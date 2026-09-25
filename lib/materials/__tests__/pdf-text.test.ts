import { deflateSync } from 'node:zlib';
import { pdfText, hasUsableText } from '../pdf-text';

let passed = 0;
let failed = 0;

function group(name: string) { console.log(`\n${name}`); }

function check(name: string, condition: boolean, detail?: string) {
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

/** A PDF of the shape a slide deck exported from PowerPoint actually has. */
function pdf(content: string, { compress = true } = {}): Buffer {
  const body = compress
    ? deflateSync(Buffer.from(content, 'latin1'))
    : Buffer.from(content, 'latin1');

  return Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n', 'latin1'),
    Buffer.from(
      `4 0 obj<</Length ${body.length}${compress ? '/Filter/FlateDecode' : ''}>>stream\n`,
      'latin1',
    ),
    body,
    Buffer.from('\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF', 'latin1'),
  ]);
}

group('a compressed page of text');
{
  const text = pdfText(pdf(
    'BT /F1 12 Tf 72 720 Td (Electric field: the region around a charge.) Tj T*\n'
    + '(Magnetic flux: the field through a surface.) Tj ET',
  ));
  check('the words come out', text.includes('Electric field'), JSON.stringify(text));
  check('the second line comes out too', text.includes('Magnetic flux'));
  check('each drawn line is its own line', text.split('\n').length >= 2, JSON.stringify(text));
}

group('an uncompressed page');
{
  const text = pdfText(pdf('BT (Plain and uncompressed.) Tj ET', { compress: false }));
  check('a stream with no filter is read', text.includes('Plain and uncompressed'));
}

group('the operators a real deck uses');
{
  const kerned = pdfText(pdf('BT [(Magnetic) -300 (flux)] TJ ET'));
  check('a kerned array joins with a space', kerned.includes('Magnetic flux'), JSON.stringify(kerned));

  const tight = pdfText(pdf('BT [(Mag) -20 (netic)] TJ ET'));
  check('a small kern does not split a word', tight.includes('Magnetic'), JSON.stringify(tight));

  const hex = pdfText(pdf('BT <00500065007200660065006300740021> Tj ET'));
  check('a two-byte hex string is read', hex.includes('Perfect!'), JSON.stringify(hex));

  const escaped = pdfText(pdf('BT (A \\(nested\\) note) Tj ET'));
  check('escaped brackets survive', escaped.includes('A (nested) note'), JSON.stringify(escaped));

  const octal = pdfText(pdf('BT (caf\\351) Tj ET'));
  check('an octal escape becomes its character', octal.includes('café'), JSON.stringify(octal));
}

group('what it must not do');
{
  check('a scan gives nothing rather than noise',
    pdfText(pdf('\u0089PNG\r\n\u001a\n\u0000\u0000\u0000rubbish binary data here')) === '');

  check('an empty file gives nothing', pdfText(Buffer.from('')) === '');
  check('something that is not a PDF gives nothing',
    pdfText(Buffer.from('just a text file, honestly')) === '');

  // A stream that claims to be compressed and is not must not throw.
  const broken = Buffer.concat([
    Buffer.from('%PDF-1.4\n4 0 obj<</Filter/FlateDecode>>stream\n', 'latin1'),
    Buffer.from([0x78, 0x9c, 0x00, 0x01, 0x02]),
    Buffer.from('\nendstream\n%%EOF', 'latin1'),
  ]);
  let threw = false;
  try { pdfText(broken); } catch { threw = true; }
  check('a corrupt stream does not throw', !threw);
}

group('deciding whether it is worth using');
{
  check('a title slide is not enough to build questions from',
    !hasUsableText('Chapter 3\nElectromagnetic Theory'));
  check('a page of prose is enough', hasUsableText('word '.repeat(80)));
}

group('the whole point: a chapter a student would upload');
{
  const slides = pdfText(pdf(
    'BT (Chapter 3 - Electromagnetic Theory) Tj T*\n'
    + '(Electric field: the region around a charged particle where a force acts on other charges.) Tj T*\n'
    + '(Magnetic flux: the total magnetic field passing through a given surface area.) Tj T*\n'
    + '(Permittivity: a measure of how much a material resists forming an electric field.) Tj T*\n'
    + '(Inductance: the tendency of a conductor to oppose a change in the current through it.) Tj ET',
  ));
  check('every definition survives', (slides.match(/:/g) ?? []).length >= 4, JSON.stringify(slides));
  check('it is long enough to use', hasUsableText(slides), `${slides.length} chars`);
}

console.log(`\n${passed} checks passed${failed > 0 ? `, ${failed} FAILED` : ''}`);
if (failed > 0) process.exit(1);
