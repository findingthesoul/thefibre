// What an invoice IS, in one place.
//
// The same facts were drawn three times by hand — into the PDF
// (apps/api/src/lib/invoice-pdf.ts), into the invoice email
// (routes/purchases.ts receiptHtml) and onto the screen (ui/invoice-dialog).
// Same fields, same order, three pieces of code agreeing only by convention.
// The PDF's own header comment admitted it: "the same facts the invoice page
// and receipt email render, in the same order". They had already drifted
// (Sjoerd, 2026-09-09) — see the three notes below.
//
// This module is the composition: which lines exist, in what order, and what
// each one is. It deliberately returns DATA, never formatted text, because
// the on-screen dialog localises and the two server renderers do not. Money
// stays in cents, dates stay ISO, and each renderer formats for its audience.
//
// No dependencies, no node, no I/O — the shared package has zero deps and is
// bundled into every web app. The renderers stay where they belong: the PDF
// and the email are built in the EU API because they are drawn from a ledger
// row, which is personal data (HARD RULE 1).

export type InvoiceBilling = {
  number?: string | null;
  company?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  tax_no?: string | null;
  period_end?: string | null;
  pdf?: string | null;
  subtotal_cents?: number | null;
  tax_cents?: number | null;
  tax_label?: string | null;
};

/** The ledger row, as every invoice surface reads it. */
export type InvoicePurchase = {
  /** A ledger row always has one; the PDF falls back to it for a filename. */
  id: string;
  item_label: string;
  amount_cents: number;
  currency: string;
  status?: string;
  method: string;
  paid_at?: string | null;
  created_at: string;
  payer_name: string;
  payer_email?: string | null;
  stripe_invoice_url?: string | null;
  billing?: InvoiceBilling | null;
};

export type InvoiceSeller = {
  legal_name?: string;
  address?: string;
  tax_no?: string;
};

/** A pending row is an INVOICE; anything else is a RECEIPT. Getting this
 *  wrong once mailed a "Receipt" with a Total for money not yet paid. */
export type InvoiceKind = 'invoice' | 'receipt';

/** How it was paid, as a decided vocabulary rather than a raw column.
 *  Renderers map these to their own words (and their own languages). */
export type InvoiceMethod = 'card' | 'invoice' | 'invoice_awaiting' | 'free' | 'other';

export type InvoiceParty = {
  name: string;
  /** Street, postcode + town, country — joined the way all three did it. */
  address: string | null;
  taxNo: string | null;
  email: string | null;
};

export type InvoiceModel = {
  kind: InvoiceKind;
  number: string | null;
  /** The date the document is ABOUT: when it was paid if it was, else when
   *  it was raised. The email used created_at unconditionally and so dated
   *  a receipt by when the invoice was issued — corrected here. */
  dateIso: string;
  currency: string;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  line: { label: string; serviceUntilIso: string | null; amountCents: number };
  totals: {
    subtotalCents: number;
    /** Present only when there is tax to state. */
    tax: { label: string | null; amountCents: number } | null;
    totalCents: number;
  };
  method: InvoiceMethod;
  /** The untranslated column values, for anything that must show them raw. */
  raw: { method: string; status: string };
};

function addressLine(parts: {
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
}): string | null {
  const line = [
    parts.address,
    [parts.postal_code, parts.city].filter(Boolean).join(' '),
    parts.country,
  ]
    .filter(Boolean)
    .join(', ');
  return line || null;
}

/** The one definition of what this invoice contains. */
export function invoiceModel(p: InvoicePurchase, seller?: InvoiceSeller | null): InvoiceModel {
  const b = p.billing ?? {};
  const status = p.status ?? 'paid';
  const settled = status !== 'pending';

  // Tax is stated when there is an amount or a label to state. Subtotal
  // then differs from the total; without tax the two are the same number,
  // which is why the email only showed a Subtotal row alongside tax.
  const taxCents = typeof b.tax_cents === 'number' ? b.tax_cents : null;
  const tax =
    taxCents !== null && (taxCents > 0 || b.tax_label)
      ? { label: b.tax_label ?? null, amountCents: taxCents }
      : null;

  const method: InvoiceMethod =
    p.method === 'stripe'
      ? 'card'
      : p.method === 'invoice'
        ? settled
          ? 'invoice'
          : 'invoice_awaiting'
        : p.method === 'free'
          ? 'free'
          : 'other';

  return {
    kind: settled ? 'receipt' : 'invoice',
    number: b.number ?? null,
    dateIso: (settled && p.paid_at) || p.created_at,
    currency: p.currency || 'EUR',
    seller: {
      name: seller?.legal_name ?? '',
      address: seller?.address ?? null,
      taxNo: seller?.tax_no ?? null,
      email: null,
    },
    buyer: {
      name: b.company ?? p.payer_name,
      address: addressLine(b),
      taxNo: b.tax_no ?? null,
      email: p.payer_email ?? null,
    },
    line: {
      label: p.item_label,
      serviceUntilIso: b.period_end ?? null,
      amountCents: b.subtotal_cents ?? p.amount_cents,
    },
    totals: {
      subtotalCents: b.subtotal_cents ?? p.amount_cents,
      tax,
      totalCents: p.amount_cents,
    },
    method,
    raw: { method: p.method, status },
  };
}
