#!/usr/bin/env node
// The app catalogue has two places a first-party app's NAME lives, and they
// disagreed in production (Sjoerd, 2026-09-13: "this list is not a single
// point of truth... Sales has been renamed Connections").
//
//   packages/shared/src/branding.ts   APPS[slug].name   ← where renames happen
//   public.app.name                   the database row  ← a copy from phase 0
//
// Branding is the source: every rename in this repo has been an edit to
// branding.ts ("slugs never change, only branding.ts does"), and the screens
// that read it were right. But a dozen API responses embed `app:app_id (slug,
// name)` and hand the DATABASE name to a screen — activities, the Teams
// picker, purchases, programmes, the privacy export — so those kept saying
// "Fibre Sales" and "Membership" long after the product said "Connections"
// and "Members".
//
// Rewriting a dozen selects would fix today and drift tomorrow, the next time
// someone writes `app:app_id (slug, name)`. So the database stays a MIRROR of
// branding, and this script keeps it one:
//
//   node scripts/sync-app-names.mjs            report drift, change nothing
//   node scripts/sync-app-names.mjs --apply    make the database match branding
//   node scripts/sync-app-names.mjs --check    exit 1 on any drift (the gate)
//
//   FIBRE_ENV_FILE=.env.staging ...            the staging database instead
//
// Third-party apps are never touched: for them the registered name IS the
// name, and there is no branding entry to disagree with.

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './lib/env.mjs';
import { APPS } from '../../../packages/shared/dist/branding.js';

const envFile = process.env.FIBRE_ENV_FILE ?? '.env';

// "Could not check" must never read like "drifted" — a refused release that
// names the wrong cause sends the next person chasing the wrong thing (the
// Connections session, 2026-09-13, which keeps no apps/api/.env between
// releases on purpose). Exit codes keep the two apart too:
//   1 = the names really have drifted
//   2 = this script could not look
function cannotCheck(why) {
  console.error(
    `\nsync-app-names: COULD NOT CHECK — ${why}\n` +
      'This is not name drift. Nothing was compared.\n' +
      `It needs database credentials in apps/api/${envFile} ` +
      '(NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).',
  );
  process.exit(2);
}

let env;
try {
  ({ env } = loadEnv(envFile));
} catch {
  cannotCheck(`apps/api/${envFile} does not exist here`);
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  cannotCheck(`apps/api/${envFile} is missing the database URL or service key`);
}

const APPLY = process.argv.includes('--apply');
const CHECK = process.argv.includes('--check');

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: rows, error } = await db
  .from('app')
  .select('slug, name, kind')
  .eq('kind', 'first_party');
if (error) cannotCheck(`the app catalogue could not be read: ${error.message}`);

const drift = [];
for (const row of rows ?? []) {
  const branded = APPS[row.slug]?.name;
  // A first-party row with no branding entry is its own problem: the product
  // has no name for it at all. Say so rather than invent one.
  if (!branded) {
    console.warn(`  ? ${row.slug} — in the database, not in branding.ts`);
    continue;
  }
  if (row.name !== branded) drift.push({ slug: row.slug, from: row.name, to: branded });
}

console.log(`${envFile}: ${rows?.length ?? 0} first-party apps, ${drift.length} named differently from branding`);
for (const d of drift) console.log(`  ${d.slug.padEnd(16)} "${d.from}" → "${d.to}"`);

if (CHECK) {
  if (drift.length) {
    console.error(
      '\nThe database app names have drifted from branding.ts, so screens that embed ' +
        'app:app_id (slug, name) show the old name.\nFix: ' +
        `FIBRE_ENV_FILE=${envFile} node apps/api/scripts/sync-app-names.mjs --apply`,
    );
    process.exit(1);
  }
  console.log('In step.');
  process.exit(0);
}

if (!APPLY) {
  if (drift.length) console.log('\nNothing changed. Re-run with --apply to write these.');
  process.exit(0);
}

for (const d of drift) {
  const { error: uErr } = await db
    .from('app')
    .update({ name: d.to })
    .eq('slug', d.slug)
    .eq('kind', 'first_party');
  if (uErr) {
    console.error(`  ✗ ${d.slug}: ${uErr.message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${d.slug} is now "${d.to}"`);
}
console.log(drift.length ? 'Done.' : 'Already in step.');
