import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';
import { renderContext, type StudentContext } from '../context';
import type { Course, WorkloadLevel, Weekday } from '@/types/database';

export interface PlannerInput {
  context: StudentContext;
  candidateIds: string[];
  semester?: string;
  /**
   * How many of the candidates the student wants to actually take.
   *
   * Without this the planner returns three plans of every size and leaves the
   * choosing to them, which is fine when they have five candidates and useless
   * when they have twelve and know they want six.
   */
  targetCourseCount?: number | null;
}

export interface PlanOption {
  name: string;
  workload_level: WorkloadLevel;
  course_ids: string[];
  total_credits: number;
  rationale: string;
  assumptions: string[];
  conflicts: string[];
}

export interface PlannerOutput {
  plans: PlanOption[];
  /** Stated once, prominently: none of these is objectively best. */
  disclaimer: string;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['plans'],
  properties: {
    plans: {
      type: 'array', minItems: 2, maxItems: 4,
      items: {
        type: 'object', additionalProperties: false,
        required: ['name','workload_level','course_codes','rationale','assumptions'],
        properties: {
          name: { type: 'string' },
          workload_level: { type: 'string', enum: ['light','balanced','intensive'] },
          course_codes: { type: 'array', items: { type: 'string' }, description: 'Course codes drawn only from the candidate list.' },
          rationale: { type: 'string', description: 'Two sentences on the trade-off this plan makes.' },
          assumptions: { type: 'array', items: { type: 'string' }, description: 'What this plan assumes that the records do not confirm.' },
        },
      },
    },
  },
} as const;

/**
 * Agent 3 — Course Planner.
 *   Input:   candidate courses plus the student's history and timetable.
 *   Output:  two to four comparable plans, each with its trade-off stated.
 *   Trigger: the student asks for plans on the Planner screen.
 *   Failure: falls back to deterministic light/balanced/intensive splits.
 *
 * Timetable conflicts are computed here rather than asked of the model, so a
 * plan can never claim to be conflict-free when it is not.
 */
export const coursePlanner: AgentDefinition<PlannerInput, PlannerOutput> = {
  name: 'Course Planner',
  trigger: 'user_requested',
  workflow: 'workflow_planner',
  describe: 'Builds several candidate semester schedules and states the trade-off behind each.',

  async run(input) {
    const candidates = input.context.courses.filter((c) => input.candidateIds.includes(c.id));
    if (!candidates.length) throw new Error('No candidate courses were supplied.');

    const raw = await callStructured<{ plans: Array<Omit<PlanOption, 'course_ids' | 'total_credits' | 'conflicts'> & { course_codes: string[] }> }>({
      system: systemFor(
        'You are the Course Planner. Build two to four different semester plans from the candidate '
        + 'courses only. Never label one plan as best — each should state what it trades away. Use '
        + 'the student\'s past grades in related subjects to reason about load, and say so in the '
        + 'rationale. Do not invent prerequisites: if the records do not state one, do not assume '
        + 'it. List anything you are assuming in the assumptions array.\n\n'
        + 'Choosing which courses to leave out is the work. A semester is not a list of everything '
        + 'available — spread difficulty rather than stacking the hard subjects together, keep the '
        + 'timetable survivable, and say in the rationale which candidate you dropped and why, '
        + 'because that is the decision the student is actually asking you to help with.',
      ),
      prompt: [
        renderContext(input.context),
        '',
        'CANDIDATE COURSES FOR NEXT SEMESTER:',
        ...candidates.map((c) =>
          `  ${c.course_code} — ${c.course_name}, ${c.credits} credits` +
          `${c.difficulty ? `, difficulty ${c.difficulty}/5` : ''}` +
          `${c.days.length ? `, ${c.days.join('/')} ${(c.start_time ?? '').slice(0, 5)}–${(c.end_time ?? '').slice(0, 5)}` : ''}`,
        ),
        '',
        input.targetCourseCount
          ? `The student wants about ${input.targetCourseCount} courses this semester. Every plan `
            + 'should hold close to that number; choose which candidates earn the places and drop '
            + 'the rest rather than returning plans of every possible size.'
          : 'Produce a light, a balanced and an intensive plan.',
      ].join('\n'),
      schema: SCHEMA,
      schemaName: 'semester_plans',
      effort: 'high',
    });

    const plans: PlanOption[] = (raw.plans ?? []).map((p) => {
      const chosen = p.course_codes
        .map((code) => candidates.find((c) => c.course_code.toUpperCase() === code.trim().toUpperCase()))
        .filter((c): c is Course => Boolean(c));

      return {
        name: p.name,
        workload_level: p.workload_level,
        course_ids: chosen.map((c) => c.id),
        total_credits: round2(chosen.reduce((s, c) => s + Number(c.credits), 0)),
        rationale: p.rationale,
        assumptions: p.assumptions ?? [],
        conflicts: findConflicts(chosen),
      };
    }).filter((p) => p.course_ids.length > 0);

    if (!plans.length) throw new Error('No plan matched the candidate courses.');

    return { plans, disclaimer: DISCLAIMER };
  },

  fallback(input) {
    const candidates = input.context.courses.filter((c) => input.candidateIds.includes(c.id));
    if (!candidates.length) return null;

    // Easiest first, so the light plan is genuinely the lighter one.
    const ordered = [...candidates].sort(
      (a, b) => (a.difficulty ?? 3) - (b.difficulty ?? 3) || Number(a.credits) - Number(b.credits),
    );

    const build = (name: string, level: WorkloadLevel, cap: number): PlanOption => {
      const picked: Course[] = [];
      let credits = 0;
      for (const c of ordered) {
        if (credits + Number(c.credits) > cap) continue;
        if (findConflicts([...picked, c]).length > findConflicts(picked).length) continue;
        picked.push(c);
        credits += Number(c.credits);
      }
      return {
        name, workload_level: level,
        course_ids: picked.map((c) => c.id),
        total_credits: round2(credits),
        rationale: `Fills up to ${cap} credits, taking the least demanding candidates first and skipping anything that clashes with what is already in the plan.`,
        assumptions: [
          'Built from credit totals and recorded difficulty only.',
          'Prerequisites are not checked — UniMate does not hold your university\'s prerequisite rules.',
        ],
        conflicts: findConflicts(picked),
      };
    };

    return {
      plans: [build('Light plan', 'light', 9), build('Balanced plan', 'balanced', 12), build('Intensive plan', 'intensive', 15)]
        .filter((p) => p.course_ids.length > 0),
      disclaimer: DISCLAIMER,
    };
  },

  summariseInput: (i) => `${i.candidateIds.length} candidate courses${i.semester ? ` for ${i.semester}` : ''}`,
  summariseOutput: (o) => `${o.plans.length} candidate schedules generated`,
};

const DISCLAIMER =
  'None of these is objectively best — they trade workload against pace. ' +
  'UniMate does not hold your university\'s prerequisite or registration rules, so check ' +
  'eligibility with your department before registering.';

/** Two courses clash when they share a weekday and their time ranges overlap. */
export function findConflicts(courses: Course[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i];
      const b = courses[j];
      if (!a.start_time || !a.end_time || !b.start_time || !b.end_time) continue;
      const shared = a.days.filter((d: Weekday) => b.days.includes(d));
      if (!shared.length) continue;
      if (a.start_time < b.end_time && b.start_time < a.end_time) {
        out.push(`${a.course_code} and ${b.course_code} overlap on ${shared.join(', ')}`);
      }
    }
  }
  return out;
}

function round2(n: number) { return Math.round(n * 100) / 100; }
