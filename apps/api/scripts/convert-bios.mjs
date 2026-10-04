// Convert stored bios from plain text to HTML — steps B (staging) and C
// (production) of docs/bio-rich-text-conversion.md.
//
// Reads nothing by default: `--count` is the resting state, so running it by
// accident tells you about the data instead of changing it.
//
//   node apps/api/scripts/convert-bios.mjs --count     what WOULD change
//   node apps/api/scripts/convert-bios.mjs --one       convert ONE row, then
//                                                      restore it and assert
//                                                      it came back identical
//   node apps/api/scripts/convert-bios.mjs --apply     convert the rest
//   node apps/api/scripts/convert-bios.mjs --restore   put every backed-up
//                                                      bio back
//
// Pick the database with FIBRE_ENV_FILE (apps/api/.env.staging for step B).
//
// The backup table has to exist first, and it is applied with
// `./scripts/db-push-staging.sh` — NEVER a bare `supabase db push`, whose CLI
// link points at PRODUCTION. That is one keystroke between a staging step and
// a production schema change, which is why it is written here rather than
// remembered.
// It prints which project it is talking to before it does anything, because
// "which stack" is the question this script must never get wrong.
//
// The order is deliberate and is the whole point of --one: a restore path
// that has never run is a belief, not a backup. Prove it on one row, with the
// most awkward content you have, before touching the rest.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bioToHtml, looksLikeStoredHtml } from '@thefibre/shared';

const MODES = ['--count', '--one', '--apply', '--restore'];
const mode = process.argv.find((a) => MODES.includes(a)) ?? '--count';

const envPath = resolve(process.env.FIBRE_ENV_FILE ?? 'apps/api/.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) throw new Error(`no Supabase credentials in ${envPath}`);

const ref = BASE.replace('https://', '').split('.')[0];
const STAGING_REF = 'lukhyylwhhjyihqtghvw';
console.log(`env      ${envPath}`);
console.log(`project  ${ref}${ref === STAGING_REF ? '  (staging)' : '  ** NOT staging **'}`);
console.log(`mode     ${mode}\n`);

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function rest(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...h, ...init.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/** The four places a person's bio is stored, and the column that identifies a
 *  row in each. Derived from the READERS (lib/identity-profile.ts,
 *  routes/thread.ts, routes/meet.ts), not from memory: a conversion that
 *  skips one leaves plain text behind a renderer that expects HTML. */
const SOURCES = [
  { table: 'identity_profile', key: 'email' },
  { table: 'user_profile', key: 'user_id' },
  { table: 'thread_organiser', key: 'id' },
  { table: 'meet_host', key: 'id' },
];

async function pending() {
  const out = [];
  for (const s of SOURCES) {
    const rows = await rest(`${s.table}?select=${s.key},bio&bio=not.is.null`);
    const plain = rows.filter((r) => r.bio?.trim() && !looksLikeStoredHtml(r.bio.trim()));
    out.push({ ...s, total: rows.length, plain });
  }
  return out;
}

function report(sources) {
  for (const s of sources) {
    console.log(
      `${s.table.padEnd(18)} ${String(s.total).padStart(3)} with a bio, ` +
        `${String(s.plain.length).padStart(3)} still plain`,
    );
  }
  const all = sources.flatMap((s) => s.plain);
  console.log(`\n${all.length} row(s) would change.`);
  return all;
}

/** The most awkward row we have: newlines first, then angle brackets or
 *  ampersands, then the longest. Converting the easiest row proves least. */
function mostAwkward(sources) {
  const scored = sources.flatMap((s) =>
    s.plain.map((r) => ({
      source: s,
      row: r,
      score:
        (r.bio.includes('\n\n') ? 4 : 0) +
        (r.bio.includes('\n') ? 2 : 0) +
        (/[<>&]/.test(r.bio) ? 3 : 0) +
        Math.min(r.bio.length / 500, 2),
    })),
  );
  return scored.sort((a, b) => b.score - a.score)[0] ?? null;
}

async function convertRow(source, row) {
  const before = row.bio;
  const after = bioToHtml(before);
  if (!after || after === before) return false;
  // Backup FIRST. A conversion that dies halfway must leave a complete record
  // of everything it had already touched.
  await rest('bio_conversion_backup', {
    method: 'POST',
    body: JSON.stringify({ source_table: source.table, row_key: String(row[source.key]), bio_before: before }),
  });
  await rest(`${source.table}?${source.key}=eq.${encodeURIComponent(row[source.key])}`, {
    method: 'PATCH',
    body: JSON.stringify({ bio: after }),
  });
  return true;
}

async function readBack(source, row) {
  const [fresh] = await rest(
    `${source.table}?select=bio&${source.key}=eq.${encodeURIComponent(row[source.key])}`,
  );
  return fresh?.bio ?? null;
}

const sources = await pending();

if (mode === '--count') {
  report(sources);
  const worst = mostAwkward(sources);
  if (worst) {
    console.log(
      `\nthe awkward one (--one would take this): ${worst.source.table} ` +
        `${worst.row[worst.source.key]}\n  ${JSON.stringify(worst.row.bio.slice(0, 160))}`,
    );
  }
  console.log('\nNothing was changed.');
} else if (mode === '--one') {
  const worst = mostAwkward(sources);
  if (!worst) throw new Error('nothing to convert');
  const { source, row } = worst;
  console.log(`converting ${source.table} ${row[source.key]}`);
  console.log(`  before ${JSON.stringify(row.bio.slice(0, 120))}`);
  await convertRow(source, row);
  console.log(`  after  ${JSON.stringify((await readBack(source, row))?.slice(0, 120))}`);

  // THE POINT: restore it and prove it came back byte-identical.
  const [backup] = await rest(
    `bio_conversion_backup?select=id,bio_before&source_table=eq.${source.table}` +
      `&row_key=eq.${encodeURIComponent(String(row[source.key]))}&order=id.desc&limit=1`,
  );
  await rest(`${source.table}?${source.key}=eq.${encodeURIComponent(row[source.key])}`, {
    method: 'PATCH',
    body: JSON.stringify({ bio: backup.bio_before }),
  });
  const restored = await readBack(source, row);
  const identical = restored === row.bio;
  console.log(`  restored ${identical ? 'IDENTICAL — the way back works' : 'DIFFERENT — STOP'}`);
  if (!identical) {
    console.log(`    expected ${JSON.stringify(row.bio)}`);
    console.log(`    got      ${JSON.stringify(restored)}`);
    process.exit(1);
  }
  await rest(`bio_conversion_backup?id=eq.${backup.id}`, { method: 'DELETE' });
  console.log('\nOne row converted, restored and verified. Nothing is left changed.');
} else if (mode === '--apply') {
  const all = report(sources);
  let done = 0;
  for (const s of sources) for (const r of s.plain) if (await convertRow(s, r)) done++;
  console.log(`\nconverted ${done} of ${all.length}`);
  const after = await pending();
  console.log('\nread back from the database:');
  report(after);
  const backups = await rest('bio_conversion_backup?select=id');
  console.log(`backup rows: ${backups.length} (must be at least ${done})`);
} else if (mode === '--restore') {
  const backups = await rest('bio_conversion_backup?select=*&order=id.asc');
  for (const b of backups) {
    const s = SOURCES.find((x) => x.table === b.source_table);
    await rest(`${s.table}?${s.key}=eq.${encodeURIComponent(b.row_key)}`, {
      method: 'PATCH',
      body: JSON.stringify({ bio: b.bio_before }),
    });
  }
  console.log(`restored ${backups.length} row(s) from the backup.`);
}
