// LandLens mark — inline SVG so strokes can inherit `currentColor` and
// so there's no extra network request on first paint.
// See docs/16-brand-guidelines.md.

import { clsx } from 'clsx';

type Variant = 'full' | 'icon';
type Theme = 'light' | 'dark' | 'auto';

interface LogoProps {
  variant?: Variant;
  /** light — for dark backgrounds (white strokes). dark — for light backgrounds
   *  (slate-900 strokes). auto — follows the user's color scheme via Tailwind dark:. */
  theme?: Theme;
  className?: string;
  title?: string;
}

const THEME_CLASS: Record<Theme, string> = {
  light: 'text-white',
  dark: 'text-slate-900',
  auto: 'text-slate-900 dark:text-white',
};

export default function Logo({ variant = 'full', theme = 'auto', className, title = 'LandLens' }: LogoProps) {
  const themeClass = THEME_CLASS[theme];
  if (variant === 'icon') return <LogoIcon className={clsx(themeClass, className)} title={title} />;
  return <LogoFull className={clsx(themeClass, className)} title={title} />;
}

function LogoFull({ className, title }: { className?: string; title: string }) {
  return (
    <svg
      className={className}
      width="240"
      height="64"
      viewBox="0 0 240 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <g>
        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <clipPath id="ll-clip-full">
          <circle cx="32" cy="32" r="28" />
        </clipPath>
        <g clipPath="url(#ll-clip-full)" stroke="currentColor" fill="none">
          <path d="M 0 20 L 64 20" strokeWidth="2" />
          <path d="M 0 44 L 64 44" strokeWidth="2" />
          <path d="M 20 0 L 20 64" strokeWidth="2" />
          <path d="M 44 0 L 44 64" strokeWidth="2" />
          <rect x="20" y="20" width="24" height="24" fill="#2563EB" opacity="0.18" stroke="none" />
          <rect x="20" y="20" width="24" height="24" stroke="#2563EB" strokeWidth="2" />
          <circle cx="32" cy="29" r="2.5" fill="#2563EB" stroke="none" />
        </g>
      </g>
      <text
        x="74"
        y="42"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="28"
        fontWeight="500"
        fill="currentColor"
        letterSpacing="-0.02em"
      >
        Land
        <tspan fontWeight="400" opacity="0.55">
          Lens
        </tspan>
      </text>
    </svg>
  );
}

function LogoIcon({ className, title }: { className?: string; title: string }) {
  return (
    <svg
      className={className}
      width="64"
      height="64"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <clipPath id="ll-clip-icon">
        <circle cx="32" cy="32" r="28" />
      </clipPath>
      <g clipPath="url(#ll-clip-icon)" stroke="currentColor" fill="none">
        <path d="M 0 20 L 64 20" strokeWidth="2" />
        <path d="M 0 44 L 64 44" strokeWidth="2" />
        <path d="M 20 0 L 20 64" strokeWidth="2" />
        <path d="M 44 0 L 44 64" strokeWidth="2" />
        <rect x="20" y="20" width="24" height="24" fill="#2563EB" opacity="0.18" stroke="none" />
        <rect x="20" y="20" width="24" height="24" stroke="#2563EB" strokeWidth="2" />
        <circle cx="32" cy="29" r="2.5" fill="#2563EB" stroke="none" />
      </g>
    </svg>
  );
}
