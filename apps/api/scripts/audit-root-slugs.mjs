#!/usr/bin/env node
// READ-ONLY. Lists every publicly addressable owner whose slug did NOT make
// it into public_root_slug — i.e. a collision that predates the constraint
// and is still resolving to 404 for everyone involved.
//
// The migration's backfill uses `on conflict do nothing` so that a database
// holding a collision cannot take a release down with it. This is the other
// half of that bargain: run it after applying the migration to see what was
// skipped, and settle each one by renaming a slug.
//
// Writes nothing. Safe against production.
//
// Usage:
//   node scripts/audit-root-slugs.mjs
//   FIBRE_ENV_FILE=.env.staging node scripts/audit-root-slugs.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '..', process.env.FIBRE_ENV_FILE ?? '.env'), 'utf-8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: registry, error } = await db.from('public_root_slug').select('slug, kind, workspace_id, team_id, organiser_id');
if (error) {
  console.error('could not read public_root_slug —', error.message);
  process.exit(1);
}
const heldTeams = new Set(registry.filter((r) => r.team_id).map((r) => r.team_id));
const heldOrgs = new Set(registry.filter((r) => r.organiser_id).map((r) => r.organiser_id));
const heldWorkspaces = new Set(registry.filter((r) => r.kind === 'workspace').map((r) => r.workspace_id));

const [{ data: workspaces }, { data: teams }, { data: organisers }] = await Promise.all([
  db.from('workspace').select('id, slug, name'),
  db.from('team').select('id, slug, name, workspace_id, is_active'),
  db.from('thread_organiser').select('id, slug, display_name, workspace_id'),
]);

const wsName = Object.fromEntries((workspaces ?? []).map((w) => [w.id, w.name]));
const orphans = [
  ...(workspaces ?? []).filter((w) => !heldWorkspaces.has(w.id))
    .map((w) => ({ slug: w.slug, kind: 'workspace', label: w.name, ws: w.id })),
  ...(teams ?? []).filter((t) => !heldTeams.has(t.id))
    .map((t) => ({ slug: t.slug, kind: 'team', label: t.name, ws: t.workspace_id })),
  ...(organisers ?? []).filter((o) => !heldOrgs.has(o.id))
    .map((o) => ({ slug: o.slug, kind: 'organiser', label: o.display_name ?? o.slug, ws: o.workspace_id })),
];

console.log(`public_root_slug holds ${registry.length} addresses.`);
if (!orphans.length) {
  console.log('Every workspace, team and organiser holds its own address. Nothing to settle.');
  process.exit(0);
}

console.log(`\n${orphans.length} owner(s) do NOT hold their slug — each is currently a 404:\n`);
for (const o of orphans) {
  const winner = registry.find((r) => r.slug === o.slug.trim().toLowerCase());
  console.log(`  /${o.slug}`);
  console.log(`    wanted by  ${o.kind} "${o.label}" in ${wsName[o.ws] ?? o.ws}`);
  console.log(`    held by    ${winner ? `${winner.kind} in ${wsName[winner.workspace_id] ?? winner.workspace_id}` : '(nothing — unexpected, investigate)'}`);
}
console.log('\nSettle each by renaming one side; the trigger claims the freed address automatically.');
