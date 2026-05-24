# Session Log

> Append-only log of completed work across Claude Code sessions. New sessions read this BEFORE doing anything else, to understand what's been done.

## Sprint 0 — Documentation & Foundations (completed 2026-05-24)

### What was built
- LICENSE — PolyForm Noncommercial 1.0.0 with LandLens notice
- NOTICE.md — third-party attributions (OSM, Bhuvan/NRSC, Copernicus, AlphaEarth, MapTiler, Esri World Imagery, OpenTopoMap, Inter, Noto fonts, all major npm dependencies)
- docs/02-database-schema.md, 03-data-sources.md, 04-boundary-segmentation.md, 06-internationalization.md, 07-deployment.md, 09-contributing.md, 12-mcp-server.md, 13-admin-assistant.md, 15-enterprise-tier.md
- Basemap providers section added to CLAUDE_CODE_PROMPT.md (section 2) and docs/03-data-sources.md, with explicit reasoning for excluding Google Maps

### Key decisions locked in
- License: PolyForm Noncommercial 1.0.0 (single-license for Phase 1, dual-license commercial planned for Phase 2)
- Two-repo architecture: `landlens/` (this repo) + `landlens-segmentation/` (separate, Python, future)
- Stack: Next.js 14 App Router + TypeScript + Tailwind + Supabase (PostGIS) + Prisma + Upstash Redis + MapLibre GL JS
- Basemaps: MapTiler (streets, default), Esri World Imagery (satellite), OpenTopoMap (terrain), Bhuvan WMS (optional). Google Maps explicitly excluded (pricing tiers don't fit a pan-India consumer product, licensing forbids vector-overlay use cases, Esri+Bhuvan cover India well).
- i18n at launch: English (default), Hindi, Urdu (RTL)
- Domain: `land.trenlens.com` via Cloudflare CNAME → Vercel (DNS-only, not proxied — Vercel terminates TLS)
- AI-first patterns required from Sprint 1: Zod schemas, /api/openapi.json, public/llms.txt, structured errors, idempotency keys

### What was NOT built yet (don't redo)
- Next.js project itself (no package.json, no app/ folder)
- Database (schema designed in docs but no migrations run, no Supabase project linked)
- No code files of any kind — only docs and license

### Files that exist
- /LICENSE
- /NOTICE.md
- /CLAUDE_CODE_PROMPT.md
- /docs/README.md, 01..15 markdown files
- /.claude/SESSION_LOG.md (this file)
- /.claude/CLAUDE.md (project instructions for future sessions)
- /.claude/settings.json (pre-existing)

### Sprint 0 addendum (2026-05-24)
- Added GPS "Locate me" feature spec across CLAUDE_CODE_PROMPT.md (Core UI Elements control + new `/api/parcels/nearby` route + Mobile-First primary-CTA note + DoD item + §13 privacy bullet on GPS non-persistence), docs/02-database-schema.md (new "Common Spatial Queries" subsection with the `ST_DWithin` radius pattern using geography casts), docs/03-data-sources.md (new "User Location (GPS)" data source section, in-memory only, DPDP-aligned), docs/06-internationalization.md (new "Location Feature Copy" subsection with `locate.*` keys in en/hi/ur for launch).

### Next up
- Sprint 1 — scaffold Next.js, Tailwind, Supabase, Prisma. Set up AI-friendly foundations (Zod, OpenAPI, llms.txt, structured errors) from the start. Deploy empty site to `land.trenlens.com`.

---

*Append new sprint sections below as work progresses. Never delete or rewrite past entries — only add new ones.*

## Sprint 1 — Foundation + AI-friendliness baseline (completed 2026-05-24)

### What was built

**Repo + git**
- `git init -b main`, identity set to `Black-Lights <mohammadammar.mughees@mail.polimi.it>`
- Remote `origin` → `https://github.com/Black-Lights/landlens.git`
- GitHub repo description + homepage (`land.trenlens.com`) + topics (cadastre, gis, india, postgis, nextjs, maplibre, land-records, geospatial) set via `gh repo edit`
- Eight commits authored under `sprint-1:` prefix following the format from `.claude/CLAUDE.md`

**Next.js scaffold**
- Next.js 14.2.35 (security-patched), TypeScript strict, Tailwind, App Router, no `src/`
- Path alias `@/*` → repo root
- Tailwind extended with LandLens accent (#4F46E5) and three font families (Inter, Noto Sans Devanagari, Noto Nastaliq Urdu)
- Build verified locally: 7 routes prerendered, `/api/health` dynamic, `/api/openapi.json` static, middleware emits 38.1 kB bundle

**Dependencies installed** (locked in `package.json` + `package-lock.json`)
- `next 14.2.35`, `react 18.3`, `prisma 5.22`, `@prisma/client 5.22`
- `@supabase/supabase-js 2.46`, `@supabase/ssr 0.5`
- `@upstash/redis 1.34`, `@upstash/ratelimit 2.0`
- `maplibre-gl 4.7`, `react-map-gl 7.1`, `@turf/turf 7.1`
- `next-intl 3.26`
- `zod 3.23`, `@asteasolutions/zod-to-openapi 7.3`
- `ai 4.0`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`
- `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`

**next-intl locale routing**
- `i18n/config.ts` declares `en` (default), `hi`, `ur` with `isRtl(ur) = true`
- `i18n/request.ts` uses the v3.22+ `requestLocale` API
- `middleware.ts` routes `/`, `/en`, `/hi`, `/ur` (always-prefix); matcher excludes `/api`, `_next`, `_vercel`, static files
- `app/[locale]/layout.tsx` sets `<html lang dir>` from locale and calls `setRequestLocale` for static rendering
- `messages/{en,hi,ur}.json` are minimal stubs — real catalogs ship in Sprint 5 per scope

**Prisma schema** (`prisma/schema.prisma`)
- Full schema from `docs/02-database-schema.md`: `admin_boundaries`, `parcels` (with all boundary_source provenance columns), `parcel_corrections`, `ownership_records`, `encumbrances`, `saved_parcels`, `access_log`
- BYOK / AI-first tables: `admin_api_keys`, `admin_assistant_conversations`, `admin_assistant_messages`
- Commercial scaffolding: `api_keys`, `api_usage` (tier defaults `community`, features off)
- Geometry columns declared `Unsupported(...)` — spatial reads go via `$queryRaw`
- `extensions = [postgis, pg_trgm, pgsodium, uuidOssp]` declared
- `directUrl = env("DIRECT_URL")` so migrations bypass PgBouncer
- Generated columns, CHECK constraints, GIST/GIN indexes, partial indexes live in `prisma/sql/post-init.sql` (Prisma can't manage them) — runs once in Supabase SQL editor

**Service clients**
- `lib/db.ts` — Prisma singleton, hot-reload safe
- `lib/supabase.ts` — `supabaseAnon()` and `supabaseAdmin()` factories
- `lib/redis.ts` — returns `null` when env unset so health probes degrade rather than throw

**AI-first foundations** (mandatory from Sprint 1)
- `lib/api/errors.ts` — `ApiError` class with 12 stable codes (`PARCEL_NOT_FOUND`, `VALIDATION_FAILED`, `IDEMPOTENCY_KEY_REUSED`, …) and `withErrors()` wrapper. Failures return `{ error: { code, message, suggested_action, docs_url } }`. ZodError gets auto-translated to `VALIDATION_FAILED`.
- `lib/api/idempotency.ts` — `Idempotency-Key` header on POST/PUT/PATCH/DELETE. Hashes `(method+path+key)` into Redis with 24h TTL, replays stored response on retry, rejects key reuse with divergent payload. Degrades to pass-through when Upstash is unconfigured.
- `lib/api/openapi.ts` — `zod-to-openapi` registry. Routes register their schemas; `generateOpenApiDocument()` emits OpenAPI 3.1 tagged with PolyForm-NC license.
- `app/api/openapi.json/route.ts` — serves the spec, edge-cached 5 min, SWR 24h
- `public/llms.txt` — site description for AI agents (concepts, endpoints, conventions, license, source repo)
- `public/robots.txt` — allow `/`, disallow `/api/`, points humans to `/llms.txt`

**API routes**
- `GET /api/health` — `{ status, db, redis, version, timestamp }`. Each dependency reports `ok` / `down` / `unconfigured` independently; overall status is `ok` only when all are `ok`.
- `GET /api/openapi.json` — auto-generated spec (already covered above)

**Brand assets** (added late in Sprint 1 alongside the foundations)
- `public/brand/logo.svg` — full lockup (icon + wordmark). Strokes use `currentColor` so the wordmark inherits the parent's text color.
- `public/brand/icon.svg` — square icon-only, also `currentColor`.
- `public/brand/app-icon.svg` — 512×512 solid-indigo background with white strokes. Source for PWA / app store icons and raster outputs.
- `public/favicon.svg` — small-size optimized icon with fixed colors (slate-900 strokes, indigo highlight).
- `public/favicon.ico` — multi-resolution (16/32/48) generated from `app-icon.svg` via `scripts/generate-favicons.ts`.
- `public/apple-touch-icon.png` — 180×180 iOS home-screen icon, generated from the same script.
- `public/brand/og-image.png` — 1200×630 social preview, generated by compositing `logo.svg` centered on a white canvas.
- `scripts/generate-favicons.ts` — `sharp` + `png-to-ico` regen pipeline. Wired as `npm run brand:generate`. Devdeps added: `sharp`, `png-to-ico`, `tsx`.
- `components/nav/Logo.tsx` — inline-SVG React component with `variant` (`full` | `icon`) and `theme` (`light` | `dark` | `auto`) props. `auto` uses Tailwind `dark:` to follow the system color scheme.
- `app/layout.tsx` — Metadata API wired with `icons` (favicon.svg + favicon.ico + apple-touch-icon), `openGraph`, `twitter:summary_large_image`, and a templated `<title>` (`%s · LandLens`). `metadataBase` reads `NEXT_PUBLIC_SITE_URL`.
- `docs/16-brand-guidelines.md` — plain-language explainer of the mark, palette, do's and don'ts; matches the style of existing docs.
- `docs/README.md` — index updated with the new doc row.
- `README.md` — replaced the earlier scaffold-only version with the branded README (centered logo, three shields-io badges, links to docs/SECURITY).
- `SECURITY.md` — disclosure policy with `mohammadammar.mughees@mail.polimi.it` as the contact (the user supplied this email directly; no placeholder remains in the file).

**Documentation**
- `.env.example` — every env var from CLAUDE_CODE_PROMPT §17 plus `DIRECT_URL` (for migrations) and `CRON_SECRET`. Commercial flags default `false`.

### Decisions taken this sprint
- **Bumped Next.js to 14.2.35** (from the originally-pinned 14.2.18) — npm flagged 14.2.18 for a security advisory ([security update 2025-12-11](https://nextjs.org/blog/security-update-2025-12-11)). Staying within 14.2.x to avoid a major framework jump in Sprint 1.
- **Prisma uses `Unsupported(...)` for all geometry columns.** Spatial work goes through `db.$queryRaw\`...\`` with bound parameters. Documented in the schema comments and in `docs/02-database-schema.md`. No JS-side geometry helpers in Sprint 1 — those land with the first real spatial query in Sprint 2.
- **next-intl `setRequestLocale` adopted** so locale pages prerender statically. Without it the build errored on `headers()` opt-out. This is the documented next-intl pattern for App Router + static rendering.
- **Health check separates `down` from `unconfigured`.** In local dev a missing `DATABASE_URL` should not look the same as a Supabase outage.
- **Idempotency middleware is a no-op when Redis is missing.** Production deploys must set `UPSTASH_REDIS_REST_URL` — this is called out in `.env.example` and the README quick start.
- **`directUrl` added to Prisma datasource.** `DATABASE_URL` will use the pooled (PgBouncer, port 6543) Supabase URL; `DIRECT_URL` uses port 5432 for migrations. Critical for `prisma migrate dev` to work.

### Env vars the user must fill before `npm run dev` works against real data
Open `.env.example` and copy to `.env.local`. The following need real values:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase project → Settings → API
- `DATABASE_URL` (pooled, port 6543) and `DIRECT_URL` (direct, port 5432) — Supabase project → Settings → Database → Connection string
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — Upstash console → REST API tab
- `NEXT_PUBLIC_MAPTILER_KEY` — optional, only needed once Sprint 2 lands

The rest (segmentation, MCP, Vault, cron) stay empty during Phase 1.

### Manual steps the user still needs to do
The session covers everything codeable. Three manual steps remain:

**1. Create the Supabase project**
- Go to <https://supabase.com> → New project
- Choose region near India (Singapore / Mumbai)
- Save the password
- Settings → API: copy `URL`, `anon key`, `service_role key` into `.env.local`
- Settings → Database → Connection pooling: copy the *pooled* string into `DATABASE_URL`
- Settings → Database → Connection string: copy the *direct* string into `DIRECT_URL`
- SQL Editor → run once:
  ```sql
  CREATE EXTENSION IF NOT EXISTS postgis;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS pgsodium;
  ```
- Locally: `npx prisma migrate dev --name init`
- SQL Editor → run `prisma/sql/post-init.sql` (paste contents) to add GIST/GIN indexes, generated columns, CHECK constraints Prisma can't manage

**2. Create the Upstash Redis database**
- Go to <https://upstash.com> → Create database → Region near India
- REST API tab → copy URL and token into `.env.local`

**3. Deploy to Vercel + wire Cloudflare DNS**
- Push to GitHub (this session already wired the remote; the next session can `git push -u origin main` once you confirm credentials)
- <https://vercel.com> → Add New Project → Import `Black-Lights/landlens`
- Framework auto-detects Next.js
- Environment Variables: paste every key from `.env.local` for Production, Preview, and Development environments
- Click Deploy — the auto-generated `*.vercel.app` URL should work
- Vercel → Project → Settings → Domains → Add `land.trenlens.com`
- Cloudflare DNS for `trenlens.com`:
  - Type: `CNAME`
  - Name: `land`
  - Target: `cname.vercel-dns.com`
  - Proxy: **DNS only (gray cloud, NOT orange)** — Vercel needs to terminate TLS itself
  - TTL: Auto
- Wait ~1 minute, Vercel issues the SSL cert automatically

After all three, visit `https://land.trenlens.com/api/health` — it should return `{ status: "ok", db: "ok", redis: "ok", … }`.

### What was deferred (per scope, not skipped accidentally)
- Map rendering, basemap switcher, layer panel → Sprint 2
- Parcel data seeding (`turf.js` voronoi mock parcels, datameet boundary ingest, faker owners) → Sprint 3
- Real i18n catalogs (all UI strings translated to en/hi/ur with RTL polish) → Sprint 5; folder structure + locale routing are ready
- Supabase Auth wiring, OTP login, saved parcels → Sprint 6
- MCP server (`packages/landlens-mcp`) → Sprint 12
- BYOK admin assistant at `/admin/assistant` → Sprint 13
- Rate-limit middleware wiring on every route → Sprint 14 (the deps are installed, but the actual `@upstash/ratelimit` wrapper isn't bound to handlers yet)

### Files added this sprint
```
.env.example
.eslintrc.json
.gitignore
README.md
SECURITY.md
app/
  globals.css
  layout.tsx
  [locale]/
    layout.tsx
    page.tsx
  api/
    health/route.ts
    openapi.json/route.ts
components/
  nav/Logo.tsx
docs/
  16-brand-guidelines.md
i18n/
  config.ts
  request.ts
lib/
  db.ts
  redis.ts
  supabase.ts
  api/
    errors.ts
    idempotency.ts
    openapi.ts
messages/
  en.json
  hi.json
  ur.json
middleware.ts
next.config.mjs
package.json
package-lock.json
postcss.config.js
prisma/
  schema.prisma
  sql/post-init.sql
public/
  apple-touch-icon.png
  favicon.ico
  favicon.svg
  llms.txt
  robots.txt
  brand/
    app-icon.svg
    icon.svg
    logo.svg
    og-image.png
scripts/
  generate-favicons.ts
tailwind.config.ts
tsconfig.json
```

### Prompt for the next session (Sprint 2 — Map)
> Read .claude/SESSION_LOG.md first so you understand what Sprint 1 already shipped. Then begin Sprint 2 — Map.
> Scope: MapLibre GL integration, India state boundaries as vector tiles, hierarchical drill-down zoom (state → district → tehsil → village), BasemapSwitcher (MapTiler streets default, Esri World Imagery satellite, OpenTopoMap terrain, Bhuvan WMS optional), AttributionFooter that swaps strings on basemap change, Breadcrumb, ScaleBar, CoordinateReadout, ZoomControls, "Locate me" button with the GPS feature spec from CLAUDE_CODE_PROMPT §4. Do NOT seed parcels yet — that's Sprint 3.
> Before doing anything, confirm the user has the Supabase + Upstash env vars filled and `prisma migrate dev` + `prisma/sql/post-init.sql` have been run. The site should boot locally on `npm run dev` and `/api/health` should return `db: 'ok'`.

