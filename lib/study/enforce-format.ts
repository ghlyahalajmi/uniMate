/**
 * Making the set the shape the student asked for.
 *
 * The schema already pins `question_type` to one value when a style is chosen,
 * and a capable model honours it. A small free model does not: it returns
 * short-answer questions with `options: null` and the screen renders a text
 * box, which is how "multiple choice" ends up looking like every other set.
 *
 * So the shape is enforced here rather than hoped for. Two rules throughout:
 * repair what can be repaired from what the model actually returned, and drop
 * what cannot. Never invent an option, a blank or an answer — a fabricated
 * distractor is a wrong answer presented as a right one.
 *
 * Pure, so the repairs can be tested against the shapes models really produce.
 */

export interface ShapedQuestion {
  topic: string;
  difficulty: string;
  question_type: string;
  question_text: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  next_action: string;
}

const norm = (v: string) => v.trim().toLowerCase();

/** "B", "b)", "(C)" — a letter standing in for the option at that position. */
function letterIndex(answer: string, count: number): number | null {
  const m = answer.trim().match(/^\(?([a-zA-Z])[).:]?$/);
  if (!m) return null;
  const i = m[1].toLowerCase().charCodeAt(0) - 97;
  return i >= 0 && i < count ? i : null;
}

/** Options with the blanks, duplicates and numbering stripped off. */
function cleanOptions(options: string[] | null): string[] {
  if (!Array.isArray(options)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of options) {
    if (typeof raw !== 'string') continue;
    const value = raw.replace(/^\s*\(?[a-dA-D][).:]\s*/, '').trim();
    if (!value) continue;
    const key = norm(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function asMultipleChoice(q: ShapedQuestion): ShapedQuestion | null {
  const options = cleanOptions(q.options);
  // Three is the floor: two options is a true/false question wearing a
  // different label, and one is not a choice.
  if (options.length < 3) return null;

  const exact = options.find((o) => o === q.answer);
  const loose = options.find((o) => norm(o) === norm(q.answer));
  const byLetter = letterIndex(q.answer, options.length);
  const contained = options.find((o) => norm(q.answer).includes(norm(o)) && norm(o).length > 2);

  const answer = exact ?? loose ?? (byLetter === null ? undefined : options[byLetter]) ?? contained;
  // An answer that matches none of its own options cannot be marked, and
  // picking one would be inventing the correct answer.
  if (!answer) return null;

  return { ...q, question_type: 'multiple_choice', options, answer };
}

function asTrueFalse(q: ShapedQuestion): ShapedQuestion | null {
  const options = ['True', 'False'];
  const a = norm(q.answer);
  const truthy = ['true', 't', 'yes', 'correct', 'صح', 'صحيح', 'نعم'];
  const falsy = ['false', 'f', 'no', 'incorrect', 'خطأ', 'غلط', 'لا'];

  const answer = truthy.includes(a) ? 'True' : falsy.includes(a) ? 'False' : null;
  if (!answer) return null;

  return { ...q, question_type: 'true_false', options, answer };
}

const BLANK = /_{3,}|\.{3,}|…/;

function asFillBlank(q: ShapedQuestion): ShapedQuestion | null {
  if (BLANK.test(q.question_text)) {
    return { ...q, question_type: 'fill_blank', options: null };
  }

  /*
   * No blank, but the answer appears in the sentence: that is a statement the
   * model forgot to blank rather than a different question, and removing the
   * word it already told us is the answer is a repair, not an invention.
   */
  const answer = q.answer.trim();
  if (answer.length >= 3 && norm(q.question_text).includes(norm(answer))) {
    const at = norm(q.question_text).indexOf(norm(answer));
    const text = `${q.question_text.slice(0, at)}_____${q.question_text.slice(at + answer.length)}`;
    return { ...q, question_type: 'fill_blank', question_text: text, options: null };
  }

  return null;
}

/**
 * The set, reshaped to the style that was asked for.
 *
 * `mixed` passes everything through — that style is the absence of a
 * constraint. Anything that cannot be repaired is dropped, and the caller
 * decides whether what survived is enough to show.
 */
export function enforceFormat(
  questions: readonly ShapedQuestion[], format: string,
): ShapedQuestion[] {
  if (format === 'mixed' || format === 'flashcards') return [...questions];

  const out: ShapedQuestion[] = [];
  for (const q of questions) {
    if (!q || typeof q.question_text !== 'string' || typeof q.answer !== 'string') continue;

    const shaped =
      format === 'multiple_choice' ? asMultipleChoice(q)
        : format === 'true_false' ? asTrueFalse(q)
          : format === 'fill_blank' ? asFillBlank(q)
            : format === 'compare' ? { ...q, question_type: 'compare', options: null }
              : q;

    if (shaped) out.push(shaped);
  }
  return out;
}
