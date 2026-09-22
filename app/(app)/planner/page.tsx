import { getCourses, getSchedules } from '@/lib/data/queries';
import { PlannerView } from '@/components/planner/planner-view';

export const metadata = { title: 'Schedule builder' };
export const dynamic = 'force-dynamic';

export default async function PlannerPage() {
  const [courses, schedules] = await Promise.all([getCourses(), getSchedules()]);

  const byId = new Map(courses.map((c) => [c.id, c]));

  return (
    <PlannerView
      candidates={courses
        .filter((c) => c.status === 'planned' || c.status === 'active')
        .map((c) => ({
          id: c.id, code: c.course_code, name: c.course_name,
          credits: Number(c.credits), difficulty: c.difficulty,
          status: c.status,
          days: c.days, start: c.start_time, end: c.end_time,
        }))}
      plans={schedules.map((s) => ({
        id: s.id,
        name: s.name,
        workload: s.workload_level,
        totalCredits: Number(s.total_credits),
        rationale: s.rationale,
        assumptions: s.assumptions,
        isSelected: s.is_selected,
        createdAt: s.created_at,
        courses: s.courses
          .map((sc) => byId.get(sc.course_id))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map((c) => ({ id: c.id, code: c.course_code, name: c.course_name, credits: Number(c.credits) })),
      }))}
    />
  );
}
