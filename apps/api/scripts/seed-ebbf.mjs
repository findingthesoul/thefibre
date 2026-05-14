#!/usr/bin/env node
// Seed realistic sample data for the default workspace.
//
// Worked example from brief §8: EBBF "Reorienting Towards Hope" Athens
// conference, plus a follow-on journey, plus a Fibre Suite working session.
// A handful of people are added, linked to EBBF as members, enrolled in the
// programmes, and have activity events spread across recent weeks.
//
// Idempotent — uses upserts and skip-if-exists so re-running doesn't duplicate.
//
// Usage:
//   node scripts/seed-ebbf.mjs
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in apps/api/.env

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from apps/api/.env (simple parser — just URL + service key).
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
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/api/.env');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const log = (...a) => console.log('·', ...a);
const warn = (...a) => console.warn('⚠', ...a);

// --- Lookup workspace + apps + current platform user ----------------------

const { data: workspaces } = await db.from('workspace').select('id').eq('slug', 'default').limit(1);
const workspaceId = workspaces?.[0]?.id;
if (!workspaceId) {
  console.error('No default workspace found.');
  process.exit(1);
}
log('workspace', workspaceId);

const { data: appRows } = await db.from('app').select('id, slug');
const apps = Object.fromEntries(appRows.map((a) => [a.slug, a.id]));
log('apps', Object.keys(apps).join(', '));

const { data: users } = await db
  .from('user')
  .select('id, email')
  .eq('workspace_id', workspaceId)
  .is('deleted_at', null);
const seederUser = users?.[0];
if (!seederUser) {
  console.error('No platform user in workspace yet — sign in once before seeding.');
  process.exit(1);
}
log('seeder', seederUser.email, seederUser.id);

// --- People ---------------------------------------------------------------

const PEOPLE = [
  { first_name: 'Marja', last_name: 'van der Berg', email: 'marja.vdb@example.org', country: 'NL', city: 'Amsterdam' },
  { first_name: 'Daniel', last_name: 'Konstantinou', email: 'daniel.k@example.gr', country: 'GR', city: 'Athens' },
  { first_name: 'Aisha', last_name: 'Rahman', email: 'aisha.r@example.org', country: 'UK', city: 'London' },
  { first_name: 'Tomáš', last_name: 'Novák', email: 'tomas.n@example.cz', country: 'CZ', city: 'Brno' },
  { first_name: 'Sofia', last_name: 'Mendes', email: 'sofia.m@example.pt', country: 'PT', city: 'Lisbon' },
  { first_name: 'Petra', last_name: 'Hoffmann', email: 'petra.h@example.de', country: 'DE', city: 'Berlin' },
  { first_name: 'Lieve', last_name: 'Janssens', email: 'lieve.j@example.be', country: 'BE', city: 'Antwerp' },
];

const personIds = [];
for (const p of PEOPLE) {
  // Find existing by email or create
  const { data: existing } = await db
    .from('person')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', p.email)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing) {
    personIds.push(existing.id);
    log('person', p.email, '(exists)');
    continue;
  }
  const { data: row, error } = await db
    .from('person')
    .insert({ ...p, workspace_id: workspaceId })
    .select('id')
    .single();
  if (error) { warn('person insert failed', p.email, error.message); continue; }
  personIds.push(row.id);
  log('person', p.email, '(created)');
}

// --- Organisation: EBBF ---------------------------------------------------

const EBBF = {
  name: 'European Bahá\'í Business Forum',
  short_name: 'EBBF',
  domain: 'ebbf.org',
  website: 'https://ebbf.org',
  country: 'CH',
  sector: 'Values-based business',
  org_type: 'ngo',
  size_band: '11-50',
};

let ebbfId;
{
  const { data: existing } = await db
    .from('organisation')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('name', EBBF.name)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing) {
    ebbfId = existing.id;
    log('org EBBF (exists)');
  } else {
    const { data: row, error } = await db
      .from('organisation')
      .insert({ ...EBBF, workspace_id: workspaceId })
      .select('id')
      .single();
    if (error) { warn('org insert failed', error.message); }
    else { ebbfId = row.id; log('org EBBF (created)'); }
  }
}

// EBBF identity (Fibre Platform owns identity for now)
if (ebbfId) {
  const { data: existing } = await db
    .from('org_identity')
    .select('id')
    .eq('org_id', ebbfId)
    .maybeSingle();
  if (!existing) {
    await db.from('org_identity').insert({
      org_id: ebbfId,
      app_id: apps['fibre-platform'],
      mission_statement: 'Bringing values-based principles to business and the workplace, applying Bahá\'í-inspired ethics to organisational life.',
      vision_statement: 'A world where ethical principles guide every economic decision.',
      stated_values: ['Service', 'Justice', 'Truthfulness', 'Consultation'],
      governance_model: 'cooperative',
      ownership_type: 'ngo',
      decision_making_style: 'consultative',
      languages_of_operation: ['en', 'fr', 'es'],
      maturity_stage: 'established',
    });
    log('  org_identity (created)');
  }

  // EBBF system context (Fibre Suite owns this)
  const { data: existing2 } = await db
    .from('org_system_context')
    .select('id')
    .eq('org_id', ebbfId)
    .maybeSingle();
  if (!existing2) {
    await db.from('org_system_context').insert({
      org_id: ebbfId,
      app_id: apps['fibre-suite'],
      transformation_stage: 'in_programme',
      active_change_themes: ['leadership for transformation', 'meaningful work'],
      strategic_priorities: 'Strengthen the annual conference programme; develop alumni journeys; deepen cohort connection.',
      leadership_stability: 'stable',
      change_readiness: 'driving',
      notes_updated_at: new Date().toISOString(),
      notes_updated_by: seederUser.id,
    });
    log('  org_system_context (created)');
  }
}

// --- Org memberships ------------------------------------------------------

const MEMBERSHIPS = [
  { person: 0, title: 'Programme Director', is_primary: true, is_decision_maker: true, is_champion: true, started: '2020-09-01' },
  { person: 1, title: 'Athens Co-host', started: '2025-01-15' },
  { person: 2, title: 'Board Member', is_decision_maker: true, started: '2018-04-01' },
];

if (ebbfId) {
  for (const m of MEMBERSHIPS) {
    if (!personIds[m.person]) continue;
    const { data: existing } = await db
      .from('org_membership')
      .select('id')
      .eq('person_id', personIds[m.person])
      .eq('org_id', ebbfId)
      .is('ended_at', null)
      .maybeSingle();
    if (existing) continue;
    const { error } = await db.from('org_membership').insert({
      person_id: personIds[m.person],
      org_id: ebbfId,
      title: m.title,
      is_primary: m.is_primary ?? false,
      is_decision_maker: m.is_decision_maker ?? false,
      is_champion: m.is_champion ?? false,
      started_at: m.started,
    });
    if (error) warn('membership failed', error.message);
    else log('  membership', PEOPLE[m.person].first_name, '-', m.title);
  }
}

// --- Programmes -----------------------------------------------------------

async function upsertProgramme({ title, format, ownerSlug, starts_on, ends_on, status }) {
  const { data: existing } = await db
    .from('program')
    .select('id, title')
    .eq('workspace_id', workspaceId)
    .eq('title', title)
    .maybeSingle();
  if (existing) {
    log('programme', title, '(exists)');
    return existing.id;
  }
  const { data: row, error } = await db
    .from('program')
    .insert({
      workspace_id: workspaceId,
      app_id: apps[ownerSlug],
      title,
      format,
      status: status ?? 'active',
      starts_on,
      ends_on,
    })
    .select('id')
    .single();
  if (error) { warn('programme insert failed', title, error.message); return null; }
  log('programme', title, '(created)');
  return row.id;
}

const conferenceId = await upsertProgramme({
  title: 'EBBF Annual Conference 2026 — Reorienting Towards Hope (Athens)',
  format: 'event',
  ownerSlug: 'the-thread',
  starts_on: '2026-04-23',
  ends_on: '2026-04-26',
  status: 'active',
});

const journeyId = await upsertProgramme({
  title: 'Post-Athens — Vertrouwen als de Basis (12-week journey)',
  format: 'journey',
  ownerSlug: 'the-thread',
  starts_on: '2026-05-15',
  ends_on: '2026-08-07',
  status: 'active',
});

const workingSessionId = await upsertProgramme({
  title: 'EBBF Board working session — March 2026',
  format: 'meeting',
  ownerSlug: 'fibre-suite',
  starts_on: '2026-03-12',
  ends_on: '2026-03-12',
  status: 'completed',
});

// --- Enrolments + activity events ----------------------------------------

const enrolTargets = [
  // Conference — most of the people are attending
  { programme: conferenceId, person: 0, status: 'completed' },
  { programme: conferenceId, person: 1, status: 'active' },
  { programme: conferenceId, person: 2, status: 'enrolled' },
  { programme: conferenceId, person: 3, status: 'enrolled' },
  { programme: conferenceId, person: 4, status: 'enrolled' },
  { programme: conferenceId, person: 5, status: 'invited' },
  // Follow-on journey — fewer continue
  { programme: journeyId, person: 0, status: 'active' },
  { programme: journeyId, person: 2, status: 'enrolled' },
  { programme: journeyId, person: 4, status: 'invited' },
  // Working session — board only
  { programme: workingSessionId, person: 0, status: 'completed' },
  { programme: workingSessionId, person: 2, status: 'completed' },
];

for (const t of enrolTargets) {
  if (!t.programme || !personIds[t.person]) continue;
  const { data: existing } = await db
    .from('enrolment')
    .select('id')
    .eq('program_id', t.programme)
    .eq('person_id', personIds[t.person])
    .maybeSingle();
  if (existing) continue;
  const { error } = await db.from('enrolment').insert({
    program_id: t.programme,
    person_id: personIds[t.person],
    status: t.status,
    enrolled_at: t.status !== 'invited' ? new Date(Date.now() - 30 * 86_400_000).toISOString() : null,
    completed_at: t.status === 'completed' ? new Date(Date.now() - 14 * 86_400_000).toISOString() : null,
    progress_pct: t.status === 'completed' ? 100 : t.status === 'active' ? 60 : 0,
  });
  if (error) warn('enrolment failed', error.message);
}
log('enrolments seeded');

// --- Activity events ------------------------------------------------------

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

const ACTIVITY = [
  // Conference
  { person: 0, app: 'the-thread', type: 'event_registered', subject: 'Registered: EBBF Annual Conference 2026 — Athens', when: 90 },
  { person: 1, app: 'the-thread', type: 'event_registered', subject: 'Registered: EBBF Annual Conference 2026 — Athens', when: 88 },
  { person: 2, app: 'the-thread', type: 'event_registered', subject: 'Registered: EBBF Annual Conference 2026 — Athens', when: 75 },
  { person: 3, app: 'the-thread', type: 'event_registered', subject: 'Registered: EBBF Annual Conference 2026 — Athens', when: 60 },
  { person: 4, app: 'the-thread', type: 'event_registered', subject: 'Registered: EBBF Annual Conference 2026 — Athens', when: 55 },
  { person: 0, app: 'the-thread', type: 'session_attended', subject: 'Attended: Opening plenary — Reorienting Towards Hope', when: 22 },
  { person: 1, app: 'the-thread', type: 'session_attended', subject: 'Attended: Opening plenary — Reorienting Towards Hope', when: 22 },
  { person: 2, app: 'the-thread', type: 'session_attended', subject: 'Attended: Opening plenary — Reorienting Towards Hope', when: 22 },
  { person: 0, app: 'the-thread', type: 'session_attended', subject: 'Attended: Practice lab — Leading through transitions', when: 21 },
  { person: 1, app: 'the-thread', type: 'session_attended', subject: 'Attended: Practice lab — Cooperative governance', when: 21 },
  { person: 0, app: 'the-thread', type: 'session_attended', subject: 'Attended: Closing circle — Athens 2026', when: 19 },
  { person: 0, app: 'the-thread', type: 'programme_completed', subject: 'Completed: EBBF Athens 2026', when: 18 },

  // Working session
  { person: 0, app: 'fibre-suite', type: 'meeting_facilitated', subject: 'Facilitated: EBBF Board working session — March', when: 64 },
  { person: 2, app: 'fibre-suite', type: 'meeting_attended', subject: 'Attended: EBBF Board working session — March', when: 64 },
  { person: 0, app: 'fibre-suite', type: 'action_item_assigned', subject: 'Action: Draft cohort design for post-Athens journey', when: 64 },

  // Journey starts
  { person: 0, app: 'the-thread', type: 'journey_step_completed', subject: 'Completed step: First reflection — Vertrouwen als de Basis', when: 7 },
  { person: 2, app: 'the-thread', type: 'event_registered', subject: 'Registered: Post-Athens journey', when: 14 },

  // Sales / outreach
  { person: 3, app: 'fibre-sales', type: 'call_made', subject: 'Discovery call — explored sponsorship options', when: 50 },
  { person: 3, app: 'fibre-sales', type: 'proposal_sent', subject: 'Sent: 2026 sponsorship proposal', when: 45 },

  // Platform
  { person: 5, app: 'fibre-platform', type: 'user_created', subject: 'Added to the workspace', when: 30 },
];

for (const a of ACTIVITY) {
  if (!personIds[a.person] || !apps[a.app]) continue;
  // Avoid duplicate (subject + person + day)
  const occurred = daysAgo(a.when);
  const { data: existing } = await db
    .from('activity')
    .select('id')
    .eq('person_id', personIds[a.person])
    .eq('subject', a.subject)
    .maybeSingle();
  if (existing) continue;
  const { error } = await db.from('activity').insert({
    workspace_id: workspaceId,
    person_id: personIds[a.person],
    app_id: apps[a.app],
    type: a.type,
    subject: a.subject,
    occurred_at: occurred,
    created_by: seederUser.id,
  });
  if (error) warn('activity failed', a.subject, error.message);
}
log('activity events seeded');

// --- Per-app curator data for one or two key people -----------------------

// Marja (person 0) — change context + learning profile
if (personIds[0]) {
  const { data: cc } = await db.from('person_change_context').select('id').eq('person_id', personIds[0]).maybeSingle();
  if (!cc) {
    await db.from('person_change_context').insert({
      person_id: personIds[0],
      app_id: apps['fibre-suite'],
      role_in_change: 'champion',
      stance_on_change: 'driving',
      readiness_level: 'driving',
      change_themes: ['leadership', 'community building'],
      motivators: ['legacy', 'service'],
      facilitator_notes: 'Consistently brings clarity to group reflection. Strong convening capacity.',
      notes_updated_at: new Date().toISOString(),
      notes_updated_by: seederUser.id,
    });
    log('Marja change_context (created)');
  }
  const { data: lr } = await db.from('person_learning').select('id').eq('person_id', personIds[0]).maybeSingle();
  if (!lr) {
    await db.from('person_learning').insert({
      person_id: personIds[0],
      app_id: apps['fibre-learn'],
      learning_style: 'reflective',
      group_role_tendency: 'connector',
      learning_interests: ['facilitation', 'systems thinking', 'consultation methodology'],
      development_goals: 'Build the next generation of EBBF facilitators.',
      open_to_coaching: true,
      open_to_peer_exchange: true,
    });
    log('Marja learning (created)');
  }
}

// Daniel (person 1) — Athens co-host. Sales-side relationship context.
if (personIds[1]) {
  const { data: rc } = await db.from('person_relationship_context').select('id').eq('person_id', personIds[1]).maybeSingle();
  if (!rc) {
    await db.from('person_relationship_context').insert({
      person_id: personIds[1],
      app_id: apps['fibre-sales'],
      source: 'referral',
      source_detail: 'Introduced by Marja during 2025 board call.',
      relationship_strength: 'strong',
      communication_preference: 'email',
      is_key_contact: true,
      is_ambassador: true,
      first_contact_at: '2025-01-15T10:00:00Z',
    });
    log('Daniel relationship_context (created)');
  }
}

log('done.');
console.log('\nSeed complete. The default workspace now contains:');
console.log(`  - ${PEOPLE.length} sample people`);
console.log('  - 1 organisation (EBBF) with identity + system context + 3 members');
console.log('  - 3 programmes (Athens conference, post-Athens journey, board working session)');
console.log('  - ~11 enrolments across them');
console.log('  - ~20 activity events spread over the last 90 days');
console.log('  - Per-app curator data for two key contacts');
