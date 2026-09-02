#!/usr/bin/env node
// Hand what one seat owns to another seat in the same workspace, and leave the
// first one standing.
//
// NOT the same job as transfer-membership.mjs. That one is for an invite sent
// to the wrong address: it makes a seat, moves the grants and retires the old
// address, and it REFUSES to run when the old address owns anything. This is
// the case it refuses — a seat that has been used, whose work should now sit
// under the address its owner actually signs in with, while the old seat stays
// usable as a way back in.
//
// WHAT MOVES: the things that answer "whose is this?" and change what a screen
// lets you do — the Thread storefront (and every thread hanging off it),
// template and engagement authorship, flow ownership.
//
// WHAT DOES NOT, and why each one:
//
//   activity.created_by      The activity log is append-only (brief §5). It
//                            records who did a thing on a day. Rewriting it
//                            would make the past say something that did not
//                            happen; corrections are new rows, never edits.
//
//   workspace_app.activated_by
//                            Same kind of fact: who switched an app on. It has
//                            no bearing on what anyone can do today.
//
//   user_profile             Display name, timezone, and the payment details
//                            keyed to that seat. The old seat is being kept as
//                            a working account, so it keeps its own profile.
//
//   app_membership,          The old seat is meant to stay usable. Stripping
//   workspace_member,        its access would make it a backup that cannot
//   user_identity_provider   sign in, which is not a backup.
//
// The destination is granted whatever apps the source holds, so the account
// taking the work over can actually open it.
//
// Usage:
//   node scripts/hand-over.mjs --workspace <slug> --from <email> --to <email>
//   FIBRE_HANDOVER_CONFIRM=1 node scripts/hand-over.mjs ...   (to write)

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

// [table, column, note]. Order matters only for reading the output.
const MOVES = [
  ['thread_organiser', 'user_id', 'the storefront — its threads follow it'],
  ['thread_template', 'created_by', 'template authorship'],
  ['thread_template', 'owner_user_id', 'template ownership'],
  ['thread_certificate_template', 'created_by', 'certificate designs'],
  ['thread_engagement', 'created_by', 'timeline items'],
  ['flow_definition', 'created_by', 'flow authorship'],
  ['flow_definition', 'owner_user_id', 'flow ownership'],
  ['flow_version', 'created_by', 'flow versions'],
  ['flow_run', 'owner_user_id', 'runs in flight'],
  ['flow_task', 'assignee_user_id', 'open tasks'],
  ['meet_host', 'user_id', 'the Meet host record'],
  ['pulse_budget_line', 'owner_user_id', 'budget lines'],
  ['pulse_commitment', 'owner_user_id', 'commitments'],
];

// Named so the output can say what it deliberately left, rather than being
// silent about it. See the header for the reasoning.
const KEPT = [
  ['activity', 'created_by', 'append-only; the past keeps its author'],
  ['workspace_app', 'activated_by', 'a fact about who switched an app on'],
  ['user_profile', 'user_id', 'the old seat keeps its own profile'],
  ['app_membership', 'user_id', 'the old seat stays usable'],
  ['workspace_member', 'user_id', 'the old seat stays usable'],
];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const slug = arg('workspace');
const fromEmail = arg('from')?.trim().toLowerCase();
const toEmail = arg('to')?.trim().toLowerCase();
const apply = process.env.FIBRE_HANDOVER_CONFIRM === '1';

if (!slug || !fromEmail || !toEmail) {
  console.error('usage: --workspace <slug> --from <email> --to <email>');
  process.exit(1);
}

const { data: ws } = await db.from('workspace').select('id, name').eq('slug', slug).maybeSingle();
if (!ws) {
  console.error(`no workspace with slug "${slug}"`);
  process.exit(1);
}

async function seat(email) {
  const { data } = await db
    .from('user')
    .select('id, email, full_name')
    .eq('workspace_id', ws.id)
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();
  return data;
}
const from = await seat(fromEmail);
const to = await seat(toEmail);
if (!from) {
  console.error(`${fromEmail} holds no live seat in ${ws.name}`);
  process.exit(1);
}
if (!to) {
  console.error(
    `${toEmail} holds no seat in ${ws.name}. Invite them first (Settings → Members), ` +
      'or use transfer-membership.mjs if the old address should be retired instead.',
  );
  process.exit(1);
}

console.log(`\nworkspace  ${ws.name} (${slug})`);
console.log(`from       ${from.email}  →  to  ${to.email}`);

const plan = [];
for (const [table, col, note] of MOVES) {
  const { count, error } = await db
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(col, from.id);
  if (error) continue; // table absent from this deployment
  if (count) plan.push({ table, col, count, note });
}

console.log('\nMOVES');
if (!plan.length) console.log('  nothing — the old seat owns none of it');
for (const p of plan) console.log(`  ${p.table}.${p.col} × ${p.count}   (${p.note})`);

console.log('\nSTAYS');
for (const [table, col, why] of KEPT) {
  const { count, error } = await db
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(col, from.id);
  if (error || !count) continue;
  console.log(`  ${table}.${col} × ${count}   (${why})`);
}

// One storefront per seat: moving onto a seat that already has one would
// either violate a unique index or leave two, and neither is what anybody
// meant. Checked before writing rather than caught halfway through.
const { count: hasOrganiser } = await db
  .from('thread_organiser')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', to.id);
if (hasOrganiser && plan.some((p) => p.table === 'thread_organiser')) {
  console.error(`\nSTOPPED. ${to.email} already has a Thread storefront; two cannot be merged here.`);
  process.exit(1);
}

if (!apply) {
  console.log('\nDry run. Re-run with FIBRE_HANDOVER_CONFIRM=1 to write.');
  process.exit(0);
}

for (const p of plan) {
  const { error } = await db.from(p.table).update({ [p.col]: to.id }).eq(p.col, from.id);
  console.log(`  ${error ? 'ERR  ' + error.message : 'moved'}  ${p.table}.${p.col} × ${p.count}`);
}

// The apps the source can open, so the destination can open what it now owns.
const { data: grants } = await db.from('app_membership').select('app_id, role').eq('user_id', from.id);
for (const g of grants ?? []) {
  await db
    .from('app_membership')
    .upsert({ user_id: to.id, app_id: g.app_id, role: g.role }, { onConflict: 'user_id,app_id' });
}
console.log(`  granted ${to.email} the ${(grants ?? []).length} app(s) the old seat holds`);

console.log(`\nDone. ${from.email} still signs in and still belongs to ${ws.name}.`);
