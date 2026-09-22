import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { runAgent } from '@/lib/ai/run';
import { chapterReview, type ReviewDocument } from '@/lib/ai/agents';
import { loadStudentContext, weakTopics } from '@/lib/ai/context';
import { isAiConfigured } from '@/lib/ai/client';
import { isReadableMaterial } from '@/lib/materials/limits';

/** Reading a chapter properly is a long call; the default limit cuts it off. */
export const maxDuration = 300;

/**
 * Write a revision note for one uploaded chapter.
 *
 * The file is fetched here rather than sent by the browser: the client already
 * has it, but trusting an upload would let any file be passed off as a chapter
 * of a course the student does not own. Reading it back from storage by its
 * recorded path means the row, and therefore row level security, decides what
 * can be reviewed.
 */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;
  if (!(await isAiConfigured())) return apiError('ai_not_configured', 200);

  const body = await readJson<{ materialId?: string }>(request, 16 * 1024);
  if (!body?.materialId) return apiError('invalid_request', 400);

  const { supabase, userId } = auth.ctx;

  const { data: material } = await supabase
    .from('course_materials')
    .select('id, course_id, title, file_path, file_type')
    .eq('id', body.materialId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!material) return apiError('not_found', 404);

  const m = material as {
    id: string; course_id: string; title: string; file_path: string; file_type: string;
  };

  if (!isReadableMaterial(m.file_type)) return apiError('not_readable', 200);

  const { data: course } = await supabase
    .from('courses')
    .select('course_code, course_name')
    .eq('id', m.course_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!course) return apiError('not_found', 404);

  const file = await supabase.storage.from('materials').download(m.file_path);
  if (file.error || !file.data) return apiError('file_missing', 200);

  const buffer = Buffer.from(await file.data.arrayBuffer());

  const document: ReviewDocument =
    m.file_type === 'application/pdf'
      ? { kind: 'pdf', data: buffer.toString('base64') }
      : m.file_type.startsWith('text/')
        ? { kind: 'text', text: buffer.toString('utf8') }
        : {
            kind: 'image',
            mediaType: m.file_type as 'image/png' | 'image/jpeg' | 'image/webp',
            data: buffer.toString('base64'),
          };

  // What this student keeps getting wrong, so the review slows down there.
  // A failure to work it out must not cost them the review itself.
  let weak: string[] = [];
  try {
    const context = await loadStudentContext(supabase, userId);
    weak = weakTopics(context, m.course_id)
      .filter((w) => w.rate < 0.7)
      .slice(0, 5)
      .map((w) => w.topic);
  } catch {
    weak = [];
  }

  const c = course as { course_code: string; course_name: string };
  const outcome = await runAgent(
    chapterReview,
    {
      courseCode: c.course_code,
      courseName: c.course_name,
      chapterTitle: m.title,
      document,
      weakTopics: weak,
    },
    auth.ctx,
  );

  if (!outcome.ok) return apiError('review_failed', 200);
  return NextResponse.json({ ok: true, review: outcome.data, chapterTitle: m.title });
}
