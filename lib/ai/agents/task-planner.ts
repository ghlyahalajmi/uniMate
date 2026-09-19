import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';
import { renderContext, weakTopics, type StudentContext } from '../context';
import type { TaskPriority } from '@/types/database';

export interface TaskPlannerInput {
  context: StudentContext;
  horizonDays: number;
}

export interface PlannedTask {
  title: string;
  description: string | null;
  course_code: string | null;
  priority: TaskPriority;
  due_date: string | null;
  estimated_minutes: number;
}

export interface TaskPlannerOutput {
  tasks: PlannedTask[];
  reasoning: string;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tasks', 'reasoning'],
  properties: {
    reasoning: { type: 'string', description: 'One sentence on how the list was prioritised.' },
    tasks: {
      type: 'array', maxItems: 10,
      items: {
        type: 'object', additionalProperties: false,
        required: ['title','description','course_code','priority','due_date','estimated_minutes'],
        properties: {
          title: { type: 'string', description: 'An action, e.g. "Rework the Quiz 1 separable-equation problems".' },
          description: { type: ['string','null'] },
          course_code: { type: ['string','null'], description: 'Must be a course code from the records.' },
          priority: { type: 'string', enum: ['low','medium','high'] },
          due_date: { type: ['string','null'], description: 'ISO YYYY-MM-DD, on or before the deadline it serves.' },
          estimated_minutes: { type: 'integer', minimum: 10, maximum: 240 },
        },
      },
    },
  },
} as const;

/**
 * Agent 6 — Task Planner.
 *   Input:   the student's deadlines, weak topics and current workload.
 *   Output:  actionable tasks, each tied to a real course and deadline.
 *   Trigger: the student asks for a study plan.
 *   Failure: falls back to deterministic tasks derived from upcoming deadlines.
 */
export const taskPlanner: AgentDefinition<TaskPlannerInput, TaskPlannerOutput> = {
  name: 'Task Planner',
  trigger: 'user_requested',
  workflow: 'workflow_task_planning',
  describe: 'Turns upcoming deadlines and weak topics into a short, concrete task list.',

  async run(input) {
    const weak = weakTopics(input.context);
    const open = input.context.tasks.filter((t) => t.status !== 'completed');

    const result = await callStructured<TaskPlannerOutput>({
      system: systemFor(
        'You are the Task Planner. Produce a short list of concrete, doable tasks from the ' +
        'deadlines and weak topics in the records. Do not duplicate a task that is already open. ' +
        'Every task must serve a specific recorded deadline or a specific recorded weak topic. ' +
        'Keep the total under about four hours of work — an overwhelming list gets ignored.',
      ),
      prompt: [
        renderContext(input.context),
        '',
        weak.length ? `WEAKEST TOPICS: ${weak.slice(0, 4).map((w) => `${w.topic} (${Math.round(w.rate * 100)}% correct)`).join(', ')}` : '',
        open.length ? `ALREADY ON THE LIST (do not repeat): ${open.map((t) => t.title).join('; ')}` : '',
        '',
        `Plan the next ${input.horizonDays} days.`,
      ].filter(Boolean).join('\n'),
      schema: SCHEMA,
      schemaName: 'task_plan',
      effort: 'medium',
    });

    return { ...result, tasks: (result.tasks ?? []).slice(0, 10) };
  },

  /** Deterministic: one preparation task per upcoming deadline that has none. */
  fallback(input) {
    const { context, horizonDays } = input;
    const open = context.tasks.filter((t) => t.status !== 'completed');
    const tasks: PlannedTask[] = [];

    const upcoming = [
      ...context.events
        .filter((e) => e.event_date && withinDays(e.event_date, horizonDays))
        .map((e) => ({
          title: e.title,
          date: e.event_date!,
          courseId: e.course_id,
          weight: e.weight,
          type: e.event_type as string,
        })),
      ...context.grades
        .filter((g) => g.score === null && g.due_date && withinDays(g.due_date, horizonDays))
        .map((g) => ({
          title: g.assessment_name,
          date: g.due_date!,
          courseId: g.course_id,
          weight: g.weight,
          type: g.assessment_type as string,
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const seen = new Set<string>();
    for (const item of upcoming) {
      const key = `${item.courseId}:${item.title}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const course = context.courses.find((c) => c.id === item.courseId);
      const title = `Prepare for ${item.title}${course ? ` (${course.course_code})` : ''}`;
      if (open.some((t) => t.title.toLowerCase() === title.toLowerCase())) continue;

      const days = daysUntil(item.date);
      tasks.push({
        title,
        description: `${item.title} is on ${item.date}${item.weight ? `, worth ${item.weight}% of the course` : ''}.`,
        course_code: course?.course_code ?? null,
        priority: (item.weight ?? 0) >= 25 || (days !== null && days <= 7) ? 'high' : days !== null && days <= 14 ? 'medium' : 'low',
        due_date: shiftDate(item.date, -Math.min(3, Math.max(1, Math.floor((days ?? 3) / 2)))),
        estimated_minutes: (item.weight ?? 0) >= 25 ? 120 : 60,
      });
      if (tasks.length >= 8) break;
    }

    if (!tasks.length) return null;
    return {
      tasks,
      reasoning: `Built from the ${tasks.length} recorded deadlines in the next ${horizonDays} days, highest-weight first.`,
    };
  },

  summariseInput: (i) => `Planning the next ${i.horizonDays} days`,
  summariseOutput: (o) => `${o.tasks.length} tasks proposed`,
};

/**
 * Agent 7 — Study Reminder Agent (Workflow D).
 * Deterministic on purpose: a revision ramp before an exam is a schedule, not
 * a judgement call, and the student can edit or delete any of it.
 */
export interface ReminderInput {
  context: StudentContext;
  /** Only look this far ahead. */
  horizonDays: number;
}

export interface PlannedReminder {
  course_id: string | null;
  event_id: string | null;
  title: string;
  body: string | null;
  remind_on: string;
}

export interface ReminderOutput {
  reminders: PlannedReminder[];
  note: string;
}

export const studyReminderAgent: AgentDefinition<ReminderInput, ReminderOutput> = {
  name: 'Study Reminder Agent',
  trigger: 'exam_approaching',
  workflow: 'workflow_d_upcoming_exam',
  describe: 'Schedules a revision ramp in the days before each recorded assessment.',

  async run(input) {
    // The ramp is deterministic; there is nothing here worth a model call.
    const out = buildReminders(input);
    if (!out) throw new Error('No upcoming assessments to build reminders from.');
    return out;
  },

  fallback(input) {
    return buildReminders(input);
  },

  summariseInput: (i) => `Scanning ${i.horizonDays} days of assessments`,
  summariseOutput: (o) => `${o.reminders.length} study reminders created`,
};

function buildReminders(input: ReminderInput): ReminderOutput | null {
  const { context, horizonDays } = input;
  const existing = new Set(
    context.reminders.map((r) => `${r.course_id}:${r.title}:${r.remind_on}`),
  );

  const exams = context.events
    .filter((e) =>
      e.event_date &&
      withinDays(e.event_date, horizonDays) &&
      ['exam', 'midterm', 'final', 'quiz'].includes(e.event_type),
    )
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));

  const reminders: PlannedReminder[] = [];

  for (const exam of exams) {
    const course = context.courses.find((c) => c.id === exam.course_id);
    const days = daysUntil(exam.event_date!);
    if (days === null || days < 2) continue;

    // Scale the ramp to the time available rather than always using five steps.
    const ramp: Array<{ offset: number; label: string; body: string | null }> =
      days >= 14
        ? [
            { offset: -14, label: 'Start revision', body: 'Read through the earliest material first.' },
            { offset: -9,  label: 'Topic review', body: null },
            { offset: -6,  label: 'Practice questions', body: 'Work under timed conditions.' },
            { offset: -3,  label: 'Weak topic review', body: 'Focus on what the practice sets caught.' },
            { offset: -1,  label: 'Final review', body: 'Light review only. Sleep early.' },
          ]
        : days >= 7
        ? [
            { offset: -6, label: 'Start revision', body: null },
            { offset: -3, label: 'Practice questions', body: 'Work under timed conditions.' },
            { offset: -1, label: 'Final review', body: 'Light review only.' },
          ]
        : [
            { offset: -2, label: 'Revision session', body: null },
            { offset: -1, label: 'Final review', body: 'Light review only.' },
          ];

    for (const step of ramp) {
      const on = shiftDate(exam.event_date!, step.offset);
      if (!on || on < todayIso()) continue;

      const title = `${course?.course_code ?? 'Study'} — ${step.label}`;
      const key = `${exam.course_id}:${title}:${on}`;
      if (existing.has(key)) continue;
      existing.add(key);

      reminders.push({
        course_id: exam.course_id,
        event_id: exam.id,
        title,
        body: step.body ?? `${exam.title} is on ${exam.event_date}.`,
        remind_on: on,
      });
    }
  }

  if (!reminders.length) return null;
  return {
    reminders,
    note: `Built a revision ramp for ${exams.length} upcoming assessment${exams.length === 1 ? '' : 's'}. Edit or delete any of these.`,
  };
}

// --- date helpers ------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(date: string): number | null {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const at = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((at(d) - at(new Date())) / 86_400_000);
}

function withinDays(date: string, horizon: number): boolean {
  const d = daysUntil(date);
  return d !== null && d >= 0 && d <= horizon;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
