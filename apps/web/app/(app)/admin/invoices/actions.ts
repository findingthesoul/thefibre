'use server';

// The platform's own invoices, in the shape the shared Invoices area reads.
//
// Sjoerd, 2026-10-04, looking at /admin/invoices beside Meet's Invoices page:
// *"this is the interface of meet. Why not the same in fibre (and hopefully in
// all the other)."* It was a fork — a plain table whose rows did not open —
// so this page gets the same component as Meet, Thread, Members and the
// contact/organisation tabs, and only the app-bound half lives here.
//
// WHY THIS LIST IS DIFFERENT, and why it needs its own `listPurchases`:
// every other Invoices page asks /api/v1/purchases, which is scoped to the
// workspace you are standing in. The platform's invoices are the SELLER's
// side — fibre-platform rows that live in each CUSTOMER's workspace — so no
// workspace-scoped query can see them. They come from the super-admin-only
// /api/v1/admin/economics/invoices, and are mapped here into the shared
// PurchaseList shape rather than the component learning a second shape.
//
// WHAT IS NOT OFFERED, and why that is not an omission: the management
// actions are absent on purpose. Mark paid, Send payment link, Reimburse and
// Resend act on an invoice the WORKSPACE issued, through its own payment
// setup. These rows are Stripe subscription invoices The Fibre issued and
// Stripe already collected; marking one paid by hand would write a lie into
// the ledger, and a refund belongs in Stripe, where the money is. The shared
// area hides a button whose action is absent rather than disabling it, so the
// dialog shows what applies here — the document, the billed-to block, the
// lines, and the Stripe-hosted PDF that is the legal copy.

import { apiFetch, ApiError } from '@/lib/api';
import type { PurchaseRow, PurchaseList, ListPurchasesArgs } from '@thefibre/shared/ui/invoices';

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    return e.message;
  }
  return e instanceof Error ? e.message : 'unknown error';
}

/** What the admin endpoint returns: purchase columns plus the workspace and
 *  app joins. Narrower than PurchaseRow, which is why the mapping below is
 *  explicit about every field it cannot supply. */
type AdminInvoiceRow = Omit<PurchaseRow, 'app'> & {
  workspace: { name: string; slug: string } | { name: string; slug: string }[] | null;
  app: { slug: string; name: string } | { slug: string; name: string }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function listPurchases(_args: ListPurchasesArgs): Promise<
  { ok: true; data: PurchaseList } | { ok: false; error: string }
> {
  // `_args` is deliberately ignored. Scope has no meaning here — there is one
  // list, every workspace — and the area is given a single scope so it never
  // offers a choice this function would silently drop. Search and paging are
  // the endpoint's next step, not a filter faked client-side: showing a
  // filtered page while the total says otherwise is worse than no search.
  try {
    const data = await apiFetch<{ items: AdminInvoiceRow[] }>(
      '/api/v1/admin/economics/invoices',
    );
    const items: PurchaseRow[] = data.items.map((r) => ({
      ...r,
      // The payer line reads as the workspace that pays, which is who this
      // invoice is actually to; payer_name on these rows is whoever typed
      // the card in, which is not the customer.
      payer_name: one(r.workspace)?.name ?? r.payer_name,
    }));

    // Totals the component shows, computed from the same rows it renders —
    // never a second number from a second query that can disagree with the
    // list in front of you.
    const byCurrency = new Map<
      string,
      { currency: string; paid_cents: number; pending_cents: number; refunded_cents: number; fees_cents: number }
    >();
    for (const r of items) {
      const cur = r.currency || 'EUR';
      const t =
        byCurrency.get(cur) ??
        { currency: cur, paid_cents: 0, pending_cents: 0, refunded_cents: 0, fees_cents: 0 };
      if (r.status === 'paid') t.paid_cents += r.amount_cents;
      if (r.status === 'pending') t.pending_cents += r.amount_cents;
      if (r.status === 'refunded') t.refunded_cents += r.amount_cents;
      byCurrency.set(cur, t);
    }

    return {
      ok: true,
      data: {
        items,
        next_cursor: null,
        totals: { count: items.length, currencies: [...byCurrency.values()] },
        // The area disables the workspace scope for non-admins; this page is
        // already super-admin-only (the page redirects), so admin is honest.
        role: 'admin',
      },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
