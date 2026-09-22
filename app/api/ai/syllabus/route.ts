import { NextResponse } from 'next/server';
import { withUser, apiError } from '@/lib/api/helpers';
import { workflowProcessSyllabus } from '@/lib/workflows';
import { MAX_UPLOAD_BYTES } from '@/lib/validation/schemas';

/**
 * These agents call Claude with adaptive thinking, and the slowest of them —
 * reading a photographed timetable, or drafting a full practice set — take
 * well over the default function limit. Vercel kills the function at that
 * limit and the browser sees a bare 504 with no logged ai_run, so the ceiling
 * is raised here rather than discovered in production.
 */
export const maxDuration = 300;

const IMAGE = ['image/png', 'image/jpeg', 'image/webp'] as const;
const ALLOWED = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  ...IMAGE,
];

/**
 * Upload → store the file → record the row → run the analyst → store what it
 * found → create reminders. Each stage is recoverable: a failed analysis
 * leaves a `failed` syllabus row with a readable message, not a missing one.
 */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError('invalid_request', 400);
  }

  const file = form.get('file');
  const courseId = form.get('course_id') ? String(form.get('course_id')) : null;
  const courseHint = form.get('course_hint') ? String(form.get('course_hint')) : undefined;

  if (!(file instanceof File)) return apiError('invalid_request', 400);
  if (file.size > MAX_UPLOAD_BYTES) return apiError('file_too_large', 413);
  if (!ALLOWED.includes(file.type)) return apiError('file_type', 415);

  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = `${auth.ctx.userId}/${Date.now()}-${sanitise(file.name)}`;

  // Keep the original in private storage, under the user's own prefix.
  const { error: uploadError } = await auth.ctx.supabase.storage
    .from('syllabi')
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  const { data: row, error: insertError } = await auth.ctx.supabase
    .from('syllabi')
    .insert({
      user_id: auth.ctx.userId,
      course_id: courseId,
      file_name: file.name.slice(0, 200),
      file_type: file.type,
      file_url: uploadError ? null : storagePath,
      processing_status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !row) return apiError('save_failed', 200);

  const document =
    IMAGE.includes(file.type as (typeof IMAGE)[number])
      ? { kind: 'image' as const, mediaType: file.type as (typeof IMAGE)[number], data: bytes.toString('base64') }
      : file.type === 'application/pdf'
        ? { kind: 'pdf' as const, data: bytes.toString('base64') }
        // Word and plain text: read the extractable text out of the bytes.
        : { kind: 'text' as const, text: extractText(bytes) };

  const result = await workflowProcessSyllabus(auth.ctx, {
    syllabusId: row.id,
    courseId,
    courseHint,
    document,
  });

  return NextResponse.json({
    ok: true,
    id: row.id,
    processed: result.ok,
    events: result.data?.events ?? 0,
    topics: result.data?.topics ?? 0,
  });
}

function sanitise(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'upload';
}

/**
 * DOCX is a zip, so its bytes are not readable text. We pull out whatever
 * printable runs exist and let the analyst work with that; when there is
 * nothing usable the workflow marks the row failed with a clear message
 * rather than inventing content.
 */
function extractText(bytes: Buffer): string {
  const raw = bytes.toString('utf8');
  const printable = raw.replace(/[^\x09\x0A\x0D\x20-\x7E -￿]+/g, ' ');
  return printable.replace(/\s{3,}/g, '\n').trim().slice(0, 120_000);
}
