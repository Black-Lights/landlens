// GET /api/parcels/by-village?village_id=<uuid>
// Returns a GeoJSON FeatureCollection of every parcel inside the village.

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { withErrors } from '@/lib/api/errors';
import { db } from '@/lib/db';

const QuerySchema = z.object({ village_id: z.string().uuid() });

interface Row {
  id: string;
  khasra_no: string | null;
  land_type: string | null;
  area_sqm: string;
  boundary_source: string;
  geometry: string;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: NextRequest) {
  const { village_id } = QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  const rows = await db.$queryRaw<Row[]>`
    SELECT
      id::text,
      khasra_no,
      land_type,
      area_sqm::text,
      boundary_source,
      ST_AsGeoJSON(geom) AS geometry
    FROM parcels
    WHERE village_id = ${village_id}::uuid
    LIMIT 2000;
  `;

  const fc = {
    type: 'FeatureCollection' as const,
    features: rows.map((r) => ({
      type: 'Feature' as const,
      geometry: JSON.parse(r.geometry),
      properties: {
        id: r.id,
        khasra_no: r.khasra_no,
        land_type: r.land_type,
        area_sqm: Number(r.area_sqm),
        boundary_source: r.boundary_source,
      },
    })),
  };

  return new NextResponse(JSON.stringify(fc), {
    status: 200,
    headers: {
      'Content-Type': 'application/geo+json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}

export const GET = withErrors(handler);
