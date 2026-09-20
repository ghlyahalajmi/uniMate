import { z } from 'zod';

const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const;

/** `HH:MM` or `HH:MM:SS`. */
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use a 24-hour time such as 10:00');
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date such as 2026-10-22');
const optionalText = z.string().trim().max(500).optional().or(z.literal('')).transform((v) => (v ? v : null));

export const courseSchema = z.object({
  course_code: z.string().trim().min(2, 'Enter a course code, for example CE301').max(20),
  course_name: z.string().trim().min(2, 'Enter the course name').max(200),
  instructor: optionalText,
  credits: z.coerce.number().min(0).max(24),
  semester: optionalText,
  difficulty: z.coerce.number().int().min(1).max(5).nullable().optional(),
  days: z.array(z.enum(WEEKDAYS)).default([]),
  start_time: timeString.nullable().optional().or(z.literal('')).transform((v) => (v ? v : null)),
  end_time: timeString.nullable().optional().or(z.literal('')).transform((v) => (v ? v : null)),
  room: optionalText,
  color: z.string().trim().max(32).nullable().optional(),
  status: z.enum(['active','completed','planned','withdrawn']).default('active'),
  final_grade: z.string().trim().max(5).nullable().optional().or(z.literal('')).transform((v) => (v ? v : null)),
  final_points: z.coerce.number().min(0).max(5).nullable().optional(),
  target_grade: z.string().trim().max(5).nullable().optional().or(z.literal('')).transform((v) => (v ? v : null)),
}).refine(
  (v) => !v.start_time || !v.end_time || v.end_time > v.start_time,
  { message: 'The end time must be after the start time', path: ['end_time'] },
);

export const gradeSchema = z.object({
  course_id: z.string().uuid('Choose a course'),
  assessment_name: z.string().trim().min(1, 'Enter an assessment name').max(200),
  assessment_type: z.enum(['quiz','assignment','midterm','final','project','lab','participation','presentation','other']).default('other'),
  weight: z.coerce.number().min(0, 'Weight must be between 0 and 100').max(100, 'Weight must be between 0 and 100'),
  score: z.coerce.number().min(0).nullable().optional(),
  max_score: z.coerce.number().positive('The maximum must be greater than zero').default(100),
  due_date: dateString.nullable().optional().or(z.literal('')).transform((v) => (v ? v : null)),
}).refine(
  (v) => v.score === null || v.score === undefined || v.score <= v.max_score,
  { message: 'The score cannot be higher than the maximum', path: ['score'] },
);

export const taskSchema = z.object({
  course_id: z.string().uuid().nullable().optional().or(z.literal('')).transform((v) => (v ? v : null)),
  title: z.string().trim().min(1, 'Enter a title').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => (v ? v : null)),
  priority: z.enum(['low','medium','high']).default('medium'),
  due_date: dateString.nullable().optional().or(z.literal('')).transform((v) => (v ? v : null)),
  estimated_minutes: z.coerce.number().int().min(1).max(1440).nullable().optional(),
  status: z.enum(['todo','in_progress','completed']).default('todo'),
});

export const flashcardSchema = z.object({
  course_id: z.string().uuid().nullable().optional().or(z.literal('')).transform((v) => (v ? v : null)),
  front: z.string().trim().min(1, 'Enter the prompt').max(500),
  back: z.string().trim().min(1, 'Enter the answer').max(2000),
  topic: z.string().trim().max(120).optional().or(z.literal('')).transform((v) => (v ? v : null)),
});

export const profileSchema = z.object({
  full_name: z.string().trim().max(120).optional().or(z.literal('')).transform((v) => (v ? v : null)),
  university: z.string().trim().max(160).optional().or(z.literal('')).transform((v) => (v ? v : null)),
  major: z.string().trim().max(160).optional().or(z.literal('')).transform((v) => (v ? v : null)),
  academic_year: z.string().trim().max(60).optional().or(z.literal('')).transform((v) => (v ? v : null)),
  preferred_language: z.enum(['en','ar']).default('en'),
  target_gpa: z.coerce.number().min(0).max(5).nullable().optional(),
  preferred_study_minutes: z.coerce.number().int().min(5).max(480).default(45),
  study_availability: z.string().trim().max(500).optional().or(z.literal('')).transform((v) => (v ? v : null)),
  theme: z.enum(['light','dark','system']).default('light'),
  reminders_enabled: z.coerce.boolean().default(true),
  momentum_enabled: z.coerce.boolean().default(true),
});

export const gradeScaleSchema = z.object({
  entries: z.array(z.object({
    letter: z.string().trim().min(1).max(5),
    min_percent: z.coerce.number().min(0).max(100),
    points: z.coerce.number().min(0).max(10),
  })).min(1, 'Keep at least one grade in the scale'),
});

export const signUpSchema = z.object({
  full_name: z.string().trim().min(1, 'Enter your name').max(120),
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(8, 'Please choose a password of at least 8 characters'),
});

export const signInSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

// --- AI request payloads -----------------------------------------------------

export const studyRequestSchema = z.object({
  course_id: z.string().uuid('Choose a course'),
  mode: z.enum(['quick_5','standard_10','deep_20','exam_mode']).default('standard_10'),
  difficulty: z.enum(['easy','medium','hard','adaptive']).default('adaptive'),
  topic: z.string().trim().max(200).optional(),
});

export const assistantRequestSchema = z.object({
  message: z.string().trim().min(1, 'Type a question').max(2000),
  history: z.array(z.object({
    role: z.enum(['user','assistant']),
    content: z.string().max(4000),
  })).max(20).default([]),
});

export const plannerRequestSchema = z.object({
  semester: z.string().trim().max(60).optional(),
  candidate_course_ids: z.array(z.string().uuid()).min(1, 'Add at least one course to consider').max(20),
});

export const syllabusAskSchema = z.object({
  syllabus_id: z.string().uuid(),
  question: z.string().trim().min(1, 'Type a question').max(500),
});

// --- Upload guards -----------------------------------------------------------

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const IMAGE_MIME = ['image/png','image/jpeg','image/webp'] as const;
export const DOC_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

export function validateUpload(
  file: { size: number; type: string },
  allowed: readonly string[],
): { ok: true } | { ok: false; reason: 'too_large' | 'wrong_type' } {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: 'too_large' };
  if (!allowed.includes(file.type)) return { ok: false, reason: 'wrong_type' };
  return { ok: true };
}

/** Turns a ZodError into `{ field: message }` for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
