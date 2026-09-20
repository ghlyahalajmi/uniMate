import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';
import {
  cleanCourseCode, cleanCredits, cleanDays, cleanTime, cleanTitleCase,
  type CleaningDecision,
} from '@/lib/validation/cleaning';
import type { Weekday } from '@/types/database';

/** One uploaded page. A syllabus is often several photos rather than one PDF. */
export type SyllabusPage =
  | { kind: 'image'; mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }
  | { kind: 'pdf'; data: string };

export interface SyllabusCourseInput {
  /** Every page of the same syllabus, in the order the student uploaded them. */
  pages: SyllabusPage[];
}

/** A person named on the syllabus, with whatever contact detail it printed. */
export interface ReadContact {
  name: string | null;
  email: string | null;
  office: string | null;
  office_hours: string | null;
}

export interface ReadCourse {
  course_code: string;
  course_name: string;
  credits: number | null;
  semester: string | null;
  days: Weekday[];
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  instructor: ReadContact;
  ta: ReadContact;
  /** Fields the model could not read with confidence, for the review screen. */
  uncertainFields: string[];
}

export interface SyllabusCourseOutput {
  course: ReadCourse | null;
  cleaning: CleaningDecision[];
  notes: string[];
}

const CONTACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'email', 'office', 'office_hours'],
  properties: {
    name: { type: ['string', 'null'], description: 'Full name including any title, exactly as printed.' },
    email: { type: ['string', 'null'], description: 'Exactly as printed. Null if the syllabus prints none.' },
    office: { type: ['string', 'null'], description: 'Building and room, e.g. "Engineering Block 2, Room 114".' },
    office_hours: { type: ['string', 'null'], description: 'Exactly as printed, e.g. "Sun & Tue 10:00-11:30".' },
  },
} as const;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['course', 'notes'],
  properties: {
    notes: {
      type: 'array', maxItems: 4, items: { type: 'string' },
      description: 'Anything the student should know — a page that was unreadable, a detail the syllabus never states.',
    },
    course: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: [
        'course_code', 'course_name', 'credits', 'semester', 'days',
        'start_time', 'end_time', 'room', 'instructor', 'ta', 'uncertainFields',
      ],
      properties: {
        course_code: { type: 'string', description: 'Exactly as printed, e.g. "CE 301".' },
        course_name: { type: 'string', description: 'The course title, exactly as printed.' },
        credits: { type: ['string', 'null'], description: 'Exactly as printed, e.g. "3 Credit Hours".' },
        semester: { type: ['string', 'null'], description: 'e.g. "Fall 2026".' },
        days: { type: 'string', description: 'The lecture days exactly as printed, e.g. "Sunday / Tuesday".' },
        start_time: { type: ['string', 'null'], description: 'Lecture start, exactly as printed.' },
        end_time: { type: ['string', 'null'], description: 'Lecture end, exactly as printed.' },
        room: { type: ['string', 'null'], description: 'The lecture room, not an office.' },
        instructor: CONTACT_SCHEMA,
        ta: CONTACT_SCHEMA,
        uncertainFields: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'course_code', 'course_name', 'credits', 'semester', 'days',
              'start_time', 'end_time', 'room',
              'instructor_name', 'instructor_email', 'instructor_office', 'instructor_office_hours',
              'ta_name', 'ta_email', 'ta_office', 'ta_office_hours',
            ],
          },
          description:
            'Every field you could not read with confidence. Be honest — a flagged field gets checked by ' +
            'the student, a wrong unflagged one does not.',
        },
      },
    },
  },
} as const;

/** The raw shape the model returns, before normalisation. */
interface RawContact {
  name: string | null; email: string | null; office: string | null; office_hours: string | null;
}
interface RawCourse {
  course_code: string; course_name: string; credits: string | null; semester: string | null;
  days: string; start_time: string | null; end_time: string | null; room: string | null;
  instructor: RawContact; ta: RawContact; uncertainFields: string[];
}

const EMPTY_CONTACT: RawContact = { name: null, email: null, office: null, office_hours: null };

/**
 * An email is the one field here that is worth rejecting rather than showing.
 * A misread address produces a mailto: link that looks right and silently goes
 * nowhere, so anything that is not shaped like an address is dropped and the
 * field flagged instead.
 */
function cleanEmail(raw: string | null): CleanResultLike<string | null> {
  if (!raw) return { value: null, decisions: [] };
  const trimmed = raw.trim().replace(/^mailto:/i, '').replace(/[.,;]+$/, '');
  const lowered = trimmed.toLowerCase();
  const decisions: CleaningDecision[] = [];

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lowered)) {
    return { value: null, decisions, rejected: true };
  }
  if (lowered !== raw.trim()) {
    decisions.push({
      field: 'email',
      original: raw.trim(),
      cleaned: lowered,
      reason: 'Normalised to lower case',
    });
  }
  return { value: lowered, decisions };
}

interface CleanResultLike<T> {
  value: T;
  decisions: CleaningDecision[];
  rejected?: boolean;
}

function cleanContact(raw: RawContact | undefined, who: 'instructor' | 'ta') {
  const source = raw ?? EMPTY_CONTACT;
  const decisions: CleaningDecision[] = [];
  const dropped: string[] = [];

  const name = source.name ? cleanTitleCase(source.name, `${who}_name`) : { value: null, decisions: [] };
  const email = cleanEmail(source.email);
  if (email.rejected) dropped.push(`${who}_email`);

  for (const d of [...name.decisions, ...email.decisions.map((x) => ({ ...x, field: `${who}_email` }))]) {
    decisions.push(d);
  }

  const contact: ReadContact = {
    name: name.value,
    email: email.value,
    office: source.office?.trim() || null,
    office_hours: source.office_hours?.trim() || null,
  };

  return { contact, decisions, dropped };
}

/**
 * Agent — Syllabus Course Reader.
 *   Input:   every page of one syllabus, as PDFs or photos.
 *   Output:  a single candidate course, its schedule, and its two contacts.
 *   Trigger: the student adds a course by syllabus.
 *   Failure: no offline equivalent — reading a document needs vision.
 *
 * This differs from the Setup Scanner on both ends. The scanner reads a
 * timetable, which is many courses and no contact details; this reads one
 * syllabus, which is one course and the people who teach it. Nothing here
 * writes — the caller shows the result and the student's confirmation is what
 * creates the row.
 */
export const syllabusCourseReader: AgentDefinition<SyllabusCourseInput, SyllabusCourseOutput> = {
  name: 'Syllabus Course Reader',
  trigger: 'syllabus_uploaded',
  workflow: 'workflow_f_course_from_syllabus',
  describe: 'Reads a syllabus into one course record, including how to reach the instructor and the TA.',

  async run(input) {
    const raw = await callStructured<{ course: RawCourse | null; notes: string[] }>({
      system: systemFor(
        'You are the Syllabus Course Reader. The attached pages are all from the SAME course syllabus — ' +
        'treat them as one document even when they arrive as separate photos, and return exactly one ' +
        'course. Copy values exactly as printed; do not tidy, expand abbreviations or convert times, ' +
        'because a later step handles normalisation. ' +
        'Distinguish the lecture room from an office: `room` is where the class meets, `office` is where ' +
        'that person holds office hours. ' +
        'The instructor is the professor or lecturer of record. The TA is the teaching assistant, ' +
        'demonstrator or lab instructor — if the syllabus names none, return nulls for every TA field ' +
        'rather than repeating the instructor. ' +
        'Never invent an email address, an office or an office hour. If a detail is absent, return null ' +
        'for it; if it is present but you cannot read it confidently, give your best reading and add ' +
        'that field name to uncertainFields. ' +
        'If the pages are not a syllabus at all, return course as null and say so in notes.',
      ),
      prompt:
        input.pages.length > 1
          ? `These ${input.pages.length} pages are one syllabus. Read the course and its contacts.`
          : 'Read the course and its contacts from this syllabus.',
      schema: SCHEMA,
      schemaName: 'syllabus_course',
      maxTokens: 16000,
      effort: 'high',
      documents: input.pages.map((p) =>
        p.kind === 'pdf'
          ? ({ kind: 'pdf', data: p.data } as const)
          : ({ kind: 'image', mediaType: p.mediaType, data: p.data } as const),
      ),
    });

    if (!raw.course) {
      return { course: null, cleaning: [], notes: raw.notes ?? [] };
    }

    const r = raw.course;
    const code = cleanCourseCode(r.course_code ?? '');
    const name = cleanTitleCase(r.course_name ?? '', 'course_name');
    const credits = r.credits ? cleanCredits(r.credits) : { value: null, decisions: [] };
    const days = cleanDays(r.days ?? '');
    const start = r.start_time ? cleanTime(r.start_time) : { value: null, decisions: [] };
    const end = r.end_time ? cleanTime(r.end_time) : { value: null, decisions: [] };
    const room = r.room ? cleanTitleCase(r.room, 'room') : { value: null, decisions: [] };

    const instructor = cleanContact(r.instructor, 'instructor');
    const ta = cleanContact(r.ta, 'ta');

    const cleaning: CleaningDecision[] = [
      ...code.decisions,
      ...name.decisions,
      ...credits.decisions,
      ...days.decisions,
      ...start.decisions.map((x) => ({ ...x, field: 'start_time' })),
      ...end.decisions.map((x) => ({ ...x, field: 'end_time' })),
      ...room.decisions,
      ...instructor.decisions,
      ...ta.decisions,
    ];

    // An address we had to drop is doubt, not silence — surface it for review.
    const uncertainFields = Array.from(new Set([
      ...(Array.isArray(r.uncertainFields) ? r.uncertainFields : []),
      ...instructor.dropped,
      ...ta.dropped,
    ]));

    const notes = [...(raw.notes ?? [])];
    for (const field of [...instructor.dropped, ...ta.dropped]) {
      notes.push(`An email address was read but did not look like a valid address, so it was left blank (${field}).`);
    }

    return {
      course: {
        course_code: code.value,
        course_name: name.value ?? r.course_name ?? '',
        credits: credits.value,
        semester: r.semester?.trim() || null,
        days: days.value as Weekday[],
        start_time: start.value,
        end_time: end.value,
        room: room.value,
        instructor: instructor.contact,
        ta: ta.contact,
        uncertainFields,
      },
      cleaning,
      notes,
    };
  },

  fallback: () => null,

  summariseInput: (i) => `Syllabus upload (${i.pages.length} page${i.pages.length === 1 ? '' : 's'})`,
  summariseOutput: (o) =>
    o.course
      ? `${o.course.course_code} read from syllabus, ${o.cleaning.length} values normalised, awaiting confirmation`
      : 'No course found in the uploaded pages',
};
