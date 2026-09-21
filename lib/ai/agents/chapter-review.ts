import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';

/** A chapter file, already fetched and encoded by the caller. */
export type ReviewDocument =
  | { kind: 'image'; mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }
  | { kind: 'pdf'; data: string }
  | { kind: 'text'; text: string };

export interface ChapterReviewInput {
  courseCode: string;
  courseName: string;
  /** What the student calls this chapter. */
  chapterTitle: string;
  document: ReviewDocument;
  /** Topics this student has been getting wrong, so the review can dwell there. */
  weakTopics?: string[];
}

export interface ReviewSection {
  heading: string;
  /** Two to five sentences. Prose, because a revision note is read, not skimmed. */
  body: string;
}

export interface ChapterReviewOutput {
  /** One paragraph: what this chapter is about and why it exists in the course. */
  overview: string;
  sections: ReviewSection[];
  keyTerms: Array<{ term: string; meaning: string }>;
  /** Formulas, rules or procedures worth memorising, exactly as the chapter states them. */
  formulas: string[];
  /** Where students of this material usually go wrong. */
  pitfalls: string[];
  /** What to be able to do before the exam, as checkable statements. */
  checklist: string[];
  /** Said out loud when the file turned out not to be teachable material. */
  notes: string[];
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overview', 'sections', 'keyTerms', 'formulas', 'pitfalls', 'checklist', 'notes'],
  properties: {
    overview: {
      type: 'string',
      description: 'One paragraph: what this chapter covers and where it sits in the course.',
    },
    sections: {
      type: 'array', maxItems: 8,
      items: {
        type: 'object', additionalProperties: false, required: ['heading', 'body'],
        properties: {
          heading: { type: 'string', description: 'The idea, named as the chapter names it.' },
          body: { type: 'string', description: 'Two to five sentences explaining it, not listing it.' },
        },
      },
    },
    keyTerms: {
      type: 'array', maxItems: 12,
      items: {
        type: 'object', additionalProperties: false, required: ['term', 'meaning'],
        properties: {
          term: { type: 'string' },
          meaning: { type: 'string', description: 'One sentence, in the sense this course uses.' },
        },
      },
    },
    formulas: {
      type: 'array', maxItems: 10, items: { type: 'string' },
      description: 'Exactly as the chapter states them. Empty when the subject has none.',
    },
    pitfalls: {
      type: 'array', maxItems: 6, items: { type: 'string' },
      description: 'Specific mistakes, not "revise carefully".',
    },
    checklist: {
      type: 'array', maxItems: 8, items: { type: 'string' },
      description: 'Each one something the student can check they can do.',
    },
    notes: {
      type: 'array', maxItems: 3, items: { type: 'string' },
      description: 'Only when something was wrong with the file — unreadable, or not course material.',
    },
  },
} as const;

/**
 * Agent — Chapter Review.
 *   Input:   one uploaded chapter, plus what this student keeps getting wrong.
 *   Output:  a revision note: the idea, the terms, the formulas, the traps.
 *   Trigger: the student picks a chapter and asks for a review.
 *   Failure: no offline equivalent — nothing in the database knows what is
 *            inside the file, so there is nothing to compute instead.
 *
 * Written from the chapter and nothing else. A review that quietly supplies
 * material the lecturer never set is worse than a short one: the student
 * revises the wrong thing and has no way to notice.
 */
export const chapterReview: AgentDefinition<ChapterReviewInput, ChapterReviewOutput> = {
  name: 'Chapter Review',
  trigger: 'chapter_review_requested',
  workflow: 'workflow_g_chapter_review',
  describe: 'Turns one uploaded chapter into a revision note: ideas, terms, formulas and traps.',

  async run(input) {
    const weak = input.weakTopics?.length
      ? `This student has been getting these topics wrong: ${input.weakTopics.join(', ')}. `
        + 'Where the chapter touches them, explain more slowly and say what the usual error is.'
      : '';

    return callStructured<ChapterReviewOutput>({
      system: systemFor(
        'You are the Chapter Review agent. You are given one chapter of course material and you '
        + 'write the revision note a good student would write after reading it properly.\n\n'
        + 'Work only from the attached material. Do not add topics the chapter does not cover, do '
        + 'not import a standard treatment of the subject from elsewhere, and do not fill a thin '
        + 'chapter out to look complete — a short honest review is useful and an invented one is '
        + 'not, because the student cannot tell which parts came from their lecturer.\n\n'
        + 'Explain rather than list. A heading followed by three words is a contents page, and the '
        + 'student already has the slides; what they do not have is the connective tissue between '
        + 'them, so each section says what the idea means and why it matters here.\n\n'
        + 'Copy formulas, definitions and notation exactly as the chapter writes them, including '
        + 'the symbols it chose, because an exam is marked against the course’s conventions '
        + 'rather than the subject’s most common ones.\n\n'
        + 'If the file is not teachable material — an admin form, a blank scan, an unreadable '
        + 'photograph — return empty sections and say so in notes rather than inventing a chapter.',
      ),
      prompt:
        `Course: ${input.courseCode} — ${input.courseName}\n`
        + `Chapter: ${input.chapterTitle}\n\n`
        + `${weak}\n\n`
        + (input.document.kind === 'text'
          ? `The chapter text follows.\n\n${input.document.text.slice(0, 120_000)}`
          : 'Write the revision note for the attached chapter.'),
      schema: SCHEMA,
      schemaName: 'chapter_review',
      maxTokens: 20000,
      effort: 'high',
      documents: input.document.kind === 'text'
        ? []
        : [input.document.kind === 'pdf'
            ? { kind: 'pdf', data: input.document.data }
            : { kind: 'image', mediaType: input.document.mediaType, data: input.document.data }],
    });
  },

  fallback: () => null,

  summariseInput: (i) => `Review of "${i.chapterTitle}" (${i.courseCode})`,
  summariseOutput: (o) =>
    `${o.sections.length} sections, ${o.keyTerms.length} terms, ${o.checklist.length} checklist items`,
};
