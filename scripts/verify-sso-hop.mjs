#!/usr/bin/env node
// Is the cross-apex SSO hop wired for every app?
//
// The hop is how a signed-in person walks from one app to another across a
// domain boundary: the source mints a one-time code, the target's /sso/land
// redeems it server-to-server (POST /api/v1/sso/redeem, X-SSO-Secret) and
// turns the answer into its own session. It needs ONE shared value —
// SSO_INTERNAL_SECRET — to match between each app's Vercel project and the
// API. Nothing in a build or a typecheck can see that, so it fails silently:
// the land route catches everything and redirects to the app's own sign-in
// page, which looks exactly like an expired session.
//
// That is how Connect went from its launch (2026-09-13) to 2026-09-23 with a
// broken hop on BOTH stacks and nobody noticing — every click into it from
// The Fibre landed on "Continue with Google" and everyone simply signed in.
//
// This probe sends a BOGUS code, so it writes nothing and needs no session:
// a code that cannot claim a row still makes the land route do everything up
// to and including the redeem call. What comes back separates the cases:
//
//   redirected to /?next=…  → the hop ran and refused the bogus code, which
//                             is the ONLY thing a bogus code can prove here.
//
// The three failure modes are distinguished in the API LOG, not here:
//   no POST /sso/redeem at all → the app has no SSO_INTERNAL_SECRET
//   POST … 403                 → it HAS one and it DIFFERS from the API's
//   POST … 400 invalid_code    → correct; a real code would have worked
//
// So: run this, then read the API log for the same second. The script prints
// the exact command for the stack you probed.
//
// Usage:
//   node scripts/verify-sso-hop.mjs             # staging
//   node scripts/verify-sso-hop.mjs --prod
//
// It is a SCRIPT, not a test, on purpose: a release gate that mints real
// handoff rows in a live database is a gate nobody wants at 2am.

import { APPS, appUrl, stagingAppUrl } from '../packages/shared/dist/branding.js';

const PROD = process.argv.includes('--prod');
const STACK = PROD ? 'production' : 'staging';

// Derived from the catalogue, never a hand-kept list of hosts: an app that
// exists is an app this checks (docs/system-handbook.md on why lists rot).
const targets = Object.entries(APPS)
  .filter(([, meta]) => meta.available !== false)
  .map(([slug, meta]) => ({
    slug,
    name: meta.name,
    url: PROD ? appUrl(slug) : stagingAppUrl(slug),
  }));

const bogus = `probe-${Date.now()}-nonexistent`;
let unreachable = 0;

console.log(`\nSSO hop probe — ${STACK}\n`);
console.log('Each line means the land route ran and refused a bogus code.');
console.log('Which of the three failure modes it is, only the API log says.\n');

for (const t of targets) {
  const url = `${t.url}/sso/land?code=${encodeURIComponent(bogus)}&next=%2Fdashboard`;
  const at = new Date().toISOString();
  let line;
  try {
    const res = await fetch(url, { redirect: 'manual' });
    const to = res.headers.get('location') ?? '';
    line =
      res.status >= 300 && res.status < 400
        ? `redirect → ${to.replace(t.url, '') || to}`
        : `HTTP ${res.status}`;
  } catch (e) {
    unreachable += 1;
    line = `unreachable — ${e.message}`;
  }
  console.log(`  ${t.name.padEnd(12)} ${at}  ${line}`);
}

const cfg = PROD ? '--config fly.toml' : '-c fly.staging.toml';
console.log(`\nNow read the API log for those timestamps:\n`);
console.log(`  fly logs ${cfg} --no-tail | grep 'sso/redeem'\n`);
console.log('  a 403 there names an app whose SSO_INTERNAL_SECRET differs from');
console.log("  the API's; no line at all names one that has no secret set.\n");

process.exit(unreachable > 0 ? 1 : 0);
