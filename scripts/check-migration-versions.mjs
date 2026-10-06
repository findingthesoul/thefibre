#!/usr/bin/env node
// Two migrations must never share a version.
//
// Supabase's migration history is keyed on the 14-digit VERSION and nothing
// else (`supabase migration repair <version>` takes only those digits).
// CLAUDE.md's older line — "tracks applied migrations by filename, not
// checksum" — means "not by content hash", and was read as "by the whole
// name", which is how this bit us.
//
// What actually happens with a duplicate: whichever file is pushed SECOND is
// treated as already applied. `supabase db push` skips it, lists only its
// siblings, and EXITS 0. The table is simply never created, and every log
// says success. On production that is code shipped against a schema that
// never changed. It happened on 2026-09-23 between two sessions writing in
// different apps on the same day: 20260923140000 twice.
//
// The lane protocol cannot see this. It fences by DIRECTORY, and these two
// sessions touched no common file — they collided through the migration
// history, which lives outside the repo. So this check reads EVERY worktree's
// supabase/migrations, not just this one's, and that is the whole point of it.
//
// And a migration must never be OLDER than one already on staging.
//
// Supabase applies in version order, and a plain `supabase db push` (what
// db-push-staging.sh and db-push-prod.sh run) REFUSES a file that sorts
// before an already-applied one unless told --include-all. So a commit whose
// new migration carries an older version than the newest on origin/staging
// passed every gate and failed at the push — after it was on staging, where
// everybody else then built on it (membership 2026-10-04, Meet 2026-10-06).
// The cause is always the same: a hand-picked timestamp, or a worktree that
// branched before a peer's migration landed. Here it is refused at verify,
// naming both versions. `./scripts/new-migration.sh` never picks one behind
// the newest it can see.
//
// Run by `pnpm verify`, so a release cannot carry a duplicate or an older one.
//   node scripts/check-migration-versions.mjs
// Exit 0 clean · 1 duplicate or out of order · 2 could not look (never mistaken for clean).

import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = /^(\d{14})_.+\.sql$/;
const STAGING = 'origin/staging';

/** The clash test itself, separate from the filesystem so it can be tested:
 *  the SAME file seen in two checkouts is one migration, two DIFFERENT files
 *  on one version are the silent-skip bug. */
export function clashesIn(listing) {
  const seen = new Map(); // version -> [{file, label}]
  for (const { label, files } of listing) {
    for (const name of files) {
      const m = VERSION.exec(name);
      if (!m) continue;
      const list = seen.get(m[1]) ?? [];
      if (list.some((e) => e.file === name)) continue;
      list.push({ file: name, label });
      seen.set(m[1], list);
    }
  }
  return {
    versions: seen.size,
    clashes: [...seen.entries()].filter(([, list]) => list.length > 1),
  };
}

/** The ordering test, also separate from git so it can be tested: a file in
 *  this checkout that is NOT on staging and whose version sorts before the
 *  newest that IS. A file already on staging is never late, whatever its
 *  version — it is applied, and its number is history. */
export function outOfOrder(localFiles, stagingFiles) {
  const onStaging = new Set(stagingFiles.filter((f) => VERSION.test(f)));
  let newest = null;
  for (const f of onStaging) {
    const v = VERSION.exec(f)[1];
    if (newest === null || v > newest) newest = v;
  }
  const late = [];
  if (newest !== null) {
    for (const f of localFiles) {
      const m = VERSION.exec(f);
      if (!m || onStaging.has(f)) continue;
      if (m[1] < newest) late.push({ file: f, version: m[1] });
    }
  }
  return { newest, late };
}

/** Basenames of the migrations on origin/staging, as git holds them — the
 *  local tree can be behind or ahead; the remote-tracking ref is what the
 *  next push will be measured against. Throws when the ref is not there. */
function stagingMigrations() {
  const out = execFileSync('git', ['ls-tree', '--name-only', STAGING, '--', 'supabase/migrations/'], {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.split('\n').filter(Boolean).map((p) => p.split('/').pop());
}

/** Every checkout that can hold migrations: this repo, plus each worktree
 *  under .claude/worktrees. A worktree's own run sees its siblings too, so it
 *  does not matter which one a session is in. */
function migrationDirs() {
  const dirs = [];
  const here = join(repo, 'supabase', 'migrations');
  if (existsSync(here)) dirs.push({ label: 'this checkout', dir: here });
  // From a worktree, .claude/worktrees lives in the MAIN checkout; git tells
  // us where that is via the .git file, but reading the tree is enough here:
  // both layouts put worktrees at <main>/.claude/worktrees/<name>.
  const roots = [repo, resolve(repo, '..', '..', '..')];
  for (const root of roots) {
    const wt = join(root, '.claude', 'worktrees');
    if (!existsSync(wt)) continue;
    for (const name of readdirSync(wt)) {
      const dir = join(wt, name, 'supabase', 'migrations');
      if (dir === here || !existsSync(dir)) continue;
      // The PATH, not just the name: a cross-checkout clash means somebody
      // else is holding an unpushed migration, and the useful next step is
      // to go to that directory and talk to whoever is in it (thefibre-0f,
      // 2026-09-23).
      dirs.push({ label: `worktree ${name} — ${join(wt, name)}`, dir });
    }
  }
  return dirs;
}

// CLI (imported-as-module runs nothing — the same import.meta guard
// scripts/vercel-ignore.mjs uses, so the rule above can be unit-tested).
const RUN_AS_CLI =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '');

if (RUN_AS_CLI) {
  let dirs;
  try {
    dirs = migrationDirs();
  } catch (e) {
    console.error(`migration versions: COULD NOT CHECK — ${e.message}`);
    console.error('This is not a duplicate. Nothing was compared.');
    process.exit(2);
  }
  if (dirs.length === 0) {
    console.error('migration versions: COULD NOT CHECK — no supabase/migrations found');
    process.exit(2);
  }

  const listing = dirs.map(({ label, dir }) => ({ label, files: readdirSync(dir) }));
  const { versions, clashes } = clashesIn(listing);
  if (clashes.length === 0) {
    // Ordering: THIS checkout's new files against what staging already holds.
    // Only this checkout — a sibling worktree's unpushed file is its own
    // session's problem, and its verify will say so.
    let staging;
    try {
      staging = stagingMigrations();
    } catch (e) {
      console.error(`migration order: COULD NOT CHECK — ${STAGING} not readable here (${e.message.trim().split('\n')[0]})`);
      console.error('This is not a pass. `git fetch origin staging` and run again.');
      process.exit(2);
    }
    const { newest, late } = outOfOrder(listing[0].files, staging);
    if (late.length > 0) {
      console.error(`REFUSED: a new migration is OLDER than the newest already on ${STAGING}.`);
      console.error('Supabase applies in version order, and `supabase db push` refuses a file that');
      console.error('sorts before an applied one — so this would pass every gate and fail at the');
      console.error('push, after it is on staging (membership 2026-10-04, Meet 2026-10-06).\n');
      for (const e of late) console.error(`  ${e.version}   ${e.file}`);
      console.error(`  newest on ${STAGING}: ${newest}\n`);
      console.error('Renumber with ./scripts/new-migration.sh <name> (it never picks a version behind');
      console.error('the newest it can see), move the SQL into the new file, delete the old one.');
      process.exit(1);
    }
    console.log(`migration versions: ${versions} unique across ${dirs.length} checkout(s); none older than ${STAGING}'s newest${newest ? ` (${newest})` : ''}`);
    process.exit(0);
  }

  console.error('REFUSED: two migrations share a version.');
  console.error('Supabase keys its history on the digits alone, so the second one');
  console.error('would be SKIPPED SILENTLY and its table never created.\n');
  for (const [version, list] of clashes) {
    console.error(`  ${version}`);
    for (const e of list) console.error(`      ${e.file}   (${e.label})`);
  }
  console.error('\nRenumber the one that is NOT yet applied anywhere:');
  console.error('    ./scripts/new-migration.sh <name>   # picks a free version for you');
  console.error('If one is already applied to a remote, that is the one that keeps its number.');
  console.error('');
  console.error('Do NOT run the `supabase migration repair --status reverted <version>`');
  console.error('the CLI suggests: it points at whichever migration is genuinely applied,');
  console.error('usually somebody else\'s. Renumber the unapplied file instead.');
  process.exit(1);
}
