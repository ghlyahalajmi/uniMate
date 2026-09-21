import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { previewApply, applySyllabus } from '@/lib/syllabus/service';

interface Body {
  syllabus_id?: string;
  course_id?: string | null;
  /** true asks what would change; false performs it. */
  preview?: boolean;
}

/**
 * Reads what a syllabus would add to a course, and on a second call adds it.
 *
 * Deliberately two steps. Everything here is read from a document by a model,
 * and assessment weights feed the grade and GPA arithmetic — so the student
 * sees the exact rows first, the same way the timetable scanner shows the
 * courses it found before saving any of them.
 */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<Body>(request, 8 * 1024);
  const syllabusId = String(body?.syllabus_id ?? '');
  if (!syllabusId) return apiError('invalid_request', 400);

  const courseId = body?.course_id ? String(body.course_id) : null;

  if (body?.preview !== false) {
    const plan = await previewApply(syllabusId, courseId);
    if (!plan) return apiError('not_found', 404);
    return NextResponse.json({ ok: true, plan });
  }

  const result = await applySyllabus(syllabusId, courseId);
  if (!result.ok) return apiError(result.reason ?? 'save_failed', result.reason === 'not_found' ? 404 : 200);

  return NextResponse.json({
    ok: true,
    created: result.created,
    updatedFields: result.updatedFields,
  });
}
