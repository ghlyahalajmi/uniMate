import { type CoachSignals, ratio } from './signals';

/**
 * Academic Level — six named stages a student moves through.
 *
 * Explicitly *not* GPA. A student who inherits a strong GPA has not done
 * anything this week, and a student rebuilding from a weak one should still be
 * able to climb. Every signal below is something the student can act on today.
 *
 * Codes are permanent; the visible names live in the dictionary so they can be
 * reworded, and translated, without changing what anyone has earned.
 */

export type AcademicLevelCode =
  | 'getting_started' | 'building_momentum' | 'consistent_learner'
  | 'academic_climber' | 'high_achiever' | 'graduation_ready';

export interface AcademicLevelDef {
  code: AcademicLevelCode;
  level: number;
  emoji: string;
  /** Points needed to stand at this level. */
  threshold: number;
}

/**
 * 100 points spread across six levels. The early ones are close together so a
 * student starting out sees movement quickly; the later ones spread out so
 * "Graduation Ready" keeps meaning something.
 */
export const ACADEMIC_LEVELS: AcademicLevelDef[] = [
  { code: 'getting_started',    level: 1, emoji: '🌱', threshold: 0 },
  { code: 'building_momentum',  level: 2, emoji: '🚀', threshold: 15 },
  { code: 'consistent_learner', level: 3, emoji: '📚', threshold: 32 },
  { code: 'academic_climber',   level: 4, emoji: '🔥', threshold: 52 },
  { code: 'high_achiever',      level: 5, emoji: '⭐', threshold: 74 },
  { code: 'graduation_ready',   level: 6, emoji: '🎓', threshold: 92 },
];

/** Each signal's share of the 100 points. */
export const LEVEL_WEIGHTS = {
  consistency: 22,   // active days over the last month
  tasks: 18,         // tasks completed, all time
  quizzes: 15,       // quiz average
  sessions: 13,      // practice sessions completed
  courseProgress: 12,// share of course weight graded
  examPrep: 8,       // upcoming exams that have a plan
  streak: 12,        // current run
} as const;

/** What each signal is measured against to score its full share. */
export const LEVEL_TARGETS = {
  activeDaysPerMonth: 20,
  tasksCompleted: 60,
  quizAverage: 85,
  practiceSessions: 30,
  streakDays: 14,
} as const;

export interface LevelSignalBreakdown {
  key: keyof typeof LEVEL_WEIGHTS;
  earned: number;
  possible: number;
}

export interface AcademicLevelInfo {
  code: AcademicLevelCode;
  level: number;
  emoji: string;
  /** 0..100 across all six levels. */
  points: number;
  /** 0..1 through the current level toward the next. */
  progress: number;
  /** Null at the top level. */
  next: AcademicLevelDef | null;
  pointsToNext: number;
  breakdown: LevelSignalBreakdown[];
}

export function academicLevel(s: CoachSignals): AcademicLevelInfo {
  const breakdown: LevelSignalBreakdown[] = [
    {
      key: 'consistency',
      earned: LEVEL_WEIGHTS.consistency * ratio(s.activeDaysLast28, LEVEL_TARGETS.activeDaysPerMonth),
      possible: LEVEL_WEIGHTS.consistency,
    },
    {
      key: 'tasks',
      earned: LEVEL_WEIGHTS.tasks * ratio(s.tasksCompletedTotal, LEVEL_TARGETS.tasksCompleted),
      possible: LEVEL_WEIGHTS.tasks,
    },
    {
      // No quizzes yet is not a deduction — it scores zero of a share the
      // student can still go and earn, rather than dragging the level down.
      key: 'quizzes',
      earned: s.quizAverage === null
        ? 0
        : LEVEL_WEIGHTS.quizzes * ratio(s.quizAverage, LEVEL_TARGETS.quizAverage),
      possible: LEVEL_WEIGHTS.quizzes,
    },
    {
      key: 'sessions',
      earned: LEVEL_WEIGHTS.sessions * ratio(s.practiceSessionsTotal, LEVEL_TARGETS.practiceSessions),
      possible: LEVEL_WEIGHTS.sessions,
    },
    {
      key: 'courseProgress',
      earned: LEVEL_WEIGHTS.courseProgress * meanCourseProgress(s),
      possible: LEVEL_WEIGHTS.courseProgress,
    },
    {
      key: 'examPrep',
      earned: s.examsUpcoming === 0
        ? LEVEL_WEIGHTS.examPrep
        : LEVEL_WEIGHTS.examPrep * ratio(s.examsWithPlan, s.examsUpcoming),
      possible: LEVEL_WEIGHTS.examPrep,
    },
    {
      key: 'streak',
      earned: LEVEL_WEIGHTS.streak * ratio(s.currentStreak, LEVEL_TARGETS.streakDays),
      possible: LEVEL_WEIGHTS.streak,
    },
  ];

  const points = Math.round(
    Math.min(100, breakdown.reduce((sum, b) => sum + b.earned, 0)),
  );

  let current = ACADEMIC_LEVELS[0];
  for (const def of ACADEMIC_LEVELS) if (points >= def.threshold) current = def;

  const next = ACADEMIC_LEVELS.find((d) => d.level === current.level + 1) ?? null;
  const floor = current.threshold;
  const ceiling = next?.threshold ?? 100;
  const span = ceiling - floor;

  return {
    code: current.code,
    level: current.level,
    emoji: current.emoji,
    points,
    progress: span > 0 ? Math.min(1, (points - floor) / span) : 1,
    next,
    pointsToNext: next ? Math.max(0, next.threshold - points) : 0,
    breakdown,
  };
}

function meanCourseProgress(s: CoachSignals): number {
  const graded = s.courses.filter((c) => c.weightGraded > 0);
  if (!graded.length) return 0;
  return graded.reduce((sum, c) => sum + c.weightGraded, 0) / graded.length;
}

/**
 * Two concrete things that would move the student up a level, chosen as the
 * cheapest wins rather than the biggest gaps: "complete 3 study sessions" beats
 * "raise your quiz average", because one is an action and the other is a wish.
 */
export interface NextLevelStep {
  key: keyof typeof LEVEL_WEIGHTS;
  /** How many more of the underlying thing. */
  amount: number;
}

export function stepsToNextLevel(s: CoachSignals, info: AcademicLevelInfo): NextLevelStep[] {
  if (!info.next) return [];

  const gap = info.pointsToNext;
  const steps: NextLevelStep[] = [];

  // Points each additional unit is worth, for the signals a student can move
  // directly this week.
  const perSession = LEVEL_WEIGHTS.sessions / LEVEL_TARGETS.practiceSessions;
  const perTask = LEVEL_WEIGHTS.tasks / LEVEL_TARGETS.tasksCompleted;
  const perStreakDay = LEVEL_WEIGHTS.streak / LEVEL_TARGETS.streakDays;

  // Split the gap across sessions and tasks, the two most directly actionable.
  const half = gap / 2;
  const sessions = Math.ceil(half / perSession);
  const tasks = Math.ceil(half / perTask);

  if (s.practiceSessionsTotal < LEVEL_TARGETS.practiceSessions && sessions > 0) {
    steps.push({ key: 'sessions', amount: sessions });
  }
  if (s.tasksCompletedTotal < LEVEL_TARGETS.tasksCompleted && tasks > 0) {
    steps.push({ key: 'tasks', amount: tasks });
  }
  if (!steps.length && s.currentStreak < LEVEL_TARGETS.streakDays) {
    steps.push({ key: 'streak', amount: Math.ceil(gap / perStreakDay) });
  }

  return steps.slice(0, 2);
}
