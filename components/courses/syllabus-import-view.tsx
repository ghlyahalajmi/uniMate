'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { AiThinking, AiUnavailable, ErrorState } from '@/components/ui/states';
import { TextInput } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { MAX_UPLOAD_BYTES } from '@/lib/validation/schemas';
import { CourseTile } from './course-tile';
import type { Weekday } from '@/types/database';

interface ReadContact {
  name: string | null;
  email: string | null;
  office: string | null;
  office_hours: string | null;
}

interface ReadCourse {
  course_code: string;
  course_name: string;
  credits: number | null;
  semester: string | null;
  days: Weekday[];
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  instructor: ReadContact;
  ta: ReadContact;
  uncertainFields: string[];
}

interface CleaningDecision {
  field: string; original: string; cleaned: string; reason: string;
}

const WEEKDAYS: Weekday[] = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';
const MAX_PAGES = 8;

type Phase = 'idle' | 'reading' | 'review' | 'saving' | 'error';

/** A page the student has chosen but not yet sent. */
interface Page {
  file: File;
  id: string;
}

/**
 * Add a course from its syllabus.
 *
 * A syllabus arrives as one PDF or as a handful of phone photos, so this takes
 * several files and treats them as one document. Nothing is written until the
 * student presses save, and fields the model was unsure of are flagged where
 * the doubt is rather than in a banner at the top.
 */
export function SyllabusImportView({ aiEnabled }: { aiEnabled: boolean }) {
  const { t, tf } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [pages, setPages] = useState<Page[]>([]);
  const [course, setCourse] = useState<ReadCourse | null>(null);
  const [cleaning, setCleaning] = useState<CleaningDecision[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  if (!aiEnabled) {
    return (
      <>
        <PageHeader title={t.syllabusImport.title} subtitle={t.syllabusImport.subtitle} />
        <AiUnavailable title={t.ai.unavailableTitle} body={t.ai.unavailableBody} />
      </>
    );
  }

  function addFiles(incoming: FileList | File[]) {
    const accepted: Page[] = [];

    for (const file of Array.from(incoming)) {
      if (!ACCEPT.split(',').includes(file.type)) { setError(t.errors.fileType); setPhase('error'); return; }
      if (file.size > MAX_UPLOAD_BYTES) { setError(t.errors.fileTooLarge); setPhase('error'); return; }
      accepted.push({ file, id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}` });
    }

    // Decided out here rather than inside the updater: a state updater has to
    // stay pure, and under StrictMode it runs twice.
    if (pages.length + accepted.length > MAX_PAGES) {
      setError(tf(t.syllabusImport.tooManyPages, { n: MAX_PAGES }));
      setPhase('error');
      return;
    }

    setPages([...pages, ...accepted]);
    setError(null);
    setPhase('idle');
  }

  async function read() {
    if (pages.length === 0) return;
    setPhase('reading');
    setError(null);

    try {
      const body = new FormData();
      for (const p of pages) body.append('files', p.file);

      const res = await fetch('/api/ai/course-from-syllabus', { method: 'POST', body });
      const data = await res.json();

      if (!data.ok) {
        setError(
          data.error === 'file_too_large' ? t.errors.fileTooLarge
          : data.error === 'file_type' ? t.errors.fileType
          : data.error === 'too_many_pages' ? tf(t.syllabusImport.tooManyPages, { n: MAX_PAGES })
          : t.syllabusImport.error,
        );
        setPhase('error');
        return;
      }
      if (!data.course) {
        setError(t.syllabusImport.nothingFound);
        setPhase('error');
        return;
      }

      setCourse(data.course);
      setCleaning(data.cleaning ?? []);
      setNotes(data.notes ?? []);
      setPhase('review');
    } catch {
      setError(t.errors.network);
      setPhase('error');
    }
  }

  async function save() {
    if (!course) return;
    setPhase('saving');
    try {
      const res = await fetch('/api/ai/course-from-syllabus', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          course: {
            course_code: course.course_code,
            course_name: course.course_name,
            credits: course.credits ?? 3,
            semester: course.semester ?? '',
            days: course.days,
            start_time: course.start_time ?? '',
            end_time: course.end_time ?? '',
            room: course.room ?? '',
            instructor: course.instructor.name ?? '',
            instructor_email: course.instructor.email ?? '',
            instructor_office: course.instructor.office ?? '',
            instructor_office_hours: course.instructor.office_hours ?? '',
            ta_name: course.ta.name ?? '',
            ta_email: course.ta.email ?? '',
            ta_office: course.ta.office ?? '',
            ta_office_hours: course.ta.office_hours ?? '',
          },
          cleaning,
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        toast.error(
          data.error === 'duplicate_course' ? t.syllabusImport.duplicate
          : data.error === 'invalid_course' ? t.courses.saveError
          : t.errors.generic,
        );
        setPhase('review');
        return;
      }

      toast.success(tf(t.syllabusImport.saved, { name: course.course_code }));
      router.push(`/courses/${data.courseId}`);
      router.refresh();
    } catch {
      toast.error(t.errors.network);
      setPhase('review');
    }
  }

  function update(patch: Partial<ReadCourse>) {
    setCourse((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateContact(who: 'instructor' | 'ta', patch: Partial<ReadContact>) {
    setCourse((prev) => (prev ? { ...prev, [who]: { ...prev[who], ...patch } } : prev));
  }

  const uncertain = (field: string) => course?.uncertainFields.includes(field) ?? false;

  return (
    <>
      <PageHeader title={t.syllabusImport.title} subtitle={t.syllabusImport.subtitle} />

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
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              className={cx(
                'flex flex-col items-center justify-center text-center px-6 py-12 rounded-[var(--radius-lg)]',
                'border-2 border-dashed transition-colors',
                dragging ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)]' : 'border-[var(--border-strong)]',
              )}
            >
              <Icon.syllabi size={32} className="text-[var(--text-muted)] mb-3" />
              <p className="text-sm font-medium">{t.syllabusImport.dropzone}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t.syllabusImport.dropzoneHint}</p>

              <div className="flex flex-wrap gap-2 justify-center mt-5">
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  <Icon.upload size={17} />
                  {t.syllabusImport.choosePages}
                </Button>
                <Button variant="secondary" onClick={() => cameraRef.current?.click()}>
                  <Icon.camera size={17} />
                  {t.scanner.takePhoto}
                </Button>
              </div>

              <input
                ref={fileRef} type="file" accept={ACCEPT} multiple className="sr-only"
                aria-label={t.syllabusImport.choosePages}
                onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
              />
              <input
                ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="sr-only"
                aria-label={t.scanner.takePhoto}
                onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
              />
            </div>
          </Card>

          {pages.length > 0 ? (
            <Card>
              <CardHeader
                title={tf(t.syllabusImport.pagesChosen, { n: pages.length })}
                subtitle={t.syllabusImport.pagesOrder}
              />
              <ul className="space-y-2">
                {pages.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    <span
                      aria-hidden="true"
                      className="w-7 h-7 grid place-items-center rounded-[0.55rem] bg-[var(--bg-inset)] text-xs tabular-nums text-[var(--text-secondary)] shrink-0"
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p.file.name}</span>
                    <span className="text-xs text-[var(--text-muted)] tabular-nums shrink-0">
                      {Math.max(1, Math.round(p.file.size / 1024))} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => setPages((prev) => prev.filter((x) => x.id !== p.id))}
                      aria-label={`${t.common.delete} ${p.file.name}`}
                      className="w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] shrink-0"
                    >
                      <Icon.trash size={15} />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => setPages([])}>{t.common.cancel}</Button>
                <Button onClick={read}>
                  <Icon.sparkle size={17} />
                  {t.syllabusImport.readIt}
                </Button>
              </div>
            </Card>
          ) : null}

          <p className="text-xs text-[var(--text-muted)] text-center">{t.scanner.reviewNote}</p>
        </div>
      ) : null}

      {phase === 'reading' ? (
        <Card>
          <AiThinking stages={[t.syllabusImport.reading, t.syllabusImport.extracting, t.syllabusImport.building]} />
        </Card>
      ) : null}

      {(phase === 'review' || phase === 'saving') && course ? (
        <div className="space-y-4">
          <Card className="bg-[var(--bg-accent-soft)] border-[var(--border-subtle)]">
            <div className="flex items-center gap-4">
              <CourseTile code={course.course_code} name={course.course_name} size="lg" />
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold truncate">
                  {course.course_code || t.syllabusImport.untitled}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] truncate">{course.course_name}</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-3">{t.syllabusImport.foundSub}</p>
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
            <CardHeader title={t.syllabusImport.courseSection} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Doubtful label={t.courses.code} value={course.course_code} uncertain={uncertain('course_code')}
                onChange={(v) => update({ course_code: v })} />
              <Doubtful label={t.courses.name} value={course.course_name} uncertain={uncertain('course_name')}
                onChange={(v) => update({ course_name: v })} />
              <Doubtful label={t.courses.creditsLabel} type="number" value={course.credits === null ? '' : String(course.credits)}
                uncertain={uncertain('credits')} onChange={(v) => update({ credits: v === '' ? null : Number(v) })} />
              <Doubtful label={t.courses.semester} value={course.semester ?? ''} uncertain={uncertain('semester')}
                onChange={(v) => update({ semester: v || null })} />
              <Doubtful label={t.courses.startTime} type="time" value={course.start_time ?? ''} uncertain={uncertain('start_time')}
                onChange={(v) => update({ start_time: v || null })} />
              <Doubtful label={t.courses.endTime} type="time" value={course.end_time ?? ''} uncertain={uncertain('end_time')}
                onChange={(v) => update({ end_time: v || null })} />
              <Doubtful label={t.courses.room} value={course.room ?? ''} uncertain={uncertain('room')}
                onChange={(v) => update({ room: v || null })} className="sm:col-span-2" />
            </div>

            <fieldset className="mt-3">
              <legend className="text-[0.8125rem] font-medium mb-1.5">
                {t.courses.daysLabel}
                {uncertain('days') ? <Badge tone="warning" className="ms-2">{t.scanner.lowConfidence}</Badge> : null}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = course.days.includes(d);
                  return (
                    <button
                      key={d} type="button" aria-pressed={on}
                      onClick={() => update({ days: on ? course.days.filter((x) => x !== d) : [...course.days, d] })}
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

          <ContactCard
            title={t.contacts.instructor}
            contact={course.instructor}
            prefix="instructor"
            uncertain={uncertain}
            onChange={(patch) => updateContact('instructor', patch)}
          />
          <ContactCard
            title={t.contacts.ta}
            subtitle={t.syllabusImport.taOptional}
            contact={course.ta}
            prefix="ta"
            uncertain={uncertain}
            onChange={(patch) => updateContact('ta', patch)}
          />

          {cleaning.length ? (
            <Card>
              <h3 className="text-sm font-semibold mb-2">{t.records.cleaningTitle}</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-3">{t.records.cleaningSub}</p>
              <ul className="space-y-2">
                {cleaning.map((d, i) => (
                  <li key={i} className="text-xs flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <code className="px-1.5 py-0.5 rounded bg-[var(--bg-inset)] text-[var(--text-secondary)]">{d.original}</code>
                    <span aria-hidden="true" className="text-[var(--text-muted)]">→</span>
                    <code className="px-1.5 py-0.5 rounded bg-[var(--positive-soft)] text-[var(--positive)]">{d.cleaned}</code>
                    <span className="text-[var(--text-muted)] w-full sm:w-auto">{d.reason}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sticky bottom-20 lg:bottom-4">
            <Button variant="secondary" onClick={() => { setPhase('idle'); setCourse(null); setPages([]); }}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={save}
              loading={phase === 'saving'}
              loadingLabel={t.common.saving}
              disabled={!course.course_code.trim() || !course.course_name.trim()}
            >
              <Icon.check size={17} />
              {t.syllabusImport.createCourse}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ContactCard({
  title, subtitle, contact, prefix, uncertain, onChange,
}: {
  title: string;
  subtitle?: string;
  contact: ReadContact;
  prefix: 'instructor' | 'ta';
  uncertain: (field: string) => boolean;
  onChange: (patch: Partial<ReadContact>) => void;
}) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="grid sm:grid-cols-2 gap-3">
        <Doubtful
          label={t.contacts.name} value={contact.name ?? ''}
          uncertain={uncertain(`${prefix}_name`)}
          onChange={(v) => onChange({ name: v || null })}
        />
        <Doubtful
          label={t.contacts.email} type="email" value={contact.email ?? ''}
          uncertain={uncertain(`${prefix}_email`)}
          onChange={(v) => onChange({ email: v || null })}
        />
        <Doubtful
          label={t.contacts.office} value={contact.office ?? ''}
          uncertain={uncertain(`${prefix}_office`)}
          onChange={(v) => onChange({ office: v || null })}
        />
        <Doubtful
          label={t.contacts.officeHours} value={contact.office_hours ?? ''}
          uncertain={uncertain(`${prefix}_office_hours`)}
          onChange={(v) => onChange({ office_hours: v || null })}
        />
      </div>
    </Card>
  );
}

function Doubtful({
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
