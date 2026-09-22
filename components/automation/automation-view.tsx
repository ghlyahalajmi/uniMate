'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import type { AiRunStatus } from '@/types/database';

export interface RunRow {
  id: string;
  workflow: string | null;
  agent: string;
  status: AiRunStatus;
  trigger: string;
  outputSummary: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: string;
}

/**
 * The five workflows, in the order they occur in a semester rather than
 * alphabetically: you scan a timetable, then a syllabus, then grades arrive,
 * then an exam approaches, then you practise for it.
 *
 * `key` matches the value written to ai_runs.workflow, which is what lets this
 * screen show real runs rather than a description of what should happen.
 */
const WORKFLOWS = [
  { letter: 'A', key: 'workflow_a_schedule_scan', endpoint: null },
  { letter: 'B', key: 'workflow_b_syllabus_processing', endpoint: null },
  { letter: 'C', key: 'workflow_c_grade_analysis', endpoint: 'grade-analysis' },
  { letter: 'D', key: 'workflow_d_upcoming_exam', endpoint: 'reminders' },
  { letter: 'E', key: 'workflow_e_study_questions', endpoint: null },
] as const;

export function AutomationView({
  webhooksEnabled, runs,
}: {
  webhooksEnabled: boolean;
  runs: RunRow[];
}) {
  const { t, tf, formatNumber, formatDate } = useI18n();
  const [open, setOpen] = useState<string | null>(null);

  const byWorkflow = useMemo(() => {
    const map = new Map<string, RunRow[]>();
    for (const r of runs) {
      if (!r.workflow) continue;
      const list = map.get(r.workflow) ?? [];
      list.push(r);
      map.set(r.workflow, list);
    }
    return map;
  }, [runs]);

  const copy = (letter: string) => {
    const key = letter.toLowerCase() as 'a' | 'b' | 'c' | 'd' | 'e';
    return {
      title: t.automation[`${key}Title`],
      trigger: t.automation[`${key}Trigger`],
      output: t.automation[`${key}Output`],
    };
  };

  return (
    <>
      <PageHeader title={t.automation.title} subtitle={t.automation.subtitle} />

      <div className="space-y-4">
        <ol className="space-y-3">
          {WORKFLOWS.map((w, i) => {
            const c = copy(w.letter);
            const wRuns = byWorkflow.get(w.key) ?? [];
            const last = wRuns[0];
            const expanded = open === w.key;

            return (
              <li key={w.key}>
                <Card padded={false} className="overflow-hidden">
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3.5">
                      <span
                        aria-hidden="true"
                        className="shrink-0 w-9 h-9 rounded-[var(--radius-md)] grid place-items-center
                                   font-display text-sm font-semibold
                                   bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]"
                      >
                        {w.letter}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <h2 className="font-display text-base font-semibold text-balance-title">{c.title}</h2>
                          <Badge tone="accent">{t.automation.needsAi}</Badge>
                        </div>

                        <dl className="mt-2.5 space-y-1.5">
                          <div className="flex gap-2 text-[0.8125rem]">
                            <dt className="shrink-0 text-[var(--text-muted)]">{t.automation.triggerLabel}</dt>
                            <dd className="min-w-0">{c.trigger}</dd>
                          </div>
                          <div className="flex gap-2 text-[0.8125rem]">
                            <dt className="shrink-0 text-[var(--text-muted)]">{t.automation.outputLabel}</dt>
                            <dd className="min-w-0">{c.output}</dd>
                          </div>
                        </dl>

                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {wRuns.length > 0 ? (
                            <>
                              <StatusDot status={last.status} />
                              <span className="text-xs text-[var(--text-muted)]">
                                {t.automation.lastRun} {formatDate(last.startedAt)}
                                {last.durationMs !== null ? ` · ${seconds(last.durationMs, formatNumber)}` : ''}
                              </span>
                              <Button
                                size="sm" variant="ghost"
                                onClick={() => setOpen(expanded ? null : w.key)}
                                aria-expanded={expanded}
                              >
                                {wRuns.length === 1
                                  ? t.automation.runCountOne
                                  : tf(t.automation.runCount, { n: formatNumber(wRuns.length) })}
                                <Icon.chevronDown
                                  size={14}
                                  className={cx('transition-transform', expanded && 'rotate-180')}
                                />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">{t.automation.neverRun}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-4 sm:px-5 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                        {t.automation.runsTitle}
                      </p>
                      <ul className="divide-y divide-[var(--border-subtle)]">
                        {wRuns.slice(0, 8).map((r) => (
                          <li key={r.id} className="py-2 flex items-start gap-2.5">
                            <StatusDot status={r.status} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs text-[var(--text-muted)]">
                                {formatDate(r.startedAt)}
                                {r.durationMs !== null ? ` · ${seconds(r.durationMs, formatNumber)}` : ''}
                              </span>
                              {r.outputSummary ? (
                                <span className="block text-[0.8125rem] mt-0.5">{r.outputSummary}</span>
                              ) : null}
                              {r.errorMessage ? (
                                <span className="block text-[0.8125rem] mt-0.5 text-[var(--danger)]">
                                  {r.errorMessage}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Card>
                {i < WORKFLOWS.length - 1 ? (
                  <span aria-hidden="true" className="block w-px h-3 mx-auto bg-[var(--border-strong)]" />
                ) : null}
              </li>
            );
          })}
        </ol>

        <Card>
          <CardHeader title={t.automation.webhooksTitle} />
          <p className="text-[0.8125rem] text-[var(--text-secondary)] leading-relaxed">
            {t.automation.webhooksBody}
          </p>

          {/* A whole sentence cannot go in a Badge: it never wraps, so at 320px
              it pushed the page 481px wide. A dot plus flowing text instead. */}
          <p className="flex items-start gap-2 mt-3.5 text-[0.8125rem] leading-relaxed">
            <span
              aria-hidden="true"
              className="shrink-0 w-2 h-2 rounded-full mt-1.5"
              style={{ background: webhooksEnabled ? 'var(--positive)' : 'var(--text-muted)' }}
            />
            <span className="min-w-0">
              {webhooksEnabled ? t.automation.webhooksOn : t.automation.webhooksOff}
            </span>
          </p>

          <ul className="mt-4 space-y-1.5">
            {WORKFLOWS.filter((w) => w.endpoint).map((w) => (
              <li key={w.endpoint}>
                <code className="block text-xs font-mono px-2.5 py-2 rounded-[var(--radius-sm)]
                                 bg-[var(--bg-inset)] text-[var(--text-secondary)] overflow-x-auto"
                >
                  POST /api/workflows/{w.endpoint}
                </code>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

const STATUS_TONE: Record<AiRunStatus, string> = {
  completed: 'var(--positive)',
  failed: 'var(--danger)',
  running: 'var(--warning)',
  pending: 'var(--text-muted)',
};

function StatusDot({ status }: { status: AiRunStatus }) {
  const { t } = useI18n();
  const tone = STATUS_TONE[status];
  // Its own vocabulary: a finished run is "completed", not "ready", which is
  // what a processed syllabus is.
  const label =
    status === 'completed' ? t.automation.runCompleted
      : status === 'failed' ? t.automation.runFailed
        : status === 'running' ? t.automation.runRunning
          : t.automation.runPending;

  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: tone }} />
      <span className="text-xs" style={{ color: tone }}>{label}</span>
    </span>
  );
}

function seconds(ms: number, formatNumber: ReturnType<typeof useI18n>['formatNumber']): string {
  return `${formatNumber(Math.round(ms / 100) / 10)}s`;
}
