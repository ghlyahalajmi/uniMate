'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card } from '@/components/ui/primitives';
import { TextInput } from '@/components/ui/form';
import {
  signInAction, signUpAction, signInDemoAction,
  requestResetAction, updatePasswordAction, type AuthState,
} from '@/app/auth/actions';

const EMPTY: AuthState = {};

/** Error keys come back from the server action; the copy lives in the dictionary. */
function useAuthCopy() {
  const { t } = useI18n();
  return (key: string | undefined): string | undefined => {
    if (!key) return undefined;
    const table = t.auth as unknown as Record<string, string | undefined>;
    return table[key] ?? t.errors.generic;
  };
}

function FormBanner({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'text-sm rounded-[var(--radius-sm)] px-3 py-2.5 bg-[var(--danger-soft)] border border-[var(--danger-border)] text-[var(--danger)]'
          : 'text-sm rounded-[var(--radius-sm)] px-3 py-2.5 bg-[var(--positive-soft)] border border-[var(--positive-border)] text-[var(--positive)]'
      }
    >
      {children}
    </p>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const copy = useAuthCopy();
  const [state, action, pending] = useActionState(signInAction, EMPTY);

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h1 className="font-display text-2xl font-semibold">{t.auth.signInTitle}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5">{t.auth.signInSub}</p>

        <form action={action} className="mt-6 space-y-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {state.message ? <FormBanner tone="error">{copy(state.message)}</FormBanner> : null}

          <TextInput
            label={t.auth.email} name="email" type="email" autoComplete="email"
            required error={state.errors?.email ? copy(state.errors.email) : undefined}
          />
          <TextInput
            label={t.auth.password} name="password" type="password" autoComplete="current-password"
            required error={state.errors?.password ? copy(state.errors.password) : undefined}
          />

          <Button type="submit" fullWidth size="lg" loading={pending} loadingLabel={t.auth.signingIn}>
            {t.auth.signIn}
          </Button>
        </form>

        <div className="flex items-center justify-between mt-5 text-sm">
          <Link href="/auth/reset" className="inline-flex items-center min-h-[32px] text-[var(--accent-soft-text)] hover:underline">
            {t.auth.forgotPassword}
          </Link>
          <span className="text-[var(--text-secondary)]">
            {t.auth.noAccount}{' '}
            <Link href="/auth/sign-up" className="inline-flex items-center min-h-[32px] text-[var(--accent-soft-text)] hover:underline font-medium">
              {t.auth.signUp}
            </Link>
          </span>
        </div>
      </Card>

      <DemoCard />
    </div>
  );
}

export function SignUpForm() {
  const { t } = useI18n();
  const copy = useAuthCopy();
  const [state, action, pending] = useActionState(signUpAction, EMPTY);

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h1 className="font-display text-2xl font-semibold">{t.auth.signUpTitle}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5">{t.auth.signUpSub}</p>

        <form action={action} className="mt-6 space-y-4">
          {state.success && state.message ? (
            <FormBanner tone="success">{copy(state.message)}</FormBanner>
          ) : state.message ? (
            <FormBanner tone="error">{copy(state.message)}</FormBanner>
          ) : null}

          <TextInput
            label={t.auth.fullName} name="full_name" autoComplete="name"
            required error={state.errors?.full_name ? copy(state.errors.full_name) : undefined}
          />
          <TextInput
            label={t.auth.email} name="email" type="email" autoComplete="email"
            required error={state.errors?.email ? copy(state.errors.email) : undefined}
          />
          <TextInput
            label={t.auth.password} name="password" type="password" autoComplete="new-password"
            required minLength={8}
            error={state.errors?.password ? copy(state.errors.password) : undefined}
          />
          <TextInput
            label={t.auth.confirmPassword} name="confirmPassword" type="password" autoComplete="new-password"
            required error={state.errors?.confirmPassword ? copy(state.errors.confirmPassword) : undefined}
          />

          <Button type="submit" fullWidth size="lg" loading={pending} loadingLabel={t.auth.signingUp}>
            {t.auth.signUp}
          </Button>
        </form>

        <p className="text-sm text-[var(--text-secondary)] mt-5 text-center">
          {t.auth.hasAccount}{' '}
          <Link href="/auth/sign-in" className="inline-flex items-center min-h-[32px] text-[var(--accent-soft-text)] hover:underline font-medium">
            {t.auth.signIn}
          </Link>
        </p>
      </Card>

      <DemoCard />
    </div>
  );
}

function DemoCard() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(
    async () => signInDemoAction(),
    EMPTY,
  );

  return (
    <Card className="bg-[var(--bg-accent-soft)] border-[var(--border-subtle)]">
      <h2 className="text-sm font-semibold">{t.auth.demoTitle}</h2>
      <p className="text-[0.8125rem] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
        {t.auth.demoBody}
      </p>
      {state.message ? (
        <p role="alert" className="text-xs text-[var(--danger)] mt-2">{t.errors.generic}</p>
      ) : null}
      <form action={action}>
        <Button type="submit" variant="secondary" size="sm" className="mt-3" loading={pending}>
          {t.auth.demoButton}
        </Button>
      </form>
    </Card>
  );
}

export function ResetForm() {
  const { t } = useI18n();
  const copy = useAuthCopy();
  const [state, action, pending] = useActionState(requestResetAction, EMPTY);

  return (
    <Card className="p-6">
      <h1 className="font-display text-2xl font-semibold">{t.auth.resetTitle}</h1>
      <p className="text-sm text-[var(--text-secondary)] mt-1.5">{t.auth.resetSub}</p>

      <form action={action} className="mt-6 space-y-4">
        {state.success ? <FormBanner tone="success">{t.auth.resetSent}</FormBanner> : null}
        <TextInput
          label={t.auth.email} name="email" type="email" autoComplete="email"
          required error={state.errors?.email ? copy(state.errors.email) : undefined}
        />
        <Button type="submit" fullWidth size="lg" loading={pending}>{t.auth.resetSend}</Button>
      </form>

      <p className="text-sm text-center mt-5">
        <Link href="/auth/sign-in" className="inline-flex items-center min-h-[32px] text-[var(--accent-soft-text)] hover:underline">
          {t.auth.signIn}
        </Link>
      </p>
    </Card>
  );
}

export function UpdatePasswordForm() {
  const { t } = useI18n();
  const copy = useAuthCopy();
  const [state, action, pending] = useActionState(updatePasswordAction, EMPTY);

  return (
    <Card className="p-6">
      <h1 className="font-display text-2xl font-semibold">{t.auth.newPasswordTitle}</h1>

      <form action={action} className="mt-6 space-y-4">
        {state.success ? (
          <FormBanner tone="success">{t.auth.passwordUpdated}</FormBanner>
        ) : state.message ? (
          <FormBanner tone="error">{copy(state.message)}</FormBanner>
        ) : null}

        <TextInput
          label={t.auth.newPassword} name="password" type="password" autoComplete="new-password"
          required minLength={8}
          error={state.errors?.password ? copy(state.errors.password) : undefined}
        />
        <Button type="submit" fullWidth size="lg" loading={pending}>{t.auth.updatePassword}</Button>
      </form>

      {state.success ? (
        <p className="text-sm text-center mt-5">
          <Link href="/dashboard" className="inline-flex items-center min-h-[32px] text-[var(--accent-soft-text)] hover:underline font-medium">
            {t.nav.dashboard}
          </Link>
        </p>
      ) : null}
    </Card>
  );
}
