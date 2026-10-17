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
//
// Imports followed: RELATIVE ones and the app alias `@/…` (each app's own
// tsconfig `paths`, `@/*` → the app root; 2026-10-17), to a file or to a
// directory's index. KNOWN LIMITS, on purpose: default imports and
// PascalCase non-component values (a `Statuses` object) pass, and package
// imports (`@thefibre/shared/…`) are not followed — shared's client modules
// export components and hooks, and a value there would need its own rule.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const CLIENT = /^\s*(?:\/\/[^\n]*\n\s*)*['"]use client['"]/;

/** `@/` → the app root, as that app's tsconfig maps it (`./*` everywhere
 *  today). Null when the file is not in an app or the app has no alias. */
const aliasCache = new Map();
function aliasRoot(file, read) {
  const m = file.match(/^(.*?(?:^|\/)apps\/[^/]+)\//);
  if (!m) return null;
  const app = m[1];
  if (!aliasCache.has(app)) {
    let target = null;
    try {
      const ts = read(join(app, 'tsconfig.json'));
      const hit = ts.match(/"@\/\*"\s*:\s*\[\s*"([^"]*)\*"/);
      if (hit) target = resolve(app, hit[1] || '.');
    } catch {
      /* no tsconfig: no alias */
    }
    aliasCache.set(app, target);
  }
  return aliasCache.get(app);
}

/** The file an import names: relative or `@/`, to a file or a directory index. */
export function resolveImport(from, spec, read, exists) {
  let base;
  if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else if (spec.startsWith('@/')) {
    const root = aliasRoot(from, read);
    if (!root) return null;
    base = resolve(root, spec.slice(2));
  } else return null;
  return [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`].find((p) => /\.tsx?$/.test(p) && exists(p)) ?? null;
}

export function offenders(list, read = (f) => readFileSync(f, 'utf8'), exists = existsSync) {
  const clientCache = new Map();
  const isClient = (f) => {
    if (!clientCache.has(f)) clientCache.set(f, exists(f) && CLIENT.test(read(f)));
    return clientCache.get(f);
  };
  const out = [];
  for (const f of list) {
    if (isClient(f)) continue;
    const src = read(f);
    for (const m of src.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]((?:\.|@\/)[^'"]+)['"]/g)) {
      const target = resolveImport(f, m[2], read, exists);
      if (!target || !isClient(target)) continue;
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
  const files = execSync("git ls-files 'apps/*/app/**/*.tsx' 'apps/*/app/**/*.ts' 'apps/*/components/**/*.tsx' 'apps/*/components/**/*.ts'", { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((f) => f && !/\.test\.tsx?$/.test(f));
  const bad = offenders(files);
  if (bad.length) {
    console.error('REFUSED: a server file imports a VALUE from a \'use client\' module (it arrives as a client reference and the page throws):');
    for (const b of bad) console.error(`  ${b}`);
    console.error('Move the value into a plain module beside it and import it from there in both files.');
    process.exit(1);
  }
  console.log(`client-value imports: none across ${files.length} files`);
}
