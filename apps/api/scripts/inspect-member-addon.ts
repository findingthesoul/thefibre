// READ-ONLY: what the database and Stripe hold for one member's add-on, so the
// move-addon-to-membership refusal ("found 0 one-off purchases") can be
// explained. Nothing is written, anywhere.
//
//   cd apps/api
//   npx tsx --env-file=<env> scripts/inspect-member-addon.ts prod --workspace soul --email <addr> --product "<name>"
//
// Prints, for that address in that workspace:
//   · the person rows (live and deleted) and their memberships;
//   · EVERY membership_product_purchase row of those persons, any product,
//     any status (so a converted, refunded or cancelled one shows);
//   · ledger (purchase) rows by person OR by payer email;
//   · with STRIPE_SECRET_KEY: the membership subscription's status, trial,
//     collection method, whether the subscription and the customer have a
//     default payment method (yes/no only — never a card's details), default
//     tax rates, each item's tax rates, VAT metadata, and Stripe's preview of
//     the next invoice (net / tax / total).

import Stripe from 'stripe';
import { adminClient } from '../src/db.js';
import { stripeOrNull } from '../src/lib/stripe/client.js';
import { workspaceStripeAccount } from '../src/lib/payment-accounts.js';

const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const args = process.argv.slice(2);
const target = args[0];
const opt = (n: string) => {
  const i = args.indexOf(n);
  const v = i >= 0 ? args[i + 1] : undefined;
  return v && !v.startsWith('--') ? v : undefined;
};
const wsSlug = opt('--workspace');
const email = opt('--email')?.toLowerCase();
const productArg = opt('--product');
if ((target !== 'prod' && target !== 'staging') || !wsSlug || !email) {
  console.error('usage: npx tsx --env-file=<env> scripts/inspect-member-addon.ts prod|staging --workspace <slug> --email <addr> [--product <name|id>]');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}
const db = adminClient;
const show = (label: string, rows: unknown[] | null | undefined) => {
  console.log(`\n${label} (${rows?.length ?? 0})`);
  for (const r of rows ?? []) console.log('  ' + JSON.stringify(r));
};

const { data: ws } = await db.from('workspace').select('id, name').eq('slug', wsSlug).maybeSingle();
if (!ws) {
  console.error(`no workspace ${wsSlug}`);
  process.exit(2);
}
const { data: persons } = await db.from('person').select('id, email, email_secondary, first_name, last_name, deleted_at, created_at').eq('workspace_id', ws.id).eq('email', email);
const { data: viaPoint } = await db.from('person_contact_point').select('person_id, value, verified_at').eq('workspace_id', ws.id).eq('kind', 'email').eq('value', email);
const personIds = [...new Set([...(persons ?? []).map((p) => p.id as string), ...(viaPoint ?? []).map((p) => p.person_id as string)])];
console.log(`${target} · ${ws.name} (${wsSlug}) · ${email} · READ-ONLY`);
show('person rows with this email', persons);
show('contact points with this email', viaPoint);

if (productArg) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(productArg);
  const { data: prods } = await db.from('membership_product').select('id, name, price_cents, price_interval, archived_at').eq('workspace_id', ws.id).eq(isUuid ? 'id' : 'name', productArg);
  show('the product', prods);
}

const { data: members } = personIds.length
  ? await db.from('membership_member').select('id, person_id, status, tier_id, stripe_subscription_id, stripe_customer_id, renews_at, created_at').eq('workspace_id', ws.id).in('person_id', personIds)
  : { data: [] };
show('memberships', members);

const { data: grants } = personIds.length
  ? await db.from('membership_product_purchase').select('id, person_id, product_id, status, stripe_session_id, stripe_subscription_id, amount_cents, currency, created_at, ends_at').eq('workspace_id', ws.id).in('person_id', personIds).order('created_at')
  : { data: [] };
show('membership_product_purchase rows (any product, any status)', grants);

const [{ data: byPerson }, { data: byPayer }] = await Promise.all([
  personIds.length ? db.from('purchase').select('id, person_id, payer_email, item_label, amount_cents, currency, status, stripe_invoice_id, created_at').eq('workspace_id', ws.id).in('person_id', personIds).order('created_at') : Promise.resolve({ data: [] }),
  db.from('purchase').select('id, person_id, payer_email, item_label, amount_cents, currency, status, stripe_invoice_id, created_at').eq('workspace_id', ws.id).eq('payer_email', email).order('created_at'),
]);
const ledger = new Map<string, unknown>();
for (const r of [...(byPerson ?? []), ...(byPayer ?? [])]) ledger.set((r as { id: string }).id, r);
show('ledger (purchase) rows by person or payer email', [...ledger.values()]);

const stripe = stripeOrNull();
const subId = (members ?? []).find((m) => m.stripe_subscription_id)?.stripe_subscription_id as string | undefined;
if (!stripe) console.log('\n(no STRIPE_SECRET_KEY: the subscription part is skipped)');
else if (subId) {
  const account = await workspaceStripeAccount(ws.id as string);
  const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price.product'] }, { stripeAccount: account! });
  const rateOf = (r: string | Stripe.TaxRate) => (typeof r === 'string' ? r : `${r.percentage}% ${r.id}${r.active ? '' : ' (inactive)'}`);
  console.log(`\nsubscription ${sub.id} · ${sub.status} · trial_end ${sub.trial_end ? new Date(sub.trial_end * 1000).toISOString().slice(0, 10) : 'none'} · cancel_at_period_end ${sub.cancel_at_period_end}`);
  // Yes/no only: whether a charge now (an add-on) or at the renewal has a
  // card to go to. Never the card's brand, digits or expiry.
  const cust = await stripe.customers.retrieve(sub.customer as string, {}, { stripeAccount: account! });
  const custPm = !cust.deleted && !!((cust as Stripe.Customer).invoice_settings?.default_payment_method || (cust as Stripe.Customer).default_source);
  console.log(`  collection_method: ${sub.collection_method} · default payment method: subscription ${sub.default_payment_method ? 'yes' : 'no'}, customer ${custPm ? 'yes' : 'no'}`);
  console.log(`  default_tax_rates: ${(sub.default_tax_rates ?? []).map(rateOf).join(', ') || 'none'}`);
  for (const it of sub.items.data) {
    const name = typeof it.price.product === 'string' ? it.price.product : (it.price.product as Stripe.Product).name;
    console.log(`  item ${it.id}: ${name} ${(it.price.unit_amount ?? 0) / 100} ${it.price.currency} / ${it.price.recurring?.interval} · item tax_rates: ${(it.tax_rates ?? []).map(rateOf).join(', ') || 'none'}`);
  }
  console.log(`  metadata vat: ${JSON.stringify(Object.fromEntries(Object.entries(sub.metadata ?? {}).filter(([k]) => k.startsWith('vat'))))}`);
  const next = await stripe.invoices.createPreview({ subscription: sub.id }, { stripeAccount: account! });
  const tax = (next.total_taxes ?? []).reduce((s, x) => s + (x.amount ?? 0), 0);
  console.log(`  next invoice preview: total ${next.total / 100} · tax ${tax / 100} · ${next.lines.data.map((l) => `${l.description} ${l.amount / 100}`).join(' · ')}`);
}
console.log('\nnothing was written.');
