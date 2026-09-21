import { getHubLinks } from '@/lib/hub/queries';
import { getLeaderboard } from '@/lib/momentum/leaderboard';
import { getMyGroups } from '@/lib/groups/queries';
import { StudentHubView } from '@/components/student-hub/student-hub-view';

export const metadata = { title: 'Student Hub' };
export const dynamic = 'force-dynamic';

/**
 * Everything the student does *with* other people, on one page: the streak
 * board, the groups they study with, the links the class shares, and their own
 * link page. The Hub and Study groups have no sidebar entry of their own —
 * they are reached from here, because this is where the class already is.
 */
export default async function StudentHubPage() {
  const [links, board, groups] = await Promise.all([
    getHubLinks(), getLeaderboard(), getMyGroups(),
  ]);

  const rows = links.map((l) => ({
    id: l.id,
    title: l.title,
    url: l.url,
    description: l.description,
    kind: l.kind,
    isPinned: l.is_pinned,
  }));

  return (
    <StudentHubView
      board={board}
      links={rows.filter((l) => l.kind === 'class')}
      // The personal Hub, previewed rather than duplicated: pinned first, and
      // the page itself is one press away.
      myLinks={rows.filter((l) => l.kind !== 'class')}
      groups={groups.map((g) => ({
        id: g.id,
        title: g.title,
        courseCode: g.courseCode,
        memberCount: g.memberCount,
        maxMembers: g.maxMembers,
      }))}
    />
  );
}
