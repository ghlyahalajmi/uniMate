'use client';

import { useBrowserNow } from '@/lib/time/clock';
import { greetingFor, type GreetingKey } from '@/lib/time/greeting';

/**
 * A single ambient wash behind the Student Hub that shifts with the hour.
 *
 * Deliberately one low-opacity layer rather than a theme: the palette, the
 * cards and the type are untouched, so the page is recognisably the same at
 * 07:00 and 23:00 — it just feels cooler in the morning and warmer at night.
 *
 * Light and dark are handled by mixing against `--bg-app`, so the wash is
 * never brighter than the surface it sits on, and it stays under the content
 * with pointer events off. On the server it renders nothing at all rather
 * than guessing an hour.
 */
const TINT: Record<GreetingKey, string> = {
  // Cool and pale — the light coming up.
  morning: 'var(--color-sage-600, #4c9c7d)',
  // The accent itself: the brightest, most ordinary working hours.
  afternoon: 'var(--accent)',
  // Warm, low sun.
  evening: 'var(--color-brass-600, #b58a3c)',
  // Deep and quiet, and the faintest of the four.
  night: 'var(--color-violet-600, #4f46e5)',
};

const STRENGTH: Record<GreetingKey, number> = {
  morning: 0.07, afternoon: 0.06, evening: 0.09, night: 0.05,
};

export function DaypartGlow() {
  const now = useBrowserNow(60_000);
  if (now === 0) return null;

  const part = greetingFor(new Date(now).getHours());

  return (
    <div
      aria-hidden="true"
      data-daypart={part}
      className="pointer-events-none fixed inset-x-0 top-0 h-[42vh] -z-10 transition-opacity duration-1000"
      style={{
        background: `radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, ${TINT[part]} ${STRENGTH[part] * 100}%, transparent) 0%, transparent 70%)`,
      }}
    />
  );
}
