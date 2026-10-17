// Un-stamp contact points that were marked proven WITHOUT evidence — the
// cleanup half of v1.277.4 (that release stops new wrong stamps; this removes
// the ones already made). Until then, signing in stamped verified_at on every
// contact point carrying the address, including addresses an organiser typed
// onto somebody's record, and such a stamp opens that person's portal.
//
//   cd apps/api
//   npx tsx --env-file=<env> scripts/unstamp-unproven-contact-points.ts staging|prod                 # dry run
//   npx tsx --env-file=<env> scripts/unstamp-unproven-contact-points.ts staging|prod --apply         # writes; saves a restore file first
//   npx tsx --env-file=<env> scripts/unstamp-unproven-contact-points.ts staging|prod --restore <file>
//
// A point keeps its stamp when its person shows evidence of the participant's
// own use of that address — the same rule markEmailProven now applies
// (lib/proven-email.ts: evidencedPersons). Everything else loses verified_at,
// which takes away portal access through that address only: the person row,
// the address and every record stay as they are, and a later sign-in with
// evidence stamps it again. The dry run prints each point it would un-stamp
// (workspace, person, address) to this terminal, never anywhere else.
// --apply writes the restore file (point ids and their verified_at) BEFORE it
// changes anything, then reads back; --restore puts exactly those stamps back.

import { readFileSync, writeFileSync } from 'node:fs';
import { serviceRole } from '../src/lib/tenant-db.js';
import { evidencedPersons } from '../src/lib/proven-email.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const args = process.argv.slice(2);
const target = args[0];
const apply = args.includes('--apply');
const restoreAt = args.indexOf('--restore');
const restoreFile = restoreAt >= 0 ? args[restoreAt + 1] : undefined;
if (target !== 'prod' && target !== 'staging') {
  console.error('usage: npx tsx --env-file=<env> scripts/unstamp-unproven-contact-points.ts prod|staging [--apply | --restore <file>]');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}
const db = serviceRole('proven-email stamp cleanup: every verified email contact point, across workspaces, keyed on point id');

type Stamp = { id: string; verified_at: string };

if (restoreFile) {
  const stamps = JSON.parse(readFileSync(restoreFile, 'utf8')) as Stamp[];
  let put = 0;
  for (const s of stamps) {
    const { data, error } = await db.from('person_contact_point').update({ verified_at: s.verified_at }).eq('id', s.id).is('verified_at', null).select('id');
    if (error) throw new Error(`restore ${s.id}: ${error.message}`);
    put += data?.length ?? 0;
  }
  const back = await db.from('person_contact_point').select('id', { count: 'exact', head: true }).in('id', stamps.map((s) => s.id)).not('verified_at', 'is', null);
  console.log(`${target} · restored ${put} of ${stamps.length} stamp(s) from ${restoreFile} · read back: ${back.count} stamped`);
  process.exit(0);
}

// Every stamped email point, page by page.
type Point = { id: string; workspace_id: string; person_id: string; value: string; verified_at: string; is_primary: boolean };
const points: Point[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('person_contact_point')
    .select('id, workspace_id, person_id, value, verified_at, is_primary')
    .eq('kind', 'email')
    .not('verified_at', 'is', null)
    .order('id')
    .range(from, from + 999);
  if (error) throw new Error(`points: ${error.message}`);
  points.push(...((data ?? []) as Point[]));
  if ((data ?? []).length < 1000) break;
}

// A point that IS the person's own primary address grants nothing person.email
// does not already grant, so it is left alone. The rest are judged by evidence.
const byValue = new Map<string, Point[]>();
for (const p of points) {
  if (p.is_primary) continue;
  byValue.set(p.value, [...(byValue.get(p.value) ?? []), p]);
}
const unproven: Point[] = [];
for (const [value, list] of byValue) {
  const ok = await evidencedPersons(value, [...new Set(list.map((p) => p.person_id))]);
  for (const p of list) if (!ok.has(p.person_id)) unproven.push(p);
}

const wsIds = [...new Set(unproven.map((p) => p.workspace_id))];
const { data: wss } = wsIds.length ? await db.from('workspace').select('id, slug').in('id', wsIds) : { data: [] };
const slug = new Map((wss ?? []).map((w) => [w.id as string, w.slug as string]));

console.log(`${target} · ${apply ? 'APPLYING' : 'dry run'} · ${points.length} stamped email point(s), ${byValue.size} secondary address(es) checked\n`);
for (const p of unproven) console.log(`  un-stamp  ${slug.get(p.workspace_id) ?? p.workspace_id}  person ${p.person_id}  ${p.value}  (stamped ${p.verified_at.slice(0, 10)})`);
console.log(`\n${unproven.length} point(s) without evidence.`);
if (!apply || unproven.length === 0) {
  if (!apply) console.log('dry run: nothing written. Add --apply to un-stamp them (a restore file is written first).');
  process.exit(0);
}

const file = `unstamp-restore-${target}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify(unproven.map((p) => ({ id: p.id, verified_at: p.verified_at })), null, 2));
console.log(`restore file written: ${file}`);
for (let i = 0; i < unproven.length; i += 200) {
  const ids = unproven.slice(i, i + 200).map((p) => p.id);
  const { error } = await db.from('person_contact_point').update({ verified_at: null }).in('id', ids);
  if (error) throw new Error(`un-stamp: ${error.message} (restore with --restore ${file})`);
}
const left = await db.from('person_contact_point').select('id', { count: 'exact', head: true }).in('id', unproven.map((p) => p.id)).not('verified_at', 'is', null);
console.log(`un-stamped ${unproven.length} · read back: ${left.count} still stamped (expected 0)`);
