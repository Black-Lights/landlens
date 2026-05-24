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
        sans: ['Inter', 'system-ui', 'sans-serif'],
        devanagari: ['"Noto Sans Devanagari"', 'sans-serif'],
        nastaliq: ['"Noto Nastaliq Urdu"', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
