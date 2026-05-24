# LandLens — Current State

> One-page summary of what's live right now. New sessions read this first.
> Historical detail for each sprint lives in `.claude/archive/sprint-N.md`.

## Currently working on
**Sprint 7 — Real cadastral data + parcel correction queue** (not yet started)

## What's live at https://land.trenlens.com

Trilingual India map (English / हिन्दी / اردو) with full drill-down (India → State → District → Village → Parcel). Four basemaps (Streets, Satellite + labels, Terrain, Bhuvan WMS). GPS Locate Me with parcels-nearby highlighting. Parcel sidebar with mock ownership data and an action row — Save (heart, optimistic), Share (copies `/<locale>/?parcel=<uuid>`), Download (GeoJSON / KML / one-page PDF). Sidebar still slides from the right in LTR, from the left in RTL, with locale-aware date and number formatting. Command palette search (Cmd/Ctrl+K) across states, districts, villages, khasra numbers, and owners. Header carries a globe-icon language switcher and a sign-in pill that turns into an initials avatar when authenticated; the avatar menu links to **Saved parcels**, **Settings**, and **Sign out**. Magic-link email + Google OAuth via `@supabase/ssr`; OAuth callback at `/auth/callback`. Logged-in users get a `/[locale]/saved` page with MapTiler static-map thumbnails. Every parcel detail view writes an audit row to `access_log` (SHA-256 hashed IP, monthly-rotating salt, bot UAs skipped). Each parcel has its own share-friendly URL `/[locale]/parcel/<uuid>` with a dynamic 1200×630 OG card. Sitemap with hreflang alternates, branded `not-found` + `error` pages, and `?parcel=` / `?signin=` deep links on the map.

## Stack snapshot
- Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui
- Supabase (PostGIS + pg_trgm + pgsodium) + `@supabase/ssr`, Prisma
- Upstash Redis, MapLibre GL JS, next-intl
- `@react-pdf/renderer` + `tokml` for downloadable parcel reports
- Locale-scoped fonts via `next/font/google` (Inter / Noto Sans Devanagari / Noto Nastaliq Urdu)
- Deployed on Vercel via `land.trenlens.com` (Cloudflare DNS only)

## Completed sprints
- Sprint 0 — docs + license (see archive/sprint-0.md)
- Sprint 1 — Next.js foundation + Supabase + deploy (see archive/sprint-1.md)
- Sprint 2 — Map + basemaps + GPS (see archive/sprint-2.md)
- Sprint 3 — Drill-down + mock parcels + sidebar (see archive/sprint-3.md)
- Sprint 4 — Search palette + `/api/search` (see archive/sprint-4.md)
- Sprint 5 — i18n catalogs, language switcher, RTL polish, locale fonts (see archive/sprint-5.md)
- Sprint 6 — Auth, saved parcels, exports, audit log, OG image, sitemap, error pages (see archive/sprint-6.md)

## Known issues / deferred

- Mock parcels are circular voronoi (real cadastral shapes come in Sprint 7)
- Only Maharashtra districts bundled (other states show structured 404 with download hint)
- Mock parcel sizes are 10-50 ha instead of realistic 0.5-2 ha — deferred to Sprint 7
- Real cadastral scraper data deferred to Sprint 7
- Search `state=` scoping is wired in the API but UI-less today (single-state demo data); surfaces as a chip once Sprint 7 lands multi-state rows
- Cross-script search now works for any row with `name_en` + `name_hi`/`name_local` (Maharashtra + Pune-Rural seed all carry both); pluggable transliteration for partial-data rows deferred to Sprint 7
- Lighthouse run not yet executed against the deployed preview — settings/perf work is wired (per-locale meta description, image dims, ARIA labels, font preload via next/font) but the actual audit happens after the next Vercel deploy
- Bulk export route (`POST /api/exports/bulk`) + the 100-parcel gate via `ENABLE_BULK_EXPORT_UNLIMITED` deferred until a Sprint 7+ feature needs it
- Settings page is a stub (full preferences out of scope in Sprint 6)
- Saved-parcel labels / notes: DB + API accept them, UI doesn't expose them yet
- "Parcel correction queue" UI deferred to Sprint 8+
- Regional languages beyond hi/ur (Marathi `mr`, Tamil, Bengali, etc.) — Phase 2

## Manual steps still owed (post Sprint 6)

These can't be done from the codebase. Track them in the project notes:

1. Supabase Auth → URL Configuration: set Site URL to `https://land.trenlens.com`. Add redirect URLs `https://land.trenlens.com/auth/callback` and `http://localhost:3000/auth/callback`.
2. Supabase Auth → Providers: enable Email + Google.
3. GCP Console: create OAuth 2.0 Web Client. Authorized redirect URI = `https://<project-ref>.supabase.co/auth/v1/callback`. Paste id + secret into Supabase's Google provider.
4. Supabase SQL Editor: run `prisma/sql/rls-policies.sql` (idempotent).
5. Vercel env vars: add `IP_HASH_SALT` (any random 32-byte hex string — see `.env.example` for the one-line generator).

## Next sprint prompt

> Read `.claude/CURRENT_STATE.md` first; Sprint 6 closes with Supabase Auth wired in (magic-link + Google), saved-parcel bookmarks with a `/[locale]/saved` page, RLS policies for all user-scoped tables, hashed-IP audit logging, per-format export (GeoJSON / KML / PDF), dynamic per-parcel OpenGraph images, sitemap + hreflang, branded 404/500 pages, and full i18n coverage for every new string. Begin Sprint 7 — Real cadastral data + parcel correction queue.
> Scope: build the first real cadastral scraper — start with **Maharashtra Mahabhumi (Pune district)**. Scraper lives in `scripts/scrape/maharashtra.ts`, runs nightly via Vercel Cron, dumps raw JSON into `raw_data` and structured fields into `parcels` + `ownership_records`. Boundary geometries come from FMB reconstructions where available, AI-with-constraints (Sprint 11 hand-off shape) for the rest — but Sprint 7 only needs to wire the column + source provenance, not the AI itself. Add a `boundary_source` chip on the parcel sidebar reflecting real provenance. Replace the circular-voronoi mock parcels for Pune with real footprints. Add parcel-correction UI: a "Report incorrect boundary" link in the sidebar opens a dialog that captures the user's drawn polygon (MapLibre Draw) + a free-text reason; submits to `POST /api/parcel-corrections` (RLS-protected). Build `/[locale]/admin/corrections` (service-role page behind an env-gated allowlist of admin emails) to triage pending corrections — approve writes to `parcels.geom`, reject leaves the record archived.
> Don't build: AI segmentation worker (Sprint 11), MCP server (Sprint 12), admin AI assistant (Sprint 13), other states' scrapers (one at a time).
> Before doing anything, confirm `npm run dev` boots, magic-link sign-in works locally, you can save a parcel + download its PDF, and `npm run typecheck` + `npm run lint` + `npm run build` are clean.
