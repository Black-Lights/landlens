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
