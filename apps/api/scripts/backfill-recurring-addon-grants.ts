// Put the RECURRING add-on grants written before v1.241.3 onto their
// membership's subscription, so they end with it (the bug: they were status
// 'paid' — owned forever — and outlived a lapsed membership).
//
// A bulk data conversion, so a SCRIPT per database, never a migration — and
// the restore is written BEFORE anything changes (CLAUDE.md / memory:
// "prove restore first").
//
//   cd apps/api
//   npx tsx --env-file=.env.staging scripts/backfill-recurring-addon-grants.ts staging            # dry run: lists, changes nothing
//   npx tsx --env-file=.env.staging scripts/backfill-recurring-addon-grants.ts staging --apply    # writes restore file, then converts
//   npx tsx --env-file=.env.staging scripts/backfill-recurring-addon-grants.ts staging --restore <file>
//   (prod: --env-file=.env … prod — Sjoerd's terminal)
//
// Which rows: status 'paid', no stripe_subscription_id, the product renews
// (price_interval ≠ 'once'), and NOT bought through /public/buy (those have
// a ledger row 'product-<session>' — audit list (a); they had no membership
// subscription to ride, so they are left for Sjoerd to decide).
//
// What each becomes, by the person's membership in that workspace:
//   active          → status 'active',    the member's subscription id
//   grace/past_due  → status 'past_due',  the member's subscription id
//   lapsed/cancelled/deleted → status 'cancelled', ends_at = lapsed_at (or now)
//   no membership   → left as is, listed
//
// Ids only in the output. Exit 0.

import { writeFileSync, readFileSync } from 'node:fs';
import { adminClient } from '../src/db.js';
import { reconcileMemberAccess } from '../src/routes/membership.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const [target, flag, restoreFile] = process.argv.slice(2);
if (target !== 'prod' && target !== 'staging') {
  console.error('usage: npx tsx --env-file=<env> scripts/backfill-recurring-addon-grants.ts prod|staging [--apply | --restore <file>]');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}

type Before = { id: string; status: string; stripe_subscription_id: string | null; ends_at: string | null };

if (flag === '--restore') {
  if (!restoreFile) throw new Error('--restore needs the file the --apply run wrote');
  const rows = JSON.parse(readFileSync(restoreFile, 'utf8')) as { target: string; rows: Before[] };
  if (rows.target !== target) throw new Error(`that restore file is for ${rows.target}, not ${target}`);
  let n = 0;
  for (const r of rows.rows) {
    const { error } = await adminClient
      .from('membership_product_purchase')
      .update({ status: r.status, stripe_subscription_id: r.stripe_subscription_id, ends_at: r.ends_at, updated_at: new Date().toISOString() })
      .eq('id', r.id);
    if (error) throw new Error(`restore ${r.id}: ${error.message}`);
    n++;
  }
  console.log(`Restored ${n} row(s) from ${restoreFile}.`);
  process.exit(0);
}

async function all<T>(label: string, build: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let a = 0; ; a += 1000) {
    const { data, error } = await build(a, a + 999);
    if (error) throw new Error(`${label}: ${error.message}`);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

const recurring = await all<{ id: string }>('products', (a, b) => adminClient.from('membership_product').select('id').neq('price_interval', 'once').order('id').range(a, b));
if (!recurring.length) {
  console.log(`${target}: no recurring products — nothing to convert.`);
  process.exit(0);
}
type Grant = { id: string; workspace_id: string; person_id: string; product_id: string; stripe_session_id: string; status: string; stripe_subscription_id: string | null; ends_at: string | null };
const grants = await all<Grant>('grants', (a, b) =>
  adminClient
    .from('membership_product_purchase')
    .select('id, workspace_id, person_id, product_id, stripe_session_id, status, stripe_subscription_id, ends_at')
    .in('product_id', recurring.map((p) => p.id))
    .eq('status', 'paid')
    .is('stripe_subscription_id', null)
    .order('id')
    .range(a, b),
);
const buyRefs = new Set(
  (grants.length
    ? await all<{ item_ref: string }>('ledger', (a, b) =>
        adminClient.from('purchase').select('item_ref').in('item_ref', grants.map((g) => `product-${g.stripe_session_id}`)).order('item_ref').range(a, b),
      )
    : []
  ).map((r) => r.item_ref),
);
const people = [...new Set(grants.map((g) => g.person_id))];
const members = people.length
  ? await all<{ id: string; workspace_id: string; person_id: string; status: string; deleted_at: string | null; lapsed_at: string | null; stripe_subscription_id: string | null }>('members', (a, b) =>
      adminClient.from('membership_member').select('id, workspace_id, person_id, status, deleted_at, lapsed_at, stripe_subscription_id').in('person_id', people).order('person_id').range(a, b),
    )
  : [];
const memberOf = new Map(members.map((m) => [`${m.workspace_id}:${m.person_id}`, m]));

type Plan = { id: string; to: { status: string; stripe_subscription_id: string | null; ends_at: string | null } } | { id: string; skip: string };
const plans: Plan[] = grants.map((g) => {
  if (buyRefs.has(`product-${g.stripe_session_id}`)) return { id: g.id, skip: 'bought through /public/buy (audit list a)' };
  const m = memberOf.get(`${g.workspace_id}:${g.person_id}`);
  if (!m) return { id: g.id, skip: 'no membership in that workspace' };
  if (m.deleted_at || m.status === 'lapsed' || m.status === 'cancelled') {
    return { id: g.id, to: { status: 'cancelled', stripe_subscription_id: m.stripe_subscription_id, ends_at: m.lapsed_at ?? new Date().toISOString() } };
  }
  if (!m.stripe_subscription_id) return { id: g.id, skip: `live membership (${m.status}) with no subscription id` };
  return { id: g.id, to: { status: m.status === 'active' ? 'active' : 'past_due', stripe_subscription_id: m.stripe_subscription_id, ends_at: null } };
});

const changes = plans.filter((p): p is Extract<Plan, { to: unknown }> => 'to' in p);
const skips = plans.filter((p): p is Extract<Plan, { skip: string }> => 'skip' in p);
console.log(`${target}: ${grants.length} recurring grant(s) still 'paid' with no subscription.`);
for (const c of changes) console.log(`  convert ${c.id} → ${c.to.status}${c.to.stripe_subscription_id ? ` on ${c.to.stripe_subscription_id}` : ''}`);
for (const s of skips) console.log(`  leave   ${s.id} — ${s.skip}`);

if (flag !== '--apply') {
  console.log(`\nDry run: ${changes.length} to convert, ${skips.length} left. Nothing was changed. Add --apply to convert.`);
  process.exit(0);
}

// RESTORE FIRST: every row's current values, written before any update.
const before: Before[] = grants.filter((g) => changes.some((c) => c.id === g.id)).map((g) => ({ id: g.id, status: g.status, stripe_subscription_id: g.stripe_subscription_id, ends_at: g.ends_at }));
const file = `backfill-recurring-addon-grants.${target}.${new Date().toISOString().replace(/[:.]/g, '-')}.restore.json`;
writeFileSync(file, JSON.stringify({ target, rows: before }, null, 2));
console.log(`\nRestore file written: ${file} (${before.length} row(s)). Undo with --restore ${file}`);

let done = 0;
for (const c of changes) {
  const { error } = await adminClient
    .from('membership_product_purchase')
    .update({ ...c.to, updated_at: new Date().toISOString() })
    .eq('id', c.id)
    .eq('status', 'paid') // only if still as read — never over a newer write
    .is('stripe_subscription_id', null);
  if (error) throw new Error(`convert ${c.id}: ${error.message} — stopped; ${done} done; restore with --restore ${file}`);
  done++;
}
console.log(`Converted ${done} row(s). ${skips.length} left as listed.`);

// A cancelled grant still has access rows in the member's journal until the
// member is reconciled — the same reconcile the webhook runs. Only members
// this run touched; a deleted member row is skipped (nothing to reconcile).
const touched = new Set<string>();
for (const c of changes) {
  const g = grants.find((x) => x.id === c.id)!;
  const m = memberOf.get(`${g.workspace_id}:${g.person_id}`);
  if (m && !m.deleted_at && c.to.status === 'cancelled') touched.add(m.id);
}
for (const id of touched) await reconcileMemberAccess(id);
console.log(`Reconciled access for ${touched.size} member(s) whose add-on ended.`);
