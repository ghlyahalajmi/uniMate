'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, CardHeader } from '@/components/ui/primitives';
import { AiThinking, AiUnavailable, Provenance } from '@/components/ui/states';
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
  const [unavailable, setUnavailable] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    setUnavailable(false);
    try {
      const res = await fetch('/api/ai/insight', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setInsight({ fact: data.fact, suggestion: data.suggestion, source: data.source });
      } else if (data.error === 'ai_not_configured') {
        setUnavailable(true);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (unavailable) {
    return <AiUnavailable title={t.ai.unavailableTitle} body={t.ai.unavailableBody} />;
  }

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
