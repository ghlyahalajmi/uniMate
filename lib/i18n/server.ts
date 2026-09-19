import { cookies } from 'next/headers';
import { dictionaries, dirFor, type Dictionary, type Locale } from './dictionaries';
import { LOCALE_COOKIE, resolveLocale } from './format';

/** Reads the locale cookie on the server so the first paint is already correct. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return resolveLocale(store.get(LOCALE_COOKIE)?.value);
}

export async function getDictionary(): Promise<{ locale: Locale; t: Dictionary; dir: 'ltr' | 'rtl' }> {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] as Dictionary, dir: dirFor(locale) };
}
