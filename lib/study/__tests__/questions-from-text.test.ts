import { questionsFromText, definitionsIn } from '../questions-from-text';

let passed = 0;
let failed = 0;

function group(name: string) {
  console.log(`\n${name}`);
}

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** A chapter shaped like the ones students actually upload. */
const CHAPTER = `
Chapter 3 — Electromagnetic Theory

3.1 Fundamentals

Electric field: the region around a charged particle where a force acts on other charges.
Magnetic flux — the total magnetic field passing through a given surface.
Permittivity: a measure of how much a material resists forming an electric field within it.
Inductance is defined as the tendency of a conductor to oppose a change in current.
Displacement current: a quantity appearing in Maxwell's equations that is not a flow of charge.

E = mc^2
This line is ordinary prose and should not become a question.
`;

group('reading a chapter');
{
  const defs = definitionsIn(CHAPTER);
  check('every definition in the chapter is found', defs.length === 5, `found ${defs.length}`);
  check('a dash definition is read', defs.some((d) => d.term === 'Magnetic flux'));
  check('an "is defined as" definition is read', defs.some((d) => d.term === 'Inductance'));
  check('ordinary prose is not a definition', !defs.some((d) => d.meaning.includes('ordinary prose')));
  check('a heading is not a definition', !defs.some((d) => d.term.startsWith('3.1')));
}

group('nothing is invented');
{
  const qs = questionsFromText(CHAPTER, 10, 'Electromagnetics', 'mixed');
  const defs = definitionsIn(CHAPTER);
  const meanings = new Set(defs.map((d) => d.meaning));
  const terms = new Set(defs.map((d) => d.term));

  check('a set is produced', qs.length > 0, `got ${qs.length}`);

  /*
   * The invariant is the chapter, not the definition list: since ordinary
   * sentences became a source too, an answer can be a word from a bullet as
   * well as the meaning beside a colon. What must never happen is an answer
   * that is in neither.
   */
  const body = CHAPTER.toLowerCase();
  const fromChapter = (value: string) =>
    meanings.has(value) || terms.has(value) || body.includes(value.toLowerCase());

  const answersAreFromTheChapter = qs.every((q) =>
    q.question_type === 'true_false'
      ? q.answer === 'True' || q.answer === 'False'
      : fromChapter(q.answer),
  );
  check('every answer came out of the chapter', answersAreFromTheChapter,
    JSON.stringify(qs.filter((q) => q.question_type !== 'true_false' && !fromChapter(q.answer))
      .map((q) => q.answer)));

  const optionsAreFromTheChapter = qs
    .filter((q) => q.question_type === 'multiple_choice')
    .every((q) => (q.options ?? []).every(fromChapter));
  check('every option came out of the chapter', optionsAreFromTheChapter);
}

group('mixed means a different style per question');
{
  const qs = questionsFromText(CHAPTER, 5, 'Electromagnetics', 'mixed');
  const kinds = qs.map((q) => q.question_type);
  check('every style appears in a set of five', new Set(kinds).size === 4, kinds.join(', '));

  let neighboursDiffer = true;
  for (let i = 1; i < kinds.length; i++) if (kinds[i] === kinds[i - 1]) neighboursDiffer = false;
  check('no two questions in a row are the same shape', neighboursDiffer, kinds.join(', '));
}

group('short answer');
{
  const sa = questionsFromText(CHAPTER, 5, 'T', 'short_answer');
  check('short answer gives short answer', sa.every((q) => q.question_type === 'short_answer'));
  check('there is nothing to pick from', sa.every((q) => q.options === null));
  const terms = new Set(definitionsIn(CHAPTER).map((d) => d.term));
  check('the answer is a term from the chapter', sa.every((q) => terms.has(q.answer)));
  check('the question does not contain its own answer',
    sa.every((q) => !q.question_text.toLowerCase().includes(q.answer.toLowerCase())));
}

group('a chosen style is the style you get');
{
  const mcq = questionsFromText(CHAPTER, 5, 'T', 'multiple_choice');
  check('multiple choice gives multiple choice', mcq.every((q) => q.question_type === 'multiple_choice'));
  check('every multiple choice has options', mcq.every((q) => (q.options ?? []).length >= 3));
  check('the answer is one of the options', mcq.every((q) => (q.options ?? []).includes(q.answer)));

  const tf = questionsFromText(CHAPTER, 5, 'T', 'true_false');
  check('true or false gives true or false', tf.every((q) => q.question_type === 'true_false'));
  check('both answers occur', new Set(tf.map((q) => q.answer)).size === 2, tf.map((q) => q.answer).join(','));

  const blanks = questionsFromText(CHAPTER, 5, 'T', 'fill_blank');
  check('complete the sentence gives a blank', blanks.every((q) => q.question_text.includes('______')));
  check('the answer is the missing word', blanks.every((q) => q.answer.length > 0));
}

group('the right answer is not always in the same place');
{
  const mcq = questionsFromText(CHAPTER, 5, 'T', 'multiple_choice');
  const positions = new Set(mcq.map((q) => (q.options ?? []).indexOf(q.answer)));
  check('the answer moves between questions', positions.size > 1, [...positions].join(','));
}

group('the same chapter gives the same set');
{
  const a = questionsFromText(CHAPTER, 5, 'T', 'mixed');
  const b = questionsFromText(CHAPTER, 5, 'T', 'mixed');
  check('two runs agree exactly', JSON.stringify(a) === JSON.stringify(b));
}

group('a chapter with nothing in it');
{
  check('prose with no definitions gives no questions',
    questionsFromText('Just some sentences. Nothing defined here at all.', 5, 'T', 'mixed').length === 0);
  check('an empty file gives no questions', questionsFromText('', 5, 'T', 'mixed').length === 0);

  // Two definitions cannot make a four-option question; it must not pad.
  const thin = 'Alpha: the first letter.\nBeta: the second letter.';
  const qs = questionsFromText(thin, 5, 'T', 'multiple_choice');
  check('a thin chapter gives what it has, not more', qs.length === 2, `got ${qs.length}`);
  check('no option was invented to fill a gap',
    qs.every((q) =>
      q.options === null
      || JSON.stringify(q.options) === JSON.stringify(['True', 'False'])
      || q.options.every((o) => o.includes('letter'))));
}

group('it stops where it is asked to');
{
  check('a count of two gives two', questionsFromText(CHAPTER, 2, 'T', 'mixed').length === 2);
  // Five definitions plus whatever ordinary sentences the chapter also holds,
  // and never more than the chapter has in it.
  const everything = questionsFromText(CHAPTER, 50, 'T', 'mixed');
  check('a count past the chapter gives the chapter and stops',
    everything.length >= 5 && everything.length < 50, `got ${everything.length}`);
  check('nothing repeats in the whole chapter',
    new Set(everything.map((q) => q.question_text)).size === everything.length);
}

console.log(`\n${passed} checks passed${failed > 0 ? `, ${failed} FAILED` : ''}`);
if (failed > 0) process.exit(1);
