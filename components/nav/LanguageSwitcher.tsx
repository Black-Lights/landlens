'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Globe, Check } from 'lucide-react';
import { clsx } from 'clsx';

import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/config';

// Floating language switcher. Globe icon → dropdown with native-script labels.
// On selection, navigates to the same pathname under the new locale prefix.
// next-intl's middleware persists the choice via the NEXT_LOCALE cookie on the
// next response, so the choice survives a hard refresh.
export function LanguageSwitcher() {
  const t = useTranslations('LanguageSwitcher');
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function switchTo(next: Locale) {
    setOpen(false);
    if (next === currentLocale) return;
    // Persist on the client too — middleware also sets it on the response,
    // but doing both ensures the cookie is in place before the navigation
    // completes (so a quick refresh doesn't re-trigger detection).
    document.cookie = `NEXT_LOCALE=${next}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.replace(pathname, { locale: next });
  }

  return (
    <div ref={ref} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('ariaLabel')}
        title={t('label')}
        className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-slate-700 shadow-md ring-1 ring-black/5 hover:bg-slate-50"
      >
        <Globe className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('ariaLabel')}
          className={clsx(
            'absolute top-12 z-30 w-44 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black/5',
            // Anchor: in LTR drop down/right; in RTL drop down/left.
            'right-0 rtl:right-auto rtl:left-0',
          )}
        >
          {locales.map((loc) => {
            const isActive = loc === currentLocale;
            return (
              <button
                key={loc}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                lang={loc}
                dir={loc === 'ur' ? 'rtl' : 'ltr'}
                onClick={() => switchTo(loc)}
                className={clsx(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                  isActive ? 'bg-accent/10 text-accent' : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                <span className={loc === 'hi' ? 'font-devanagari' : loc === 'ur' ? 'font-nastaliq' : ''}>
                  {t(loc)}
                </span>
                {isActive && <Check className="h-4 w-4" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
