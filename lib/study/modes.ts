/**
 * Practice modes and their sizes.
 *
 * This lives outside `lib/ai` because both sides need it: the agent decides
 * how many questions to ask for, and the setup screen tells the student what
 * they are about to commit to before they start. The agent module is
 * server-only, so a client component cannot import the number from there.
 */

export type PracticeMode = 'quick_5' | 'standard_10' | 'deep_20' | 'exam_mode';
export type RequestedDifficulty = 'easy' | 'medium' | 'hard' | 'adaptive';

export const MODE_SIZES: Record<PracticeMode, number> = {
  quick_5: 5, standard_10: 10, deep_20: 20, exam_mode: 15,
};
