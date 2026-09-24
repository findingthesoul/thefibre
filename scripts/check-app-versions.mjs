#!/usr/bin/env node
// Several apps carry their OWN user-facing version, deliberately decoupled
// from the monorepo cadence (CLAUDE.md "Version bumps"): Meet shows v2.x
// because it is the rebuild of Suite v1, and Pulse, Members and the portal
// each started at 0.1.0 when they were born. Those numbers are shown to
// people — the portal prints "My Thread · v0.10.5" at the foot of every page.
//
// FIVE, not four. CLAUDE.md names three; Thread also carries its own (v4.0.0,
// from the rebuild) and the portal is a fourth. Which is the argument for
// deriving the list instead of writing it down: this comment would have been
// wrong on the day it was written if it had counted.
//
// Nothing stamps them. `scripts/release.sh` DERIVES the monorepo version
// surfaces (every apps/*/package.json, packages/*, apps/web/lib/version.ts)
// precisely so a new app cannot be forgotten — but these four are outside
// that on purpose, so they are bumped by hand, which means they are bumped
// when somebody remembers.
//
// On 2026-09-24 somebody did not. The portal's constant read 0.10.5 while
// five portal releases had shipped on top of it: a calendar subscription, the
// way back out, where a subscription can be added, the whole sequence at
// once, and the way-back button. The footer was telling people they were
// looking at software that did not have the feature on the screen in front of
// them. Spotted by a passing session, not by any check.
//
// WHY THIS WARNS AND DOES NOT REFUSE
// ---------------------------------------------------------------------------
// It compares two commit dates — the same trick as check-sw-freshness.mjs,
// because the mismatch exists nowhere else. But it cannot tell a user-facing
// change from a shared refactor that happened to touch the folder, and a gate
// that misfires is a gate people route around (the reasoning already written
// into changelog-order.mjs). So it says so loudly and returns 0. Deciding
// whether a change was worth a number is a judgement, and this is a reminder
// to make it, not a claim to have made it.
//
// DERIVED, NEVER LISTED: any app that declares a VERSION constant outside
// apps/web is covered the moment it exists.
//
// THE THRESHOLD IS A NOISE DIAL, NOT A CORRECTNESS BOUNDARY. With no
// threshold this fired on five apps out of five, most of them one commit
// behind, which is a warning nobody reads by the second release. Three is
// the point at which "we have shipped this app a few times without moving
// its number" stops being routine. It is a judgement, it is arbitrary, and
// it is written here rather than left as a bare `>= 3` in the code.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** See the header: a noise dial, not a correctness boundary. */
const NOISE_FLOOR = 3;

const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

/** When a path was last committed, as a unix timestamp; 0 if never. */
const lastCommitted = (p) => Number(git(['log', '-1', '--format=%ct', '--', p])) || 0;

/** Every file under `dir` that could hold a VERSION constant, shallowly. */
function versionFileFor(app) {
  const candidates = [
    join(app, 'lib', 'version.ts'),
    join(app, 'app', '(app)', 'layout.tsx'),
    join(app, 'app', 'layout.tsx'),
  ];
  for (const rel of candidates) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    // `export const` in the portal, a bare `const` in Meet, Pulse and
    // Members — a pattern requiring the export matched one app out of four
    // and reported the other three as fine, which is the failure mode this
    // whole script exists to catch.
    const m = readFileSync(abs, 'utf8').match(
      /(?:export\s+)?const VERSION\s*=\s*['"]([^'"]+)['"]/,
    );
    if (m) return { rel, version: m[1] };
  }
  return null;
}

/** The app's own source, minus the two files a release stamps anyway. */
function sourcePaths(app) {
  return readdirSync(join(ROOT, app))
    .filter((e) => !['node_modules', '.next', 'package.json', 'public'].includes(e))
    .map((e) => join(app, e))
    .filter((p) => existsSync(join(ROOT, p)) && statSync(join(ROOT, p)).isDirectory());
}

const apps = readdirSync(join(ROOT, 'apps'))
  .map((name) => join('apps', name))
  .filter((p) => statSync(join(ROOT, p)).isDirectory())
  // apps/web/lib/version.ts is the MONOREPO version — release.sh stamps it,
  // so it is never behind and warning about it would be noise.
  .filter((p) => p !== join('apps', 'web'));

const behind = [];
for (const app of apps) {
  const v = versionFileFor(app);
  if (!v) continue;
  const stamped = lastCommitted(v.rel);
  if (!stamped) continue;

  const sources = sourcePaths(app).filter((p) => p !== dirname(join(ROOT, v.rel)));
  const newest = Math.max(0, ...sources.map(lastCommitted));
  if (newest <= stamped) continue;

  // How many commits touched the app's source after the number last moved —
  // "behind by five releases" is actionable in a way that a date is not.
  const since = git([
    'log',
    '--format=%h',
    `--since=@${stamped + 1}`,
    '--',
    ...sources,
  ])
    .split('\n')
    .filter(Boolean);
  if (since.length >= NOISE_FLOOR) behind.push({ app, ...v, count: since.length });
}

if (behind.length) {
  console.warn('');
  console.warn('⚠️  An app version shown to users has not moved with its app:');
  for (const b of behind) {
    console.warn(`   ${b.app} — v${b.version} in ${b.rel}, ${b.count} commit(s) behind`);
  }
  console.warn('');
  console.warn('   These are decoupled from the monorepo number on purpose and are');
  console.warn('   bumped BY HAND. If those commits changed something a person sees,');
  console.warn('   bump the constant in the same release. If they were a shared');
  console.warn('   refactor, they were not worth a number and this line is noise —');
  console.warn('   which is why it does not fail the release.');
  console.warn('');
}
