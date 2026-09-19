'use client';

import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button } from '@/components/ui/primitives';
import { UniMateMark } from '@/components/brand/logo';

/**
 * Human-readable only. The technical detail goes to the console for a
 * developer, never onto the screen for a student.
 */
export default function GlobalError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error('[unimate]', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="text-center max-w-sm">
        <UniMateMark size={48} className="mx-auto mb-5" />
        <h1 className="font-display text-2xl font-semibold">{t.errors.generic}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2">{t.errors.network}</p>
        <Button onClick={reset} className="mt-6">{t.common.retry}</Button>
      </div>
    </div>
  );
}
