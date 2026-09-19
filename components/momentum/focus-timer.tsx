'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { Select, SegmentedControl } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';

type Phase = 'idle' | 'focus' | 'break';

const FOCUS_OPTIONS = [15, 25, 45, 50];
const BREAK_OPTIONS = [5, 10, 15];
const ROUNDS = 4;

/**
 * A Pomodoro timer that writes a real study_sessions row when a block ends,
 * so focus time appears in analytics and records like any other study, and
 * counts toward the streak.
 *
 * Timing is derived from wall-clock deadlines rather than counting interval
 * ticks — a backgrounded tab throttles timers, and a student who leaves the
 * page should still get credit for the minutes that actually passed.
 */
export function FocusTimer({
  courses,
}: {
  courses: Array<{ id: string; code: string; name: string }>;
}) {
  const { t, tf } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [courseId, setCourseId] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(1);
  const [remaining, setRemaining] = useState(25 * 60);
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);

  const deadlineRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);   // focus seconds accumulated this block

  useEffect(() => {
    if (phase === 'idle') setRemaining(focusMinutes * 60);
  }, [focusMinutes, phase]);

  const logFocus = useCallback(async (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) {
      toast.info(t.momentum.focusTooShort);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/momentum/focus', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          minutes,
          course_id: courseId || null,
          timezone_offset_minutes: new Date().getTimezoneOffset(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(tf(t.momentum.focusSaved, { n: minutes }));
        if (data.momentum?.streakExtended) {
          toast.success(tf(t.momentum.toastStreak, { n: data.momentum.streakAfter }));
        }
        router.refresh();
      } else {
        toast.error(t.errors.generic);
      }
    } catch {
      toast.error(t.errors.network);
    } finally {
      setSaving(false);
    }
  }, [courseId, router, t, tf, toast]);

  // Single ticking effect driven by an absolute deadline.
  useEffect(() => {
    if (phase === 'idle' || paused) return;

    const id = window.setInterval(() => {
      if (deadlineRef.current === null) return;
      const left = Math.round((deadlineRef.current - Date.now()) / 1000);

      if (left > 0) {
        setRemaining(left);
        return;
      }

      // Block finished.
      setRemaining(0);
      if (phase === 'focus') {
        const earned = elapsedRef.current + focusMinutes * 60;
        elapsedRef.current = 0;
        void logFocus(earned);
        toast.info(t.momentum.focusDone);
        setPhase('break');
        deadlineRef.current = Date.now() + breakMinutes * 60_000;
        setRemaining(breakMinutes * 60);
      } else {
        const next = round >= ROUNDS ? 1 : round + 1;
        setRound(next);
        setPhase('focus');
        deadlineRef.current = Date.now() + focusMinutes * 60_000;
        setRemaining(focusMinutes * 60);
      }
    }, 500);

    return () => window.clearInterval(id);
  }, [phase, paused, focusMinutes, breakMinutes, round, logFocus, toast, t]);

  function start() {
    elapsedRef.current = 0;
    setPhase('focus');
    setPaused(false);
    setRound(1);
    deadlineRef.current = Date.now() + focusMinutes * 60_000;
    setRemaining(focusMinutes * 60);
  }

  function togglePause() {
    if (paused) {
      deadlineRef.current = Date.now() + remaining * 1000;
      setPaused(false);
      return;
    }
    // Bank the focus seconds served so far, so a pause cannot lose them.
    if (phase === 'focus' && deadlineRef.current !== null) {
      const served = focusMinutes * 60 - remaining;
      elapsedRef.current += Math.max(0, served);
    }
    setPaused(true);
  }

  /** Ends early and still credits the minutes actually served. */
  function stop() {
    const served = phase === 'focus' && !paused
      ? elapsedRef.current + (focusMinutes * 60 - remaining)
      : elapsedRef.current;

    elapsedRef.current = 0;
    deadlineRef.current = null;
    setPhase('idle');
    setPaused(false);
    setRound(1);
    setRemaining(focusMinutes * 60);

    if (served >= 60) void logFocus(served);
  }

  function skipBreak() {
    setPhase('focus');
    setRound((r) => (r >= ROUNDS ? 1 : r + 1));
    deadlineRef.current = Date.now() + focusMinutes * 60_000;
    setRemaining(focusMinutes * 60);
  }

  const total = phase === 'break' ? breakMinutes * 60 : focusMinutes * 60;
  const progress = total > 0 ? 1 - remaining / total : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  const size = 200;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <Card as="section">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Icon.clock size={18} className="text-[var(--accent)]" />
            {t.momentum.focusTitle}
          </span>
        }
        subtitle={t.momentum.focusSub}
      />

      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-inset)" strokeWidth={stroke} />
            <circle
              cx={size / 2} cy={size / 2} r={r}
              fill="none"
              stroke={phase === 'break' ? 'var(--positive)' : 'var(--accent)'}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference * progress} ${circumference}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dasharray 500ms linear' }}
            />
          </svg>

          <div className="absolute inset-0 grid place-content-center text-center">
            <span
              className="font-display text-5xl font-semibold tabular-nums leading-none"
              role="timer"
              aria-live="off"
            >
              {mm}:{ss}
            </span>
            <span className="text-xs text-[var(--text-muted)] mt-2 uppercase tracking-wider">
              {phase === 'break' ? t.momentum.focusBreak : t.momentum.focusWork}
            </span>
            {phase !== 'idle' ? (
              <span className="text-xs text-[var(--text-muted)] mt-0.5">
                {tf(t.momentum.focusRound, { n: round, total: ROUNDS })}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mt-5">
          {phase === 'idle' ? (
            <Button onClick={start} size="lg" disabled={saving}>
              <Icon.play size={17} />
              {t.momentum.focusStart}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={togglePause}>
                {paused ? <Icon.play size={16} /> : <Icon.pause size={16} />}
                {paused ? t.momentum.focusResume : t.momentum.focusPause}
              </Button>
              {phase === 'break' ? (
                <Button variant="secondary" onClick={skipBreak}>{t.momentum.focusSkip}</Button>
              ) : null}
              <Button variant="danger" onClick={stop} loading={saving}>
                <Icon.stop size={16} />
                {t.momentum.focusStop}
              </Button>
            </>
          )}
        </div>
      </div>

      {phase === 'idle' ? (
        <div className="mt-6 pt-5 border-t border-[var(--border-subtle)] space-y-4">
          <div>
            <p className="text-[0.8125rem] font-medium mb-1.5">{t.momentum.focusLength}</p>
            <SegmentedControl
              label={t.momentum.focusLength}
              value={String(focusMinutes)}
              onChange={(v) => setFocusMinutes(Number(v))}
              options={FOCUS_OPTIONS.map((m) => ({ value: String(m), label: `${m}m` }))}
            />
          </div>
          <div>
            <p className="text-[0.8125rem] font-medium mb-1.5">{t.momentum.breakLength}</p>
            <SegmentedControl
              label={t.momentum.breakLength}
              value={String(breakMinutes)}
              onChange={(v) => setBreakMinutes(Number(v))}
              options={BREAK_OPTIONS.map((m) => ({ value: String(m), label: `${m}m` }))}
            />
          </div>
          {courses.length ? (
            <Select
              label={t.momentum.focusCourse}
              options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
              placeholder={t.common.noCourse}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
