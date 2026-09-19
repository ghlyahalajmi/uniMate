import { getProfile } from '@/lib/data/queries';
import { getLocale } from '@/lib/i18n/server';
import { isAiConfigured, AI_MODEL } from '@/lib/ai/client';
import { AGENT_REGISTRY } from '@/lib/ai/agents';
import { SettingsView } from '@/components/settings/settings-view';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);

  return (
    <SettingsView
      profile={{
        fullName: profile?.full_name ?? '',
        university: profile?.university ?? '',
        major: profile?.major ?? '',
        academicYear: profile?.academic_year ?? '',
        targetGpa: profile?.target_gpa ?? null,
        studyMinutes: profile?.preferred_study_minutes ?? 45,
        availability: profile?.study_availability ?? '',
        remindersEnabled: profile?.reminders_enabled ?? true,
        language: profile?.preferred_language ?? locale,
        isDemo: Boolean(profile?.is_demo),
      }}
      ai={{
        configured: isAiConfigured(),
        // The model id only; the key itself never reaches the client.
        model: isAiConfigured() ? AI_MODEL : null,
        agents: AGENT_REGISTRY.map((a) => ({ ...a })),
      }}
    />
  );
}
