'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';
import { Card, CardHeader, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icons';
import { parseDesign } from '@/lib/notes/design';
import { Sticker } from '@/components/notes/stickers';

export interface HomeNote {
  id: string;
  title: string;
  /** The first few lines, already trimmed by the page. */
  preview: string[];
  done: number;
  total: number;
  theme: string;
  tint: string;
  /** The stickers as stored, parsed here rather than trusted. */
  stickers: unknown;
}

/**
 * The notes the student pinned here, and only those.
 *
 * Nothing decides this but their switch on the note itself — not recency, not
 * length, not whether it was touched today. A home screen that fills itself is
 * one people stop reading, so the rule is "you asked for this one".
 *
 * Each note keeps the paper it was designed with, because recognising a note
 * by its colour is the whole point of having coloured it.
 */
export function HomeNotes({ notes }: { notes: HomeNote[] }) {
  const { t, tf, formatNumber } = useI18n();
  if (notes.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title={t.notes.onHomeTitle}
        subtitle={t.notes.onHomeSub}
        action={
          <Link
            href="/notes"
            className="inline-flex items-center gap-1.5 min-h-[32px] text-[0.8125rem] font-medium text-[var(--accent-soft-text)] hover:underline"
          >
            {t.nav.notes}
            <Icon.chevronEnd size={14} className="flip-rtl" />
          </Link>
        }
      />

      <ul className="grid gap-3 sm:grid-cols-2">
        {notes.map((n) => {
          // The same parser the Notes screen uses, given the same three
          // fields. A note pinned Home should be the note the student
          // decorated — same paper, same tint, same stickers where they put
          // them — not a plain copy of its text.
          const design = parseDesign({ theme: n.theme, color: n.tint, stickers: n.stickers });
          return (
            <li key={n.id} className="min-w-0">
              <Link
                href="/notes"
                aria-label={`${n.title || t.notes.untitled} — ${t.notes.onHomeOpen}`}
                className={cx(
                  'paper relative overflow-hidden h-full flex flex-col gap-2 p-3.5',
                  'rounded-[var(--radius-md)] border',
                  'border-[var(--border-subtle)] hover:border-[var(--accent)]',
                  'transition-[border-color,transform] duration-200 hover:-translate-y-0.5',
                )}
                data-tint={design.tint}
                data-pattern={design.pattern}
              >
                {/*
                  Decoration only, exactly as on the note itself when its
                  design bar is closed: hidden from assistive technology and
                  taking no pointer events, so nothing here gets between the
                  student and the card they are trying to open. Positions are
                  percentages, so a sticker sits where it was placed however
                  much narrower this card is than the note.
                */}
                {design.stickers.length > 0 ? (
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                    {design.stickers.map((st, i) => (
                      <span
                        key={`${st.k}-${i}`}
                        className="absolute select-none"
                        style={{
                          insetInlineStart: `${st.x}%`,
                          top: `${st.y}%`,
                          transform: `translate(-50%, -50%) rotate(${st.r}deg)`,
                        }}
                      >
                        <Sticker k={st.k} size={22} />
                      </span>
                    ))}
                  </span>
                ) : null}
                <span className="flex items-center gap-2 min-w-0">
                  <Icon.notes size={15} className="shrink-0 opacity-70" />
                  <span className="font-display text-[0.9375rem] font-semibold truncate">
                    {n.title || t.notes.untitled}
                  </span>
                </span>

                {n.preview.length > 0 ? (
                  <ul className="space-y-1">
                    {n.preview.map((line, i) => (
                      <li key={`${n.id}-${i}`} className="text-[0.8125rem] leading-snug truncate opacity-85">
                        · {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[0.8125rem] opacity-70">{t.notes.emptyLines}</span>
                )}

                {n.total > 0 ? (
                  <span className="mt-auto pt-1 text-xs tabular-nums opacity-70">
                    {tf(t.notes.onHomeLines, {
                      done: formatNumber(n.done), total: formatNumber(n.total),
                    })}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
