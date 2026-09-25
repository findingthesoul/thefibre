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

import { ArrowLeft } from 'lucide-react';
import { ENTITY, surfaceUrl } from '@thefibre/shared';
import { headers } from 'next/headers';
import { loadCalendarStatus, loadErasure, loadProfile, loadSession } from '@/lib/session';
import { VERSION } from '@/lib/version';
import { SignedOut } from '../signed-out';
import { PageShell } from '../page-shell';
import { DetailsForm } from './details-form';
import { CalendarCard } from './calendar-card';
import { RemoveData } from './remove-data';
import { SignOutButton } from './sign-out-button';

export const dynamic = 'force-dynamic';

export default async function YouPage() {
  const session = await loadSession();
  if (!session) return <SignedOut />;

  const profile = await loadProfile();
  const calendar = await loadCalendarStatus();
  const erasure = await loadErasure();
  const { person } = session.portal;
  // Label derived from the resolved href, not from the constant: on staging
  // this page is my.thefibre.tech and a link reading "thethread.app" would be
  // telling the visitor they are somewhere they are not.
  const siteUrl = surfaceUrl('website', process.env, (await headers()).get('host'));

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

      <CalendarCard status={calendar} />

      {/* Below the calendar and above the way out — last of the things you
          DO here, which is where a page puts the one you hope nobody needs.
          Omitted entirely when the picture could not be read: offering a
          right we cannot describe accurately is worse than not offering it
          on this page, since the privacy policy carries it either way. */}
      {erasure && <RemoveData picture={erasure} />}

      {/* The way back. The app switcher now offers my.thread from every app,
          so this is the other half of that pair — a member who lives here
          still needs one obvious door outward. It points at the public site
          rather than an app: someone reading this page has a seat in no app
          by definition, and thethread.app is the address they know.
          (Sjoerd, 2026-09-24: *"And of course on my.thread below YOU a
          button: back the thethread.app"*.) */}
      <div className="mt-10 border-t border-line pt-6">
        {/* A BUTTON, not a link. It shipped as small underlined text and
            Sjoerd asked for it a second time — "button to go back to
            thethread" — which is the answer to whether an underline at the
            bottom of a page reads as a way out. Full width on a phone, where
            this page is read one-handed and the thumb is nowhere near a
            17px target. */}
        <a
          href={siteUrl}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-5 text-sm font-medium text-ink hover:bg-surface-sunken sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to {siteUrl.replace(/^https?:\/\//, '')}
        </a>
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <SignOutButton />
      </div>

      <p className="mt-12 text-xs text-ink-muted">
        {ENTITY.publicName} · v{VERSION}
      </p>
    </PageShell>
  );
}
