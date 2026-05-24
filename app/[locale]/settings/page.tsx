import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { supabaseServerReadOnly } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: 'Settings' });
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function SettingsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Settings' });

  const supabase = supabaseServerReadOnly();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/${locale}/?signin=1`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>
      <p className="rounded-md bg-slate-50 px-4 py-6 text-sm text-slate-600">{t('comingSoon')}</p>
    </main>
  );
}
