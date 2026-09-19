import { DEFAULT_LOCALE, LOCALES, type Locale } from './dictionaries';

export const LOCALE_COOKIE = 'unimate-locale';

export function resolveLocale(value: string | undefined | null): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

/**
 * Arabic here uses Latin digits (`-u-nu-latn`). Grades, weights and GPA read
 * more clearly in a mixed-script academic interface, and it matches how these
 * figures are printed on Kuwaiti transcripts.
 */
function intlLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB';
}

export function formatDate(
  value: string | Date | null | undefined,
  locale: Locale,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), opts).format(d);
}

/** Formats a bare `HH:MM[:SS]` time column without pulling in a timezone. */
export function formatTime(value: string | null | undefined, locale: Locale): string {
  if (!value) return '—';
  const [h, m] = value.split(':');
  const hour = Number(h);
  const minute = Number(m ?? '0');
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const d = new Date(2000, 0, 1, hour, minute);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

export function formatNumber(
  value: number | null | undefined,
  locale: Locale,
  opts: Intl.NumberFormatOptions = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(intlLocale(locale), opts).format(value);
}

/** Whole days between today and `value`; negative when the date has passed. */
export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);
}

export function formatRelativeDays(days: number, locale: Locale): string {
  return new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' }).format(days, 'day');
}

/** Replaces `{name}` placeholders in a dictionary string. */
export function interpolate(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
