'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader } from '@/components/ui/primitives';
import { TextInput, TextArea, Toggle, SegmentedControl } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { saveProfile, type ActionState } from '@/lib/data/actions';
import { AiKeyForm } from './ai-key-form';
import { actionMessage } from '@/lib/i18n/action-messages';
import type { AppLanguage } from '@/types/database';

const EMPTY: ActionState = {};

export function SettingsView({
  profile, ai,
}: {
  profile: {
    fullName: string; university: string; major: string; academicYear: string;
    targetGpa: number | null; studyMinutes: number; availability: string;
    remindersEnabled: boolean; momentumEnabled: boolean;
    boardOptIn: boolean; boardShowName: boolean;
    language: AppLanguage; isDemo: boolean;
  };
  ai: {
    configured: boolean; model: string | null;
    /** Last four characters of the student's own key, when they saved one. */
    keyHint: string | null;
    /** True when the deployment has its own key, so nobody needs to add one. */
    deploymentKey: boolean;
  };
}) {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [reminders, setReminders] = useState(profile.remindersEnabled);
  const [momentum, setMomentum] = useState(profile.momentumEnabled);
  const [boardOptIn, setBoardOptIn] = useState(profile.boardOptIn);
  const [boardName, setBoardName] = useState(profile.boardShowName);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('unimate-theme');
    return stored === 'dark' || stored === 'light' ? stored : 'system';
  });
  const [exporting, setExporting] = useState(false);

  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveProfile(prev, formData);
      if (result.ok) {
        toast.success(actionMessage(t, result.messageKey));
        router.refresh();
      } else {
        toast.error(actionMessage(t, result.messageKey));
      }
      return result;
    },
    EMPTY,
  );

  function applyTheme(next: 'light' | 'dark' | 'system') {
    setTheme(next);
    try {
      if (next === 'system') {
        localStorage.removeItem('unimate-theme');
        document.documentElement.removeAttribute('data-theme');
      } else {
        localStorage.setItem('unimate-theme', next);
        document.documentElement.setAttribute('data-theme', next);
      }
    } catch { /* private mode */ }
  }

  async function exportAll() {
    setExporting(true);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) { toast.error(t.records.exportError); return; }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `unimate-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success(t.records.exportReady);
    } catch {
      toast.error(t.records.exportError);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />

      {profile.isDemo ? (
        <div className="mb-5">
          <Badge tone="warning">{t.common.demoData}</Badge>
        </div>
      ) : null}

      <form action={action} className="space-y-5">
        <Card>
          <CardHeader title={t.settings.profileSection} />
          <div className="space-y-4">
            <TextInput
              label={t.auth.fullName} name="full_name"
              defaultValue={profile.fullName}
              error={state.errors?.full_name}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <TextInput label={t.onboarding.university} name="university" defaultValue={profile.university} />
              <TextInput label={t.onboarding.major} name="major" defaultValue={profile.major} />
            </div>
            <TextInput label={t.onboarding.academicYear} name="academic_year" defaultValue={profile.academicYear} />
          </div>
        </Card>

        <Card>
          <CardHeader title={t.settings.academicSection} />
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <TextInput
                label={t.onboarding.targetGpa} name="target_gpa"
                type="number" step="0.01" min="0" max="5"
                defaultValue={profile.targetGpa ?? ''}
              />
              <TextInput
                label={t.settings.studyBlock} name="preferred_study_minutes"
                type="number" min="5" max="480"
                defaultValue={profile.studyMinutes}
              />
            </div>
            <TextArea
              label={t.onboarding.availability} name="study_availability"
              defaultValue={profile.availability} rows={2}
              placeholder={t.onboarding.availabilityPlaceholder}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title={t.settings.preferencesSection} />
          <div className="space-y-5">
            <div>
              <p className="text-[0.8125rem] font-medium mb-1.5">{t.common.language}</p>
              <SegmentedControl
                label={t.common.language}
                value={locale}
                onChange={(v) => setLocale(v)}
                options={[
                  { value: 'en' as AppLanguage, label: t.common.english },
                  { value: 'ar' as AppLanguage, label: t.common.arabic },
                ]}
              />
              <input type="hidden" name="preferred_language" value={locale} />
            </div>

            <div>
              <p className="text-[0.8125rem] font-medium mb-1.5">{t.settings.theme}</p>
              <SegmentedControl
                label={t.settings.theme}
                value={theme}
                onChange={applyTheme}
                options={[
                  { value: 'light' as const, label: t.settings.light },
                  { value: 'dark' as const, label: t.settings.dark },
                  { value: 'system' as const, label: t.settings.system },
                ]}
              />
              <input type="hidden" name="theme" value={theme} />
            </div>

            <Toggle
              label={t.settings.reminders}
              description={t.settings.remindersSub}
              checked={reminders}
              onChange={setReminders}
            />
            {reminders ? <input type="hidden" name="reminders_enabled" value="on" /> : null}

            <Toggle
              label={t.momentum.enableLabel}
              description={t.momentum.enableSub}
              checked={momentum}
              onChange={setMomentum}
            />
            {momentum ? <input type="hidden" name="momentum_enabled" value="on" /> : null}

            <Toggle
              label={t.momentum.boardOn}
              description={t.momentum.boardOnSub}
              checked={boardOptIn}
              onChange={setBoardOptIn}
            />
            {boardOptIn ? <input type="hidden" name="leaderboard_opt_in" value="on" /> : null}

            {/* Only offered once they are on the board at all — a name toggle
                for a board you are not on would be a control with no effect. */}
            {boardOptIn ? (
              <>
                <Toggle
                  label={t.momentum.boardName}
                  description={t.momentum.boardNameSub}
                  checked={boardName}
                  onChange={setBoardName}
                />
                {boardName ? <input type="hidden" name="leaderboard_show_name" value="on" /> : null}
              </>
            ) : null}
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={pending} loadingLabel={t.common.saving}>
            {t.common.save}
          </Button>
        </div>
      </form>

      <Card className="mt-5">
        <CardHeader title={t.settings.dataSection} subtitle={t.settings.exportSub} />
        <Button variant="secondary" onClick={exportAll} loading={exporting} loadingLabel={t.records.exporting}>
          <Icon.download size={17} />
          {t.settings.exportData}
        </Button>
      </Card>

      {/*
        The student's own AI key, and nothing else.
        --------------------------------------------------------------------
        The roster of agents — what fires each one, which workflow it belongs
        to, what it does without a model — is operations detail. It answered a
        question a student was not asking and buried the one control they
        actually need. It lives on the admin side now.
      */}
      <Card className="mt-5">
        <CardHeader
          title={t.ai.ownKeyTitle}
          subtitle={ai.configured ? `${t.common.ai} · ${ai.model}` : t.ai.unavailableTitle}
          action={
            <Badge tone={ai.configured ? 'positive' : 'warning'}>
              {ai.configured ? t.syllabi.completed : t.common.notSet}
            </Badge>
          }
        />
        {!ai.configured ? (
          <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">{t.ai.unavailableBody}</p>
        ) : null}

        <AiKeyForm savedHint={ai.keyHint} usingDeploymentKey={ai.deploymentKey} />

        <p className="text-xs text-[var(--text-muted)] mt-3">{t.ai.noInvention}</p>
      </Card>
    </>
  );
}
