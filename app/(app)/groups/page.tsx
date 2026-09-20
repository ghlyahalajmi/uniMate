import { getCourses } from '@/lib/data/queries';
import { discoverGroups, getMyGroups, myBlocks } from '@/lib/groups/queries';
import { GroupsView } from '@/components/groups/groups-view';

export const metadata = { title: 'Study groups' };
export const dynamic = 'force-dynamic';

export default async function GroupsPage({
  searchParams,
}: {
  // `?course=CE301` arrives from a course's Practice tab.
  searchParams: Promise<{ course?: string }>;
}) {
  const { course } = await searchParams;

  const [courses, mine, blocks] = await Promise.all([getCourses(), getMyGroups(), myBlocks()]);
  const active = courses.filter((c) => c.status === 'active');
  const selected = course?.trim().toUpperCase()
    ?? active[0]?.course_code.toUpperCase()
    ?? '';

  const found = selected ? await discoverGroups(selected) : [];

  return (
    <GroupsView
      courses={active.map((c) => ({ code: c.course_code, name: c.course_name }))}
      selectedCourse={selected}
      mine={mine}
      found={found}
      // Matching runs on the timetable; with no timed course there is nothing
      // to match on, and saying so beats showing an empty result.
      hasTimetable={blocks.length > 0}
    />
  );
}
