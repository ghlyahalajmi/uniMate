import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';
import { renderContext, type StudentContext, gradesByCourse } from '../context';
import { cumulativeGpa } from '@/lib/calculations/gpa';

export interface AnalystInput { context: StudentContext }

export interface AnalystOutput {
  patterns: Array<{ title: string; detail: string; evidence: string }>;
  strengths: string[];
  watchAreas: string[];
  /** Explicitly a suggestion, never presented as a university fact. */
  suggestions: string[];
  basedOn: { completedCourses: number; assessments: number };
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['patterns', 'strengths', 'watchAreas', 'suggestions'],
  properties: {
    patterns: {
      type: 'array', maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'detail', 'evidence'],
        properties: {
          title: { type: 'string', description: 'Six words or fewer.' },
          detail: { type: 'string', description: 'One or two sentences.' },
          evidence: { type: 'string', description: 'The exact courses, grades or credits this follows from.' },
        },
      },
    },
    strengths: { type: 'array', maxItems: 4, items: { type: 'string' } },
    watchAreas: { type: 'array', maxItems: 4, items: { type: 'string' } },
    suggestions: { type: 'array', maxItems: 4, items: { type: 'string' } },
  },
} as const;

/**
 * Agent 1 — Academic Analyst.
 *   Input:   the full student context.
 *   Output:  patterns, strengths, watch areas and suggestions, each tied to a record.
 *   Trigger: the student asks for an analysis on the Analytics screen.
 *   Failure: falls back to a deterministic pass over completed courses.
 */
export const academicAnalyst: AgentDefinition<AnalystInput, AnalystOutput> = {
  name: 'Academic Analyst',
  trigger: 'user_requested',
  workflow: 'analyst_on_demand',
  describe: 'Reads the completed academic record and reports the patterns actually present in it.',

  async run({ context }) {
    const result = await callStructured<Omit<AnalystOutput, 'basedOn'>>({
      system: systemFor(
        'You are the Academic Analyst. Report only patterns that the records below actually '
        + 'support. If the record is too thin to support a pattern, say so instead of inventing '
        + 'one. Quote the specific courses, grades or practice results behind every claim.\n\n'
        + 'Three sources, not one. Completed courses say what this student has already proved they '
        + 'can do; marked assessments say how the current semester is going; practice sessions say '
        + 'which topics they get wrong when nobody is marking. A subject can be a strength by grade '
        + 'and a weakness in practice — say so when it is, because that gap is the most useful '
        + 'thing in the record.\n\n'
        + 'Name subjects, not feelings. "Weak at circuits, from 58% on the CE210 midterm and 4/10 '
        + 'on filter practice" is something to act on; "could revise more" is not.\n\n'
        + 'Every suggestion must follow from a specific record and say what to do next week, not in '
        + 'general.',
      ),
      prompt: `${renderContext(context)}\n\nAnalyse this academic record.`,
      schema: SCHEMA,
      schemaName: 'academic_analysis',
      effort: 'high',
    });
    return { ...result, basedOn: countBasis(context) };
  },

  fallback({ context }) {
    const completed = context.courses.filter((c) => c.status === 'completed' && c.final_points !== null);
    if (completed.length === 0) return null;

    const byPrefix = new Map<string, { points: number; credits: number }>();
    for (const c of completed) {
      const prefix = c.course_code.replace(/\d+.*$/, '') || c.course_code;
      const e = byPrefix.get(prefix) ?? { points: 0, credits: 0 };
      e.points += Number(c.final_points) * Number(c.credits);
      e.credits += Number(c.credits);
      byPrefix.set(prefix, e);
    }

    const ranked = [...byPrefix.entries()]
      .filter(([, v]) => v.credits > 0)
      .map(([prefix, v]) => ({ prefix, avg: v.points / v.credits, credits: v.credits }))
      .sort((a, b) => b.avg - a.avg);

    const overall = cumulativeGpa(context.courses, context.scale);
    const patterns: AnalystOutput['patterns'] = [];

    if (ranked.length >= 2) {
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      patterns.push({
        title: `Strongest in ${best.prefix} courses`,
        detail: `Your ${best.prefix} courses average ${best.avg.toFixed(2)} grade points across ${best.credits} credits, the highest of any subject prefix on your record.`,
        evidence: completed.filter((c) => c.course_code.startsWith(best.prefix)).map((c) => `${c.course_code} ${c.final_grade}`).join(', '),
      });
      if (worst.avg < best.avg - 0.4) {
        patterns.push({
          title: `${worst.prefix} courses trail the rest`,
          detail: `Your ${worst.prefix} courses average ${worst.avg.toFixed(2)} grade points, ${(best.avg - worst.avg).toFixed(2)} below your ${best.prefix} average.`,
          evidence: completed.filter((c) => c.course_code.startsWith(worst.prefix)).map((c) => `${c.course_code} ${c.final_grade}`).join(', '),
        });
      }
    }

    const heavy = groupBySemester(completed);
    for (const [semester, credits] of heavy) {
      if (credits >= 14) {
        patterns.push({
          title: `${semester} was a heavy semester`,
          detail: `You carried ${credits} credits in ${semester}.`,
          evidence: completed.filter((c) => c.semester === semester).map((c) => c.course_code).join(', '),
        });
        break;
      }
    }

    return {
      patterns,
      strengths: ranked.slice(0, 2).map((r) => `${r.prefix} courses (${r.avg.toFixed(2)} average grade points)`),
      watchAreas: ranked.slice(-1).filter((r) => r.avg < 3).map((r) => `${r.prefix} courses (${r.avg.toFixed(2)} average grade points)`),
      suggestions: overall.gpa !== null && context.profile?.target_gpa
        ? [`Your cumulative GPA is ${overall.gpa} against a target of ${context.profile.target_gpa}. Consider where the remaining credits can move it.`]
        : [],
      basedOn: countBasis(context),
    };
  },

  summariseInput: ({ context }) =>
    `${context.courses.filter((c) => c.status === 'completed').length} completed courses, ${context.grades.length} assessments`,
  summariseOutput: (o) =>
    `${o.patterns.length} patterns identified across the academic record`,
};

function countBasis(context: StudentContext) {
  return {
    completedCourses: context.courses.filter((c) => c.status === 'completed').length,
    assessments: context.grades.length,
  };
}

function groupBySemester(courses: StudentContext['courses']): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const c of courses) {
    if (!c.semester) continue;
    map.set(c.semester, (map.get(c.semester) ?? 0) + Number(c.credits));
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export { gradesByCourse };
