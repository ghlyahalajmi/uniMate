'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Button, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icons';

type Phase = 'idle' | 'running' | 'done' | 'failed';

/**
 * Starting a workflow, from inside the product.
 *
 * The status is shown where the button is, because the question a person has
 * after pressing it is "is it doing anything" and the answer has to be in the
 * same place as the press. Waiting says waiting, a finish says what it
 * produced, and a failure says the word failed and why — never a spinner that
 * turns forever.
 *
 * `router.refresh()` on success so the run appears in this workflow's own
 * history below without a reload: the page reads `ai_runs`, and the run that
 * just happened is a row in it.
 */
export function RunButton({ workflow }: { workflow: 'reminders' | 'grade-analysis' }) {
  const { t, tf } = useI18n();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setPhase('running');
    setMessage(null);

    try {
      const res = await fetch('/api/automation/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workflow }),
      });
      const data = await res.json();

      if (!data.ok) {
        setPhase('failed');
        setMessage(
          data.error === 'rate_limited' ? tf(t.ai.rateLimited, { n: data.detail ?? '1' })
          : data.error === 'no_active_course' ? t.automation.runNoCourse
          : data.detail || t.automation.runError,
        );
        return;
      }

      setPhase('done');
      setMessage(
        data.workflow === 'reminders'
          ? tf(t.automation.runRemindersDone, { n: String(data.created ?? 0) })
          : tf(t.automation.runGradeDone, { course: data.course ?? '—', verdict: data.verdict ?? '' }),
      );
      router.refresh();
    } catch {
      setPhase('failed');
      setMessage(t.errors.network);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void run()} loading={phase === 'running'}>
          <Icon.sparkle size={15} />
          {t.automation.runNow}
        </Button>

        {phase !== 'idle' ? (
          <span
            role="status"
            className={cx(
              'inline-flex items-center gap-1.5 text-xs font-medium',
              phase === 'running' && 'text-[var(--text-muted)]',
              phase === 'done' && 'text-[var(--positive)]',
              phase === 'failed' && 'text-[var(--danger)]',
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                'w-1.5 h-1.5 rounded-full',
                phase === 'running' && 'bg-[var(--warning)] animate-pulse',
                phase === 'done' && 'bg-[var(--positive)]',
                phase === 'failed' && 'bg-[var(--danger)]',
              )}
            />
            {phase === 'running' ? t.automation.runWaiting
              : phase === 'done' ? t.automation.runDone
              : t.automation.runFailed}
          </span>
        ) : null}
      </div>

      {message ? (
        <p className="text-[0.8125rem] text-[var(--text-secondary)] leading-relaxed mt-2">
          {message}
        </p>
      ) : null}
    </div>
  );
}
