/**
 * Normalisers used when importing scanned or uploaded data.
 *
 * Each one returns the cleaned value plus a reason, so the caller can write a
 * cleaning_log row. Nothing is cleaned silently — if a value changes, there is
 * a record of what changed and why.
 */

export interface CleaningDecision {
  field: string;
  original: string;
  cleaned: string;
  reason: string;
}

export interface CleanResult<T> {
  value: T;
  decisions: CleaningDecision[];
}

/** `CE 301` / `ce-301` → `CE301`. */
export function cleanCourseCode(raw: string): CleanResult<string> {
  const original = raw;
  const cleaned = raw.trim().replace(/[\s\-_.]+/g, '').toUpperCase();
  const decisions: CleaningDecision[] = [];

  if (cleaned !== original) {
    decisions.push({
      field: 'course_code',
      original,
      cleaned,
      reason: /\s/.test(original)
        ? 'Removed inconsistent spacing from the course code.'
        : 'Normalised the course code to uppercase without separators.',
    });
  }
  return { value: cleaned, decisions };
}

/** `10.00 AM`, `2:30 pm`, `1000` → `10:00`, `14:30`. */
export function cleanTime(raw: string): CleanResult<string | null> {
  const original = raw;
  const text = raw.trim().toLowerCase();
  const decisions: CleaningDecision[] = [];

  if (!text) return { value: null, decisions };

  const meridiem = /\b(am|pm)\b/.exec(text)?.[1];
  const digits = text.replace(/[^0-9]/g, '');

  let hour: number;
  let minute: number;

  const separated = /(\d{1,2})\s*[:.٫]\s*(\d{2})/.exec(text);
  if (separated) {
    hour = Number(separated[1]);
    minute = Number(separated[2]);
  } else if (digits.length === 4) {
    hour = Number(digits.slice(0, 2));
    minute = Number(digits.slice(2));
  } else if (digits.length > 0 && digits.length <= 2) {
    hour = Number(digits);
    minute = 0;
  } else {
    return { value: null, decisions };
  }

  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;

  if (hour > 23 || minute > 59) return { value: null, decisions };

  const cleaned = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  if (cleaned !== original.trim()) {
    decisions.push({
      field: 'time',
      original,
      cleaned,
      reason: meridiem
        ? 'Converted the scanned time to 24-hour format.'
        : 'Normalised the scanned time to HH:MM.',
    });
  }
  return { value: cleaned, decisions };
}

/** `3 Credits`, `3.0 cr`, `٣` → `3`. */
export function cleanCredits(raw: string): CleanResult<number | null> {
  const original = raw;
  const latin = toLatinDigits(raw);
  const match = /(\d+(?:\.\d+)?)/.exec(latin);
  const decisions: CleaningDecision[] = [];

  if (!match) return { value: null, decisions };

  const value = Number(match[1]);
  if (String(value) !== original.trim()) {
    decisions.push({
      field: 'credits',
      original,
      cleaned: String(value),
      reason: 'Extracted the numeric credit value from the scanned text.',
    });
  }
  return { value, decisions };
}

/** `25 %` → `25`. */
export function cleanWeight(raw: string): CleanResult<number | null> {
  const original = raw;
  const latin = toLatinDigits(raw);
  const match = /(\d+(?:\.\d+)?)/.exec(latin);
  const decisions: CleaningDecision[] = [];

  if (!match) return { value: null, decisions };
  const value = Number(match[1]);

  if (String(value) !== original.trim()) {
    decisions.push({
      field: 'weight',
      original,
      cleaned: String(value),
      reason: 'Stripped the percent sign so the weight stores as a number.',
    });
  }
  return { value, decisions };
}

/** `lab b2` → `Lab B2`; `dr. ahmad al-sabah` → `Dr. Ahmad Al-Sabah`. */
export function cleanTitleCase(raw: string, field: string): CleanResult<string | null> {
  const original = raw;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  const decisions: CleaningDecision[] = [];

  if (!trimmed) return { value: null, decisions };

  // Leave anything that already mixes cases alone — it is probably deliberate.
  const looksUntouched = trimmed === trimmed.toLowerCase() || trimmed === trimmed.toUpperCase();
  const cleaned = looksUntouched ? titleCase(trimmed) : trimmed;

  if (cleaned !== original) {
    decisions.push({
      field,
      original,
      cleaned,
      reason: looksUntouched
        ? `Applied title case to the ${field.replace(/_/g, ' ')}.`
        : `Removed extra spacing from the ${field.replace(/_/g, ' ')}.`,
    });
  }
  return { value: cleaned, decisions };
}

function titleCase(text: string): string {
  return text
    .split(' ')
    .map((word) =>
      word
        .split('-')
        .map((part) =>
          part.length === 0
            ? part
            : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
        )
        .join('-'),
    )
    .join(' ');
}

/** Arabic-Indic and Eastern Arabic-Indic digits to 0-9. */
export function toLatinDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

const DAY_ALIASES: Record<string, string> = {
  sun: 'sunday', sunday: 'sunday', 'الأحد': 'sunday', 'الاحد': 'sunday',
  mon: 'monday', monday: 'monday', 'الاثنين': 'monday', 'الإثنين': 'monday',
  tue: 'tuesday', tues: 'tuesday', tuesday: 'tuesday', 'الثلاثاء': 'tuesday',
  wed: 'wednesday', weds: 'wednesday', wednesday: 'wednesday', 'الأربعاء': 'wednesday', 'الاربعاء': 'wednesday',
  thu: 'thursday', thur: 'thursday', thurs: 'thursday', thursday: 'thursday', 'الخميس': 'thursday',
  fri: 'friday', friday: 'friday', 'الجمعة': 'friday',
  sat: 'saturday', saturday: 'saturday', 'السبت': 'saturday',
};

/** `Sunday / Tuesday`, `Sun, Tue`, `الأحد والثلاثاء` → `['sunday','tuesday']`. */
export function cleanDays(raw: string): CleanResult<string[]> {
  const original = raw;
  const tokens = raw
    .split(/[\s,/&\u00b7|]+|\band\b/i)
    .map((t) => t.trim().toLowerCase().replace(/[.]/g, ''))
    .filter(Boolean);

  const seen = new Set<string>();
  for (const token of tokens) {
    // Arabic writes "and Tuesday" as a fused waw prefix: والثلاثاء.
    const day = DAY_ALIASES[token]
      ?? (token.startsWith('\u0648') ? DAY_ALIASES[token.slice(1)] : undefined);
    if (day) seen.add(day);
  }

  const order = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const value = order.filter((d) => seen.has(d));
  const decisions: CleaningDecision[] = [];

  if (value.length > 0 && value.join(', ') !== original.trim().toLowerCase()) {
    decisions.push({
      field: 'days',
      original,
      cleaned: value.join(', '),
      reason: 'Normalised the scanned day names to a standard weekday list.',
    });
  }
  return { value, decisions };
}
