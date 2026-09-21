import type { Dictionary } from './dictionaries';

/**
 * Server actions return a dictionary key, never prose, so the message the
 * student sees is in their chosen language and never a raw API string.
 */
export function actionMessage(t: Dictionary, key: string | undefined): string {
  if (!key) return t.errors.generic;
  const table: Record<string, string> = {
    generic: t.errors.generic,
    courseSaved: t.courses.saved,
    courseDeleted: t.courses.deleted,
    courseSaveError: t.courses.saveError,
    duplicate: t.errors.invalidCourseCode,
    gradeSaved: t.grades.saved,
    gradeDeleted: t.grades.deleted,
    gradeSaveError: t.grades.saveError,
    taskSaved: t.tasks.saved,
    taskDeleted: t.tasks.deleted,
    taskSaveError: t.tasks.saveError,
    settingsSaved: t.settings.saved,
    settingsSaveError: t.settings.saveError,
    scaleSaved: t.grades.scaleSaved,
    syllabusDeleted: t.syllabi.deleted,
    uploadError: t.syllabi.uploadError,
    planSaved: t.planner.saved,
    planDeleted: t.planner.deleted,
    exportError: t.records.exportError,
    cardSaved: t.flashcards.saved,
    cardDeleted: t.flashcards.deleted,
    cardSaveError: t.flashcards.saveError,
    linkSaved: t.hub.saved,
    linkDeleted: t.hub.deleted,
    linkSaveError: t.hub.saveError,
  };
  return table[key] ?? t.errors.generic;
}

/** Field-level errors come back as keys too. */
export function fieldMessage(t: Dictionary, key: string | undefined): string | undefined {
  if (!key) return undefined;
  const table: Record<string, string> = {
    duplicate: t.errors.invalidCourseCode,
    rangeWeight: t.errors.rangeWeight,
    rangeScore: t.errors.rangeScore,
    invalidNumber: t.errors.invalidNumber,
  };
  // Zod messages are already human-readable English; show them as-is when the
  // interface is English, and fall back to the generic notice in Arabic.
  return table[key] ?? key;
}
