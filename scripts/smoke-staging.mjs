#!/usr/bin/env node
// Staging smoke test — the automatable half of docs/environments.md Phase 3.
// Exits non-zero on the first failure, so it can gate a promote.
//
// Usage:
//   node scripts/smoke-staging.mjs [--api <url>] [--web <url>]
// Defaults: STAGING_API_URL / STAGING_WEB_URL env vars, then the canonical
// staging hosts.

import { APPS, SURFACES } from '../packages/shared/dist/branding.js';

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

// The terms a joiner must tick before paying — followed the way they follow
// it, from the catalogue the join form reads, not from a URL typed here.
//
// Sjoerd, testing the join on staging: "Terms and condition link leads to
// nothing." It 404'd on BOTH stacks, for two different reasons at once (a
// stack check on an env var that does not exist, and a page in the one app
// that has no staging deployment) — and nothing noticed, because no check
// ever followed the link. A required checkbox beside a dead link is the
// worst version of this: it makes somebody agree to a document they cannot
// read.
//
// Two things are asserted, because either alone passes while the link is
// wrong: the page ANSWERS, and the host is THIS stack. A staging API handing
// out a production URL is the bug that happened, and a 200 from production
// hides it completely.
await check('standard terms link in the join catalogue resolves on this stack', async () => {
  const cat = await get(`${API}/api/v1/membership/public/catalog/default`);
  if (!cat.ok) {
    throw new Error(
      `no public membership catalogue at /default (status ${cat.status}) — ` +
        'this check reads the terms link from the join form\'s own payload',
    );
  }
  const terms = (await cat.json()).terms;
  if (!terms?.url) throw new Error('the catalogue carries no terms url');
  if (!terms.standard) {
    console.log(`    (workspace has its own terms: ${terms.url} — not ours to serve)`);
    return;
  }
  const host = new URL(terms.url).hostname;
  if (!host.endsWith(new URL(WEB).hostname)) {
    throw new Error(
      `the standard terms point at ${host}, which is not this stack (${new URL(WEB).hostname}) — ` +
        'the staging API is handing joiners the production document',
    );
  }
  const page = await get(terms.url);
  if (!page.ok) throw new Error(`${terms.url} → status ${page.status}`);
  const html = await page.text();
  // The text is a DRAFT and says so. When it stops being a draft that word
  // goes, and this assertion should be changed deliberately — not quietly.
  if (!/\bDraft\b/.test(html)) {
    throw new Error(`${terms.url} answers 200 but is not the draft terms document`);
  }
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
//
// The MAP still has to be written by hand — production moved Thread to
// `app.thethread.app` while staging kept `thread.thefibre.tech`, so the
// subdomain is not derivable from the registry URL. What is NOT left to hand
// is whether the map is COMPLETE: the guard below fails if a released app or
// a registered surface is neither listed here nor deliberately excluded.
// `my` was missing from this map from the day the portal shipped, so nothing
// ever noticed that staging's portal answers a Vercel login page instead of
// the portal (found 2026-09-12, walking an enrolled participant to it).
const STAGING_SUBS = {
  meet: 'fibre-meet',
  thread: 'the-thread',
  flow: 'fibre-flow',
  pulse: 'fibre-pulse',
  membership: 'membership',
  // `connect`, not `connections`, since the rename on 2026-09-21. The old
  // host still serves and 307s to this one, which is why the check failed
  // rather than 404'd — and why a redirect is not good enough here: this
  // script exists to catch a subdomain serving the WRONG APP, and a 307 it
  // does not follow tells it nothing either way.
  connect: 'fibre-sales',
  // Models (2026-09-25): models.thefibre.tech answered 200 on 2026-09-27
  // while this map did not know it — the guard below said so.
  models: 'fibre-models',
};

/** Surfaces are not catalogue apps, so they carry their own map and their
 *  title comes from `shortLabel` ("My Thread"), not `name`. */
const STAGING_SURFACE_SUBS = {
  my: 'my-portal',
};

/** Deliberately absent from staging, each with the reason. Anything not
 *  here and not mapped above makes this script fail rather than skip. */
const NOT_ON_STAGING = {
  'fibre-platform': 'it IS the staging apex (thefibre.tech), checked above',
  website: 'the marketing site has no staging deployment; the apex serves the Fibre web',
  'fibre-learn': 'in the registry but unbuilt — no app to serve',
};
// Not listed above and not a gap: apps that live only in the DB catalogue
// (fot-planner, and the contract script's throwaway) never reach this guard,
// which reads the code registry. Correct — they are not ours to host.

{
  const mapped = new Set([...Object.values(STAGING_SUBS), ...Object.values(STAGING_SURFACE_SUBS)]);
  const missing = [
    ...Object.keys(APPS),
    ...Object.keys(SURFACES),
  ].filter((k) => !mapped.has(k) && !(k in NOT_ON_STAGING));
  if (missing.length) {
    console.error(
      `  ✗ smoke-staging has no entry for: ${missing.join(', ')}\n` +
        `    Add it to STAGING_SUBS / STAGING_SURFACE_SUBS, or to NOT_ON_STAGING with a reason.`,
    );
    failed += 1;
  }
}
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

// The same check for surfaces. `my` is the participant's own page — the one
// place a person who is not a customer ever signs in — so it being
// unreachable on staging means the whole participant half is untestable.
for (const [sub, key] of Object.entries(STAGING_SURFACE_SUBS)) {
  const title = SURFACES[key]?.shortLabel;
  if (!title) {
    console.error(`  ✗ ${sub}.${apex} — no surface "${key}" in the registry`);
    failed += 1;
    continue;
  }
  await check(`${sub}.${apex} serves ${title}, not another app`, async () => {
    const r = await get(`https://${sub}.${apex}/`);
    // Deployment protection announces itself as a redirect to Vercel's own
    // SSO, so catch it on the Location header — the body is never reached.
    // Saying "status 302" would send the reader hunting for a DNS or routing
    // fault that is not there.
    const loc = r.headers.get('location') ?? '';
    if (/vercel\.com\/sso-api|vercel\.com\/login/i.test(loc)) {
      throw new Error(
        'Vercel deployment protection is ON for this project — it answers a ' +
        'Vercel login, not the app, so nobody outside the team can reach it. ' +
        'Every other staging domain is open. Vercel → Project → Settings → ' +
        'Deployment Protection.'
      );
    }
    if (!r.ok) throw new Error(`status ${r.status}${loc ? ` → ${loc}` : ''}`);
    const body = await r.text();
    const m = body.match(/<title>([^<]*)<\/title>/);
    if (!m) throw new Error('no <title> in HTML');
    if (!m[1].includes(title)) {
      throw new Error(`title is "${m[1]}" — check the Vercel domain→project assignment`);
    }
  });
}

console.log(failed === 0 ? '\nAll green.' : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
