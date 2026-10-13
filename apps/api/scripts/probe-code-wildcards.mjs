// Can a typed discount code still act as a wildcard? Ask the DATABASE.
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/probe-code-wildcards.mjs
//
// READ-ONLY. Run it after a deploy that touches the code lookup.
//
// This exists because the unit tests could not have caught the bug they are
// named after. They assert that `likeLiteral` produces a particular string —
// which it did, correctly, while `*` went on matching everything, because
// PostgREST accepts `*` as an alias for `%` and SQL has never heard of it.
// The rules that matter are the ones of the thing you are actually talking
// to, so this talks to it: the same client the route uses, against real rows.
//
// It prints a line per probe and exits non-zero if any wildcard matches
// anything. A thread with no active code proves nothing either way, and it
// says so rather than reporting a pass.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
// The escaping is RE-STATED here, deliberately, rather than imported from
// src (TypeScript, unbuilt in a worktree) or dist (which may not exist). A
// probe that imported the implementation could only ever agree with it; this
// one encodes what the rule is SUPPOSED to be and asks the database whether
// that is enough. If the two drift, the unit tests say so.
const likeLiteral = (v) => v.replace(/([\\%_*])/g, '\\$1');

const envFile = process.env.FIBRE_ENV_FILE;
if (!envFile) {
  console.error('set FIBRE_ENV_FILE to the env file for the stack to probe');
  process.exit(2);
}
const raw = readFileSync(envFile, 'utf8');
const env = Object.fromEntries(
  raw
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Everything a visitor might type that is a wildcard SOMEWHERE in the
 *  stack — SQL's own, PostgREST's alias, and the escape character. */
const WILDCARDS = ['%', '_', '*', '%%', 'E*', '*D', 'E_', '\\'];

const { data: coupons, error } = await db
  .from('thread_coupon')
  .select('id, thread_id, code')
  .eq('is_active', true);
if (error) throw new Error(`reading coupons: ${error.message}`);
if (!coupons?.length) {
  console.log('no active discount codes on this stack — nothing to probe, and nothing proven');
  process.exit(0);
}

const byThread = new Map();
for (const c of coupons) byThread.set(c.thread_id, [...(byThread.get(c.thread_id) ?? []), c]);

let open = 0;
for (const [threadId, list] of byThread) {
  // A thread with several active codes refuses everything through
  // maybeSingle() anyway, so it cannot show a hole OR prove its absence.
  const note = list.length > 1 ? '  (several codes: maybeSingle refuses regardless)' : '';
  console.log(`thread ${threadId.slice(0, 8)} — ${list.length} active code(s)${note}`);

  for (const typed of WILDCARDS) {
    const { data, error: qErr } = await db
      .from('thread_coupon')
      .select('code')
      .eq('thread_id', threadId)
      .ilike('code', likeLiteral(typed))
      .eq('is_active', true)
      .maybeSingle();
    const matched = !qErr && data;
    if (matched) open += 1;
    console.log(
      `  ${JSON.stringify(typed).padEnd(6)} -> ${
        qErr ? `refused (${qErr.code})` : data ? `OPEN: matches ${data.code}` : 'no match'
      }`,
    );
  }

  // And the positive anchor: a real code must still be found, or "no match"
  // above would mean the lookup is simply broken.
  const real = list[0].code;
  for (const typed of [real, real.toLowerCase(), real.toUpperCase()]) {
    const { data } = await db
      .from('thread_coupon')
      .select('code')
      .eq('thread_id', threadId)
      .ilike('code', likeLiteral(typed))
      .eq('is_active', true)
      .maybeSingle();
    console.log(`  ${JSON.stringify(typed).padEnd(6)} -> ${data ? `matches ${data.code}` : 'NO MATCH — the lookup is broken'}`);
    if (!data && list.length === 1) open += 1;
  }
}

console.log(open === 0 ? '\nclosed.' : `\n${open} probe(s) went the wrong way.`);
process.exit(open === 0 ? 0 : 1);
