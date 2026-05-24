// POST /api/auth/signout — clears the Supabase session cookies.
// Called from the avatar dropdown. We respond with JSON; the client re-renders
// after a soft refresh.

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { withErrors } from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler() {
  const supabase = supabaseServer();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}

export const POST = withErrors(handler);
