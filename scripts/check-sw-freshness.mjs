#!/usr/bin/env node
// A precached file that changed after its service worker did is already stale
// on somebody's phone.
//
// A browser only reinstalls a worker whose OWN bytes changed. So editing a
// file the worker precaches — an icon, the offline page — leaves every
// installed phone serving the old copy, for ever, while the server is right
// and the repo is right and the typecheck is green. The only place the
// mismatch exists is between two commit dates.
//
// That is not hypothetical. Connect's icon was redrawn on 2026-09-22 and its
// worker was not touched, so every phone with the app kept the pre-rename
// icon out of `connections-shell-v2`. Sjoerd: "the icon of connect (if I
// download it for my mobile) is the old one."
//
// DERIVED, NEVER LISTED: every `apps/*/public/sw.js` is checked, so an app
// that gains a worker is covered the moment it exists. `PRECACHE` is read out
// of each worker's own source, so the list cannot drift from the thing it
// guards.
//
// (apps/connections/lib/sw-freshness.test.ts checks the same property for
// that one app and predates this. It is correct and harmless; folding it in
// belongs to whoever next owns that app, not to a passing release.)

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** When a path was last committed, as a unix timestamp; 0 if never. */
function lastCommitted(path) {
  const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', path], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  return out ? Number(out) : 0;
}

function precachedFiles(source) {
  const block = source.match(/const PRECACHE = \[(.*?)\]/s);
  if (!block) return null;
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const problems = [];
let checked = 0;

for (const app of readdirSync(resolve(ROOT, 'apps'))) {
  const sw = `apps/${app}/public/sw.js`;
  if (!existsSync(resolve(ROOT, sw))) continue;
  checked += 1;

  const files = precachedFiles(readFileSync(resolve(ROOT, sw), 'utf8'));
  if (files === null) {
    problems.push(`${sw}: no PRECACHE array found — this check reads it from the source`);
    continue;
  }
  // A guard that reads an empty list passes for the wrong reason.
  if (files.length === 0) {
    problems.push(`${sw}: PRECACHE is empty`);
    continue;
  }

  for (const f of files) {
    // ON DISK is the test, not "committed". A worker and the page it precaches
    // arrive in the same commit, so on the run that adds them neither has a
    // commit date yet — and a check that fails while you are writing the thing
    // it asks for is how a check becomes noise and then gets deleted.
    if (!existsSync(resolve(ROOT, `apps/${app}/public${f}`))) {
      problems.push(`${sw}: precaches ${f}, which does not exist`);
    }
  }

  // An UNCOMMITTED edit to the worker means it is being changed right now, so
  // it is newer than anything in history. Without this the guard fires while
  // you are in the middle of fixing exactly what it asks for — which is how a
  // check becomes noise and then gets deleted.
  const editing = execFileSync('git', ['status', '--porcelain', '--', sw], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (editing) continue;

  const swAt = lastCommitted(sw);
  if (swAt === 0) {
    problems.push(`${sw}: has no commit — run this in a git checkout`);
    continue;
  }

  // A file with no commit yet is being added alongside this worker, not
  // drifting from it — `lastCommitted` returns 0, which is never > swAt.
  const stale = files.filter((f) => lastCommitted(`apps/${app}/public${f}`) > swAt);
  if (stale.length) {
    problems.push(
      `${sw}: ${stale.join(', ')} changed after it. Bump VERSION in that file and say why — ` +
        `the bump is what makes a browser reinstall the worker and re-fetch what it precaches.`,
    );
  }
}

if (problems.length) {
  console.error('Service worker freshness:\n' + problems.map((p) => `  ✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`Service worker freshness: ${checked} worker(s) newer than everything they precache.`);
