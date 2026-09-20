import { getHubLinks } from '@/lib/hub/queries';
import { StudentHubView } from '@/components/student-hub/student-hub-view';

export const metadata = { title: 'Student Hub' };
export const dynamic = 'force-dynamic';

export default async function StudentHubPage() {
  const links = await getHubLinks();

  return (
    <StudentHubView
      links={links
        .filter((l) => l.kind === 'class')
        .map((l) => ({
          id: l.id,
          title: l.title,
          url: l.url,
          description: l.description,
          kind: l.kind,
          isPinned: l.is_pinned,
        }))}
    />
  );
}
