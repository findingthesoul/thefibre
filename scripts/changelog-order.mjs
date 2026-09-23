#!/usr/bin/env node
// Is the changelog in order, and does any number appear twice?
//
//   node scripts/changelog-order.mjs          # report; exit 1 if wrong
//   node scripts/changelog-order.mjs --fix    # sort the entries, lossless
//
// ── Why ─────────────────────────────────────────────────────────────────────
//
// Entries are inserted at the top by whoever releases, and rebases land them
// wherever the merge put them. Nothing ever sorted them, so the permanent
// record drifted out of order — and that is not cosmetic. `release-guard.sh`
// read the TOPMOST heading as "the last release", so on 2026-09-24, with
// 1.26.0 sitting above 1.27.0, it cleared 1.26.1: a number LOWER than what
// was already released, approved by the check that exists to stop collisions.
//
// That symptom is fixed (both scripts now take the highest of the branch
// manifest and every heading). This is the CONDITION that produced it, and
// the thing a human actually reads.
//
// Three duplicate headings were already in the file from earlier collisions
// nobody noticed — 0.59.0, 0.59.2, 0.68.5. Sorting puts each pair adjacent,
// where they are at least visible. They are NOT merged here: they are two
// real releases that took one number, and rewriting history to tidy that
// would lose what happened.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();
const FILE = resolve(ROOT, 'CHANGELOG.md');
const FIX = process.argv.includes('--fix');

const src = readFileSync(FILE, 'utf8');
const lines = src.split('\n');

// Where each release heading starts. Everything before the first one is the
// preamble and never moves.
const starts = [];
lines.forEach((l, i) => {
  const m = l.match(/^## \[(\d+\.\d+\.\d+)\]/);
  if (m) starts.push({ version: m[1], at: i });
});

if (starts.length === 0) {
  console.error('No release headings found — is this the right file?');
  process.exit(2);
}

const cmp = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pb[i] - pa[i]; // newest first
  return 0;
};

const preamble = lines.slice(0, starts[0].at);
const blocks = starts.map((s, i) => ({
  version: s.version,
  lines: lines.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : lines.length),
}));

const versions = blocks.map((b) => b.version);
const sorted = [...versions].sort(cmp);
const inOrder = versions.every((v, i) => v === sorted[i]);
const dupes = [...new Set(versions.filter((v, i) => versions.indexOf(v) !== i))];

if (!FIX) {
  if (inOrder && dupes.length === 0) {
    console.log(`CHANGELOG: ${versions.length} entries, in order, no duplicates.`);
    process.exit(0);
  }
  if (!inOrder) {
    console.error('CHANGELOG is OUT OF ORDER — the top entry is not the newest release.');
    console.error(`  first six: ${versions.slice(0, 6).join(' ')}`);
    console.error('  fix:  node scripts/changelog-order.mjs --fix');
  }
  if (dupes.length) {
    console.error(`CHANGELOG has DUPLICATE headings: ${dupes.join(', ')}`);
    console.error('  two releases took one number. Sorting makes each pair adjacent;');
    console.error('  they are not merged, because both happened.');
  }
  process.exit(1);
}

// ── --fix, losslessly ───────────────────────────────────────────────────────
// Blocks are moved, never edited. The assertions below are the whole reason
// this is safe to run on a file three sessions have written to: every line
// that went in comes out, and only the ORDER differs.
const reordered = [...blocks].sort((a, b) => cmp(a.version, b.version));
const out = [...preamble, ...reordered.flatMap((b) => b.lines)].join('\n');

const before = [...lines].sort().join('\n');
const after = [...out.split('\n')].sort().join('\n');
if (before !== after) {
  console.error('REFUSED: the sorted file is not a permutation of the original. Nothing written.');
  process.exit(1);
}
if (out === src) {
  console.log('CHANGELOG already in order — nothing written.');
  process.exit(0);
}
writeFileSync(FILE, out);
console.log(`CHANGELOG reordered: ${versions.length} entries, same lines, newest first.`);
if (dupes.length) console.log(`  duplicates now adjacent and visible: ${dupes.join(', ')}`);
