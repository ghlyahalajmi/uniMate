import { SignInForm } from '@/components/auth/auth-forms';

export const metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; suspended?: string }>;
}) {
  const { next, suspended } = await searchParams;
  // Middleware signs a suspended account out on its next request. Landing back
  // on sign-in with no explanation would read as the password being wrong.
  return <SignInForm next={next} suspended={suspended === '1'} />;
}
