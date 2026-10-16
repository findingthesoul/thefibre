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

import { NOTICE } from '@thefibre/shared/ui/recipes';
import { loadInvoices, loadSession } from '@/lib/session';
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';
import { InvoiceList } from './invoice-list';
import { ProductRenewals, Renewals } from './renewals';
import { fetchBuyerDetails, fetchRenewals } from '@/lib/portal-api';
import { BillingDetailsForm } from './billing-details';

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

  const [{ rows, failed }, renewals, buyer] = await Promise.all([
    loadInvoices(),
    fetchRenewals(session.token),
    fetchBuyerDetails(session.token),
  ]);
  const outstanding = rows.filter((r) => r.status !== 'paid' && r.status !== 'refunded');

  return (
    <PageShell title="Purchases">
      {renewals && <Renewals items={renewals.memberships} />}
      {renewals && <ProductRenewals items={renewals.products} />}
      {buyer && <BillingDetailsForm initial={buyer} />}
      {/* A failed call is NOT an empty list, and this page used to show both
          as "Nothing invoiced yet" — which is how a reported missing invoice
          became an hour of ruling things out on 2026-10-13. Somebody who paid
          and sees "nothing yet" concludes their payment vanished; telling them
          the list would not load is both true and less alarming. */}
      {failed ? (
        <div className={`mt-8 ${NOTICE.error}`}>
          We could not load your invoices just now. Nothing is lost — this is us, not your
          payment. Reload the page in a moment, and tell the community you joined if it keeps
          happening.
        </div>
      ) : rows.length === 0 ? (
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
