import { getCourses, getTasks } from '@/lib/data/queries';
import { TasksView } from '@/components/tasks/tasks-view';

export const metadata = { title: 'Tasks' };
export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const [tasks, courses] = await Promise.all([getTasks(), getCourses()]);

  return (
    <TasksView
      tasks={tasks}
      courseOptions={courses.map((c) => ({ value: c.id, label: `${c.course_code} — ${c.course_name}` }))}
      courseCodes={Object.fromEntries(courses.map((c) => [c.id, c.course_code]))}
    />
  );
}
