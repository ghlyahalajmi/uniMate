import { notFound } from 'next/navigation';
import { getGroup } from '@/lib/groups/queries';
import { GroupView } from '@/components/groups/group-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getGroup(id);
  return { title: detail ? detail.group.title : 'Study group' };
}

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getGroup(id);
  // A group you are not in is not found, rather than forbidden: whether it
  // exists is itself something only its members are entitled to know.
  if (!detail) notFound();

  return (
    <GroupView
      detail={detail}
      // The server's day, corrected in the browser before a date is proposed.
      serverToday={new Date().toISOString().slice(0, 10)}
    />
  );
}
