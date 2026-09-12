// PURCHASES — every invoice, in one list, newest first.
//
// Money asked about later is asked about AS MONEY ("what did I pay"), not as
// "which of my four memberships was that under" — so this is one list rather
// than a section inside each membership (docs/member-portal-plan.md §3).
//
// Slice 3 made it true. Until v0.68.61 it could only show MEMBERSHIP
// invoices, because Membership's per-membership endpoint was the only
// member-facing one that existed: thread tickets and meet bookings sat in
// the same ledger with no route a member could reach. `GET /me/invoices`
// answers for all of them.

import { loadInvoices, loadSession } from '@/lib/session';
import { fmtDate, money } from '@/lib/format';
import { invoicePdfUrl } from '@/lib/portal-api';
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';

export const dynamic = 'force-dynamic';

/** What the member calls the thing that sold it. The slug is ours. */
const SOLD_BY: Record<string, string> = {
  membership: 'Membership',
  'the-thread': 'Thread',
  'fibre-meet': 'Meeting',
  'fibre-platform': 'The Thread',
};

export default async function PurchasesPage() {
  const session = await loadSession();
  if (!session) return <SignedOut />;

  const rows = await loadInvoices();
  const outstanding = rows.filter((r) => r.status !== 'paid' && r.status !== 'refunded');

  return (
    <PageShell title="Purchases">
      {rows.length === 0 ? (
        <Empty title="Nothing invoiced yet.">
          Anything you pay for — a membership, a ticket, a booking — appears here with its
          invoice to download. If you expected something, check you signed in with the address
          you paid with.
        </Empty>
      ) : (
        <>
          {outstanding.length > 0 && (
            <p className="mt-4 text-sm text-ink-subtle">
              {outstanding.length === 1
                ? 'One invoice is still outstanding.'
                : `${outstanding.length} invoices are still outstanding.`}
            </p>
          )}
          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {rows.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ink">
                    {inv.item_label || SOLD_BY[inv.app] || 'Purchase'}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                    {inv.workspace && <span className="truncate">{inv.workspace}</span>}
                    {inv.workspace && <span aria-hidden>·</span>}
                    <span>{fmtDate(inv.created_at)}</span>
                    {inv.status !== 'paid' && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="capitalize">{inv.status}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="shrink-0 tabular-nums text-sm text-ink">
                  {money(inv.amount_cents, inv.currency)}
                </span>
                {/* A plain link cannot carry a bearer token, which is why the
                    download goes the long way round through this app's own
                    route handler. */}
                <a
                  href={invoicePdfUrl(inv.id)}
                  className="inline-flex min-h-11 shrink-0 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
                >
                  PDF
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  );
}
