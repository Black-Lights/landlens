'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import { clsx } from 'clsx';

import { useUser } from '@/lib/auth/useUser';

type Props = {
  parcelId: string;
  // Initial saved state — sidebar passes it in once known so the heart paints
  // the right colour on first render.
  initialSaved?: boolean;
};

// Optimistic toggle. Falls back to a "sign in" tooltip + opens the sign-in
// modal indirectly by dispatching a custom event the header listens to.
export function SaveParcelButton({ parcelId, initialSaved = false }: Props) {
  const t = useTranslations('Sidebar');
  const { user, loading } = useUser();

  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);

  // When the parcel changes, refresh saved-state from the server so the heart
  // reflects truth for the newly opened parcel (we don't keep a full client
  // cache).
  useEffect(() => {
    setSaved(initialSaved);
  }, [parcelId, initialSaved]);

  useEffect(() => {
    if (!user || loading) return;
    let cancelled = false;
    fetch(`/api/saved-parcels`)
      .then((r) => (r.ok ? r.json() : { saved: [] }))
      .then((json: { saved: { parcel_id: string }[] }) => {
        if (cancelled) return;
        setSaved(json.saved.some((s) => s.parcel_id === parcelId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [parcelId, user, loading]);

  async function toggle() {
    if (!user) {
      // Header listens for this and pops the sign-in modal.
      window.dispatchEvent(new CustomEvent('landlens:signin'));
      return;
    }
    if (pending) return;
    const next = !saved;
    setSaved(next);
    setPending(true);
    try {
      if (next) {
        const res = await fetch('/api/saved-parcels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parcel_id: parcelId }),
        });
        if (!res.ok) throw new Error('save_failed');
      } else {
        const res = await fetch(`/api/saved-parcels/${parcelId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('unsave_failed');
      }
    } catch {
      // Roll back on failure.
      setSaved(!next);
    } finally {
      setPending(false);
    }
  }

  const label = !user ? t('signInToSave') : saved ? t('unsaveAria') : t('saveAria');

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-md ring-1 ring-black/5 transition-colors',
        saved
          ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
          : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-rose-500',
        pending && 'opacity-70',
      )}
    >
      <Heart
        className={clsx('h-4 w-4', saved && 'fill-current')}
        aria-hidden
      />
    </button>
  );
}
