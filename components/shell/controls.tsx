'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { LOCALES } from '@/lib/i18n';
import { Icon } from './icons';
import { cx } from '@/components/ui/primitives';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t, isSwitching } = useI18n();
  const next = LOCALES.find((l) => l !== locale) ?? 'en';

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      disabled={isSwitching}
      aria-label={t.a11y.toggleLanguage}
      title={t.a11y.toggleLanguage}
      className={cx(
        'inline-flex items-center gap-2 rounded-[var(--radius-sm)] text-sm font-medium',
        'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-inset)]',
        'transition-colors min-h-[40px]',
        compact ? 'px-2.5' : 'px-3 w-full',
      )}
    >
      <Icon.globe size={18} />
      <span>{next === 'ar' ? 'العربية' : 'English'}</span>
    </button>
  );
}

type Theme = 'light' | 'dark';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('unimate-theme');
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
      return;
    }
    setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('unimate-theme', next); } catch { /* private mode */ }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.a11y.toggleTheme}
      title={t.a11y.toggleTheme}
      className={cx(
        'inline-flex items-center gap-2 rounded-[var(--radius-sm)] text-sm font-medium',
        'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-inset)]',
        'transition-colors min-h-[40px]',
        compact ? 'px-2.5' : 'px-3 w-full',
      )}
    >
      {theme === 'dark' ? <Icon.sun size={18} /> : <Icon.moon size={18} />}
      <span>{theme === 'dark' ? t.settings.light : t.settings.dark}</span>
    </button>
  );
}

export function SkipLink() {
  const { t } = useI18n();
  return (
    <a
      href="#main"
      className={cx(
        'sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[70]',
        'focus:px-4 focus:py-2.5 focus:rounded-[var(--radius-sm)]',
        'focus:bg-[var(--accent)] focus:text-white focus:shadow-[var(--shadow-float)] focus:text-sm',
      )}
    >
      {t.a11y.skipToContent}
    </a>
  );
}
