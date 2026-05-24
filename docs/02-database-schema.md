# 02 — Database Schema

> What LandLens stores, why we store it that way, and how each table connects to the next.

## The Eight Tables

LandLens fits into eight core tables. Five hold cadastral data, three hold platform / commercial scaffolding.

```
admin_boundaries ──┐
                   ├── parcels ──┬── ownership_records
                   │             ├── encumbrances
                   │             ├── parcel_corrections
                   │             └── saved_parcels ── (auth.users)
                   │
access_log ────────┘
```

Plus three tables added for AI-first / commercial readiness:

```
admin_api_keys                ← BYOK for the in-app assistant
admin_assistant_conversations ─┬── admin_assistant_messages
api_keys ────── api_usage     ← Public API (Phase 2)
```

## Why PostgreSQL + PostGIS (and not Firebase)

Cadastral data is **geometric, relational, and joined**:
- A parcel has a *polygon*, an owner, a village, encumbrances. That's four joins on a single click.
- Spatial questions ("what's inside this polygon?", "what's nearest this point?") need a geometry index.

Firebase has no joins and no spatial index. PostGIS is the industry standard for both. The decision is closed.

## Table-by-Table

### `admin_boundaries` — the geographic hierarchy

Every administrative unit, from country down to village, in **one self-referential table** with a `level` column and a `parent_id` foreign key.

| Column | Why it exists |
|---|---|
| `level` | `country` / `state` / `district` / `tehsil` / `village` |
| `parent_id` | A village's parent is its tehsil; a tehsil's parent is its district. Enables `WITH RECURSIVE` drill-down queries. |
| `lgd_code` | The Local Government Directory code — the only ID that's stable across Indian government systems. |
| `geom` | The polygon. `MULTIPOLYGON` because some districts are non-contiguous. |
| `centroid` | Pre-computed so "zoom to this state" doesn't have to recalculate `ST_Centroid` every time. |
| `area_sqkm` | Also pre-computed. PostGIS's `ST_Area(geom::geography)` is expensive at query time. |

Indexes: GIST on `geom`, trigram GIN on `name_en` (for fuzzy search), btree on `level` and `parent_id`.

### `parcels` — the heart of the platform

One row per land plot. The polygon is the most important column; everything else is metadata about that polygon.

Three groups of columns:

**Identity** — `ulpin`, `khasra_no`, `survey_no`, `sub_division`. ULPIN is the future-canonical 14-digit ID; the others are legacy state IDs that we still need because ULPIN rollout is incomplete.

**Geometry** — `geom` (the polygon), `centroid` (pre-computed), `area_sqm` plus `area_acres` and `area_hectares` as `GENERATED ALWAYS AS` columns. The generated columns mean we never have unit-conversion bugs.

**Provenance** — the column that makes LandLens trustworthy:

```
boundary_source ∈ {
  govt_bhunaksha,         -- TIER 1
  fmb_reconstructed,      -- TIER 2
  ai_with_constraints,    -- TIER 3
  osm,                    -- TIER 4
  ai_only,                -- TIER 5
  user_corrected,
  mock
}
```

Paired with `confidence_score` (0.00–1.00), `ai_model_version`, `needs_verification`, `last_verified_at`. Every polygon on the map carries its lineage. See [Boundary Segmentation](./04-boundary-segmentation.md).

`raw_data JSONB` keeps the original record from the source portal — for forensics if a scrape is later disputed.

### `ownership_records` — Record of Rights

Multiple rows per parcel: one for each owner across time. `transfer_date IS NULL` means current owner; we expose this as a generated column `is_current`.

Owner names are stored **three times**:
- `owner_name` — original script (Devanagari, Tamil, Urdu)
- `owner_name_en` — transliteration for searching
- `owner_name_masked` — `"Rajesh K."` for public display

The masked column is what unauthenticated users see. The full name is gated behind login + terms acceptance, by design. See [Section 13 of the project prompt](../CLAUDE_CODE_PROMPT.md).

### `encumbrances` — mortgages, court cases, disputes

Many-to-one with `parcels`. Status badge in the UI reads directly from `status ∈ {active, resolved, pending}`. Partial index on `status = 'active'` so the homepage badge query is instant.

### `parcel_corrections` — the community queue

When a logged-in user edits an AI-detected polygon, we don't overwrite the parcel. We write a *correction*, store both `previous_geom` and `new_geom`, and queue it for admin review. The admin assistant (Sprint 13) drains this queue. See [Boundary Segmentation](./04-boundary-segmentation.md#community-corrections).

### `saved_parcels` — user bookmarks

A simple join table. Owner is `auth.users(id)` from Supabase Auth, cascading delete.

### `access_log` — privacy + analytics

Every parcel detail view writes a row. **IP is hashed, not raw** — we get pattern visibility without storing PII. This satisfies the audit requirement in Section 13 of the prompt.

### `admin_api_keys` — BYOK encryption

For the in-app admin assistant. The user's LLM API key is encrypted via Supabase Vault (`pgsodium`) before insert. The `encrypted_key BYTEA` column never contains plaintext. Decrypted only in-memory, only during the admin's session. See [Admin Assistant](./13-admin-assistant.md).

### `api_keys` / `api_usage` — commercial scaffolding

Wired in Phase 1, but every key is `tier = 'community'` and every commercial feature flag defaults `false`. When Phase 2 lands, no schema change is needed — only new tier values and flipped flags. See [Enterprise Tier](./15-enterprise-tier.md).

## Indexing Philosophy

Three principles:

1. **Every `geom` column gets a GIST index.** Spatial queries without one are O(n).
2. **Every fuzzy-searchable text column gets a trigram GIN index.** `pg_trgm` makes `ILIKE '%raj%'` index-backed.
3. **Partial indexes for hot subsets.** `WHERE needs_verification = true`, `WHERE status = 'active'`, `WHERE is_current = true`. These are the queries the UI runs constantly.

## Common Spatial Queries

The geometry indexes pay off only if the queries are written to use them. Three patterns cover most of LandLens.

### Point-in-polygon ("what parcel is at this click?")

```sql
SELECT id, khasra_no, area_sqm
FROM parcels
WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($lng, $lat), 4326))
LIMIT 1;
```

Uses the GIST index on `geom`. Sub-millisecond on a 10M-row table.

### Bounding box ("what parcels are in the viewport?")

```sql
SELECT id, ST_AsMVTGeom(geom, ST_TileEnvelope($z, $x, $y)) AS mvt_geom
FROM parcels
WHERE geom && ST_MakeEnvelope($west, $south, $east, $north, 4326);
```

The `&&` operator is the GIST-accelerated bounding-box intersect. Used by the vector tile endpoint.

### Radius search ("what parcels are within 500m of me?")

Powers the "Locate me" feature.

```sql
-- "Find parcels within 500m of user GPS"
-- Uses geography type for accurate meter-based distance
SELECT id, khasra_no, area_sqm,
       ST_Distance(geom::geography, ST_MakePoint($lng, $lat)::geography) AS distance_m
FROM parcels
WHERE ST_DWithin(geom::geography, ST_MakePoint($lng, $lat)::geography, 500)
ORDER BY distance_m ASC
LIMIT 100;
```

Two things make this query fast and correct:

1. **`geography` casts, not `geometry`.** Distances on `geometry(_, 4326)` are in degrees — meaningless near the equator vs. near Kashmir. Casting both sides to `geography` makes the units real meters, anywhere in India.
2. **`ST_DWithin` + GIST on `geom`.** The planner uses the existing `parcels_geom_idx` to prune the search to a bounding-box candidate set before doing the precise geodesic distance check on each candidate. The cast does not defeat the index.

`$lat` and `$lng` come from the request; never substituted as string — always bound parameters via Prisma's `$queryRaw` to prevent SQL injection.

## Migration Strategy

Prisma owns schema migrations. PostGIS extension enablement is done **once, manually** in the Supabase SQL editor before the first migration — Prisma can't manage extensions:

```sql
CREATE EXTENSION postgis;
CREATE EXTENSION pg_trgm;
CREATE EXTENSION "uuid-ossp";
CREATE EXTENSION pgsodium;
```

After that, all schema changes go through `prisma migrate dev` → `prisma migrate deploy`. We never edit the database manually.

## What's Next

→ Read [Data Sources](./03-data-sources.md) to see where the rows in these tables come from.
