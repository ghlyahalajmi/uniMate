import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured, callText } from '../client';
import { systemFor } from '../prompts';
import type { SyllabusEventType } from '@/types/database';

export interface SyllabusInput {
  /** base64 for a PDF or image, or already-extracted plain text. */
  document:
    | { kind: 'pdf'; data: string }
    | { kind: 'image'; mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }
    | { kind: 'text'; text: string };
  courseHint?: string;
  /** Anchors relative dates such as "week 7". */
  today: string;
}

export interface ExtractedEvent {
  title: string;
  event_type: SyllabusEventType;
  event_date: string | null;
  weight: number | null;
  description: string | null;
}

export interface SyllabusOutput {
  course_name: string | null;
  course_code: string | null;
  instructor: string | null;
  office_hours: string | null;
  required_material: string | null;
  policies: string | null;
  topics: string[];
  events: ExtractedEvent[];
  summary: string;
  /** Verbatim text kept so the syllabus stays answerable later. */
  extracted_text: string;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['course_name','course_code','instructor','office_hours','required_material','policies','topics','events','summary','extracted_text'],
  properties: {
    course_name: { type: ['string','null'] },
    course_code: { type: ['string','null'] },
    instructor: { type: ['string','null'] },
    office_hours: { type: ['string','null'] },
    required_material: { type: ['string','null'] },
    policies: { type: ['string','null'], description: 'Late work, attendance, academic integrity — only what the document states.' },
    topics: { type: 'array', items: { type: 'string' }, description: 'Weekly or unit topics, in order.' },
    summary: { type: 'string', description: 'Two sentences describing how the course is assessed.' },
    extracted_text: { type: 'string', description: 'The readable text of the document, kept so questions can be answered from it later. Up to about 20000 characters.' },
    events: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title','event_type','event_date','weight','description'],
        properties: {
          title: { type: 'string' },
          event_type: { type: 'string', enum: ['exam','midterm','final','quiz','assignment','project','presentation','deadline','lecture','holiday','other'] },
          event_date: { type: ['string','null'], description: 'ISO YYYY-MM-DD. null when the document gives no date — never invent one.' },
          weight: { type: ['number','null'], description: 'Percent of the final grade, when stated.' },
          description: { type: ['string','null'] },
        },
      },
    },
  },
} as const;

/**
 * Agent 4 — Syllabus Analyst (Workflow B).
 *   Input:   an uploaded syllabus as PDF, image or text.
 *   Output:  structured course metadata, topics and dated assessments.
 *   Trigger: a syllabus upload finishes.
 *   Failure: no offline equivalent — reading the document needs the model.
 */
export const syllabusAnalyst: AgentDefinition<SyllabusInput, SyllabusOutput> = {
  name: 'Syllabus Analyst',
  trigger: 'syllabus_uploaded',
  workflow: 'workflow_b_syllabus_processing',
  describe: 'Reads a syllabus into topics, assessment weights and dated deadlines.',

  async run(input) {
    const documents = input.document.kind === 'text'
      ? undefined
      : [input.document.kind === 'pdf'
          ? { kind: 'pdf' as const, data: input.document.data }
          : { kind: 'image' as const, mediaType: input.document.mediaType, data: input.document.data }];

    return callStructured<SyllabusOutput>({
      system: systemFor(
        'You are the Syllabus Analyst. Extract only what the document states. If it gives no date ' +
        'for an assessment, set event_date to null — never infer one from the semester. If it gives ' +
        'no weight, set weight to null. Convert relative references such as "Week 7" to a date only ' +
        'when the document states the week-one date; otherwise leave the date null and put the ' +
        'relative reference in the description. Copy the readable body text into extracted_text so ' +
        'the student can ask questions about it later.',
      ),
      prompt: [
        `Today is ${input.today}.`,
        input.courseHint ? `This syllabus is for ${input.courseHint}.` : '',
        input.document.kind === 'text' ? `\nSYLLABUS TEXT:\n${input.document.text.slice(0, 120_000)}` : '',
        '\nExtract the structured information.',
      ].filter(Boolean).join('\n'),
      schema: SCHEMA,
      schemaName: 'syllabus_extraction',
      maxTokens: 32000,
      effort: 'high',
      documents,
    });
  },

  fallback: () => null,

  summariseInput: (i) =>
    `${i.document.kind === 'text' ? 'Syllabus text' : `Syllabus ${i.document.kind}`}${i.courseHint ? ` for ${i.courseHint}` : ''}`,
  summariseOutput: (o) =>
    `${o.events.length} assessment events extracted, ${o.topics.length} topics stored`,
};

/**
 * Answers a question strictly from one stored syllabus. Separate from the
 * extraction agent because it runs on demand with different failure semantics:
 * "not in the document" is a correct answer here, not an error.
 */
export async function askSyllabus(args: {
  extractedText: string;
  structured: string;
  question: string;
}): Promise<{ answer: string; found: boolean }> {
  const answer = await callText({
    system: systemFor(
      'You answer questions about one specific syllabus. The document below is your only source. ' +
      'If the answer is not in it, reply with exactly: NOT_FOUND. Do not reason from what is ' +
      'typical for a university course — only from this document. Keep answers to two sentences.',
    ),
    messages: [{
      role: 'user',
      content: [
        'SYLLABUS (structured):', args.structured, '',
        'SYLLABUS (full text):', args.extractedText.slice(0, 120_000), '',
        `QUESTION: ${args.question}`,
      ].join('\n'),
    }],
    maxTokens: 1000,
    effort: 'low',
  });

  const found = !answer.trim().toUpperCase().startsWith('NOT_FOUND');
  return { answer: found ? answer : '', found };
}
