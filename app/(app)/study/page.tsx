import { getCourses, getStudySessions } from '@/lib/data/queries';
import { isAiConfigured } from '@/lib/ai/client';
import { StudyView } from '@/components/study/study-view';

export const metadata = { title: 'Study AI' };
export const dynamic = 'force-dynamic';

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course } = await searchParams;
  const [courses, sessions] = await Promise.all([getCourses(), getStudySessions(12)]);
  const active = courses.filter((c) => c.status === 'active');

  return (
    <StudyView
      aiEnabled={isAiConfigured()}
      courses={active.map((c) => ({ id: c.id, code: c.course_code, name: c.course_name }))}
      initialCourseId={course ?? active[0]?.id ?? ''}
      history={sessions
        .filter((s) => s.completed_at)
        .map((s) => ({
          id: s.id,
          courseCode: courses.find((c) => c.id === s.course_id)?.course_code ?? null,
          topic: s.topic,
          score: s.score,
          correct: s.correct_answers,
          total: s.total_questions,
          completedAt: s.completed_at as string,
        }))}
    />
  );
}
