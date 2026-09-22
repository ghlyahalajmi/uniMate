import { getCourses, getSyllabi, getSyllabusEvents } from '@/lib/data/queries';
import { SyllabiView } from '@/components/syllabi/syllabi-view';

export const metadata = { title: 'Syllabus' };
export const dynamic = 'force-dynamic';

export default async function SyllabiPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course } = await searchParams;
  const [syllabi, courses, events] = await Promise.all([
    getSyllabi(), getCourses(), getSyllabusEvents(),
  ]);

  const codes = Object.fromEntries(courses.map((c) => [c.id, c.course_code]));

  return (
    <SyllabiView
      initialCourseId={course ?? ''}
      courseOptions={courses.map((c) => ({ value: c.id, label: `${c.course_code} — ${c.course_name}` }))}
      syllabi={syllabi.map((s) => ({
        id: s.id,
        fileName: s.file_name,
        courseId: s.course_id,
        courseCode: s.course_id ? codes[s.course_id] ?? null : null,
        status: s.processing_status,
        errorMessage: s.error_message,
        summary: s.summary,
        instructor: s.instructor,
        officeHours: s.office_hours,
        material: s.required_material,
        policies: s.policies,
        topics: s.topics,
        uploadedAt: s.uploaded_at,
        events: events
          .filter((e) => e.syllabus_id === s.id)
          .map((e) => ({
            id: e.id, title: e.title, type: e.event_type,
            date: e.event_date, weight: e.weight, description: e.description,
          })),
      }))}
    />
  );
}
