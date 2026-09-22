import assert from 'node:assert/strict';
import { toClockParts, toStoredTime, formatClock, isPast, todayIso } from '../when';

let failures = 0;
function check(name: string, fn: () => void) {
  try { fn(); console.log(`  PASS  ${name}`); } catch (e) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(e as Error).message}`);
  }
}

console.log('\nreading a stored time as a clock');

check('afternoon', () => assert.deepEqual(toClockParts('19:05'), { hour: 7, minute: 5, meridiem: 'PM' }));
check('morning', () => assert.deepEqual(toClockParts('07:05'), { hour: 7, minute: 5, meridiem: 'AM' }));
check('midnight is 12 AM, not 0', () =>
  assert.deepEqual(toClockParts('00:30'), { hour: 12, minute: 30, meridiem: 'AM' }));
check('noon is 12 PM, not 0', () =>
  assert.deepEqual(toClockParts('12:00'), { hour: 12, minute: 0, meridiem: 'PM' }));
check('nonsense is null, never midnight', () => {
  assert.equal(toClockParts('25:00'), null);
  assert.equal(toClockParts('7pm'), null);
  assert.equal(toClockParts(''), null);
  assert.equal(toClockParts(null), null);
});

console.log('\nwriting a clock back');

check('evening', () => assert.equal(toStoredTime({ hour: 7, minute: 5, meridiem: 'PM' }), '19:05'));
check('morning', () => assert.equal(toStoredTime({ hour: 7, minute: 5, meridiem: 'AM' }), '07:05'));
check('12 AM is midnight', () => assert.equal(toStoredTime({ hour: 12, minute: 0, meridiem: 'AM' }), '00:00'));
check('12 PM is noon', () => assert.equal(toStoredTime({ hour: 12, minute: 0, meridiem: 'PM' }), '12:00'));
check('out of range is refused rather than wrapped', () => {
  assert.equal(toStoredTime({ hour: 13, minute: 0, meridiem: 'PM' }), null);
  assert.equal(toStoredTime({ hour: 0, minute: 0, meridiem: 'AM' }), null);
  assert.equal(toStoredTime({ hour: 7, minute: 60, meridiem: 'AM' }), null);
});

check('a time survives the round trip', () => {
  for (const stored of ['00:00', '00:59', '11:59', '12:00', '12:01', '23:59', '09:30']) {
    const parts = toClockParts(stored);
    assert.ok(parts, stored);
    assert.equal(toStoredTime(parts), stored, stored);
  }
});

console.log('\nshowing it');

check('English', () => assert.equal(formatClock('19:05'), '7:05 PM'));
check('Arabic', () => assert.equal(formatClock('19:05', true), '7:05 م'));
check('nothing for an empty time', () => assert.equal(formatClock(null), ''));

console.log('\nrefusing a moment that has gone');

const now = new Date(2026, 8, 22, 18, 30); // 22 September 2026, 18:30 local

check('yesterday is past, whatever the time', () => {
  assert.equal(isPast('2026-09-21', '23:59', now), true);
  assert.equal(isPast('2026-09-21', null, now), true);
});
check('tomorrow is not', () => {
  assert.equal(isPast('2026-09-23', '00:01', now), false);
});
check('earlier today is past', () => assert.equal(isPast('2026-09-22', '18:29', now), true));
check('this minute is not past', () => assert.equal(isPast('2026-09-22', '18:30', now), false));
check('later today is not', () => assert.equal(isPast('2026-09-22', '21:00', now), false));
check('today with no time is not past', () => assert.equal(isPast('2026-09-22', null, now), false));
check('a malformed day is not judged', () => assert.equal(isPast('nope', '09:00', now), false));

check('today is read from the given clock, not a timezone', () => {
  assert.equal(todayIso(now), '2026-09-22');
  assert.equal(todayIso(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
});

console.log(failures === 0 ? '\n21 checks passed' : `\n${failures} FAILED`);
if (failures > 0) process.exit(1);
