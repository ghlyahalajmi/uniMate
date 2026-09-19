/**
 * Arithmetic checks for the grade and GPA engines.
 * Run with:  node --experimental-strip-types lib/calculations/__tests__/calculations.test.ts
 */
import assert from 'node:assert/strict';
import { computeCourseGrade, requiredForTarget, DEFAULT_GRADE_SCALE, letterForPercent } from '../grades';
import { cumulativeGpa, manualGpa, pointsNeededForTargetGpa } from '../gpa';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log('  PASS  ' + name);
}

const g = (weight: number, score: number | null, max = 100) =>
  ({ weight, score, max_score: max } as never);

console.log('\ncomputeCourseGrade');

check('banks weighted points from completed work only', () => {
  const b = computeCourseGrade([
    g(25, 72), // 25 × 0.72 = 18
    g(10, 90), // 10 × 0.90 = 9
    g(40, null),
    g(25, null),
  ]);
  assert.equal(b.earnedWeightedPoints, 27);
  assert.equal(b.completedWeight, 35);
  assert.equal(b.remainingWeight, 65);
  assert.equal(b.totalDefinedWeight, 100);
  assert.equal(b.unaccountedWeight, 0);
  // 27 / 35 = 77.142857…
  assert.equal(b.currentPercent, 77.14);
  assert.equal(b.currentLetter, 'C+');
});

check('handles scores out of a non-100 maximum', () => {
  const b = computeCourseGrade([g(10, 8, 10), g(10, 17, 20)]);
  // 10×0.8 + 10×0.85 = 16.5 over 20 weight = 82.5%
  assert.equal(b.earnedWeightedPoints, 16.5);
  assert.equal(b.currentPercent, 82.5);
});

check('flags weight that has not been entered', () => {
  const b = computeCourseGrade([g(30, 80), g(20, null)]);
  assert.equal(b.totalDefinedWeight, 50);
  assert.equal(b.unaccountedWeight, 50);
});

check('reports the reachable range', () => {
  const b = computeCourseGrade([g(50, 60), g(50, null)]);
  assert.equal(b.minPossiblePercent, 30); // remaining scores zero
  assert.equal(b.maxPossiblePercent, 80); // remaining scores full
});

check('no scores yet means no current percentage', () => {
  const b = computeCourseGrade([g(100, null)]);
  assert.equal(b.currentPercent, null);
  assert.equal(b.hasAnyScore, false);
});

console.log('\nrequiredForTarget');

check('handles the brief\u2019s example exactly as listed', () => {
  // The brief lists only Midterm 25% @72, Assignment 10% @90, Final 40% unsat.
  // Those three weights total 75, so a quarter of the course is unaccounted for
  // and the calculator has to say so rather than quietly assume 100.
  const r = requiredForTarget([g(25, 72), g(10, 90), g(40, null)], 'A-');
  assert.equal(r.breakdown.earnedWeightedPoints, 27); // 18 + 9
  assert.equal(r.breakdown.completedWeight, 35);
  assert.equal(r.breakdown.remainingWeight, 40);
  assert.equal(r.breakdown.unaccountedWeight, 25);
  assert.ok(r.assumptions.some((a) => a.includes('25%')), 'warns about the missing 25%');
  // (90 - 27) / 40 x 100 = 157.5 -> out of reach on the entered weights alone
  assert.equal(r.verdict, 'impossible');
  assert.equal(r.requiredAveragePercent, 157.5);
});

check('same example once the full 100% of weight is entered', () => {
  const r = requiredForTarget([g(25, 72), g(10, 90), g(40, null), g(25, null)], 'A-');
  assert.equal(r.verdict, 'reachable');
  assert.equal(r.targetPercent, 90);
  assert.equal(r.breakdown.unaccountedWeight, 0);
  // (90 - 27) / 65 x 100 = 96.923...
  assert.equal(r.requiredAveragePercent, 96.92);
});

check('calls out a target that is no longer reachable', () => {
  const r = requiredForTarget([g(60, 40), g(40, null)], 'A');
  // (93 − 24) / 40 × 100 = 172.5
  assert.equal(r.verdict, 'impossible');
  assert.equal(r.requiredAveragePercent, 172.5);
});

check('recognises a target already banked', () => {
  const r = requiredForTarget([g(95, 100), g(5, null)], 'B');
  // (83 − 95) / 5 → negative, already clear of the threshold
  assert.equal(r.verdict, 'already_achieved');
});

check('handles a course with nothing left to sit', () => {
  const r = requiredForTarget([g(100, 88)], 'A');
  assert.equal(r.verdict, 'no_remaining_assessments');
});

check('returns no_target_set when no target is chosen', () => {
  assert.equal(requiredForTarget([g(50, 80), g(50, null)], null).verdict, 'no_target_set');
});

check('states its assumptions', () => {
  const r = requiredForTarget([g(30, 80), g(20, null)], 'B');
  assert.ok(r.assumptions.some((a) => a.includes('50%')), 'flags the missing weight');
  assert.ok(r.assumptions.some((a) => a.includes('83%')), 'states the target threshold');
});

console.log('\nletterForPercent');

check('maps boundaries to the right letter', () => {
  assert.equal(letterForPercent(93, DEFAULT_GRADE_SCALE)!.letter, 'A');
  assert.equal(letterForPercent(92.99, DEFAULT_GRADE_SCALE)!.letter, 'A-');
  assert.equal(letterForPercent(0, DEFAULT_GRADE_SCALE)!.letter, 'F');
  assert.equal(letterForPercent(59.9, DEFAULT_GRADE_SCALE)!.letter, 'F');
  assert.equal(letterForPercent(60, DEFAULT_GRADE_SCALE)!.letter, 'D');
});

console.log('\nGPA');

check('cumulative GPA weights by credits', () => {
  const courses = [
    { id: '1', course_code: 'CE201', course_name: 'A', credits: 3, status: 'completed', final_grade: 'A',  final_points: 4.0 },
    { id: '2', course_code: 'MATH102', course_name: 'B', credits: 3, status: 'completed', final_grade: 'C+', final_points: 2.33 },
    { id: '3', course_code: 'PHYS102', course_name: 'C', credits: 4, status: 'completed', final_grade: 'B',  final_points: 3.0 },
  ] as never;
  const r = cumulativeGpa(courses);
  // (3×4 + 3×2.33 + 4×3) / 10 = (12 + 6.99 + 12) / 10 = 3.099
  assert.equal(r.qualityPoints, 30.99);
  assert.equal(r.gradedCredits, 10);
  assert.equal(r.gpa, 3.1);
});

check('active courses are excluded from the cumulative GPA', () => {
  const courses = [
    { id: '1', course_code: 'X', course_name: 'X', credits: 3, status: 'completed', final_grade: 'A', final_points: 4 },
    { id: '2', course_code: 'Y', course_name: 'Y', credits: 3, status: 'active',    final_grade: null, final_points: null },
  ] as never;
  assert.equal(cumulativeGpa(courses).gpa, 4);
});

check('manual calculator rows resolve letters to points', () => {
  const r = manualGpa([
    { id: '1', courseName: 'CE301',   credits: 3, letter: 'A' },
    { id: '2', courseName: 'MATH201', credits: 3, letter: 'B+' },
  ]);
  // (3×4 + 3×3.33) / 6 = 21.99 / 6 = 3.665 → 3.67 (round-half-up on 3.665)
  assert.equal(r.qualityPoints, 21.99);
  assert.equal(r.gpa, 3.67);
});

check('an ungraded row does not drag the average down', () => {
  const r = manualGpa([
    { id: '1', courseName: 'A', credits: 3, letter: 'A' },
    { id: '2', courseName: 'B', credits: 3, letter: '' },
  ]);
  assert.equal(r.gradedCredits, 3);
  assert.equal(r.totalCredits, 6);
  assert.equal(r.gpa, 4);
});

check('works out the points the remaining credits must earn', () => {
  const current = manualGpa([{ id: '1', courseName: 'A', credits: 30, letter: 'B' }]); // 3.0 × 30 = 90
  // target 3.5 over 30 + 30 credits: (3.5×60 − 90) / 30 = (210 − 90)/30 = 4.0
  assert.equal(pointsNeededForTargetGpa(current, 30, 3.5), 4);
  assert.equal(pointsNeededForTargetGpa(current, 0, 3.5), null);
});

console.log(`\n${passed} checks passed\n`);
