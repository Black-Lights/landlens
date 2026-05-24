import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';

import { locales, defaultLocale } from './i18n/config';
import { refreshSupabaseSession } from './lib/supabase/middleware';

const intl = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'always',
});

export default async function middleware(request: NextRequest) {
  // next-intl handles the locale prefix + cookie. We then layer Supabase's
  // session refresh on the same response object so any rotated auth cookies
  // ride out in a single Set-Cookie header.
  const response = intl(request);
  return refreshSupabaseSession(request, response);
}

export const config = {
  // Skip Next internals, API routes, static assets, and known root files.
  // `auth` is excluded so the OAuth/magic-link callback at /auth/callback
  // doesn't get rewritten through the next-intl locale prefix.
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
