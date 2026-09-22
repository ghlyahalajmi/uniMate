'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button } from '@/components/ui/primitives';
import { TextInput } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { saveAiKey, clearAiKey } from '@/lib/data/actions';
import { actionMessage } from '@/lib/i18n/action-messages';

/**
 * Where a student switches the AI features on for their own account.
 *
 * Until this existed, "AI features are not configured" could only be answered
 * by whoever deploys UniMate. A student can now paste a key of their own —
 * OpenRouter's free tier costs nothing — and every agent turns on for them.
 *
 * The field is a password field and the key is sent straight to a server
 * action: it is never put in a URL, never held in a form that survives the
 * page, and never read back. What comes back is the last four characters.
 */
export function AiKeyForm({
  savedHint, usingDeploymentKey,
}: {
  savedHint: string | null;
  usingDeploymentKey: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [key, setKey] = useState('');
  const [pending, start] = useTransition();

  const submit = () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    start(async () => {
      const result = await saveAiKey({ provider: 'openrouter', key: trimmed });
      const message = actionMessage(t, result.messageKey);
      if (result.ok) toast.success(message);
      else toast.error(message);
      if (result.ok) {
        setKey('');
        router.refresh();
      }
    });
  };

  const remove = () => {
    start(async () => {
      const result = await clearAiKey();
      const message = actionMessage(t, result.messageKey);
      if (result.ok) toast.success(message);
      else toast.error(message);
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4 mb-4">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <h3 className="text-sm font-semibold">{t.ai.ownKeyTitle}</h3>
        {savedHint ? <Badge tone="positive">{t.ai.ownKeySaved}</Badge> : null}
      </div>

      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">
        {usingDeploymentKey ? t.ai.ownKeyNotNeeded : t.ai.ownKeyBody}
      </p>

      {savedHint ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-[var(--text-muted)] font-mono">
            {t.ai.ownKeyEnding} ····{savedHint}
          </span>
          <Button variant="secondary" onClick={remove} loading={pending}>
            {t.ai.ownKeyRemove}
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="grow min-w-[220px]">
            <TextInput
              name="aiKey"
              type="password"
              label={t.ai.ownKeyLabel}
              placeholder="sk-or-v1-…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button onClick={submit} loading={pending} disabled={!key.trim()}>
            {t.ai.ownKeySave}
          </Button>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">
        {t.ai.ownKeyPrivacy}{' '}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
        >
          openrouter.ai/keys
        </a>
      </p>
    </div>
  );
}
