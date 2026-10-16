// Two holes around RECURRING products, as a list, not a change — for Sjoerd
// to run on production and decide per row (found 2026-10-16, v1.240.1):
//
//   (a) BOUGHT ONCE: a recurring product (price_interval ≠ 'once') owned
//       through POST /public/buy, which until v1.240.1 never checked the
//       interval — paid once, owned forever. Recognised by its ledger row:
//       /public/buy writes item_ref = 'product-<checkout session id>'.
//   (b) OUTLIVED: a recurring product held as a membership ADD-ON whose
//       membership has lapsed or been cancelled (or the member row deleted)
//       — the grant is a status 'paid' row, and every reader treats 'paid'
//       as owned forever.
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/audit-recurring-product-grants.ts prod
//   npx tsx --env-file=.env.staging scripts/audit-recurring-product-grants.ts staging
//
// Read-only. Ids and amounts only — no names, no addresses. Exit 0 with
// counts; it refuses (exit 2) when the env file points at the other project.

import { adminClient } from '../src/db.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const target = process.argv[2];
if (target !== 'prod' && target !== 'staging') {
  console.error('usage: npx tsx --env-file=<env> scripts/audit-recurring-product-grants.ts prod|staging');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}

/** Every row of a select, a page at a time — PostgREST stops at 1,000 and
 *  says nothing, which would make a short list look complete. */
async function all<T>(label: string, build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(`${label}: ${error.message}`);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

type Product = { id: string; workspace_id: string; price_interval: string | null };
type Grant = { id: string; workspace_id: string; person_id: string; product_id: string; stripe_session_id: string; amount_cents: number; currency: string; status: string; created_at: string };

const recurring = await all<Product>('products', (a, b) =>
  adminClient.from('membership_product').select('id, workspace_id, price_interval').neq('price_interval', 'once').order('id').range(a, b),
);
const intervalOf = new Map(recurring.map((p) => [p.id, p.price_interval ?? '?']));
console.log(`${target}: ${recurring.length} recurring product(s).`);
if (!recurring.length) {
  console.log('No recurring products — nothing can be in either list.');
  process.exit(0);
}

const grants = await all<Grant>('grants', (a, b) =>
  adminClient
    .from('membership_product_purchase')
    .select('id, workspace_id, person_id, product_id, stripe_session_id, amount_cents, currency, status, created_at')
    .in('product_id', [...intervalOf.keys()])
    .eq('status', 'paid')
    .order('id')
    .range(a, b),
);
console.log(`${grants.length} paid grant(s) of a recurring product.\n`);

// (a) Bought once: the ledger row /public/buy writes.
const refs = grants.map((g) => `product-${g.stripe_session_id}`);
const ledger = refs.length
  ? await all<{ item_ref: string; amount_cents: number }>('ledger', (a, b) =>
      adminClient.from('purchase').select('item_ref, amount_cents').in('item_ref', refs).order('item_ref').range(a, b),
    )
  : [];
const boughtOnce = new Set(ledger.map((l) => l.item_ref));
const listA = grants.filter((g) => boughtOnce.has(`product-${g.stripe_session_id}`));

// (b) Outlived: the person's membership in that workspace is not live.
const people = [...new Set(grants.map((g) => g.person_id))];
const members = people.length
  ? await all<{ workspace_id: string; person_id: string; status: string; deleted_at: string | null }>('members', (a, b) =>
      adminClient.from('membership_member').select('workspace_id, person_id, status, deleted_at').in('person_id', people).order('person_id').range(a, b),
    )
  : [];
const memberOf = new Map(members.map((m) => [`${m.workspace_id}:${m.person_id}`, m]));
const LIVE = new Set(['active', 'grace', 'past_due']);
const listB = grants
  .filter((g) => !boughtOnce.has(`product-${g.stripe_session_id}`))
  .map((g) => ({ g, m: memberOf.get(`${g.workspace_id}:${g.person_id}`) }))
  .filter(({ m }) => !m || m.deleted_at || !LIVE.has(m.status));

const money = (c: number, cur: string) => `${(c / 100).toFixed(2)} ${cur}`;

console.log(`(a) BOUGHT ONCE through /public/buy — ${listA.length}`);
for (const g of listA) {
  console.log(`  grant ${g.id}  ws ${g.workspace_id}  person ${g.person_id}  product ${g.product_id} (${intervalOf.get(g.product_id)})  paid ${money(g.amount_cents, g.currency)}  on ${g.created_at.slice(0, 10)}`);
}
console.log(`\n(b) OUTLIVED a lapsed/cancelled/removed membership — ${listB.length}`);
for (const { g, m } of listB) {
  const state = !m ? 'no member row' : m.deleted_at ? 'member deleted' : m.status;
  console.log(`  grant ${g.id}  ws ${g.workspace_id}  person ${g.person_id}  product ${g.product_id} (${intervalOf.get(g.product_id)})  membership: ${state}`);
}
console.log(`\nRead-only. ${listA.length} in (a), ${listB.length} in (b). Nothing was changed.`);
