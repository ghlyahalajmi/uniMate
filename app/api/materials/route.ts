import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import {
  MAX_MATERIALS, MAX_MATERIAL_BYTES, MAX_MATERIAL_TOTAL_BYTES,
  MATERIAL_EXTENSIONS, isAllowedMaterial,
} from '@/lib/materials/limits';

/**
 * Course materials: the slides and chapter handouts a course is taught from.
 *
 * The file itself goes to the private `materials` bucket under
 * `<user-id>/<course-id>/`, which is the prefix the storage policy checks, and
 * a row records what the student calls it. The thirty-per-course ceiling is
 * enforced by a trigger, so this route reports that refusal rather than
 * trying to be the one that counts.
 */

export const maxDuration = 120;

const MAX_FILES_PER_REQUEST = MAX_MATERIALS;

/** Strips the extension so the default title reads like a chapter name. */
function titleFrom(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, '').trim();
  return (withoutExt || fileName).slice(0, 200);
}

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth.ctx;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError('invalid_request', 400);
  }

  const courseId = String(form.get('courseId') ?? '');
  if (!courseId) return apiError('invalid_request', 400);

  // The course must be one of theirs. RLS would refuse the insert anyway, but
  // a 404 here is a clearer answer than a foreign-key error.
  const { data: course } = await supabase
    .from('courses').select('id').eq('id', courseId).eq('user_id', userId).maybeSingle();
  if (!course) return apiError('not_found', 404);

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return apiError('invalid_request', 400);
  if (files.length > MAX_FILES_PER_REQUEST) return apiError('too_many_files', 400);

  let total = 0;
  for (const file of files) {
    if (file.size > MAX_MATERIAL_BYTES) return apiError('file_too_large', 413);
    if (!isAllowedMaterial(file.type)) return apiError('file_type', 415);
    total += file.size;
  }
  if (total > MAX_MATERIAL_TOTAL_BYTES) return apiError('file_too_large', 413);

  // Refuse the whole upload when it cannot fit, rather than storing the first
  // few and failing partway — a half-uploaded chapter list is worse than a
  // clear "there is only room for four more".
  const { count } = await supabase
    .from('course_materials')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId);
  const used = count ?? 0;
  if (used + files.length > MAX_MATERIALS) {
    return NextResponse.json(
      { ok: false, error: 'material_limit', remaining: Math.max(0, MAX_MATERIALS - used) },
      { status: 200 },
    );
  }

  const saved: Array<{ id: string; title: string; file_name: string }> = [];
  const failed: Array<{ file_name: string; error: string }> = [];

  for (const [i, file] of files.entries()) {
    const ext = MATERIAL_EXTENSIONS[file.type] ?? 'bin';
    const path = `${userId}/${courseId}/${randomUUID()}.${ext}`;

    const upload = await supabase.storage
      .from('materials')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (upload.error) {
      failed.push({ file_name: file.name, error: 'upload_failed' });
      continue;
    }

    const { data, error } = await supabase
      .from('course_materials')
      .insert({
        user_id: userId,
        course_id: courseId,
        title: titleFrom(file.name),
        file_name: file.name,
        file_path: path,
        file_type: file.type,
        size_bytes: file.size,
        position: used + i,
      })
      .select('id, title, file_name')
      .single();

    if (error || !data) {
      // The row is what makes the object reachable, so an object with no row
      // is litter in the bucket. Remove it rather than leave it billing.
      await supabase.storage.from('materials').remove([path]);
      failed.push({ file_name: file.name, error: 'save_failed' });
      continue;
    }

    saved.push(data as { id: string; title: string; file_name: string });
  }

  return NextResponse.json({ ok: saved.length > 0, saved, failed });
}

/** Rename a chapter, or move it in the list. */
export async function PATCH(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ id?: string; title?: string; position?: number }>(request, 16 * 1024);
  if (!body?.id) return apiError('invalid_request', 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.title === 'string') {
    const title = body.title.trim().slice(0, 200);
    if (!title) return apiError('invalid_request', 400);
    patch.title = title;
  }
  if (typeof body.position === 'number' && Number.isFinite(body.position)) {
    patch.position = Math.max(0, Math.trunc(body.position));
  }
  if (Object.keys(patch).length === 0) return apiError('invalid_request', 400);

  const { error } = await auth.ctx.supabase
    .from('course_materials')
    .update(patch)
    .eq('id', body.id)
    .eq('user_id', auth.ctx.userId);

  if (error) return apiError('save_failed', 200);
  return NextResponse.json({ ok: true });
}

/** Remove a chapter, and the file behind it. */
export async function DELETE(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth.ctx;

  const body = await readJson<{ id?: string }>(request, 16 * 1024);
  if (!body?.id) return apiError('invalid_request', 400);

  // Read the path first: once the row is gone there is nothing left pointing
  // at the object, and it would sit in the bucket forever.
  const { data: row } = await supabase
    .from('course_materials')
    .select('file_path')
    .eq('id', body.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!row) return apiError('not_found', 404);

  const { error } = await supabase
    .from('course_materials').delete().eq('id', body.id).eq('user_id', userId);
  if (error) return apiError('save_failed', 200);

  await supabase.storage.from('materials').remove([(row as { file_path: string }).file_path]);
  return NextResponse.json({ ok: true });
}
