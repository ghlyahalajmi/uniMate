'use client';

import { cx } from '@/components/ui/primitives';

export function PageHeader({
  title, subtitle, action, className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-wrap items-start justify-between gap-3 mb-6', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-2xl sm:text-[1.75rem] font-semibold leading-tight text-balance-title">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-[var(--text-secondary)] mt-1.5 max-w-prose">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 flex gap-2">{action}</div> : null}
    </div>
  );
}
