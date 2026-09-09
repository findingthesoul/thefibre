// MEMBERSHIPS — what you belong to, and what state it is in.
//
// A membership has no date, it has a state, so putting it in a chronological
// list means inventing a position for it (docs/member-portal-plan.md §3).
// It gets its own tab instead.
//
// What a membership UNLOCKS is slice 4 and is not here yet. Nothing on this
// page claims otherwise: a tier's included products need a resolver per link
// kind, and showing a thread you are not actually enrolled in would repeat
// the false promise the access-grant dropdown already made once.

import Link from 'next/link';
import { loadSession } from '@/lib/session';
import { fmtDate } from '@/lib/format';
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';

export const dynamic = 'force-dynamic';

const STATE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  grace: 'bg-amber-50 text-amber-700 ring-amber-200',
  lapsed: 'bg-surface-sunken text-ink-muted ring-line',
  cancelled: 'bg-surface-sunken text-ink-muted ring-line',
};

export default async function MembershipsPage() {
  const session = await loadSession();
  if (!session) return <SignedOut />;

  const items = session.portal.groups.flatMap((g) =>
    g.memberships.map((m) => ({ ...m, workspace: g.name, logo_url: g.logo_url })),
  );

  return (
    <PageShell title="Memberships">
      {items.length === 0 ? (
        <Empty title="You are not a member anywhere yet.">
          A membership appears here when you join a community. If you expected one, check you
          signed in with the address you joined with.
        </Empty>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((m) => (
            <li
              key={m.member_id}
              className="rounded-2xl border border-line bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-medium text-ink">{m.workspace}</div>
                  <div className="mt-0.5 text-sm text-ink-subtle">{m.tier ?? 'Member'}</div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] capitalize ring-1 ${
                    STATE[m.status] ?? STATE.lapsed
                  }`}
                >
                  {m.status}
                </span>
              </div>

              {m.status === 'active' && m.renews_at && (
                <p className="mt-2 text-xs text-ink-muted">Renews {fmtDate(m.renews_at)}</p>
              )}
              {m.started_at && (
                <p className="mt-0.5 text-xs text-ink-muted">
                  Member since {fmtDate(m.started_at)}
                </p>
              )}

              <Link
                href="/purchases"
                className="mt-3 inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
              >
                What you paid
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
