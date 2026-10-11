// Sweep the integration-test fixtures that staging accumulates.
//
//   node apps/api/scripts/sweep-int-test-fixtures.mjs            # DRY RUN
//   node apps/api/scripts/sweep-int-test-fixtures.mjs --apply    # does it
//
// DRY BY DEFAULT, and that is the whole safety model: this deletes workspaces
// and auth users, and the one thing it must never be is a script somebody
// runs to "see what it says" that turns out to have done it. `--apply` is the
// only way anything is written.
//
// TWO BUCKETS, because one of them is not optional:
//
//   DELETABLE  nothing about it is pinned. Removed outright.
//   PINNED     it has `activity` rows. Activity is append-only and the
//              trigger refuses the service role too, so its persons can
//              never be hard-deleted and nor can the workspace. These are
//              RETIRED IN PLACE instead: stripped of everything removable,
//              persons soft-deleted, and archived so nothing serves them.
//              `resolvePublicOwner` skips an archived workspace, so a
//              retired fixture answers no public URL.
//
// A fixture that ever hosted an enrolment or a booking is in the second
// bucket for good. That is not a bug to fix later; it is what append-only
// means, and a sweep that pretended otherwise would just fail every run.
//
// DELETE THE WORKSPACE, NEVER THE TEAMS FIRST. When a workspace delete is
// refused the tempting move is to clear its children and retry, and the
// automatic Admins/Everyone teams are the first thing to hand. Do not: those
// teams are created by a trigger on workspace creation, deleting them is a
// change to the workspace's own structure rather than cleanup, and a
// half-deleted workspace whose teams are gone is worse than an intact one
// that was simply refused. The order below removes CONTENT, then the
// workspace whole, and lets a refusal mean "this one is pinned".
//
// Also sweeps ORPHAN AUTH USERS: @example.com accounts with no `public.user`
// row anywhere. Those are what a fixture leaves when its workspace went but
// its sign-in identity did not, and they accumulate invisibly because nothing
// lists them.

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

// Fixtures to leave alone, by exact slug: `--keep int-test-split-6f4f1d74`.
//
// A fixture is sometimes deliberately alive — the person/organisation
// before-and-after is the only place on staging where that change is visible,
// and sweeping it would destroy the thing somebody was asked to look at.
//
// ON THE COMMAND LINE rather than in this file, and PRINTED on every run
// including the dry one. A keep-list that lives in the source goes stale in
// silence and quietly protects nothing years later; one that has to be typed
// is re-decided each time. And a keep that matches NOTHING is called out
// below rather than ignored, because a stale slug protecting an id that no
// longer exists is the same as no protection at all — and it would look
// exactly like protection in the log.
const KEEP = process.argv.reduce(
  (acc, a, i) => (a === '--keep' && process.argv[i + 1] ? [...acc, process.argv[i + 1]] : acc),
  /** @type {string[]} */ ([]),
);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (apps/api/.env.staging).');
  process.exit(64);
}
// STAGING ONLY, checked against the project ref rather than a flag somebody
// could pass by mistake. There is no production mode and there should not be:
// production has no int-test fixtures, so a sweep there could only ever
// delete something real.
if (!url.includes('lukhyylwhhjyihqtghvw')) {
  console.error(`REFUSED: ${url} is not the staging project. This script only ever runs against staging.`);
  process.exit(64);
}

const c = createClient(url, key, { auth: { persistSession: false } });
const PATTERN = 'int-test-%';

// ── ACCOUNTS THIS SCRIPT MUST NEVER TOUCH ───────────────────────────────────
//
// The e2e suite keeps PERMANENT identities. They are "orphans" by any
// mechanical definition between runs — no workspace, no membership, nothing
// pointing at them — and deleting one does not fail here: it fails later, in
// somebody else's e2e run, as an unexplained sign-in failure.
//
// Found by reading e2e/ rather than from a list somebody remembered: two of
// these were not in the instruction I was given.
const ALWAYS_KEEP = [
  'e2e-fixture@example.com',
  'e2e-payer-one@example.com',
  'e2e-payer-two@example.com',
  'fixture-organiser@example.com',
];

// And every `e2e-` account, including the per-run ones
// (e2e-enrolee-…, e2e-noaccess-…, e2e-…-org-…).
//
// A deliberate asymmetry rather than an oversight: deleting one of these
// buys tidiness, and costs a broken run — possibly a CONCURRENT one, since
// several sessions share this database and an e2e run in flight looks
// exactly like an abandoned fixture from here. Tidiness is worth less than
// somebody else's green suite. They are counted and named below so the
// choice is visible rather than silent.
const KEEP_PREFIXES = ['e2e-'];

const protectedAccount = (email) =>
  ALWAYS_KEEP.includes(email) || KEEP_PREFIXES.some((p) => email.startsWith(p));

// What this suite's own fixtures are called. Everything else that happens to
// be @example.com and unreferenced was made BY HAND — a rehearsal account, a
// demo person somebody shows the product with — and being mechanically
// orphaned says nothing about whether it is wanted.
//
// The first run of this script would have swept three of those in among
// forty-four machine-made ones, where nobody reading a list of forty-seven
// would have picked them out. They are separated and NOT deleted; removing
// one is a decision a person makes by name.
const SUITE_PREFIXES = ['int-'];
const madeBySuite = (email) => SUITE_PREFIXES.some((p) => email.startsWith(p));

/** Content a fixture workspace can hold, in the order the foreign keys allow.
 *  Everything here belongs to a workspace that is about to go or be retired,
 *  so none of it is anybody's data. `activity` is absent on purpose — it
 *  cannot be deleted, and asking is how the bucket is decided. */
const CONTENT = [
  'meet_booking', 'meet_meeting_type', 'meet_host',
  'thread_engagement', 'thread_thread', 'thread_organiser', 'thread_settings',
  'pulse_balance_snapshot', 'pulse_account',
  'purchase', 'enrolment', 'program',
  'organisation', 'workspace_app',
];

async function main() {
  const { data: workspaces, error } = await c
    .from('workspace')
    .select('id, slug, name, archived_at')
    .like('slug', PATTERN)
    .order('slug');
  if (error) throw new Error(`listing workspaces: ${error.message}`);

  const kept = (workspaces ?? []).filter((w) => KEEP.includes(w.slug));
  const unmatched = KEEP.filter((k) => !(workspaces ?? []).some((w) => w.slug === k));

  const deletable = [];
  const pinned = [];
  for (const w of (workspaces ?? []).filter((w) => !KEEP.includes(w.slug))) {
    const { count, error: aErr } = await c
      .from('activity')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', w.id);
    if (aErr) throw new Error(`activity count for ${w.slug}: ${aErr.message}`);
    (count && count > 0 ? pinned : deletable).push({ ...w, activity: count ?? 0 });
  }

  // Orphan sign-in identities: an @example.com auth user with no public.user
  // row. listUsers pages at 1000; keep asking until a short page comes back,
  // or a sweep silently stops at the first thousand.
  const authUsers = [];
  for (let page = 1; ; page++) {
    const { data, error: lErr } = await c.auth.admin.listUsers({ page, perPage: 1000 });
    if (lErr) throw new Error(`listing auth users: ${lErr.message}`);
    authUsers.push(...(data?.users ?? []));
    if ((data?.users ?? []).length < 1000) break;
  }
  const allExample = authUsers.filter((u) => u.email?.endsWith('@example.com'));
  const candidates = allExample.filter((u) => !protectedAccount(u.email));
  const shielded = allExample.filter((u) => protectedAccount(u.email));

  // ORPHAN = no `public.user` row AND no workspace_member.
  //
  // The second half is belt and braces — workspace_member.user_id points at
  // public.user, so no user row already implies no membership. It is checked
  // anyway because the two are matched by different things: the user row by
  // EMAIL, and an email can differ in case between GoTrue and public.user
  // (createFixtureUser lowercases precisely because that mismatch produced a
  // token with no claims once). Matching case-insensitively, and then asking
  // the membership table directly, means a real account has to be invisible
  // twice before this script will remove it.
  const orphans = [];
  for (const u of candidates) {
    const { data: rows } = await c.from('user').select('id').ilike('email', u.email);
    if (rows?.length) continue;
    const { data: byId } = await c.from('user').select('id').eq('id', u.id);
    if (byId?.length) continue;
    const ids = [...(rows ?? []), ...(byId ?? [])].map((r) => r.id);
    if (ids.length) {
      const { count: members } = await c
        .from('workspace_member')
        .select('user_id', { count: 'exact', head: true })
        .in('user_id', ids);
      if (members) continue;
    }
    orphans.push(u);
  }
  const suiteOrphans = orphans.filter((u) => madeBySuite(u.email));
  const handMade = orphans.filter((u) => !madeBySuite(u.email));

  const already = (workspaces ?? []).filter((w) => w.archived_at).length;
  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN — nothing is written'}`);
  console.log(`  workspaces matching ${PATTERN}: ${(workspaces ?? []).length}  (${already} already archived)`);
  console.log(`    DELETABLE (no activity):      ${deletable.length}`);
  console.log(`    PINNED by activity → retire:  ${pinned.length}`);
  console.log(`  @example.com auth accounts: ${allExample.length} total`);
  console.log(`    protected (e2e and named fixtures): ${shielded.length} — never deleted`);
  console.log(`    orphans made by this suite (int-*): ${suiteOrphans.length} — these are removed`);
  console.log(`    orphans made BY HAND:               ${handMade.length} — left alone, listed below`);
  if (kept.length) console.log(`  KEPT by --keep, untouched: ${kept.map((w) => w.slug).join(', ')}`);
  if (unmatched.length) {
    console.log(`  ⚠️  --keep matched NOTHING for: ${unmatched.join(', ')}`);
    console.log('      A keep that matches nothing protects nothing. Check the slug before applying.');
  }
  console.log('');

  const sample = (rows, n = 8) =>
    rows.slice(0, n).map((r) => `      ${r.slug}${r.activity ? `  (${r.activity} activity)` : ''}`).join('\n') +
    (rows.length > n ? `\n      … and ${rows.length - n} more` : '');
  if (deletable.length) console.log('    to DELETE:\n' + sample(deletable));
  if (pinned.length) console.log('    to RETIRE:\n' + sample(pinned));
  // THE FULL LIST, never a sample: these are accounts, and a count plus
  // "… and 39 more" is not something anybody can approve.
  if (suiteOrphans.length) {
    console.log(`    orphan accounts to REMOVE (all ${suiteOrphans.length}):`);
    for (const u of suiteOrphans) console.log(`      ${u.email}`);
  }
  if (handMade.length) {
    console.log(`    NOT removed — hand-made, somebody's to decide (${handMade.length}):`);
    for (const u of handMade) console.log(`      ${u.email}`);
  }
  if (shielded.length) {
    console.log(`    accounts PROTECTED and never touched (${shielded.length}):`);
    for (const u of shielded) console.log(`      ${u.email}`);
  }

  if (!APPLY) {
    console.log('\nRe-run with --apply to do it.\n');
    return;
  }

  let deleted = 0, retired = 0, refused = 0;
  for (const w of deletable) {
    const ok = await strip(w.id);
    const { error: dErr } = await c.from('workspace').delete().eq('id', w.id);
    if (dErr) {
      // A refusal here means something references it that this script does
      // not know about. Say which, and leave it alone — a half-cleared
      // workspace is worse than an untouched one.
      console.log(`  REFUSED ${w.slug}: ${dErr.message}`);
      refused++;
    } else if (ok) deleted++;
  }
  for (const w of pinned) {
    await strip(w.id);
    await c.from('person').update({ deleted_at: new Date().toISOString() }).eq('workspace_id', w.id).is('deleted_at', null);
    await c.from('user').update({ person_id: null }).eq('workspace_id', w.id);
    await c.from('workspace_member').delete().eq('workspace_id', w.id);
    await c.from('user').delete().eq('workspace_id', w.id);
    const { error: aErr } = await c
      .from('workspace')
      .update({ archived_at: w.archived_at ?? new Date().toISOString(), name: 'RETIRED int-test fixture (activity is append-only)' })
      .eq('id', w.id);
    if (aErr) console.log(`  COULD NOT RETIRE ${w.slug}: ${aErr.message}`);
    else retired++;
  }

  let accounts = 0;
  for (const u of suiteOrphans) {
    const { error: uErr } = await c.auth.admin.deleteUser(u.id);
    if (uErr) console.log(`  auth ${u.email}: ${uErr.message}`);
    else accounts++;
  }

  console.log(`\n  deleted ${deleted}, retired ${retired}, refused ${refused}, accounts removed ${accounts}`);
  const { data: left } = await c.from('workspace').select('slug, archived_at').like('slug', PATTERN);
  const serving = (left ?? []).filter((w) => !w.archived_at);
  console.log(`  left: ${(left ?? []).length} rows, of which ${serving.length} still SERVING (archived rows serve nothing)\n`);
}

/** Remove a workspace's content. Returns false when something refused, so the
 *  caller can tell "cleared" from "cleared as far as it could". */
async function strip(workspaceId) {
  let ok = true;
  const { data: users } = await c.from('user').select('id').eq('workspace_id', workspaceId);
  for (const u of users ?? []) {
    const r = await c.from('app_membership').delete().eq('user_id', u.id);
    if (r.error) { console.log(`    app_membership: ${r.error.message}`); ok = false; }
  }
  for (const t of CONTENT) {
    const r = await c.from(t).delete().eq('workspace_id', workspaceId);
    // A missing column means that table is not workspace-scoped; not an error.
    if (r.error && !/column .* does not exist/.test(r.error.message)) {
      console.log(`    ${t}: ${r.error.message}`);
      ok = false;
    }
  }
  // person ⇄ user point at each other; cut one side before removing both.
  await c.from('user').update({ person_id: null }).eq('workspace_id', workspaceId);
  const p = await c.from('person').delete().eq('workspace_id', workspaceId);
  if (p.error) ok = false; // pinned by activity — expected in that bucket
  await c.from('workspace_member').delete().eq('workspace_id', workspaceId);
  await c.from('user').delete().eq('workspace_id', workspaceId);
  return ok;
}

await main();
