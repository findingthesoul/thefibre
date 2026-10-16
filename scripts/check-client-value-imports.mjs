#!/usr/bin/env node
// Refuse a SERVER file in a Next app that imports a non-component VALUE from a
// 'use client' module.
//
// On the server such an import is a client reference, not the value: an
// array arrives as a proxy and `.includes(...)` throws, so the page renders
// "Application error" on every request. Neither typecheck nor `next build`
// notices, because neither renders the page. It shipped twice on 2026-10-16:
// my.thread's You tabs (v1.248.2, YOU_TABS) and Members' Google addresses
// (v1.250.0, GA_STATUSES). Both were found only by an e2e on staging.
//
// The rule: components (PascalCase) and hooks may cross; anything else a
// server file needs lives in a plain module beside it. Test files are not
// rendered by React and are skipped. Exit 1 lists every offender.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const files = execSync("git ls-files 'apps/*/app/**/*.tsx' 'apps/*/app/**/*.ts' 'apps/*/components/**/*.tsx' 'apps/*/components/**/*.ts'", { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter((f) => f && !/\.test\.tsx?$/.test(f));

const CLIENT = /^\s*(?:\/\/[^\n]*\n\s*)*['"]use client['"]/;
const clientCache = new Map();
const isClient = (f) => {
  if (!clientCache.has(f)) clientCache.set(f, existsSync(f) && CLIENT.test(readFileSync(f, 'utf8')));
  return clientCache.get(f);
};

export function offenders(list = files, read = (f) => readFileSync(f, 'utf8'), clientCheck = isClient) {
  const out = [];
  for (const f of list) {
    if (clientCheck(f)) continue;
    const src = read(f);
    for (const m of src.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"](\.[^'"]+)['"]/g)) {
      const base = resolve(dirname(f), m[2]);
      const target = [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`].find((p) => /\.tsx?$/.test(p) && existsSync(p));
      if (!target || !clientCheck(target)) continue;
      const values = m[1]
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x && !x.startsWith('type '))
        .map((x) => x.split(/\s+as\s+/)[0])
        .filter((n) => !/^[A-Z][a-z0-9]/.test(n) && !/^use[A-Z]/.test(n));
      if (values.length) out.push(`${f} imports ${values.join(', ')} from the client module ${m[2]}`);
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bad = offenders();
  if (bad.length) {
    console.error('REFUSED: a server file imports a VALUE from a \'use client\' module (it arrives as a client reference and the page throws):');
    for (const b of bad) console.error(`  ${b}`);
    console.error('Move the value into a plain module beside it and import it from there in both files.');
    process.exit(1);
  }
  console.log(`client-value imports: none across ${files.length} files`);
}
