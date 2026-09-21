/**
 * Models behind OpenRouter do not all return bare JSON. These are the shapes
 * seen in practice: a markdown fence, a sentence of preamble, a trailing note.
 */
import assert from 'node:assert/strict';
import { extractJson } from '../json';

let passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); console.log(`  PASS  ${name}`); passed += 1; }
  catch (e) { console.log(`  FAIL  ${name}`); throw e; }
}

console.log('\nreading JSON out of a model reply');

check('takes a bare object unchanged', () => {
  assert.equal(extractJson('{"a":1}'), '{"a":1}');
});

check('unwraps a ```json fence', () => {
  assert.equal(extractJson('```json\n{"a":1}\n```'), '{"a":1}');
});

check('unwraps a bare fence', () => {
  assert.equal(extractJson('```\n{"a":1}\n```'), '{"a":1}');
});

check('drops a sentence of preamble', () => {
  assert.equal(extractJson('Here is the result:\n{"a":1}'), '{"a":1}');
});

check('drops a trailing note', () => {
  assert.equal(extractJson('{"a":1}\n\nLet me know if you need more.'), '{"a":1}');
});

check('handles a top-level array', () => {
  assert.equal(extractJson('Sure!\n[{"a":1},{"b":2}]\nDone'), '[{"a":1},{"b":2}]');
});

check('does not stop at a brace inside a string', () => {
  assert.equal(extractJson('{"text":"a } b","n":1}'), '{"text":"a } b","n":1}');
});

check('does not stop at an escaped quote', () => {
  assert.equal(extractJson('{"text":"say \\"} \\" now","n":1}'), '{"text":"say \\"} \\" now","n":1}');
});

check('keeps nested objects whole', () => {
  const v = '{"a":{"b":{"c":[1,2,{"d":3}]}}}';
  assert.equal(extractJson(`prefix ${v} suffix`), v);
});

check('parses back to the original value', () => {
  const original = { questions: [{ q: 'What is 2+2 }?', options: ['4', '5'] }], rationale: 'ok' };
  const wrapped = '```json\n' + JSON.stringify(original) + '\n```';
  assert.deepEqual(JSON.parse(extractJson(wrapped)), original);
});

check('returns the text when there is no JSON at all', () => {
  assert.equal(extractJson('I cannot help with that.'), 'I cannot help with that.');
});

console.log(`\n${passed} checks passed`);
