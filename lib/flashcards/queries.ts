import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/data/queries';
import { deckMastery, isDue } from './scheduler';
import type { Flashcard } from '@/types/database';

export interface DeckSummary {
  cards: Flashcard[];
  total: number;
  due: number;
  /** 0–1, weighted by how far each card has climbed. */
  mastery: number;
  /** Count per Leitner box, index 0 = box 1. */
  boxes: number[];
}

/**
 * The whole deck, not just what is due.
 *
 * A student's deck is at most a few hundred cards, so paging it would add
 * complexity for no gain — and the screen needs the full set anyway to show
 * the box distribution and let them browse what they have written.
 */
export async function getDeck(todayIso: string, courseId?: string): Promise<DeckSummary> {
  const supabase = await createClient();
  const userId = await requireUserId();

  let q = supabase
    .from('flashcards')
    .select('*')
    .eq('user_id', userId)
    .order('due_on', { ascending: true })
    .order('created_at', { ascending: false });

  if (courseId) q = q.eq('course_id', courseId);

  const { data } = await q;
  const cards = (data as Flashcard[]) ?? [];
  const boxes = [0, 0, 0, 0, 0];
  for (const c of cards) boxes[Math.min(Math.max(c.box, 1), 5) - 1] += 1;

  return {
    cards,
    total: cards.length,
    due: cards.filter((c) => isDue(c.due_on, todayIso)).length,
    mastery: deckMastery(cards.map((c) => c.box)),
    boxes,
  };
}
