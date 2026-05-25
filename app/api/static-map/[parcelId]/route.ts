// GET /api/static-map/:parcelId?w=480&h=280
//
// Public, cacheable PNG snapshot of a parcel — used by the Saved page
// thumbnails and anywhere else the client needs a baked map image. The
// actual stitching happens server-side in lib/map/tile-stitch.ts so the
// MapTiler key never leaves the runtime.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ApiError, withErrors } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { stitchStaticMap } from '@/lib/map/tile-stitch';

export const runtime = 'nodejs';

const ParamsSchema = z.object({ parcelId: z.string().uuid() });
const QuerySchema = z.object({
  w: z.coerce.number().min(64).max(1024).default(480),
  h: z.coerce.number().min(64).max(1024).default(280),
  // z is treated as an upper bound — auto-zoom picks a lower value for
  // larger parcels so the polygon doesn't fill the frame.
  z: z.coerce.number().min(10).max(19).default(18),
});

interface Row {
  centroid_lng: number | null;
  centroid_lat: number | null;
  geometry: string;
}

async function handler(request: Request, ctx: { params: { parcelId: string } }) {
  const { parcelId } = ParamsSchema.parse(ctx.params);
  const url = new URL(request.url);
  const { w, h, z } = QuerySchema.parse({
    w: url.searchParams.get('w'),
    h: url.searchParams.get('h'),
    z: url.searchParams.get('z'),
  });

  const rows = await db.$queryRaw<Row[]>`
    SELECT
      ST_X(centroid)::float AS centroid_lng,
      ST_Y(centroid)::float AS centroid_lat,
      ST_AsGeoJSON(geom) AS geometry
    FROM parcels WHERE id = ${parcelId}::uuid LIMIT 1;
  `;
  if (rows.length === 0) throw new ApiError('PARCEL_NOT_FOUND', `No parcel with id ${parcelId}`);

  const r = rows[0];
  if (r.centroid_lng == null || r.centroid_lat == null) {
    throw new ApiError('NOT_FOUND', 'Parcel has no centroid');
  }
  const buffer = await stitchStaticMap([r.centroid_lng, r.centroid_lat], {
    width: w,
    height: h,
    zoom: z,
    geometry: JSON.parse(r.geometry),
  });
  if (!buffer) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'Map tile provider is unavailable');
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      // Cache aggressively — parcel geometry is stable, the upstream tiles
      // are themselves cached by MapTiler.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}

export const GET = withErrors(handler);
