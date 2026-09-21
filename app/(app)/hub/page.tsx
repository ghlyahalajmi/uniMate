import { getHubLinks } from '@/lib/hub/queries';
import { HubView } from '@/components/hub/hub-view';

export const metadata = { title: 'Hub' };
export const dynamic = 'force-dynamic';

export default async function HubPage() {
  const links = await getHubLinks();

  return (
    <HubView
      links={links.map((l) => ({
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
