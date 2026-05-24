'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/nav/LanguageSwitcher';

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
      {/* Floating top-right language switcher. Sits to the left of the
          basemap switcher in LTR (offset by 12 + 40 + 8 = right-[60px]) and
          on the right of it in RTL. */}
      <div className="absolute top-3 right-[60px] z-30 pointer-events-none rtl:right-auto rtl:left-[60px]">
        <LanguageSwitcher />
      </div>
    </>
  );
}
