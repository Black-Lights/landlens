# 07 — Deployment

> How LandLens ships to `land.trenlens.com`. The website only. The AI service has its own deployment story (see [AI Service](./08-ai-service.md)).

## What We Deploy Where

| Component | Host | Plan | Why |
|---|---|---|---|
| Next.js app | Vercel | Hobby (free) → Pro ($20/mo when needed) | First-class Next.js host, edge functions, free SSL |
| PostgreSQL + PostGIS | Supabase | Free → Pro ($25/mo) | PostGIS preinstalled, generous free tier |
| Redis cache | Upstash | Free | Per-command billing, HTTP API, edge-friendly |
| Map tiles | MapTiler | Free (100k tiles/mo) | Or OpenFreeMap when we self-host |
| Domain | Cloudflare DNS | Free | `trenlens.com` is already there |

Total monthly cost for MVP: **₹0**.

## Domain: `land.trenlens.com`

A subdomain of an existing apex (`trenlens.com`), pointed at Vercel via CNAME.

```
Zone:    trenlens.com (Cloudflare)
Record:  CNAME
Name:    land
Target:  cname.vercel-dns.com
Proxy:   DNS only  ← gray cloud, NOT orange
TTL:     Auto
```

**Why DNS-only, not proxied (orange cloud):**
Vercel needs to terminate TLS itself to issue and renew its Let's Encrypt certificate. Cloudflare's proxy would intercept TLS and break that. The proxy gains us nothing for a Vercel-hosted site — Vercel already runs at the edge.

Then in Vercel: Project Settings → Domains → Add `land.trenlens.com`. SSL is issued automatically in roughly one minute.

## Environments

Three environments, all on the same Vercel project:

| Env | URL | Database | Trigger |
|---|---|---|---|
| Production | `land.trenlens.com` | Supabase production project | Push to `main` |
| Preview | `landlens-git-<branch>.vercel.app` | Supabase production project (read-only) | Every push to a non-main branch |
| Local | `localhost:3000` | Local Supabase (`supabase start`) or remote dev project | `npm run dev` |

**Important:** Preview deploys connect to the production database in **read-only** mode. They run real queries against real data, but cannot mutate. This is enforced by using a read-only PostgreSQL role in the preview environment's `DATABASE_URL`.

## Environment Variables

Configured in Vercel's project settings, separately per environment:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server-only, never NEXT_PUBLIC
DATABASE_URL                      # read-only role in Preview

# Upstash
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

# Maps
NEXT_PUBLIC_MAPTILER_KEY          # optional

# Site
NEXT_PUBLIC_SITE_URL              # https://land.trenlens.com in prod

# Phase 2: AI segmentation (empty in Phase 1 — site degrades gracefully)
SEGMENTATION_SERVICE_URL
SEGMENTATION_API_KEY
GEE_SERVICE_ACCOUNT_KEY
GEE_PROJECT_ID

# AI-first
MCP_SERVER_ADMIN_TOKEN
VAULT_ENCRYPTION_KEY

# Feature flags (default false in Phase 1)
ENABLE_BULK_EXPORT_UNLIMITED=false
ENABLE_POSTGIS_DIRECT_ACCESS=false
ENABLE_ENCROACHMENT_DETECTION=false
ENABLE_WHITE_LABEL=false
```

`.env.local` for local dev — never committed. `.env.example` for documentation — committed.

## Build & Deploy Flow

```
git push origin main
   │
   ▼
Vercel receives webhook
   │
   ▼
npm install
   ▼
prisma generate            ← types must exist before build
   ▼
next build                  ← static + RSC + edge
   ▼
deploy edge functions to all regions
   ▼
issue/renew TLS for land.trenlens.com
   ▼
production traffic cuts over (zero-downtime)
```

Total wall-clock: ~90 seconds for a typical change.

## Database Migrations

Prisma migrations run **outside** the Vercel build. The Vercel build is read-only against the schema.

```
Local:     prisma migrate dev --name <description>
           → creates migration file
           → applies to local DB
           → commit migration file to git

CI:        On merge to main, GitHub Action runs:
             prisma migrate deploy
           → applies pending migrations to production Supabase
           → never generates new migrations, only applies committed ones
```

This separation matters because Vercel builds run in parallel (preview branches) and we cannot have parallel processes attempting schema mutations.

PostGIS extension enablement is **one-time, manual** in the Supabase SQL editor — Prisma can't manage extensions:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgsodium;
```

## Edge vs. Node Runtime

We use **Vercel Edge runtime** for read-heavy, latency-sensitive API routes:

- `/api/boundaries/*` — vector tile serving
- `/api/parcels/at` — point-in-polygon lookup
- `/api/parcels/in-bbox` — viewport query
- `/api/tiles/*` — MVT tile endpoints

We use **Node runtime** where edge can't help:

- `/api/parcels/:id/export` — PDF generation (Node-only libs)
- `/api/chat` — admin assistant streaming (uses Node-only AI SDK features)
- Scrapers (run as cron jobs, not in the request path)
- Any route that touches Prisma (Prisma requires Node)

Edge routes use `@supabase/supabase-js` directly with raw SQL via `rpc()` — no Prisma. The handful of edge endpoints are documented in `lib/edge-queries.ts`.

## Caching Strategy

Three layers, in order of cheapness:

1. **Vercel Edge Cache** — `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800` on stable resources (admin boundaries, vector tiles)
2. **Upstash Redis** — application-level cache for parcel detail (1h TTL), GeoJSON for boundaries (24h TTL)
3. **Postgres** — source of truth, always the last resort

Cache invalidation is tag-based via Vercel's `revalidateTag`:
- `boundaries:<lgd_code>` — invalidated when an admin boundary is updated
- `parcel:<id>` — invalidated on correction approval or fresh scrape

## Rate Limiting

Every API route is wrapped in `@upstash/ratelimit` middleware:

```
Public (unauthenticated)   60 req/min/IP
Authenticated (community)   600 req/min/user
Developer tier              6,000 req/min/api_key
Business tier               60,000 req/min/api_key
Enterprise                  custom
```

Tier is read from `api_keys.tier` for authenticated calls; IP-based bucket for unauthenticated.

## Cron Jobs

Defined in `vercel.json`. Some are stubbed in Phase 1:

```json
{
  "crons": [
    { "path": "/api/cron/refresh-tiles",      "schedule": "0 3 * * *" },
    { "path": "/api/cron/scrape-mahabhumi",   "schedule": "0 2 * * *" },
    { "path": "/api/cron/ai-batch-segment",   "schedule": "0 4 * * *" },
    { "path": "/api/cron/usage-rollup",       "schedule": "0 0 * * *" }
  ]
}
```

Each handler reads `process.env.CRON_SECRET` to reject unauthorized invocations.

## Observability

- **Vercel Analytics** — page views, Core Web Vitals
- **Vercel Logs** — request logs, edge function output
- **Supabase Logs** — slow queries, errors
- **Sentry** (added in Sprint 15) — error tracking with source maps

We do not run our own observability stack in Phase 1. The hosted offerings are free at our scale.

## Rollback

Vercel keeps every deployment. Rollback is one click:

```
Dashboard → Deployments → previous deployment → "Promote to Production"
```

Sub-30-second cutover, no DNS change. The previous deployment's environment variables are snapshotted with it, so rollback is fully atomic.

Database rollback is not atomic with code rollback. Prisma migrations are forward-only by convention — we don't write `down` migrations. To revert a schema change, write a new migration that undoes it.

## Pre-Launch Checklist

Before flipping `land.trenlens.com` live:

- [ ] All three locales (en, hi, ur) render without missing-key warnings
- [ ] RTL audit passes for Urdu (`/dev/i18n-audit`)
- [ ] Lighthouse Production: Performance > 85, Accessibility > 95
- [ ] All API routes rate-limited
- [ ] `public/robots.txt` allows `/`, blocks `/api/`
- [ ] `public/llms.txt` published
- [ ] `/api/openapi.json` returns a valid spec
- [ ] Audit logging writes on every parcel detail view
- [ ] Owner names masked for unauthenticated users
- [ ] Disclaimer banner present on every parcel detail view
- [ ] `LICENSE` and `NOTICE.md` present in repo root
- [ ] OG image generation works for `/parcel/:id`
- [ ] Sentry DSN configured (if Sprint 15 reached)
- [ ] 404 and 500 pages localized

## What's Next

→ Read [AI Service](./08-ai-service.md) for how the separate Python service deploys.
