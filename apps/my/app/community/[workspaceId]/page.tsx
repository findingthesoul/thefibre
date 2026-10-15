import { notFound } from 'next/navigation';
import { loadFrame } from '@/lib/session';
import { fetchCommunities } from '@/lib/portal-api';
import { SignedOut } from '../../signed-out';
import { PageShell } from '../../page-shell';
import { CommunityPage } from '../community-view';

export const dynamic = 'force-dynamic';

// One of several communities. Only ever one the API returned for this
// session: an id typed into the address bar for a community you are not in
// is simply not found.
export default async function OneCommunity({ params }: { params: Promise<{ workspaceId: string }> }) {
  const session = await loadFrame();
  if (!session) return <SignedOut />;
  const { workspaceId } = await params;
  const c = (await fetchCommunities(session.token)).find((x) => x.workspace_id === workspaceId);
  if (!c) notFound();
  return (
    <PageShell title={c.name}>
      <CommunityPage c={c} />
    </PageShell>
  );
}
