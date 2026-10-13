// The member list — the first surface where one member sees another.
//
// Sjoerd asked for this in one sentence: "Members need to see each other.
// Can we create a list of members. With profiles. Ways to contact them."
// Everything before it existed so that this page could be built without
// anyone having to decide, here, who may see whom.
//
// FOUR STATES, kept apart on purpose. This community has no directory (which
// is also what a lapsed member is told, because it is the truer of the two
// things we could say); we could not find out; the directory exists and
// nobody is in it yet; the directory exists and here are the people.
// Rendering any two of those the same is the empty that reads as working —
// the mistake this repo keeps catching, including in my own code on
// 2026-10-05, when a failed load silently omitted a privacy switch and
// looked like a page with nothing on it.
//
// Whether the READER appears in the list is no longer one of those states.
// It is a line above the list, not a door in front of it (2026-10-14).

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
        // NOT A GATE ANY MORE — a note above a list they can read. Until
        // 2026-10-14 this was the whole page for an unlisted member, because
        // reading the list required being in it. Sjoerd separated the two:
        // consent decides whether you are SHOWN, and membership decides
        // whether you can look. So this says what is true about them and
        // where to change it, and the list renders underneath.
        <div className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-sm text-ink">You&apos;re not shown to other members.</p>
          <p className="mt-1 text-xs text-ink-muted">
            You can see everyone here who has chosen to appear. To appear yourself, turn that on —
            and off again whenever you like — on your{' '}
            <Link href="/you" className="underline hover:text-ink">
              You
            </Link>{' '}
            page.
          </p>
        </div>
      )}

      {list.state === 'ok' && list.items.length === 0 && (
        // TWO EMPTIES, because they are different facts about the reader.
        // Someone who is listed and sees nobody IS the list; someone who is
        // not listed and sees nobody would be told "you're the only one here"
        // about a list they are not in.
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          {list.you_are_listed
            ? "You're the only one here so far. Nobody else has chosen to appear yet."
            : 'Nobody has chosen to appear in this list yet.'}
        </p>
      )}

      {list.state === 'ok' && list.items.length > 0 && (
        <MemberSearch members={list.items} workspaceId={workspaceId} />
      )}

    </PageShell>
  );
}
