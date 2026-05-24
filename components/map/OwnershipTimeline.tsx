'use client';

import { User2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useLocale, useTranslations } from 'next-intl';

import type { ParcelDetail } from './ParcelSidebar';

type Props = { owners: ParcelDetail['owners'] };

const OWNERSHIP_TYPE_KEYS = new Set(['sole', 'joint', 'huf']);

export function OwnershipTimeline({ owners }: Props) {
  const t = useTranslations('Ownership');
  const locale = useLocale();
  // Force Western digits per editorial convention even when the rest of the
  // locale's numeric system is non-Latin (e.g. ur).
  const dateLocale = `${locale}-IN-u-nu-latn`;

  if (owners.length === 0) {
    return <p className="text-sm text-slate-500">{t('noRecords')}</p>;
  }
  return (
    <ol className="relative space-y-3 border-l border-slate-200 pl-4 rtl:border-l-0 rtl:border-r rtl:pl-0 rtl:pr-4">
      {owners.map((o, i) => (
        <li key={o.id} className="relative">
          <span
            className={clsx(
              // LTR: dot sits on the left rail. RTL: mirror to the right rail.
              'absolute top-1 grid h-4 w-4 place-items-center rounded-full ring-2 ring-white',
              '-left-[21px] rtl:left-auto rtl:-right-[21px]',
              o.is_current ? 'bg-accent' : 'bg-slate-300',
            )}
            aria-hidden
          >
            <User2 className="h-2.5 w-2.5 text-white" />
          </span>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">{o.owner_name}</p>
            {o.is_current ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                {t('current')}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">
                {fmtDate(o.transfer_date, dateLocale) ?? fmtDate(o.registration_date, dateLocale) ?? '—'}
              </span>
            )}
          </div>
          {o.father_or_spouse && (
            <p className="text-xs text-slate-500">{t('relation', { name: o.father_or_spouse })}</p>
          )}
          <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
            {o.ownership_type && <span>{labelForOwnership(o.ownership_type, t)}</span>}
            {o.share_fraction && <span>· {t('share', { fraction: o.share_fraction })}</span>}
            {o.registration_date && i === owners.length - 1 && (
              <span>· {t('registered', { date: fmtDate(o.registration_date, dateLocale) ?? '' })}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function fmtDate(d: string | null | undefined, locale: string): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short' }).format(dt);
}

function labelForOwnership(value: string, t: (key: string) => string): string {
  if (OWNERSHIP_TYPE_KEYS.has(value)) {
    return t(`type.${value}`);
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
