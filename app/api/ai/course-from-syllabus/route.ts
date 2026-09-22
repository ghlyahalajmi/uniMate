import { NextResponse } from 'next/server';
import { withUser, apiError } from '@/lib/api/helpers';
import { confirmSyllabusCourse, type SyllabusCourseDraft } from '@/lib/workflows';
import { runAgent } from '@/lib/ai/run';
import { syllabusCourseReader, type SyllabusPage } from '@/lib/ai/agents';
import { isAiConfigured } from '@/lib/ai/client';
import { courseSchema, MAX_UPLOAD_BYTES } from '@/lib/validation/schemas';
import { groupSyllabuses, type UploadedFile } from '@/lib/syllabus/grouping';

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const;
type AllowedType = (typeof ALLOWED)[number];

/** Files in one upload. Photographed syllabuses run to several pages each. */
const MAX_FILES = 16;
/** Courses one upload may create. Each costs a full document read. */
const MAX_SYLLABI = 8;
/** The per-file ceiling is MAX_UPLOAD_BYTES; this caps the whole upload. */
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
/**
 * Document reads running at once.
 *
 * Each one is a long vision call, so firing eight together is the difference
 * between one provider rate-limit and none. Three keeps a five-syllabus
 * upload well inside the function's 300s ceiling while staying polite.
 */
const CONCURRENCY = 3;

/** Runs `worker` over `items`, at most `limit` at a time, preserving order. */
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

/**
 * Step one: read the upload. Writes nothing but the ai_runs rows.
 *
 * The upload is split into one syllabus per PDF, with any photos read together
 * as a single document, and each syllabus gets its own agent run. Separate
 * runs rather than one big one is the point: a model given five syllabuses at
 * once blends them — the wrong instructor against the wrong course code — and
 * one unreadable scan takes the other four down with it. Run apart, a failure
 * is reported against the file it came from and the rest still arrive.
 */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;
  if (!(await isAiConfigured())) return apiError('ai_not_configured', 200);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError('invalid_request', 400);
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return apiError('invalid_request', 400);
  if (files.length > MAX_FILES) return apiError('too_many_files', 400);

  let total = 0;
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) return apiError('file_too_large', 413);
    if (!ALLOWED.includes(file.type as AllowedType)) return apiError('file_type', 415);
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) return apiError('file_too_large', 413);

  // Group before reading anything, so an upload that asks for too many
  // courses is refused before it costs a single document read.
  const described: Array<UploadedFile & { file: File }> =
    files.map((f) => ({ name: f.name, type: f.type, file: f }));
  const groups = groupSyllabuses(described, (n) => `photos:${n}`);
  if (groups.length > MAX_SYLLABI) return apiError('too_many_syllabi', 400);

  const results = await mapLimit(groups, CONCURRENCY, async (group) => {
    // `source` is what the student called the file. It is the only way to tell
    // them which of five uploads produced which course, or which one failed.
    const source = group.files.length === 1 && group.files[0].type === 'application/pdf'
      ? group.files[0].name
      : null;
    const photoCount = source === null ? group.files.length : 0;
    const unreadable = { source, photoCount, course: null, cleaning: [], notes: [], failed: true };

    // One corrupt file must cost its own card and nothing else. Without this,
    // a truncated PDF rejects the whole batch and the four good syllabuses
    // beside it are lost to a 500 the student cannot act on.
    try {
      const pages: SyllabusPage[] = await Promise.all(
        group.files.map(async (entry) => {
          const data = Buffer.from(await entry.file.arrayBuffer()).toString('base64');
          return entry.type === 'application/pdf'
            ? ({ kind: 'pdf', data } as const)
            : ({
                kind: 'image',
                mediaType: entry.type as Exclude<AllowedType, 'application/pdf'>,
                data,
              } as const);
        }),
      );

      const outcome = await runAgent(syllabusCourseReader, { pages }, auth.ctx);
      if (!outcome.ok) return unreadable;

      return {
        source,
        photoCount,
        course: outcome.data.course,
        cleaning: outcome.data.cleaning,
        notes: outcome.data.notes,
        failed: false,
      };
    } catch {
      return unreadable;
    }
  });

  // Every syllabus failing is a failed request; some failing is a result the
  // student should see, with the ones that worked still in it.
  if (results.every((r) => r.failed)) return apiError('scan_failed', 200);

  return NextResponse.json({
    ok: true,
    results,
    // One course under the old key as well, so a client that has not been
    // reloaded since the deploy still works instead of showing nothing.
    course: results[0]?.course ?? null,
    cleaning: results[0]?.cleaning ?? [],
    notes: results[0]?.notes ?? [],
  });
}

type Cleaning = Array<{ field: string; original: string; cleaned: string; reason: string }>;

interface ConfirmEntry {
  course: Record<string, unknown>;
  cleaning?: Cleaning;
  /** Echoed back so the client can match an outcome to the card that produced it. */
  source?: string | null;
}

interface ConfirmBody {
  /** The batch. A single `course` is still accepted for one-at-a-time saves. */
  courses?: ConfirmEntry[];
  course?: Record<string, unknown>;
  cleaning?: Cleaning;
}

/** What happened to one course in the batch. */
interface SaveOutcome {
  source: string | null;
  course_code: string;
  ok: boolean;
  courseId?: string;
  error?: 'duplicate_course' | 'invalid_course' | 'save_failed';
  detail?: string;
}

/**
 * Step two: the student has reviewed what was read. Now write it.
 *
 * Saved one at a time rather than in a single transaction, and deliberately:
 * a duplicate course code in the fourth syllabus is a normal thing to hit when
 * someone imports a whole semester, and rolling back the three good ones over
 * it would be worse than useless. Each course reports its own outcome and the
 * student retries only what did not land.
 */
export async function PUT(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return apiError('invalid_request', 400);
  }

  const entries: ConfirmEntry[] = Array.isArray(body.courses)
    ? body.courses
    : body.course
      ? [{ course: body.course, cleaning: body.cleaning }]
      : [];

  if (entries.length === 0) return apiError('invalid_request', 400);
  if (entries.length > MAX_SYLLABI) return apiError('too_many_syllabi', 400);

  const results: SaveOutcome[] = [];

  for (const entry of entries) {
    const source = entry.source ?? null;
    const codeForReport =
      typeof entry.course?.course_code === 'string' ? entry.course.course_code : '';

    if (!entry.course || typeof entry.course !== 'object') {
      results.push({ source, course_code: codeForReport, ok: false, error: 'invalid_course' });
      continue;
    }

    // The same schema the manual form uses, so a course created from a
    // syllabus cannot reach the table in a shape the form would have rejected.
    const parsed = courseSchema.safeParse(entry.course);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      results.push({
        source,
        course_code: codeForReport,
        ok: false,
        error: 'invalid_course',
        detail: first ? `${first.path.join('.')}: ${first.message}` : undefined,
      });
      continue;
    }
    const v = parsed.data;

    const draft: SyllabusCourseDraft = {
      course_code: v.course_code,
      course_name: v.course_name,
      credits: v.credits,
      semester: v.semester,
      days: v.days,
      start_time: v.start_time,
      end_time: v.end_time,
      room: v.room,
      instructor: v.instructor,
      instructor_email: v.instructor_email,
      instructor_office: v.instructor_office,
      instructor_office_hours: v.instructor_office_hours,
      ta_name: v.ta_name,
      ta_email: v.ta_email,
      ta_office: v.ta_office,
      ta_office_hours: v.ta_office_hours,
      color: v.color ?? null,
    };

    const result = await confirmSyllabusCourse(auth.ctx, draft, entry.cleaning ?? []);
    if (!result.ok) {
      results.push({
        source,
        course_code: v.course_code,
        ok: false,
        error: result.error === 'duplicate_course' ? 'duplicate_course' : 'save_failed',
      });
      continue;
    }

    results.push({ source, course_code: v.course_code, ok: true, courseId: result.data?.courseId });
  }

  const saved = results.filter((r) => r.ok);

  // A one-course save keeps the shape its caller expects, including the error
  // codes, so nothing that already worked has to change.
  if (!Array.isArray(body.courses)) {
    const only = results[0];
    if (!only.ok) {
      return only.error === 'duplicate_course'
        ? apiError('duplicate_course', 200)
        : only.error === 'invalid_course'
          ? apiError('invalid_course', 422, only.detail)
          : apiError('save_failed', 200);
    }
    return NextResponse.json({ ok: true, courseId: only.courseId, results });
  }

  return NextResponse.json({
    ok: saved.length > 0,
    saved: saved.length,
    failed: results.length - saved.length,
    results,
    // Where to send the student when exactly one course was created.
    courseId: saved.length === 1 ? saved[0].courseId : undefined,
  });
}
