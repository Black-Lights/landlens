# LandLens — Current State

> One-page summary of what's live right now. New sessions read this first.
> Historical detail for each sprint lives in `.claude/archive/sprint-N.md`.

## Currently working on
**Sprint 5 — i18n catalogs & share** (not yet started)

## What's live at https://land.trenlens.com

India map with full drill-down (India → State → District → Village → Parcel). Four basemaps (Streets, Satellite + labels, Terrain, Bhuvan WMS). GPS Locate Me with parcels-nearby highlighting. Parcel sidebar with mock ownership data. **Command palette search** (Cmd/Ctrl+K or top-left button) across states, districts, villages, khasra numbers, and owners — pg_trgm ranked, multilingual-ready, with recent-searches localStorage. 374 parcels seeded across 10 villages in Pune Rural with 715 ownership records.

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
- Sprint 4 — Search palette + `/api/search` (see archive/sprint-4.md)

## Known issues / deferred
- Mock parcels are circular voronoi (real cadastral shapes come in Sprint 7)
- Only Maharashtra districts bundled (other states show structured 404 with download hint)
- Mock parcel sizes are 10-50 ha instead of realistic 0.5-2 ha — deferred to Sprint 7
- Real cadastral scraper data deferred to Sprint 7
- Search `state=` scoping is wired in the API but UI-less today (single-state demo data); surfaces as a chip once Sprint 7 lands multi-state rows
- Cross-script search (typing English to find a Devanagari-only row) requires both `name_en` and `name_hi`/`name_local` to be populated — works on rows that have both; pluggable transliteration deferred to Sprint 7

## Next sprint prompt

> Read `.claude/CURRENT_STATE.md` first; Sprint 4 closes with `/api/search` live (5 entity types, pg_trgm ranking, ancestors + bbox/centroid for flyTo) and a `Cmd+K` command palette wired into the map. Begin Sprint 5 — i18n & share.
> Scope: next-intl message catalogs for the three launch locales (`en`, `hi`, `ur`) covering Breadcrumb, BasemapSwitcher, LocateMe, ParcelSidebar, OwnershipTimeline, SearchPalette, structured-error messages. RTL polish for Urdu (`dir="rtl"`, mirrored padding/icons via `rtl:` utilities). Share link: `?parcel=<uuid>` (or `#parcel=…`) opens the sidebar on load + a "Share" button on the sidebar that copies the canonical URL. "Open in Google Maps / OSM" external links on the sidebar header. Locale switcher in the top nav (small flag/text trio).
> Don't build: auth + saved bookmarks (Sprint 6), real scraper data (Sprint 7), AI assistant (Sprint 13).
> Before doing anything, confirm `npm run dev` boots, `Cmd+K` opens the palette, typing `pune` shows the Pune Rural district result, and selecting it zooms + paints the village layer.
