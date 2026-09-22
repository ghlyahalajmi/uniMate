import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';
import { cardsFromDocument } from '../fallbacks/study';
import { renderContext, type StudentContext } from '../context';
import type { ReviewDocument } from './chapter-review';

export interface FlashcardInput {
  context: StudentContext;
  courseId: string;
  courseCode: string;
  courseName: string;
  count: number;
  /** The chapter to write from, when the student picked one. */
  document?: ReviewDocument;
  chapterTitle?: string;
  topic?: string;
}

export interface WrittenCard {
  front: string;
  back: string;
  topic: string;
}

export interface FlashcardOutput {
  cards: WrittenCard[];
  rationale: string;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards', 'rationale'],
  properties: {
    rationale: { type: 'string', description: 'One sentence on what this deck covers.' },
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['front', 'back', 'topic'],
        properties: {
          front: { type: 'string', description: 'The prompt. One idea, answerable from memory.' },
          back: { type: 'string', description: 'The answer, as short as it can be and still correct.' },
          topic: { type: 'string', description: 'The part of the course this belongs to.' },
        },
      },
    },
  },
} as const;

/**
 * Agent — Flashcard Writer.
 *   Input:   a course, optionally one of its chapters, and how many cards.
 *   Output:  prompt/answer pairs for the student's deck.
 *   Trigger: the student picks flashcards as their practice style.
 *   Failure: no offline equivalent — writing a good prompt is the work.
 *
 * Separate from the question generator on purpose. A question is answered once
 * and marked; a card is met again in a week and has to still make sense on its
 * own, which changes what a good one looks like: no "which of the following",
 * no context that only exists in the set it came from, and an answer short
 * enough to check against what you just recalled.
 */
export const flashcardWriter: AgentDefinition<FlashcardInput, FlashcardOutput> = {
  name: 'Flashcard Writer',
  trigger: 'user_requested',
  workflow: 'workflow_i_flashcards',
  describe: 'Writes a spaced-repetition deck from a course or one of its chapters.',

  async run(input) {
    return callStructured<FlashcardOutput>({
      system: systemFor(
        'You are the Flashcard Writer. You write cards for spaced repetition, which is a different '
        + 'job from writing quiz questions.\n\n'
        + 'A card is met again weeks later with nothing around it, so each one has to stand alone: '
        + 'no "which of the following", no reference to another card, no phrasing that only makes '
        + 'sense inside the set it came from.\n\n'
        + 'One idea per card. A front that asks two things cannot be marked right or wrong, so the '
        + 'student ends up guessing what counts, and the card teaches them nothing.\n\n'
        + 'Keep the back short enough to check against what they just recalled — a definition, a '
        + 'condition, a formula, a distinction. A paragraph on the back is a card nobody grades '
        + 'honestly.\n\n'
        + 'Prefer the things that are worth knowing cold: definitions the course leans on, the '
        + 'conditions a theorem needs, what a symbol means, which of two similar methods applies '
        + 'when. Skip anything a student would look up rather than memorise.\n\n'
        + 'Use the course’s own terms and notation. An exam is marked against what the '
        + 'lecturer wrote, not against the most common textbook.',
      ),
      prompt: [
        renderContext(input.context, { focusCourseId: input.courseId }),
        '',
        `WRITE: ${input.count} flashcards for ${input.courseCode} — ${input.courseName}.`,
        input.topic ? `Focus on: ${input.topic}.` : '',
        input.document
          ? `The attached chapter${input.chapterTitle ? ` ("${input.chapterTitle}")` : ''} is the `
            + 'material. Write only from what it covers.'
          : '',
        input.document?.kind === 'text'
          ? `\nThe chapter text follows.\n\n${input.document.text.slice(0, 80_000)}`
          : '',
      ].filter(Boolean).join('\n'),
      schema: SCHEMA,
      schemaName: 'flashcard_deck',
      maxTokens: 16000,
      effort: 'medium',
      documents: !input.document || input.document.kind === 'text'
        ? []
        : [input.document.kind === 'pdf'
            ? { kind: 'pdf', data: input.document.data }
            : { kind: 'image', mediaType: input.document.mediaType, data: input.document.data }],
    });
  },

  /*
   * Cards from the definitions the chapter already states, in its words. A
   * card whose back was guessed is worse than no card: it is reviewed for
   * weeks before anyone notices it is wrong.
   */
  fallback: (input) => cardsFromDocument(input),

  summariseInput: (i) => `${i.count} flashcards for ${i.courseCode}`,
  summariseOutput: (o) => `${o.cards.length} cards written`,
};
