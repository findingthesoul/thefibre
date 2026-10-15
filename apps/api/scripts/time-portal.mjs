#!/usr/bin/env node
// How long my.thread's API calls take, for a fixture member, on STAGING.
//
//   node scripts/time-portal.mjs [--email upcoming-fixture@example.com] [--runs 5]
//
// Written up from the session scratchpad, as docs/handover-portal-entitlements-
// batching.md asked ("worth rewriting into apps/api/scripts/ if this is done
// more than once"). The default address is the fixture seed-upcoming-fixture.mjs
// gives TWO memberships with team calendars — the shape the entitlement walk
// is slow on, and the one nothing else could measure.
//
// The token: admin generate_link for the address, then POST /auth/v1/verify
// with its token_hash, which answers an access token directly — no browser,
// no inbox. The admin API returns `hashed_token` at the TOP level, not under
// `properties` as the client typings suggest.
//
// FIXTURE ADDRESSES ONLY. This mints a real session for whoever it names; it
// refuses anything that is not an @example.com address.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(process.env.FIBRE_ENV_FILE_STAGING ?? join(HERE, '..', '.env.staging'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE || SUPABASE.includes('zfsyyokepyycefbxiblc')) {
  console.error('REFUSED: staging only, and the env file points at production or nowhere.');
  process.exit(2);
}
const API = process.env.FIBRE_API ?? 'https://thefibre-api-staging.fly.dev';
const flag = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const EMAIL = flag('email', 'upcoming-fixture@example.com');
const RUNS = Number(flag('runs', '5'));
if (!/@example\.com$/i.test(EMAIL)) {
  console.error(`REFUSED: ${EMAIL} is not a fixture address (@example.com).`);
  process.exit(2);
}

const admin = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
const link = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
  method: 'POST', headers: admin, body: JSON.stringify({ type: 'magiclink', email: EMAIL }),
}).then((r) => r.json());
const hash = link.hashed_token ?? link.properties?.hashed_token;
if (!hash) throw new Error(`generate_link gave no token: ${JSON.stringify(link).slice(0, 200)}`);
const verified = await fetch(`${SUPABASE}/auth/v1/verify`, {
  method: 'POST',
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', token_hash: hash }),
}).then((r) => r.json());
const token = verified.access_token;
if (!token) throw new Error(`verify gave no access token: ${JSON.stringify(verified).slice(0, 200)}`);

const PATHS = ['/api/v1/me/nav', '/api/v1/me/portal', '/api/v1/me/portal/upcoming', '/api/v1/membership/portal/me/directory'];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(`${EMAIL} against ${API}, ${RUNS} runs each (one warm-up first)`);
for (const path of PATHS) {
  const call = async () => {
    const t = performance.now();
    const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-App-ID': 'the-thread' } });
    await r.text();
    return { ms: performance.now() - t, status: r.status };
  };
  await call();
  const xs = [];
  let status = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = await call();
    xs.push(r.ms);
    status = r.status;
  }
  console.log(`  ${path.padEnd(44)} ${status}  median ${Math.round(median(xs))}ms  (${xs.map((x) => Math.round(x)).join(', ')})`);
}
