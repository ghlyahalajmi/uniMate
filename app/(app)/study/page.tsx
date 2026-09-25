import {
  getCourses, getStudySessions, getCourseMaterials, getStudyPlans,
} from '@/lib/data/queries';
import { isReadableMaterial } from '@/lib/materials/limits';
import { StudyHome } from '@/components/study/study-home';

export const metadata = { title: 'Study with AI' };
export const dynamic = 'force-dynamic';

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course } = await searchParams;

  const [courses, sessions, materials, plans] = await Promise.all([
    getCourses(),
    getStudySessions(12),
    // Every course's chapters in one read; the screen switches between courses
    // without going back to the server, so fetching per course would be a
    // round trip on every tap.
    getCourseMaterials(),
    getStudyPlans(),
  ]);

  const active = courses.filter((c) => c.status === 'active');
  const codeOf = (id: string | null) =>
    courses.find((c) => c.id === id)?.course_code ?? null;

  return (
    <StudyHome
      courses={active.map((c) => ({
        id: c.id,
        code: c.course_code,
        name: c.course_name,
        chapters: materials
          .filter((m) => m.course_id === c.id)
          .map((m) => ({
            id: m.id,
            title: m.title,
            readable: isReadableMaterial(m.file_type),
          })),
      }))}
      plans={plans.map((p) => ({
        id: p.id,
        title: p.title,
        goal: p.goal,
        startsOn: p.starts_on,
        endsOn: p.ends_on,
        sessions: p.items.map((i) => ({
          id: i.id,
          courseCode: codeOf(i.course_id),
          topic: i.topic,
          scheduledOn: i.scheduled_on ?? '',
          startTime: i.start_time,
          minutes: i.minutes,
          done: i.completed_at !== null,
        })),
      }))}
      initialCourseId={course ?? active[0]?.id ?? ''}
      history={sessions
        .filter((s) => s.completed_at)
        .map((s) => ({
          id: s.id,
          courseCode: codeOf(s.course_id),
          topic: s.topic,
          score: s.score,
          correct: s.correct_answers,
          total: s.total_questions,
          completedAt: s.completed_at as string,
        }))}
    />
  );
}
