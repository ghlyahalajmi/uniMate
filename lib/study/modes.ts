/**
 * Practice modes and their sizes.
 *
 * This lives outside `lib/ai` because both sides need it: the agent decides
 * how many questions to ask for, and the setup screen tells the student what
 * they are about to commit to before they start. The agent module is
 * server-only, so a client component cannot import the number from there.
 */

export type PracticeMode = 'quick_5' | 'standard_10' | 'deep_20' | 'exam_mode';
export type RequestedDifficulty = 'easy' | 'medium' | 'hard' | 'adaptive';

export const MODE_SIZES: Record<PracticeMode, number> = {
  quick_5: 5, standard_10: 10, deep_20: 20, exam_mode: 15,
};

/**
 * How the student wants to be asked.
 *
 * `mixed` leaves the choice of question type to the generator, which is what
 * Study AI did before the course page started offering the choice. The other
 * two pin every question in the set to one shape. Flashcards are not in this
 * union: they are a deck the student writes and owns, not a generated set, so
 * they are a separate destination rather than a format of this one.
 */
export type PracticeFormat =
  | 'mixed'
  | 'multiple_choice'
  | 'true_false'
  | 'fill_blank'
  | 'compare'
  | 'flashcards';

export const PRACTICE_FORMATS: PracticeFormat[] = [
  'mixed', 'multiple_choice', 'true_false', 'fill_blank', 'compare', 'flashcards',
];

/**
 * Flashcards are not a question shape.
 *
 * The other formats produce a set the student answers and is marked on;
 * flashcards produce a deck they keep and review on a schedule. Same starting
 * point, different destination, so the caller has to branch rather than treat
 * this as one more enum value.
 */
export function isDeckFormat(format: PracticeFormat): boolean {
  return format === 'flashcards';
}

/** Narrows a query-string value, so a hand-edited URL cannot smuggle a format in. */
export function toPracticeFormat(value: string | undefined): PracticeFormat {
  return value && (PRACTICE_FORMATS as string[]).includes(value)
    ? (value as PracticeFormat)
    : 'mixed';
}
