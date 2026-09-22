import assert from 'node:assert/strict';
import { extractFromText, dateIn, weightIn } from '../extract';

let failures = 0;
function check(name: string, fn: () => void) {
  try { fn(); console.log(`  PASS  ${name}`); } catch (e) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(e as Error).message}`);
  }
}

const TODAY = '2026-09-22';

console.log('\nreading dates the way syllabi write them');

check('ISO', () => assert.equal(dateIn('Midterm 2026-10-15', TODAY), '2026-10-15'));
check('day first with slashes', () => assert.equal(dateIn('Quiz 15/10/2026', TODAY), '2026-10-15'));
check('month name with a year', () => assert.equal(dateIn('Final on December 3, 2026', TODAY), '2026-12-03'));
check('month name without a year takes the year in hand', () =>
  assert.equal(dateIn('Midterm Oct 15', TODAY), '2026-10-15'));
check('day before month', () => assert.equal(dateIn('Project due 3 Nov', TODAY), '2026-11-03'));
check('no date is null, not today', () => assert.equal(dateIn('Midterm, week 7', TODAY), null));
check('a fourteenth month is not a date', () => assert.equal(dateIn('Quiz 15/14/2026', TODAY), null));

console.log('\nreading weights');

check('a percentage', () => assert.equal(weightIn('Midterm 25%'), 25));
check('a decimal percentage', () => assert.equal(weightIn('Quiz 7.5 %'), 7.5));
check('nothing when there is no percentage', () => assert.equal(weightIn('Midterm in week 7'), null));
check('an impossible percentage is not a weight', () => assert.equal(weightIn('see section 250%'), null));

console.log('\npulling the schedule out of a syllabus');

const SYLLABUS = [
  'Kuwait University — College of Engineering',
  'Course Title: Signals and Systems',
  'EE 320',
  'Instructor: Dr. A. Al-Mutairi',
  'Office Hours: Sunday and Tuesday, 11:00-12:30',
  '',
  'Assessment',
  'Midterm Exam — 20 October 2026 — 25%',
  'Quiz 1 — 6 Oct 2026 — 10%',
  'Final Exam — 2026-12-14 — 40%',
  'Project report — 25%',
  'Attendance is required and students must pass with 60% overall.',
].join('\n');

check('finds the assessments and their dates', () => {
  const out = extractFromText(SYLLABUS, TODAY);
  const titles = out.events.map((e) => e.event_date);
  assert.deepEqual(titles.slice(0, 3), ['2026-10-06', '2026-10-20', '2026-12-14']);
});

check('keeps the weights as written', () => {
  const out = extractFromText(SYLLABUS, TODAY);
  const final = out.events.find((e) => /final/i.test(e.title));
  assert.equal(final?.weight, 40);
  assert.equal(final?.event_type, 'exam');
});

check('keeps an undated assessment that carries a weight', () => {
  const out = extractFromText(SYLLABUS, TODAY);
  const project = out.events.find((e) => /project/i.test(e.title));
  assert.equal(project?.event_date, null);
  assert.equal(project?.weight, 25);
});

check('does not turn a pass-mark sentence into an assessment', () => {
  const out = extractFromText(SYLLABUS, TODAY);
  assert.ok(!out.events.some((e) => /attendance/i.test(e.title)));
});

check('reads the labelled fields', () => {
  const out = extractFromText(SYLLABUS, TODAY);
  assert.equal(out.instructor, 'Dr. A. Al-Mutairi');
  assert.equal(out.course_name, 'Signals and Systems');
  assert.equal(out.course_code, 'EE320');
  assert.ok(out.office_hours?.startsWith('Sunday'));
});

check('finds nothing in an empty file rather than inventing a term', () => {
  const out = extractFromText('', TODAY);
  assert.deepEqual(out.events, []);
  assert.equal(out.instructor, null);
});

console.log(failures === 0 ? '\n18 checks passed' : `\n${failures} FAILED`);
if (failures > 0) process.exit(1);
