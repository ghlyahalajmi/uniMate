'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, CardHeader } from '@/components/ui/primitives';
import { AiThinking, Provenance } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';

interface Insight { fact: string; suggestion: string; source: 'ai' | 'fallback' }

/**
 * The dashboard's one AI insight. It separates the recorded fact from the
 * suggestion visually, so a student never reads a recommendation as if the
 * university had issued it.
 */
export function InsightPanel() {
  const { t } = useI18n();
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  /** Pure fetch. No state is touched here, so the caller owns cancellation. */
  const fetchInsight = useCallback(async () => {
    const res = await fetch('/api/ai/insight', { method: 'POST' });
    return res.json() as Promise<{ ok: boolean; error?: string; fact: string; suggestion: string; source: 'ai' | 'fallback' }>;
  }, []);

  const apply = useCallback((data: Awaited<ReturnType<typeof fetchInsight>> | null) => {
    if (data?.ok) {
      setInsight({ fact: data.fact, suggestion: data.suggestion, source: data.source });
    } else {
      setFailed(true);
    }
    setLoading(false);
  }, []);

  /** Manual retry from the button. */
  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      apply(await fetchInsight());
    } catch {
      setFailed(true);
      setLoading(false);
    }
  }, [apply, fetchInsight]);

  // On mount the component already starts in its loading state, so nothing is
  // set synchronously here; and a result arriving after unmount is dropped.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchInsight();
        if (!cancelled) apply(data);
      } catch {
        if (!cancelled) { setFailed(true); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [apply, fetchInsight]);

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Icon.sparkle size={18} className="text-[var(--accent)]" />
            {t.dashboard.aiInsight}
          </span>
        }
        action={
          !loading ? (
            <Button variant="ghost" size="sm" onClick={load} aria-label={t.dashboard.regenerate}>
              <Icon.sparkle size={15} />
            </Button>
          ) : null
        }
      />

      {loading ? (
        <AiThinking stages={[t.ai.checkingDeadlines, t.ai.retrievingContext]} className="py-2" />
      ) : failed ? (
        <div>
          <p className="text-sm text-[var(--text-secondary)]">{t.errors.generic}</p>
          <Button variant="secondary" size="sm" onClick={load} className="mt-3">
            {t.common.retry}
          </Button>
        </div>
      ) : insight ? (
        <div className="space-y-2.5">
          <Provenance kind="fact" label={t.ai.factLabel}>{insight.fact}</Provenance>
          <Provenance kind="suggestion" label={t.ai.suggestionLabel}>{insight.suggestion}</Provenance>
          {insight.source === 'fallback' ? (
            <p className="text-xs text-[var(--text-muted)]">{t.ai.noInvention}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">{t.dashboard.insightPending}</p>
      )}
    </Card>
  );
}
