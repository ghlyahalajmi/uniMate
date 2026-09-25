/**
 * Statements worth being asked about, found in ordinary prose.
 *
 * The first version of this only understood "Term: meaning" lines, and a
 * lecturer's slides are almost never written that way. They are bullets and
 * sentences: "The electric field is strongest closest to the charge", "Light
 * travels at 3 x 10^8 metres per second". Every one of those is a claim that
 * can be blanked, judged, or asked about — and none of them has a colon in it.
 *
 * So this looks for the shape of a statement rather than the shape of a
 * definition: a sentence of a reasonable length built round a linking verb,
 * with something specific in it worth remembering. The specific thing becomes
 * the answer; the rest of the sentence becomes the question.
 *
 * Pure, deterministic and testable against a real chapter.
 */

export interface Fact {
  /** The sentence as the chapter wrote it. */
  sentence: string;
  /** The part worth remembering: a term, a quantity, a name. */
  key: string;
  /** Where `key` starts in `sentence`, so it can be cut out exactly once. */
  at: number;
  /**
   * What kind of thing the key is.
   *
   * A false statement is only worth judging if it could have been true. Swap
   * a speed for a wavelength and the student has to know the physics; swap a
   * speed for a verb and they spot it by grammar, which tests nothing.
   */
  kind: 'quantity' | 'name' | 'word';
}

/**
 * Verbs that turn a noun phrase into a claim. A sentence without one is
 * usually a heading, a caption or half a bullet, and blanking a word out of it
 * produces a question with no answer.
 */
const LINKING = new RegExp(
  '\\b(is|are|was|were|means|refers to|consists of|consist of|equals|equal to|'
  + 'describes|represents|contains|produces|causes|travels|behaves|occurs|'
  + 'depends on|is defined as|is called|is known as|has|have|relates|relate|'
  + 'defines|define|forms|form|carries|carry|requires|require|emits|emit|'
  + 'absorbs|absorb|increases|increase|decreases|decrease|varies|vary|'
  + 'moves|move|acts|act|behaves as|results in)\\b',
  'i',
);

/** Words that are never the point of a sentence. */
const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'by', 'for',
  'with', 'from', 'as', 'that', 'this', 'these', 'those', 'it', 'its', 'be', 'been',
  'is', 'are', 'was', 'were', 'has', 'have', 'had', 'can', 'may', 'will', 'would',
  'when', 'where', 'which', 'while', 'than', 'then', 'also', 'more', 'most', 'some',
  'each', 'both', 'such', 'other', 'into', 'through', 'between', 'about', 'they',
  'their', 'them', 'there', 'we', 'you', 'not', 'any', 'all', 'one', 'two', 'very',
]);

/**
 * Debris from an equation set in a symbol font: a line that is mostly
 * punctuation and stray capitals once the glyphs have been stripped. It is
 * not a sentence in any language and joining it to a real one ruins both.
 */
function isDebris(line: string): boolean {
  if (line.length > 60) return false;
  const letters = line.replace(/[^\p{L}]/gu, '').length;
  const words = line.split(/\s+/).filter((w) => w.length > 2).length;
  return letters < line.length * 0.5 || words < 2;
}

/**
 * Splits a chapter into sentences, keeping bullets as sentences of their own.
 *
 * Lines are rejoined first. A PDF has no paragraphs — it has draws at
 * positions — so a sentence that wrapped on the slide arrives as two lines,
 * and a phrase the lecturer made bold arrives as a line of its own. Both are
 * put back: a line that does not finish a sentence, followed by one that does
 * not start one, is one line.
 */
export function sentencesIn(text: string): string[] {
  const lines: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const cleaned = raw
      // Wingdings bullets arrive as ordinary characters: ¾ Ø § v are all
      // 'a bullet' in one font or another.
      .replace(/^[\s\-*•·▪◦¾Ø§▶►◆❖]+(?=\s|[A-Z\u0600-\u06FF])/, '')
      .replace(/^[\s\-*•·▪◦]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned || isDebris(cleaned)) continue;
    lines.push(cleaned);
  }

  // Put wrapped lines back together.
  const joined: string[] = [];
  for (const line of lines) {
    const previous = joined[joined.length - 1];
    /*
     * A numbered heading never continues into the sentence beneath it.
     *
     * "3.1 Basic Laws of Electromagnetic Theory" followed by a bullet that
     * begins with a lower-case word looks exactly like a wrapped line, and
     * joining them produced a question asking what fills the gap in "3.1
     * Basic Laws of ______ electric field is defined through…".
     */
    const heading = previous !== undefined && /^\d+(\.\d+)*\s/.test(previous);

    const continues =
      previous !== undefined
      && !heading
      && !/[.!?:;]$/.test(previous)
      && /^[a-z\u0600-\u06FF(]/.test(line)
      && previous.split(/\s+/).length + line.split(/\s+/).length <= 40;

    if (continues) joined[joined.length - 1] = `${previous} ${line}`;
    else joined.push(line);
  }

  const out: string[] = [];
  for (const line of joined) {
    for (const piece of line.split(/(?<=[.!?])\s+(?=[A-Z\u0600-\u06FF])/)) {
      const sentence = piece.trim().replace(/\s*[.;,]+$/, '');
      if (sentence) out.push(sentence);
    }
  }

  return out;
}

/**
 * The part of a sentence worth asking about.
 *
 * In order of preference: a quantity with a unit, because that is the thing
 * people actually forget; then a capitalised phrase that is not the first
 * word, which in a technical sentence is a named thing; then the longest
 * ordinary word that is not furniture.
 */
function keyOf(sentence: string): { key: string; at: number; kind: Fact['kind'] } | null {
  const quantity = sentence.match(
    /\b\d[\d.,]*\s*(?:x\s*10\^?-?\d+\s*)?(?:m\/s|km\/s|nm|mm|cm|km|hz|khz|mhz|ghz|ev|kev|mev|j|kj|w|kw|v|mv|a|ma|ω|ohms?|kg|g|s|ms|µs|ns|°c|k|t|%)\b/i,
  );
  if (quantity && quantity.index !== undefined) {
    return { key: quantity[0].trim(), at: quantity.index, kind: 'quantity' };
  }

  // A named thing: two or three capitalised words, or one long one, not at the
  // very start where every sentence capitalises anyway.
  const named = [...sentence.matchAll(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b/g)]
    .filter((m) => (m.index ?? 0) > 0);
  if (named.length > 0) {
    const best = named.reduce((a, b) => (b[1].length > a[1].length ? b : a));
    return { key: best[1], at: best.index ?? 0, kind: 'name' };
  }

  const words = [...sentence.matchAll(/\b([\p{L}][\p{L}-]{4,})\b/gu)]
    .filter((m) => !STOP.has(m[1].toLowerCase()));
  if (words.length === 0) return null;

  const longest = words.reduce((a, b) => (b[1].length > a[1].length ? b : a));
  return { key: longest[1], at: longest.index ?? 0, kind: 'word' };
}

/**
 * Facts in a chapter, in the order it makes them.
 *
 * A sentence is kept when it is long enough to carry a claim, short enough to
 * read as a question, built round a linking verb, and has something specific
 * in it. Everything else — headings, page furniture, half-bullets — is left
 * alone rather than turned into a question nobody can answer.
 */
export function factsIn(text: string): Fact[] {
  const out: Fact[] = [];
  const seen = new Set<string>();

  for (const sentence of sentencesIn(text)) {
    const words = sentence.split(/\s+/).length;
    if (words < 5 || words > 34) continue;
    if (/[?]$/.test(sentence)) continue;
    if (!LINKING.test(sentence)) continue;

    // A line that is mostly symbols is a formula — or wreckage — and blanking
    // part of one asks the student to recall punctuation.
    const letters = sentence.replace(/[^\p{L}]/gu, '').length;
    if (letters < sentence.length * 0.6) continue;

    /*
     * A decoding artefact rather than a sentence.
     *
     * The test is not "unusual characters" — λ and μ and ° are ordinary in
     * physics, and Arabic is ordinary here. It is *runs* of accented Latin
     * letters, which is what a font table looks like when it is read as text
     * and never what anybody types.
     */
    if (/[\u00c0-\u024f]{2,}/u.test(sentence)) continue;

    const key = keyOf(sentence);
    if (!key || key.key.length < 3) continue;

    // A key that is most of the sentence leaves nothing to read.
    if (key.key.length > sentence.length * 0.5) continue;

    const fingerprint = sentence.toLowerCase().slice(0, 60);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    out.push({ sentence, key: key.key, at: key.at, kind: key.kind });
  }

  return out;
}

/** The sentence with its key cut out, blanked exactly once. */
export function blanked(fact: Fact, blank = '______'): string {
  return fact.sentence.slice(0, fact.at) + blank + fact.sentence.slice(fact.at + fact.key.length);
}
