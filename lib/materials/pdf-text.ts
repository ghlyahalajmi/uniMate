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
  /*
   * A line break is a move down the page, not a move at all.
   *
   * This is the whole difficulty. PowerPoint writes every styled run as its
   * own positioned piece — "The", then "electric field" in bold, then "is
   * defined through…" — so a single sentence arrives as four separate draws.
   * Breaking the line at each one shattered every sentence in the deck into
   * fragments too short to be worth asking about, which is why a 64,000
   * character chapter yielded no questions at all.
   *
   * So the vertical position is tracked instead. `Td` and `TD` carry their own
   * displacement, `Tm` sets the whole text matrix, and `T*` is always a new
   * line. A move that changes y starts a line; a move that only changes x is
   * the next run of the same one, and gets a space.
   */
  const marks: Array<{ at: number; text: string }> = [];

  const TEXT = /(\((?:\\.|[^\\()])*\)|\[[\s\S]*?\]|<[0-9A-Fa-f\s]*>)\s*(TJ|Tj|'|")/g;
  const MOVE = /(-?[\d.]+)\s+(-?[\d.]+)\s+(Td|TD)\b/g;
  const MATRIX = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm\b/g;
  // `\b` after an asterisk never matches — it is not a word character — so
  // the two operators are anchored separately.
  const NEWLINE = /T\*|\bET\b/g;

  let m: RegExpExecArray | null;

  while ((m = TEXT.exec(content)) !== null) {
    marks.push({ at: m.index, text: readOperand(m[1]) });
  }
  while ((m = MOVE.exec(content)) !== null) {
    // A vertical displacement of zero is the same line, further along it.
    marks.push({ at: m.index, text: Math.abs(Number(m[2])) > 0.01 ? '\n' : ' ' });
  }
  while ((m = NEWLINE.exec(content)) !== null) {
    marks.push({ at: m.index, text: '\n' });
  }

  /*
   * `Tm` is absolute rather than relative, so it only means a new line when
   * the y it sets differs from the y in force. A deck that sets the matrix
   * for every run — which is most of them — would otherwise break every run
   * onto its own line all over again.
   */
  const matrices: Array<{ at: number; y: number }> = [];
  while ((m = MATRIX.exec(content)) !== null) {
    matrices.push({ at: m.index, y: Number(m[6]) });
  }
  for (let i = 0; i < matrices.length; i++) {
    const previous = matrices[i - 1];
    const moved = !previous || Math.abs(matrices[i].y - previous.y) > 1;
    marks.push({ at: matrices[i].at, text: moved ? '\n' : ' ' });
  }

  marks.sort((a, b) => a.at - b.at);
  return marks.map((mark) => mark.text).join('');
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

/**
 * Whether a run of characters is writing or wreckage.
 *
 * Decoding a font's internal table with a text decoder yields plenty of
 * characters, all of them nonsense. Real writing is mostly letters, digits,
 * spaces and punctuation; binary read as Latin-1 is mostly the high range.
 */
function looksLikeText(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  /*
   * A ratio rather than a length: a slide with two words on it is a real
   * slide, and a font table read as text is thousands of characters. What
   * separates them is what proportion of it could have been typed.
   */
  const ordinary = trimmed.replace(/[^\p{L}\p{N}\s.,;:!?()\[\]'"/%°+\-=×÷<>^_*|@#&$~{}]/gu, '').length;
  return ordinary >= trimmed.length * 0.75;
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
    /*
     * Equations set in a symbol font arrive as control bytes and private-use
     * characters — the glyph index, not the character. They are not words in
     * any language and cannot be turned back into one without the font, so
     * they go rather than sitting in the middle of a sentence as mojibake.
     */
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\ue000-\uf8ff]+/g, ' ')
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

    /*
     * Only a content stream holds text, and it has to look like one.
     *
     * A font file or a compressed image is a megabyte of bytes, and in a
     * megabyte of bytes the two characters "Tj" turn up by accident. Reading
     * one as a page produced pages of mojibake — and the question builder,
     * given mojibake, dutifully built questions out of it. So a stream has to
     * open a text object and close it, not merely contain the letters.
     */
    if (!/\bBT\b/.test(content) || !/\bET\b/.test(content)) continue;
    if (!/(TJ|Tj|T\*|Td)\s/.test(content)) continue;

    const drawn = textFromContentStream(content);
    // And what comes out has to read as language rather than as bytes.
    if (!looksLikeText(drawn)) continue;

    out += drawn;
    out += '\n';
  }

  return tidy(out.slice(0, MAX_TEXT));
}

/** Whether a PDF gave up enough text to be worth building questions from. */
export function hasUsableText(text: string): boolean {
  return text.replace(/\s/g, '').length >= 200;
}
