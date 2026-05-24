## Sprint 3 — Parcels & Drill-Down (in progress 2026-05-24)

### What was built

**District boundaries (state click → districts layer)**
- `public/data/boundaries/districts/Maharashtra.geojson` — 36 districts, 524 kB after Douglas–Peucker simplification (tolerance 0.003) of the 12.9 MB source. Property shape normalised to `{ district_name, state_name, district_lgd, state_lgd, dtcode11 }`.
- `scripts/download-district-boundaries.ts` (npm script `data:download-districts`) — pulls per-state GeoJSON from `datta07/INDIAN-SHAPEFILES`, simplifies via `@turf/turf simplify`, writes to `public/data/boundaries/districts/<State>.geojson`. URL map seeded with Maharashtra, Karnataka, Tamil Nadu, Gujarat, Kerala. Add more by appending to the `SOURCES` record.
- `app/api/districts/route.ts` — `GET /api/districts?state=<name>` serves the bundled file with structured 404 when no file exists for the requested state.

**Village boundaries (district click → villages layer)**
- `lib/overpass.ts` — Overpass-QL builder + dependency-light JSON parser. Walks nodes/ways/relations, stitches `outer` ways into closed rings, emits `Feature<Polygon, { osm_id, name, name_local, admin_level }>`. Multi-outer relations collapse to the first outer (good enough for Sprint 3 demo; real admin polygons with holes land with the Sprint 7 ingest).
- `app/api/villages/route.ts` — `GET /api/villages?bbox=w,s,e,n[&district_id=<uuid>]`. Tries the `admin_boundaries` cache first via `ST_Intersects` on `geom`, falls back to live Overpass on miss and persists the result with `ST_GeomFromGeoJSON → ST_Multi`. Best-effort write-through; the response is not delayed by the persist. `Prisma.sql` / `Prisma.empty` is used to compose the optional `parent_id` clause safely. Bbox capped to ~5° × 5° to keep Overpass calls civilised.

**Mock parcels (village click → parcels layer)**
- `lib/parcels/mock.ts` — `generateMockParcels(villageFeature, opts)` samples N seed points inside the polygon (rejection sample on bbox), runs `turf.voronoi`, intersects each cell with the village polygon, and tags every clipped cell with a sequential Khasra No, computed `area_sqm`, and a random `land_type` from `LAND_TYPES`. Also exports `generateMockVillages` (small ~2 km circular footprints around random centroids — not voronoi cells of the whole district, that produced absurd 600 km² "villages") and `mulberry32(seed)` for deterministic seed-script output.
- `app/api/parcels/by-village/route.ts` — `GET /api/parcels/by-village?village_id=<uuid>` returns a GeoJSON FeatureCollection of every parcel in the village.

**Parcel detail + ownership timeline**
- `app/api/parcels/[id]/route.ts` — joins `parcels → admin_boundaries (village) → admin_boundaries (district) → admin_boundaries (state)` in a single raw query, then loads owners ordered current-first. Returns the parcel polygon as inline GeoJSON.
- `components/map/ParcelSidebar.tsx` — fixed-position rail. Desktop (md+): 380 px right sidebar; mobile: bottom sheet ≤ 70vh with rounded top corners. Slides in/out with CSS translate. Shows khasra, area (acres / hectares / sq m), land-type badge (colour-coded via `LAND_TYPE_COLORS`), boundary-source badge, district LGD code, and the ownership timeline.
- `components/map/OwnershipTimeline.tsx` — vertical timeline with bullet markers; current owner gets the accent indigo bullet + "CURRENT" tag, older owners get slate bullets + transfer-date.
- `components/ui/Badge.tsx` — reusable pill with `neutral`, `accent`, `land`, `source` variants. The `land` variant accepts a `style.backgroundColor` so the parcel-type colour drives the pill.

**MapView drill-down (the structural work)**
- Four GeoJSON sources stacked: `india-states` (always present) → `india-districts` (lazy on state click) → `india-villages` (lazy on district click) → `india-parcels` (lazy on village click).
- `interactiveLayerIds` recomputed each render so click events only fire on currently-mounted fill layers; `e.features?.[0]` (topmost) drives the route-by-layer-id dispatcher.
- `drillIntoState` fits to the state bbox + calls `/api/districts?state=<name>`, displays an inline amber chip when the API returns 404 (e.g. clicking Punjab today — only Maharashtra is bundled).
- `drillIntoDistrict` fits to the district bbox + sets `villagesUrl` so MapLibre fetches `/api/villages?bbox=<...>` and the source mounts with the cached/Overpass result.
- `drillIntoVillage` fits to the village bbox; if `properties.id` (UUID) is present (cache row), sets `parcelsUrl`. OSM-only village features (no UUID) drill in visually but show no parcels.
- Clicking a parcel sets `selectedParcel` → ParcelSidebar opens + indigo 2.5 px outline ring layer paints over the selected feature.
- Breadcrumb jumps prune deeper sources: India jump unmounts districts/villages/parcels, state jump keeps districts but drops villages/parcels, etc. Avoids stale features bleeding through after re-drill.
- Land-type fill is a MapLibre `match` expression generated from `LAND_TYPE_COLORS` — no JS-side colour assignment, fully GPU-side.

**Locate Me → nearby parcels glow**
- `MapView.onLocate` now also fires `/api/parcels/nearby?lat=<>&lng=<>&limit=5` after `flyTo`. The returned IDs feed an `in` filter on a yellow (`#fde047`, 55 % opacity) glow fill layer above the parcels.
- Glow filter degrades gracefully — when `nearbyIds` is empty, the filter becomes `['==', ['get', 'id'], '__none__']` so the layer renders nothing instead of throwing on an empty `['in', ...]` operand.

**Seed script — Pune Rural end-to-end (`npm run data:seed-pune`)**
- `scripts/generate-mock-parcels.ts` reads the Pune polygon out of `public/data/boundaries/districts/Maharashtra.geojson`, upserts a Maharashtra state row (geometry sourced from `india-states.geojson` because `admin_boundaries.geom` is NOT NULL), upserts a Pune district row with **`lgd_code='519'`** (the LGD register's "Pune Rural" code per the user spec — overriding the Census 2011 LGD 490 that the source file uses, so the seeded row matches what Sprint 7 scrapers will expect), synthesises 10 small circular villages with `faker.location.city()` names, runs the parcel generator at 25-50 plots per village, and persists 1-3 ownership records per parcel using `@faker-js/faker/EN_IN`.
- Most recent owner has `transfer_date = NULL` so the `ownership_records.is_current` generated column flips true.
- Re-running is idempotent: a `DELETE FROM parcels WHERE source_portal='pune_rural_mock'` runs first, then a `DELETE FROM admin_boundaries WHERE level='village' AND parent_id = <pune>` clears the previous village set.
- Last seed run: **374 parcels, 715 ownership records, 10 villages** in `Pune Rural`. Verified via end-to-end API smoke test (see below).
- `RNG_SEED = 0x70_75_6e_65` ("pune" in ASCII hex) drives `mulberry32` so the geometric output is reproducible. Owner names use faker's own RNG (non-seeded) so re-runs produce different people but the same parcel layout.

**OpenAPI registrations**
- `OwnershipRecord`, `ParcelDetail`, `NearbyParcel` schemas added to `lib/api/openapi.ts`.
- New paths registered: `/api/districts`, `/api/villages`, `/api/parcels/{id}`, `/api/parcels/by-village`, `/api/parcels/nearby`. All five routes are reflected in `/api/openapi.json`.

### Decisions taken this sprint

- **datameet has no GeoJSON.** The user spec called out `datameet/maps` for districts. Inspecting the repo confirmed it ships shapefiles only (`Districts/Census_2011/2011_Dist.shp` is 10 MB; converting requires GDAL on the contributor's machine, which we can't assume). Pulled instead from `datta07/INDIAN-SHAPEFILES`, which has per-state GeoJSON district files (~13 MB raw → ~520 kB simplified). The download script is the migration path: when Sprint 7 scrapers persist boundaries to PostGIS, `/api/districts` will read from the DB and the bundled file can be retired.
- **Bundled MH only, gated everywhere else.** Shipping all 36 states would push the repo's `public/` past 20 MB and add nothing for the demo. Clicking an un-bundled state surfaces a structured 404 + amber chip telling the user how to fetch it ("Run `npm run data:download-districts -- "Tamil Nadu"`"). Sprint 7 turns this into a non-issue.
- **Villages are circles, not voronoi cells of the district.** First pass used `voronoi(districtCentroids, { bbox: district })` for villages, which produced ~600 km² polygons. After subdividing each into ~30 parcels, the median parcel was 27 ha — visually wrong (real farm plots are 0.5-2 ha). Switched to small circular footprints (~2 km radius ≈ 12 km²) so parcels land in the 10-50 ha range. Still demo-scale, not survey-grade, but no longer ridiculous. Note in `lib/parcels/mock.ts` documents the WHY.
- **`Prisma.sql` for the optional WHERE clause.** Prisma tagged-template literals don't compose with `?:` directly. `Prisma.sql\`...\`` + `Prisma.empty` is the documented escape hatch — used in `/api/villages` for the optional `parent_id` filter.
- **`ORDER BY distance_m::float` is a Postgres error.** A column alias can't take a cast in `ORDER BY`. `/api/parcels/nearby` was rewritten with a CTE so the ordered expression is already a `double precision` column. Tested live (5 results in 5 km radius from Viramgam village centroid).
- **`force-dynamic` on every parameterised route.** Next 14's static analysis throws `DYNAMIC_SERVER_USAGE` errors at build-time for `nextUrl.searchParams` lookups. The errors don't fail the build but they pollute the log; the explicit `export const dynamic = 'force-dynamic'` silences them.
- **Promoted `name` (not `id`) for villages.** Cache-source village features carry both `id` and `name` properties; OSM-source features carry only `name` (and `osm_id`). Using `name` for `promoteId` keeps the hover filter expression `['==', ['get', 'name'], hovered.key]` working in both modes. UUIDs are still consumed at click-time via `feat.properties.id`.
- **Pune Rural LGD 519 vs Census LGD 490.** The user spec asked for LGD 519. The Census 2011 source labels Pune as LGD 490. Seed script overrides the LGD to 519 on insert so the row matches the LGD register that downstream scrapers will use; a comment in the seed script documents this.
- **Land-type fill via MapLibre `match` expression.** `LAND_TYPE_COLORS` is the single source of truth — the same record drives the GPU fill expression in MapView and the inline badge colour in ParcelSidebar.
- **Ownership timeline ordering.** Current-first (top), older transfers below, ordered by `is_current DESC, transfer_date DESC NULLS LAST`. Matches the way the Record-of-Rights extract is typically read.

### Verification

- `npm run typecheck` ✓ clean
- `npx next build` ✓ all seven API routes appear as `ƒ (Dynamic)`, `/[locale]` First Load JS still 1.27 kB (the lazy MapClient chunk absorbs the new map code without bloating the shell)
- `npm run data:seed-pune` ✓ second run inserted 374 parcels + 715 ownership records across 10 villages
- Live curl-tests against `npm run dev` (port 3002):
  - `GET /api/districts?state=Maharashtra` → 200, 36 features
  - `GET /api/villages?bbox=73.32,17.89,75.16,19.39` → 200, 8 features (cache hit — Overpass not called)
  - `GET /api/parcels/by-village?village_id=<uuid>` → 200, 46 features
  - `GET /api/parcels/<id>` → 200, full chain (village `Viramgam (M)` / district `Pune Rural` LGD 519) + 1 owner
  - `GET /api/parcels/nearby?lat=18.342&lng=73.726&limit=5&radius_m=5000` → 200, 5 ranked parcels (distances 1003-1089 m)

### What was deferred (in scope of later sprints, NOT skipped accidentally)

- Real district boundaries for all states (only Maharashtra bundled today). Run the download script to add more.
- Tehsil / block layer between district and village. The drill model and breadcrumb both support a `tehsil` level but no layer is mounted — OSM coverage at `admin_level=6` for India is too thin to be useful without manual curation. Reconsider in Sprint 7 when scrapers can provide tehsil polygons from state portals.
- `OwnershipRecord.father_or_spouse` rendered as "S/o · D/o · W/o {name}" — the prefix logic should pick a single relation based on owner gender, not show all three. Lands with Sprint 5 i18n when the catalog has the locale-correct phrasing.
- Edit / correction queue on the sidebar — Sprint 6 after auth.
- Real-time progress while Overpass fetches (the village fetch can take 2-15 s on a cold district; today the layer just doesn't paint until the response lands). Loading skeleton — Sprint 4.
- Parcel area scaling — current mock parcels are 10-50 ha, real Indian farm plots are 0.5-2 ha. Reflects the small ~2 km-radius village footprints; would need denser parcel sampling per village (200+) to hit realistic acreages and the seed run is already DB-bound (~1 s per parcel insert over PgBouncer to Mumbai Supabase). Sprint 7 with real survey data fixes this; for the demo we accept the scale.

### Files added this sprint

```
app/api/districts/route.ts
app/api/villages/route.ts
app/api/parcels/[id]/route.ts
app/api/parcels/by-village/route.ts
app/api/parcels/nearby/route.ts
components/map/OwnershipTimeline.tsx
components/map/ParcelSidebar.tsx
components/ui/Badge.tsx
lib/data/states.ts
lib/overpass.ts
lib/parcels/mock.ts
public/data/boundaries/districts/Maharashtra.geojson
scripts/download-district-boundaries.ts
scripts/generate-mock-parcels.ts
```

Modified: `components/map/MapView.tsx`, `lib/api/openapi.ts`, `lib/map/constants.ts`, `package.json` / `package-lock.json` (added `@faker-js/faker` devDep, new npm scripts `data:download-districts`, `data:seed-pune`).

### Commits this sprint

- `sprint-3: bundle simplified Maharashtra districts + download script`
- `sprint-3: overpass loader, mock-parcel generator, land-type palette`
- `sprint-3: parcel/village/district API routes + OpenAPI registrations`
- `sprint-3: drill-down state>district>village>parcel + parcel sidebar`
- `sprint-3: Pune Rural seed script (faker-js Indian locale)`

### Prompt for the next session (Sprint 4 — Search)

> Read `.claude/SESSION_LOG.md` first; Sprint 3 closes with full drill-down state→district→village→parcel and 374 mock parcels seeded in Pune Rural. Begin Sprint 4 — Search & Discovery.
> Scope: command palette (Cmd/Ctrl+K) with three tabs (Places, Khasra, People), Postgres `pg_trgm` fuzzy search across `admin_boundaries.name_en`, `parcels.khasra_no`, and `ownership_records.owner_name_en`. A `/api/search?q=<text>&tab=<…>&limit=10` route returning ranked results with `flyTo` targets. Recent-searches list persisted in localStorage. Sidebar "Open in Google Maps / OSM" external links. Maybe a "Share this parcel" → copies a URL with `#parcel=<uuid>` that re-opens the sidebar on load.
> Don't build: auth + saved bookmarks (Sprint 6), real scraper data (Sprint 7), i18n catalogs (Sprint 5).
> Before doing anything, confirm `npm run dev` boots and the homepage renders the map with Pune Rural drill-down working (click Maharashtra → districts paint, click Pune → villages paint, click a village → parcels paint, click a parcel → sidebar opens).
