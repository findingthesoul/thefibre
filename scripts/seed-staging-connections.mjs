#!/usr/bin/env node
// Give STAGING enough connective tissue for the Connections map to mean
// something: tags that overlap, people who share an employer, and a few
// recorded relationships.
//
// WHY: staging is a scrambled clone of production's PEOPLE, but almost none of
// what TIES them — 2 tags, 3 tag links, 3 current memberships, 0 relationships
// across 30 people. The map's whole job is to show ties, so it looked empty and
// read as broken (Sjoerd, 2026-09-13: "I don't see it online" / "add more data").
//
// SAFE BY CONSTRUCTION:
//   * Refuses to run against anything but the staging project ref.
//   * Writes only to tag / person_tag / org_membership / relationship.
//   * Deterministic and idempotent: the same graph every run, no duplicates.
//   * Everything it creates is recognisable — tags carry SEED_COLOR and
//     person_tag rows carry created_via='seed' — so `--undo` can remove
//     exactly its own rows and nothing a human made.
//
// Usage:
//   node scripts/seed-staging-connections.mjs
//   node scripts/seed-staging-connections.mjs --undo

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const STAGING_REF = fs.readFileSync(path.join(root, 'supabase/.staging-ref'), 'utf8').trim();

// The env lives in the MAIN checkout; a worktree has no copy of it.
const ENV_FILE = '/Users/sjoerdair/Projects/thefibre/apps/api/.env.staging';
for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
  if (!line.includes('=') || line.trim().startsWith('#')) continue;
  const i = line.indexOf('=');
  process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(STAGING_REF)) {
  console.error(`REFUSED: ${url} is not the staging project (${STAGING_REF}).`);
  process.exit(1);
}
const { adminClient: db } = await import(path.join(root, 'apps/api/dist/db.js'));

const UNDO = process.argv.includes('--undo');
/** Marks every tag this script owns. A human-made tag never carries it. */
const SEED_COLOR = '#9fb4c7';
const SEED_VIA = 'seed';

const { data: ws } = await db.from('workspace').select('id, name').eq('name', 'The Thread').maybeSingle();
if (!ws) throw new Error('no workspace called "The Thread" on staging');

// ── A community's vocabulary ────────────────────────────────────────────────
// Sized on purpose: a couple of common words that tie almost nobody (the
// rarity weighting should mute them) and several rare ones that should pull
// hard. That is the behaviour worth looking at, not just "lots of lines".
const TAGS = [
  { name: 'newsletter', share: 0.8 },
  { name: 'alumni', share: 0.5 },
  { name: 'facilitation', share: 0.3 },
  { name: 'athens-2026', share: 0.25 },
  { name: 'deep democracy', share: 0.2 },
  { name: 'board', share: 0.13 },
  { name: 'sdg13', share: 0.13 },
  { name: 'mentor', share: 0.1 },
  { name: 'youth track', share: 0.1 },
  { name: 'donor circle', share: 0.07 },
];

const REL_TYPES = ['colleague', 'peer', 'mentor', 'introduced_by', 'co_facilitates'];
const TITLES = ['Director', 'Programme lead', 'Board member', 'Facilitator', 'Coordinator', 'Volunteer'];

/** Deterministic 0..1 from a string, so every run builds the same graph. */
function rnd(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const { data: peopleRows } = await db
  .from('person')
  .select('id, first_name, last_name')
  .eq('workspace_id', ws.id)
  .is('deleted_at', null)
  .is('merged_into', null)
  .order('id');
const people = peopleRows ?? [];
const { data: orgRows } = await db
  .from('organisation')
  .select('id, name')
  .eq('workspace_id', ws.id)
  .is('deleted_at', null)
  .order('id');
const orgs = orgRows ?? [];
console.log(`${ws.name}: ${people.length} people, ${orgs.length} organisations`);

// ── Undo ────────────────────────────────────────────────────────────────────
if (UNDO) {
  const { data: mine } = await db.from('tag').select('id').eq('workspace_id', ws.id).eq('color', SEED_COLOR);
  const ids = (mine ?? []).map((t) => t.id);
  if (ids.length) {
    await db.from('person_tag').delete().in('tag_id', ids);
    await db.from('tag').delete().in('id', ids);
  }
  await db.from('person_tag').delete().eq('created_via', SEED_VIA);
  // Relationships and memberships this script made carry its own marker text.
  await db.from('relationship').delete().eq('workspace_id', ws.id).eq('notes', SEED_VIA);
  await db.from('org_membership').delete().eq('department', SEED_VIA);
  console.log(`undone: ${ids.length} tags and their links, plus seeded relationships and memberships`);
  process.exit(0);
}

// ── Tags ────────────────────────────────────────────────────────────────────
let tagLinks = 0;
for (const t of TAGS) {
  let { data: tag } = await db
    .from('tag')
    .select('id')
    .eq('workspace_id', ws.id)
    .eq('name', t.name)
    .maybeSingle();
  if (!tag) {
    const { data: made, error } = await db
      .from('tag')
      .insert({ workspace_id: ws.id, name: t.name, color: SEED_COLOR })
      .select('id')
      .single();
    if (error) throw new Error(`tag ${t.name}: ${error.message}`);
    tag = made;
  }
  const holders = people.filter((p) => rnd(`${t.name}|${p.id}`) < t.share);
  if (holders.length) {
    const { error } = await db.from('person_tag').upsert(
      holders.map((p) => ({ person_id: p.id, tag_id: tag.id, created_via: SEED_VIA })),
      { onConflict: 'person_id,tag_id' },
    );
    if (error) throw new Error(`person_tag ${t.name}: ${error.message}`);
    tagLinks += holders.length;
  }
  console.log(`  #${t.name}: ${holders.length} people`);
}

// ── Employers ───────────────────────────────────────────────────────────────
// Six of the organisations get staff, so shared-employer links actually cluster
// rather than scattering one person per company across nineteen.
const employers = orgs.slice(0, 6);
let memberships = 0;
for (const p of people) {
  const r = rnd(`org|${p.id}`);
  if (r > 0.75) continue; // a quarter belong to none, as in life
  const org = employers[Math.floor(rnd(`which|${p.id}`) * employers.length)];
  const { data: existing } = await db
    .from('org_membership')
    .select('id')
    .eq('person_id', p.id)
    .eq('org_id', org.id)
    .is('ended_at', null)
    .maybeSingle();
  if (existing) continue;
  const { error } = await db.from('org_membership').insert({
    person_id: p.id,
    org_id: org.id,
    title: TITLES[Math.floor(rnd(`title|${p.id}`) * TITLES.length)],
    department: SEED_VIA,
    is_primary: true,
    is_decision_maker: rnd(`dm|${p.id}`) > 0.8,
  });
  if (error) throw new Error(`org_membership ${p.id}: ${error.message}`);
  memberships += 1;
}

// ── Recorded relationships ──────────────────────────────────────────────────
// The only kind the map draws solid, so there need to be enough to see the
// difference between "somebody said so" and "they share a word".
let rels = 0;
for (let i = 0; i < people.length; i += 1) {
  for (let j = i + 1; j < people.length; j += 1) {
    const a = people[i];
    const b = people[j];
    if (rnd(`rel|${a.id}|${b.id}`) > 0.045) continue;
    const { data: existing } = await db
      .from('relationship')
      .select('id')
      .eq('workspace_id', ws.id)
      .eq('from_person_id', a.id)
      .eq('to_person_id', b.id)
      .maybeSingle();
    if (existing) continue;
    const { error } = await db.from('relationship').insert({
      workspace_id: ws.id,
      from_person_id: a.id,
      to_person_id: b.id,
      type: REL_TYPES[Math.floor(rnd(`type|${a.id}|${b.id}`) * REL_TYPES.length)],
      notes: SEED_VIA,
    });
    if (error) throw new Error(`relationship: ${error.message}`);
    rels += 1;
  }
}

console.log(`\ntag links: ${tagLinks}   new memberships: ${memberships}   new relationships: ${rels}`);

// ── What the map will now show ──────────────────────────────────────────────
const ids = people.map((p) => p.id);
const { data: links } = await db.rpc('connections_links_among', { p_workspace: ws.id, p_people: ids });
console.log(`connections_links_among over all ${ids.length}: ${(links ?? []).length} pairs`);
const sample = people[0];
const { data: nb } = await db.rpc('connections_neighbourhood', {
  p_workspace: ws.id,
  p_person: sample.id,
  p_limit: 40,
});
const name = (p) => [p.first_name, p.last_name].filter(Boolean).join(' ');
console.log(`neighbours of ${name(sample)}: ${(nb ?? []).length}`);
