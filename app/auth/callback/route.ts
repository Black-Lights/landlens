// OAuth + magic-link callback. Both flows land here with `?code=<otp>` and
// optional `?next=/<path>` so we can return the user to wherever they were
// before signing in. Locale-agnostic on purpose — magic links use a single
// canonical URL that's friendly to email clients and matches the URL we
// register in Supabase Auth settings.

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { defaultLocale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? `/${defaultLocale}`;

  if (!code) {
    return NextResponse.redirect(new URL(`/${defaultLocale}?auth_error=missing_code`, url.origin));
  }

  const supabase = supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/${defaultLocale}?auth_error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // `next` is server-validated to be same-origin. Anything else falls back to
  // the homepage to avoid open-redirect abuse.
  const target = next.startsWith('/') ? next : `/${defaultLocale}`;
  return NextResponse.redirect(new URL(target, url.origin));
}
