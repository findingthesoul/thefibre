// Monthly platform-fee statements — the VAT invoice for what Stripe already
// took (Sjoerd, 2026-09-15: "is that also an invoice, weekly or monthly?").
//
// On every card payment an organiser or workspace receives, Stripe deducts
// the plan's platform fee at the moment of the charge (an application fee on
// the connected account: lib/fees.ts decides the amount, the ledger records
// it in `platform_fee_cents`). The organiser sees the net payout and nothing
// ever invoiced them for the fee — a taxable service with no invoice. This
// module issues one statement per workspace per month, for the fees settled
// through Stripe in that month, as a `fibre-platform` row in the same ledger
// every other invoice lives in, and emails it from The Thread with the
// platform as seller.
//
// Facts this rests on:
//   - Money: nothing is charged. The statement is `paid` on creation because
//     Stripe collected the amount already; it documents, it does not bill.
//   - VAT: the fee was collected as a gross amount, so the statement splits
//     VAT OUT of it (inclusive) at the home rate from /admin/vat — unless the
//     workspace holds a VAT number from another EU country, in which case
//     the charge is reverse-charged and the whole fee is the subtotal.
//     The workspace's country is not stored anywhere; the VAT number's
//     two-letter prefix is the only signal, and a workspace without one is
//     treated as domestic. Non-EU workspaces do not exist yet; when they do,
//     the country needs a field before this can say "out of scope".
//   - Fees on the invoice rail (an organiser who collects by bank transfer)
//     are recorded but never collected by anyone. They are deliberately NOT
//     on this statement: putting them on would turn a document into a bill,
//     which is a business decision, not a job's.
//   - Idempotent on (app, item_ref): re-running a month creates nothing new
//     and sends nothing twice. Safe from the scheduler and by hand.
//
// Runs from the scheduler on the 2nd of each month for the previous month
// (server.ts), and on demand via POST /api/v1/admin/fee-statements/run.

import { ENTITY } from '@thefibre/shared';
import { adminClient } from '../db.js';
import { adminEmails } from './usage-meters.js';
import { recordPurchase } from './purchases.js';
import { inclusiveVat } from './seller-vat.js';
import { getVatRates } from './vat.js';
import { sendReceipt } from '../routes/purchases.js';

const EU = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'EL', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

/** 'YYYY-MM' → the UTC window [start, end) and a human label. */
export function monthWindow(month: string): { start: string; end: string; label: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error(`month must be YYYY-MM, got ${month}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error(`month out of range: ${month}`);
  const start = new Date(Date.UTC(y, mo - 1, 1));
  const end = new Date(Date.UTC(y, mo, 1));
  const label = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start);
  return { start: start.toISOString(), end: end.toISOString(), label };
}

/** The month before the one `now` is in, as 'YYYY-MM' (UTC). */
export function previousMonth(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The VAT split for a fee total already collected, given the payer's VAT number. */
export function feeVatSplit(
  totalCents: number,
  taxNo: string | null | undefined,
  rates: { home_country: string; eu_b2b_reverse_charge: boolean; rates: Record<string, number> },
): { subtotal_cents: number; tax_cents: number; tax_label: string; reverse_charge: boolean } {
  const home = rates.home_country.toUpperCase();
  const prefix = (taxNo ?? '').trim().slice(0, 2).toUpperCase();
  if (rates.eu_b2b_reverse_charge && prefix && EU.has(prefix) && prefix !== home) {
    return { subtotal_cents: totalCents, tax_cents: 0, tax_label: 'VAT reverse-charged (EU B2B)', reverse_charge: true };
  }
  const pct = rates.rates[home] ?? 21;
  const split = inclusiveVat(totalCents, pct);
  return { ...split, tax_label: `incl. VAT ${pct}% (${home})`, reverse_charge: false };
}

export type FeeStatement = {
  workspace_id: string;
  workspace: string;
  month: string;
  currency: string;
  payments: number;
  fee_cents: number;
  item_ref: string;
  outcome: 'created' | 'exists' | 'dry-run' | 'no-recipient';
  sent_to: string | null;
};

export async function issueFeeStatements(opts: {
  month?: string | undefined;
  dryRun?: boolean | undefined;
  send?: boolean | undefined;
} = {}): Promise<FeeStatement[]> {
  const month = opts.month ?? previousMonth();
  const { start, end, label } = monthWindow(month);
  const send = opts.send ?? true;

  const { data: platform } = await adminClient.from('app').select('id').eq('slug', 'fibre-platform').single();
  if (!platform) throw new Error('fibre-platform app row missing');

  // Fees Stripe settled in the month: paid, on the card rail, from an app
  // sale (the platform's own subscription rows carry the whole amount in
  // platform_fee_cents and are not fees).
  const { data: rows, error } = await adminClient
    .from('purchase')
    .select('workspace_id, platform_fee_cents, currency')
    .eq('status', 'paid')
    .eq('method', 'stripe')
    .gt('platform_fee_cents', 0)
    .neq('app_id', platform.id)
    .gte('paid_at', start)
    .lt('paid_at', end);
  if (error) throw new Error(`fee rows: ${error.message}`);

  const groups = new Map<string, { workspace_id: string; currency: string; fee: number; n: number }>();
  for (const r of rows ?? []) {
    const cur = String(r.currency ?? 'EUR').toUpperCase();
    const key = `${r.workspace_id}:${cur}`;
    const g = groups.get(key) ?? { workspace_id: r.workspace_id as string, currency: cur, fee: 0, n: 0 };
    g.fee += Number(r.platform_fee_cents ?? 0);
    g.n += 1;
    groups.set(key, g);
  }

  const rates = await getVatRates();
  const out: FeeStatement[] = [];
  for (const g of groups.values()) {
    const itemRef = g.currency === 'EUR' ? `platform-fees-${month}` : `platform-fees-${month}-${g.currency}`;
    const { data: ws } = await adminClient
      .from('workspace')
      .select('name, slug, invoice_details')
      .eq('id', g.workspace_id)
      .maybeSingle();
    const details = (ws?.invoice_details ?? null) as { legal_name?: string; address?: string; tax_no?: string } | null;
    const base: Omit<FeeStatement, 'outcome' | 'sent_to'> = {
      workspace_id: g.workspace_id,
      workspace: ws?.name ?? g.workspace_id,
      month,
      currency: g.currency,
      payments: g.n,
      fee_cents: g.fee,
      item_ref: itemRef,
    };

    const { data: existing } = await adminClient
      .from('purchase')
      .select('id')
      .eq('app_id', platform.id)
      .eq('item_ref', itemRef)
      .maybeSingle();
    if (existing) {
      out.push({ ...base, outcome: 'exists', sent_to: null });
      continue;
    }
    if (opts.dryRun) {
      out.push({ ...base, outcome: 'dry-run', sent_to: null });
      continue;
    }

    const recipients = await adminEmails(g.workspace_id);
    const to = recipients[0] ?? null;
    const vat = feeVatSplit(g.fee, details?.tax_no ?? null, rates);
    const number = `PF-${month.replace('-', '')}-${(ws?.slug ?? g.workspace_id).slice(0, 24).toUpperCase()}`;
    await recordPurchase({
      appSlug: 'fibre-platform',
      workspaceId: g.workspace_id,
      itemRef,
      itemLabel: `Platform fees ${label} · ${g.n} payment${g.n === 1 ? '' : 's'} settled through Stripe`,
      payerName: details?.legal_name ?? ws?.name ?? '',
      payerEmail: to,
      amountCents: g.fee,
      currency: g.currency,
      platformFeeCents: g.fee,
      vendorShareCents: 0,
      orgShareCents: 0,
      method: 'stripe',
      status: 'paid',
      billing: {
        number,
        company: details?.legal_name ?? ws?.name ?? null,
        address: details?.address ?? null,
        tax_no: details?.tax_no ?? null,
        subtotal_cents: vat.subtotal_cents,
        tax_cents: vat.tax_cents,
        tax_label: vat.tax_label,
        period_end: end,
        settled_via: 'stripe application fees',
      },
    });

    if (!to) {
      out.push({ ...base, outcome: 'created', sent_to: null });
      continue;
    }
    if (send) {
      const { data: saved } = await adminClient
        .from('purchase')
        .select('id, app_id, payer_name, payer_email, item_label, amount_cents, currency, method, status, created_at, paid_at, billing, stripe_invoice_url')
        .eq('app_id', platform.id)
        .eq('item_ref', itemRef)
        .maybeSingle();
      if (saved) {
        await sendReceipt(g.workspace_id, saved as Record<string, unknown>, {
          legal_name: ENTITY.name,
          address: ENTITY.address,
        }, to).catch((e) => console.error('[fee-statements] email failed', itemRef, e));
      }
    }
    out.push({ ...base, outcome: 'created', sent_to: send ? to : null });
  }
  return out;
}

// Scheduler entry: once a month is over and the 2nd has arrived, issue the
// previous month's statements. Idempotent on the ledger, so the only thing
// this guard saves is a query every five minutes.
let doneMonth: string | null = null;
export async function runFeeStatementTick(now = new Date()): Promise<void> {
  if (now.getUTCDate() < 2) return;
  const month = previousMonth(now);
  if (doneMonth === month) return;
  const result = await issueFeeStatements({ month, send: true });
  const created = result.filter((r) => r.outcome === 'created');
  if (created.length) console.log(`[fee-statements] ${month}: ${created.length} statement(s) issued`);
  doneMonth = month;
}
