'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatLatLng, formatUtm, latLngToUtm } from '@/lib/map/utm';

type Props = {
  lat: number | null;
  lng: number | null;
};

export function CoordReadout({ lat, lng }: Props) {
  const t = useTranslations('CoordReadout');
  const [mode, setMode] = useState<'latlng' | 'utm'>('latlng');

  let label: string;
  if (lat == null || lng == null) {
    label = '—';
  } else if (mode === 'latlng') {
    label = formatLatLng(lat, lng);
  } else {
    const u = latLngToUtm(lat, lng);
    label = u ? formatUtm(u) : t('utmUnavailable');
  }

  const modeLabel = mode === 'latlng' ? t('modeLatLng') : t('modeUtm');

  return (
    <button
      type="button"
      onClick={() => setMode((m) => (m === 'latlng' ? 'utm' : 'latlng'))}
      title={t('switchTitle', { mode: modeLabel })}
      className="pointer-events-auto rounded-md bg-white/95 px-2.5 py-1 font-mono text-[11px] tabular-nums text-slate-700 shadow-md ring-1 ring-black/5 backdrop-blur hover:bg-white"
    >
      {label}
    </button>
  );
}
