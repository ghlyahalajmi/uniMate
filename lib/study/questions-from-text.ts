/**
 * Practice questions built from a chapter's own words, with no model.
 *
 * The offline path used to rebuild a set out of questions the student had
 * already been asked. That is fine on a course they have practised before and
 * useless on a chapter they have just uploaded — which is exactly when they
 * press the button. So this reads the chapter instead.
 *
 * Nothing here is written. Every question is a rearrangement of a sentence the
 * file already contained: a definition becomes a multiple choice by putting
 * three of the chapter's other meanings beside the right one, a true/false by
 * sometimes pairing a term with the wrong meaning, and a fill-in-the-blank by
 * cutting the term out of its own definition. A made-up question about
 * electromagnetics is not practice for this course; it is practice for a
 * different one.
 *
 * Pure and deterministic — the same chapter always gives the same set, so a
 * student who reloads does not lose the questions they were halfway through,
 * and the whole thing can be tested against a real chapter's text.
 */

import type { QuestionType } from '@/types/database';

export interface TextQuestion {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question_type: QuestionType;
  question_text: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  next_action: string;
}

export interface Definition {
  term: string;
  meaning: string;
}

/** "Term — meaning", "Term: meaning", "Term is defined as ..." */
export function definitionsIn(text: string): Definition[] {
  const out: Definition[] = [];
  const seen = new Set<string>();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^[-*•]\s*/, '').replace(/\s+/g, ' ');
    const m =
      line.match(/^([^:—–]{2,60})\s*[:—–]\s*(.{12,300})$/) ??
      line.match(/^(.{2,60}?)\s+(?:is|are)\s+defined\s+as\s+(.{12,300})$/i);
    if (!m) continue;

    const term = m[1].trim().replace(/[.,;]$/, '');
    const meaning = m[2].trim();

    // A sentence that merely contains a colon is not a definition.
    if (term.split(/\s+/).length > 6) continue;
    if (!/[A-Za-z؀-ۿ]/.test(term)) continue;

    /*
     * Nor is a heading. "Chapter 3 — Electromagnetic Theory" has a dash and
     * two halves and matches everything above, and turning it into a question
     * asks the student what chapter three is. The shape of a title is what
     * rules it out: a numbering word, or a bare number, on the left.
     */
    if (/^(chapter|section|unit|lecture|part|appendix|figure|table|الفصل|الوحدة|الباب)\b/i.test(term)) continue;
    if (/^\d+(\.\d+)*$/.test(term)) continue;

    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ term, meaning });
  }

  return out;
}

/**
 * A shuffle that is the same every time for the same inputs.
 *
 * Math.random would move the right answer between reloads, and a set that
 * renumbers itself under someone halfway through it is worse than one with a
 * predictable order.
 */
function placeAt(count: number, seed: number): number {
  return seed % count;
}

/** Three other meanings, taken from elsewhere in the same chapter. */
function distractors(all: Definition[], skip: number, want: number): string[] {
  const out: string[] = [];
  for (let step = 1; out.length < want && step < all.length; step++) {
    const candidate = all[(skip + step) % all.length];
    if (candidate.meaning !== all[skip].meaning) out.push(candidate.meaning);
  }
  return out;
}

function multipleChoice(all: Definition[], i: number, topic: string): TextQuestion | null {
  const wrong = distractors(all, i, 3);
  if (wrong.length < 2) return null;

  const { term, meaning } = all[i];
  const options = [...wrong];
  options.splice(placeAt(options.length + 1, i), 0, meaning);

  return {
    topic,
    difficulty: 'medium',
    question_type: 'multiple_choice',
    question_text: `Which of these is ${term}?`,
    options,
    answer: meaning,
    explanation: `The chapter defines ${term} in these words. The other options are its definitions of other terms.`,
    next_action: 'If the wrong options looked plausible, those terms are worth a second read too.',
  };
}

function trueFalse(all: Definition[], i: number, topic: string): TextQuestion {
  const { term, meaning } = all[i];

  // Every third one is paired with another term's meaning, so the answer is
  // not always true and the set cannot be passed by pressing one button.
  const lie = i % 3 === 2 && all.length > 1;
  const shown = lie ? all[(i + 1) % all.length].meaning : meaning;

  return {
    topic,
    difficulty: 'easy',
    question_type: 'true_false',
    question_text: `True or false: ${term} is ${trimEnd(shown)}.`,
    options: ['True', 'False'],
    answer: lie ? 'False' : 'True',
    explanation: lie
      ? `That is the chapter's definition of a different term. ${term} is ${trimEnd(meaning)}.`
      : `Those are the chapter's own words for ${term}.`,
    next_action: lie ? 'Check which term that definition actually belongs to.' : 'Move on.',
  };
}

function fillBlank(all: Definition[], i: number, topic: string): TextQuestion {
  const { term, meaning } = all[i];

  // Cut the term out of its own definition when it appears there; otherwise
  // the blank stands where the term would be.
  const pattern = new RegExp(escape(term), 'i');
  const hasTerm = pattern.test(meaning);
  const text = hasTerm
    ? meaning.replace(pattern, '______')
    : `______ is ${trimEnd(meaning)}.`;

  return {
    topic,
    difficulty: 'medium',
    question_type: 'fill_blank',
    question_text: text,
    options: null,
    answer: term,
    explanation: `Straight from the chapter's definition of ${term}.`,
    next_action: 'Say the whole sentence out loud with the word back in it.',
  };
}

function shortAnswer(all: Definition[], i: number, topic: string): TextQuestion {
  const { term, meaning } = all[i];

  return {
    topic,
    difficulty: 'medium',
    question_type: 'short_answer',
    question_text: `In one word or phrase: what does the chapter call ${lowerFirst(trimEnd(meaning))}?`,
    options: null,
    answer: term,
    explanation: `The chapter's own name for it is ${term}.`,
    next_action: 'If you knew the idea but not the word, that is a vocabulary gap, not a concept gap.',
  };
}

/** "The region around a charge" reads wrong after "what does the chapter call". */
function lowerFirst(value: string): string {
  if (!value) return value;
  // Only when the rest of the word is lower case: "Maxwell" must stay "Maxwell".
  const [first, ...rest] = value;
  const second = rest[0] ?? '';
  return second && second === second.toLowerCase() ? first.toLowerCase() + rest.join('') : value;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trimEnd(value: string): string {
  return value.replace(/[.،؛;]+$/, '');
}

/**
 * A practice set from a chapter, of the shape asked for.
 *
 * `mixed` rotates the three styles so consecutive questions are never the
 * same shape — which is what "a different style per question" has to mean if
 * it is to mean anything. Anything else pins every question to one shape.
 *
 * Returns fewer than asked, or none at all, rather than padding: a chapter
 * with two definitions in it has two questions in it.
 */
type Style = 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank';

/** What `mixed` cycles through, so two neighbours are never the same shape. */
const ROTATION: readonly Style[] = ['multiple_choice', 'true_false', 'short_answer', 'fill_blank'];

/** The formats this can pin every question to. */
const FIXED: readonly Style[] = ROTATION;

export function questionsFromText(
  text: string, count: number, topic: string, format: string,
): TextQuestion[] {
  const defs = definitionsIn(text);
  if (defs.length === 0) return [];

  const out: TextQuestion[] = [];

  for (let i = 0; i < defs.length && out.length < count; i++) {
    /*
     * `compare`, and anything unrecognised, has no honest shape to take from a
     * list of definitions — comparing two things needs two things the chapter
     * actually set against each other. Those fall back to the rotation rather
     * than to an invented question.
     */
    const rotated = ROTATION[i % ROTATION.length];
    const style = FIXED.includes(format as Style) ? (format as Style) : rotated;

    const made =
      style === 'multiple_choice' ? multipleChoice(defs, i, topic)
      : style === 'true_false' ? trueFalse(defs, i, topic)
      : style === 'short_answer' ? shortAnswer(defs, i, topic)
      : fillBlank(defs, i, topic);

    // A multiple choice with too few distractors comes back null; a chapter
    // that short gets a true/false in its place rather than a gap.
    out.push(made ?? trueFalse(defs, i, topic));
  }

  return out;
}
