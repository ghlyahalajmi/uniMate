import { redirect } from 'next/navigation';
import { adminExists } from '@/lib/admin/queries';
import { AdminFirstRunForm } from '@/components/admin/admin-first-run-form';

export const metadata = { title: 'First run' };
export const dynamic = 'force-dynamic';

/**
 * Claiming the admin side.
 *
 * Reachable only while no administrator exists — and the database refuses the
 * claim independently, so this redirect is the courtesy rather than the lock.
 */
export default async function AdminFirstRunPage() {
  if (await adminExists()) redirect('/admin/sign-in');
  return <AdminFirstRunForm />;
}
