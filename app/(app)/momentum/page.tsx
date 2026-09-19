import { getMomentum, getWrapped } from '@/lib/momentum/queries';
import { getCourses, getProfile } from '@/lib/data/queries';
import { MomentumView } from '@/components/momentum/momentum-view';

export const metadata = { title: 'Momentum' };
export const dynamic = 'force-dynamic';

export default async function MomentumPage() {
  const [snapshot, wrapped, courses, profile] = await Promise.all([
    getMomentum(16), getWrapped(), getCourses(), getProfile(),
  ]);

  return (
    <MomentumView
      enabled={profile?.momentum_enabled ?? true}
      streak={snapshot.streak}
      level={snapshot.level}
      totals={snapshot.totals}
      heatmap={snapshot.heatmap}
      xpToday={snapshot.xpToday}
      achievements={snapshot.achievements}
      wrapped={wrapped}
      courses={courses
        .filter((c) => c.status === 'active')
        .map((c) => ({ id: c.id, code: c.course_code, name: c.course_name }))}
    />
  );
}
