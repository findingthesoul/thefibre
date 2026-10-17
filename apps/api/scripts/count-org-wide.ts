// How many teams and programs are set to org_wide (contacts follow the
// hierarchy, 2026-10-17). can_see_person still honours that explicit setting
// — an internal member sees the people of an org_wide team or program — and
// whether to keep the clause at all depends on whether anything uses it.
// Staging had none on the day. Sjoerd runs this against PRODUCTION:
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/count-org-wide.ts prod
//   npx tsx --env-file=.env.staging scripts/count-org-wide.ts staging
//
// Counts and workspace slugs only. It writes NOTHING.

import { adminClient } from '../src/db.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';

const target = process.argv[2];
if (target !== 'prod' && target !== 'staging') {
  console.error('usage: npx tsx --env-file=<env> scripts/count-org-wide.ts prod|staging');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}

for (const table of ['team', 'program'] as const) {
  const all = await adminClient.from(table).select('id', { count: 'exact', head: true });
  const wide = await adminClient.from(table).select('workspace_id').eq('visibility', 'org_wide');
  const err = all.error ?? wide.error;
  if (err) {
    console.error(`${table}: could not read — ${err.message}`);
    process.exit(1);
  }
  const rows = (wide.data ?? []) as { workspace_id: string }[];
  const workspaces = [...new Set(rows.map((r) => r.workspace_id))];
  const { data: slugs } = workspaces.length
    ? await adminClient.from('workspace').select('slug').in('id', workspaces)
    : { data: [] };
  console.log(
    `${table}: ${rows.length} of ${all.count} org_wide` +
      (rows.length ? ` — in ${((slugs ?? []) as { slug: string }[]).map((s) => s.slug).join(', ')}` : ''),
  );
}
