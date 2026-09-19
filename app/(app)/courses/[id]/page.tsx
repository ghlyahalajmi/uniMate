import { notFound } from 'next/navigation';
import {
  getCourse, getGrades, getTasks, getSyllabi, getSyllabusEvents,
  getQuestions, getGradeScale,
} from '@/lib/data/queries';
import { computeCourseGrade, requiredForTarget, bestReachableLetter } from '@/lib/calculations/grades';
import { CourseDetailView } from '@/components/courses/course-detail-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getCourse(id);
  return { title: course ? `${course.course_code} — ${course.course_name}` : 'Course' };
}

/**
 * The relationship walk the schema is built for:
 *   course → its assessments → its tasks → its syllabus → that syllabus's events
 * all on one page, all fetched through foreign keys.
 */
export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const course = await getCourse(id);
  if (!course) notFound();

  const [grades, tasks, syllabi, events, questions, scale] = await Promise.all([
    getGrades(id), getTasks(id), getSyllabi(id), getSyllabusEvents(id), getQuestions(id, 12), getGradeScale(),
  ]);

  const breakdown = computeCourseGrade(grades, scale);
  const target = requiredForTarget(grades, course.target_grade, scale);

  return (
    <CourseDetailView
      course={course}
      grades={grades}
      tasks={tasks}
      syllabus={syllabi[0] ?? null}
      events={events}
      questions={questions}
      breakdown={breakdown}
      target={{
        verdict: target.verdict as string,
        targetLetter: target.targetLetter,
        targetPercent: target.targetPercent,
        requiredAveragePercent: target.requiredAveragePercent,
        assumptions: target.assumptions,
      }}
      bestReachable={bestReachableLetter(grades, scale)}
      scaleLetters={scale.map((s) => s.letter)}
    />
  );
}
