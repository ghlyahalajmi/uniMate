/**
 * Hand-maintained mirror of supabase/migrations/0001_schema.sql.
 * Regenerate with `npx supabase gen types typescript` once the CLI is linked.
 */

export type AppLanguage = 'en' | 'ar';
export type CourseStatus = 'active' | 'completed' | 'planned' | 'withdrawn';
export type AssessmentType =
  | 'quiz' | 'assignment' | 'midterm' | 'final' | 'project'
  | 'lab' | 'participation' | 'presentation' | 'other';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type RecordSource = 'manual' | 'ai';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AiRunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type WorkloadLevel = 'light' | 'balanced' | 'intensive';
export type QuestionType =
  | 'multiple_choice' | 'true_false' | 'short_answer'
  | 'calculation' | 'conceptual' | 'scenario';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type SyllabusEventType =
  | 'exam' | 'midterm' | 'final' | 'quiz' | 'assignment' | 'project'
  | 'presentation' | 'deadline' | 'lecture' | 'holiday' | 'other';
export type ReminderStatus = 'scheduled' | 'done' | 'dismissed';

export type Weekday =
  | 'sunday' | 'monday' | 'tuesday' | 'wednesday'
  | 'thursday' | 'friday' | 'saturday';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  university: string | null;
  major: string | null;
  academic_year: string | null;
  preferred_language: AppLanguage;
  target_gpa: number | null;
  gpa_scale: number;
  preferred_study_minutes: number;
  study_availability: string | null;
  theme: string;
  reminders_enabled: boolean;
  onboarding_completed: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface GradeScaleEntry {
  id: string;
  user_id: string;
  letter: string;
  min_percent: number;
  points: number;
  sort_order: number;
  created_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  course_code: string;
  course_name: string;
  instructor: string | null;
  credits: number;
  semester: string | null;
  difficulty: number | null;
  days: Weekday[];
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  color: string | null;
  status: CourseStatus;
  final_grade: string | null;
  final_points: number | null;
  target_grade: string | null;
  source: RecordSource;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Grade {
  id: string;
  user_id: string;
  course_id: string;
  assessment_name: string;
  assessment_type: AssessmentType;
  weight: number;
  score: number | null;
  max_score: number;
  due_date: string | null;
  target_grade: string | null;
  source: RecordSource;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Syllabus {
  id: string;
  user_id: string;
  course_id: string | null;
  file_name: string | null;
  file_url: string | null;
  file_type: string | null;
  extracted_text: string | null;
  summary: string | null;
  instructor: string | null;
  office_hours: string | null;
  policies: string | null;
  required_material: string | null;
  topics: string[];
  processing_status: ProcessingStatus;
  error_message: string | null;
  is_demo: boolean;
  uploaded_at: string;
  updated_at: string;
}

export interface SyllabusEvent {
  id: string;
  user_id: string;
  syllabus_id: string | null;
  course_id: string | null;
  title: string;
  event_type: SyllabusEventType;
  event_date: string | null;
  weight: number | null;
  description: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_date: string | null;
  estimated_minutes: number | null;
  status: TaskStatus;
  source: RecordSource;
  is_demo: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  course_id: string | null;
  event_id: string | null;
  title: string;
  body: string | null;
  remind_on: string;
  status: ReminderStatus;
  source: RecordSource;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  course_id: string | null;
  topic: string | null;
  mode: string | null;
  duration_minutes: number | null;
  score: number | null;
  total_questions: number;
  correct_answers: number;
  is_demo: boolean;
  started_at: string;
  completed_at: string | null;
}

export interface Question {
  id: string;
  user_id: string;
  course_id: string | null;
  session_id: string | null;
  topic: string | null;
  difficulty: DifficultyLevel;
  question_type: QuestionType;
  question_text: string;
  options: string[] | null;
  answer: string;
  explanation: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface QuestionAttempt {
  id: string;
  user_id: string;
  question_id: string;
  session_id: string | null;
  given_answer: string | null;
  is_correct: boolean;
  answered_at: string;
}

export interface Schedule {
  id: string;
  user_id: string;
  semester: string | null;
  name: string;
  total_credits: number;
  workload_level: WorkloadLevel;
  rationale: string | null;
  assumptions: string[];
  is_selected: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface ScheduleCourse {
  id: string;
  user_id: string;
  schedule_id: string;
  course_id: string;
  note: string | null;
}

export interface AiRun {
  id: string;
  user_id: string;
  agent_name: string;
  trigger_type: string;
  workflow: string | null;
  status: AiRunStatus;
  input_summary: string | null;
  output_summary: string | null;
  error_message: string | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface CleaningLogEntry {
  id: string;
  user_id: string;
  table_name: string;
  record_id: string | null;
  field_name: string | null;
  original_value: string | null;
  cleaned_value: string | null;
  reason: string;
  created_at: string;
}

/** A course joined to its assessments — the shape most screens actually want. */
export interface CourseWithGrades extends Course {
  grades: Grade[];
}
