import assert from 'node:assert/strict';
import { greetingFor } from '../greeting';

let passed = 0;
function check(name: string, fn: () => void) { fn(); passed++; console.log('  PASS  ' + name); }

console.log('\ngreeting bands');

check('early hours are night, not morning', () => {
  for (const h of [0, 1, 3, 4]) assert.equal(greetingFor(h), 'night', `hour ${h}`);
});

check('morning runs from 5 to 11', () => {
  for (const h of [5, 8, 11]) assert.equal(greetingFor(h), 'morning', `hour ${h}`);
});

check('afternoon runs from 12 to 16', () => {
  for (const h of [12, 15, 16]) assert.equal(greetingFor(h), 'afternoon', `hour ${h}`);
});

check('evening runs from 17 to 20', () => {
  for (const h of [17, 19, 20]) assert.equal(greetingFor(h), 'evening', `hour ${h}`);
});

check('21:00 is night — the case that was reported wrong', () => {
  assert.equal(greetingFor(21), 'night');
  assert.equal(greetingFor(22), 'night');
  assert.equal(greetingFor(23), 'night');
});

check('every hour of the day maps to something', () => {
  for (let h = 0; h < 24; h++) assert.ok(greetingFor(h));
});

check('nonsense falls back rather than throwing', () => {
  assert.equal(greetingFor(Number.NaN), 'morning');
});

console.log(`\n${passed} checks passed\n`);
