import { NextResponse } from 'next/server';
import { withUser, apiError } from '@/lib/api/helpers';
import { confirmSyllabusCourse, type SyllabusCourseDraft } from '@/lib/workflows';
import { runAgent } from '@/lib/ai/run';
import { syllabusCourseReader, type SyllabusPage } from '@/lib/ai/agents';
import { isAiConfigured } from '@/lib/ai/client';
import { courseSchema, MAX_UPLOAD_BYTES } from '@/lib/validation/schemas';

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const;
type AllowedType = (typeof ALLOWED)[number];

/** A syllabus photographed page by page is still one syllabus, but not an unbounded one. */
const MAX_PAGES = 8;
/** The per-file ceiling is MAX_UPLOAD_BYTES; this caps the whole upload. */
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

/** Step one: read the pages. Writes nothing but the ai_runs row. */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;
  if (!isAiConfigured()) return apiError('ai_not_configured', 200);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError('invalid_request', 400);
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return apiError('invalid_request', 400);
  if (files.length > MAX_PAGES) return apiError('too_many_pages', 400);

  let total = 0;
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) return apiError('file_too_large', 413);
    if (!ALLOWED.includes(file.type as AllowedType)) return apiError('file_type', 415);
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) return apiError('file_too_large', 413);

  const pages: SyllabusPage[] = await Promise.all(
    files.map(async (file) => {
      const data = Buffer.from(await file.arrayBuffer()).toString('base64');
      return file.type === 'application/pdf'
        ? ({ kind: 'pdf', data } as const)
        : ({ kind: 'image', mediaType: file.type as Exclude<AllowedType, 'application/pdf'>, data } as const);
    }),
  );

  const outcome = await runAgent(syllabusCourseReader, { pages }, auth.ctx);
  if (!outcome.ok) return apiError('scan_failed', 200);

  return NextResponse.json({
    ok: true,
    course: outcome.data.course,
    cleaning: outcome.data.cleaning,
    notes: outcome.data.notes,
  });
}

interface ConfirmBody {
  course: Record<string, unknown>;
  cleaning?: Array<{ field: string; original: string; cleaned: string; reason: string }>;
}

/** Step two: the student has reviewed the course. Now write it. */
export async function PUT(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return apiError('invalid_request', 400);
  }
  if (!body.course || typeof body.course !== 'object') return apiError('invalid_request', 400);

  // The same schema the manual form uses, so a course created from a syllabus
  // cannot reach the table in a shape the form would have rejected.
  const parsed = courseSchema.safeParse(body.course);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError('invalid_course', 422, first ? `${first.path.join('.')}: ${first.message}` : undefined);
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

  const result = await confirmSyllabusCourse(auth.ctx, draft, body.cleaning ?? []);
  if (!result.ok) {
    return result.error === 'duplicate_course'
      ? apiError('duplicate_course', 200)
      : apiError('save_failed', 200);
  }

  return NextResponse.json({ ok: true, courseId: result.data?.courseId });
}
