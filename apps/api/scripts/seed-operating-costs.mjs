#!/usr/bin/env node
// Seed The Fibre's operating costs as Pulse budget lines in Solidarity Lab's
// workspace — the cost-floor table from docs/pricing-proposal.md ("What it
// costs to run", ~€75/month), as editable lines to correct against real
// invoices. This is deliberately where costs live: Pulse is the business
// view; /admin/economics only shows what platform tables know.
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
const envPath = resolve(__dirname, '../.env');
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

console.log('\nDone. Correct the amounts in Pulse → Budget as real invoices arrive.');
