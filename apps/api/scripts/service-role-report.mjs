#!/usr/bin/env node
// How much of the API reaches the database as the service role, and how much
// of that has the workspace bound in. Reproducible: it reads the source and
// nothing else.
//
//   node apps/api/scripts/service-role-report.mjs                 # totals
//   node apps/api/scripts/service-role-report.mjs --by-file       # per file, densest first
//   node apps/api/scripts/service-role-report.mjs --list          # every use, file:line key
//   node apps/api/scripts/service-role-report.mjs --exceptions    # every serviceRole('reason')
//   node apps/api/scripts/service-role-report.mjs --write-baseline
//
// --write-baseline LOWERS the ratchet to what the tree holds now. Run it after
// converting a module to tenantDb, in the same commit. It refuses to raise any
// count: new code goes through tenantDb or serviceRole(), never the baseline.

import { writeFileSync } from 'node:fs';
import { BASELINE_FILE, countByFileAndKey, overBaseline, readBaseline, scan } from './lib/service-role-scan.mjs';

const args = new Set(process.argv.slice(2));
const { uses, exceptions } = scan();

if (args.has('--write-baseline')) {
  let base = {};
  try {
    base = readBaseline();
  } catch {
    /* first write */
  }
  const over = Object.keys(base).length ? overBaseline(uses, base) : [];
  if (over.length && !args.has('--initial')) {
    console.error('Refusing: these would RAISE the baseline. Convert them to tenantDb/serviceRole first:');
    for (const o of over) console.error(`  ${o.file}  ${o.key}  ${o.allowed} → ${o.count}`);
    process.exit(1);
  }
  writeFileSync(BASELINE_FILE, JSON.stringify(countByFileAndKey(uses), null, 1) + '\n');
  console.log(`baseline written: ${uses.length} raw uses in ${new Set(uses.map((u) => u.file)).size} files`);
  process.exit(0);
}

if (args.has('--list')) {
  for (const u of uses) console.log(`${u.file}:${u.line}\t${u.key}${u.workspaceFiltered ? '\t(workspace_id by hand)' : ''}`);
  process.exit(0);
}

if (args.has('--exceptions')) {
  for (const e of exceptions) console.log(`${e.file}:${e.line}\t${e.ok ? '' : 'NO REASON\t'}${e.reason ?? '(not a literal)'}`);
  process.exit(0);
}

const queries = uses.filter((u) => /\.(select|insert|upsert|update|delete|from)$/.test(u.key));
const byHand = queries.filter((u) => u.workspaceFiltered).length;
const files = new Set(uses.map((u) => u.file));
console.log(`raw service-role uses:         ${uses.length} in ${files.size} files`);
console.log(`  of which table queries:      ${queries.length} (${byHand} filter workspace_id by hand, ${queries.length - byHand} do not)`);
console.log(`  rpc / storage / auth / other: ${uses.length - queries.length}`);
console.log(`serviceRole('reason') uses:    ${exceptions.length}${exceptions.some((e) => !e.ok) ? ` (${exceptions.filter((e) => !e.ok).length} without a valid reason)` : ''}`);

if (args.has('--by-file')) {
  const counts = Object.entries(countByFileAndKey(uses))
    .map(([f, k]) => [f, Object.values(k).reduce((a, b) => a + b, 0)])
    .sort((a, b) => b[1] - a[1]);
  console.log('');
  for (const [f, n] of counts) console.log(`${String(n).padStart(5)}  ${f}`);
}
