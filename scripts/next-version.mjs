#!/usr/bin/env node
// Allocate the next version number and stamp it everywhere, in one command.
//
//   node scripts/next-version.mjs minor            # stamp the working tree
//   node scripts/next-version.mjs minor --amend    # …and amend the release commit
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// Choosing a version number by hand is a race that five sessions lose every
// day. You read the last release, add one, stamp SIXTEEN files (every
// package.json, apps/web/lib/version.ts, the CHANGELOG heading), commit — and
// somewhere in those minutes another session releases, so `release-guard.sh`
// refuses your number and every one of those files has to be rewritten. On
// 2026-09-23 that happened to one session three times in an hour, and to two
// sessions simultaneously twice (two v0.108.0s, two v1.7.0s).
//
// The guard is right and the announcements are courtesy — messages lose races
// with pushes, which is CLAUDE.md rule 5. What was wrong is that LOSING the
// race was expensive. This makes it one command:
//
//   ./scripts/release.sh            → REFUSED, someone released 1.24.0
//   node scripts/next-version.mjs minor --amend
//   ./scripts/release.sh            → 1.25.0
//
// ── What it does NOT do ─────────────────────────────────────────────────────
//
// It does not choose patch vs minor. That is a judgement about what changed —
// a fix, a new tool, a breaking shape — and a script that guessed would be
// wrong quietly. It does not write your CHANGELOG entry either: the number is
// mechanical, the entry is the release.
//
// It reads the last released number from CHANGELOG on `origin/staging`, the
// same source `release-guard.sh` reads, so the two cannot disagree about what
// "last" means.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The checkout you RUN it from, not the one this file lives in. Sessions work
// in `.claude/worktrees/*`, and a script that stamped its own repo instead of
// the caller's would quietly bump the wrong tree — and did, the first time
// this was tested against a fixture.
const ROOT = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return resolve(dirname(fileURLToPath(import.meta.url)), '..');
  }
})();
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const KIND = process.argv[2];
const AMEND = process.argv.includes('--amend');
if (!['patch', 'minor', 'major'].includes(KIND ?? '')) {
  console.error('usage: node scripts/next-version.mjs <patch|minor|major> [--amend]');
  process.exit(2);
}

// The same ref release-guard.sh reads, for the same reason: main lags by
// design since 2026-09-12, so a number taken from it can already be released.
git('fetch', '-q', 'origin');
const REF = (() => {
  try {
    git('rev-parse', '--verify', '--quiet', 'origin/staging');
    return 'origin/staging';
  } catch {
    return 'origin/main';
  }
})();

const released = git('show', `${REF}:CHANGELOG.md`)
  .split('\n')
  .map((l) => l.match(/^## \[(\d+\.\d+\.\d+)\]/)?.[1])
  .find(Boolean);
if (!released) {
  console.error(`REFUSED: could not read the last release number from ${REF}.`);
  process.exit(1);
}

const [maj, min, pat] = released.split('.').map(Number);
const next =
  KIND === 'major' ? `${maj + 1}.0.0` : KIND === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;

// ── Every version surface, DERIVED ──────────────────────────────────────────
// Not a written list: apps/my was the eighth app and a hand-kept list is how
// three "new thing forgotten in a list" bugs happened here.
const manifests = ['package.json'];
for (const dir of ['apps', 'packages']) {
  for (const name of readdirSync(resolve(ROOT, dir))) {
    const p = `${dir}/${name}/package.json`;
    if (existsSync(resolve(ROOT, p))) manifests.push(p);
  }
}

const touched = [];
for (const rel of manifests) {
  const p = resolve(ROOT, rel);
  const json = JSON.parse(readFileSync(p, 'utf8'));
  if (json.version === next) continue;
  json.version = next;
  writeFileSync(p, `${JSON.stringify(json, null, 2)}\n`);
  touched.push(rel);
}

const VERSION_TS = 'apps/web/lib/version.ts';
const vts = readFileSync(resolve(ROOT, VERSION_TS), 'utf8');
const vtsNext = vts.replace(/export const VERSION = '[^']*'/, `export const VERSION = '${next}'`);
if (vtsNext !== vts) {
  writeFileSync(resolve(ROOT, VERSION_TS), vtsNext);
  touched.push(VERSION_TS);
}

// ── The CHANGELOG heading ───────────────────────────────────────────────────
//
// The topmost entry heading is renumbered, whether it says `[NEXT]` or a
// number an earlier attempt stamped. It is only ever rewritten when that
// number is NOT yet on the release branch — so this can be re-run after losing
// a race without any chance of rewriting the heading of something released.
const CHANGELOG = 'CHANGELOG.md';
const log = readFileSync(resolve(ROOT, CHANGELOG), 'utf8');
const head = log.match(/^## \[(NEXT|\d+\.\d+\.\d+)\](.*)$/m);
if (!head) {
  console.error('REFUSED: no `## [NEXT]` or `## [x.y.z]` heading in CHANGELOG.md — write the entry first.');
  process.exit(1);
}
// Is the top heading THEIRS or MINE?
//
// After losing a race these look identical by number: a peer releases 1.25.0
// while my own entry is stamped 1.25.0. Refusing on the number alone would
// refuse the exact case this script exists for — which is what the first
// version did, and the test caught it.
//
// So compare the whole heading LINE against the released file. If my top
// heading appears verbatim on the release branch, I never wrote an entry and
// renumbering would silently relabel somebody's shipped release. If it does
// not, the number collides but the entry is mine, and renumbering is the
// whole point.
if (head[1] !== 'NEXT') {
  const releasedHeadings = new Set(
    git('show', `${REF}:CHANGELOG.md`)
      .split('\n')
      .filter((l) => /^## \[\d+\.\d+\.\d+\]/.test(l))
      .map((l) => l.trim()),
  );
  if (releasedHeadings.has(head[0].trim())) {
    console.error(`REFUSED: the top CHANGELOG entry is ${head[1]}, already released on ${REF}.`);
    console.error("         Write this release's entry above it before allocating a number.");
    process.exit(1);
  }
}
// LOCAL date, not `toISOString()`. Sjoerd works in Amsterdam, so an evening
// release is already the next day there while UTC is still on the previous
// one — the first run of this script stamped 2026-09-23 while the entry above
// it, written by hand minutes earlier, said 2026-09-24. A changelog dated a
// day behind for every release after 22:00 CEST is the kind of small lie
// nobody notices until they are reading history to find when something broke.
const now = new Date();
const today = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-');
// Keep whatever title the author put after the date; replace only number+date.
const title = head[2].replace(/^\s*—\s*\d{4}-\d{2}-\d{2}/, '').trim();
const logNext = log.replace(head[0], `## [${next}] — ${today}${title ? ` ${title}` : ''}`);
if (logNext !== log) {
  writeFileSync(resolve(ROOT, CHANGELOG), logNext);
  touched.push(CHANGELOG);
}

console.log(`${released} (${REF}) → ${next}`);
for (const f of touched) console.log(`  stamped ${f}`);

if (AMEND) {
  if (!git('rev-parse', '--verify', '--quiet', 'HEAD')) {
    console.error('REFUSED: --amend with no commit to amend.');
    process.exit(1);
  }
  // Explicit paths only. `git add -A` in this shared checkout is how every
  // sweep incident in this repo started.
  if (touched.length) execFileSync('git', ['add', ...touched], { cwd: ROOT });
  execFileSync('git', ['commit', '--amend', '--no-edit'], { cwd: ROOT, stdio: 'inherit' });
  console.log(`amended ${git('log', '--oneline', '-1')}`);
}
