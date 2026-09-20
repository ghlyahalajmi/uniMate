import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';
import { renderContext, weakTopics, type StudentContext } from '../context';
import type { DifficultyLevel, QuestionType } from '@/types/database';
import { MODE_SIZES, type PracticeMode, type RequestedDifficulty } from '@/lib/study/modes';

export type { PracticeMode, RequestedDifficulty } from '@/lib/study/modes';
export { MODE_SIZES } from '@/lib/study/modes';

export interface StudyInput {
  context: StudentContext;
  courseId: string;
  mode: PracticeMode;
  difficulty: RequestedDifficulty;
  topic?: string;
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

const SCHEMA = {
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
          question_type: { type: 'string', enum: ['multiple_choice','true_false','short_answer','calculation','conceptual','scenario'] },
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
} as const;

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
        'Vary the question types. Include calculation questions where the subject supports them.',
      ].filter(Boolean).join('\n'),
      schema: SCHEMA,
      schemaName: 'question_set',
      maxTokens: 24000,
      effort: 'high',
    });

    return {
      ...result,
      questions: result.questions.slice(0, count).map(normalise),
      resolvedDifficulty: difficulty === 'adaptive' ? resolved : mode === 'exam_mode' ? 'mixed' : difficulty,
    };
  },

  // Writing subject-matter questions is not something we can fake offline.
  fallback: () => null,

  summariseInput: ({ context, courseId, mode, difficulty }) => {
    const c = context.courses.find((x) => x.id === courseId);
    return `${c?.course_code ?? courseId} · ${mode} · ${difficulty}`;
  },
  summariseOutput: (o) => {
    const topics = new Set(o.questions.map((q) => q.topic));
    return `${o.questions.length} questions generated across ${topics.size} topics`;
  },
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
  if (q.question_type === 'true_false' && (!q.options || q.options.length !== 2)) {
    return { ...q, options: ['True', 'False'] };
  }
  return q;
}
