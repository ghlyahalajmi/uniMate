'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';
import { Icon } from '@/components/shell/icons';
import { cx } from '@/components/ui/primitives';
import type { StreakSummary } from '@/lib/momentum/queries';

/**
 * The streak, in the bar at the top of every page.
 *
 * It used to live only on Home, on Momentum and on the Hub board — three
 * screens, three different-looking widgets, and nothing at all on the other
 * ten. A student on Courses or Notes had no idea whether today was counted
 * yet, which is the one thing a streak is for.
 *
 * So: one figure, in one place, on every page, and a press away from the
 * screen that explains it. The number itself is not computed here — it comes
 * from the same `computeStreak` over the same `activity_days` rows the
 * Momentum screen reads, so the two cannot drift apart.
 */
export function StreakChip({ streak }: { streak: StreakSummary }) {
  const { t, tf, formatNumber } = useI18n();
  const lit = streak.current > 0;

  const label = !lit
    ? t.momentum.noStreak
    : streak.current === 1
      ? t.momentum.streakOne
      : tf(t.momentum.streakDays, { n: formatNumber(streak.current) });

  return (
    <Link
      href="/momentum"
      title={streak.atRisk ? t.momentum.atRiskBody : label}
      aria-label={label}
      className={cx(
        'inline-flex items-center gap-1 h-9 px-1.5 rounded-[var(--radius-sm)]',
        'text-sm font-semibold tabular-nums transition-colors',
        lit
          ? 'text-[var(--warning)] hover:bg-[var(--warning-soft)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--bg-inset)]',
        // A run with nothing logged today is the one state worth drawing
        // attention to: it is the only one the student can still change.
        streak.atRisk && 'ring-1 ring-[var(--warning-border)]',
      )}
    >
      <span aria-hidden="true" className={cx(!lit && 'opacity-60')}>
        <Icon.flame size={17} />
      </span>
      <span aria-hidden="true">{formatNumber(streak.current)}</span>
    </Link>
  );
}
