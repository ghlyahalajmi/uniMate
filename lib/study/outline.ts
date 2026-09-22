/**
 * Turning a chapter's own text into a revision note, without a model.
 *
 * This does not write anything: it finds what the chapter already says and
 * arranges it. A heading stays a heading, a definition stays in the words the
 * lecturer used, and nothing is added that was not in the file. That is the
 * whole point — when the model is unavailable, an invented "key term" would be
 * worse than none.
 *
 * Pure and testable, so the shape of a real chapter can be checked against it.
 */

export interface TextOutline {
  overview: string;
  sections: Array<{ heading: string; body: string }>;
  keyTerms: Array<{ term: string; meaning: string }>;
  formulas: string[];
  checklist: string[];
}

/** A line that reads like a heading: short, no full stop, not a sentence. */
function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 80) return false;
  if (/[.!?،؛]$/.test(t)) return false;
  if (/^[-*•]/.test(t)) return false;
  // "3.2 Laplace transforms", "Chapter 4", "CONVOLUTION", or Title Case.
  return (
    /^(chapter|section|unit|lecture|الفصل|الوحدة)\b/i.test(t) ||
    /^\d+(\.\d+)*\s+\S/.test(t) ||
    (t === t.toUpperCase() && /[A-Z؀-ۿ]/.test(t)) ||
    t.split(/\s+/).length <= 8
  );
}

/** "Term — meaning", "Term: meaning", "Term is defined as ..." */
function definitionIn(line: string): { term: string; meaning: string } | null {
  const t = line.trim().replace(/^[-*•]\s*/, '');
  const m =
    t.match(/^([^:—–-]{2,60})\s*[:—–]\s*(.{10,300})$/) ??
    t.match(/^(.{2,60}?)\s+(?:is|are)\s+defined\s+as\s+(.{10,300})$/i);
  if (!m) return null;
  const term = m[1].trim();
  const meaning = m[2].trim();
  // A sentence that merely contains a colon is not a definition.
  if (term.split(/\s+/).length > 6) return null;
  return { term, meaning };
}

/** A line carrying a formula: an equals sign, or maths symbols and few words. */
function looksLikeFormula(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 200) return false;
  if (!/[=∑∫√±≤≥→]/.test(t)) return false;
  return t.split(/\s+/).length <= 24;
}

export function outlineFromText(text: string, chapterTitle: string): TextOutline {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  const sections: Array<{ heading: string; body: string }> = [];
  const keyTerms: Array<{ term: string; meaning: string }> = [];
  const formulas: string[] = [];

  let heading = chapterTitle;
  let body: string[] = [];

  const flush = () => {
    const prose = body.join(' ').trim();
    if (prose.length > 40) sections.push({ heading, body: prose.slice(0, 900) });
    body = [];
  };

  for (const line of lines) {
    if (looksLikeFormula(line) && formulas.length < 12) formulas.push(line);

    const def = definitionIn(line);
    if (def && keyTerms.length < 14 && !keyTerms.some((k) => k.term === def.term)) {
      keyTerms.push(def);
      continue;
    }

    if (looksLikeHeading(line)) {
      flush();
      heading = line;
      continue;
    }

    body.push(line);
  }
  flush();

  const firstProse = lines.find((l) => l.length > 80 && !looksLikeHeading(l)) ?? '';

  return {
    overview: firstProse
      ? firstProse.slice(0, 500)
      : `${chapterTitle} — read from the file you uploaded. No AI was involved, so this is the chapter's own wording rearranged, not a summary of it.`,
    sections: sections.slice(0, 8),
    keyTerms,
    formulas,
    checklist: [
      ...keyTerms.slice(0, 6).map((k) => `Explain ${k.term} in your own words.`),
      ...sections.slice(0, 4).map((s) => `Work through "${s.heading}" without the notes.`),
      ...(formulas.length > 0 ? ['Reproduce every formula above from memory.'] : []),
    ].slice(0, 10),
  };
}

/**
 * Cards from the same text: one per definition found.
 *
 * Only real definitions, never a guess — a card whose back was invented is a
 * card that teaches the wrong thing, and it would be reviewed for weeks.
 */
export function cardsFromText(
  text: string, limit: number, topic: string,
): Array<{ front: string; back: string; topic: string }> {
  const seen = new Set<string>();
  const cards: Array<{ front: string; back: string; topic: string }> = [];

  for (const line of text.split(/\r?\n/)) {
    if (cards.length >= limit) break;
    const def = definitionIn(line.replace(/\s+/g, ' '));
    if (!def) continue;
    const key = def.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push({ front: `What is ${def.term}?`, back: def.meaning, topic });
  }

  return cards;
}
