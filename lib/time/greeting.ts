/**
 * Which greeting belongs to an hour, and nothing else.
 *
 * Pure and hour-in, key-out, so the bands are testable and the same rule can
 * be used on the server and in the browser. The bug this replaces was not the
 * bands but *whose* clock was read: the hour was taken during server render,
 * so a student in Kuwait at 21:00 saw the Virginia server's afternoon.
 */
export type GreetingKey = 'morning' | 'afternoon' | 'evening' | 'night';

export function greetingFor(hour: number): GreetingKey {
  // Anything not a real hour falls to morning rather than throwing: a greeting
  // is decoration, and a crash here would take the whole dashboard with it.
  if (!Number.isFinite(hour)) return 'morning';
  const h = Math.floor(hour);
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}
