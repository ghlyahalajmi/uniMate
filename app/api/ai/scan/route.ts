import { NextResponse } from 'next/server';
import { withUser, apiError } from '@/lib/api/helpers';
import { confirmScannedCourses } from '@/lib/workflows';
import { runAgent } from '@/lib/ai/run';
import { setupScanner } from '@/lib/ai/agents';
import { isAiConfigured } from '@/lib/ai/client';
import { MAX_UPLOAD_BYTES } from '@/lib/validation/schemas';
import type { Weekday } from '@/types/database';

/**
 * These agents call Claude with adaptive thinking, and the slowest of them —
 * reading a photographed timetable, or drafting a full practice set — take
 * well over the default function limit. Vercel kills the function at that
 * limit and the browser sees a bare 504 with no logged ai_run, so the ceiling
 * is raised here rather than discovered in production.
 */
export const maxDuration = 300;

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const;
type AllowedType = (typeof ALLOWED)[number];

/** Step one: read the image. Writes nothing but the ai_runs row. */
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

  const file = form.get('file');
  if (!(file instanceof File)) return apiError('invalid_request', 400);
  if (file.size > MAX_UPLOAD_BYTES) return apiError('file_too_large', 413);
  if (!ALLOWED.includes(file.type as AllowedType)) return apiError('file_type', 415);

  const data = Buffer.from(await file.arrayBuffer()).toString('base64');

  // Run the agent directly so the cleaning decisions come back with the
  // preview; the workflow wrapper only returns their count.
  const outcome = await runAgent(
    setupScanner,
    { data, mediaType: file.type as AllowedType },
    auth.ctx,
  );
  if (!outcome.ok) return apiError('scan_failed', 200);

  return NextResponse.json({
    ok: true,
    courses: outcome.data.courses,
    cleaning: outcome.data.cleaning,
    notes: outcome.data.notes,
  });
}

interface ConfirmBody {
  courses: Array<{
    course_code: string; course_name: string; instructor: string | null;
    credits: number | null; days: Weekday[]; start_time: string | null;
    end_time: string | null; room: string | null; semester: string | null;
  }>;
  cleaning?: Array<{ field: string; original: string; cleaned: string; reason: string; courseCode: string }>;
}

/** Step two: the student has reviewed the rows. Now write them. */
export async function PUT(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return apiError('invalid_request', 400);
  }

  if (!Array.isArray(body.courses) || body.courses.length === 0) {
    return apiError('invalid_request', 400);
  }
  if (body.courses.length > 30) return apiError('too_many', 400);

  const result = await confirmScannedCourses(auth.ctx, body.courses, body.cleaning ?? []);
  if (!result.ok) return apiError('save_failed', 200);

  return NextResponse.json({ ok: true, inserted: result.data?.inserted ?? 0 });
}
