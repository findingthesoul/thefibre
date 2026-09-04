import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ENTITY } from '@thefibre/shared';
import { apiFetch } from '@/lib/api';
import { eur } from '@/lib/plans';
import { AutoPrint } from './auto-print';

// The invoice, IN the Fibre ("my invoices are still in Stripe" — Sjoerd,
// 2026-09-04). Rendered entirely from the ledger row: the webhook captures
// the invoice number, buyer details and period at payment time. Stripe's
// hosted PDF stays available as a footnote — rails, not the record.
// Print-friendly on purpose: browser print IS the export.

export const metadata = { title: 'Invoice' };

type Purchase = {
  id: string;
  item_label: string;
  amount_cents: number;
  currency: string;
  status: string;
  method: string;
  paid_at: string | null;
  created_at: string;
  payer_name: string;
  payer_email: string | null;
  stripe_invoice_url: string | null;
  billing: {
    number?: string | null;
    company?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
    tax_no?: string | null;
    period_end?: string | null;
    subtotal_cents?: number | null;
    tax_cents?: number | null;
    tax_label?: string | null;
  } | null;
};

export default async function FibreInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const { print } = await searchParams;
  let invoice: Purchase | undefined;
  try {
    const data = await apiFetch<{ items: Purchase[] }>(
      '/api/v1/purchases?scope=workspace&app=fibre-platform',
    );
    invoice = data.items.find((p) => p.id === id);
  } catch {
    /* falls through to notFound */
  }
  if (!invoice) notFound();

  const b = invoice.billing ?? {};
  const date = new Date(invoice.paid_at ?? invoice.created_at);
  const buyerAddress = [
    b.address,
    [b.postal_code, b.city].filter(Boolean).join(' '),
    b.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="mx-auto max-w-2xl px-8 py-12 print:px-0 print:py-0">
      {print && <AutoPrint />}
      <div className="mb-8 flex items-center justify-between print:hidden">
        <Link href="/settings/plan" className="text-sm text-ink-subtle hover:text-ink">
          ← Plan
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-ink-muted">Use your browser&rsquo;s Print for a PDF</span>
          {invoice.stripe_invoice_url && (
            <a
              href={invoice.stripe_invoice_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              Stripe copy
            </a>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface-raised p-8 print:border-0 print:bg-transparent print:p-0">
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">
              {invoice.status === 'paid' ? 'Receipt' : 'Invoice'}
            </h1>
            {b.number && <div className="mt-1 font-mono text-sm text-ink-muted">{b.number}</div>}
          </div>
          <div className="text-right text-sm leading-relaxed">
            <div className="font-medium">{ENTITY.name}</div>
            <div className="text-ink-subtle">{ENTITY.address}</div>
            <div className="text-ink-muted">{ENTITY.supportEmail}</div>
          </div>
        </header>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">Billed to</div>
            <div className="mt-1 leading-relaxed">
              <div>{b.company ?? invoice.payer_name}</div>
              {buyerAddress && <div className="text-ink-subtle">{buyerAddress}</div>}
              {b.tax_no && <div className="text-ink-subtle">VAT: {b.tax_no}</div>}
              {invoice.payer_email && <div className="text-ink-muted">{invoice.payer_email}</div>}
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">Date</div>
            <div className="mt-1">
              {date.toLocaleDateString('en-GB', { dateStyle: 'long' })}
            </div>
            <div className="mt-3 text-[10px] uppercase tracking-wider text-ink-muted">Payment</div>
            <div className="mt-1">
              {invoice.method === 'stripe' ? 'Card' : invoice.method === 'invoice' ? 'By invoice' : invoice.method}
              {' · '}
              <span className={invoice.status === 'paid' ? 'text-emerald-700 dark:text-emerald-400' : ''}>
                {invoice.status}
              </span>
            </div>
          </div>
        </div>

        <table className="mt-10 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th className="py-2 font-normal">Description</th>
              <th className="py-2 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line/60">
              <td className="py-3">
                {invoice.item_label}
                {b.period_end && (
                  <span className="ml-2 text-xs text-ink-muted">
                    service period until{' '}
                    {new Date(b.period_end).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </span>
                )}
              </td>
              <td className="py-3 text-right font-mono">
                {eur(b.subtotal_cents ?? invoice.amount_cents)}
              </td>
            </tr>
            {typeof b.tax_cents === 'number' && (b.tax_cents > 0 || b.tax_label) && (
              <tr className="border-b border-line/60 text-ink-subtle">
                <td className="py-3">{b.tax_label ?? 'VAT'}</td>
                <td className="py-3 text-right font-mono">{eur(b.tax_cents)}</td>
              </tr>
            )}
            <tr>
              <td className="py-4 font-medium">Total ({invoice.currency})</td>
              <td className="py-4 text-right font-mono text-lg font-medium">
                {eur(invoice.amount_cents)}
              </td>
            </tr>
          </tbody>
        </table>

        <footer className="mt-10 border-t border-line pt-4 text-xs text-ink-muted leading-relaxed">
          {ENTITY.name} · {ENTITY.address} · {ENTITY.hostedLine}. Questions about this{' '}
          {invoice.status === 'paid' ? 'receipt' : 'invoice'}? {ENTITY.supportEmail}
        </footer>
      </div>
    </div>
  );
}
