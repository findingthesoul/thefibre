// The body of one community's member list, shared by its two doors.
//
// /members/<ws> renders it, and so does /members itself when the reader has
// exactly one community with a list. Until 2026-10-15 the second door was a
// redirect to the first, which made a one-community member — almost all of
// them — pay for the layout, the session and the page twice: 3.9s against
// 2.0s, measured on staging (e2e/portal-members-speed.spec.ts). Why there are
// four states is written on the page; this is only its markup.

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { DirectoryChoice, DirectoryList } from '@/lib/portal-api';
import { PageShell } from '../page-shell';
import { MemberSearch } from './member-search';

export function membersTitle(choices: DirectoryChoice[] | null, workspaceId: string): string {
  // null = the choices call failed; the heading just falls back to "Members"
  // rather than naming a community we could not confirm.
  const community = (choices ?? []).find((c) => c.workspace_id === workspaceId);
  return community ? `Members of ${community.workspace_name}` : 'Members';
}

export function CommunityMembers({
  workspaceId,
  list,
  title,
}: {
  workspaceId: string;
  list: DirectoryList;
  title: string;
}) {
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
