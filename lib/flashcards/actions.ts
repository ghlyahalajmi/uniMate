'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/data/queries';
import { flashcardSchema, fieldErrors } from '@/lib/validation/schemas';
import { recordActivity } from '@/lib/momentum/record';
import { localDay } from '@/lib/momentum/record';
import { review } from './scheduler';
import type { ActionState } from '@/lib/data/actions';
import type { Flashcard } from '@/types/database';

const GENERIC: ActionState = { ok: false, messageKey: 'generic' };

export async function saveFlashcard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = formData.get('id') ? String(formData.get('id')) : null;
  const parsed = flashcardSchema.safeParse({
    course_id: formData.get('course_id') ?? '',
    front: formData.get('front') ?? '',
    back: formData.get('back') ?? '',
    topic: formData.get('topic') ?? '',
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  try {
    const supabase = await createClient();
    const userId = await requireUserId();

    if (id) {
      // Editing the wording does not reset the schedule: the card is the same
      // fact, and a typo fix should not throw away five reviews of progress.
      const { error } = await supabase
        .from('flashcards')
        .update(parsed.data)
        .eq('id', id)
        .eq('user_id', userId);
      if (error) return { ok: false, messageKey: 'cardSaveError' };
    } else {
      const { error } = await supabase
        .from('flashcards')
        .insert({ ...parsed.data, user_id: userId, source: 'manual' });
      if (error) return { ok: false, messageKey: 'cardSaveError' };
    }

    revalidatePath('/flashcards');
    return { ok: true, messageKey: 'cardSaved' };
  } catch {
    return GENERIC;
  }
}

export async function deleteFlashcard(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('flashcards').delete().eq('id', id);
    if (error) return GENERIC;
    revalidatePath('/flashcards');
    return { ok: true, messageKey: 'cardDeleted' };
  } catch {
    return GENERIC;
  }
}

/**
 * Moves one card after the student says whether they recalled it.
 *
 * The new box and date are computed by the pure scheduler rather than by the
 * database or the browser, so the same inputs always produce the same
 * schedule and the rules can be unit tested.
 */
export async function reviewFlashcard(
  id: string,
  recalled: boolean,
  timezoneOffsetMinutes?: number,
): Promise<{ ok: boolean; box?: number; dueOn?: string }> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();

    const { data: card } = await supabase
      .from('flashcards')
      .select('id, box, reviews, lapses')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!card) return { ok: false };

    const today = localDay(timezoneOffsetMinutes);
    const next = review(card as Pick<Flashcard, 'box' | 'reviews' | 'lapses'>, recalled, today);

    const { error } = await supabase
      .from('flashcards')
      .update({
        box: next.box,
        due_on: next.dueOn,
        reviews: next.reviews,
        lapses: next.lapses,
        last_reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return { ok: false };
    return { ok: true, box: next.box, dueOn: next.dueOn };
  } catch {
    return { ok: false };
  }
}

/**
 * Closes a review session and books the momentum.
 *
 * A finished deck run is a practice session — the same thing a quiz set is —
 * so it uses the existing counter and XP rule rather than inventing a
 * parallel currency the student would have to learn separately.
 */
export async function completeReviewSession(input: {
  reviewed: number;
  recalled: number;
  timezoneOffsetMinutes?: number;
}): Promise<{ ok: boolean; momentum: Awaited<ReturnType<typeof recordActivity>> }> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();

    const momentum = await recordActivity(
      supabase,
      userId,
      {
        kind: 'practice',
        correctAnswers: Math.max(0, input.recalled),
        questionsAnswered: Math.max(0, input.reviewed),
      },
      { timezoneOffsetMinutes: input.timezoneOffsetMinutes },
    );

    revalidatePath('/flashcards');
    revalidatePath('/momentum');
    revalidatePath('/dashboard');
    return { ok: true, momentum };
  } catch {
    return { ok: false, momentum: null };
  }
}
