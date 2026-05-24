import { type ReactNode } from 'react';
import { clsx } from 'clsx';

type Variant = 'neutral' | 'accent' | 'land' | 'source';

const VARIANTS: Record<Variant, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  accent:  'bg-accent/10 text-accent ring-accent/20',
  land:    'text-white ring-black/10',
  source:  'bg-amber-50 text-amber-800 ring-amber-200',
};

type Props = {
  children: ReactNode;
  variant?: Variant;
  /** Inline background for the `land` variant (driven by LAND_TYPE_COLORS). */
  style?: React.CSSProperties;
  className?: string;
};

export function Badge({ children, variant = 'neutral', style, className }: Props) {
  return (
    <span
      style={style}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
