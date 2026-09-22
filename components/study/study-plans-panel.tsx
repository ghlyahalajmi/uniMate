'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { AiThinking, EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';

export interface PlanCourse { id: string; code: string; name: string }

export interface SavedSession {
  id: string;
  courseCode: string | null;
  topic: string;
  scheduledOn: string;
  startTime: string | null;
  minutes: number | null;
  done: boolean;
}

export interface SavedPlan {
  id: string;
  title: string;
  goal: string | null;
  startsOn: string | null;
  endsOn: string | null;
  sessions: SavedSession[];
}

interface ProposedSession {
  courseId: string;
  materialId: string | null;
  topic: string;
  scheduledOn: string;
  startTime: string;
  minutes: number;
  reason: string;
}

interface Proposed {
  title: string;
  goal: string;
  notes: string[];
  sessions: ProposedSession[];
  courses: PlanCourse[];
}

type Phase = 'idle' | 'planning' | 'proposed' | 'error';

const HORIZONS = [14, 21, 30];

/**
 * Study plans: propose, approve, then live with.
 *
 * A plan the student has not agreed to is not in their week — the proposal is
 * shown in full, with the reason beside each session, and only approval writes
 * anything. Afterwards the sessions are theirs to move: a plan that cannot be
 * edited is one they abandon the first time a session lands badly, and then it
 * is a calendar full of things they did not do.
 */
export function StudyPlansPanel({
  courses, plans,
}: {
  courses: PlanCourse[];
  plans: SavedPlan[];
}) {
  const { t, tf, formatNumber, formatDate } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>('idle');
  const [picked, setPicked] = useState<string[]>([]);
  const [horizon, setHorizon] = useState(21);
  const [proposed, setProposed] = useState<Proposed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  async function propose() {
    setPhase('planning');
    setError(null);
    try {
      const res = await fetch('/api/ai/study-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courseIds: picked,
          horizonDays: horizon,
          // The student's own day, not the server's.
          todayIso: new Date().toLocaleDateString('en-CA'),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(
          data.error === 'rate_limited' ? tf(t.ai.rateLimited, { n: data.detail ?? '1' })
          : data.error === 'no_courses' ? t.studyAi.planEmpty
          : data.error === 'plan_empty' ? t.studyAi.planEmpty
          : t.errors.generic,
        );
        setPhase('error');
        return;
      }
      setProposed(data.plan as Proposed);
      setPhase('proposed');
    } catch {
      setError(t.errors.network);
      setPhase('error');
    }
  }

  async function approve() {
    if (!proposed) return;
    try {
      const res = await fetch('/api/ai/study-plan', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: proposed.title, goal: proposed.goal, sessions: proposed.sessions,
        }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(t.errors.generic); return; }
      toast.success(tf(t.studyAi.planSaved, { n: formatNumber(proposed.sessions.length) }));
      setProposed(null);
      setPhase('idle');
      router.refresh();
    } catch {
      toast.error(t.errors.network);
    }
  }

  async function moveSession(itemId: string, patch: { scheduledOn?: string; startTime?: string }) {
    try {
      const res = await fetch('/api/ai/study-plan', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId, ...patch }),
      });
      if (!(await res.json()).ok) { toast.error(t.errors.generic); return; }
      toast.success(t.studyAi.saved);
      router.refresh();
    } catch {
      toast.error(t.errors.network);
    }
  }

  async function removePlan(planId: string) {
    try {
      const res = await fetch('/api/ai/study-plan', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      if (!(await res.json()).ok) { toast.error(t.errors.generic); return; }
      toast.success(t.studyAi.planDeleted);
      router.refresh();
    } catch {
      toast.error(t.errors.network);
    }
  }

  const courseName = (id: string) => courses.find((c) => c.id === id)?.code ?? '';

  if (phase === 'planning') {
    return <Card><AiThinking stages={[t.studyAi.planning, t.studyAi.planProposed]} /></Card>;
  }

  if (phase === 'proposed' && proposed) {
    return (
      <div className="space-y-4">
        <Card className="bg-[var(--bg-accent-soft)] border-[var(--border-subtle)]">
          <CardHeader title={proposed.title} subtitle={proposed.goal} />
          <p className="text-sm text-[var(--text-secondary)]">{t.studyAi.planProposedSub}</p>
          {proposed.notes.length ? (
            <ul className="mt-2 space-y-1">
              {proposed.notes.map((n) => (
                <li key={n} className="text-xs text-[var(--text-secondary)]">· {n}</li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card>
          <CardHeader title={tf(t.studyAi.planSessions, { n: formatNumber(proposed.sessions.length) })} />
          <ul className="divide-y divide-[var(--border-subtle)]">
            {proposed.sessions.map((s, i) => (
              <li key={`${s.scheduledOn}-${s.startTime}-${i}`} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium min-w-0 truncate">{s.topic}</span>
                  <span className="text-xs tabular-nums text-[var(--text-muted)] shrink-0">
                    {formatDate(s.scheduledOn)} · {s.startTime} · {tf(t.studyAi.sessionMinutes, { n: formatNumber(s.minutes) })}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {courseName(s.courseId)} — {s.reason}
                </p>
              </li>
            ))}
          </ul>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => { setProposed(null); setPhase('idle'); }}>
              {t.studyAi.planDiscard}
            </Button>
            <Button onClick={() => void approve()}>
              <Icon.check size={17} />
              {t.studyAi.planApprove}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {phase === 'error' && error ? (
        <ErrorState message={error} onRetry={() => setPhase('idle')} retryLabel={t.common.retry} />
      ) : null}

      <Card>
        <CardHeader title={t.studyAi.planCourses} subtitle={t.studyAi.planCoursesSub} />
        <div className="flex flex-wrap gap-1.5">
          {courses.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])}
                className={cx(
                  'px-3 min-h-[36px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium border transition-colors',
                  on
                    ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
                )}
              >
                {c.code}
              </button>
            );
          })}
        </div>

        <fieldset className="mt-4">
          <legend className="text-[0.8125rem] font-medium mb-1.5">{t.studyAi.planHorizon}</legend>
          <div className="flex flex-wrap gap-1.5">
            {HORIZONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={horizon === d}
                onClick={() => setHorizon(d)}
                className={cx(
                  'px-3 min-h-[36px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium border transition-colors',
                  horizon === d
                    ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
                )}
              >
                {tf(t.studyAi.planDays, { n: formatNumber(d) })}
              </button>
            ))}
          </div>
        </fieldset>

        <Button className="mt-4" onClick={() => void propose()}>
          <Icon.sparkle size={17} />
          {t.studyAi.planNew}
        </Button>
      </Card>

      <Card>
        <CardHeader title={t.studyAi.plans} subtitle={t.studyAi.plansSub} />

        {plans.length === 0 ? (
          <EmptyState compact title={t.studyAi.planNone} body={t.studyAi.planNoneSub} icon={<Icon.calendar size={22} />} />
        ) : (
          <ul className="space-y-5">
            {plans.map((p) => (
              <li key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-[0.9375rem] font-semibold truncate">{p.title}</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {p.startsOn && p.endsOn
                        ? tf(t.studyAi.planRange, { from: formatDate(p.startsOn), to: formatDate(p.endsOn) })
                        : null}
                      {' · '}
                      {tf(t.studyAi.planSessions, { n: formatNumber(p.sessions.length) })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removePlan(p.id)}
                    aria-label={`${t.studyAi.planDelete}: ${p.title}`}
                    className="w-9 h-9 shrink-0 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <Icon.trash size={15} />
                  </button>
                </div>

                <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
                  {p.sessions.map((s) => (
                    <li key={s.id} className="py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className={cx('block text-sm truncate', s.done && 'line-through opacity-60')}>
                            {s.topic}
                          </span>
                          <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                            {s.courseCode ? `${s.courseCode} · ` : ''}
                            {formatDate(s.scheduledOn)}
                            {s.minutes ? ` · ${tf(t.studyAi.sessionMinutes, { n: formatNumber(s.minutes) })}` : ''}
                          </span>
                        </span>

                        <span className="flex items-center gap-1.5 shrink-0">
                          {editing === s.id ? (
                            <>
                              <input
                                type="date"
                                defaultValue={s.scheduledOn}
                                aria-label={t.studyAi.changeTime}
                                onChange={(e) => void moveSession(s.id, { scheduledOn: e.target.value })}
                                className="text-xs px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--bg-inset)] border border-[var(--border-subtle)]"
                              />
                              <input
                                type="time"
                                defaultValue={s.startTime?.slice(0, 5) ?? ''}
                                aria-label={t.studyAi.changeTime}
                                onChange={(e) => {
                                  if (e.target.value) void moveSession(s.id, { startTime: e.target.value });
                                }}
                                className="text-xs px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--bg-inset)] border border-[var(--border-subtle)]"
                              />
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditing(s.id)}
                              className="text-xs tabular-nums px-2 py-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-inset)]"
                              title={t.studyAi.changeTime}
                            >
                              {s.startTime?.slice(0, 5) ?? '--:--'}
                            </button>
                          )}

                          {s.done ? (
                            <Badge tone="positive">{t.studyAi.sessionDone}</Badge>
                          ) : null}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
