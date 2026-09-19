import { getCourses, getGrades, getReminders, getSyllabusEvents, getTasks } from '@/lib/data/queries';
import { CalendarView } from '@/components/calendar/calendar-view';

export const metadata = { title: 'Calendar' };
export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const [courses, events, grades, tasks, reminders] = await Promise.all([
    getCourses(), getSyllabusEvents(), getGrades(), getTasks(), getReminders(),
  ]);

  const codes = Object.fromEntries(courses.map((c) => [c.id, c.course_code]));

  return (
    <CalendarView
      classes={courses
        .filter((c) => c.status === 'active' && c.days.length)
        .map((c) => ({
          id: c.id, code: c.course_code, name: c.course_name,
          days: c.days, start: c.start_time, end: c.end_time, room: c.room,
        }))}
      dated={[
        ...events.filter((e) => e.event_date).map((e) => ({
          id: `e-${e.id}`, kind: 'assessment' as const, date: e.event_date as string,
          title: e.title, courseCode: e.course_id ? codes[e.course_id] ?? null : null,
          detail: e.weight ? `${e.weight}%` : null,
        })),
        ...grades.filter((g) => g.due_date && g.score === null).map((g) => ({
          id: `g-${g.id}`, kind: 'assessment' as const, date: g.due_date as string,
          title: g.assessment_name, courseCode: codes[g.course_id] ?? null,
          detail: `${g.weight}%`,
        })),
        ...tasks.filter((tk) => tk.due_date && tk.status !== 'completed').map((tk) => ({
          id: `t-${tk.id}`, kind: 'task' as const, date: tk.due_date as string,
          title: tk.title, courseCode: tk.course_id ? codes[tk.course_id] ?? null : null,
          detail: tk.estimated_minutes ? `${tk.estimated_minutes} min` : null,
        })),
        ...reminders.filter((r) => r.status === 'scheduled').map((r) => ({
          id: `r-${r.id}`, kind: 'reminder' as const, date: r.remind_on,
          title: r.title, courseCode: r.course_id ? codes[r.course_id] ?? null : null,
          detail: r.body,
        })),
      ]}
    />
  );
}
