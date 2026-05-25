'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, MapPin, Loader2 } from 'lucide-react';
import Image from 'next/image';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/config';

interface Saved {
  id: string;
  parcel_id: string;
  label: string | null;
  created_at: string;
  khasra_no: string | null;
  area_sqm: number;
  area_acres: number;
  land_type: string | null;
  centroid: [number, number] | null;
  village: string | null;
  district: string | null;
  state: string | null;
}

export function SavedParcelsList({ locale }: { locale: Locale }) {
  const t = useTranslations('Saved');
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/saved-parcels')
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error('load'))))
      .then((json: { saved: Saved[] }) => {
        if (!cancelled) setSaved(json.saved);
      })
      .catch(() => {
        if (!cancelled) setError(t('loadFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function remove(parcelId: string) {
    const prev = saved;
    setSaved((s) => s?.filter((row) => row.parcel_id !== parcelId) ?? null);
    try {
      const res = await fetch(`/api/saved-parcels/${parcelId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('remove');
    } catch {
      setSaved(prev);
    }
  }

  if (error) {
    return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>;
  }

  if (saved === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
      </p>
    );
  }

  if (saved.length === 0) {
    return <p className="rounded-md bg-slate-50 px-4 py-6 text-sm text-slate-600">{t('empty')}</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {saved.map((row) => {
        // Thumbnails come from our tile-stitching endpoint — keeps the
        // MapTiler key server-side and works on the free tile-only plan.
        const thumb = `/api/static-map/${row.parcel_id}?w=480&h=280`;
        const breadcrumb = [row.village, row.district, row.state].filter(Boolean).join(' · ');
        const label = row.khasra_no ? `Khasra ${row.khasra_no}` : t('title');
        const date = formatDate(row.created_at, locale);
        return (
          <li
            key={row.id}
            className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md"
          >
            <div className="relative aspect-video bg-slate-100">
              {thumb ? (
                <Image
                  src={thumb}
                  alt={`${label} — ${breadcrumb || t('title')}`}
                  width={480}
                  height={280}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                  <MapPin className="h-6 w-6" aria-hidden />
                </div>
              )}
            </div>
            <div className="space-y-2 p-4">
              <div>
                <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
                <p className="truncate text-xs text-slate-500">{breadcrumb || '—'}</p>
              </div>
              <p className="text-xs text-slate-400">{t('savedOn', { date })}</p>
              <div className="flex items-center justify-between pt-2">
                <Link
                  href={`/?parcel=${row.parcel_id}`}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  {t('openOnMap')}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(row.parcel_id)}
                  aria-label={t('removeAria', { label })}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> {t('remove')}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(`${locale}-IN-u-nu-latn`, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}
