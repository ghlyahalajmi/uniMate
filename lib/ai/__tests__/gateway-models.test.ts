/**
 * Ranking the Vercel AI Gateway roster. Model ids there are `provider/model`,
 * and the catalogue is a plain list, so the awkward parts are missing ids and
 * a roster with no preferred vendor on it at all.
 */
import assert from 'node:assert/strict';
import { rankGatewayModels } from '../gateway-models';

let passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); console.log(`  PASS  ${name}`); passed += 1; }
  catch (e) { console.log(`  FAIL  ${name}`); throw e; }
}

console.log('\nranking the gateway roster');

check('prefers Anthropic, the models the prompts were written for', () => {
  const ids = rankGatewayModels([
    { id: 'zai/glm-4.7' }, { id: 'openai/gpt-5' }, { id: 'anthropic/claude-sonnet-4.5' },
  ]);
  assert.equal(ids[0], 'anthropic/claude-sonnet-4.5');
});

check('falls to OpenAI, then Google, then anything else', () => {
  const ids = rankGatewayModels([
    { id: 'zai/glm-4.7' }, { id: 'google/gemini-3' }, { id: 'openai/gpt-5' },
  ]);
  assert.deepEqual(ids, ['openai/gpt-5', 'google/gemini-3', 'zai/glm-4.7']);
});

check('still returns something when no preferred vendor is listed', () => {
  const ids = rankGatewayModels([{ id: 'zai/glm-4.7' }, { id: 'xai/grok-4.5' }]);
  assert.deepEqual(ids, ['xai/grok-4.5', 'zai/glm-4.7']);
});

check('is stable within a vendor', () => {
  const models = [{ id: 'anthropic/c' }, { id: 'anthropic/a' }, { id: 'anthropic/b' }];
  assert.deepEqual(rankGatewayModels(models), ['anthropic/a', 'anthropic/b', 'anthropic/c']);
  assert.deepEqual(rankGatewayModels([...models].reverse()), ['anthropic/a', 'anthropic/b', 'anthropic/c']);
});

check('caps the list', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `openai/m${i}` }));
  assert.equal(rankGatewayModels(many).length, 4);
  assert.equal(rankGatewayModels(many, 2).length, 2);
});

check('skips entries with no usable id', () => {
  const ids = rankGatewayModels([
    {}, { id: 42 }, { id: '' }, { id: null }, { id: 'anthropic/ok' },
  ] as Array<{ id?: unknown }>);
  assert.deepEqual(ids, ['anthropic/ok']);
});

check('an empty roster ranks to nothing', () => {
  assert.deepEqual(rankGatewayModels([]), []);
});

check('does not mutate the caller’s array', () => {
  const models = [{ id: 'zai/b' }, { id: 'anthropic/a' }];
  const copy = [...models];
  rankGatewayModels(models);
  assert.deepEqual(models, copy);
});

console.log(`\n${passed} checks passed`);
