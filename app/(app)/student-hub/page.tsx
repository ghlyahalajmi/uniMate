import { getHubLinks } from '@/lib/hub/queries';
import { getLeaderboard } from '@/lib/momentum/leaderboard';
import { StudentHubView } from '@/components/student-hub/student-hub-view';

export const metadata = { title: 'Student Hub' };
export const dynamic = 'force-dynamic';

export default async function StudentHubPage() {
  const [links, board] = await Promise.all([getHubLinks(), getLeaderboard()]);

  return (
    <StudentHubView
      board={board}
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
