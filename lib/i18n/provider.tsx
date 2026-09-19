'use client';

import { createContext, useCallback, useContext, useMemo, useTransition } from 'react';
import { dictionaries, dirFor, type Dictionary, type Locale } from './dictionaries';
import { LOCALE_COOKIE, formatDate, formatNumber, formatTime, interpolate } from './format';

interface I18nValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  t: Dictionary;
  /** Dictionary string with `{placeholder}` substitution. */
  tf: (template: string, values?: Record<string, string | number>) => string;
  setLocale: (next: Locale) => void;
  isSwitching: boolean;
  formatDate: (v: string | Date | null | undefined, o?: Intl.DateTimeFormatOptions) => string;
  formatTime: (v: string | null | undefined) => string;
  formatNumber: (v: number | null | undefined, o?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const [isSwitching, startTransition] = useTransition();

  const setLocale = useCallback((next: Locale) => {
    // A year-long cookie; the server layout reads it to set <html lang/dir>.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => {
      // Full reload so the document direction and server-rendered copy both flip.
      window.location.reload();
    });
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = dictionaries[locale] as Dictionary;
    return {
      locale,
      dir: dirFor(locale),
      t,
      tf: (template, values) => interpolate(template, values),
      setLocale,
      isSwitching,
      formatDate: (v, o) => formatDate(v, locale, o),
      formatTime: (v) => formatTime(v, locale),
      formatNumber: (v, o) => formatNumber(v, locale, o),
    };
  }, [locale, setLocale, isSwitching]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
