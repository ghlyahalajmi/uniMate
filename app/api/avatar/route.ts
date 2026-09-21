import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { parseAvatar, parseAvatarKind } from '@/lib/avatar/design';

export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
};

/** Upload a photo and make it the account's picture. */
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

  const file = form.get('file');
  if (!(file instanceof File)) return apiError('invalid_request', 400);
  if (file.size > MAX_BYTES) return apiError('file_too_large', 413);
  if (!ALLOWED.has(file.type)) return apiError('file_type', 415);

  const path = `${userId}/${randomUUID()}.${EXT[file.type]}`;
  const upload = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) return apiError('save_failed', 200);

  // Read the old path before overwriting it, or the previous photo becomes a
  // file nothing points at and nobody can remove.
  const { data: before } = await supabase
    .from('profiles').select('avatar_path').eq('user_id', userId).maybeSingle();

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_kind: 'photo', avatar_path: path })
    .eq('user_id', userId);

  if (error) {
    await supabase.storage.from('avatars').remove([path]);
    return apiError('save_failed', 200);
  }

  const old = (before as { avatar_path?: string | null } | null)?.avatar_path;
  if (old && old !== path) await supabase.storage.from('avatars').remove([old]);

  return NextResponse.json({ ok: true });
}

/** Save a built avatar, or go back to initials. */
export async function PUT(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth.ctx;

  const body = await readJson<{ kind?: string; design?: unknown }>(request, 16 * 1024);
  const kind = parseAvatarKind(body?.kind);

  // A photo is set by uploading one, not by asking for it.
  if (kind === 'photo') return apiError('invalid_request', 400);

  const patch: Record<string, unknown> = { avatar_kind: kind };
  if (kind === 'character') {
    // Parsed rather than stored as sent: what reaches the column is a set of
    // known keys, so nothing a client invents can come back out later.
    patch.avatar_design = parseAvatar(body?.design);
  }

  const { error } = await supabase.from('profiles').update(patch).eq('user_id', userId);
  if (error) return apiError('save_failed', 200);
  return NextResponse.json({ ok: true });
}

/** Remove the photo and fall back to initials. */
export async function DELETE() {
  const auth = await withUser();
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth.ctx;

  const { data: before } = await supabase
    .from('profiles').select('avatar_path').eq('user_id', userId).maybeSingle();

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_kind: 'initials', avatar_path: null })
    .eq('user_id', userId);
  if (error) return apiError('save_failed', 200);

  const old = (before as { avatar_path?: string | null } | null)?.avatar_path;
  if (old) await supabase.storage.from('avatars').remove([old]);

  return NextResponse.json({ ok: true });
}
