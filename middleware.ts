import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  // Skip Next internals, API routes, static assets, and known root files.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
