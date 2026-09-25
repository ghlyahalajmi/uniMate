import { redirect } from 'next/navigation';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { AppShell } from '@/components/shell/app-shell';
import { getAvatarUrl } from '@/lib/data/queries';
import { parseAvatar, parseAvatarKind } from '@/lib/avatar/design';
import { getStreakSummary } from '@/lib/momentum/queries';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/sign-in');

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_demo, avatar_kind, avatar_path, avatar_design, momentum_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  /*
   * The streak is read here, once, for every page in the app — so the figure
   * in the bar is the same figure on Home, on Momentum and on the board,
   * rather than each screen counting for itself. A student who has switched
   * Momentum off gets no chip, and a read that fails costs the chip, never
   * the page.
   */
  const streak = (profile?.momentum_enabled ?? true)
    ? await getStreakSummary().catch(() => null)
    : null;

  return (
    <AppShell
      streak={streak}
      user={{
        name: profile?.full_name ?? null,
        email: user.email ?? '',
        isDemo: Boolean(profile?.is_demo),
        avatarKind: parseAvatarKind(profile?.avatar_kind),
        avatarDesign: parseAvatar(profile?.avatar_design),
        avatarUrl: await getAvatarUrl(profile?.avatar_path ?? null),
      }}
    >
      {children}
    </AppShell>
  );
}
