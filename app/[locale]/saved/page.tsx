import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabase/server';
import { SavedParcelsList } from './SavedParcelsList';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: 'Saved' });
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function SavedPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Saved' });

  const supabase = supabaseServerReadOnly();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    // Send the user back to the homepage with a hint so the sign-in modal can
    // pop open. The middleware preserves the locale prefix automatically.
    redirect(`/${locale}/?signin=1`);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>
      <SavedParcelsList locale={locale as Locale} />
    </main>
  );
}
