// Seller-side VAT on app sales — tickets, bookings ("VAT is workspace and
// then organiser. Workspace is organiser too." — Sjoerd, 2026-09-04).
//
// The config lives inside the payments SPoT's invoice_details jsonb:
// the WORKSPACE's details carry the default; a person selling under their
// own name overrides with their profile's. Team sales follow the workspace
// (teams hold no payment identity of their own), and workspace-level sales
// use the workspace config directly — the workspace IS an organiser.
//
// Ticket prices are VAT-INCLUSIVE: applying VAT never changes what the
// buyer pays, it splits the amount on the invoice ("includes VAT 21%").
// This deliberately avoids touching the Stripe Connect charge itself —
// rails move the money, the ledger carries the tax facts.

import {
  personalInvoiceDetails,
  workspaceInvoiceDetails,
} from './payment-accounts.js';

export type SellerVat = { rate_pct: number; label: string };

type VatFields = { vat_registered?: boolean; vat_rate_pct?: number | null };

/** undefined = this level says nothing; null = explicitly no VAT. */
function fromDetails(d: unknown): SellerVat | null | undefined {
  const v = d as VatFields | null;
  if (!v || v.vat_registered === undefined) return undefined;
  if (!v.vat_registered) return null;
  const rate = typeof v.vat_rate_pct === 'number' ? v.vat_rate_pct : null;
  if (!rate || rate <= 0 || rate > 100) return null;
  return { rate_pct: rate, label: `incl. VAT ${rate}%` };
}

export async function resolveSellerVat(
  workspaceId: string,
  organiserUserId?: string | null,
): Promise<SellerVat | null> {
  if (organiserUserId) {
    const own = fromDetails(await personalInvoiceDetails(organiserUserId));
    if (own !== undefined) return own;
  }
  const ws = fromDetails(await workspaceInvoiceDetails(workspaceId));
  return ws ?? null;
}

/** Inclusive split: the total stays the total; VAT is carved out of it. */
export function inclusiveVat(
  totalCents: number,
  ratePct: number,
): { subtotal_cents: number; tax_cents: number } {
  const tax = Math.round((totalCents * ratePct) / (100 + ratePct));
  return { subtotal_cents: totalCents - tax, tax_cents: tax };
}
