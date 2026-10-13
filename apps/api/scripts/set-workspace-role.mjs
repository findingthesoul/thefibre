// Set one person's role on their workspace memberships. A reviewed one-off.
//
//   node apps/api/scripts/set-workspace-role.mjs prod --email a@b.c --all-workspaces
//   node apps/api/scripts/set-workspace-role.mjs prod --email a@b.c --all-workspaces --apply
//   node apps/api/scripts/set-workspace-role.mjs prod --email a@b.c --workspace soul.com \
//        --role admin --relationship internal [--apply]
//
// DRY BY DEFAULT, and a script rather than a migration, because this edits
// WHO MAY DO WHAT in live tenants — the repo's rule for any bulk data change,
// and doubly right for permissions. Nothing moves without --apply.
//
// WHY IT EXISTS. On 2026-10-14 Sjoerd could not open Settings → Your domain in
// the soul.com workspace on production: his own row there reads "Organiser
// (default)" and "External", although he founded the workspace in May. The
// Role select snaps back when he changes it, because changing roles needs an
// admin and he is not one — the state locks itself in. So the repair has to
// come from outside the UI.
//
// WHAT IT WILL NOT DO.
//   - It never CREATES a membership. A workspace he is not part of is listed
//     as "not a member, skipped": joining somebody else's workspace is a
//     different decision from correcting his own role, and a script that
//     quietly did both would be the wrong tool for either.
//   - It touches nothing but `workspace_member`. No membership, team, seat,
//     grant or person row.
//   - It changes `relationship_type` ONLY where asked. Sjoerd confirmed
//     internal for soul.com and said nothing about the others, and a
//     relationship is a statement about a person's place in an organisation,
//     not a default to spray.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const which = argv[0];
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1] ?? null;
};
const has = (name) => argv.includes(`--${name}`);

const apply = has('apply');
const email = (flag('email') ?? '').trim().toLowerCase();
const allWorkspaces = has('all-workspaces');
const slug = flag('workspace');
const ROLES = ['super_admin', 'admin', 'organiser'];
const RELATIONSHIPS = ['internal', 'external'];
// super_admin for the sweep (Sjoerd, 2026-10-14: "In all current workspaces I
// should be superadmin"), and whatever --role says for a single workspace.
const role = flag('role') ?? (allWorkspaces ? 'super_admin' : null);
const relationship = flag('relationship');

const audit = has('audit');

const usage = () => {
  console.error(
    'usage:\n' +
      '  set-workspace-role.mjs staging|prod --audit\n' +
      '  set-workspace-role.mjs staging|prod --email <addr> --all-workspaces [--role <r>] [--apply]\n' +
      '  set-workspace-role.mjs staging|prod --email <addr> --workspace <slug> --role <r>\n' +
      '                                      [--relationship internal|external] [--apply]\n' +
      `\n  roles: ${ROLES.join(', ')}   relationships: ${RELATIONSHIPS.join(', ')}`,
  );
  process.exit(2);
};

if (which !== 'prod' && which !== 'staging') usage();
if (audit) {
  if (email || allWorkspaces || slug || apply) {
    console.error('--audit takes nothing else: it only reads, and changes nothing.');
    process.exit(2);
  }
} else if (!email || !email.includes('@')) usage();
if (!audit && allWorkspaces === Boolean(slug)) {
  console.error('give exactly one of --all-workspaces or --workspace <slug>');
  process.exit(2);
}
if (!audit && (!role || !ROLES.includes(role))) usage();
if (relationship && !RELATIONSHIPS.includes(relationship)) usage();
// Spelled out rather than inferred: --all-workspaces with --relationship would
// rewrite a person's stated place in every organisation at once, which is the
// one thing this was told not to do.
if (allWorkspaces && relationship) {
  console.error(
    'refusing --relationship with --all-workspaces: a relationship is set per\n' +
      'workspace, deliberately. Run the single-workspace form for each one.',
  );
  process.exit(2);
}

const file =
  which === 'prod'
    ? process.env.FIBRE_ENV_FILE ?? 'apps/api/.env'
    : process.env.FIBRE_STAGING_ENV_FILE ?? 'apps/api/.env.staging';
const expect = which === 'prod' ? 'zfsyyokepyycefbxiblc' : 'lukhyylwhhjyihqtghvw';
const env = Object.fromEntries(
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
if (!(env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes(expect)) {
  throw new Error(`${file} is not the ${which} project — refusing`);
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const die = (...m) => {
  console.error(...m);
  process.exit(1);
};

console.log(
  `${which.toUpperCase()}  ${
    audit ? 'AUDIT — reads only' : apply ? '*** APPLY ***' : 'DRY RUN — nothing is written'
  }`,
);
if (!audit) console.log(`who: ${email}\n`);

// WHICH WORKSPACES HAVE NOBODY IN CHARGE.
//
// A workspace with no admin and no super_admin cannot be administered from
// any screen, because every one of those screens is behind an admin check —
// including the one that would appoint an admin. soul.com is in that state
// and that is why this script exists; this says whether it is alone.
//
// `wouldOrphanWorkspace` has prevented the LAST admin being demoted or
// removed for some time, so a workspace should not be able to reach zero any
// more. It says nothing about one that was already there.
//
// Reads only, and takes no other argument, so there is no --apply to reach
// for by accident.
if (audit) {
  const [ws, wm, us] = await Promise.all([
    db.from('workspace').select('id, name, slug').order('name'),
    db.from('workspace_member').select('user_id, workspace_id, workspace_role'),
    db.from('user').select('id, email'),
  ]);
  if (ws.error) die(`could not list workspaces: ${ws.error.message}`);
  if (wm.error) die(`could not read workspace_member: ${wm.error.message}`);
  if (us.error) die(`could not read users: ${us.error.message}`);
  const mailOf = new Map((us.data ?? []).map((u) => [u.id, u.email]));

  const byWorkspace = new Map();
  for (const m of wm.data ?? []) {
    const list = byWorkspace.get(m.workspace_id) ?? [];
    list.push(m);
    byWorkspace.set(m.workspace_id, list);
  }

  const orphans = [];
  for (const w of ws.data ?? []) {
    const members = byWorkspace.get(w.id) ?? [];
    const admins = members.filter(
      (m) => m.workspace_role === 'admin' || m.workspace_role === 'super_admin',
    );
    if (!admins.length) orphans.push({ w, members });
  }

  console.log(`${(ws.data ?? []).length} workspace(s) on ${which}\n`);
  if (!orphans.length) {
    console.log('Every workspace has at least one admin.');
    process.exit(0);
  }
  // THE ONES WITH PEOPLE IN THEM FIRST. On staging this listing is 124 rows
  // long and almost all of them are abandoned e2e fixtures with no members
  // at all, so alphabetical order buries the one row somebody has to act on.
  // An empty workspace with no admin is tidying; a workspace with five
  // members and no admin is five people who cannot administer their own
  // community.
  orphans.sort((a, b) => b.members.length - a.members.length);
  const withPeople = orphans.filter((o) => o.members.length > 0).length;
  console.log(
    `${orphans.length} workspace(s) with NO admin and NO super_admin` +
      ` — ${withPeople} of them have members:\n`,
  );
  for (const { w, members } of orphans) {
    console.log(`  ${w.name}  (${w.slug})    ${members.length} member(s)`);
    // The members are named, because "a workspace with nobody in charge" and
    // "an empty workspace nobody uses" look identical in a count and want
    // completely different responses.
    for (const m of members) {
      console.log(`      ${m.workspace_role.padEnd(12)} ${mailOf.get(m.user_id) ?? m.user_id}`);
    }
    console.log('');
  }
  console.log('Nothing was changed. Appointing an admin is a separate, deliberate command.');
  process.exit(0);
}

// THE PERSON — ONE ROW PER WORKSPACE, not one row.
//
// `public."user"`, not auth.users: workspace_member.user_id is a FK to the
// public row (the repo's standing JWT gotcha, in reverse). And that table is
// `unique (workspace_id, email)`, so one human with memberships in five
// communities legitimately has FIVE user rows, one per workspace, each with
// its own id. Checked against the migration rather than assumed: the first
// draft of this script refused to continue on seeing more than one row for
// the address, which would have made it useless on production for exactly
// the person it was written for.
//
// So identity is resolved PER WORKSPACE, and `workspace_member` is keyed on
// (that workspace's user row, that workspace).
const { data: users, error: uErr } = await db
  .from('user')
  .select('id, workspace_id, email, full_name, deleted_at')
  .ilike('email', email);
if (uErr) die(`could not read user: ${uErr.message}`);
const live = (users ?? []).filter((u) => !u.deleted_at);
if (!live.length) die(`no live user row for ${email}`);
console.log(`${live.length} user row(s) for that address — one per workspace\n`);

const { data: workspaces, error: wErr } = await db
  .from('workspace')
  .select('id, name, slug')
  .order('name');
if (wErr) die(`could not list workspaces: ${wErr.message}`);

const { data: allMembers, error: mErr } = await db
  .from('workspace_member')
  .select('user_id, workspace_id, workspace_role, relationship_type, joined_at');
if (mErr) die(`could not read workspace_member: ${mErr.message}`);

const { data: allUsers, error: auErr } = await db.from('user').select('id, email');
if (auErr) die(`could not read users: ${auErr.message}`);
const emailOf = new Map((allUsers ?? []).map((u) => [u.id, u.email]));

const myUserIds = new Set(live.map((u) => u.id));
const mine = new Map();
for (const m of allMembers ?? []) {
  if (myUserIds.has(m.user_id)) mine.set(m.workspace_id, m);
}
const targets = allWorkspaces
  ? workspaces ?? []
  : (workspaces ?? []).filter((w) => w.slug === slug || w.name === slug);
if (!allWorkspaces && !targets.length) die(`no workspace with slug or name "${slug}"`);

// WHOSE WORKSPACE IS IT. Printed before anything changes, because the point
// of the dry run is for a human to notice a workspace that belongs to
// somebody else.
const planned = [];
const skipped = [];
for (const w of targets) {
  const row = mine.get(w.id);
  const others = (allMembers ?? []).filter((m) => m.workspace_id === w.id);
  const admins = others
    .filter((m) => m.workspace_role === 'admin' || m.workspace_role === 'super_admin')
    .map((m) => `${emailOf.get(m.user_id) ?? m.user_id}:${m.workspace_role}`);

  console.log(`${w.name}  (${w.slug})`);
  console.log(`    members: ${others.length}    admins: ${admins.length ? admins.join(', ') : 'NONE'}`);
  if (!row) {
    console.log('    you: NOT A MEMBER — skipped, this script never joins a workspace\n');
    skipped.push(w);
    continue;
  }
  const newRelationship = relationship ?? row.relationship_type;
  console.log(
    `    you: role ${row.workspace_role} → ${role}` +
      `    relationship ${row.relationship_type}` +
      `${newRelationship === row.relationship_type ? ' (unchanged)' : ` → ${newRelationship}`}` +
      `    joined ${String(row.joined_at).slice(0, 10)}\n`,
  );
  if (row.workspace_role === role && newRelationship === row.relationship_type) continue;
  planned.push({ w, row, newRelationship });
}

console.log(`${planned.length} row(s) to change, ${skipped.length} workspace(s) skipped.`);
if (!planned.length) {
  console.log('Nothing to do.');
  process.exit(0);
}
if (!apply) {
  console.log('\nDRY RUN — nothing was written. Re-run with --apply to make these changes.');
  process.exit(0);
}

// ONE ROW AT A TIME, keyed on BOTH primary-key columns, and read back. A
// filter that matched more than intended is the failure mode that matters
// here, so each update names exactly one (user, workspace) pair and the
// result is verified rather than assumed.
let changed = 0;
for (const { w, row, newRelationship } of planned) {
  // BOTH primary-key columns, and `user_id` taken from the row that was
  // actually read for this workspace — not from a single global "him", which
  // does not exist in a table keyed per workspace.
  const { data, error } = await db
    .from('workspace_member')
    .update({ workspace_role: role, relationship_type: newRelationship })
    .eq('user_id', row.user_id)
    .eq('workspace_id', w.id)
    .select('user_id, workspace_id, workspace_role, relationship_type');
  if (error) {
    console.error(`  FAILED ${w.slug}: ${error.message}`);
    continue;
  }
  if ((data ?? []).length !== 1) {
    console.error(`  FAILED ${w.slug}: updated ${(data ?? []).length} rows, expected exactly 1`);
    continue;
  }
  const after = data[0];
  console.log(
    `  ${w.slug}: role ${row.workspace_role} → ${after.workspace_role}, ` +
      `relationship ${row.relationship_type} → ${after.relationship_type}`,
  );
  changed += 1;
}
console.log(`\n${changed} of ${planned.length} row(s) changed.`);
if (changed !== planned.length) process.exitCode = 1;
