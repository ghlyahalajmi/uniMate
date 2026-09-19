import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';
import { renderContext, gradesByCourse, type StudentContext } from '../context';
import { computeCourseGrade, requiredForTarget, bestReachableLetter } from '@/lib/calculations/grades';

export interface GradeCoachInput {
  context: StudentContext;
  courseId: string;
}

export interface GradeCoachOutput {
  /** Arithmetic — computed locally, never by the model. */
  facts: {
    currentPercent: number | null;
    currentLetter: string | null;
    earnedWeightedPoints: number;
    remainingWeight: number;
    unaccountedWeight: number;
    targetLetter: string | null;
    requiredAveragePercent: number | null;
    verdict: string;
    bestReachable: string | null;
    assumptions: string[];
  };
  /** Prose — clearly the model's suggestion, not a statement of fact. */
  coaching: string;
  focusAreas: string[];
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['coaching', 'focusAreas'],
  properties: {
    coaching: { type: 'string', description: 'Two or three sentences of practical advice. Never restate the numbers as if you calculated them.' },
    focusAreas: { type: 'array', maxItems: 3, items: { type: 'string' } },
  },
} as const;

/**
 * Agent 5 — Grade Coach.
 *   Input:   a course and the student's context.
 *   Output:  the computed requirement plus advice on how to get there.
 *   Trigger: a grade is entered, or the student opens the grade coach.
 *   Failure: falls back to the arithmetic alone, which is the important half.
 *
 * The numbers are always computed in lib/calculations. The model is only
 * allowed to write the advice around them, so a model slip can never produce
 * a wrong grade requirement.
 */
export const gradeCoach: AgentDefinition<GradeCoachInput, GradeCoachOutput> = {
  name: 'Grade Coach',
  trigger: 'grade_entered',
  workflow: 'workflow_c_grade_analysis',
  describe: 'Explains what the student needs on remaining assessments and how to approach it.',

  async run(input) {
    const facts = computeFacts(input);
    const course = input.context.courses.find((c) => c.id === input.courseId);

    const result = await callStructured<{ coaching: string; focusAreas: string[] }>({
      system: systemFor(
        'You are the Grade Coach. The arithmetic has already been done and is given to you as ' +
        'fact — do not recompute it or contradict it. Write practical advice about how to approach ' +
        'the remaining assessments. If the target is out of reach, say so plainly and kindly, and ' +
        'talk about the best grade that is still reachable instead.',
      ),
      prompt: [
        renderContext(input.context, { focusCourseId: input.courseId }),
        '',
        `COMPUTED FOR ${course?.course_code ?? 'this course'} (these figures are correct, use them as given):`,
        JSON.stringify(facts, null, 2),
        '',
        'Write the coaching.',
      ].join('\n'),
      schema: SCHEMA,
      schemaName: 'grade_coaching',
      effort: 'low',
    });

    return { facts, ...result };
  },

  // The arithmetic is the part that matters, and it needs no model at all.
  fallback(input) {
    const facts = computeFacts(input);
    return { facts, coaching: '', focusAreas: [] };
  },

  summariseInput: ({ context, courseId }) => {
    const c = context.courses.find((x) => x.id === courseId);
    return `${c?.course_code ?? courseId} grade analysis`;
  },
  summariseOutput: (o) =>
    o.facts.requiredAveragePercent !== null
      ? `Current ${o.facts.currentPercent ?? 'n/a'}%; target ${o.facts.targetLetter} needs ${o.facts.requiredAveragePercent}% of remaining weight`
      : `Current ${o.facts.currentPercent ?? 'n/a'}%; ${o.facts.verdict}`,
};

function computeFacts(input: GradeCoachInput): GradeCoachOutput['facts'] {
  const course = input.context.courses.find((c) => c.id === input.courseId);
  const grades = gradesByCourse(input.context).get(input.courseId) ?? [];
  const scale = input.context.scale;

  const breakdown = computeCourseGrade(grades, scale);
  const req = requiredForTarget(grades, course?.target_grade ?? null, scale);

  return {
    currentPercent: breakdown.currentPercent,
    currentLetter: breakdown.currentLetter,
    earnedWeightedPoints: breakdown.earnedWeightedPoints,
    remainingWeight: breakdown.remainingWeight,
    unaccountedWeight: breakdown.unaccountedWeight,
    targetLetter: req.targetLetter,
    requiredAveragePercent: req.requiredAveragePercent,
    verdict: req.verdict,
    bestReachable: bestReachableLetter(grades, scale),
    assumptions: req.assumptions,
  };
}

export type { StudentContext };
