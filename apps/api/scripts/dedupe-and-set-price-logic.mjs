// Collapse a workspace's duplicate general pricing rules into ONE row, and
// optionally fill it from a country-income policy.
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/dedupe-and-set-price-logic.mjs \
//       staging --workspace default [--policy wb-fy2027] [--keep CL=75 ...] [--apply]
//
// THE STACK IS THE FIRST WORD, and it is checked against the env file's own
// project ref — the same shape as `dedupe-consent-records` and
// `set-workspace-role`. Printing which database it is about to act on helps
// somebody who reads the output; refusing a mismatch helps somebody who does
// not. The command's own words should say which database it changes, and if
// they disagree with the env file, that is a mistake rather than a
// preference.
//
// WHY A SCRIPT AND NOT A MIGRATION. This is a bulk data conversion, and the
// house rule is one run per database with eyes on it, never a migration that
// fans out silently (docs: bulk conversions). It also has to run BEFORE the
// `NULLS NOT DISTINCT` migration, because that constraint cannot be created
// while the duplicates it forbids are still there.
//
// WHAT WENT WRONG, so the next reader knows what this is cleaning up.
// `membership_pricing_rule` is unique on (workspace_id, kind, tier_id), and
// Postgres treats NULLs as DISTINCT in a unique index. A GENERAL rule — one
// that applies to every tier — has `tier_id = NULL`, so the route's
// `onConflict: 'workspace_id,kind,tier_id'` never conflicted and INSERTED a
// new row on every save. soul.com accumulated six. Both readers then took
// whichever row came back first from a query with no ORDER BY, and one of
// those readers decides what somebody is CHARGED: production spent five weeks
// pricing on a rule set from 7 September.
//
// v1.187.2 made the newest row win, which stopped the bleeding. This removes
// the rows.
//
// DRY RUN BY DEFAULT. It prints every row it would delete, the rule set it
// would leave behind, and — the part worth reading before pressing anything —
// which countries' prices go UP and which go DOWN, by comparing what is
// CHARGED today against what the new rule set would charge. A percentage
// moving up is somebody paying more than they paid yesterday, and that should
// never be a surprise discovered afterwards.

import fs from 'node:fs';
import {
  COUNTRY_CATEGORY_PCT,
  WB_FY2027_CATEGORY_C,
  WB_FY2027_UPPER_MIDDLE,
} from '@thefibre/shared/country-income-wb-fy2027';
import { countryName } from '@thefibre/shared/countries';

// ── arguments ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);

/** Project refs, by name. Hard-coded on purpose: a value read from the thing
 *  it is meant to check is not a check. */
const PROJECT_REF = {
  prod: 'zfsyyokepyycefbxiblc',
  staging: 'lukhyylwhhjyihqtghvw',
};
const stack = argv[0];
if (!Object.hasOwn(PROJECT_REF, stack ?? '')) {
  console.error('first argument must be `staging` or `prod` — it names the database this acts on');
  console.error('  node apps/api/scripts/dedupe-and-set-price-logic.mjs staging --workspace default');
  process.exit(2);
}
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : (argv[i + 1] ?? '');
};
const has = (name) => argv.includes(`--${name}`);

const workspaceSlug = flag('workspace');
const policy = flag('policy');
const apply = has('apply');
/** `--keep CL=75` — an explicit, printed exception to the policy. Repeatable.
 *  It exists so a disagreement with the policy is stated in the command and
 *  shown in the output, rather than hand-edited into the data afterwards
 *  where nobody can see it was deliberate. */
const keep = new Map(
  argv
    .map((a, i) => (a === '--keep' ? argv[i + 1] : null))
    .filter(Boolean)
    .map((pair) => {
      const [code, pct] = String(pair).split('=');
      if (!code || !pct || !Number.isFinite(Number(pct))) {
        console.error(`--keep expects CODE=PCT, got ${JSON.stringify(pair)}`);
        process.exit(2);
      }
      return [code.toUpperCase(), Number(pct)];
    }),
);

if (!workspaceSlug) {
  console.error('--workspace <slug> is required');
  process.exit(2);
}
if (policy && policy !== 'wb-fy2027') {
  console.error(`unknown --policy ${policy}; the only one is wb-fy2027`);
  process.exit(2);
}

// ── the database ───────────────────────────────────────────────────────────
const envFile = process.env.FIBRE_ENV_FILE;
if (!envFile) {
  console.error('set FIBRE_ENV_FILE to the env file of the database to act on');
  process.exit(2);
}
const env = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error(`${envFile} has no NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`);
  process.exit(2);
}
// SAY WHICH DATABASE, every time and before anything else. The one mistake
// this script could make that nothing undoes is running on the wrong one.
const project = URL_.replace(/^https:\/\//, '').split('.')[0];
if (project !== PROJECT_REF[stack]) {
  console.error(
    `REFUSED: you said \`${stack}\` (${PROJECT_REF[stack]}) but ${envFile} points at ${project}.`,
  );
  console.error('  Fix the argument or the env file — do not make the script guess which you meant.');
  process.exit(2);
}
console.log(`database: ${project}  — ${stack}  (${envFile})`);
console.log(`mode:     ${apply ? 'APPLY — this will delete rows and write one' : 'dry run'}`);

const call = async (path, init = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} → ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
};

// ── the policy, as a rule set ──────────────────────────────────────────────
function policyRules() {
  const b = WB_FY2027_UPPER_MIDDLE.map((c) => c.code);
  const c = WB_FY2027_CATEGORY_C.map((c2) => c2.code);
  const overridden = new Set(keep.keys());
  // A --keep code leaves its category and gets its own rule, so the override
  // is visible in the stored data as well as in this output.
  const rules = [
    { when: { attr: 'country', op: 'in', values: b.filter((x) => !overridden.has(x)) }, pct: COUNTRY_CATEGORY_PCT.B },
    { when: { attr: 'country', op: 'in', values: c.filter((x) => !overridden.has(x)) }, pct: COUNTRY_CATEGORY_PCT.C },
  ].filter((r) => r.when.values.length > 0);
  for (const [code, pct] of keep) {
    rules.unshift({ when: { attr: 'country', op: 'in', values: [code] }, pct });
  }
  return { rules, default_pct: COUNTRY_CATEGORY_PCT.default };
}

/** The same reading the evaluator does: first matching rule wins. */
function pctFor(config, code) {
  for (const r of config?.rules ?? []) {
    const w = r.when ?? {};
    if (w.attr !== 'country' || !Array.isArray(w.values)) continue;
    const inSet = w.values.map((v) => String(v).toUpperCase()).includes(code);
    if ((w.op === 'in' && inSet) || (w.op === 'not_in' && !inSet)) return r.pct;
  }
  return config?.default_pct ?? 100;
}

// ── go ─────────────────────────────────────────────────────────────────────
const ws = (await call(`workspace?select=id,name,slug&slug=eq.${encodeURIComponent(workspaceSlug)}`))[0];
if (!ws) {
  console.error(`no workspace "${workspaceSlug}" in ${project}`);
  process.exit(1);
}
console.log(`workspace: ${ws.name} (${ws.slug})\n`);

const rows = await call(
  `membership_pricing_rule?select=id,tier_id,config,created_at,updated_at&kind=eq.price_logic&workspace_id=eq.${ws.id}&order=updated_at.asc`,
);
const general = rows.filter((r) => r.tier_id === null);
const tierScoped = rows.filter((r) => r.tier_id !== null);

console.log(`${rows.length} price_logic row(s): ${general.length} general, ${tierScoped.length} tier-scoped`);
if (tierScoped.length) {
  console.log('  tier-scoped rows are NOT touched by this script.');
}
if (!general.length) {
  console.log('\nNo general rule to clean up.');
  if (!policy) process.exit(0);
}

// WHAT IS CHARGED TODAY is the newest general row — the rule v1.187.2 put in
// place. Reading it the same way the API does is what makes the up/down list
// trustworthy rather than a guess about which row was winning.
const newest = [...general].sort((a, b) =>
  (b.updated_at ?? '').localeCompare(a.updated_at ?? '') ||
  (b.created_at ?? '').localeCompare(a.created_at ?? '') ||
  b.id.localeCompare(a.id),
)[0];

const doomed = general.filter((r) => r.id !== newest?.id);
if (doomed.length) {
  console.log(`\n── would DELETE ${doomed.length} duplicate general row(s) ──`);
  for (const r of doomed) {
    const summary = (r.config?.rules ?? [])
      .map((x) => `${(x.when?.values ?? []).join('/')}→${x.pct}%`)
      .join('  ');
    console.log(`  ${r.id}  ${(r.updated_at ?? '').slice(0, 10)}  ${summary || '(no rules)'}  default ${r.config?.default_pct ?? 100}%`);
  }
  console.log(`  keeping ${newest.id} (${(newest.updated_at ?? '').slice(0, 10)})`);
}

const next = policy ? policyRules() : newest?.config;
if (policy) {
  console.log(`\n── the rule set it would leave behind (policy ${policy}) ──`);
  for (const r of next.rules) {
    console.log(`  ${r.pct.toString().padStart(3)}%  ${r.when.values.length} countries: ${r.when.values.join(' ')}`);
  }
  console.log(`  ${String(next.default_pct).padStart(3)}%  everyone else`);
  if (keep.size) {
    console.log('\n  EXPLICIT OVERRIDES, against the policy:');
    for (const [code, pct] of keep) {
      console.log(`    ${code} ${countryName(code) ?? ''} pinned at ${pct}% by --keep`);
    }
  }
}

// ── who pays more, who pays less ───────────────────────────────────────────
if (newest && next) {
  const codes = [
    ...new Set([
      ...(newest.config?.rules ?? []).flatMap((r) => r.when?.values ?? []),
      ...(next.rules ?? []).flatMap((r) => r.when?.values ?? []),
    ].map((v) => String(v).toUpperCase())),
  ].sort();
  const up = [];
  const down = [];
  for (const code of codes) {
    const before = pctFor(newest.config, code);
    const after = pctFor(next, code);
    if (after > before) up.push([code, before, after]);
    else if (after < before) down.push([code, before, after]);
  }
  const say = (label, list) => {
    console.log(`\n── price goes ${label} for: ${list.length} ──`);
    for (const [code, before, after] of list) {
      console.log(`  ${code} ${(countryName(code) ?? '').padEnd(26)} ${before}% → ${after}%`);
    }
    if (!list.length) console.log('  (none)');
  };
  // UP FIRST, deliberately: it is the list somebody has to agree to.
  say('UP', up);
  say('DOWN', down);

  // Anybody actually affected? A percentage is abstract; a member is not.
  const members = await call(
    `membership_member?select=id,country,status,person:person_id(email)&workspace_id=eq.${ws.id}&status=in.(active,grace)`,
  );
  const touched = members
    .filter((m) => m.country)
    .map((m) => [m, pctFor(newest.config, m.country.toUpperCase()), pctFor(next, m.country.toUpperCase())])
    .filter(([, b2, a]) => b2 !== a);
  console.log(`\n── members whose percentage changes: ${touched.length} of ${members.length} active/grace ──`);
  for (const [m, b2, a] of touched) {
    console.log(`  ${m.person?.email ?? m.id}  ${m.country}  ${b2}% → ${a}%`);
  }
  if (!touched.length) {
    console.log('  (none — every current member keeps the percentage they have)');
  }
}

// ── act ────────────────────────────────────────────────────────────────────
if (!apply) {
  console.log('\nDry run. Nothing was changed. Add --apply to do it.');
  process.exit(0);
}

for (const r of doomed) {
  await call(`membership_pricing_rule?id=eq.${r.id}`, { method: 'DELETE' });
  console.log(`deleted ${r.id}`);
}
if (policy && newest) {
  await call(`membership_pricing_rule?id=eq.${newest.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ config: next, updated_at: new Date().toISOString() }),
  });
  console.log(`updated ${newest.id} to the ${policy} policy`);
} else if (policy && !newest) {
  const made = await call('membership_pricing_rule', {
    method: 'POST',
    body: JSON.stringify({
      workspace_id: ws.id,
      tier_id: null,
      kind: 'price_logic',
      config: next,
      updated_at: new Date().toISOString(),
    }),
  });
  console.log(`created ${made[0].id} with the ${policy} policy`);
}

// ── read it back ───────────────────────────────────────────────────────────
// Never trust the write; ask the database what is there now. A PostgREST
// write can succeed and store something other than what was meant.
const after = await call(
  `membership_pricing_rule?select=id,tier_id,config,updated_at&kind=eq.price_logic&workspace_id=eq.${ws.id}`,
);
const generalAfter = after.filter((r) => r.tier_id === null);
console.log(`\nread back: ${generalAfter.length} general row(s)`);
if (generalAfter.length !== 1) {
  console.error('EXPECTED EXACTLY ONE. Something else is writing, or a delete failed.');
  process.exit(1);
}
const left = generalAfter[0];
for (const r of left.config?.rules ?? []) {
  console.log(`  ${r.pct}%  ${(r.when?.values ?? []).length} countries`);
}
console.log(`  default ${left.config?.default_pct}%`);
console.log('\nDone.');
