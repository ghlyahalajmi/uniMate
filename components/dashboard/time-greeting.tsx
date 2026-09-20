'use client';

import { useSyncExternalStore } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { greetingFor, type GreetingKey } from '@/lib/time/greeting';

/**
 * The greeting, the date and the clock — all from the *browser's* time.
 *
 * The previous version called `new Date().getHours()` straight in the render
 * of a client component. Client components still render on the server first,
 * so the hour came from the server's timezone: a student in Kuwait at 21:00
 * was told "Good afternoon". The fix is not a different formula, it is
 * refusing to answer until the browser can: `now` starts null, the server
 * renders only the name, and the real time appears on mount and then ticks.
 */
export function TimeGreeting({ firstName }: { firstName: string | null }) {
  const { t, locale } = useI18n();

  // Read through an external store rather than state set from an effect: the
  // server snapshot is 0 ("not known yet") so the markup React sends matches
  // what it hydrates, and the browser's clock takes over from the first tick.
  const tick = useSyncExternalStore(subscribeToClock, clockTick, serverClockTick);
  const now = tick === 0 ? null : new Date(tick * TICK_MS);

  const key: GreetingKey | null = now ? greetingFor(now.getHours()) : null;
  const greeting = key === null ? null : GREETING[key](t);

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-[1.75rem] font-semibold leading-tight">
        {/* Before the browser answers, the name alone — never a guessed
            time of day that then flips. */}
        {greeting ? `${greeting}, ` : ''}{firstName ?? ''}{greeting || firstName ? '.' : ''}
      </h1>
      <p
        className="text-sm text-[var(--text-secondary)] mt-1 tabular-nums"
        // The clock is decoration that changes on its own; announcing every
        // tick would talk over the page.
        aria-live="off"
      >
        {now ? (
          <>
            <span>{new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}</span>
            <span className="mx-1.5 text-[var(--text-muted)]" aria-hidden="true">·</span>
            <span>{new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(now)}</span>
          </>
        ) : (
          <span className="inline-block w-40 h-4 rounded skeleton" aria-hidden="true" />
        )}
      </p>
    </div>
  );
}

/** Re-render at most four times a minute — enough for an hh:mm clock. */
const TICK_MS = 15_000;

function subscribeToClock(onChange: () => void): () => void {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
}

/**
 * A number that only changes every TICK_MS, so React sees a stable snapshot
 * between ticks rather than a new value on every read.
 */
function clockTick(): number {
  return Math.floor(Date.now() / TICK_MS);
}

/** 0 means "no clock yet" — the server has no business guessing the hour. */
function serverClockTick(): number {
  return 0;
}

const GREETING: Record<GreetingKey, (t: ReturnType<typeof useI18n>['t']) => string> = {
  morning: (t) => t.dashboard.goodMorning,
  afternoon: (t) => t.dashboard.goodAfternoon,
  evening: (t) => t.dashboard.goodEvening,
  night: (t) => t.dashboard.goodNight,
};
