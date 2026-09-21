/**
 * Reading an avatar back out of storage. The awkward parts are the ones that
 * arrive from jsonb: missing fields, unknown words, and designs saved before
 * an option existed.
 */
import assert from 'node:assert/strict';
import {
  parseAvatar, parseAvatarKind, initialsFrom, DEFAULT_AVATAR, PRESETS,
} from '../design';

let passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); console.log(`  PASS  ${name}`); passed += 1; }
  catch (e) { console.log(`  FAIL  ${name}`); throw e; }
}

console.log('\nreading a saved avatar');

check('keeps every choice it recognises', () => {
  const saved = {
    figure: 'boy', skin: 'olive', hair: 'curly', hairColour: 'auburn',
    face: 'wink', extra: 'glasses', outfit: 'dishdasha', backdrop: 'mint',
  };
  assert.deepEqual(parseAvatar(saved), saved);
});

check('a design saved before figure and outfit existed still reads', () => {
  // Exactly the shape the first version wrote. It must keep every choice it
  // made and gain sensible values for the two fields it never knew about,
  // because these are already in the database.
  const old = {
    skin: 'olive', hair: 'curly', hairColour: 'auburn',
    face: 'wink', extra: 'glasses', backdrop: 'mint',
  };
  const out = parseAvatar(old);
  assert.equal(out.skin, 'olive');
  assert.equal(out.hair, 'curly');
  assert.equal(out.backdrop, 'mint');
  assert.equal(out.figure, DEFAULT_AVATAR.figure);
  assert.equal(out.outfit, DEFAULT_AVATAR.outfit);
});

check('the Kuwaiti options are ordinary values, not special cases', () => {
  assert.equal(parseAvatar({ hair: 'shmagh' }).hair, 'shmagh');
  assert.equal(parseAvatar({ outfit: 'dishdasha' }).outfit, 'dishdasha');
  assert.equal(parseAvatar({ outfit: 'abaya' }).outfit, 'abaya');
  assert.equal(parseAvatar({ outfit: 'darraa' }).outfit, 'darraa');
  assert.equal(parseAvatar({ backdrop: 'sadu' }).backdrop, 'sadu');
  assert.equal(parseAvatar({ backdrop: 'towers' }).backdrop, 'towers');
});

check('every preset is a design the parser accepts unchanged', () => {
  for (const preset of PRESETS) {
    assert.deepEqual(parseAvatar(preset.design), preset.design, preset.key);
  }
});

check('an empty design is the default one', () => {
  assert.deepEqual(parseAvatar({}), DEFAULT_AVATAR);
});

check('null and undefined do not throw', () => {
  assert.deepEqual(parseAvatar(null), DEFAULT_AVATAR);
  assert.deepEqual(parseAvatar(undefined), DEFAULT_AVATAR);
});

check('a word it does not know falls back for that feature alone', () => {
  const out = parseAvatar({ skin: 'chartreuse', hair: 'curly' });
  assert.equal(out.skin, DEFAULT_AVATAR.skin);
  assert.equal(out.hair, 'curly');
});

check('a non-string value falls back', () => {
  const out = parseAvatar({ skin: 7, hair: ['curly'], face: null });
  assert.deepEqual(out, DEFAULT_AVATAR);
});

check('always returns a whole design, never a partial one', () => {
  const out = parseAvatar({ hair: 'bun' });
  for (const key of Object.keys(DEFAULT_AVATAR)) {
    assert.ok(out[key as keyof typeof out], `${key} is set`);
  }
});

check('a covering is a normal choice, not a special case', () => {
  assert.equal(parseAvatar({ hair: 'hijab' }).hair, 'hijab');
  assert.equal(parseAvatar({ hair: 'ghutra' }).hair, 'ghutra');
});

console.log('\nwhich kind of picture the account has');

check('reads the three kinds', () => {
  assert.equal(parseAvatarKind('photo'), 'photo');
  assert.equal(parseAvatarKind('character'), 'character');
  assert.equal(parseAvatarKind('initials'), 'initials');
});

check('anything else is initials', () => {
  assert.equal(parseAvatarKind('bitmoji'), 'initials');
  assert.equal(parseAvatarKind(null), 'initials');
  assert.equal(parseAvatarKind(42), 'initials');
});

console.log('\nfalling back to initials');

check('takes two letters from a name', () => {
  assert.equal(initialsFrom('Dana Hamad', 'x@y.z'), 'DH');
});

check('uses the address when there is no name', () => {
  assert.equal(initialsFrom(null, 'dana.hamad@ku.edu.kw'), 'DH');
});

check('copes with one word', () => {
  assert.equal(initialsFrom('Dana', 'x@y.z'), 'D');
});

check('never returns an empty string', () => {
  assert.equal(initialsFrom(null, ''), '·');
  assert.equal(initialsFrom('   ', ''), '·');
});

console.log(`\n${passed} checks passed`);
