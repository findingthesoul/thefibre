// The member list — the first surface where one member sees another.
//
// Sjoerd asked for this in one sentence: "Members need to see each other.
// Can we create a list of members. With profiles. Ways to contact them."
// Everything before it existed so that this page could be built without
// anyone having to decide, here, who may see whom.
//
// FOUR STATES, kept apart on purpose. This community has no directory; we
// could not find out; the directory exists and you are not in it; the
// directory exists and here are the people. Rendering any two of those the
// same is the empty that reads as working — the mistake this repo keeps
// catching, including in my own code on 2026-10-05, when a failed load
// silently omitted a privacy switch and looked like a page with nothing on
// it.

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { loadDirectoryChoices, loadDirectoryMembers, loadSession } from '@/lib/session';
import { SignedOut } from '../../signed-out';
import { PageShell } from '../../page-shell';
import { MemberSearch } from '../member-search';

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const session = await loadSession();
  if (!session) return <SignedOut />;

  const [list, choices] = await Promise.all([
    loadDirectoryMembers(workspaceId),
    loadDirectoryChoices(),
  ]);
  // null = the choices call failed; the heading just falls back to "Members"
  // rather than naming a community we could not confirm.
  const community = (choices ?? []).find((c) => c.workspace_id === workspaceId);
  const title = community ? `Members of ${community.workspace_name}` : 'Members';

  return (
    <PageShell title={title}>
      <Link
        href="/you"
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={1.75} />
        Back to you
      </Link>

      {list.state === 'failed' && (
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          We couldn&apos;t load this right now. Nothing has changed, and nobody has been shown
          anything — try again in a moment.
        </p>
      )}

      {list.state === 'none' && (
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          This community doesn&apos;t have a member list.
        </p>
      )}

      {list.state === 'ok' && !list.you_are_listed && (
        // Being in a directory and reading one are the same bargain. Said
        // plainly, with the way to change it, rather than showing an empty
        // page that looks broken.
        <div className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-sm text-ink">You&apos;re not in this member list yet.</p>
          <p className="mt-1 text-xs text-ink-muted">
            The list shows members to each other, so you see it once you appear in it. You can turn
            that on, and off again, on your{' '}
            <Link href="/you" className="underline hover:text-ink">
              You
            </Link>{' '}
            page.
          </p>
        </div>
      )}

      {list.state === 'ok' && list.you_are_listed && list.items.length === 0 && (
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          You&apos;re the only one here so far. Nobody else has chosen to appear yet.
        </p>
      )}

      {list.state === 'ok' && list.items.length > 0 && <MemberSearch members={list.items} />}

    </PageShell>
  );
}
