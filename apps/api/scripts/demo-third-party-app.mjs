#!/usr/bin/env node
// Cross-app entity mapping — runnable third-party integration demo.
//
// Walks through the four steps from docs/third-party-app-guide.md
// against a live API, simulating a "Mailchimp" connector:
//
//   1. Register the app + entity mapping + membership   (service-role / SQL)
//   2. Read back the manifest                            (HTTP)
//   3. Link three subscribers (2 existing + 1 created)   (HTTP)
//   4. Push activities for each linked subscriber        (HTTP)
//   5. Reverse-lookup the link + full person row         (HTTP)
//
// Idempotent — re-running upserts and doesn't duplicate.
//
// Usage:
//   FIBRE_API=http://localhost:8080 \
//   FIBRE_JWT=<paste a workspace-scoped Supabase JWT here> \
//   node scripts/demo-third-party-app.mjs
//
// How to get a JWT: sign in to the web app locally, open devtools console,
// run `(await (await fetch('/api/auth/session')).json()).session.access_token`
// — or pull it out of the Supabase cookie. The script will tell you which
// workspace the JWT resolved to, so you can sanity-check.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Env ------------------------------------------------------------------

const envPath = resolve(__dirname, '../.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=', 2))
    .filter((p) => p.length === 2),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const API = process.env.FIBRE_API ?? 'http://localhost:8080';
const JWT = process.env.FIBRE_JWT;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/api/.env');
  process.exit(1);
}
if (!JWT) {
  console.error(
    'FIBRE_JWT not set. Sign in to the local web app, grab your access token, and re-run:\n' +
      '  FIBRE_JWT=eyJ... node scripts/demo-third-party-app.mjs',
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const log = (...a) => console.log('·', ...a);
const ok = (...a) => console.log('✓', ...a);
const warn = (...a) => console.warn('⚠', ...a);

// X-App-ID has to be a first-party slug today (see "Open gaps" in the
// third-party guide). We call AS fibre-platform but link records FOR the
// 'mailchimp' app slug in the URL path. Same DB rows, same contract.
const APP_SLUG = 'mailchimp';
const CALLING_APP = 'fibre-platform';

async function fetchJson(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${JWT}`,
      'X-App-ID': CALLING_APP,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

// --- Step 1 — register the app + mapping + membership (service-role) -----

log('Resolving workspace + caller from JWT...');
// Decode the JWT payload to find the workspace + user we're acting as.
const [, payloadB64] = JWT.split('.');
const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
const workspaceId = claims.workspace_id;
const userId = claims.app_user_id;
if (!workspaceId || !userId) {
  console.error('JWT is missing workspace_id / app_user_id claims. Sign out and back in.');
  process.exit(1);
}
log('workspace', workspaceId);
log('user', userId);

log('Registering "Mailchimp" in public.app (idempotent)...');
const { data: existingApp } = await db
  .from('app')
  .select('id, slug, name')
  .eq('slug', APP_SLUG)
  .maybeSingle();

let appId;
if (existingApp) {
  appId = existingApp.id;
  log('app already registered', appId);
} else {
  const { data: created, error } = await db
    .from('app')
    .insert({ slug: APP_SLUG, name: 'Mailchimp', description: 'Newsletter audiences (demo)' })
    .select('id')
    .single();
  if (error) { console.error('app insert failed', error); process.exit(1); }
  appId = created.id;
  ok('app registered', appId);
}

log('Declaring entity mapping: mailchimp_subscriber → person ...');
const { error: mapErr } = await db
  .from('app_entity_mapping')
  .upsert(
    {
      workspace_id: workspaceId,
      app_id: appId,
      app_entity: 'mailchimp_subscriber',
      platform_entity: 'person',
      mapping_kind: 'identity',
      match_on: ['email'],
    },
    { onConflict: 'workspace_id,app_id,app_entity' },
  );
if (mapErr) { warn('mapping upsert', mapErr.message); }

log('Granting the calling user an app_membership for Mailchimp ...');
const { error: memErr } = await db
  .from('app_membership')
  .upsert(
    { workspace_id: workspaceId, user_id: userId, app_id: appId, role: 'owner' },
    { onConflict: 'workspace_id,user_id,app_id' },
  );
if (memErr) { warn('membership upsert', memErr.message); }

// --- Step 2 — read back the manifest (HTTP) ------------------------------

log(`GET /api/v1/apps/${APP_SLUG}/manifest`);
const manifest = await fetchJson('GET', `/api/v1/apps/${APP_SLUG}/manifest`);
ok('manifest:', JSON.stringify(manifest.mappings.map((m) => `${m.app_entity}→${m.platform_entity}`)));

// --- Step 3 — link subscribers (HTTP) ------------------------------------

// Use a couple of seeded EBBF people if present, plus one fresh one to
// exercise create_if_missing. Re-running just upserts.
const SUBSCRIBERS = [
  { id: 'sub_marja_001', email: 'marja.vdb@example.org', name: 'Marja van der Berg' },
  { id: 'sub_daniel_002', email: 'daniel.k@example.gr', name: 'Daniel Konstantinou' },
  { id: 'sub_newcomer_003', email: 'newcomer@example.org', name: 'Pat Newcomer' },
];

const linked = [];
for (const sub of SUBSCRIBERS) {
  log(`POST /api/v1/apps/${APP_SLUG}/links  ${sub.id} (${sub.email})`);
  try {
    const res = await fetchJson('POST', `/api/v1/apps/${APP_SLUG}/links`, {
      app_entity: 'mailchimp_subscriber',
      app_record_id: sub.id,
      match_on: { email: sub.email, name: sub.name },
      create_if_missing: true,
    });
    ok(`  → ${res.action} person ${res.platform_id}`);
    linked.push({ ...sub, platform_id: res.platform_id });
  } catch (e) {
    warn(`  link failed: ${e.message}`);
  }
}

// --- Step 4 — push activities (HTTP) -------------------------------------
//
// /api/v1/activities expects { person_id, type, subject, occurred_at } and
// stamps app_id from X-App-ID. Two known gaps the demo bumps into:
//
//   (a) activity `type` is a hardcoded enum in @thefibre/shared
//       (ACTIVITY_TYPES). A manifest can declare its own types but they
//       aren't merged into the enum yet — so the demo uses an existing
//       value (`consent_granted`) instead of `newsletter_opened`.
//   (b) X-App-ID can only be a first-party slug today, so the event
//       attributes to fibre-platform, not mailchimp.
//
// Both gaps are tracked in docs/third-party-app-guide.md "Open gaps".

for (const sub of linked) {
  log(`POST /api/v1/activities  consent_granted for ${sub.email}`);
  try {
    await fetchJson('POST', `/api/v1/activities`, {
      person_id: sub.platform_id,
      type: 'consent_granted',
      subject: 'Subscribed to newsletter (demo)',
      occurred_at: new Date().toISOString(),
    });
    ok('  activity recorded');
  } catch (e) {
    warn(`  activity failed: ${e.message}`);
  }
}

// --- Step 5 — reverse lookup (HTTP) --------------------------------------

for (const sub of linked) {
  log(`GET /api/v1/apps/${APP_SLUG}/persons/mailchimp_subscriber/${sub.id}`);
  try {
    const person = await fetchJson(
      'GET',
      `/api/v1/apps/${APP_SLUG}/persons/mailchimp_subscriber/${sub.id}`,
    );
    ok(`  ${person.first_name} ${person.last_name} <${person.email}> · id=${person.id}`);
  } catch (e) {
    warn(`  lookup failed: ${e.message}`);
  }
}

console.log('\nDone. Re-run any time — every step is idempotent.');
