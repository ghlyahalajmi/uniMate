import { isAiConfigured } from '@/lib/ai/client';
import { SyllabusImportView } from '@/components/courses/syllabus-import-view';

export const metadata = { title: 'Add course by syllabus' };
export const dynamic = 'force-dynamic';

export default function CourseFromSyllabusPage() {
  return <SyllabusImportView aiEnabled={isAiConfigured()} />;
}
