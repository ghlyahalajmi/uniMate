import type { CoachSignals } from './signals';

/**
 * Milestones — the next achievable goal, always exactly one.
 *
 * The rule is that a student should never look at this and think "that is
 * miles away". Each milestone is measured against something already being
 * counted, and the catalogue is ordered so the next one is always within
 * reach of the last.
 *
 * Codes are permanent. The visible titles live in the dictionary.
 */

export type MilestoneCode =
  | 'first_task' | 'first_session' | 'tasks_10' | 'study_5h'
  | 'streak_7' | 'quizzes_5' | 'quiz_average_80' | 'tasks_25'
  | 'streak_14' | 'exam_prepared' | 'sessions_20' | 'streak_30';

export interface MilestoneDef {
  code: MilestoneCode;
  target: number;
  /** Which signal counts toward it. */
  measure: (s: CoachSignals) => number;
  icon: string;
}

/**
 * Ordered easiest first. The active milestone is the first one not yet met, so
 * finishing one automatically promotes the next.
 */
export const MILESTONES: MilestoneDef[] = [
  { code: 'first_task',      target: 1,  icon: 'check',  measure: (s) => s.tasksCompletedTotal },
  { code: 'first_session',   target: 1,  icon: 'study',  measure: (s) => s.practiceSessionsTotal },
  { code: 'tasks_10',        target: 10, icon: 'check',  measure: (s) => s.tasksCompletedTotal },
  { code: 'study_5h',        target: 300, icon: 'clock', measure: (s) => s.studyMinutesLast7 },
  { code: 'streak_7',        target: 7,  icon: 'flame',  measure: (s) => s.currentStreak },
  { code: 'quizzes_5',       target: 5,  icon: 'study',  measure: (s) => s.quizzesCompletedTotal },
  { code: 'quiz_average_80', target: 80, icon: 'sparkle', measure: (s) => Math.round(s.quizAverage ?? 0) },
  { code: 'tasks_25',        target: 25, icon: 'check',  measure: (s) => s.tasksCompletedTotal },
  { code: 'streak_14',       target: 14, icon: 'flame',  measure: (s) => s.currentStreak },
  { code: 'exam_prepared',   target: 1,  icon: 'trophy', measure: (s) => s.examsWithPlan },
  { code: 'sessions_20',     target: 20, icon: 'study',  measure: (s) => s.practiceSessionsTotal },
  { code: 'streak_30',       target: 30, icon: 'flame',  measure: (s) => s.currentStreak },
];

export const MILESTONE_BY_CODE = new Map(MILESTONES.map((m) => [m.code, m]));

export interface MilestoneProgress {
  code: MilestoneCode;
  icon: string;
  current: number;
  target: number;
  /** 0..1. */
  progress: number;
  complete: boolean;
}

export function milestoneProgress(def: MilestoneDef, s: CoachSignals): MilestoneProgress {
  const current = Math.max(0, def.measure(s));
  return {
    code: def.code,
    icon: def.icon,
    current: Math.min(current, def.target),
    target: def.target,
    progress: Math.min(1, current / def.target),
    complete: current >= def.target,
  };
}

/**
 * Every milestone with its progress, plus the one currently being worked
 * toward. `reached` holds codes already met, which is what the caller stores so
 * a milestone is celebrated once.
 *
 * A streak milestone is a special case: a broken streak lowers the reading, but
 * `reached` is the caller's stored record, so an earned milestone is never
 * taken back.
 */
export function evaluateMilestones(s: CoachSignals): {
  all: MilestoneProgress[];
  next: MilestoneProgress | null;
  reached: MilestoneCode[];
} {
  const all = MILESTONES.map((def) => milestoneProgress(def, s));
  const next = all.find((m) => !m.complete) ?? null;
  return { all, next, reached: all.filter((m) => m.complete).map((m) => m.code) };
}
