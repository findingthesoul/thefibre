// YOU — who you are signed in as, and how to stop being.
//
// Editing your own details is not here yet: the portal API is read-only on
// person data (docs/member-portal-plan.md §7.5). `ui/profile-form` is the
// component that will fill this page once the endpoint exists, and this page
// says what it cannot do rather than showing fields that do not save.

import { ENTITY } from '@thefibre/shared';
import { loadSession } from '@/lib/session';
import { SignedOut } from '../signed-out';
import { PageShell } from '../page-shell';
import { VERSION } from '@/lib/version';
import { SignOutButton } from './sign-out-button';

export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate text-sm text-ink">{value}</dd>
    </div>
  );
}

export default async function YouPage() {
  const session = await loadSession();
  if (!session) return <SignedOut />;

  const { person } = session.portal;
  const name = [person.first_name, person.last_name].filter(Boolean).join(' ');

  return (
    <PageShell title="You">
      <dl className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {name && <Row label="Name" value={name} />}
        <Row label="Email" value={person.email} />
      </dl>

      <p className="mt-3 text-xs text-ink-muted">
        Your details come from the communities you belong to. To change them, ask the
        organiser — editing them here is coming.
      </p>

      <div className="mt-8 border-t border-line pt-6">
        <SignOutButton />
      </div>

      <p className="mt-12 text-xs text-ink-muted">
        {ENTITY.publicName} · v{VERSION}
      </p>
    </PageShell>
  );
}
