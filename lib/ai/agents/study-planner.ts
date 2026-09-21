import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';
import type { Weekday } from '@/types/database';

/** One course the plan has to cover, with what is known about its pressure. */
export interface PlannedCourse {
  id: string;
  code: string;
  name: string;
  /** Chapters the student has uploaded, in teaching order. */
  chapters: Array<{ id: string; title: string }>;
  /** Unscored assessments ahead, so revision lands before the thing it is for. */
  upcoming: Array<{ title: string; date: string | null; weight: number | null }>;
  /** Percent so far, when there is enough marked work to say. */
  currentPercent: number | null;
}

export interface StudyPlanInput {
  courses: PlannedCourse[];
  /** Today, as the student's browser sees it. */
  todayIso: string;
  /** How long a session should run when nothing else decides. */
  defaultMinutes: number;
  /** Weekdays the student said they can study. Empty means no constraint. */
  availableDays: Weekday[];
  /** Days the plan may span. */
  horizonDays: number;
  weakTopics?: string[];
}

export interface PlannedSession {
  courseId: string;
  /** Which uploaded chapter this session is on, when one fits. */
  materialId: string | null;
  topic: string;
  /** ISO date, within the horizon. */
  scheduledOn: string;
  /** 24-hour HH:MM. */
  startTime: string;
  minutes: number;
  /** Why this sits here — shown beside it, so the order can be argued with. */
  reason: string;
}

export interface StudyPlanOutput {
  title: string;
  goal: string;
  sessions: PlannedSession[];
  /** Anything the student should know before approving. */
  notes: string[];
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'goal', 'sessions', 'notes'],
  properties: {
    title: { type: 'string', description: 'Short, e.g. "Midterm revision — three courses".' },
    goal: { type: 'string', description: 'One sentence on what this plan is for.' },
    sessions: {
      type: 'array', maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['courseId', 'materialId', 'topic', 'scheduledOn', 'startTime', 'minutes', 'reason'],
        properties: {
          courseId: { type: 'string', description: 'Exactly one of the ids given.' },
          materialId: { type: ['string', 'null'], description: 'One of that course’s chapter ids, or null.' },
          topic: { type: 'string', description: 'What this session covers, in the course’s words.' },
          scheduledOn: { type: 'string', description: 'YYYY-MM-DD, today or later, inside the horizon.' },
          startTime: { type: 'string', description: 'HH:MM, 24-hour.' },
          minutes: { type: 'integer', minimum: 15, maximum: 180 },
          reason: { type: 'string', description: 'One clause: why here, why now.' },
        },
      },
    },
    notes: { type: 'array', maxItems: 4, items: { type: 'string' } },
  },
} as const;

/**
 * Agent — Study Planner.
 *   Input:   the courses to cover, their chapters, what is due, and when the
 *            student can work.
 *   Output:  dated, timed sessions the student approves before anything is saved.
 *   Trigger: the student asks for a study plan.
 *   Failure: no offline equivalent — spacing chapters against deadlines is the
 *            judgement being asked for, and a fixed rule would produce a
 *            calendar nobody follows.
 *
 * Nothing here writes. The plan is shown, argued with, and only then saved,
 * because a schedule that appears in someone's week uninvited is a schedule
 * they resent.
 */
export const studyPlanner: AgentDefinition<StudyPlanInput, StudyPlanOutput> = {
  name: 'Study Planner',
  trigger: 'study_plan_requested',
  workflow: 'workflow_h_study_plan',
  describe: 'Turns courses, chapters and deadlines into dated study sessions to approve.',

  async run(input) {
    const days = input.availableDays.length
      ? `The student can study on: ${input.availableDays.join(', ')}. Use no other weekday.`
      : 'The student did not restrict which days they can study.';

    const courses = input.courses.map((c) => {
      const chapters = c.chapters.length
        ? c.chapters.map((ch) => `      - ${ch.id} :: ${ch.title}`).join('\n')
        : '      (no chapters uploaded)';
      const due = c.upcoming.length
        ? c.upcoming.map((a) =>
            `      - ${a.title}${a.date ? ` on ${a.date}` : ''}${a.weight !== null ? ` (${a.weight}% of the course)` : ''}`,
          ).join('\n')
        : '      (nothing scheduled)';
      return `  ${c.id} :: ${c.code} — ${c.name}`
        + `${c.currentPercent !== null ? ` — currently ${c.currentPercent}%` : ''}\n`
        + `    chapters:\n${chapters}\n    coming up:\n${due}`;
    }).join('\n\n');

    return callStructured<StudyPlanOutput>({
      system: systemFor(
        'You are the Study Planner. You lay out study sessions across the next few weeks and the '
        + 'student decides whether to accept them.\n\n'
        + 'Work backwards from what is due. A session earns its place by landing before the thing '
        + 'it prepares for, with enough room to fail and retry; revision the night before an exam '
        + 'is the plan a student makes for themselves and the reason they asked for help.\n\n'
        + 'Space repetition rather than blocking. Two shorter sessions on a chapter days apart beat '
        + 'one long one, so return to a heavy chapter instead of finishing it in a sitting.\n\n'
        + 'Weight by consequence and by weakness: an assessment worth a fifth of the course, or a '
        + 'topic this student keeps getting wrong, deserves more of the week than one they have '
        + 'already passed comfortably.\n\n'
        + 'Be honest about capacity. Three or four sessions a week that someone actually does are '
        + 'worth more than a full calendar they abandon by Wednesday. Never schedule two sessions '
        + 'at the same time on the same day, never put one in the past, and never use a weekday '
        + 'the student ruled out.\n\n'
        + 'Name only the course ids and chapter ids you were given. Inventing one produces a '
        + 'session that points at nothing.',
      ),
      prompt:
        `Today is ${input.todayIso}. Plan the next ${input.horizonDays} days.\n`
        + `${days}\n`
        + `A session should run about ${input.defaultMinutes} minutes unless the work suggests otherwise.\n`
        + (input.weakTopics?.length
          ? `Topics this student keeps getting wrong: ${input.weakTopics.join(', ')}.\n`
          : '')
        + `\nCourses:\n\n${courses}\n`,
      schema: SCHEMA,
      schemaName: 'study_plan',
      maxTokens: 20000,
      effort: 'high',
    });
  },

  fallback: () => null,

  summariseInput: (i) => `Study plan for ${i.courses.length} course(s) over ${i.horizonDays} days`,
  summariseOutput: (o) => `${o.sessions.length} sessions proposed, awaiting approval`,
};
