#!/usr/bin/env node
// What Stripe is actually configured to send us, checked against what the
// code is written to receive.
//
// Born 2026-09-09, from soul.com's first live invoiced member: the payment
// went through and the membership never moved, because a membership charge
// runs on a CONNECTED account and only a Connect endpoint receives those
// events. routes/membership.ts drops anything without `.account`, silently
// and correctly — so a webhook registered in the ordinary "your account"
// mode looks perfectly healthy in the Stripe dashboard and delivers nothing
// this app can use. That is invisible from our side and invisible from
// theirs. This script is the place it becomes visible.
//
// It also answers the other question that costs an afternoon: which payment
// methods a connected account will actually offer at checkout. Nothing in
// this codebase pins `payment_method_types`, so the answer is entirely the
// CONNECTED account's payment method configuration — never the platform's.
//
// READ ONLY. It creates nothing, changes nothing, and needs only a Stripe
// key that can read webhook endpoints. A restricted key is plenty.
//
// Usage:
//   node scripts/verify-stripe-webhooks.mjs
//   node scripts/verify-stripe-webhooks.mjs --account acct_123        # + payment methods
//   node scripts/verify-stripe-webhooks.mjs --account acct_123 --session cs_live_123
//
// The key comes from apps/api/.env (STRIPE_SECRET_KEY) or the environment.
// Point it at the test-mode key to audit the staging endpoints.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function dotenv() {
  try {
    return Object.fromEntries(
      readFileSync(resolve(__dirname, '..', process.env.FIBRE_ENV_FILE ?? '.env'), 'utf-8')
        .split('\n')
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => l.split('=', 2))
        .filter((p) => p.length === 2),
    );
  } catch {
    return {};
  }
}

const KEY = process.env.STRIPE_SECRET_KEY ?? dotenv().STRIPE_SECRET_KEY;
if (!KEY) {
  console.error(
    'No STRIPE_SECRET_KEY. Put one in apps/api/.env or pass it in the environment.\n' +
      'A restricted key with read access to Webhook endpoints is enough.',
  );
  process.exit(2);
}

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1] ?? null;
};
const ACCOUNT = arg('account');
const SESSION = arg('session');

async function stripe(path, account) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(account ? { 'Stripe-Account': account } : {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? `Stripe ${res.status} on ${path}`);
  return body;
}

// Every webhook this API answers, and what it needs to be sent. `connect`
// is the one that bites: an endpoint in the wrong mode receives events that
// the route then ignores, so nothing errors anywhere.
const EXPECTED = [
  {
    path: '/api/v1/membership/stripe-webhook',
    connect: true,
    why: 'membership charges run on the workspace’s connected account',
    events: [
      'checkout.session.completed',
      'invoice.paid',
      'invoice.payment_failed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ],
  },
  {
    path: '/api/v1/thread/stripe-webhook',
    connect: true,
    why: 'thread enrolments are paid to the organiser’s connected account',
    events: ['checkout.session.completed', 'checkout.session.expired'],
  },
  {
    path: '/api/v1/meet/stripe-webhook',
    connect: true,
    why: 'meet bookings are paid to the host’s connected account',
    events: [
      'checkout.session.completed',
      'checkout.session.expired',
      'payment_intent.payment_failed',
    ],
  },
  {
    path: '/api/v1/billing/stripe-webhook',
    connect: false,
    why: 'Fibre’s own subscriptions are charged on the platform account',
    events: [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid',
      'invoice.payment_failed',
    ],
  },
];

let failures = 0;
const ok = (m, d) => console.log(`   ✓ ${m}${d ? ` — ${d}` : ''}`);
const bad = (m, d) => {
  failures += 1;
  console.log(`   ✗ ${m}${d ? ` — ${d}` : ''}`);
};

const { data: endpoints } = await stripe('webhook_endpoints?limit=100');
const mode = KEY.includes('_test_') ? 'TEST' : 'LIVE';
console.log(`\nStripe ${mode} mode — ${endpoints.length} webhook endpoint(s) registered\n`);

console.log('1. Every webhook the API answers is registered, in the right mode');
for (const want of EXPECTED) {
  const matches = endpoints.filter((e) => (e.url ?? '').endsWith(want.path));
  if (matches.length === 0) {
    bad(want.path, `no endpoint registered (${want.why})`);
    continue;
  }
  for (const e of matches) {
    const host = new URL(e.url).host;
    if (e.status !== 'enabled') {
      bad(`${want.path} @ ${host}`, `endpoint is ${e.status}`);
      continue;
    }
    // Stripe returns `connect: true` for endpoints that listen on connected
    // accounts. It cannot be changed after creation — a wrong one is
    // deleted and made again.
    const isConnect = e.connect === true;
    if (isConnect !== want.connect) {
      bad(
        `${want.path} @ ${host}`,
        `listening on ${isConnect ? 'connected accounts' : 'your own account'}, needs ${
          want.connect ? 'connected accounts' : 'your own account'
        } — ${want.why}. Delete it and create it again; the mode is fixed at creation.`,
      );
    } else {
      ok(`${want.path} @ ${host}`, isConnect ? 'connected accounts' : 'platform account');
    }
    const all = e.enabled_events.includes('*');
    const missing = all ? [] : want.events.filter((ev) => !e.enabled_events.includes(ev));
    if (missing.length) bad(`${want.path} events`, `missing ${missing.join(', ')}`);
    else ok(`${want.path} events`, all ? 'all events' : `${want.events.length} needed, all present`);
  }
}

console.log('\n2. Nothing else is pointed at this API');
const known = EXPECTED.map((e) => e.path);
const strays = endpoints.filter(
  (e) => /thefibre-api|thefibre\.app|thethread\.app/.test(e.url ?? '') && !known.some((p) => e.url.endsWith(p)),
);
if (strays.length === 0) ok('no unrecognised endpoints on our hosts');
else for (const e of strays) bad('unrecognised endpoint', `${e.url} (${e.status})`);

if (ACCOUNT) {
  console.log(`\n3. What ${ACCOUNT} will offer at checkout`);
  console.log('   Nothing in this API pins payment_method_types, so this list is the');
  console.log('   whole answer. Edits on the PLATFORM account do not appear here.');
  try {
    const { data: configs } = await stripe('payment_method_configurations?limit=10', ACCOUNT);
    if (configs.length === 0) bad('payment method configuration', 'none on this account');
    for (const cfg of configs) {
      const on = Object.entries(cfg)
        .filter(([, v]) => v && typeof v === 'object' && v.display_preference)
        .filter(([, v]) => (v.display_preference.value ?? v.display_preference.preference) !== 'off')
        .map(([k]) => k)
        .sort();
      console.log(
        `   · ${cfg.name ?? cfg.id}${cfg.is_default ? ' (default)' : ''}: ${
          on.length ? on.join(', ') : 'nothing enabled'
        }`,
      );
      // iDEAL is single-use. Stripe only offers it on a subscription when it
      // can turn the mandate into SEPA Direct Debit, so the pair matters.
      if (on.includes('ideal') && !on.includes('sepa_debit')) {
        bad(
          'iDEAL on subscriptions',
          'iDEAL is on but SEPA Direct Debit is off — iDEAL will show for one-off invoices and NOT for memberships, which are subscriptions',
        );
      }
    }
  } catch (e) {
    bad('payment method configuration', e.message);
  }
}

if (SESSION) {
  console.log(`\n4. Checkout session ${SESSION}`);
  if (!ACCOUNT) bad('session lookup', 'pass --account too; the session lives on a connected account');
  else {
    try {
      const s = await stripe(`checkout/sessions/${SESSION}`, ACCOUNT);
      console.log(`   · status ${s.status}, payment ${s.payment_status}, ${s.amount_total} ${s.currency}`);
      if (s.payment_status === 'paid') ok('the money moved');
      else bad('the money did not move', `payment_status ${s.payment_status}`);
    } catch (e) {
      bad('session lookup', e.message);
    }
  }
}

console.log(
  failures === 0
    ? '\nAll good — Stripe is configured the way the code expects.\n'
    : `\n${failures} problem(s) above.\n`,
);
process.exit(failures === 0 ? 0 : 1);
