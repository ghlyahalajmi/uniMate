import assert from 'node:assert/strict';
import {
  clampSticker, MAX_STICKERS, parseDesign, parseStickers, tiltFor,
} from '../design';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  PASS  ${name}`);
}

console.log('\nNote design\n');

check('a sticker dragged past the edge is pulled back onto the note', () => {
  assert.deepEqual(
    clampSticker({ k: 'star', x: 140, y: -20, r: 99 }),
    { k: 'star', x: 100, y: 0, r: 30 },
  );
  assert.deepEqual(
    clampSticker({ k: 'heart', x: 33.333, y: 66.666, r: -5 }),
    { k: 'heart', x: 33.3, y: 66.7, r: -5 },
  );
});

check('an unknown sticker key is dropped rather than drawn', () => {
  const rows = parseStickers([
    { k: 'star', x: 10, y: 10, r: 0 },
    { k: 'not-a-sticker', x: 10, y: 10, r: 0 },
    { k: 'heart', x: 'over there', y: 10, r: 0 },
    null,
    'star',
  ]);
  assert.deepEqual(rows, [{ k: 'star', x: 10, y: 10, r: 0 }]);
});

check('jsonb that is not an array gives no stickers at all', () => {
  assert.deepEqual(parseStickers(null), []);
  assert.deepEqual(parseStickers({ k: 'star' }), []);
  assert.deepEqual(parseStickers('[]'), []);
});

check('more stickers than the limit are cut, not stored', () => {
  const many = Array.from({ length: 30 }, () => ({ k: 'star', x: 5, y: 5, r: 0 }));
  assert.equal(parseStickers(many).length, MAX_STICKERS);
});

check('an unknown pattern or tint falls back instead of reaching the page', () => {
  assert.deepEqual(
    parseDesign({ theme: 'url(evil)', color: '#ff0000', stickers: [] }),
    { pattern: 'plain', tint: 'default', stickers: [] },
  );
  assert.deepEqual(
    parseDesign({ theme: 'lined', color: 'mint', stickers: [{ k: 'bulb', x: 1, y: 2, r: 3 }] }),
    { pattern: 'lined', tint: 'mint', stickers: [{ k: 'bulb', x: 1, y: 2, r: 3 }] },
  );
  // A row from before this feature existed still reads.
  assert.deepEqual(parseDesign({}), { pattern: 'plain', tint: 'default', stickers: [] });
});

check('tilt depends only on the position, so it never jitters', () => {
  assert.equal(tiltFor(10, 20), tiltFor(10, 20));
  assert.notEqual(tiltFor(10, 20), tiltFor(80, 20));
  for (const [x, y] of [[0, 0], [100, 100], [37.5, 12.5], [99, 1]]) {
    const tilt = tiltFor(x, y);
    assert.ok(tilt >= -12 && tilt <= 13, `tilt ${tilt} stays small`);
  }
});

console.log(`\n${passed} checks passed\n`);
