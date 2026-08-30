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
// WARNING — THIS WRITES TO A REAL WORKSPACE. There is one Supabase project, so
// "local" only ever describes the API process; the database is always the
// shared one. The script creates a throwaway app, four persons, one
// organisation and one activity, then removes them. Two things it CANNOT fully
// remove, by design:
//
//   * `activity` is append-only at the DB layer, so its one activity row stays
//     forever. That row pins its person, which is therefore SOFT deleted (the
//     platform's own mechanism for personal data) rather than dropped.
//   * the app row is pinned by that same activity, so it is left `suspended` —
//     inert, and invisible to non-super-admins.
//
// Everything else is hard-deleted; nothing test-shaped stays visible in the
// UI. Run it knowing that, not by accident — hence the opt-in.
//
// Usage:
//   FIBRE_VERIFY_CONFIRM=1 node scripts/verify-external-app.mjs
//   FIBRE_VERIFY_CONFIRM=1 FIBRE_API=https://thefibre-api.fly.dev node scripts/verify-external-app.mjs
//
// The admin steps need a real user session. Rather than asking you to paste a
// JWT, the script mints one for the super admin via the Supabase admin API —
// same token the browser would carry, custom claims and all.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

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

// Values nobody would ship, so a half-finished run leaves nothing confusing —
// and so cleanup can find every row this script created.
const SLUG = 'verify-external-app';
const PERSON_PREFIX = 'verify-organiser';
const FIXTURE_ORGANISER_SLUG = 'verify-external-app-organiser';
const FIXTURE_THREAD_SLUG = 'verify-external-app-festival';
const ORG_DOMAIN = 'verify-host.example';
const FLOW_KEY = 'verify-external-app-flow';

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('Missing Supabase keys in apps/api/.env');
  process.exit(1);
}

if (process.env.FIBRE_VERIFY_CONFIRM !== '1') {
  console.error(
    'This script writes a throwaway app, 4 persons, 1 organisation and 1 activity\n' +
      'into the real workspace, then cleans up (see the header for the two rows it\n' +
      'cannot remove — activity is append-only). Re-run with:\n\n' +
      '  FIBRE_VERIFY_CONFIRM=1 node scripts/verify-external-app.mjs\n',
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
const step = (n, label) => console.log(`\n── ${n}. ${label}`);
// ---------------------------------------------------------------------------
// The published shape.
//
// Everything under /api/v1/apps/* is a contract apps outside this repository
// are written against, so a response key that has shipped is permanent. These
// lists are that promise, written down: adding to one is fine, removing from
// one means somebody's integration just broke.
//
// See the CONTRACT block at the top of apps/api/src/routes/app-flow.ts.
// ---------------------------------------------------------------------------
const CONTRACT_SHAPES = {
  whoami: ['auth', 'app_slug', 'workspace_id', 'scopes'],
  link: ['platform_entity', 'platform_id', 'action'],
  flowListItem: ['id', 'name', 'description', 'lifecycle', 'progression', 'system_key', 'current_version_id'],
  flowShape: ['id', 'name', 'description', 'lifecycle', 'progression', 'system_key', 'version_id', 'steps'],
  flowShapeStep: [
    'key', 'name', 'description', 'kind', 'ordinal', 'default_tasks',
    'group_key', 'group_label', 'meta',
  ],
  runCreated: ['id', 'created'],
  run: [
    'id', 'flow_id', 'person_id', 'organisation_id', 'subject_label', 'source_ref',
    'status', 'entered_at', 'current_step_key', 'steps', 'unfiled_tasks',
  ],
  runStep: [
    'key', 'name', 'description', 'kind', 'ordinal', 'tasks', 'note', 'status',
    'group_key', 'group_label', 'meta',
  ],
  task: ['id', 'title', 'description', 'status', 'due_at', 'completed_at'],
  taskCreated: ['id', 'step_key'],
  note: ['step_key', 'body', 'updated_at'],
  move: ['ok', 'step_key'],
  thread: [
    'id', 'program_id', 'slug', 'title', 'format', 'status', 'starts_on', 'ends_on',
    'intention', 'timezone', 'cover_url', 'is_public_listed', 'requires_approval',
    'price_cents', 'price_currency', 'capacity', 'source_ref', 'organiser',
    'created_at', 'updated_at',
  ],
  enrolment: [
    'id', 'enrolment_id', 'person_id', 'full_name', 'email', 'status',
    'progress_pct', 'enrolled_at', 'completed_at', 'payment_status', 'registered_at',
    'awaiting_approval',
  ],
  engagement: [
    'id', 'source_ref', 'type', 'status', 'title', 'description', 'content',
    'starts_at', 'ends_at', 'daily_schedule', 'location', 'location_url',
    'meeting_url', 'meeting_provider',
    'scheduled_at', 'trigger_kind', 'trigger_anchor', 'trigger_engagement_id',
    'trigger_offset_days', 'trigger_time', 'position', 'show_in_agenda',
    'created_at', 'updated_at',
  ],
};

/**
 * Fields that must NEVER appear on an app-facing response. The other shape
 * checks assert presence; this asserts ABSENCE, which is the only way a
 * `select('*')` regression gets caught — every other check would still pass.
 */
const WALLED_OFF = [
  'answers',              // whatever the organiser asked on the registration form
  // Per-person delivery: who received which message, when. One step from
  // `answers` in kind. An app writes what should go out; it never learns who
  // got it. See docs/brief-thread-engagements-from-apps.md §6.
  'thread_message_send',
  'sends',
  'sent_at',
  'recipients',
  'amount_cents',
  'coupon_id',
  'stripe_session_id',
  'stripe_payment_intent',
];

function checkWall(label, obj) {
  if (!obj || typeof obj !== 'object') {
    check(false, `${label} — nothing to check the wall against`, String(obj));
    return;
  }
  const leaked = WALLED_OFF.filter((k) => k in obj);
  check(
    leaked.length === 0,
    `${label} carries none of the walled-off fields`,
    leaked.length ? `LEAKED ${leaked.join(', ')}` : `${WALLED_OFF.length} checked`,
  );
}

/** Every key the contract promises is still present. Extra keys are fine. */
function checkShape(label, obj, keys) {
  if (!obj || typeof obj !== 'object') {
    check(false, `${label} keeps its published keys`, `got ${obj === null ? 'null' : typeof obj}`);
    return;
  }
  const missing = keys.filter((k) => !(k in obj));
  check(
    missing.length === 0,
    `${label} keeps its published keys`,
    missing.length ? `MISSING ${missing.join(', ')}` : `${keys.length} keys`,
  );
}

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
//
// Order matters, and so does reporting. An earlier version swallowed the errors
// here and quietly left four fake contacts and an organisation sitting in the
// real workspace. Anything that can't be removed is now printed.
async function cleanup({ quiet = true, resetForRerun = false } = {}) {
  const note = (label, error) => {
    if (error && !quiet) console.log(`   ! could not remove ${label}: ${error.message}`);
  };

  const { data: app } = await db.from('app').select('id').eq('slug', SLUG).maybeSingle();

  if (app) {
    // app_membership first — activating an app auto-grants one, and its FK is
    // what silently blocked the app row from being deleted.
    note('app_membership', (await db.from('app_membership').delete().eq('app_id', app.id)).error);
    note('app_key', (await db.from('app_key').delete().eq('app_id', app.id)).error);
    note('app_record_link', (await db.from('app_record_link').delete().eq('app_id', app.id)).error);
    note('app_entity_mapping', (await db.from('app_entity_mapping').delete().eq('app_id', app.id)).error);
    note('workspace_app', (await db.from('workspace_app').delete().eq('app_id', app.id)).error);
  }

  // The Thread fixtures. Before the person loop, because the enrolment rows
  // reference the registrant.
  const { data: fxPrograms } = await db
    .from('program')
    .select('id')
    .eq('source_app', SLUG);
  for (const prog of fxPrograms ?? []) {
    const { data: threads } = await db
      .from('thread_thread')
      .select('id')
      .eq('program_id', prog.id);
    for (const t of threads ?? []) {
      note('thread_enrolment', (await db.from('thread_enrolment').delete().eq('thread_id', t.id)).error);
      note('thread_thread', (await db.from('thread_thread').delete().eq('id', t.id)).error);
    }
    note('enrolment', (await db.from('enrolment').delete().eq('program_id', prog.id)).error);
    note('program', (await db.from('program').delete().eq('id', prog.id)).error);
  }
  // Only ever a row this script created — a real organiser profile has a
  // different slug and is never touched.
  note(
    'thread_organiser',
    (await db.from('thread_organiser').delete().eq('slug', FIXTURE_ORGANISER_SLUG)).error,
  );

  // A person with no activity can be dropped outright; one pinned by an
  // append-only activity row gets the platform's own treatment for personal
  // data it can't drop — a soft delete.
  const { data: people } = await db
    .from('person')
    .select('id, email')
    .ilike('email', `${PERSON_PREFIX}%`);
  for (const person of people ?? []) {
    const { data: acts } = await db.from('activity').select('id').eq('person_id', person.id).limit(1);
    if ((acts ?? []).length === 0) {
      note(`person ${person.email}`, (await db.from('person').delete().eq('id', person.id)).error);
    } else {
      const { error } = await db
        .from('person')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', person.id);
      note(`person ${person.email}`, error);
      if (!quiet && !error) {
        console.log(`   · ${person.email} soft-deleted (pinned by an append-only activity row)`);
      }
    }
  }
  note('organisation', (await db.from('organisation').delete().eq('domain', ORG_DOMAIN)).error);

  // On a re-run, revive the soft-deleted person from last time rather than
  // letting the linker create a fresh one. Without this every run stranded one
  // more soft-deleted row: each is pinned by its own append-only activity, so
  // nothing could ever collect them and the count only went up. Reviving caps
  // the residue at exactly one person, however many times this is run.
  //
  // Exactly ONE. Reviving them all makes the linker's .maybeSingle() lookup
  // match many rows, which fails, so it creates yet another — the first
  // version of this fix added a row instead of reusing one.
  if (resetForRerun) {
    const { data: dormant } = await db
      .from('person')
      .select('id')
      .ilike('email', `${PERSON_PREFIX}@example.com`)
      .not('deleted_at', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (dormant) {
      await db.from('person').update({ deleted_at: null }).eq('id', dormant.id);
    }
  }

  // The fixture flow. Runs first: flow_run.flow_id has no ON DELETE CASCADE,
  // so the definition cannot go while a run points at it. Tasks and notes DO
  // cascade from the run, so removing runs takes them with it.
  const { data: fixtureFlow } = await db
    .from('flow_definition')
    .select('id')
    .eq('system_key', FLOW_KEY)
    .maybeSingle();
  if (fixtureFlow) {
    note('flow_run', (await db.from('flow_run').delete().eq('flow_id', fixtureFlow.id)).error);
    note('flow_definition', (await db.from('flow_definition').delete().eq('id', fixtureFlow.id)).error);
  }

  // Last, once nothing else references it. This fails once a run has written
  // its activity row — the FK from an append-only table is permanent.
  //
  // Rather than burning the slug, the row is kept. It is left `suspended`,
  // which is inert and sits under the Suspended tab in /admin/apps rather than
  // cluttering an admin's review queue; the START-of-run cleanup is the one
  // that resets it to `pending` so the next run can walk approve → activate →
  // mint against it for real.
  if (app) {
    const { error } = await db.from('app').delete().eq('id', app.id);
    if (error) {
      await db
        .from('app')
        .update(
          resetForRerun
            ? { status: 'pending', manifest: null, reviewed_at: null, reviewed_by: null }
            : { status: 'suspended' },
        )
        .eq('id', app.id);
      if (!quiet) {
        console.log('   · app row kept (pinned by its append-only activity row), left `suspended`');
      }
    }
  }
}

async function main() {
  console.log(`API: ${API}`);
  await cleanup({ resetForRerun: true });

  const jwt = await adminSession();
  const me = await call('/api/v1/auth/me', { token: jwt, appId: 'fibre-platform' });
  if (me.status !== 200) throw new Error(`/auth/me returned ${me.status}`);
  console.log(`Admin: ${ADMIN_EMAIL} (super admin: ${!!me.body.user.is_super_admin})`);
  const MY_USER_ID = me.body.user.id;
  const MY_WORKSPACE_ID = me.body.user.workspace_id;

  // ---- 1. Register + approve ---------------------------------------------
  step(1, 'Register itself and be approved by an admin');

  const manifest = {
    app_slug: SLUG,
    app_name: 'External App Verification',
    scopes_requested: [
      'read:persons',
      'write:persons',
      'write:organisations',
      'write:activities',
      'read:flows',
      'write:flow_runs',
      'read:programs',
      'write:programs',
      'read:enrolments',
      'write:messages',
      'review:enrolments',
    ],
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
  // 201 on a first run; a previous run's row survives pinned to its activity
  // and is reset to `pending`, in which case registration is idempotent.
  check(
    reg.status === 201 || (reg.status === 200 && reg.body?.already_registered),
    'registers with no credential',
    `HTTP ${reg.status}`,
  );

  // A re-registration returns the old row untouched, so make sure the manifest
  // under test is the one actually stored before anything reads it back.
  await db.from('app').update({ manifest }).eq('slug', SLUG);

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
      match_on: { email: `${PERSON_PREFIX}@example.com`, name: 'Verify Organiser' },
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
      match_on: { domain: ORG_DOMAIN, name: 'Verify Host Org' },
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
        match_on: { email: `${PERSON_PREFIX}-${n}@example.com`, name: `Verify Organiser ${n}` },
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

  // ---- 7. Run a flow it does not own -------------------------------------
  step(7, 'Own runs on a Flow it did not author');

  // A workspace flow, published, three steps — the shape a companion app
  // consumes. Seeded service-side: authoring is exactly what an app key may
  // NOT do, so the fixture cannot come through the API under test.
  const { data: fx } = await db
    .from('flow_definition')
    .insert({
      workspace_id: MY_WORKSPACE_ID,
      name: 'Verification flow',
      scope: 'workspace',
      owner_user_id: MY_USER_ID,
      created_by: MY_USER_ID,
      lifecycle: 'active',
      // Self-paced: all steps open, all tasks present at creation, no due
      // dates. The shape a companion app needs.
      progression: 'open',
      system_key: FLOW_KEY,
    })
    .select('id')
    .single();
  const { data: fxVersion } = await db
    .from('flow_version')
    .insert({ flow_id: fx.id, version_number: 1, published_at: new Date().toISOString(), created_by: MY_USER_ID })
    .select('id')
    .single();
  await db.from('flow_definition').update({ current_version_id: fxVersion.id }).eq('id', fx.id);
  const { data: fxSteps } = await db
    .from('flow_step')
    .insert([
      // group_* and meta exercise the v0.17.0 columns: a section two steps
      // share, and the app-defined fields the platform must hand back verbatim.
      {
        flow_version_id: fxVersion.id, key: 'listen', name: 'Listen', kind: 'entry', ordinal: 0,
        group_key: 'orientation', group_label: 'Orientation',
        meta: { purpose: 'Hear what is already there', trap: 'Talking first' },
      },
      {
        flow_version_id: fxVersion.id, key: 'gather', name: 'Gather', kind: 'normal', ordinal: 1,
        group_key: 'orientation', group_label: 'Orientation',
      },
      { flow_version_id: fxVersion.id, key: 'grow', name: 'Grow', kind: 'end_positive', ordinal: 2 },
    ])
    .select('id, key');
  const listenId = fxSteps.find((s) => s.key === 'listen').id;
  const gatherId = fxSteps.find((s) => s.key === 'gather').id;
  await db.from('flow_step_default_task').insert([
    { step_id: listenId, title: 'Talk to three people', actor_type: 'personal', ordinal: 0 },
    { step_id: listenId, title: 'Write down what you heard', actor_type: 'personal', ordinal: 1 },
    // due_days_after_entry is set deliberately: an open flow must ignore it.
    { step_id: gatherId, title: 'Invite the core group', actor_type: 'personal', due_days_after_entry: 7, ordinal: 0 },
  ]);

  const mint3 = await call(`/api/v1/apps/${SLUG}/keys`, {
    method: 'POST',
    body: { name: 'verification-flow', scopes: ['read:flows', 'write:flow_runs'] },
    token: jwt,
    appId: 'fibre-platform',
  });
  const FLOWKEY = mint3.body?.token;
  check(!!FLOWKEY, 'a key with the flow scopes mints', `HTTP ${mint3.status}`);

  const flowList = await call(`/api/v1/apps/${SLUG}/flow/flows`, { token: FLOWKEY });
  check(
    flowList.status === 200 && (flowList.body.flows ?? []).some((f) => f.id === fx.id),
    'it can list the workspace flows it may consume',
    `HTTP ${flowList.status}`,
  );

  const shape = await call(`/api/v1/apps/${SLUG}/flow/flows/${fx.id}`, { token: FLOWKEY });
  check(
    shape.status === 200 && shape.body.steps?.length === 3 && shape.body.steps[0].default_tasks?.length === 2,
    'and read its published shape — steps in order, with their task templates',
    `HTTP ${shape.status}`,
  );

  const shapeListen = (shape.body?.steps ?? []).find((s) => s.key === 'listen');
  const shapeGrow = (shape.body?.steps ?? []).find((s) => s.key === 'grow');
  check(
    shapeListen?.group_key === 'orientation' && shapeListen?.group_label === 'Orientation',
    'a step carries its section',
    `${shapeListen?.group_key}/${shapeListen?.group_label}`,
  );
  check(
    shapeGrow?.group_key === null,
    'an ungrouped step reports null, not a guess',
    String(shapeGrow?.group_key),
  );
  check(
    shapeListen?.meta?.purpose === 'Hear what is already there' &&
      shapeListen?.meta?.trap === 'Talking first',
    'app-defined step fields come back verbatim',
    JSON.stringify(shapeListen?.meta),
  );
  check(
    shapeGrow?.meta && Object.keys(shapeGrow.meta).length === 0,
    'a step with no app fields reports {}, so callers need no guard',
    JSON.stringify(shapeGrow?.meta),
  );

  const noAuthoring = await call(`/api/v1/flow/flows/${fx.id}`, { token: FLOWKEY });
  check(
    noAuthoring.status === 403,
    'Flow’s own authoring routes stay closed to it',
    `HTTP ${noAuthoring.status}`,
  );

  const SOURCE_REF = randomUUID();
  const startRun = await call(`/api/v1/apps/${SLUG}/flow/flows/${fx.id}/runs`, {
    method: 'POST',
    token: FLOWKEY,
    body: { subject_label: 'Festival of Trust — Athens', source_ref: SOURCE_REF },
  });
  check(startRun.status === 201 && !!startRun.body.id, 'a run starts with no person behind it', `HTTP ${startRun.status}`);
  const RUN = startRun.body.id;

  const rerun = await call(`/api/v1/apps/${SLUG}/flow/flows/${fx.id}/runs`, {
    method: 'POST',
    token: FLOWKEY,
    body: { subject_label: 'Festival of Trust — Athens', source_ref: SOURCE_REF },
  });
  check(
    rerun.body?.created === false && rerun.body?.id === RUN,
    'the same source_ref returns the same run — creating is safe to retry',
    `HTTP ${rerun.status}`,
  );

  const readRun = await call(`/api/v1/apps/${SLUG}/flow/runs/${RUN}`, { token: FLOWKEY });
  const listen = readRun.body?.steps?.find((s) => s.key === 'listen');
  const gather = readRun.body?.steps?.find((s) => s.key === 'gather');
  check(
    readRun.status === 200 && listen?.tasks?.length === 2 && listen.status === 'not_started',
    'the run reads back as steps with their own tasks and status',
    `HTTP ${readRun.status}`,
  );
  check(
    gather?.tasks?.length === 1,
    'a step the run never visited already has its tasks — self-paced seeds the whole sequence',
    `${gather?.tasks?.length ?? 0} task(s) on step 2`,
  );
  check(
    readRun.body?.steps?.every((s) => s.tasks.every((t) => t.due_at === null)),
    'and nothing carries a due date, so nothing can ever be overdue',
  );

  const doneOne = await call(`/api/v1/apps/${SLUG}/flow/tasks/${listen.tasks[0].id}`, {
    method: 'PATCH',
    token: FLOWKEY,
    body: { status: 'done' },
  });
  check(doneOne.status === 200, 'a task can be checked off', `HTTP ${doneOne.status}`);

  const afterCheck = await call(`/api/v1/apps/${SLUG}/flow/runs/${RUN}`, { token: FLOWKEY });
  check(
    afterCheck.body?.steps?.find((s) => s.key === 'listen')?.status === 'in_progress',
    'and the step turns in_progress — status is task counts, not the cursor',
  );

  const ownTask = await call(`/api/v1/apps/${SLUG}/flow/runs/${RUN}/tasks`, {
    method: 'POST',
    token: FLOWKEY,
    body: { title: 'Book the room', step_key: 'gather' },
  });
  check(ownTask.status === 201, 'it can add a task of its own to a step', `HTTP ${ownTask.status}`);

  const afterAdd = await call(`/api/v1/apps/${SLUG}/flow/runs/${RUN}`, { token: FLOWKEY });
  check(
    afterAdd.body?.steps?.find((s) => s.key === 'gather')?.tasks?.length === 2 &&
      (afterAdd.body?.unfiled_tasks ?? []).length === 0,
    'and it lands filed under that step, not adrift',
    `${(afterAdd.body?.unfiled_tasks ?? []).length} unfiled`,
  );

  const runListen = (afterAdd.body?.steps ?? []).find((s) => s.key === 'listen');
  check(
    runListen?.group_key === 'orientation' && runListen?.meta?.trap === 'Talking first',
    'the run shape carries section + app fields too (the call a planner renders)',
    `${runListen?.group_key} / ${JSON.stringify(runListen?.meta)}`,
  );

  const jump = await call(`/api/v1/apps/${SLUG}/flow/runs/${RUN}/move`, {
    method: 'POST',
    token: FLOWKEY,
    body: { step_key: 'grow' },
  });
  check(jump.status === 200, 'it can jump to the last step with nothing done — no gate, no lock', `HTTP ${jump.status}`);

  const putNote = await call(`/api/v1/apps/${SLUG}/flow/runs/${RUN}/steps/listen/note`, {
    method: 'PUT',
    token: FLOWKEY,
    body: { body: 'Who is missing from this conversation?' },
  });
  check(putNote.status === 201 || putNote.status === 200, 'a reflection note saves', `HTTP ${putNote.status}`);

  const rewrite = await call(`/api/v1/apps/${SLUG}/flow/runs/${RUN}/steps/listen/note`, {
    method: 'PUT',
    token: FLOWKEY,
    body: { body: 'Rewritten.' },
  });
  const getNote = await call(`/api/v1/apps/${SLUG}/flow/runs/${RUN}/steps/listen/note`, { token: FLOWKEY });
  check(
    rewrite.status === 200 && getNote.body?.body === 'Rewritten.',
    'and rewrites in place rather than appending',
    getNote.body?.body,
  );

  const foreignRun = await call(`/api/v1/apps/${SLUG}/flow/runs/${RUN}`, { token: WRITER });
  check(
    foreignRun.status === 403,
    'a key without read:flows cannot reach the run at all',
    `HTTP ${foreignRun.status}`,
  );

  // ---- 7b. The shape itself ----------------------------------------------
  step('7b', 'Keep the shape apps are written against');

  checkShape('whoami', whoami.body, CONTRACT_SHAPES.whoami);
  checkShape('POST /links', linkPerson.body, CONTRACT_SHAPES.link);
  checkShape('flow list item', flowList.body?.flows?.[0], CONTRACT_SHAPES.flowListItem);
  checkShape('flow shape', shape.body, CONTRACT_SHAPES.flowShape);
  checkShape('flow shape step', shape.body?.steps?.[0], CONTRACT_SHAPES.flowShapeStep);
  checkShape('run created', startRun.body, CONTRACT_SHAPES.runCreated);
  checkShape('run', afterAdd.body, CONTRACT_SHAPES.run);
  checkShape('run step', afterAdd.body?.steps?.[0], CONTRACT_SHAPES.runStep);
  checkShape('task', afterAdd.body?.steps?.[0]?.tasks?.[0], CONTRACT_SHAPES.task);
  checkShape('task created', ownTask.body, CONTRACT_SHAPES.taskCreated);
  checkShape('note', getNote.body, CONTRACT_SHAPES.note);
  checkShape('move', jump.body, CONTRACT_SHAPES.move);

  // ---- 7c. The Thread -----------------------------------------------------
  step('7c', 'Publish a programme and read its registrations');

  // The organiser has to be a real person with a Fibre account AND a Thread
  // organiser profile. Use the admin's own, creating the profile only if it
  // isn't there (and remembering, so cleanup doesn't delete someone's real one).
  const { data: myUser } = await db
    .from('user')
    .select('id, person_id, workspace_id')
    .eq('id', MY_USER_ID)
    .single();
  let { data: myOrganiser } = await db
    .from('thread_organiser')
    .select('id')
    .eq('user_id', MY_USER_ID)
    .maybeSingle();
  if (!myOrganiser) {
    const { data: made } = await db
      .from('thread_organiser')
      .insert({ user_id: MY_USER_ID, workspace_id: myUser.workspace_id, slug: FIXTURE_ORGANISER_SLUG })
      .select('id')
      .single();
    myOrganiser = made;
  }

  const mint4 = await call(`/api/v1/apps/${SLUG}/keys`, {
    method: 'POST',
    body: { name: 'verification-thread', scopes: ['write:programs', 'read:programs', 'read:enrolments', 'write:messages', 'review:enrolments'] },
    token: jwt,
    appId: 'fibre-platform',
  });
  const THREADKEY = mint4.body?.token;
  check(!!THREADKEY, 'a key with the Thread scopes mints', `HTTP ${mint4.status}`);

  const planRef = randomUUID();
  const publish = await call(`/api/v1/apps/${SLUG}/thread/threads`, {
    method: 'POST',
    token: THREADKEY,
    body: {
      title: 'Festival of Trust — Verification',
      format: 'event',
      slug: FIXTURE_THREAD_SLUG,
      organiser_person_id: myUser.person_id,
      source_ref: planRef,
      starts_on: '2026-11-02',
      ends_on: '2026-11-04',
    },
  });
  check(
    publish.status === 201 && publish.body?.created === true,
    'it publishes a programme as a public page',
    `HTTP ${publish.status} ${publish.body?.error ?? ''}`,
  );
  const THREAD_ID = publish.body?.id;

  const republish = await call(`/api/v1/apps/${SLUG}/thread/threads`, {
    method: 'POST',
    token: THREADKEY,
    body: {
      title: 'Festival of Trust — Verification',
      format: 'event',
      slug: FIXTURE_THREAD_SLUG,
      organiser_person_id: myUser.person_id,
      source_ref: planRef,
    },
  });
  check(
    republish.status === 200 && republish.body?.created === false && republish.body?.id === THREAD_ID,
    'the same source_ref returns the same page — publishing is safe to retry',
    `HTTP ${republish.status}`,
  );

  const patched = await call(`/api/v1/apps/${SLUG}/thread/threads/${THREAD_ID}`, {
    method: 'PATCH',
    token: THREADKEY,
    body: { intention: 'A festival of trust, verified.', capacity: 40, status: 'active' },
  });
  check(
    patched.status === 200 && patched.body?.intention === 'A festival of trust, verified.' &&
      patched.body?.capacity === 40 && patched.body?.status === 'active',
    'it edits the page as the plan firms up — across programme AND storefront',
    `HTTP ${patched.status}`,
  );

  // ---- Templates ---------------------------------------------------------
  // The organiser picks a structure in the app that owns the festival, so the
  // app must be able to see what is on offer and build from one.
  const templates = await call(`/api/v1/apps/${SLUG}/thread/templates`, { token: THREADKEY });
  check(
    templates.status === 200 && Array.isArray(templates.body?.templates),
    'it can see the structures a festival can be built from',
    `HTTP ${templates.status}`,
  );

  // A template carrying messages must not be a way around write:messages.
  // Planted service-side: authoring templates is not something a key may do.
  const { data: tplRow } = await db
    .from('thread_template')
    .insert({
      workspace_id: MY_WORKSPACE_ID,
      title: 'verify-template-with-messages',
      scope: 'workspace',
      structure: {
        format: 'event',
        engagements: [
          { title: 'Welcome', type: 'message', trigger_kind: 'on_enrolment', content: { body: 'hi' } },
        ],
      },
    })
    .select('id')
    .single();

  if (tplRow) {
    const viaTemplate = await call(`/api/v1/apps/${SLUG}/thread/threads`, {
      method: 'POST',
      token: WRITER, // write:persons etc, but NOT write:messages
      body: { title: 'Sneak', format: 'event', slug: `verify-sneak-${Date.now()}`, template_id: tplRow.id },
    });
    check(
      viaTemplate.status === 403,
      'a template full of messages is not a way around write:messages',
      `HTTP ${viaTemplate.status}`,
    );

    const built = await call(`/api/v1/apps/${SLUG}/thread/threads`, {
      method: 'POST',
      token: THREADKEY,
      body: {
        title: 'Built from a template',
        format: 'event',
        slug: `verify-tpl-${Date.now()}`,
        starts_on: '2026-10-01',
        template_id: tplRow.id,
      },
    });
    check(built.status === 201, 'it builds a festival from a chosen structure', `HTTP ${built.status}`);

    if (built.body?.id) {
      const seeded = await call(
        `/api/v1/apps/${SLUG}/thread/threads/${built.body.id}/engagements`,
        { token: THREADKEY },
      );
      check(
        seeded.body?.engagements?.length === 1 && seeded.body.engagements[0].title === 'Welcome',
        "and the template's items come with it",
        `${seeded.body?.engagements?.length ?? 0} item(s)`,
      );
      await db.from('thread_engagement').delete().eq('thread_id', built.body.id);
      const { data: bt } = await db.from('thread_thread').select('program_id').eq('id', built.body.id).maybeSingle();
      await db.from('thread_thread').delete().eq('id', built.body.id);
      if (bt) await db.from('program').delete().eq('id', bt.program_id);
    }
    await db.from('thread_template').delete().eq('id', tplRow.id);
  }

  // ---- The messages around it -------------------------------------------
  // An app that can publish an event and not write a word to the people who
  // sign up is the gap docs/brief-thread-engagements-from-apps.md closes.
  const engagement = await call(`/api/v1/apps/${SLUG}/thread/threads/${THREAD_ID}/engagements`, {
    method: 'POST',
    token: THREADKEY,
    body: {
      source_ref: randomUUID(),
      type: 'message',
      title: 'Welcome',
      status: 'draft',
      trigger_kind: 'on_enrolment',
      content: { body: 'Welcome to the festival.' },
    },
  });
  check(
    engagement.status === 201 && engagement.body?.created === true,
    'it writes a message into its own thread',
    `HTTP ${engagement.status}`,
  );

  // Delivery data is per-person and stays behind the wall. This is the check
  // that catches a select('*') regression — every other assertion would pass.
  checkWall('the engagement response', engagement.body);

  const engagementAgain = await call(
    `/api/v1/apps/${SLUG}/thread/threads/${THREAD_ID}/engagements`,
    { method: 'GET', token: THREADKEY },
  );
  check(
    engagementAgain.status === 200 && Array.isArray(engagementAgain.body?.engagements),
    'it reads the sequence back',
    `HTTP ${engagementAgain.status}`,
  );
  if (engagementAgain.body?.engagements?.[0]) {
    checkWall('an engagement in the list', engagementAgain.body.engagements[0]);
  }

  const ENG_ID = engagement.body?.id;

  const engPatch = await call(`/api/v1/apps/${SLUG}/thread/engagements/${ENG_ID}`, {
    method: 'PATCH',
    token: THREADKEY,
    body: { title: 'Welcome, revised' },
  });
  check(
    engPatch.status === 200 && engPatch.body?.title === 'Welcome, revised',
    'it re-words a message that has not gone out yet',
    `HTTP ${engPatch.status}`,
  );
  checkWall('the patched engagement', engPatch.body);

  // Ownership is one level down: the engagement resolves to its thread, and
  // the thread must belong to the calling app. A key for a different app on the
  // same workspace must not reach it.
  const engWrongApp = await call(`/api/v1/apps/${SLUG}/thread/engagements/${ENG_ID}`, {
    method: 'PATCH',
    token: WRITER,
    body: { title: 'not yours' },
  });
  check(
    engWrongApp.status === 403,
    'a key without write:messages cannot re-word one either',
    `HTTP ${engWrongApp.status}`,
  );

  const engDelete = await call(`/api/v1/apps/${SLUG}/thread/engagements/${ENG_ID}`, {
    method: 'DELETE',
    token: THREADKEY,
  });
  check(
    engDelete.status === 204,
    'it deletes a message that has not gone out yet',
    `HTTP ${engDelete.status}`,
  );

  // The scope that matters: without write:messages, no app can cause an email
  // to reach a human. THREADKEY has it; the plain writer key does not.
  const noMessages = await call(
    `/api/v1/apps/${SLUG}/thread/threads/${THREAD_ID}/engagements`,
    { method: 'POST', token: WRITER, body: { source_ref: randomUUID(), type: 'message', title: 'x' } },
  );
  check(
    noMessages.status === 403,
    'a key without write:messages cannot write one',
    `HTTP ${noMessages.status}`,
  );

  // The agenda is a different thing from the post. An agenda item cannot email
  // anybody, so it rides on write:programs — and the split has to hold in BOTH
  // directions or the new scope was pointless.
  const agendaItem = await call(
    `/api/v1/apps/${SLUG}/thread/threads/${THREAD_ID}/engagements`,
    {
      method: 'POST',
      token: THREADKEY,
      body: {
        source_ref: randomUUID(),
        type: 'event',
        title: 'Opening ceremony',
        starts_at: '2026-11-02T09:00:00Z',
        ends_at: '2026-11-02T10:00:00Z',
        location: 'Main hall',
      },
    },
  );
  check(
    agendaItem.status === 201 && agendaItem.body?.type === 'event',
    'it writes an agenda item — The Thread owns the agenda, the app edits it',
    `HTTP ${agendaItem.status} ${agendaItem.status !== 201 ? JSON.stringify(agendaItem.body).slice(0, 100) : ''}`,
  );

  // The window rule still bites: an agenda item outside the event's own dates
  // is refused. That is why the dated version of the check above failed.
  const outside = await call(
    `/api/v1/apps/${SLUG}/thread/threads/${THREAD_ID}/engagements`,
    {
      method: 'POST',
      token: THREADKEY,
      body: {
        source_ref: randomUUID(),
        type: 'event',
        title: 'Long after everyone went home',
        starts_at: '2030-01-01T09:00:00Z',
        ends_at: '2030-01-01T10:00:00Z',
      },
    },
  );
  check(outside.status === 400, 'an agenda item outside the event dates is refused', `HTTP ${outside.status}`);
  checkWall('the agenda item', agendaItem.body);
  checkShape('engagement', agendaItem.body, CONTRACT_SHAPES.engagement);

  // The agenda round-trips: what the app laid down — timing and place
  // included — comes back through the list read. This is the door the
  // planner's agenda migration walks through (site writes sessions here,
  // renders its public agenda from here).
  const engList = await call(`/api/v1/apps/${SLUG}/thread/threads/${THREAD_ID}/engagements`, {
    token: THREADKEY,
  });
  const listedItem = (engList.body?.engagements ?? []).find(
    (e) => e.id === agendaItem.body?.id,
  );
  check(
    engList.status === 200 &&
      listedItem?.starts_at === '2026-11-02T09:00:00+00:00' &&
      listedItem?.location === 'Main hall',
    'the agenda item reads back with its timing and place',
    `${listedItem?.starts_at ?? 'missing'} @ ${listedItem?.location ?? 'missing'}`,
  );

  if (agendaItem.body?.id) {
    const retype = await call(`/api/v1/apps/${SLUG}/thread/engagements/${agendaItem.body.id}`, {
      method: 'PATCH',
      token: THREADKEY,
      body: { type: 'message' },
    });
    check(
      retype.status === 400,
      'an agenda item cannot be retyped into a message',
      `HTTP ${retype.status}`,
    );
    await call(`/api/v1/apps/${SLUG}/thread/engagements/${agendaItem.body.id}`, {
      method: 'DELETE',
      token: THREADKEY,
    });
  }

  // A registration, planted the way the public form would: a platform
  // enrolment with The Thread's commerce and form answers on top. The answers
  // and Stripe fields are exactly what must not come back.
  const { data: fxPerson } = await db
    .from('person')
    .insert({
      workspace_id: myUser.workspace_id,
      email: `${PERSON_PREFIX}-registrant@example.com`,
      first_name: 'Verify',
      last_name: 'Registrant',
    })
    .select('id')
    .single();
  const { data: fxProgramRow } = await db
    .from('program')
    .select('id')
    .eq('source_app', SLUG)
    .eq('source_ref', planRef)
    .single();
  const { data: fxEnrolment } = await db
    .from('enrolment')
    .insert({ program_id: fxProgramRow.id, person_id: fxPerson.id, status: 'enrolled', enrolled_at: new Date(0).toISOString() })
    .select('id')
    .single();
  await db.from('thread_enrolment').insert({
    workspace_id: myUser.workspace_id,
    thread_id: THREAD_ID,
    enrolment_id: fxEnrolment.id,
    person_id: fxPerson.id,
    payment_status: 'paid',
    amount_cents: 4500,
    currency: 'EUR',
    stripe_session_id: 'cs_test_MUST_NOT_LEAK',
    stripe_payment_intent: 'pi_test_MUST_NOT_LEAK',
    answers: { dietary: 'MUST NOT LEAK', why_coming: 'MUST NOT LEAK' },
    request_id: `verify-${planRef}`,
  });

  const enrolments = await call(`/api/v1/apps/${SLUG}/thread/threads/${THREAD_ID}/enrolments`, {
    token: THREADKEY,
  });
  const registrant = enrolments.body?.enrolments?.[0];
  check(
    enrolments.status === 200 && enrolments.body?.enrolments?.length === 1,
    'it sees who registered',
    `HTTP ${enrolments.status}`,
  );
  check(
    registrant?.email === `${PERSON_PREFIX}-registrant@example.com` &&
      registrant?.status === 'enrolled' && registrant?.payment_status === 'paid',
    'with the person and where their registration stands',
    `${registrant?.full_name} / ${registrant?.status} / ${registrant?.payment_status}`,
  );

  // THE assertion. A select('*') regression passes every check above.
  checkWall('the enrolments response', registrant);
  check(
    !JSON.stringify(enrolments.body ?? {}).includes('MUST_NOT_LEAK') &&
      !JSON.stringify(enrolments.body ?? {}).includes('MUST NOT LEAK'),
    'and nothing anywhere in the payload carries the walled values',
  );

  const noWriteEnrolment = await call(`/api/v1/apps/${SLUG}/thread/threads/${THREAD_ID}/enrolments`, {
    method: 'POST',
    token: THREADKEY,
    body: { person_id: fxPerson.id },
  });
  check(
    noWriteEnrolment.status === 403,
    'and it cannot write one — there is no write:enrolments, by design',
    `HTTP ${noWriteEnrolment.status}`,
  );

  // The published shape, asserted here rather than in 7b because 7b runs
  // before this step and these bindings would not exist yet.
  checkShape('thread', patched.body, CONTRACT_SHAPES.thread);
  checkShape('enrolment', registrant, CONTRACT_SHAPES.enrolment);

  // ---- 7d. Review — admit and decline through the key ---------------------
  step('7d', 'Review applications through the key (review:enrolments)');

  // Approval gate on (fixture-planted; the gate is just a thread setting).
  await db.from('thread_thread').update({ requires_approval: true }).eq('id', THREAD_ID);

  // Two applications, the way the public form leaves them on a gated thread:
  // platform enrolment 'invited', nothing paid. Emails stay on the reserved
  // .example TLD — approve attempts a confirmation send, which fails inside
  // its own try/catch and must not fail the run.
  const applicants = [];
  for (const n of [1, 2]) {
    const { data: ap } = await db
      .from('person')
      .insert({
        workspace_id: myUser.workspace_id,
        email: `${PERSON_PREFIX}-applicant${n}@verify-host.example`,
        first_name: 'Verify',
        last_name: `Applicant${n}`,
      })
      .select('id')
      .single();
    const { data: en } = await db
      .from('enrolment')
      .insert({ program_id: fxProgramRow.id, person_id: ap.id, status: 'invited' })
      .select('id')
      .single();
    const { data: teRow } = await db
      .from('thread_enrolment')
      .insert({
        workspace_id: myUser.workspace_id,
        thread_id: THREAD_ID,
        enrolment_id: en.id,
        person_id: ap.id,
        payment_status: 'not_required',
        request_id: `verify-${planRef}-applicant${n}`,
      })
      .select('id')
      .single();
    applicants.push({ teId: teRow.id });
  }

  const withApps = await call(`/api/v1/apps/${SLUG}/thread/threads/${THREAD_ID}/enrolments`, {
    token: THREADKEY,
  });
  const appRows = withApps.body?.enrolments ?? [];
  const waiting = appRows.filter((r) => r.awaiting_approval);
  check(
    waiting.length === 2 &&
      appRows.some((r) => r.status === 'enrolled' && !r.awaiting_approval),
    'awaiting_approval marks exactly the applications, never the enrolled',
    `${waiting.length} waiting of ${appRows.length}`,
  );

  const reviewDenied = await call(
    `/api/v1/apps/${SLUG}/thread/enrolments/${applicants[0].teId}/approve`,
    { method: 'POST', token: FLOWKEY },
  );
  check(
    reviewDenied.status === 403,
    'a key without review:enrolments cannot admit anyone',
    `HTTP ${reviewDenied.status}`,
  );

  const admit = await call(
    `/api/v1/apps/${SLUG}/thread/enrolments/${applicants[0].teId}/approve`,
    { method: 'POST', token: THREADKEY },
  );
  check(
    admit.status === 200 && admit.body?.ok === true,
    'admit flips an application to enrolled',
    `HTTP ${admit.status}`,
  );
  const turnedDown = await call(
    `/api/v1/apps/${SLUG}/thread/enrolments/${applicants[1].teId}/decline`,
    { method: 'POST', token: THREADKEY },
  );
  check(
    turnedDown.status === 200 && turnedDown.body?.ok === true,
    'decline turns one down',
    `HTTP ${turnedDown.status}`,
  );

  const afterReview = await call(`/api/v1/apps/${SLUG}/thread/threads/${THREAD_ID}/enrolments`, {
    token: THREADKEY,
  });
  const reviewById = new Map((afterReview.body?.enrolments ?? []).map((r) => [r.id, r]));
  check(
    reviewById.get(applicants[0].teId)?.status === 'enrolled' &&
      !reviewById.get(applicants[0].teId)?.awaiting_approval,
    'the admitted application reads enrolled',
    String(reviewById.get(applicants[0].teId)?.status),
  );
  check(
    reviewById.get(applicants[1].teId)?.status === 'dropped',
    'the declined application reads dropped',
    String(reviewById.get(applicants[1].teId)?.status),
  );

  const flowKeyOnThread = await call(`/api/v1/apps/${SLUG}/thread/threads`, { token: FLOWKEY });
  check(
    flowKeyOnThread.status === 403,
    'a key without read:programs cannot reach the Thread surface at all',
    `HTTP ${flowKeyOnThread.status}`,
  );

  step(8, 'Lose everything the moment it is suspended');

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

  console.log('\n── cleanup');
  await cleanup({ quiet: false });
  console.log(
    failures === 0
      ? '\nAll steps pass. An external app can register, be approved, hold a scoped key, link both entity kinds, write activity, own runs on a flow it did not author, and be refused — and every response still carries the keys apps are written against.'
      : `\n${failures} check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('\nFAILED:', e.message);
  console.error('Cleaning up what the run created…');
  await cleanup({ quiet: false }).catch(() => {});
  process.exit(1);
});
