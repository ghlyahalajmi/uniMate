import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';

export interface GradingScaleInput {
  /** base64, no data: prefix */
  data: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
}

export interface ScaleRow {
  letter: string;
  min_percent: number;
  points: number;
  /** Fields the model could not read with confidence; the UI flags these. */
  uncertainFields: string[];
}

export interface GradingScaleOutput {
  rows: ScaleRow[];
  notes: string[];
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rows', 'notes'],
  properties: {
    notes: {
      type: 'array', maxItems: 4, items: { type: 'string' },
      description: 'Anything the reader should know — a cut-off column, a footnote, a second scale on the page.',
    },
    rows: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['letter', 'min_percent', 'points', 'uncertainFields'],
        properties: {
          letter: { type: 'string', description: 'The grade as printed, e.g. "A+", "B-", "F".' },
          min_percent: {
            type: ['string', 'null'],
            description: 'The lowest mark that earns this grade, as printed, e.g. "90" from "90-100".',
          },
          points: {
            type: ['string', 'null'],
            description: 'The grade points, as printed, e.g. "4.00" or "3.7".',
          },
          uncertainFields: {
            type: 'array',
            items: { type: 'string', enum: ['letter', 'min_percent', 'points'] },
            description:
              'Every field you could not read with confidence. Be honest — a flagged field gets '
              + 'checked by the student, a wrong unflagged one silently changes every GPA they calculate.',
          },
        },
      },
    },
  },
} as const;

interface RawRow {
  letter: string;
  min_percent: string | null;
  points: string | null;
  uncertainFields: string[];
}

/**
 * Agent — Grading Scale Reader.
 *   Input:   a photo or PDF of a university grading scale.
 *   Output:  candidate scale rows for the student to confirm.
 *   Trigger: the student uploads a picture of their grading scale.
 *   Failure: no offline equivalent — reading an image needs vision.
 *
 * This writes nothing. Every GPA in UniMate is computed against this scale, so
 * a misread row would quietly corrupt every figure the student is shown; the
 * caller puts the rows on screen and only the student's confirmation saves
 * them, replacing the existing scale.
 *
 * Numbers are parsed here rather than by the model: it is asked to transcribe
 * what is printed, and the strings are turned into numbers in code, so a
 * malformed value becomes a flagged field instead of a plausible wrong number.
 */
export const gradingScaleReader: AgentDefinition<GradingScaleInput, GradingScaleOutput> = {
  name: 'Grading Scale Reader',
  trigger: 'grading_scale_uploaded',
  workflow: 'workflow_f_grading_scale',
  describe: 'Reads a photographed grading scale into candidate scale rows for the student to confirm.',

  async run(input) {
    const raw = await callStructured<{ rows: RawRow[]; notes: string[] }>({
      system: systemFor(
        'You are the Grading Scale Reader. Transcribe the grading scale in the attached file into '
        + 'one row per letter grade. Copy values exactly as printed and do not convert or tidy them. '
        + 'For a band such as "90-100" the minimum is 90. If a row shows no percentage, or no grade '
        + 'points, return null for that field rather than inventing one, and name the field in '
        + 'uncertainFields. If the page holds more than one scale, transcribe the undergraduate one '
        + 'and say so in notes. If there is no grading scale in the image at all, return an empty '
        + 'rows array and say so in notes.',
      ),
      prompt: 'Transcribe every row of this grading scale.',
      schema: SCHEMA,
      schemaName: 'grading_scale',
      maxTokens: 8000,
      effort: 'high',
      documents: [
        input.mediaType === 'application/pdf'
          ? { kind: 'pdf', data: input.data }
          : { kind: 'image', mediaType: input.mediaType, data: input.data },
      ],
    });

    const rows: ScaleRow[] = [];

    for (const r of raw.rows ?? []) {
      const letter = (r.letter ?? '').trim().toUpperCase();
      if (!letter) continue;

      const uncertain = new Set(Array.isArray(r.uncertainFields) ? r.uncertainFields : []);
      const min = numberFrom(r.min_percent);
      const pts = numberFrom(r.points);

      // An unreadable number is flagged, never filled in: the student checks a
      // flagged field, and does not check one that looks plausible.
      if (min === null) uncertain.add('min_percent');
      if (pts === null) uncertain.add('points');

      rows.push({
        letter,
        min_percent: clamp(min ?? 0, 0, 100),
        points: clamp(pts ?? 0, 0, 10),
        uncertainFields: [...uncertain],
      });
    }

    // Highest grade first, which is how every scale is printed and how the
    // editor expects them.
    rows.sort((a, b) => b.min_percent - a.min_percent);

    return { rows, notes: raw.notes ?? [] };
  },

  fallback: () => null,

  summariseInput: (i) => `Grading scale upload (${i.mediaType})`,
  summariseOutput: (o) =>
    `${o.rows.length} scale rows detected, ${o.rows.filter((r) => r.uncertainFields.length).length} needing a check`,
};

/** First number in the string, or null. "90-100" → 90; "A+" → null. */
function numberFrom(value: string | null): number | null {
  if (!value) return null;
  const match = String(value).match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const n = Number(match[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}
