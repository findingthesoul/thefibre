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
import { FindMeSlot } from '../find-me-slot';
import { MemberSearch } from './member-search';
import type { Locale } from '@thefibre/shared/i18n';
import { t } from '@/lib/i18n';
import { parts } from '@/lib/i18n-parts';

export function membersTitle(choices: DirectoryChoice[] | null, workspaceId: string, locale: Locale): string {
  // null = the choices call failed; the heading just falls back to "Members"
  // rather than naming a community we could not confirm.
  const community = (choices ?? []).find((c) => c.workspace_id === workspaceId);
  return community ? t(locale, 'members_of', { name: community.workspace_name }) : t(locale, 'nav_members');
}

export function CommunityMembers({
  workspaceId,
  list,
  title,
  locale,
}: {
  workspaceId: string;
  list: DirectoryList;
  title: string;
  locale: Locale;
}) {
  return (
    <PageShell title={title}>
      <Link
        href="/you"
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={1.75} />
        {t(locale, 'back_to_you')}
      </Link>
      {/* Whether YOU are in this list, and the switch for it (2026-10-17). */}
      <FindMeSlot />

      {list.state === 'failed' && (
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          {t(locale, 'members_failed_private')}
        </p>
      )}

      {list.state === 'none' && (
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          {t(locale, 'members_no_list')}
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
          <p className="text-sm text-ink">{t(locale, 'members_you_hidden')}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {parts(t(locale, 'members_you_hidden_body'), {
              link: (
                <Link href="/you" className="underline hover:text-ink">
                  {t(locale, 'nav_you')}
                </Link>
              ),
            })}
          </p>
        </div>
      )}

      {list.state === 'ok' && list.items.length === 0 && (
        // TWO EMPTIES, because they are different facts about the reader.
        // Someone who is listed and sees nobody IS the list; someone who is
        // not listed and sees nobody would be told "you're the only one here"
        // about a list they are not in.
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          {list.you_are_listed ? t(locale, 'members_only_you') : t(locale, 'members_nobody')}
        </p>
      )}

      {list.state === 'ok' && list.items.length > 0 && (
        <MemberSearch members={list.items} workspaceId={workspaceId} />
      )}

    </PageShell>
  );
}
