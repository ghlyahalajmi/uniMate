'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/data/queries';

/**
 * Show or hide your name on the streak board, from the board itself.
 *
 * The same setting lives in Settings, but a privacy choice is most likely to
 * be made at the moment you are looking at what it affects, so it is offered
 * here too rather than only two screens away.
 */
export async function setBoardNameVisible(visible: boolean): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();
    const { error } = await supabase
      .from('profiles')
      .update({ leaderboard_show_name: visible })
      .eq('user_id', userId);
    if (error) return { ok: false };

    revalidatePath('/student-hub');
    revalidatePath('/settings');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
