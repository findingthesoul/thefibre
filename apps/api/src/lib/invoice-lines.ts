// What a Stripe invoice was FOR, line by line — for the ledger row's
// `billing.lines` (the basket join, 2026-10-16).

import type Stripe from 'stripe';

/** WHAT WAS BOUGHT, line by line, for the ledger row's `billing.lines`
 *  (the basket join, 2026-10-16). ONE purchase row per Stripe invoice — the
 *  invoice is the document and the refund unit — with its lines inside, so
 *  my.thread can say what a payment was for. Net per line (Stripe's line
 *  amount is excl. tax under the excl. rule), its VAT, and whether it renews
 *  with the subscription. */
export function invoiceLines(invoice: Pick<Stripe.Invoice, 'lines'>): { label: string; net_cents: number; vat_cents: number; recurring: boolean }[] {
  return (invoice.lines?.data ?? []).map((l) => {
    const line = l as Stripe.InvoiceLineItem & {
      parent?: { type?: string } | null;
      taxes?: { amount?: number }[] | null;
      price?: { recurring?: unknown } | null;
      pricing?: { price_details?: unknown } | null;
    };
    const vat = (line.taxes ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0);
    return {
      // Stripe says "1 × Soul membership — Singer (at €300.00 / year)" for a
      // subscription line; the ledger keeps the name.
      label: (line.description ?? '').replace(/^\d+\s*×\s*/, '').replace(/\s*\(at [^)]*\)\s*$/, ''),
      net_cents: line.amount ?? 0,
      vat_cents: vat,
      recurring: line.parent?.type === 'subscription_item_details' || !!line.price?.recurring,
    };
  });
}

