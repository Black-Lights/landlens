'use client';

import { ChevronRight, Home } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DrillLevel } from '@/lib/map/constants';

export type DrillCrumb = {
  level: DrillLevel;
  label: string;
};

type Props = {
  trail: DrillCrumb[];
  onJump: (index: number) => void;
};

export function Breadcrumb({ trail, onJump }: Props) {
  const t = useTranslations('Breadcrumb');
  if (trail.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 md:top-3">
      <nav
        aria-label={t('ariaLabel')}
        className="pointer-events-auto flex max-w-[calc(100vw-32px)] items-center gap-1 overflow-x-auto rounded-full bg-white/95 px-3 py-1.5 text-sm shadow-md ring-1 ring-black/5 backdrop-blur md:max-w-[90vw]"
      >
        {trail.map((crumb, i) => {
          const isLast = i === trail.length - 1;
          // First crumb is always India; its label is provided by the
          // translation. Deeper crumbs come from feature properties.
          const label = i === 0 && crumb.level === 'india' ? t('india') : crumb.label;
          return (
            <div key={`${crumb.level}-${i}`} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 text-slate-400 rtl:-scale-x-100"
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={() => onJump(i)}
                disabled={isLast}
                className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 ${
                  isLast
                    ? 'cursor-default font-medium text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {i === 0 && <Home className="h-3.5 w-3.5" aria-hidden />}
                <span>{label}</span>
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
