import { type CoachSignals, pct, ratio } from './signals';

/**
 * Academic Momentum — a 0..100 reading of how the term is going *right now*.
 *
 * Five components, equally weighted, each a ratio of something the student
 * actually did against a stated, reachable expectation. The expectations are
 * constants here rather than curves, so a student can be told exactly what the
 * number is made of and what would move it.
 *
 * This is a progress indicator, not a judgement. It deliberately does not
 * include GPA: a student cannot change last term's grades today, and a score
 * that is mostly fixed history would tell them nothing about what to do next.
 */

export const MOMENTUM_EXPECTATIONS = {
  /** Days active out of the last 28 that counts as fully consistent. */
  activeDaysPerMonth: 20,
  /** Open tasks are not punished; completing this many a week is the mark. */
  tasksPerWeek: 8,
  /** Quiz average that counts as full marks on this component. */
  quizTarget: 85,
  /** Share of an exam's preparation plan expected to be in place. */
  examPlanShare: 1,
} as const;

export type MomentumComponentKey =
  | 'consistency' | 'tasks' | 'quizzes' | 'examPrep' | 'courseProgress';

export interface MomentumComponent {
  key: MomentumComponentKey;
  /** 0..100. */
  score: number;
  /** True when there is not enough data yet to read anything into it. */
  unmeasured: boolean;
}

export interface MomentumScore {
  /** 0..100, the headline. */
  total: number;
  components: MomentumComponent[];
  /** Components with real data behind them. */
  measuredCount: number;
}

/**
 * A component with no underlying data scores neutral rather than zero, and is
 * marked `unmeasured` so the interface can say "not enough data yet" instead
 * of showing a student a zero they did nothing to earn.
 */
const NEUTRAL = 50;

export function academicMomentum(s: CoachSignals): MomentumScore {
  const components: MomentumComponent[] = [];

  // Study consistency — showing up, measured over a month.
  components.push({
    key: 'consistency',
    score: pct(ratio(s.activeDaysLast28, MOMENTUM_EXPECTATIONS.activeDaysPerMonth)),
    unmeasured: false,
  });

  // Task completion — what was finished this week, against the weekly mark.
  components.push({
    key: 'tasks',
    score: pct(ratio(s.tasksCompletedLast7, MOMENTUM_EXPECTATIONS.tasksPerWeek)),
    unmeasured: s.tasksCompletedTotal === 0 && s.tasksOpen === 0,
  });

  // Quiz performance — the average itself, against a target of 85%.
  const hasQuiz = s.quizAverage !== null;
  components.push({
    key: 'quizzes',
    score: hasQuiz ? pct(ratio(s.quizAverage as number, MOMENTUM_EXPECTATIONS.quizTarget)) : NEUTRAL,
    unmeasured: !hasQuiz,
  });

  // Exam preparation — of the exams coming up, how many are planned for.
  const hasExams = s.examsUpcoming > 0;
  components.push({
    key: 'examPrep',
    score: hasExams ? pct(ratio(s.examsWithPlan, s.examsUpcoming)) : NEUTRAL,
    unmeasured: !hasExams,
  });

  // Course progress — how far through the graded weight the courses are.
  const graded = s.courses.filter((c) => c.weightGraded > 0);
  const hasCourses = graded.length > 0;
  const meanProgress = hasCourses
    ? graded.reduce((sum, c) => sum + c.weightGraded, 0) / graded.length
    : 0;
  components.push({
    key: 'courseProgress',
    score: hasCourses ? pct(meanProgress) : NEUTRAL,
    unmeasured: !hasCourses,
  });

  const total = Math.round(
    components.reduce((sum, c) => sum + c.score, 0) / components.length,
  );

  return {
    total,
    components,
    measuredCount: components.filter((c) => !c.unmeasured).length,
  };
}
