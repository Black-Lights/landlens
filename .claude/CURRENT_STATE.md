# LandLens — Current State

> One-page summary of what's live right now. New sessions read this first.
> Historical detail for each sprint lives in `.claude/archive/sprint-N.md`.

## Currently working on
**Sprint 4 — Search** (not yet started)

## What's live at https://land.trenlens.com

India map with full drill-down (India → State → District → Village → Parcel). Four basemaps (Streets, Satellite + labels, Terrain, Bhuvan WMS). GPS Locate Me with parcels-nearby highlighting. Parcel sidebar with mock ownership data. 374 parcels seeded across 10 villages in Pune Rural with 715 ownership records.

## Stack snapshot
- Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui
- Supabase (PostGIS + pg_trgm + pgsodium), Prisma
- Upstash Redis, MapLibre GL JS, next-intl
- Deployed on Vercel via `land.trenlens.com` (Cloudflare DNS only)

## Completed sprints
- Sprint 0 — docs + license (see archive/sprint-0.md)
- Sprint 1 — Next.js foundation + Supabase + deploy (see archive/sprint-1.md)
- Sprint 2 — Map + basemaps + GPS (see archive/sprint-2.md)
- Sprint 3 — Drill-down + mock parcels + sidebar (see archive/sprint-3.md)

## Known issues / deferred
- Mock parcels are circular voronoi (real cadastral shapes come in Sprint 7)
- Only Maharashtra districts bundled (other states show structured 404 with download hint)
- Mock parcel sizes are 10-50 ha instead of realistic 0.5-2 ha — deferred to Sprint 7
- Real cadastral scraper data deferred to Sprint 7

## Next sprint prompt

> Read `.claude/CURRENT_STATE.md` first; Sprint 3 closes with full drill-down state→district→village→parcel and 374 mock parcels seeded in Pune Rural. Begin Sprint 4 — Search & Discovery.
> Scope: command palette (Cmd/Ctrl+K) with three tabs (Places, Khasra, People), Postgres `pg_trgm` fuzzy search across `admin_boundaries.name_en`, `parcels.khasra_no`, and `ownership_records.owner_name_en`. A `/api/search?q=<text>&tab=<…>&limit=10` route returning ranked results with `flyTo` targets. Recent-searches list persisted in localStorage. Sidebar "Open in Google Maps / OSM" external links. Maybe a "Share this parcel" → copies a URL with `#parcel=<uuid>` that re-opens the sidebar on load.
> Don't build: auth + saved bookmarks (Sprint 6), real scraper data (Sprint 7), i18n catalogs (Sprint 5).
> Before doing anything, confirm `npm run dev` boots and the homepage renders the map with Pune Rural drill-down working (click Maharashtra → districts paint, click Pune → villages paint, click a village → parcels paint, click a parcel → sidebar opens).
