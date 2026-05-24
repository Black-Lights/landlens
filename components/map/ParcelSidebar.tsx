'use client';

import { useEffect, useState } from 'react';
import { X, Landmark, Sprout, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { clsx } from 'clsx';

import { Badge } from '@/components/ui/Badge';
import { LAND_TYPE_COLORS } from '@/lib/map/constants';
import { OwnershipTimeline } from './OwnershipTimeline';

export interface ParcelDetail {
  id: string;
  khasra_no: string | null;
  area_sqm: number;
  area_acres: number;
  area_hectares: number;
  land_type: string | null;
  boundary_source: string;
  village: { id: string; name: string } | null;
  district: { id: string; name: string; lgd_code: string | null } | null;
  state: { id: string; name: string } | null;
  owners: {
    id: string;
    owner_name: string;
    father_or_spouse: string | null;
    ownership_type: string | null;
    share_fraction: string | null;
    transfer_date: string | null;
    registration_date: string | null;
    is_current: boolean;
  }[];
}

type Props = {
  parcelId: string | null;
  onClose: () => void;
};

// Indo-Arabic digits everywhere — locale extension forces `nu=latn` even on
// `ur-IN` where engines might otherwise emit ١٢٣. Indian Urdu uses Western
// digits per editorial convention.
function localeNumberFormat(locale: string): string {
  return `${locale}-IN-u-nu-latn`;
}

export function ParcelSidebar({ parcelId, onClose }: Props) {
  const t = useTranslations('ParcelSidebar');
  const tLand = useTranslations('LandType');
  const tSource = useTranslations('BoundarySource');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();

  const [data, setData] = useState<ParcelDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!parcelId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/parcels/${parcelId}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error?.message ?? tErrors('parcelFetchFailed', { status: r.status }));
        }
        return r.json();
      })
      .then((json: ParcelDetail) => {
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parcelId, tErrors]);

  const open = parcelId !== null;
  const landColor = data?.land_type ? LAND_TYPE_COLORS[data.land_type] ?? '#64748b' : '#64748b';
  const numberFormat = new Intl.NumberFormat(localeNumberFormat(locale));
  const decimalFormat = new Intl.NumberFormat(localeNumberFormat(locale), {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

  return (
    <aside
      role="dialog"
      aria-label={t('ariaLabel')}
      aria-hidden={!open}
      className={clsx(
        // Desktop: side sheet 380px. RTL swaps left/right so it slides in from
        // the left. Mobile remains a bottom sheet either way.
        'pointer-events-auto fixed z-30 flex flex-col bg-white shadow-2xl ring-1 ring-black/5 transition-transform duration-300 ease-out',
        'inset-x-0 bottom-0 max-h-[70vh] rounded-t-2xl',
        // LTR: right-aligned sheet, slides in from right.
        'md:inset-y-0 md:right-0 md:left-auto md:w-[380px] md:max-h-none md:rounded-none md:rounded-l-2xl',
        // RTL: flip to left-aligned sheet with left-rounded corner reversed.
        'md:rtl:right-auto md:rtl:left-0 md:rtl:rounded-l-none md:rtl:rounded-r-2xl',
        open
          ? 'translate-y-0 md:translate-x-0'
          // Mobile closed: slide down. Desktop closed: slide off-edge — right
          // edge in LTR, left edge in RTL.
          : 'translate-y-full md:translate-y-0 md:translate-x-full md:rtl:-translate-x-full',
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-slate-500">{t('header')}</p>
          <h2 className="truncate text-lg font-semibold text-slate-900">
            {data?.khasra_no ?? (loading ? '…' : t('header'))}
          </h2>
          {data && (
            <p className="truncate text-xs text-slate-500">
              {[data.village?.name, data.district?.name, data.state?.name].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('closeAria')}
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}
        {data && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {data.land_type && (
                <Badge variant="land" style={{ backgroundColor: landColor }}>
                  <Sprout className="h-3 w-3" />
                  {labelForLandType(data.land_type, tLand)}
                </Badge>
              )}
              <Badge variant="source">
                <Landmark className="h-3 w-3" />
                {labelForSource(data.boundary_source, tSource)}
              </Badge>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-slate-500">{t('areaAcres')}</dt>
              <dd className="text-right font-mono tabular-nums text-slate-900">
                {decimalFormat.format(data.area_acres)}
              </dd>
              <dt className="text-slate-500">{t('areaHectares')}</dt>
              <dd className="text-right font-mono tabular-nums text-slate-900">
                {decimalFormat.format(data.area_hectares)}
              </dd>
              <dt className="text-slate-500">{t('areaSqm')}</dt>
              <dd className="text-right font-mono tabular-nums text-slate-900">
                {numberFormat.format(Math.round(data.area_sqm))}
              </dd>
              {data.district?.lgd_code && (
                <>
                  <dt className="text-slate-500">{t('districtLgd')}</dt>
                  <dd className="text-right font-mono tabular-nums text-slate-900">
                    {data.district.lgd_code}
                  </dd>
                </>
              )}
            </dl>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('ownershipHistory')}
              </h3>
              <OwnershipTimeline owners={data.owners} />
            </div>

            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              {t('mockBannerLead')} <strong>{t('mockBannerEmphasis')}</strong> {t('mockBannerTrail')}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function labelForLandType(t: string, tr: (key: string) => string): string {
  // Translation catalogues cover every key in LAND_TYPE_COLORS; unknown values
  // fall back to a humanised version of the raw code.
  try {
    return tr(t);
  } catch {
    return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function labelForSource(s: string, tr: (key: string) => string): string {
  try {
    return tr(s);
  } catch {
    return s;
  }
}
