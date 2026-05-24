'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Map as MapIcon, FileText, Globe } from 'lucide-react';
import { clsx } from 'clsx';

type Props = {
  parcelId: string;
  // For naming the downloaded file as a fallback when the browser doesn't
  // honour Content-Disposition (rare, but happens with some download managers).
  khasraNo: string | null;
};

type Format = 'geojson' | 'kml' | 'pdf';

export function ExportMenu({ parcelId, khasraNo }: Props) {
  const t = useTranslations('Sidebar');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function download(format: Format) {
    setPending(format);
    setError(null);
    try {
      const res = await fetch(`/api/parcels/${parcelId}/export?format=${format}`);
      if (!res.ok) throw new Error('export_failed');
      const blob = await res.blob();
      const ext = format === 'geojson' ? 'geojson' : format;
      const slug = khasraNo
        ? `landlens-khasra-${khasraNo.replace(/[^\w-]/g, '')}`
        : `landlens-parcel-${parcelId.slice(0, 8)}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      setError(t('exportFailed'));
    } finally {
      setPending(null);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('downloadAria')}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-white px-2.5 text-sm text-slate-700 ring-1 ring-black/5 hover:bg-slate-50"
      >
        <Download className="h-4 w-4" aria-hidden />
        <span>{t('download')}</span>
      </button>

      {open && (
        <div
          role="menu"
          className={clsx(
            'absolute top-11 z-30 w-56 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black/5',
            'right-0 rtl:right-auto rtl:left-0',
          )}
        >
          <ExportItem
            icon={<Globe className="h-4 w-4" />}
            label={t('exportGeoJson')}
            onClick={() => download('geojson')}
            pending={pending === 'geojson'}
          />
          <ExportItem
            icon={<MapIcon className="h-4 w-4" />}
            label={t('exportKml')}
            onClick={() => download('kml')}
            pending={pending === 'kml'}
          />
          <ExportItem
            icon={<FileText className="h-4 w-4" />}
            label={t('exportPdf')}
            onClick={() => download('pdf')}
            pending={pending === 'pdf'}
          />
          {error && (
            <p className="border-t border-slate-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ExportItem({
  icon,
  label,
  onClick,
  pending,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={pending}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="text-slate-400">{icon}</span>
      <span className="flex-1">{label}</span>
      {pending && (
        <span className="text-xs text-slate-400" aria-hidden>
          …
        </span>
      )}
    </button>
  );
}
