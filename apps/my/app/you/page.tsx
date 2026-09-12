// YOU — who you are, what language you hear from us in, and how to leave.
//
// Slice 5 of docs/member-portal-plan.md. This was the read-only tab: it
// showed a name with no way to correct it, which is the wrong answer to "my
// name is spelled wrong on my invoice" — that question currently becomes an
// email to an organiser, which is the thing this portal exists to stop.
//
// `ui/profile-form` was the shared candidate and is not the right one: it is
// the ORGANISER's profile — display name, bio, photo, timezone, the face a
// workspace sees. A member has none of that. What they have is a name that
// several communities hold copies of, and a language.

import { ENTITY } from '@thefibre/shared';
import { loadProfile, loadSession } from '@/lib/session';
import { VERSION } from '@/lib/version';
import { SignedOut } from '../signed-out';
import { PageShell } from '../page-shell';
import { DetailsForm } from './details-form';
import { SignOutButton } from './sign-out-button';

export const dynamic = 'force-dynamic';

export default async function YouPage() {
  const session = await loadSession();
  if (!session) return <SignedOut />;

  const profile = await loadProfile();
  const { person } = session.portal;

  return (
    <PageShell title="You">
      {profile ? (
        <DetailsForm profile={profile} />
      ) : (
        // The details call failed. Show what the portal payload already knows
        // rather than an error where a name should be — and say plainly that
        // editing is the part that is missing, not the person.
        <>
          <dl className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {(person.first_name || person.last_name) && (
              <div className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="shrink-0 text-sm text-ink-muted">Name</dt>
                <dd className="min-w-0 truncate text-sm text-ink">
                  {[person.first_name, person.last_name].filter(Boolean).join(' ')}
                </dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="shrink-0 text-sm text-ink-muted">Email</dt>
              <dd className="min-w-0 truncate text-sm text-ink">{person.email}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-muted">
            Editing is not reachable right now. Try again in a moment.
          </p>
        </>
      )}

      <div className="mt-10 border-t border-line pt-6">
        <SignOutButton />
      </div>

      <p className="mt-12 text-xs text-ink-muted">
        {ENTITY.publicName} · v{VERSION}
      </p>
    </PageShell>
  );
}
