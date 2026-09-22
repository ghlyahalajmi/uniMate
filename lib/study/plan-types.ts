import type { Weekday } from '@/lib/groups/availability';

/**
 * The shape of a study plan, kept away from the agent that usually writes one.
 *
 * Both paths produce this: the model when it is available, and the
 * deterministic builder when it is not. Living here rather than beside the
 * prompt means the builder — and its tests — never pull in server-only code.
 */

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
