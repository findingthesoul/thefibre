// WHAT A STRANGER CAN REACH on the public join path.
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/probe-join-tenancy.mjs
//
// Every route here is PUBLIC and unauthenticated by design — a join page has
// to work for somebody who has never signed in — so the tenant boundary is
// whatever filter the route itself applies. There is no RLS behind these:
// they run on the service role (handbook §2), which is exactly the shape of
// the two cross-workspace holes found in September.
//
// This asks, as a stranger: can I use one community's identifiers against
// another community's page?
//
//   a discount code belonging to community B, typed on A's page
//   a TIER belonging to B, joined through A's page
//   a hidden tier of B, reached by its link on A's page
//   an optional PRODUCT of B, ticked on A's join
//   a product of A that this tier does not offer
//   a product of A that is INCLUDED rather than optional
//
// Each one would be a different kind of wrong: a discount nobody granted, a
// membership sold at another community's price, a paid add-on attached to
// somebody else's money.
//
// Read-only in effect: it creates two throwaway communities, posts to the
// real deployed routes, and removes everything. No Checkout session that it
// opens is ever paid, and any it does open are expired.
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
const findings = [];
const made = [];
let account = null;
const sessions = [];

async function ins(table, row, what) {
  const { data, error } = await db.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${what}: ${error.message}`);
  return data.id;
}

async function community(label, opts = {}) {
  const slug = `zz-sec-${label}-${stamp}`;
  const ws = await ins(
    'workspace',
    { name: `ZZ sec ${label}`, slug, stripe_account_id: account },
    `workspace ${label}`,
  );
  made.push({ ws, slug });
  const { data: app } = await db.from('app').select('id').eq('slug', 'membership').single();
  await db.from('workspace_app').insert({ workspace_id: ws, app_id: app.id });

  const tier = await ins(
    'membership_tier',
    {
      workspace_id: ws,
      name: `ZZ tier ${label}`,
      price_cents_year: opts.price ?? 10000,
      currency: 'EUR',
      ...(opts.hidden ? { hidden: true } : {}),
    },
    `tier ${label}`,
  );
  const optional = await ins(
    'membership_product',
    { workspace_id: ws, name: `ZZ optional ${label}`, price_cents: 5000, currency: 'EUR', price_interval: 'once' },
    `optional ${label}`,
  );
  const included = await ins(
    'membership_product',
    { workspace_id: ws, name: `ZZ included ${label}`, price_cents: 7000, currency: 'EUR', price_interval: 'once' },
    `included ${label}`,
  );
  const unlinked = await ins(
    'membership_product',
    { workspace_id: ws, name: `ZZ unlinked ${label}`, price_cents: 9000, currency: 'EUR', price_interval: 'once' },
    `unlinked ${label}`,
  );
  await db.from('membership_tier_product').insert([
    { tier_id: tier, product_id: optional, optional: true },
    { tier_id: tier, product_id: included, optional: false },
  ]);
  const code = `ZZSEC${label.toUpperCase()}`;
  await ins(
    'discount_code',
    { workspace_id: ws, code, type: 'percentage', discount_percentage: 90, applies_to: 'workspace' },
    `code ${label}`,
  );
  const hidden = opts.alsoHidden
    ? await ins(
        'membership_tier',
        { workspace_id: ws, name: `ZZ hidden ${label}`, price_cents_year: 100, currency: 'EUR', hidden: true },
        `hidden ${label}`,
      )
    : null;
  return { ws, slug, tier, optional, included, unlinked, code, hidden };
}

const post = async (path, body) => {
  const res = await fetch(`${API}/api/v1/membership${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-ID': 'membership' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const joinBody = (extra) => ({
  email: `int-sec-${stamp}-${Math.random().toString(36).slice(2, 8)}@example.com`,
  name: 'Security Probe',
  terms_accepted: true,
  request_id: `sec-${stamp}-${Math.random().toString(36).slice(2, 10)}`,
  ...extra,
});

/** What a join actually cost, so "refused" and "quietly ignored" can be told
 *  apart — a route that accepts a foreign product id and silently drops it is
 *  safe; one that accepts and CHARGES for it is not. */
async function amountOf(checkoutUrl) {
  const m = /\/(cs_(?:test|live)_[A-Za-z0-9]+)/.exec(checkoutUrl ?? '');
  if (!m) return null;
  sessions.push(m[1]);
  const s = await stripe.checkout.sessions.retrieve(m[1], {}, { stripeAccount: account });
  return s.amount_total ?? 0;
}

function report(name, safe, detail) {
  findings.push({ name, safe, detail });
}

try {
  const { data: def } = await db
    .from('workspace')
    .select('stripe_account_id')
    .eq('slug', 'default')
    .single();
  account = def?.stripe_account_id;
  if (!account) throw new Error('the default workspace has no connected Stripe account');

  const A = await community('a');
  const B = await community('b', { price: 99900, alsoHidden: true });
  console.log(`community A ${A.slug}\ncommunity B ${B.slug}\n`);

  // 1 ── B's discount code, typed on A's page.
  {
    const r = await post('/public/validate-code', {
      workspace_slug: A.slug,
      tier_id: A.tier,
      interval: 'year',
      code: B.code,
    });
    const granted = r.status === 200 && r.body?.valid === true;
    report(
      "B's code validated on A's page",
      !granted,
      granted ? `GRANTED — price ${money(r.body?.price_cents)}` : `refused (${r.status}, valid=${r.body?.valid})`,
    );
  }

  // 2 ── B's code carried straight to A's join, skipping the panel.
  {
    const r = await post('/public/join', joinBody({ workspace_slug: A.slug, tier_id: A.tier, code: B.code }));
    const amount = r.status === 200 ? await amountOf(r.body?.url) : null;
    const discounted = amount != null && amount < 10000;
    report(
      "B's code used on A's join",
      !discounted,
      amount == null ? `refused (${r.status})` : `collected ${money(amount)} of 100.00`,
    );
  }

  // 3 ── B's TIER joined through A's page: a membership at another
  //      community's price, sold by the wrong community.
  {
    const r = await post('/public/join', joinBody({ workspace_slug: A.slug, tier_id: B.tier }));
    const amount = r.status === 200 ? await amountOf(r.body?.url) : null;
    report(
      "B's tier joined through A's page",
      amount == null,
      amount == null ? `refused (${r.status})` : `SOLD — collected ${money(amount)}`,
    );
  }

  // 4 ── B's HIDDEN tier, reached by its link on A's page. The link is the
  //      only authority a hidden tier has, so it must not be portable.
  {
    const res = await fetch(
      `${API}/api/v1/membership/public/catalog/${A.slug}?tier=${B.hidden}`,
      { headers: { 'X-App-ID': 'membership' } },
    );
    const body = await res.json().catch(() => null);
    const leaked = (body?.tiers ?? []).length > 0;
    report(
      "B's hidden tier fetched through A's catalogue",
      !leaked,
      leaked ? `LEAKED — ${body.tiers[0]?.name}` : 'not served',
    );
  }

  // 5 ── B's optional product, ticked on A's join.
  {
    const r = await post(
      '/public/join',
      joinBody({ workspace_slug: A.slug, tier_id: A.tier, option_product_ids: [B.optional] }),
    );
    const amount = r.status === 200 ? await amountOf(r.body?.url) : null;
    const charged = amount != null && amount > 10000;
    report(
      "B's product ticked on A's join",
      !charged,
      amount == null ? `refused (${r.status})` : `collected ${money(amount)} (tier alone is 100.00)`,
    );
  }

  // 6 ── A's own product that this tier does not offer at all.
  {
    const r = await post(
      '/public/join',
      joinBody({ workspace_slug: A.slug, tier_id: A.tier, option_product_ids: [A.unlinked] }),
    );
    const amount = r.status === 200 ? await amountOf(r.body?.url) : null;
    const charged = amount != null && amount > 10000;
    report(
      'a product the tier does not offer',
      !charged,
      amount == null ? `refused (${r.status})` : `collected ${money(amount)} (tier alone is 100.00)`,
    );
  }

  // 7 ── A's INCLUDED product, ticked as though it were optional. Charging
  //      for something the tier already includes is being billed twice for
  //      one thing.
  {
    const r = await post(
      '/public/join',
      joinBody({ workspace_slug: A.slug, tier_id: A.tier, option_product_ids: [A.included] }),
    );
    const amount = r.status === 200 ? await amountOf(r.body?.url) : null;
    const charged = amount != null && amount > 10000;
    report(
      'an INCLUDED product ticked as an extra',
      !charged,
      amount == null ? `refused (${r.status})` : `collected ${money(amount)} (tier alone is 100.00)`,
    );
  }

  // 8 ── The control. A's own optional product must still work, or every
  //      case above passes because the feature is broken.
  {
    const r = await post(
      '/public/join',
      joinBody({ workspace_slug: A.slug, tier_id: A.tier, option_product_ids: [A.optional] }),
    );
    const amount = r.status === 200 ? await amountOf(r.body?.url) : null;
    report(
      "A's own optional product (the control)",
      amount === 15000,
      amount == null ? `REFUSED (${r.status}) — the feature is broken` : `collected ${money(amount)}, want 150.00`,
    );
  }

  console.log('what a stranger can reach');
  console.log('─'.repeat(74));
  for (const f of findings) {
    console.log(`${f.safe ? 'safe' : 'HOLE'}  ${f.name.padEnd(42)} ${f.detail}`);
  }
  console.log('─'.repeat(74));
  const holes = findings.filter((f) => !f.safe);
  console.log(holes.length ? `${holes.length} HOLE(S)` : 'no holes: every boundary held.');
  if (holes.length) process.exitCode = 1;
} finally {
  console.log('\ncleaning up…');
  for (const id of sessions) {
    await stripe.checkout.sessions.expire(id, {}, { stripeAccount: account }).catch(() => {});
  }
  for (const { ws, slug } of made) {
    const members = await db.from('membership_member').select('id').eq('workspace_id', ws);
    const ids = (members.data ?? []).map((m) => m.id);
    if (ids.length) await db.from('membership_reminder_send').delete().in('member_id', ids);
    const tiers = await db.from('membership_tier').select('id').eq('workspace_id', ws);
    const tierIds = (tiers.data ?? []).map((t) => t.id);
    if (tierIds.length) await db.from('membership_tier_product').delete().in('tier_id', tierIds);
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
      const r = await db.from(table).delete().eq('workspace_id', ws);
      if (r.error) console.warn(`  ${slug} ${table}: ${r.error.message}`);
    }
    await db.from('user').update({ person_id: null }).eq('workspace_id', ws);
    for (const table of ['person', 'user', 'organisation']) {
      const r = await db.from(table).delete().eq('workspace_id', ws);
      if (r.error) console.warn(`  ${slug} ${table}: ${r.error.message}`);
    }
    const w = await db.from('workspace').delete().eq('id', ws);
    if (w.error) {
      console.error(`  ${slug}: STILL THERE — ${w.error.message}`);
      process.exitCode = 1;
    } else {
      console.log(`  ${slug}: removed`);
    }
  }
}
