'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, ProgressBar, cx } from '@/components/ui/primitives';
import { AiThinking, AiUnavailable, EmptyState, ErrorState } from '@/components/ui/states';
import { SegmentedControl, TextInput } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import type { Question } from '@/types/database';

type Mode = 'quick_5' | 'standard_10' | 'deep_20' | 'exam_mode';
type Difficulty = 'easy' | 'medium' | 'hard' | 'adaptive';
type Phase = 'setup' | 'generating' | 'answering' | 'results' | 'error';

interface HistoryRow {
  id: string; courseCode: string | null; topic: string | null;
  score: number | null; correct: number; total: number; completedAt: string;
}

interface Answered { questionId: string; given: string; correct: boolean; topic: string | null }

export function StudyView({
  aiEnabled, courses, initialCourseId, history,
}: {
  aiEnabled: boolean;
  courses: Array<{ id: string; code: string; name: string }>;
  initialCourseId: string;
  history: HistoryRow[];
}) {
  const { t, tf, formatDate, formatNumber } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>('setup');
  const [courseId, setCourseId] = useState(initialCourseId);
  const [mode, setMode] = useState<Mode>('standard_10');
  const [difficulty, setDifficulty] = useState<Difficulty>('adaptive');
  const [topic, setTopic] = useState('');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState('');
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef<number>(0);

  const current = questions[index];
  const isLast = index === questions.length - 1;

  const start = useCallback(async () => {
    if (!courseId) return;
    setPhase('generating');
    setError(null);
    try {
      const res = await fetch('/api/ai/study', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId, mode, difficulty,
          topic: topic.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!data.ok || !data.questions?.length) {
        setError(data.error === 'ai_not_configured' ? t.ai.unavailableBody : t.study.genError);
        setPhase('error');
        return;
      }
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setIndex(0);
      setAnswers([]);
      setGiven('');
      setChecked(false);
      startedAt.current = Date.now();
      setPhase('answering');
    } catch {
      setError(t.errors.network);
      setPhase('error');
    }
  }, [courseId, mode, difficulty, topic, t]);

  function check() {
    if (!current || !sessionId) return;
    const correct = isCorrect(current, given);
    setChecked(true);
    setAnswers((prev) => [...prev, { questionId: current.id, given, correct, topic: current.topic }]);

    void fetch('/api/ai/study/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId, question_id: current.id,
        given_answer: given, is_correct: correct,
      }),
    }).catch(() => undefined);
  }

  async function next() {
    if (!isLast) {
      setIndex((i) => i + 1);
      setGiven('');
      setChecked(false);
      return;
    }
    const correct = answers.filter((a) => a.correct).length;
    try {
      const res = await fetch('/api/ai/study/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          correct,
          total: questions.length,
          duration_minutes: Math.round((Date.now() - startedAt.current) / 60000),
          timezone_offset_minutes: new Date().getTimezoneOffset(),
        }),
      });
      const data = await res.json();
      const m = data?.momentum;
      if (m) {
        if (m.xpAwarded > 0) toast.success(tf(t.momentum.toastXp, { n: m.xpAwarded }));
        if (m.streakExtended) toast.success(tf(t.momentum.toastStreak, { n: m.streakAfter }));
        for (const code of m.newAchievements ?? []) {
          const name = (t.momentum as unknown as Record<string, string>)[`a_${code}`] ?? code;
          toast.success(tf(t.momentum.toastAchievement, { name }));
        }
      }
    } catch {
      // The session is already saved; momentum feedback is not worth an error.
    }
    setPhase('results');
    router.refresh();
  }

  const courseOptions = useMemo(
    () => courses.map((c) => ({ value: c.id, label: c.code })),
    [courses],
  );

  if (courses.length === 0) {
    return (
      <>
        <PageHeader title={t.study.title} subtitle={t.study.subtitle} />
        <Card><EmptyState title={t.study.title} body={t.study.empty} /></Card>
      </>
    );
  }

  if (!aiEnabled) {
    return (
      <>
        <PageHeader title={t.study.title} subtitle={t.study.subtitle} />
        <AiUnavailable title={t.ai.unavailableTitle} body={t.ai.unavailableBody} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.study.title} subtitle={t.study.subtitle} />

      {phase === 'setup' || phase === 'error' ? (
        <div className="space-y-4">
          {phase === 'error' && error ? (
            <ErrorState message={error} onRetry={() => setPhase('setup')} retryLabel={t.common.retry} />
          ) : null}

          <Card>
            <CardHeader title={t.common.course} />
            <SegmentedControl
              label={t.common.selectCourse}
              value={courseId}
              options={courseOptions}
              onChange={setCourseId}
              className="w-full"
            />
          </Card>

          <Card>
            <CardHeader title={t.study.mode} />
            <SegmentedControl
              label={t.study.mode}
              value={mode}
              onChange={(v) => setMode(v)}
              options={[
                { value: 'quick_5' as Mode, label: t.study.quick5, hint: t.study.quick5Sub },
                { value: 'standard_10' as Mode, label: t.study.standard10, hint: t.study.standard10Sub },
                { value: 'deep_20' as Mode, label: t.study.deep20, hint: t.study.deep20Sub },
                { value: 'exam_mode' as Mode, label: t.study.examMode, hint: t.study.examModeSub },
              ]}
              className="w-full"
            />
          </Card>

          <Card>
            <CardHeader title={t.study.difficulty} />
            <SegmentedControl
              label={t.study.difficulty}
              value={difficulty}
              onChange={(v) => setDifficulty(v)}
              options={[
                { value: 'easy' as Difficulty, label: t.study.easy },
                { value: 'medium' as Difficulty, label: t.study.medium },
                { value: 'hard' as Difficulty, label: t.study.hard },
                { value: 'adaptive' as Difficulty, label: t.study.adaptive, hint: t.study.adaptiveSub },
              ]}
              className="w-full"
            />
            {difficulty === 'adaptive' ? (
              <p className="text-xs text-[var(--text-muted)] mt-3">{t.study.adaptiveNote}</p>
            ) : null}
          </Card>

          <Card>
            <TextInput
              label={t.study.topic}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              hint={t.common.optional}
              placeholder={t.study.topic}
            />
          </Card>

          <Button size="lg" fullWidth onClick={start} disabled={!courseId}>
            <Icon.sparkle size={18} />
            {t.study.start}
          </Button>

          {history.length > 0 ? (
            <Card>
              <CardHeader title={t.study.history} />
              <ul className="divide-y divide-[var(--border-subtle)]">
                {history.map((h) => (
                  <li key={h.id} className="py-2.5 flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {h.courseCode ?? '—'}{h.topic ? ` · ${h.topic}` : ''}
                      </span>
                      <span className="block text-xs text-[var(--text-muted)]">{formatDate(h.completedAt)}</span>
                    </span>
                    <Badge tone={(h.score ?? 0) >= 80 ? 'positive' : (h.score ?? 0) >= 60 ? 'warning' : 'danger'}>
                      {h.correct}/{h.total}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <p className="text-sm text-[var(--text-secondary)] text-center">{t.study.noHistory}</p>
          )}
        </div>
      ) : null}

      {phase === 'generating' ? (
        <Card>
          <AiThinking stages={[t.ai.retrievingContext, t.ai.generatingQuestions, t.study.generating]} />
        </Card>
      ) : null}

      {phase === 'answering' && current ? (
        <div className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <p className="text-sm font-medium">
                {tf(t.study.question, { n: index + 1, total: questions.length })}
              </p>
              <div className="flex gap-1.5">
                {current.topic ? <Badge>{current.topic}</Badge> : null}
                <Badge tone={current.difficulty === 'hard' ? 'warning' : 'neutral'}>
                  {t.study[current.difficulty]}
                </Badge>
              </div>
            </div>
            <ProgressBar value={index} max={questions.length} label={t.study.title} />
          </div>

          <Card>
            <p className="text-base leading-relaxed">{current.question_text}</p>

            <div className="mt-5">
              {current.options?.length ? (
                <fieldset>
                  <legend className="sr-only">{t.study.selectAnswer}</legend>
                  <ul className="space-y-2">
                    {current.options.map((opt) => {
                      const selected = given === opt;
                      const isAnswer = opt === current.answer;
                      return (
                        <li key={opt}>
                          <button
                            type="button"
                            disabled={checked}
                            onClick={() => setGiven(opt)}
                            aria-pressed={selected}
                            className={cx(
                              'w-full text-start px-4 py-3 rounded-[var(--radius-md)] border text-sm transition-colors',
                              'disabled:cursor-default',
                              checked && isAnswer
                                ? 'border-[var(--positive)] bg-[var(--positive-soft)]'
                                : checked && selected
                                  ? 'border-[var(--danger)] bg-[var(--danger-soft)]'
                                  : selected
                                    ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)]'
                                    : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
                            )}
                          >
                            <span className="flex items-start gap-2.5">
                              {checked && isAnswer ? (
                                <span aria-hidden="true" className="text-[var(--positive)]">✓</span>
                              ) : checked && selected ? (
                                <span aria-hidden="true" className="text-[var(--danger)]">✕</span>
                              ) : null}
                              <span>{opt}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              ) : (
                <TextInput
                  label={t.study.typeAnswer}
                  value={given}
                  onChange={(e) => setGiven(e.target.value)}
                  disabled={checked}
                />
              )}
            </div>

            {checked ? (
              <div className="mt-5 space-y-3">
                <div
                  className={cx(
                    'rounded-[var(--radius-md)] border p-3.5',
                    answers[answers.length - 1]?.correct
                      ? 'border-[var(--positive-border)] bg-[var(--positive-soft)]'
                      : 'border-[var(--danger-border)] bg-[var(--danger-soft)]',
                  )}
                >
                  <p className="text-sm font-semibold">
                    {answers[answers.length - 1]?.correct ? `✓ ${t.study.correct}` : `✕ ${t.study.incorrect}`}
                  </p>
                  {!answers[answers.length - 1]?.correct ? (
                    <p className="text-sm mt-1.5">
                      <span className="text-[var(--text-secondary)]">{t.study.correctAnswer}: </span>
                      {current.answer}
                    </p>
                  ) : null}
                </div>

                {current.explanation ? (
                  <div className="rounded-[var(--radius-md)] bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      {t.study.explanation}
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{current.explanation}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
              {!checked ? (
                <Button onClick={check} disabled={!given.trim()}>{t.study.submit}</Button>
              ) : (
                <Button onClick={next}>
                  {isLast ? t.study.finish : t.study.nextQuestion}
                  <Icon.chevronEnd size={16} className="flip-rtl" />
                </Button>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {phase === 'results' ? (
        <ResultsPanel
          answers={answers}
          total={questions.length}
          onAgain={() => setPhase('setup')}
        />
      ) : null}
    </>
  );
}

function ResultsPanel({
  answers, total, onAgain,
}: {
  answers: Answered[];
  total: number;
  onAgain: () => void;
}) {
  const { t, tf, formatNumber } = useI18n();
  const correct = answers.filter((a) => a.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const a of answers) {
    const key = a.topic ?? '—';
    const e = byTopic.get(key) ?? { correct: 0, total: 0 };
    e.total += 1;
    if (a.correct) e.correct += 1;
    byTopic.set(key, e);
  }
  const topics = [...byTopic.entries()].map(([topic, v]) => ({ topic, ...v, rate: v.correct / v.total }));
  const weak = topics.filter((x) => x.rate < 0.7);
  const strong = topics.filter((x) => x.rate >= 0.7);

  return (
    <div className="space-y-4">
      <Card className="text-center">
        <p className="font-display text-5xl font-semibold tabular-nums" style={{
          color: pct >= 80 ? 'var(--positive)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)',
        }}>
          {formatNumber(pct)}%
        </p>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          {tf(t.study.scored, { correct, total })}
        </p>
      </Card>

      {weak.length > 0 ? (
        <Card>
          <CardHeader title={t.study.weakTopics} />
          <ul className="flex flex-wrap gap-1.5">
            {weak.map((x) => (
              <li key={x.topic}>
                <Badge tone="warning">{x.topic} · {x.correct}/{x.total}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {strong.length > 0 ? (
        <Card>
          <CardHeader title={t.study.strongTopics} />
          <ul className="flex flex-wrap gap-1.5">
            {strong.map((x) => (
              <li key={x.topic}>
                <Badge tone="positive">{x.topic} · {x.correct}/{x.total}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Button fullWidth size="lg" onClick={onAgain}>
        <Icon.sparkle size={18} />
        {t.study.practiceAgain}
      </Button>
    </div>
  );
}

/** Lenient on whitespace and case for free-text answers; exact for options. */
function isCorrect(q: Question, given: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?]+$/, '');
  if (q.options?.length) return given === q.answer;
  return norm(given) === norm(q.answer);
}
