#!/usr/bin/env node
// Add or remove a scope on an app's MANIFEST — the list of scopes the app says
// it needs.
//
// WHY THIS IS A SCRIPT AND NOT A SCREEN
// The manifest decides what Settings → Apps → Manage API keys can offer when
// you mint: the picker lists `manifest.scopes_requested`, so a scope the
// manifest never asked for cannot be ticked, and a key can never carry it
// (lib/app-keys.ts). That is the intended shape — an app declares what it
// needs, a human decides whether to hand it over.
//
// An app can widen its own manifest through PUT /apps/:slug/manifest with its
// own key. An app registered by hand, like fot-planner, has no code that does
// that, and Admin → Apps only DISPLAYS the scopes. So without this there is no
// way to add one to an already-approved app.
//
// Adding a scope here grants nothing on its own. It puts a tick-box in front
// of a workspace admin, who then mints a key. Existing keys are untouched:
// app_key.scopes is a stored column, so widening the manifest never widens a
// credential already in the wild — that is the whole reason the two are
// separate.
//
// Usage:
//   node scripts/manifest-scope.mjs --app <slug>
//   node scripts/manifest-scope.mjs --app <slug> --add <scope>
//   node scripts/manifest-scope.mjs --app <slug> --remove <scope>
//   FIBRE_MANIFEST_CONFIRM=1 node scripts/manifest-scope.mjs ...   (to write)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The scope list, read out of its source rather than imported: app-keys.ts
// pulls in the db client and half the server with it, and this is a script.
const APP_SCOPES = [
  ...readFileSync(resolve(__dirname, '../src/lib/app-keys.ts'), 'utf-8')
    .split('export const APP_SCOPES = [')[1]
    .split('] as const')[0]
    .matchAll(/'([a-z_]+:[a-z_]+)'/g),
].map((m) => m[1]);
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

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const slug = arg('app');
const add = arg('add');
const remove = arg('remove');
const apply = process.env.FIBRE_MANIFEST_CONFIRM === '1';

if (!slug) {
  console.error('usage: --app <slug> [--add <scope> | --remove <scope>]');
  process.exit(1);
}

const { data: app } = await db
  .from('app')
  .select('id, slug, name, status, manifest')
  .eq('slug', slug)
  .maybeSingle();
if (!app) {
  console.error(`no app with slug "${slug}"`);
  process.exit(1);
}

const manifest = app.manifest && typeof app.manifest === 'object' ? app.manifest : {};
const current = Array.isArray(manifest.scopes_requested) ? manifest.scopes_requested : [];

console.log(`\n${app.name} (${app.slug}) — ${app.status}`);
console.log(`asks for: ${current.join(', ') || 'nothing'}`);

if (!add && !remove) process.exit(0);

// A scope the platform does not know would sit in the manifest looking real
// and be dropped at mint time (partitionScopes), which is a confusing way to
// find out you made a typo.
if (add && !APP_SCOPES.includes(add)) {
  console.error(`\n"${add}" is not a scope this platform has. Known: ${APP_SCOPES.join(', ')}`);
  process.exit(1);
}

let next = current;
if (add) next = current.includes(add) ? current : [...current, add];
if (remove) next = next.filter((s) => s !== remove);

if (next.length === current.length && next.every((s, i) => s === current[i])) {
  console.log('\nNothing to change.');
  process.exit(0);
}
console.log(`becomes:  ${next.join(', ')}`);

if (!apply) {
  console.log('\nDry run. Re-run with FIBRE_MANIFEST_CONFIRM=1 to write.');
  process.exit(0);
}

const { error } = await db
  .from('app')
  .update({ manifest: { ...manifest, scopes_requested: next } })
  .eq('id', app.id);
if (error) {
  console.error('update failed', error);
  process.exit(1);
}
console.log('\nWritten. It is now a tick-box at Settings → Apps → Manage API keys.');
console.log('Keys already minted are unchanged — mint a new one to use it.');
