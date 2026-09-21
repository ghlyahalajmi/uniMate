/**
 * Deciding how many syllabuses an upload actually contains.
 *
 * The screen used to treat every file as a page of one document, because a
 * syllabus is often photographed a page at a time. That is still true of
 * photos — but a student holding five PDFs is holding five courses, and making
 * them upload and confirm each one separately is busywork the app can do.
 *
 * So the rule is drawn where the file format already draws it:
 *
 *   - **A PDF is a whole document.** One PDF is one syllabus is one course,
 *     however many pages are inside it.
 *   - **Photos are pages.** Phone cameras produce one image per page, and
 *     nothing in a JPEG says which syllabus it came from, so images are read
 *     together as a single document.
 *
 * The alternative — asking the model to split a merged pile — trades a rule
 * the student can predict for a guess they cannot, and gets it wrong on the
 * day two of their courses share an instructor.
 *
 * This module is pure so the rule can be tested without files or a network.
 */

/** The little an upload needs to expose for grouping. */
export interface UploadedFile {
  name: string;
  type: string;
}

/** One syllabus: the files that make it up, and what to call it on screen. */
export interface SyllabusGroup<T extends UploadedFile> {
  /** What the student sees while reviewing — a filename, or a count of photos. */
  label: string;
  files: T[];
}

export const PDF_TYPE = 'application/pdf';

export function isPdf(file: UploadedFile): boolean {
  return file.type === PDF_TYPE;
}

/**
 * Split an upload into one group per syllabus, in the order the student
 * chose the files.
 *
 * `photoLabel` names the image group; the caller passes a translated string
 * because this module has no dictionary of its own.
 */
export function groupSyllabuses<T extends UploadedFile>(
  files: readonly T[],
  photoLabel: (count: number) => string,
): SyllabusGroup<T>[] {
  const groups: SyllabusGroup<T>[] = [];
  const photos: T[] = [];

  for (const file of files) {
    if (isPdf(file)) groups.push({ label: file.name, files: [file] });
    else photos.push(file);
  }

  // The photos go last: a PDF names itself, so the group that needs explaining
  // is better read after the ones that do not.
  if (photos.length > 0) {
    groups.push({ label: photoLabel(photos.length), files: photos });
  }

  return groups;
}

/** How many courses this upload will try to create. */
export function countSyllabuses(files: readonly UploadedFile[]): number {
  const pdfs = files.filter(isPdf).length;
  const hasPhotos = files.length > pdfs;
  return pdfs + (hasPhotos ? 1 : 0);
}
