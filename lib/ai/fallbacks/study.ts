import 'server-only';
import type { AgentRunContext } from '../run';
import type { StudyInput, StudyOutput, GeneratedQuestion } from '../agents/study-questions';
import type { ChapterReviewInput, ChapterReviewOutput } from '../agents/chapter-review';
import type { FlashcardInput, FlashcardOutput } from '../agents/flashcard-writer';
import { MODE_SIZES } from '@/lib/study/modes';
import { outlineFromText, cardsFromText } from '@/lib/study/outline';

/**
 * What Study with AI can still do when there is no model.
 *
 * The rule throughout: use the student's own material, or say nothing. A
 * practice question invented here would be a question about a subject rather
 * than about their course, and a flashcard with a made-up back is worse than
 * no flashcard — it gets reviewed for weeks.
 */

interface StoredQuestion {
  id: string;
  topic: string | null;
  difficulty: string | null;
  question_type: string | null;
  question_text: string;
  options: unknown;
  answer: string;
  explanation: string | null;
}

function asOptions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = value.filter((v): v is string => typeof v === 'string');
  return strings.length > 0 ? strings : null;
}

/**
 * A practice set rebuilt from what this student has already been asked and
 * what they have already written down.
 *
 * The ones they got wrong come first — that is the set worth sitting again —
 * then ones they have not seen, then the rest, then their own flashcards
 * turned into questions. Nothing here was written by this function.
 */
export async function questionsFromRecords(
  input: StudyInput, ctx: AgentRunContext,
): Promise<StudyOutput | null> {
  const count = MODE_SIZES[input.mode];

  const [asked, attempted, cards] = await Promise.all([
    ctx.supabase
      .from('questions')
      .select('id, topic, difficulty, question_type, question_text, options, answer, explanation')
      .eq('user_id', ctx.userId)
      .eq('course_id', input.courseId)
      .order('created_at', { ascending: false })
      .limit(120),
    ctx.supabase
      .from('question_attempts')
      .select('question_id, is_correct')
      .eq('user_id', ctx.userId)
      .order('answered_at', { ascending: false })
      .limit(400),
    ctx.supabase
      .from('flashcards')
      .select('front, back, topic')
      .eq('user_id', ctx.userId)
      .eq('course_id', input.courseId)
      .limit(60),
  ]);

  const pool = (asked.data ?? []) as StoredQuestion[];
  const attempts = (attempted.data ?? []) as Array<{ question_id: string; is_correct: boolean }>;

  const wrong = new Set(attempts.filter((a) => !a.is_correct).map((a) => a.question_id));
  const seen = new Set(attempts.map((a) => a.question_id));

  const ranked = [
    ...pool.filter((q) => wrong.has(q.id)),
    ...pool.filter((q) => !seen.has(q.id)),
    ...pool.filter((q) => seen.has(q.id) && !wrong.has(q.id)),
  ];

  const questions: GeneratedQuestion[] = ranked.slice(0, count).map((q) => ({
    topic: q.topic ?? 'Revision',
    difficulty: (q.difficulty as GeneratedQuestion['difficulty']) ?? 'medium',
    question_type: (q.question_type as GeneratedQuestion['question_type']) ?? 'short_answer',
    question_text: q.question_text,
    options: asOptions(q.options),
    answer: q.answer,
    explanation: q.explanation ?? 'From a set you were given earlier in this course.',
    next_action: wrong.has(q.id)
      ? 'You missed this one before. Read the explanation, then come back to it tomorrow.'
      : 'Check the explanation against your notes.',
  }));

  // Still short? The student's own cards are questions with answers already.
  const deck = (cards.data ?? []) as Array<{ front: string; back: string; topic: string | null }>;
  for (const card of deck) {
    if (questions.length >= count) break;
    if (questions.some((q) => q.question_text === card.front)) continue;
    questions.push({
      topic: card.topic ?? 'Flashcards',
      difficulty: 'medium',
      question_type: 'short_answer',
      question_text: card.front,
      options: null,
      answer: card.back,
      explanation: 'From a flashcard you wrote for this course.',
      next_action: 'If this one was slow, move the card back a box.',
    });
  }

  if (questions.length === 0) return null;

  return {
    questions,
    rationale:
      `Built without AI, from your own records: ${questions.length} question(s) taken from sets you have already been given in this course and from your flashcards, with the ones you got wrong first.`,
    resolvedDifficulty: 'mixed',
  };
}

/** A revision note assembled from the chapter's own text. Null for a file this cannot read. */
export function reviewFromDocument(input: ChapterReviewInput): ChapterReviewOutput | null {
  if (input.document.kind !== 'text') return null;

  const outline = outlineFromText(input.document.text, input.chapterTitle);
  if (outline.sections.length === 0 && outline.keyTerms.length === 0) return null;

  return {
    overview: outline.overview,
    sections: outline.sections,
    keyTerms: outline.keyTerms,
    formulas: outline.formulas,
    // Where students usually go wrong is a judgement, and a judgement is
    // exactly what this path cannot make honestly.
    pitfalls: [],
    checklist: outline.checklist,
    notes: [
      "Assembled from the chapter itself without AI: its own headings, definitions and formulas, rearranged. Nothing has been added.",
    ],
  };
}

/** Cards from the chapter's own definitions. Null when there are none to take. */
export function cardsFromDocument(input: FlashcardInput): FlashcardOutput | null {
  if (!input.document || input.document.kind !== 'text') return null;

  const cards = cardsFromText(
    input.document.text, input.count, input.topic ?? input.chapterTitle ?? input.courseCode,
  );
  if (cards.length === 0) return null;

  return {
    cards,
    rationale: `Written without AI from the definitions in "${input.chapterTitle ?? input.courseCode}" — every back is the chapter's own wording.`,
  };
}
