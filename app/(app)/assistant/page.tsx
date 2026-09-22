import { getCourses } from '@/lib/data/queries';
import { AssistantView } from '@/components/assistant/assistant-view';

export const metadata = { title: 'Assistant' };
export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  const courses = await getCourses();
  const firstActive = courses.find((c) => c.status === 'active');

  return (
    <AssistantView
      sampleCourseCode={firstActive?.course_code ?? 'CE301'}
    />
  );
}
