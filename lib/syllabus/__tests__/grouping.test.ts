/**
 * How an upload is split into syllabuses: one course per PDF, photos together.
 */
import assert from 'node:assert/strict';
import { groupSyllabuses, countSyllabuses, isPdf } from '../grouping';

let passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); console.log(`  PASS  ${name}`); passed += 1; }
  catch (e) { console.log(`  FAIL  ${name}`); throw e; }
}

const pdf = (name: string) => ({ name, type: 'application/pdf' });
const jpg = (name: string) => ({ name, type: 'image/jpeg' });
const png = (name: string) => ({ name, type: 'image/png' });
const photos = (n: number) => `${n} photos`;

console.log('\ngrouping an upload into syllabuses');

check('one PDF is one syllabus', () => {
  const g = groupSyllabuses([pdf('ce301.pdf')], photos);
  assert.equal(g.length, 1);
  assert.equal(g[0].label, 'ce301.pdf');
  assert.equal(g[0].files.length, 1);
});

check('three PDFs are three syllabuses', () => {
  const g = groupSyllabuses([pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')], photos);
  assert.deepEqual(g.map((x) => x.label), ['a.pdf', 'b.pdf', 'c.pdf']);
  assert.ok(g.every((x) => x.files.length === 1));
});

check('PDFs keep the order they were chosen in', () => {
  const g = groupSyllabuses([pdf('z.pdf'), pdf('a.pdf')], photos);
  assert.deepEqual(g.map((x) => x.label), ['z.pdf', 'a.pdf']);
});

check('several photos are one syllabus, not several', () => {
  const g = groupSyllabuses([jpg('p1.jpg'), jpg('p2.jpg'), png('p3.png')], photos);
  assert.equal(g.length, 1);
  assert.equal(g[0].files.length, 3);
  assert.equal(g[0].label, '3 photos');
});

check('PDFs and photos together: one course each plus one for the photos', () => {
  const g = groupSyllabuses([pdf('a.pdf'), jpg('p1.jpg'), pdf('b.pdf'), jpg('p2.jpg')], photos);
  assert.equal(g.length, 3);
  assert.deepEqual(g.map((x) => x.label), ['a.pdf', 'b.pdf', '2 photos']);
  assert.equal(g[2].files.length, 2);
});

check('the photo group comes last whatever the upload order', () => {
  const g = groupSyllabuses([jpg('p.jpg'), pdf('a.pdf')], photos);
  assert.deepEqual(g.map((x) => x.label), ['a.pdf', '1 photos']);
});

check('an empty upload is no syllabuses', () => {
  assert.deepEqual(groupSyllabuses([], photos), []);
});

check('every file ends up in exactly one group', () => {
  const files = [pdf('a.pdf'), jpg('1.jpg'), pdf('b.pdf'), png('2.png'), jpg('3.jpg')];
  const g = groupSyllabuses(files, photos);
  const flat = g.flatMap((x) => x.files);
  assert.equal(flat.length, files.length);
  assert.deepEqual(new Set(flat.map((f) => f.name)), new Set(files.map((f) => f.name)));
});

console.log('\ncounting the courses an upload will create');

check('counts one per PDF', () => {
  assert.equal(countSyllabuses([pdf('a.pdf'), pdf('b.pdf')]), 2);
});

check('counts all photos as one', () => {
  assert.equal(countSyllabuses([jpg('1.jpg'), jpg('2.jpg'), jpg('3.jpg')]), 1);
});

check('counts a mixed upload', () => {
  assert.equal(countSyllabuses([pdf('a.pdf'), jpg('1.jpg'), jpg('2.jpg')]), 2);
});

check('counts nothing as nothing', () => {
  assert.equal(countSyllabuses([]), 0);
});

check('the count matches the number of groups', () => {
  const files = [pdf('a.pdf'), jpg('1.jpg'), pdf('b.pdf'), png('2.png')];
  assert.equal(countSyllabuses(files), groupSyllabuses(files, photos).length);
});

check('isPdf does not match an image', () => {
  assert.equal(isPdf(pdf('a.pdf')), true);
  assert.equal(isPdf(jpg('a.jpg')), false);
});

console.log(`\n${passed} checks passed`);
