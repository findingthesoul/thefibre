#!/usr/bin/env node
// Production smoke — read-only, safe to run any time (testing approach
// §3.7 / handbook §11). Sibling of smoke-staging.mjs, but prod's topology
// is TWO apexes since v0.52.0, so the domain list comes from the branding
// registry instead of an apex + subdomain pattern. Exits non-zero on the
// first failure so it can gate anything.
//
// Usage: node scripts/smoke-prod.mjs   (needs packages/shared built)

import { APPS } from '../packages/shared/dist/branding.js';

const API = 'https://thefibre-api.fly.dev';

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
async function get(url, init) {
  // One retry after a beat — first hit of the day can be cold.
  let r = await fetch(url, init).catch(() => null);
  if (!r || r.status >= 500) {
    await new Promise((s) => setTimeout(s, 8000));
    r = await fetch(url, init);
  }
  return r;
}

console.log(`Prod smoke: ${API} + the registry domains\n`);

await check('API /health', async () => {
  const r = await get(`${API}/health`);
  if (!r.ok) throw new Error(`status ${r.status}`);
  const j = await r.json();
  if (!j.ok) throw new Error('health not ok');
});

await check('public plan catalogue (Free first)', async () => {
  const r = await get(`${API}/api/v1/public/plans`);
  if (!r.ok) throw new Error(`status ${r.status}`);
  const j = await r.json();
  if (!Array.isArray(j.plans) || j.plans.length < 4) throw new Error('fewer than 4 plans');
  if (j.plans[0].id !== 'free') throw new Error(`first plan is ${j.plans[0].id}, not free`);
});

// Every available app serves ITS OWN app at its registry URL — the check
// that catches the misroute class (a domain attached to the wrong project).
for (const [slug, meta] of Object.entries(APPS)) {
  if (!meta.available) continue;
  await check(`${new URL(meta.url).hostname} serves ${meta.name}`, async () => {
    const r = await get(meta.url);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const html = await r.text();
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    if (!title.includes(meta.name)) throw new Error(`title "${title}" lacks "${meta.name}"`);
  });
}

// The thethread.app apex (old landing) must keep serving until the website
// rework — build-plan item 0.
await check('thethread.app apex still serves the landing', async () => {
  const r = await get('https://thethread.app/');
  if (!r.ok) throw new Error(`status ${r.status}`);
});

// CORS: a registry origin is reflected; a foreign origin is not.
await check('API CORS: registry origin allowed, foreign blocked', async () => {
  const probe = async (origin) => {
    const r = await get(`${API}/api/v1/public/plans`, { headers: { Origin: origin } });
    return r.headers.get('access-control-allow-origin');
  };
  const ours = await probe(APPS['the-thread'].url);
  if (ours !== APPS['the-thread'].url) throw new Error(`own origin got "${ours}"`);
  const foreign = await probe('https://evil.example.com');
  if (foreign) throw new Error(`foreign origin got "${foreign}"`);
});

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll good.');
process.exit(failed ? 1 : 0);
