import { getCourses, getGrades, getGradeScale, getProfile, groupGradesByCourse } from '@/lib/data/queries';
import { computeCourseGrade, requiredForTarget, bestReachableLetter } from '@/lib/calculations/grades';
import { cumulativeGpa, semesterGpa } from '@/lib/calculations/gpa';
import { GradesView } from '@/components/grades/grades-view';

export const metadata = { title: 'Grades' };
export const dynamic = 'force-dynamic';

export default async function GradesPage() {
  const [courses, grades, scale, profile] = await Promise.all([
    getCourses(), getGrades(), getGradeScale(), getProfile(),
  ]);

  const byCourse = groupGradesByCourse(grades);
  const active = courses.filter((c) => c.status === 'active');

  const courseCards = active.map((c) => {
    const rows = byCourse.get(c.id) ?? [];
    const breakdown = computeCourseGrade(rows, scale);
    const target = requiredForTarget(rows, c.target_grade, scale);
    return {
      id: c.id,
      code: c.course_code,
      name: c.course_name,
      targetGrade: c.target_grade,
      breakdown,
      target: {
        verdict: target.verdict as string,
        targetLetter: target.targetLetter,
        targetPercent: target.targetPercent,
        requiredAveragePercent: target.requiredAveragePercent,
        assumptions: target.assumptions,
      },
      bestReachable: bestReachableLetter(rows, scale),
    };
  });

  const cum = cumulativeGpa(courses, scale);
  const sem = semesterGpa(courses, byCourse, scale);

  return (
    <GradesView
      courseCards={courseCards}
      cumulative={cum}
      semester={sem}
      scale={scale}
      courseOptions={courses.map((c) => ({ value: c.id, label: `${c.course_code} — ${c.course_name}` }))}
      targetGpa={profile?.target_gpa ?? null}
    />
  );
}
