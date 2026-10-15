#!/usr/bin/env node
// Which staging integration tests reach the code this release changed — and
// were therefore NOT run by `pnpm verify`.
//
// `pnpm verify` runs unit tests only; the integration suite
// (apps/api/src/integration/*.int.test.ts) talks to the staging database and
// is run by hand. Twice in October a release went out green while an
// integration test that exercised its own lane was red (publish-guard.int,
// red from 1.201.3 until 1.203.0, found by accident). This does not run them
// — they need staging credentials and minutes — it NAMES them, so "verified"
// in a runway request can say which ones were run.
//
// A test counts as reaching a changed file when it (a) is itself changed,
// (b) imports the file, or (c) imports a module that imports it — two levels,
// on purpose: the full closure through routes/thread.ts would name nearly
// every test and the list would be ignored.
//
// Usage: node scripts/lane-integration-tests.mjs <base-ref>   (default origin/staging)
// Never fails: exit 0 whatever it finds. Information, not a gate.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const base = process.argv[2] || 'origin/staging';
const SRC = join(root, 'apps/api/src');
const INT = join(SRC, 'integration');

let changed;
try {
  changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((p) => join(root, p));
} catch {
  process.exit(0); // no base to compare with: say nothing rather than guess
}
const changedSet = new Set(changed);
if (!existsSync(INT)) process.exit(0);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Relative imports of one file, resolved to .ts paths on disk. */
const importsCache = new Map();
function importsOf(file) {
  if (importsCache.has(file)) return importsCache.get(file);
  const text = readFileSync(file, 'utf8');
  const out = new Set();
  for (const m of text.matchAll(/['"](\.{1,2}\/[^'"]+?)\.js['"]/g)) {
    const p = resolve(dirname(file), `${m[1]}.ts`);
    if (existsSync(p)) out.add(p);
  }
  importsCache.set(file, out);
  return out;
}

const tests = readdirSync(INT).filter((n) => n.endsWith('.int.test.ts')).map((n) => join(INT, n));

// A HUB is a module most tests import (routes/thread.ts is the obvious one):
// reaching a change only through a hub says little about any one test, so
// those are counted, not listed — otherwise every release names twenty-five
// tests and the line is ignored.
const importCount = new Map();
for (const t of tests) for (const d of importsOf(t)) importCount.set(d, (importCount.get(d) ?? 0) + 1);
const isHub = (f) => (importCount.get(f) ?? 0) >= Math.max(6, Math.ceil(tests.length / 5));

const named = [];
const viaHub = new Map(); // hub → tests that reach the change only through it
for (const t of tests) {
  const reasons = [];
  const hubs = new Set();
  if (changedSet.has(t)) reasons.push('the test itself changed');
  for (const dep of importsOf(t)) {
    const hub = isHub(dep);
    if (changedSet.has(dep)) {
      if (hub) hubs.add(dep);
      else reasons.push(`imports ${relative(SRC, dep)}`);
    }
    for (const dep2 of importsOf(dep)) {
      if (!changedSet.has(dep2)) continue;
      if (hub) hubs.add(dep);
      else reasons.push(`via ${relative(SRC, dep)} → ${relative(SRC, dep2)}`);
    }
  }
  if (reasons.length) named.push({ t, reasons: [...new Set(reasons)] });
  else for (const h of hubs) viaHub.set(h, [...(viaHub.get(h) ?? []), t]);
}

// Only API code is reached this way; a change outside apps/api/src says nothing.
if (!named.length && !viaHub.size) process.exit(0);

const rel = (f) => relative(join(root, 'apps/api'), f);
console.log('');
console.log('ⓘ  Staging integration tests that reach this release\'s lane — NOT run by pnpm verify:');
for (const h of named) {
  console.log(`   · ${rel(h.t)} — ${h.reasons.slice(0, 2).join('; ')}${h.reasons.length > 2 ? ` (+${h.reasons.length - 2})` : ''}`);
}
for (const [hub, list] of viaHub) {
  console.log(`   + ${list.length} more reach it only through ${relative(SRC, hub)}, which most tests import`);
}
if (named.length) {
  console.log('   Run the named ones against staging, and say which you ran in the runway request:');
  console.log(`     cd apps/api && npx vitest run --config vitest.integration.config.ts ${named.map((h) => rel(h.t)).join(' ')}`);
}
console.log('');
