import type { CoachSignals, CourseSignal } from './signals';

/**
 * Graduation progress, GPA standing, course health and the week-on-week
 * comparison. Everything here is descriptive: it reports what the records say
 * and leaves the wording to the message layer, which is where the tone rules
 * are enforced.
 */

export interface GraduationProgress {
  creditsCompleted: number;
  creditsRequired: number;
  creditsRemaining: number;
  /** 0..1. */
  progress: number;
  percent: number;
}

export function graduationProgress(s: CoachSignals): GraduationProgress {
  const required = Math.max(0, s.creditsRequired);
  const completed = Math.max(0, Math.min(s.creditsCompleted, required || s.creditsCompleted));
  const progress = required > 0 ? Math.min(1, completed / required) : 0;
  return {
    creditsCompleted: completed,
    creditsRequired: required,
    creditsRemaining: Math.max(0, required - completed),
    progress,
    percent: Math.round(progress * 100),
  };
}

export interface GpaStanding {
  current: number | null;
  target: number | null;
  scale: number;
  /** Positive when the target is still ahead. Null when either is missing. */
  gap: number | null;
  /** True once the current GPA is at or above the target. */
  reached: boolean;
  /** Where the current value sits on a 0..1 bar drawn from 0 to the scale max. */
  currentFraction: number | null;
  targetFraction: number | null;
}

export function gpaStanding(s: CoachSignals): GpaStanding {
  const scale = s.gpaScale > 0 ? s.gpaScale : 4;
  const current = s.currentGpa;
  const target = s.targetGpa;
  const gap = current !== null && target !== null ? Math.round((target - current) * 100) / 100 : null;

  return {
    current,
    target,
    scale,
    gap,
    reached: gap !== null && gap <= 0,
    currentFraction: current !== null ? Math.max(0, Math.min(1, current / scale)) : null,
    targetFraction: target !== null ? Math.max(0, Math.min(1, target / scale)) : null,
  };
}

// --- Course health -----------------------------------------------------------

export type HealthStatus = 'on_track' | 'needs_attention' | 'urgent';

/** Why a course is flagged, as a key the dictionary turns into supportive copy. */
export type HealthReasonKey =
  | 'examSoonNoPlan' | 'lowQuizAverage' | 'tasksOutstanding'
  | 'gradeSlipping' | 'noData' | 'allGood';

export interface CourseHealth {
  courseId: string;
  code: string;
  name: string;
  status: HealthStatus;
  reason: HealthReasonKey;
  /** Numbers the copy interpolates, so the message is specific. */
  detail: { percent?: number; days?: number; open?: number };
}

/** Below this, a quiz average is worth pointing at. */
const QUIZ_CONCERN = 70;
/** A course standing under this is worth a gentle flag. */
const GRADE_CONCERN = 65;
/** An exam this close with no plan behind it is the urgent case. */
const EXAM_URGENT_DAYS = 7;

export function courseHealth(course: CourseSignal): CourseHealth {
  const base = { courseId: course.id, code: course.code, name: course.name };
  const openTasks = Math.max(0, course.tasksTotal - course.tasksCompleted);

  // Urgent is reserved for a deadline the student can still act on. It says
  // "this is close", never "you have failed to prepare".
  if (
    course.daysToNextAssessment !== null &&
    course.daysToNextAssessment <= EXAM_URGENT_DAYS &&
    !course.nextAssessmentHasPlan
  ) {
    return {
      ...base,
      status: 'urgent',
      reason: 'examSoonNoPlan',
      detail: { days: course.daysToNextAssessment },
    };
  }

  if (course.quizAverage !== null && course.quizAverage < QUIZ_CONCERN) {
    return {
      ...base,
      status: 'needs_attention',
      reason: 'lowQuizAverage',
      detail: { percent: Math.round(course.quizAverage) },
    };
  }

  if (course.currentPercent !== null && course.currentPercent < GRADE_CONCERN) {
    return {
      ...base,
      status: 'needs_attention',
      reason: 'gradeSlipping',
      detail: { percent: Math.round(course.currentPercent) },
    };
  }

  if (openTasks >= 3) {
    return {
      ...base,
      status: 'needs_attention',
      reason: 'tasksOutstanding',
      detail: { open: openTasks },
    };
  }

  if (course.currentPercent === null && course.quizAverage === null) {
    return { ...base, status: 'on_track', reason: 'noData', detail: {} };
  }

  return {
    ...base,
    status: 'on_track',
    reason: 'allGood',
    detail: course.currentPercent !== null
      ? { percent: Math.round(course.currentPercent) }
      : {},
  };
}

export function allCourseHealth(s: CoachSignals): CourseHealth[] {
  const order: Record<HealthStatus, number> = { urgent: 0, needs_attention: 1, on_track: 2 };
  return s.courses
    .map(courseHealth)
    .sort((a, b) => order[a.status] - order[b.status] || a.code.localeCompare(b.code));
}

// --- This week ---------------------------------------------------------------

export interface WeeklyMetric {
  key: 'studyMinutes' | 'tasks' | 'quizzes' | 'questions' | 'sessions';
  value: number;
  previous: number;
  delta: number;
}

export interface WeeklyProgress {
  metrics: WeeklyMetric[];
  studyMinutes: number;
  /** Minutes more (or fewer) than the week before. */
  studyMinutesDelta: number;
  tasksCompleted: number;
  streak: number;
  /** True when at least one headline metric went up. Drives the tone. */
  improved: boolean;
}

export function weeklyProgress(s: CoachSignals): WeeklyProgress {
  const metrics: WeeklyMetric[] = [
    metric('studyMinutes', s.studyMinutesLast7, s.studyMinutesPrev7),
    metric('tasks', s.tasksCompletedLast7, s.tasksCompletedPrev7),
    metric('quizzes', s.quizzesCompletedLast7, 0),
    metric('questions', s.questionsAnsweredLast7, 0),
    metric('sessions', s.practiceSessionsLast7, 0),
  ];

  return {
    metrics,
    studyMinutes: s.studyMinutesLast7,
    studyMinutesDelta: s.studyMinutesLast7 - s.studyMinutesPrev7,
    tasksCompleted: s.tasksCompletedLast7,
    streak: s.currentStreak,
    improved:
      s.studyMinutesLast7 > s.studyMinutesPrev7 ||
      s.tasksCompletedLast7 > s.tasksCompletedPrev7,
  };
}

function metric(key: WeeklyMetric['key'], value: number, previous: number): WeeklyMetric {
  return { key, value, previous, delta: value - previous };
}

/** Quiz improvement worth celebrating: the spec's "62% → 78%" line. */
export function quizImprovement(s: CoachSignals): { from: number; to: number } | null {
  if (s.quizAverage === null || s.quizAveragePrevious === null) return null;
  const from = Math.round(s.quizAveragePrevious);
  const to = Math.round(s.quizAverage);
  return to > from ? { from, to } : null;
}
