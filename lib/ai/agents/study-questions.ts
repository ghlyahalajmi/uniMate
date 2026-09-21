import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';
import { renderContext, weakTopics, type StudentContext } from '../context';
import type { DifficultyLevel, QuestionType } from '@/types/database';
import {
  MODE_SIZES, type PracticeFormat, type PracticeMode, type RequestedDifficulty,
} from '@/lib/study/modes';

export type { PracticeMode, RequestedDifficulty, PracticeFormat } from '@/lib/study/modes';
export { MODE_SIZES } from '@/lib/study/modes';

export interface StudyInput {
  context: StudentContext;
  courseId: string;
  mode: PracticeMode;
  difficulty: RequestedDifficulty;
  /** The shape every question takes. Defaults to letting the model choose. */
  format?: PracticeFormat;
  topic?: string;
  /**
   * One uploaded chapter to set the questions on.
   *
   * With this the set is drawn from what the lecturer actually taught rather
   * than from the topic names on the course record, which is the difference
   * between revision and a general quiz about the subject.
   */
  document?:
    | { kind: 'image'; mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }
    | { kind: 'pdf'; data: string }
    | { kind: 'text'; text: string };
  /** What the student calls that chapter. */
  chapterTitle?: string;
}

export interface GeneratedQuestion {
  topic: string;
  difficulty: DifficultyLevel;
  question_type: QuestionType;
  question_text: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  next_action: string;
}

export interface StudyOutput {
  questions: GeneratedQuestion[];
  /** Why this set looks the way it does — shown to the student. */
  rationale: string;
  resolvedDifficulty: DifficultyLevel | 'mixed';
}

const ALL_TYPES = [
  'multiple_choice', 'true_false', 'short_answer', 'calculation', 'conceptual', 'scenario',
  'fill_blank', 'compare',
] as const;

/**
 * The schema is built per request rather than declared once: when the student
 * asks for true/false only, `question_type` is an enum of one, so a set that
 * drifts back to short answers is rejected by the API rather than caught in
 * the UI.
 */
const schemaFor = (format: PracticeFormat) => ({
  type: 'object',
  additionalProperties: false,
  required: ['questions', 'rationale'],
  properties: {
    rationale: { type: 'string', description: 'One sentence on why these topics and this difficulty were chosen.' },
    questions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['topic','difficulty','question_type','question_text','answer','explanation','next_action'],
        properties: {
          topic: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy','medium','hard'] },
          question_type: {
            type: 'string',
            // `flashcards` is a destination, not a question shape, and naming it
            // here would put a value in the enum that the column cannot store.
            // A stray call degrades to a mixed set rather than a rejected one.
            enum: format === 'mixed' || format === 'flashcards' ? [...ALL_TYPES] : [format],
          },
          question_text: { type: 'string' },
          options: {
            type: ['array','null'],
            items: { type: 'string' },
            description: 'Four options for multiple_choice, two for true_false, null otherwise.',
          },
          answer: { type: 'string', description: 'For multiple_choice this must exactly match one option.' },
          explanation: { type: 'string', description: 'Why the answer is right. Never just restate it.' },
          next_action: { type: 'string', description: 'One concrete next step if the student gets this wrong.' },
        },
      },
    },
  },
});

/**
 * Agent 2 — Study Question Generator.
 *   Input:   course, mode, requested difficulty, the student's weak topics and history.
 *   Output:  a question set with answers, explanations and a next action each.
 *   Trigger: the student starts a practice session.
 *   Failure: no offline equivalent — writing course-specific questions needs the model.
 */
export const studyQuestionGenerator: AgentDefinition<StudyInput, StudyOutput> = {
  name: 'Study Question Generator',
  trigger: 'user_requested',
  workflow: 'workflow_e_study_questions',
  describe: 'Writes practice questions from the student\'s own course, syllabus topics and weak areas.',

  async run(input) {
    const { context, courseId, mode, difficulty, topic } = input;
    const format = input.format ?? 'mixed';
    const course = context.courses.find((c) => c.id === courseId);
    if (!course) throw new Error('That course is not in your records.');

    const count = MODE_SIZES[mode];
    const weak = weakTopics(context, courseId);
    const syllabus = context.syllabi.find((s) => s.course_id === courseId);
    const resolved = resolveDifficulty(difficulty, weak);

    const focusLine = topic
      ? `Focus every question on: ${topic}.`
      : weak.length
        ? `Weight the set toward the topics the student is getting wrong: ${weak.slice(0, 3).map((w) => `${w.topic} (${Math.round(w.rate * 100)}% correct)`).join(', ')}.`
        : 'Spread the questions across the syllabus topics on file.';

    const difficultyLine = difficulty === 'adaptive'
      ? `Adaptive difficulty. Recent results in this course put the student at "${resolved}". ` +
        'Open with questions one step easier to rebuild the foundation, then climb. ' +
        'If there is no history, start at medium.'
      : mode === 'exam_mode'
        ? 'Exam mode: mix easy, medium and hard as a real paper would, in ascending order.'
        : `Every question at ${difficulty} difficulty.`;

    const result = await callStructured<Omit<StudyOutput, 'resolvedDifficulty'>>({
      system: systemFor(
        'You are the Study Question Generator. Write genuine practice questions on the academic ' +
        'subject matter of the course named below. Base the topics on the syllabus topics and the ' +
        'student\'s recorded weak areas. Never write a question about the student\'s own grades or ' +
        'timetable — these are subject questions. Every explanation must teach the reasoning, not ' +
        'restate the answer. For multiple_choice, "answer" must be character-for-character one of ' +
        'the options.',
      ),
      prompt: [
        renderContext(context, { focusCourseId: courseId }),
        '',
        `GENERATE: exactly ${count} questions for ${course.course_code} — ${course.course_name}.`,
        focusLine,
        difficultyLine,
        syllabus?.topics.length ? `Syllabus topics on file: ${syllabus.topics.join(', ')}.` : '',
        FORMAT_LINES[format],
        // When a chapter is attached it is the source, not a hint. Questions
        // about the subject in general would be indistinguishable from a quiz
        // the student could have found anywhere.
        input.document
          ? `The attached chapter${input.chapterTitle ? ` ("${input.chapterTitle}")` : ''} is the `
            + 'material to set these on. Ask only about what it covers, use its notation and its '
            + 'terms, and do not reach for the standard treatment of the subject where the chapter '
            + 'does something its own way.'
          : '',
        input.document?.kind === 'text'
          ? `\nThe chapter text follows.\n\n${input.document.text.slice(0, 80_000)}`
          : '',
      ].filter(Boolean).join('\n'),
      schema: schemaFor(format),
      schemaName: 'question_set',
      maxTokens: 24000,
      effort: 'high',
      documents: !input.document || input.document.kind === 'text'
        ? []
        : [input.document.kind === 'pdf'
            ? { kind: 'pdf', data: input.document.data }
            : { kind: 'image', mediaType: input.document.mediaType, data: input.document.data }],
    });

    return {
      ...result,
      questions: result.questions.slice(0, count).map(normalise),
      resolvedDifficulty: difficulty === 'adaptive' ? resolved : mode === 'exam_mode' ? 'mixed' : difficulty,
    };
  },

  // Writing subject-matter questions is not something we can fake offline.
  fallback: () => null,

  summariseInput: ({ context, courseId, mode, difficulty, format }) => {
    const c = context.courses.find((x) => x.id === courseId);
    return `${c?.course_code ?? courseId} · ${mode} · ${difficulty} · ${format ?? 'mixed'}`;
  },
  summariseOutput: (o) => {
    const topics = new Set(o.questions.map((q) => q.topic));
    return `${o.questions.length} questions generated across ${topics.size} topics`;
  },
};

/**
 * What each format asks of the model.
 *
 * The wrong options carry the teaching in a multiple-choice set, and a
 * true/false set is worthless if every false statement is absurd — so each
 * line says how to be wrong, not just what shape to return.
 */
const FORMAT_LINES: Record<PracticeFormat, string> = {
  mixed:
    'Vary the question types. Include calculation questions where the subject supports them.',
  multiple_choice:
    'Every question must be multiple choice with exactly four options, one of them correct, and '
    + '"answer" character-for-character equal to that option. Each wrong option must be a mistake '
    + 'a student of this course would actually make — never filler, never obviously absurd, and '
    + 'never "all of the above".',
  true_false:
    'Every question must be one statement the student judges, with options exactly ["True","False"] '
    + 'and "answer" exactly "True" or "False". Make roughly half of them false, and make a false '
    + 'statement false by one specific detail — a swapped term, a wrong condition, a reversed '
    + 'direction — so that judging it requires knowing the material rather than spotting nonsense.',
  fill_blank:
    'Every question must be one sentence from this subject with exactly one blank, written as five '
    + 'underscores (_____), and "answer" the single word or short phrase that fills it. Blank the '
    + 'term that carries the meaning — the condition, the unit, the operator — never an article or '
    + 'a connective, because a sentence that reads the same either way tests nothing. Put "options" '
    + 'at null.',
  compare:
    'Every question must ask the student to distinguish two things this course treats as a pair — '
    + 'two methods, two conditions, two cases — and "answer" must name the difference that matters '
    + 'rather than list features of each in turn. Choose pairs that are genuinely confusable; two '
    + 'unrelated topics make a question nobody gets wrong for the right reason. Put "options" at '
    + 'null.',
  // Never reaches the generator: a deck is built by its own path, not asked for
  // as a question set. Present so the map stays exhaustive over the union.
  flashcards:
    'Write each item as a prompt and its answer, short enough to be recalled in one go.',
};

function resolveDifficulty(
  requested: RequestedDifficulty,
  weak: ReturnType<typeof weakTopics>,
): DifficultyLevel {
  if (requested !== 'adaptive') return requested;
  if (weak.length === 0) return 'medium';
  const overall = weak.reduce((sum, w) => sum + w.rate, 0) / weak.length;
  if (overall < 0.55) return 'easy';
  if (overall > 0.85) return 'hard';
  return 'medium';
}

/** Guards against an option list that does not contain its own answer. */
function normalise(q: GeneratedQuestion): GeneratedQuestion {
  if (q.question_type === 'multiple_choice' && q.options?.length) {
    const exact = q.options.find((o) => o === q.answer);
    if (!exact) {
      const loose = q.options.find(
        (o) => o.trim().toLowerCase() === q.answer.trim().toLowerCase(),
      );
      return { ...q, answer: loose ?? q.options[0] };
    }
  }
  if (q.question_type === 'true_false') {
    const options = q.options?.length === 2 ? q.options : ['True', 'False'];
    // The answer is compared to the option the student clicked, so a "T" or a
    // "true" coming back would mark every correct answer wrong.
    const match = options.find((o) => o.trim().toLowerCase() === q.answer.trim().toLowerCase());
    const starts = options.find((o) => o.trim().toLowerCase().startsWith(q.answer.trim().toLowerCase()[0] ?? ''));
    return { ...q, options, answer: match ?? starts ?? options[0] };
  }
  return q;
}
