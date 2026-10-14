// HOME — the page of the community you belong to (item 4). With one, it IS
// that page; with several, it lists them.

import Link from 'next/link';
import { loadSession } from '@/lib/session';
import { fetchCommunities, type CommunityView } from '@/lib/portal-api';
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';
import { CommunityPage } from './community-view';

export const dynamic = 'force-dynamic';

export default async function CommunityIndex() {
  const session = await loadSession();
  if (!session) return <SignedOut />;
  let list: CommunityView[] | null = null;
  try {
    list = await fetchCommunities(session.token);
  } catch (e) {
    console.error('[my] /me/portal/community failed', e);
  }
  if (!list) {
    return (
      <PageShell title="Home">
        <Empty title="This page could not be loaded.">Try again in a moment.</Empty>
      </PageShell>
    );
  }
  if (list.length === 1) {
    const c = list[0]!;
    return (
      <PageShell title={c.name}>
        <CommunityPage c={c} />
      </PageShell>
    );
  }
  return (
    <PageShell title="Home">
      {list.length === 0 ? (
        <Empty title="You are not a member of a community yet.">
          When you join one, its page is here: an introduction, its documents and what is next.
        </Empty>
      ) : (
        <ul className="mt-8 space-y-3">
          {list.map((c) => (
            <li key={c.workspace_id}>
              <Link href={`/community/${c.workspace_id}`} className="flex min-h-11 items-center rounded-2xl border border-line bg-surface p-5 text-base text-ink hover:border-line-strong">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
