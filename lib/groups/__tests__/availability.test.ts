import assert from 'node:assert/strict';
import {
  invert, merge, matchMinutes, rank, sharedFreeWindows, toMinutes, toTime, weekdayOf,
  type Block,
} from '../availability';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  PASS  ${name}`);
}

const H = (h: number, m = 0) => h * 60 + m;

/** A class, the way a course row describes one. */
function cls(day: Block['day'], from: number, to: number): Block {
  return { day, start: H(from), end: H(to) };
}

console.log('\nStudy group availability\n');

check('a time string becomes minutes, and nonsense becomes null', () => {
  assert.equal(toMinutes('09:30'), 570);
  assert.equal(toMinutes('09:30:00'), 570);
  assert.equal(toMinutes('7:05'), 425);
  assert.equal(toMinutes(null), null);
  assert.equal(toMinutes('25:00'), null);
  assert.equal(toMinutes('noon'), null);
  assert.equal(toTime(570), '09:30');
  assert.equal(toTime(0), '00:00');
});

check('touching and overlapping classes merge into one busy block', () => {
  assert.deepEqual(
    merge([{ start: 540, end: 600 }, { start: 600, end: 660 }]),
    [{ start: 540, end: 660 }],
  );
  assert.deepEqual(
    merge([{ start: 540, end: 700 }, { start: 600, end: 660 }]),
    [{ start: 540, end: 700 }],
  );
  // Out of order, and a zero-length block that should vanish.
  assert.deepEqual(
    merge([{ start: 800, end: 900 }, { start: 500, end: 500 }, { start: 540, end: 600 }]),
    [{ start: 540, end: 600 }, { start: 800, end: 900 }],
  );
});

check('inverting busy time gives the gaps inside the search window', () => {
  assert.deepEqual(
    invert([{ start: 540, end: 600 }], 480, 720),
    [{ start: 480, end: 540 }, { start: 600, end: 720 }],
  );
  // A class that swallows the whole window leaves nothing.
  assert.deepEqual(invert([{ start: 400, end: 800 }], 480, 720), []);
  // No classes: the whole window is free.
  assert.deepEqual(invert([], 480, 720), [{ start: 480, end: 720 }]);
});

check('two students with one clashing class still share the afternoon', () => {
  const a = [cls('sunday', 9, 10)];
  const b = [cls('sunday', 11, 12)];

  const windows = sharedFreeWindows([a, b], { days: ['sunday'], requireAll: true });

  assert.deepEqual(
    windows.map((w) => `${toTime(w.start)}–${toTime(w.end)}`),
    ['12:00–20:00', '08:00–09:00', '10:00–11:00'],
  );
  assert.ok(windows.every((w) => w.free === 2 && w.total === 2));
});

check('a window shorter than the minimum is not offered', () => {
  // 10:00–10:45 is the only gap, and 45 minutes is not a study session.
  const a = [cls('monday', 8, 10), { day: 'monday' as const, start: H(10, 45), end: H(20) }];
  const b = [cls('monday', 8, 10), { day: 'monday' as const, start: H(10, 45), end: H(20) }];

  assert.deepEqual(sharedFreeWindows([a, b], { days: ['monday'], requireAll: true }), []);
  assert.equal(
    sharedFreeWindows([a, b], { days: ['monday'], requireAll: true, minMinutes: 30 }).length,
    1,
  );
});

check('four of five free is reported, and ranked below all five free', () => {
  const free: Block[] = [];
  const busyTuesdayMorning = [cls('tuesday', 8, 12)];
  const members = [free, free, free, free, busyTuesdayMorning];

  const windows = sharedFreeWindows(members, { days: ['tuesday'] });

  assert.equal(windows[0].free, 5, 'the all-free window comes first');
  assert.equal(`${toTime(windows[0].start)}–${toTime(windows[0].end)}`, '12:00–20:00');
  assert.equal(windows[1].free, 4);
  assert.equal(`${toTime(windows[1].start)}–${toTime(windows[1].end)}`, '08:00–12:00');
  assert.ok(windows.every((w) => w.total === 5));
});

check('a group that is never all free together says so', () => {
  const morning = [cls('wednesday', 8, 14)];
  const afternoon = [cls('wednesday', 13, 20)];

  assert.deepEqual(
    sharedFreeWindows([morning, afternoon], { days: ['wednesday'], requireAll: true }),
    [],
  );
});

check('one member alone still sees their own free time', () => {
  const windows = sharedFreeWindows([[cls('sunday', 9, 10)]], { days: ['sunday'] });
  assert.equal(windows.length, 2);
  assert.ok(windows.every((w) => w.free === 1 && w.total === 1));
});

check('a class outside the search window does not shrink the day', () => {
  const evening = [cls('thursday', 20, 22)];
  const windows = sharedFreeWindows([evening, []], { days: ['thursday'], requireAll: true });
  assert.equal(windows.length, 1);
  assert.equal(`${toTime(windows[0].start)}–${toTime(windows[0].end)}`, '08:00–20:00');
});

check('days with no shared time do not appear at all', () => {
  const a = [cls('sunday', 8, 20)];
  const windows = sharedFreeWindows([a, []], {
    days: ['sunday', 'monday'],
    requireAll: true,
  });
  assert.deepEqual(windows.map((w) => w.day), ['monday']);
});

check('the match score is the weekly overlap in minutes', () => {
  // Both free all week except Sunday morning for one of them: five days of
  // 08:00–20:00 minus the four hours they cannot share.
  const mine = [cls('sunday', 8, 12)];
  const theirs: Block[] = [];
  const full = 5 * 12 * 60;
  assert.equal(matchMinutes(mine, theirs), full - 4 * 60);

  // Identical timetables overlap everywhere they are both free.
  assert.equal(matchMinutes(mine, mine), full - 4 * 60);
  // Someone in class the whole week shares nothing.
  const always = (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'] as const)
    .map((d) => cls(d, 8, 20));
  assert.equal(matchMinutes(mine, always), 0);
});

check('ranking is fullest, then longest, then earliest in the week', () => {
  const windows = [
    { day: 'monday' as const, start: H(9), end: H(10), free: 3, total: 3 },
    { day: 'sunday' as const, start: H(9), end: H(10), free: 3, total: 3 },
    { day: 'sunday' as const, start: H(14), end: H(18), free: 2, total: 3 },
    { day: 'sunday' as const, start: H(11), end: H(14), free: 3, total: 3 },
  ];
  assert.deepEqual(
    rank(windows).map((w) => `${w.day} ${toTime(w.start)} ${w.free}`),
    ['sunday 11:00 3', 'sunday 09:00 3', 'monday 09:00 3', 'sunday 14:00 2'],
  );
});

check('a date maps to a weekday without going through Intl', () => {
  assert.equal(weekdayOf('2026-09-24'), 'thursday');
  assert.equal(weekdayOf('2026-09-20'), 'sunday');
  assert.equal(weekdayOf('not a date'), null);
});

console.log(`\n${passed} checks passed\n`);
