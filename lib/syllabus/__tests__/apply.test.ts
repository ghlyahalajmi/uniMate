import assert from 'node:assert/strict';
import { planApply, normaliseName, type SyllabusEventLike, type ExistingAssessment } from '../apply';

let passed = 0;
function check(name: string, fn: () => void) { fn(); passed++; console.log('  PASS  ' + name); }

const NO_COURSE = { instructor: null, course_name: 'CE301' };
const base = (over: Partial<Parameters<typeof planApply>[0]> = {}) => ({
  events: [] as SyllabusEventLike[],
  existing: [] as ExistingAssessment[],
  extracted: {},
  course: NO_COURSE,
  ...over,
});

/** The CE301 syllabus exactly as the analyst read it in the screenshots. */
const CE301_EVENTS: SyllabusEventLike[] = [
  { id: 'e1', title: 'Midterm Exam',       event_type: 'midterm', event_date: '2026-10-22', weight: 25 },
  { id: 'e2', title: 'DSP Filter Project due', event_type: 'project', event_date: '2026-11-26', weight: 15 },
  { id: 'e3', title: 'Final Exam',         event_type: 'final',   event_date: '2026-12-14', weight: 40 },
];

console.log('\nturning a read syllabus into assessments');

check('creates one assessment per gradeable event', () => {
  const plan = planApply(base({ events: CE301_EVENTS }));
  assert.equal(plan.create.length, 3);
  assert.deepEqual(
    plan.create.map((a) => [a.assessment_name, a.weight, a.due_date]),
    [
      ['Midterm Exam', 25, '2026-10-22'],
      ['DSP Filter Project due', 15, '2026-11-26'],
      ['Final Exam', 40, '2026-12-14'],
    ],
  );
});

check('maps each event type onto an assessment type', () => {
  const plan = planApply(base({ events: CE301_EVENTS }));
  assert.deepEqual(
    plan.create.map((a) => a.assessment_type),
    ['midterm', 'project', 'final'],
  );
});

check('reports the weight the course will still be missing', () => {
  const plan = planApply(base({ events: CE301_EVENTS }));
  assert.equal(plan.totalWeightAfter, 80);
  // The screenshot's syllabus also has two quizzes, which its event list did
  // not date — so 20% is genuinely unaccounted for and is reported, not hidden.
  assert.equal(plan.unaccountedWeight, 20);
  assert.equal(plan.weightOverflows, false);
});

check('never invents a mark for an assessment that only has a date', () => {
  const plan = planApply(base({
    events: [{ title: 'Quiz 1', event_type: 'quiz', event_date: '2026-10-01', weight: null }],
  }));
  assert.equal(plan.create.length, 1);
  assert.equal(plan.create[0].weight, 0, 'the date is kept, the weight is not guessed');
});

console.log('\nwhat it refuses to do');

check('skips lectures and holidays, which carry no mark', () => {
  const plan = planApply(base({
    events: [
      { title: 'Lecture: Z-transform', event_type: 'lecture', event_date: '2026-10-05', weight: null },
      { title: 'National Day',         event_type: 'holiday', event_date: '2026-02-25', weight: null },
      { title: 'Midterm Exam',         event_type: 'midterm', event_date: '2026-10-22', weight: 25 },
    ],
  }));
  assert.equal(plan.create.length, 1);
  assert.deepEqual(plan.skipped.map((s) => s.reason), ['notGradeable', 'notGradeable']);
});

check('accounts for every event — nothing vanishes silently', () => {
  const events: SyllabusEventLike[] = [
    { title: 'Midterm Exam', event_type: 'midterm', event_date: '2026-10-22', weight: 25 },
    { title: 'Reading week', event_type: 'holiday', event_date: null, weight: null },
    { title: 'Some assignment', event_type: 'assignment', event_date: null, weight: null },
  ];
  const plan = planApply(base({ events }));
  assert.equal(
    plan.create.length + plan.skipped.length,
    events.length,
    'every event is either created or explained',
  );
});

check('does not add an assessment the student already entered', () => {
  const plan = planApply(base({
    events: CE301_EVENTS,
    existing: [{ id: 'g1', assessment_name: 'Midterm Exam', due_date: '2026-10-22', weight: 25 }],
  }));
  assert.equal(plan.create.length, 2);
  const dup = plan.skipped.find((s) => s.reason === 'duplicate');
  assert.equal(dup?.title, 'Midterm Exam');
  assert.equal(dup?.existingName, 'Midterm Exam');
});

check('catches a duplicate worded differently on the same date', () => {
  const plan = planApply(base({
    events: [{ title: 'Midterm Exam', event_type: 'midterm', event_date: '2026-10-22', weight: 25 }],
    existing: [{ id: 'g1', assessment_name: 'Midterm 1', due_date: '2026-10-22', weight: 25 }],
  }));
  assert.equal(plan.create.length, 0, '"Midterm Exam" and "Midterm 1" on one date are one thing');
  assert.equal(plan.skipped[0].reason, 'duplicate');
});

check('applying the same syllabus twice adds nothing the second time', () => {
  const first = planApply(base({ events: CE301_EVENTS }));
  // Simulate the rows the first apply would have written.
  const written: ExistingAssessment[] = first.create.map((a, i) => ({
    id: 'g' + i, assessment_name: a.assessment_name, due_date: a.due_date, weight: a.weight,
  }));
  const second = planApply(base({ events: CE301_EVENTS, existing: written }));
  assert.equal(second.create.length, 0, 're-applying must be a no-op');
  assert.equal(second.totalWeightAfter, 80, 'and must not double the weights');
});

console.log('\nweights');

check('flags an overflow past 100% rather than quietly trimming it', () => {
  const plan = planApply(base({
    events: [
      { title: 'Midterm', event_type: 'midterm', event_date: '2026-10-22', weight: 60 },
      { title: 'Final',   event_type: 'final',   event_date: '2026-12-14', weight: 60 },
    ],
  }));
  assert.equal(plan.totalWeightAfter, 120);
  assert.equal(plan.weightOverflows, true, 'the student is told, not silently corrected');
  assert.equal(plan.create.length, 2, 'and the rows are still offered');
});

check('counts weight already on the course', () => {
  const plan = planApply(base({
    events: [{ title: 'Final Exam', event_type: 'final', event_date: '2026-12-14', weight: 40 }],
    existing: [{ id: 'g1', assessment_name: 'Homework', due_date: null, weight: 30 }],
  }));
  assert.equal(plan.totalWeightAfter, 70);
  assert.equal(plan.unaccountedWeight, 30);
});

console.log('\ncourse fields');

check('fills a blank instructor from the document', () => {
  const plan = planApply(base({
    extracted: { instructor: 'Dr. Yousef Al-Rashid' },
    course: { instructor: null, course_name: 'Data Structures' },
  }));
  assert.deepEqual(plan.courseUpdates, [
    { field: 'instructor', from: null, to: 'Dr. Yousef Al-Rashid' },
  ]);
});

check("never overwrites what the student typed themselves", () => {
  const plan = planApply(base({
    extracted: { instructor: 'Dr. Yousef Al-Rashid' },
    course: { instructor: 'Dr. Y. Rashid', course_name: 'Data Structures' },
  }));
  assert.equal(plan.courseUpdates.length, 0, 'their own entry wins over the document');
});

check('names a course that is still called after its own code', () => {
  const plan = planApply(base({
    extracted: { courseName: 'Digital Signal Processing' },
    course: { instructor: 'Someone', course_name: 'CE301' },
  }));
  assert.equal(plan.courseUpdates[0].field, 'course_name');
  assert.equal(plan.courseUpdates[0].to, 'Digital Signal Processing');
});

check('leaves a real course name alone', () => {
  const plan = planApply(base({
    extracted: { courseName: 'Digital Signal Processing' },
    course: { instructor: null, course_name: 'Data Structures and Algorithms' },
  }));
  assert.equal(plan.courseUpdates.length, 0);
});

console.log('\nname normalisation');

check('treats the usual wordings as one name', () => {
  assert.equal(normaliseName('Midterm Exam'), normaliseName('midterm'));
  assert.equal(normaliseName('Final  Exam!'), normaliseName('final'));
  assert.notEqual(normaliseName('Quiz 1'), normaliseName('Quiz 2'));
});

console.log('\n' + passed + ' checks passed\n');
