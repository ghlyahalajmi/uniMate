'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader } from '@/components/ui/primitives';
import { AiThinking, AiUnavailable, EmptyState, Provenance } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { ChartFrame } from '@/components/charts/chart-frame';
import { BarChart, type BarDatum } from '@/components/charts/bar-chart';
import { LineChart, type LinePoint } from '@/components/charts/line-chart';

interface Analysis {
  patterns: Array<{ title: string; detail: string; evidence: string }>;
  strengths: string[];
  watchAreas: string[];
  suggestions: string[];
  basedOn: { completedCourses: number; assessments: number };
}

export function AnalyticsView({
  aiEnabled, assessmentSeries, courseStanding, gpaSeries, creditSeries, studySeries,
  maxGpa, maxCredits, completedCount, assessmentCount,
}: {
  aiEnabled: boolean;
  assessmentSeries: LinePoint[];
  courseStanding: BarDatum[];
  gpaSeries: BarDatum[];
  creditSeries: BarDatum[];
  studySeries: LinePoint[];
  maxGpa: number;
  maxCredits: number;
  completedCount: number;
  assessmentCount: number;
}) {
  const { t, tf, formatNumber } = useI18n();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [failed, setFailed] = useState(false);

  const nothingAtAll =
    assessmentSeries.length === 0 && courseStanding.length === 0 &&
    gpaSeries.length === 0 && studySeries.length === 0;

  async function runAnalyst() {
    setAnalysing(true);
    setFailed(false);
    try {
      const res = await fetch('/api/ai/analyst', { method: 'POST' });
      const data = await res.json();
      if (data.ok) setAnalysis(data);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setAnalysing(false);
    }
  }

  if (nothingAtAll) {
    return (
      <>
        <PageHeader title={t.analytics.title} subtitle={t.analytics.subtitle} />
        <Card><EmptyState title={t.analytics.title} body={t.analytics.empty} /></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.analytics.title} subtitle={t.analytics.subtitle} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title={t.analytics.performanceChart}
          yLabel={t.analytics.performanceY}
          xLabel={t.analytics.performanceX}
          empty={assessmentSeries.length === 0}
          emptyBody={t.analytics.emptyChart}
          footnote={t.a11y.chartDescription}
          table={{
            head: [t.analytics.performanceX, t.common.course, t.analytics.performanceY],
            rows: assessmentSeries.map((d) => [d.label, d.sub ?? '—', `${formatNumber(d.value)}%`]),
          }}
        >
          <LineChart data={assessmentSeries} max={100} unit="%" seriesVar="--color-series-1" />
        </ChartFrame>

        <ChartFrame
          title={t.analytics.coursePerformance}
          yLabel={t.analytics.courseY}
          xLabel={t.analytics.courseX}
          empty={courseStanding.length === 0}
          emptyBody={t.analytics.emptyChart}
          table={{
            head: [t.common.course, t.grades.currentWeighted, t.dashboard.target],
            rows: courseStanding.map((d) => [d.label, `${formatNumber(d.value)}%`, d.sub ?? '—']),
          }}
        >
          <BarChart data={courseStanding} max={100} unit="%" seriesVar="--color-series-1" />
        </ChartFrame>

        <ChartFrame
          title={t.analytics.gpaTrend}
          yLabel={t.analytics.gpaY}
          xLabel={t.analytics.gpaX}
          empty={gpaSeries.length === 0}
          emptyBody={t.analytics.emptyChart}
          table={{
            head: [t.analytics.gpaX, t.analytics.gpaY, t.courses.creditsLabel],
            rows: gpaSeries.map((d) => [d.label, formatNumber(d.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), d.sub ?? '—']),
          }}
        >
          <BarChart data={gpaSeries} max={maxGpa} unit="" seriesVar="--color-series-3" />
        </ChartFrame>

        <ChartFrame
          title={t.analytics.creditLoad}
          yLabel={t.analytics.creditY}
          xLabel={t.analytics.creditX}
          empty={creditSeries.length === 0}
          emptyBody={t.analytics.emptyChart}
          table={{
            head: [t.analytics.creditX, t.analytics.creditY],
            rows: creditSeries.map((d) => [d.label, formatNumber(d.value)]),
          }}
        >
          <BarChart data={creditSeries} max={maxCredits} unit="" seriesVar="--color-series-2" />
        </ChartFrame>

        <ChartFrame
          title={t.analytics.studyChart}
          yLabel={t.analytics.studyY}
          xLabel={t.analytics.studyX}
          empty={studySeries.length === 0}
          emptyBody={t.study.noHistory}
          table={{
            head: [t.analytics.studyX, t.common.course, t.analytics.studyY],
            rows: studySeries.map((d) => [d.label, d.sub ?? '—', `${formatNumber(d.value)}%`]),
          }}
        >
          <LineChart data={studySeries} max={100} unit="%" seriesVar="--color-series-5" />
        </ChartFrame>

        {/* Academic analyst ------------------------------------------------ */}
        <Card as="section">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Icon.sparkle size={18} className="text-[var(--accent)]" />
                {t.analytics.analyst}
              </span>
            }
            subtitle={tf(t.analytics.basedOn, { n: completedCount, m: assessmentCount })}
            action={
              !analysing ? (
                <Button size="sm" variant="secondary" onClick={runAnalyst}>
                  {analysis ? t.dashboard.regenerate : t.analytics.runAnalyst}
                </Button>
              ) : null
            }
          />

          {!aiEnabled && !analysis ? (
            <AiUnavailable
          title={t.ai.unavailableTitle}
          body={t.ai.unavailableBody}
          action={{ href: "/settings", label: t.ai.ownKeyCta }}
        />
          ) : analysing ? (
            <AiThinking stages={[t.ai.readingHistory, t.ai.findingPatterns, t.analytics.analysing]} />
          ) : failed ? (
            <p className="text-sm text-[var(--text-secondary)]">{t.errors.generic}</p>
          ) : !analysis ? (
            <p className="text-sm text-[var(--text-secondary)]">{t.analytics.noAnalysis}</p>
          ) : (
            <div className="space-y-4">
              {analysis.patterns.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    {t.analytics.patterns}
                  </p>
                  <ul className="space-y-3">
                    {analysis.patterns.map((p) => (
                      <li key={p.title}>
                        <Provenance kind="fact" label={p.title}>
                          <p>{p.detail}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-1.5">{p.evidence}</p>
                        </Provenance>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {analysis.strengths.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    {t.study.strongTopics}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {analysis.strengths.map((s) => (<li key={s}><Badge tone="positive">{s}</Badge></li>))}
                  </ul>
                </div>
              ) : null}

              {analysis.watchAreas.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    {t.study.weakTopics}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {analysis.watchAreas.map((s) => (<li key={s}><Badge tone="warning">{s}</Badge></li>))}
                  </ul>
                </div>
              ) : null}

              {analysis.suggestions.length ? (
                <ul className="space-y-2">
                  {analysis.suggestions.map((s) => (
                    <li key={s}>
                      <Provenance kind="suggestion" label={t.ai.suggestionLabel}>{s}</Provenance>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
