import { redirect } from 'next/navigation';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { AppShell } from '@/components/shell/app-shell';
import { getAvatarUrl } from '@/lib/data/queries';
import { parseAvatar, parseAvatarKind } from '@/lib/avatar/design';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/sign-in');

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_demo, avatar_kind, avatar_path, avatar_design')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <AppShell
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
