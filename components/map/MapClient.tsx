'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/nav/LanguageSwitcher';
import { AuthButton } from '@/components/auth/AuthButton';

function MapLoading() {
  const t = useTranslations('Common');
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      {t('loadingMap')}
    </div>
  );
}

const MapView = dynamic(() => import('./MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <MapLoading />,
});

export default function MapClient() {
  return (
    <>
      <MapView />
      {/* Floating top-right header cluster: auth button + language switcher.
          Sits inset of the basemap switcher (which lives at right-3). In RTL
          the cluster flips to the left edge automatically. */}
      <div className="absolute top-3 right-[60px] z-30 flex items-center gap-2 rtl:right-auto rtl:left-[60px] rtl:flex-row-reverse">
        <AuthButton />
        <LanguageSwitcher />
      </div>
    </>
  );
}
