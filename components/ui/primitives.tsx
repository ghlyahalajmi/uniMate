'use client';

import { forwardRef } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// --- Button ------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-sm)] ' +
  'transition-[background,color,box-shadow,transform] duration-150 ' +
  'disabled:opacity-55 disabled:pointer-events-none select-none ' +
  'active:translate-y-px whitespace-nowrap';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[var(--shadow-card)] hover:bg-[var(--accent-hover)]',
  secondary:
    'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] ' +
    'hover:bg-[var(--bg-surface-2)] hover:border-[var(--border-strong)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]',
  danger:
    'bg-[var(--danger)] text-white hover:brightness-110 shadow-[var(--shadow-card)]',
  accent:
    'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border border-[var(--border-subtle)] hover:brightness-[0.97]',
};

// Minimum 40px tall so every control is a comfortable thumb target.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'text-[0.8125rem] px-3 min-h-[36px]',
  md: 'text-sm px-4 min-h-[42px]',
  lg: 'text-[0.9375rem] px-5 min-h-[48px]',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Text announced and shown while `loading` is true. */
  loadingLabel?: string;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, loadingLabel, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size],
        fullWidth && 'w-full', className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={15} /> : null}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
});

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={cx('animate-spin shrink-0', className)} aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.22" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// --- Card --------------------------------------------------------------------

export function Card({
  children, className, as: Tag = 'div', padded = true, interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
  padded?: boolean;
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cx(
        'bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)]',
        'shadow-[var(--shadow-card)]',
        padded && 'p-4 sm:p-5',
        interactive && 'transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title, subtitle, action, className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex items-start justify-between gap-3 mb-4', className)}>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold leading-tight text-balance-title">{title}</h2>
        {subtitle ? (
          <p className="text-[0.8125rem] text-[var(--text-secondary)] mt-1">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// --- Badge -------------------------------------------------------------------

type Tone = 'neutral' | 'accent' | 'positive' | 'warning' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'bg-[var(--bg-inset)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
  accent: 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--border-subtle)]',
  positive: 'bg-[var(--positive-soft)] text-[var(--positive)] border-[var(--positive-border)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning-border)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger-border)]',
};

export function Badge({
  children, tone = 'neutral', className, icon,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border',
        'text-xs font-medium leading-5 whitespace-nowrap',
        TONES[tone], className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * Status is carried by the label, an icon glyph and the colour together —
 * never by colour alone.
 */
export function StatusDot({ tone = 'neutral' }: { tone?: Tone }) {
  const colour = {
    neutral: 'var(--text-muted)',
    accent: 'var(--accent)',
    positive: 'var(--positive)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
  }[tone];
  return (
    <span
      aria-hidden="true"
      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{ background: colour }}
    />
  );
}

// --- Progress ----------------------------------------------------------------

export function ProgressBar({
  value, max = 100, tone = 'accent', label, className, showValue = false,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  label: string;
  className?: string;
  showValue?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const colour = {
    neutral: 'var(--text-muted)',
    accent: 'var(--accent)',
    positive: 'var(--positive)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
  }[tone];

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-2 w-full rounded-full overflow-hidden bg-[var(--bg-inset)]"
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: colour }}
        />
      </div>
      {showValue ? (
        <p className="text-xs text-[var(--text-muted)] mt-1 tabular-nums">{Math.round(pct)}%</p>
      ) : null}
    </div>
  );
}

// --- Skeleton ----------------------------------------------------------------

export function Skeleton({ className, rounded = 'sm' }: { className?: string; rounded?: 'sm' | 'md' | 'full' }) {
  return (
    <div
      className={cx(
        'skeleton',
        rounded === 'full' ? 'rounded-full' : rounded === 'md' ? 'rounded-[var(--radius-md)]' : '',
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <Card>
      <Skeleton className="h-4 w-1/3 mb-3" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-4/5" />
    </Card>
  );
}
