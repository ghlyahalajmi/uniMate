'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Card, CardHeader } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icons';

/**
 * Practising a course starts with how you want to be asked.
 *
 * The three styles are offered together rather than hidden behind separate
 * screens, because the choice is about the material in front of you: a formula
 * you keep forgetting wants a flashcard, a definitions-heavy week wants
 * true/false, an exam wants options. Flashcards lead: they are the student's
 * own cards and the only style that works with no AI key.
 */
export function CoursePractice({
  courseId, deck,
}: {
  courseId: string;
  deck: { total: number; due: number };
}) {
  const { t, tf, formatNumber } = useI18n();

  const options = [
    {
      key: 'flashcards',
      href: `/flashcards?course=${courseId}`,
      icon: <Icon.flashcards size={20} />,
      title: t.practice.flashcards,
      body: t.practice.flashcardsSub,
      note: deck.total === 0
        ? t.practice.deckEmpty
        : tf(t.practice.deckCards, { n: formatNumber(deck.total), due: formatNumber(deck.due) }),
      due: deck.due,
    },
    /*
     * One tile, not two. These used to be "multiple choice" and "true or
     * false", each carrying the style in the link — and the style was not
     * honoured at the other end, so both opened the same set. A practice set
     * mixes the shapes now, which is what the two tiles had promised between
     * them anyway.
     */
    {
      key: 'questions',
      href: `/study?course=${courseId}`,
      icon: <Icon.options size={20} />,
      title: t.practice.questions,
      body: t.practice.questionsSub,
      note: null,
      due: 0,
    },
  ];

  return (
    <Card>
      <CardHeader title={t.practice.title} subtitle={t.practice.subtitle} />

      <ul className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <li key={o.key} className="min-w-0">
            <Link
              href={o.href}
              className="h-full flex flex-col gap-2 p-3.5 rounded-[var(--radius-md)] border
                         border-[var(--border-subtle)] bg-[var(--bg-surface)]
                         hover:border-[var(--accent)] hover:bg-[var(--bg-accent-soft)]
                         transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="shrink-0 w-9 h-9 rounded-[var(--radius-sm)] grid place-items-center
                             bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]"
                >
                  {o.icon}
                </span>
                <span className="min-w-0 font-medium text-sm">{o.title}</span>
              </span>
              <span className="block text-xs text-[var(--text-secondary)] leading-relaxed">
                {o.body}
              </span>
              {o.note ? (
                <span className="mt-auto pt-1 flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] tabular-nums">{o.note}</span>
                  {o.due > 0 ? <Badge tone="warning">{t.flashcards.due}</Badge> : null}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

    </Card>
  );
}
