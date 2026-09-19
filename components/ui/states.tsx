'use client';

import { Card, Button, cx } from './primitives';

/**
 * Every empty state says what the screen is for and gives one way forward.
 * A blank page with no explanation is treated as a bug in this codebase.
 */
export function EmptyState({
  title, body, action, icon, compact,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        'text-center flex flex-col items-center',
        compact ? 'py-8 px-4' : 'py-14 px-6',
      )}
    >
      <div
        aria-hidden="true"
        className="w-14 h-14 rounded-[var(--radius-lg)] grid place-items-center mb-4 bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]"
      >
        {icon ?? <DefaultEmptyIcon />}
      </div>
      <h3 className="font-display text-lg font-semibold mb-1.5 text-balance-title">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-sm leading-relaxed">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function DefaultEmptyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 10v5.5c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ErrorState({
  message, onRetry, retryLabel = 'Try again',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <Card className="border-[var(--danger-border)] bg-[var(--danger-soft)]">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-[var(--danger)] text-lg leading-6">⚠</span>
        <div className="flex-1 min-w-0">
          <p role="alert" className="text-sm text-[var(--text-primary)]">{message}</p>
          {onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry} className="mt-3">
              {retryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/**
 * AI work can take several seconds, so the loader narrates the stage it is at
 * rather than spinning silently.
 */
export function AiThinking({ stages, className }: { stages: string[]; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-2.5 py-6', className)} role="status" aria-live="polite">
      {stages.map((stage, i) => (
        <div key={stage} className="flex items-center gap-2.5 text-sm">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse-soft shrink-0"
            style={{ animationDelay: `${i * 0.25}s` }}
            aria-hidden="true"
          />
          <span
            className={i === 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}
            style={{ opacity: 1 - i * 0.22 }}
          >
            {stage}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Shown wherever an AI feature would be, when no API key is configured. */
export function AiUnavailable({ title, body }: { title: string; body: string }) {
  return (
    <Card className="bg-[var(--warning-soft)] border-[var(--warning-border)]">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-[var(--warning)] text-lg leading-6">ⓘ</span>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-[0.8125rem] text-[var(--text-secondary)] mt-1 leading-relaxed">{body}</p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Marks a statement as either recorded fact or model suggestion. Used
 * everywhere the two could otherwise be confused.
 */
export function Provenance({
  kind, children, label,
}: {
  kind: 'fact' | 'suggestion';
  children: React.ReactNode;
  label: string;
}) {
  const fact = kind === 'fact';
  return (
    <div
      className={cx(
        'rounded-[var(--radius-md)] border p-3.5',
        fact
          ? 'bg-[var(--bg-surface-2)] border-[var(--border-subtle)]'
          : 'bg-[var(--bg-accent-soft)] border-[var(--border-subtle)]',
      )}
    >
      <p
        className={cx(
          'text-xs font-semibold uppercase tracking-wider mb-1.5',
          fact ? 'text-[var(--text-muted)]' : 'text-[var(--accent-soft-text)]',
        )}
      >
        {label}
      </p>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
