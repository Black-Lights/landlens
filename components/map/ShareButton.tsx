'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { clsx } from 'clsx';

type Props = { parcelId: string };

// Copies a canonical /<locale>/?parcel=<uuid> URL to the clipboard. Sister of
// the sidebar's heart and download buttons.
export function ShareButton({ parcelId }: Props) {
  const t = useTranslations('Sidebar');
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  async function share() {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/${locale}/?parcel=${parcelId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback — open a temporary input so the user can manually copy.
      window.prompt(t('shareAria'), url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={t('shareAria')}
      title={copied ? t('shareCopied') : t('shareAria')}
      className={clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-md ring-1 ring-black/5 transition-colors',
        copied ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-slate-500 hover:bg-slate-50',
      )}
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
    </button>
  );
}
