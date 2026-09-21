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
import { groupSyllabuses } from '@/lib/syllabus/grouping';
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
/** Kept in step with the route. */
const MAX_FILES = 16;
const MAX_SYLLABI = 8;

type Phase = 'idle' | 'reading' | 'review' | 'saving' | 'error';

/** A file the student has chosen but not yet sent. */
interface Page {
  file: File;
  id: string;
}

/** What one syllabus produced, and where it came from. */
interface Draft {
  id: string;
  /** The PDF's filename, or null when this draft came from photos. */
  source: string | null;
  photoCount: number;
  course: ReadCourse | null;
  cleaning: CleaningDecision[];
  notes: string[];
  /** The read failed for this file alone. */
  failed: boolean;
  /** Set after a save attempt that did not land. */
  saveError?: 'duplicate_course' | 'invalid_course' | 'save_failed';
  /** Set once this one is safely in the database. */
  savedId?: string;
  /** A demonstration row. Never saved, never counted as pending. */
  preview?: boolean;
}

interface ReadResult {
  source: string | null;
  photoCount: number;
  course: ReadCourse | null;
  cleaning?: CleaningDecision[];
  notes?: string[];
  failed?: boolean;
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
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  /**
   * How the chosen files will be split, shown before anything is read.
   *
   * The student should know they are about to create four courses rather than
   * one while they can still take a file out — finding out afterwards, on a
   * review screen four times longer than expected, is a worse way to learn it.
   */
  const showingExample = drafts.some((d) => d.preview);

  const groups = groupSyllabuses(
    pages.map((p) => ({ name: p.file.name, type: p.file.type, id: p.id })),
    (n) => tf(t.syllabusImport.photoGroup, { n }),
  );

  /**
   * Fill the review step with a worked example.
   *
   * Without a provider the screen used to stop at a banner, which meant the
   * part worth looking at — a card per syllabus, the doubt markers, the file
   * each course came from — could not be seen at all. The sample is marked as
   * a sample and cannot be saved; it exists so the interface can be judged
   * before anyone pays for a key.
   */
  function showExample() {
    setDrafts(EXAMPLE_DRAFTS);
    setPhase('review');
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
    const next = [...pages, ...accepted];
    if (next.length > MAX_FILES) {
      setError(tf(t.syllabusImport.tooManyFiles, { n: MAX_FILES }));
      setPhase('error');
      return;
    }
    // Refused here rather than by the server, so the student is told before
    // they wait for a read that was never going to be allowed.
    const syllabusCount = groupSyllabuses(
      next.map((x) => ({ name: x.file.name, type: x.file.type })),
      () => 'photos',
    ).length;
    if (syllabusCount > MAX_SYLLABI) {
      setError(tf(t.syllabusImport.tooManySyllabi, { n: MAX_SYLLABI }));
      setPhase('error');
      return;
    }

    setPages(next);
    setError(null);
    setPhase('idle');
  }

  async function read() {
    if (pages.length === 0) return;
    // Nothing to call yet. Say so where the student pressed, rather than
    // letting the request come back with a error they did not cause.
    if (!aiEnabled) { setError(t.ai.unavailableBody); setPhase('error'); return; }
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
          : data.error === 'too_many_files' ? tf(t.syllabusImport.tooManyFiles, { n: MAX_FILES })
          : data.error === 'too_many_syllabi' ? tf(t.syllabusImport.tooManySyllabi, { n: MAX_SYLLABI })
          : t.syllabusImport.error,
        );
        setPhase('error');
        return;
      }

      const results: ReadResult[] = Array.isArray(data.results)
        ? data.results
        // A server that has not been redeployed yet still answers with one
        // course. Name it from the first group so the card reads correctly
        // rather than calling a PDF a pile of photos.
        : [{
            source: pages.length === 1 && pages[0].file.type === 'application/pdf'
              ? pages[0].file.name
              : null,
            photoCount: pages.length,
            course: data.course,
            cleaning: data.cleaning,
            notes: data.notes,
          }];

      // Nothing readable anywhere is a dead end; one bad file among several is
      // a card that says so, next to the ones that worked.
      if (results.every((r) => !r.course)) {
        setError(t.syllabusImport.nothingFound);
        setPhase('error');
        return;
      }

      setDrafts(results.map((r, i) => ({
        id: `${r.source ?? 'photos'}-${i}`,
        source: r.source ?? null,
        photoCount: r.photoCount ?? 0,
        course: r.course,
        cleaning: r.cleaning ?? [],
        notes: r.notes ?? [],
        failed: Boolean(r.failed),
      })));
      setPhase('review');
    } catch {
      setError(t.errors.network);
      setPhase('error');
    }
  }

  /** Everything still on screen that has a course and has not already saved. */
  function pending(): Draft[] {
    return drafts.filter((d) => d.course !== null && !d.savedId && !d.preview);
  }

  async function save() {
    const batch = pending();
    if (batch.length === 0) return;
    setPhase('saving');

    try {
      const res = await fetch('/api/ai/course-from-syllabus', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courses: batch.map((d) => ({
            // The id travels as `source` so each outcome can be matched back to
            // the card that produced it, whatever order the server replies in.
            source: d.id,
            cleaning: d.cleaning,
            course: serialiseCourse(d.course as ReadCourse),
          })),
        }),
      });
      const data = await res.json();

      if (!Array.isArray(data.results)) {
        toast.error(data.error === 'duplicate_course' ? t.syllabusImport.duplicate : t.errors.generic);
        setPhase('review');
        return;
      }

      const byId = new Map<string, { ok: boolean; courseId?: string; error?: Draft['saveError'] }>(
        data.results.map((r: { source: string | null; ok: boolean; courseId?: string; error?: Draft['saveError'] }) =>
          [r.source ?? '', { ok: r.ok, courseId: r.courseId, error: r.error }]),
      );

      const updated = drafts.map((d) => {
        const outcome = byId.get(d.id);
        if (!outcome) return d;
        return outcome.ok
          ? { ...d, savedId: outcome.courseId, saveError: undefined }
          : { ...d, saveError: outcome.error ?? 'save_failed' };
      });
      setDrafts(updated);

      const saved = updated.filter((d) => d.savedId);
      const stillFailing = updated.filter((d) => d.course && !d.savedId);

      if (saved.length > 0) {
        toast.success(
          saved.length === 1
            ? tf(t.syllabusImport.saved, { name: saved[0].course?.course_code ?? '' })
            : tf(t.syllabusImport.savedMany, { n: saved.length }),
        );
      }

      // Everything landed: leave the page. Anything left to fix keeps the
      // student here, with the saved ones marked so they are not saved twice.
      if (stillFailing.length === 0) {
        if (saved.length === 1 && saved[0].savedId) router.push(`/courses/${saved[0].savedId}`);
        else router.push('/courses');
        router.refresh();
        return;
      }

      toast.error(tf(t.syllabusImport.someFailed, { n: stillFailing.length }));
      setPhase('review');
    } catch {
      toast.error(t.errors.network);
      setPhase('review');
    }
  }

  function update(id: string, patch: Partial<ReadCourse>) {
    setDrafts((prev) => prev.map((d) =>
      d.id === id && d.course
        // Editing a field after a failed save clears the complaint: the state
        // it described is no longer the state on screen.
        ? { ...d, course: { ...d.course, ...patch }, saveError: undefined }
        : d,
    ));
  }

  function updateContact(id: string, who: 'instructor' | 'ta', patch: Partial<ReadContact>) {
    setDrafts((prev) => prev.map((d) =>
      d.id === id && d.course
        ? { ...d, course: { ...d.course, [who]: { ...d.course[who], ...patch } }, saveError: undefined }
        : d,
    ));
  }

  function removeDraft(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <>
      <PageHeader title={t.syllabusImport.title} subtitle={t.syllabusImport.subtitle} />

      {phase === 'idle' || phase === 'error' ? (
        <div className="space-y-4">
          {!aiEnabled ? (
            <>
              <AiUnavailable title={t.ai.unavailableTitle} body={t.ai.unavailableBody} />
              <Card>
                <CardHeader
                  title={t.syllabusImport.previewTitle}
                  subtitle={t.syllabusImport.previewBody}
                />
                <Button variant="secondary" onClick={showExample}>
                  <Icon.sparkle size={17} />
                  {t.syllabusImport.previewOpen}
                </Button>
              </Card>
            </>
          ) : null}

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

              {/* What the upload will become, before a single read is paid for. */}
              <p className="text-[0.8125rem] text-[var(--accent-soft-text)] mt-3">
                {tf(t.syllabusImport.willCreate, { n: groups.length })}
              </p>
              <ul className="mt-2 space-y-1">
                {groups.map((g) => (
                  // Keyed by the first file's id, not the label: two syllabuses
                  // downloaded from different courses are often both called
                  // "syllabus.pdf", and a duplicate key drops one from the list.
                  <li key={g.files[0].id} className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 min-w-0">
                    <Icon.check size={13} className="shrink-0 text-[var(--positive)]" />
                    <span className="truncate">{g.label}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => setPages([])}>{t.common.cancel}</Button>
                <Button onClick={read}>
                  <Icon.sparkle size={17} />
                  {groups.length === 1
                    ? t.syllabusImport.readIt
                    : tf(t.syllabusImport.readThem, { n: groups.length })}
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

      {phase === 'review' || phase === 'saving' ? (
        <div className="space-y-6">
          <Card className="bg-[var(--bg-accent-soft)] border-[var(--border-subtle)]">
            <CardHeader
              title={tf(t.syllabusImport.coursesFound, { n: drafts.filter((d) => d.course).length })}
              subtitle={t.syllabusImport.reviewAllSub}
            />
          </Card>

          {drafts.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              onUpdate={(patch) => update(d.id, patch)}
              onUpdateContact={(who, patch) => updateContact(d.id, who, patch)}
              onRemove={() => removeDraft(d.id)}
            />
          ))}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sticky bottom-20 lg:bottom-4">
            {showingExample ? (
              <p className="text-xs text-[var(--text-muted)] sm:me-auto">
                {t.syllabusImport.previewLocked}
              </p>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => { setPhase('idle'); setDrafts([]); setPages([]); }}
            >
              {t.common.cancel}
            </Button>
            {showingExample ? null : (
              <Button
                onClick={save}
                loading={phase === 'saving'}
                loadingLabel={t.common.saving}
                disabled={
                  pending().length === 0 ||
                  pending().some((d) => !d.course?.course_code.trim() || !d.course?.course_name.trim())
                }
              >
                <Icon.check size={17} />
                {pending().length === 1
                  ? t.syllabusImport.createCourse
                  : tf(t.syllabusImport.createAll, { n: pending().length })}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * A worked example of a two-syllabus upload.
 *
 * Invented on purpose and marked as invented: one course read cleanly, one
 * with fields the reader was unsure about and a normalisation it had to make,
 * and a third file it could not read at all — because those three outcomes
 * side by side are what the screen is actually for.
 *
 * `preview: true` is what stops it being saved. Nothing here ever reaches the
 * database, and no real student's record is used to demonstrate the feature.
 */
const EXAMPLE_DRAFTS: Draft[] = [
  {
    id: 'example-1',
    source: 'CE301-syllabus.pdf',
    photoCount: 0,
    preview: true,
    failed: false,
    notes: [],
    cleaning: [],
    course: {
      course_code: 'CE301',
      course_name: 'Digital Signal Processing',
      credits: 3,
      semester: 'Fall 2026',
      days: ['sunday', 'tuesday'],
      start_time: '10:00',
      end_time: '11:15',
      room: 'Room 204',
      instructor: {
        name: 'Dr. Noura Al-Sabah',
        email: 'n.alsabah@ku.edu.kw',
        office: 'Engineering Block 2, Room 114',
        office_hours: 'Sun & Tue 12:00-13:30',
      },
      ta: { name: 'Yousef Al-Rashid', email: null, office: null, office_hours: null },
      uncertainFields: [],
    },
  },
  {
    id: 'example-2',
    source: 'MATH201.pdf',
    photoCount: 0,
    preview: true,
    failed: false,
    notes: ['The syllabus does not state a room for the tutorial session.'],
    cleaning: [
      { field: 'credits', original: '3 Credit Hours', cleaned: '3', reason: 'Read as a number' },
      { field: 'days', original: 'Mon / Wed', cleaned: 'monday, wednesday', reason: 'Expanded to full weekdays' },
    ],
    course: {
      course_code: 'MATH201',
      course_name: 'Differential Equations',
      credits: 3,
      semester: 'Fall 2026',
      days: ['monday', 'wednesday'],
      start_time: '12:00',
      end_time: '13:15',
      room: null,
      instructor: {
        name: 'Prof. Hamad Al-Otaibi',
        email: 'h.alotaibi@ku.edu.kw',
        office: null,
        office_hours: 'By appointment',
      },
      ta: { name: null, email: null, office: null, office_hours: null },
      // The doubt markers are the point of the review screen, so the example
      // shows them rather than pretending every read is clean.
      uncertainFields: ['room', 'instructor_office'],
    },
  },
  {
    id: 'example-3',
    source: 'scan-photo.pdf',
    photoCount: 0,
    preview: true,
    failed: true,
    notes: [],
    cleaning: [],
    course: null,
  },
];

/** The course fields flattened into the shape the API and the manual form share. */
function serialiseCourse(course: ReadCourse) {
  return {
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
  };
}

/**
 * One syllabus, as read.
 *
 * Each card names the file it came from, because the whole point of uploading
 * five at once is knowing which of them produced the course you are looking
 * at — and, when one cannot be read, which file to photograph again.
 */
function DraftCard({
  draft, onUpdate, onUpdateContact, onRemove,
}: {
  draft: Draft;
  onUpdate: (patch: Partial<ReadCourse>) => void;
  onUpdateContact: (who: 'instructor' | 'ta', patch: Partial<ReadContact>) => void;
  onRemove: () => void;
}) {
  const { t, tf } = useI18n();
  const course = draft.course;

  const origin = draft.source
    ? tf(t.syllabusImport.fromFile, { name: draft.source })
    : tf(t.syllabusImport.fromPhotos, { n: draft.photoCount });

  // A file that could not be read still gets a card. Silence would leave the
  // student counting courses against files to work out which one is missing.
  if (!course) {
    return (
      <Card className="border-[var(--warning-border)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{origin}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {draft.failed ? t.syllabusImport.fileUnreadable : t.syllabusImport.noCourseInFile}
            </p>
          </div>
          <Badge tone={draft.preview ? 'neutral' : 'warning'} className="shrink-0">
            {draft.preview ? t.syllabusImport.previewBadge : t.common.notSet}
          </Badge>
        </div>
      </Card>
    );
  }

  const uncertain = (field: string) => course.uncertainFields.includes(field);
  const saved = Boolean(draft.savedId);

  return (
    <div className={cx('space-y-4', saved && 'opacity-60')}>
      <Card className="bg-[var(--bg-accent-soft)] border-[var(--border-subtle)]">
        <div className="flex items-center gap-4">
          <CourseTile code={course.course_code} name={course.course_name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold truncate">
              {course.course_code || t.syllabusImport.untitled}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] truncate">{course.course_name}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{origin}</p>
          </div>
          {draft.preview ? (
            <Badge tone="neutral" className="shrink-0">{t.syllabusImport.previewBadge}</Badge>
          ) : saved ? (
            <Badge tone="positive" className="shrink-0">{t.syllabi.completed}</Badge>
          ) : (
            <button
              type="button"
              onClick={onRemove}
              aria-label={t.syllabusImport.removeDraft}
              className="w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] shrink-0"
            >
              <Icon.trash size={15} />
            </button>
          )}
        </div>

        {draft.saveError ? (
          <p className="text-sm text-[var(--danger)] mt-3">
            {draft.saveError === 'duplicate_course'
              ? t.syllabusImport.duplicate
              : draft.saveError === 'invalid_course'
                ? t.courses.saveError
                : t.errors.generic}
          </p>
        ) : null}

        {draft.notes.length ? (
          <ul className="mt-3 space-y-1">
            {draft.notes.map((n) => (
              <li key={n} className="text-xs text-[var(--text-secondary)] flex gap-1.5">
                <span aria-hidden="true">·</span>{n}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {saved ? null : (
        <>
          <Card>
            <CardHeader title={t.syllabusImport.courseSection} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Doubtful label={t.courses.code} value={course.course_code} uncertain={uncertain('course_code')}
                onChange={(v) => onUpdate({ course_code: v })} />
              <Doubtful label={t.courses.name} value={course.course_name} uncertain={uncertain('course_name')}
                onChange={(v) => onUpdate({ course_name: v })} />
              <Doubtful label={t.courses.creditsLabel} type="number" value={course.credits === null ? '' : String(course.credits)}
                uncertain={uncertain('credits')} onChange={(v) => onUpdate({ credits: v === '' ? null : Number(v) })} />
              <Doubtful label={t.courses.semester} value={course.semester ?? ''} uncertain={uncertain('semester')}
                onChange={(v) => onUpdate({ semester: v || null })} />
              <Doubtful label={t.courses.startTime} type="time" value={course.start_time ?? ''} uncertain={uncertain('start_time')}
                onChange={(v) => onUpdate({ start_time: v || null })} />
              <Doubtful label={t.courses.endTime} type="time" value={course.end_time ?? ''} uncertain={uncertain('end_time')}
                onChange={(v) => onUpdate({ end_time: v || null })} />
              <Doubtful label={t.courses.room} value={course.room ?? ''} uncertain={uncertain('room')}
                onChange={(v) => onUpdate({ room: v || null })} className="sm:col-span-2" />
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
                      onClick={() => onUpdate({ days: on ? course.days.filter((x) => x !== d) : [...course.days, d] })}
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
            onChange={(patch) => onUpdateContact('instructor', patch)}
          />
          <ContactCard
            title={t.contacts.ta}
            subtitle={t.syllabusImport.taOptional}
            contact={course.ta}
            prefix="ta"
            uncertain={uncertain}
            onChange={(patch) => onUpdateContact('ta', patch)}
          />

          {draft.cleaning.length ? (
            <Card>
              <h3 className="text-sm font-semibold mb-2">{t.records.cleaningTitle}</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-3">{t.records.cleaningSub}</p>
              <ul className="space-y-2">
                {draft.cleaning.map((d, i) => (
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
        </>
      )}
    </div>
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
