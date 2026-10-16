// Thread card payments whose PLATFORM FEE was worked out on the price
// INCLUDING VAT — a list, not a change. For Sjoerd to decide (2026-10-16).
//
// Two paths, and they go wrong differently:
//   · the Stripe WEBHOOK (routes/thread.ts, checkout.session.completed)
//     records the fee as platformFeeCents(gross). The checkout itself took
//     the fee on the NET (application_fee_amount at enrol), so the money is
//     right and the LEDGER is wrong: purchase.platform_fee_cents and the
//     vendor/org shares are computed on the gross;
//   · the PAYMENT LINK (routes/purchases.ts send-payment-link) charges the
//     ledger's gross as one line with application_fee_amount =
//     platformFeeCents(gross): there Stripe actually TOOK the fee on the VAT.
//
// For every paid or refunded Thread card purchase that carried VAT on top,
// this reads the fee Stripe actually took (the charge's application fee),
// the fee the ledger recorded, and the fee on the net at the workspace's
// CURRENT rate (lib/fees — an approximation for older rows if the plan
// changed since), and says which case each row is.
//
//   cd apps/api
//   npx tsx --env-file=.env.staging scripts/audit-fee-on-gross.ts staging
//   npx tsx --env-file=.env scripts/audit-fee-on-gross.ts prod
//
// Read-only: selects on the ledger, retrieves from Stripe. Writes nothing.
// Prints purchase ids and amounts only — never a payer's name or address.

import { adminClient } from '../src/db.js';
import { stripeOrNull } from '../src/lib/stripe/client.js';
import { platformFeeCents } from '../src/lib/fees.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const target = process.argv[2];
if (target !== 'prod' && target !== 'staging') {
  console.error('usage: npx tsx --env-file=<env> scripts/audit-fee-on-gross.ts prod|staging');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}
const stripe = stripeOrNull();
if (!stripe) {
  console.error(
    'REFUSED: this env file has no STRIPE_SECRET_KEY, and the fee Stripe actually took is only on the Stripe charge. ' +
      'Add the key for this stack to the env file (or export it for this one command) and run it again.',
  );
  process.exit(2);
}

const { data: app } = await adminClient.from('app').select('id').eq('slug', 'the-thread').single();
if (!app) throw new Error('no the-thread app row');
const { data: rows, error } = await adminClient
  .from('purchase')
  .select('id, workspace_id, amount_cents, currency, platform_fee_cents, paid_at, status, billing, stripe_payment_intent, stripe_account_id, stripe_session_id')
  .eq('app_id', app.id)
  .eq('method', 'stripe')
  .in('status', ['paid', 'refunded'])
  .order('paid_at', { ascending: true });
if (error) throw new Error(`purchases: ${error.message}`);

type Line = { kind: string; when: string; id: string; gross: number; net: number; taken: number | null; recorded: number; onNet: number; cur: string };
const out: Line[] = [];
let skipped = 0;
for (const r of rows ?? []) {
  const b = (r.billing ?? {}) as Record<string, unknown>;
  const tax = typeof b.tax_cents === 'number' ? b.tax_cents : 0;
  const label = (b.tax_label as string | undefined) ?? '';
  // Only VAT ON TOP: an inclusive split never changed what was charged.
  if (tax <= 0 || label.startsWith('incl.')) continue;
  const gross = r.amount_cents as number;
  const net = typeof b.subtotal_cents === 'number' ? b.subtotal_cents : gross - tax;
  const onNet = await platformFeeCents(r.workspace_id as string, net, (r.stripe_account_id as string | null) ?? null);
  const recorded = (r.platform_fee_cents as number | null) ?? 0;

  let taken: number | null = null;
  if (r.stripe_payment_intent && r.stripe_account_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(
        r.stripe_payment_intent as string,
        { expand: ['latest_charge'] },
        { stripeAccount: r.stripe_account_id as string },
      );
      const ch = pi.latest_charge as { application_fee_amount?: number | null } | null;
      taken = ch?.application_fee_amount ?? 0;
    } catch {
      skipped++;
    }
  } else {
    skipped++;
  }

  const kind =
    taken !== null && taken > onNet
      ? 'TAKEN on gross (money)'
      : recorded > onNet
        ? 'RECORDED on gross (ledger only)'
        : 'ok';
  if (kind === 'ok') continue;
  out.push({ kind, when: String(r.paid_at ?? '').slice(0, 10), id: r.id as string, gross, net, taken, recorded, onNet, cur: String(r.currency ?? 'EUR') });
}

const taken = out.filter((l) => l.kind.startsWith('TAKEN'));
const recorded = out.filter((l) => l.kind.startsWith('RECORDED'));
console.log(`${target}: ${rows?.length ?? 0} Thread card purchases read; ${skipped} could not be checked against Stripe.`);
console.log(`  fee TAKEN on the price incl. VAT (money): ${taken.length}, over by ${taken.reduce((s, l) => s + ((l.taken ?? 0) - l.onNet), 0)} cents in total`);
console.log(`  fee RECORDED on the price incl. VAT (ledger only): ${recorded.length}, overstated by ${recorded.reduce((s, l) => s + (l.recorded - l.onNet), 0)} cents in total`);
for (const l of out) {
  console.log(`  ${l.when}  ${l.kind.padEnd(32)} purchase ${l.id} gross ${l.gross} net ${l.net} | taken ${l.taken ?? '?'} recorded ${l.recorded} on-net ${l.onNet} ${l.cur}`);
}
