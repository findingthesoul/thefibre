#!/usr/bin/env node
// The staging identity verify-external-app.mjs signs in as — so it never has
// to sign in as a real person (Sjoerd agreed, 2026-10-16: "yes: create the
// staging fixture super admin").
//
//   verify-admin@example.com — is_super_admin, in its own permanent workspace
//   `verify-fixture` (Pro, Thread switched on), with a person row. Nothing
//   real is in that workspace; the script's own fixtures come and go there.
//
// STAGING ONLY: refuses any project but the staging one. Idempotent — safe
// to re-run; it fills in whatever is missing.
//
//   FIBRE_ENV_FILE=apps/api/.env.staging node apps/api/scripts/ensure-verify-admin.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
export const VERIFY_ADMIN_EMAIL = 'verify-admin@example.com';
const WS_SLUG = 'verify-fixture';

const envFile = process.env.FIBRE_ENV_FILE ?? 'apps/api/.env.staging';
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(STAGING_REF)) {
  console.error(`REFUSED: ${url || '(no url)'} is not the staging project. This identity exists on staging only.`);
  process.exit(2);
}
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (label, r) => {
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  return r.data;
};

let ws = must('workspace', await db.from('workspace').select('id').eq('slug', WS_SLUG).maybeSingle());
if (!ws) ws = must('workspace insert', await db.from('workspace').insert({ slug: WS_SLUG, name: 'Verify fixture (staging)' }).select('id').single());

const { error: authErr } = await db.auth.admin.createUser({ email: VERIFY_ADMIN_EMAIL, email_confirm: true });
if (authErr && !/already/i.test(authErr.message)) throw new Error(`auth user: ${authErr.message}`);

let person = must('person', await db.from('person').select('id').eq('workspace_id', ws.id).eq('email', VERIFY_ADMIN_EMAIL).is('deleted_at', null).maybeSingle());
if (!person) person = must('person insert', await db.from('person').insert({ workspace_id: ws.id, email: VERIFY_ADMIN_EMAIL, first_name: 'Verify', last_name: 'Admin' }).select('id').single());

let user = must('user', await db.from('user').select('id').eq('workspace_id', ws.id).eq('email', VERIFY_ADMIN_EMAIL).maybeSingle());
if (!user) user = must('user insert', await db.from('user').insert({ workspace_id: ws.id, email: VERIFY_ADMIN_EMAIL, full_name: 'Verify Admin (fixture)', person_id: person.id }).select('id').single());
must('super admin', await db.from('user').update({ is_super_admin: true, person_id: person.id, deleted_at: null }).eq('id', user.id));
must('member', await db.from('workspace_member').upsert({ workspace_id: ws.id, user_id: user.id, workspace_role: 'super_admin', relationship_type: 'internal' }, { onConflict: 'user_id,workspace_id' }));
must('plan', await db.from('workspace_subscription').upsert({ workspace_id: ws.id, plan_id: 'pro', status: 'active' }, { onConflict: 'workspace_id' }));
const thread = must('thread app', await db.from('app').select('id').eq('slug', 'the-thread').single());
must('thread on', await db.from('workspace_app').upsert({ workspace_id: ws.id, app_id: thread.id }, { onConflict: 'workspace_id,app_id' }));
must('thread membership', await db.from('app_membership').upsert({ user_id: user.id, app_id: thread.id, role: 'admin' }, { onConflict: 'user_id,app_id' }));
// Switching an app on in a workspace is a PLATFORM admin's act (RLS
// workspace_app_write → is_platform_admin(): a fibre-platform admin
// membership). Step 2 of verify-external-app activates its test app.
const platform = must('platform app', await db.from('app').select('id').eq('slug', 'fibre-platform').single());
must('platform membership', await db.from('app_membership').upsert({ user_id: user.id, app_id: platform.id, role: 'admin' }, { onConflict: 'user_id,app_id' }));

const check = must('read back', await db.from('user').select('email, is_super_admin, workspace_id, person_id').eq('id', user.id).single());
console.log(`staging verify admin ready: ${check.email} super_admin=${check.is_super_admin} workspace=${WS_SLUG} person=${!!check.person_id}`);
