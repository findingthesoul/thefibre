// EVERY SHAPE OF JOIN, through the deployed route, against what the panel says.
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/stress-join-shapes.mjs
//
// WHAT THIS IS FOR. Before the first invitations go out, the question is not
// "does the code look right" but "for each way somebody can join, does Stripe
// collect the number the page promised". Those are different questions: every
// bug found in the money path this week lived in the gap between them.
//
// So this drives the REAL `/public/join` on the deployed staging API — the
// same endpoint a visitor's browser posts to — takes the Checkout session it
// returns, asks STRIPE what that session will collect, and compares it to the
// figure stated here. Nothing is modelled: if the route builds the lines
// differently from what the panel shows, the numbers disagree and this says
// so.
//
// It completes no payment. `amount_total` is Stripe's own answer to "what
// would be taken now", and every session is expired afterwards.
//
// THE SHAPES, from the launch path as an invitee meets it:
//   1  an ordinary yearly join
//   2  an ordinary monthly join
//   3  a cohort join (whole first period now, fixed renewal)
//   4  a cohort join with two recurring extras and a one-time extra
//   5  the same with a 50% code
//   6  the same with a 100% code
//   7  a code that expired between the panel and the join
//   8  a code whose last use was taken between the panel and the join
//   9  a HIDDEN tier, reached by its direct link
//  10  a join with no terms accepted (must be refused)
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const API = 'https://thefibre-api-staging.fly.dev';

const envFile = process.env.FIBRE_ENV_FILE;
if (!envFile) {
  console.error('set FIBRE_ENV_FILE to the staging env file');
  process.exit(2);
}
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const key = env.STRIPE_SECRET_KEY ?? '';
if (!key.startsWith('sk_test')) throw new Error('refusing: not a test key');
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes('lukhyylwhhjyihqtghvw')) throw new Error('refusing: not the staging project');

const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const money = (c) => (c == null ? null : (c / 100).toFixed(2));
const END = '2026-12-31'; // the cohort's first period ends here

const TIER_YEAR = 30000;
const TIER_MONTH = 3000;
const HIDDEN_YEAR = 15000;
const GW = 19320; // a yearly extra
const FELLOW = 200000; // a yearly extra
const ACCRED = 100000; // a one-time extra

const made = { ws: null, slug: null, tiers: {}, products: {}, codes: {}, sessions: [], persons: [] };
const results = [];

async function ins(table, row, what) {
  const { data, error } = await db.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${what}: ${error.message}`);
  return data.id;
}

/** POST the real join route, exactly as a browser would. */
async function join(body) {
  const res = await fetch(`${API}/api/v1/membership/public/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-ID': 'membership' },
    body: JSON.stringify({
      workspace_slug: made.slug,
      email: `int-stress-${stamp}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      name: 'Stress Test',
      terms_accepted: true,
      request_id: `stress-${stamp}-${Math.random().toString(36).slice(2, 10)}`,
      ...body,
    }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** What Stripe says a session will collect, and what recurs after it. */
async function sessionTotals(checkoutUrl) {
  // The session id is in the pay URL: /c/pay/cs_test_… .
  const m = /\/(cs_(?:test|live)_[A-Za-z0-9]+)/.exec(checkoutUrl ?? '');
  if (!m) throw new Error(`no session id in ${checkoutUrl}`);
  const id = m[1];
  made.sessions.push(id);
  const s = await stripe.checkout.sessions.retrieve(
    id,
    { expand: ['line_items', 'line_items.data.price'] },
    { stripeAccount: made.account },
  );
  // WHAT RECURS. Taken from the price's unit_amount and not from the line's
  // amount_total: on a session with a trial those are different things, and
  // which one Checkout reports is Stripe's business rather than a fact about
  // this product. The unit amount is what will be charged per period.
  const items = (s.line_items?.data ?? []).map((li) => ({
    amount: li.amount_total ?? 0,
    unit: li.price?.unit_amount ?? 0,
    recurring: Boolean(li.price?.recurring),
    name: li.description ?? '',
  }));
  const recurring = items.filter((i) => i.recurring).reduce((n, i) => n + i.unit, 0);
  return { now: s.amount_total ?? 0, recurring, lines: items.length, items };
}

/** One case: drive the route, ask Stripe, compare. */
async function check(name, body, expectNow, expectRecurring) {
  const r = await join(body);
  if (r.status !== 200 || !r.body?.url) {
    results.push({ name, ok: false, note: `join refused: ${r.status} ${JSON.stringify(r.body)}` });
    return;
  }
  const t = await sessionTotals(r.body.url);
  const ok = t.now === expectNow && (expectRecurring == null || t.recurring === expectRecurring);
  results.push({
    name,
    ok,
    note:
      `now ${money(t.now)} (want ${money(expectNow)})` +
      (expectRecurring == null ? '' : `, renews ${money(t.recurring)} (want ${money(expectRecurring)})`) +
      `, ${t.lines} line(s)`,
    // EVERY LINE, on a mismatch. A pass/fail with two numbers says a shape is
    // wrong; the lines say WHY, and one run should be enough to find out
    // rather than a second run with more printing added.
    items: ok ? null : t.items,
  });
}

/** A case that must be REFUSED. An endpoint that accepts everything passes
 *  every positive case. */
async function checkRefused(name, body, why) {
  const r = await join(body);
  const ok = r.status >= 400;
  results.push({
    name,
    ok,
    note: ok ? `refused ${r.status} — ${why}` : `ACCEPTED, and should not have been (${why})`,
  });
}

try {
  // ── the fixture community ────────────────────────────────────────────────
  //
  // Its own workspace, so nothing here touches a real one, but on the staging
  // CONNECTED ACCOUNT, because that is where a Checkout session for this
  // stack has to be created.
  const { data: def } = await db
    .from('workspace')
    .select('stripe_account_id')
    .eq('slug', 'default')
    .single();
  made.account = def?.stripe_account_id;
  if (!made.account) throw new Error('the default workspace has no connected Stripe account');

  made.slug = `zz-stress-${stamp}`;
  made.ws = await ins('workspace', { name: `ZZ stress ${stamp}`, slug: made.slug, stripe_account_id: made.account }, 'workspace');

  const { data: app } = await db.from('app').select('id').eq('slug', 'membership').single();
  await db.from('workspace_app').insert({ workspace_id: made.ws, app_id: app.id });

  const tier = (name, extra) =>
    ins('membership_tier', { workspace_id: made.ws, name, currency: 'EUR', ...extra }, `tier ${name}`);

  made.tiers.year = await tier('ZZ yearly', { price_cents_year: TIER_YEAR });
  made.tiers.month = await tier('ZZ monthly', { price_cents_month: TIER_MONTH });
  made.tiers.cohort = await tier('ZZ cohort', { price_cents_year: TIER_YEAR, first_period_ends_on: END });
  made.tiers.extras = await tier('ZZ cohort with extras', {
    price_cents_year: TIER_YEAR,
    first_period_ends_on: END,
  });
  made.tiers.hidden = await tier('ZZ hidden', { price_cents_year: HIDDEN_YEAR, hidden: true });

  const product = (name, cents, interval) =>
    ins(
      'membership_product',
      { workspace_id: made.ws, name, price_cents: cents, currency: 'EUR', price_interval: interval },
      `product ${name}`,
    );
  made.products.gw = await product('ZZ Google Workspace', GW, 'year');
  made.products.fellow = await product('ZZ Fellowship', FELLOW, 'year');
  made.products.accred = await product('ZZ Accreditation', ACCRED, 'once');
  for (const id of Object.values(made.products)) {
    await db
      .from('membership_tier_product')
      .insert({ tier_id: made.tiers.extras, product_id: id, optional: true });
  }

  // The real columns, read from the migration rather than guessed: `type`
  // is ('percentage','amount','free'), the percentage lives in
  // `discount_percentage`, and the ceiling is `usage_limit` against
  // `used_count`.
  const code = (c, extra) =>
    ins(
      'discount_code',
      {
        workspace_id: made.ws,
        code: c,
        type: 'percentage',
        discount_percentage: 50,
        applies_to: 'workspace',
        ...extra,
      },
      `code ${c}`,
    );
  made.codes.half = await code('ZZHALF');
  made.codes.full = await code('ZZFULL', { discount_percentage: 100 });
  made.codes.expired = await code('ZZEXPIRED', { expires_at: '2020-01-01T00:00:00Z' });
  made.codes.used = await code('ZZUSED', { usage_limit: 1, used_count: 1 });

  console.log(`fixture community ${made.slug} on ${made.account}\n`);

  const allExtras = [made.products.gw, made.products.fellow, made.products.accred];
  const extrasNow = GW + FELLOW + ACCRED;
  const extrasRecurring = GW + FELLOW;

  // ── the shapes ───────────────────────────────────────────────────────────
  // An ordinary join bills the subscription itself: Stripe collects the first
  // period as part of it, so `now` is the tier price and the recurring line
  // is the same amount.
  await check('1  yearly', { tier_id: made.tiers.year }, TIER_YEAR, TIER_YEAR);
  await check('2  monthly', { tier_id: made.tiers.month, interval: 'month' }, TIER_MONTH, TIER_MONTH);

  // A cohort join is SPLIT: the first period as a one-off now, the
  // subscription at full price from the anchor.
  await check('3  cohort', { tier_id: made.tiers.cohort }, TIER_YEAR, TIER_YEAR);

  await check(
    '4  cohort + 2 yearly extras + 1 one-time',
    { tier_id: made.tiers.extras, option_product_ids: allExtras },
    TIER_YEAR + extrasNow,
    TIER_YEAR + extrasRecurring,
  );

  // A code discounts the TIER and only the first period. The extras are not
  // discounted, and the renewal is at full price.
  await check(
    '5  the same + a 50% code',
    { tier_id: made.tiers.extras, option_product_ids: allExtras, code: 'ZZHALF' },
    TIER_YEAR / 2 + extrasNow,
    TIER_YEAR + extrasRecurring,
  );

  // 100% off the tier: the extras are still collected, so this is not a zero
  // session — and the renewal is full price, which is the case that needs a
  // payment method on file.
  await check(
    '6  the same + a 100% code',
    { tier_id: made.tiers.extras, option_product_ids: allExtras, code: 'ZZFULL' },
    extrasNow,
    TIER_YEAR + extrasRecurring,
  );

  // A code that is no longer valid must be REFUSED, loudly — not silently
  // honoured and not silently ignored. Somebody who typed a code and saw a
  // price must not be charged a different one without being told.
  await checkRefused(
    '7  an expired code',
    { tier_id: made.tiers.year, code: 'ZZEXPIRED' },
    'expired between the panel and the join',
  );
  await checkRefused(
    '8  a used-up code',
    { tier_id: made.tiers.year, code: 'ZZUSED' },
    'its last use was taken in between',
  );

  // The hidden tier joins normally when its id is known — that is what the
  // invitation link carries.
  await check('9  a hidden tier by its link', { tier_id: made.tiers.hidden }, HIDDEN_YEAR, HIDDEN_YEAR);

  await checkRefused(
    '10 no terms accepted',
    { tier_id: made.tiers.year, terms_accepted: false },
    'nobody is asked for money before they have agreed',
  );

  // ── the answer ───────────────────────────────────────────────────────────
  console.log('shape                                      result');
  console.log('─'.repeat(78));
  for (const r of results) {
    console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name.padEnd(38)} ${r.note}`);
    for (const i of r.items ?? []) {
      console.log(
        `          ${money(i.amount).padStart(9)} charged  ${money(i.unit).padStart(9)} per period  ` +
          `${i.recurring ? 'recurring' : 'one-off  '}  ${i.name}`,
      );
    }
  }
  const bad = results.filter((r) => !r.ok);
  console.log('─'.repeat(78));
  console.log(`${results.length - bad.length} of ${results.length} shapes behave as the panel promises.`);
  if (bad.length) process.exitCode = 1;
} finally {
  console.log('\ncleaning up…');
  for (const id of made.sessions) {
    await stripe.checkout.sessions.expire(id, {}, { stripeAccount: made.account }).catch(() => {});
  }
  if (made.ws) {
    // CLEANUP THAT SAYS WHEN IT DID NOT CLEAN, and in the order the foreign
    // keys allow. The first run of this script left a workspace standing,
    // which is how staging came to carry 124 of them: the delete failed,
    // printed, and the script exited 0 regardless.
    //
    // Not every table here is workspace-scoped. `membership_reminder_send` is
    // keyed on the MEMBER and `membership_tier_product` on the TIER, so
    // filtering them by workspace_id is a 42703 and a silent no-op — they are
    // cleared through their own keys first.
    const members = await db.from('membership_member').select('id').eq('workspace_id', made.ws);
    const memberIds = (members.data ?? []).map((m) => m.id);
    if (memberIds.length) {
      await db.from('membership_reminder_send').delete().in('member_id', memberIds);
    }
    const tierIds = Object.values(made.tiers).filter(Boolean);
    if (tierIds.length) {
      await db.from('membership_tier_product').delete().in('tier_id', tierIds);
    }

    for (const table of [
      'membership_product_purchase',
      'purchase',
      'activity',
      'membership_member',
      'membership_product',
      'discount_code',
      'membership_tier',
      'membership_settings',
      'workspace_app',
    ]) {
      const r = await db.from(table).delete().eq('workspace_id', made.ws);
      if (r.error) console.warn(`  ${table} not cleaned: ${r.error.message}`);
    }

    // person ⇄ user point at each other, so one side is cut before both go.
    await db.from('user').update({ person_id: null }).eq('workspace_id', made.ws);
    for (const table of ['person', 'user']) {
      const r = await db.from(table).delete().eq('workspace_id', made.ws);
      if (r.error) console.warn(`  ${table} not cleaned: ${r.error.message}`);
    }

    // THE ORGANISATION, and this is the one that bites. Since 2026-09-15
    // every workspace gets its own organisation row, behind a foreign key
    // that does NOT cascade — so the workspace delete is refused until it
    // goes. That is precisely why the first run of this script leaked.
    const org = await db.from('organisation').delete().eq('workspace_id', made.ws);
    if (org.error) console.warn(`  organisation not cleaned: ${org.error.message}`);

    const w = await db.from('workspace').delete().eq('id', made.ws);
    if (w.error) {
      console.warn(`  WORKSPACE NOT REMOVED: ${w.error.message}`);
      // A leaked workspace is a real cost — the five-minute schedulers walk
      // every one of them — so this is a failure of the run, not a note.
      process.exitCode = 1;
    } else {
      console.log(`  workspace ${made.slug} removed`);
    }
  }
  console.log('cleaned up');
}
