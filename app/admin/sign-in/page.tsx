import { redirect } from 'next/navigation';
import { isAdmin, adminExists } from '@/lib/admin/queries';
import { AdminSignInForm } from '@/components/admin/admin-sign-in-form';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function AdminSignInPage() {
  // Already an administrator: there is nothing to sign into.
  if (await isAdmin()) redirect('/admin');

  // Nobody has claimed the admin side yet, so the sign-in form has no account
  // to accept. Send them to the one page that can help.
  if (!(await adminExists())) redirect('/admin/first-run');

  return <AdminSignInForm />;
}
