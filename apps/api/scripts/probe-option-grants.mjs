// A JOIN WITH SEVERAL EXTRAS: does every extra actually get granted?
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/probe-option-grants.mjs
//
// The webhook inserts one `membership_product_purchase` per chosen product,
// all carrying the SAME `stripe_session_id`, and treats 23505 as "a retry,
// already done". That is correct only if the uniqueness is (session, product).
// This asks the database which it is, by inserting two rows that differ ONLY
// in product_id and reading what comes back.
//
// It matters because those rows are the ENTITLEMENT: reconcileMemberAccess
// turns them into access grants, the member portal lists them as owned, and
// member-discount counts them. A row that is never written is a product the
// member paid for and did not receive.
//
// Read-mostly: it creates two throwaway products in a throwaway workspace and
// deletes everything it made, including on failure.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.FIBRE_ENV_FILE;
if (!envFile) {
  console.error('set FIBRE_ENV_FILE to an env file');
  process.exit(2);
}
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('that env file has no Supabase url + service-role key');
  process.exit(2);
}
// STAGING ONLY, with no override. This probe WRITES — a workspace, a person,
// two products and two purchase rows — and the other scripts beside it are
// guarded by refusing a key that is not `sk_test`, which says nothing about
// which DATABASE an env file points at. Pointed at production it would plant
// fixtures in real tenant data.
//
// And there is deliberately no --prod escape, because there is no question
// production could answer that staging cannot: the thing being asked is
// which columns a UNIQUE constraint covers, and both stacks run the same
// migrations. A flag would exist only to be used by accident.
if (!url.includes('lukhyylwhhjyihqtghvw')) {
  console.error(
    'refusing: that env file is not the staging project, and this probe writes.\n' +
      'It creates a throwaway workspace, person, products and purchases, so it\n' +
      'runs against staging only. There is no override: the answer is which\n' +
      'columns a unique constraint covers, and that is the same on both stacks.',
  );
  process.exit(2);
}
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const tag = `probe-option-grants-${Date.now()}`;
const made = { workspace: null, person: null, products: [] };

async function cleanup() {
  // Purchases first (they reference product + person), then the rest.
  if (made.workspace) {
    await db.from('membership_product_purchase').delete().eq('workspace_id', made.workspace);
    await db.from('membership_product').delete().eq('workspace_id', made.workspace);
  }
  if (made.person) await db.from('person').delete().eq('id', made.person);
  if (made.workspace) await db.from('workspace').delete().eq('id', made.workspace);
}

const die = async (...msg) => {
  console.error(...msg);
  await cleanup();
  process.exit(1);
};

try {
  const ws = await db.from('workspace').insert({ name: tag, slug: tag }).select('id').single();
  if (ws.error) await die('could not make a workspace:', ws.error.message);
  made.workspace = ws.data.id;

  const p = await db
    .from('person')
    .insert({ workspace_id: made.workspace, first_name: 'Probe', last_name: tag })
    .select('id')
    .single();
  if (p.error) await die('could not make a person:', p.error.message);
  made.person = p.data.id;

  for (const name of ['Extra one', 'Extra two']) {
    const pr = await db
      .from('membership_product')
      .insert({ workspace_id: made.workspace, name: `${tag} ${name}`, price_cents: 1000 })
      .select('id')
      .single();
    if (pr.error) await die('could not make a product:', pr.error.message);
    made.products.push(pr.data.id);
  }

  // THE JOIN'S OWN SHAPE: one checkout session, two products ticked.
  const session = `cs_test_${tag}`;
  const results = [];
  for (const productId of made.products) {
    const { error } = await db.from('membership_product_purchase').insert({
      workspace_id: made.workspace,
      person_id: made.person,
      product_id: productId,
      stripe_session_id: session,
      amount_cents: 1000,
      currency: 'EUR',
      status: 'paid',
    });
    results.push(error ? `${error.code}: ${error.message}` : 'inserted');
  }

  const back = await db
    .from('membership_product_purchase')
    .select('product_id')
    .eq('stripe_session_id', session);
  if (back.error) await die('could not read the rows back:', back.error.message);

  console.log('two products ticked in ONE checkout session:');
  results.forEach((r, i) => console.log(`  product ${i + 1}: ${r}`));
  console.log(`\nrows that exist: ${back.data.length} of 2`);

  if (back.data.length === 2) {
    console.log('\nOPEN AND CORRECT: every chosen extra is granted.');
  } else if (back.data.length === 1 && results[1].startsWith('23505')) {
    console.log(
      '\nLOSS CONFIRMED: the uniqueness is on stripe_session_id ALONE, so the\n' +
        'second extra raises 23505 — which the webhook reads as "already done".\n' +
        'A member who ticks three extras pays for three and is granted ONE.',
    );
  } else {
    console.log('\nINCONCLUSIVE: neither shape. Read the two lines above.');
  }
} finally {
  await cleanup();
  console.log('\n(fixture removed)');
}
