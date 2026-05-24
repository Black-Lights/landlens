# Sprint 6 — Auth & Polish

Sprint 6 turns LandLens from an open map into a signed-in product: magic-link
auth, saved parcels, downloadable exports, audit logging, and the brand polish
needed to ship socially-shareable parcel pages.

## What landed

| Area | What | Where |
| --- | --- | --- |
| Auth core | `@supabase/ssr` server + browser clients, monthly-rotating cookie refresh layered onto next-intl | [lib/supabase/server.ts](../../lib/supabase/server.ts), [lib/supabase/client.ts](../../lib/supabase/client.ts), [lib/supabase/middleware.ts](../../lib/supabase/middleware.ts), [middleware.ts](../../middleware.ts) |
| Sign-in UX | Modal with email magic-link primary + Google OAuth secondary; stays on the map (no separate page); fires from header pill or `landlens:signin` event | [components/auth/SignInModal.tsx](../../components/auth/SignInModal.tsx), [components/auth/AuthButton.tsx](../../components/auth/AuthButton.tsx) |
| Callback | `/auth/callback` exchanges magic-link / OAuth codes for a session, redirects to `?next=` (origin-validated) | [app/auth/callback/route.ts](../../app/auth/callback/route.ts) |
| Sign-out | `POST /api/auth/signout` clears Supabase cookies; client does soft refresh | [app/api/auth/signout/route.ts](../../app/api/auth/signout/route.ts) |
| Saved parcels | `GET`/`POST /api/saved-parcels` + `DELETE /api/saved-parcels/:parcelId`; heart icon in sidebar with optimistic toggle + rollback | [components/map/SaveParcelButton.tsx](../../components/map/SaveParcelButton.tsx), [app/api/saved-parcels/](../../app/api/saved-parcels/) |
| Saved page | `/[locale]/saved` lists bookmarks with MapTiler static-map thumbnails; remove inline | [app/[locale]/saved/](../../app/[locale]/saved/) |
| RLS | Saved parcels, access log, parcel corrections, admin assistant tables — all locked to `auth.uid()` | [prisma/sql/rls-policies.sql](../../prisma/sql/rls-policies.sql) |
| Audit log | SHA-256 of IP salted per UTC month (`IP_HASH_SALT`); bot UAs skipped; fire-and-forget from parcel detail route | [lib/auth/ip-hash.ts](../../lib/auth/ip-hash.ts), [lib/auth/audit.ts](../../lib/auth/audit.ts) |
| Exports | GeoJSON, KML (tokml), PDF (`@react-pdf/renderer`) — one route, three formats: `GET /api/parcels/:id/export?format=` | [app/api/parcels/[id]/export/route.ts](../../app/api/parcels/[id]/export/route.ts), [lib/export/](../../lib/export/) |
| Sidebar polish | Action row: Save · Share (copies `/<locale>/?parcel=<uuid>`) · Download menu | [components/map/ParcelSidebar.tsx](../../components/map/ParcelSidebar.tsx), [components/map/ShareButton.tsx](../../components/map/ShareButton.tsx), [components/map/ExportMenu.tsx](../../components/map/ExportMenu.tsx) |
| Open Graph | Dynamic per-parcel 1200×630 card with MapTiler static-map + parcel summary | [app/[locale]/parcel/[id]/opengraph-image.tsx](../../app/[locale]/parcel/[id]/opengraph-image.tsx) |
| Share-friendly URL | `/[locale]/parcel/[id]` redirects to the map with `?parcel=<id>` and carries metadata | [app/[locale]/parcel/[id]/page.tsx](../../app/[locale]/parcel/[id]/page.tsx) |
| Sitemap + robots | `app/sitemap.ts` lists locale × public-path with hreflang alternates; existing `robots.txt` already correct | [app/sitemap.ts](../../app/sitemap.ts) |
| Error pages | Branded `/[locale]/not-found.tsx` + `/[locale]/error.tsx` with "Back to map" CTA | [app/[locale]/not-found.tsx](../../app/[locale]/not-found.tsx), [app/[locale]/error.tsx](../../app/[locale]/error.tsx) |
| i18n | `Auth`, `Saved`, `Sidebar`, `Settings`, `NotFound`, `ErrorPage`, `Site` catalogs in en/hi/ur | [messages/](../../messages/) |
| Env | `IP_HASH_SALT` (generated) + Supabase Auth setup notes | [.env.example](../../.env.example) |

## Decisions worth remembering

- **`/auth/callback` is locale-less on purpose.** Magic-link emails embed a
  single canonical URL — friendlier to email clients and matches what we
  register in Supabase Auth's redirect-URL list. The middleware matcher
  excludes `/auth` so next-intl doesn't redirect into a locale prefix.
- **Header pill, not separate sign-in page.** The user stays on the map; the
  sign-in modal pops in place. The save button (and any future component that
  wants auth) requests sign-in by dispatching the `landlens:signin` custom
  event — keeps the modal a single instance owned by `AuthButton`.
- **RLS pins to `auth.uid()` everywhere.** Public read tables (parcels,
  admin_boundaries, ownership_records, encumbrances) keep RLS disabled so the
  anon key still serves the map without a session. Personal tables are pinned;
  the service role bypasses RLS for admin reads (Sprint 13).
- **Audit log is fire-and-forget.** Failures are swallowed inside
  `logParcelAccess` — auditing must never break a parcel detail request. Bot
  UAs are filtered before the DB hit, not after.
- **IP hash salt rotates monthly.** `IP_HASH_SALT:<YYYY-MM>:<ip>` → SHA-256.
  Rotating the env var invalidates the previous hash space, monthly rotation
  breaks long-range correlation by default.
- **One export route, three formats.** Querystring (`?format=`) keeps the
  client trivial and lets us add CSV / Shapefile later without proliferating
  endpoints. `Content-Disposition` carries the canonical filename.
- **Bulk export gate is environment-driven.** `ENABLE_BULK_EXPORT_UNLIMITED`
  stays `false` in Phase 1; nothing in this sprint reads it yet (no bulk
  endpoint exists), but the flag is documented and the export pipeline is
  built so a future `POST /api/exports/bulk` can wire it in cleanly.
- **OG image uses MapTiler static-map.** Renders inside the Edge-style
  `ImageResponse` by fetching the PNG at request time. Falls back to a
  branded gradient card when the parcel id is invalid or geometry is missing.

## Verified locally

```
npm run typecheck   → clean
npm run lint        → 0 warnings, 0 errors
npm run build       → succeeds, 14 routes prerendered, OG image dynamic
curl /en            → 200
curl /sitemap.xml   → 200
curl /auth/callback → 307 (redirect when no code supplied)
```

PDF and KML exports were exercised by typecheck only — the actual download
requires a parcel UUID from the dev database. Same goes for the OG image
route. Both compile and the route handlers are wired through `withErrors`.

## Manual steps after merge

These can only be done from outside the codebase:

1. **Supabase Auth → URL Configuration** — set Site URL to
   `https://land.trenlens.com`. Add redirect URLs:
   `https://land.trenlens.com/auth/callback` and
   `http://localhost:3000/auth/callback`.
2. **Supabase Auth → Providers** — enable Email (magic link) and Google.
3. **Google Cloud Console → Credentials** — create an OAuth 2.0 Client ID
   (Web application). Authorized redirect URI =
   `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the client id
   and secret into Supabase's Google provider config.
4. **Supabase SQL Editor** — run `prisma/sql/rls-policies.sql` once. Idempotent
   (drops + recreates policies, enables RLS only where intended).
5. **Vercel env vars** — add `IP_HASH_SALT` (any random 32-byte hex string;
   `.env.example` shows the generator).
6. **Verify** — sign in, save a parcel, hit `/[locale]/saved`, download the
   PDF report, share a parcel link, and check the OG image at
   `/en/parcel/<uuid>/opengraph-image` with a social-preview tool.

## Deferred to later sprints

- Lighthouse run was not executed (no live URL during this session). Score
  validation must happen against the deployed preview — settings.json change
  not required.
- Bulk export endpoint (`/api/exports/bulk`) and the 100-parcel gate using
  `ENABLE_BULK_EXPORT_UNLIMITED` are deferred until a downstream feature needs
  them (Sprint 7+ when real cadastral data lands).
- Settings page is a stub — full preferences (default basemap, default
  locale, email preferences) are out of scope here.
- Saved-parcel labels / notes UI deferred (DB columns exist; API accepts
  `label` but the sidebar doesn't expose it yet).
- Real cadastral data is still Sprint 7's job.
