// DELETE /api/saved-parcels/:parcelId — un-bookmark a parcel for the current
// user. Keyed by parcel_id rather than the save's primary key so the client
// only has to remember which parcels it bookmarked, not the join-row UUID.

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ApiError, withErrors } from '@/lib/api/errors';
import { supabaseServer } from '@/lib/supabase/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ parcelId: z.string().uuid() });

async function deleteHandler(_req: Request, ctx: { params: { parcelId: string } }) {
  const { parcelId } = ParamsSchema.parse(ctx.params);

  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    throw new ApiError('UNAUTHORIZED', 'Sign in to manage saved parcels.');
  }

  await db.$executeRaw`
    DELETE FROM saved_parcels
    WHERE user_id = ${data.user.id}::uuid
      AND parcel_id = ${parcelId}::uuid;
  `;
  return NextResponse.json({ ok: true });
}

export const DELETE = withErrors(deleteHandler);
