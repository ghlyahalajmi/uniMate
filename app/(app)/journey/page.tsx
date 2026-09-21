import { getJourneyData } from '@/lib/coach/view';
import { JourneyView } from '@/components/journey/journey-view';

export const metadata = { title: 'My Journey' };
export const dynamic = 'force-dynamic';

export default async function JourneyPage() {
  const data = await getJourneyData();
  return <JourneyView data={data} />;
}
