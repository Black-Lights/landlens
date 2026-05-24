# LandLens — Claude Code Project Prompt

> **Vision:** A unified, modern, beautiful pan-India cadastral platform. The Stripe of Indian land records — clean, fast, multilingual, mobile-first.
>
> **Tagline:** *See Every Inch of Land*
>
> **Built by a geoinformatics engineer, for everyone.**

---

## 0. Project Structure — Two Repositories

LandLens is built as **two separate projects** that communicate via HTTP:

```
landlens/                          ← This prompt is for THIS repo
  └── Next.js + TypeScript          The website. Launches first.
                                    Works on its own with real cadastral data.

landlens-segmentation/             ← Separate project, separate prompt
  └── Python + FastAPI + PyTorch    The AI brain. Built in parallel.
                                    Plugged in later via env var.
                                    Doubles as thesis research.
```

**Why two repos:**
- Different languages, runtimes, hosting, costs, dev cycles
- Website ships fast; AI service does months of research
- AI service is publishable open-source research output
- Website degrades gracefully when AI service is down or absent
- See `/docs/01-architecture.md` and `/docs/08-ai-service.md` for full reasoning

**This prompt builds `landlens/` only.** The AI service has its own prompt.

---

## 1. Why LandLens Exists (Market Gap)

Every government land portal in India today is **fragmented, ugly, slow, and unilingual**:
- Bhu Naksha (NIC) is split across 28+ state portals with 2008-era UI
- State portals (MahaBhumi, MeeBhoomi, AnyROR, Bhoomi, Apna Khata, Patta Chitta, Jamabandi) don't talk to each other
- Bhulekh portals show text records but lack proper map UX
- ULPIN (14-digit unified ID) is being rolled out but no consumer interface exists

**LandLens unifies all of this into one elegant interface** — pan-India coverage, click-to-explore, multilingual, mobile-first.

---

## 2. Tech Stack (Scalable, Free-Tier-First)

| Layer | Tool | Why |
|---|---|---|
| **Framework** | Next.js 14 (App Router) + TypeScript | SSR, edge functions, Vercel-native |
| **Map Engine** | MapLibre GL JS + react-map-gl | Open-source Mapbox fork, vector tiles, no token needed |
| **Basemaps** | MapTiler (streets, default) + Esri World Imagery (satellite) + OpenTopoMap (terrain) + Bhuvan WMS (optional, Indian satellite) | Four-option switcher. Google Maps explicitly excluded — see below. |
| **Database** | Supabase (PostgreSQL 15 + PostGIS 3.4) | Geospatial-native. Firebase ❌ — no PostGIS, no joins. |
| **ORM** | Prisma | Type-safe queries, migrations |
| **Cache** | Upstash Redis (free 10k cmd/day) | Cache GeoJSON polygons, parcel lookups |
| **Auth** | Supabase Auth | OTP login (phone), Google OAuth |
| **i18n** | next-intl | App Router native, type-safe, message catalogs |
| **Search** | Postgres full-text + pg_trgm | No external search service needed for MVP |
| **Hosting** | Vercel (frontend) + Supabase (DB) | Both free tier |
| **Domain** | `land.trenlens.com` (Cloudflare CNAME → Vercel) | Reuse existing trenlens.com |
| **Styling** | Tailwind CSS + shadcn/ui | Minimal, consistent |
| **Fonts** | Inter (Latin) + Noto Sans Devanagari (Hindi) + Noto Nastaliq Urdu (Urdu) | Self-host via `next/font` |
| **Icons** | Lucide React | Clean, consistent |

### Scalability Strategy (already baked in)
- **Cache-first reads** — Redis caches boundary GeoJSON (24h TTL) and parcel details (1h TTL)
- **Vector tiles** instead of raw GeoJSON — 90% smaller payloads
- **Edge runtime** for read-heavy APIs (Vercel Edge Functions)
- **PostGIS GIST indexes** on all `geom` columns
- **PgBouncer** connection pooling (built into Supabase)
- **Rate limiting** via Upstash Redis middleware on all API routes (60 req/min/IP)
- Migration path: Supabase free → Supabase Pro → self-hosted Postgres on Neon/AWS RDS

### Basemap Providers (Four-Option Switcher)

A `BasemapSwitcher` control toggles between four basemaps. All four are loaded as MapLibre raster sources (Esri/Bhuvan/OpenTopoMap) or vector (MapTiler). Defaults to Streets.

| Basemap | Provider | URL pattern | Cost | Attribution |
|---|---|---|---|---|
| **Streets (default)** | MapTiler Cloud | `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=...` | Free 100k loads/mo | `© MapTiler © OpenStreetMap contributors` |
| **Satellite** | Esri World Imagery | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | Free | `Source: Esri, Maxar, Earthstar Geographics` |
| **Terrain** | OpenTopoMap | `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png` | Free | `© OpenTopoMap (CC-BY-SA)` |
| **Indian Satellite** (optional) | Bhuvan WMS (ISRO) | `https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms` | Free non-commercial | `© Bhuvan / NRSC / ISRO` |

The active basemap's attribution is shown in `AttributionFooter.tsx` (bottom-right). Switching basemaps swaps the attribution string in place.

**Why Google Maps is excluded:** Google Maps Platform pricing tiers don't fit a pan-India consumer product (per-load billing balloons fast at scale). Google's TOS also restricts vector-overlay use cases — exactly what LandLens does with cadastral polygons. Esri World Imagery covers India well via Maxar high-resolution data, and Bhuvan provides Indian-specific imagery when needed. We lose nothing by skipping Google.

---

## 3. Domain Setup (Cloudflare → Vercel)

**Target URL:** `https://land.trenlens.com`

```
Cloudflare DNS (trenlens.com zone):
  Type:   CNAME
  Name:   land
  Target: cname.vercel-dns.com
  Proxy:  DNS only (gray cloud, NOT orange)
```

Then in Vercel project settings → Domains → Add `land.trenlens.com`. SSL auto-issued in ~1 min.

---

## 4. UI/UX Philosophy (Geoinformatics-Grade)

### Design References
- **Felt.com** — modern collaborative maps
- **Mapbox Studio** — minimal chrome, map-first
- **Linear.app** — typography & restraint
- **QGIS** — layer panel inspiration (simplified)

### Visual Language
- **Map = 100% of viewport.** UI floats over it as glass panels.
- **Color palette:** neutral slate grays + single indigo accent (`#4F46E5`)
- **Typography:** Inter for UI, Noto Sans Devanagari for Hindi/Indic scripts
- **Spacing:** 8px grid, generous whitespace
- **Shadows:** subtle (`shadow-sm`, `shadow-md` max)
- **No gradients, no neon, no glassmorphism overload** — just clean

### Core UI Elements (must-haves for any GIS app)
- **Scale bar** (bottom-left) — adjusts with zoom
- **Coordinate readout** (bottom-right) — lat/lng + UTM zone toggle
- **North arrow** (top-right, optional)
- **Zoom controls** (`+`/`−` buttons, top-right, mobile-friendly)
- **"Locate me" button** (bottom-right, above the coordinate readout) — uses `navigator.geolocation.getCurrentPosition` to center the map on the user's GPS position with a 50m accuracy circle. Drops a pulsing blue dot at the user's location. Auto-loads all parcels in a 500m radius via `/api/parcels/nearby`. Updates on user motion if "follow mode" is toggled on (uses `watchPosition`). Falls back gracefully if permission denied (toast: `locate.permission_denied`). On HTTPS only — the Geolocation API requires a secure context.
- **Layer toggle panel** (left, collapsible) — basemap, cadastral, satellite, terrain, admin
- **Search bar** (top-center, command-palette style with `Ctrl+K`)
- **Breadcrumb** (top, slide-down) — India → State → District → Tehsil → Village → Parcel
- **Attribution** (bottom-right, small) — data source credits

### Mobile-First
- Map fills screen
- Bottom sheet for parcel details (swipe up to expand)
- Floating Action Button for search
- Layer toggle in hamburger drawer
- **On mobile, the "Locate me" button is the primary CTA on first load** — most users will be physically at the land they want to look up. Position it prominently in the thumb zone (bottom-right, above the coordinate readout).

---

## 5. Multi-Language (i18n)

**Default: English (`en`). Phase 1 also ships Hindi (`hi`).**

```
locales/
  ├── en.json      ← shipped at launch (DEFAULT)
  ├── hi.json      ← shipped at launch
  ├── ur.json      ← shipped at launch — RTL, critical for J&K, Telangana historical records
  ├── mr.json      ← phase 2: Marathi
  ├── ta.json      ← phase 2: Tamil
  ├── te.json      ← phase 2: Telugu
  ├── kn.json      ← phase 2: Kannada
  ├── bn.json      ← phase 2: Bengali
  ├── gu.json      ← phase 3: Gujarati
  ├── pa.json      ← phase 3: Punjabi
  ├── or.json      ← phase 3: Odia
  └── ml.json      ← phase 3: Malayalam
```

### Why Urdu at launch?
- J&K historical Jamabandi records are in Urdu/Persian script
- Hyderabad/Telangana pre-1948 Nizam-era records are in Urdu
- Urdu is an official language in Bihar, Jharkhand, UP, WB, Telangana, J&K, Delhi
- Adds RTL infrastructure once — useful for future Arabic/Persian historical document support

### Implementation
- Use **next-intl** with App Router
- Language switcher in header (globe icon, dropdown)
- Detect browser language on first visit, persist choice in cookie
- URLs: `/en/parcel/123`, `/hi/parcel/123` (locale-prefixed)
- Numerals: optional toggle for Indian Devanagari numerals (१२३) in `hi` locale
- All cadastral terminology localized: Khasra/खसरा, Khatauni/खतौनी, Tehsil/तहसील, etc.
- Owner names: stored in original script + transliteration field, display based on user choice

### Hindi & Urdu Specific Polish
- Use `font-feature-settings: "kern" 1` for proper Devanagari kerning
- Test all UI at 1.3× text length (Hindi/Urdu typically longer than English)
- Right-side panels: ensure no text truncation at 30 characters
- **RTL support for Urdu:** use Tailwind's `rtl:` prefix utilities + `dir="rtl"` on `<html>`
- Urdu font: **Noto Nastaliq Urdu** for authentic Persian-style calligraphy
- Mirror UI layout in RTL: sidebar slides from left instead of right, breadcrumb reverses
- Number alignment: Indo-Arabic numerals (1,2,3) for Urdu, NOT Eastern Arabic (١,٢,٣) — India uses Indo-Arabic even in Urdu

---

## 6. Database Schema (PostGIS-Powered)

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- fuzzy search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Administrative boundaries (hierarchical)
CREATE TABLE admin_boundaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en TEXT NOT NULL,
  name_hi TEXT,                            -- Hindi name
  name_local TEXT,                         -- regional language
  level TEXT NOT NULL CHECK (level IN ('country', 'state', 'district', 'tehsil', 'village')),
  parent_id UUID REFERENCES admin_boundaries(id),
  lgd_code TEXT UNIQUE,                    -- Local Government Directory code
  geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  centroid GEOMETRY(POINT, 4326),          -- precomputed for fast zoom-to
  area_sqkm DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX admin_geom_idx ON admin_boundaries USING GIST(geom);
CREATE INDEX admin_name_trgm_idx ON admin_boundaries USING GIN(name_en gin_trgm_ops);
CREATE INDEX admin_level_idx ON admin_boundaries(level);
CREATE INDEX admin_parent_idx ON admin_boundaries(parent_id);

-- Land parcels (the heart of the platform)
CREATE TABLE parcels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ulpin TEXT UNIQUE,                       -- 14-digit Bhu-Aadhaar
  khasra_no TEXT,
  survey_no TEXT,
  sub_division TEXT,
  village_id UUID REFERENCES admin_boundaries(id),
  area_sqm DECIMAL NOT NULL,
  area_acres DECIMAL GENERATED ALWAYS AS (area_sqm / 4046.86) STORED,
  area_hectares DECIMAL GENERATED ALWAYS AS (area_sqm / 10000) STORED,
  land_type TEXT CHECK (land_type IN (
    'agricultural', 'residential', 'commercial', 'industrial',
    'forest', 'government', 'water_body', 'wasteland', 'mixed'
  )),
  land_use TEXT,                           -- irrigated, rainfed, etc.
  classification TEXT,                     -- per state land classification
  geom GEOMETRY(POLYGON, 4326) NOT NULL,
  centroid GEOMETRY(POINT, 4326),
  source_portal TEXT,                      -- bhulekh_up, mahabhumi, etc.
  data_year INT,                           -- when the record was last updated
  raw_data JSONB,                          -- full original record for forensics
  
  -- Boundary provenance (registry-anchored segmentation tracking)
  boundary_source TEXT CHECK (boundary_source IN (
    'govt_bhunaksha',         -- TIER 1: official polygon
    'fmb_reconstructed',      -- TIER 2: from FMB corner coordinates
    'ai_with_constraints',    -- TIER 3: AI + registry hints (split correctly)
    'osm',                    -- TIER 4: OpenStreetMap
    'ai_only',                -- TIER 5: pure AI, no registry hints
    'user_corrected',         -- community-edited
    'mock'                    -- dev seed data
  )) NOT NULL DEFAULT 'mock',
  confidence_score DECIMAL(3,2),           -- 0.00 - 1.00
  ai_model_version TEXT,                   -- 'sam2-hiera-large-v1.2'
  needs_verification BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  verified_by UUID,                        -- references auth.users(id)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX parcels_geom_idx ON parcels USING GIST(geom);
CREATE INDEX parcels_centroid_idx ON parcels USING GIST(centroid);
CREATE INDEX parcels_village_idx ON parcels(village_id);
CREATE INDEX parcels_ulpin_idx ON parcels(ulpin);
CREATE INDEX parcels_khasra_idx ON parcels(khasra_no);
CREATE INDEX parcels_land_type_idx ON parcels(land_type);
CREATE INDEX parcels_source_idx ON parcels(boundary_source);
CREATE INDEX parcels_unverified_idx ON parcels(needs_verification) WHERE needs_verification = true;

-- Community correction queue (when users edit AI-detected polygons)
CREATE TABLE parcel_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE,
  user_id UUID,                            -- references auth.users(id)
  previous_geom GEOMETRY(POLYGON, 4326),
  new_geom GEOMETRY(POLYGON, 4326),
  reason TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX corrections_parcel_idx ON parcel_corrections(parcel_id);
CREATE INDEX corrections_status_idx ON parcel_corrections(status);

-- Ownership records (Record of Rights / Khatauni / Jamabandi)
CREATE TABLE ownership_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,                -- original script
  owner_name_en TEXT,                      -- transliterated
  owner_name_masked TEXT,                  -- "Rajesh K." for privacy
  father_or_spouse TEXT,
  ownership_type TEXT CHECK (ownership_type IN (
    'sole', 'joint', 'huf', 'government', 'trust', 'company'
  )),
  share_fraction TEXT,                     -- "1/4", "1/2" for joint owners
  mutation_no TEXT,
  registration_date DATE,
  transfer_date DATE,                       -- NULL = current owner
  document_no TEXT,
  document_type TEXT,                       -- sale_deed, gift_deed, inheritance
  is_current BOOLEAN GENERATED ALWAYS AS (transfer_date IS NULL) STORED,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ownership_parcel_idx ON ownership_records(parcel_id);
CREATE INDEX ownership_current_idx ON ownership_records(parcel_id) WHERE is_current = true;
CREATE INDEX ownership_name_trgm_idx ON ownership_records USING GIN(owner_name_en gin_trgm_ops);

-- Encumbrances (mortgages, court cases, disputes)
CREATE TABLE encumbrances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN (
    'mortgage', 'court_case', 'dispute', 'easement', 'lien', 'attachment'
  )),
  party_name TEXT,                          -- bank, plaintiff, etc.
  description TEXT,
  amount DECIMAL,                           -- for mortgages
  start_date DATE,
  end_date DATE,
  status TEXT CHECK (status IN ('active', 'resolved', 'pending')),
  reference_no TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX encumbrances_parcel_idx ON encumbrances(parcel_id);
CREATE INDEX encumbrances_active_idx ON encumbrances(parcel_id) WHERE status = 'active';

-- User saved searches / bookmarks (post-auth)
CREATE TABLE saved_parcels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE,
  label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, parcel_id)
);

-- Audit log (track who looked up what — for compliance + analytics)
CREATE TABLE access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  parcel_id UUID REFERENCES parcels(id),
  ip_hash TEXT,                             -- hashed, not raw, for privacy
  user_agent TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX access_log_parcel_idx ON access_log(parcel_id);
CREATE INDEX access_log_user_idx ON access_log(user_id);
```

---

## 7. API Routes

```
# Boundaries (hierarchical drill-down)
GET  /api/boundaries/states                      → All 28 states + 8 UTs as vector tiles
GET  /api/boundaries/districts?state=:lgd        → Districts of a state
GET  /api/boundaries/tehsils?district=:lgd       → Tehsils of a district
GET  /api/boundaries/villages?tehsil=:lgd        → Villages of a tehsil

# Parcels
GET  /api/parcels/at?lat=:lat&lng=:lng          → Spatial point-in-polygon lookup
GET  /api/parcels/in-bbox?bbox=:w,:s,:e,:n      → All parcels in viewport
GET  /api/parcels/nearby?lat=:lat&lng=:lng&radius_m=:radius
                                                 → Parcels within radius, sorted by distance.
                                                 # Uses PostGIS ST_DWithin on geography type
                                                 # so radius is in meters, not degrees.
                                                 # Powers the "Locate me" feature. Default
                                                 # radius 500m, max 5000m. Returns up to 100.
GET  /api/parcels/:id                            → Full parcel + owner + encumbrances (joined)
GET  /api/parcels/:id/timeline                   → Ownership history (chronological)
GET  /api/parcels/:id/export?format=geojson|kml|pdf

# Search (unified)
GET  /api/search?q=:query&type=:type&state=:lgd → Fuzzy search
     # type: village | khasra | owner | ulpin | district

# Vector tiles (for map layers)
GET  /api/tiles/parcels/:z/:x/:y.pbf            → MVT tiles for parcels
GET  /api/tiles/admin/:z/:x/:y.pbf              → MVT tiles for admin boundaries

# User
POST /api/auth/otp                               → Send OTP via Supabase Auth
POST /api/saved-parcels                          → Bookmark a parcel
GET  /api/saved-parcels                          → My bookmarks
```

---

## 8. Folder Structure

```
landlens/
├── docs/                               # Plain-language documentation
│   ├── README.md                       # Entry point
│   ├── 01-architecture.md
│   ├── 02-database-schema.md
│   ├── 03-data-sources.md
│   ├── 04-boundary-segmentation.md
│   ├── 05-cadastral-anchoring.md
│   ├── 06-internationalization.md
│   ├── 07-deployment.md
│   ├── 08-ai-service.md                # Points to separate repo
│   ├── 09-contributing.md
│   └── 10-glossary.md
├── app/
│   ├── [locale]/
│   │   ├── page.tsx                    # Main map page
│   │   ├── parcel/[id]/page.tsx        # Direct parcel link (shareable)
│   │   ├── saved/page.tsx              # User's saved parcels
│   │   └── layout.tsx                  # Locale-aware layout
│   ├── api/
│   │   ├── boundaries/
│   │   ├── parcels/
│   │   ├── search/
│   │   └── tiles/                      # Vector tile endpoints
│   └── layout.tsx
├── components/
│   ├── map/
│   │   ├── LandLensMap.tsx             # MapLibre GL wrapper
│   │   ├── ParcelLayer.tsx             # Vector tile parcel layer
│   │   ├── BoundaryLayer.tsx           # Admin boundaries layer
│   │   ├── BasemapSwitcher.tsx         # streets/satellite/terrain
│   │   ├── LayerPanel.tsx              # left-side collapsible panel
│   │   ├── ScaleBar.tsx
│   │   ├── CoordinateReadout.tsx       # lat/lng + UTM
│   │   ├── NorthArrow.tsx
│   │   ├── ZoomControls.tsx
│   │   └── AttributionFooter.tsx
│   ├── search/
│   │   ├── CommandPalette.tsx          # Ctrl+K search modal
│   │   ├── SearchResults.tsx
│   │   └── SearchFilters.tsx
│   ├── parcel/
│   │   ├── ParcelSidebar.tsx           # desktop slide-in panel
│   │   ├── ParcelBottomSheet.tsx       # mobile bottom sheet
│   │   ├── OwnershipTimeline.tsx       # visual chronological timeline
│   │   ├── EncumbranceList.tsx
│   │   ├── ParcelStats.tsx             # area, type, classification
│   │   └── ExportMenu.tsx              # GeoJSON/KML/PDF download
│   ├── nav/
│   │   ├── Header.tsx
│   │   ├── Breadcrumb.tsx
│   │   └── LanguageSwitcher.tsx
│   └── ui/                             # shadcn primitives
├── lib/
│   ├── db.ts                           # Prisma client (singleton)
│   ├── supabase.ts                     # Supabase client
│   ├── redis.ts                        # Upstash Redis client
│   ├── geo/
│   │   ├── projections.ts              # WGS84 ↔ UTM ↔ Web Mercator
│   │   ├── postgis-queries.ts          # ST_Contains, ST_Intersects helpers
│   │   ├── tile-server.ts              # MVT generation
│   │   └── geojson-utils.ts            # turf.js helpers
│   ├── scrapers/                       # State Bhulekh adapters
│   │   ├── base.ts                     # abstract scraper interface
│   │   ├── maharashtra.ts              # MahaBhumi adapter
│   │   ├── up.ts                       # UP Bhulekh adapter
│   │   ├── karnataka.ts                # Bhoomi adapter
│   │   ├── rajasthan.ts                # Apna Khata adapter
│   │   └── tamilnadu.ts                # Patta Chitta adapter
│   ├── i18n/
│   │   ├── config.ts                   # locale list
│   │   └── transliterate.ts            # Devanagari ↔ Latin
│   └── rate-limit.ts
├── messages/                           # i18n message catalogs
│   ├── en.json
│   ├── hi.json
│   └── ...
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── scripts/
│   ├── ingest-admin-boundaries.ts      # Seed states/districts from datameet
│   ├── ingest-village-boundaries.ts    # From Bhuvan/OSM
│   ├── generate-mock-parcels.ts        # turf.js subdivision for dev
│   ├── seed-mock-owners.ts             # Indian-name faker
│   └── tile-precompute.ts              # Pre-bake MVT tiles for zooms 5-12
├── public/
│   ├── tiles/                          # Pre-computed vector tiles
│   ├── fonts/                          # Inter + Noto Sans Devanagari
│   └── icons/
├── types/
│   ├── parcel.ts
│   ├── boundary.ts
│   └── geo.ts
├── middleware.ts                       # i18n + rate-limit middleware
├── next.config.js
└── README.md
```

---

## 9. Parcel Boundary Acquisition Strategy (The Core Geospatial Challenge)

> **Critical insight:** No single source provides complete cadastral polygons for India. LandLens uses a **4-tier hybrid pipeline** combining government scraping, OpenStreetMap, and AI-based segmentation powered by **Google's AlphaEarth Foundations** geospatial embeddings.

### Coverage Reality Check

| Source | India Coverage | Format | Access |
|---|---|---|---|
| Bhu-Naksha state portals | ~60% (varies by state) | Web only | Scraping required |
| Bhuvan (ISRO) | Pan-India | WMS (raster) | Public; vector WFS restricted |
| Survey of India | Complete | Shapefile | Paid + licensing |
| OpenStreetMap | Patchy, urban-biased | Vector | Free |
| **AI segmentation (ours)** | **Anywhere** | **Generated vectors** | **Compute-bound** |

### The 5-Tier Boundary Resolution Pipeline (Registry-Anchored)

> **Critical:** Registry data is used to **constrain** AI output, not just as fallback. Two adjacent rice paddies owned by different people look identical to AI but the registry knows they're separate plots. We feed registry metadata (expected count, areas, adjacency) into the AI service as hints. See `/docs/05-cadastral-anchoring.md`.

```
User clicks (lat, lng) on map
        │
        ▼
┌────────────────────────────────────────────────────┐
│ TIER 1: Registry polygon exists (Bhu-Naksha)       │ ← use directly
│ Confidence: 0.95-1.0                                │
└────────────────────────────────────────────────────┘
        │ miss
        ▼
┌────────────────────────────────────────────────────┐
│ TIER 2: FMB corner coordinates available            │
│ Reconstruct exact polygon from surveyor traverse    │
│ Confidence: 0.90-0.97                               │
└────────────────────────────────────────────────────┘
        │ miss
        ▼
┌────────────────────────────────────────────────────┐
│ TIER 3: Registry-constrained AI (AlphaEarth+SAM2)   │
│ - Call landlens-segmentation HTTP service           │
│ - Pass registry hints: expected_count, areas,       │
│   adjacency, village_lgd_code                       │
│ - AI segments + enforces cadastral constraints      │
│ - Splits merged polygons using area-balanced kmeans │
│ Confidence: 0.75-0.90                               │
└────────────────────────────────────────────────────┘
        │ miss
        ▼
┌────────────────────────────────────────────────────┐
│ TIER 4: OSM landuse / building footprints           │
│ Confidence: 0.60-0.80                               │
└────────────────────────────────────────────────────┘
        │ miss
        ▼
┌────────────────────────────────────────────────────┐
│ TIER 5: Pure AI segmentation (no registry hints)    │
│ Flagged needs_verification = true                   │
│ Confidence: 0.40-0.70                               │
└────────────────────────────────────────────────────┘
```

### Bonus Feature: Discrepancy Detection

When BOTH registry data AND AI output exist, we compare them. Mismatches flag possible encroachment, unregistered subdivisions, or outdated records. This becomes a value-add feature for buyers, banks, and lawyers — "Verify your land matches its registry record." No competitor offers this.

### What the Website Sends to the AI Service

```typescript
// lib/segmentation/client.ts
async function detectParcel(lat: number, lng: number): Promise<Parcel | null> {
  // 1. Check cache
  const cached = await db.parcels.findByPoint(lat, lng);
  if (cached) return cached;
  
  // 2. Gather registry hints from PostGIS
  const hints = await db.getRegistryHintsForArea(lat, lng);
  // hints = { expected_plot_count, expected_areas_sqm[], village_lgd_code, ... }
  
  // 3. Call separate AI service
  if (!process.env.SEGMENTATION_SERVICE_URL) {
    return null; // graceful degradation
  }
  
  const response = await fetch(`${process.env.SEGMENTATION_SERVICE_URL}/segment`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.SEGMENTATION_API_KEY}` },
    body: JSON.stringify({ lat, lng, registry_hints: hints }),
  });
  
  if (!response.ok) return null;
  
  const result = await response.json();
  
  // 4. Persist for next user
  return await db.parcels.create({
    geom: result.polygons[0].geometry,
    confidence_score: result.polygons[0].confidence,
    boundary_source: result.polygons[0].source,
    ai_model_version: result.polygons[0].model_version,
    needs_verification: result.polygons[0].confidence < 0.8,
  });
}
```

**Note:** The website builds and ships **without** the AI service. The env var `SEGMENTATION_SERVICE_URL` stays empty during phase 1. Users see official polygons where they exist and "Boundary not available" elsewhere — still useful. AI service connects in phase 2.

### What's Inside `landlens-segmentation/` (separate repo)

```
landlens-segmentation/         ← DO NOT BUILD IN THIS PROMPT
├── src/
│   ├── earth_engine.py        # AlphaEarth + Sentinel-2 fetch via GEE
│   ├── sam2_inference.py      # SAM2 with embedding-augmented prompts
│   ├── registry_anchor.py     # Area-constrained splitting, FMB traverse
│   ├── vectorize.py           # raster → shapely polygons
│   ├── snap_to_osm.py         # edge alignment to OSM roads
│   └── eval/                  # Fields of The World benchmarks
├── api.py                     # FastAPI HTTP server
├── batch/                     # Nightly pre-compute jobs
├── notebooks/                 # Thesis experiments
└── Dockerfile                 # GPU-enabled
```

Deployed to **Modal** or **Replicate** for per-second GPU billing.

### Open-Source References

- **AlphaEarth Foundations** — `developers.google.com/earth-engine/datasets/catalog/GOOGLE_SATELLITE_EMBEDDING_V1_ANNUAL`
- **SAM2** — `github.com/facebookresearch/segment-anything-2`
- **Fields of The World** (India benchmark) — `github.com/fieldsoftheworld/ftw-baselines`
- **FieldSeg** — SAM + Sentinel-2 pipeline tested on South India
- **sentinel-hub/field-delineation** — ResUNet-a reference implementation

---

## 10. Seed Data Strategy (No Government API Access Needed for MVP)

**Phase 0 (now): Mock data that mirrors real schema**

1. **Admin boundaries from open sources:**
   - States/Districts: `https://github.com/datameet/maps` (open-source India GeoJSON)
   - Villages: OSM Overpass API query for `admin_level=9` polygons
   - LGD codes: Local Government Directory CSV (lgdirectory.gov.in)

2. **Generate fake parcel polygons (for UI development only):**
   - Take village polygons → use `turf.js` `voronoi` + `intersect` to subdivide into ~50-200 fake plots per village
   - Tag every mock parcel with `boundary_source = 'mock'` so it's never confused with real data
   - Each gets a fake Khasra number, area, land type (weighted random: 60% agricultural, 20% residential, etc.)

3. **Generate fake ownership records:**
   - Use `@faker-js/faker` with Indian locale
   - 1-3 historical owners per parcel
   - Realistic mutation dates spanning 1970-2024

4. **Phase 1 (post-launch): Real data adapters**
   - Build scrapers/adapters for top 5 states (MH, UP, RJ, KA, TN)
   - Respect robots.txt, add 2-second delays, cache aggressively
   - Store source attribution in `parcels.source_portal`

5. **Phase 2: AlphaEarth-powered segmentation rollout**
   - Run nightly batch SAM2 jobs for unmapped districts
   - Pre-populate `parcels` table with AI-detected polygons
   - Mark all with `boundary_source = 'ai_alphaearth_sam2'`, `needs_verification = true`

6. **Phase 3: Official partnerships**
   - Apply for Bhuvan API access (ISRO)
   - Apply for DILRMP data sharing
   - Once ULPIN rollout completes nationally, query by ULPIN

---

## 11. AI-First Architecture (LandLens Is Built for AI to Operate)

> LandLens treats AI agents as first-class users alongside humans. Every API is readable by AI, every admin operation is callable by AI, and a built-in chat assistant lets admins drive the platform through natural language. See `/docs/11-ai-first-architecture.md`.

### Three Pillars

**1. MCP Server (separate package: `landlens-mcp`)**
A Model Context Protocol server that exposes admin operations as tools. Any MCP-compatible AI (Claude Code, Claude Desktop, Cursor) connects via:
```
mcp.land.trenlens.com
```

Tools exposed by the MCP server:
```typescript
// Data queries
search_parcels({ query, filters })
get_parcel({ id })
get_parcel_at_location({ lat, lng })
list_parcels_in_bbox({ bbox, limit })
get_ownership_history({ parcel_id })

// Admin operations
list_pending_corrections({ limit, district })
approve_correction({ id, notes })
reject_correction({ id, reason })
list_unverified_parcels({ max_confidence, district })
bulk_mark_verified({ parcel_ids, notes })

// Data pipeline
trigger_segmentation_job({ area, priority })
get_segmentation_status({ job_id })
ingest_state_data({ state_code, dry_run })
run_data_quality_check({ scope })

// Export & reporting
export_parcels({ filter, format })
generate_district_report({ district_lgd_code })
get_admin_stats({})
```

**2. In-App Admin Assistant (`/admin/assistant` page)**
A chat interface inside the LandLens web app. Admin pastes their own LLM API key (Anthropic / OpenAI / Google) — BYOK pattern. Uses Vercel AI SDK to abstract providers. Same tools as the MCP server.

Setup:
```bash
npm install ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google
```

Storage: encrypt user API keys with Supabase Vault (`pgsodium`). Never log decrypted keys. Decrypt in-memory only during the admin's session.

**3. AI-Friendly Web App Patterns (Required Everywhere)**

| Pattern | Implementation |
|---|---|
| `llms.txt` at root | Markdown file at `public/llms.txt` describing site + endpoints for AI agents |
| Auto-generated OpenAPI | Use `zod-to-openapi` to expose `/api/openapi.json` |
| Predictable REST URLs | `/api/parcels/:id/owners`, never `/api/getOwners?id=` |
| Structured error responses | `{ error: { code, message, suggested_action, docs_url } }` |
| Idempotent mutations | Accept `Idempotency-Key` header on all POST/PUT |
| Strict types | Zod schemas for every API; types derived from schemas |

**Sample `public/llms.txt`:**
```markdown
# LandLens
> Pan-India cadastral land records platform.

## Core concepts
- Parcels: land plots with polygons and ownership
- Khasra: traditional plot number
- ULPIN: 14-digit national unique ID (Bhu-Aadhaar)

## Machine-readable endpoints
- /api/openapi.json — full API spec
- /api/parcels/{id} — single parcel
- /api/parcels/at?lat=X&lng=Y — point lookup

## For AI agents
- MCP server: mcp.land.trenlens.com
- Auth: Bearer token (admin only)
- Rate limit: 60 req/min for public; 600 req/min for authenticated

## Documentation
- Human: /docs
- Machine: /api/openapi.json
```

### Folder Structure Additions

```
landlens/
├── packages/
│   └── landlens-mcp/                # MCP server (separate npm package)
│       ├── package.json
│       ├── src/
│       │   ├── server.ts            # MCP server entry
│       │   ├── tools/
│       │   │   ├── parcels.ts
│       │   │   ├── corrections.ts
│       │   │   ├── pipeline.ts
│       │   │   └── exports.ts
│       │   └── auth.ts              # admin token validation
│       └── README.md                # how to install in Claude Desktop
├── app/
│   ├── admin/
│   │   ├── assistant/page.tsx       # in-app AI chat
│   │   └── api-keys/page.tsx        # BYOK management
│   └── api/
│       ├── openapi.json/route.ts    # auto-generated spec
│       └── chat/route.ts            # streaming SSE for assistant
├── lib/
│   ├── ai/
│   │   ├── tools.ts                 # shared tool definitions
│   │   ├── providers.ts             # Vercel AI SDK setup
│   │   └── vault.ts                 # BYOK encryption
│   └── api/
│       ├── errors.ts                # structured error class
│       ├── idempotency.ts           # middleware
│       └── openapi.ts               # zod → openapi conversion
└── public/
    └── llms.txt                     # at site root
```

### Additional Dependencies

```bash
# AI / MCP
npm install @modelcontextprotocol/sdk
npm install ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google
npm install zod @asteasolutions/zod-to-openapi
```

### Schema Additions for BYOK

```sql
CREATE TABLE admin_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,            -- references auth.users(id)
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google', 'mistral')),
  encrypted_key BYTEA NOT NULL,     -- encrypted via pgsodium
  key_label TEXT,                   -- "My personal Claude key"
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE TABLE admin_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_assistant_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES admin_assistant_conversations(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant', 'tool')),
  content JSONB NOT NULL,           -- text or tool call/result
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX assistant_msgs_conv_idx ON admin_assistant_messages(conversation_id, created_at);
```

---

## 12. Licensing & Commercial Strategy

> Two distinct licenses to manage: LandLens's own code (our choice) and Google Earth Engine usage (Google's terms). They transition together when we monetize. See `/docs/14-licensing.md`.

### Phase 1 (Now — Academic / Thesis)

**LandLens code license:** `PolyForm Noncommercial 1.0.0`
- Add `LICENSE` file with the full text from polyformproject.org
- Add file header comments: `// LandLens — PolyForm Noncommercial 1.0.0`
- Add `NOTICE.md` listing all third-party licenses

**Google Earth Engine:** Register as non-commercial. Monitor compute (EECU) quotas — they're enforced from April 27, 2026 onward.

**Allowed under this phase:**
- Anyone clones, modifies, runs LandLens
- Academic / research / thesis use
- Internal evaluation by companies

**Not allowed:**
- Selling LandLens-derived services to customers
- Hosting LandLens as a paid SaaS

### Phase 2 (Future — Commercial)

**LandLens code license:** Dual-license
- PolyForm NC continues for academic/individual users
- Commercial license (one-time legal template) for paying customers
- Same source code, two contracts

**Google Earth Engine:** Switch to **Earth Engine Commercial** via Google Cloud billing account. This is mandatory once LandLens generates revenue — independent of our own license.

### Required Attributions (Always)

These are non-negotiable, required by third-party licenses:

```typescript
// In /credits page + API responses
const attributions = {
  alphaearth: "The AlphaEarth Foundations Satellite Embedding dataset was created by Google and Google DeepMind",
  sam2: "Segment Anything 2 by Meta AI (Apache 2.0)",
  sentinel: "Contains modified Copernicus Sentinel data",
  osm: "© OpenStreetMap contributors (ODbL)",
  bhuvan: "Contains data from Bhuvan / NRSC / ISRO",
  // State portals attribution where scraped from
};
```

Display this on `/credits` page and embed in API responses under `meta.attributions`.

### Enterprise Tier Design (Phase 2 — Build Hooks Now)

Even in Phase 1, build the infrastructure that enables tier-based access later:

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_email TEXT,
  organization TEXT,
  tier TEXT CHECK (tier IN ('community', 'developer', 'business', 'enterprise')),
  rate_limit_per_min INT DEFAULT 60,
  monthly_quota INT,
  used_this_month INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id UUID REFERENCES api_keys(id),
  endpoint TEXT,
  status_code INT,
  response_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX usage_key_time_idx ON api_usage(api_key_id, created_at);
```

This lets you switch on commercial tiers without schema changes. During Phase 1, everyone is 'community' tier.

### Features to Gate Behind Commercial License (Build flags Now)

Wire these as feature flags from day one (just `false` during Phase 1):

```typescript
// lib/features.ts
export const COMMERCIAL_FEATURES = {
  bulk_export_unlimited: false,        // gate to 100 parcels in Phase 1
  postgis_direct_access: false,
  historical_ownership_5plus_years: false,
  encroachment_detection: false,
  custom_segmentation_jobs: false,
  white_label_embed: false,
  webhook_notifications: false,
  audit_log_access: false,
  dedicated_sla: false,
};
```

---

## 13. Privacy, Legal & Compliance

**Critical — don't skip:**
- **Mask owner full names by default** — show "Rajesh K." not full name
- Full name reveal requires user authentication + agreement to terms
- **No bulk export** — rate-limit prevents scraping
- **Audit log** every parcel detail view (already in schema)
- **Disclaimer banner:** "Data sourced from public government records. For legal/official use, consult the respective State Revenue Department or Sub-Registrar Office."
- **No direct transaction features** — avoid RERA + Sub-Registrar Office complexity
- **Robots.txt:** allow indexing of static pages, disallow `/api/`
- **PII storage:** owner names stored encrypted at rest via Supabase column encryption (`pgsodium`)
- **User GPS coordinates are queried in-memory for "Locate me" features and never persisted to the database.** The browser provides location only with explicit user consent via the standard Geolocation Permission API. If the user saves a parcel they discovered via GPS, only the `parcel_id` lands in `saved_parcels` — never the coordinate, never a trail.

---

## 14. Definition of Done for MVP (Phase 1)

- [ ] India map loads with all 28 state + 8 UT boundaries (vector tiles)
- [ ] Click state → smooth zoom + load districts
- [ ] Click district → load tehsils → load villages → load parcels
- [ ] Click any parcel → sidebar (desktop) / bottom sheet (mobile) shows full details
- [ ] Ownership history rendered as visual timeline
- [ ] Encumbrance list with status badges
- [ ] Command palette search (Ctrl+K) — fuzzy match villages, khasra nos, owners, ULPIN
- [ ] Direct shareable URLs: `/en/parcel/:id` works with og:image preview
- [ ] Language switcher: English ↔ Hindi ↔ Urdu (all three production-ready, Urdu with RTL)
- [ ] Mobile responsive at 320px width
- [ ] Map controls: scale bar, coordinate readout, zoom buttons, layer toggle, basemap switcher
- [ ] Export menu: download parcel as GeoJSON, KML, PDF report
- [ ] OTP login (Supabase Auth)
- [ ] Save/bookmark parcel feature
- [ ] Deployed to `land.trenlens.com` with auto-SSL
- [ ] Lighthouse score: Performance > 85, Accessibility > 95
- [ ] All API routes rate-limited via Upstash
- [ ] Audit log records all parcel views
- [ ] "Locate me" button works on mobile and desktop with graceful permission-denied fallback

---

## 15. Phase 2 Roadmap

- Add 9 more regional languages (Marathi, Tamil, Telugu, Kannada, Bengali, Gujarati, Punjabi, Odia, Malayalam)
- Real data adapters for top 5 states (MH, UP, RJ, KA, TN)
- **AlphaEarth + SAM2 segmentation service** for AI-generated parcel boundaries (separate Python service on Modal/Replicate)
- **Community correction workflow** — users edit AI polygons, admin review queue
- **Train custom U-Net on AlphaEarth embeddings** using Fields of The World India subset (potential thesis publication)
- Satellite layer toggle (Esri World Imagery / Bhuvan tiles / Sentinel-2 cloudless mosaic)
- Dispute heatmap overlay (visualize litigation density)
- "Notify me of mutation" — email/SMS alerts via Supabase Webhooks
- Document OCR — upload RoR PDF, auto-extract fields
- Compare two parcels side-by-side (adjacency analysis)
- Time-slider — see parcel changes year over year using AlphaEarth annual embeddings (2017–2025)
- Admin panel for data corrections
- Public API (with API keys + tier limits) for developers

---

## 16. First Commands to Run

```bash
# Scaffold
npx create-next-app@latest landlens --typescript --tailwind --app --src-dir=false
cd landlens

# Core deps
npm install maplibre-gl react-map-gl @turf/turf
npm install @prisma/client prisma
npm install @supabase/supabase-js @supabase/ssr
npm install @upstash/redis @upstash/ratelimit
npm install next-intl
npm install lucide-react class-variance-authority clsx tailwind-merge
npm install @faker-js/faker  # dev seeding

# shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button input dialog sheet command badge tabs

# Prisma
npx prisma init
# → Add DATABASE_URL from Supabase project to .env

# DB setup
# In Supabase SQL editor, enable extensions:
#   CREATE EXTENSION postgis;
#   CREATE EXTENSION pg_trgm;
# Then:
npx prisma migrate dev --name init

# Seed
npx tsx scripts/ingest-admin-boundaries.ts
npx tsx scripts/generate-mock-parcels.ts
npx tsx scripts/seed-mock-owners.ts

# Run
npm run dev
```

---

## 17. Environment Variables (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...

# MapTiler (optional — for premium basemaps)
NEXT_PUBLIC_MAPTILER_KEY=...

# Site
NEXT_PUBLIC_SITE_URL=https://land.trenlens.com

# Earth Engine + AI Segmentation Service (Phase 2+)
GEE_SERVICE_ACCOUNT_KEY=...                # Google Earth Engine service account JSON
GEE_PROJECT_ID=your-gcp-project-id
SEGMENTATION_SERVICE_URL=https://landlens-seg.modal.run
SEGMENTATION_API_KEY=...

# AI-First Architecture
MCP_SERVER_ADMIN_TOKEN=long-random-string-for-mcp-auth
VAULT_ENCRYPTION_KEY=...                   # for BYOK key encryption (pgsodium)

# Feature flags (Phase 2 commercial features — default false in Phase 1)
ENABLE_BULK_EXPORT_UNLIMITED=false
ENABLE_POSTGIS_DIRECT_ACCESS=false
ENABLE_ENCROACHMENT_DETECTION=false
ENABLE_WHITE_LABEL=false
```

---

## 18. Build Order (Suggested Sprints)

**Sprint 0 (Docs first):** Set up `/docs` folder with all markdown files BEFORE writing code. Plain-language explanations. Add `LICENSE` (PolyForm Noncommercial 1.0.0) and `NOTICE.md` (third-party attributions).

**Sprint 1 (Foundation + AI-friendliness baseline):** Repo, Next.js, Tailwind, Supabase, Prisma schema, deploy empty site to `land.trenlens.com`. From day one: Zod schemas for every route, structured error responses, `public/llms.txt`, auto-generated OpenAPI at `/api/openapi.json`. **AI-readability is a Sprint 1 concern, not a "later" concern.**

**Sprint 2 (Map):** MapLibre integration, India state boundaries, hierarchical zoom, breadcrumb

**Sprint 3 (Parcels with mock data):** turf.js subdivision for dev parcels, click-to-detail, sidebar/bottom-sheet — proves the UX before real data work

**Sprint 4 (Search):** Command palette, fuzzy search, direct parcel URLs

**Sprint 5 (i18n):** next-intl setup, English + Hindi + Urdu catalogs, language switcher, RTL support

**Sprint 6 (Auth & Polish):** Supabase Auth, saved parcels, export menu (gated at 100 parcels via feature flag), Lighthouse pass

**Sprint 7 (Real Data — Scrapers):** Build adapters for top 5 state portals, ingest into PostGIS, replace mock parcels in covered areas

**Sprint 8 (OSM Integration):** Pull OSM landuse + building polygons via Overpass, fill urban gaps

**Sprint 9 (Connect to AI Service):** The Python `landlens-segmentation` service has been built **separately** in parallel by this point. Set `SEGMENTATION_SERVICE_URL` env var. Wire `/api/parcels/at` to call it with registry hints. Test on one district. Site degrades gracefully when service is down.

**Sprint 10 (Batch Pre-compute):** Nightly cron job runs SAM2 on unmapped districts, populates PostGIS

**Sprint 11 (Community Corrections):** Allow logged-in users to edit AI-detected polygons, admin review queue

**Sprint 12 (MCP Server):** Build `packages/landlens-mcp` — Model Context Protocol server exposing admin tools. Publish to npm. Document Claude Desktop integration.

**Sprint 13 (In-App Admin Assistant):** Build `/admin/assistant` chat with Vercel AI SDK. BYOK key management at `/admin/api-keys`. Encrypt keys via Supabase Vault. Same tools as MCP server.

**Sprint 14 (Enterprise Hooks):** Build `api_keys` and `api_usage` tables. Rate limit middleware reads tier from key. All commercial features behind feature flags (off in Phase 1). Sets up the rails for commercial launch.

**Sprint 15 (Scale Hardening):** Vector tiles, Redis caching, rate limiting tuning, audit log, observability

---

*Prompt v5.0 — Built for Claude Code. Two-repo architecture (web + AI). Registry-anchored segmentation. AI-first design (MCP + BYOK assistant). Dual-license ready. Comprehensive docs.*
*Paste this into a fresh Claude Code session and say "let's build LandLens, start with Sprint 0 — set up the docs folder and LICENSE first."*
