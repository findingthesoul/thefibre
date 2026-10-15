// Put VAT on the RENEWALS of a community's existing memberships — from the
// next renewal on, nothing charged now and nothing back-charged.
//
// Sjoerd, 2026-10-15: "existing members (only 1) should receive an invoice of
// 300 excl, so 363 incl, from January. For the past, she is lucky. New ones
// should pay 363 (incl VAT) immediately." New joins get VAT from release
// 1.208.0; a subscription started before it carries no tax rate, so this
// gives it one.
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/apply-vat-to-subscriptions.ts prod --workspace soul          # dry run
//   npx tsx --env-file=.env scripts/apply-vat-to-subscriptions.ts prod --workspace soul --apply  # writes
//
// Per live subscription it decides the VAT by THE rule (lib/sale-vat.ts) from
// the member's country (membership_member.country → subscription metadata →
// the Stripe customer's address) and VAT number (subscription metadata →
// the customer's tax ids). The dry run prints member, current amount, country,
// VAT number, the rule's answer and the gross at the next renewal. --apply:
//   · sets the subscription's default tax rate to the community's own Stripe
//     tax rate (connectedTaxRateId), proration_behavior 'none' — so the change
//     bills nothing now and applies from the next invoice;
//   · stamps vat_rule / vat_label metadata, so the ledger records that
//     invoice as net / VAT / gross (vatBreakdownFromInvoice).
// A subscription that already carries a tax rate is left alone. A member
// with no VAT due (reverse charge, outside the EU) gets only the metadata,
// so the invoice says why it carries no VAT.

import Stripe from 'stripe';
import { adminClient } from '../src/db.js';
import { stripeOrNull } from '../src/lib/stripe/client.js';
import { workspaceStripeAccount } from '../src/lib/payment-accounts.js';
import { resolveSellerVat } from '../src/lib/seller-vat.js';
import { saleVat } from '../src/lib/sale-vat.js';
import { connectedTaxRateId } from '../src/lib/vat-stripe.js';
import { readBillingMetadata } from '../src/lib/membership-customer.js';
import { vatMetadata } from '../src/routes/membership.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const args = process.argv.slice(2);
const target = args[0];
const wsSlug = args[args.indexOf('--workspace') + 1];
const apply = args.includes('--apply');
if ((target !== 'prod' && target !== 'staging') || !args.includes('--workspace') || !wsSlug || wsSlug.startsWith('--')) {
  console.error('usage: npx tsx --env-file=<env> scripts/apply-vat-to-subscriptions.ts prod|staging --workspace <slug> [--apply]');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}
const stripe = stripeOrNull();
if (!stripe) {
  console.error('REFUSED: no STRIPE_SECRET_KEY in this env file — nothing can be read from Stripe.');
  process.exit(2);
}

const { data: ws, error: wsErr } = await adminClient.from('workspace').select('id, slug, name').eq('slug', wsSlug).maybeSingle();
if (wsErr || !ws) throw new Error(`workspace ${wsSlug}: ${wsErr?.message ?? 'not found'}`);
const account = await workspaceStripeAccount(ws.id as string);
if (!account) throw new Error(`${wsSlug} has no connected Stripe account`);
if (!(await resolveSellerVat(ws.id as string))) {
  console.log(`${wsSlug} is not marked VAT-registered — no VAT to add. Nothing to do.`);
  process.exit(0);
}

const { data: members, error: mErr } = await adminClient
  .from('membership_member')
  .select('id, person_id, country, status, stripe_subscription_id, person:person_id (email, first_name, last_name)')
  .eq('workspace_id', ws.id)
  .in('status', ['active', 'grace'])
  .not('stripe_subscription_id', 'is', null);
if (mErr) throw new Error(`members: ${mErr.message}`);

console.log(`${target} · ${ws.name} (${wsSlug}) · ${apply ? 'APPLYING' : 'dry run'} · ${(members ?? []).length} live subscription(s)\n`);
let changed = 0;
for (const m of members ?? []) {
  const person = (Array.isArray(m.person) ? m.person[0] : m.person) as { email?: string; first_name?: string; last_name?: string } | null;
  const who = `${[person?.first_name, person?.last_name].filter(Boolean).join(' ') || '?'} <${person?.email ?? '?'}>`;
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(m.stripe_subscription_id as string, { expand: ['customer', 'customer.tax_ids'] }, { stripeAccount: account });
  } catch (e) {
    console.log(`  ✗ ${who}: subscription ${m.stripe_subscription_id} not readable — ${(e as Error).message}`);
    continue;
  }
  const items = sub.items.data;
  const netCents = items.reduce((sum, it) => sum + (it.price.unit_amount ?? 0) * (it.quantity ?? 1), 0);
  const currency = (items[0]?.price.currency ?? 'eur').toUpperCase();
  const nextRenewal = items[0]?.current_period_end ? new Date(items[0].current_period_end * 1000).toISOString().slice(0, 10) : '?';
  const alreadyTaxed = (sub.default_tax_rates ?? []).length > 0 || items.some((it) => (it.tax_rates ?? []).length > 0);
  const customer = typeof sub.customer === 'string' ? null : (sub.customer as Stripe.Customer);
  const country =
    (m.country as string | null)?.toUpperCase() ||
    (sub.metadata?.country as string | undefined)?.toUpperCase() ||
    customer?.address?.country?.toUpperCase() ||
    null;
  const taxIds = (customer as unknown as { tax_ids?: { data?: { value?: string }[] } } | null)?.tax_ids?.data ?? [];
  const vatId = readBillingMetadata(sub.metadata).tax_no || taxIds[0]?.value || null;
  const vat = await saleVat({ workspaceId: ws.id as string, net_cents: netCents, country, vat_id: vatId });
  const line =
    `  · ${who}  sub ${sub.id}  now ${(netCents / 100).toFixed(2)} ${currency}  country ${country ?? '?? (none known — home rate)'}` +
    `${vatId ? `  VAT no. ${vatId}` : ''}  →  ${vat.label ?? 'no VAT'}: at renewal ${nextRenewal} ${(vat.gross_cents / 100).toFixed(2)} ${currency}`;
  if (alreadyTaxed) {
    console.log(`${line}  (already carries a tax rate — left alone)`);
    continue;
  }
  console.log(line);
  if (!apply) continue;
  const rateId = vat.rate_pct > 0 && vat.rate_country ? await connectedTaxRateId(account, vat.rate_country, vat.rate_pct) : null;
  await stripe.subscriptions.update(
    sub.id,
    {
      ...(rateId ? { default_tax_rates: [rateId] } : {}),
      proration_behavior: 'none',
      metadata: { ...sub.metadata, ...vatMetadata(vat) },
    },
    { stripeAccount: account },
  );
  changed++;
  console.log(`    ✓ applied${rateId ? ` (tax rate ${rateId})` : ' (metadata only — no VAT due)'}; nothing charged now`);
}
console.log(`\n${apply ? `${changed} subscription(s) changed.` : 'Dry run — nothing changed. Add --apply to write.'}`);
