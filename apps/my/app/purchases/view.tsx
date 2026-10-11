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
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';
import { InvoiceList } from './invoice-list';

export const dynamic = 'force-dynamic';

/** `/purchases` and `/purchases/<id>` are the SAME view: the second renders
 *  the first with one invoice's dialog open. That is what makes the deep
 *  link need no ownership rule of its own — the list it opens into is
 *  already only this member's rows, so an id that is not theirs opens
 *  nothing and says nothing.
 *
 *  A plain component rather than a page, because a Next page's props are
 *  typechecked against PageProps and cannot carry an `openId`. Both route
 *  files are three lines and render this. */
export async function PurchasesView({ openId = null }: { openId?: string | null }) {
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
          <InvoiceList invoices={rows} openId={openId} />
        </>
      )}
    </PageShell>
  );
}
