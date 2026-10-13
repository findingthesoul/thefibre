// Remove duplicate LIVE consent records, so the unique index can exist.
//
//   node apps/api/scripts/dedupe-consent-records.mjs staging          # DRY RUN
//   node apps/api/scripts/dedupe-consent-records.mjs staging --apply
//   node apps/api/scripts/dedupe-consent-records.mjs prod   [--apply]
//
// DRY BY DEFAULT. A script, never a migration: a data conversion belongs to
// one database at a time, with a human reading the counts in between (the
// repo's own rule, learned the hard way).
//
// WHY THESE ROWS EXIST. setDirectoryListing read "was this listed?" and then
// inserted a consent record, and the two webhooks that converge on
// ensureMemberFromSubscription can arrive together: both read false, both
// insert. One human act, two rows, milliseconds apart.
//
// WHY IT DELETES RATHER THAN REVOKES. A revoked row asserts that somebody
// WITHDREW their consent, and nobody did. The surplus row is an artefact of
// my own race, not a record of a human act, and the truest repair is for the
// evidence to show what actually happened: one consent, at the moment it was
// given. The EARLIEST row of each duplicated pair survives, because that is
// when the person said yes. (This is the one case where deleting a consent
// row is right; a consent a person withdraws is always revoked, never
// deleted — see lib/directory-consent.ts.)
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const which = process.argv[2];
const apply = process.argv.includes('--apply');
if (which !== 'prod' && which !== 'staging') {
  console.error('usage: node dedupe-consent-records.mjs staging|prod [--apply]');
  process.exit(2);
}
const file =
  which === 'prod'
    ? process.env.FIBRE_ENV_FILE ?? 'apps/api/.env'
    : process.env.FIBRE_STAGING_ENV_FILE ?? 'apps/api/.env.staging';
const expect = which === 'prod' ? 'zfsyyokepyycefbxiblc' : 'lukhyylwhhjyihqtghvw';

const raw = readFileSync(file, 'utf8');
const env = Object.fromEntries(
  raw
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
if (!(env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes(expect)) {
  throw new Error(`${file} is not the ${which} project — refusing`);
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await db
  .from('consent_record')
  .select('id, person_id, purpose_code, granted_at, revoked_at, text_version');
if (error) throw new Error(error.message);

const live = (data ?? []).filter((r) => r.revoked_at === null);
const groups = new Map();
for (const r of live) {
  // The SAME key the index uses — person, purpose and TEXT VERSION. A newer
  // version of the words is a new consent, not a duplicate, and deduping on
  // (person, purpose) alone would delete a real one.
  const k = `${r.person_id}|${r.purpose_code}|${r.text_version ?? ''}`;
  groups.set(k, [...(groups.get(k) ?? []), r]);
}

const surplus = [];
for (const [, rows] of groups) {
  if (rows.length < 2) continue;
  // Earliest first: the moment consent was actually given survives.
  const sorted = [...rows].sort((a, b) => a.granted_at.localeCompare(b.granted_at));
  surplus.push(...sorted.slice(1));
}

console.log(
  `${which}: ${(data ?? []).length} consent rows, ${live.length} live, ` +
    `${[...groups.values()].filter((r) => r.length > 1).length} duplicated pair(s), ` +
    `${surplus.length} surplus row(s) to remove.`,
);
for (const r of surplus) {
  // Purpose and timing only — a count-level report names nobody.
  console.log(`  surplus: purpose=${r.purpose_code} version=${r.text_version ?? '(none)'} granted_at=${r.granted_at}`);
}

if (!surplus.length) {
  console.log('Nothing to do — the unique index can be created.');
  process.exit(0);
}
if (!apply) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply to remove them.');
  process.exit(0);
}

const { error: delErr } = await db
  .from('consent_record')
  .delete()
  .in(
    'id',
    surplus.map((r) => r.id),
  );
if (delErr) throw new Error(`delete: ${delErr.message}`);

// Read back rather than trusting the write: the whole point of this script is
// that the index cannot be created until the answer is zero.
const { data: after } = await db
  .from('consent_record')
  .select('person_id, purpose_code, text_version, revoked_at');
const stillLive = (after ?? []).filter((r) => r.revoked_at === null);
const stillDup = new Map();
for (const r of stillLive) {
  const k = `${r.person_id}|${r.purpose_code}|${r.text_version ?? ''}`;
  stillDup.set(k, (stillDup.get(k) ?? 0) + 1);
}
const remaining = [...stillDup.values()].filter((n) => n > 1).length;
console.log(`Removed ${surplus.length}. Duplicated pairs remaining: ${remaining}.`);
process.exit(remaining === 0 ? 0 : 1);
