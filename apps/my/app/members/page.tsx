// The door to the member list, for people who have not opened it yet.
//
// Sjoerd, on staging, signed in and asking where the member list was. It was
// reachable only from a link on the You card, and that link only appears once
// you are already listed — so a member who had not opted in had no way to
// discover the list existed. A feature nobody can find is a feature nobody
// has.
//
// With one community, this is its list. With several, it asks which. With
// none, it says so rather than 404ing.

import Link from 'next/link';
import { loadDirectoryChoices, loadDirectoryMembers, loadFrame } from '@/lib/session';
import { SignedOut } from '../signed-out';
import { PageShell } from '../page-shell';
import { FindMeSlot } from '../find-me-slot';
import { CommunityMembers, membersTitle } from './community-members';
import { pageLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';

export default async function MembersIndex() {
  // Side by side: the session (already under way in the layout) decides only
  // signed-in or not, and the choices need just the token.
  const [session, choices] = await Promise.all([loadFrame(), loadDirectoryChoices()]);
  if (!session) return <SignedOut />;
  const locale = await pageLocale();

  if (choices === null) {
    return (
      <PageShell title={t(locale, 'nav_members')}>
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          {t(locale, 'members_failed')}
        </p>
      </PageShell>
    );
  }

  const withDirectory = choices.filter((c) => c.directory_enabled);
  // One community: its list, HERE. This was a redirect to /members/<ws>
  // until 2026-10-15, and a redirect is a second request — layout, session,
  // portal and all — so the commonest case cost twice the slowest page in
  // the app. The address stays /members; the nav highlights it either way.
  if (withDirectory.length === 1) {
    const only = withDirectory[0].workspace_id;
    return (
      <CommunityMembers
        workspaceId={only}
        list={await loadDirectoryMembers(only)}
        title={membersTitle(choices, only, locale)}
        locale={locale}
      />
    );
  }

  return (
    <PageShell title={t(locale, 'nav_members')}>
      <FindMeSlot />
      {withDirectory.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          {t(locale, 'members_no_list_any')}
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {withDirectory.map((c) => (
            <li key={c.workspace_id}>
              <Link
                href={`/members/${c.workspace_id}`}
                className="block rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink hover:border-line-strong"
              >
                {c.workspace_name}
                {!c.listed && (
                  // Not a warning about what they cannot do — since
                  // 2026-10-14 they can open and read every one of these.
                  // It says what is true of them in that list, which is the
                  // thing they might want to change.
                  <span className="block text-xs text-ink-muted">
                    {t(locale, 'members_not_shown_here')}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
