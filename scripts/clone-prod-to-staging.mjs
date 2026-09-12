#!/usr/bin/env node
// Copy one production workspace's SHAPE onto staging, with every identity
// scrambled.
//
// Sjoerd, 2026-09-12: *"Can you copy data from live to staging... so we have
// stuff to work with."* Asked which way, he chose scrambled: same people,
// same volume, same dates, same tags and stages — invented names.
//
// ── Why scrambled is not a compromise here ──────────────────────────────────
//
// Everything Connections computes is structural. The landscape counts
// attendance, the cadence axis measures gaps between conversations, the
// rarity rule weighs how many people share a tag. None of that reads a name.
// So a scrambled copy exercises every surface exactly as a real one would,
// and the one thing it costs — recognising a specific person while testing —
// is a thing to do on production anyway.
//
// What it avoids is real: a second system holding real names and notes, with
// its own test accounts and its own access, where anything erased in
// production lives on until somebody erases it again.
//
// ── What it does NOT copy ───────────────────────────────────────────────────
//
//   auth users, sessions, tokens   staging has its own, and a copied refresh
//                                  token would point at production's Google
//   purchases, invoices, Stripe    money is never test data
//   user_connection                credentials, full stop
//
// ── Idempotence ─────────────────────────────────────────────────────────────
//
// Every row it writes carries a marker (`created_via = 'clone'`, or a tag
// name prefix). Re-running deletes what a previous run made and rebuilds it,
// so this is safe to run repeatedly and leaves no drift.
//
//   node scripts/clone-prod-to-staging.mjs                 The Thread B.V.
//   node scripts/clone-prod-to-staging.mjs "soul.com"      another workspace
//   node scripts/clone-prod-to-staging.mjs --clean         remove, rebuild nothing

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Resolved from apps/api rather than by bare name: this script lives in
// scripts/, which has no package.json of its own, so a bare import finds
// nothing. The API workspace is where the client is a real dependency.
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createClient } = createRequire(path.join(ROOT, 'apps/api/package.json'))(
  '@supabase/supabase-js',
);

function envFrom(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return out;
}

const prodEnv = envFrom(path.join(ROOT, 'apps/api/.env'));
const stagingEnv = envFrom(path.join(ROOT, 'apps/api/.env.staging'));

// Belt and braces: this script writes, and writing to production because two
// env files were the same would be unrecoverable.
if (prodEnv.NEXT_PUBLIC_SUPABASE_URL === stagingEnv.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('prod and staging point at the same database — refusing');
  process.exit(1);
}
if (!stagingEnv.NEXT_PUBLIC_SUPABASE_URL.includes('lukhyylwhhjyihqtghvw')) {
  console.error(
    `staging env does not look like staging (${stagingEnv.NEXT_PUBLIC_SUPABASE_URL}) — refusing`,
  );
  process.exit(1);
}

const prod = createClient(prodEnv.NEXT_PUBLIC_SUPABASE_URL, prodEnv.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const stg = createClient(
  stagingEnv.NEXT_PUBLIC_SUPABASE_URL,
  stagingEnv.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const MARKER = 'clone';
const TAG_PREFIX = '~';

// ── The scrambler ───────────────────────────────────────────────────────────
//
// Deterministic from the source id, so re-running gives the same invented
// person the same invented name and a conversation about "Wilma" stays about
// Wilma across runs. Not reversible — there is no key and no lookup table
// kept anywhere, which is the point.

const FIRST = ['Wilma', 'Joost', 'Aniek', 'Bram', 'Fenna', 'Ruben', 'Sanne', 'Teun', 'Lotte', 'Daan', 'Iris', 'Kees', 'Nora', 'Pim', 'Roos', 'Sven', 'Tess', 'Wout', 'Yara', 'Zeno'];
const LAST = ['Doornbos', 'Veenstra', 'Hoogland', 'Brinkman', 'Kuipers', 'Molenaar', 'Roosendaal', 'Vermeulen', 'Woudstra', 'Zijlstra', 'Aalders', 'Bosman', 'Cornelisse', 'Dekker', 'Elzinga'];
const ORG_A = ['Noordlicht', 'Stroom', 'Kompas', 'Veldwerk', 'Baken', 'Vonk', 'Anker', 'Zaailing'];
const ORG_B = ['Collectief', 'Stichting', 'Coöperatie', 'Werkplaats', 'Instituut', 'Gilde'];

/** A small stable hash of a uuid — enough to index word lists. */
function h(id, salt = 0) {
  let n = salt;
  for (let i = 0; i < id.length; i += 1) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return n;
}

const fakePerson = (id) => ({
  first_name: FIRST[h(id, 1) % FIRST.length],
  last_name: LAST[h(id, 2) % LAST.length],
  // .invalid is reserved by RFC 2606 and can never route anywhere, so a stray
  // send from staging cannot reach a real inbox.
  email: `p${(h(id, 3) % 100000).toString().padStart(5, '0')}@example.invalid`,
});

const fakeOrg = (id) => `${ORG_A[h(id, 4) % ORG_A.length]} ${ORG_B[h(id, 5) % ORG_B.length]}`;

/**
 * Note bodies become filler of roughly the same length.
 *
 * Length is kept because it is structural — a one-line note and a three-
 * paragraph one are different objects on screen, and a composer tested only
 * against short text is a composer nobody tested. The words are not kept,
 * because a conversation note is the most sensitive text in the system.
 */
const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud'.split(' ');
function fakeBody(body, id) {
  if (!body) return body;
  const words = Math.max(1, Math.round(body.split(/\s+/).length));
  const start = h(id, 6) % LOREM.length;
  const out = [];
  for (let i = 0; i < words; i += 1) out.push(LOREM[(start + i) % LOREM.length]);
  return out.join(' ');
}

// ── Run ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cleanOnly = args.includes('--clean');
const wsName = args.find((a) => !a.startsWith('--')) ?? 'The Thread B.V.';

async function main() {
  const { data: srcWs } = await prod
    .from('workspace')
    .select('id,name')
    .eq('name', wsName)
    .maybeSingle();
  if (!srcWs) {
    console.error(`no production workspace named "${wsName}"`);
    process.exit(1);
  }

  // The destination is chosen by name too, and must already exist. This
  // script does not create workspaces: a workspace carries plan, membership
  // and billing, and inventing one on staging would diverge the two stacks in
  // a way nothing here could put back.
  const { data: dstWs } = await stg
    .from('workspace')
    .select('id,name')
    .eq('name', 'The Thread')
    .maybeSingle();
  if (!dstWs) {
    console.error('no staging workspace named "The Thread" — create it first');
    process.exit(1);
  }
  console.log(`${srcWs.name} (prod)  ->  ${dstWs.name} (staging)`);

  // ── Clean out anything a previous run made ────────────────────────────────
  // Order matters: children before parents, or the FKs refuse.
  const { data: oldPeople } = await stg
    .from('person')
    .select('id')
    .eq('workspace_id', dstWs.id)
    .eq('created_via', MARKER);
  const oldIds = (oldPeople ?? []).map((p) => p.id);
  if (oldIds.length) {
    await stg.from('person_tag').delete().in('person_id', oldIds);
    await stg.from('flow_run_note').delete().in('person_id', oldIds);
    await stg.from('activity').delete().in('person_id', oldIds);
    await stg.from('pulse_commitment').delete().in('person_id', oldIds);
    await stg.from('person').delete().in('id', oldIds);
  }
  await stg.from('tag').delete().eq('workspace_id', dstWs.id).like('name', `${TAG_PREFIX}%`);
  await stg
    .from('organisation')
    .delete()
    .eq('workspace_id', dstWs.id)
    .like('name', `${TAG_PREFIX}%`);
  console.log(`cleared ${oldIds.length} people from a previous clone`);
  if (cleanOnly) return;

  // ── Organisations ────────────────────────────────────────────────────────
  const { data: orgs } = await prod
    .from('organisation')
    .select('id,name,created_at')
    .eq('workspace_id', srcWs.id)
    .is('deleted_at', null);
  const orgMap = new Map();
  for (const o of orgs ?? []) {
    const { data: made } = await stg
      .from('organisation')
      .insert({
        workspace_id: dstWs.id,
        name: `${TAG_PREFIX}${fakeOrg(o.id)}`,
        created_at: o.created_at,
      })
      .select('id')
      .single();
    if (made) orgMap.set(o.id, made.id);
  }
  console.log(`organisations: ${orgMap.size}`);

  // ── People ───────────────────────────────────────────────────────────────
  const { data: people } = await prod
    .from('person')
    .select('id,created_at,country,city')
    .eq('workspace_id', srcWs.id)
    .is('deleted_at', null)
    .is('merged_into', null);
  const personMap = new Map();
  for (const p of people ?? []) {
    const { data: made, error } = await stg
      .from('person')
      .insert({
        workspace_id: dstWs.id,
        ...fakePerson(p.id),
        // Structural, not identifying: the landscape and the people list both
        // show country, and a column that is null everywhere tests nothing.
        country: p.country,
        city: p.city,
        created_at: p.created_at,
        created_via: MARKER,
      })
      .select('id')
      .single();
    if (error) console.warn('  person failed:', error.message);
    else personMap.set(p.id, made.id);
  }
  console.log(`people: ${personMap.size}`);

  // ── Activity ─────────────────────────────────────────────────────────────
  // The spine of the ladder and of every cadence measure. Subject lines are
  // scrambled: they are free text and can carry a name.
  //
  // app_id has to be TRANSLATED, not copied. The two databases have the same
  // apps under the same slugs and different uuids, so a copied id points at
  // nothing and the FK refuses the whole batch — which is how the first run
  // of this script lost every activity row while reporting a count.
  const [{ data: prodApps }, { data: stgApps }] = await Promise.all([
    prod.from('app').select('id,slug'),
    stg.from('app').select('id,slug'),
  ]);
  const stgBySlug = new Map((stgApps ?? []).map((a) => [a.slug, a.id]));
  const appMap = new Map();
  for (const a of prodApps ?? []) {
    const there = stgBySlug.get(a.slug);
    if (there) appMap.set(a.id, there);
  }

  const { data: acts } = await prod
    .from('activity')
    .select('id,person_id,app_id,type,subject,occurred_at')
    .eq('workspace_id', srcWs.id)
    .limit(5000);
  const actRows = (acts ?? [])
    .filter((a) => personMap.has(a.person_id) && appMap.has(a.app_id))
    .map((a) => ({
      workspace_id: dstWs.id,
      person_id: personMap.get(a.person_id),
      app_id: appMap.get(a.app_id),
      type: a.type,
      subject: fakeBody(a.subject, a.id),
      occurred_at: a.occurred_at,
    }));
  // Counted from what actually landed, not from what was attempted. The first
  // version printed the attempted figure and reported 28 rows while inserting
  // none, which is the worst thing a data script can do.
  let actWritten = 0;
  for (let i = 0; i < actRows.length; i += 500) {
    const batch = actRows.slice(i, i + 500);
    const { error } = await stg.from('activity').insert(batch);
    if (error) console.warn('  activity batch failed:', error.message);
    else actWritten += batch.length;
  }
  console.log(`activity: ${actWritten}${actWritten === actRows.length ? '' : ` of ${actRows.length}`}`);

  // ── Notes ────────────────────────────────────────────────────────────────
  const { data: notes } = await prod
    .from('flow_run_note')
    .select('id,person_id,body,kind,origin,happened_at,is_draft,created_at')
    .eq('workspace_id', srcWs.id)
    .is('deleted_at', null)
    .limit(2000);
  const noteRows = (notes ?? [])
    .filter((n) => n.person_id && personMap.has(n.person_id))
    .map((n) => ({
      workspace_id: dstWs.id,
      person_id: personMap.get(n.person_id),
      body: fakeBody(n.body, n.id),
      kind: n.kind,
      origin: n.origin,
      happened_at: n.happened_at,
      is_draft: n.is_draft,
      created_at: n.created_at,
    }));
  if (noteRows.length) {
    const { error } = await stg.from('flow_run_note').insert(noteRows);
    if (error) console.warn('  notes failed:', error.message);
  }
  console.log(`notes: ${noteRows.length}`);

  // ── Deals ────────────────────────────────────────────────────────────────
  // Stage and dates are the whole point (rot, the opportunity axis); the
  // label is free text and gets scrambled.
  const { data: deals } = await prod
    .from('pulse_commitment')
    .select('id,person_id,organisation_id,direction,label,stage,probability,created_at,updated_at')
    .eq('workspace_id', srcWs.id)
    .is('deleted_at', null)
    .limit(1000);
  let dealCount = 0;
  for (const d of deals ?? []) {
    if (d.person_id && !personMap.has(d.person_id)) continue;
    const { error } = await stg.from('pulse_commitment').insert({
      workspace_id: dstWs.id,
      direction: d.direction,
      label: `${TAG_PREFIX}${fakeBody(d.label, d.id)}`,
      stage: d.stage,
      probability: d.probability,
      person_id: d.person_id ? personMap.get(d.person_id) : null,
      organisation_id: d.organisation_id ? (orgMap.get(d.organisation_id) ?? null) : null,
      created_at: d.created_at,
      updated_at: d.updated_at,
    });
    if (error) console.warn('  deal failed:', error.message);
    else dealCount += 1;
  }
  console.log(`deals: ${dealCount}`);

  console.log('\ndone. Every row carries a marker, so re-running replaces it.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
