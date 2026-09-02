#!/usr/bin/env node
// Grant (or revoke) platform super-admin. There is no UI for this by design —
// it is the flag that unlocks Admin → Access requests, App registry and
// Workspaces across every workspace, so it should be a deliberate act with a
// record of it, not a toggle somebody can fat-finger.
//
// Super admin is on `public.user`, keyed by email, and is NOT in the JWT — it
// is read fresh from the database on every request. So a change here takes
// effect on the target's next page load. They do not need to sign out.
//
// It is also independent of how they authenticate: Google, email passcode, or
// anything added later. The flag follows the email address.
//
// Usage:
//   FIBRE_GRANT_CONFIRM=1 node scripts/grant-super-admin.mjs <email>
//   FIBRE_GRANT_CONFIRM=1 node scripts/grant-super-admin.mjs <email> --revoke
//   node scripts/grant-super-admin.mjs --list          (read-only, no confirm)

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

async function listAdmins() {
  const { data } = await db
    .from('user')
    .select('email, full_name, primary_auth_method, created_at')
    .eq('is_super_admin', true)
    .is('deleted_at', null)
    .order('created_at');
  console.log(`\n=== SUPER ADMINS (${data?.length ?? 0}) ===`);
  for (const a of data ?? []) {
    console.log(`  ${a.email}  —  ${a.full_name ?? 'no name'}  (since ${a.created_at?.slice(0, 10)})`);
  }
  return data ?? [];
}

const args = process.argv.slice(2);
if (args.includes('--list') || args.length === 0) {
  await listAdmins();
  process.exit(0);
}

const email = args[0].toLowerCase();
const revoking = args.includes('--revoke');

if (process.env.FIBRE_GRANT_CONFIRM !== '1') {
  console.error(
    `This ${revoking ? 'REVOKES' : 'GRANTS'} platform super-admin for ${email}.\n` +
      'Re-run with FIBRE_GRANT_CONFIRM=1 if that is what you mean.',
  );
  process.exit(1);
}

const { data: target, error } = await db
  .from('user')
  .select('id, email, full_name, is_super_admin, deleted_at')
  .eq('email', email)
  .maybeSingle();
if (error) throw error;

if (!target) {
  console.error(`REFUSING: no user row for ${email}. They must have signed in at least once.`);
  process.exit(1);
}
if (target.deleted_at) {
  console.error(`REFUSING: ${email} is soft-deleted.`);
  process.exit(1);
}

// Never leave the platform with nobody who can administer it.
if (revoking) {
  const admins = await db
    .from('user')
    .select('id')
    .eq('is_super_admin', true)
    .is('deleted_at', null);
  if ((admins.data ?? []).length <= 1 && target.is_super_admin) {
    console.error('REFUSING: that is the last super admin. Grant another one first.');
    process.exit(1);
  }
}

const want = !revoking;
if (target.is_super_admin === want) {
  console.log(`${email} already ${want ? 'holds' : 'does not hold'} super admin. Nothing to do.`);
} else {
  const { error: uErr } = await db
    .from('user')
    .update({ is_super_admin: want })
    .eq('id', target.id);
  if (uErr) throw uErr;
  console.log(
    `${want ? 'Granted' : 'Revoked'} super admin ${want ? 'to' : 'from'} ${email} ` +
      `(${target.full_name ?? 'no name set'})`,
  );
}

await listAdmins();
console.log('\nTakes effect on their next page load — no sign-out needed.');
