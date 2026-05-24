# NOTICE

LandLens is distributed under the [PolyForm Noncommercial License 1.0.0](./LICENSE).

This product includes software, data, and conventions from other projects.
The notices below satisfy the attribution requirements of those projects.
They must be preserved in any copy or derivative of LandLens.

> Required Notice: Copyright LandLens contributors (https://land.trenlens.com)

---

## Code & Libraries

### Next.js
- Copyright (c) Vercel, Inc.
- License: MIT
- https://github.com/vercel/next.js

### React
- Copyright (c) Meta Platforms, Inc. and affiliates.
- License: MIT
- https://github.com/facebook/react

### MapLibre GL JS
- Copyright (c) MapLibre contributors
- Originally Copyright (c) 2014–2020 Mapbox
- License: BSD-3-Clause
- https://github.com/maplibre/maplibre-gl-js

### react-map-gl
- Copyright (c) Urban Computing Foundation
- License: MIT
- https://github.com/visgl/react-map-gl

### Turf.js
- Copyright (c) Turf.js contributors
- License: MIT
- https://github.com/Turfjs/turf

### Prisma
- Copyright (c) Prisma Data, Inc.
- License: Apache-2.0
- https://github.com/prisma/prisma

### Supabase JS SDK
- Copyright (c) Supabase
- License: MIT
- https://github.com/supabase/supabase-js

### Upstash Redis / Ratelimit SDKs
- Copyright (c) Upstash, Inc.
- License: MIT
- https://github.com/upstash/redis-js

### next-intl
- Copyright (c) Jan Amann
- License: MIT
- https://github.com/amannn/next-intl

### Tailwind CSS
- Copyright (c) Tailwind Labs, Inc.
- License: MIT
- https://github.com/tailwindlabs/tailwindcss

### shadcn/ui
- Copyright (c) shadcn
- License: MIT
- https://github.com/shadcn-ui/ui

### Lucide
- Copyright (c) Lucide contributors
- License: ISC
- https://github.com/lucide-icons/lucide

### Vercel AI SDK
- Copyright (c) Vercel, Inc.
- License: Apache-2.0
- https://github.com/vercel/ai

### Model Context Protocol SDK
- Copyright (c) Anthropic, PBC
- License: MIT
- https://github.com/modelcontextprotocol/typescript-sdk

### Zod
- Copyright (c) Colin McDonnell
- License: MIT
- https://github.com/colinhacks/zod

### @asteasolutions/zod-to-openapi
- Copyright (c) Astea Solutions
- License: MIT
- https://github.com/asteasolutions/zod-to-openapi

### Faker (@faker-js/faker)
- Copyright (c) Faker contributors
- License: MIT
- https://github.com/faker-js/faker

---

## Basemap Tile Providers

### MapTiler Cloud
- © MapTiler
- Tiles served from `api.maptiler.com`. Underlying data © OpenStreetMap contributors (ODbL).
- Required attribution on every map displaying these tiles:
  `© MapTiler © OpenStreetMap contributors`
- https://www.maptiler.com/copyright/

### Esri World Imagery
- Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community.
- Served from `server.arcgisonline.com` under Esri's Public Use Constraints.
- Required attribution on every map displaying these tiles:
  `Source: Esri, Maxar, Earthstar Geographics`
- https://www.esri.com/en-us/legal/terms/full-master-agreement

### OpenTopoMap
- © OpenTopoMap contributors
- Tiles derived from OpenStreetMap and SRTM elevation data.
- License: CC-BY-SA 3.0
- Required attribution on every map displaying these tiles:
  `© OpenTopoMap (CC-BY-SA)`
- https://opentopomap.org/about

## Geospatial Data Sources

### OpenStreetMap
- © OpenStreetMap contributors
- License: Open Database License (ODbL) 1.0
- https://www.openstreetmap.org/copyright
- LandLens displays OSM data and derived tiles. Any user-facing surface that
  displays OSM-derived geometry must show the credit `© OpenStreetMap contributors`.

### Bhuvan / NRSC / ISRO
- Contains data from Bhuvan, the geoportal of the National Remote Sensing
  Centre (NRSC), Indian Space Research Organisation (ISRO).
- https://bhuvan.nrsc.gov.in
- Used under Bhuvan's public data terms.

### Copernicus Sentinel
- Contains modified Copernicus Sentinel data (Sentinel-2, processed by
  LandLens for boundary segmentation).
- https://www.copernicus.eu

### State Government Bhulekh / Bhu-Naksha Portals
- Cadastral records sourced from publicly accessible state portals including
  MahaBhumi (Maharashtra), Bhulekh (UP), Bhoomi (Karnataka), Apna Khata
  (Rajasthan), Patta Chitta (Tamil Nadu), Jamabandi (Punjab/Haryana),
  AnyROR (Gujarat), MeeBhoomi (AP/Telangana), and others.
- Each parcel's originating portal is recorded in `parcels.source_portal`
  and surfaced to end users as a source attribution.

### Local Government Directory (LGD)
- Administrative codes sourced from the Local Government Directory,
  Ministry of Panchayati Raj, Government of India.
- https://lgdirectory.gov.in

### datameet / India maps
- State and district boundaries sourced from the datameet community.
- https://github.com/datameet/maps
- License: CC-BY-4.0 (per repository).

---

## AI Models & Embeddings

### AlphaEarth Foundations (Google Satellite Embedding V1)
- The AlphaEarth Foundations Satellite Embedding dataset was created by
  Google and Google DeepMind.
- Accessed via Google Earth Engine.
- https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_SATELLITE_EMBEDDING_V1_ANNUAL
- Use governed by Google Earth Engine Terms of Service. LandLens uses the
  non-commercial / research tier during Phase 1.

### Segment Anything 2 (SAM 2)
- Copyright (c) Meta Platforms, Inc. and affiliates.
- License: Apache-2.0
- https://github.com/facebookresearch/segment-anything-2

### Fields of The World (FTW) benchmarks
- Used for evaluation of the segmentation pipeline.
- https://github.com/fieldsoftheworld/ftw-baselines

---

## Fonts

### Inter
- Copyright (c) The Inter Project Authors
- License: SIL Open Font License 1.1
- https://github.com/rsms/inter

### Noto Sans Devanagari
- Copyright (c) Google LLC
- License: SIL Open Font License 1.1
- https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari

### Noto Nastaliq Urdu
- Copyright (c) Google LLC
- License: SIL Open Font License 1.1
- https://fonts.google.com/noto/specimen/Noto+Nastaliq+Urdu

---

## Reporting an Attribution Issue

If you believe LandLens is using your work without proper attribution, or
attributing it incorrectly, open an issue at the LandLens repository or
email the maintainers. We will correct attribution within 32 days, in line
with the PolyForm Noncommercial 1.0.0 notice cure period.
