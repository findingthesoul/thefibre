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
import { redirect } from 'next/navigation';
import { loadDirectoryChoices, loadSession } from '@/lib/session';
import { SignedOut } from '../signed-out';
import { PageShell } from '../page-shell';

export default async function MembersIndex() {
  const session = await loadSession();
  if (!session) return <SignedOut />;

  const choices = await loadDirectoryChoices();

  if (choices === null) {
    return (
      <PageShell title="Members">
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          We couldn&apos;t load this right now. Nothing has changed — try again in a moment.
        </p>
      </PageShell>
    );
  }

  const withDirectory = choices.filter((c) => c.directory_enabled);
  if (withDirectory.length === 1) redirect(`/members/${withDirectory[0].workspace_id}`);

  return (
    <PageShell title="Members">
      {withDirectory.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-subtle">
          None of your communities has a member list.
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
                  <span className="block text-xs text-ink-muted">
                    You&apos;re not in this list yet
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
