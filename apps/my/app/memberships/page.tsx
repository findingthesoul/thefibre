// MEMBERSHIPS — what you belong to, what it gets you, and what it costs.
//
// A membership has no date, it has a state, so putting it in a chronological
// list means inventing a position for it (docs/member-portal-plan.md §3).
// It gets its own tab instead.
//
// Slice 4 filled it in. Sjoerd: "click and then what it contains, with links
// to what is included and invoices". Two sources feed "includes" and both
// are the member's by different routes — the non-optional products of their
// tier, held for as long as they are a member, and the products they bought
// outright, kept through a tier change or a lapse. The API resolves both,
// and resolves a thread link to a real address rather than showing a ref.

import Link from 'next/link';
import { loadSession } from '@/lib/session';
import { fmtDate } from '@/lib/format';
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';
import { ManagePayment } from './manage-payment';

export const dynamic = 'force-dynamic';

const STATE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  grace: 'bg-amber-50 text-amber-700 ring-amber-200',
  lapsed: 'bg-surface-sunken text-ink-muted ring-line',
  cancelled: 'bg-surface-sunken text-ink-muted ring-line',
};

/** Said in words, because a member should not have to know our vocabulary. */
const STATE_NOTE: Record<string, string> = {
  grace: 'Payment is overdue. Your access continues for now.',
  lapsed: 'This has lapsed. Rejoin to get it back.',
  cancelled: 'This has been cancelled.',
};

export default async function MembershipsPage() {
  const session = await loadSession();
  if (!session) return <SignedOut />;

  const items = session.portal.groups.flatMap((g) =>
    g.memberships.map((m) => ({ ...m, workspace: g.name })),
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
          {items.map((m) => {
            const includes = m.includes ?? [];
            return (
              <li key={m.member_id} className="rounded-2xl border border-line bg-surface p-5">
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

                {STATE_NOTE[m.status] && (
                  <p className="mt-2 text-sm text-ink-subtle">{STATE_NOTE[m.status]}</p>
                )}
                {m.status === 'active' && m.renews_at && (
                  <p className="mt-2 text-xs text-ink-muted">Renews {fmtDate(m.renews_at)}</p>
                )}
                {m.started_at && (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Member since {fmtDate(m.started_at)}
                  </p>
                )}

                {/* What it gets you. An empty list is a real answer — a tier
                    can include nothing but belonging — so it says that
                    rather than showing an empty heading. */}
                <div className="mt-4 border-t border-line pt-4">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    What this includes
                  </h3>
                  {includes.length === 0 ? (
                    <p className="mt-1 text-sm text-ink-muted">
                      Belonging to {m.workspace}, and nothing else listed.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {includes.map((inc, i) => (
                        <li key={i} className="text-sm">
                          {inc.url ? (
                            <a
                              href={inc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-11 items-center text-ink underline underline-offset-2 hover:opacity-70"
                            >
                              {inc.name}
                            </a>
                          ) : (
                            <span className="text-ink">{inc.name}</span>
                          )}
                          {inc.description && (
                            <p className="text-ink-muted">{inc.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4">
                  <Link
                    href="/purchases"
                    className="inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
                  >
                    What you paid
                  </Link>
                </div>
                <ManagePayment memberId={m.member_id} hasStripe={!!m.has_stripe} />
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
