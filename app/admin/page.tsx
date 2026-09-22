import { redirect } from 'next/navigation';
import { isAdmin, listUsers, aiSummary, currentAdmin } from '@/lib/admin/queries';
import { AGENT_REGISTRY } from '@/lib/ai/agents';
import { AdminUsersView } from '@/components/admin/admin-users-view';

export const metadata = { title: 'Accounts' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // The page guard. The data guard is in the database, which refuses these
  // functions to anyone who is not an administrator regardless of this line.
  if (!(await isAdmin())) redirect('/admin/sign-in');

  const [users, summary, me] = await Promise.all([listUsers(), aiSummary(), currentAdmin()]);

  return (
    <AdminUsersView
      users={users}
      summary={summary}
      username={me?.username ?? ''}
      agents={AGENT_REGISTRY.map((a) => ({ ...a, why: 'why' in a ? a.why : null }))}
    />
  );
}
