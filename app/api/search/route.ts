// GET /api/search?q=<text>&type=<state|district|village|khasra|owner>&state=<lgd>
//
// Unified search across admin_boundaries (state/district/village), parcels
// (khasra_no) and ownership_records (owner_name + owner_name_en). Uses
// Postgres pg_trgm for typo-tolerance and ranks results:
//   exact (=1.0) > prefix (=0.9) > trigram similarity (0..1).
//
// Multilingual columns (name_en/name_hi/name_local, owner_name/owner_name_en)
// are matched in parallel — the highest similarity per row wins.

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { withErrors } from '@/lib/api/errors';
import { db } from '@/lib/db';

const SEARCH_TYPES = ['state', 'district', 'village', 'khasra', 'owner'] as const;
type SearchType = (typeof SEARCH_TYPES)[number];

const QuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  type: z.enum(SEARCH_TYPES).optional(),
  state: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

interface RawRow {
  type: SearchType;
  id: string;
  label: string;
  sublabel: string | null;
  parcel_id: string | null;
  state_id: string | null;
  state_name: string | null;
  district_id: string | null;
  district_name: string | null;
  village_id: string | null;
  village_name: string | null;
  bbox: string | null;     // "w,s,e,n"
  centroid: string | null; // "lng,lat"
  score: string;
}

export interface SearchResult {
  type: SearchType;
  id: string;
  label: string;
  sublabel: string | null;
  parcel_id: string | null;
  ancestors: {
    state: { id: string; name: string } | null;
    district: { id: string; name: string } | null;
    village: { id: string; name: string } | null;
  };
  bbox: [number, number, number, number] | null;
  centroid: [number, number] | null;
  score: number;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: NextRequest) {
  const q = QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  // Without a DB we can't search — return an empty payload so the UI degrades.
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ query: q.q, results: [] satisfies SearchResult[] });
  }

  const allowed: SearchType[] = q.type ? [q.type] : [...SEARCH_TYPES];
  const term = q.q;
  const lower = term.toLowerCase();
  const prefix = `${lower}%`;
  const contains = `%${lower}%`;

  // Optional scope: resolve state arg (LGD code OR name) to a uuid at query
  // time. NULL when not provided => no scoping applied.
  const scopeSubq = q.state
    ? Prisma.sql`(
        SELECT id FROM admin_boundaries
        WHERE level = 'state'
          AND (lgd_code = ${q.state} OR lower(name_en) = ${q.state.toLowerCase()})
        LIMIT 1
      )`
    : Prisma.sql`NULL::uuid`;

  const adminCte = (level: 'state' | 'district' | 'village') => {
    const ancestorJoins =
      level === 'village'
        ? Prisma.sql`
            LEFT JOIN admin_boundaries d ON d.id = ab.parent_id
            LEFT JOIN admin_boundaries s ON s.id = d.parent_id
          `
        : level === 'district'
        ? Prisma.sql`LEFT JOIN admin_boundaries s ON s.id = ab.parent_id`
        : Prisma.empty;

    const ancestorCols =
      level === 'village'
        ? Prisma.sql`
            s.id::text   AS state_id,    s.name_en AS state_name,
            d.id::text   AS district_id, d.name_en AS district_name,
            ab.id::text  AS village_id,  ab.name_en AS village_name
          `
        : level === 'district'
        ? Prisma.sql`
            s.id::text   AS state_id,    s.name_en AS state_name,
            ab.id::text  AS district_id, ab.name_en AS district_name,
            NULL::text   AS village_id,  NULL::text AS village_name
          `
        : Prisma.sql`
            ab.id::text  AS state_id,    ab.name_en AS state_name,
            NULL::text   AS district_id, NULL::text AS district_name,
            NULL::text   AS village_id,  NULL::text AS village_name
          `;

    const sublabel =
      level === 'village'
        ? Prisma.sql`CONCAT_WS(' · ', d.name_en, s.name_en)`
        : level === 'district'
        ? Prisma.sql`s.name_en`
        : Prisma.sql`NULL::text`;

    // Scope filter: state level checks ab.id; district checks ab.parent_id;
    // village checks d.parent_id (i.e. its state).
    const scopeFilter =
      level === 'state'
        ? Prisma.sql`AND (${scopeSubq} IS NULL OR ab.id = ${scopeSubq})`
        : level === 'district'
        ? Prisma.sql`AND (${scopeSubq} IS NULL OR ab.parent_id = ${scopeSubq})`
        : Prisma.sql`AND (${scopeSubq} IS NULL OR d.parent_id = ${scopeSubq})`;

    return Prisma.sql`
      SELECT
        ${level}::text AS type,
        ab.id::text    AS id,
        ab.name_en     AS label,
        ${sublabel}    AS sublabel,
        NULL::text     AS parcel_id,
        ${ancestorCols},
        CONCAT_WS(',', ST_XMin(ab.geom)::text, ST_YMin(ab.geom)::text, ST_XMax(ab.geom)::text, ST_YMax(ab.geom)::text) AS bbox,
        CONCAT_WS(',', ST_X(COALESCE(ab.centroid, ST_Centroid(ab.geom)))::text, ST_Y(COALESCE(ab.centroid, ST_Centroid(ab.geom)))::text) AS centroid,
        (CASE
           WHEN lower(ab.name_en) = ${lower}                       THEN 1.0
           WHEN lower(COALESCE(ab.name_hi, ''))    = ${lower}       THEN 1.0
           WHEN lower(COALESCE(ab.name_local, '')) = ${lower}       THEN 1.0
           WHEN lower(ab.name_en) LIKE ${prefix}                    THEN 0.9
           WHEN lower(COALESCE(ab.name_hi, ''))    LIKE ${prefix}   THEN 0.88
           WHEN lower(COALESCE(ab.name_local, '')) LIKE ${prefix}   THEN 0.88
           ELSE GREATEST(
             similarity(lower(ab.name_en),                  ${lower}),
             similarity(lower(COALESCE(ab.name_hi, '')),    ${lower}),
             similarity(lower(COALESCE(ab.name_local, '')), ${lower})
           )
         END)::text AS score
      FROM admin_boundaries ab
      ${ancestorJoins}
      WHERE ab.level = ${level}
        ${scopeFilter}
        AND (
          lower(ab.name_en)                  LIKE ${contains}
          OR lower(COALESCE(ab.name_hi, ''))    LIKE ${contains}
          OR lower(COALESCE(ab.name_local, '')) LIKE ${contains}
          OR lower(ab.name_en)                  % ${lower}
          OR lower(COALESCE(ab.name_hi, ''))    % ${lower}
          OR lower(COALESCE(ab.name_local, '')) % ${lower}
        )
    `;
  };

  const khasraCte = Prisma.sql`
    SELECT
      'khasra'::text AS type,
      p.id::text     AS id,
      p.khasra_no    AS label,
      CONCAT_WS(' · ', v.name_en, d.name_en) AS sublabel,
      p.id::text     AS parcel_id,
      s.id::text  AS state_id,    s.name_en AS state_name,
      d.id::text  AS district_id, d.name_en AS district_name,
      v.id::text  AS village_id,  v.name_en AS village_name,
      CONCAT_WS(',', ST_XMin(p.geom)::text, ST_YMin(p.geom)::text, ST_XMax(p.geom)::text, ST_YMax(p.geom)::text) AS bbox,
      CONCAT_WS(',', ST_X(COALESCE(p.centroid, ST_Centroid(p.geom)))::text, ST_Y(COALESCE(p.centroid, ST_Centroid(p.geom)))::text) AS centroid,
      (CASE
         WHEN lower(p.khasra_no) = ${lower}        THEN 1.0
         WHEN lower(p.khasra_no) LIKE ${prefix}    THEN 0.9
         ELSE similarity(lower(p.khasra_no), ${lower})
       END)::text AS score
    FROM parcels p
    LEFT JOIN admin_boundaries v ON v.id = p.village_id
    LEFT JOIN admin_boundaries d ON d.id = v.parent_id
    LEFT JOIN admin_boundaries s ON s.id = d.parent_id
    WHERE p.khasra_no IS NOT NULL
      AND (${scopeSubq} IS NULL OR d.parent_id = ${scopeSubq})
      AND (
        lower(p.khasra_no) LIKE ${contains}
        OR lower(p.khasra_no) % ${lower}
      )
  `;

  const ownerCte = Prisma.sql`
    SELECT
      'owner'::text AS type,
      o.id::text    AS id,
      o.owner_name  AS label,
      CONCAT_WS(' · ', 'Khasra ' || COALESCE(p.khasra_no, '?'), v.name_en) AS sublabel,
      o.parcel_id::text AS parcel_id,
      s.id::text  AS state_id,    s.name_en AS state_name,
      d.id::text  AS district_id, d.name_en AS district_name,
      v.id::text  AS village_id,  v.name_en AS village_name,
      CONCAT_WS(',', ST_XMin(p.geom)::text, ST_YMin(p.geom)::text, ST_XMax(p.geom)::text, ST_YMax(p.geom)::text) AS bbox,
      CONCAT_WS(',', ST_X(COALESCE(p.centroid, ST_Centroid(p.geom)))::text, ST_Y(COALESCE(p.centroid, ST_Centroid(p.geom)))::text) AS centroid,
      (CASE
         WHEN lower(o.owner_name) = ${lower}                              THEN 1.0
         WHEN lower(COALESCE(o.owner_name_en, '')) = ${lower}             THEN 1.0
         WHEN lower(o.owner_name) LIKE ${prefix}                          THEN 0.9
         WHEN lower(COALESCE(o.owner_name_en, '')) LIKE ${prefix}         THEN 0.88
         ELSE GREATEST(
           similarity(lower(o.owner_name),                       ${lower}),
           similarity(lower(COALESCE(o.owner_name_en, '')),      ${lower})
         )
       END)::text AS score
    FROM ownership_records o
    JOIN parcels p ON p.id = o.parcel_id
    LEFT JOIN admin_boundaries v ON v.id = p.village_id
    LEFT JOIN admin_boundaries d ON d.id = v.parent_id
    LEFT JOIN admin_boundaries s ON s.id = d.parent_id
    WHERE o.is_current = true
      AND (${scopeSubq} IS NULL OR d.parent_id = ${scopeSubq})
      AND (
        lower(o.owner_name)                        LIKE ${contains}
        OR lower(COALESCE(o.owner_name_en, ''))    LIKE ${contains}
        OR lower(o.owner_name)                     % ${lower}
        OR lower(COALESCE(o.owner_name_en, ''))    % ${lower}
      )
  `;

  const parts: Prisma.Sql[] = [];
  if (allowed.includes('state')) parts.push(adminCte('state'));
  if (allowed.includes('district')) parts.push(adminCte('district'));
  if (allowed.includes('village')) parts.push(adminCte('village'));
  if (allowed.includes('khasra')) parts.push(khasraCte);
  if (allowed.includes('owner')) parts.push(ownerCte);

  const unioned = Prisma.join(parts, ' UNION ALL ');

  const rows = await db
    .$queryRaw<RawRow[]>(Prisma.sql`
      SELECT * FROM (${unioned}) u
      WHERE score::float > 0.15
      ORDER BY score::float DESC, label ASC
      LIMIT ${q.limit}
    `)
    .catch((err) => {
      console.warn('[/api/search] query failed:', err);
      return [];
    });

  const results: SearchResult[] = rows.map((r) => ({
    type: r.type,
    id: r.id,
    label: r.label,
    sublabel: r.sublabel,
    parcel_id: r.parcel_id,
    ancestors: {
      state: r.state_id ? { id: r.state_id, name: r.state_name ?? '' } : null,
      district: r.district_id ? { id: r.district_id, name: r.district_name ?? '' } : null,
      village: r.village_id ? { id: r.village_id, name: r.village_name ?? '' } : null,
    },
    bbox: parseBbox(r.bbox),
    centroid: parseCentroid(r.centroid),
    score: Number(r.score),
  }));

  return NextResponse.json(
    { query: q.q, results },
    {
      headers: {
        // Short cache — results depend on data freshness once Sprint 7 starts
        // landing scraped records.
        'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}

function parseBbox(s: string | null): [number, number, number, number] | null {
  if (!s) return null;
  const parts = s.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts as [number, number, number, number];
}

function parseCentroid(s: string | null): [number, number] | null {
  if (!s) return null;
  const parts = s.split(',').map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts as [number, number];
}

export const GET = withErrors(handler);
