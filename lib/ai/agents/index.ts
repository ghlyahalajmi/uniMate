import 'server-only';

export { academicAnalyst } from './academic-analyst';
export { studyQuestionGenerator, MODE_SIZES } from './study-questions';
export { coursePlanner, findConflicts } from './course-planner';
export { syllabusAnalyst, askSyllabus } from './syllabus-analyst';
export { gradeCoach } from './grade-coach';
export { taskPlanner, studyReminderAgent } from './task-planner';
export { unimateAssistant, dashboardInsight } from './assistant';
export { setupScanner } from './setup-scanner';
export { syllabusCourseReader } from './syllabus-course-reader';

export type { AnalystInput, AnalystOutput } from './academic-analyst';
export type { StudyInput, StudyOutput, GeneratedQuestion, PracticeMode, RequestedDifficulty } from './study-questions';
export type { PlannerInput, PlannerOutput, PlanOption } from './course-planner';
export type { SyllabusInput, SyllabusOutput, ExtractedEvent } from './syllabus-analyst';
export type { GradeCoachInput, GradeCoachOutput } from './grade-coach';
export type { TaskPlannerInput, TaskPlannerOutput, PlannedTask, ReminderInput, ReminderOutput, PlannedReminder } from './task-planner';
export type { AssistantInput, AssistantOutput, InsightInput, InsightOutput } from './assistant';
export type { ScannerInput, ScannerOutput, ScannedCourse } from './setup-scanner';
export type {
  SyllabusCourseInput, SyllabusCourseOutput, SyllabusPage, ReadCourse, ReadContact,
} from './syllabus-course-reader';

/**
 * The agent roster, for the documentation page and the activity log legend.
 * Keep in step with the exports above.
 */
export const AGENT_REGISTRY = [
  { name: 'Academic Analyst',         trigger: 'user_requested',    workflow: 'analyst_on_demand',              offline: 'Deterministic pass over completed courses' },
  { name: 'Study Question Generator', trigger: 'user_requested',    workflow: 'workflow_e_study_questions',     offline: null },
  { name: 'Course Planner',           trigger: 'user_requested',    workflow: 'workflow_planner',               offline: 'Credit-capped light/balanced/intensive splits' },
  { name: 'Syllabus Analyst',         trigger: 'syllabus_uploaded', workflow: 'workflow_b_syllabus_processing', offline: null },
  { name: 'Grade Coach',              trigger: 'grade_entered',     workflow: 'workflow_c_grade_analysis',      offline: 'Full arithmetic, without the written advice' },
  { name: 'Task Planner',             trigger: 'user_requested',    workflow: 'workflow_task_planning',         offline: 'One preparation task per upcoming deadline' },
  { name: 'Study Reminder Agent',     trigger: 'exam_approaching',  workflow: 'workflow_d_upcoming_exam',       offline: 'Full revision ramp — deterministic by design' },
  { name: 'UniMate Assistant',        trigger: 'user_message',      workflow: 'assistant_chat',                 offline: null },
  { name: 'Setup Scanner',            trigger: 'timetable_uploaded',workflow: 'workflow_a_schedule_scan',       offline: null },
  { name: 'Syllabus Course Reader',  trigger: 'syllabus_uploaded', workflow: 'workflow_f_course_from_syllabus', offline: null },
  { name: 'Dashboard Insight',        trigger: 'dashboard_opened',  workflow: 'dashboard_insight',              offline: 'Nearest recorded deadline plus a proportionate nudge' },
] as const;
