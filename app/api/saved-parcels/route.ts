// GET  /api/saved-parcels       — list current user's saves (newest first)
// POST /api/saved-parcels       — bookmark a parcel { parcel_id }
//
// Auth is enforced via Supabase SSR cookies. The RLS policies in
// `prisma/sql/rls-policies.sql` make sure callers cannot see or modify other
// users' rows even if they reach the DB directly with their anon JWT.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ApiError, withErrors } from '@/lib/api/errors';
import { supabaseServer } from '@/lib/supabase/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PostSchema = z.object({
  parcel_id: z.string().uuid(),
  label: z.string().max(120).optional(),
});

interface SavedRow {
  id: string;
  parcel_id: string;
  label: string | null;
  created_at: string;
  khasra_no: string | null;
  area_sqm: string;
  area_acres: string | null;
  land_type: string | null;
  centroid_lng: number | null;
  centroid_lat: number | null;
  village_name: string | null;
  district_name: string | null;
  state_name: string | null;
}

async function requireUser() {
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    throw new ApiError('UNAUTHORIZED', 'Sign in to use saved parcels.');
  }
  return data.user;
}

async function getHandler() {
  const user = await requireUser();
  const rows = await db.$queryRaw<SavedRow[]>`
    SELECT
      s.id::text,
      s.parcel_id::text,
      s.label,
      s.created_at::text,
      p.khasra_no,
      p.area_sqm::text,
      p.area_acres::text,
      p.land_type,
      ST_X(p.centroid)::float AS centroid_lng,
      ST_Y(p.centroid)::float AS centroid_lat,
      v.name_en AS village_name,
      d.name_en AS district_name,
      st.name_en AS state_name
    FROM saved_parcels s
    JOIN parcels p ON p.id = s.parcel_id
    LEFT JOIN admin_boundaries v  ON v.id  = p.village_id
    LEFT JOIN admin_boundaries d  ON d.id  = v.parent_id
    LEFT JOIN admin_boundaries st ON st.id = d.parent_id
    WHERE s.user_id = ${user.id}::uuid
    ORDER BY s.created_at DESC
    LIMIT 200;
  `;

  return NextResponse.json({
    saved: rows.map((r) => ({
      id: r.id,
      parcel_id: r.parcel_id,
      label: r.label,
      created_at: r.created_at,
      khasra_no: r.khasra_no,
      area_sqm: Number(r.area_sqm),
      area_acres: r.area_acres ? Number(r.area_acres) : Number(r.area_sqm) / 4046.86,
      land_type: r.land_type,
      centroid: r.centroid_lng != null && r.centroid_lat != null
        ? [r.centroid_lng, r.centroid_lat] as [number, number]
        : null,
      village: r.village_name,
      district: r.district_name,
      state: r.state_name,
    })),
  });
}

async function postHandler(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => ({}));
  const parsed = PostSchema.parse(body);

  // Single-row upsert keyed on (user_id, parcel_id). Returns the row so the
  // client can render the saved state without a follow-up GET.
  const rows = await db.$queryRaw<{ id: string; created_at: string }[]>`
    INSERT INTO saved_parcels (user_id, parcel_id, label)
    VALUES (${user.id}::uuid, ${parsed.parcel_id}::uuid, ${parsed.label ?? null})
    ON CONFLICT (user_id, parcel_id) DO UPDATE
      SET label = COALESCE(EXCLUDED.label, saved_parcels.label)
    RETURNING id::text, created_at::text;
  `;
  const row = rows[0];
  return NextResponse.json({
    id: row.id,
    parcel_id: parsed.parcel_id,
    label: parsed.label ?? null,
    created_at: row.created_at,
  }, { status: 201 });
}

export const GET = withErrors(getHandler);
export const POST = withErrors(postHandler);
