'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';
import { cx } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icons';

/**
 * A single line on the dashboard: how long the run is, and whether today has
 * been claimed yet. Links through rather than duplicating the full picture.
 */
export function StreakStrip({
  current, atRisk, activeToday, level, xpToday, dailyCap,
}: {
  current: number;
  atRisk: boolean;
  activeToday: boolean;
  level: number;
  xpToday: number;
  dailyCap: number;
}) {
  const { t, tf, formatNumber } = useI18n();
  const lit = current > 0;

  return (
    <Link
      href="/momentum"
      className={cx(
        'flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] border transition-colors',
        'hover:border-[var(--border-strong)]',
        atRisk
          ? 'bg-[var(--warning-soft)] border-[var(--warning-border)]'
          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'w-10 h-10 shrink-0 grid place-items-center rounded-full',
          lit ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : 'bg-[var(--bg-inset)] text-[var(--text-muted)]',
        )}
      >
        <Icon.flame size={20} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {current === 0
            ? t.momentum.startToday
            : current === 1
              ? t.momentum.streakOne
              : tf(t.momentum.streakDays, { n: formatNumber(current) })}
        </span>
        <span className="block text-xs text-[var(--text-secondary)] mt-0.5">
          {atRisk
            ? t.momentum.atRiskBody
            : activeToday
              ? `${t.momentum.activeToday} · ${t.momentum.level} ${level}`
              : `${t.momentum.level} ${level} · ${formatNumber(xpToday)}/${formatNumber(dailyCap)} ${t.momentum.xp}`}
        </span>
      </span>

      <Icon.chevronEnd size={16} className="text-[var(--text-muted)] shrink-0 flip-rtl" />
    </Link>
  );
}
