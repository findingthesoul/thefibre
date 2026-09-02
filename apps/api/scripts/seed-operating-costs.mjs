#!/usr/bin/env node
// Seed The Fibre's operating costs as Pulse budget lines in Solidarity Lab's
// workspace — the cost-floor table from docs/pricing-proposal.md ("What it
// costs to run", ~€75/month), as editable lines to correct against real
// invoices. This is deliberately where costs live: Pulse is the business
// view; /admin/economics reads these lines back (category match).
//
// v2 (Sjoerd 2026-09-01: "I want to see a separate cashflow for the tools"):
// the lines live on a TEAM — "The Fibre" — which Pulse renders as its own
// cashflow tab with its own virtual bank and projection, separate from the
// rest of Solidarity Lab. The script creates the team, registers it as a
// Pulse involved team, and stamps every cost line with it (including lines
// seeded by v1, which sat on the workspace tab).
//
// Idempotent: matched on (workspace, label) among unarchived lines.
//
// Usage:
//   node scripts/seed-operating-costs.mjs [--workspace <slug>]
//
// Without --workspace it looks for a workspace whose name contains
// "solidarity" and refuses if that finds anything but exactly one.

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

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const argIdx = process.argv.indexOf('--workspace');
const slugArg = argIdx !== -1 ? process.argv[argIdx + 1] : null;

let workspace;
if (slugArg) {
  const { data } = await db.from('workspace').select('id, name, slug').eq('slug', slugArg).maybeSingle();
  workspace = data;
} else {
  const { data } = await db.from('workspace').select('id, name, slug').ilike('name', '%solidarity%');
  if ((data ?? []).length !== 1) {
    console.error(
      `Expected exactly one workspace matching "solidarity", found ${data?.length ?? 0}. Pass --workspace <slug>.`,
    );
    process.exit(1);
  }
  workspace = data[0];
}
if (!workspace) {
  console.error('Workspace not found.');
  process.exit(1);
}
console.log(`Seeding operating costs into "${workspace.name}" (${workspace.slug})`);

// --- The team whose cashflow tab holds the tools -------------------------
const TEAM_SLUG = 'the-fibre';
const TEAM_NAME = 'The Fibre';

let { data: team } = await db
  .from('team')
  .select('id, name')
  .eq('workspace_id', workspace.id)
  .eq('slug', TEAM_SLUG)
  .maybeSingle();

if (!team) {
  // created_by: the workspace's super admin (there is exactly one operator).
  const { data: creator } = await db
    .from('user')
    .select('id')
    .eq('workspace_id', workspace.id)
    .eq('is_super_admin', true)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  const { data: created, error: tErr } = await db
    .from('team')
    .insert({
      workspace_id: workspace.id,
      slug: TEAM_SLUG,
      name: TEAM_NAME,
      description: 'The platform itself — hosting, email, payments tooling.',
      is_active: true,
      created_by: creator?.id ?? null,
    })
    .select('id, name')
    .single();
  if (tErr || !created) {
    console.error('team create failed:', tErr?.message);
    process.exit(1);
  }
  team = created;
  if (creator) {
    await db.from('team_member').insert({ team_id: team.id, user_id: creator.id, role: 'lead' });
  }
  console.log(`  created team "${TEAM_NAME}"`);
} else {
  console.log(`  team "${TEAM_NAME}" exists`);
}

// Registering it as an involved team is what gives it a cashflow TAB.
const { error: itErr } = await db
  .from('pulse_involved_team')
  .upsert(
    { workspace_id: workspace.id, team_id: team.id },
    { onConflict: 'workspace_id,team_id', ignoreDuplicates: true },
  );
if (itErr) {
  console.error('involved-team upsert failed:', itErr.message);
  process.exit(1);
}

// v1 seeded these lines onto the workspace tab — move them to the team's.
const { data: moved, error: mvErr } = await db
  .from('pulse_budget_line')
  .update({ team_id: team.id })
  .eq('workspace_id', workspace.id)
  .eq('category', 'Platform infrastructure')
  .is('team_id', null)
  .is('archived_at', null)
  .select('label');
if (mvErr) {
  console.error('moving v1 lines failed:', mvErr.message);
  process.exit(1);
}
for (const l of moved ?? []) console.log(`  moved to "${TEAM_NAME}" tab: ${l.label}`);

// The estimates from docs/pricing-proposal.md — check against real invoices
// and correct the amounts in Pulse; this seed never overwrites an amount you
// changed there (match-by-label, insert-only).
const LINES = [
  { label: 'Fly.io — API (shared-cpu-1x, fra)', amount_cents: 700 },
  { label: 'Supabase Pro (EU, Ireland)', amount_cents: 2500 },
  { label: 'Vercel (five apps)', amount_cents: 2000 },
  { label: 'Resend (email)', amount_cents: 2000 },
  { label: 'Domains', amount_cents: 200 },
  { label: 'Stripe (per-transaction, estimate)', amount_cents: 500 },
];

const { data: existing } = await db
  .from('pulse_budget_line')
  .select('label')
  .eq('workspace_id', workspace.id)
  .is('archived_at', null);
const have = new Set((existing ?? []).map((l) => l.label));

for (const line of LINES) {
  if (have.has(line.label)) {
    console.log(`  exists, untouched: ${line.label}`);
    continue;
  }
  const { error } = await db.from('pulse_budget_line').insert({
    workspace_id: workspace.id,
    team_id: team.id,
    label: line.label,
    category: 'Platform infrastructure',
    direction: 'out',
    amount_cents: line.amount_cents,
    cadence: 'monthly',
    included: true,
  });
  if (error) {
    console.error(`  FAILED ${line.label}:`, error.message);
    process.exit(1);
  }
  console.log(`  added: ${line.label} (€${(line.amount_cents / 100).toFixed(2)}/mo)`);
}

console.log(
  `\nDone. Pulse → Cashflow now has a "${TEAM_NAME}" tab holding the tools; ` +
    'correct the amounts in Pulse → Budget as real invoices arrive.',
);
