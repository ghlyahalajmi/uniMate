'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Icon } from '@/components/shell/icons';
import { cx } from '@/components/ui/primitives';
import { formatClock } from '@/lib/time/when';

/**
 * The reminder that arrives while the app is open.
 *
 * A reminder nobody is told about is a row in a table. This asks the server
 * once a minute whether anything is due — by the browser's own clock, because
 * 7pm means 7pm where the student is — and when something is, it plays a short
 * chime and puts a card on the screen until it is dismissed.
 *
 * Announced reminders are marked on the server, so the same one does not greet
 * them again on every page they open for the rest of the day. That is the
 * difference between a reminder and a nag.
 */

interface Due {
  id: string;
  title: string;
  body: string | null;
  at: string | null;
}

const EVERY_MS = 60_000;

/**
 * One audio context for the page.
 *
 * Browsers cap how many a page may create — a handful — and creating one per
 * chime silently stops working after the first few. Kept at module scope so it
 * survives the component remounting on navigation.
 */
let shared: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (shared) return shared;
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  shared = new Ctor();
  return shared;
}

export function ReminderWatch() {
  const { t, locale } = useI18n();
  const [due, setDue] = useState<Due[]>([]);
  const seen = useRef<Set<string>>(new Set());

  /**
   * Two notes, from the Web Audio API.
   *
   * No audio file: an asset would be another request and another thing to 404,
   * and this needs to be a second long and unmistakable rather than pretty.
   *
   * Two things this gets wrong if written the obvious way, and both were wrong
   * here. A browser starts an audio context *suspended* until the page has
   * been interacted with, and a suspended context plays nothing while
   * reporting no error — so the first chime was silent. And a new context per
   * chime hits the browser's limit of a handful per page, after which creating
   * one fails and every later chime is silent too. So: one context for the
   * life of the page, woken on the first click or key the student makes, and
   * resumed again before each use in case the browser put it back to sleep.
   */
  const chime = useCallback(async () => {
    try {
      const ctx = audioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state !== 'running') return;

      const now = ctx.currentTime;
      [880, 1174.66].forEach((hz, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(0.0001, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.55);
      });
    } catch {
      // Audio is the flourish; the card is the message.
    }
  }, []);

  /*
   * Wake the audio context on the first thing the student does.
   *
   * Browsers only allow sound after a genuine interaction. Waiting until the
   * reminder is due is too late: by then the click that would have permitted
   * it happened minutes ago and the context is still asleep.
   */
  useEffect(() => {
    const unlock = () => {
      const ctx = audioContext();
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  const check = useCallback(async () => {
    try {
      const now = new Date();
      const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const response = await fetch(`/api/reminders/due?day=${day}&time=${time}`);
      if (!response.ok) return;

      const payload = (await response.json()) as { due?: Due[] };
      const fresh = (payload.due ?? []).filter((d) => !seen.current.has(d.id));
      if (fresh.length === 0) return;

      fresh.forEach((d) => seen.current.add(d.id));
      setDue((prev) => [...fresh, ...prev].slice(0, 4));
      void chime();

      // Told once. The server remembers, so a refresh does not repeat it.
      await fetch('/api/reminders/due', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: fresh.map((d) => d.id) }),
      });
    } catch {
      // Offline, or signed out. Either way there is nothing to announce.
    }
  }, [chime]);

  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), EVERY_MS);
    // A laptop that was asleep at the due minute should hear about it on wake.
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  if (due.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-[60] bottom-24 lg:bottom-6 inset-x-0 px-4 flex flex-col items-center gap-2 pointer-events-none"
    >
      {due.map((d) => (
        <div
          key={d.id}
          className={cx(
            'pointer-events-auto w-full max-w-[420px] flex items-start gap-3 p-3.5',
            'rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--bg-surface)]',
            'shadow-[var(--shadow-float)] animate-mark-node',
          )}
        >
          <span
            aria-hidden="true"
            className="shrink-0 w-9 h-9 grid place-items-center rounded-full bg-[var(--warning-soft)] text-[var(--warning)]"
          >
            <Icon.bell size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--warning)]">
              {t.calendar.reminderDueNow}
            </p>
            <p className="text-sm font-medium mt-0.5 break-words">{d.title}</p>
            {d.at ? (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {formatClock(d.at, locale === 'ar')}
              </p>
            ) : null}
            {d.body ? (
              <p className="text-xs text-[var(--text-secondary)] mt-1 break-words">{d.body}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setDue((prev) => prev.filter((x) => x.id !== d.id))}
            aria-label={t.common.close}
            className="shrink-0 w-7 h-7 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-inset)]"
          >
            <Icon.close size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
