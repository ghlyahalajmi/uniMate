import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pdfText, hasUsableText } from './pdf-text';
import { isReadableMaterial } from './limits';

/**
 * A stored file, in the form the agents take it.
 *
 * The one thing worth knowing here: a PDF keeps its bytes *and* carries the
 * text pulled out of it. The model wants the file — it can see the diagram
 * beside the paragraph, and the layout of a slide is part of what the slide
 * says. The deterministic path cannot see any of that and only needs the
 * words. Carrying both means neither is made worse to suit the other, and a
 * chapter that is a PDF stops being a chapter nothing can read when no model
 * is reachable.
 *
 * `text` is absent when there was nothing to find, which is the honest answer
 * for a scan: those pages are photographs, and their words are pixels.
 */
export type AgentDocument =
  | { kind: 'text'; text: string }
  | { kind: 'pdf'; data: string; text?: string }
  | { kind: 'image'; mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string };

export function documentFrom(fileType: string, buffer: Buffer): AgentDocument {
  if (fileType === 'application/pdf') {
    const text = pdfText(buffer);
    return {
      kind: 'pdf',
      data: buffer.toString('base64'),
      text: hasUsableText(text) ? text : undefined,
    };
  }

  if (fileType.startsWith('text/')) {
    return { kind: 'text', text: buffer.toString('utf8') };
  }

  return {
    kind: 'image',
    mediaType: fileType as 'image/png' | 'image/jpeg' | 'image/webp',
    data: buffer.toString('base64'),
  };
}

/** The words in a document, for the paths that cannot see a picture. */
export function readableText(document: AgentDocument | undefined): string {
  if (!document) return '';
  if (document.kind === 'text') return document.text;
  if (document.kind === 'pdf') return document.text ?? '';
  return '';
}

/** At most this many files, and this much text, for one practice set. */
const MAX_FILES = 4;
const MAX_CHARS = 120_000;

/**
 * The whole course's readable material, as one body of text.
 *
 * "Which chapter? — Mixed" has to mean every chapter, and it meant none: the
 * request carried no material id, the route fetched no file, and the offline
 * builder was handed nothing to read. A student who had uploaded their
 * chapter and asked for questions across all of it got the one answer that
 * made no sense — that there was nothing to ask about.
 *
 * Read through the student's own session, so row level security decides which
 * files these are; the course is checked as well, because a query is not a
 * permission.
 */
export async function courseText(
  supabase: SupabaseClient, userId: string, courseId: string,
): Promise<{ text: string; title: string } | null> {
  const { data } = await supabase
    .from('course_materials')
    .select('title, file_path, file_type')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .order('created_at', { ascending: true })
    .limit(MAX_FILES * 3);

  const rows = (data ?? []) as Array<{ title: string; file_path: string; file_type: string }>;
  const readable = rows.filter((r) => isReadableMaterial(r.file_type)).slice(0, MAX_FILES);
  if (readable.length === 0) return null;

  const pieces: string[] = [];
  let first = '';

  for (const row of readable) {
    if (pieces.join('').length >= MAX_CHARS) break;
    try {
      const file = await supabase.storage.from('materials').download(row.file_path);
      if (file.error || !file.data) continue;

      const buffer = Buffer.from(await file.data.arrayBuffer());
      const text = readableText(documentFrom(row.file_type, buffer));
      if (!text) continue;

      if (!first) first = row.title;
      pieces.push(text);
    } catch {
      // One unreadable file must not lose the others.
    }
  }

  if (pieces.length === 0) return null;

  return {
    text: pieces.join('\n\n').slice(0, MAX_CHARS),
    title: pieces.length === 1 ? first : `${first} and ${pieces.length - 1} more`,
  };
}
