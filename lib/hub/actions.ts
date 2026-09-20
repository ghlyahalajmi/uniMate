'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/data/queries';
import { hubLinkSchema, fieldErrors } from '@/lib/validation/schemas';
import type { ActionState } from '@/lib/data/actions';

const GENERIC: ActionState = { ok: false, messageKey: 'generic' };

export async function saveHubLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = formData.get('id') ? String(formData.get('id')) : null;
  const parsed = hubLinkSchema.safeParse({
    title: formData.get('title') ?? '',
    url: formData.get('url') ?? '',
    description: formData.get('description') ?? '',
    kind: formData.get('kind') ?? 'resource',
    is_pinned: formData.get('is_pinned') === 'on',
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  try {
    const supabase = await createClient();
    const userId = await requireUserId();

    if (id) {
      const { error } = await supabase
        .from('hub_links')
        .update(parsed.data)
        .eq('id', id)
        .eq('user_id', userId);
      if (error) return { ok: false, messageKey: 'linkSaveError' };
    } else {
      // New links land at the end of their group rather than the top, so the
      // order the student arranged does not shuffle every time they add one.
      const { data: last } = await supabase
        .from('hub_links')
        .select('position')
        .eq('user_id', userId)
        .eq('kind', parsed.data.kind)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase.from('hub_links').insert({
        ...parsed.data,
        user_id: userId,
        position: (last?.position ?? 0) + 1,
      });
      if (error) return { ok: false, messageKey: 'linkSaveError' };
    }

    revalidatePath('/hub');
    return { ok: true, messageKey: 'linkSaved' };
  } catch {
    return GENERIC;
  }
}

export async function deleteHubLink(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('hub_links').delete().eq('id', id);
    if (error) return GENERIC;
    revalidatePath('/hub');
    return { ok: true, messageKey: 'linkDeleted' };
  } catch {
    return GENERIC;
  }
}

export async function toggleHubPin(id: string, pinned: boolean): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();
    const { error } = await supabase
      .from('hub_links')
      .update({ is_pinned: pinned })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return GENERIC;
    revalidatePath('/hub');
    return { ok: true };
  } catch {
    return GENERIC;
  }
}
