import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // LandLens accent — indigo (see CLAUDE_CODE_PROMPT §4)
        accent: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
        },
      },
      fontFamily: {
        // CSS variables provided by next/font/google in i18n/fonts.ts.
        // Each variable is only set on <html> when the locale-scoped class is
        // applied, so non-active fonts never ship.
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        devanagari: ['var(--font-devanagari)', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        nastaliq: ['var(--font-nastaliq)', '"Noto Nastaliq Urdu"', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
