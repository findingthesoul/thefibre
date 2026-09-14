#!/usr/bin/env node
// READ-ONLY. Which SECURITY DEFINER functions can the public anon key
// execute through PostgREST on this project — and which can a signed-in
// user, if you hand it a session.
//
// Never runs a function body: every call carries a malformed uuid, so the
// privilege check either refuses (42501) or the argument cast fails (22P02)
// before the body starts. See scripts/lib/definer-probe.mjs for the
// calibration and the reviewed allowlists.
//
// Safe against production. Exit 1 when a function is open to a role that the
// allowlist does not name — the same rule the staging integration test
// enforces, runnable here against any project.
//
// Usage:
//   node scripts/audit-definer-functions.mjs                       # .env (prod)
//   FIBRE_ENV_FILE=.env.staging node scripts/audit-definer-functions.mjs
//   FIBRE_BEARER=<access token> node scripts/audit-definer-functions.mjs
//     → also probes as that signed-in session (role `authenticated`).

import { supabaseEnv } from './lib/env.mjs';
import {
  ANON_ALLOWED,
  AUTHENTICATED_ALLOWED,
  collectDefinerFunctions,
  probeAll,
} from './lib/definer-probe.mjs';

const { file, url, anonKey, projectRef } = supabaseEnv({ requireService: false });
const fns = collectDefinerFunctions();
console.log(`${file} → project ${projectRef}`);
console.log(`${fns.length} SECURITY DEFINER function(s) in supabase/migrations\n`);

let problems = 0;

function report(role, rows, allowed) {
  console.log(`As ${role}:`);
  for (const r of rows) {
    const sig = `${r.fn.name}(${r.fn.params.map((p) => p.type).join(', ')})`;
    const ok = r.verdict !== 'open' || allowed.has(r.fn.name);
    const mark = r.verdict === 'open' ? (ok ? '·' : '✗') : r.verdict === 'closed' ? '✓' : '–';
    const why =
      r.verdict === 'open'
        ? ok
          ? 'open, on the reviewed allowlist'
          : `OPEN — ${r.code ?? r.status}${r.detail ? ` ${r.detail}` : ''}`
        : r.verdict === 'closed'
          ? 'closed (42501)'
          : 'not reachable over REST';
    if (!ok) problems++;
    console.log(`  ${mark} ${sig.padEnd(58)} ${why}`);
  }
  console.log();
}

report('anon', await probeAll({ url, apikey: anonKey }, fns), ANON_ALLOWED);

if (process.env.FIBRE_BEARER) {
  report(
    'authenticated',
    await probeAll({ url, apikey: anonKey, bearer: process.env.FIBRE_BEARER }, fns),
    AUTHENTICATED_ALLOWED,
  );
} else {
  console.log('(pass FIBRE_BEARER=<access token> to probe as a signed-in user too)\n');
}

if (problems) {
  console.log(`${problems} function(s) open to a role the allowlist does not name.`);
  process.exit(1);
}
console.log('Every SECURITY DEFINER function is closed, or open on purpose.');
