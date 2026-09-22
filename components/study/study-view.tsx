'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { AiThinking, EmptyState, ErrorState } from '@/components/ui/states';
import { TextInput } from '@/components/ui/form';
import { useToast, Modal } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { formatLabel, formatHint, formatIcon } from './practice-format-picker';
import {
  MODE_SIZES, PRACTICE_FORMATS, isDeckFormat,
  type PracticeFormat, type PracticeMode, type RequestedDifficulty,
} from '@/lib/study/modes';
import { XP_RULES } from '@/lib/momentum/engine';
import type { Question } from '@/types/database';

type Phase = 'setup' | 'generating' | 'answering' | 'results' | 'error';

export interface StudyHistoryEntry {
  id: string; courseCode: string | null; topic: string | null;
  score: number | null; correct: number; total: number; completedAt: string;
}

type HistoryRow = StudyHistoryEntry;

interface Answered { questionId: string; given: string; correct: boolean; topic: string | null }

/** Option letters. Beyond nine the keyboard shortcut stops, the letters do not. */
const LETTERS = 'ABCDEFGHIJ';

const MODES: PracticeMode[] = ['quick_5', 'standard_10', 'deep_20', 'exam_mode'];
const DIFFICULTIES: RequestedDifficulty[] = ['easy', 'medium', 'hard', 'adaptive'];

/** How hot the difficulty chip burns: one bar for easy, three for hard. */
const HEAT: Record<RequestedDifficulty, number> = { easy: 1, medium: 2, hard: 3, adaptive: 0 };

export function StudyView({
  aiEnabled, courses, initialCourseId, initialFormat, history,
  chapters = [], initialChapterId = null, embedded = false,
}: {
  aiEnabled: boolean;
  courses: Array<{ id: string; code: string; name: string }>;
  initialCourseId: string;
  /** The style the course page asked for, or 'mixed' when nobody chose. */
  initialFormat: PracticeFormat;
  history: HistoryRow[];
  /** Chapters of the chosen course, so a set can be set on one of them. */
  chapters?: Array<{ id: string; title: string; readable: boolean }>;
  /** Pre-selected when the student came here from a chapter review. */
  initialChapterId?: string | null;
  /** True when Study with AI already drew the page header and course picker. */
  embedded?: boolean;
}) {
  const { t, tf, formatNumber } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>('setup');
  const [courseId, setCourseId] = useState(initialCourseId);
  const [mode, setMode] = useState<PracticeMode>('standard_10');
  const [format, setFormat] = useState<PracticeFormat>(initialFormat);
  // The choices live behind the button that uses them, and open on the press.
  const [setupOpen, setSetupOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<RequestedDifficulty>('adaptive');
  const [topic, setTopic] = useState('');
  const [chapterId, setChapterId] = useState<string | null>(initialChapterId);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState('');
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [awardedXp, setAwardedXp] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef<number>(0);

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const answeredCurrent = checked ? answers[answers.length - 1] : undefined;

  // The clock only runs while questions are on screen, and is read from the
  // start timestamp rather than accumulated, so a throttled tab cannot drift.
  useEffect(() => {
    if (phase !== 'answering') return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const start = useCallback(async () => {
    if (!courseId) return;
    setPhase('generating');
    setError(null);

    // Flashcards are a deck, not a set to answer now, so they go to their own
    // route and the student lands on the deck rather than on question one.
    // Sending them through the question generator would quietly hand back
    // ordinary questions under a label that promised cards.
    if (isDeckFormat(format)) {
      try {
        const res = await fetch('/api/ai/flashcards', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            course_id: courseId,
            mode,
            material_id: chapterId ?? undefined,
            topic: topic.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error === 'ai_not_configured' ? t.ai.unavailableBody : t.study.genError);
          setPhase('error');
          return;
        }
        toast.success(tf(t.study.deckBuilt, { n: formatNumber(data.created ?? 0) }));
        router.push(`/flashcards?course=${courseId}`);
        router.refresh();
      } catch {
        setError(t.errors.network);
        setPhase('error');
      }
      return;
    }

    try {
      const res = await fetch('/api/ai/study', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId, mode, difficulty, format,
          topic: topic.trim() || undefined,
          material_id: chapterId ?? undefined,
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
      setCombo(0);
      setBestCombo(0);
      setElapsed(0);
      setAwardedXp(null);
      startedAt.current = Date.now();
      setPhase('answering');
    } catch {
      setError(t.errors.network);
      setPhase('error');
    }
  }, [courseId, mode, difficulty, format, topic, chapterId, t, tf, formatNumber, router, toast]);

  const check = useCallback(() => {
    if (!current || !sessionId || checked || !given.trim()) return;
    const correct = isCorrect(current, given);
    setChecked(true);
    setAnswers((prev) => [...prev, { questionId: current.id, given, correct, topic: current.topic }]);
    setCombo((prev) => {
      const next = correct ? prev + 1 : 0;
      setBestCombo((best) => Math.max(best, next));
      return next;
    });

    void fetch('/api/ai/study/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId, question_id: current.id,
        given_answer: given, is_correct: correct,
      }),
    }).catch(() => undefined);
  }, [current, sessionId, checked, given]);

  const next = useCallback(async () => {
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
        if (typeof m.xpAwarded === 'number') setAwardedXp(m.xpAwarded);
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
  }, [isLast, answers, sessionId, questions.length, toast, tf, t, router]);

  // Answering a set is a rhythm, and reaching for the mouse every question
  // breaks it. Digits pick an option, Enter checks and then advances.
  useEffect(() => {
    if (phase !== 'answering' || !current) return;

    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA';

      if (e.key === 'Enter') {
        if (typing && !checked) { e.preventDefault(); check(); return; }
        if (!typing) { e.preventDefault(); if (checked) void next(); else check(); }
        return;
      }
      if (typing || checked) return;

      const n = Number(e.key);
      const options = current?.options ?? [];
      if (Number.isInteger(n) && n >= 1 && n <= Math.min(9, options.length)) {
        e.preventDefault();
        setGiven(options[n - 1]);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, current, checked, check, next]);

  const courseCode = courses.find((c) => c.id === courseId)?.code ?? null;

  if (courses.length === 0) {
    return (
      <>
        {embedded ? null : <PageHeader title={t.study.title} subtitle={t.study.subtitle} />}
        <Card><EmptyState title={t.study.title} body={t.study.empty} /></Card>
      </>
    );
  }

  if (!aiEnabled) {
    return (
      <>
        {embedded ? null : <PageHeader title={t.study.title} subtitle={t.study.subtitle} />}
        <LockedPanel history={history} />
      </>
    );
  }

  return (
    <>
      {embedded ? null : <PageHeader title={t.study.title} subtitle={t.study.subtitle} />}

      {phase === 'setup' || phase === 'error' ? (
        <div className="space-y-4">
          {phase === 'error' && error ? (
            <ErrorState message={error} onRetry={() => setPhase('setup')} retryLabel={t.common.retry} />
          ) : null}

          <LaunchPad
            mode={mode}
            difficulty={difficulty}
            format={format}
            courseCode={courseCode}
            topic={topic.trim()}
            // The button opens the choices rather than starting immediately:
            // a set is twenty minutes of someone's evening, and the settings
            // that shape it were three scrolls below the button that used it.
            onStart={() => setSetupOpen(true)}
            canStart={Boolean(courseId)}
          />

          {embedded ? null : (
            <Card>
              <CardHeader title={t.common.course} />
              <ChipRow
                label={t.common.selectCourse}
                value={courseId}
                onChange={setCourseId}
                options={courses.map((c) => ({ value: c.id, label: c.code, title: c.name }))}
              />
            </Card>
          )}

          {/*
            Which chapter to be asked about.
            Optional on purpose: a set drawn from the whole course is still a
            useful thing to ask for, and forcing a chapter would block every
            student who has not uploaded one yet.
          */}
          {chapters.length > 0 ? (
            <Card>
              <CardHeader title={t.studyAi.chooseChapter} subtitle={t.studyAi.onlyReadable} />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={chapterId === null}
                  onClick={() => setChapterId(null)}
                  className={cx(
                    'px-3 min-h-[36px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium border transition-colors',
                    chapterId === null
                      ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
                  )}
                >
                  {t.practice.mixed}
                </button>
                {chapters.filter((c) => c.readable).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={chapterId === c.id}
                    onClick={() => setChapterId(c.id)}
                    title={c.title}
                    className={cx(
                      'px-3 min-h-[36px] max-w-[16rem] truncate rounded-[var(--radius-sm)] text-[0.8125rem] font-medium border transition-colors',
                      chapterId === c.id
                        ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
                    )}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={t.practice.format} />
            <div role="radiogroup" aria-label={t.practice.format} className="flex flex-wrap gap-2">
              {PRACTICE_FORMATS.map((f) => {
                const selected = f === format;
                return (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFormat(f)}
                    className={cx(
                      'inline-flex items-center gap-2 px-3 min-h-[38px] rounded-full border text-sm transition-colors',
                      selected
                        ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] font-medium'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    {formatIcon(f, 14)}
                    {formatLabel(t, f)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-3">{formatHint(t, format)}</p>
          </Card>

          <Card>
            <CardHeader title={t.study.mode} />
            <div role="radiogroup" aria-label={t.study.mode} className="grid grid-cols-2 gap-2">
              {MODES.map((m) => {
                const selected = m === mode;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMode(m)}
                    className={cx(
                      'text-start p-3 rounded-[var(--radius-md)] border transition-colors',
                      'min-h-[76px] flex flex-col justify-between gap-1',
                      selected
                        ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)]'
                        : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    <span
                      className={cx(
                        'font-display text-2xl font-semibold tabular-nums leading-none',
                        selected ? 'text-[var(--accent-soft-text)]' : 'text-[var(--text-primary)]',
                      )}
                    >
                      {formatNumber(MODE_SIZES[m])}
                    </span>
                    <span className="block">
                      <span className="block text-xs font-medium">{modeLabel(t, m)}</span>
                      <span className="block text-xs text-[var(--text-muted)]">{modeHint(t, m)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title={t.study.difficulty} />
            <div role="radiogroup" aria-label={t.study.difficulty} className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => {
                const selected = d === difficulty;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDifficulty(d)}
                    className={cx(
                      'inline-flex items-center gap-2 px-3 min-h-[38px] rounded-full border text-sm transition-colors',
                      selected
                        ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] font-medium'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    {d === 'adaptive' ? (
                      <Icon.sparkle size={14} />
                    ) : (
                      <span aria-hidden="true" className="flex items-end gap-0.5 h-3">
                        {[1, 2, 3].map((bar) => (
                          <span
                            key={bar}
                            className={cx(
                              'w-1 rounded-full',
                              bar <= HEAT[d] ? 'bg-current' : 'bg-current opacity-25',
                            )}
                            style={{ height: `${4 + bar * 3}px` }}
                          />
                        ))}
                      </span>
                    )}
                    {t.study[d]}
                  </button>
                );
              })}
            </div>
            {difficulty === 'adaptive' ? (
              <p className="text-xs text-[var(--text-muted)] mt-3">{t.study.adaptiveNote}</p>
            ) : null}
          </Card>

          <Card>
               {/*
            Every choice in one window.
            ----------------------------------------------------------------
            Style, chapter, length, difficulty and topic decide what the next
            twenty minutes are, and they were spread down a page under the
            button that starts it. Here they are one dialog: open it, choose,
            start. Escape or the backdrop closes it and nothing is lost —
            these are the same pieces of state, just shown when they matter.
          */}
          <Modal
            open={setupOpen}
            onClose={() => setSetupOpen(false)}
            title={t.study.setupTitle}
            description={t.study.setupSub}
            size="lg"
            footer={
              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={() => setSetupOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button onClick={() => { setSetupOpen(false); start(); }} disabled={!courseId}>
                  <Icon.sparkle size={16} />
                  {t.study.start}
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
          {embedded ? null : (
            <Card>
              <CardHeader title={t.common.course} />
              <ChipRow
                label={t.common.selectCourse}
                value={courseId}
                onChange={setCourseId}
                options={courses.map((c) => ({ value: c.id, label: c.code, title: c.name }))}
              />
            </Card>
          )}

          {/*
            Which chapter to be asked about.
            Optional on purpose: a set drawn from the whole course is still a
            useful thing to ask for, and forcing a chapter would block every
            student who has not uploaded one yet.
          */}
          {chapters.length > 0 ? (
            <Card>
              <CardHeader title={t.studyAi.chooseChapter} subtitle={t.studyAi.onlyReadable} />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={chapterId === null}
                  onClick={() => setChapterId(null)}
                  className={cx(
                    'px-3 min-h-[36px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium border transition-colors',
                    chapterId === null
                      ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
                  )}
                >
                  {t.practice.mixed}
                </button>
                {chapters.filter((c) => c.readable).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={chapterId === c.id}
                    onClick={() => setChapterId(c.id)}
                    title={c.title}
                    className={cx(
                      'px-3 min-h-[36px] max-w-[16rem] truncate rounded-[var(--radius-sm)] text-[0.8125rem] font-medium border transition-colors',
                      chapterId === c.id
                        ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
                    )}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={t.practice.format} />
            <div role="radiogroup" aria-label={t.practice.format} className="flex flex-wrap gap-2">
              {PRACTICE_FORMATS.map((f) => {
                const selected = f === format;
                return (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFormat(f)}
                    className={cx(
                      'inline-flex items-center gap-2 px-3 min-h-[38px] rounded-full border text-sm transition-colors',
                      selected
                        ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] font-medium'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    {formatIcon(f, 14)}
                    {formatLabel(t, f)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-3">{formatHint(t, format)}</p>
          </Card>

          <Card>
            <CardHeader title={t.study.mode} />
            <div role="radiogroup" aria-label={t.study.mode} className="grid grid-cols-2 gap-2">
              {MODES.map((m) => {
                const selected = m === mode;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMode(m)}
                    className={cx(
                      'text-start p-3 rounded-[var(--radius-md)] border transition-colors',
                      'min-h-[76px] flex flex-col justify-between gap-1',
                      selected
                        ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)]'
                        : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    <span
                      className={cx(
                        'font-display text-2xl font-semibold tabular-nums leading-none',
                        selected ? 'text-[var(--accent-soft-text)]' : 'text-[var(--text-primary)]',
                      )}
                    >
                      {formatNumber(MODE_SIZES[m])}
                    </span>
                    <span className="block">
                      <span className="block text-xs font-medium">{modeLabel(t, m)}</span>
                      <span className="block text-xs text-[var(--text-muted)]">{modeHint(t, m)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title={t.study.difficulty} />
            <div role="radiogroup" aria-label={t.study.difficulty} className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => {
                const selected = d === difficulty;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDifficulty(d)}
                    className={cx(
                      'inline-flex items-center gap-2 px-3 min-h-[38px] rounded-full border text-sm transition-colors',
                      selected
                        ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] font-medium'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    {d === 'adaptive' ? (
                      <Icon.sparkle size={14} />
                    ) : (
                      <span aria-hidden="true" className="flex items-end gap-0.5 h-3">
                        {[1, 2, 3].map((bar) => (
                          <span
                            key={bar}
                            className={cx(
                              'w-1 rounded-full',
                              bar <= HEAT[d] ? 'bg-current' : 'bg-current opacity-25',
                            )}
                            style={{ height: `${4 + bar * 3}px` }}
                          />
                        ))}
                      </span>
                    )}
                    {t.study[d]}
                  </button>
                );
              })}
            </div>
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
            </div>
          </Modal>

       <TextInput
              label={t.study.topic}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              hint={t.common.optional}
              placeholder={t.study.topic}
            />
          </Card>

          {history.length > 0 ? (
            <Card>
              <CardHeader title={t.study.history} />
              <ul className="divide-y divide-[var(--border-subtle)]">
                {history.map((h) => (
                  <li key={h.id} className="py-2.5">
                    <HistoryLine row={h} />
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
          <SessionHud
            answers={answers}
            total={questions.length}
            index={index}
            combo={combo}
            elapsed={elapsed}
          />

          <Card>
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {tf(t.study.question, { n: index + 1, total: questions.length })}
              </p>
              <div className="flex flex-wrap justify-end gap-1.5">
                {current.topic ? <Badge>{current.topic}</Badge> : null}
                <Badge tone={current.difficulty === 'hard' ? 'warning' : 'neutral'}>
                  {t.study[current.difficulty]}
                </Badge>
              </div>
            </div>

            <p className="font-display text-lg leading-snug text-balance-title">{current.question_text}</p>

            <div className="mt-5">
              {current.options?.length ? (
                <fieldset>
                  <legend className="sr-only">{t.study.selectAnswer}</legend>
                  <ul className="space-y-2">
                    {current.options.map((opt, i) => {
                      const selected = given === opt;
                      const isAnswer = opt === current.answer;
                      const reveal = checked && isAnswer;
                      const wrong = checked && selected && !isAnswer;
                      return (
                        <li key={opt}>
                          <button
                            type="button"
                            disabled={checked}
                            onClick={() => setGiven(opt)}
                            aria-pressed={selected}
                            className={cx(
                              'w-full text-start p-3 rounded-[var(--radius-md)] border text-sm transition-colors',
                              'flex items-center gap-3 disabled:cursor-default',
                              reveal
                                ? 'border-[var(--positive)] bg-[var(--positive-soft)]'
                                : wrong
                                  ? 'border-[var(--danger)] bg-[var(--danger-soft)]'
                                  : selected
                                    ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)]'
                                    : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={cx(
                                'shrink-0 w-7 h-7 grid place-items-center rounded-[var(--radius-sm)]',
                                'text-xs font-semibold tabular-nums border',
                                reveal
                                  ? 'border-[var(--positive)] text-[var(--positive)]'
                                  : wrong
                                    ? 'border-[var(--danger)] text-[var(--danger)]'
                                    : selected
                                      ? 'border-[var(--accent)] text-[var(--accent-soft-text)]'
                                      : 'border-[var(--border-subtle)] text-[var(--text-muted)]',
                              )}
                            >
                              {reveal ? '✓' : wrong ? '✕' : LETTERS[i] ?? '·'}
                            </span>
                            <span className="min-w-0">{opt}</span>
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
              <div className="mt-5 space-y-3 animate-pop">
                <div
                  className={cx(
                    'rounded-[var(--radius-md)] border p-3.5 flex items-start gap-3',
                    answeredCurrent?.correct
                      ? 'border-[var(--positive-border)] bg-[var(--positive-soft)]'
                      : 'border-[var(--danger-border)] bg-[var(--danger-soft)]',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'shrink-0 w-7 h-7 grid place-items-center rounded-full text-sm font-semibold',
                      answeredCurrent?.correct
                        ? 'bg-[var(--positive)] text-white'
                        : 'bg-[var(--danger)] text-white',
                    )}
                  >
                    {answeredCurrent?.correct ? '✓' : '✕'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {answeredCurrent?.correct ? t.study.correct : t.study.incorrect}
                      {answeredCurrent?.correct && combo >= 2 ? (
                        <span className="ms-2 font-normal text-[var(--text-secondary)]">
                          {tf(t.study.combo, { n: formatNumber(combo) })}
                        </span>
                      ) : null}
                    </p>
                    {!answeredCurrent?.correct ? (
                      <p className="text-sm mt-1.5">
                        <span className="text-[var(--text-secondary)]">{t.study.correctAnswer}: </span>
                        {current.answer}
                      </p>
                    ) : null}
                  </div>
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

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 mt-5">
              <p className="text-xs text-[var(--text-muted)]">{t.study.keyboardHint}</p>
              {!checked ? (
                <Button onClick={check} disabled={!given.trim()}>{t.study.submit}</Button>
              ) : (
                <Button onClick={() => void next()}>
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
          bestCombo={bestCombo}
          seconds={elapsed}
          awardedXp={awardedXp}
          previousBest={bestScoreFor(history, courseCode)}
          onAgain={() => setPhase('setup')}
          onDrillTopic={(next) => { setTopic(next); setPhase('setup'); }}
        />
      ) : null}
    </>
  );
}

// --- Setup -------------------------------------------------------------------

/**
 * The choices below are four separate controls, which makes it easy to press
 * start without noticing you asked for twenty hard questions. This restates
 * the whole run as one sentence, right above the button that commits to it.
 */
function LaunchPad({
  mode, difficulty, format, courseCode, topic, onStart, canStart,
}: {
  mode: PracticeMode;
  difficulty: RequestedDifficulty;
  format: PracticeFormat;
  courseCode: string | null;
  topic: string;
  onStart: () => void;
  canStart: boolean;
}) {
  const { t, tf, formatNumber } = useI18n();
  const count = MODE_SIZES[mode];
  const maxXp = XP_RULES.practiceSession + count * XP_RULES.perCorrectAnswer;

  return (
    <Card className="relative overflow-hidden bg-[var(--bg-accent-soft)] border-[var(--border-subtle)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -end-16 w-44 h-44 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
      />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-soft-text)]">
          {t.study.runHeading}
        </p>

        <div className="flex items-end gap-2.5 mt-2">
          <span className="font-display text-5xl font-semibold leading-none tabular-nums">
            {formatNumber(count)}
          </span>
          <span className="text-sm text-[var(--text-secondary)] pb-1.5">{t.study.questionsLabel}</span>
        </div>

        <ul className="flex flex-wrap gap-1.5 mt-3.5">
          {courseCode ? <li><Badge tone="accent">{courseCode}</Badge></li> : null}
          {/* The style is the choice made back on the course, so it is
              confirmed here rather than left to be remembered. */}
          {format !== 'mixed' ? <li><Badge>{formatLabel(t, format)}</Badge></li> : null}
          <li><Badge>{t.study[difficulty]}</Badge></li>
          {topic ? <li><Badge>{topic}</Badge></li> : null}
          <li>
            <Badge tone="positive" icon={<Icon.flame size={12} />}>
              {tf(t.study.xpUpTo, { n: formatNumber(maxXp) })}
            </Badge>
          </li>
        </ul>

        <Button size="lg" fullWidth onClick={onStart} disabled={!canStart} className="mt-4">
          <Icon.sparkle size={18} />
          {t.study.start}
        </Button>
      </div>
    </Card>
  );
}

function ChipRow({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string; title?: string }>;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              'px-3 min-h-[38px] rounded-full border text-sm transition-colors',
              selected
                ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] font-medium'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// --- Answering ---------------------------------------------------------------

/** One pip per question, filled as you go, so progress is visible at a glance. */
function SessionHud({
  answers, total, index, combo, elapsed,
}: {
  answers: Answered[];
  total: number;
  index: number;
  combo: number;
  elapsed: number;
}) {
  const { t, tf, formatNumber } = useI18n();
  const correct = answers.filter((a) => a.correct).length;

  return (
    <Card padded={false} className="p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold tabular-nums">
          {formatNumber(correct)}
          <span className="text-[var(--text-muted)] font-normal">/{formatNumber(total)}</span>
        </p>
        <div className="flex items-center gap-2.5">
          {combo >= 2 ? (
            <Badge tone="warning" icon={<Icon.flame size={12} />}>
              {tf(t.study.combo, { n: formatNumber(combo) })}
            </Badge>
          ) : null}
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] tabular-nums">
            <Icon.clock size={13} />
            <span className="sr-only">{t.study.elapsed}: </span>
            {clock(elapsed)}
          </span>
        </div>
      </div>

      <ol className="flex gap-1 mt-3" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const a = answers[i];
          return (
            <li
              key={i}
              className={cx(
                'h-1.5 flex-1 rounded-full transition-colors',
                a ? (a.correct ? 'bg-[var(--positive)]' : 'bg-[var(--danger)]')
                  : i === index ? 'bg-[var(--accent)]' : 'bg-[var(--bg-inset)]',
              )}
            />
          );
        })}
      </ol>
    </Card>
  );
}

// --- Results -----------------------------------------------------------------

function ResultsPanel({
  answers, total, bestCombo, seconds, awardedXp, previousBest, onAgain, onDrillTopic,
}: {
  answers: Answered[];
  total: number;
  bestCombo: number;
  seconds: number;
  awardedXp: number | null;
  previousBest: number | null;
  onAgain: () => void;
  onDrillTopic: (topic: string) => void;
}) {
  const { t, tf, formatNumber } = useI18n();
  const correct = answers.filter((a) => a.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const tone = pct >= 80 ? 'var(--positive)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';

  const verdict =
    pct === 100 ? t.study.verdictPerfect
      : pct >= 80 ? t.study.verdictStrong
        : pct >= 60 ? t.study.verdictSolid
          : t.study.verdictRough;

  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const a of answers) {
    const key = a.topic ?? '—';
    const e = byTopic.get(key) ?? { correct: 0, total: 0 };
    e.total += 1;
    if (a.correct) e.correct += 1;
    byTopic.set(key, e);
  }
  const topics = [...byTopic.entries()]
    .map(([name, v]) => ({ name, ...v, rate: v.correct / v.total }))
    .sort((a, b) => a.rate - b.rate);

  const weakest = topics.find((x) => x.rate < 0.7 && x.name !== '—');
  const isBest = previousBest !== null && pct > previousBest;

  return (
    <div className="space-y-4">
      <Card className="text-center">
        <ScoreRing pct={pct} colour={tone} />
        <p className="font-display text-xl font-semibold mt-3 text-balance-title">{verdict}</p>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {tf(t.study.scored, { correct: formatNumber(correct), total: formatNumber(total) })}
        </p>

        <ul className="flex flex-wrap justify-center gap-1.5 mt-3">
          {isBest ? (
            <li><Badge tone="positive" icon={<Icon.trophy size={12} />}>{t.study.newBest}</Badge></li>
          ) : null}
          {awardedXp !== null ? (
            <li>
              <Badge tone="accent" icon={<Icon.flame size={12} />}>
                {t.study.sessionXp} +{formatNumber(awardedXp)}
              </Badge>
            </li>
          ) : null}
        </ul>

        {!isBest && previousBest !== null ? (
          <p className="text-xs text-[var(--text-muted)] mt-2">
            {tf(t.study.prevBest, { n: formatNumber(previousBest) })}
          </p>
        ) : null}

        <dl className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-[var(--border-subtle)]">
          <Stat label={t.study.accuracy} value={`${formatNumber(pct)}%`} />
          <Stat label={t.study.bestRun} value={formatNumber(bestCombo)} />
          <Stat label={t.study.elapsed} value={clock(seconds)} />
        </dl>
      </Card>

      {topics.length > 0 ? (
        <Card>
          <CardHeader title={t.study.topicBreakdown} />
          <ul className="space-y-3">
            {topics.map((x) => (
              <li key={x.name}>
                <div className="flex items-baseline justify-between gap-2 text-sm mb-1">
                  <span className="min-w-0 truncate">{x.name}</span>
                  <span className="tabular-nums text-[var(--text-secondary)] shrink-0">
                    {formatNumber(x.correct)}/{formatNumber(x.total)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(x.rate * 100)}%`,
                      background: x.rate >= 0.7 ? 'var(--positive)' : 'var(--warning)',
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="space-y-2">
        {weakest ? (
          <Button fullWidth size="lg" onClick={() => onDrillTopic(weakest.name)}>
            <Icon.sparkle size={18} />
            {tf(t.study.focusWeakest, { topic: weakest.name })}
          </Button>
        ) : null}
        <Button fullWidth size="lg" variant={weakest ? 'secondary' : 'primary'} onClick={onAgain}>
          {t.study.practiceAgain}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular-nums mt-0.5">{value}</dd>
    </div>
  );
}

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

function ScoreRing({ pct, colour }: { pct: number; colour: string }) {
  const { formatNumber } = useI18n();
  const offset = RING_C - (RING_C * pct) / 100;

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden="true">
        <circle
          cx="60" cy="60" r={RING_R} fill="none" strokeWidth="10"
          stroke="var(--bg-inset)"
        />
        <circle
          cx="60" cy="60" r={RING_R} fill="none" strokeWidth="10" strokeLinecap="round"
          stroke={colour}
          strokeDasharray={RING_C}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          className="animate-ring"
          style={{ '--ring-from': String(RING_C) } as React.CSSProperties}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        <span className="font-display text-3xl font-semibold tabular-nums" style={{ color: colour }}>
          {formatNumber(pct)}%
        </span>
      </span>
    </div>
  );
}

// --- No API key --------------------------------------------------------------

/**
 * This screen is the one place in UniMate that genuinely cannot work without a
 * key, so rather than a bare notice it shows what the feature is, what a
 * question looks like, and what is still running regardless.
 */
function LockedPanel({ history }: { history: HistoryRow[] }) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -end-20 w-52 h-52 rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
        />
        <div className="relative flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="shrink-0 w-10 h-10 rounded-[var(--radius-md)] grid place-items-center bg-[var(--bg-inset)] text-[var(--text-muted)]"
          >
            <Icon.lock size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-balance-title">{t.study.lockedTitle}</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              {t.study.lockedBody}
            </p>
            {/* The one screen a student lands on wanting this. Sending them to
                read a settings page to find the box is a step too many. */}
            <Link
              href="/settings"
              className="inline-block mt-3 text-sm font-medium underline underline-offset-2"
            >
              {t.ai.ownKeyCta}
            </Link>
          </div>
        </div>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
          {t.study.lockedExample}
        </p>
        <div className="opacity-70 select-none" aria-hidden="true">
          <p className="font-display text-base leading-snug">{t.study.lockedExampleQ}</p>
          <div className="mt-4 p-3 rounded-[var(--radius-md)] border border-[var(--positive)] bg-[var(--positive-soft)] flex items-center gap-3 text-sm">
            <span className="shrink-0 w-7 h-7 grid place-items-center rounded-[var(--radius-sm)] border border-[var(--positive)] text-[var(--positive)] text-xs font-semibold">
              ✓
            </span>
            {t.study.lockedExampleA}
          </div>
        </div>
      </Card>

      <Card className="bg-[var(--positive-soft)] border-[var(--positive-border)]">
        <p className="text-sm font-semibold">{t.study.lockedWorks}</p>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
          {t.study.lockedWorksList}
        </p>
      </Card>

      {history.length > 0 ? (
        <Card>
          <CardHeader title={t.study.history} />
          <ul className="divide-y divide-[var(--border-subtle)]">
            {history.map((h) => (
              <li key={h.id} className="py-2.5"><HistoryLine row={h} /></li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

// --- Shared ------------------------------------------------------------------

function HistoryLine({ row }: { row: HistoryRow }) {
  const { formatDate, formatNumber } = useI18n();
  const pct = row.score ?? (row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0);

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium truncate">
          {row.courseCode ?? '—'}{row.topic ? ` · ${row.topic}` : ''}
        </span>
        <span className="block text-xs text-[var(--text-muted)]">{formatDate(row.completedAt)}</span>
        <span className="block h-1 rounded-full bg-[var(--bg-inset)] overflow-hidden mt-1.5 max-w-[10rem]">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: pct >= 80 ? 'var(--positive)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)',
            }}
          />
        </span>
      </span>
      <Badge tone={pct >= 80 ? 'positive' : pct >= 60 ? 'warning' : 'danger'}>
        {formatNumber(row.correct)}/{formatNumber(row.total)}
      </Badge>
    </div>
  );
}

function modeLabel(t: ReturnType<typeof useI18n>['t'], m: PracticeMode): string {
  return m === 'quick_5' ? t.study.quick5
    : m === 'standard_10' ? t.study.standard10
      : m === 'deep_20' ? t.study.deep20
        : t.study.examMode;
}

function modeHint(t: ReturnType<typeof useI18n>['t'], m: PracticeMode): string {
  return m === 'quick_5' ? t.study.quick5Sub
    : m === 'standard_10' ? t.study.standard10Sub
      : m === 'deep_20' ? t.study.deep20Sub
        : t.study.examModeSub;
}

/** mm:ss, padded, direction-neutral. */
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** The student's best score in this course so far, or null if it is their first. */
function bestScoreFor(history: HistoryRow[], courseCode: string | null): number | null {
  if (!courseCode) return null;
  const scores = history
    .filter((h) => h.courseCode === courseCode)
    .map((h) => h.score ?? (h.total > 0 ? Math.round((h.correct / h.total) * 100) : 0));
  return scores.length ? Math.max(...scores) : null;
}

/** Lenient on whitespace and case for free-text answers; exact for options. */
function isCorrect(q: Question, given: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?]+$/, '');
  if (q.options?.length) return given === q.answer;
  return norm(given) === norm(q.answer);
}
