#!/usr/bin/env node
// Bootstrap an EMPTY environment (staging) to the point where a real person
// can sign in and seed-ebbf.mjs can run: the 'default' workspace, and a
// pre-created platform user for the operator's email — mirroring what the
// members-invite path creates (person + user + workspace_member +
// app_membership), so the normal sso/resolve flow links the Google sign-in
// to it on first login. Idempotent.
//
// Usage:
//   FIBRE_ENV_FILE=.env.staging node scripts/bootstrap-staging.mjs <email> [name]
//
// Refuses to run against prod (checks the URL against the known prod ref).

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', process.env.FIBRE_ENV_FILE ?? '.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=', 2))
    .filter((p) => p.length === 2),
);

if ((env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes('zfsyyokepyycefbxiblc')) {
  console.error('This is the PROD database. Bootstrap is for empty environments only.');
  process.exit(1);
}

const email = process.argv[2];
const fullName = process.argv[3] ?? 'Sjoerd Luteijn';
if (!email || !email.includes('@')) {
  console.error('Usage: FIBRE_ENV_FILE=.env.staging node scripts/bootstrap-staging.mjs <email> [name]');
  process.exit(1);
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 1. The 'default' workspace (seed-ebbf looks it up by this slug). The
//    on-insert trigger creates its workspace_subscription (free, comped).
let { data: ws } = await db.from('workspace').select('id').eq('slug', 'default').maybeSingle();
if (!ws) {
  const { data, error } = await db
    .from('workspace')
    .insert({ slug: 'default', name: 'Staging Lab' })
    .select('id')
    .single();
  if (error) {
    console.error('workspace create failed:', error.message);
    process.exit(1);
  }
  ws = data;
  console.log('created workspace "Staging Lab" (default)');
} else {
  console.log('workspace "default" exists');
}

// 2. Person + user pair (identity invariant: every user has a person).
let { data: person } = await db
  .from('person')
  .select('id')
  .eq('workspace_id', ws.id)
  .eq('email', email)
  .is('deleted_at', null)
  .maybeSingle();
if (!person) {
  const parts = fullName.trim().split(/\s+/);
  const { data, error } = await db
    .from('person')
    .insert({
      workspace_id: ws.id,
      first_name: parts[0] ?? null,
      last_name: parts.slice(1).join(' ') || null,
      email,
    })
    .select('id')
    .single();
  if (error) {
    console.error('person create failed:', error.message);
    process.exit(1);
  }
  person = data;
  console.log('created person', email);
}

let { data: user } = await db
  .from('user')
  .select('id, is_super_admin')
  .eq('workspace_id', ws.id)
  .eq('email', email)
  .is('deleted_at', null)
  .maybeSingle();
if (!user) {
  const { data, error } = await db
    .from('user')
    .insert({
      workspace_id: ws.id,
      person_id: person.id,
      email,
      full_name: fullName,
      primary_auth_method: 'google',
      email_verified: false,
      is_super_admin: true,
    })
    .select('id')
    .single();
  if (error) {
    console.error('user create failed:', error.message);
    process.exit(1);
  }
  user = data;
  console.log('created user (super admin)', email);
} else if (!user.is_super_admin) {
  await db.from('user').update({ is_super_admin: true }).eq('id', user.id);
  console.log('granted super admin to existing user');
} else {
  console.log('user exists (super admin)');
}

// 3. Workspace role + app memberships (platform admin + the four apps).
const { error: wmErr } = await db
  .from('workspace_member')
  .upsert(
    { workspace_id: ws.id, user_id: user.id, workspace_role: 'super_admin' },
    { onConflict: 'workspace_id,user_id' },
  );
if (wmErr) console.error('workspace_member upsert failed (non-fatal):', wmErr.message);

const { data: apps } = await db
  .from('app')
  .select('id, slug')
  .in('slug', ['fibre-platform', 'fibre-meet', 'the-thread', 'fibre-flow', 'fibre-pulse']);
for (const app of apps ?? []) {
  const role = app.slug === 'fibre-platform' ? 'admin' : 'member';
  const { error } = await db
    .from('app_membership')
    .upsert({ user_id: user.id, app_id: app.id, role }, { onConflict: 'user_id,app_id' });
  if (error) console.error(`app_membership ${app.slug} failed (non-fatal):`, error.message);
}

// 4. Storage buckets — NOT part of migrations (Supabase storage lives
// outside the schema), so a fresh project has none and every upload 500s
// with "Bucket not found" (hit 2026-09-04, profile photo on staging).
const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};
for (const bucket of [
  // Mirrors prod config: public, 5MB, images only (uploads.ts serves public URLs).
  { id: 'thread-assets', name: 'thread-assets', public: true, file_size_limit: 5242880, allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] },
  { id: 'fibre-assets', name: 'fibre-assets', public: true },
]) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify(bucket),
  });
  if (r.ok) console.log(`storage bucket ${bucket.id} created`);
  else if (r.status === 400 || r.status === 409) console.log(`storage bucket ${bucket.id} exists`);
  else console.error(`storage bucket ${bucket.id} failed:`, r.status, await r.text());
}

console.log(`\nBootstrap done. ${email} can sign in with Google now; then run:`);
console.log('  FIBRE_ENV_FILE=.env.staging node scripts/seed-ebbf.mjs');
