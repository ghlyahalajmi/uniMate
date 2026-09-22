'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, cx } from '@/components/ui/primitives';
import { AiThinking, ErrorState } from '@/components/ui/states';
import { TextInput } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { MAX_UPLOAD_BYTES } from '@/lib/validation/schemas';
import type { Weekday } from '@/types/database';

interface ScannedCourse {
  course_code: string;
  course_name: string;
  instructor: string | null;
  credits: number | null;
  days: Weekday[];
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  uncertainFields: string[];
}

interface CleaningDecision {
  field: string; original: string; cleaned: string; reason: string; courseCode: string;
}

const WEEKDAYS: Weekday[] = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';

type Phase = 'idle' | 'scanning' | 'review' | 'saving' | 'error';

/**
 * Nothing this screen reads is written until the student presses save. Fields
 * the model was unsure about are flagged individually so the student's
 * attention goes where the doubt is.
 */
export function ScannerView() {
  const { t, tf } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [courses, setCourses] = useState<ScannedCourse[]>([]);
  const [cleaning, setCleaning] = useState<CleaningDecision[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [semester, setSemester] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) { setError(t.errors.fileTooLarge); setPhase('error'); return; }
    if (!ACCEPT.split(',').includes(file.type)) { setError(t.errors.fileType); setPhase('error'); return; }

    setPhase('scanning');
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/ai/scan', { method: 'POST', body });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error === 'file_too_large' ? t.errors.fileTooLarge
          : data.error === 'file_type' ? t.errors.fileType
          : t.scanner.error);
        setPhase('error');
        return;
      }
      if (!data.courses?.length) {
        setError(t.scanner.nothingFound);
        setPhase('error');
        return;
      }

      setCourses(data.courses);
      setCleaning(data.cleaning ?? []);
      setNotes(data.notes ?? []);
      setPhase('review');
    } catch {
      setError(t.errors.network);
      setPhase('error');
    }
  }

  async function save() {
    setPhase('saving');
    try {
      const res = await fetch('/api/ai/scan', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courses: courses.map((c) => ({ ...c, semester: semester.trim() || null })),
          cleaning,
        }),
      });
      const data = await res.json();
      if (!data.ok) { toast.error(t.errors.generic); setPhase('review'); return; }

      toast.success(tf(t.scanner.saved, { n: data.inserted }));
      router.push('/courses');
      router.refresh();
    } catch {
      toast.error(t.errors.network);
      setPhase('review');
    }
  }

  function update(index: number, patch: Partial<ScannedCourse>) {
    setCourses((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  return (
    <>
      <PageHeader title={t.scanner.title} subtitle={t.scanner.subtitle} />

      {phase === 'idle' || phase === 'error' ? (
        <div className="space-y-4">
          {phase === 'error' && error ? (
            <ErrorState message={error} onRetry={() => { setPhase('idle'); setError(null); }} retryLabel={t.common.retry} />
          ) : null}

          <Card padded={false}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              className={cx(
                'flex flex-col items-center justify-center text-center px-6 py-12 rounded-[var(--radius-lg)]',
                'border-2 border-dashed transition-colors',
                dragging ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)]' : 'border-[var(--border-strong)]',
              )}
            >
              <Icon.camera size={32} className="text-[var(--text-muted)] mb-3" />
              <p className="text-sm font-medium">{t.scanner.dropzone}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t.syllabi.fileTypes}</p>

              <div className="flex flex-wrap gap-2 justify-center mt-5">
                <Button onClick={() => cameraRef.current?.click()}>
                  <Icon.camera size={17} />
                  {t.scanner.takePhoto}
                </Button>
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  <Icon.upload size={17} />
                  {t.scanner.chooseFile}
                </Button>
              </div>

              <input
                ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only"
                aria-label={t.scanner.takePhoto}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
              />
              <input
                ref={fileRef} type="file" accept={ACCEPT} className="sr-only"
                aria-label={t.scanner.chooseFile}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
              />
            </div>
          </Card>

          <p className="text-xs text-[var(--text-muted)] text-center">{t.scanner.reviewNote}</p>
        </div>
      ) : null}

      {phase === 'scanning' ? (
        <Card>
          <AiThinking stages={[t.scanner.scanning, t.scanner.extracting, t.scanner.building]} />
        </Card>
      ) : null}

      {phase === 'review' || phase === 'saving' ? (
        <div className="space-y-4">
          <Card className="bg-[var(--bg-accent-soft)] border-[var(--border-subtle)]">
            <h2 className="font-display text-lg font-semibold">
              {t.scanner.found} ({courses.length})
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{t.scanner.foundSub}</p>
            {notes.length ? (
              <ul className="mt-3 space-y-1">
                {notes.map((n) => (
                  <li key={n} className="text-xs text-[var(--text-secondary)] flex gap-1.5">
                    <span aria-hidden="true">·</span>{n}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card>
            <TextInput
              label={t.courses.semester}
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="Fall 2026"
              hint={t.common.optional}
            />
          </Card>

          <ul className="space-y-3">
            {courses.map((c, i) => (
              <Card as="li" key={i}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-display text-base font-semibold">
                    {c.course_code || '—'}
                  </h3>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setCourses((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Icon.trash size={15} />
                    {t.scanner.discardOne}
                  </Button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <FieldWithDoubt
                    label={t.courses.code} value={c.course_code}
                    uncertain={c.uncertainFields.includes('course_code')}
                    onChange={(v) => update(i, { course_code: v })}
                  />
                  <FieldWithDoubt
                    label={t.courses.name} value={c.course_name}
                    uncertain={c.uncertainFields.includes('course_name')}
                    onChange={(v) => update(i, { course_name: v })}
                  />
                  <FieldWithDoubt
                    label={t.courses.instructor} value={c.instructor ?? ''}
                    uncertain={c.uncertainFields.includes('instructor')}
                    onChange={(v) => update(i, { instructor: v || null })}
                  />
                  <FieldWithDoubt
                    label={t.courses.creditsLabel} value={c.credits === null ? '' : String(c.credits)}
                    type="number" uncertain={c.uncertainFields.includes('credits')}
                    onChange={(v) => update(i, { credits: v === '' ? null : Number(v) })}
                  />
                  <FieldWithDoubt
                    label={t.courses.startTime} value={c.start_time ?? ''} type="time"
                    uncertain={c.uncertainFields.includes('start_time')}
                    onChange={(v) => update(i, { start_time: v || null })}
                  />
                  <FieldWithDoubt
                    label={t.courses.endTime} value={c.end_time ?? ''} type="time"
                    uncertain={c.uncertainFields.includes('end_time')}
                    onChange={(v) => update(i, { end_time: v || null })}
                  />
                  <FieldWithDoubt
                    label={t.courses.room} value={c.room ?? ''}
                    uncertain={c.uncertainFields.includes('room')}
                    onChange={(v) => update(i, { room: v || null })}
                    className="sm:col-span-2"
                  />
                </div>

                <fieldset className="mt-3">
                  <legend className="text-[0.8125rem] font-medium mb-1.5">
                    {t.courses.daysLabel}
                    {c.uncertainFields.includes('days') ? (
                      <Badge tone="warning" className="ms-2">{t.scanner.lowConfidence}</Badge>
                    ) : null}
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((d) => {
                      const on = c.days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          onClick={() => update(i, {
                            days: on ? c.days.filter((x) => x !== d) : [...c.days, d],
                          })}
                          className={cx(
                            'px-3 min-h-[36px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium border transition-colors',
                            on
                              ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
                          )}
                        >
                          {t.weekdaysShort[d]}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </Card>
            ))}
          </ul>

          {cleaning.length ? (
            <Card>
              <h3 className="text-sm font-semibold mb-2">{t.records.cleaningTitle}</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-3">{t.records.cleaningSub}</p>
              <ul className="space-y-2">
                {cleaning.map((d, i) => (
                  <li key={i} className="text-xs flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <code className="px-1.5 py-0.5 rounded bg-[var(--bg-inset)] text-[var(--text-secondary)]">
                      {d.original}
                    </code>
                    <span aria-hidden="true" className="text-[var(--text-muted)]">→</span>
                    <code className="px-1.5 py-0.5 rounded bg-[var(--positive-soft)] text-[var(--positive)]">
                      {d.cleaned}
                    </code>
                    <span className="text-[var(--text-muted)] w-full sm:w-auto">{d.reason}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sticky bottom-20 lg:bottom-4">
            <Button variant="secondary" onClick={() => { setPhase('idle'); setCourses([]); }}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={save}
              loading={phase === 'saving'}
              loadingLabel={t.common.saving}
              disabled={courses.length === 0}
            >
              <Icon.check size={17} />
              {t.scanner.confirmAll}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FieldWithDoubt({
  label, value, onChange, uncertain, type = 'text', className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  uncertain: boolean;
  type?: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={className}>
      <TextInput
        label={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={uncertain ? 'border-[var(--warning)] bg-[var(--warning-soft)]' : undefined}
      />
      {uncertain ? (
        <p className="text-xs text-[var(--warning)] mt-1 flex items-start gap-1">
          <span aria-hidden="true">⚠</span>
          <span>{t.scanner.lowConfidence}</span>
        </p>
      ) : null}
    </div>
  );
}
