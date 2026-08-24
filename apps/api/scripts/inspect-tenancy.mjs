#!/usr/bin/env node
// READ-ONLY diagnostic. Prints workspaces, signup requests, users and
// organisations so you can see the tenancy state before touching anything.
//
// Writes nothing. Deletes nothing. Safe to run against production.
//
// Usage:
//   node scripts/inspect-tenancy.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env'), 'utf-8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=', 2))
    .filter((p) => p.length === 2),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function section(title, rows, cols) {
  console.log(`\n=== ${title} (${rows?.length ?? 0}) ===`);
  for (const r of rows ?? []) {
    console.log(cols.map((c) => `${c}=${JSON.stringify(r[c])}`).join('  '));
  }
}

const { data: ws, error: wsErr } = await db
  .from('workspace')
  .select('id, slug, name, plan, created_at')
  .order('created_at');
if (wsErr) throw wsErr;
section('WORKSPACES', ws, ['id', 'slug', 'name', 'plan', 'created_at']);

const { data: sr } = await db
  .from('signup_request')
  .select('id, email, full_name, organisation_name, status, workspace_id, created_at')
  .order('created_at');
section('SIGNUP REQUESTS', sr, [
  'email',
  'organisation_name',
  'status',
  'workspace_id',
  'created_at',
]);

const { data: users } = await db
  .from('user')
  .select('id, email, workspace_id, deleted_at, last_sign_in')
  .order('created_at');
section('USERS', users, ['id', 'email', 'workspace_id', 'deleted_at', 'last_sign_in']);

const { data: orgs } = await db
  .from('organisation')
  .select('id, name, workspace_id, deleted_at')
  .order('name');
section('ORGANISATIONS', orgs, ['name', 'workspace_id', 'deleted_at']);

// Anything hanging off a workspace tells you whether it is empty or in use.
for (const w of ws ?? []) {
  const counts = {};
  for (const t of ['user', 'person', 'organisation', 'activity', 'workspace_app']) {
    const { count } = await db
      .from(t)
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', w.id);
    counts[t] = count ?? 0;
  }
  console.log(`\nworkspace ${w.slug} (${w.name}) →`, JSON.stringify(counts));
}
