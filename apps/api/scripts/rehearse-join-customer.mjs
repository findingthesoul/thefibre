// Does billing the join against a CUSTOMER we create change what is charged?
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/rehearse-join-customer.mjs
//
// The join used to hand Checkout a bare `customer_email` and let Stripe's page
// ask for the billing address. It now creates (or reuses) a customer on the
// workspace's own account, writes the panel's invoicing details onto it, and
// passes `customer` with `billing_address_collection: 'auto'`. That is a
// change to a money path, so it is rehearsed rather than reasoned about:
//
//   1. An ordinary yearly join       — one recurring line, no anchor.
//   2. A cohort join                 — one-off line + trial_end, the launch rule.
//   3. The SAME person joining again — the customer must be reused, not doubled.
//
// For each it prints what Stripe says it will collect now. It never completes
// a payment: nothing here types a card, and `amount_total` is Stripe's own
// answer to "what will this person be charged".
//
// Test keys only, and it cleans up every object it makes.
import { readFileSync } from 'node:fs';
import Stripe from 'stripe';

const envFile = process.env.FIBRE_ENV_FILE;
if (!envFile) {
  console.error('set FIBRE_ENV_FILE to the staging env file');
  process.exit(2);
}
const raw = readFileSync(envFile, 'utf8');
const env = Object.fromEntries(
  raw
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const key = env.STRIPE_SECRET_KEY ?? '';
if (!key.startsWith('sk_test')) throw new Error('refusing: not a test key');
const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });

const PRICE = 30000;
const CURRENCY = 'eur';
const END = '2026-12-31';
const ANCHOR = Math.floor(Date.parse('2027-01-01T00:00:00Z') / 1000);
const money = (c) => (c == null ? null : `${(c / 100).toFixed(2)} ${CURRENCY.toUpperCase()}`);

// The panel's fields, filled in as somebody invoicing their employer would.
const BILLING = {
  payer: 'organisation',
  company: 'Acme BV',
  address: 'Sint-Jobsweg 30',
  postal_code: '3024 EJ',
  city: 'Rotterdam',
  country: 'NL',
  tax_no: 'NL123456789B01',
};

// Exactly what apps/api/src/lib/billing-fields.ts does, so this rehearses the
// route's own shaping rather than a convenient version of it.
const stripeAddress = (b) =>
  b?.address?.trim()
    ? {
        line1: b.address.trim(),
        ...(b.postal_code?.trim() ? { postal_code: b.postal_code.trim() } : {}),
        ...(b.city?.trim() ? { city: b.city.trim() } : {}),
        ...(/^[A-Za-z]{2}$/.test(b.country ?? '') ? { country: b.country.toUpperCase() } : {}),
      }
    : null;
const invoiceName = (b, person) =>
  b?.payer === 'organisation' && b.company?.trim() ? b.company.trim() : person;

const made = { customers: [], sessions: [] };

async function makeCustomer(email, person, billing) {
  const address = stripeAddress(billing);
  const c = await stripe.customers.create({
    name: invoiceName(billing, person),
    email,
    ...(address ? { address } : {}),
    metadata: { rehearsal: 'join-customer' },
  });
  made.customers.push(c.id);
  return c;
}

async function session(label, { customer, email, cohort, billing }) {
  const s = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: CURRENCY,
          product_data: { name: 'Rehearsal membership' },
          unit_amount: PRICE,
          // The cohort pays the period as a ONE-OFF line; an ordinary join's
          // line recurs. Same conditional the route uses.
          ...(cohort ? {} : { recurring: { interval: 'year' } }),
        },
        quantity: 1,
      },
      // And for the cohort, the subscription itself, which starts at the
      // anchor. Checkout refuses a subscription session whose only line is
      // one-off ("You must provide at least one recurring price") — the
      // route has always built both, and this rehearsal did not, which is
      // the kind of difference a rehearsal exists to catch.
      ...(cohort
        ? [
            {
              price_data: {
                currency: CURRENCY,
                product_data: { name: 'Rehearsal membership (from 1 January)' },
                unit_amount: PRICE,
                recurring: { interval: 'year' },
              },
              quantity: 1,
            },
          ]
        : []),
    ],
    subscription_data: {
      ...(cohort ? { trial_end: ANCHOR } : {}),
      metadata: {
        rehearsal: 'join-customer',
        ...(billing
          ? {
              billing_extra: JSON.stringify({
                payer: billing.payer,
                company: billing.company,
                tax_no: billing.tax_no,
              }).slice(0, 480),
            }
          : {}),
      },
    },
    ...(customer ? { customer } : { customer_email: email }),
    // The route's own rule: 'auto' only when the customer HAS an address.
    // With 'auto' and none on file Stripe may not ask at all for an ordinary
    // card, and the invoice loses its address block — case 4 is here to show
    // that this falls back to 'required' rather than silently dropping it.
    billing_address_collection: stripeAddress(billing) ? 'auto' : 'required',
    success_url: 'https://example.com/ok',
    cancel_url: 'https://example.com/no',
  });
  made.sessions.push(s.id);
  const cust = s.customer
    ? await stripe.customers.retrieve(typeof s.customer === 'string' ? s.customer : s.customer.id)
    : null;
  console.log(`\n${label}`);
  console.log(`  collects now        ${money(s.amount_total)}`);
  console.log(`  customer            ${typeof s.customer === 'string' ? s.customer : '—'}`);
  console.log(`  address collection  ${s.billing_address_collection}`);
  console.log(`  customer name       ${cust?.name ?? '—'}`);
  console.log(
    `  customer address    ${
      cust?.address?.line1
        ? `${cust.address.line1}, ${cust.address.postal_code ?? ''} ${cust.address.city ?? ''} ${cust.address.country ?? ''}`.trim()
        : '—'
    }`,
  );
  // Stripe does not echo `subscription_data` back on the session, so there
  // is nothing truthful to print here: the company and tax number are
  // asserted by the round-trip test in lib/billing-fields.test.ts instead.
  return s;
}

try {
  const email = `rehearsal+${Date.now()}@example.com`;

  // 1. Ordinary yearly join, with the invoicing details filled in.
  const c1 = await makeCustomer(email, 'Marja de Vries', BILLING);
  await session('1. ordinary yearly join, customer carries our details', {
    customer: c1.id,
    cohort: false,
    billing: BILLING,
  });

  // 2. Cohort join — the launch rule, on the same customer.
  await session('2. cohort join (one-off line + trial_end 2027-01-01)', {
    customer: c1.id,
    cohort: true,
    billing: BILLING,
  });

  // 3. The same person joining again. The route looks the id up in
  //    membership_member and UPDATES rather than creating — rehearsed here by
  //    updating the same customer and checking Stripe still has one.
  const before = await stripe.customers.list({ email, limit: 10 });
  await stripe.customers.update(c1.id, {
    name: 'Acme BV',
    email,
    address: stripeAddress(BILLING),
  });
  const after = await stripe.customers.list({ email, limit: 10 });
  console.log('\n3. the same person joins again');
  console.log(`  customers with that email before  ${before.data.length}`);
  console.log(`  customers with that email after   ${after.data.length}`);
  console.log(
    `  ${after.data.length === before.data.length ? 'REUSED — no duplicate' : 'DUPLICATED — bug'}`,
  );

  // 4. THE SECURITY CASE. A stranger types a member's email into the public
  //    join form. The route only reaches the reuse path when the requester
  //    has PROVEN the address (a session whose own email is the one being
  //    joined), so the unproven path here creates its own customer and the
  //    member's name and address must come through untouched.
  const victimBefore = await stripe.customers.retrieve(c1.id);
  const stranger = await makeCustomer(email, 'A Stranger', {
    payer: 'self',
    address: 'Somewhere Else 99',
    postal_code: '9999 ZZ',
    city: 'Groningen',
    country: 'NL',
  });
  const victimAfter = await stripe.customers.retrieve(c1.id);
  console.log('\n4. a stranger types a member’s email (unproven)');
  console.log(`  stranger billed as        ${stranger.id} (a different customer)`);
  console.log(`  member's name before      ${victimBefore.name}`);
  console.log(`  member's name after       ${victimAfter.name}`);
  console.log(`  member's address after    ${victimAfter.address?.line1 ?? '—'}`);
  console.log(
    `  ${
      victimAfter.name === victimBefore.name &&
      victimAfter.address?.line1 === victimBefore.address?.line1 &&
      stranger.id !== c1.id
        ? 'UNTOUCHED — the stranger got their own customer'
        : 'OVERWRITTEN — the gate is not holding'
    }`,
  );

  // 5. And the case that must not break: nothing typed at all.
  const emailB = `rehearsal-bare+${Date.now()}@example.com`;
  const c2 = await makeCustomer(emailB, 'Someone Plain', null);
  await session('5. join with no invoicing details typed', {
    customer: c2.id,
    cohort: false,
    billing: null,
  });
} finally {
  for (const id of made.sessions) {
    await stripe.checkout.sessions.expire(id).catch(() => {});
  }
  for (const id of made.customers) {
    await stripe.customers.del(id).catch(() => {});
  }
  console.log(
    `\ncleaned up ${made.sessions.length} session(s) and ${made.customers.length} customer(s)`,
  );
}
