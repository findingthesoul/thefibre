#!/usr/bin/env node
// Staging smoke test — the automatable half of docs/environments.md Phase 3.
// Exits non-zero on the first failure, so it can gate a promote.
//
// Usage:
//   node scripts/smoke-staging.mjs [--api <url>] [--web <url>]
// Defaults: STAGING_API_URL / STAGING_WEB_URL env vars, then the canonical
// staging hosts.

import { APPS } from '../packages/shared/dist/branding.js';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
};
const API = (arg('api', process.env.STAGING_API_URL ?? 'https://thefibre-api-staging.fly.dev')).replace(/\/$/, '');
const WEB = (arg('web', process.env.STAGING_WEB_URL ?? 'https://thefibre.tech')).replace(/\/$/, '');

let failed = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`  ✗ ${label} — ${e.message}`);
  }
}
async function get(url) {
  // Free-tier Supabase (and a scale-to-zero Fly machine) can need a moment
  // on the first hit of the day — one retry after a beat is honest, more
  // would paper over real breakage.
  let r = await fetch(url, { redirect: 'manual' }).catch(() => null);
  if (!r || r.status >= 500) {
    await new Promise((s) => setTimeout(s, 8000));
    r = await fetch(url, { redirect: 'manual' });
  }
  return r;
}

console.log(`Smoke: API ${API} · WEB ${WEB}\n`);

await check('API /health', async () => {
  const r = await get(`${API}/health`);
  if (!r.ok) throw new Error(`status ${r.status}`);
  const j = await r.json();
  if (!j.ok) throw new Error('health not ok');
});

await check('public plan catalogue (4 plans, Free first)', async () => {
  const r = await get(`${API}/api/v1/public/plans`);
  if (!r.ok) throw new Error(`status ${r.status}`);
  const j = await r.json();
  if (!Array.isArray(j.plans) || j.plans.length < 4) throw new Error(`got ${j.plans?.length} plans`);
  if (j.plans[0].id !== 'free') throw new Error(`first plan is ${j.plans[0].id}`);
});

await check('auth is enforced (bare API request → 401)', async () => {
  const r = await get(`${API}/api/v1/persons`);
  if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
});

await check('web landing renders (Thread-first)', async () => {
  const r = await get(`${WEB}/`);
  if (!r.ok) throw new Error(`status ${r.status}`);
  const html = await r.text();
  if (!html.includes('Thread')) throw new Error('no "Thread" in the landing HTML');
});

await check('web /pricing renders with live prices', async () => {
  const r = await get(`${WEB}/pricing`);
  if (!r.ok) throw new Error(`status ${r.status}`);
  const html = await r.text();
  if (!html.includes('Starter')) throw new Error('no "Starter" in pricing HTML');
});

await check('sign-in page reachable', async () => {
  const r = await get(`${WEB}/sign-in`);
  if (!r.ok) throw new Error(`status ${r.status}`);
});

// Each app subdomain must serve ITS OWN app. Caught for real on 2026-09-03:
// all four .tech app domains were serving the web project (Vercel domain →
// project assignment / DNS CNAME target), so "Meet doesn't open on staging".
// The <title> comes from each app's root layout (APPS[slug].name in
// @thefibre/shared branding.ts) — a title mismatch means the domain is
// routed to the wrong Vercel project.
const apex = new URL(WEB).hostname.replace(/^www\./, '');
// The subdomain → app mapping is the only staging-specific fact here; the
// NAME comes from the catalogue, never from a second copy. A hand-written
// title list went stale twice over — it still said "Thread" and
// "Membership" after branding.ts had moved to "The Thread" and "Members",
// so this check reported two correctly-routed domains as misrouted
// (2026-09-12). smoke-prod.mjs has always derived; this now matches it,
// `includes` and all, so a title with a page suffix does not read as a
// wrong app.
const STAGING_SUBS = {
  meet: 'fibre-meet',
  thread: 'the-thread',
  flow: 'fibre-flow',
  pulse: 'fibre-pulse',
  membership: 'membership',
};
for (const [sub, slug] of Object.entries(STAGING_SUBS)) {
  const title = APPS[slug]?.name;
  if (!title) {
    console.error(`  ✗ ${sub}.${apex} — no app "${slug}" in the catalogue`);
    failed += 1;
    continue;
  }
  await check(`${sub}.${apex} serves ${title}, not another app`, async () => {
    const r = await get(`https://${sub}.${apex}/`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const m = (await r.text()).match(/<title>([^<]*)<\/title>/);
    if (!m) throw new Error('no <title> in HTML');
    if (!m[1].includes(title)) {
      throw new Error(
        `title is "${m[1]}" — this domain is serving the wrong app; ` +
        'check the Vercel domain→project assignment and the DNS CNAME target'
      );
    }
  });
}

console.log(failed === 0 ? '\nAll green.' : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
