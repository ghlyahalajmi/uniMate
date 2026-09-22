import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { runAgent } from '@/lib/ai/run';
import { flashcardWriter, type FlashcardInput } from '@/lib/ai/agents';
import { loadStudentContext } from '@/lib/ai/context';
import { isReadableMaterial } from '@/lib/materials/limits';
import { MODE_SIZES, type PracticeMode } from '@/lib/study/modes';

export const maxDuration = 300;

type Document = NonNullable<FlashcardInput['document']>;

const MODES = new Set<PracticeMode>(['quick_5', 'standard_10', 'deep_20', 'exam_mode']);

/**
 * Write a deck and keep it.
 *
 * Separate from /api/ai/study because the destinations differ: a question set
 * becomes a session the student answers now, a deck becomes rows in
 * `flashcards` that come back on a schedule. Sharing a route would mean one
 * response shape pretending to be both.
 */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    course_id?: string; mode?: string; material_id?: string; topic?: string;
  }>(request, 32 * 1024);

  if (!body?.course_id) return apiError('invalid_request', 400);

  const { supabase, userId } = auth.ctx;

  const { data: course } = await supabase
    .from('courses')
    .select('id, course_code, course_name')
    .eq('id', body.course_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!course) return apiError('not_found', 404);
  const c = course as { id: string; course_code: string; course_name: string };

  // Same fetch-it-here rule as practice: the path on the row is what decides
  // which file may be read, not anything the browser sends.
  let document: Document | undefined;
  let chapterTitle: string | undefined;

  if (body.material_id) {
    const { data: material } = await supabase
      .from('course_materials')
      .select('title, file_path, file_type, course_id')
      .eq('id', body.material_id)
      .eq('user_id', userId)
      .maybeSingle();

    const m = material as
      | { title: string; file_path: string; file_type: string; course_id: string }
      | null;

    if (m && m.course_id === c.id && isReadableMaterial(m.file_type)) {
      const file = await supabase.storage.from('materials').download(m.file_path);
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

  const mode = MODES.has(body.mode as PracticeMode) ? (body.mode as PracticeMode) : 'standard_10';
  const context = await loadStudentContext(supabase, userId);

  const outcome = await runAgent(
    flashcardWriter,
    {
      context,
      courseId: c.id,
      courseCode: c.course_code,
      courseName: c.course_name,
      count: MODE_SIZES[mode],
      document,
      chapterTitle,
      topic: body.topic?.trim() || undefined,
    },
    auth.ctx,
  );

  if (!outcome.ok) return apiError('generation_failed', 200);

  const cards = outcome.data.cards
    .filter((card) => card.front?.trim() && card.back?.trim())
    .slice(0, MODE_SIZES[mode]);

  if (cards.length === 0) return apiError('generation_failed', 200);

  // New cards start in box 1 and are due today: a deck you have to wait a day
  // to open is a deck you forget you made.
  const today = new Date().toISOString().slice(0, 10);

  const { data: saved, error } = await supabase
    .from('flashcards')
    .insert(cards.map((card) => ({
      user_id: userId,
      course_id: c.id,
      front: card.front.trim().slice(0, 1000),
      back: card.back.trim().slice(0, 2000),
      topic: card.topic?.trim().slice(0, 200) || chapterTitle || null,
      source: 'generated',
      box: 1,
      due_on: today,
    })))
    .select('id');

  if (error) return apiError('save_failed', 200);

  return NextResponse.json({
    ok: true,
    created: saved?.length ?? 0,
    rationale: outcome.data.rationale,
  });
}
