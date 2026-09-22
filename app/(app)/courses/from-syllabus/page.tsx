import { SyllabusImportView } from '@/components/courses/syllabus-import-view';

export const metadata = { title: 'Add course by syllabus' };
export const dynamic = 'force-dynamic';

export default async function CourseFromSyllabusPage() {
  return <SyllabusImportView />;
}
