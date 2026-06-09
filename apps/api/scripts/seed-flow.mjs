#!/usr/bin/env node
// Seed a demo Fibre Flow: a "Partnership Pipeline" flow with steps, gated
// transitions, and a handful of existing seeded people placed at various
// steps (with their current-step gate tasks materialised).
//
// Builds on the people created by seed-ebbf.mjs. Idempotent — keyed on the
// flow name within the default workspace; re-running skips if it exists.
//
// Usage:  node scripts/seed-flow.mjs   (requires apps/api/.env)

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
  auth: { persistSession: false, autoRefreshToken: false },
});
const log = (...a) => console.log('·', ...a);

const FLOW_NAME = 'Partnership Pipeline';

const { data: ws } = await db.from('workspace').select('id').eq('slug', 'default').limit(1);
const workspaceId = ws?.[0]?.id;
if (!workspaceId) { console.error('No default workspace'); process.exit(1); }

const { data: users } = await db
  .from('user').select('id, email').eq('workspace_id', workspaceId).is('deleted_at', null);
const user = users?.[0];
if (!user) { console.error('No platform user — sign in once first'); process.exit(1); }
log('seeder', user.email);

// Skip if the flow already exists.
const { data: existing } = await db
  .from('flow_definition').select('id').eq('workspace_id', workspaceId).eq('name', FLOW_NAME).is('deleted_at', null);
if (existing && existing.length) { log('flow already seeded —', existing[0].id, '— nothing to do'); process.exit(0); }

// --- flow + version -------------------------------------------------------
const { data: flow } = await db.from('flow_definition').insert({
  workspace_id: workspaceId, name: FLOW_NAME,
  description: 'Move prospective partners from introduction to active partnership.',
  scope: 'workspace', owner_user_id: user.id, created_by: user.id, lifecycle: 'active',
}).select('id').single();
log('flow', flow.id);

const { data: version } = await db.from('flow_version').insert({
  flow_id: flow.id, version_number: 1, created_by: user.id, published_at: new Date().toISOString(),
}).select('id').single();

// --- steps ----------------------------------------------------------------
const STEPS = [
  { key: 'introduction', name: 'Introduction', kind: 'entry', x: 40, y: 40 },
  { key: 'exploration', name: 'Exploration', kind: 'normal', x: 300, y: 40 },
  { key: 'proposal', name: 'Proposal', kind: 'normal', x: 560, y: 40 },
  { key: 'active_partner', name: 'Active Partner', kind: 'end_positive', x: 820, y: 40 },
  { key: 'declined', name: 'Declined', kind: 'end_negative', x: 560, y: 200 },
];
const stepRows = STEPS.map((s, i) => ({
  flow_version_id: version.id, key: s.key, name: s.name, kind: s.kind,
  canvas_x: s.x, canvas_y: s.y, ordinal: i,
}));
const { data: steps } = await db.from('flow_step').insert(stepRows).select('id, key');
const stepId = Object.fromEntries(steps.map((s) => [s.key, s.id]));

// --- transitions + gate tasks --------------------------------------------
const TRANS = [
  { from: 'introduction', to: 'exploration', label: 'Explore fit', logic: 'all',
    gates: [{ title: 'Intro call held', actor: 'team' }] },
  { from: 'exploration', to: 'proposal', label: 'Send proposal', logic: 'all',
    gates: [{ title: 'Draft proposal', actor: 'personal' }] },
  { from: 'proposal', to: 'active_partner', label: 'Sign MOU', logic: 'all',
    gates: [{ title: 'MOU signed', actor: 'contact', action: 'signed_contract' }] },
  { from: 'proposal', to: 'declined', label: 'Decline', logic: 'all', gates: [] },
];
const gateByStep = {}; // from-step-key → [{title,actor,action,id}]
for (let i = 0; i < TRANS.length; i++) {
  const t = TRANS[i];
  const { data: tr } = await db.from('flow_transition').insert({
    flow_version_id: version.id, from_step_id: stepId[t.from], to_step_id: stepId[t.to],
    label: t.label, gate_logic: t.logic, ordinal: i,
  }).select('id').single();
  for (let j = 0; j < t.gates.length; j++) {
    const g = t.gates[j];
    const { data: gt } = await db.from('flow_gate_task').insert({
      transition_id: tr.id, title: g.title, actor_type: g.actor,
      contact_action_type: g.actor === 'contact' ? g.action : null, required: true, ordinal: j,
    }).select('id').single();
    (gateByStep[t.from] ??= []).push({ ...g, id: gt.id });
  }
}

// step default task on entry
await db.from('flow_step_default_task').insert({
  step_id: stepId['introduction'], title: 'Send welcome email', actor_type: 'personal', ordinal: 0,
});

// --- runs: place a few existing people at various steps -------------------
const { data: people } = await db
  .from('person').select('id, first_name').eq('workspace_id', workspaceId).is('deleted_at', null).limit(6);
const placements = [
  { step: 'introduction' }, { step: 'exploration' }, { step: 'proposal' },
];
let placed = 0;
for (let i = 0; i < placements.length && i < (people?.length ?? 0); i++) {
  const person = people[i];
  const stepKey = placements[i].step;
  const { data: run } = await db.from('flow_run').insert({
    workspace_id: workspaceId, flow_id: flow.id, flow_version_id: version.id,
    person_id: person.id, current_step_id: stepId[stepKey], owner_user_id: user.id, status: 'active',
  }).select('id').single();

  // Materialise the current step's outgoing gate tasks (so the board/popup show them).
  for (const g of gateByStep[stepKey] ?? []) {
    await db.from('flow_task').insert({
      workspace_id: workspaceId, flow_run_id: run.id, gate_task_id: g.id,
      title: g.title, actor_type: g.actor,
      assignee_user_id: g.actor !== 'contact' ? user.id : null,
      contact_id: g.actor === 'contact' ? person.id : null,
      status: 'open', created_by: user.id,
    });
  }
  placed++;
  log('placed', person.first_name, '→', stepKey);
}

log(`done — flow "${FLOW_NAME}" with ${placed} contacts in motion.`);
process.exit(0);
