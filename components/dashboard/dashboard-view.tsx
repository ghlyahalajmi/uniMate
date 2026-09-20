'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Card, CardHeader, ProgressBar, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { InsightPanel } from './insight-panel';
import { StreakStrip } from './streak-strip';
import { XP_RULES } from '@/lib/momentum/engine';

interface ClassRow { id: string; code: string; name: string; start: string | null; end: string | null; room: string | null }
interface TaskRow { id: string; title: string; priority: string; status: string; courseCode: string | null; overdue: boolean; source: string }
interface UpcomingRow { key: string; title: string; date: string; courseCode: string | null; weight: number | null; kind: string; days: number }
interface ProgressRow {
  id: string; code: string; name: string;
  current: number | null; currentLetter: string | null;
  target: string | null; required: number | null; verdict: string; remainingWeight: number;
}

export function DashboardView({
  name, isDemo, hasAnyCourse, todayClasses, todayTasks, openTaskCount,
  upcoming, snapshot, progress, momentum, focus, greetingFallback,
}: {
  name: string | null;
  isDemo: boolean;
  hasAnyCourse: boolean;
  todayClasses: ClassRow[];
  todayTasks: TaskRow[];
  openTaskCount: number;
  upcoming: UpcomingRow[];
  snapshot: {
    cumulativeGpa: number | null; targetGpa: number | null;
    semesterGpa: number | null; creditsCompleted: number; activeCourses: number;
  };
  focus: {
    title: string; courseCode: string | null; minutes: number;
    reason: 'overdue' | 'today' | 'class' | 'exam'; days: number | null;
  } | null;
  progress: ProgressRow[];
  momentum: { current: number; atRisk: boolean; activeToday: boolean; level: number; xpToday: number } | null;
  greetingFallback: string;
}) {
  const { t, tf, formatTime, formatNumber } = useI18n();

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t.dashboard.goodMorning
    : hour < 18 ? t.dashboard.goodAfternoon
    : t.dashboard.goodEvening;

  const firstName = name?.split(' ')[0] ?? null;

  // A brand-new account gets an explanation and two ways in, never a blank page.
  if (!hasAnyCourse) {
    return (
      <>
        <PageHeader title={`${greeting || greetingFallback}${firstName ? `, ${firstName}` : ''}.`} />
        <Card>
          <EmptyState
            title={t.dashboard.firstRunTitle}
            body={t.dashboard.firstRunBody}
            action={
              <div className="flex flex-wrap gap-2 justify-center">
                <Link
                  href="/courses/scan"
                  className="inline-flex items-center gap-2 px-4 min-h-[42px] rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)]"
                >
                  <Icon.camera size={17} />
                  {t.dashboard.firstRunUpload}
                </Link>
                <Link
                  href="/courses?new=1"
                  className="inline-flex items-center gap-2 px-4 min-h-[42px] rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                >
                  <Icon.plus size={17} />
                  {t.dashboard.firstRunAdd}
                </Link>
              </div>
            }
          />
        </Card>
      </>
    );
  }

  const classCount = todayClasses.length === 1
    ? t.dashboard.classCount_one
    : tf(t.dashboard.classCount_other, { n: todayClasses.length });
  const taskCount = openTaskCount === 1
    ? t.dashboard.taskCount_one
    : tf(t.dashboard.taskCount_other, { n: openTaskCount });

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-[1.75rem] font-semibold leading-tight">
          {greeting}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5">
          {tf(t.dashboard.summary, { classes: classCount, tasks: taskCount })}
        </p>
        {isDemo ? (
          <Badge tone="warning" className="mt-2.5">{t.common.demoData}</Badge>
        ) : null}
      </div>

      {momentum ? (
        <div className="mb-5">
          <StreakStrip {...momentum} dailyCap={XP_RULES.dailyCap} />
        </div>
      ) : null}

      {/* Snapshot ---------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat
          label={t.dashboard.cumulativeGpa}
          value={snapshot.cumulativeGpa === null ? '—' : gpa(snapshot.cumulativeGpa, formatNumber)}
          sub={snapshot.targetGpa === null ? undefined : gpa(snapshot.targetGpa, formatNumber)}
          subLabel={t.dashboard.targetGpa}
        />
        <Stat
          label={t.dashboard.semesterGpa}
          value={snapshot.semesterGpa === null ? '—' : gpa(snapshot.semesterGpa, formatNumber)}
          note={t.grades.projectedNote}
        />
        <Stat label={t.dashboard.creditsCompleted} value={formatNumber(snapshot.creditsCompleted)} />
        <Stat label={t.dashboard.activeCourses} value={formatNumber(snapshot.activeCourses)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          {/* Today's focus -------------------------------------------------- */}
          <Card className="relative overflow-hidden bg-[var(--bg-accent-soft)] border-[var(--border-subtle)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 -end-16 w-44 h-44 rounded-full opacity-40"
              style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
            />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-soft-text)]">
                {t.dashboard.todayFocus}
              </p>

              {focus === null ? (
                <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
                  {t.dashboard.focusNone}
                </p>
              ) : (
                <>
                  <p className="font-display text-lg font-semibold mt-1.5 text-balance-title">
                    {focus.courseCode ? `${focus.courseCode} — ` : ''}{focus.title}
                  </p>
                  <ul className="flex flex-wrap gap-1.5 mt-2.5">
                    <li>
                      <Badge tone={focus.reason === 'overdue' ? 'danger' : 'neutral'}>
                        {focus.reason === 'overdue' ? t.dashboard.focusReasonOverdue
                          : focus.reason === 'today' ? t.dashboard.focusReasonTask
                            : focus.reason === 'class' ? t.dashboard.focusReasonClass
                              : tf(t.dashboard.focusReasonExam, { n: formatNumber(focus.days ?? 0) })}
                      </Badge>
                    </li>
                    <li>
                      <Badge tone="accent" icon={<Icon.clock size={12} />}>
                        {tf(t.dashboard.focusMinutes, { n: formatNumber(focus.minutes) })}
                      </Badge>
                    </li>
                  </ul>
                </>
              )}
            </div>
          </Card>

          {/* Today's classes ---------------------------------------------- */}
          <Card>
            <CardHeader title={t.dashboard.todayClasses} />
            {todayClasses.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{t.dashboard.noClassesToday}</p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)] -mx-1">
                {todayClasses.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/courses/${c.id}`}
                      className="flex items-center gap-3 py-2.5 px-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-inset)] transition-colors"
                    >
                      <span className="tabular-nums text-sm font-semibold text-[var(--accent)] w-12 shrink-0">
                        {c.start ? formatTime(c.start) : '—'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">
                          {c.code} · {c.name}
                        </span>
                        <span className="block text-xs text-[var(--text-muted)]">
                          {c.end ? formatTime(c.end) : ''}{c.room ? ` · ${c.room}` : ''}
                        </span>
                      </span>
                      <Icon.chevronEnd size={16} className="text-[var(--text-muted)] shrink-0 flip-rtl" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Grade progress ------------------------------------------------ */}
          <Card>
            <CardHeader
              title={t.dashboard.gradeProgress}
              action={
                <Link href="/grades" className="inline-flex items-center min-h-[32px] text-[0.8125rem] text-[var(--accent-soft-text)] hover:underline">
                  {t.common.viewAll}
                </Link>
              }
            />
            {progress.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{t.grades.empty}</p>
            ) : (
              <ul className="space-y-4">
                {progress.map((p) => {
                  const tone =
                    p.verdict === 'impossible' ? 'danger'
                    : p.verdict === 'already_achieved' ? 'positive'
                    : p.required !== null && p.required > 90 ? 'warning'
                    : 'accent';
                  return (
                    <li key={p.id}>
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        {/* min-h keeps this a thumb-sized target; a bare text
                            link here measured 20px tall. */}
                        <Link
                          href={`/courses/${p.id}`}
                          className="inline-flex items-center min-h-[32px] text-sm font-medium hover:underline truncate"
                        >
                          {p.code}
                        </Link>
                        <span className="text-[0.8125rem] tabular-nums text-[var(--text-secondary)] shrink-0">
                          {p.current === null ? t.grades.notCompleted : `${formatNumber(p.current)}%`}
                          {p.currentLetter ? ` · ${p.currentLetter}` : ''}
                          {p.target ? ` → ${p.target}` : ''}
                        </span>
                      </div>
                      <ProgressBar
                        value={p.current ?? 0}
                        label={`${p.code} ${t.dashboard.currentGrade}`}
                        tone={tone}
                      />
                      <p className="text-xs text-[var(--text-muted)] mt-1.5">
                        {p.verdict === 'impossible'
                          ? t.grades.impossible
                          : p.verdict === 'already_achieved'
                            ? t.grades.achieved
                            : p.verdict === 'no_remaining_assessments'
                              ? t.grades.nothingLeft
                              : p.required !== null
                                ? `${t.dashboard.needed}: ${formatNumber(p.required)}%`
                                : t.grades.pickTarget}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5 min-w-0">
          <InsightPanel />

          {/* Today's tasks -------------------------------------------------- */}
          <Card>
            <CardHeader
              title={t.dashboard.todayTasks}
              action={
                <Link href="/tasks" className="inline-flex items-center min-h-[32px] text-[0.8125rem] text-[var(--accent-soft-text)] hover:underline">
                  {t.common.viewAll}
                </Link>
              }
            />
            {todayTasks.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{t.dashboard.noTasksToday}</p>
            ) : (
              <ul className="space-y-2.5">
                {todayTasks.map((tk) => (
                  <li key={tk.id} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className={cx(
                        'mt-[5px] w-2 h-2 rounded-full shrink-0',
                        tk.overdue ? 'bg-[var(--danger)]'
                        : tk.priority === 'high' ? 'bg-[var(--warning)]'
                        : 'bg-[var(--border-strong)]',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug">{tk.title}</span>
                      <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {tk.courseCode ? (
                          <span className="text-xs text-[var(--text-muted)]">{tk.courseCode}</span>
                        ) : null}
                        {tk.overdue ? (
                          <span className="text-xs text-[var(--danger)]">{t.common.overdue}</span>
                        ) : null}
                        {tk.source === 'ai' ? (
                          <span className="text-xs text-[var(--accent-soft-text)]">{t.common.ai}</span>
                        ) : null}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Upcoming ------------------------------------------------------- */}
          <Card>
            <CardHeader title={t.dashboard.upcoming} />
            {upcoming.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{t.dashboard.nothingUpcoming}</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((u) => (
                  <li key={u.key} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm leading-snug truncate">{u.title}</span>
                      <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                        {u.courseCode ? `${u.courseCode} · ` : ''}
                        {u.weight ? `${u.weight}% · ` : ''}
                        {u.days === 0 ? t.common.today : u.days === 1 ? t.common.tomorrow : tf(t.common.inDays, { n: u.days })}
                      </span>
                    </span>
                    <Badge tone={u.days <= 3 ? 'danger' : u.days <= 7 ? 'warning' : 'neutral'} className="shrink-0">
                      {u.days}{' '}{u.days === 1 ? t.common.day : t.common.days}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({
  label, value, note, sub, subLabel,
}: {
  label: string;
  value: string;
  /** Announced but not drawn — for context a sighted reader gets from layout. */
  note?: string;
  /** A second figure shown beside the first, such as the GPA you are aiming at. */
  sub?: string;
  /** What `sub` means, announced rather than drawn, since the arrow carries it visually. */
  subLabel?: string;
}) {
  return (
    <Card padded={false} className="p-3.5">
      <p className="font-display text-2xl sm:text-[1.75rem] font-semibold tabular-nums leading-none">
        {value}
        {sub ? (
          <span className="text-base font-medium text-[var(--text-muted)] ms-1.5">
            <span aria-hidden="true">→ </span>
            {subLabel ? <span className="sr-only">{subLabel} </span> : null}
            {sub}
          </span>
        ) : null}
      </p>
      <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-tight">{label}</p>
      {note ? <p className="sr-only">{note}</p> : null}
    </Card>
  );
}

/** Two decimals, in the reader's numerals. */
function gpa(value: number, formatNumber: ReturnType<typeof useI18n>['formatNumber']): string {
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
