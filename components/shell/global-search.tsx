'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Icon } from '@/components/shell/icons';
import { NAV_ITEMS, type NavItem } from '@/components/shell/nav-config';
import { cx } from '@/components/ui/primitives';
import type { SearchHit, SearchKind } from '@/lib/search/query';

/**
 * Search, in the space at the end of the tabs.
 *
 * Two kinds of answer, in one list. Screens are matched here in the browser
 * from the same nav table the tabs are built from, so "grades" lands
 * instantly and in the student's own language. Records — courses, tasks,
 * notes, assessments, exam dates, reminders, cards — come from /api/search,
 * which runs the query on the caller's own session, so the box can only ever
 * find things that belong to the person typing.
 *
 * Arrow keys move, Enter opens, Escape closes, and every request but the last
 * is aborted, so a fast typist never sees an earlier query's answers land on
 * top of a later one.
 */

type Row =
  | { type: 'page'; key: string; title: string; href: string; icon: NavItem['icon'] }
  | { type: 'record'; key: string; hit: SearchHit };

const KIND_ICON: Record<SearchKind, NavItem['icon']> = {
  course: 'courses',
  task: 'tasks',
  note: 'notes',
  grade: 'grades',
  event: 'calendar',
  reminder: 'calendar',
  flashcard: 'study',
};

export function GlobalSearch({ className }: { className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const listId = useId();

  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  /**
   * The answer is stored with the question it answers. Whether the list is
   * current is then something to read rather than something to keep in step:
   * no clearing on every keystroke, and a late reply for an older term simply
   * stops matching instead of flashing on screen.
   */
  const [results, setResults] = useState<{ term: string; hits: SearchHit[] }>({ term: '', hits: [] });
  const [cursor, setCursor] = useState(0);

  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = term.trim();
  const busy = query.length >= 2 && results.term !== query;

  // Screens, matched on the label the student is actually reading.
  const pages: Row[] = useMemo(() => {
    if (query.length < 1) return [];
    const needle = query.toLowerCase();
    return NAV_ITEMS
      .filter((item) => item.label(t).toLowerCase().includes(needle))
      .slice(0, 4)
      .map((item) => ({
        type: 'page' as const,
        key: `page:${item.href}`,
        title: item.label(t),
        href: item.href,
        icon: item.icon,
      }));
  }, [query, t]);

  const rows: Row[] = useMemo(() => {
    // Only the answer to the question being asked. A reply for an older term
    // is still in hand but is not this list.
    const hits = results.term === query ? results.hits : [];
    return [
      ...pages,
      ...hits.map((hit) => ({ type: 'record' as const, key: `${hit.kind}:${hit.id}`, hit })),
    ];
  }, [pages, results, query]);

  // Records. Debounced, and the previous request is abandoned rather than
  // raced: an answer to "ma" must never overwrite the answer to "math".
  useEffect(() => {
    if (query.length < 2) return;

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as { ok?: boolean; hits?: SearchHit[] };
        if (!controller.signal.aborted) {
          setResults({ term: query, hits: response.ok && payload.hits ? payload.hits : [] });
        }
      } catch {
        // An aborted request is the normal case here, not a failure.
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Clicking anywhere else puts the list away.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // The shortcut people try first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const active = rows.length === 0 ? 0 : Math.min(cursor, rows.length - 1);

  const go = useCallback((row: Row) => {
    setOpen(false);
    setTerm('');
    setCursor(0);
    inputRef.current?.blur();
    router.push(row.type === 'page' ? row.href : row.hit.href);
  }, [router]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || rows.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((active + 1) % rows.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((active - 1 + rows.length) % rows.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[active];
      if (row) go(row);
    }
  };

  const showPanel = open && query.length > 0;

  return (
    <div ref={boxRef} className={cx('relative', className)}>
      <span
        aria-hidden="true"
        className="absolute inset-y-0 start-2.5 grid place-items-center text-[var(--text-muted)] pointer-events-none"
      >
        <Icon.search size={16} />
      </span>

      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-label={t.search.label}
        placeholder={t.search.placeholder}
        value={term}
        onChange={(e) => { setTerm(e.target.value); setCursor(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={cx(
          'w-full h-9 ps-8 pe-3 rounded-full text-sm',
          'bg-[var(--bg-inset)] border border-[var(--border-subtle)]',
          'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
          'outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25',
          '[&::-webkit-search-cancel-button]:appearance-none',
        )}
      />

      {showPanel ? (
        <div
          className={cx(
            'absolute top-[calc(100%+6px)] end-0 w-[min(92vw,380px)] z-40',
            'rounded-[var(--radius-md)] border border-[var(--border-subtle)]',
            'bg-[var(--bg-surface)] shadow-[var(--shadow-float)] overflow-hidden',
          )}
        >
          <ul id={listId} role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
            {rows.map((row, i) => {
              const Glyph = Icon[row.type === 'page' ? row.icon : KIND_ICON[row.hit.kind]];
              const title = row.type === 'page' ? row.title : row.hit.title;
              const subtitle = row.type === 'page' ? t.search.page : row.hit.subtitle;
              return (
                <li key={row.key} role="option" aria-selected={i === cursor}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(row)}
                    className={cx(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-start',
                      i === active ? 'bg-[var(--bg-inset)]' : '',
                    )}
                  >
                    <span aria-hidden="true" className="shrink-0 text-[var(--text-muted)]">
                      <Glyph size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm truncate">{title}</span>
                      {subtitle ? (
                        <span className="block text-xs text-[var(--text-muted)] truncate">{subtitle}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}

            {rows.length === 0 ? (
              <li className="px-3 py-3 text-sm text-[var(--text-muted)]">
                {busy || query.length < 2 ? t.search.typing : t.search.empty}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
