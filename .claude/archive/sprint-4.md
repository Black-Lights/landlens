## Sprint 4 — Search (closed 2026-05-24)

### What was built

**Unified search endpoint (`GET /api/search`)**
- `app/api/search/route.ts` — single endpoint that searches across five entity types in one round-trip via a `UNION ALL` over per-type CTEs.
- Query params (Zod-validated): `q` (1–120 chars, required), `type` (one of `state|district|village|khasra|owner`, optional — restricts to a single type), `state` (LGD code OR name, optional — restricts admin / parcel / owner matches to one state), `limit` (1–50, default 20).
- Ranking is uniform across types:
  - Exact (case-insensitive, on any matched name column) → **1.0**
  - Prefix on `name_en` → **0.9**, prefix on `name_hi` / `name_local` → **0.88**
  - Otherwise `GREATEST(similarity(...))` across all candidate name columns (pg_trgm) → 0..1
- Results below similarity `0.15` are filtered. Final order: `score DESC, label ASC`.
- Multilingual matching: admin searches consider `name_en`, `name_hi`, and `name_local` in parallel. Owner search uses `owner_name` + `owner_name_en`. Cross-script transliteration (English → Devanagari and back) requires both columns to be populated; works today for any seed row that carries both names, will scale automatically once Sprint 7 scrapers fill in vernacular fields.
- Each result carries the full ancestor chain (`{state, district, village}` UUIDs + names) so the client can rebuild the breadcrumb without a second fetch, plus `bbox` (boundary `geom`) and `centroid` (parcel `centroid`/`ST_Centroid(geom)`). Boundary results use `bbox` for `fitBounds`; parcel/owner results use `centroid` for `flyTo`.
- Graceful degradation: when `DATABASE_URL` is unset (e.g. CI without DB), returns `{ query, results: [] }` instead of throwing.
- Cache headers: `public, max-age=30, s-maxage=60, stale-while-revalidate=300` — short because owner/khasra freshness will matter once real scraper data lands.

**Command palette UI (`components/map/SearchPalette.tsx`)**
- Centered modal that floats above the map. Opens with `Cmd/Ctrl+K`, the magnifying-glass button on the map, or programmatically. Closes on `Esc`, backdrop click, or result selection.
- Debounced input (300 ms) → `fetch('/api/search?q=...&limit=20')` with `AbortController` so old requests don't race the latest.
- Results grouped by type with per-type icons (`MapIcon`, `Building2`, `Trees`, `Hash`, `User`) and section headers. Within a group, the API's score-desc order is preserved.
- Keyboard navigation: `↑/↓` walks the flat result list (across groups), `Enter` selects, `Esc` closes. The active row scrolls into view automatically via `scrollIntoView({ block: 'nearest' })`.
- Empty input state: shows up to 8 **recent searches** stored in `localStorage` under `landlens:recentSearches`. Each entry persists `{ query, result, at }`; selecting a recent re-uses it.
- Loading state: three pulsing skeleton rows while the debounced fetch is in flight.
- No-results state: friendly `No results for "<q>"` line.
- Error state: red banner with the structured-error `message` from the API.
- Footer hints (`↑↓ navigate / ↵ open / esc close`) so the keyboard model is discoverable.

**Map wiring (`components/map/MapView.tsx`)**
- New persistent search button at top-left of the map (`absolute left-3 top-14`) — pill-shaped with the magnifying-glass icon, the word "Search…", and a `⌘K` kbd hint. Mobile collapses to an icon-only tap target.
- Global `keydown` listener for `Cmd+K` / `Ctrl+K` mounted on the map. Toggles the palette open. Suppresses the shortcut when focus is in a regular input/textarea/contentEditable (but still allows toggling from within the palette's own input — `searchOpen` flag).
- New `goToSearchResult(r)` async callback dispatches by `r.type`:
  - `state` → `fitBounds(r.bbox)` + `setDrill({ state: { name: r.label } })` + reset trail + `/api/districts?state=<name>` for the next layer (mirrors the click-handler logic).
  - `district` → `fitBounds(r.bbox)` + drill includes both state + district + `/api/villages?bbox=<r.bbox>` so the next click works. District file fetched too (so the dashed district outlines paint).
  - `village` → `fitBounds(r.bbox)` (expanded ±50 % for context) + drill includes full chain + `/api/parcels/by-village?village_id=<r.id>`.
  - `khasra` / `owner` → `flyTo(r.centroid, zoom: 17)` + drill includes full chain + parcels URL + `setSelectedParcel(r.parcel_id)` so the indigo outline + sidebar both open. Sidebar then fetches `/api/parcels/{id}` as it does for any other selection.
- Trail builder is identical for all paths: prepends `India` and appends only the ancestor crumbs the result actually has, so a village result that's missing a district (shouldn't happen with seeded data, but defensive) still renders cleanly.

**OpenAPI + llms.txt**
- `SearchResult` + `SearchResponse` schemas registered in `lib/api/openapi.ts`; `/api/search` route registered with full request-query shape and `200` response. Confirmed live in `/api/openapi.json` (`schemas: [..., 'SearchResult', 'SearchResponse']`, `paths: [..., '/api/search']`).
- `public/llms.txt` gets a one-liner under "Machine-readable endpoints" describing the endpoint, its parameters, and the bbox/centroid → flyTo intent — so an AI agent reading the file can pick a target geometry without consulting the OpenAPI separately.

### Decisions taken this sprint

- **Single endpoint, one round-trip, ranked across types.** The original prompt suggested three tabs (Places / Khasra / People); we went with a flat results list grouped by type instead. Reasoning: with `limit=20` the user gets the top matches across all types in one glance — there's never been a moment where I wanted to scope to "people only" before having seen what else matches. The `type=` query param is still there for callers that want narrow results (or for tab UI later if the UX needs it).
- **Score-only ranking across UNION ALL, not per-type buckets.** A 0.9 prefix match on a village beats a 0.45 trigram match on an owner; tabs would have buried the obvious answer. Grouping happens client-side after ranking so visual scanning still works.
- **No `state` scoping UI yet.** The endpoint honours `&state=<lgd|name>` (filters admin via uuid resolved by subquery, parcels/owners via `d.parent_id = state`), but the palette doesn't expose it. Will surface once Sprint 7 lands multi-state data — today every result is in Maharashtra so the filter would be a no-op chip.
- **Ancestors in the API, not the client.** Returning `ancestors.{state,district,village}` from the SQL via `LEFT JOIN admin_boundaries d / s` saves the client a second fetch to rebuild the breadcrumb. Adds three joins per row but keeps the response self-contained.
- **bbox AND centroid on every row.** Boundaries need bbox for `fitBounds`; parcels need centroid for `flyTo` at zoom 17. Computing both in SQL (`CONCAT_WS(',', ST_XMin(geom)::text, ...)` and `ST_X(ST_Centroid(...))::text`) is cheaper than running two endpoints, and the client picks the right one per type.
- **Similarity floor at 0.15.** pg_trgm's default `%` operator threshold is 0.3 — too aggressive (single-typo matches like `maharasta` → `maharashtra` score ~0.47, fine, but a partial like `mahar` would just barely score above). Lowered the floor so trigram still surfaces helpful approximations; exact + prefix lanes still hit 0.88-1.0 so good matches dominate the order.
- **Recents key `landlens:recentSearches` in localStorage, max 8.** Stored as `[{ query, result, at }]` — keeping the original query lets us show "you searched 'pune'" later, even though today we just render the stored result row. Deduped on `type:id` so re-picking an old item doesn't push older entries off the list with duplicates.
- **Debounce 300 ms + AbortController.** Standard, but the abort matters: typing fast on a slow connection was racing stale responses into the panel and reordering rows mid-keystroke. With abort, only the last in-flight response paints.
- **One global Cmd+K listener, suppressed when focus is in another input.** The palette opens from any context (including the parcel sidebar) but won't steal focus from a form input — important once user-editable fields land in Sprint 6.
- **Search button at top-left, not in the breadcrumb.** Breadcrumb is centered at `top-3` and already wide; left-3 / top-14 keeps the search affordance visible without overlapping the breadcrumb or pushing the BasemapSwitcher (top-right). Mobile collapses to icon-only.
- **Khasra/owner selection drills to parcels too.** Just flying to the centroid would open the sidebar but leave the map blank — no polygon outline, no land-type fill, no neighbour parcels. By also setting `parcelsUrl` for the owner's village we get the indigo selected-parcel ring + the village's full parcel layer in one shot.

### Verification

- `npm run typecheck` ✓ clean.
- `npx next build` ✓ all eight API routes present (`/api/search` shows as `ƒ (Dynamic)`), `/[locale]` First Load JS unchanged at 1.27 kB (SearchPalette is part of the lazy MapClient chunk).
- Live curl-tests against `npm run dev` (port 3002):
  - `GET /api/search?q=pune&limit=10` → 200, **Pune Rural** district score 1.0 with bbox + ancestors populated.
  - `GET /api/search?q=maharasta&limit=5` → 200, **Maharashtra** state via trigram score 0.467 (typo-tolerance works).
  - `GET /api/search?q=PNE-01-001&limit=5` → 200, exact khasra score 1.0, then prefix khasra siblings at 0.727.
  - `GET /api/search?q=PNE-01&type=khasra&limit=5` → 200, prefix khasra matches at score 0.9.
  - `GET /api/search?q=tara&limit=5` → 200, owner **Tara Mahajan** score 0.9 + village **Tarn Taran (M)** trigram match 0.36 (mixed-type results in one query).
  - `GET /api/search?q=viram&limit=5` → 200, **Viramgam (M)** village prefix match 0.9.
  - `GET /api/search?q=zzzzznoresult&limit=5` → 200, empty results array (no error).
- `/api/openapi.json` includes `SearchResult` + `SearchResponse` schemas and the `/api/search` path entry.

### What was deferred (in scope of later sprints, NOT skipped accidentally)

- "Open in Google Maps / OSM" external links on the parcel sidebar — Sprint 5 (or pulled forward as a small polish task).
- "Share this parcel" → `#parcel=<uuid>` URL hash that re-opens the sidebar on load — Sprint 5 i18n / routing pass is the natural home.
- i18n catalogs for the palette strings (`Search…`, `No results for…`, kbd hints, footer copy) — Sprint 5.
- Multi-state demo data — only Pune Rural is populated today, so `state=` scoping is functional but visually a no-op. Sprint 7 fixes this.
- Cross-script transliteration (typing `Pune` and finding rows whose only populated name is `पुणे`) — works today only when *both* `name_en` and `name_hi`/`name_local` are filled in. A pluggable transliteration layer (e.g. via `indic-transliteration`) is overkill for Sprint 4 and lands more naturally once we have scraper data in vernacular scripts to test against (Sprint 7).
- Saved searches / per-user history (vs. localStorage-only recents) — Sprint 6 (auth).
- Type-scoped tabs in the palette — the API supports `type=`; the UI is flat-grouped today. Add tabs only if user testing shows the grouped list gets unwieldy.

### Files added this sprint

```
app/api/search/route.ts
components/map/SearchPalette.tsx
```

Modified:
- `components/map/MapView.tsx` — search button, Cmd+K listener, `goToSearchResult` dispatcher, `SearchPalette` render.
- `lib/api/openapi.ts` — `SearchResult` + `SearchResponse` schemas + `/api/search` path registration.
- `public/llms.txt` — `/api/search` line under "Machine-readable endpoints".

### Commits this sprint

- `sprint-4: /api/search endpoint (pg_trgm, 5 entity types, ranked)`
- `sprint-4: command-palette UI with Cmd+K, debounce, recents`
- `sprint-4: search wiring in MapView + OpenAPI + llms.txt`

### Prompt for the next session (Sprint 5 — i18n catalogs + share)

> Read `.claude/CURRENT_STATE.md` first; Sprint 4 closes with `/api/search` live (5 entity types, pg_trgm ranking, ancestors + bbox/centroid for flyTo) and a `Cmd+K` command palette wired into the map. Begin Sprint 5 — i18n & share.
> Scope: next-intl message catalogs for the three launch locales (`en`, `hi`, `ur`) covering Breadcrumb, BasemapSwitcher, LocateMe, ParcelSidebar, OwnershipTimeline, SearchPalette, structured-error messages. RTL polish for Urdu (`dir="rtl"`, mirrored padding/icons via `rtl:` utilities). Share link: `?parcel=<uuid>` (or `#parcel=…`) opens the sidebar on load + a "Share" button on the sidebar that copies the canonical URL. "Open in Google Maps / OSM" external links on the sidebar header. Locale switcher in the top nav (small flag/text trio).
> Don't build: auth + saved bookmarks (Sprint 6), real scraper data (Sprint 7), AI assistant (Sprint 13).
> Before doing anything, confirm `npm run dev` boots, `Cmd+K` opens the palette, typing `pune` shows the Pune Rural district result, and selecting it zooms + paints the village layer.
