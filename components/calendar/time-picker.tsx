'use client';

import { toClockParts, toStoredTime, type Meridiem } from '@/lib/time/when';
import { cx } from '@/components/ui/primitives';

/**
 * A time, chosen the way a clock is read here: hour, minutes, AM or PM.
 *
 * The browser's own `type="time"` renders 24-hour or 12-hour depending on the
 * machine's locale, which meant the same field asked two different questions
 * on two laptops in the same room. This asks one.
 *
 * The value in and out is always 24-hour "HH:MM" — the shape the column
 * stores — so nothing downstream has to know this component exists.
 */
export function TimePicker({
  label, value, onChange, hint, invalid,
}: {
  label: string;
  /** 24-hour "HH:MM", or empty for no time. */
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  invalid?: boolean;
}) {
  const parts = toClockParts(value) ?? { hour: 9, minute: 0, meridiem: 'AM' as Meridiem };
  const set = (next: Partial<typeof parts>) => {
    const stored = toStoredTime({ ...parts, ...next });
    if (stored) onChange(stored);
  };

  const field = cx(
    'h-10 px-2 rounded-[var(--radius-sm)] border bg-[var(--bg-surface)] text-sm',
    'outline-none focus:ring-2 focus:ring-[var(--accent)]/25',
    invalid ? 'border-[var(--danger)]' : 'border-[var(--border-subtle)] focus:border-[var(--accent)]',
  );

  return (
    <div>
      <span className="block text-[0.8125rem] font-medium mb-1.5">{label}</span>

      <div className="flex items-center gap-1.5">
        <select
          aria-label={`${label} — hour`}
          value={parts.hour}
          onChange={(e) => set({ hour: Number(e.target.value) })}
          className={cx(field, 'w-[4.25rem]')}
        >
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>

        <span aria-hidden="true" className="text-[var(--text-muted)]">:</span>

        <select
          aria-label={`${label} — minute`}
          value={parts.minute}
          onChange={(e) => set({ minute: Number(e.target.value) })}
          className={cx(field, 'w-[4.5rem]')}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
          ))}
        </select>

        {/* Two buttons rather than a third dropdown: this is the part people
            get wrong, and it should be one press with both options in view. */}
        <div role="radiogroup" aria-label={`${label} — AM or PM`} className="flex gap-1 ms-1">
          {(['AM', 'PM'] as const).map((m) => {
            const selected = parts.meridiem === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => set({ meridiem: m })}
                className={cx(
                  'h-10 px-3 rounded-[var(--radius-sm)] border text-sm font-medium transition-colors',
                  selected
                    ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)]',
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {hint ? <span className="block text-xs text-[var(--text-muted)] mt-1">{hint}</span> : null}
    </div>
  );
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * Every minute of the hour.
 *
 * This used to offer five-minute steps on the theory that nobody wants 10:37.
 * They do: a lecture ends at 10:50, a bus goes at 7:42, and a picker that
 * cannot say so is a picker you have to work around.
 */
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
