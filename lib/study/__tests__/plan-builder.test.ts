import assert from 'node:assert/strict';
import { buildStudyPlan } from '../plan-builder';
import type { StudyPlanInput } from '../plan-types';
import { outlineFromText, cardsFromText } from '../outline';

let failures = 0;
function check(name: string, fn: () => void) {
  try { fn(); console.log(`  PASS  ${name}`); } catch (e) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(e as Error).message}`);
  }
}

console.log('\nbuilding a study plan without AI');

const course = (over: Partial<StudyPlanInput['courses'][number]> = {}) => ({
  id: 'c1', code: 'MATH102', name: 'Calculus II',
  chapters: [{ id: 'm1', title: 'Chapter 1' }, { id: 'm2', title: 'Chapter 2' }],
  upcoming: [{ title: 'Midterm', date: '2026-10-01', weight: 30 }],
  currentPercent: null,
  ...over,
});

const base = {
  courses: [course()],
  todayIso: '2026-09-22',
  defaultMinutes: 45,
  availableDays: [],
  horizonDays: 7,
} as StudyPlanInput;

check('puts a session on a real day inside the horizon', () => {
  const plan = buildStudyPlan(base);
  assert.ok(plan.sessions.length > 0);
  for (const s of plan.sessions) {
    assert.ok(s.scheduledOn >= '2026-09-22' && s.scheduledOn <= '2026-09-28', s.scheduledOn);
  }
});

check('never schedules revision after the assessment it is for', () => {
  const plan = buildStudyPlan({
    ...base,
    courses: [course({ upcoming: [{ title: 'Midterm', date: '2026-09-23', weight: 30 }] })],
  });
  for (const s of plan.sessions) assert.ok(s.scheduledOn <= '2026-09-23', s.scheduledOn);
});

check('honours the days the student said they are free', () => {
  const plan = buildStudyPlan({ ...base, availableDays: ['friday'], horizonDays: 14 });
  assert.ok(plan.sessions.length > 0);
  for (const s of plan.sessions) {
    assert.equal(new Date(`${s.scheduledOn}T00:00:00Z`).getUTCDay(), 5, s.scheduledOn);
  }
});

check('says so rather than inventing a day when none is free', () => {
  const plan = buildStudyPlan({ ...base, availableDays: ['friday'], horizonDays: 3 });
  assert.equal(plan.sessions.length, 0);
  assert.ok(plan.notes.join(' ').length > 0);
});

check('serves the nearer deadline first', () => {
  const plan = buildStudyPlan({
    ...base,
    courses: [
      course({ id: 'far', code: 'PHYS', upcoming: [{ title: 'Final', date: '2026-12-01', weight: 40 }] }),
      course({ id: 'near', code: 'MATH', upcoming: [{ title: 'Quiz', date: '2026-09-24', weight: 10 }] }),
    ],
  });
  assert.equal(plan.sessions[0]?.courseId, 'near');
});

check('takes chapters in the order they were uploaded', () => {
  const plan = buildStudyPlan(base);
  const forCourse = plan.sessions.filter((s) => s.courseId === 'c1');
  assert.deepEqual(forCourse.slice(0, 2).map((s) => s.materialId), ['m1', 'm2']);
});

check('is the same plan every time', () => {
  assert.deepEqual(buildStudyPlan(base), buildStudyPlan(base));
});

check('copes with a course that has nothing uploaded and nothing due', () => {
  const plan = buildStudyPlan({
    ...base,
    courses: [course({ chapters: [], upcoming: [] })],
  });
  assert.ok(plan.sessions.length > 0);
  assert.equal(plan.sessions[0].materialId, null);
});

console.log('\nreading a chapter without AI');

const CHAPTER = [
  'Chapter 4',
  'The Laplace transform turns a differential equation in time into an algebraic equation in s, which is why it is taught immediately after convolution and before transfer functions are introduced in any course.',
  '4.1 Definition',
  'Laplace transform: an integral transform that maps a function of time to a function of a complex variable s.',
  'Region of convergence — the set of s for which the defining integral converges.',
  'F(s) = ∫ f(t) e^{-st} dt',
  'The transform is linear, so it distributes over sums and scales with constants in the way you would expect from an integral.',
].join('\n');

check('keeps the chapter’s own words as key terms', () => {
  const out = outlineFromText(CHAPTER, 'Chapter 4');
  assert.ok(out.keyTerms.some((k) => k.term === 'Laplace transform'));
  assert.ok(out.keyTerms.some((k) => k.term === 'Region of convergence'));
});

check('finds the formulas', () => {
  const out = outlineFromText(CHAPTER, 'Chapter 4');
  assert.ok(out.formulas.some((f) => f.includes('F(s)')));
});

check('builds a checklist that points at the material', () => {
  const out = outlineFromText(CHAPTER, 'Chapter 4');
  assert.ok(out.checklist.length > 0);
  assert.ok(out.checklist.some((c) => c.includes('Laplace transform')));
});

check('invents nothing when the file has no prose', () => {
  const out = outlineFromText('', 'Empty');
  assert.equal(out.keyTerms.length, 0);
  assert.equal(out.sections.length, 0);
  assert.equal(out.formulas.length, 0);
});

check('writes one card per definition and no more', () => {
  const cards = cardsFromText(CHAPTER, 10, 'Transforms');
  assert.equal(cards.length, 2);
  assert.ok(cards[0].front.startsWith('What is '));
  assert.ok(cards[0].back.length > 10);
});

check('respects the requested count', () => {
  assert.equal(cardsFromText(CHAPTER, 1, 'T').length, 1);
});

console.log(failures === 0 ? `\n${16} checks passed` : `\n${failures} FAILED`);
if (failures > 0) process.exit(1);
