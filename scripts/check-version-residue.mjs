#!/usr/bin/env node
// Is the working tree holding a version stamp from a release that never
// happened?
//
// ── What went wrong ─────────────────────────────────────────────────────────
//
// `next-version.mjs` stamps sixteen files — every manifest, plus
// apps/web/lib/version.ts — and `release.sh` commits them. If the release is
// then amended, reset or simply abandoned, THE STAMP STAYS IN THE TREE. On
// 2026-09-25 a v1.60.0 release was amended and left every manifest sitting at
// 1.60.1, uncommitted, in the SHARED main checkout. They were still there on
// 2026-09-27, seventeen releases later. Anything that committed them — a
// release run from that checkout, or one `git add -A` — would have regressed
// every manifest and the sidebar footer from 1.77.0 to 1.60.1, and the number
// would have gone BACKWARDS in a release nobody could see was wrong, because
// the files it touched are the files every release touches.
//
// Nothing noticed for two days. `git status` showed fourteen modified
// manifests, which is what a release in progress looks like.
//
// ── The rule ───────────────────────────────────────────────────────────────
//
// An UNCOMMITTED version stamp is legitimate only while it is going UP. A
// real release stamps a number greater than what is released and commits it
// within the minute; residue is a number less than or equal to it, sitting
// there. So: refuse an uncommitted manifest version that is not strictly
// greater than the released version.
//
// That is why this is safe inside `pnpm verify`, which `release.sh` runs
// AFTER stamping and BEFORE committing: mid-release the stamp is higher and
// this passes. It is also why a clean tree — a worktree parked at an old sha
// for a deploy, say — is never a finding: there is nothing uncommitted to
// judge.
//
// It reads the LOCAL origin/staging ref and does not fetch. A ref a few
// releases stale still catches this, the whole failure mode being a stamp
// that is many releases behind, and verify is slow enough already.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The checkout this was INVOKED in, not the one the script file happens to
// live in. They are the same in every real use — each worktree has its own
// scripts/ — but deriving it from the file made the script uncheckable
// against a throwaway repo, and a guard nobody can test is a guard nobody
// trusts.
const ROOT = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return resolve(dirname(fileURLToPath(import.meta.url)), '..');
  }
})();
const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  } catch {
    return '';
  }
};

/** Newest first. */
const cmp = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

const REF = git(['rev-parse', '--verify', '--quiet', 'origin/staging']).trim()
  ? 'origin/staging'
  : git(['rev-parse', '--verify', '--quiet', 'origin/main']).trim()
    ? 'origin/main'
    : null;
if (!REF) {
  console.log('version residue: no origin ref to compare against — skipped.');
  process.exit(0);
}

let released;
try {
  released = JSON.parse(git(['show', `${REF}:package.json`])).version;
} catch {
  released = '';
}
if (!/^\d+\.\d+\.\d+$/.test(released ?? '')) {
  console.log(`version residue: could not read the released version from ${REF} — skipped.`);
  process.exit(0);
}

/** The version a manifest or the VERSION constant declares, or ''. */
function versionIn(src, f) {
  if (f.endsWith('version.ts')) {
    return src.match(/VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/)?.[1] ?? '';
  }
  try {
    return JSON.parse(src).version ?? '';
  } catch {
    return '';
  }
}

// Uncommitted version manifests, and what they now say.
const changed = git(['diff', '--name-only', 'HEAD', '--', '*package.json', 'apps/web/lib/version.ts'])
  .split('\n')
  .filter(Boolean);

const stale = [];
for (const f of changed) {
  // The file ON DISK, not `git show :<f>`. The residue was unstaged, and so is
  // a release's own stamp when `release.sh` runs verify — reading the index
  // would have compared HEAD against HEAD and refused every real release
  // while catching the residue by accident.
  let src = '';
  try {
    src = readFileSync(resolve(ROOT, f), 'utf8');
  } catch {
    continue; // deleted in the working tree
  }
  const m = [null, versionIn(src, f)];
  const v = m?.[1];
  if (!v || !/^\d+\.\d+\.\d+$/.test(v)) continue;

  // Only the VERSION FIELD being touched is evidence of a stamp. A manifest
  // modified for anything else — a dependency added while sitting at the
  // released number — is not residue, and refusing it would make this the
  // kind of gate people switch off.
  const head = versionIn(git(['show', `HEAD:${f}`]) || '', f);
  if (head === v) continue;

  if (cmp(v, released) <= 0) stale.push({ f, v, head });
}

if (stale.length === 0) {
  console.log(`version residue: none (released ${released} on ${REF}).`);
  process.exit(0);
}

console.error('');
console.error('REFUSED: the working tree holds a version stamp that is not newer than what shipped.');
console.error(`  released on ${REF}: ${released}`);
for (const s of stale) console.error(`  ${s.f} — ${s.head} → ${s.v}`);
console.error('');
console.error('  This is what an abandoned release leaves behind. Committing it sends every');
console.error('  manifest and the sidebar footer BACKWARDS, in a commit that looks exactly');
console.error('  like a release.');
console.error('');
console.error('  If you are releasing:  node scripts/next-version.mjs --amend');
console.error('  If you are not:        git checkout -- <the files above>');
console.error('');
process.exit(1);
