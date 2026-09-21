/**
 * The raw signals every part of the coach reads.
 *
 * One shape, assembled once from the database, then passed to pure functions.
 * Nothing in this folder performs I/O or calls a model, so every rule the
 * student is judged by can be unit-tested against a fixture.
 */

export interface CoachSignals {
  /** ISO day the snapshot was taken for. */
  today: string;

  // --- Study activity, from activity_days -----------------------------------
  /** Days that earned XP in the last 28 days. */
  activeDaysLast28: number;
  studyMinutesLast7: number;
  studyMinutesPrev7: number;
  practiceSessionsLast7: number;
  practiceSessionsTotal: number;
  questionsAnsweredLast7: number;

  // --- Streak ---------------------------------------------------------------
  currentStreak: number;
  longestStreak: number;
  streakActiveToday: boolean;
  /** Ended yesterday: alive but unclaimed. */
  streakAtRisk: boolean;

  // --- Tasks ----------------------------------------------------------------
  tasksCompletedLast7: number;
  tasksCompletedPrev7: number;
  tasksCompletedTotal: number;
  tasksOpen: number;
  tasksOverdue: number;

  // --- Quizzes --------------------------------------------------------------
  quizzesCompletedLast7: number;
  quizzesCompletedTotal: number;
  /** Mean session score, 0..100, over the most recent sessions. Null when none. */
  quizAverage: number | null;
  /** Mean over the window before that, for the improvement line. Null when none. */
  quizAveragePrevious: number | null;

  // --- Courses --------------------------------------------------------------
  courses: CourseSignal[];

  // --- Exam preparation -----------------------------------------------------
  /** Assessments within the next 14 days that are not yet scored. */
  examsUpcoming: number;
  /** Of those, how many have a study plan attached. */
  examsWithPlan: number;

  // --- Credits --------------------------------------------------------------
  creditsCompleted: number;
  creditsRequired: number;

  // --- GPA ------------------------------------------------------------------
  currentGpa: number | null;
  targetGpa: number | null;
  gpaScale: number;
}

export interface CourseSignal {
  id: string;
  code: string;
  name: string;
  /** Share of the course's weight that has been graded, 0..1. */
  weightGraded: number;
  /** Current weighted standing as a percentage, or null when nothing is marked. */
  currentPercent: number | null;
  /** Mean quiz score for this course, 0..100, or null. */
  quizAverage: number | null;
  tasksTotal: number;
  tasksCompleted: number;
  /** Days until the next unscored assessment, or null when none is scheduled. */
  daysToNextAssessment: number | null;
  /** True when that assessment has a study plan behind it. */
  nextAssessmentHasPlan: boolean;
}

/** Clamp to 0..1. Used everywhere a ratio feeds a score. */
export function ratio(value: number, of: number): number {
  if (of <= 0) return 0;
  return Math.max(0, Math.min(1, value / of));
}

export function pct(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}
