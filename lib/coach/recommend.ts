import type { CoachSignals } from './signals';
import { allCourseHealth } from './progress';

/**
 * "What should I do now?" — one action, never a list.
 *
 * A student staring at twenty open tasks does none of them. This picks the
 * single most useful next thing and says why, so the recommendation reads as
 * reasoning rather than a lottery.
 *
 * The order below is the priority order, and it is deliberate: a deadline the
 * student can still act on beats a weak topic, which beats general practice,
 * which beats admin. Every branch returns an action the student can start in
 * the next half hour.
 */

export type ActionKind =
  | 'prepare_exam' | 'practice_weak_topic' | 'finish_overdue_task'
  | 'next_task' | 'practice_session' | 'review_flashcards'
  | 'keep_streak' | 'add_first_course' | 'log_grades';

export type ReasonKey =
  | 'examInDays' | 'quizBelowTarget' | 'taskOverdue' | 'taskDueSoon'
  | 'noPracticeThisWeek' | 'streakAtRisk' | 'gettingStarted'
  | 'weightsIncomplete' | 'steadyProgress';

export interface Recommendation {
  kind: ActionKind;
  reason: ReasonKey;
  /** Suggested length, in minutes. */
  minutes: number;
  /** The course it concerns, when it concerns one. */
  courseCode: string | null;
  courseId: string | null;
  /** Free text from the record itself — a task title, a topic. Never invented. */
  subject: string | null;
  /** Numbers the copy interpolates. */
  detail: { days?: number; percent?: number; count?: number };
}

export interface RecommendationInput {
  signals: CoachSignals;
  /** The student's own open tasks, most urgent first. */
  openTasks: Array<{
    id: string;
    title: string;
    courseId: string | null;
    courseCode: string | null;
    priority: 'low' | 'medium' | 'high';
    dueDate: string | null;
    estimatedMinutes: number | null;
    overdue: boolean;
  }>;
  /** Topics the student has actually answered questions on, worst first. */
  weakTopics: Array<{ topic: string; courseCode: string | null; courseId: string | null; percent: number }>;
  /** Flashcards due today. */
  flashcardsDue: number;
  defaultSessionMinutes: number;
}

export function recommendNextAction(input: RecommendationInput): Recommendation {
  const { signals: s, openTasks, weakTopics } = input;
  const minutes = clampMinutes(input.defaultSessionMinutes);

  // Nothing set up yet — the only sensible next step is to add a course.
  if (s.courses.length === 0) {
    return action('add_first_course', 'gettingStarted', minutes, null, null, null, {});
  }

  // 1. An exam close enough to matter, with no preparation behind it.
  const urgent = allCourseHealth(s).find((h) => h.status === 'urgent');
  if (urgent) {
    const course = s.courses.find((c) => c.id === urgent.courseId);
    return action(
      'prepare_exam', 'examInDays', minutes,
      urgent.code, urgent.courseId, null,
      { days: course?.daysToNextAssessment ?? undefined },
    );
  }

  // 2. A topic the student's own answers show needs practice.
  const weak = weakTopics[0];
  if (weak && weak.percent < 70) {
    return action(
      'practice_weak_topic', 'quizBelowTarget', minutes,
      weak.courseCode, weak.courseId, weak.topic,
      { percent: Math.round(weak.percent) },
    );
  }

  // 3. Something already past its due date. One, not all of them.
  const overdue = openTasks.find((t) => t.overdue);
  if (overdue) {
    return action(
      'finish_overdue_task', 'taskOverdue', overdue.estimatedMinutes ?? minutes,
      overdue.courseCode, overdue.courseId, overdue.title, {},
    );
  }

  // 4. The streak is alive but unclaimed — a small win keeps it.
  if (s.streakAtRisk && s.currentStreak >= 2) {
    const quick = openTasks[0];
    return action(
      quick ? 'next_task' : 'keep_streak', 'streakAtRisk',
      quick?.estimatedMinutes ?? Math.min(minutes, 20),
      quick?.courseCode ?? null, quick?.courseId ?? null, quick?.title ?? null,
      { count: s.currentStreak },
    );
  }

  // 5. The next task by priority and date.
  const next = openTasks[0];
  if (next) {
    return action(
      'next_task', next.dueDate ? 'taskDueSoon' : 'steadyProgress',
      next.estimatedMinutes ?? minutes,
      next.courseCode, next.courseId, next.title, {},
    );
  }

  // 6. Cards waiting to be reviewed.
  if (input.flashcardsDue > 0) {
    return action(
      'review_flashcards', 'steadyProgress', Math.min(minutes, 15),
      null, null, null, { count: input.flashcardsDue },
    );
  }

  // 7. No practice yet this week.
  if (s.practiceSessionsLast7 === 0) {
    const course = s.courses[0];
    return action(
      'practice_session', 'noPracticeThisWeek', minutes,
      course?.code ?? null, course?.id ?? null, null, {},
    );
  }

  // 8. Grades that cannot be computed because the weights are not all entered.
  const incomplete = s.courses.find((c) => c.weightGraded > 0 && c.weightGraded < 0.99);
  if (incomplete && s.tasksOpen === 0) {
    return action(
      'log_grades', 'weightsIncomplete', 10,
      incomplete.code, incomplete.id, null, {},
    );
  }

  // Everything is genuinely in hand. Still offer practice rather than nothing.
  const course = s.courses[0];
  return action(
    'practice_session', 'steadyProgress', minutes,
    course?.code ?? null, course?.id ?? null, null, {},
  );
}

function action(
  kind: ActionKind, reason: ReasonKey, minutes: number,
  courseCode: string | null, courseId: string | null, subject: string | null,
  detail: Recommendation['detail'],
): Recommendation {
  return { kind, reason, minutes: clampMinutes(minutes), courseCode, courseId, subject, detail };
}

/** Never recommend less than 10 minutes or more than an hour in one sitting. */
function clampMinutes(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 25;
  return Math.max(10, Math.min(60, Math.round(n)));
}

// --- Today's mission ---------------------------------------------------------

export interface MissionTask {
  id: string;
  title: string;
  courseCode: string | null;
  priority: 'low' | 'medium' | 'high';
  minutes: number;
  overdue: boolean;
}

/**
 * Today's Mission — at most five, ordered by priority then by date.
 *
 * Capped on purpose. The point is a list a student can finish, so that
 * finishing it is a real event rather than a theoretical one.
 */
export const MISSION_LIMIT = 5;

export function todaysMission(
  openTasks: RecommendationInput['openTasks'],
  today: string,
  defaultMinutes: number,
): MissionTask[] {
  const rank = { high: 0, medium: 1, low: 2 } as const;

  return openTasks
    .filter((t) => t.overdue || t.dueDate === null || t.dueDate <= addDays(today, 2))
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
      return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
    })
    .slice(0, MISSION_LIMIT)
    .map((t) => ({
      id: t.id,
      title: t.title,
      courseCode: t.courseCode,
      priority: t.priority,
      minutes: clampMinutes(t.estimatedMinutes ?? defaultMinutes),
      overdue: t.overdue,
    }));
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
