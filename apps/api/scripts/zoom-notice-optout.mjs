#!/usr/bin/env node
//
// Hide the "Zoom is still waiting for approval" notice from ONE workspace.
//
//   node scripts/zoom-notice-optout.mjs --workspace-name "Zoom review"
//   node scripts/zoom-notice-optout.mjs --workspace-name "Zoom review" --apply
//   node scripts/zoom-notice-optout.mjs --workspace-name "Zoom review" --undo --apply
//
//   FIBRE_ENV_FILE=.env.staging node scripts/zoom-notice-optout.mjs …   staging
//   (default: apps/api/.env — on most machines, PRODUCTION)
//
// ── Who this is for ────────────────────────────────────────────────────────
//
// The Zoom Marketplace reviewer. He is testing the very integration the
// notice calls unapproved, and telling him it is "still under request, use
// Google instead" would undermine the review being waited on. His account is
// named nowhere in this codebase — his WORKSPACE carries a flag, and this is
// what sets it.
//
// ── Why a script and not a line of SQL ────────────────────────────────────
//
// Nobody knows for certain what the reviewer's workspace is called, and a
// pasted UPDATE that matches nothing succeeds silently with 0 rows. So this
// LOOKS first and shows what it found — the workspace, when it was made, and
// the email addresses of its members — so the person running it can confirm
// it is the reviewer's before anything is written. It refuses on 0 matches
// and on more than 1.
//
// DRY RUN BY DEFAULT. Nothing is written without --apply.
//
// ── REMOVE WHEN THE ZOOM MARKETPLACE APP IS PUBLISHED ─────────────────────
//
// Delete this file along with the column (20261011230252),
// apps/api/src/lib/zoom-pending.ts and the shared wording.

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './lib/env.mjs';

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] ?? null;
}
const wanted = arg('--workspace-name');
const apply = args.includes('--apply');
const undo = args.includes('--undo');

if (!wanted) {
  console.error(
    'usage: zoom-notice-optout.mjs --workspace-name "<name>" [--apply] [--undo]\n' +
      '  Dry run unless --apply. --undo clears the flag instead of setting it.',
  );
  process.exit(2);
}

const envFile = process.env.FIBRE_ENV_FILE ?? '.env';
let env, path;
try {
  ({ env, path } = loadEnv(envFile));
} catch (e) {
  console.error(`zoom-notice-optout: could not read apps/api/${envFile}: ${e.message}`);
  process.exit(2);
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(`zoom-notice-optout: ${path} has no NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`);
  process.exit(2);
}

// Say which project is about to be touched, every time. Pointing at
// production by accident should be visible, not silent.
const project = url.replace(/^https?:\/\//, '').split('.')[0];
const stack = envFile === '.env' ? 'PRODUCTION (default env file)' : `env file ${envFile}`;
console.log(`\nProject: ${project}  —  ${stack}`);

const db = createClient(url, key, { auth: { persistSession: false } });

// ── Look ───────────────────────────────────────────────────────────────────
const { data: matches, error: wsErr } = await db
  .from('workspace')
  .select('id, name, slug, created_at, zoom_notice_hidden')
  .ilike('name', wanted);
if (wsErr) {
  console.error(`\nCould not read workspaces: ${wsErr.message}`);
  process.exit(2);
}

if (!matches?.length) {
  console.error(
    `\nNO WORKSPACE is named "${wanted}" on this project. Nothing was written.\n` +
      'This is a STOP, not a no-op: the whole point of the flag is that one\n' +
      'particular workspace carries it, and none does. Check the name — the\n' +
      'workspaces here are listed with:\n' +
      "    node scripts/zoom-notice-optout.mjs --workspace-name '%'\n",
  );
  process.exit(1);
}

if (matches.length > 1) {
  console.error(`\n${matches.length} workspaces match "${wanted}". Refusing to guess:\n`);
  for (const w of matches) console.error(`    ${w.name}  (${w.slug})`);
  console.error('\nNarrow the name. Nothing was written.\n');
  process.exit(1);
}

const ws = matches[0];

// Its members, so the person running this can see WHOSE workspace it is.
const { data: members, error: memErr } = await db
  .from('workspace_member')
  .select('workspace_role, user:user_id(email)')
  .eq('workspace_id', ws.id);
if (memErr) {
  console.error(`\nCould not read its members: ${memErr.message}`);
  process.exit(2);
}

console.log(`\nWorkspace : ${ws.name}`);
console.log(`  slug    : ${ws.slug}`);
console.log(`  created : ${ws.created_at}`);
console.log(`  flag now: zoom_notice_hidden = ${ws.zoom_notice_hidden}`);
console.log(`  members : ${members?.length ?? 0}`);
for (const m of members ?? []) {
  console.log(`      ${m.user?.email ?? '(no email)'}  [${m.workspace_role}]`);
}
console.log(
  '\n  ^ Check these addresses. This should be the Zoom reviewer\'s workspace,\n' +
    '    and nobody else\'s — the flag silences the notice for everyone in it.',
);

// ── Write ──────────────────────────────────────────────────────────────────
const target = !undo;
const verb = target ? 'HIDE the notice for' : 'SHOW the notice again in';

if (ws.zoom_notice_hidden === target) {
  console.log(`\nAlready set: nothing to do. (zoom_notice_hidden = ${target})\n`);
  process.exit(0);
}

if (!apply) {
  console.log(
    `\nDRY RUN — nothing written.\n` +
      `Would ${verb} this workspace (zoom_notice_hidden: ${ws.zoom_notice_hidden} → ${target}).\n` +
      `Re-run with --apply to do it.\n`,
  );
  process.exit(0);
}

const { error: upErr, count } = await db
  .from('workspace')
  .update({ zoom_notice_hidden: target }, { count: 'exact' })
  .eq('id', ws.id);
if (upErr) {
  console.error(`\nUPDATE FAILED: ${upErr.message}\nNothing changed.\n`);
  process.exit(1);
}

// Read it back rather than trusting the write — the flag matters precisely
// once, and "the update returned no error" is not the same as "the row says
// what I think it says".
const { data: after, error: reErr } = await db
  .from('workspace')
  .select('zoom_notice_hidden')
  .eq('id', ws.id)
  .single();
if (reErr || after?.zoom_notice_hidden !== target) {
  console.error(
    `\nWROTE, BUT THE ROW DOES NOT READ BACK AS EXPECTED` +
      `${reErr ? `: ${reErr.message}` : ` (got ${after?.zoom_notice_hidden})`}.\n` +
      'Do not assume it is set. Re-run the dry run and look.\n',
  );
  process.exit(1);
}

console.log(
  `\nDONE — ${target ? 'the notice is hidden for' : 'the notice is back in'} "${ws.name}" ` +
    `(${count ?? 1} row).\n`,
);
