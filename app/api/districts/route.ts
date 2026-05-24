// GET /api/districts?state=<state name>
// Reads the bundled per-state district GeoJSON from the public folder.
// We could let the client fetch the static file directly, but going through
// the API gives us a single place to return the structured 404 + lets us
// swap to a DB-backed source later without breaking callers.

import { NextResponse, type NextRequest } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import { ApiError, withErrors } from '@/lib/api/errors';

const QuerySchema = z.object({ state: z.string().min(1).max(80) });

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 86400; // 24h

async function handler(req: NextRequest) {
  const { state } = QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const safeName = state.replace(/[\\/]/g, ''); // no path traversal
  const filePath = path.join(process.cwd(), 'public', 'data', 'boundaries', 'districts', `${safeName}.geojson`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    throw new ApiError('NOT_FOUND', `District boundaries are not bundled for ${state} yet.`, {
      suggested_action: 'Run `npm run data:download-districts -- "' + state + '"` to fetch and simplify them.',
    });
  }
  return new NextResponse(raw, {
    status: 200,
    headers: {
      'Content-Type': 'application/geo+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}

export const GET = withErrors(handler);
