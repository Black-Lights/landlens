'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogIn, LogOut, Settings, Bookmark } from 'lucide-react';
import { clsx } from 'clsx';
import type { User } from '@supabase/supabase-js';

import { supabaseBrowser } from '@/lib/supabase/client';
import { Link } from '@/i18n/navigation';
import { SignInModal } from './SignInModal';

// Header pill — shows "Sign in" when signed out, an initials avatar + dropdown
// (Saved parcels / Settings / Sign out) when signed in. Subscribes to Supabase
// `onAuthStateChange` so the UI updates without a refresh after callback.
export function AuthButton() {
  const t = useTranslations('Auth');

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signInOpen, setSignInOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setUser(data.user);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Other components (e.g. the save-parcel heart) ask the header to open the
  // sign-in modal via a custom event — keeps the modal a single instance.
  useEffect(() => {
    function onSignInRequest() {
      setSignInOpen(true);
    }
    window.addEventListener('landlens:signin', onSignInRequest);
    return () => window.removeEventListener('landlens:signin', onSignInRequest);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  async function signOut() {
    setMenuOpen(false);
    await fetch('/api/auth/signout', { method: 'POST' });
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    setUser(null);
    // Soft refresh so server components re-render with the cleared session.
    window.location.reload();
  }

  if (loading) {
    // Same footprint as the avatar/sign-in button so the header doesn't jump.
    return <div className="h-10 w-10 rounded-md bg-white/60 ring-1 ring-black/5" aria-hidden />;
  }

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSignInOpen(true)}
          className="pointer-events-auto flex h-10 items-center gap-1.5 rounded-md bg-white px-3 text-sm font-medium text-slate-700 shadow-md ring-1 ring-black/5 hover:bg-slate-50"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          <span>{t('signIn')}</span>
        </button>
        <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      </>
    );
  }

  const initials = initialsFor(user);

  return (
    <div ref={menuRef} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={t('accountMenuAria')}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white shadow-md ring-1 ring-black/5 hover:bg-accent/90"
      >
        {initials}
      </button>

      {menuOpen && (
        <div
          role="menu"
          className={clsx(
            'absolute top-12 z-40 w-56 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black/5',
            'right-0 rtl:right-auto rtl:left-0',
          )}
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-xs text-slate-500">{t('signedInAs')}</p>
            <p className="truncate text-sm font-medium text-slate-900">{user.email ?? '—'}</p>
          </div>
          <Link
            href="/saved"
            onClick={() => setMenuOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Bookmark className="h-4 w-4" aria-hidden /> {t('savedParcels')}
          </Link>
          <Link
            href="/settings"
            onClick={() => setMenuOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" aria-hidden /> {t('settings')}
          </Link>
          <button
            type="button"
            onClick={signOut}
            role="menuitem"
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" aria-hidden /> {t('signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

function initialsFor(user: User): string {
  const fromName = (user.user_metadata?.full_name as string | undefined) ?? '';
  const fromEmail = user.email ?? '';
  const source = fromName || fromEmail;
  if (!source) return '?';
  const parts = source.split(/[\s@.]/).filter(Boolean);
  if (parts.length === 0) return source[0]?.toUpperCase() ?? '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
