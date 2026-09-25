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

/** Splits a chapter into sentences, keeping bullets as sentences of their own. */
export function sentencesIn(text: string): string[] {
  const out: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const cleaned = line
      .replace(/^[\s\-*•·▪◦]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) continue;

    // A bullet often has no full stop; a paragraph has several sentences.
    for (const piece of cleaned.split(/(?<=[.!?])\s+(?=[A-Z؀-ۿ])/)) {
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

    // A line that is mostly symbols is a formula, and blanking part of one
    // asks the student to recall punctuation.
    const letters = sentence.replace(/[^\p{L}]/gu, '').length;
    if (letters < sentence.length * 0.55) continue;

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
