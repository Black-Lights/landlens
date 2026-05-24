/**
 * download-district-boundaries — populate public/data/boundaries/districts/<State>.geojson.
 *
 * Usage:
 *   npx tsx scripts/download-district-boundaries.ts                # default: Maharashtra
 *   npx tsx scripts/download-district-boundaries.ts Karnataka
 *   npx tsx scripts/download-district-boundaries.ts "Tamil Nadu"
 *
 * Source:
 *   datameet/maps ships shapefiles only (no GeoJSON), so for Sprint 3 we
 *   pull pre-converted per-state district GeoJSON from datta07/INDIAN-SHAPEFILES.
 *   The downloader simplifies geometries with turf.simplify (tolerance 0.003,
 *   high quality) to keep payloads ≈ 500 KB instead of multi-MB. Property
 *   shapes are normalised to:
 *     { district_name, state_name, district_lgd, state_lgd, dtcode11 }
 *
 *   When the Sprint 7 scraper lands and we ingest real boundaries into
 *   PostGIS, this script will be retired in favour of `/api/districts`
 *   reading directly from the DB.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { simplify } from '@turf/turf';
import type { Feature, FeatureCollection } from 'geojson';

// Per-state source URL map. Keys are the display names used in
// public/data/boundaries/india-states.geojson (ST_NM).
const SOURCES: Record<string, string> = {
  Maharashtra:
    'https://raw.githubusercontent.com/datta07/INDIAN-SHAPEFILES/master/STATES/MAHARASHTRA/MAHARASHTRA_DISTRICTS.geojson',
  Karnataka:
    'https://raw.githubusercontent.com/datta07/INDIAN-SHAPEFILES/master/STATES/KARNATAKA/KARNATAKA_DISTRICTS.geojson',
  'Tamil Nadu':
    'https://raw.githubusercontent.com/datta07/INDIAN-SHAPEFILES/master/STATES/TAMIL%20NADU/TAMIL%20NADU_DISTRICTS.geojson',
  Gujarat:
    'https://raw.githubusercontent.com/datta07/INDIAN-SHAPEFILES/master/STATES/GUJARAT/GUJARAT_DISTRICTS.geojson',
  Kerala:
    'https://raw.githubusercontent.com/datta07/INDIAN-SHAPEFILES/master/STATES/KERALA/KERALA_DISTRICTS.geojson',
};

interface RawProps {
  dtname?: string;
  stname?: string;
  Dist_LGD?: number;
  State_LGD?: number;
  dtcode11?: string;
}

async function main() {
  const stateArg = process.argv.slice(2).join(' ').trim() || 'Maharashtra';
  const url = SOURCES[stateArg];
  if (!url) {
    console.error(`No source URL registered for "${stateArg}".`);
    console.error('Known states:', Object.keys(SOURCES).join(', '));
    process.exit(1);
  }

  console.log(`→ Fetching ${stateArg} districts from datta07/INDIAN-SHAPEFILES`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`HTTP ${res.status} for ${url}`);
    process.exit(1);
  }
  const raw = (await res.json()) as FeatureCollection<never, RawProps>;
  console.log(`  ${raw.features.length} districts, raw payload ${(JSON.stringify(raw).length / 1024).toFixed(0)} kB`);

  const out: FeatureCollection = {
    type: 'FeatureCollection',
    features: raw.features.map((f) => {
      const simplified = simplify(f as Feature, { tolerance: 0.003, highQuality: true });
      return {
        type: 'Feature',
        geometry: simplified.geometry,
        properties: {
          district_name: f.properties?.dtname ?? 'Unknown',
          state_name: f.properties?.stname ?? stateArg.toUpperCase(),
          district_lgd: f.properties?.Dist_LGD ?? null,
          state_lgd: f.properties?.State_LGD ?? null,
          dtcode11: f.properties?.dtcode11 ?? null,
        },
      };
    }),
  };

  const outDir = path.join(process.cwd(), 'public', 'data', 'boundaries', 'districts');
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${stateArg}.geojson`);
  const minified = JSON.stringify(out);
  await fs.writeFile(outFile, minified, 'utf8');
  console.log(`✓ Wrote ${outFile} (${(minified.length / 1024).toFixed(0)} kB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
