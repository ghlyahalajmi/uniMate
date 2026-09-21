import assert from 'node:assert/strict';
import { review, addDays, isDue, deckMastery, BOX_INTERVALS, MAX_BOX } from '../scheduler';

let passed = 0;
function check(name: string, fn: () => void) { fn(); passed++; console.log('  PASS  ' + name); }

const card = (box: number, reviews = 0, lapses = 0) => ({ box, reviews, lapses });

console.log('\nflashcard scheduling');

check('a recalled card climbs one box and waits that box’s interval', () => {
  const r = review(card(1), true, '2026-09-20');
  assert.equal(r.box, 2);
  assert.equal(r.dueOn, addDays('2026-09-20', BOX_INTERVALS[2]));
  assert.equal(r.reviews, 1);
  assert.equal(r.lapsed, false);
});

check('the top box does not overflow', () => {
  const r = review(card(MAX_BOX), true, '2026-09-20');
  assert.equal(r.box, MAX_BOX);
  assert.equal(r.dueOn, addDays('2026-09-20', BOX_INTERVALS[MAX_BOX]));
});

check('a missed card drops to box 1 and returns the same day', () => {
  const r = review(card(4, 9, 1), false, '2026-09-20');
  assert.equal(r.box, 1);
  assert.equal(r.dueOn, '2026-09-20');
  assert.equal(r.lapses, 2);
  assert.equal(r.lapsed, true);
});

check('missing a card that was already in box 1 is not a lapse worth flagging', () => {
  const r = review(card(1), false, '2026-09-20');
  assert.equal(r.box, 1);
  assert.equal(r.lapsed, false);
  assert.equal(r.lapses, 1);
});

check('every review counts, right or wrong', () => {
  assert.equal(review(card(2, 5), true, '2026-09-20').reviews, 6);
  assert.equal(review(card(2, 5), false, '2026-09-20').reviews, 6);
});

check('a corrupt box falls back to 1 rather than scheduling nonsense', () => {
  const r = review(card(Number.NaN), true, '2026-09-20');
  assert.equal(r.box, 2);
  assert.ok(r.dueOn > '2026-09-20');
});

console.log('\ndate arithmetic');

check('crosses a month boundary', () => {
  assert.equal(addDays('2026-09-29', 4), '2026-10-03');
});

check('crosses a year boundary', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
});

check('handles a leap day', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

console.log('\ndue queue');

check('a card due today is due, and so is one overdue by a week', () => {
  assert.equal(isDue('2026-09-20', '2026-09-20'), true);
  assert.equal(isDue('2026-09-13', '2026-09-20'), true);
});

check('a card scheduled for tomorrow is not', () => {
  assert.equal(isDue('2026-09-21', '2026-09-20'), false);
});

console.log('\ndeck mastery');

check('an empty deck is zero rather than a division by zero', () => {
  assert.equal(deckMastery([]), 0);
});

check('a deck entirely in box 1 counts for nothing', () => {
  assert.equal(deckMastery([1, 1, 1]), 0);
});

check('a deck entirely in the top box is complete', () => {
  assert.equal(deckMastery([MAX_BOX, MAX_BOX]), 1);
});

check('a mixed deck lands in between', () => {
  const m = deckMastery([1, 3, 5]);
  assert.ok(m > 0 && m < 1);
  assert.equal(Math.round(m * 100), 50);
});

console.log(`\n${passed} checks passed\n`);
