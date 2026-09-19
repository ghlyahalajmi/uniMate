import assert from 'node:assert/strict';
import { cleanCourseCode, cleanTime, cleanCredits, cleanWeight, cleanTitleCase, cleanDays, toLatinDigits } from '../cleaning';

let passed = 0;
function check(name: string, fn: () => void) { fn(); passed++; console.log('  PASS  ' + name); }

console.log('\ncleaning');

check('course codes lose stray spacing and casing', () => {
  assert.equal(cleanCourseCode('CE 301').value, 'CE301');
  assert.equal(cleanCourseCode('math 201').value, 'MATH201');
  assert.equal(cleanCourseCode('ce-301').value, 'CE301');
  assert.equal(cleanCourseCode('CE301').decisions.length, 0, 'a clean value logs nothing');
  assert.match(cleanCourseCode('CE 301').decisions[0].reason, /spacing/);
});

check('times normalise to 24-hour HH:MM', () => {
  assert.equal(cleanTime('10.00 AM').value, '10:00');
  assert.equal(cleanTime('2:30 pm').value, '14:30');
  assert.equal(cleanTime('12:00 AM').value, '00:00');
  assert.equal(cleanTime('12:00 PM').value, '12:00');
  assert.equal(cleanTime('1015').value, '10:15');
  assert.equal(cleanTime('09:45').value, '09:45');
  assert.equal(cleanTime('09:45').decisions.length, 0);
  assert.equal(cleanTime('not a time').value, null);
  assert.equal(cleanTime('99:99').value, null);
});

check('credits and weights pull the number out', () => {
  assert.equal(cleanCredits('3 Credits').value, 3);
  assert.equal(cleanCredits('3.0 cr').value, 3);
  assert.equal(cleanWeight('25 %').value, 25);
  assert.equal(cleanWeight('25').decisions.length, 0);
  assert.equal(cleanCredits('no number here').value, null);
});

check('Arabic-Indic digits convert to Latin', () => {
  assert.equal(toLatinDigits('٣'), '3');
  assert.equal(toLatinDigits('١٠:٣٠'), '10:30');
  assert.equal(cleanCredits('٣ وحدات').value, 3);
});

check('title case only touches single-case text', () => {
  assert.equal(cleanTitleCase('lab b2', 'room').value, 'Lab B2');
  assert.equal(cleanTitleCase('dr. mohammed al-sabah', 'instructor').value, 'Dr. Mohammed Al-Sabah');
  // Already mixed case: left alone rather than mangled.
  assert.equal(cleanTitleCase('Dr. Yousef Al-Rashid', 'instructor').decisions.length, 0);
  assert.equal(cleanTitleCase('McDonald Hall', 'room').value, 'McDonald Hall');
});

check('day lists parse from several layouts', () => {
  assert.deepEqual(cleanDays('Sunday / Tuesday').value, ['sunday', 'tuesday']);
  assert.deepEqual(cleanDays('Sun, Tue').value, ['sunday', 'tuesday']);
  assert.deepEqual(cleanDays('Mon & Wed').value, ['monday', 'wednesday']);
  assert.deepEqual(cleanDays('الأحد والثلاثاء').value, ['sunday', 'tuesday']);
  // Always in week order, never the order they were written in.
  assert.deepEqual(cleanDays('Wednesday, Monday').value, ['monday', 'wednesday']);
  assert.deepEqual(cleanDays('gibberish').value, []);
});

console.log(`\n${passed} checks passed\n`);
