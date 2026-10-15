// Membership invoices where the PLATFORM FEE was taken on the VAT too — a
// list, not a change. For Sjoerd to decide whether to refund the difference.
//
// From 1.208.0 (batch 29) until 1.209.0, a membership join added VAT on top
// while its platform fee stayed a Stripe `application_fee_percent`, which
// Stripe applies to the invoice TOTAL — VAT included. 1.209.0 scales the
// percentage to the net (feeOnNetPercent). This lists every paid membership
// invoice that carried VAT on top and a platform fee, with the fee taken, the
// fee on the net, and the difference.
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/audit-fee-on-vat.ts prod
//   npx tsx --env-file=.env.staging scripts/audit-fee-on-vat.ts staging
//
// Read-only: it reads the ledger and each invoice from Stripe (the fee Stripe
// actually took is on the invoice, `application_fee_amount`).

import { adminClient } from '../src/db.js';
import { stripeOrNull } from '../src/lib/stripe/client.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const target = process.argv[2];
if (target !== 'prod' && target !== 'staging') {
  console.error('usage: npx tsx --env-file=<env> scripts/audit-fee-on-vat.ts prod|staging');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}
const stripe = stripeOrNull();
if (!stripe) {
  console.error('REFUSED: no STRIPE_SECRET_KEY in this env file — the fee taken is only on the Stripe invoice.');
  process.exit(2);
}

const { data: app } = await adminClient.from('app').select('id').eq('slug', 'membership').single();
if (!app) throw new Error('no membership app row');
const { data: rows, error } = await adminClient
  .from('purchase')
  .select('id, payer_name, payer_email, amount_cents, currency, paid_at, billing, stripe_invoice_id, stripe_account_id')
  .eq('app_id', app.id)
  .eq('status', 'paid')
  .not('stripe_invoice_id', 'is', null)
  .order('paid_at', { ascending: true });
if (error) throw new Error(`purchases: ${error.message}`);

let considered = 0;
let totalDiff = 0;
const lines: string[] = [];
for (const r of rows ?? []) {
  const b = (r.billing ?? {}) as Record<string, unknown>;
  const tax = typeof b.tax_cents === 'number' ? b.tax_cents : 0;
  const label = (b.tax_label as string | undefined) ?? '';
  // Only VAT ON TOP: the old inclusive split ("incl. VAT …") never changed
  // what Stripe's total was, so its fee was always on the price as charged.
  if (tax <= 0 || label.startsWith('incl.') || !r.stripe_account_id) continue;
  considered++;
  let feeTaken = 0;
  try {
    const inv = await stripe.invoices.retrieve(r.stripe_invoice_id as string, {}, { stripeAccount: r.stripe_account_id as string });
    feeTaken = (inv as unknown as { application_fee_amount?: number | null }).application_fee_amount ?? 0;
  } catch (e) {
    lines.push(`  ? ${r.stripe_invoice_id}: not readable from Stripe — ${(e as Error).message}`);
    continue;
  }
  if (feeTaken <= 0) continue;
  const gross = r.amount_cents as number;
  const net = gross - tax;
  const feeOnNet = Math.round((feeTaken * net) / gross);
  const diff = feeTaken - feeOnNet;
  if (diff <= 0) continue;
  totalDiff += diff;
  lines.push(
    `  ${(r.paid_at ?? '').slice(0, 10)}  ${(gross / 100).toFixed(2)} ${r.currency} (net ${(net / 100).toFixed(2)})  fee taken ${(feeTaken / 100).toFixed(2)}  ` +
      `fee on net ${(feeOnNet / 100).toFixed(2)}  difference ${(diff / 100).toFixed(2)}  ${r.payer_name ?? ''} <${r.payer_email ?? ''}>  [invoice ${r.stripe_invoice_id}]`,
  );
}

console.log(`${target}: ${(rows ?? []).length} paid membership invoices; ${considered} with VAT on top; ${lines.length} where the fee was taken on the VAT.`);
if (lines.length) console.log(lines.join('\n'));
console.log(`\nTotal fee taken on VAT: ${(totalDiff / 100).toFixed(2)} (refund to the community, or leave). Nothing was changed.`);
