// Does a thread coupon COUNT every use when two people redeem at once?
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/probe-coupon-race.mjs
//   …                                                              --unguarded
//
// Until 2026-10-13 the enrol path redeemed with `used_count: <value read
// earlier> + 1`, so two simultaneous redemptions both wrote the same number
// and one was LOST — a code recording 1 use when 2 people had used it.
//
// What is shipped is a retry loop, not a plain compare-and-set, and the
// difference matters. The redemption happens AFTER the enrolment is
// committed, so a CAS that loses the race leaves that enrolment standing and
// simply does not count it: the same under-count, now also when the code is
// nowhere near its limit. The loop re-reads and retries until the use is
// recorded, so every use is counted and an oversell is accepted and warned
// about rather than hidden.
//
// So this does NOT claim "exactly one succeeds" — that would be a different
// product decision, needing an RPC and a migration. It claims every
// redemption is counted. `--unguarded` reproduces the old lost-update shape
// so the probe can show the fault as well as its absence: one that only ever
// reports success proves nothing about whether it is looking.
//
// It creates its own coupon on a throwaway thread and removes everything.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes('lukhyylwhhjyihqtghvw')) throw new Error('refusing: not the staging project');
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const made = [];
const insert = async (table, row) => {
  const { data, error } = await db.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  made.unshift({ table, id: data.id });
  return data.id;
};

try {
  const { data: ws } = await db.from('workspace').select('id').eq('slug', 'default').single();
  const appId = (await db.from('app').select('id').eq('slug', 'the-thread').single()).data.id;
  const userId = await insert('user', {
    workspace_id: ws.id,
    email: `int-race-${stamp}@example.com`,
  });
  const organiserId = await insert('thread_organiser', {
    user_id: userId,
    workspace_id: ws.id,
    slug: `race-org-${stamp}`,
  });
  const programId = await insert('program', {
    workspace_id: ws.id,
    app_id: appId,
    title: `race fixture ${stamp}`,
    format: 'journey',
    status: 'active',
  });
  const threadId = await insert('thread_thread', {
    workspace_id: ws.id,
    program_id: programId,
    organiser_id: organiserId,
    slug: `race-thread-${stamp}`,
    is_public_listed: false,
    public_enrolment_open: false,
  });

  // One use left: limit 1, used 0.
  const couponId = await insert('thread_coupon', {
    workspace_id: ws.id,
    thread_id: threadId,
    code: `RACE${stamp}`,
    type: 'percentage',
    discount_percentage: 50,
    usage_limit: 1,
    used_count: 0,
    is_active: true,
  });

  const guarded = !process.argv.includes('--unguarded');
  console.log(guarded ? 'with the retry loop:' : 'WITHOUT it (the old lost-update shape):');

  // BOTH redeemers read the same row first — which is exactly what two
  // concurrent enrolments do — and then write.
  const read = await db.from('thread_coupon').select('used_count').eq('id', couponId).single();
  const seen = read.data.used_count;

  /** The route's own loop, restated here rather than imported: this probe
   *  asks what the DATABASE does with the shape, and importing the
   *  implementation would only make it agree with itself. */
  async function redeem() {
    if (!guarded) {
      // The old shape: write a number computed from a stale read.
      await db.from('thread_coupon').update({ used_count: seen + 1 }).eq('id', couponId);
      return;
    }
    let count = seen;
    for (let i = 0; i < 5; i += 1) {
      const { data: took } = await db
        .from('thread_coupon')
        .update({ used_count: count + 1 })
        .eq('id', couponId)
        .eq('used_count', count)
        .select('used_count');
      if (took?.length) return;
      const { data: fresh } = await db
        .from('thread_coupon')
        .select('used_count')
        .eq('id', couponId)
        .maybeSingle();
      if (!fresh) return;
      count = fresh.used_count;
    }
  }

  await Promise.all([redeem(), redeem()]);
  const { data: after } = await db
    .from('thread_coupon')
    .select('used_count')
    .eq('id', couponId)
    .single();

  console.log(`  two people redeemed, both having read used_count ${seen}`);
  console.log(`  used_count afterwards: ${after.used_count}  (2 means both were counted)`);
  console.log(
    after.used_count === 2
      ? '\nevery use counted.'
      : `\nA USE WAS LOST — ${after.used_count} recorded for 2 redemptions.`,
  );
  process.exitCode = after.used_count === 2 ? 0 : 1;
} finally {
  for (const { table, id } of made) {
    const { error } = await db.from(table).delete().eq('id', id);
    if (error) console.warn(`[cleanup] ${table} ${id}: ${error.message}`);
  }
  console.log('cleaned up');
}
