/**
 * Times as people write them, and times as the database stores them.
 *
 * Storage is 24-hour "HH:MM" because that sorts and compares; the screen is
 * 12-hour with AM/PM because that is what everyone here reads a clock as. The
 * conversion lives in one place so a reminder set for 7 in the evening cannot
 * arrive at seven in the morning.
 *
 * Pure, and with no clock of its own — "now" arrives as an argument, so a test
 * can stand at any minute of any day, and so nothing here can read the
 * server's timezone by accident.
 */

export type Meridiem = 'AM' | 'PM';

export interface ClockParts {
  /** 1–12, as shown. */
  hour: number;
  minute: number;
  meridiem: Meridiem;
}

/** "19:05" → 7:05 PM. Anything unparseable comes back null rather than as midnight. */
export function toClockParts(value: string | null | undefined): ClockParts | null {
  if (!value) return null;
  const m = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;

  const h24 = Number(m[1]);
  const minute = Number(m[2]);
  const meridiem: Meridiem = h24 >= 12 ? 'PM' : 'AM';
  const hour = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour, minute, meridiem };
}

/** 7:05 PM → "19:05". Out-of-range parts come back null rather than wrapping. */
export function toStoredTime(parts: ClockParts): string | null {
  const { hour, minute, meridiem } = parts;
  if (!Number.isInteger(hour) || hour < 1 || hour > 12) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  const h24 = meridiem === 'PM'
    ? (hour === 12 ? 12 : hour + 12)
    : (hour === 12 ? 0 : hour);

  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** "19:05" → "7:05 PM", for reading back. */
export function formatClock(value: string | null | undefined, arabic = false): string {
  const parts = toClockParts(value);
  if (!parts) return '';
  const suffix = arabic
    ? (parts.meridiem === 'AM' ? 'ص' : 'م')
    : parts.meridiem;
  return `${parts.hour}:${String(parts.minute).padStart(2, '0')} ${suffix}`;
}

/**
 * Whether a day and time have already passed.
 *
 * A reminder for a moment that is gone is not a reminder, it is a note — and
 * the form should say so before it is saved rather than after. A day with no
 * time is judged by the day alone, so "today, sometime" is still ahead.
 */
export function isPast(
  dayIso: string, time: string | null | undefined, now: Date,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayIso)) return false;

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (dayIso < today) return true;
  if (dayIso > today) return false;
  if (!time) return false;

  const parts = time.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!parts) return false;

  const minutesAt = Number(parts[1]) * 60 + Number(parts[2]);
  return minutesAt < now.getHours() * 60 + now.getMinutes();
}

/** Today, as the browser's own calendar reads it. For a date input's `min`. */
export function todayIso(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
