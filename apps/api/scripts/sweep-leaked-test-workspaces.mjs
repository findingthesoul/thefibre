#!/usr/bin/env node
// Remove the throwaway workspaces the test suites left on STAGING.
//
//   FIBRE_ENV_FILE=.env.staging node scripts/sweep-leaked-test-workspaces.mjs            # DRY RUN: counts and a sample, deletes nothing
//   FIBRE_ENV_FILE=.env.staging node scripts/sweep-leaked-test-workspaces.mjs --delete   # the sweep itself
//
// Why there is anything to sweep: from 2026-09-15 to 2026-10-01 every
// integration run left every throwaway workspace behind — a migration gave
// each workspace its own organisation behind a key that does not cascade, so
// the harness's `delete from workspace` was refused and nobody read the
// answer (v1.97.3 fixed the harness). 406 of them stood on staging when it
// was found, plus the browser pack's `e2e-noaccess-*` and the first-admin
// test's `first-admin-*`. The five-minute schedulers walked all of them.
//
// Sjoerd approved the sweep on 2026-10-03, staging only, "count first and
// sample", on these terms, each of which is a line below and not a comment:
//
//   OPT-IN, never exempt-out. A workspace is deleted only when its slug
//   matches one of three explicit harness patterns AND its name is the one
//   that harness writes. An exemption list fails open (2026-09-27); an
//   allow-list fails closed.
//
//   THE PERMANENT FIXTURES MUST EXIST AND MUST NOT BE IN THE SET. The script
//   refuses to run if any of them is missing (which would mean it is looking
//   at the wrong database) or if the allow-list ever matches one of them.
//
//   STAGING ONLY. Refuses unless the connected project is the staging ref.
//
//   DRY RUN FIRST. Without --delete it prints counts per pattern, the
//   permanent fixtures it found, a sample of ten with dates and member
//   counts, and leaves. Bring that to the controller; Sjoerd sees it.
//
//   NEVER a migration, never a rename. A workspace that cannot be deleted
//   (its people are pinned by append-only `activity`) is reported and left.
//
// Deletion order per workspace follows the keys: cut user.person_id (user
// and person point at each other), then persons, users, the workspace's own
// organisations, then the workspace. Auth users of the leaked seats are
// removed only when their seat was removed here; orphan @example.com auth
// users with no seat anywhere are COUNTED, not touched (not approved).

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './lib/env.mjs';
import { HARNESS, classify, isOrphanTestAccount } from './lib/sweep-rules.mjs';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const DELETE = process.argv.includes('--delete');

// The rules (allow-list, permanent fixtures) live in lib/sweep-rules.mjs,
// where they are tested without a database.

const { file, env } = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(STAGING_REF)) {
  console.error(`REFUSED: ${file} points at ${url || '(nothing)'}, not the staging project (${STAGING_REF}). This script never runs against production.`);
  process.exit(2);
}
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (what, r) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

console.log(`Project: ${STAGING_REF} (staging), env file ${file}. ${DELETE ? 'DELETE RUN.' : 'DRY RUN: nothing is deleted.'}\n`);

// ── 1. Every workspace, classified ─────────────────────────────────────────
const all = must('workspaces', await db.from('workspace').select('id, slug, name, created_at').order('created_at'));
const { candidates, nameMismatch, permanentFound, missing, illegal, rehearsal } = classify(all);
console.log(`Workspaces: ${all.length}. Permanent fixtures found: ${permanentFound.map((w) => w.slug).join(', ') || 'none'}${rehearsal ? `; rehearsal ${rehearsal.slug}` : ''}.`);
if (missing.length) {
  console.error(`REFUSED: permanent fixture(s) missing: ${missing.join(', ')}. Either this is not the staging database or the fixtures were lost; nothing is swept until that is understood.`);
  process.exit(2);
}
if (illegal.length) {
  console.error(`REFUSED: the allow-list matched a permanent workspace (${illegal.map((w) => w.slug).join(', ')}). The patterns are wrong; nothing is swept.`);
  process.exit(2);
}

// Member and user counts, for the sample and for the record.
const ids = candidates.map((w) => w.id);
const counts = new Map(ids.map((id) => [id, { users: 0, members: 0, persons: 0 }]));
for (let i = 0; i < ids.length; i += 200) {
  const slice = ids.slice(i, i + 200);
  for (const [table, key] of [['user', 'users'], ['workspace_member', 'members'], ['person', 'persons']]) {
    const rows = must(table, await db.from(table).select('workspace_id').in('workspace_id', slice));
    for (const r of rows) counts.get(r.workspace_id)[key] += 1;
  }
}

// ── 2. The report ───────────────────────────────────────────────────────────
console.log('\nBy pattern (slug matches AND the harness name):');
for (const h of HARNESS) {
  const n = candidates.filter((c) => c.label === h.label);
  const dates = n.map((c) => c.created_at.slice(0, 10)).sort();
  console.log(`  ${h.label.padEnd(16)} ${String(n.length).padStart(4)}   ${n.length ? `${dates[0]} → ${dates[dates.length - 1]}` : ''}   (${h.source})`);
}
console.log(`  total to sweep   ${String(candidates.length).padStart(4)}`);
if (nameMismatch.length) {
  console.log(`\nSlug matched but the NAME did not — left alone, listed so a person can look (${nameMismatch.length}):`);
  for (const w of nameMismatch.slice(0, 20)) console.log(`  ${w.slug.padEnd(40)} name=${JSON.stringify(w.name)}  ${w.created_at.slice(0, 10)}`);
}
const withPeople = candidates.filter((c) => counts.get(c.id).members > 0 || counts.get(c.id).users > 0);
console.log(`\nOf those, with users or members still attached: ${withPeople.length} (their seats go with the workspace; a real person never had one here).`);

console.log('\nSample of 10 (oldest, newest, and eight spread between):');
const sample = candidates.length <= 10 ? candidates : [0, ...Array.from({ length: 8 }, (_, k) => Math.round(((k + 1) * (candidates.length - 1)) / 9)), candidates.length - 1].map((i) => candidates[i]);
for (const w of sample) {
  const c = counts.get(w.id);
  console.log(`  ${w.slug.padEnd(40)} ${w.created_at.slice(0, 16)}  users=${c.users} members=${c.members} persons=${c.persons}  ${JSON.stringify(w.name)}`);
}

// Orphan auth users: counted, not touched.
let orphanAuth = 0;
try {
  const seats = new Set(must('seat emails', await db.from('user').select('email')).map((u) => String(u.email).toLowerCase()));
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (isOrphanTestAccount(u.email, seats)) orphanAuth += 1;
    }
    if (data.users.length < 1000) break;
    page += 1;
  }
  console.log(`\nOrphan @example.com auth users with no seat anywhere: ${orphanAuth} (counted only; not part of this sweep).`);
} catch (e) {
  console.log(`\nOrphan auth users: could not count (${e.message}).`);
}

if (!DELETE) {
  console.log('\nDRY RUN. Nothing was deleted. Re-run with --delete to sweep exactly the set above.');
  process.exit(0);
}

// ── 3. The sweep, one workspace at a time, each answer read ────────────────
console.log('\nSweeping…');
let removed = 0;
const left = [];
for (const w of candidates) {
  try {
    const emails = must('emails', await db.from('user').select('email').eq('workspace_id', w.id)).map((u) => String(u.email).toLowerCase());
    must('unlink users', await db.from('user').update({ person_id: null }).eq('workspace_id', w.id));
    must('persons', await db.from('person').delete().eq('workspace_id', w.id));
    must('users', await db.from('user').delete().eq('workspace_id', w.id));
    must('organisations', await db.from('organisation').delete().eq('workspace_id', w.id));
    const gone = must('workspace', await db.from('workspace').delete().eq('id', w.id).select('id'));
    if (gone.length !== 1) throw new Error('workspace row did not go');
    removed += 1;
    // The seats' sign-in identities, now that the seats are gone and no other
    // seat holds the address.
    for (const email of emails) {
      const { count } = await db.from('user').select('id', { count: 'exact', head: true }).eq('email', email);
      if (count) continue;
      const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
      const au = data?.users.find((a) => (a.email ?? '').toLowerCase() === email);
      if (au) await db.auth.admin.deleteUser(au.id);
    }
  } catch (e) {
    left.push(`${w.slug}: ${e.message}`);
  }
}
console.log(`Removed ${removed} of ${candidates.length}.`);
if (left.length) {
  console.log(`Left standing, with the reason (${left.length}):`);
  for (const l of left) console.log(`  ${l}`);
}
const after = must('recount', await db.from('workspace').select('id', { count: 'exact', head: true }));
console.log(`Workspaces now: ${after === null ? '?' : ''}${(await db.from('workspace').select('id', { count: 'exact', head: true })).count}.`);
process.exit(left.length ? 1 : 0);
