'use client';

import { useEffect, useState } from 'react';
import { X, Landmark, Sprout, Loader2 } from 'lucide-react';
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

export function ParcelSidebar({ parcelId, onClose }: Props) {
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
          throw new Error(body?.error?.message ?? `Failed (${r.status})`);
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
  }, [parcelId]);

  const open = parcelId !== null;
  const landColor = data?.land_type ? LAND_TYPE_COLORS[data.land_type] ?? '#64748b' : '#64748b';

  return (
    <aside
      role="dialog"
      aria-label="Parcel details"
      aria-hidden={!open}
      className={clsx(
        // Desktop: right sidebar 380px wide.
        // Mobile: bottom sheet ~70vh, slides up.
        'pointer-events-auto fixed z-30 flex flex-col bg-white shadow-2xl ring-1 ring-black/5 transition-transform duration-300 ease-out',
        'inset-x-0 bottom-0 max-h-[70vh] rounded-t-2xl',
        'md:inset-y-0 md:right-0 md:left-auto md:w-[380px] md:max-h-none md:rounded-none md:rounded-l-2xl',
        open
          ? 'translate-y-0 md:translate-x-0'
          : 'translate-y-full md:translate-y-0 md:translate-x-full',
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-slate-500">Parcel</p>
          <h2 className="truncate text-lg font-semibold text-slate-900">
            {data?.khasra_no ?? (loading ? '…' : 'Unknown')}
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
          aria-label="Close parcel details"
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading parcel…
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
                  {labelForLandType(data.land_type)}
                </Badge>
              )}
              <Badge variant="source">
                <Landmark className="h-3 w-3" />
                {labelForSource(data.boundary_source)}
              </Badge>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-slate-500">Area (acres)</dt>
              <dd className="text-right font-mono tabular-nums text-slate-900">
                {data.area_acres.toFixed(3)}
              </dd>
              <dt className="text-slate-500">Area (hectares)</dt>
              <dd className="text-right font-mono tabular-nums text-slate-900">
                {data.area_hectares.toFixed(3)}
              </dd>
              <dt className="text-slate-500">Area (sq m)</dt>
              <dd className="text-right font-mono tabular-nums text-slate-900">
                {Math.round(data.area_sqm).toLocaleString('en-IN')}
              </dd>
              {data.district?.lgd_code && (
                <>
                  <dt className="text-slate-500">District LGD</dt>
                  <dd className="text-right font-mono tabular-nums text-slate-900">
                    {data.district.lgd_code}
                  </dd>
                </>
              )}
            </dl>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Ownership history
              </h3>
              <OwnershipTimeline owners={data.owners} />
            </div>

            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              These records are <strong>mock data</strong> generated for Sprint 3. Real records
              from state portals land in Sprint 7.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function labelForLandType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelForSource(s: string): string {
  switch (s) {
    case 'mock': return 'Mock';
    case 'osm': return 'OSM';
    case 'govt_bhunaksha': return 'Govt';
    case 'ai_with_constraints':
    case 'ai_only': return 'AI';
    case 'fmb_reconstructed': return 'FMB';
    case 'user_corrected': return 'User';
    default: return s;
  }
}
