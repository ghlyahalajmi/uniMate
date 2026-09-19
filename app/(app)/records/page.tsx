import {
  getAiRuns, getCleaningLog, getCourses, getGrades, getQuestions, getReminders,
  getStudySessions, getSyllabi, getSyllabusEvents, getTasks,
} from '@/lib/data/queries';
import { RecordsView } from '@/components/records/records-view';

export const metadata = { title: 'Records' };
export const dynamic = 'force-dynamic';

/**
 * Every row UniMate holds, in one place, with real delete from the frontend.
 * This is also where the AI activity log and the data cleaning log live.
 */
export default async function RecordsPage() {
  const [courses, grades, tasks, syllabi, events, sessions, questions, reminders, runs, cleaning] =
    await Promise.all([
      getCourses(), getGrades(), getTasks(), getSyllabi(), getSyllabusEvents(),
      getStudySessions(100), getQuestions(undefined, 100), getReminders(),
      getAiRuns(100), getCleaningLog(200),
    ]);

  const codes = Object.fromEntries(courses.map((c) => [c.id, c.course_code]));

  return (
    <RecordsView
      courses={courses.map((c) => ({
        id: c.id,
        cells: [c.course_code, c.course_name, String(c.credits), c.semester ?? '—', c.status, c.is_demo ? 'demo' : ''],
      }))}
      grades={grades.map((g) => ({
        id: g.id,
        cells: [
          codes[g.course_id] ?? '—', g.assessment_name, g.assessment_type,
          `${g.weight}%`, g.score === null ? '—' : `${g.score}/${g.max_score}`, g.due_date ?? '—',
        ],
      }))}
      tasks={tasks.map((tk) => ({
        id: tk.id,
        cells: [
          tk.title, tk.course_id ? codes[tk.course_id] ?? '—' : '—',
          tk.priority, tk.status, tk.due_date ?? '—', tk.source,
        ],
      }))}
      syllabi={syllabi.map((s) => ({
        id: s.id,
        cells: [
          s.file_name ?? '—', s.course_id ? codes[s.course_id] ?? '—' : '—',
          s.processing_status, String(s.topics.length), s.uploaded_at.slice(0, 10),
        ],
      }))}
      events={events.map((e) => ({
        id: e.id,
        cells: [
          e.title, e.course_id ? codes[e.course_id] ?? '—' : '—',
          e.event_type, e.event_date ?? '—', e.weight === null ? '—' : `${e.weight}%`,
        ],
      }))}
      sessions={sessions.map((s) => ({
        id: s.id,
        cells: [
          s.course_id ? codes[s.course_id] ?? '—' : '—', s.topic ?? '—', s.mode ?? '—',
          `${s.correct_answers}/${s.total_questions}`,
          s.score === null ? '—' : `${s.score}%`,
          (s.completed_at ?? s.started_at).slice(0, 10),
        ],
      }))}
      questions={questions.map((q) => ({
        id: q.id,
        cells: [
          q.question_text.slice(0, 90), q.course_id ? codes[q.course_id] ?? '—' : '—',
          q.topic ?? '—', q.difficulty, q.question_type,
        ],
      }))}
      reminders={reminders.map((r) => ({
        id: r.id,
        cells: [r.title, r.course_id ? codes[r.course_id] ?? '—' : '—', r.remind_on, r.status, r.source],
      }))}
      runs={runs.map((r) => ({
        id: r.id,
        agent: r.agent_name,
        trigger: r.trigger_type,
        workflow: r.workflow,
        status: r.status,
        input: r.input_summary,
        output: r.output_summary,
        error: r.error_message,
        durationMs: r.duration_ms,
        startedAt: r.started_at,
      }))}
      cleaning={cleaning.map((c) => ({
        id: c.id,
        table: c.table_name,
        field: c.field_name,
        original: c.original_value,
        cleaned: c.cleaned_value,
        reason: c.reason,
        createdAt: c.created_at,
      }))}
    />
  );
}
