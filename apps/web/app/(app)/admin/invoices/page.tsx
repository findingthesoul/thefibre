import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, SectionLabel, EmptyState } from '@/components/ui/page';
import { eur } from '@/lib/plans';

// The platform's own outgoing invoices — the SELLER side of the same
// purchase ledger the app Invoices pages read (Sjoerd, 2026-09-03: "The
// Fibre already has an invoice system… can we use it for the super admin
// also?"). Every fibre-platform row across all workspaces: who pays for
// their Fibre, when, and the Stripe-hosted PDF that is the legal document.

export const metadata = { title: 'Platform invoices' };

type Me = { user: { is_super_admin?: boolean } };

type Row = {
  id: string;
  item_label: string;
  amount_cents: number;
  currency: string;
  status: string;
  method: string;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
  payer_name: string;
  payer_email: string | null;
  stripe_invoice_url: string | null;
  workspace: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

function wsOf(r: Row): { name: string; slug: string } | null {
  if (!r.workspace) return null;
  return Array.isArray(r.workspace) ? r.workspace[0] ?? null : r.workspace;
}

export default async function AdminInvoicesPage() {
  const me = await apiFetch<Me>('/api/v1/auth/me');
  if (!me.user.is_super_admin) redirect('/dashboard');

  let items: Row[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<{ items: Row[] }>('/api/v1/admin/economics/invoices');
    items = data.items;
  } catch {
    error = 'Could not load invoices.';
  }

  const paidTotal = items
    .filter((r) => r.status === 'paid')
    .reduce((s, r) => s + r.amount_cents, 0);

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Platform invoices"
        description="What workspaces pay The Fibre — the seller side of the same ledger every app's Invoices page reads. The Stripe-hosted PDF is the legal document."
      />

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <SectionLabel>
            {items.length} invoice{items.length === 1 ? '' : 's'}
          </SectionLabel>
          {paidTotal > 0 && (
            <span className="text-xs text-ink-muted">
              {eur(paidTotal)} collected all-time
            </span>
          )}
        </div>

        {error ? (
          <EmptyState>{error}</EmptyState>
        ) : items.length === 0 ? (
          <EmptyState>
            No platform invoices yet — the first one appears the moment a workspace pays for a
            plan.
          </EmptyState>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface-raised">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-muted">
                  <th className="px-4 py-2.5 font-normal">Workspace</th>
                  <th className="px-4 py-2.5 font-normal">What</th>
                  <th className="px-4 py-2.5 font-normal">When</th>
                  <th className="px-4 py-2.5 font-normal text-right">Amount</th>
                  <th className="px-4 py-2.5 font-normal">Status</th>
                  <th className="px-4 py-2.5 font-normal" />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const ws = wsOf(r);
                  return (
                    <tr key={r.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{ws?.name ?? '—'}</div>
                        <div className="text-xs text-ink-muted">{r.payer_email ?? ws?.slug}</div>
                      </td>
                      <td className="px-4 py-2.5 text-ink-subtle">{r.item_label}</td>
                      <td className="px-4 py-2.5 text-ink-muted">
                        {new Date(r.paid_at ?? r.created_at).toLocaleDateString('en-GB', {
                          dateStyle: 'medium',
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{eur(r.amount_cents)}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                            r.status === 'paid'
                              ? 'border-emerald-600/40 text-emerald-700 dark:text-emerald-400'
                              : r.status === 'refunded'
                                ? 'border-amber-600/40 text-amber-700 dark:text-amber-400'
                                : 'border-line text-ink-muted'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.stripe_invoice_url && (
                          <a
                            href={r.stripe_invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline underline-offset-2 text-ink-subtle hover:text-ink"
                          >
                            PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
