import { getCourses, getGrades, getGradeScale, getStudySessions, groupGradesByCourse } from '@/lib/data/queries';
import { computeCourseGrade } from '@/lib/calculations/grades';
import { cumulativeGpa } from '@/lib/calculations/gpa';
import { isAiConfigured } from '@/lib/ai/client';
import { AnalyticsView } from '@/components/analytics/analytics-view';

export const metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

/**
 * Every chart here is built from the student's own rows. When a series has no
 * rows, its chart shows an empty state that explains what to add — never
 * placeholder data standing in for the real thing.
 */
export default async function AnalyticsPage() {
  const [courses, grades, sessions, scale] = await Promise.all([
    getCourses(), getGrades(), getStudySessions(40), getGradeScale(),
  ]);

  const byCourse = groupGradesByCourse(grades);
  const codes = Object.fromEntries(courses.map((c) => [c.id, c.course_code]));

  // Assessment scores in the order they were sat.
  const assessmentSeries = grades
    .filter((g) => g.score !== null && Number(g.max_score) > 0)
    .sort((a, b) => (a.due_date ?? a.created_at).localeCompare(b.due_date ?? b.created_at))
    .map((g) => ({
      label: g.assessment_name,
      value: Math.round((Number(g.score) / Number(g.max_score)) * 1000) / 10,
      sub: codes[g.course_id] ?? undefined,
    }));

  // Current weighted standing per active course.
  const courseStanding = courses
    .filter((c) => c.status === 'active')
    .map((c) => {
      const b = computeCourseGrade(byCourse.get(c.id) ?? [], scale);
      return { label: c.course_code, value: b.currentPercent ?? 0, sub: c.target_grade ?? undefined, has: b.hasAnyScore };
    })
    .filter((x) => x.has)
    .map(({ label, value, sub }) => ({ label, value, sub }));

  // GPA and credit load, by semester, for completed work only.
  const semesters = [...new Set(
    courses.filter((c) => c.status === 'completed' && c.semester).map((c) => c.semester as string),
  )].sort(compareSemesters);

  const gpaSeries = semesters.map((sem) => {
    const inSem = courses.filter((c) => c.status === 'completed' && c.semester === sem);
    const r = cumulativeGpa(inSem, scale);
    return { label: sem, value: r.gpa ?? 0, sub: `${r.gradedCredits} credits` };
  }).filter((x) => x.value > 0);

  const creditSeries = semesters.map((sem) => ({
    label: sem,
    value: courses
      .filter((c) => c.status === 'completed' && c.semester === sem)
      .reduce((s, c) => s + Number(c.credits), 0),
  }));

  const studySeries = sessions
    .filter((s) => s.completed_at && s.score !== null)
    .sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''))
    .map((s) => ({
      label: (s.completed_at ?? '').slice(5, 10),
      value: Number(s.score),
      sub: [s.course_id ? codes[s.course_id] : null, s.topic].filter(Boolean).join(' · ') || undefined,
    }));

  const maxGpa = Math.max(4, ...scale.map((x) => Number(x.points)));
  const maxCredits = Math.max(18, ...creditSeries.map((x) => x.value));

  return (
    <AnalyticsView
      aiEnabled={await isAiConfigured()}
      assessmentSeries={assessmentSeries}
      courseStanding={courseStanding}
      gpaSeries={gpaSeries}
      creditSeries={creditSeries}
      studySeries={studySeries}
      maxGpa={maxGpa}
      maxCredits={maxCredits}
      completedCount={courses.filter((c) => c.status === 'completed').length}
      assessmentCount={grades.length}
    />
  );
}

/** "Fall 2025" before "Spring 2026" before "Fall 2026". */
function compareSemesters(a: string, b: string): number {
  const parse = (s: string) => {
    const year = Number(/\d{4}/.exec(s)?.[0] ?? 0);
    const lower = s.toLowerCase();
    const term = lower.includes('spring') ? 1 : lower.includes('summer') ? 2 : lower.includes('fall') || lower.includes('autumn') ? 3 : 0;
    return year * 10 + term;
  };
  return parse(a) - parse(b) || a.localeCompare(b);
}
