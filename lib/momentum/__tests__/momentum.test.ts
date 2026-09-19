import assert from 'node:assert/strict';
import {
  computeStreak, levelFromXp, xpForLevel, xpForEvent, applyDailyCap,
  buildHeatmap, totals, XP_RULES, type ActivityDay,
} from '../engine';
import { evaluateAchievements } from '../achievements';

let passed = 0;
function check(name: string, fn: () => void) { fn(); passed++; console.log('  PASS  ' + name); }

const day = (d: string, xp = 20, extra: Partial<ActivityDay> = {}): ActivityDay => ({
  day: d, tasks_completed: 0, practice_sessions: 0, questions_answered: 0,
  focus_minutes: 0, grades_logged: 0, xp, ...extra,
});

console.log('\nstreak');

check('counts consecutive days ending today', () => {
  const s = computeStreak(
    [day('2026-09-17'), day('2026-09-18'), day('2026-09-19')],
    '2026-09-19',
  );
  assert.equal(s.current, 3);
  assert.equal(s.activeToday, true);
  assert.equal(s.atRisk, false);
  assert.equal(s.startedOn, '2026-09-17');
});

check('stays alive but at risk when today is not done yet', () => {
  const s = computeStreak([day('2026-09-17'), day('2026-09-18')], '2026-09-19');
  assert.equal(s.current, 2, 'yesterday still anchors the run');
  assert.equal(s.activeToday, false);
  assert.equal(s.atRisk, true);
});

check('breaks when two days are missed', () => {
  const s = computeStreak([day('2026-09-15'), day('2026-09-16')], '2026-09-19');
  assert.equal(s.current, 0);
  assert.equal(s.atRisk, false);
  assert.equal(s.startedOn, null);
});

check('a gap splits the run', () => {
  const s = computeStreak(
    [day('2026-09-14'), day('2026-09-15'), day('2026-09-18'), day('2026-09-19')],
    '2026-09-19',
  );
  assert.equal(s.current, 2);
  assert.equal(s.longest, 2);
});

check('remembers the longest run even after it breaks', () => {
  const s = computeStreak(
    ['2026-09-01','2026-09-02','2026-09-03','2026-09-04','2026-09-05', '2026-09-19']
      .map((d) => day(d)),
    '2026-09-19',
  );
  assert.equal(s.current, 1);
  assert.equal(s.longest, 5);
});

check('a zero-XP day does not count', () => {
  const s = computeStreak([day('2026-09-18', 0), day('2026-09-19')], '2026-09-19');
  assert.equal(s.current, 1, 'the empty day breaks the chain');
});

check('handles no activity at all', () => {
  const s = computeStreak([], '2026-09-19');
  assert.deepEqual(
    { c: s.current, l: s.longest, r: s.atRisk, a: s.activeToday },
    { c: 0, l: 0, r: false, a: false },
  );
});

check('crosses a month boundary', () => {
  const s = computeStreak(
    [day('2026-08-30'), day('2026-08-31'), day('2026-09-01')],
    '2026-09-01',
  );
  assert.equal(s.current, 3);
});

console.log('\nXP');

check('task XP stacks priority and punctuality', () => {
  assert.equal(xpForEvent({ kind: 'task' }), 10);
  assert.equal(xpForEvent({ kind: 'task', highPriority: true }), 15);
  assert.equal(xpForEvent({ kind: 'task', highPriority: true, onTime: true }), 20);
});

check('practice XP rewards correct answers', () => {
  assert.equal(xpForEvent({ kind: 'practice', correctAnswers: 0 }), 15);
  assert.equal(xpForEvent({ kind: 'practice', correctAnswers: 8 }), 31);
});

check('focus XP is granted per completed ten minutes', () => {
  assert.equal(xpForEvent({ kind: 'focus', focusMinutes: 9 }), 0);
  assert.equal(xpForEvent({ kind: 'focus', focusMinutes: 25 }), 12);
  assert.equal(xpForEvent({ kind: 'focus', focusMinutes: 60 }), 36);
});

check('the daily cap limits what lands', () => {
  assert.equal(applyDailyCap(0, 40), 40);
  assert.equal(applyDailyCap(140, 40), 10, 'only the remaining room');
  assert.equal(applyDailyCap(XP_RULES.dailyCap, 40), 0);
  assert.equal(applyDailyCap(0, -5), 0, 'never negative');
});

console.log('\nlevels');

check('thresholds step up by a constant amount', () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 250);
  assert.equal(xpForLevel(3), 600);
  assert.equal(xpForLevel(4), 1050);
});

check('maps XP to the right level and progress', () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(249).level, 1);
  assert.equal(levelFromXp(250).level, 2);
  assert.equal(levelFromXp(599).level, 2);
  assert.equal(levelFromXp(600).level, 3);

  const mid = levelFromXp(425); // 175 into a 350-wide level 2
  assert.equal(mid.level, 2);
  assert.equal(mid.xpIntoLevel, 175);
  assert.equal(mid.xpForNextLevel, 350);
  assert.equal(mid.progress, 0.5);
});

check('a negative total is floored at level 1', () => {
  assert.equal(levelFromXp(-100).level, 1);
  assert.equal(levelFromXp(-100).totalXp, 0);
});

console.log('\nheatmap and totals');

check('builds a full grid ending on today', () => {
  const grid = buildHeatmap([day('2026-09-19', 60)], '2026-09-19', 4);
  assert.equal(grid.length, 28);
  const today = grid.find((c) => c.day === '2026-09-19');
  assert.ok(today, 'today is in the grid');
  assert.equal(today!.intensity, 3);
  assert.equal(today!.future, false);
});

check('grades intensity by XP', () => {
  const grid = buildHeatmap(
    [day('2026-09-16', 0), day('2026-09-17', 10), day('2026-09-18', 30), day('2026-09-19', 120)],
    '2026-09-19', 2,
  );
  const at = (d: string) => grid.find((c) => c.day === d)!.intensity;
  assert.equal(at('2026-09-16'), 0);
  assert.equal(at('2026-09-17'), 1);
  assert.equal(at('2026-09-18'), 2);
  assert.equal(at('2026-09-19'), 4);
});

check('sums the totals', () => {
  const r = totals([
    day('2026-09-18', 30, { tasks_completed: 2, focus_minutes: 50 }),
    day('2026-09-19', 40, { tasks_completed: 1, practice_sessions: 1, questions_answered: 10 }),
    day('2026-09-17', 0),
  ]);
  assert.equal(r.tasksCompleted, 3);
  assert.equal(r.focusMinutes, 50);
  assert.equal(r.questionsAnswered, 10);
  assert.equal(r.activeDays, 2, 'the zero-XP day is not active');
});

console.log('\nachievements');

const baseCtx = {
  days: [] as ActivityDay[],
  streak: { current: 0, longest: 0, atRisk: false, activeToday: false, startedOn: null, currentDays: [] },
  totalQuestions: 0,
  bestSessionScore: null,
  syllabiCount: 0,
  coursesWithFullWeights: 0,
  targetsSecured: 0,
  comebackTopic: null,
  taskCompletionHours: [] as number[],
  weekendActiveDays: 0,
};

check('awards nothing on an empty record', () => {
  assert.equal(evaluateAchievements(baseCtx).length, 0);
});

check('unlocks every streak tier at or below the longest run', () => {
  const codes = evaluateAchievements({
    ...baseCtx,
    streak: { ...baseCtx.streak, longest: 15 },
  }).map((a) => a.code);
  assert.ok(codes.includes('streak_3'));
  assert.ok(codes.includes('streak_7'));
  assert.ok(codes.includes('streak_14'));
  assert.ok(!codes.includes('streak_30'), '30 is not yet earned');
});

check('carries the evidence that earned it', () => {
  const got = evaluateAchievements({
    ...baseCtx,
    days: [day('2026-09-19', 40, { tasks_completed: 4 })],
  });
  const first = got.find((a) => a.code === 'first_task');
  assert.ok(first);
  assert.match(first!.evidence, /4 tasks/);
});

check('deep work needs two hours in a single day', () => {
  const twoShort = evaluateAchievements({
    ...baseCtx,
    days: [day('2026-09-18', 40, { focus_minutes: 90 }), day('2026-09-19', 40, { focus_minutes: 90 })],
  }).map((a) => a.code);
  assert.ok(!twoShort.includes('deep_work'), 'split across days does not count');

  const oneLong = evaluateAchievements({
    ...baseCtx,
    days: [day('2026-09-19', 40, { focus_minutes: 130 })],
  }).map((a) => a.code);
  assert.ok(oneLong.includes('deep_work'));
});

check('reads the clock for early bird and night owl', () => {
  const early = evaluateAchievements({ ...baseCtx, taskCompletionHours: [7] }).map((a) => a.code);
  assert.ok(early.includes('early_bird'));
  assert.ok(!early.includes('night_owl'));

  const late = evaluateAchievements({ ...baseCtx, taskCompletionHours: [23] }).map((a) => a.code);
  assert.ok(late.includes('night_owl'));
});

console.log(`\n${passed} checks passed\n`);
