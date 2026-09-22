'use client';

import { useState } from 'react';
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

  /*
   * What is typed, before it is a number.
   *
   * The field has to show "0" while someone is on their way to "07", so the
   * keystrokes live here and the padded value is what leaves. `emitted`
   * remembers what this component last sent up: when the incoming value is
   * something else, the form was reset from outside and the draft follows it.
   * Without that check, every keystroke would come back padded and the caret
   * would jump.
   */
  const [draft, setDraft] = useState(() => pad(parts.minute));
  const [emitted, setEmitted] = useState(value);
  if (value !== emitted) {
    setEmitted(value);
    setDraft(pad(parts.minute));
  }

  const set = (next: Partial<typeof parts>) => {
    const stored = toStoredTime({ ...parts, ...next });
    if (!stored) return;
    setEmitted(stored);
    if (next.minute !== undefined) setDraft(pad(next.minute));
    onChange(stored);
  };

  /** Digits only, and never past 59 — 7 then 5 is 7 minutes past, not 75. */
  const type = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setDraft(digits);
    const minute = Number(digits);
    if (digits === '' || minute > 59) return;
    const stored = toStoredTime({ ...parts, minute });
    if (stored) { setEmitted(stored); onChange(stored); }
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

        {/* Typed, not scrolled. A list of sixty is a list nobody reads to the
            end of: 10:47 took four seconds of dragging to reach. Two keys now,
            and the four minutes anyone actually picks are the buttons below. */}
        <input
          aria-label={`${label} — minute`}
          inputMode="numeric"
          autoComplete="off"
          value={draft}
          onChange={(e) => type(e.target.value)}
          onBlur={() => setDraft(pad(parts.minute))}
          onFocus={(e) => e.currentTarget.select()}
          className={cx(field, 'w-[3.25rem] text-center tabular-nums')}
        />

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

      <div className="flex gap-1 mt-1.5">
        {QUARTERS.map((m) => {
          const selected = parts.minute === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={selected}
              onClick={() => set({ minute: m })}
              className={cx(
                'h-7 px-2 rounded-[var(--radius-sm)] border text-xs tabular-nums transition-colors',
                selected
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
              )}
            >
              :{pad(m)}
            </button>
          );
        })}
      </div>

      {hint ? <span className="block text-xs text-[var(--text-muted)] mt-1">{hint}</span> : null}
    </div>
  );
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** The minutes a reminder is actually set to. Every other one is typed. */
const QUARTERS = [0, 15, 30, 45];

function pad(minute: number): string {
  return String(minute).padStart(2, '0');
}
