#!/usr/bin/env node
// Move somebody's place in a workspace from one email address to another.
//
// WHY THIS EXISTS
// A workspace membership is a row in public."user", keyed by (workspace_id,
// email) — so an invite sent to the wrong address is not a field to correct,
// it is a row under a name that is not theirs. The Members screen can invite
// and can remove; it cannot say "this seat is the same person, under their
// real address", because that means creating one row, moving the app grants
// onto it, and retiring the other. Three writes that have to happen together.
//
// This is the script for that, and only that. It does not touch the person's
// row in any OTHER workspace: since v0.19.1 one account may hold a seat in
// several, and the point of the exercise is usually to make the address here
// match the one they already use elsewhere.
//
// WHAT IT WILL NOT DO
// Move content. If the old address created anything — a thread, a flow, an
// invoice — the script stops and says what, rather than orphaning it. Nobody
// has ever signed in as a mis-addressed invite, so in practice it owns
// nothing; if it ever does, that is a different job and a person should look
// at it.
//
// The old rows are SOFT-deleted (brief §6, personal data). The membership and
// app-grant rows are join rows and are deleted outright — leaving them would
// keep a retired seat in the Members list.
//
// Usage:
//   node scripts/transfer-membership.mjs --workspace <slug> --from <email> --to <email>
//   FIBRE_TRANSFER_CONFIRM=1 node scripts/transfer-membership.mjs ... (to write)
//
// Without the confirm variable it prints the plan and writes nothing.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '..', process.env.FIBRE_ENV_FILE ?? '.env'), 'utf-8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=', 2))
    .filter((p) => p.length === 2),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const slug = arg('workspace');
const fromEmail = arg('from')?.trim().toLowerCase();
const toEmail = arg('to')?.trim().toLowerCase();
const apply = process.env.FIBRE_TRANSFER_CONFIRM === '1';

if (!slug || !fromEmail || !toEmail) {
  console.error('usage: --workspace <slug> --from <email> --to <email>');
  process.exit(1);
}

const { data: ws } = await db.from('workspace').select('id, name').eq('slug', slug).maybeSingle();
if (!ws) {
  console.error(`no workspace with slug "${slug}"`);
  process.exit(1);
}

const { data: from } = await db
  .from('user')
  .select('id, email, full_name, person_id, primary_auth_method')
  .eq('workspace_id', ws.id)
  .eq('email', fromEmail)
  .is('deleted_at', null)
  .maybeSingle();
if (!from) {
  console.error(`${fromEmail} holds no live seat in ${ws.name}`);
  process.exit(1);
}

// Anything the old address made. Checked before anything is written, because
// the answer decides whether this is a transfer or a job for a human.
const OWNS = [
  ['thread_thread', 'created_by'],
  ['thread_template', 'created_by'],
  ['thread_engagement', 'created_by'],
  ['thread_certificate', 'issued_by'],
  ['flow_definition', 'created_by'],
  ['flow_definition', 'owner_user_id'],
  ['flow_run', 'owner_user_id'],
  ['flow_task', 'assignee_user_id'],
  ['meet_team', 'created_by'],
  ['meet_host', 'user_id'],
  ['purchase', 'organiser_user_id'],
  ['user_profile', 'user_id'],
  ['user_connection', 'user_id'],
  ['thread_organiser', 'user_id'],
];
const owned = [];
for (const [table, col] of OWNS) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true }).eq(col, from.id);
  if (error) continue; // table not in this deployment
  if (count) owned.push(`${table}.${col} × ${count}`);
}

const { data: grants } = await db.from('app_membership').select('app_id, role, permissions').eq('user_id', from.id);
const { data: member } = await db
  .from('workspace_member')
  .select('workspace_role, relationship_type, member_status')
  .eq('user_id', from.id)
  .eq('workspace_id', ws.id)
  .maybeSingle();
const { data: existing } = await db
  .from('user')
  .select('id, email')
  .eq('workspace_id', ws.id)
  .eq('email', toEmail)
  .is('deleted_at', null)
  .maybeSingle();

const { data: apps } = await db.from('app').select('id, slug');
const slugOf = Object.fromEntries((apps ?? []).map((a) => [a.id, a.slug]));

console.log(`\nworkspace   ${ws.name} (${slug})`);
console.log(`from        ${from.email}  ${from.full_name ?? ''}`);
console.log(`to          ${toEmail}${existing ? '  (already has a seat — grants will be added to it)' : '  (new seat)'}`);
console.log(`role        ${member?.workspace_role ?? 'organiser'} / ${member?.relationship_type ?? 'internal'}`);
console.log(`apps        ${(grants ?? []).map((g) => slugOf[g.app_id] ?? g.app_id).join(', ') || 'none'}`);
console.log(`owns        ${owned.length ? owned.join(', ') : 'nothing'}`);

if (owned.length) {
  console.error('\nSTOPPED. The old address owns the rows above; moving them is not this script\'s job.');
  process.exit(1);
}
if (!apply) {
  console.log('\nDry run. Re-run with FIBRE_TRANSFER_CONFIRM=1 to write.');
  process.exit(0);
}

// 1. The seat. Identity invariant: every user has a paired person, so the
//    person is made first and pointed back at the user afterwards — the same
//    order the invite in routes/members.ts uses.
let userId = existing?.id;
if (!userId) {
  const parts = (from.full_name ?? '').trim().split(/\s+/).filter(Boolean);
  let { data: person } = await db
    .from('person')
    .select('id')
    .eq('workspace_id', ws.id)
    .eq('email', toEmail)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (!person) {
    const { data: created, error } = await db
      .from('person')
      .insert({
        workspace_id: ws.id,
        first_name: parts[0] || null,
        last_name: parts.slice(1).join(' ') || null,
        email: toEmail,
      })
      .select('id')
      .single();
    if (error) throw error;
    person = created;
  }
  const { data: created, error } = await db
    .from('user')
    .insert({
      workspace_id: ws.id,
      person_id: person.id,
      email: toEmail,
      full_name: from.full_name,
      primary_auth_method: from.primary_auth_method ?? 'google',
      email_verified: false,
    })
    .select('id')
    .single();
  if (error) throw error;
  userId = created.id;
  await db.from('person').update({ user_id: userId }).eq('id', person.id);
  console.log(`\ncreated seat ${userId}`);
}

// 2. Standing in the workspace, and the apps they were given.
await db.from('workspace_member').upsert(
  {
    user_id: userId,
    workspace_id: ws.id,
    workspace_role: member?.workspace_role ?? 'organiser',
    relationship_type: member?.relationship_type ?? 'internal',
    member_status: member?.member_status ?? null,
  },
  { onConflict: 'user_id,workspace_id' },
);
for (const g of grants ?? []) {
  await db
    .from('app_membership')
    .upsert(
      { user_id: userId, app_id: g.app_id, role: g.role, permissions: g.permissions ?? {} },
      { onConflict: 'user_id,app_id' },
    );
}
console.log(`moved ${(grants ?? []).length} app grant(s) and the workspace role`);

// 3. Retire the old address.
await db.from('app_membership').delete().eq('user_id', from.id);
await db.from('workspace_member').delete().eq('user_id', from.id).eq('workspace_id', ws.id);
await db.from('user').update({ deleted_at: new Date().toISOString() }).eq('id', from.id);
if (from.person_id) {
  await db.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', from.person_id);
}
console.log(`retired ${from.email} (soft-deleted; activity it appears in is untouched)`);
console.log('\nDone. They sign in with the new address; no sign-out needed anywhere else.');
