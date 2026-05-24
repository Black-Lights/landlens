# 03 — Data Sources

> Where the rows in LandLens come from. The honest version: no single source covers India. We stitch many together.

## The Coverage Reality

If a single dataset had every parcel in India with a polygon, owner, and ULPIN, LandLens would be a CRUD app. It does not exist.

| Source | India coverage | What we get | How we get it |
|---|---|---|---|
| State Bhu-Naksha portals | ~60%, very uneven | Cadastral polygons + Khasra | Scraping |
| State Bhulekh portals | ~85% | Text RoR records (no map) | Scraping |
| Bhuvan (ISRO) | Pan-India | Raster basemaps, WMS | Public WMS |
| Survey of India | Complete | Topographic shapefiles | Paid + licensing |
| OpenStreetMap | Patchy, urban-biased | Roads, buildings, landuse | Overpass / planet dump |
| datameet/maps | All states + districts | Admin boundaries | GitHub clone |
| Local Government Directory | All admin units | LGD codes | CSV download |
| AI segmentation (ours) | Anywhere | Generated polygons | Compute |

The job is wiring these together into one schema with honest provenance.

## What We Ingest, In What Order

### Step 1 — Administrative boundaries (one-time)

From [`datameet/maps`](https://github.com/datameet/maps) and OpenStreetMap Overpass:

```
states + UTs       ← datameet (CC-BY-4.0)
districts          ← datameet (CC-BY-4.0)
tehsils            ← OSM Overpass, admin_level=6
villages           ← OSM Overpass, admin_level=9
```

LGD codes are merged in from the [Local Government Directory CSV](https://lgdirectory.gov.in/). After this step, `admin_boundaries` is populated for all 28 states + 8 UTs.

Script: `scripts/ingest-admin-boundaries.ts`.

### Step 2 — Mock parcels (dev only)

While the website is being built and before any state scraping is wired up, we generate fake parcels so the UI has something to render:

1. Pick a village polygon from `admin_boundaries`
2. Use `turf.voronoi` + `turf.intersect` to chop it into 50–200 plots
3. Tag every row `boundary_source = 'mock'`
4. Generate fake Khasra numbers and owner names with `@faker-js/faker` Indian locale

These rows are **clearly tagged**. The UI displays a "Mock data" badge whenever it renders a parcel with `boundary_source = 'mock'`. They are filtered out of production by `WHERE boundary_source != 'mock'` everywhere except `localhost`.

Scripts: `scripts/generate-mock-parcels.ts`, `scripts/seed-mock-owners.ts`.

### Step 3 — State scrapers (Sprint 7)

One adapter per state. They all implement a common interface:

```typescript
// lib/scrapers/base.ts
interface StateScraper {
  state_code: string;
  fetch_parcels(village_lgd: string): Promise<ParcelRecord[]>;
  fetch_owners(khasra_no: string): Promise<OwnerRecord[]>;
}
```

Priority order (set by area covered × ease of scraping):

| Rank | State | Portal | Notes |
|---|---|---|---|
| 1 | Maharashtra | MahaBhumi | Has both text + polygons |
| 2 | Uttar Pradesh | UP Bhulekh | Text only; polygon from Bhu-Naksha UP |
| 3 | Rajasthan | Apna Khata | Text + polygons via separate flow |
| 4 | Karnataka | Bhoomi / Dishaank | Text + polygons |
| 5 | Tamil Nadu | Patta Chitta | Text + TN BhuLekh polygons |

**Scraping rules — non-negotiable:**
- Honor `robots.txt` of each portal
- 2-second minimum delay between requests
- One concurrent request per portal
- Cache aggressively (24h+) — we are not a real-time mirror
- Set a descriptive `User-Agent` identifying LandLens with a contact URL
- Backoff exponentially on 429 / 5xx

Every scraped row records `source_portal` so attribution and re-scraping are deterministic.

### Step 4 — OSM landuse + buildings (Sprint 8)

Fills urban gaps where state portals are weakest. Overpass query for `landuse=*` and `building=*` polygons inside a district. Tagged `boundary_source = 'osm'`, low confidence (0.60–0.80), `needs_verification = true`.

### Step 5 — AI segmentation (Sprint 9+)

When all of the above produce no polygon, the [AI service](./08-ai-service.md) is called with [registry hints](./05-cadastral-anchoring.md). Tagged `boundary_source = 'ai_with_constraints'` or `'ai_only'` depending on whether hints were available.

### Step 6 — Official partnerships (Phase 3)

The long game. Apply for:
- Bhuvan API access (ISRO) — for higher-resolution vector data
- DILRMP data-sharing MoU — for direct RoR feeds
- DigiLocker integration — for verified document downloads

Once ULPIN rollout completes nationally, `parcels.ulpin` becomes the canonical key and most scraping retires.

## Refresh Cadence

| Source | Refresh | Why |
|---|---|---|
| `admin_boundaries` | Quarterly | Admin units rarely change |
| State scrapers | Weekly per district | Mutations happen daily but daily-per-village is too aggressive |
| OSM | Monthly | Match OSM planet dump cycle |
| AI segmentation | On-demand, plus nightly batch for unmapped districts | Compute-bound |
| LGD codes | Annually | LGD itself updates slowly |

Refresh writes a new row with a newer `data_year`, doesn't UPDATE in place. Old rows are kept for forensics until we explicitly prune.

## Data Quality Signals

Every row carries enough metadata to answer "should I trust this?":

- `boundary_source` — the tier
- `confidence_score` — 0–1
- `data_year` — when the source last touched it
- `last_verified_at` — when a human (or admin assistant) last checked it
- `needs_verification` — flagged for review

The UI surfaces this honestly. "AI-detected boundary · 78% confidence · Verify" beats hiding the uncertainty.

## User Location (GPS)

The "Locate me" feature uses the browser's Geolocation API to discover parcels around the user's current position. This is the only data source where the **user is the source**.

| Property | Value |
|---|---|
| Source | `navigator.geolocation.getCurrentPosition` / `watchPosition` (browser-native) |
| Consent | Required, per browser's Geolocation Permission API |
| Accuracy | 5–50m typical (urban GPS), worse indoors |
| Storage | **Not persisted.** Coordinates live in memory for the duration of the in-session query only. |
| Use | Passed to `/api/parcels/nearby?lat=&lng=&radius_m=` for a one-shot or watched query |
| Transport | HTTPS only — the Geolocation API requires a secure context |
| Fallback | If permission denied: toast `locate.permission_denied`. The map remains usable for non-GPS browsing. |

If the user is logged in and explicitly saves a parcel they discovered via "Locate me", only the `parcel_id` is stored in `saved_parcels`. The user's actual coordinate or movement trail is **never** stored, even in `access_log` (which only records the parcel viewed, not how the user got there).

This is a deliberate posture for DPDP Act compliance (see §13 of `CLAUDE_CODE_PROMPT.md`). GPS coordinates are sensitive personal data under the Act when paired with an identity. By never persisting them, the surface area for breach or subpoena is zero.

## Basemap Providers

Parcel polygons and admin boundaries are LandLens's own data. The **basemap** under them — streets, satellite imagery, terrain — comes from external tile providers. Four are wired into the map's `BasemapSwitcher` control:

| Basemap | Provider | URL pattern | Cost | Attribution |
|---|---|---|---|---|
| **Streets (default)** | MapTiler Cloud | `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=...` | Free 100k loads/mo | `© MapTiler © OpenStreetMap contributors` |
| **Satellite** | Esri World Imagery | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | Free | `Source: Esri, Maxar, Earthstar Geographics` |
| **Terrain** | OpenTopoMap | `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png` | Free | `© OpenTopoMap (CC-BY-SA)` |
| **Indian Satellite** (optional) | Bhuvan WMS (ISRO) | `https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms` | Free non-commercial | `© Bhuvan / NRSC / ISRO` |

The active basemap's attribution string is rendered in `AttributionFooter.tsx` (bottom-right). Switching basemaps swaps the string in place — never blank, never wrong.

### Why Google Maps Is Not in This List

Google Maps Platform is the obvious-looking choice and we are deliberately not using it. Three reasons:

1. **Pricing.** Google bills per map load. At pan-India consumer scale (hundreds of thousands of monthly users opening a map-first UI), the bill compounds quickly with no graceful free tier. MapTiler's 100k-loads/mo free tier and Esri's free public tile service hit our use case without a billing cliff.
2. **Licensing.** Google's Terms of Service restrict overlaying third-party vector data — exactly what LandLens does (cadastral polygons over the basemap). MapTiler, Esri, OpenTopoMap, and Bhuvan all permit this overlay use case unambiguously.
3. **Coverage.** Esri World Imagery uses Maxar high-resolution data that covers India well, and Bhuvan provides Indian-specific satellite imagery from ISRO when extra-local detail matters. We do not lose coverage by skipping Google.

The choice is reviewed if any of the four providers materially changes terms.

### Provider-Specific Notes

- **MapTiler** requires an API key (`NEXT_PUBLIC_MAPTILER_KEY`). The key is public — it's restricted by HTTP referrer (only `land.trenlens.com` and `localhost`) at the MapTiler console.
- **Esri World Imagery** is served from `server.arcgisonline.com` without a key. Esri's Public Use Constraints require the attribution line on every map that uses it.
- **OpenTopoMap** is community-run on donated infrastructure. We respect the tile usage policy: minimum zoom level 6 enforced client-side, no scraping, attribution always visible.
- **Bhuvan WMS** is rate-sensitive — we cache tiles in Upstash with a 7-day TTL when this basemap is selected. Best for power users who want Indian-domestic imagery; not the default.

## Discrepancy Detection (Bonus Feature)

When both a registry polygon and an AI polygon exist for the same area, we compare. `ST_HausdorffDistance` and `ST_Area` deltas above thresholds flag possible encroachment, unregistered subdivision, or stale records. Surfaced as a "Possible discrepancy detected" badge. Banks, buyers, lawyers care about this. No competitor does it.

## What's Next

→ Read [Boundary Segmentation](./04-boundary-segmentation.md) for how AI fills the gaps the scrapers can't.
