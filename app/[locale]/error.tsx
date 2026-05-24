'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

// Branded 500. Client-side only by design (Next.js requirement). In
// production we never surface the underlying stack — just log it server-side.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('ErrorPage');

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[error.tsx]', error);
    }
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-accent">500</p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">{t('title')}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">{t('subtitle')}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent/90"
        >
          {t('tryAgain')}
        </button>
        <Link
          href="/"
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          {t('backToMap')}
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 font-mono text-[11px] text-slate-400">ref: {error.digest}</p>
      )}
    </main>
  );
}
