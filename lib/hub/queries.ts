import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/data/queries';
import type { HubLink } from '@/types/database';

/** Pinned first, then the student's own order, then oldest first. */
export async function getHubLinks(): Promise<HubLink[]> {
  const supabase = await createClient();
  const userId = await requireUserId();
  const { data } = await supabase
    .from('hub_links')
    .select('*')
    .eq('user_id', userId)
    .order('is_pinned', { ascending: false })
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  return (data as HubLink[]) ?? [];
}
