// A discount code on a SUBSCRIPTION: what does Stripe actually charge, now
// and at the renewal?
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/rehearse-discounted-join.mjs
//
// A membership renews, and Thread's codes never had to answer what that means
// — a thread is bought once. Decided 2026-10-13: a code discounts the FIRST
// PERIOD ONLY and the membership renews at full price. A code that silently
// halves somebody's membership for ever is the kind of thing a community
// discovers three years later.
//
// That makes the line shape the same one the launch cohort already uses: the
// discounted amount as a ONE-OFF line collected now, and the subscription line
// at FULL price starting at the period end (trial_end). This rehearses it on
// test keys before it reaches anybody, and prints what Stripe says it will
// collect — `amount_total` is Stripe's own answer, not ours.
//
// Four cases, each with a question that could go wrong:
//   1. yearly + 50%     — is a trial a year out inside Stripe's limit?
//   2. cohort + 50%     — does a code compose with the fixed renewal date?
//   3. monthly + 50%    — does the same shape work on a month?
//   4. free (100%)      — does Checkout still collect a card for the renewal?
//
// Nothing here completes a payment, and every object it makes is removed.
//
// The shapes below are the ones routes/membership.ts now builds — one-off
// line only when the amount is above zero, the recurring line at the LIST
// price, and trial_end from `startsBilling`. The source assertions in
// routes/fixed-renewal-wiring.test.ts hold the route to them; this says what
// Stripe does with them.
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

const CURRENCY = 'eur';
const YEAR = 30000;
const MONTH = 3600;
const money = (c) => (c == null ? null : `${(c / 100).toFixed(2)} ${CURRENCY.toUpperCase()}`);
const made = [];

/** The day after a period ends, in unix seconds — the same arithmetic
 *  lib/fixed-renewal.ts does for the cohort. */
const anchorFor = (iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000) + 86400;

/** One period from now, for an ordinary join with a code: the subscription
 *  starts billing when the discounted period runs out. */
function anniversary(interval) {
  const d = new Date();
  if (interval === 'year') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return Math.floor(d.getTime() / 1000);
}

async function session(label, { fullCents, paidNowCents, interval, anchor }) {
  const s = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      // What they pay NOW: one-off, so it is collected in this session's own
      // payment and never again.
      ...(paidNowCents > 0
        ? [
            {
              price_data: {
                currency: CURRENCY,
                product_data: { name: 'Rehearsal membership (first period)' },
                unit_amount: paidNowCents,
              },
              quantity: 1,
            },
          ]
        : []),
      // And the membership itself, at FULL price, from the anchor.
      {
        price_data: {
          currency: CURRENCY,
          product_data: { name: 'Rehearsal membership' },
          unit_amount: fullCents,
          recurring: { interval },
        },
        quantity: 1,
      },
    ],
    subscription_data: { trial_end: anchor },
    // A 100% code still needs a card on file, or the first renewal has
    // nothing to charge. 'always' is the whole point of case 4.
    payment_method_collection: 'always',
    success_url: 'https://example.com/ok',
    cancel_url: 'https://example.com/no',
  });
  made.push(s.id);
  console.log(`\n${label}`);
  console.log(`  collects now     ${money(s.amount_total)}`);
  console.log(`  renews at        ${money(fullCents)} every ${interval}`);
  console.log(`  first renewal    ${new Date(anchor * 1000).toISOString().slice(0, 10)}`);
  console.log(`  card collected   ${s.payment_method_collection}`);
  return s;
}

try {
  // 1. Ordinary yearly join with a 50% code.
  await session('1. yearly + 50% code', {
    fullCents: YEAR,
    paidNowCents: YEAR / 2,
    interval: 'year',
    anchor: anniversary('year'),
  });

  // 2. Cohort join with a code: the anchor is the cohort's fixed date, not an
  //    anniversary, so the two rules have to compose rather than fight.
  await session('2. cohort + 50% code (first period ends 2026-12-31)', {
    fullCents: YEAR,
    paidNowCents: YEAR / 2,
    interval: 'year',
    anchor: anchorFor('2026-12-31'),
  });

  // 3. Monthly.
  await session('3. monthly + 50% code', {
    fullCents: MONTH,
    paidNowCents: MONTH / 2,
    interval: 'month',
    anchor: anniversary('month'),
  });

  // 4. A free code. No one-off line at all — Stripe refuses a zero-amount
  //    price_data line — so the session collects nothing now and the card is
  //    taken for the renewal.
  await session('4. free (100%) code', {
    fullCents: YEAR,
    paidNowCents: 0,
    interval: 'year',
    anchor: anniversary('year'),
  });
} finally {
  for (const id of made) await stripe.checkout.sessions.expire(id).catch(() => {});
  console.log(`\ncleaned up ${made.length} session(s)`);
}
