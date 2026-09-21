'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, ProgressBar, cx } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import type { JourneyData } from '@/lib/coach/view';

/**
 * My Academic Journey.
 *
 * Four sections, in the order a student asks the questions:
 *   Level            — where am I?
 *   Progress         — what have I done, and how close am I to my goal?
 *   Today's Mission  — what do I do right now?
 *   Next Milestone   — what am I working toward?
 *
 * Everything rendered here arrives already computed from the student's own
 * records. This file formats; it never derives a figure of its own.
 */
export function JourneyView({ data }: { data: JourneyData }) {
  const { t, tf } = useI18n();

  return (
    <>
      <PageHeader title={t.journey.title} subtitle={t.journey.subtitle} />

      <CoachCard data={data} />

      <div className="flex flex-col gap-6">
        <LevelSection data={data} />
        <ProgressSection data={data} />
        <MissionSection data={data} />
        <MilestoneSection data={data} />
        <AchievementsSection data={data} />
      </div>

      <Celebration data={data} />

      <p className="sr-only">{tf(t.journey.momentumOutOf, { n: data.momentum.total })}</p>
    </>
  );
}

// --- 1. Level ----------------------------------------------------------------

function LevelSection({ data }: { data: JourneyData }) {
  const { t, tf } = useI18n();
  const level = data.level;
  const name = (t.journey as Record<string, string>)[`l${level.level}`] ?? '';

  return (
    <Card className="p-5">
      <SectionHead icon="trophy" title={t.journey.levelTitle} step={1} />

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
        <span className="text-2xl" aria-hidden="true">{level.emoji}</span>
        <h3 className="font-display text-xl font-semibold">
          {tf(t.journey.levelOf, { n: level.level })} — {name}
        </h3>
      </div>

      <ProgressBar
        value={Math.round(level.progress * 100)}
        label={t.journey.levelTitle}
        className="mt-3"
      />
      <p className="text-xs text-[var(--text-muted)] mt-1.5 tabular-nums">
        {Math.round(level.progress * 100)}%
      </p>

      {level.next ? (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">
            {tf(t.journey.toNextLevel, {
              name: (t.journey as Record<string, string>)[`l${level.next.level}`] ?? '',
            })}
          </p>
          <ul className="flex flex-col gap-1.5">
            {data.nextLevelSteps.map((step) => (
              <li key={step.key} className="text-sm flex items-start gap-2 text-[var(--text-secondary)]">
                <Icon.chevronEnd size={14} className="mt-1 shrink-0" />
                <span>
                  {step.key === 'sessions' ? tf(t.journey.stepSessions, { n: step.amount })
                    : step.key === 'tasks' ? tf(t.journey.stepTasks, { n: step.amount })
                    : tf(t.journey.stepStreak, { n: step.amount })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)] mt-3">{t.journey.atTopLevel}</p>
      )}

      {/* What the level is actually made of, so it is never a mystery number. */}
      <details className="mt-4 group">
        <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)] min-h-[32px] flex items-center">
          {t.journey.levelExplainer}
        </summary>
        <ul className="mt-3 flex flex-col gap-2">
          {level.breakdown.map((b) => (
            <li key={b.key} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs">
              <span className="text-[var(--text-secondary)]">
                {(t.journey as Record<string, string>)[signalKey(b.key)]}
              </span>
              <span className="tabular-nums text-[var(--text-muted)]">
                {Math.round(b.earned)} / {b.possible}
              </span>
              <ProgressBar
                value={b.possible > 0 ? (b.earned / b.possible) * 100 : 0}
                label={(t.journey as Record<string, string>)[signalKey(b.key)] ?? b.key}
                className="col-span-2"
              />
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function signalKey(key: string): string {
  return 'signal' + key.charAt(0).toUpperCase() + key.slice(1);
}

// --- 2. Progress -------------------------------------------------------------

function ProgressSection({ data }: { data: JourneyData }) {
  const { t, tf } = useI18n();
  const { graduation, gpa, momentum, week } = data;

  return (
    <Card className="p-5">
      <SectionHead icon="analytics" title={t.journey.progressTitle} step={2} />

      {/* Graduation */}
      <section className="mb-6">
        <h4 className="text-sm font-semibold mb-2">🎓 {t.journey.graduationTitle}</h4>
        <p className="text-lg font-display font-semibold tabular-nums">
          {tf(t.journey.creditsDone, {
            done: graduation.creditsCompleted, total: graduation.creditsRequired,
          })}
        </p>
        <ProgressBar
          value={graduation.percent}
          label={t.journey.graduationTitle}
          tone="positive"
          className="mt-2"
        />
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          {tf(t.journey.graduationLine, { percent: graduation.percent })}
        </p>
        {!data.degreeCreditsSet ? (
          <p className="text-xs text-[var(--text-muted)] mt-1.5">
            {tf(t.journey.creditsUnset, { total: graduation.creditsRequired })}
          </p>
        ) : null}
      </section>

      {/* GPA */}
      <section className="mb-6">
        <h4 className="text-sm font-semibold mb-2">{t.journey.gpaTitle}</h4>
        {gpa.current === null ? (
          <p className="text-sm text-[var(--text-muted)]">{t.journey.gpaNoData}</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-sm text-[var(--text-secondary)]">
                {t.journey.gpaCurrent}{' '}
                <strong className="text-[var(--text-primary)] tabular-nums text-base">
                  {gpa.current.toFixed(2)}
                </strong>
              </span>
              {gpa.target !== null ? (
                <span className="text-sm text-[var(--text-secondary)]">
                  {t.journey.gpaTarget}{' '}
                  <strong className="text-[var(--text-primary)] tabular-nums text-base">
                    {gpa.target.toFixed(2)}
                  </strong>
                </span>
              ) : null}
            </div>

            {/* Current position on the scale, with the target marked. */}
            <div className="relative h-2 rounded-full bg-[var(--bg-inset)] overflow-visible">
              <div
                className="absolute inset-y-0 start-0 rounded-full bg-[var(--accent)]"
                style={{ width: `${(gpa.currentFraction ?? 0) * 100}%` }}
              />
              {gpa.targetFraction !== null ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 w-0.5 h-4 bg-[var(--text-primary)] rounded-full"
                  style={{ insetInlineStart: `${gpa.targetFraction * 100}%` }}
                />
              ) : null}
            </div>

            <p className="text-sm text-[var(--text-secondary)] mt-2">
              {gpa.target === null ? t.journey.gpaNoTarget
                : gpa.reached ? t.journey.gpaReached
                : t.journey.gpaSupportive}
            </p>
          </>
        )}
      </section>

      {/* Academic Momentum */}
      <section className="mb-6">
        <h4 className="text-sm font-semibold mb-2">📈 {t.journey.momentumTitle}</h4>
        <p className="font-display text-3xl font-semibold tabular-nums">
          {momentum.total}
          <span className="text-base text-[var(--text-muted)] font-normal"> / 100</span>
        </p>
        <ProgressBar value={momentum.total} label={t.journey.momentumTitle} className="mt-2" />

        <ul className="mt-4 flex flex-col gap-2.5">
          {momentum.components.map((c) => (
            <li key={c.key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-center">
              <span className="text-sm text-[var(--text-secondary)]">
                {(t.journey as Record<string, string>)['momentum' + c.key.charAt(0).toUpperCase() + c.key.slice(1)]}
              </span>
              <span className="text-sm tabular-nums text-[var(--text-muted)]">
                {c.unmeasured ? '—' : `${c.score}%`}
              </span>
              <ProgressBar
                value={c.unmeasured ? 0 : c.score}
                tone={c.unmeasured ? 'neutral' : 'accent'}
                label={c.key}
                className="col-span-2"
              />
              {c.unmeasured ? (
                <span className="col-span-2 text-xs text-[var(--text-muted)]">
                  {t.journey.notMeasuredYet}
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">
          {t.journey.momentumExplainer}
        </p>
      </section>

      {/* This week */}
      <section className="mb-6">
        <h4 className="text-sm font-semibold mb-3">{t.journey.weekTitle}</h4>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat label={t.journey.weekStudyTime} value={formatMinutes(week.studyMinutes)} icon="clock" />
          <Stat label={t.journey.weekTasks} value={String(week.tasksCompleted)} icon="check" />
          <Stat label={t.journey.weekQuestions} value={String(data.questionsThisWeek)} icon="study" />
          <Stat label={t.journey.weekQuizzes} value={String(data.quizzesThisWeek)} icon="study" />
          <Stat label={t.journey.weekSessions} value={String(data.sessionsThisWeek)} icon="play" />
          <Stat label={t.journey.weekStreak} value={String(week.streak)} icon="flame" />
        </dl>
        <p className="text-sm text-[var(--text-secondary)] mt-3">
          {data.isFirstWeek ? t.journey.weekFirst
            : week.studyMinutesDelta > 0 ? tf(t.journey.weekUpMinutes, { n: week.studyMinutesDelta })
            : week.studyMinutesDelta === 0 ? t.journey.weekSameMinutes
            : t.journey.weekDownMinutes}
        </p>
      </section>

      {/* Streak */}
      <section className="mb-6">
        <h4 className="text-sm font-semibold mb-2">🔥 {t.journey.streakTitle}</h4>
        <p className="font-display text-2xl font-semibold tabular-nums">
          {week.streak === 1 ? t.journey.streakDay : tf(t.journey.streakDays, { n: week.streak })}
        </p>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5">
          {week.streak === 0 && data.longestStreak >= 3 ? t.journey.streakBrokenLine
            : week.streak === 0 ? t.journey.streakNone
            : data.streakAtRisk ? tf(t.journey.streakRisk, { n: week.streak })
            : week.streak >= 7 ? tf(t.journey.streakStrong, { n: week.streak })
            : `${t.journey.streakCurrent}: ${week.streak} · ${t.journey.streakLongest}: ${data.longestStreak}`}
        </p>
      </section>

      {/* Course health */}
      {data.courseHealth.length > 0 ? (
        <section>
          <h4 className="text-sm font-semibold mb-3">{t.journey.coursesTitle}</h4>
          <ul className="flex flex-col gap-2">
            {data.courseHealth.map((c) => (
              <li
                key={c.courseId}
                className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3"
              >
                <Badge tone={c.status === 'urgent' ? 'danger' : c.status === 'needs_attention' ? 'warning' : 'positive'}>
                  {c.status === 'urgent' ? t.journey.urgent
                    : c.status === 'needs_attention' ? t.journey.needsAttention
                    : t.journey.onTrack}
                </Badge>
                <strong className="text-sm">{c.code}</strong>
                <span className="text-sm text-[var(--text-secondary)] basis-full sm:basis-auto">
                  {healthCopy(t, tf, c)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Card>
  );
}

function healthCopy(
  t: ReturnType<typeof useI18n>['t'],
  tf: ReturnType<typeof useI18n>['tf'],
  c: JourneyData['courseHealth'][number],
): string {
  const j = t.journey as Record<string, string>;
  switch (c.reason) {
    case 'examSoonNoPlan':   return tf(j.healthExamSoonNoPlan, { days: c.detail.days ?? 0 });
    case 'lowQuizAverage':   return tf(j.healthLowQuizAverage, { percent: c.detail.percent ?? 0 });
    case 'gradeSlipping':    return tf(j.healthGradeSlipping, { percent: c.detail.percent ?? 0 });
    case 'tasksOutstanding': return tf(j.healthTasksOutstanding, { open: c.detail.open ?? 0 });
    case 'noData':           return j.healthNoData;
    case 'allGood':
      return c.detail.percent !== undefined
        ? tf(j.healthAllGood, { percent: c.detail.percent })
        : j.healthAllGoodPlain;
  }
}

// --- 3. Today's Mission ------------------------------------------------------

function MissionSection({ data }: { data: JourneyData }) {
  const { t, tf } = useI18n();

  return (
    <Card className="p-5">
      <SectionHead icon="tasks" title={t.journey.missionTitle} step={3} />

      {/* The single next best step, ahead of the list. */}
      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-accent-soft)] p-4 mb-4">
        <p className="text-xs font-medium text-[var(--accent-soft-text)] mb-1">
          🎯 {t.journey.nowSubtitle}
        </p>
        <p className="font-display text-lg font-semibold mb-1">{data.recommendationLabel}</p>
        <p className="text-sm text-[var(--text-secondary)] mb-3">{data.recommendationReason}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={recommendationHref(data)}
            className={
              'inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-4 min-h-[42px] ' +
              'text-sm font-medium bg-[var(--accent)] text-[var(--text-on-accent)] ' +
              'hover:bg-[var(--accent-hover)] shadow-[var(--shadow-card)]'
            }
          >
            <Icon.play size={14} /> {t.journey.startNow}
          </Link>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {tf(t.journey.minutes, { n: data.recommendationMinutes })}
          </span>
        </div>
      </div>

      {data.mission.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {data.missionAllDone ? t.journey.missionDone : t.journey.missionEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.mission.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3"
            >
              <span aria-hidden="true">
                {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}
              </span>
              <span className="sr-only">
                {task.priority === 'high' ? t.journey.priorityHigh
                  : task.priority === 'medium' ? t.journey.priorityMedium
                  : t.journey.priorityLow}
              </span>
              <span className="flex-1 min-w-0 text-sm font-medium break-words">{task.title}</span>
              {task.courseCode ? <Badge>{task.courseCode}</Badge> : null}
              {task.overdue ? <Badge tone="danger">{t.journey.overdueLabel}</Badge> : null}
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                {tf(t.journey.minutes, { n: task.minutes })}
              </span>
              <Link
                href="/tasks"
                className="text-xs font-medium text-[var(--accent)] hover:underline min-h-[32px] flex items-center px-1"
              >
                {t.journey.start}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}


/** Where "Start now" goes, per recommendation. Every target already exists. */
function recommendationHref(data: JourneyData): string {
  switch (data.recommendationKind) {
    case 'add_first_course': return '/courses';
    case 'log_grades':       return '/grades';
    case 'finish_overdue_task':
    case 'next_task':
    case 'keep_streak':      return '/tasks';
    case 'prepare_exam':     return '/planner';
    case 'practice_weak_topic':
    case 'practice_session':
    case 'review_flashcards': return '/study';
  }
}

// --- 4. Next Milestone -------------------------------------------------------

function MilestoneSection({ data }: { data: JourneyData }) {
  const { t } = useI18n();
  const next = data.nextMilestone;

  return (
    <Card className="p-5">
      <SectionHead icon="trophy" title={t.journey.milestoneTitle} step={4} />

      {!next ? (
        <p className="text-sm text-[var(--text-secondary)]">{t.journey.milestoneAllDone}</p>
      ) : (
        <>
          <p className="font-display text-lg font-semibold mb-2">
            🎯 {(t.journey as Record<string, string>)[`m_${next.code}`] ?? next.code}
          </p>
          <ProgressBar
            value={next.current}
            max={next.target}
            label={t.journey.milestoneTitle}
          />
          <p className="text-sm text-[var(--text-muted)] mt-2 tabular-nums">
            {next.current} / {next.target}
          </p>
        </>
      )}
    </Card>
  );
}

// --- Achievements ------------------------------------------------------------

function AchievementsSection({ data }: { data: JourneyData }) {
  const { t } = useI18n();
  if (!data.milestones.length) return null;

  return (
    <Card className="p-5">
      <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <Icon.trophy size={18} /> {t.journey.achievementsTitle}
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {data.milestones.map((m) => (
          <li
            key={m.code}
            className={cx(
              'flex items-center gap-3 rounded-[var(--radius-md)] border p-3',
              m.complete
                ? 'border-[var(--positive-border)] bg-[var(--positive-soft)]'
                : 'border-[var(--border-subtle)]',
            )}
          >
            <span aria-hidden="true" className="text-lg">{m.complete ? '✅' : '🔒'}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium break-words">
                {(t.journey as Record<string, string>)[`m_${m.code}`] ?? m.code}
              </span>
              <span className="block text-xs text-[var(--text-muted)] tabular-nums">
                {m.complete ? t.journey.unlocked : `${m.current} / ${m.target}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// --- AI coach ----------------------------------------------------------------

export function CoachCard({ data }: { data: JourneyData }) {
  const { t, tf } = useI18n();
  const [ai, setAi] = useState<{ message: string; reason: string } | null>(null);
  // Starts true because the request below fires on mount, so it is already in
  // flight by the time this first renders.
  const [loading, setLoading] = useState(true);

  // The deterministic line renders immediately; the written one replaces it if
  // and when it arrives, so a missing or slow model never delays the screen.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/coach', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.ok && d.message) setAi({ message: d.message, reason: d.reason ?? '' });
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const fallback = tf(
    (t.journey as Record<string, string>)[`msg_${data.coachKey}`] ?? '',
    data.coachValues,
  );

  return (
    <Card className="p-5 mb-6">
      <h2 className="font-display text-base font-semibold mb-2 flex items-center gap-2">
        <Icon.sparkle size={17} /> {t.journey.coachTitle}
      </h2>
      <p className="text-[0.9375rem] leading-relaxed text-[var(--text-primary)]">
        {ai?.message || fallback}
      </p>
      {ai?.reason ? (
        <p className="text-xs text-[var(--text-muted)] mt-2">
          {t.journey.coachWhy}: {ai.reason}
        </p>
      ) : null}
      {loading && !ai ? (
        <p className="text-xs text-[var(--text-muted)] mt-2">{t.journey.coachThinking}</p>
      ) : null}
    </Card>
  );
}

// --- Celebration -------------------------------------------------------------

function Celebration({ data }: { data: JourneyData }) {
  const { t } = useI18n();
  const router = useRouter();
  const pending = data.celebrate;
  const [open, setOpen] = useState(Boolean(pending));

  const dismiss = useCallback(async () => {
    setOpen(false);
    if (!pending) return;
    await fetch('/api/coach/celebrate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: pending.code }),
    }).catch(() => undefined);
    router.refresh();
  }, [pending, router]);

  if (!pending) return null;

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title={t.journey.celebrationTitle}
      description=""
      size="sm"
      footer={<Button onClick={dismiss}>{t.journey.celebrationContinue}</Button>}
    >
      <div className="text-center py-2">
        {/* Kept to a scale and fade so it stays cheap on a phone and is
            skipped entirely for anyone who asked for reduced motion. */}
        <div className="text-5xl mb-3 animate-celebrate" aria-hidden="true">
          🎉
        </div>
        <p className="font-display text-lg font-semibold mb-1">
          {(t.journey as Record<string, string>)[`m_${pending.code}`] ?? pending.code}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">{t.journey.celebrationBody}</p>
      </div>
    </Modal>
  );
}

// --- small pieces ------------------------------------------------------------

function SectionHead({ icon, title, step }: { icon: keyof typeof Icon; title: string; step: number }) {
  const Glyph = Icon[icon];
  return (
    <div className="flex items-center gap-2 mb-4">
      <span
        aria-hidden="true"
        className="grid place-items-center w-6 h-6 rounded-full bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] text-xs font-semibold tabular-nums"
      >
        {step}
      </span>
      <Glyph size={17} />
      <h2 className="font-display text-lg font-semibold">{title}</h2>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: keyof typeof Icon }) {
  const Glyph = Icon[icon];
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
      <dt className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
        <Glyph size={13} /> {label}
      </dt>
      <dd className="font-display text-lg font-semibold tabular-nums mt-0.5">{value}</dd>
    </div>
  );
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
