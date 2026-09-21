import { redirect } from 'next/navigation';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { AppShell } from '@/components/shell/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/sign-in');

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_demo')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <AppShell
      user={{
        name: profile?.full_name ?? null,
        email: user.email ?? '',
        isDemo: Boolean(profile?.is_demo),
      }}
    >
      {children}
    </AppShell>
  );
}
