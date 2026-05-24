// Generate plausible mock parcels for a village polygon.
//   1. Pick N random points inside the polygon (rejection sample on bbox).
//   2. Run turf.voronoi over those points (bounded by the village bbox).
//   3. Intersect each voronoi cell with the village polygon — the clipped
//      cells become the parcel polygons.
//   4. Tag each parcel with a fake Khasra No, area, land_type.
//
// Used by both the seed script (persists to DB) and any on-the-fly demo
// path (Sprint 3 ships seed-only; the function is exported either way).

import {
  area as turfArea,
  bbox,
  bboxPolygon,
  booleanPointInPolygon,
  intersect,
  voronoi,
  featureCollection,
  point,
  randomPoint,
  polygon as turfPolygon,
} from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

import { LAND_TYPES } from '@/lib/map/constants';

export interface MockParcel {
  khasraNo: string;
  areaSqm: number;
  landType: string;
  geom: Polygon;
}

interface GenerateOpts {
  /** Inclusive lower bound on the number of parcels to generate. */
  min?: number;
  /** Inclusive upper bound. */
  max?: number;
  /** Optional RNG (0..1) — pass a seeded one from the seed script for stable output. */
  rng?: () => number;
  /** Village khasra prefix (e.g. "PNE-RUR-01-"); defaults to "V". */
  khasraPrefix?: string;
}

const DEFAULT_RNG = () => Math.random();

export function generateMockParcels(
  village: Feature<Polygon | MultiPolygon>,
  opts: GenerateOpts = {},
): MockParcel[] {
  const { min = 20, max = 60, rng = DEFAULT_RNG, khasraPrefix = 'V' } = opts;

  const count = Math.floor(rng() * (max - min + 1)) + min;
  const seeds = sampleInside(village, count, rng);
  if (seeds.length < 3) return []; // voronoi needs ≥3 points

  const seedFc = featureCollection(seeds.map((c) => point(c)));
  const villageBbox = bbox(village) as [number, number, number, number];
  const cells = voronoi(seedFc, { bbox: villageBbox });

  const parcels: MockParcel[] = [];
  for (let i = 0; i < cells.features.length; i++) {
    const cell = cells.features[i];
    if (!cell?.geometry) continue;
    // Intersect with village polygon
    const clipped = safeIntersect(cell as Feature<Polygon>, village);
    if (!clipped) continue;
    const geom = clipped.geometry;
    if (geom.type !== 'Polygon') continue;
    const sqm = turfArea(clipped);
    if (sqm < 50) continue; // discard pathological slivers

    parcels.push({
      khasraNo: `${khasraPrefix}${String(i + 1).padStart(3, '0')}`,
      areaSqm: Math.round(sqm),
      landType: LAND_TYPES[Math.floor(rng() * LAND_TYPES.length)],
      geom,
    });
  }
  return parcels;
}

function safeIntersect(
  a: Feature<Polygon>,
  b: Feature<Polygon | MultiPolygon>,
): Feature<Polygon | MultiPolygon> | null {
  try {
    const out = intersect(featureCollection([a, b as Feature<Polygon>]));
    return out as Feature<Polygon | MultiPolygon> | null;
  } catch {
    return null;
  }
}

function sampleInside(
  polygonFeat: Feature<Polygon | MultiPolygon>,
  count: number,
  rng: () => number,
): [number, number][] {
  const [minX, minY, maxX, maxY] = bbox(polygonFeat);
  const out: [number, number][] = [];
  let attempts = 0;
  const limit = count * 50;
  while (out.length < count && attempts < limit) {
    attempts++;
    const lng = minX + rng() * (maxX - minX);
    const lat = minY + rng() * (maxY - minY);
    if (booleanPointInPolygon([lng, lat], polygonFeat as Feature<Polygon>)) {
      out.push([lng, lat]);
    }
  }
  return out;
}

/** Mulberry32 — small seeded PRNG for stable test/seed output. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Helper for the seed script: synthesize N village polygons inside a district.
 *  Each village is a small circular footprint (~2 km radius ≈ 12 km²) around a
 *  random centroid, clipped to the district polygon. This keeps individual
 *  parcels in a realistic 1000-10000 m² range when subdivided into ~30 plots. */
export function generateMockVillages(
  district: Feature<Polygon | MultiPolygon>,
  count: number,
  rng: () => number,
): Feature<Polygon>[] {
  const seeds = sampleInside(district, count, rng);
  const out: Feature<Polygon>[] = [];
  for (const c of seeds) {
    const circle = buildCirclePolygon(c, 2.0); // 2 km radius
    const clipped = safeIntersect(circle, district);
    if (!clipped || clipped.geometry.type !== 'Polygon') continue;
    out.push({ type: 'Feature', geometry: clipped.geometry, properties: {} });
  }
  return out;
}

function buildCirclePolygon(center: [number, number], radiusKm: number): Feature<Polygon> {
  // 32-vertex polygon — enough for visual roundness, cheap for turf intersect.
  const steps = 32;
  const [lng, lat] = center;
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    ring.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} };
}

// Unused re-exports silenced; kept available for downstream callers.
export { bboxPolygon, turfPolygon };
