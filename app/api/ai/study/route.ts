import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { workflowGenerateQuestions } from '@/lib/workflows';
import { studyRequestSchema } from '@/lib/validation/schemas';
import { createClient } from '@/lib/supabase/server';
import { isReadableMaterial } from '@/lib/materials/limits';
import type { StudyInput } from '@/lib/ai/agents';

type StudyDocument = NonNullable<StudyInput['document']>;

/**
 * These agents call Claude with adaptive thinking, and the slowest of them —
 * reading a photographed timetable, or drafting a full practice set — take
 * well over the default function limit. Vercel kills the function at that
 * limit and the browser sees a bare 504 with no logged ai_run, so the ceiling
 * is raised here rather than discovered in production.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<unknown>(request, 64 * 1024);
  const parsed = studyRequestSchema.safeParse(body);
  if (!parsed.success) return apiError('invalid_request', 400, parsed.error.issues[0]?.message);

  // A chapter, when the student picked one. Fetched here from the path on the
  // row rather than accepted from the browser, so a hand-edited request cannot
  // set practice on a file belonging to someone else.
  let document: StudyDocument | undefined;
  let chapterTitle: string | undefined;

  if (parsed.data.material_id) {
    const { data: material } = await auth.ctx.supabase
      .from('course_materials')
      .select('title, file_path, file_type, course_id')
      .eq('id', parsed.data.material_id)
      .eq('user_id', auth.ctx.userId)
      .maybeSingle();

    const m = material as
      | { title: string; file_path: string; file_type: string; course_id: string }
      | null;

    if (m && m.course_id === parsed.data.course_id && isReadableMaterial(m.file_type)) {
      const file = await auth.ctx.supabase.storage.from('materials').download(m.file_path);
      if (!file.error && file.data) {
        const buffer = Buffer.from(await file.data.arrayBuffer());
        chapterTitle = m.title;
        document =
          m.file_type === 'application/pdf'
            ? { kind: 'pdf', data: buffer.toString('base64') }
            : m.file_type.startsWith('text/')
              ? { kind: 'text', text: buffer.toString('utf8') }
              : {
                  kind: 'image',
                  mediaType: m.file_type as 'image/png' | 'image/jpeg' | 'image/webp',
                  data: buffer.toString('base64'),
                };
      }
    }
  }

  const result = await workflowGenerateQuestions(auth.ctx, {
    courseId: parsed.data.course_id,
    mode: parsed.data.mode,
    difficulty: parsed.data.difficulty,
    format: parsed.data.format,
    topic: parsed.data.topic,
    materialId: document ? parsed.data.material_id : undefined,
    document,
    chapterTitle,
  });
  if (!result.ok || !result.data) return apiError('generation_failed', 200);

  // Return the saved rows so the client renders exactly what is stored.
  const supabase = await createClient();
  const { data: questions } = await supabase
    .from('questions').select('*').eq('session_id', result.data.sessionId).order('created_at');

  return NextResponse.json({
    ok: true,
    sessionId: result.data.sessionId,
    questions: questions ?? [],
  });
}
