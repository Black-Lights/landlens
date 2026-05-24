import { Inter, Noto_Sans_Devanagari, Noto_Nastaliq_Urdu } from 'next/font/google';
import type { Locale } from './config';

// English (and as a fallback for Latin glyphs on every locale).
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Devanagari for Hindi. preload:false keeps the .woff2 out of English HTML;
// the @font-face is only present when the className is applied to <html>.
export const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-devanagari',
  display: 'swap',
  preload: false,
});

// Nastaliq for Urdu. Same locale-scoped strategy.
export const notoNastaliq = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-nastaliq',
  display: 'swap',
  preload: false,
});

export function localeFontClass(locale: Locale): string {
  switch (locale) {
    case 'hi':
      return `${inter.variable} ${notoDevanagari.variable} font-devanagari`;
    case 'ur':
      return `${inter.variable} ${notoNastaliq.variable} font-nastaliq`;
    case 'en':
    default:
      return `${inter.variable} font-sans`;
  }
}
