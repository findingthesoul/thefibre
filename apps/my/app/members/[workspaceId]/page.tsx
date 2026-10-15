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

import { loadDirectoryChoices, loadDirectoryMembers, loadFrame } from '@/lib/session';
import { SignedOut } from '../../signed-out';
import { CommunityMembers, membersTitle } from '../community-members';

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  // All three at once. The session is only needed for the signed-out
  // decision, and the layout has already started it (the same cached call),
  // so the list no longer waits behind the portal payload — it used to.
  const [session, list, choices] = await Promise.all([
    loadFrame(),
    loadDirectoryMembers(workspaceId),
    loadDirectoryChoices(),
  ]);
  if (!session) return <SignedOut />;

  return (
    <CommunityMembers
      workspaceId={workspaceId}
      list={list}
      title={membersTitle(choices, workspaceId)}
    />
  );
}
