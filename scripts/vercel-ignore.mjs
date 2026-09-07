#!/usr/bin/env node
// Vercel "Ignored Build Step" for the monorepo (wired via each app's
// vercel.json `ignoreCommand`). Exit 0 = skip the build, exit 1 = build.
//
// Why: every release used to rebuild ALL SIX apps on BOTH branches — on
// 2026-09-05 (13 releases) that was ~150 builds, most for apps that hadn't
// changed. €150 of Vercel usage in five days.
//
// An app rebuilds when the diff of the pushed commit touches:
//   - its own folder (apps/<app>), EXCLUDING its package.json — the release
//     ritual bumps every app's version field every time, which would defeat
//     the whole check; real dependency changes also touch pnpm-lock.yaml,
//     which IS included.
//   - packages/shared (same package.json exclusion, same reasoning — new
//     exports always come with new src files).
//   - pnpm-lock.yaml or pnpm-workspace.yaml (dependency graph changed).
//
// Diff base: Vercel builds once per PUSH, not per commit — HEAD^ would miss
// an app-touching commit buried in a multi-commit push (e.g. fix + version
// stamp). VERCEL_GIT_PREVIOUS_SHA (the branch's last deployed sha) is the
// correct base when set and present in the clone; HEAD^ is the fallback.
//
// Safety: any doubt (no usable base, git error, unknown app) → build.

import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Pure decision functions — exported for tests (scripts/vercel-ignore.test.mjs
// locks the safety posture: any doubt → build). The CLI below wires them to
// git/env; behavior is identical to the pre-extraction script.
// ---------------------------------------------------------------------------

/** Is the arg a plausible app folder name? Anything else → build to be safe. */
export function validApp(app) {
  return typeof app === 'string' && /^[a-z-]+$/.test(app);
}

/**
 * Pick the diff base. `prevSha` is VERCEL_GIT_PREVIOUS_SHA (the branch's
 * last DEPLOYED sha — the correct base for a multi-commit push); `probe`
 * answers whether a candidate exists in this (possibly shallow) clone:
 * { commitExists(sha), hasParent() }. Returns the base or null (= no usable
 * base → build).
 */
export function pickBase(prevSha, probe) {
  if (prevSha && /^[0-9a-f]{7,40}$/i.test(prevSha) && probe.commitExists(prevSha)) {
    return prevSha;
  }
  return probe.hasParent() ? 'HEAD^' : null;
}

/**
 * The pathspecs whose diff forces a build for `app`: the app's folder and
 * packages/shared (each EXCLUDING its package.json — the release ritual
 * bumps every version field every time; real dependency changes also touch
 * pnpm-lock.yaml, which IS included) plus the lockfile/workspace files.
 */
export function changePaths(app) {
  return [
    `apps/${app}`,
    `:(exclude)apps/${app}/package.json`,
    'packages/shared',
    ':(exclude)packages/shared/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ];
}

// ---------------------------------------------------------------------------
// CLI (imported-as-module runs nothing — the import.meta guard below).
// ---------------------------------------------------------------------------

const invokedDirectly =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '');
if (!invokedDirectly) {
  // Imported for its pure functions (tests) — do nothing.
} else {
  main();
}

function main() {
const app = process.argv[2];
if (!validApp(app)) {
  console.log(`[vercel-ignore] no/invalid app arg (${app}) — building to be safe`);
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

let root;
try {
  root = run('git rev-parse --show-toplevel');
} catch {
  console.log('[vercel-ignore] not a git checkout — building');
  process.exit(1);
}

const base = pickBase(process.env.VERCEL_GIT_PREVIOUS_SHA, {
  commitExists: (sha) => {
    try {
      run(`git -C ${JSON.stringify(root)} cat-file -e ${sha}^{commit}`);
      return true;
    } catch {
      return false; // previous deploy's sha isn't in this (shallow) clone
    }
  },
  hasParent: () => {
    try {
      run(`git -C ${JSON.stringify(root)} rev-parse HEAD^`);
      return true;
    } catch {
      return false;
    }
  },
});
if (!base) {
  console.log('[vercel-ignore] no usable diff base — building');
  process.exit(1);
}

const paths = changePaths(app);

try {
  execSync(
    `git -C ${JSON.stringify(root)} diff --quiet ${base} HEAD -- ${paths.map((p) => JSON.stringify(p)).join(' ')}`,
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  console.log(`[vercel-ignore] no changes for ${app} since ${base} — skipping build`);
  process.exit(0);
} catch {
  console.log(`[vercel-ignore] changes detected for ${app} — building`);
  process.exit(1);
}
}
