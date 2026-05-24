export const locales = ['en', 'hi', 'ur'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

const rtlLocales: ReadonlySet<Locale> = new Set(['ur']);

export function isRtl(locale: Locale): boolean {
  return rtlLocales.has(locale);
}

// MapTiler streets-v2 supports a fixed language list. `hi` is shipped, `ur`
// is not — for Urdu we fall back to English Latin labels (which is what
// most Indian maps use anyway, and what MapTiler returns by default).
export function maptilerLanguage(locale: Locale): string | null {
  switch (locale) {
    case 'hi': return 'hi';
    case 'ur': return 'en';
    case 'en':
    default: return null;
  }
}
