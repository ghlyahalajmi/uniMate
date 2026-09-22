/**
 * Reading a syllabus with rules instead of a model.
 *
 * A syllabus is a document written for humans, so a parser will never match a
 * model for nuance. But the part students actually need out of it — what is
 * assessed, when, and for how much — is written in a small number of shapes,
 * and those shapes can be matched exactly.
 *
 * The discipline here is the same as everywhere else in this codebase: take
 * what the document says, never fill in what it does not. A midterm with no
 * date comes back with a null date, not a guess.
 *
 * Pure and testable: text in, findings out, and the year for an undated line
 * is taken from `today` rather than from a clock.
 */

export type SyllabusEventKind =
  | 'exam' | 'quiz' | 'assignment' | 'project' | 'presentation' | 'other';

export interface ExtractedFinding {
  title: string;
  event_type: SyllabusEventKind;
  event_date: string | null;
  weight: number | null;
  description: string | null;
}

export interface SyllabusFindings {
  course_code: string | null;
  course_name: string | null;
  instructor: string | null;
  office_hours: string | null;
  topics: string[];
  events: ExtractedFinding[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const KIND_WORDS: Array<[RegExp, SyllabusEventKind]> = [
  [/\b(final|midterm|exam|اختبار|امتحان|نهائي|منتصف)\b/i, 'exam'],
  [/\b(quiz|كويز)\b/i, 'quiz'],
  [/\b(assignment|homework|hw|تكليف|واجب)\b/i, 'assignment'],
  [/\b(project|مشروع)\b/i, 'project'],
  [/\b(presentation|seminar|عرض|تقديم)\b/i, 'presentation'],
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** A date in the line, in whichever of the usual shapes it was written. */
export function dateIn(line: string, today: string): string | null {
  const fallbackYear = Number(today.slice(0, 4));

  // 2026-10-15
  const iso = line.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`;

  // 15/10/2026 or 15-10-2026 (day first, as written across the Gulf and Europe)
  const dmy = line.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${dmy[3]}-${pad(m)}-${pad(d)}`;
  }

  // October 15, 2026 / Oct 15 / 15 October
  const named = line.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:\s*,?\s*(20\d{2}))?\b/i,
  );
  if (named) {
    const m = MONTHS[named[1].toLowerCase()];
    const d = Number(named[2]);
    if (d >= 1 && d <= 31) return `${named[3] ?? fallbackYear}-${pad(m)}-${pad(d)}`;
  }

  const dayFirst = line.match(
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s*,?\s*(20\d{2}))?\b/i,
  );
  if (dayFirst) {
    const d = Number(dayFirst[1]);
    const m = MONTHS[dayFirst[2].toLowerCase()];
    if (d >= 1 && d <= 31) return `${dayFirst[3] ?? fallbackYear}-${pad(m)}-${pad(d)}`;
  }

  return null;
}

/** A percentage that is a weight, not a pass mark buried in a policy sentence. */
export function weightIn(line: string): number | null {
  const m = line.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n <= 100 ? n : null;
}

function kindOf(line: string): SyllabusEventKind | null {
  for (const [re, kind] of KIND_WORDS) if (re.test(line)) return kind;
  return null;
}

/** The line without its date and weight — what is left is the name of the thing. */
function titleFrom(line: string): string {
  return line
    .replace(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g, ' ')
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]20\d{2}\b/g, ' ')
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{0,2},?\s*(20\d{2})?/gi, ' ')
    .replace(/\d{1,3}(\.\d+)?\s*%/g, ' ')
    .replace(/[|\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s.:,\-–—•*]+|[\s.:,\-–—•*]+$/g, '')
    .slice(0, 120)
    .trim();
}

function labelled(lines: string[], ...labels: string[]): string | null {
  for (const line of lines) {
    for (const label of labels) {
      const re = new RegExp(`^\\s*${label}\\s*[:：]\\s*(.{2,160})$`, 'i');
      const m = line.match(re);
      if (m) return m[1].trim();
    }
  }
  return null;
}

export function extractFromText(text: string, today: string): SyllabusFindings {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  const events: ExtractedFinding[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const kind = kindOf(line);
    if (!kind) continue;

    const date = dateIn(line, today);
    const weight = weightIn(line);
    // A line that names an assessment but carries neither a date nor a weight
    // is prose about the course, not a row in its schedule.
    if (date === null && weight === null) continue;

    const title = titleFrom(line) || line.slice(0, 60);
    const key = `${title}|${date ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    events.push({ title, event_type: kind, event_date: date, weight, description: null });
    if (events.length >= 40) break;
  }

  const code = text.match(/\b([A-Z]{2,4})\s?-?\s?(\d{3}[A-Z]?)\b/);

  return {
    course_code: code ? `${code[1]}${code[2]}` : null,
    course_name: labelled(lines, 'course title', 'course name', 'اسم المقرر'),
    instructor: labelled(lines, 'instructor', 'lecturer', 'professor', 'المدرس', 'أستاذ المقرر'),
    office_hours: labelled(lines, 'office hours', 'الساعات المكتبية'),
    topics: [],
    events: events.sort((a, b) => (a.event_date ?? '9999').localeCompare(b.event_date ?? '9999')),
  };
}
