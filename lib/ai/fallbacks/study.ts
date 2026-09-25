import 'server-only';
import type { AgentRunContext } from '../run';
import type { StudyInput, StudyOutput, GeneratedQuestion } from '../agents/study-questions';
import type { ChapterReviewInput, ChapterReviewOutput } from '../agents/chapter-review';
import type { FlashcardInput, FlashcardOutput } from '../agents/flashcard-writer';
import { MODE_SIZES } from '@/lib/study/modes';
import { outlineFromText, cardsFromText } from '@/lib/study/outline';
import { questionsFromText } from '@/lib/study/questions-from-text';
import { readableText } from '@/lib/materials/document';

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

  /*
   * The chapter first, when there is one that can be read.
   *
   * This used to start with questions the student had already been asked,
   * which is the right answer on a course they have practised before and the
   * wrong one on a chapter they uploaded a minute ago — which is exactly when
   * the button gets pressed. A chapter's own definitions make real questions
   * of every shape, so they come first and the archive fills whatever is left.
   */
  const chapterText = readableText(input.document);
  const fromChapter = chapterText
    ? questionsFromText(
        chapterText,
        count,
        input.chapterTitle ?? input.topic ?? 'Revision',
        input.format ?? 'mixed',
      )
    : [];

  if (fromChapter.length >= count) {
    return {
      questions: fromChapter.slice(0, count),
      rationale:
        `Built without AI, from the chapter itself: ${fromChapter.length} question(s), each one a definition the file already contained, rearranged. Nothing here was written for you.`,
      resolvedDifficulty: 'mixed',
    };
  }

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

  /*
   * Only questions of the shape that was asked for.
   *
   * This is what made the picker look broken: the archive is mostly
   * `conceptual`, so asking for true or false returned ten conceptual
   * questions with a true-or-false label on the request. A set that is not
   * the shape you chose is worse than a short set, so the wrong shapes are
   * dropped rather than relabelled.
   *
   * `conceptual` counts as a short answer because that is what it is — a
   * question you answer in your own words — and it is the one relabelling
   * that is true rather than convenient.
   */
  const wanted = (input.format ?? 'mixed') as string;
  const matchesFormat = (q: StoredQuestion): boolean => {
    if (wanted === 'mixed') return true;
    const type = q.question_type ?? 'short_answer';
    if (wanted === 'short_answer') return type === 'short_answer' || type === 'conceptual';
    return type === wanted;
  };

  const eligible = pool.filter(matchesFormat);

  const ranked = [
    ...eligible.filter((q) => wrong.has(q.id)),
    ...eligible.filter((q) => !seen.has(q.id)),
    ...eligible.filter((q) => seen.has(q.id) && !wrong.has(q.id)),
  ];

  const questions: GeneratedQuestion[] = [...fromChapter];

  for (const q of ranked.slice(0, Math.max(0, count - questions.length)).map((q) => ({
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
  }))) {
    if (questions.length >= count) break;
    if (questions.some((existing) => existing.question_text === q.question_text)) continue;
    questions.push(q);
  }

  /*
   * Still short? The student's own cards are questions with answers already —
   * but only where a written answer is what was asked for. A flashcard cannot
   * become a multiple choice without inventing three wrong answers.
   */
  const cardsFit = wanted === 'mixed' || wanted === 'short_answer';
  const deck = cardsFit
    ? ((cards.data ?? []) as Array<{ front: string; back: string; topic: string | null }>)
    : [];
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
    rationale: fromChapter.length > 0
      ? `Built without AI: ${fromChapter.length} from the chapter's own definitions, the rest from sets you have already been given in this course and from your flashcards.`
      : `Built without AI, from your own records: ${questions.length} question(s) taken from sets you have already been given in this course and from your flashcards, with the ones you got wrong first.`,
    resolvedDifficulty: 'mixed',
  };
}

/** A revision note assembled from the chapter's own text. Null for a file this cannot read. */
export function reviewFromDocument(input: ChapterReviewInput): ChapterReviewOutput | null {
  const text = readableText(input.document);
  if (!text) return null;

  const outline = outlineFromText(text, input.chapterTitle);
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
export async function cardsFromDocument(
  input: FlashcardInput, ctx: AgentRunContext,
): Promise<FlashcardOutput | null> {
  const text = readableText(input.document);

  if (text) {
    const cards = cardsFromText(
      text, input.count, input.topic ?? input.chapterTitle ?? input.courseCode,
    );
    if (cards.length > 0) {
      return {
        cards,
        rationale: `Written without AI from the definitions in "${input.chapterTitle ?? input.courseCode}" — every back is the chapter's own wording.`,
      };
    }
  }

  /*
   * No chapter, or a chapter that is a photograph: the student's own answered
   * questions are already cards. A question with its answer is a front with a
   * back, and it is theirs — which is the whole rule this file runs on.
   *
   * Until now this agent had no offline path at all, so pressing Flashcards
   * without a key failed outright rather than falling back like everything
   * else.
   */
  const { data } = await ctx.supabase
    .from('questions')
    .select('question_text, answer, topic')
    .eq('user_id', ctx.userId)
    .eq('course_id', input.courseId)
    .order('created_at', { ascending: false })
    .limit(input.count * 3);

  const rows = (data ?? []) as Array<{ question_text: string; answer: string; topic: string | null }>;

  const seen = new Set<string>();
  const cards: Array<{ front: string; back: string; topic: string }> = [];
  for (const row of rows) {
    if (cards.length >= input.count) break;
    const front = row.question_text.trim();
    const back = row.answer.trim();
    // A card whose back is a letter is a card that teaches the letter.
    if (!front || back.length < 2) continue;
    const key = front.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push({ front, back, topic: row.topic ?? input.courseCode });
  }

  if (cards.length === 0) return null;

  return {
    cards,
    rationale: `Written without AI from ${cards.length} question(s) you have already been asked in ${input.courseCode}, each one turned back into a card.`,
  };
}
