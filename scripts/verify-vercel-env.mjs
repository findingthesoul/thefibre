#!/usr/bin/env node
// Audit the six Fibre Vercel projects against the canonical env matrix
// (docs/deploy.md prod + docs/environments.md §E staging), then optionally
// apply the fixes. Born 2026-09-05 after an afternoon of hand-clicking
// found a staging anon key in membership's PROD scope and a website URL
// where a database URL belonged. Values are never printed.
//
// Usage: node scripts/verify-vercel-env.mjs <token-file> <prod-anon> <staging-anon> [apply]
// Token: vercel.com/account/settings/tokens (scope: the team, short expiry).
// Sensitive-type vars cannot be read or patched — the script says so and
// leaves them; replace those by hand if they ever need to change.
// Prints ok / MISSING / WRONG / secret(set) â never full values.
// Usage: node vercel-env-audit2.mjs <token-file> <prod-anon> <staging-anon> [apply]

import { readFileSync } from 'node:fs';

const TOKEN = readFileSync(process.argv[2], 'utf8').trim();
const PROD_ANON = process.argv[3];
const STAGING_ANON = process.argv[4];
const APPLY = process.argv[5] === 'apply';

const API = 'https://api.vercel.com';
async function v(path, init = {}) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${r.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

const NAMES = ['thefibre', 'thefibre-meet', 'thefibre-thread', 'thefibre-flow', 'thefibre-pulse', 'thefibre-membership'];
const T = (h) => `https://${h}`;
const MATRIX = {
  prod: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://zfsyyokepyycefbxiblc.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: PROD_ANON,
    NEXT_PUBLIC_API_BASE_URL: 'https://thefibre-api.fly.dev',
    NEXT_PUBLIC_COOKIE_DOMAIN: '.thefibre.app',
    SSO_INTERNAL_SECRET: null,
  },
  staging: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://lukhyylwhhjyihqtghvw.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: STAGING_ANON,
    NEXT_PUBLIC_API_BASE_URL: 'https://thefibre-api-staging.fly.dev',
    NEXT_PUBLIC_COOKIE_DOMAIN: '.thefibre.tech',
    SSO_INTERNAL_SECRET: null,
    NEXT_PUBLIC_FIBRE_URL: T('thefibre.tech'),
    NEXT_PUBLIC_MEET_URL: T('meet.thefibre.tech'),
    NEXT_PUBLIC_THREAD_URL: T('thread.thefibre.tech'),
    NEXT_PUBLIC_FLOW_URL: T('flow.thefibre.tech'),
    NEXT_PUBLIC_PULSE_URL: T('pulse.thefibre.tech'),
    NEXT_PUBLIC_MEMBERSHIP_URL: T('membership.thefibre.tech'),
  },
};

// Resolve team scope: prefer the team listing if projects live there.
const teams = (await v('/v2/teams')).teams ?? [];
let teamQ = '';
let projects = ((await v('/v9/projects?limit=100')).projects ?? []).filter((p) => NAMES.includes(p.name));
if (projects.length < NAMES.length && teams[0]) {
  teamQ = `teamId=${teams[0].id}`;
  projects = ((await v(`/v9/projects?limit=100&${teamQ}`)).projects ?? []).filter((p) => NAMES.includes(p.name));
}
const q = (extra = '') => (teamQ ? `?${teamQ}${extra ? `&${extra}` : ''}` : extra ? `?${extra}` : '');

const ssoValues = { prod: new Map(), staging: new Map() };
const fixes = []; // {project, id?, key, value, target, gitBranch, action}
const report = [];

for (const name of NAMES) {
  const p = projects.find((x) => x.name === name);
  if (!p) { report.push(`ââ ${name}: PROJECT NOT FOUND`); continue; }
  const envs = (await v(`/v10/projects/${p.id}/env${q()}`)).envs ?? [];

  async function decrypted(row) {
    if (row.type === 'sensitive') return { secret: true };
    try {
      const d = await v(`/v9/projects/${p.id}/env/${row.id}${q()}`);
      return { value: d.value };
    } catch { return { unreadable: true }; }
  }
  const pick = (key, scope) =>
    envs.filter((e) => e.key === key).find((e) =>
      scope === 'prod'
        ? e.target?.includes('production')
        : e.target?.includes('preview') && (e.gitBranch === 'staging' || !e.gitBranch),
    );

  const lines = [];
  for (const [scope, vars] of Object.entries(MATRIX)) {
    for (const [key, expected] of Object.entries(vars)) {
      const row = pick(key, scope);
      const target = scope === 'prod' ? ['production'] : ['preview'];
      const gitBranch = scope === 'prod' ? undefined : 'staging';
      if (!row) {
        lines.push(`   ${scope.padEnd(7)} ${key.padEnd(34)} MISSING${expected ? ' â will add' : ' (no known value â manual)'}`);
        if (expected) fixes.push({ project: name, pid: p.id, key, value: expected, target, gitBranch, action: 'create' });
        continue;
      }
      const d = await decrypted(row);
      if (d.secret) { lines.push(expected ? `   ${scope.padEnd(7)} ${key.padEnd(34)} secret(set) â cannot verify` : null); if (key === 'SSO_INTERNAL_SECRET') { /* can't compare */ } }
      else if (d.unreadable) lines.push(`   ${scope.padEnd(7)} ${key.padEnd(34)} set but unreadable`);
      else if (expected === null) {
        if (key === 'SSO_INTERNAL_SECRET') {
          const m = ssoValues[scope];
          m.set(d.value, [...(m.get(d.value) ?? []), name]);
        }
      } else if (d.value !== expected) {
        lines.push(`   ${scope.padEnd(7)} ${key.padEnd(34)} WRONG (has ${d.value?.slice(0, 30)}â¦) â will fix`);
        fixes.push({ project: name, pid: p.id, envId: row.id, key, value: expected, target, gitBranch, action: 'update' });
      }
      // branch limiting: staging row without gitBranch â tighten
      if (row && scope === 'staging' && !row.gitBranch && expected) {
        fixes.push({ project: name, pid: p.id, envId: row.id, key, value: expected, target, gitBranch: 'staging', action: 'update' });
        lines.push(`   ${scope.padEnd(7)} ${key.padEnd(34)} (preview-wide â limiting to staging branch)`);
      }
    }
  }
  report.push(`ââ ${name}`, ...lines.filter(Boolean).length ? lines.filter(Boolean) : ['   all ok']);
}

console.log(report.join('\n'));
for (const scope of ['prod', 'staging']) {
  const groups = [...ssoValues[scope].entries()];
  if (groups.length > 1) {
    console.log(`\nâ ï¸  SSO_INTERNAL_SECRET (${scope}): ${groups.length} different readable values: ${groups.map(([, g]) => g.join('+')).join(' | ')}`);
  } else if (groups.length === 1) {
    console.log(`\nSSO_INTERNAL_SECRET (${scope}): consistent across readable projects (${groups[0][1].join(', ')})`);
  }
}

if (!APPLY) {
  console.log(`\n${fixes.length} fixes queued (dry run â pass 'apply' to write them).`);
} else {
  console.log(`\nApplying ${fixes.length} fixesâ¦`);
  for (const f of fixes) {
    const body = { key: f.key, value: f.value, type: 'plain', target: f.target, ...(f.gitBranch ? { gitBranch: f.gitBranch } : {}) };
    try {
      if (f.action === 'create') await v(`/v10/projects/${f.pid}/env${q('upsert=true')}`, { method: 'POST', body: JSON.stringify(body) });
      else await v(`/v9/projects/${f.pid}/env/${f.envId}${q()}`, { method: 'PATCH', body: JSON.stringify(body) });
      console.log(`   â ${f.project} ${f.key} (${f.action})`);
    } catch (e) {
      console.log(`   â ${f.project} ${f.key}: ${String(e).slice(0, 140)}`);
    }
  }
}
