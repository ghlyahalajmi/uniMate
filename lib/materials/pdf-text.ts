import { inflateSync, inflateRawSync } from 'node:zlib';

/**
 * Reading the words out of a PDF, without a model and without a library.
 *
 * A PDF that was made from a document — lecture slides exported from
 * PowerPoint, a syllabus printed to PDF, a chapter from a publisher — stores
 * its text as text. It is wrapped in compressed streams and addressed by
 * operators rather than laid out as a paragraph, but the words are in there.
 * Only a scan is genuinely a picture.
 *
 * So "a PDF needs a model to read it" was true of the code and not of the
 * file, and it was the reason a student who uploaded the chapter they were
 * actually revising got nothing from every offline path in the app.
 *
 * What this does not do: layout. Columns, tables and reading order are lost,
 * and a scanned page comes back empty — correctly, because there is nothing
 * there to find. The caller checks for empty and falls back rather than
 * showing a student a page of nothing.
 */

/** Anything past this is a book, not a chapter; enough for any slide deck. */
const MAX_TEXT = 400_000;

/**
 * Text-showing operators carry their strings in ( ) or < >. This pulls the
 * strings out of one decoded content stream, in the order they are drawn.
 */
function textFromContentStream(content: string): string {
  let out = '';

  /*
   * `(text) Tj`, `[(a) -2 (b)] TJ`, and the quote operators. The pieces are
   * gathered operator by operator rather than by one greedy regex, because a
   * bracket inside a string is a bracket, not the end of an array.
   */
  const operator = /(\((?:\\.|[^\\()])*\)|\[[\s\S]*?\]|<[0-9A-Fa-f\s]*>)\s*(TJ|Tj|'|")/g;
  const positioning = /(T\*|Td|TD|ET)/g;

  // Walk the stream once, keeping the order of text and line breaks.
  const marks: Array<{ at: number; text: string }> = [];

  let m: RegExpExecArray | null;
  while ((m = operator.exec(content)) !== null) {
    marks.push({ at: m.index, text: readOperand(m[1]) });
  }
  while ((m = positioning.exec(content)) !== null) {
    marks.push({ at: m.index, text: '\n' });
  }
  marks.sort((a, b) => a.at - b.at);

  for (const mark of marks) out += mark.text;
  return out;
}

/** One operand: a literal string, a hex string, or an array of both. */
function readOperand(operand: string): string {
  if (operand.startsWith('(')) return decodeLiteral(operand.slice(1, -1));
  if (operand.startsWith('<')) return decodeHex(operand.slice(1, -1));

  // An array: the strings in it, with large negative kerns read as a space.
  let out = '';
  const pieces = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>|-?\d+(?:\.\d+)?/g;
  let p: RegExpExecArray | null;
  while ((p = pieces.exec(operand)) !== null) {
    const piece = p[0];
    if (piece.startsWith('(')) out += decodeLiteral(piece.slice(1, -1));
    else if (piece.startsWith('<')) out += decodeHex(piece.slice(1, -1));
    else if (Number(piece) <= -120) out += ' ';
  }
  return out;
}

function decodeLiteral(value: string): string {
  return value.replace(/\\(n|r|t|b|f|\(|\)|\\|[0-7]{1,3})/g, (_, code: string) => {
    switch (code) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case 'b': return '';
      case 'f': return '';
      case '(': return '(';
      case ')': return ')';
      case '\\': return '\\';
      default: return String.fromCharCode(parseInt(code, 8));
    }
  });
}

/**
 * A hex string is either one byte per character pair, or two for the
 * two-byte encodings a slide deck's embedded font often uses. The high byte
 * is zero for everything in Latin-1, which is how the two are told apart.
 */
function decodeHex(value: string): string {
  const hex = value.replace(/\s+/g, '');
  if (hex.length % 4 === 0 && /^(00[0-9A-Fa-f]{2})+$/.test(hex)) {
    let out = '';
    for (let i = 0; i < hex.length; i += 4) {
      out += String.fromCharCode(parseInt(hex.slice(i + 2, i + 4), 16));
    }
    return out;
  }

  let out = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return out;
}

/** Never throws: a stream that will not inflate is a stream we skip. */
function inflate(bytes: Buffer): Buffer | null {
  try {
    return inflateSync(bytes);
  } catch {
    try {
      return inflateRawSync(bytes);
    } catch {
      return null;
    }
  }
}

/**
 * Tidies what the operators give back into something a person — and the
 * offline question builder — can read: real line breaks, no runs of spaces,
 * and no page of blank lines from a deck of title slides.
 */
function tidy(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, i, all) => line.length > 0 || (all[i - 1] ?? '').length > 0)
    .join('\n')
    .trim();
}

/**
 * The text of a PDF, or an empty string when there is none to find.
 *
 * An empty answer is the honest one for a scan: the file is a photograph of a
 * page, and the words in it are pixels.
 */
export function pdfText(bytes: Buffer): string {
  let out = '';

  // Streams are located by their markers rather than by parsing the object
  // graph: a chapter's text does not need the whole file understood, and a
  // malformed cross-reference table is common enough to plan around.
  const source = bytes.toString('latin1');
  const marker = /stream\r?\n?/g;

  let m: RegExpExecArray | null;
  while ((m = marker.exec(source)) !== null && out.length < MAX_TEXT) {
    const start = m.index + m[0].length;
    const end = source.indexOf('endstream', start);
    if (end === -1) continue;

    const slice = bytes.subarray(start, end);
    const decoded = inflate(slice) ?? slice;
    const content = decoded.toString('latin1');

    // Only content streams hold text operators; fonts and images do not, and
    // running the regex over a megabyte of image data would be wasted work.
    if (!/(TJ|Tj|T\*|Td)\s/.test(content)) continue;

    out += textFromContentStream(content);
    out += '\n';
  }

  return tidy(out.slice(0, MAX_TEXT));
}

/** Whether a PDF gave up enough text to be worth building questions from. */
export function hasUsableText(text: string): boolean {
  return text.replace(/\s/g, '').length >= 200;
}
