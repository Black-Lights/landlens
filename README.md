# LandLens

> *See Every Inch of Land*

A unified pan-India cadastral platform. Click any plot of land on the map and see who owns it, who owned it before, area, type, and history. Solves the problem of 28+ fragmented state land record portals.

**Status:** Phase 1 — non-commercial open source ([PolyForm Noncommercial 1.0.0](./LICENSE)). Academic/thesis-aligned. Commercial dual-license planned for Phase 2.

## Quick start

```bash
npm install
cp .env.example .env.local        # fill in Supabase + Upstash values
npx prisma generate
npx prisma migrate dev --name init
# Then in the Supabase SQL editor, run prisma/sql/post-init.sql
# (adds GIST indexes, CHECK constraints, generated columns Prisma can't manage)
npm run dev
```

Open <http://localhost:3000>. You should be redirected to `/en`.

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 App Router + TypeScript |
| Map | MapLibre GL JS + react-map-gl (no Google Maps) |
| DB | Supabase Postgres 15 + PostGIS 3.4 + pg_trgm + pgsodium |
| ORM | Prisma (`Unsupported` geometry columns, raw SQL for spatial work) |
| Cache | Upstash Redis |
| Auth | Supabase Auth (Sprint 6) |
| i18n | next-intl — English, Hindi, Urdu (RTL) at launch |
| Hosting | Vercel + Supabase + Cloudflare DNS (`land.trenlens.com`) |

## AI-first foundations (Sprint 1)

LandLens is built so AI agents can read it and operate it as first-class users.

- **`/api/openapi.json`** — auto-generated OpenAPI 3.1 from Zod schemas (`lib/api/openapi.ts`).
- **`public/llms.txt`** — human-readable site description for AI agents at the site root.
- **Structured errors** — every failure returns `{ error: { code, message, suggested_action, docs_url } }` (`lib/api/errors.ts`).
- **Idempotency** — `Idempotency-Key` header on mutations, replay-cached in Redis for 24h (`lib/api/idempotency.ts`).
- **`/api/health`** — liveness + dependency health (Postgres, Redis).

See [`docs/11-ai-first-architecture.md`](./docs/11-ai-first-architecture.md).

## Two-repo architecture

This is `landlens/` — the website. A separate `landlens-segmentation/` (Python + FastAPI + PyTorch) handles AI parcel boundary detection. The website degrades gracefully when it's absent. See [`docs/01-architecture.md`](./docs/01-architecture.md).

## Docs

| # | Doc | What it covers |
|---|---|---|
| 01 | [Architecture](./docs/01-architecture.md) | The big picture |
| 02 | [Database Schema](./docs/02-database-schema.md) | What we store and why |
| 03 | [Data Sources](./docs/03-data-sources.md) | Government, open, AI |
| 04 | [Boundary Segmentation](./docs/04-boundary-segmentation.md) | How polygons get drawn |
| 06 | [Internationalization](./docs/06-internationalization.md) | en / hi / ur, RTL |
| 07 | [Deployment](./docs/07-deployment.md) | How LandLens ships |
| 11 | [AI-First Architecture](./docs/11-ai-first-architecture.md) | MCP, BYOK, OpenAPI |
| 14 | [Licensing](./docs/14-licensing.md) | PolyForm now → commercial later |

Full index: [`docs/README.md`](./docs/README.md).

## License

[PolyForm Noncommercial 1.0.0](./LICENSE). Third-party attributions in [`NOTICE.md`](./NOTICE.md).
