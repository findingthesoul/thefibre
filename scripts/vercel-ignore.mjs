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
// Safety: any doubt (no parent commit, git error, unknown app) → build.

import { execSync } from 'node:child_process';

const app = process.argv[2];
if (!app || !/^[a-z-]+$/.test(app)) {
  console.log(`[vercel-ignore] no/invalid app arg (${app}) — building to be safe`);
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

let root;
try {
  root = run('git rev-parse --show-toplevel');
  run('git rev-parse HEAD^');
} catch {
  console.log('[vercel-ignore] no parent commit / not a git checkout — building');
  process.exit(1);
}

const paths = [
  `apps/${app}`,
  `:(exclude)apps/${app}/package.json`,
  'packages/shared',
  ':(exclude)packages/shared/package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
];

try {
  execSync(
    `git -C ${JSON.stringify(root)} diff --quiet HEAD^ HEAD -- ${paths.map((p) => JSON.stringify(p)).join(' ')}`,
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  console.log(`[vercel-ignore] no changes for ${app} — skipping build`);
  process.exit(0);
} catch {
  console.log(`[vercel-ignore] changes detected for ${app} — building`);
  process.exit(1);
}
