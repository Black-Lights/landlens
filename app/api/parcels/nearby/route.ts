// GET /api/parcels/nearby?lat=<>&lng=<>&limit=5&radius_m=2000
// Nearest N parcels to a point, ranked by distance. Used by the "Locate me"
// flow to highlight nearby plots after centering the user's GPS.

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { withErrors } from '@/lib/api/errors';
import { db } from '@/lib/db';

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  limit: z.coerce.number().int().min(1).max(50).default(5),
  radius_m: z.coerce.number().int().min(50).max(50000).default(2000),
});

interface Row {
  id: string;
  khasra_no: string | null;
  land_type: string | null;
  distance_m: string;
  centroid_lng: string;
  centroid_lat: string;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: NextRequest) {
  const q = QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const pt = `SRID=4326;POINT(${q.lng} ${q.lat})`;

  const rows = await db.$queryRaw<Row[]>`
    WITH base AS (
      SELECT
        id::text AS id,
        khasra_no,
        land_type,
        ST_Distance(
          COALESCE(centroid, ST_Centroid(geom))::geography,
          ST_GeogFromText(${pt})
        ) AS distance_m,
        ST_X(COALESCE(centroid, ST_Centroid(geom))) AS centroid_lng,
        ST_Y(COALESCE(centroid, ST_Centroid(geom))) AS centroid_lat
      FROM parcels
      WHERE ST_DWithin(
        COALESCE(centroid, ST_Centroid(geom))::geography,
        ST_GeogFromText(${pt}),
        ${q.radius_m}
      )
    )
    SELECT
      id,
      khasra_no,
      land_type,
      distance_m::text   AS distance_m,
      centroid_lng::text AS centroid_lng,
      centroid_lat::text AS centroid_lat
    FROM base
    ORDER BY distance_m ASC
    LIMIT ${q.limit};
  `;

  return NextResponse.json({
    parcels: rows.map((r) => ({
      id: r.id,
      khasra_no: r.khasra_no,
      land_type: r.land_type,
      distance_m: Math.round(Number(r.distance_m)),
      centroid: [Number(r.centroid_lng), Number(r.centroid_lat)] as [number, number],
    })),
  });
}

export const GET = withErrors(handler);
