import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import MapClient from '@/components/map/MapClient';
import { locales } from '@/i18n/config';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://land.trenlens.com';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Site' });
  const description = t('metaDescription');
  const languages: Record<string, string> = Object.fromEntries(
    locales.map((l) => [l, `${SITE_URL}/${l}`]),
  );
  return {
    title: 'LandLens — See Every Inch of Land',
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages,
    },
    openGraph: {
      title: 'LandLens',
      description,
      url: `${SITE_URL}/${locale}`,
      siteName: 'LandLens',
      images: ['/brand/og-image.png'],
      locale: locale === 'hi' ? 'hi_IN' : locale === 'ur' ? 'ur_IN' : 'en_IN',
      type: 'website',
    },
  };
}

export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return (
    <main className="h-[100dvh] w-full">
      <MapClient />
    </main>
  );
}
