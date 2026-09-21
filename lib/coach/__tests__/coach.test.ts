import assert from 'node:assert/strict';
import { academicMomentum, MOMENTUM_EXPECTATIONS } from '../momentum-score';
import { academicLevel, stepsToNextLevel, ACADEMIC_LEVELS } from '../academic-level';
import {
  graduationProgress, gpaStanding, courseHealth, allCourseHealth,
  weeklyProgress, quizImprovement,
} from '../progress';
import { evaluateMilestones, MILESTONES } from '../milestones';
import { recommendNextAction, todaysMission, MISSION_LIMIT } from '../recommend';
import {
  dailyMessage, taskCompletedMessage, wrongAnswerMessage,
  isSupportive, FORBIDDEN_PHRASES,
} from '../messages';
import type { CoachSignals, CourseSignal } from '../signals';

let passed = 0;
function check(name: string, fn: () => void) { fn(); passed++; console.log('  PASS  ' + name); }

// A student who has done nothing at all.
const EMPTY: CoachSignals = {
  today: '2026-09-21',
  activeDaysLast28: 0,
  studyMinutesLast7: 0, studyMinutesPrev7: 0,
  practiceSessionsLast7: 0, practiceSessionsTotal: 0, questionsAnsweredLast7: 0,
  currentStreak: 0, longestStreak: 0, streakActiveToday: false, streakAtRisk: false,
  tasksCompletedLast7: 0, tasksCompletedPrev7: 0, tasksCompletedTotal: 0,
  tasksOpen: 0, tasksOverdue: 0,
  quizzesCompletedLast7: 0, quizzesCompletedTotal: 0,
  quizAverage: null, quizAveragePrevious: null,
  courses: [],
  examsUpcoming: 0, examsWithPlan: 0,
  creditsCompleted: 0, creditsRequired: 120,
  currentGpa: null, targetGpa: null, gpaScale: 4,
};

const course = (over: Partial<CourseSignal> = {}): CourseSignal => ({
  id: 'c1', code: 'CSC230', name: 'Digital Logic',
  weightGraded: 0.5, currentPercent: 78, quizAverage: 78,
  tasksTotal: 10, tasksCompleted: 8,
  daysToNextAssessment: null, nextAssessmentHasPlan: false,
  ...over,
});

const signals = (over: Partial<CoachSignals> = {}): CoachSignals => ({
  ...EMPTY, courses: [course()], ...over,
});

console.log('\nacademic momentum');

check('a blank record scores the neutral middle, not zero', () => {
  const m = academicMomentum(EMPTY);
  // Consistency and tasks are genuinely zero; the other three are unmeasured
  // and sit at neutral rather than punishing a student who has no data yet.
  assert.equal(m.measuredCount, 1, 'only consistency is measurable with no courses, tasks or quizzes');
  assert.ok(m.total > 0, 'an empty record is not a zero score');
  assert.ok(m.total < 50, 'but it is well below a working term');
});

check('a strong term scores high and marks every component measured', () => {
  const m = academicMomentum(signals({
    activeDaysLast28: 20, tasksCompletedLast7: 8, tasksCompletedTotal: 40,
    quizAverage: 85, examsUpcoming: 2, examsWithPlan: 2,
    courses: [course({ weightGraded: 1 })],
  }));
  assert.equal(m.total, 100);
  assert.equal(m.measuredCount, 5);
});

check('each component is capped, so one heroic week cannot carry the score', () => {
  const m = academicMomentum(signals({
    tasksCompletedLast7: 500, tasksCompletedTotal: 500,
  }));
  const tasks = m.components.find((c) => c.key === 'tasks');
  assert.equal(tasks?.score, 100, 'capped at 100, not 6000');
  assert.ok(m.total < 60, 'the other components still hold the total down');
});

check('unmeasured components are flagged rather than silently counted', () => {
  const m = academicMomentum(signals({ quizAverage: null, examsUpcoming: 0 }));
  assert.equal(m.components.find((c) => c.key === 'quizzes')?.unmeasured, true);
  assert.equal(m.components.find((c) => c.key === 'examPrep')?.unmeasured, true);
});

check('the stated expectations are what the score actually uses', () => {
  const m = academicMomentum(signals({
    activeDaysLast28: MOMENTUM_EXPECTATIONS.activeDaysPerMonth,
  }));
  assert.equal(m.components.find((c) => c.key === 'consistency')?.score, 100);
});

console.log('\nacademic level');

check('starts every student at level 1', () => {
  const l = academicLevel(EMPTY);
  assert.equal(l.level, 1);
  assert.equal(l.code, 'getting_started');
  assert.ok(l.progress >= 0 && l.progress <= 1);
});

check('is not driven by GPA', () => {
  const lowGpa = academicLevel(signals({
    currentGpa: 1.2, activeDaysLast28: 20, tasksCompletedTotal: 60,
    practiceSessionsTotal: 30, currentStreak: 14, quizAverage: 85,
    courses: [course({ weightGraded: 1 })], examsUpcoming: 0,
  }));
  const highGpa = academicLevel(signals({ currentGpa: 4.0 }));
  assert.ok(
    lowGpa.level > highGpa.level,
    'work done this term outranks an inherited GPA',
  );
});

check('reaches the top level only when every signal is strong', () => {
  const l = academicLevel(signals({
    activeDaysLast28: 20, tasksCompletedTotal: 60, quizAverage: 85,
    practiceSessionsTotal: 30, currentStreak: 14, examsUpcoming: 0,
    courses: [course({ weightGraded: 1 })],
  }));
  assert.equal(l.points, 100);
  assert.equal(l.level, 6);
  assert.equal(l.next, null);
  assert.equal(l.pointsToNext, 0);
});

check('having no quizzes yet costs the share but never goes negative', () => {
  const l = academicLevel(signals({ quizAverage: null, activeDaysLast28: 10 }));
  const quizzes = l.breakdown.find((b) => b.key === 'quizzes');
  assert.equal(quizzes?.earned, 0);
  assert.ok(l.points >= 0);
});

check('the level thresholds are ordered and reachable', () => {
  for (let i = 1; i < ACADEMIC_LEVELS.length; i++) {
    assert.ok(
      ACADEMIC_LEVELS[i].threshold > ACADEMIC_LEVELS[i - 1].threshold,
      'each level must cost more than the last',
    );
  }
  assert.equal(ACADEMIC_LEVELS[ACADEMIC_LEVELS.length - 1].threshold <= 100, true);
});

check('next-level steps are concrete actions, never more than two', () => {
  const s = signals({ activeDaysLast28: 8, tasksCompletedTotal: 5, practiceSessionsTotal: 2 });
  const steps = stepsToNextLevel(s, academicLevel(s));
  assert.ok(steps.length > 0 && steps.length <= 2);
  for (const step of steps) assert.ok(step.amount > 0, 'an ask of zero is not an ask');
});

console.log('\ngraduation and GPA');

check('reports credits and percentage', () => {
  const g = graduationProgress(signals({ creditsCompleted: 42, creditsRequired: 120 }));
  assert.equal(g.percent, 35);
  assert.equal(g.creditsRemaining, 78);
});

check('survives a missing credit requirement without dividing by zero', () => {
  const g = graduationProgress(signals({ creditsCompleted: 12, creditsRequired: 0 }));
  assert.equal(g.progress, 0);
  assert.equal(g.percent, 0);
  assert.ok(Number.isFinite(g.percent));
});

check('knows when the target GPA is already met', () => {
  const g = gpaStanding(signals({ currentGpa: 3.8, targetGpa: 3.7 }));
  assert.equal(g.reached, true);
  assert.ok((g.gap ?? 0) <= 0);
});

check('reports the gap without editorialising', () => {
  const g = gpaStanding(signals({ currentGpa: 3.42, targetGpa: 3.7 }));
  assert.equal(g.gap, 0.28);
  assert.equal(g.reached, false);
});

console.log('\ncourse health');

check('flags an exam that is close with nothing planned', () => {
  const h = courseHealth(course({ daysToNextAssessment: 3, nextAssessmentHasPlan: false }));
  assert.equal(h.status, 'urgent');
  assert.equal(h.reason, 'examSoonNoPlan');
  assert.equal(h.detail.days, 3);
});

check('does not flag the same exam once there is a plan behind it', () => {
  const h = courseHealth(course({ daysToNextAssessment: 3, nextAssessmentHasPlan: true }));
  assert.notEqual(h.status, 'urgent');
});

check('points at a weak quiz average as attention, never as failure', () => {
  const h = courseHealth(course({ quizAverage: 55 }));
  assert.equal(h.status, 'needs_attention');
  assert.equal(h.reason, 'lowQuizAverage');
  assert.equal(h.detail.percent, 55);
});

check('a course with nothing marked is not called unhealthy', () => {
  const h = courseHealth(course({ currentPercent: null, quizAverage: null, tasksTotal: 0, tasksCompleted: 0 }));
  assert.equal(h.status, 'on_track');
  assert.equal(h.reason, 'noData');
});

check('sorts the most urgent course first', () => {
  const list = allCourseHealth(signals({
    courses: [
      course({ id: 'a', code: 'AAA', quizAverage: 90, currentPercent: 90 }),
      course({ id: 'b', code: 'BBB', daysToNextAssessment: 2, nextAssessmentHasPlan: false }),
    ],
  }));
  assert.equal(list[0].code, 'BBB');
  assert.equal(list[0].status, 'urgent');
});

console.log('\nweekly progress');

check('compares this week with the one before', () => {
  const w = weeklyProgress(signals({ studyMinutesLast7: 275, studyMinutesPrev7: 230 }));
  assert.equal(w.studyMinutesDelta, 45, 'the "45 minutes more" line comes from real numbers');
  assert.equal(w.improved, true);
});

check('a quieter week is reported without being called a failure', () => {
  const w = weeklyProgress(signals({ studyMinutesLast7: 60, studyMinutesPrev7: 200 }));
  assert.equal(w.improved, false);
  assert.equal(w.studyMinutesDelta, -140, 'the number is honest');
});

check('only reports quiz improvement when the score actually went up', () => {
  assert.deepEqual(
    quizImprovement(signals({ quizAveragePrevious: 62, quizAverage: 78 })),
    { from: 62, to: 78 },
  );
  assert.equal(quizImprovement(signals({ quizAveragePrevious: 80, quizAverage: 70 })), null);
  assert.equal(quizImprovement(signals({ quizAveragePrevious: null, quizAverage: 70 })), null);
});

console.log('\nmilestones');

check('the first milestone is reachable in one action', () => {
  const m = evaluateMilestones(EMPTY);
  assert.equal(m.next?.code, 'first_task');
  assert.equal(m.next?.target, 1);
});

check('finishing one promotes the next', () => {
  const m = evaluateMilestones(signals({ tasksCompletedTotal: 1, practiceSessionsTotal: 1 }));
  assert.equal(m.next?.code, 'tasks_10');
  assert.ok(m.reached.includes('first_task'));
  assert.ok(m.reached.includes('first_session'));
});

check('progress never exceeds the target', () => {
  const m = evaluateMilestones(signals({ tasksCompletedTotal: 9999 }));
  for (const item of m.all) {
    assert.ok(item.current <= item.target, item.code + ' overshot its own target');
    assert.ok(item.progress <= 1);
  }
});

check('every milestone in the catalogue has a positive target', () => {
  for (const def of MILESTONES) assert.ok(def.target > 0, def.code);
});

console.log('\nnext best action');

const noTasks = { openTasks: [], weakTopics: [], flashcardsDue: 0, defaultSessionMinutes: 25 };

check('sends a brand-new student to add a course', () => {
  const r = recommendNextAction({ signals: EMPTY, ...noTasks });
  assert.equal(r.kind, 'add_first_course');
});

check('an exam in three days outranks everything else', () => {
  const r = recommendNextAction({
    signals: signals({ courses: [course({ daysToNextAssessment: 3, nextAssessmentHasPlan: false })] }),
    ...noTasks,
    weakTopics: [{ topic: 'D Flip-Flops', courseCode: 'CSC230', courseId: 'c1', percent: 40 }],
  });
  assert.equal(r.kind, 'prepare_exam');
  assert.equal(r.detail.days, 3);
});

check('otherwise practises the topic the answers show is weak', () => {
  const r = recommendNextAction({
    signals: signals(), ...noTasks,
    weakTopics: [{ topic: 'D Flip-Flops', courseCode: 'CSC230', courseId: 'c1', percent: 45 }],
  });
  assert.equal(r.kind, 'practice_weak_topic');
  assert.equal(r.subject, 'D Flip-Flops', 'the topic comes from the record, not invented');
  assert.equal(r.detail.percent, 45);
});

check('always returns exactly one action, never a list', () => {
  const r = recommendNextAction({ signals: signals(), ...noTasks });
  assert.equal(typeof r.kind, 'string');
  assert.ok(r.minutes >= 10 && r.minutes <= 60, 'the ask is always a sitting a student can start');
});

check('clamps an absurd estimate into a sitting', () => {
  const r = recommendNextAction({
    signals: signals(), ...noTasks,
    openTasks: [{
      id: 't', title: 'Huge', courseId: null, courseCode: null, priority: 'high',
      dueDate: null, estimatedMinutes: 900, overdue: true,
    }],
  });
  assert.equal(r.minutes, 60);
});

console.log("\ntoday's mission");

check('caps the list at something a student can finish', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    id: String(i), title: 'Task ' + i, courseId: null, courseCode: null,
    priority: 'medium' as const, dueDate: '2026-09-21', estimatedMinutes: 30, overdue: false,
  }));
  assert.equal(todaysMission(many, '2026-09-21', 25).length, MISSION_LIMIT);
});

check('puts overdue first, then high priority', () => {
  const mission = todaysMission([
    { id: 'a', title: 'Low', courseId: null, courseCode: null, priority: 'low', dueDate: '2026-09-21', estimatedMinutes: 20, overdue: false },
    { id: 'b', title: 'High', courseId: null, courseCode: null, priority: 'high', dueDate: '2026-09-21', estimatedMinutes: 30, overdue: false },
    { id: 'c', title: 'Overdue', courseId: null, courseCode: null, priority: 'low', dueDate: '2026-09-18', estimatedMinutes: 15, overdue: true },
  ], '2026-09-21', 25);
  assert.deepEqual(mission.map((m) => m.title), ['Overdue', 'High', 'Low']);
});

console.log('\nmotivation tone');

check('a quiet week is encouraging, never a reprimand', () => {
  const m = dailyMessage(signals({
    tasksCompletedTotal: 12, practiceSessionsTotal: 3,
    studyMinutesLast7: 0, tasksCompletedLast7: 0,
  }));
  assert.equal(m.key, 'weekQuiet');
  assert.equal(m.tone, 'encouraging');
});

check('a broken streak keeps the progress and drops the blame', () => {
  const m = dailyMessage(signals({
    tasksCompletedTotal: 20, practiceSessionsTotal: 5,
    currentStreak: 0, longestStreak: 9,
  }));
  assert.equal(m.key, 'streakBroken');
  assert.equal(m.tone, 'encouraging');
  assert.equal(m.values.longest, 9, 'it still names what was achieved');
});

check('leads with a real improvement when there is one', () => {
  const m = dailyMessage(signals({
    tasksCompletedTotal: 10, quizAveragePrevious: 62, quizAverage: 78,
  }));
  assert.equal(m.key, 'quizImproved');
  assert.deepEqual(m.values, { from: 62, to: 78 });
});

check('no tone is ever negative', () => {
  const cases: CoachSignals[] = [
    EMPTY,
    signals({ tasksCompletedTotal: 1, studyMinutesLast7: 0, tasksCompletedLast7: 0 }),
    signals({ tasksCompletedTotal: 40, currentStreak: 0, longestStreak: 20 }),
    signals({ tasksCompletedTotal: 40, tasksOverdue: 15, tasksOpen: 30 }),
    signals({ tasksCompletedTotal: 5, quizAverage: 20, courses: [course({ quizAverage: 20, currentPercent: 30 })] }),
  ];
  for (const c of cases) {
    const m = dailyMessage(c);
    assert.ok(
      ['positive', 'steady', 'encouraging'].includes(m.tone),
      'produced a tone outside the allowed three: ' + m.tone,
    );
  }
});

check('a wrong answer is framed as information', () => {
  assert.equal(wrongAnswerMessage().tone, 'encouraging');
});

check('finishing several tasks reads differently from finishing one', () => {
  assert.equal(taskCompletedMessage(1).key, 'taskCompleted');
  assert.equal(taskCompletedMessage(4).key, 'tasksMultiple');
});

check('the shaming filter catches what it is meant to, in both languages', () => {
  assert.equal(isSupportive('Great work this week, keep going.'), true);
  assert.equal(isSupportive("You're lazy and behind everyone."), false);
  assert.equal(isSupportive('You are FAILING this course'), false);
  assert.equal(isSupportive('أنت كسول'), false);
  assert.equal(isSupportive('عمل رائع، استمر'), true);
});

check('every forbidden phrase is actually rejected by the filter', () => {
  for (const phrase of FORBIDDEN_PHRASES) {
    assert.equal(
      isSupportive('Some text ' + phrase + ' more text'),
      false,
      'filter missed: ' + phrase,
    );
  }
});

console.log('\n' + passed + ' checks passed\n');
