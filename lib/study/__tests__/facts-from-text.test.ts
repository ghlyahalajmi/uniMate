import { factsIn, sentencesIn, blanked } from '../facts-from-text';
import { questionsFromText } from '../questions-from-text';

let passed = 0;
let failed = 0;

function group(name: string) { console.log(`\n${name}`); }
function check(name: string, condition: boolean, detail?: string) {
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

/**
 * A chapter written the way instructor slides actually are: a title, bullets
 * with no full stops, ordinary sentences, and not one colon definition.
 */
const SLIDES = `
Chapter 3 - Electromagnetic Theory, Photons and Light

Learning outcomes
Understand the nature of electromagnetic radiation

• Light travels at 3 x 10^8 m/s in a vacuum
• The electric field is strongest closest to the charge
• Electromagnetic waves consist of an electric field and a magnetic field at right angles
• The energy of a photon depends on its frequency
• Visible light has a wavelength between 400 nm and 700 nm
• Planck constant relates the energy of a photon to its frequency
• Radio waves are produced when charges accelerate along an antenna
• The photoelectric effect occurs when light strikes a metal surface

Summary
`;

group('finding sentences');
{
  const sentences = sentencesIn(SLIDES);
  check('bullets become sentences', sentences.some((s) => s.startsWith('Light travels')));
  check('the bullet marker is gone', !sentences.some((s) => s.startsWith('•')));
  check('a heading is still a line', sentences.includes('Summary'));
}

group('finding facts in ordinary prose');
{
  const facts = factsIn(SLIDES);
  check('facts are found without a single colon', facts.length >= 6, `found ${facts.length}`);
  check('a heading is not a fact', !facts.some((f) => f.sentence === 'Summary'));
  check('a title is not a fact',
    !facts.some((f) => f.sentence.startsWith('Chapter 3')), JSON.stringify(facts.map((f) => f.sentence)));
  check('a short fragment is not a fact', !facts.some((f) => f.sentence.split(' ').length < 5));
}

group('what gets asked about');
{
  const facts = factsIn(SLIDES);
  const speed = facts.find((f) => f.sentence.includes('3 x 10^8'));
  check('a quantity is the thing worth asking', speed?.key.includes('10^8') ?? false, speed?.key);

  const photon = facts.find((f) => f.sentence.includes('energy of a photon depends'));
  check('otherwise a real word is chosen',
    (photon?.key.length ?? 0) >= 4 && !['the', 'is', 'of'].includes((photon?.key ?? '').toLowerCase()),
    photon?.key);

  for (const fact of facts) {
    check(`the key is really in its sentence — ${fact.key}`,
      fact.sentence.slice(fact.at, fact.at + fact.key.length) === fact.key);
    break;
  }
}

group('blanking');
{
  const facts = factsIn(SLIDES);
  const fact = facts[0];
  const gap = blanked(fact);
  check('the blank replaces the key', gap.includes('______'), gap);
  check('the answer is no longer visible', !gap.includes(fact.key), gap);
  check('the rest of the sentence survives', gap.length > 10);
}

group('the three styles that used to come back empty');
{
  for (const style of ['multiple_choice', 'true_false', 'fill_blank'] as const) {
    const qs = questionsFromText(SLIDES, 5, 'Electromagnetics', style);
    check(`${style}: a full set comes back`, qs.length === 5, `got ${qs.length}`);
    check(`${style}: every question is that style`,
      qs.every((q) => q.question_type === style), qs.map((q) => q.question_type).join(','));
  }

  const mcq = questionsFromText(SLIDES, 5, 'T', 'multiple_choice');
  check('multiple choice has real options', mcq.every((q) => (q.options ?? []).length >= 3));
  check('the answer is among them', mcq.every((q) => (q.options ?? []).includes(q.answer)));
  check('no option repeats within a question',
    mcq.every((q) => new Set(q.options ?? []).size === (q.options ?? []).length));

  const tf = questionsFromText(SLIDES, 6, 'T', 'true_false');
  check('true or false is not all true', new Set(tf.map((q) => q.answer)).size === 2,
    tf.map((q) => q.answer).join(','));

  const blanks = questionsFromText(SLIDES, 5, 'T', 'fill_blank');
  check('every blank hides its answer',
    blanks.every((q) => !q.question_text.includes(q.answer)),
    JSON.stringify(blanks.map((q) => q.question_text)));
}

group('mixed on a chapter with no definitions');
{
  const qs = questionsFromText(SLIDES, 8, 'T', 'mixed');
  check('a full mixed set comes back', qs.length === 8, `got ${qs.length}`);
  check('all four shapes appear', new Set(qs.map((q) => q.question_type)).size === 4,
    qs.map((q) => q.question_type).join(','));
  check('no two questions are identical',
    new Set(qs.map((q) => q.question_text)).size === qs.length);
}

group('nothing is invented');
{
  const qs = questionsFromText(SLIDES, 8, 'T', 'mixed');
  const body = SLIDES.toLowerCase();
  check('every answer appears in the chapter',
    qs.every((q) =>
      q.answer === 'True' || q.answer === 'False' || body.includes(q.answer.toLowerCase())),
    JSON.stringify(qs.map((q) => q.answer)));
}

group('a file with nothing in it');
{
  check('a scan that yielded no text gives no questions',
    questionsFromText('', 5, 'T', 'mixed').length === 0);
  check('a page of headings gives no questions',
    questionsFromText('Summary\nOutcomes\nChapter 4\nReferences', 5, 'T', 'mixed').length === 0);
}

group('the same chapter gives the same set');
{
  const a = questionsFromText(SLIDES, 6, 'T', 'mixed');
  const b = questionsFromText(SLIDES, 6, 'T', 'mixed');
  check('two runs agree exactly', JSON.stringify(a) === JSON.stringify(b));
}

console.log(`\n${passed} checks passed${failed > 0 ? `, ${failed} FAILED` : ''}`);
if (failed > 0) process.exit(1);
