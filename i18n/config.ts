export const locales = ['en', 'hi', 'ur'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

const rtlLocales: ReadonlySet<Locale> = new Set(['ur']);

export function isRtl(locale: Locale): boolean {
  return rtlLocales.has(locale);
}
