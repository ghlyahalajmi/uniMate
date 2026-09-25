import { getProfile, getAvatarUrl } from '@/lib/data/queries';
import { getCurrentUser } from '@/lib/supabase/server';
import { parseAvatar, parseAvatarKind, initialsFrom } from '@/lib/avatar/design';
import { AvatarPicker } from '@/components/avatar/avatar-picker';
import { getLocale } from '@/lib/i18n/server';
import { isAiConfigured, aiProvider, modelNameFor, deploymentProvider } from '@/lib/ai/client';
import { studentKeyHint } from '@/lib/ai/credentials';
import { SettingsView } from '@/components/settings/settings-view';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [profile, locale, user, aiOn, provider, ownKey] = await Promise.all([
    getProfile(), getLocale(), getCurrentUser(), isAiConfigured(), aiProvider(),
    studentKeyHint(),
  ]);
  const photoUrl = await getAvatarUrl(profile?.avatar_path ?? null);

  return (
    <>
      {/* The picture sits above the form: it is the part of a profile people
          come to change, and it was the only part with nowhere to change it. */}
      <div className="mb-5">
        <AvatarPicker
          initialKind={parseAvatarKind(profile?.avatar_kind)}
          initialDesign={parseAvatar(profile?.avatar_design)}
          photoUrl={photoUrl}
          initials={initialsFrom(profile?.full_name ?? null, user?.email ?? '')}
        />
      </div>

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
        momentumEnabled: profile?.momentum_enabled ?? true,
        boardOptIn: profile?.leaderboard_opt_in ?? true,
        boardShowName: profile?.leaderboard_show_name ?? false,
        language: profile?.preferred_language ?? locale,
        isDemo: Boolean(profile?.is_demo),
      }}
      // Public by design — it is handed to every browser that subscribes.
      pushPublicKey={process.env.VAPID_PUBLIC_KEY ?? null}
      ai={{
        configured: aiOn,
        // The model id only; the key itself never reaches the client.
        model: aiOn ? modelNameFor(provider) : null,
        // Four characters, read from a generated column — enough to recognise
        // the key you saved, useless to anyone who reads it off the page.
        keyHint: ownKey?.hint ?? null,
        deploymentKey: deploymentProvider() !== null,
      }}
    />
    </>
  );
}
