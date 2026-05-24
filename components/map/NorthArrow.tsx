'use client';

import { useTranslations } from 'next-intl';

type Props = {
  bearing: number;
  onReset: () => void;
};

export function NorthArrow({ bearing, onReset }: Props) {
  const t = useTranslations('NorthArrow');
  return (
    <button
      type="button"
      onClick={onReset}
      aria-label={t('resetAria')}
      title={t('resetAria')}
      className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/5 hover:bg-slate-50"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 120ms linear' }}
        aria-hidden
      >
        <polygon points="12,3 8,20 12,16 16,20" fill="#dc2626" />
        <polygon points="12,3 16,20 12,16" fill="#1e293b" />
        <text
          x="12"
          y="11"
          textAnchor="middle"
          fontSize="6"
          fill="#ffffff"
          fontWeight="700"
        >
          N
        </text>
      </svg>
    </button>
  );
}
