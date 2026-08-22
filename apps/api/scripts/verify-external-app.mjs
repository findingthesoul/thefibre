#!/usr/bin/env node
// docs/brief-external-apps.md — "How to verify it worked", made runnable.
//
// The brief names six things an external app must be able to do without
// anyone running SQL. This script does all six against a live API, using a
// throwaway app slug, and cleans up after itself:
//
//   1. Register itself and be approved by an admin.
//   2. Be activated on a workspace.
//   3. Hold a key scoped to that workspace, with no user session present.
//   4. Link an organiser to a person and a host to an organisation.
//   5. Emit an activity onto the workspace timeline.
//   6. Be refused when it asks for something outside its scopes.
//
// Step 6 is the one that proves the model rather than the plumbing, so the
// script fails loudly if a refusal doesn't happen.
//
// Usage:
//   node scripts/verify-external-app.mjs                    # against localhost:8080
//   FIBRE_API=https://thefibre-api.fly.dev node scripts/verify-external-app.mjs
//
// The admin steps need a real user session. Rather than asking you to paste a
// JWT, the script mints one for the super admin via the Supabase admin API —
// same token the browser would carry, custom claims and all.

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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const API = process.env.FIBRE_API ?? 'http://localhost:8080';
const ADMIN_EMAIL = process.env.FIBRE_ADMIN_EMAIL ?? 'sjoerd@soul.com';

// A slug nobody would ship, so a half-finished run leaves nothing confusing.
const SLUG = 'verify-external-app';

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('Missing Supabase keys in apps/api/.env');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
const step = (n, label) => console.log(`\n── ${n}. ${label}`);
function check(ok, label, detail) {
  console.log(`   ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function call(path, { method = 'GET', body, token, appId } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (appId) headers['X-App-ID'] = appId;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

// --- A real user session for the admin steps -------------------------------
async function adminSession() {
  const { data: link, error } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email: ADMIN_EMAIL,
  });
  if (error) throw new Error(`generateLink failed: ${error.message}`);
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: vErr } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  });
  if (vErr) throw new Error(`verifyOtp failed: ${vErr.message}`);
  return data.session.access_token;
}

// --- Cleanup ---------------------------------------------------------------
async function cleanup() {
  const { data: app } = await db.from('app').select('id').eq('slug', SLUG).maybeSingle();
  if (!app) return;
  await db.from('app_key').delete().eq('app_id', app.id);
  await db.from('app_record_link').delete().eq('app_id', app.id);
  await db.from('activity').delete().eq('app_id', app.id);
  await db.from('app_entity_mapping').delete().eq('app_id', app.id);
  await db.from('workspace_app').delete().eq('app_id', app.id);
  await db.from('app').delete().eq('id', app.id);
}

async function main() {
  console.log(`API: ${API}`);
  await cleanup();

  const jwt = await adminSession();
  const me = await call('/api/v1/auth/me', { token: jwt, appId: 'fibre-platform' });
  if (me.status !== 200) throw new Error(`/auth/me returned ${me.status}`);
  console.log(`Admin: ${ADMIN_EMAIL} (super admin: ${!!me.body.user.is_super_admin})`);

  // ---- 1. Register + approve ---------------------------------------------
  step(1, 'Register itself and be approved by an admin');

  const manifest = {
    app_slug: SLUG,
    app_name: 'External App Verification',
    scopes_requested: ['read:persons', 'write:persons', 'write:organisations', 'write:activities'],
    entity_mappings: [
      {
        app_entity: 'planner_organiser',
        platform_entity: 'person',
        mapping_kind: 'identity',
        match_on: ['email'],
      },
      {
        app_entity: 'planner_host',
        platform_entity: 'organisation',
        mapping_kind: 'identity',
        match_on: ['domain'],
      },
    ],
    activity_types: [{ type: 'fot_planner_plan_created', subject: 'Plan created' }],
  };

  // No credential at all — an app registering itself doesn't have one yet.
  const reg = await call('/api/v1/apps/register', {
    method: 'POST',
    body: {
      app_slug: SLUG,
      app_name: 'External App Verification',
      description: 'Throwaway app used by scripts/verify-external-app.mjs.',
      contact_email: 'verify@example.com',
      homepage_url: 'https://example.com',
      manifest,
    },
  });
  check(reg.status === 201, 'registers with no credential', `HTTP ${reg.status}`);

  const beforeApproval = await call('/api/v1/workspace-apps', {
    method: 'POST',
    body: { app_slug: SLUG },
    token: jwt,
    appId: 'fibre-platform',
  });
  check(
    beforeApproval.status === 400,
    'cannot be activated while pending',
    `HTTP ${beforeApproval.status}`,
  );

  const approve = await call(`/api/v1/apps/${SLUG}`, {
    method: 'PATCH',
    body: { action: 'approve' },
    token: jwt,
    appId: 'fibre-platform',
  });
  check(approve.status === 200 && approve.body.app.status === 'approved', 'admin approves it');

  // ---- 2. Activate on a workspace ----------------------------------------
  step(2, 'Be activated on a workspace from settings/apps');
  const activate = await call('/api/v1/workspace-apps', {
    method: 'POST',
    body: { app_slug: SLUG },
    token: jwt,
    appId: 'fibre-platform',
  });
  check(activate.status === 200, 'activated', `HTTP ${activate.status}`);
  const workspaceId = me.body.user.workspace_id ?? activate.body?.workspace_app?.workspace_id;

  // Install the manifest so the entity mappings exist in this workspace.
  const install = await call(`/api/v1/apps/${SLUG}/manifest`, {
    method: 'PUT',
    body: {
      entity_mappings: manifest.entity_mappings,
      activity_types: manifest.activity_types,
      scopes_requested: manifest.scopes_requested,
    },
    token: jwt,
    appId: 'fibre-platform',
  });
  check(install.status === 200, 'manifest installed', `HTTP ${install.status}`);

  // ---- 3. Hold a key, no user session -------------------------------------
  step(3, 'Hold a key scoped to that workspace, with no user session present');

  const overreach = await call(`/api/v1/apps/${SLUG}/keys`, {
    method: 'POST',
    body: { name: 'overreach', scopes: ['read:activities'] },
    token: jwt,
    appId: 'fibre-platform',
  });
  check(
    overreach.status === 400,
    'refuses a scope the manifest never asked for',
    `HTTP ${overreach.status}`,
  );

  const mint = await call(`/api/v1/apps/${SLUG}/keys`, {
    method: 'POST',
    body: {
      name: 'verification',
      // Deliberately NOT write:activities — step 6 needs something to refuse.
      scopes: ['read:persons', 'write:persons', 'write:organisations'],
    },
    token: jwt,
    appId: 'fibre-platform',
  });
  check(mint.status === 201 && !!mint.body.token, 'key minted', `HTTP ${mint.status}`);
  const KEY = mint.body.token;

  const whoami = await call('/api/v1/apps/whoami', { token: KEY });
  check(
    whoami.status === 200 && whoami.body.app_slug === SLUG && whoami.body.auth === 'app_key',
    'the key authenticates on its own (no JWT, no X-App-ID)',
    `HTTP ${whoami.status}`,
  );
  check(
    whoami.body?.workspace_id === (workspaceId ?? whoami.body?.workspace_id),
    'and resolves to one workspace',
    whoami.body?.workspace_id,
  );

  // ---- 4. Link a person and an organisation -------------------------------
  step(4, 'Link an organiser to a person and a host to an organisation');

  const linkPerson = await call(`/api/v1/apps/${SLUG}/links`, {
    method: 'POST',
    token: KEY,
    body: {
      app_entity: 'planner_organiser',
      app_record_id: 'organiser-1',
      match_on: { email: 'verify-organiser@example.com', name: 'Verify Organiser' },
      create_if_missing: true,
    },
  });
  check(
    linkPerson.status === 201 && linkPerson.body.platform_entity === 'person',
    'organiser → person',
    `HTTP ${linkPerson.status} ${linkPerson.body?.action ?? linkPerson.body?.error ?? ''}`,
  );

  // This is the one the planner's manifest declares and could not write before.
  const linkOrg = await call(`/api/v1/apps/${SLUG}/links`, {
    method: 'POST',
    token: KEY,
    body: {
      app_entity: 'planner_host',
      app_record_id: 'host-1',
      match_on: { domain: 'verify-host.example', name: 'Verify Host Org' },
      create_if_missing: true,
    },
  });
  check(
    linkOrg.status === 201 && linkOrg.body.platform_entity === 'organisation',
    'host → organisation',
    `HTTP ${linkOrg.status} ${linkOrg.body?.action ?? linkOrg.body?.error ?? ''}`,
  );

  const bulk = await call(`/api/v1/apps/${SLUG}/links:bulk`, {
    method: 'POST',
    token: KEY,
    body: {
      links: [2, 3, 4].map((n) => ({
        app_entity: 'planner_organiser',
        app_record_id: `organiser-${n}`,
        match_on: { email: `verify-organiser-${n}@example.com`, name: `Verify Organiser ${n}` },
        create_if_missing: true,
      })),
    },
  });
  check(
    bulk.status === 201 && bulk.body.linked === 3,
    'three more in one bulk call',
    `HTTP ${bulk.status} linked=${bulk.body?.linked}`,
  );

  const reverse = await call(`/api/v1/apps/${SLUG}/links/planner_host/host-1`, { token: KEY });
  check(reverse.status === 200, 'reverse lookup resolves the org link', `HTTP ${reverse.status}`);

  const personId = linkPerson.body.platform_id;

  // ---- 5 + 6. Activity, and the refusal ----------------------------------
  step(5, 'Emit an activity onto the workspace timeline');

  const deniedActivity = await call('/api/v1/activities', {
    method: 'POST',
    token: KEY,
    body: { person_id: personId, type: 'fot_planner_plan_created', subject: 'Plan created' },
  });
  check(
    deniedActivity.status === 403,
    'the key WITHOUT write:activities is refused',
    `HTTP ${deniedActivity.status}`,
  );

  const mint2 = await call(`/api/v1/apps/${SLUG}/keys`, {
    method: 'POST',
    body: { name: 'verification-writer', scopes: ['write:activities'] },
    token: jwt,
    appId: 'fibre-platform',
  });
  const WRITER = mint2.body?.token;
  check(!!WRITER, 'a second key with write:activities mints', `HTTP ${mint2.status}`);

  const act = await call('/api/v1/activities', {
    method: 'POST',
    token: WRITER,
    body: { person_id: personId, type: 'fot_planner_plan_created', subject: 'Plan created' },
  });
  check(act.status === 201, 'activity lands on the timeline', `HTTP ${act.status}`);

  const typo = await call('/api/v1/activities', {
    method: 'POST',
    token: WRITER,
    body: { person_id: personId, type: 'fot_planner_plan_creatd', subject: 'Typo' },
  });
  check(
    typo.status === 400,
    'an undeclared activity type is refused, not silently written',
    `HTTP ${typo.status}`,
  );

  step(6, 'Be refused when it asks for something outside its scopes');

  const notReachable = await call('/api/v1/persons', { token: WRITER });
  check(
    notReachable.status === 403,
    'a general platform route is not reachable with an app key at all',
    `HTTP ${notReachable.status}`,
  );

  const wrongApp = await call('/api/v1/apps/fibre-meet/links/x/y', { token: WRITER });
  check(
    wrongApp.status === 403,
    'a key cannot act as another app',
    `HTTP ${wrongApp.status}`,
  );

  const suspend = await call(`/api/v1/apps/${SLUG}`, {
    method: 'PATCH',
    body: { action: 'suspend' },
    token: jwt,
    appId: 'fibre-platform',
  });
  check(suspend.status === 200, 'admin suspends the app');

  const afterSuspend = await call('/api/v1/apps/whoami', { token: WRITER });
  check(
    afterSuspend.status === 401,
    'suspension kills its keys immediately',
    `HTTP ${afterSuspend.status}`,
  );

  await cleanup();
  console.log(
    failures === 0
      ? '\nAll six steps pass. An external app can register, be approved, hold a scoped key, link both entity kinds, write activity, and be refused.'
      : `\n${failures} check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('\nFAILED:', e.message);
  await cleanup().catch(() => {});
  process.exit(1);
});
