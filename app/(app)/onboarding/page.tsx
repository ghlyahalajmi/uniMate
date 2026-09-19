import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/data/queries';
import { getLocale } from '@/lib/i18n/server';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const metadata = { title: 'Set up UniMate' };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (profile?.onboarding_completed) redirect('/dashboard');

  const locale = await getLocale();

  return (
    <OnboardingFlow
      initial={{
        fullName: profile?.full_name ?? '',
        university: profile?.university ?? '',
        major: profile?.major ?? '',
        academicYear: profile?.academic_year ?? '',
        targetGpa: profile?.target_gpa ?? null,
        studyMinutes: profile?.preferred_study_minutes ?? 45,
        availability: profile?.study_availability ?? '',
        language: locale,
      }}
    />
  );
}
