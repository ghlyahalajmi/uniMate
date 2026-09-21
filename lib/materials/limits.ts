/**
 * What a course may hold, and what an agent can read.
 *
 * Shared because three places need the same answer: the trigger's ceiling is
 * mirrored here for the form, the route validates uploads against it, and the
 * study screens use `isReadable` to decide what to offer as revisable. A route
 * file cannot export these itself — Next.js only allows its own fields there.
 */

/** Files per course. The database enforces this; the form only explains it. */
export const MAX_MATERIALS = 30;

/** Per file, and per request in total. */
export const MAX_MATERIAL_BYTES = 25 * 1024 * 1024;
export const MAX_MATERIAL_TOTAL_BYTES = 120 * 1024 * 1024;

/** Everything a student may store against a course. */
export const ALLOWED_MATERIAL_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/png', 'image/jpeg', 'image/webp',
  'text/plain', 'text/markdown',
] as const;

export const MATERIAL_ACCEPT = ALLOWED_MATERIAL_TYPES.join(',');

/**
 * What an agent can actually read.
 *
 * A PowerPoint file is a zip of XML, and handing one to a vision model gets
 * nothing useful back, so those are stored and listed but never offered as
 * something to revise from. Saying that plainly beats silently producing an
 * empty review.
 */
const READABLE_TYPES = new Set<string>([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'text/plain', 'text/markdown',
]);

export function isReadableMaterial(fileType: string): boolean {
  return READABLE_TYPES.has(fileType);
}

export function isAllowedMaterial(fileType: string): boolean {
  return (ALLOWED_MATERIAL_TYPES as readonly string[]).includes(fileType);
}

/** Storage extension for a stored type, so a path keeps a meaningful suffix. */
export const MATERIAL_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'text/markdown': 'md',
};
