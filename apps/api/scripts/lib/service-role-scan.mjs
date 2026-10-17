// Every place the API reaches the database as the service role, read from
// the source with the TypeScript parser — no regexes, no running code.
//
// The service-role client (`adminClient`, src/db.ts) is not seen by row level
// security, so on every query made with it the route itself is the boundary
// between workspaces (handbook §2). This scanner is how that boundary is
// measured, and the measurement is reproducible by anyone with the repo:
//
//   node apps/api/scripts/service-role-report.mjs          # the numbers
//   node apps/api/scripts/service-role-report.mjs --list   # every use, file:line
//
// Read by src/lib/service-role-boundary.test.ts, the ratchet: a NEW raw use
// fails the release; the old ones are on a baseline that only shrinks.
//
// What counts as a use: every reference to `adminClient` (or a local alias
// of it — `import { adminClient as db }`, `const db = adminClient`) in
// apps/api/src, except
//   - src/db.ts, which creates it, and src/lib/tenant-db.ts, the accessor
//     that binds the workspace in;
//   - tests (`*.test.ts`, src/integration/), which run against staging
//     fixtures, not requests;
//   - apps/api/scripts, which are operator tools run by hand, not routes.
// `serviceRole('<reason>')` from lib/tenant-db.ts is the named exception: it
// is counted separately, with its reason, and is not a violation.

import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';

export const SRC = resolve(import.meta.dirname, '../../src');
const EXEMPT = new Set(['db.ts', 'lib/tenant-db.ts']);
const VERBS = new Set(['select', 'insert', 'upsert', 'update', 'delete']);
export const MIN_REASON = 12;

function sourceFiles(dir = SRC) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) {
      if (relative(SRC, p) === 'integration' || e.name === 'node_modules') continue;
      out.push(...sourceFiles(p));
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') && !e.name.endsWith('.d.ts')) {
      out.push(p);
    }
  }
  return out.sort();
}

const literal = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);

/** Walk up a builder chain (`x.from(t).select().eq()…`): the method names and
 *  first arguments, outward from `node`. */
function chainAbove(node) {
  const steps = [];
  let cur = node;
  while (
    cur.parent &&
    ts.isPropertyAccessExpression(cur.parent) &&
    cur.parent.expression === cur &&
    cur.parent.parent &&
    ts.isCallExpression(cur.parent.parent) &&
    cur.parent.parent.expression === cur.parent
  ) {
    const call = cur.parent.parent;
    steps.push({ name: cur.parent.name.text, arg: literal(call.arguments[0]) ?? (call.arguments[0]?.getText() ?? null) });
    cur = call;
  }
  return steps;
}

/** Does any filter in the chain name workspace_id? Informational only: a
 *  hand-written filter is correct today and still the thing tenantDb
 *  replaces, so the ratchet counts it like any other raw use. */
const filtersWorkspace = (steps) =>
  steps.some((s) => ['eq', 'in', 'match', 'or', 'filter'].includes(s.name) && /workspace_id/.test(s.arg ?? ''));

/**
 * One file's uses. Each is `{ file, line, key, workspaceFiltered }`, where
 * `key` is `<table>.<verb>` for a query, `rpc:<fn>`, `storage`, `auth`,
 * `member:<name>` for another property, or `reference` when the client is
 * passed, returned or stored somewhere this scanner cannot follow.
 */
export function scanFile(abs) {
  const file = relative(SRC, abs).split('\\').join('/');
  const text = readFileSync(abs, 'utf8');
  const uses = [];
  const exceptions = [];
  if (EXEMPT.has(file)) return { file, uses, exceptions };
  if (!text.includes('adminClient') && !text.includes('serviceRole')) return { file, uses, exceptions };
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true);
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  // Local names bound to the client: the import (possibly renamed) and any
  // `const x = adminClient`.
  const names = new Set();
  const aliasDecls = new Set();
  const collect = (n) => {
    if (ts.isImportSpecifier(n) && (n.propertyName ?? n.name).text === 'adminClient') names.add(n.name.text);
    ts.forEachChild(n, collect);
  };
  collect(sf);
  const aliases = (n) => {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.initializer) && names.has(n.initializer.text) && ts.isIdentifier(n.name)) {
      names.add(n.name.text);
      aliasDecls.add(n.initializer);
    }
    ts.forEachChild(n, aliases);
  };
  if (names.size) aliases(sf);

  const visit = (n) => {
    if (ts.isIdentifier(n) && names.has(n.text) && !aliasDecls.has(n)) {
      const p = n.parent;
      const isDeclName =
        ts.isImportSpecifier(p) ||
        (ts.isVariableDeclaration(p) && p.name === n) ||
        (ts.isPropertyAccessExpression(p) && p.name === n);
      if (!isDeclName) {
        let key = 'reference';
        let workspaceFiltered = false;
        if (ts.isPropertyAccessExpression(p) && p.expression === n) {
          const member = p.name.text;
          const call = p.parent && ts.isCallExpression(p.parent) && p.parent.expression === p ? p.parent : null;
          if (member === 'from' && call) {
            const steps = chainAbove(call);
            const verb = steps.find((s) => VERBS.has(s.name))?.name ?? 'from';
            key = `${literal(call.arguments[0]) ?? '<dynamic>'}.${verb}`;
            workspaceFiltered = filtersWorkspace(steps);
          } else if (member === 'rpc' && call) key = `rpc:${literal(call.arguments[0]) ?? '<dynamic>'}`;
          else if (member === 'storage' || member === 'auth') key = member;
          else key = `member:${member}`;
        }
        uses.push({ file, line: lineOf(n), key, workspaceFiltered });
      }
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'serviceRole') {
      const reason = literal(n.arguments[0]);
      exceptions.push({ file, line: lineOf(n), reason, ok: !!reason && reason.trim().length >= MIN_REASON });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { file, uses, exceptions };
}

export function scan() {
  const uses = [];
  const exceptions = [];
  for (const f of sourceFiles()) {
    const r = scanFile(f);
    uses.push(...r.uses);
    exceptions.push(...r.exceptions);
  }
  return { uses, exceptions };
}

/** `{ file: { key: count } }`, keys sorted, for the baseline file. */
export function countByFileAndKey(uses) {
  const out = {};
  for (const u of uses) {
    out[u.file] ??= {};
    out[u.file][u.key] = (out[u.file][u.key] ?? 0) + 1;
  }
  const sorted = {};
  for (const f of Object.keys(out).sort()) {
    sorted[f] = {};
    for (const k of Object.keys(out[f]).sort()) sorted[f][k] = out[f][k];
  }
  return sorted;
}

/**
 * The ratchet: every (file, key) whose count exceeds the baseline, with the
 * lines of that key in that file (the scanner cannot tell which one is new,
 * so it names them all and lets the diff tell).
 */
export function overBaseline(uses, baseline) {
  const now = countByFileAndKey(uses);
  const over = [];
  for (const [file, keys] of Object.entries(now)) {
    for (const [key, count] of Object.entries(keys)) {
      const allowed = baseline[file]?.[key] ?? 0;
      if (count > allowed) {
        over.push({
          file,
          key,
          count,
          allowed,
          lines: uses.filter((u) => u.file === file && u.key === key).map((u) => u.line),
        });
      }
    }
  }
  return over;
}

export const BASELINE_FILE = resolve(SRC, 'lib/service-role-baseline.json');

export function readBaseline() {
  return JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
}

/** The fix, spelled out, for a failure message. */
export function howToComply(over) {
  const lines = over.flatMap((o) =>
    o.lines.map((l) => `  apps/api/src/${o.file}:${l}  ${o.key}   (${o.count} now, baseline ${o.allowed})`),
  );
  return [
    'New raw service-role database use(s) — where a key shows several lines, one of them is new and the diff says which:',
    ...lines,
    '',
    'The service-role client is not seen by row level security, so nothing under this line keeps',
    'one workspace from another. Instead of adminClient, use (lib/tenant-db.ts):',
    "  1. tenantDb(ctx).from('<table>')…            the workspace_id filter is forced in; inserts are stamped",
    "  2. await tenantDb(ctx).child('<table>', { via: '<parent table>', key: '<fk column>', id })",
    '                                               for a table with no workspace_id (null = not yours)',
    "  3. serviceRole('<why crossing workspaces is safe here>').from(…)",
    '                                               only when the query must not be scoped — the reason is the review record',
    'Do not raise apps/api/src/lib/service-role-baseline.json for new code; it only shrinks.',
  ].join('\n');
}
