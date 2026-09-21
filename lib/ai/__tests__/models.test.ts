/**
 * Picking a free model out of OpenRouter's catalogue. The shapes here are the
 * ones the real endpoint returns, including the awkward parts: prices as
 * strings, missing fields, and paid models sitting next to free ones.
 */
import assert from 'node:assert/strict';
import { pickFreeModels, resolveModels, type CatalogueModel } from '../models';

let passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); console.log(`  PASS  ${name}`); passed += 1; }
  catch (e) { console.log(`  FAIL  ${name}`); throw e; }
}

const free = (id: string, extra: Partial<CatalogueModel> = {}): CatalogueModel => ({
  id, pricing: { prompt: '0', completion: '0' }, context_length: 8000, ...extra,
});
const paid = (id: string): CatalogueModel => ({
  id, pricing: { prompt: '0.0000015', completion: '0.000002' }, context_length: 200000,
});

console.log('\nchoosing a free model');

check('keeps only the models that cost nothing', () => {
  const ids = pickFreeModels([paid('big/expensive'), free('a/free'), paid('other/paid')]);
  assert.deepEqual(ids, ['a/free']);
});

check('treats a numeric zero price as free', () => {
  const ids = pickFreeModels([{ id: 'n/zero', pricing: { prompt: 0, completion: 0 } }]);
  assert.deepEqual(ids, ['n/zero']);
});

check('a zero prompt with a paid completion is not free', () => {
  const ids = pickFreeModels([{ id: 'x/half', pricing: { prompt: '0', completion: '0.001' } }]);
  assert.deepEqual(ids, []);
});

check('ranks structured-output models first', () => {
  const ids = pickFreeModels([
    free('plain/one', { context_length: 900000 }),
    free('json/one', { supported_parameters: ['response_format'], context_length: 4000 }),
  ]);
  assert.deepEqual(ids, ['json/one', 'plain/one']);
});

check('accepts structured_outputs as the capability name too', () => {
  const ids = pickFreeModels([
    free('plain/one', { context_length: 900000 }),
    free('json/two', { supported_parameters: ['structured_outputs'], context_length: 4000 }),
  ]);
  assert.equal(ids[0], 'json/two');
});

check('breaks a tie on context length, longest first', () => {
  const ids = pickFreeModels([free('s/short', { context_length: 4000 }), free('l/long', { context_length: 128000 })]);
  assert.deepEqual(ids, ['l/long', 's/short']);
});

check('is stable when everything else ties', () => {
  const models = [free('c/x'), free('a/x'), free('b/x')];
  assert.deepEqual(pickFreeModels(models), ['a/x', 'b/x', 'c/x']);
  assert.deepEqual(pickFreeModels([...models].reverse()), ['a/x', 'b/x', 'c/x']);
});

check('caps the list', () => {
  const many = Array.from({ length: 30 }, (_, i) => free(`m/${i}`));
  assert.equal(pickFreeModels(many).length, 5);
  assert.equal(pickFreeModels(many, 2).length, 2);
});

check('survives junk entries without throwing', () => {
  const ids = pickFreeModels([
    {} as CatalogueModel,
    { id: 42 } as unknown as CatalogueModel,
    { id: 'no/pricing' },
    { id: 'null/pricing', pricing: null },
    { id: 'odd/params', pricing: { prompt: '0', completion: '0' }, supported_parameters: 'nope' },
    free('good/one'),
  ]);
  assert.deepEqual(ids, ['good/one', 'odd/params']);
});

check('returns nothing when the catalogue is empty', () => {
  assert.deepEqual(pickFreeModels([]), []);
});

console.log('\ndeciding what the request names');

check('a pinned model is used alone', () => {
  assert.deepEqual(resolveModels('deepseek/deepseek-chat:free', ['a', 'b']), ['deepseek/deepseek-chat:free']);
});

check('whitespace around a pinned model is trimmed', () => {
  assert.deepEqual(resolveModels('  x/y  ', []), ['x/y']);
});

check('a blank pin is ignored', () => {
  assert.deepEqual(resolveModels('   ', ['a', 'b']), ['a', 'b']);
});

check('undefined pin uses the discovered list', () => {
  assert.deepEqual(resolveModels(undefined, ['a', 'b']), ['a', 'b']);
});

check('falls back to the router when discovery found nothing', () => {
  assert.deepEqual(resolveModels(undefined, []), ['openrouter/auto']);
});

check('does not hand back the caller’s array', () => {
  const discovered = ['a'];
  const out = resolveModels(undefined, discovered);
  out.push('b');
  assert.deepEqual(discovered, ['a']);
});

console.log(`\n${passed} checks passed`);
