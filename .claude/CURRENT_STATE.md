# LandLens — Current State

> One-page summary of what's live right now. New sessions read this first.
> Historical detail for each sprint lives in `.claude/archive/sprint-N.md`.

## Currently working on
**Sprint 6 — Auth & saved bookmarks** (not yet started)

## What's live at https://land.trenlens.com

Trilingual India map (English / हिन्दी / اردو) with full drill-down (India → State → District → Village → Parcel). Four basemaps (Streets, Satellite + labels, Terrain, Bhuvan WMS). GPS Locate Me with parcels-nearby highlighting. Parcel sidebar with mock ownership data — slides from the right in LTR, from the left in RTL, with locale-aware date and number formatting. **Command palette search** (Cmd/Ctrl+K or top-left button) across states, districts, villages, khasra numbers, and owners — pg_trgm ranked, cross-script ready (matches both `Pune` and `पुणे`), with recent-searches localStorage. 374 parcels seeded across 10 named Pune Rural villages with 715 ownership records — `admin_boundaries` now carries `name_hi` and `name_local` for Maharashtra, Pune Rural, and every seeded village. **Language switcher** (globe icon, top-right) toggles locale via URL prefix + `NEXT_LOCALE` cookie; first-visit detection honours `Accept-Language`.

## Stack snapshot
- Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui
- Supabase (PostGIS + pg_trgm + pgsodium), Prisma
- Upstash Redis, MapLibre GL JS, next-intl
- Locale-scoped fonts via `next/font/google` (Inter / Noto Sans Devanagari / Noto Nastaliq Urdu)
- Deployed on Vercel via `land.trenlens.com` (Cloudflare DNS only)

## Completed sprints
- Sprint 0 — docs + license (see archive/sprint-0.md)
- Sprint 1 — Next.js foundation + Supabase + deploy (see archive/sprint-1.md)
- Sprint 2 — Map + basemaps + GPS (see archive/sprint-2.md)
- Sprint 3 — Drill-down + mock parcels + sidebar (see archive/sprint-3.md)
- Sprint 4 — Search palette + `/api/search` (see archive/sprint-4.md)
- Sprint 5 — i18n catalogs, language switcher, RTL polish, locale fonts (see archive/sprint-5.md)

## Known issues / deferred
- Mock parcels are circular voronoi (real cadastral shapes come in Sprint 7)
- Only Maharashtra districts bundled (other states show structured 404 with download hint)
- Mock parcel sizes are 10-50 ha instead of realistic 0.5-2 ha — deferred to Sprint 7
- Real cadastral scraper data deferred to Sprint 7
- Search `state=` scoping is wired in the API but UI-less today (single-state demo data); surfaces as a chip once Sprint 7 lands multi-state rows
- Cross-script search now works for any row with `name_en` + `name_hi`/`name_local` (Maharashtra + Pune-Rural seed all carry both); pluggable transliteration for partial-data rows deferred to Sprint 7
- "Share parcel" link/button on the sidebar deferred to Sprint 6 (was originally drafted into Sprint 5's prompt but cut to keep this sprint i18n-only)
- Regional languages beyond hi/ur (Marathi `mr`, Tamil, Bengali, etc.) — Phase 2

## Next sprint prompt

> Read `.claude/CURRENT_STATE.md` first; Sprint 5 closes with the app fully trilingual — full `en`/`hi`/`ur` message catalogs, a globe-icon language switcher, locale-scoped Devanagari + Nastaliq fonts, RTL polish for Urdu (sidebar slides from the left, chevrons mirror, map controls stay put), and the Pune Rural seed now carrying `name_hi` + `name_local` for cross-script search. Begin Sprint 6 — Auth & saved bookmarks.
> Scope: Supabase Auth wired in (magic-link email + Google OAuth, `@supabase/ssr` helpers, server-side session via cookies). Sign-in page at `/[locale]/sign-in` with a clean translated form, magic-link callback at `/[locale]/auth/callback`, sign-out action. `saved_parcels` CRUD: a heart icon on `ParcelSidebar` that toggles save state for the current user (optimistic, rollback on error), a `/[locale]/saved` page listing the user's parcels with a small map preview + remove. RLS policies on `saved_parcels` (user can only read/write their own rows). Add a small avatar/sign-in button to the top-right of the map (next to the language switcher). "Share parcel" button on the sidebar header copies the canonical `/<locale>/?parcel=<uuid>` URL and opens the sidebar on load when that param is present. Translate every new UI string in all three locales.
> Don't build: AI assistant (Sprint 13), real scraper data (Sprint 7), parcel correction queue (Sprint 8+).
> Before doing anything, confirm `npm run dev` boots, the globe button switches between en/hi/ur, the parcel sidebar opens with localised area/date formats, and `npm run typecheck` + `npm run lint` are clean.
