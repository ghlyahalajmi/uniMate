'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, ProgressBar, cx } from '@/components/ui/primitives';
import { TextInput, TextArea, Select, SegmentedControl } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { UniMateMark } from '@/components/brand/logo';
import { Icon } from '@/components/shell/icons';
import { completeOnboarding } from '@/lib/data/actions';
import type { AppLanguage } from '@/types/database';

interface Initial {
  fullName: string; university: string; major: string; academicYear: string;
  targetGpa: number | null; studyMinutes: number; availability: string;
  language: AppLanguage;
}

const TOTAL = 4;

export function OnboardingFlow({ initial }: { initial: Initial }) {
  const { t, tf } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initial);
  const [route, setRoute] = useState<'scan' | 'manual' | 'later'>('scan');

  function set<K extends keyof Initial>(key: K, value: Initial[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function finish() {
    startTransition(async () => {
      const result = await completeOnboarding({
        full_name: form.fullName.trim(),
        university: form.university.trim() || null,
        major: form.major.trim() || null,
        academic_year: form.academicYear.trim() || null,
        target_gpa: form.targetGpa,
        preferred_study_minutes: form.studyMinutes,
        study_availability: form.availability.trim() || null,
        preferred_language: form.language,
      });

      if (!result.ok) { toast.error(t.errors.generic); return; }

      router.push(route === 'scan' ? '/courses/scan' : route === 'manual' ? '/courses?new=1' : '/dashboard');
      router.refresh();
    });
  }

  const canAdvance = step === 1 ? form.fullName.trim().length > 0 : true;

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-6">
        <UniMateMark size={44} className="mx-auto mb-3" />
        <h1 className="font-display text-2xl font-semibold">{t.onboarding.title}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5">
          {tf(t.onboarding.stepOf, { n: step, total: TOTAL })}
        </p>
      </div>

      <ProgressBar value={step} max={TOTAL} label={t.onboarding.title} className="mb-6" />

      <Card>
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold">{t.onboarding.s1Title}</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{t.onboarding.s1Sub}</p>
            </div>
            <TextInput
              label={t.auth.fullName} required
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              autoComplete="name"
            />
            <TextInput
              label={t.onboarding.university}
              value={form.university}
              onChange={(e) => set('university', e.target.value)}
              placeholder="Kuwait University"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <TextInput
                label={t.onboarding.major}
                value={form.major}
                onChange={(e) => set('major', e.target.value)}
                placeholder="Computer Engineering"
              />
              <TextInput
                label={t.onboarding.academicYear}
                value={form.academicYear}
                onChange={(e) => set('academicYear', e.target.value)}
                placeholder="Year 3"
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold">{t.onboarding.s2Title}</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{t.onboarding.s2Sub}</p>
            </div>
            <ul className="space-y-2.5">
              {([
                { key: 'scan' as const, icon: 'camera' as const, title: t.onboarding.optUpload, body: t.onboarding.optUploadBody },
                { key: 'manual' as const, icon: 'plus' as const, title: t.onboarding.optManual, body: t.onboarding.optManualBody },
                { key: 'later' as const, icon: 'clock' as const, title: t.onboarding.optLater, body: t.onboarding.optLaterBody },
              ]).map((o) => {
                const Glyph = Icon[o.icon];
                const selected = route === o.key;
                return (
                  <li key={o.key}>
                    <button
                      type="button"
                      onClick={() => setRoute(o.key)}
                      aria-pressed={selected}
                      className={cx(
                        'w-full text-start flex items-start gap-3 p-4 rounded-[var(--radius-md)] border transition-colors',
                        selected
                          ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)]'
                          : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cx(
                          'w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] shrink-0',
                          selected ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-inset)] text-[var(--text-secondary)]',
                        )}
                      >
                        <Glyph size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{o.title}</span>
                        <span className="block text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{o.body}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold">{t.onboarding.s3Title}</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{t.onboarding.s3Sub}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <TextInput
                label={t.onboarding.targetGpa}
                type="number" step="0.01" min="0" max="5"
                value={form.targetGpa ?? ''}
                onChange={(e) => set('targetGpa', e.target.value === '' ? null : Number(e.target.value))}
                placeholder="3.50"
              />
              <Select
                label={t.onboarding.studyPreference}
                options={[25, 30, 45, 60, 90].map((m) => ({ value: String(m), label: `${m} ${t.common.minutes}` }))}
                value={String(form.studyMinutes)}
                onChange={(e) => set('studyMinutes', Number(e.target.value))}
              />
            </div>
            <TextArea
              label={t.onboarding.availability}
              value={form.availability}
              onChange={(e) => set('availability', e.target.value)}
              placeholder={t.onboarding.availabilityPlaceholder}
              rows={2}
            />
            <div>
              <p className="text-[0.8125rem] font-medium mb-1.5">{t.common.language}</p>
              <SegmentedControl
                label={t.common.language}
                value={form.language}
                onChange={(v) => set('language', v)}
                options={[
                  { value: 'en' as AppLanguage, label: t.common.english },
                  { value: 'ar' as AppLanguage, label: t.common.arabic },
                ]}
              />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="text-center py-4">
            <span
              aria-hidden="true"
              className="w-14 h-14 mx-auto rounded-full grid place-items-center bg-[var(--positive-soft)] text-[var(--positive)] mb-4"
            >
              <Icon.check size={26} />
            </span>
            <h2 className="font-display text-xl font-semibold">{t.onboarding.s4Title}</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-2">{t.onboarding.s4Body}</p>
            <p className="text-xs text-[var(--text-muted)] mt-4 max-w-sm mx-auto leading-relaxed">
              {t.ai.noInvention}
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 mt-6 pt-5 border-t border-[var(--border-subtle)]">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={pending}>
              {t.common.back}
            </Button>
          ) : (
            <Link
              href="/dashboard"
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2"
            >
              {t.onboarding.skip}
            </Link>
          )}

          {step < TOTAL ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              {t.common.next}
              <Icon.chevronEnd size={16} className="flip-rtl" />
            </Button>
          ) : (
            <Button onClick={finish} loading={pending} loadingLabel={t.common.saving}>
              {t.onboarding.s4Go}
              <Icon.chevronEnd size={16} className="flip-rtl" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
