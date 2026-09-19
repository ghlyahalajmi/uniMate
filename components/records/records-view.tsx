'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { deleteRecord, type DeletableTable } from '@/lib/data/actions';

interface Row { id: string; cells: string[] }

interface RunRow {
  id: string; agent: string; trigger: string; workflow: string | null;
  status: string; input: string | null; output: string | null;
  error: string | null; durationMs: number | null; startedAt: string;
}

interface CleaningRow {
  id: string; table: string; field: string | null;
  original: string | null; cleaned: string | null; reason: string; createdAt: string;
}

type TabKey =
  | 'courses' | 'grades' | 'tasks' | 'syllabi' | 'events'
  | 'sessions' | 'questions' | 'reminders' | 'runs' | 'cleaning';

export function RecordsView(props: {
  courses: Row[]; grades: Row[]; tasks: Row[]; syllabi: Row[]; events: Row[];
  sessions: Row[]; questions: Row[]; reminders: Row[];
  runs: RunRow[]; cleaning: CleaningRow[];
}) {
  const { t, formatDate, formatNumber } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<TabKey>('courses');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState<{ table: DeletableTable; id: string; label: string } | null>(null);

  const tables: Record<Exclude<TabKey, 'runs' | 'cleaning'>, {
    label: string; head: string[]; rows: Row[]; table: DeletableTable; exportName: string;
  }> = {
    courses: {
      label: t.records.tableCourses, table: 'courses', exportName: 'courses',
      head: [t.courses.code, t.courses.name, t.courses.creditsLabel, t.courses.semester, t.common.status, ''],
      rows: props.courses,
    },
    grades: {
      label: t.records.tableGrades, table: 'grades', exportName: 'grades',
      head: [t.common.course, t.grades.assessmentName, t.grades.assessmentType, t.common.weight, t.common.score, t.common.dueDate],
      rows: props.grades,
    },
    tasks: {
      label: t.records.tableTasks, table: 'tasks', exportName: 'tasks',
      head: [t.tasks.taskTitle, t.common.course, t.common.priority, t.common.status, t.common.dueDate, t.common.createdBy],
      rows: props.tasks,
    },
    syllabi: {
      label: t.records.tableSyllabi, table: 'syllabi', exportName: 'syllabi',
      head: [t.syllabi.upload, t.common.course, t.syllabi.processingStatus, t.courseDetail.topics, t.records.started],
      rows: props.syllabi,
    },
    events: {
      label: t.records.tableEvents, table: 'syllabus_events', exportName: 'syllabus_events',
      head: [t.tasks.taskTitle, t.common.course, t.grades.assessmentType, t.common.dueDate, t.common.weight],
      rows: props.events,
    },
    sessions: {
      label: t.records.tableSessions, table: 'study_sessions', exportName: 'study_sessions',
      head: [t.common.course, t.study.topic, t.study.mode, t.common.score, '%', t.records.started],
      rows: props.sessions,
    },
    questions: {
      label: t.records.tableQuestions, table: 'questions', exportName: 'questions',
      head: [t.study.question.replace(' {n} of {total}', ''), t.common.course, t.study.topic, t.study.difficulty, t.grades.assessmentType],
      rows: props.questions,
    },
    reminders: {
      label: t.records.tableReminders, table: 'reminders', exportName: 'reminders',
      head: [t.tasks.taskTitle, t.common.course, t.common.dueDate, t.common.status, t.common.createdBy],
      rows: props.reminders,
    },
  };

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    ...Object.entries(tables).map(([key, v]) => ({
      key: key as TabKey, label: v.label, count: v.rows.length,
    })),
    { key: 'runs', label: t.records.tableRuns, count: props.runs.length },
    { key: 'cleaning', label: t.records.tableCleaning, count: props.cleaning.length },
  ];

  async function exportCsv(table?: string) {
    setExporting(true);
    try {
      const url = table ? `/api/export?table=${encodeURIComponent(table)}` : '/api/export';
      const res = await fetch(url);
      if (!res.ok) { toast.error(t.records.exportError); return; }

      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download =
        res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        'unimate-export.csv';
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

  const activeTable = tab !== 'runs' && tab !== 'cleaning' ? tables[tab] : null;

  return (
    <>
      <PageHeader
        title={t.records.title}
        subtitle={t.records.subtitle}
        action={
          <Button onClick={() => exportCsv()} loading={exporting} loadingLabel={t.records.exporting}>
            <Icon.download size={17} />
            <span className="hidden sm:inline">{t.records.exportAll}</span>
          </Button>
        }
      />

      <div role="tablist" aria-label={t.records.title} className="flex gap-1 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            className={cx(
              'shrink-0 px-3.5 min-h-[38px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors whitespace-nowrap',
              tab === tb.key
                ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]',
            )}
          >
            {tb.label}
            <span className="ms-1.5 text-[var(--text-muted)] tabular-nums">{tb.count}</span>
          </button>
        ))}
      </div>

      {activeTable ? (
        <Card>
          <CardHeader
            title={activeTable.label}
            subtitle={`${activeTable.rows.length} ${t.records.rowCount.replace('{n} ', '')}`}
            action={
              activeTable.rows.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => exportCsv(activeTable.exportName)}>
                  <Icon.download size={15} />
                  <span className="hidden sm:inline">{t.records.exportOne}</span>
                </Button>
              ) : null
            }
          />

          {activeTable.rows.length === 0 ? (
            <EmptyState compact title={activeTable.label} body={t.records.noRows} />
          ) : (
            <>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{activeTable.label}</caption>
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      {activeTable.head.map((h, i) => (
                        <th key={i} scope="col" className="text-start py-2 pe-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                          {h}
                        </th>
                      ))}
                      <th scope="col" className="py-2"><span className="sr-only">{t.common.actions}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTable.rows.map((r) => (
                      <tr key={r.id} className="border-b border-[var(--border-subtle)] last:border-0">
                        {r.cells.map((c, i) => (
                          <td key={i} className="py-2.5 pe-3 max-w-[18rem] truncate">{c || '—'}</td>
                        ))}
                        <td className="py-2.5 text-end">
                          <button
                            type="button"
                            onClick={() => setDeleting({ table: activeTable.table, id: r.id, label: r.cells[0] })}
                            aria-label={`${t.records.deleteRow}: ${r.cells[0]}`}
                            className="w-8 h-8 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                          >
                            <Icon.trash size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="sm:hidden space-y-2.5">
                {activeTable.rows.map((r) => (
                  <li key={r.id} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <dl className="min-w-0 flex-1 space-y-1">
                        {r.cells.map((c, i) => (
                          c ? (
                            <div key={i} className="flex gap-2 text-xs">
                              <dt className="text-[var(--text-muted)] shrink-0 min-w-[5.5rem]">{activeTable.head[i]}</dt>
                              <dd className="min-w-0 truncate">{c}</dd>
                            </div>
                          ) : null
                        ))}
                      </dl>
                      <button
                        type="button"
                        onClick={() => setDeleting({ table: activeTable.table, id: r.id, label: r.cells[0] })}
                        aria-label={`${t.records.deleteRow}: ${r.cells[0]}`}
                        className="w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] shrink-0"
                      >
                        <Icon.trash size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      ) : null}

      {tab === 'runs' ? (
        <Card>
          <CardHeader
            title={t.records.runsTitle}
            subtitle={t.records.runsSub}
            action={
              props.runs.length ? (
                <Button variant="ghost" size="sm" onClick={() => exportCsv('ai_runs')}>
                  <Icon.download size={15} />
                  <span className="hidden sm:inline">{t.records.exportOne}</span>
                </Button>
              ) : null
            }
          />
          {props.runs.length === 0 ? (
            <EmptyState compact title={t.records.tableRuns} body={t.records.runsEmpty} />
          ) : (
            <ul className="space-y-2.5">
              {props.runs.map((r) => (
                <li key={r.id} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{r.agent}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {r.trigger}{r.workflow ? ` · ${r.workflow}` : ''}
                      </p>
                    </div>
                    <Badge tone={r.status === 'completed' ? 'positive' : r.status === 'failed' ? 'danger' : 'warning'}>
                      {r.status}
                    </Badge>
                  </div>

                  <dl className="mt-2.5 space-y-1 text-xs">
                    {r.input ? (
                      <div className="flex gap-2">
                        <dt className="text-[var(--text-muted)] shrink-0 min-w-[4rem]">{t.records.input}</dt>
                        <dd className="min-w-0">{r.input}</dd>
                      </div>
                    ) : null}
                    {r.output ? (
                      <div className="flex gap-2">
                        <dt className="text-[var(--text-muted)] shrink-0 min-w-[4rem]">{t.records.output}</dt>
                        <dd className="min-w-0">{r.output}</dd>
                      </div>
                    ) : null}
                    {r.error ? (
                      <div className="flex gap-2">
                        <dt className="text-[var(--text-muted)] shrink-0 min-w-[4rem]">{t.records.error}</dt>
                        <dd className="min-w-0 text-[var(--danger)]">{r.error}</dd>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <dt className="text-[var(--text-muted)] shrink-0 min-w-[4rem]">{t.records.started}</dt>
                      <dd className="tabular-nums">
                        {formatDate(r.startedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {r.durationMs !== null ? ` · ${formatNumber(Math.round(r.durationMs / 100) / 10)}s` : ''}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === 'cleaning' ? (
        <Card>
          <CardHeader
            title={t.records.cleaningTitle}
            subtitle={t.records.cleaningSub}
            action={
              props.cleaning.length ? (
                <Button variant="ghost" size="sm" onClick={() => exportCsv('cleaning_log')}>
                  <Icon.download size={15} />
                  <span className="hidden sm:inline">{t.records.exportOne}</span>
                </Button>
              ) : null
            }
          />
          {props.cleaning.length === 0 ? (
            <EmptyState compact title={t.records.cleaningTitle} body={t.records.cleaningEmpty} />
          ) : (
            <ul className="space-y-2.5">
              {props.cleaning.map((c) => (
                <li key={c.id} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3.5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge>{c.table}</Badge>
                    {c.field ? <Badge tone="neutral">{c.field}</Badge> : null}
                    <span className="text-xs text-[var(--text-muted)] tabular-nums ms-auto">
                      {formatDate(c.createdAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <code className="px-2 py-1 rounded bg-[var(--bg-inset)] text-[var(--text-secondary)] line-through decoration-[var(--text-muted)]">
                      {c.original ?? '—'}
                    </code>
                    <span aria-hidden="true" className="text-[var(--text-muted)]">→</span>
                    <code className="px-2 py-1 rounded bg-[var(--positive-soft)] text-[var(--positive)]">
                      {c.cleaned ?? '—'}
                    </code>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-2">{c.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t.records.deleteRow}
        body={deleting?.label ?? t.tasks.deleteBody}
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteRecord(deleting.table, deleting.id);
          if (result.ok) toast.success(t.common.delete);
          else toast.error(t.errors.generic);
          setDeleting(null);
          router.refresh();
        }}
      />
    </>
  );
}
