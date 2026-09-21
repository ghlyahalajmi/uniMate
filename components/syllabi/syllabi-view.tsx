'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { AiThinking, AiUnavailable, EmptyState } from '@/components/ui/states';
import { Select, TextInput } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { deleteRecord } from '@/lib/data/actions';
import { MAX_UPLOAD_BYTES } from '@/lib/validation/schemas';
import type { ProcessingStatus, SyllabusEventType } from '@/types/database';

const ACCEPT =
  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg,image/webp';

interface EventRow {
  id: string; title: string; type: SyllabusEventType;
  date: string | null; weight: number | null; description: string | null;
}

interface SyllabusRow {
  id: string; fileName: string | null; courseId: string | null; courseCode: string | null;
  status: ProcessingStatus; errorMessage: string | null;
  summary: string | null; instructor: string | null; officeHours: string | null;
  material: string | null; policies: string | null; topics: string[];
  uploadedAt: string; events: EventRow[];
}

export function SyllabiView({
  aiEnabled, syllabi, courseOptions, initialCourseId,
}: {
  aiEnabled: boolean;
  syllabi: SyllabusRow[];
  courseOptions: Array<{ value: string; label: string }>;
  initialCourseId: string;
}) {
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [courseId, setCourseId] = useState(initialCourseId);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<SyllabusRow | null>(null);

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) { toast.error(t.errors.fileTooLarge); return; }
    if (!ACCEPT.split(',').includes(file.type)) { toast.error(t.errors.fileType); return; }

    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      if (courseId) {
        body.append('course_id', courseId);
        const label = courseOptions.find((o) => o.value === courseId)?.label;
        if (label) body.append('course_hint', label);
      }
      const res = await fetch('/api/ai/syllabus', { method: 'POST', body });
      const data = await res.json();

      if (!data.ok) {
        toast.error(data.error === 'file_too_large' ? t.errors.fileTooLarge
          : data.error === 'file_type' ? t.errors.fileType
          : t.syllabi.uploadError);
      } else if (!data.processed) {
        toast.info(data.reason === 'ai_not_configured' ? t.ai.unavailableTitle : t.syllabi.uploadError);
      } else {
        toast.success(t.syllabi.completed);
      }
      router.refresh();
    } catch {
      toast.error(t.errors.network);
    } finally {
      setUploading(false);
    }
  }

  const statusLabel: Record<ProcessingStatus, string> = {
    pending: t.syllabi.pending,
    processing: t.syllabi.processingLabel,
    completed: t.syllabi.completed,
    failed: t.syllabi.failed,
  };

  return (
    <>
      <PageHeader title={t.syllabi.title} subtitle={t.syllabi.subtitle} />

      {!aiEnabled ? (
        <div className="mb-5">
          <AiUnavailable title={t.ai.unavailableTitle} body={t.ai.unavailableBody} />
        </div>
      ) : null}

      <Card className="mb-5">
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Select
            label={t.syllabi.linkCourse}
            options={courseOptions}
            placeholder={t.common.noCourse}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          />
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
          className={cx(
            'flex flex-col items-center justify-center text-center px-6 py-10 rounded-[var(--radius-lg)]',
            'border-2 border-dashed transition-colors',
            dragging ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)]' : 'border-[var(--border-strong)]',
          )}
        >
          {uploading ? (
            <AiThinking stages={[t.syllabi.uploading, t.ai.analysingSyllabus, t.ai.findingAssessments, t.ai.buildingTimeline]} />
          ) : (
            <>
              <Icon.upload size={30} className="text-[var(--text-muted)] mb-3" />
              <p className="text-sm font-medium">{t.syllabi.dropzone}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t.syllabi.fileTypes}</p>
              <Button className="mt-5" onClick={() => fileRef.current?.click()}>
                <Icon.upload size={17} />
                {t.syllabi.upload}
              </Button>
              <input
                ref={fileRef} type="file" accept={ACCEPT} className="sr-only"
                aria-label={t.syllabi.upload}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }}
              />
            </>
          )}
        </div>
      </Card>

      {syllabi.length === 0 ? (
        <Card><EmptyState title={t.syllabi.title} body={t.syllabi.empty} /></Card>
      ) : (
        <ul className="space-y-4">
          {syllabi.map((s) => (
            <Card as="li" key={s.id}>
              <CardHeader
                title={s.fileName ?? t.courseDetail.syllabus}
                subtitle={[s.courseCode, formatDate(s.uploadedAt)].filter(Boolean).join(' · ')}
                action={
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={s.status === 'completed' ? 'positive' : s.status === 'failed' ? 'danger' : 'warning'}
                    >
                      {statusLabel[s.status]}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setDeleting(s)}
                      aria-label={`${t.common.delete} ${s.fileName ?? ''}`}
                      className="w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                    >
                      <Icon.trash size={15} />
                    </button>
                  </div>
                }
              />

              {s.status === 'failed' && s.errorMessage ? (
                <p className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] border border-[var(--danger-border)] rounded-[var(--radius-sm)] px-3 py-2.5">
                  {s.errorMessage}
                </p>
              ) : null}

              {s.summary ? <p className="text-sm text-[var(--text-secondary)]">{s.summary}</p> : null}

              {s.status === 'completed' ? (
                <>
                  <dl className="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
                    {s.instructor ? <Detail label={t.courses.instructor} value={s.instructor} /> : null}
                    {s.officeHours ? <Detail label={t.syllabi.officeHours} value={s.officeHours} /> : null}
                    {s.material ? <Detail label={t.syllabi.material} value={s.material} /> : null}
                    {s.policies ? <Detail label={t.syllabi.policies} value={s.policies} /> : null}
                  </dl>

                  {s.topics.length ? (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                        {t.courseDetail.topics}
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {s.topics.map((topic) => (<li key={topic}><Badge>{topic}</Badge></li>))}
                      </ul>
                    </div>
                  ) : null}

                  {s.events.length ? (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                        {t.syllabi.events}
                      </p>
                      <ul className="divide-y divide-[var(--border-subtle)]">
                        {s.events.map((e) => (
                          <li key={e.id} className="py-2 flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block text-sm">{e.title}</span>
                              <span className="block text-xs text-[var(--text-muted)]">
                                {t.eventTypes[e.type]}{e.weight ? ` · ${e.weight}%` : ''}
                              </span>
                            </span>
                            <span className="text-xs tabular-nums text-[var(--text-secondary)] shrink-0">
                              {e.date ? formatDate(e.date) : t.common.notSet}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <ApplyPanel
                    syllabusId={s.id}
                    courseId={s.courseId}
                    courseOptions={courseOptions}
                  />

                  {aiEnabled ? <AskPanel syllabusId={s.id} /> : null}
                </>
              ) : null}
            </Card>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t.syllabi.deleteConfirm}
        body={t.syllabi.deleteBody}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteRecord('syllabi', deleting.id);
          toast.success(t.syllabi.deleted);
          setDeleting(null);
          router.refresh();
        }}
      />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 leading-relaxed">{value}</dd>
    </div>
  );
}


export interface ApplyPlan {
  create: Array<{ assessment_name: string; assessment_type: string; weight: number; due_date: string | null }>;
  skipped: Array<{ title: string; reason: 'notGradeable' | 'duplicate' | 'noWeightOrDate'; existingName?: string }>;
  courseUpdates: Array<{ field: string; to: string }>;
  totalWeightAfter: number;
  weightOverflows: boolean;
  unaccountedWeight: number;
  needsCourse: boolean;
  courseCode: string | null;
}

/**
 * Puts what the document says into the course.
 *
 * Until this existed, everything the analyst read stopped on this screen: a
 * student could see "Midterm · 25% · 22 Oct" printed here while their Grades
 * screen stayed empty and their course grade could not be computed.
 *
 * Two steps on purpose. These weights feed the grade and GPA arithmetic and
 * they were read out of a PDF by a model, so the student sees the exact rows
 * first — the same way the timetable scanner shows the courses it found before
 * saving any of them.
 */
export function ApplyPanel({
  syllabusId, courseId, courseOptions,
}: {
  syllabusId: string;
  courseId: string | null;
  courseOptions: Array<{ value: string; label: string }>;
}) {
  const { t, tf, formatDate } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [plan, setPlan] = useState<ApplyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [target, setTarget] = useState(courseId ?? '');

  async function review(courseOverride?: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/syllabus/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          syllabus_id: syllabusId,
          course_id: courseOverride ?? target ?? null,
          preview: true,
        }),
      });
      const data = await res.json();
      if (data?.ok) setPlan(data.plan);
      else toast.error(t.syllabi.applyError);
    } catch {
      toast.error(t.errors.network);
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!target) { toast.error(t.syllabi.applyNoCourse); return; }
    setApplying(true);
    try {
      const res = await fetch('/api/syllabus/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ syllabus_id: syllabusId, course_id: target, preview: false }),
      });
      const data = await res.json();
      if (!data?.ok) { toast.error(t.syllabi.applyError); return; }

      toast.success(
        data.updatedFields > 0
          ? tf(t.syllabi.applyDoneFields, { n: data.created, f: data.updatedFields })
          : tf(t.syllabi.applyDone, {
              n: data.created,
              course: plan?.courseCode ?? courseOptions.find((c) => c.value === target)?.label ?? '',
            }),
      );
      setPlan(null);
      router.refresh();
    } catch {
      toast.error(t.errors.network);
    } finally {
      setApplying(false);
    }
  }

  const skipLabel = (reason: string) =>
    reason === 'duplicate' ? t.syllabi.applySkipDuplicate
    : reason === 'notGradeable' ? t.syllabi.applySkipNotGradeable
    : t.syllabi.applySkipNoWeightOrDate;

  return (
    <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
      <p className="text-sm font-semibold mb-1">{t.syllabi.applyTitle}</p>
      <p className="text-sm text-[var(--text-secondary)] mb-3">{t.syllabi.applyBody}</p>

      {!plan ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => review()}
          loading={loading}
          loadingLabel={t.syllabi.applyChecking}
        >
          <Icon.check size={15} /> {t.syllabi.applyReview}
        </Button>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
          {plan.needsCourse ? (
            <div className="mb-3">
              <Select
                label={t.syllabi.applyPickCourse}
                value={target}
                onChange={(e) => { setTarget(e.target.value); void review(e.target.value); }}
                options={[{ value: '', label: t.common.selectCourse }, ...courseOptions]}
              />
            </div>
          ) : null}

          {plan.create.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              {plan.skipped.some((k) => k.reason === 'duplicate')
                ? t.syllabi.applyNothingNew
                : t.syllabi.applyNothingGradeable}
            </p>
          ) : (
            <>
              <p className="text-sm font-medium mb-2">
                {tf(t.syllabi.applyWillAdd, { n: plan.create.length })}
              </p>
              <ul className="divide-y divide-[var(--border-subtle)] mb-3">
                {plan.create.map((a) => (
                  <li key={a.assessment_name + a.due_date} className="py-2 flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm">{a.assessment_name}</span>
                      <span className="block text-xs text-[var(--text-muted)]">
                        {t.assessmentTypes[a.assessment_type as keyof typeof t.assessmentTypes] ?? a.assessment_type}
                        {a.weight > 0 ? ` · ${a.weight}%` : ''}
                      </span>
                    </span>
                    <span className="text-xs tabular-nums text-[var(--text-secondary)] shrink-0">
                      {a.due_date ? formatDate(a.due_date) : t.common.notSet}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {plan.courseUpdates.length ? (
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              {tf(t.syllabi.applyCourseFields, {
                fields: plan.courseUpdates.map((u) => u.to).join(', '),
              })}
            </p>
          ) : null}

          {plan.skipped.length ? (
            <details className="mb-2">
              <summary className="text-xs text-[var(--text-muted)] cursor-pointer min-h-[32px] flex items-center">
                {tf(t.syllabi.applySkipped, { n: plan.skipped.length })}
              </summary>
              <ul className="mt-1.5 flex flex-col gap-1">
                {plan.skipped.map((k, i) => (
                  <li key={k.title + i} className="text-xs text-[var(--text-muted)]">
                    {k.title} — {skipLabel(k.reason)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {plan.create.length > 0 ? (
            <>
              <p className="text-xs text-[var(--text-muted)] tabular-nums">
                {tf(t.syllabi.applyWeightTotal, { n: plan.totalWeightAfter })}
              </p>
              {plan.weightOverflows ? (
                <p className="text-xs text-[var(--danger)] mt-1">{t.syllabi.applyWeightOverflow}</p>
              ) : plan.unaccountedWeight > 0 ? (
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {tf(t.syllabi.applyWeightRemaining, { n: plan.unaccountedWeight })}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" onClick={apply} loading={applying} loadingLabel={t.syllabi.applyApplying}>
                  {t.syllabi.applyConfirm}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPlan(null)}>
                  {t.common.cancel}
                </Button>
              </div>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setPlan(null)} className="mt-2">
              {t.common.close}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Asks a question of one stored syllabus. "Not in the document" is a valid answer. */
function AskPanel({ syllabusId }: { syllabusId: string }) {
  const { t } = useI18n();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ text: string; found: boolean } | null>(null);
  const [asking, setAsking] = useState(false);

  async function ask() {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await fetch('/api/ai/syllabus/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ syllabus_id: syllabusId, question: question.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setAnswer({ text: data.found ? data.answer : t.syllabi.notFound, found: data.found });
      } else {
        setAnswer({ text: t.errors.generic, found: false });
      }
    } catch {
      setAnswer({ text: t.errors.network, found: false });
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
      <p className="text-sm font-semibold mb-3">{t.syllabi.askTitle}</p>
      <form
        onSubmit={(e) => { e.preventDefault(); void ask(); }}
        className="flex flex-col sm:flex-row gap-2 items-end"
      >
        <div className="flex-1 w-full">
          <TextInput
            label={t.syllabi.askTitle}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t.syllabi.askPlaceholder}
          />
        </div>
        <Button type="submit" loading={asking} loadingLabel={t.syllabi.asking} disabled={!question.trim()}>
          {t.syllabi.ask}
        </Button>
      </form>

      {answer ? (
        <div
          className={cx(
            'mt-3 rounded-[var(--radius-md)] border p-3.5',
            answer.found
              ? 'bg-[var(--bg-surface-2)] border-[var(--border-subtle)]'
              : 'bg-[var(--warning-soft)] border-[var(--warning-border)]',
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
            {answer.found ? t.ai.factLabel : t.common.unknown}
          </p>
          <p className="text-sm leading-relaxed">{answer.text}</p>
        </div>
      ) : null}
    </div>
  );
}
