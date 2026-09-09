// PURCHASES — every invoice, in one list, newest first.
//
// Money asked about later is asked about as money ("what did I pay"), not as
// "which of my four memberships was that under" — so this is one list rather
// than a section inside each membership (docs/member-portal-plan.md §3).
//
// TODAY IT IS MEMBERSHIP INVOICES ONLY. Thread tickets and Meet bookings are
// in the same purchase ledger but have no member-facing endpoint yet (plan
// §7.4), and the page says so rather than presenting a partial list as a
// complete one.

import { loadInvoices, loadSession } from '@/lib/session';
import { fmtDate, money } from '@/lib/format';
import { invoicePdfUrl } from '@/lib/portal-api';
import { SignedOut } from '../signed-out';
import { PageShell, Empty } from '../page-shell';

export const dynamic = 'force-dynamic';

export default async function PurchasesPage() {
  const session = await loadSession();
  if (!session) return <SignedOut />;

  const rows = await loadInvoices();

  return (
    <PageShell title="Purchases">
      {rows.length === 0 ? (
        <Empty title="Nothing invoiced yet.">
          Invoices for your memberships appear here, with the PDF to download. Tickets and
          bookings are not on this list yet.
        </Empty>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {rows.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ink">
                    {inv.item_label ?? 'Membership'}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                    <span className="truncate">{inv.workspace}</span>
                    <span aria-hidden>·</span>
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
          <p className="mt-3 text-xs text-ink-muted">
            Membership invoices only for now. Tickets and bookings follow.
          </p>
        </>
      )}
    </PageShell>
  );
}
