#!/usr/bin/env node
// Does .env.example name what the code reads?
//
//   node scripts/check-env-example.mjs           # report, exit 1 on a gap
//   node scripts/check-env-example.mjs --list    # every name, with one file that reads it
//
// Written 2026-10-01, when .env.example was found "groomed 2026-07-07" and
// three months behind: about half the names the code reads were missing from
// it, and it still told a newcomer to set names nothing reads. A file like
// that goes stale silently, so this reads the other side: every
// `process.env.NAME` (and `env.NAME` / `env['NAME']` in the modules that take
// env as an argument) in the RUNNING code: apps/* and packages/*, without
// their scripts/ folders and without tests. A script's variables
// (FIBRE_ENV_FILE, FIBRE_API, the *_CONFIRM switches) are flags somebody types
// on a command line, documented in the script that reads them; .env.example
// is for what a process needs in order to start.
//
// NOT part of `pnpm verify` yet. Wiring it in makes every new env var a
// release gate for every session, which is a decision, not a side effect.
//
// It checks NAMES only and never reads a real .env file.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['scripts', 'e2e', 'integration', 'node_modules', '.next', 'dist', '.turbo', '.vercel', '.git', '.claude', 'coverage', 'test-results', 'playwright-report']);
const EXT = /\.(ts|tsx|mjs|js|cjs)$/;
const TEST = /\.(test|spec)\.[a-z]+$/;

// Set by the platform or the toolchain, never by a person in an env file.
const AMBIENT = new Set([
  'NODE_ENV', 'CI', 'PATH', 'HOME', 'PWD', 'TZ', 'PORT', 'NODE_OPTIONS', 'npm_package_version',
  'FLY_APP_NAME', 'FLY_MACHINE_ID', 'FLY_REGION', 'FLY_ALLOC_ID',
  'VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_REF', 'VERCEL_GIT_PREVIOUS_SHA',
  'NEXT_RUNTIME', 'NEXT_PHASE', 'GITHUB_ACTIONS', 'GITHUB_SHA', 'GITHUB_REF',
  // The MCP command-line client (packages/mcp/src/cli.ts) is run by somebody
  // OUTSIDE this system with their own key; docs/mcp.md documents these.
  'FIBRE_APP_KEY', 'FIBRE_API',
]);

/** name → first file that reads it */
const read = new Map();

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (EXT.test(entry) && !TEST.test(entry)) scan(full);
  }
}

function scan(file) {
  const source = readFileSync(file, 'utf8');
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]+)/g,
    /process\.env\[['"]([A-Z][A-Z0-9_]+)['"]\]/g,
    /\benv\??\.([A-Z][A-Z0-9_]{3,})\b/g,
    /\benv\??\[['"]([A-Z][A-Z0-9_]{3,})['"]\]/g,
    // branding.ts names the per-app URL variables as data: urlEnv: 'NEXT_PUBLIC_…'
    /urlEnv:\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
  ];
  const seen = (name) => {
    // `NEXT_PUBLIC_` alone is a prefix somebody is testing for, not a name.
    if (name.endsWith('_')) return;
    if (!read.has(name)) read.set(name, relative(root, file));
  };
  for (const re of patterns) {
    for (const m of source.matchAll(re)) seen(m[1]);
  }
  // const { A: a, B } = process.env
  for (const m of source.matchAll(/\{([^{}]*)\}\s*=\s*process\.env\b/g)) {
    for (const n of m[1].matchAll(/\b([A-Z][A-Z0-9_]{3,})\b/g)) seen(n[1]);
  }
  // A name chosen at run time: const name = cond ? 'A_SECRET' : 'B_SECRET'; process.env[name]
  if (/process\.env\[[a-z]/.test(source)) {
    for (const m of source.matchAll(/['"]([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)['"]/g)) seen(m[1]);
  }
}

for (const top of ['apps', 'packages']) {
  try {
    walk(join(root, top));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

const example = readFileSync(join(root, '.env.example'), 'utf8');
const named = new Set();
for (const line of example.split('\n')) {
  // A name counts whether it is set (`NAME=`) or offered commented out (`# NAME=`).
  const m = /^#?\s*([A-Z][A-Z0-9_]+)=/.exec(line);
  if (m) named.add(m[1]);
}

const names = [...read.keys()].filter((n) => !AMBIENT.has(n)).sort();

if (process.argv.includes('--list')) {
  for (const n of names) console.log(`${named.has(n) ? ' ' : '!'} ${n.padEnd(44)} ${read.get(n)}`);
  process.exit(0);
}

const missing = names.filter((n) => !named.has(n));
const unread = [...named].filter((n) => !read.has(n)).sort();

console.log(`.env.example names ${named.size}; the code reads ${names.length} (ambient ones excluded).`);
if (missing.length) {
  console.log(`\nRead by the code, missing from .env.example (${missing.length}):`);
  for (const n of missing) console.log(`  ${n.padEnd(44)} ${read.get(n)}`);
}
if (unread.length) {
  console.log(`\nIn .env.example, read by nothing (${unread.length}):`);
  for (const n of unread) console.log(`  ${n}`);
}
if (!missing.length && !unread.length) console.log('In agreement.');
process.exit(missing.length || unread.length ? 1 : 0);
