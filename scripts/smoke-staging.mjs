#!/usr/bin/env node
// Staging smoke test — the automatable half of docs/environments.md Phase 3.
// Exits non-zero on the first failure, so it can gate a promote.
//
// Usage:
//   node scripts/smoke-staging.mjs [--api <url>] [--web <url>]
// Defaults: STAGING_API_URL / STAGING_WEB_URL env vars, then the canonical
// staging hosts.

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

console.log(failed === 0 ? '\nAll green.' : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
