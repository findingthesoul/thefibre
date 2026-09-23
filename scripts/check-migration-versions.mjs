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
// Run by `pnpm verify`, so a release cannot carry a duplicate.
//   node scripts/check-migration-versions.mjs
// Exit 0 clean · 1 duplicate found · 2 could not look (never mistaken for clean).

import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = /^(\d{14})_.+\.sql$/;

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
    console.log(`migration versions: ${versions} unique across ${dirs.length} checkout(s)`);
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
