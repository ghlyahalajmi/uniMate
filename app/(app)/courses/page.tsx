import { getCourses, getGrades, getGradeScale, groupGradesByCourse } from '@/lib/data/queries';
import { computeCourseGrade } from '@/lib/calculations/grades';
import { CoursesView } from '@/components/courses/courses-view';

export const metadata = { title: 'Courses' };
export const dynamic = 'force-dynamic';

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { new: openNew } = await searchParams;
  const [courses, grades, scale] = await Promise.all([getCourses(), getGrades(), getGradeScale()]);
  const byCourse = groupGradesByCourse(grades);

  const rows = courses.map((c) => {
    const cg = computeCourseGrade(byCourse.get(c.id) ?? [], scale);
    return {
      ...c,
      currentPercent: cg.currentPercent,
      currentLetter: cg.currentLetter,
      assessmentCount: (byCourse.get(c.id) ?? []).length,
      weightTotal: cg.totalDefinedWeight,
    };
  });

  return <CoursesView rows={rows} openNew={openNew === '1'} />;
}
