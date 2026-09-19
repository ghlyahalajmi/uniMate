import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';
import { cleanCourseCode, cleanCredits, cleanDays, cleanTime, cleanTitleCase, type CleaningDecision } from '@/lib/validation/cleaning';
import type { Weekday } from '@/types/database';

export interface ScannerInput {
  /** base64, no data: prefix */
  data: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
}

/** A course read off the image, with per-field confidence so the UI can flag doubt. */
export interface ScannedCourse {
  course_code: string;
  course_name: string;
  instructor: string | null;
  credits: number | null;
  days: Weekday[];
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  /** Fields the model was not confident about. The UI asks the student to check these. */
  uncertainFields: string[];
}

export interface ScannerOutput {
  courses: ScannedCourse[];
  /** Normalisations applied, for the cleaning log. Nothing is cleaned silently. */
  cleaning: Array<CleaningDecision & { courseCode: string }>;
  notes: string[];
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['courses', 'notes'],
  properties: {
    notes: {
      type: 'array', maxItems: 4, items: { type: 'string' },
      description: 'Anything the reader should know, e.g. a column that was cut off.',
    },
    courses: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['course_code','course_name','instructor','credits','days','start_time','end_time','room','uncertainFields'],
        properties: {
          course_code: { type: 'string', description: 'Exactly as printed, e.g. "CE 301".' },
          course_name: { type: 'string' },
          instructor: { type: ['string','null'] },
          credits: { type: ['string','null'], description: 'Exactly as printed, e.g. "3 Credits".' },
          days: { type: 'string', description: 'Exactly as printed, e.g. "Sunday / Tuesday".' },
          start_time: { type: ['string','null'], description: 'Exactly as printed, e.g. "10:00".' },
          end_time: { type: ['string','null'], description: 'Exactly as printed.' },
          room: { type: ['string','null'] },
          uncertainFields: {
            type: 'array',
            items: { type: 'string', enum: ['course_code','course_name','instructor','credits','days','start_time','end_time','room'] },
            description: 'Every field you could not read with confidence. Be honest — a flagged field gets checked by the student, a wrong unflagged one does not.',
          },
        },
      },
    },
  },
} as const;

/** The raw shape the model returns, before normalisation. */
interface RawScanned {
  course_code: string;
  course_name: string;
  instructor: string | null;
  credits: string | null;
  days: string;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  uncertainFields: string[];
}

/**
 * Agent — Setup Scanner (Workflow A).
 *   Input:   a photo or PDF of a timetable.
 *   Output:  candidate courses plus the cleaning decisions applied to them.
 *   Trigger: the student uploads a timetable.
 *   Failure: no offline equivalent — reading an image needs vision.
 *
 * Nothing here writes to the database. The caller shows the result for review
 * and only the student's confirmation creates rows.
 */
export const setupScanner: AgentDefinition<ScannerInput, ScannerOutput> = {
  name: 'Setup Scanner',
  trigger: 'timetable_uploaded',
  workflow: 'workflow_a_schedule_scan',
  describe: 'Reads a photographed timetable into candidate course records for the student to confirm.',

  async run(input) {
    const raw = await callStructured<{ courses: RawScanned[]; notes: string[] }>({
      system: systemFor(
        'You are the Setup Scanner. Transcribe the timetable in the attached file into structured ' +
        'course records. Copy values exactly as printed — do not tidy, expand abbreviations or ' +
        'convert times; a later step handles normalisation. If a field is blurred, cropped, ' +
        'ambiguous or simply absent, put your best reading in the field and add that field name to ' +
        'uncertainFields. Never guess a room number or a time to fill a gap. If the image contains ' +
        'no timetable at all, return an empty courses array and say so in notes.',
      ),
      prompt: 'Transcribe every course in this timetable.',
      schema: SCHEMA,
      schemaName: 'scanned_timetable',
      maxTokens: 16000,
      effort: 'high',
      documents: [
        input.mediaType === 'application/pdf'
          ? { kind: 'pdf', data: input.data }
          : { kind: 'image', mediaType: input.mediaType, data: input.data },
      ],
    });

    const cleaning: ScannerOutput['cleaning'] = [];
    const courses: ScannedCourse[] = [];

    for (const r of raw.courses ?? []) {
      const code = cleanCourseCode(r.course_code ?? '');
      const name = cleanTitleCase(r.course_name ?? '', 'course_name');
      const instructor = r.instructor ? cleanTitleCase(r.instructor, 'instructor') : { value: null, decisions: [] };
      const credits = r.credits ? cleanCredits(r.credits) : { value: null, decisions: [] };
      const days = cleanDays(r.days ?? '');
      const start = r.start_time ? cleanTime(r.start_time) : { value: null, decisions: [] };
      const end = r.end_time ? cleanTime(r.end_time) : { value: null, decisions: [] };
      const room = r.room ? cleanTitleCase(r.room, 'room') : { value: null, decisions: [] };

      for (const d of [
        ...code.decisions, ...name.decisions, ...instructor.decisions,
        ...credits.decisions, ...days.decisions,
        ...start.decisions.map((x) => ({ ...x, field: 'start_time' })),
        ...end.decisions.map((x) => ({ ...x, field: 'end_time' })),
        ...room.decisions,
      ]) {
        cleaning.push({ ...d, courseCode: code.value });
      }

      courses.push({
        course_code: code.value,
        course_name: name.value ?? r.course_name ?? '',
        instructor: instructor.value,
        credits: credits.value,
        days: days.value as Weekday[],
        start_time: start.value,
        end_time: end.value,
        room: room.value,
        uncertainFields: Array.isArray(r.uncertainFields) ? r.uncertainFields : [],
      });
    }

    return { courses, cleaning, notes: raw.notes ?? [] };
  },

  fallback: () => null,

  summariseInput: (i) => `Timetable upload (${i.mediaType})`,
  summariseOutput: (o) =>
    `${o.courses.length} courses detected, ${o.cleaning.length} values normalised, awaiting confirmation`,
};
