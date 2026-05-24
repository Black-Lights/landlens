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

### Sprint 1 close-out (2026-05-24, end of session)

Sprint 1 is **complete and live in production**.

**Verification snapshots**
- Local: `GET http://localhost:3000/api/health` → `{ status: "ok", db: "ok", redis: "ok" }`
- Production: `GET https://land.trenlens.com/api/health` → `{ status: "ok", db: "ok", redis: "ok", version: "aa1239b" }`

The `version` field on the production response is the short commit SHA from `VERCEL_GIT_COMMIT_SHA` — matches `aa1239b` (the initial Prisma migration commit), confirming the deployed build is exactly the code on `main`.

**Manual steps completed outside Claude Code during this session**
- Supabase project `landlens` created in Mumbai (`ap-south-1`), Postgres 17.6 on `t4g.nano`, extensions enabled (postgis 3.3.7, pg_trgm 1.6, uuid-ossp 1.1, pgsodium 3.1.8). Pooler hostname turned out to be `aws-1-ap-south-1.pooler.supabase.com` (not `aws-0-`); `.env.local` updated accordingly.
- Upstash Redis database created in Mumbai (free tier): `capital-glider-135285.upstash.io`. URL + token added to `.env.local` and to Vercel env vars.
- MapTiler API key added to `.env.local` and Vercel — `NEXT_PUBLIC_MAPTILER_KEY` is now populated so Sprint 2 can use it directly.
- Vercel project imported from `Black-Lights/landlens`, all env vars from `.env.local` propagated to Production / Preview / Development environments.
- Domain `land.trenlens.com` configured via Cloudflare's Vercel auto-configure flow — CNAME `land → cname.vercel-dns.com` (DNS-only, gray cloud) plus the TXT verification record. TLS auto-issued by Vercel.

**What is NOT done yet** (and is correctly scoped to later sprints)
- Map rendering (Sprint 2)
- Parcel data seeding — turf voronoi mocks, datameet boundary ingest, faker owners (Sprint 3)
- Search / command palette (Sprint 4)
- Real i18n catalogs — the folder structure + locale routing are ready, but the JSON files are stubs (Sprint 5)
- Supabase Auth wiring, OTP login, saved-parcel bookmarks (Sprint 6)
- Real state-portal scrapers (Sprint 7)
- AI segmentation service integration (Sprint 9)
- MCP server + in-app admin assistant (Sprints 12 / 13)
- Rate-limit middleware on every API route (Sprint 14) — `@upstash/ratelimit` is installed but not yet wrapped around handlers

**Live URL:** <https://land.trenlens.com>

**Repo:** <https://github.com/Black-Lights/landlens>

Sprint 2 prompt is above and ready to use verbatim in the next session.

---

## Sprint 2 — The Map (in progress 2026-05-24)

### What was built

**Basemap layer**
- `lib/map/basemaps.ts` — registry of four basemaps. Each entry has `id`, `label`, `attribution`, an `available()` guard (Streets needs `NEXT_PUBLIC_MAPTILER_KEY`, others are always on), and a `style()` factory returning either a MapTiler hosted style URL or an inline raster `StyleSpecification`.
  - Streets → `https://api.maptiler.com/maps/streets-v2/style.json?key=...` (default)
  - Satellite → Esri World Imagery raster tiles (`server.arcgisonline.com/.../World_Imagery/.../{z}/{y}/{x}`)
  - Terrain → OpenTopoMap (a/b/c subdomains, maxzoom 17)
  - Bhuvan → NRSC WMS, EPSG:3857 with `{bbox-epsg-3857}` substitution
- `lib/map/constants.ts` — `INDIA_CENTER = [78.9629, 20.5937]`, `INDIA_DEFAULT_ZOOM = 4.2` (full subcontinent visible on a 16:9 viewport), `INDIA_MAX_BOUNDS` to stop panning to the antarctic, and `DRILL_ZOOM` map per drill level (state 7, district 9, tehsil 11, village 13).
- `lib/map/utm.ts` — minimal WGS84 → UTM forward converter (Krüger series, k0 = 0.9996). Returns `{zone, hemisphere, easting, northing}` or `null` outside ±80/84°. Used by `CoordReadout` when the user clicks it to toggle.

**Map UI**
- `components/map/MapView.tsx` — the heart of Sprint 2. Wraps `react-map-gl/maplibre` `Map`. Wires:
  - State boundaries source (`/data/boundaries/india-states.geojson`) → three layers: invisible fill (interactivity target), thin slate-900 line at 55% opacity, and a hover-highlight fill driven by feature-filter expression
  - Click handler that fits the map to the feature bbox (computed with `@turf/turf` `bbox`) and pushes a breadcrumb crumb
  - Hover state via `MapLayerMouseEvent` features lookup; cursor flips to `pointer` over a state
  - Bearing tracking → drives `NorthArrow` rotation; clicking the arrow `easeTo({bearing:0, pitch:0})`
  - GPS state → renders a `Source`/`Layer` pair: an accuracy circle (zoom-interpolated radius from `properties.accuracy` meters) and a pulsing dot (50ms ticker driving a sine-modulated `circle-radius`)
- `components/map/MapClient.tsx` — `'use client'` wrapper that `next/dynamic`-imports `MapView` with `ssr: false`. The `[locale]/page.tsx` server component renders this wrapper so SSR doesn't try to evaluate `maplibre-gl` (which touches `window`).
- `components/map/BasemapSwitcher.tsx` — floating top-right Layers button. Opens a 4-item menu (Streets / Satellite / Terrain / Bhuvan), greys out Streets when MapTiler key is missing. `aria-expanded`, `role="menuitemradio"`, `aria-checked`.
- `components/map/Breadcrumb.tsx` — floating top-center pill. Renders the drill trail (`India > State name`). Last crumb is disabled (current); earlier crumbs are clickable and call `onJump(index)` which `flyTo`s back to that level.
- `components/map/CoordReadout.tsx` — bottom-center pill, monospace. Tracks pointer `lngLat` from MapView; button click toggles between lat/lng (decimal degrees with N/S/E/W) and UTM (`zone+hemisphere easting northing`).
- `components/map/NorthArrow.tsx` — SVG arrow (red/slate) that rotates with `-bearing`; click resets bearing. Top-right under the basemap switcher.
- `components/map/LocateMe.tsx` — accent-indigo round button bottom-right (above coord readout). Calls `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: true, timeout: 10000, maximumAge: 0`. Reports back `(lat, lng, accuracy)` to MapView which `flyTo`s to zoom 14 and renders the pulsing-dot source. Surfaces in-app toasts for `PERMISSION_DENIED`, geolocation unavailable, and accuracy > 200 m (the "open sky" hint). Uses copy keys aligned with `locate.*` namespace in `docs/06-internationalization.md` — strings are hardcoded English for now; i18n hookup lands in Sprint 5.

**MapLibre built-in controls**
- `NavigationControl` (bottom-right, `showCompass={false}` because we render our own north arrow)
- `ScaleControl` (bottom-left, metric, max 120 px)
- `AttributionControl` (compact, bottom-right) — `customAttribution` is swapped on every basemap change so the credit line is always correct for the active provider

**Page wiring**
- `app/[locale]/page.tsx` — now a single-screen container `h-[100dvh] w-full` that renders `<MapClient />`. `setRequestLocale` still called so locale prerendering keeps working.
- `app/globals.css` — added `margin: 0; overflow: hidden` on `body` (the map owns the viewport, no page scroll). Light translucent backdrop for the MapLibre attribution chip so it stays readable over satellite tiles.

**Boundary data**
- `public/data/boundaries/india-states.geojson` — 1.0 MB, ~36 features (28 states + 8 UTs), `properties.ST_NM` is the state name. Sourced from the long-circulated Plotly community gist `jbrobst/56c13bbbf9d97d187fea01ca62ea5112` (CC0-style availability; same dataset used in many Indian-state choropleths). datameet/maps was the first choice but stores shapefiles, not GeoJSON, so the simplified gist is the pragmatic Sprint 2 source. If we want fresher/authoritative geometries later, the path is `ogr2ogr` over datameet shapefiles + `mapshaper` simplification — both can be wired into a `scripts/download-boundaries.ts` task in Sprint 3 when we ingest districts.

### Decisions taken this sprint
- **`next/dynamic({ ssr: false })` wrapped in a client component, not in the page itself.** Next 14 disallows `ssr: false` from a server component module. The wrapper pattern keeps the page server-rendered (so `setRequestLocale` still prerenders the locale routes) while the map evaluates only on the client.
- **GeoJSON shipped as a static asset, not a tileset.** ~1 MB is fine for one fetch, gzip drops it under 250 kB, and MapLibre's `geojson` source handles tessellation client-side. Vector tiles are a Sprint 3+ concern once districts/parcels show up.
- **Bearing/pitch lock implicit via UX, not the API.** No `maxPitch`/`dragRotate: false` — instead, the north arrow makes any accidental rotation visible and one click resets. Cheaper than disabling features.
- **`promoteId: 'ST_NM'`** on the states source so feature-state and feature-filter hover work without depending on `id`.
- **`overflow: hidden` on `<body>`** to suppress the iOS Safari address-bar shrink-on-scroll. `100dvh` then resolves to the real visible viewport.
- **Pulsing GPS dot driven by React state, not WebGL.** A 50 ms `setInterval` updates a `circle-radius` paint property via re-render. Slightly noisier than a custom layer but works inside react-map-gl and dependency-free. Worth revisiting in Sprint 9 if it starts showing up in profile traces.
- **No `setRequestLocale` runtime check** that the map is on a real-time HTTPS context — the GeolocateControl is gone (we render our own UI) but Geolocation API itself enforces secure-context, so we let it surface the error naturally and toast on `PERMISSION_DENIED`.

### Verification
- `npm run typecheck` → clean
- `npx next build` → ✓ Compiled successfully. The `/[locale]` route is **1.27 kB** First Load JS because `MapClient` lazy-loads the MapLibre chunk on the client; the homepage shell still prerenders for all three locales.
- Manual click-through (locally) not done in this session — the user should `npm run dev` and verify the map paints, the basemap switcher swaps tiles, hovering highlights states, click zooms, and "Locate me" prompts the browser permission.

### What was deferred (in scope of later sprints, NOT skipped accidentally)
- District / tehsil / village click drill-down — needs the datameet district shapefile ingest, which lands with parcels in Sprint 3. Breadcrumb already supports any depth; only the click handlers are wired through state level today.
- `/api/parcels/nearby` call after Locate me succeeds — Sprint 3 (no parcel data yet to call against).
- i18n on map UI copy (locate toasts, basemap labels, breadcrumb root) — Sprint 5. Strings are inlined English so they don't need to round-trip through stub message catalogs.
- AttributionFooter component as a separate file — folded into MapLibre's `AttributionControl` for now; if richer formatting becomes a need (icons, links per provider) it can be split out without changing the basemap registry.
- Layer toggle panel (the left-side collapsible from CLAUDE_CODE_PROMPT §4) — out of scope for Sprint 2; lands with cadastral overlay in Sprint 3.
- Search bar with `Ctrl+K` palette — Sprint 4.

### Files added this sprint
```
components/map/
  BasemapSwitcher.tsx
  Breadcrumb.tsx
  CoordReadout.tsx
  LocateMe.tsx
  MapClient.tsx
  MapView.tsx
  NorthArrow.tsx
lib/map/
  basemaps.ts
  constants.ts
  utm.ts
public/data/boundaries/
  india-states.geojson
```

Modified: `app/[locale]/page.tsx`, `app/globals.css`.

### Commits this sprint
- `sprint-2: add India state boundaries GeoJSON`
- `sprint-2: basemap config (MapTiler/Esri/OpenTopoMap/Bhuvan), UTM helper, drill constants`
- `sprint-2: MapView + overlays (BasemapSwitcher, Breadcrumb, CoordReadout, NorthArrow, LocateMe)`
- `sprint-2: wire MapView into homepage, full-viewport layout`

### Prompt for the next session (Sprint 3 — Parcels)
> Read `.claude/SESSION_LOG.md` first; Sprint 2 shipped the map and state boundaries. Begin Sprint 3 — Parcels.
> Scope: ingest datameet district shapefiles into the `admin_boundaries` table (or convert to GeoJSON and serve as a static asset, matching the Sprint 2 pattern); seed mock parcels using `@turf/turf` voronoi over sample centroids per state; faker-generated owner names into `ownership_records`; click-a-parcel sidebar (desktop) + bottom sheet (mobile); `/api/parcels/:id` and `/api/parcels/nearby` (the latter wires into the Sprint 2 "Locate me" path); extend the breadcrumb click drill-down through district → tehsil → village now that data exists.
> Before doing anything, confirm `npm run dev` boots and the homepage shows the India map.

### Sprint 2 polish + close-out (2026-05-24)

Three post-deploy fixes shipped in one commit (`sprint-2: fix satellite labels, bhuvan wms, locate-me position`) plus the earlier favicon contrast fix.

**1. Satellite view has labels now.** Esri World Imagery is raster-only — no place names, no roads. The `satellite` basemap style in `lib/map/basemaps.ts` is now a two-source / two-layer stack: Esri tiles for the imagery + Stadia Maps' Stamen Toner Labels (`tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}.png`) layered on top at `raster-opacity: 0.9`. Cities, roads and state names are legible over satellite. Attribution string updated to credit Stadia + Stamen + OSM alongside Esri/Maxar.

**2. Bhuvan WMS renders.** The old `bhuvan-vec1` host returns 5xx for some BBOX requests in mid-2026. Switched to `bhuvan-vec2.nrsc.gov.in` with the exact uppercase WMS param casing ISRO expects (`SERVICE`, `VERSION`, `REQUEST`, `LAYERS=india3`, `STYLES=`, `FORMAT=image/png`, `TRANSPARENT=true`, `SRS=EPSG:3857`, `WIDTH=256&HEIGHT=256`, `BBOX={bbox-epsg-3857}`). Inline comment in the source documents `lulc50k_1112` as the fallback layer if `india3` ever stops serving.

**3. Locate-me button moved out of overlap.** Was at `bottom-24 right-3` on mobile but flipped to `bottom-16 right-3` on `sm:` breakpoint, which collided with MapLibre's NavigationControl stack (~60 px tall at the bottom-right). Now consistently `bottom-24 right-4` (96 px / 16 px) on every breakpoint — clears the zoom controls and lands in the thumb zone. Toast lifted out of the absolutely-positioned button wrapper and changed to `fixed bottom-32 left-1/2` so it centers on the viewport, not on the small button div.

**4. Favicon contrast (earlier this session).** Slate-900 strokes vanished on dark Chrome/Edge tabs. `public/favicon.svg` now defaults to `#FFFFFF` strokes (visible on dark tabs and used by the `.ico` rasterizer, which doesn't evaluate media queries), with a `@media (prefers-color-scheme: light)` swap to `#0F172A` for light-mode browsers. Inner accent block brightened to `#60A5FA` at 45% opacity. `scripts/generate-favicons.ts` was also hardened earlier: sources from `public/favicon.svg` (no background rect) instead of `app-icon.svg` (solid indigo rect), and Sharp's `resize()` is passed `background: { r:0, g:0, b:0, alpha:0 }` so transparency is preserved through the 16/32/48 ICO sizes.

**Verification**
- `npm run typecheck` clean
- `npx next build` ✓ — `/[locale]` First Load JS still 1.27 kB (MapView stays lazy-loaded)
- All Sprint 2 commits pushed to `origin/main`; Vercel auto-deploy in flight

**Commits added in this close-out**
- `sprint-2: fix favicon transparency + push to production`
- `sprint-2: favicon — white strokes on dark tabs, brighter accent`
- `sprint-2: fix satellite labels, bhuvan wms, locate-me position`

**Sprint 2 status: closed.** Live at <https://land.trenlens.com>. The map ships. Sprint 3 (parcels + drill-down past state level) is now the next session's work — see prompt above.


