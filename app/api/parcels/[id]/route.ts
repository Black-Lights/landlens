// GET /api/parcels/:id — parcel + ownership timeline + admin chain.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ApiError, withErrors } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { logParcelAccess } from '@/lib/auth/audit';

const ParamsSchema = z.object({ id: z.string().uuid() });

interface ParcelRow {
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: Request, ctx: { params: { id: string } }) {
  const { id } = ParamsSchema.parse(ctx.params);

  // Audit hit — fire and forget so the response isn't blocked. Bot UAs are
  // filtered out inside the helper.
  void logParcelAccess(req, id);

  const rows = await db.$queryRaw<ParcelRow[]>`
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
      id::text,
      owner_name,
      father_or_spouse,
      ownership_type,
      share_fraction,
      transfer_date::text,
      registration_date::text,
      is_current
    FROM ownership_records
    WHERE parcel_id = ${id}::uuid
    ORDER BY is_current DESC, transfer_date DESC NULLS LAST, registration_date DESC NULLS LAST;
  `;

  return NextResponse.json({
    id: r.id,
    khasra_no: r.khasra_no,
    area_sqm: Number(r.area_sqm),
    area_acres: r.area_acres ? Number(r.area_acres) : Number(r.area_sqm) / 4046.86,
    area_hectares: r.area_hectares ? Number(r.area_hectares) : Number(r.area_sqm) / 10000,
    land_type: r.land_type,
    boundary_source: r.boundary_source,
    village: r.village_id ? { id: r.village_id, name: r.village_name ?? 'Unknown' } : null,
    district: r.district_id ? { id: r.district_id, name: r.district_name ?? 'Unknown', lgd_code: r.district_lgd } : null,
    state: r.state_id ? { id: r.state_id, name: r.state_name ?? 'Unknown' } : null,
    geometry: JSON.parse(r.geometry),
    owners,
  });
}

export const GET = withErrors(handler);
