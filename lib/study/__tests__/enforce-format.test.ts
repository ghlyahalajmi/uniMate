import assert from 'node:assert/strict';
import { enforceFormat, type ShapedQuestion } from '../enforce-format';

let failures = 0;
function check(name: string, fn: () => void) {
  try { fn(); console.log(`  PASS  ${name}`); } catch (e) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(e as Error).message}`);
  }
}

const q = (over: Partial<ShapedQuestion> = {}): ShapedQuestion => ({
  topic: 'T', difficulty: 'medium', question_type: 'short_answer',
  question_text: 'What is the Laplace transform of a unit step?',
  options: null, answer: '1/s', explanation: 'x', next_action: 'y',
  ...over,
});

console.log('\nmaking the set the shape that was asked for');

check('a short answer cannot pretend to be multiple choice', () => {
  // The exact failure reported: choose multiple choice, get plain questions.
  assert.deepEqual(enforceFormat([q()], 'multiple_choice'), []);
});

check('a real multiple choice survives and is typed correctly', () => {
  const [out] = enforceFormat([q({
    options: ['1/s', 's', '1', '0'], answer: '1/s',
  })], 'multiple_choice');
  assert.equal(out.question_type, 'multiple_choice');
  assert.equal(out.answer, '1/s');
  assert.equal(out.options?.length, 4);
});

check('an answer given as a letter is resolved to the option', () => {
  const [out] = enforceFormat([q({
    options: ['s', '1/s', '1', '0'], answer: 'B',
  })], 'multiple_choice');
  assert.equal(out.answer, '1/s');
});

check('numbered options are unnumbered so the answer can match', () => {
  const [out] = enforceFormat([q({
    options: ['a) s', 'b) 1/s', 'c) 1', 'd) 0'], answer: '1/s',
  })], 'multiple_choice');
  assert.deepEqual(out.options, ['s', '1/s', '1', '0']);
  assert.equal(out.answer, '1/s');
});

check('an answer matching none of its options is dropped, not guessed', () => {
  assert.deepEqual(enforceFormat([q({
    options: ['s', '1', '0', 'jw'], answer: '1/s',
  })], 'multiple_choice'), []);
});

check('two options is not a multiple choice question', () => {
  assert.deepEqual(enforceFormat([q({ options: ['Yes', 'No'], answer: 'Yes' })], 'multiple_choice'), []);
});

check('duplicate options are collapsed and then it is too short', () => {
  assert.deepEqual(enforceFormat([q({
    options: ['1/s', '1/s', '1/s'], answer: '1/s',
  })], 'multiple_choice'), []);
});

console.log('\ntrue or false');

check('true/false is normalised to the two options the screen renders', () => {
  const [out] = enforceFormat([q({ answer: 'T', options: null })], 'true_false');
  assert.deepEqual(out.options, ['True', 'False']);
  assert.equal(out.answer, 'True');
  assert.equal(out.question_type, 'true_false');
});

check('Arabic yes and no are understood', () => {
  assert.equal(enforceFormat([q({ answer: 'خطأ' })], 'true_false')[0].answer, 'False');
});

check('an answer that is neither is dropped', () => {
  assert.deepEqual(enforceFormat([q({ answer: '1/s' })], 'true_false'), []);
});

console.log('\ncomplete the sentence');

check('a sentence that already has a blank passes', () => {
  const [out] = enforceFormat([q({
    question_text: 'The transform of a unit step is _____.', answer: '1/s',
  })], 'fill_blank');
  assert.equal(out.question_type, 'fill_blank');
  assert.equal(out.options, null);
});

check('a statement containing its own answer gets the blank cut into it', () => {
  const [out] = enforceFormat([q({
    question_text: 'The region of convergence is where the integral converges.',
    answer: 'region of convergence',
  })], 'fill_blank');
  assert.ok(out.question_text.includes('_____'));
  assert.ok(!out.question_text.toLowerCase().includes('region of convergence'));
});

check('a question with no blank and no way to make one is dropped', () => {
  assert.deepEqual(enforceFormat([q()], 'fill_blank'), []);
});

console.log('\nthe styles that impose no shape');

check('mixed keeps everything untouched', () => {
  const input = [q(), q({ options: ['a', 'b'], answer: 'a' })];
  assert.deepEqual(enforceFormat(input, 'mixed'), input);
});

check('short answer types the question and clears the options', () => {
  const [out] = enforceFormat([q({ options: ['x', 'y'] })], 'short_answer');
  assert.equal(out.question_type, 'short_answer');
  assert.equal(out.options, null);
});

console.log(failures === 0 ? '\n15 checks passed' : `\n${failures} FAILED`);
if (failures > 0) process.exit(1);
