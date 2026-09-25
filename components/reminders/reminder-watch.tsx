'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';
import { Icon } from '@/components/shell/icons';
import { cx } from '@/components/ui/primitives';
import { formatClock } from '@/lib/time/when';

/**
 * The reminder — and the missed deadline — that arrives while the app is open.
 *
 * A reminder nobody is told about is a row in a table, and so is an overdue
 * task: "Overdue" was a red word on a list, and the student who missed the
 * deadline is exactly the student not looking at that list. This asks the
 * server once a minute whether anything is due or late — by the browser's own
 * clock, because 7pm means 7pm where the student is, and a task due today is
 * not late until today is over — and when something is, it plays a short chime
 * and puts a card on the screen until it is dismissed.
 *
 * Announced reminders are marked on the server, so the same one does not greet
 * them again on every page they open for the rest of the day. That is the
 * difference between a reminder and a nag.
 */

interface Due {
  id: string;
  /** A reminder that has arrived, or a task whose day has gone. */
  kind?: 'reminder' | 'task';
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
   * It is loud on purpose — a reminder nobody hears from the next room is a
   * card nobody was looking at.
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

      /*
       * A limiter across the whole chime.
       *
       * Loud is not one number turned up — three notes and their harmonics
       * stacking at full gain is what makes a sound distort rather than carry.
       * Everything goes through this first, so the notes can be driven hard
       * and the peak still lands where it was aimed.
       */
      const out = ctx.createDynamicsCompressor();
      out.threshold.value = -8;
      out.ratio.value = 12;
      out.attack.value = 0.003;
      out.connect(ctx.destination);

      // Three notes rising, rather than two: a longer shape carries across a
      // room and through a laptop speaker better than a louder short one.
      [880, 1174.66, 1567.98].forEach((hz, i) => {
        const at = now + i * 0.16;

        // The note, and a quieter octave above it. The harmonic is what makes
        // a sine read as bright at the far end of a room — a bare sine at the
        // same level sounds softer than it measures.
        ([
          { type: 'sine' as OscillatorType, hz, peak: 0.55 },
          { type: 'triangle' as OscillatorType, hz: hz * 2, peak: 0.16 },
        ]).forEach(({ type, hz: freq, peak }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.62);
          osc.connect(gain).connect(out);
          osc.start(at);
          osc.stop(at + 0.66);
        });
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

  /*
   * Ask the browser to re-check the service worker whenever the app opens.
   *
   * A worker already installed on a phone keeps running the code it was
   * installed with, and a browser only looks for a new one when it feels like
   * it. That is how a student ends up with a version of the notification
   * logic we stopped shipping — the fix is deployed and their phone has never
   * heard of it. This costs one conditional request and takes the new worker
   * on the next open rather than the next day.
   */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker
      .getRegistration('/sw.js')
      .then((reg) => reg?.update())
      .catch(() => {
        // Nothing registered, or the browser refused. Neither is worth a word.
      });
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
      {due.map((d) => {
        /*
         * A missed deadline is not the same message as a reminder, and it
         * should not look like one. Red rather than amber, "you missed this"
         * rather than the time it was set for, and a way straight to the list
         * — the point of telling somebody is that they can act on it.
         */
        const late = d.kind === 'task';

        return (
          <div
            key={d.id}
            className={cx(
              'pointer-events-auto w-full max-w-[420px] flex items-start gap-3 p-3.5',
              'rounded-[var(--radius-md)] bg-[var(--bg-surface)]',
              late ? 'border border-[var(--danger-border)]' : 'border border-[var(--warning-border)]',
              'shadow-[var(--shadow-float)] animate-mark-node',
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                'shrink-0 w-9 h-9 grid place-items-center rounded-full',
                late
                  ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                  : 'bg-[var(--warning-soft)] text-[var(--warning)]',
              )}
            >
              {late ? <Icon.alert size={18} /> : <Icon.bell size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cx(
                'text-[0.6875rem] font-semibold uppercase tracking-wide',
                late ? 'text-[var(--danger)]' : 'text-[var(--warning)]',
              )}>
                {late ? t.tasks.overdueAlert : t.calendar.reminderDueNow}
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
              {late ? (
                <Link
                  href="/tasks"
                  onClick={() => setDue((prev) => prev.filter((x) => x.id !== d.id))}
                  className="inline-block text-xs font-medium mt-1.5 text-[var(--danger)] underline underline-offset-2"
                >
                  {t.tasks.overdueOpen}
                </Link>
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
        );
      })}
    </div>
  );
}
