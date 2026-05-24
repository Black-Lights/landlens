'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Mail, X } from 'lucide-react';
import { clsx } from 'clsx';

import { supabaseBrowser } from '@/lib/supabase/client';

type Props = {
  open: boolean;
  onClose: () => void;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

export function SignInModal({ open, onClose }: Props) {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    if (!open) return;
    setStatus({ kind: 'idle' });
    setEmail('');
    // Focus the email field on open for keyboard-first sign-in.
    setTimeout(() => emailRef.current?.focus(), 80);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      setStatus({ kind: 'error', message: t('invalidEmail') });
      return;
    }
    setStatus({ kind: 'sending' });
    try {
      const supabase = supabaseBrowser();
      // `redirectTo` must match a URL registered in Supabase Auth settings.
      // We append `?next=` so the callback lands the user back on the locale
      // they signed in from (preserving any deep-link path).
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        },
      });
      if (error) throw error;
      setStatus({ kind: 'sent', email });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('genericError');
      setStatus({ kind: 'error', message });
    }
  }

  async function signInWithGoogle() {
    setStatus({ kind: 'sending' });
    try {
      const supabase = supabaseBrowser();
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        },
      });
      if (error) throw error;
      // Browser navigates to Google immediately on success — no further UI.
    } catch (err) {
      const message = err instanceof Error ? err.message : t('genericError');
      setStatus({ kind: 'error', message });
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('dialogAria')}
        lang={locale}
        className={clsx(
          'relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5',
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('closeAria')}
          className="absolute end-3 top-3 rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-semibold text-slate-900">{t('title')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>

        {status.kind === 'sent' ? (
          <div className="mt-5 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            <p className="font-medium">{t('linkSentTitle')}</p>
            <p className="mt-1">{t('linkSentBody', { email: status.email })}</p>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="mt-5 space-y-3">
            <label htmlFor="signin-email" className="block text-xs font-medium text-slate-700">
              {t('emailLabel')}
            </label>
            <input
              ref={emailRef}
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              type="submit"
              disabled={status.kind === 'sending'}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status.kind === 'sending' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {t('sendMagicLink')}
            </button>

            {status.kind === 'error' && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
                {status.message}
              </p>
            )}

            <div className="flex items-center gap-3 py-1 text-[11px] uppercase tracking-wider text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              <span>{t('or')}</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={status.kind === 'sending'}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleGlyph />
              {t('continueWithGoogle')}
            </button>
          </form>
        )}

        <p className="mt-5 text-[11px] leading-relaxed text-slate-400">{t('privacyNote')}</p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.53 1 10.22 1 12s.43 3.47 1.18 4.96l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
