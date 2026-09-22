import 'server-only';
import type { AgentDefinition } from '../run';
import { callText, callStructured } from '../client';
import { systemFor } from '../prompts';
import { answerFromRecords } from '../fallbacks/assistant';
import { renderContext, gradesByCourse, type StudentContext } from '../context';
import { computeCourseGrade, requiredForTarget } from '@/lib/calculations/grades';
import { cumulativeGpa, semesterGpa } from '@/lib/calculations/gpa';

export interface AssistantInput {
  context: StudentContext;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AssistantOutput {
  answer: string;
}

/**
 * Agent 8 — UniMate Assistant.
 *   Input:   a question plus the full student context.
 *   Output:  a grounded prose answer.
 *   Trigger: the student sends a chat message.
 *   Failure: no offline equivalent — declines rather than guessing.
 *
 * Grade arithmetic is pre-computed and handed to the model as fact, so
 * "what do I need on my final" is answered by lib/calculations, not by the
 * model doing mental arithmetic.
 */
/**
 * What this assistant is for, and what it is not.
 *
 * A study assistant that also answers about football, politics or someone's
 * love life is a chatbot with a university logo on it: every off-topic answer
 * is one the student cannot check against their records, and the first wrong
 * one costs the trust the grounded answers earned. So the subject is the
 * student's studies, and everything else gets one short line back.
 *
 * Stated as a rule the model can apply rather than a list of banned topics,
 * because a list is always missing the next thing somebody asks.
 */
const SCOPE = [
  'SCOPE — you answer about this student\'s studies and nothing else.',
  'In scope: their courses, assessments, grades, GPA, deadlines, timetable and',
  'attendance; what to study and when; how to revise, plan a week, prepare for',
  'an exam or split a large piece of work; the subject matter of the courses in',
  'their records; and how to use UniMate itself.',
  'Out of scope: everything else — news, sport, politics, religion, health,',
  'money, relationships, entertainment, code or writing unrelated to their',
  'courses, and general knowledge questions that have nothing to do with their',
  'studying. Being asked politely, or told it is "just a quick question", does',
  'not bring a subject into scope.',
  'When a question is out of scope, do not answer it even partially. Reply with',
  'one short line: say you only help with studying, and name one thing you can',
  'help with from their own records instead. Do not lecture, do not apologise',
  'twice, and do not explain your rules.',
  'Reply in the language the student wrote in.',
].join('\n');

export const unimateAssistant: AgentDefinition<AssistantInput, AssistantOutput> = {
  name: 'UniMate Assistant',
  trigger: 'user_message',
  workflow: 'assistant_chat',
  describe: 'Answers questions about the student\'s courses, grades and deadlines from their records.',

  async run(input) {
    const answer = await callText({
      system: systemFor(
        'You are the UniMate Assistant talking directly to the student. Answer only from the '
        + 'records below and the pre-computed figures. If they do not contain the answer, say so '
        + 'plainly and name what the student would need to add. Keep it to a short paragraph. '
        + 'When you give advice rather than a recorded fact, make that explicit.\n\n'
        + SCOPE,
      ),
      messages: [
        ...input.history.slice(-10),
        {
          role: 'user',
          content: [
            renderContext(input.context),
            '',
            'PRE-COMPUTED FIGURES (these are correct — use them, do not recalculate):',
            computedBlock(input.context),
            '',
            `QUESTION: ${input.message}`,
          ].join('\n'),
        },
      ],
      maxTokens: 1500,
      effort: 'medium',
    });
    return { answer };
  },

  /*
   * Most of what students ask is a lookup — what is due, what is my GPA, what
   * do I have today — and those answers are arithmetic over rows that are
   * already here. Refusing them because a model is unavailable would be
   * refusing to read the student their own diary. Anything needing judgement
   * still returns null rather than an imitation.
   */
  fallback: (input) => answerFromRecords(input, computedBlock(input.context)),

  summariseInput: (i) => i.message.slice(0, 120),
  summariseOutput: (o) => `${o.answer.length} character answer returned`,
};

/**
 * The dashboard's single insight. Separate agent because it fires
 * unprompted and must stay to one sentence.
 */
export interface InsightInput { context: StudentContext }
export interface InsightOutput {
  fact: string;
  suggestion: string;
}

const INSIGHT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['fact', 'suggestion'],
  properties: {
    fact: { type: 'string', description: 'One sentence stating something recorded — a deadline, a mark, a standing.' },
    suggestion: { type: 'string', description: 'One sentence suggesting what to do about it. Must follow from the fact.' },
  },
} as const;

export const dashboardInsight: AgentDefinition<InsightInput, InsightOutput> = {
  name: 'Dashboard Insight',
  // Fires on every dashboard open. A free provider allows a few dozen calls a
  // day, and spending them here means the practice set the student actually
  // asked for fails.
  throttleHours: 6,
  trigger: 'dashboard_opened',
  workflow: 'dashboard_insight',
  describe: 'Produces one grounded observation and one suggestion for the dashboard.',

  async run({ context }) {
    return callStructured<InsightOutput>({
      system: systemFor(
        'You write the single insight on the student\'s dashboard. Return one recorded fact and ' +
        'one suggestion that follows from it. The fact must be something in the records — a real ' +
        'deadline, mark or standing, with its specifics. The suggestion must be doable today.',
      ),
      prompt: `${renderContext(context)}\n\n${computedBlock(context)}\n\nWrite today's insight.`,
      schema: INSIGHT_SCHEMA,
      schemaName: 'dashboard_insight',
      effort: 'low',
      maxTokens: 2000,
    });
  },

  /** Deterministic: the nearest deadline and a proportionate nudge. */
  fallback({ context }) {
    const open = context.tasks.filter((t) => t.status !== 'completed' && t.due_date);
    const next = [
      ...context.events.filter((e) => e.event_date && e.event_date >= today()).map((e) => ({
        date: e.event_date!, label: e.title, courseId: e.course_id, weight: e.weight,
      })),
      ...context.grades.filter((g) => g.score === null && g.due_date && g.due_date >= today()).map((g) => ({
        date: g.due_date!, label: g.assessment_name, courseId: g.course_id, weight: g.weight,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date))[0];

    if (!next) {
      if (!open.length) return null;
      return {
        fact: `You have ${open.length} open task${open.length === 1 ? '' : 's'} with a due date.`,
        suggestion: `Start with "${open[0].title}" — it is the soonest.`,
      };
    }

    const course = context.courses.find((c) => c.id === next.courseId);
    const days = Math.round(
      (new Date(next.date).getTime() - new Date(today()).getTime()) / 86_400_000,
    );

    return {
      fact:
        `${course?.course_code ?? 'An assessment'} — ${next.label} is on ${next.date}` +
        `${days === 0 ? ' (today)' : ` (in ${days} day${days === 1 ? '' : 's'})`}` +
        `${next.weight ? `, worth ${next.weight}% of the course` : ''}.`,
      suggestion:
        days <= 3
          ? 'Consider making this your focus for today.'
          : `Consider putting ${context.profile?.preferred_study_minutes ?? 45} minutes toward it this week so it does not stack up.`,
    };
  },

  summariseInput: ({ context }) => `${context.courses.length} courses, ${context.tasks.length} tasks`,
  summariseOutput: (o) => o.fact.slice(0, 120),
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Pre-computed arithmetic, so the model never has to do maths on grades. */
function computedBlock(context: StudentContext): string {
  const byCourse = gradesByCourse(context);
  const lines: string[] = [];

  const cum = cumulativeGpa(context.courses, context.scale);
  const sem = semesterGpa(context.courses, byCourse, context.scale);
  lines.push(`Cumulative GPA: ${cum.gpa ?? 'not available'} (${cum.gradedCredits} graded credits)`);
  lines.push(`Projected semester GPA: ${sem.gpa ?? 'not available'}`);

  for (const c of context.courses.filter((x) => x.status === 'active')) {
    const grades = byCourse.get(c.id) ?? [];
    const b = computeCourseGrade(grades, context.scale);
    const r = requiredForTarget(grades, c.target_grade, context.scale);

    lines.push(
      `${c.course_code}: banked ${b.earnedWeightedPoints} weighted points of 100; ` +
      `${b.currentPercent === null ? 'no marks yet' : `${b.currentPercent}% across marked work (${b.currentLetter})`}; ` +
      `${b.remainingWeight}% still to assess; ` +
      `best still reachable ${b.maxPossiblePercent}%` +
      (r.targetLetter
        ? `; target ${r.targetLetter} (${r.targetPercent}%) → ${
            r.verdict === 'reachable' ? `needs ${r.requiredAveragePercent}% average on what remains`
            : r.verdict === 'impossible' ? `would need ${r.requiredAveragePercent}%, which is above 100% and so out of reach`
            : r.verdict === 'already_achieved' ? 'already secured'
            : 'nothing left to assess'
          }`
        : '; no target set'),
    );
  }
  return lines.join('\n');
}
