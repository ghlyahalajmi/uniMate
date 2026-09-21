import assert from 'node:assert/strict';
import { hostOf, initialsOf } from '../format';

let passed = 0;
function check(name: string, fn: () => void) { fn(); passed++; console.log('  PASS  ' + name); }

console.log('\nhub link display');

check('takes the host and drops www', () => {
  assert.equal(hostOf('https://www.github.com/ghlyahalajmi/uniMate'), 'github.com');
  assert.equal(hostOf('https://unimate-pied.vercel.app/dashboard'), 'unimate-pied.vercel.app');
});

check('a malformed address degrades to blank rather than throwing', () => {
  assert.equal(hostOf('not a url'), '');
  assert.equal(hostOf(''), '');
});

check('initials come from the first two words', () => {
  assert.equal(initialsOf('Kuwait University'), 'KU');
  assert.equal(initialsOf('uniMate'), 'UN');
});

check('punctuation is not treated as a word', () => {
  assert.equal(initialsOf('— UniMate'), 'UN');
  assert.equal(initialsOf('Plana — Digital Planner'), 'PD');
});

check('an empty or symbol-only name still renders something', () => {
  assert.equal(initialsOf(''), '•');
  assert.equal(initialsOf('—'), '•');
});

check('works on Arabic names', () => {
  assert.equal(initialsOf('جامعة الكويت'), 'جا');
});

console.log(`\n${passed} checks passed\n`);
