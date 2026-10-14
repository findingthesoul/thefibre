// A community on staging to LOOK at, and then remove.
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/staging-join-fixture.mjs
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/staging-join-fixture.mjs --sweep
//
// WHY THIS EXISTS. Several things shipped this week are only visible on a
// screen: the extras box and its total, the discount line, the country
// picker, the terms box, and a tier reached by its invitation link. None of
// them can be checked by a test that reads JSON, and none of them existed on
// staging to look at — the shapes that show them (a cohort tier with optional
// extras, a hidden tier, a live code) were on production only.
//
// So this builds one, prints the URLs, and leaves it standing. `--sweep`
// removes everything it has ever made.
//
// IT IS SWEEPABLE BY DESIGN. Staging carries 124 abandoned fixture
// workspaces, each walked by the five-minute schedulers forever, because the
// scripts that made them could not take them away again. Every row here
// carries the `zz-walk-` slug prefix so one command finds all of it.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const PREFIX = 'zz-walk-';

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
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes('lukhyylwhhjyihqtghvw')) throw new Error('refusing: not the staging project');
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** Everything a fixture workspace can hold, in the order the keys allow.
 *  The `organisation` row is the one that bites: since 2026-09-15 every
 *  workspace gets one, behind a foreign key that does NOT cascade, so the
 *  workspace delete is refused until it goes. */
async function removeWorkspace(id, slug) {
  const members = await db.from('membership_member').select('id').eq('workspace_id', id);
  const memberIds = (members.data ?? []).map((m) => m.id);
  if (memberIds.length) await db.from('membership_reminder_send').delete().in('member_id', memberIds);
  const tiers = await db.from('membership_tier').select('id').eq('workspace_id', id);
  const tierIds = (tiers.data ?? []).map((t) => t.id);
  if (tierIds.length) await db.from('membership_tier_product').delete().in('tier_id', tierIds);
  for (const table of [
    'membership_product_purchase',
    'purchase',
    'activity',
    'membership_member',
    'membership_product',
    'discount_code',
    'membership_directory_entry',
    'membership_tier',
    'membership_settings',
    'workspace_app',
  ]) {
    const r = await db.from(table).delete().eq('workspace_id', id);
    if (r.error) console.warn(`  ${slug} ${table}: ${r.error.message}`);
  }
  // person ⇄ user reference each other, so one side is cut before both go.
  await db.from('user').update({ person_id: null }).eq('workspace_id', id);
  for (const table of ['person', 'user', 'organisation']) {
    const r = await db.from(table).delete().eq('workspace_id', id);
    if (r.error) console.warn(`  ${slug} ${table}: ${r.error.message}`);
  }
  const w = await db.from('workspace').delete().eq('id', id);
  if (w.error) {
    console.error(`  ${slug}: STILL THERE — ${w.error.message}`);
    return false;
  }
  console.log(`  ${slug}: removed`);
  return true;
}

if (process.argv.includes('--sweep')) {
  const { data, error } = await db.from('workspace').select('id, slug').like('slug', `${PREFIX}%`);
  if (error) throw new Error(error.message);
  console.log(`${data.length} walk fixture(s) to remove`);
  let ok = true;
  for (const w of data) ok = (await removeWorkspace(w.id, w.slug)) && ok;
  process.exit(ok ? 0 : 1);
}

// ── build it ────────────────────────────────────────────────────────────────
const stamp = Date.now();
const slug = `${PREFIX}${stamp}`;

const { data: def } = await db
  .from('workspace')
  .select('stripe_account_id')
  .eq('slug', 'default')
  .single();
if (!def?.stripe_account_id) throw new Error('the default workspace has no connected Stripe account');

async function ins(table, row, what) {
  const { data, error } = await db.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${what}: ${error.message}`);
  return data.id;
}

const ws = await ins(
  'workspace',
  { name: `ZZ walk ${stamp}`, slug, stripe_account_id: def.stripe_account_id },
  'workspace',
);
const { data: app } = await db.from('app').select('id').eq('slug', 'membership').single();
await db.from('workspace_app').insert({ workspace_id: ws, app_id: app.id });

// A cohort tier, because that is the one whose panel has the most to say: the
// whole first period now, a fixed renewal date, extras, and a total.
const cohort = await ins(
  'membership_tier',
  {
    workspace_id: ws,
    name: 'Community member',
    description: 'Membership of the community.',
    characteristics: ['Access to the member list', 'The community calendar'],
    price_cents_year: 30000,
    price_cents_month: 3000,
    currency: 'EUR',
    first_period_ends_on: '2026-12-31',
    sort_order: 1,
  },
  'cohort tier',
);
const plain = await ins(
  'membership_tier',
  {
    workspace_id: ws,
    name: 'Supporter',
    description: 'An ordinary yearly membership.',
    price_cents_year: 6000,
    currency: 'EUR',
    sort_order: 2,
  },
  'plain tier',
);
const hidden = await ins(
  'membership_tier',
  {
    workspace_id: ws,
    name: 'Founding rate (not listed)',
    description: 'By invitation only.',
    price_cents_year: 15000,
    currency: 'EUR',
    hidden: true,
    sort_order: 3,
  },
  'hidden tier',
);

// Two recurring extras and a one-time one — the shape that was collecting the
// wrong amount until this morning, and the one with a total worth reading.
for (const [name, cents, interval] of [
  ['email@example.com / Google Workspace', 19320, 'year'],
  ['Fellowship', 200000, 'year'],
  ['Accreditation program', 100000, 'once'],
]) {
  const id = await ins(
    'membership_product',
    { workspace_id: ws, name, price_cents: cents, currency: 'EUR', price_interval: interval },
    `product ${name}`,
  );
  await db.from('membership_tier_product').insert({ tier_id: cohort, product_id: id, optional: true });
}

for (const [code, pct, extra] of [
  ['WALKHALF', 50, {}],
  ['WALKFULL', 100, {}],
  ['WALKDEAD', 50, { expires_at: '2020-01-01T00:00:00Z' }],
]) {
  await ins(
    'discount_code',
    {
      workspace_id: ws,
      code,
      type: 'percentage',
      discount_percentage: pct,
      applies_to: 'workspace',
      ...extra,
    },
    `code ${code}`,
  );
}

// The staging host of the members app. `membership`, not `members`: the
// catalogue SLUG is `membership` and the staging label follows it, while the
// app's display name is "Members" — which is what made me type the wrong one
// first. smoke-staging.mjs has the same mapping.
const base = 'https://membership.thefibre.tech';
console.log(`built ${slug}\n`);
console.log(`  the join page             ${base}/${slug}`);
console.log(`  the invitation-only tier  ${base}/${slug}?tier=${hidden}`);
console.log(`  a listed tier preselected ${base}/${slug}?tier=${plain}`);
console.log('\n  codes: WALKHALF (50%), WALKFULL (100%), WALKDEAD (expired)');
console.log('  "Community member" carries the three extras and the cohort date.');
console.log(`\n  remove it:  node apps/api/scripts/staging-join-fixture.mjs --sweep`);
