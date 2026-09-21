'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';
import { Card, CardHeader, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icons';
import type { Weekday } from '@/lib/groups/availability';

export interface StreakDay {
  /** Weekday key, for the label. */
  day: Weekday;
  /** The day earned XP: a task finished, a set practised, focus logged. */
  active: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface StreakBoardData {
  current: number;
  longest: number;
  atRisk: boolean;
  activeToday: boolean;
  level: number;
  week: StreakDay[];
  tasksCompleted: number;
  studyMinutes: number;
  activeDays: number;
  /** The next round number worth reaching, and how far off it is. */
  milestone: { target: number; toGo: number } | null;
}

/**
 * The streak, as a week rather than a number.
 *
 * A single figure tells a student whether they are winning; seven dots tell
 * them what happened, which is the thing that changes tomorrow. Every dot is
 * read from `activity_days` — a day counts when it earned XP, exactly as the
 * momentum engine counts it — so nothing here is a decoration with no record
 * behind it.
 *
 * Today's dot is drawn differently while it is unclaimed: it is the one the
 * student can still do something about.
 */
export function StreakBoard({ data }: { data: StreakBoardData }) {
  const { t, tf, formatNumber } = useI18n();
  const lit = data.current > 0;

  return (
    <Card className={cx(
      'relative overflow-hidden',
      data.atRisk && 'border-[var(--warning-border)]',
    )}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -end-16 w-56 h-40 rounded-full opacity-30"
        style={{
          background: `radial-gradient(circle, var(--${lit ? 'warning' : 'accent'}) 0%, transparent 70%)`,
        }}
      />

      <div className="relative">
        <CardHeader
          title={t.momentum.streak}
          subtitle={data.atRisk ? t.momentum.atRiskBody : t.momentum.subtitle}
          action={
            <Link
              href="/momentum"
              className="inline-flex items-center gap-1.5 min-h-[32px] text-[0.8125rem] font-medium text-[var(--accent-soft-text)] hover:underline"
            >
              {t.common.viewAll}
              <Icon.chevronEnd size={14} className="flip-rtl" />
            </Link>
          }
        />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {/* The number, with the flame lit only when the run is alive. */}
          <p className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={cx(
                'grid place-items-center w-11 h-11 rounded-full',
                lit
                  ? 'bg-[var(--warning-soft)] text-[var(--warning)] animate-pop'
                  : 'bg-[var(--bg-inset)] text-[var(--text-muted)]',
              )}
            >
              <Icon.flame size={22} />
            </span>
            <span>
              <span className="block font-display text-2xl font-semibold leading-none tabular-nums">
                {formatNumber(data.current)}
              </span>
              <span className="block text-xs text-[var(--text-secondary)] mt-1">
                {data.current === 1 ? t.momentum.streakOne : t.momentum.streakDaysShort}
              </span>
            </span>
          </p>

          <Figure label={t.momentum.longest} value={formatNumber(data.longest)} />
          <Figure label={t.momentum.tasksDone} value={formatNumber(data.tasksCompleted)} />
          <Figure
            label={t.momentum.focusTime}
            value={tf(t.momentum.hours, {
              n: formatNumber(Math.round((data.studyMinutes / 60) * 10) / 10),
            })}
          />
          <Figure label={t.momentum.activeDays} value={formatNumber(data.activeDays)} />
        </div>

        {/* The week ------------------------------------------------------- */}
        <ul className="flex items-end justify-between gap-1.5 mt-5">
          {data.week.map((d) => (
            <li key={d.day} className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cx(
                  'w-full h-9 rounded-[var(--radius-sm)] border transition-colors duration-200',
                  d.active
                    ? 'bg-[var(--warning-soft)] border-[var(--warning-border)]'
                    : d.isFuture
                      ? 'bg-transparent border-dashed border-[var(--border-subtle)]'
                      : 'bg-[var(--bg-inset)] border-[var(--border-subtle)]',
                  d.isToday && 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-surface)]',
                )}
              >
                {d.active ? (
                  <span className="grid place-items-center h-full text-[var(--warning)]">
                    <Icon.flame size={15} />
                  </span>
                ) : null}
              </span>
              <span
                className={cx(
                  'text-xs truncate max-w-full',
                  d.isToday ? 'font-semibold text-[var(--accent-soft-text)]' : 'text-[var(--text-muted)]',
                )}
              >
                {t.weekdaysShort[d.day]}
              </span>
              <span className="sr-only">
                {d.active ? t.momentum.dayActive : t.momentum.dayQuiet}
              </span>
            </li>
          ))}
        </ul>

        {/* What is next --------------------------------------------------- */}
        {data.milestone ? (
          <div className="mt-4 pt-3.5 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between gap-3 text-[0.8125rem]">
              <span className="min-w-0">
                {tf(t.momentum.nextMilestone, {
                  n: formatNumber(data.milestone.target),
                  toGo: formatNumber(data.milestone.toGo),
                })}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                {formatNumber(data.current)}/{formatNumber(data.milestone.target)}
              </span>
            </div>
            <div
              aria-hidden="true"
              className="mt-2 h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden"
            >
              <span
                className="block h-full rounded-full bg-[var(--warning)] transition-[width] duration-500 ease-out"
                style={{ width: `${Math.min(100, (data.current / data.milestone.target) * 100)}%` }}
              />
            </div>
          </div>
        ) : null}

        {!data.activeToday ? (
          <p className="text-xs text-[var(--text-muted)] mt-3">{t.momentum.claimToday}</p>
        ) : null}
      </div>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0">
      <span className="block font-display text-lg font-semibold leading-none tabular-nums">{value}</span>
      <span className="block text-xs text-[var(--text-muted)] mt-1 truncate">{label}</span>
    </p>
  );
}
