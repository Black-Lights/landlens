// GET /api/villages?bbox=<w,s,e,n>&district_id=<uuid>
//
// 1. Look up cached village polygons in `admin_boundaries` whose centroids
//    fall inside the bbox (PostGIS ST_Intersects on centroid). Optionally
//    scoped to a district via `parent_id`.
// 2. If none, call OSM Overpass live, persist results under
//    parent_id=<district_id> (if supplied), return.
// Returns GeoJSON.

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { Prisma } from '@prisma/client';

import { ApiError, withErrors } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { fetchVillagePolygons, type OverpassVillageProps } from '@/lib/overpass';
import type { Feature, FeatureCollection, Polygon } from 'geojson';

const QuerySchema = z.object({
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'bbox must be w,s,e,n'),
  district_id: z.string().uuid().optional(),
});

interface CachedRow {
  id: string;
  name_en: string;
  name_local: string | null;
  level: string;
  parent_id: string | null;
  geojson: string;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: NextRequest) {
  const parsed = QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const [w, s, e, n] = parsed.bbox.split(',').map(Number) as [number, number, number, number];
  if (!Number.isFinite(w + s + e + n) || w >= e || s >= n) {
    throw new ApiError('BAD_REQUEST', 'bbox values must be ordered west,south,east,north and finite');
  }
  if ((e - w) * (n - s) > 25) {
    // Cap area to keep Overpass calls reasonable (~5°×5° ≈ Maharashtra-sized).
    throw new ApiError('BAD_REQUEST', 'bbox is too large; request a sub-region (max ~5° × 5°)');
  }

  // 1. Try cache
  let cached: CachedRow[] = [];
  if (process.env.DATABASE_URL) {
    const districtFilter = parsed.district_id
      ? Prisma.sql`AND parent_id = ${parsed.district_id}::uuid`
      : Prisma.empty;
    cached = await db.$queryRaw<CachedRow[]>(Prisma.sql`
      SELECT id::text, name_en, name_local, level, parent_id::text,
             ST_AsGeoJSON(geom) AS geojson
      FROM admin_boundaries
      WHERE level = 'village'
        ${districtFilter}
        AND ST_Intersects(geom, ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}, 4326))
      LIMIT 2000;
    `).catch((err: unknown) => {
      console.warn('[/api/villages] cache lookup failed:', err);
      return [];
    });
  }

  if (cached.length > 0) {
    return geojsonResponse(toFeatureCollection(cached, 'cache'));
  }

  // 2. Live fetch from Overpass
  let live: FeatureCollection<Polygon, OverpassVillageProps>;
  try {
    live = await fetchVillagePolygons([w, s, e, n]);
  } catch (err) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'OSM Overpass is unreachable. Try again in a moment.', {
      suggested_action: 'Overpass is rate-limited and occasionally returns 504. Retry with a smaller bbox.',
      details: err instanceof Error ? err.message : String(err),
    });
  }

  // 3. Persist (best-effort; never block the response on a write failure).
  if (process.env.DATABASE_URL && live.features.length > 0) {
    void persistVillages(live, parsed.district_id).catch((err) =>
      console.warn('[/api/villages] persist failed:', err),
    );
  }

  return geojsonResponse(live, 'overpass');
}

function geojsonResponse(fc: FeatureCollection, source: string = 'cache') {
  return new NextResponse(JSON.stringify(fc), {
    status: 200,
    headers: {
      'Content-Type': 'application/geo+json; charset=utf-8',
      'Cache-Control': source === 'cache'
        ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
        : 'public, max-age=600, s-maxage=3600',
      'X-LandLens-Source': source,
    },
  });
}

function toFeatureCollection(rows: CachedRow[], source: string): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows.map<Feature>((r) => ({
      type: 'Feature',
      geometry: JSON.parse(r.geojson),
      properties: {
        id: r.id,
        name: r.name_en,
        name_local: r.name_local,
        admin_level: 8,
        source,
      },
    })),
  };
}

async function persistVillages(
  fc: FeatureCollection<Polygon, OverpassVillageProps>,
  parentId?: string,
): Promise<void> {
  for (const feat of fc.features) {
    const geomJson = JSON.stringify(feat.geometry);
    await db.$executeRaw`
      INSERT INTO admin_boundaries (id, name_en, name_local, level, parent_id, geom, centroid)
      VALUES (
        gen_random_uuid(),
        ${feat.properties.name},
        ${feat.properties.name_local ?? null},
        'village',
        ${parentId ?? null}::uuid,
        ST_Multi(ST_GeomFromGeoJSON(${geomJson})),
        ST_Centroid(ST_GeomFromGeoJSON(${geomJson}))
      )
      ON CONFLICT DO NOTHING;
    `;
  }
}

export const GET = withErrors(handler);
