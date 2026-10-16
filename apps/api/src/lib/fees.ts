// Plan-aware platform fee — ONE implementation of the workspace_meet_fee
// resolution that had been copy-pasted into four payment paths (Meet
// checkout, Thread enrol checkout, Thread webhook payout, payment links).
// Free plan: 2% capped at €2; Pro/Org: waived. The RPC owns the numbers —
// the literals below are only the never-under-skim fallback when the
// lookup fails.
//
// THE FEE IS ON THE NET (Sjoerd, 2026-10-16: "yes" — the platform fee on the
// net everywhere). Every caller passes the price BEFORE VAT: the checkout's
// net line, Stripe's own amount_subtotal in the webhook, and netOfPurchase()
// for a payment link that charges a ledger row's gross. Until then the
// webhook and the payment links passed the gross, so the fee was taken (link)
// or recorded (webhook) on the VAT as well.

import { adminClient } from '../db.js';
import { isOwnAccount } from './stripe/connect.js';

export async function platformFeeCents(
  workspaceId: string,
  /** The price BEFORE VAT. Never a gross: see the note at the top. */
  netCents: number,
  /** The account the money is going to. When it is the PLATFORM's own — the
   *  workspace that owns The Thread is a real seller — Stripe refuses a fee
   *  outright ("Can only apply an application_fee when the request is made on
   *  behalf of another account"), so the fee is zero rather than an error at
   *  the Pay button. Omitted, the fee is charged as before. */
  destinationAccountId?: string | null,
): Promise<number> {
  if (destinationAccountId && (await isOwnAccount(destinationAccountId))) return 0;
  let feePct = 0.02;
  let feeCapCents: number | null = 200;
  try {
    const { data: feeRows } = await adminClient.rpc('workspace_meet_fee', {
      ws_id: workspaceId,
    });
    const row = Array.isArray(feeRows) ? feeRows[0] : null;
    if (row) {
      // numeric comes back as a string from PostgREST sometimes; coerce.
      const rawPct = (row as { pct: number | string }).pct;
      feePct = typeof rawPct === 'string' ? parseFloat(rawPct) : rawPct;
      feeCapCents = (row as { cap_cents: number | null }).cap_cents;
    }
  } catch (e) {
    console.warn('[fees] workspace_meet_fee lookup failed, defaulting to Free rate', e);
  }
  return computeFeeCents(netCents, feePct, feeCapCents);
}

/** The NET of a ledger row: its VAT breakdown's subtotal when it carries one
 *  (VAT on top, or an inclusive split), else the amount itself (no VAT). For
 *  a payment link, which charges the row's gross as one line, so its fee is
 *  taken on what the fee is meant to be on. */
export function netOfPurchase(p: {
  amount_cents: number;
  billing?: { subtotal_cents?: number | null; tax_cents?: number | null } | null;
}): number {
  const b = p.billing ?? null;
  if (b && typeof b.tax_cents === 'number' && typeof b.subtotal_cents === 'number') return b.subtotal_cents;
  return p.amount_cents;
}

/** The fee math, pure: floor(gross × pct), capped when a cap is set. */
export function computeFeeCents(
  grossCents: number,
  pct: number,
  capCents: number | null,
): number {
  const computed = Math.floor(grossCents * pct);
  return capCents !== null ? Math.min(computed, capCents) : computed;
}
