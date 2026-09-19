'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';
import { Card, CardHeader } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { StreakCard } from './streak-card';
import { ActivityHeatmap } from './heatmap';
import { AchievementsGrid } from './achievements-grid';
import { FocusTimer } from './focus-timer';
import { WrappedCard } from './wrapped-card';
import { XP_RULES, type LevelInfo, type MomentumTotals, type StreakInfo } from '@/lib/momentum/engine';
import type { AchievementCode } from '@/lib/momentum/achievements';
import type { WrappedData } from '@/lib/momentum/queries';

interface Cell { day: string; xp: number; intensity: 0 | 1 | 2 | 3 | 4; future: boolean }

export function MomentumView({
  enabled, streak, level, totals, heatmap, xpToday, achievements, wrapped, courses,
}: {
  enabled: boolean;
  streak: StreakInfo;
  level: LevelInfo;
  totals: MomentumTotals;
  heatmap: Cell[];
  xpToday: number;
  achievements: Array<{ code: AchievementCode; evidence: string | null; unlockedAt: string }>;
  wrapped: WrappedData;
  courses: Array<{ id: string; code: string; name: string }>;
}) {
  const { t, formatNumber } = useI18n();

  if (!enabled) {
    return (
      <>
        <PageHeader title={t.momentum.title} subtitle={t.momentum.subtitle} />
        <Card>
          <EmptyState
            title={t.momentum.disabled}
            body={t.momentum.disabledBody}
            icon={<Icon.flame size={24} />}
            action={
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 px-4 min-h-[42px] rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent)] text-[var(--text-on-accent)]"
              >
                <Icon.settings size={17} />
                {t.nav.settings}
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  const xpRows = [
    { label: t.momentum.xpTask, value: `+${XP_RULES.task}`, note: `+${XP_RULES.taskHighPriority} / +${XP_RULES.taskOnTime} ${t.momentum.xpTaskBonus}` },
    { label: t.momentum.xpPractice, value: `+${XP_RULES.practiceSession}`, note: `+${XP_RULES.perCorrectAnswer} ${t.momentum.xpPracticeBonus}` },
    { label: t.momentum.xpFocus, value: `+${XP_RULES.focusPerTenMinutes}`, note: null },
    { label: t.momentum.xpGrade, value: `+${XP_RULES.gradeLogged}`, note: null },
  ];

  return (
    <>
      <PageHeader title={t.momentum.title} subtitle={t.momentum.subtitle} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <StreakCard streak={streak} level={level} xpToday={xpToday} dailyCap={XP_RULES.dailyCap} />
          <ActivityHeatmap cells={heatmap} />

          <Card as="section">
            <CardHeader title={t.momentum.totalsTitle} />
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: t.momentum.activeDays, value: formatNumber(totals.activeDays) },
                { label: t.momentum.tasksDone, value: formatNumber(totals.tasksCompleted) },
                { label: t.momentum.practiceSets, value: formatNumber(totals.practiceSessions) },
                { label: t.momentum.questionsAnswered, value: formatNumber(totals.questionsAnswered) },
                { label: t.momentum.focusTime, value: `${formatNumber(Math.round(totals.focusMinutes / 6) / 10)}h` },
                { label: t.momentum.xpTotal, value: formatNumber(level.totalXp) },
              ].map((s) => (
                <div key={s.label} className="rounded-[var(--radius-md)] bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] p-3">
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <span className="block font-display text-2xl font-semibold tabular-nums leading-none">{s.value}</span>
                    <span className="block text-xs text-[var(--text-muted)] mt-1.5 leading-tight">{s.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <WrappedCard data={wrapped} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <FocusTimer courses={courses} />
          <AchievementsGrid earned={achievements} />

          {/* The rules, stated plainly. A points system you cannot predict is
              a slot machine, not a habit tool. */}
          <Card as="section">
            <CardHeader title={t.momentum.howItCounts} />
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {t.momentum.howItCountsBody}
            </p>

            <p className="text-[0.8125rem] font-semibold mt-4 mb-2">{t.momentum.howXpWorks}</p>
            <ul className="space-y-2">
              {xpRows.map((r) => (
                <li key={r.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block">{r.label}</span>
                    {r.note ? <span className="block text-xs text-[var(--text-muted)]">{r.note}</span> : null}
                  </span>
                  <span className="tabular-nums font-medium text-[var(--accent-soft-text)] shrink-0">{r.value}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--text-muted)] mt-3 pt-3 border-t border-[var(--border-subtle)]">
              {t.momentum.dailyCap.replace('{n}', String(XP_RULES.dailyCap))}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
