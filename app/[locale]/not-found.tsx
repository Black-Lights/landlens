import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

// Branded 404 — Next.js renders this whenever a page under /[locale]/ calls
// notFound() or no route matches. We deliberately re-use the existing logo
// asset rather than embedding inline SVG so the file stays small.

export default async function NotFound() {
  // i18n: `not-found.tsx` runs outside the request-locale context, so we have
  // to fall back to the default catalog. The user can still hit the language
  // switcher from the destination page.
  const t = await getTranslations({ locale: 'en', namespace: 'NotFound' });
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-accent">404</p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">{t('title')}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">{t('subtitle')}</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent/90"
      >
        {t('backToMap')}
      </Link>
    </main>
  );
}
