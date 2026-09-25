import 'server-only';
import { pdfText, hasUsableText } from './pdf-text';

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
