// GET /api/parcels/:id/export?format=geojson|kml|pdf
//
// Single endpoint that hydrates a parcel and streams it back in the requested
// format. Keeps the sidebar client simple — one URL pattern per format.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { renderToBuffer } from '@react-pdf/renderer';

import { ApiError, withErrors } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { parcelToGeoJson } from '@/lib/export/geojson';
import { parcelToKml } from '@/lib/export/kml';
import { ParcelReport, fetchPdfMapImage } from '@/lib/export/pdf';
import type { ParcelExport } from '@/lib/export/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });
const QuerySchema = z.object({ format: z.enum(['geojson', 'kml', 'pdf']) });

interface Row {
  id: string;
  khasra_no: string | null;
  area_sqm: string;
  area_acres: string | null;
  area_hectares: string | null;
  land_type: string | null;
  boundary_source: string;
  village_id: string | null;
  village_name: string | null;
  district_id: string | null;
  district_name: string | null;
  district_lgd: string | null;
  state_id: string | null;
  state_name: string | null;
  geometry: string;
}

interface OwnerRow {
  id: string;
  owner_name: string;
  father_or_spouse: string | null;
  ownership_type: string | null;
  share_fraction: string | null;
  transfer_date: string | null;
  registration_date: string | null;
  is_current: boolean;
}

async function handler(request: Request, ctx: { params: { id: string } }) {
  const { id } = ParamsSchema.parse(ctx.params);
  const url = new URL(request.url);
  const { format } = QuerySchema.parse({ format: url.searchParams.get('format') ?? 'geojson' });

  const rows = await db.$queryRaw<Row[]>`
    SELECT
      p.id::text,
      p.khasra_no,
      p.area_sqm::text,
      p.area_acres::text,
      p.area_hectares::text,
      p.land_type,
      p.boundary_source,
      v.id::text  AS village_id,
      v.name_en   AS village_name,
      d.id::text  AS district_id,
      d.name_en   AS district_name,
      d.lgd_code  AS district_lgd,
      s.id::text  AS state_id,
      s.name_en   AS state_name,
      ST_AsGeoJSON(p.geom) AS geometry
    FROM parcels p
    LEFT JOIN admin_boundaries v ON v.id = p.village_id
    LEFT JOIN admin_boundaries d ON d.id = v.parent_id
    LEFT JOIN admin_boundaries s ON s.id = d.parent_id
    WHERE p.id = ${id}::uuid
    LIMIT 1;
  `;
  if (rows.length === 0) {
    throw new ApiError('PARCEL_NOT_FOUND', `No parcel with id ${id}`);
  }
  const r = rows[0];

  const owners = await db.$queryRaw<OwnerRow[]>`
    SELECT
      id::text, owner_name, father_or_spouse, ownership_type, share_fraction,
      transfer_date::text, registration_date::text, is_current
    FROM ownership_records
    WHERE parcel_id = ${id}::uuid
    ORDER BY is_current DESC, transfer_date DESC NULLS LAST, registration_date DESC NULLS LAST;
  `;

  const parcel: ParcelExport = {
    id: r.id,
    khasra_no: r.khasra_no,
    area_sqm: Number(r.area_sqm),
    area_acres: r.area_acres ? Number(r.area_acres) : Number(r.area_sqm) / 4046.86,
    area_hectares: r.area_hectares ? Number(r.area_hectares) : Number(r.area_sqm) / 10000,
    land_type: r.land_type,
    boundary_source: r.boundary_source,
    geometry: JSON.parse(r.geometry),
    village: r.village_id ? { id: r.village_id, name: r.village_name ?? 'Unknown' } : null,
    district: r.district_id ? { id: r.district_id, name: r.district_name ?? 'Unknown', lgd_code: r.district_lgd } : null,
    state: r.state_id ? { id: r.state_id, name: r.state_name ?? 'Unknown' } : null,
    owners,
  };

  const filenameBase = parcel.khasra_no
    ? `landlens-khasra-${parcel.khasra_no.replace(/[^\w-]/g, '')}`
    : `landlens-parcel-${parcel.id.slice(0, 8)}`;

  if (format === 'geojson') {
    return NextResponse.json(parcelToGeoJson(parcel), {
      headers: {
        'Content-Type': 'application/geo+json',
        'Content-Disposition': `attachment; filename="${filenameBase}.geojson"`,
      },
    });
  }

  if (format === 'kml') {
    return new NextResponse(parcelToKml(parcel), {
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml',
        'Content-Disposition': `attachment; filename="${filenameBase}.kml"`,
      },
    });
  }

  // format === 'pdf' — prefetch the MapTiler PNG so react-pdf doesn't have to
  // do its own HTTP fetch (which is unreliable in serverless).
  const mapImage = await fetchPdfMapImage(parcel);
  const buffer = await renderToBuffer(ParcelReport({ parcel, mapImage }));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
    },
  });
}

export const GET = withErrors(handler);
