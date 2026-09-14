// Which SECURITY DEFINER functions can a given role EXECUTE through
// PostgREST — answered without running a single body.
//
// The trick, calibrated on 2026-09-13 (handbook §11.3b): Postgres checks
// EXECUTE privilege first, coerces the arguments second, and runs the body
// third. So calling a function with a malformed uuid as the role under test
// yields exactly one of:
//
//   42501  permission denied      → CLOSED to this role
//   22P02  invalid input syntax   → OPEN: the role may execute, the body never ran
//   PGRST202 function not found   → not reachable over REST at all (trigger
//                                   functions, or a name no migration created)
//
// Anything else — a 200, a different error — also proves the role got past
// the privilege check, and is reported as OPEN with the detail attached.
//
// Every function with a uuid parameter is therefore probed with zero risk of
// side effects. The handful without one (claim readers such as
// is_workspace_admin(), and the trigger functions) are STABLE or unreachable.
//
// The list of functions comes from `supabase/migrations`, not from the
// database: PostgREST cannot enumerate pg_proc and the scripts have no
// direct connection. The migrations ARE the source the database was built
// from, so a new SECURITY DEFINER function is on the list the moment its
// migration exists — which is the property the guard needs. Redefinitions
// win by filename order, the same order Supabase applies them.
//
// Shared by scripts/audit-definer-functions.mjs (a report, any project) and
// src/integration/definer-functions.int.test.ts (the standing guard, staging).

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', '..', 'supabase', 'migrations',
);

/**
 * Functions that MAY stay executable by `anon`. Reviewed 2026-09-14: none.
 * Every policy in this schema is `to authenticated`, the API reaches every
 * definer function through the service role, and the one anon policy
 * (signup_request insert) calls no function. Add a name here only with a
 * comment saying which anonymous caller needs it.
 */
export const ANON_ALLOWED = new Set([]);

/**
 * Functions that MAY stay executable by `authenticated`. These are the RLS
 * helpers evaluated inside row policies as the signed-in role — revoking
 * them blanks the app for every user (build-plan, 2026-09-13). Each answers
 * only about the CALLER (claims from the JWT) or, for workspace_meet_fee,
 * returns a plan's fee for a workspace id: reviewed 2026-09-14, low value,
 * kept because a policy-side caller is cheaper than a service-role hop.
 */
export const AUTHENTICATED_ALLOWED = new Set([
  'can_see_person',
  'can_see_organisation',
  'can_see_activity',
  'meet_is_team_lead',
  'is_workspace_admin',
  'current_workspace_role',
  'pulse_can_read_workspace',
  'pulse_can_write_workspace',
  'workspace_meet_fee',
]);

/**
 * Parse every migration and return the LATEST definition of each function,
 * keeping only those that are SECURITY DEFINER in that latest definition.
 * @returns {{ name: string, params: {name:string,type:string}[], file: string }[]}
 */
export function collectDefinerFunctions(dir = MIGRATIONS_DIR) {
  const defs = new Map();
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const head = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z_0-9]+)"?\s*\(/gi;
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf-8');
    let m;
    while ((m = head.exec(sql))) {
      const name = m[1].toLowerCase();
      const paramsRaw = readBalanced(sql, head.lastIndex - 1);
      const bodyStart = head.lastIndex + paramsRaw.length;
      const body = functionBody(sql, bodyStart);
      const secdef = /security\s+definer/i.test(body);
      defs.set(name, { name, params: parseParams(paramsRaw), file, secdef });
    }
  }
  return [...defs.values()].filter((d) => d.secdef).map(({ secdef, ...d }) => d);
}

// From an opening paren, return the text inside the matching close paren.
function readBalanced(sql, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < sql.length; i++) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')') {
      depth--;
      if (depth === 0) return sql.slice(openIdx + 1, i);
    }
  }
  return sql.slice(openIdx + 1);
}

// The text between the parameter list and the end of the dollar-quoted body
// (or the next statement when the function has none we can find).
function functionBody(sql, from) {
  const rest = sql.slice(from);
  const open = rest.match(/\$([a-z_]*)\$/i);
  if (!open) return rest.slice(0, 2000);
  const tag = open[0];
  const close = rest.indexOf(tag, open.index + tag.length);
  return close === -1 ? rest : rest.slice(0, close + tag.length + 40);
}

function parseParams(raw) {
  const cleaned = raw.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  return cleaned.split(',').map((p) => {
    const noDefault = p.replace(/\s+default\s+.*$/i, '').trim();
    const parts = noDefault.split(' ').filter(Boolean);
    const [name, ...type] = parts[0].toLowerCase() === 'in' ? parts.slice(1) : parts;
    return { name, type: type.join(' ').toLowerCase() };
  });
}

/** One argument per parameter that can never reach a body. */
export function probeArgs(params) {
  const args = {};
  for (const { name, type } of params) {
    if (type.includes('uuid[]')) args[name] = ['not-a-uuid'];
    else if (type.includes('uuid')) args[name] = 'not-a-uuid';
    else if (type.includes('jsonb') || type.includes('json')) args[name] = {};
    else if (type.includes('timestamp')) args[name] = '2020-01-01T00:00:00Z';
    else if (type.includes('int') || type.includes('numeric') || type.includes('real')) args[name] = 1;
    else if (type.includes('bool')) args[name] = false;
    else args[name] = 'probe';
  }
  return args;
}

/**
 * Probe one function as one role.
 * @param {{url:string, apikey:string, bearer?:string}} who
 * @returns {Promise<{verdict:'closed'|'open'|'unreachable', code?:string, status:number, detail?:string}>}
 */
export async function probe(who, fn) {
  const headers = {
    apikey: who.apikey,
    Authorization: `Bearer ${who.bearer ?? who.apikey}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(`${who.url.replace(/\/$/, '')}/rest/v1/rpc/${fn.name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(probeArgs(fn.params)),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON — a 200 with a scalar, or HTML */
  }
  const code = json && typeof json === 'object' && !Array.isArray(json) ? json.code : undefined;
  if (code === '42501') return { verdict: 'closed', code, status: res.status };
  if (code === 'PGRST202') return { verdict: 'unreachable', code, status: res.status };
  if (code === '22P02') return { verdict: 'open', code, status: res.status };
  return {
    verdict: 'open',
    code,
    status: res.status,
    detail: (json && json.message) || text.slice(0, 120),
  };
}

/** Probe every function as one role; returns rows sorted by name. */
export async function probeAll(who, fns) {
  const rows = [];
  for (const fn of fns) rows.push({ fn, ...(await probe(who, fn)) });
  return rows.sort((a, b) => a.fn.name.localeCompare(b.fn.name));
}
