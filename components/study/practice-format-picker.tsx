'use client';

import { useI18n } from '@/lib/i18n/provider';
import { Card, CardHeader, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icons';
import { PRACTICE_FORMATS, type PracticeFormat } from '@/lib/study/modes';

/**
 * How the student wants to be asked — chosen first, not found later.
 *
 * The setting existed before this, three cards down a setup page, which meant
 * most students never saw it and every set came back mixed. Pressing Practice
 * now asks the one question that changes what the whole session feels like,
 * and nothing else is on the screen while it does.
 */

export function formatLabel(t: ReturnType<typeof useI18n>['t'], f: PracticeFormat): string {
  switch (f) {
    case 'mixed': return t.practice.mixed;
    case 'multiple_choice': return t.practice.mcq;
    case 'true_false': return t.practice.trueFalse;
    case 'fill_blank': return t.studyAi.formatFillBlank;
    case 'short_answer': return t.studyAi.formatShortAnswer;
    case 'flashcards': return t.studyAi.formatFlashcards;
  }
}

export function formatHint(t: ReturnType<typeof useI18n>['t'], f: PracticeFormat): string {
  switch (f) {
    case 'mixed': return t.practice.mixedSub;
    case 'multiple_choice': return t.practice.mcqSub;
    case 'true_false': return t.practice.trueFalseSub;
    case 'fill_blank': return t.studyAi.formatFillBlankSub;
    case 'short_answer': return t.studyAi.formatShortAnswerSub;
    case 'flashcards': return t.studyAi.formatFlashcardsSub;
  }
}

/** The same mark at two sizes: 18 on the chooser's cards, 14 on the setup chips. */
export function formatIcon(f: PracticeFormat, size = 18) {
  switch (f) {
    case 'mixed': return <Icon.sparkle size={size} />;
    case 'multiple_choice': return <Icon.options size={size} />;
    case 'true_false': return <Icon.trueFalse size={size} />;
    case 'fill_blank': return <Icon.edit size={size} />;
    case 'short_answer': return <Icon.notes size={size} />;
    case 'flashcards': return <Icon.flashcards size={size} />;
  }
}

export function PracticeFormatPicker({
  onChoose,
}: {
  onChoose: (format: PracticeFormat) => void;
}) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader title={t.studyAi.pickFormatTitle} subtitle={t.studyAi.pickFormatSub} />
      <div role="radiogroup" aria-label={t.practice.format} className="grid sm:grid-cols-2 gap-2.5">
        {PRACTICE_FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={false}
            onClick={() => onChoose(f)}
            className={cx(
              'group text-start flex items-start gap-3 p-3.5 rounded-[var(--radius-md)]',
              'border border-[var(--border-subtle)] bg-[var(--bg-surface)]',
              'hover:border-[var(--accent)] hover:bg-[var(--bg-accent-soft)] transition-colors',
            )}
          >
            <span
              aria-hidden="true"
              className="shrink-0 w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] bg-[var(--bg-inset)] text-[var(--text-secondary)] group-hover:text-[var(--accent-soft-text)]"
            >
              {formatIcon(f)}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{formatLabel(t, f)}</span>
              <span className="block text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                {formatHint(t, f)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
