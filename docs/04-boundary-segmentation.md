# 04 — Boundary Segmentation

> How LandLens draws parcel polygons on the map when the government didn't draw them first. The five-tier pipeline, the website's role, and the AI service's role.

## The Question We're Answering

A user clicks a point on the map. We need to return a polygon and metadata. We have **five places to look**, in order. Each is more uncertain than the last.

```
User clicks (lat, lng)
   │
   ▼
TIER 1 — Government Bhu-Naksha polygon         (confidence 0.95–1.00)
   │ miss
   ▼
TIER 2 — FMB corner-coordinate reconstruction   (confidence 0.90–0.97)
   │ miss
   ▼
TIER 3 — Registry-constrained AI segmentation   (confidence 0.75–0.90)
   │ miss
   ▼
TIER 4 — OSM landuse / building footprints      (confidence 0.60–0.80)
   │ miss
   ▼
TIER 5 — Pure AI segmentation (no hints)        (confidence 0.40–0.70)
   │ miss
   ▼
"Boundary not available at this location"
```

Every polygon we return is tagged with which tier produced it (`parcels.boundary_source`). That tag drives a badge in the UI so users see exactly how trustworthy the boundary is.

## Why Five Tiers, Not Just "AI"

Pure AI segmentation of cadastral boundaries is **wrong by default** in India. Two reasons:

1. **Adjacent parcels look identical.** Two rice paddies owned by different people are visually one field. See [Cadastral Anchoring](./05-cadastral-anchoring.md).
2. **Cadastral boundaries are legal, not visual.** A boundary can be the middle of a stream, the centerline of a road, or a line nobody planted a hedge along.

Government polygons (Tier 1) and registry hints (Tier 3) are the only things that align AI output with legal reality. Without them, we're showing the wrong polygons confidently.

## Tier 1 — Government Bhu-Naksha

If a state portal already has the polygon, we use it directly. No work needed. This covers ~60% of India, very unevenly distributed.

Implementation: every state scraper in `lib/scrapers/` writes Bhu-Naksha polygons to `parcels` with `boundary_source = 'govt_bhunaksha'`. See [Data Sources](./03-data-sources.md#step-3--state-scrapers-sprint-7).

## Tier 2 — FMB Reconstruction

Field Measurement Books (FMBs) record the **corner coordinates** of a parcel as a surveyor's traverse: bearings, distances, station points. Even when a portal doesn't publish polygons, it sometimes publishes FMB data.

We reconstruct the polygon by walking the traverse:

```
start at (lat0, lng0)
for each (bearing, distance) in fmb_traverse:
  (lat, lng) = move(prev, bearing, distance)
close ring back to start
```

This gives a near-exact polygon — surveyor-measured, not AI-guessed. Confidence is high. Lives in the AI service repo (`registry_anchor.py`) because the math is heavier than what fits in the web app.

## Tier 3 — Registry-Constrained AI (The Important One)

Where most of LandLens's accuracy comes from. The website gathers everything the registry knows about an area and passes it to the AI service as constraints.

### What the website sends

```typescript
// lib/segmentation/client.ts
const hints = await db.getRegistryHintsForArea(lat, lng);
// {
//   expected_plot_count: 47,
//   expected_areas_sqm: [2023, 4250, 1890, ...],
//   adjacency_graph: { "123": ["124","125"], ... },
//   village_lgd_code: "...",
//   land_use_distribution: { agricultural: 0.7, residential: 0.2, ... }
// }

await fetch(`${process.env.SEGMENTATION_SERVICE_URL}/segment`, {
  method: 'POST',
  body: JSON.stringify({ lat, lng, registry_hints: hints }),
});
```

### What the AI service does with it

1. Pulls AlphaEarth embeddings + Sentinel-2 imagery for the area
2. Runs SAM2 on the imagery → raw segmentation masks
3. Splits or merges masks to match `expected_plot_count`
4. Uses area-balanced k-means to bias splits toward `expected_areas_sqm`
5. Snaps polygon edges to OSM roads where adjacency suggests a road boundary
6. Returns polygons + confidence per polygon

Returned polygons are written with `boundary_source = 'ai_with_constraints'`. See [AI Service](./08-ai-service.md) for full pipeline.

### Graceful degradation

If `SEGMENTATION_SERVICE_URL` is empty, undefined, or the service returns non-2xx, the website returns `null` and falls through to Tier 4. **The website never crashes because the AI is down.** This is enforced by a try/catch around the only call site.

## Tier 4 — OSM Landuse / Buildings

If OSM has a `landuse=*` or `building=*` polygon containing the click, we use it. Confidence is moderate. `boundary_source = 'osm'`, `needs_verification = true`.

## Tier 5 — Pure AI (No Hints)

Same AI service as Tier 3, but called with empty `registry_hints`. The AI does its best without legal context. `boundary_source = 'ai_only'`, `needs_verification = true`, confidence below 0.7 by default.

This tier exists for completeness — better to show a possibly-wrong polygon with a "Verify" warning than to show nothing.

## Community Corrections

When a logged-in user thinks a polygon is wrong, they don't overwrite it. They submit a correction:

```sql
INSERT INTO parcel_corrections (parcel_id, user_id, previous_geom, new_geom, reason, status)
VALUES (?, ?, ?, ?, ?, 'pending');
```

An admin reviews via:
- the `/admin/corrections` page, OR
- the in-app [Admin Assistant](./13-admin-assistant.md) using `approve_correction` / `reject_correction` tools, OR
- the [MCP Server](./12-mcp-server.md) from Claude Desktop / Cursor

On approve: `parcels.geom` is replaced with `new_geom`, `boundary_source` becomes `'user_corrected'`, the correction row is marked approved.

## Discrepancy Detection

When both a registry polygon (Tier 1) **and** an AI polygon (Tier 3 or 5) exist for the same parcel, we compute:

- `ST_HausdorffDistance(registry_geom, ai_geom)` — max edge deviation
- `(ai_area - registry_area) / registry_area` — area delta
- IoU between the two polygons

If any of these crosses a threshold, the parcel is flagged with a "Possible discrepancy detected" badge. This catches:

- **Encroachment** — someone farming beyond their registered plot
- **Unregistered subdivisions** — one Khasra physically split into two
- **Stale records** — registry hasn't been updated after a real-world change

No competitor offers this. It is a direct value-add for buyers, banks, and lawyers.

## Pre-Computation

We don't want to call the AI service in real time for every click. Two pre-compute strategies:

1. **Nightly batch (Sprint 10)** — A cron job runs Tier 3 segmentation across one district at a time, sorted by user interest (click volume in `access_log`). Results land in `parcels` overnight.

2. **Vector tile bake (Sprint 15)** — Once polygons exist, MVT tiles are pre-baked for zoom levels 5–12 and served from `public/tiles/`. Click-to-parcel is sub-100ms because the tile already contains the polygon.

## Honest Provenance, Always

Every polygon LandLens shows carries a badge: "Official" / "FMB Reconstructed" / "AI · 78% · Verify" / "OSM" / "AI (Low Confidence)" / "Community Edit". Users can filter the map by source. The discrepancy badge is its own layer.

We never silently merge tiers into one "boundary" claim. That trust signal is the product.

## What's Next

→ Read [Cadastral Anchoring](./05-cadastral-anchoring.md) for the deeper explanation of how registry data constrains the AI.
