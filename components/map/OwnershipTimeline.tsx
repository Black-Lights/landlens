import { User2 } from 'lucide-react';
import { clsx } from 'clsx';

import type { ParcelDetail } from './ParcelSidebar';

type Props = { owners: ParcelDetail['owners'] };

export function OwnershipTimeline({ owners }: Props) {
  if (owners.length === 0) {
    return (
      <p className="text-sm text-slate-500">No ownership records on file.</p>
    );
  }
  return (
    <ol className="relative space-y-3 border-l border-slate-200 pl-4">
      {owners.map((o, i) => (
        <li key={o.id} className="relative">
          <span
            className={clsx(
              'absolute -left-[21px] top-1 grid h-4 w-4 place-items-center rounded-full ring-2 ring-white',
              o.is_current ? 'bg-accent' : 'bg-slate-300',
            )}
            aria-hidden
          >
            <User2 className="h-2.5 w-2.5 text-white" />
          </span>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">{o.owner_name}</p>
            {o.is_current ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">Current</span>
            ) : (
              <span className="text-[10px] text-slate-400">
                {fmtDate(o.transfer_date) ?? fmtDate(o.registration_date) ?? '—'}
              </span>
            )}
          </div>
          {o.father_or_spouse && (
            <p className="text-xs text-slate-500">S/o · D/o · W/o {o.father_or_spouse}</p>
          )}
          <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
            {o.ownership_type && <span>{cap(o.ownership_type)}</span>}
            {o.share_fraction && <span>· Share {o.share_fraction}</span>}
            {o.registration_date && i === owners.length - 1 && (
              <span>· Registered {fmtDate(o.registration_date)}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
