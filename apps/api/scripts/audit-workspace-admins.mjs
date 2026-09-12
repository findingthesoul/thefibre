/**
 * Read-only: which workspaces have nobody who can administer them.
 *
 *   node scripts/audit-workspace-admins.mjs
 *   FIBRE_ENV_FILE=.env.staging node scripts/audit-workspace-admins.mjs
 *
 * A workspace with users but no `workspace_member` row of role admin/
 * super_admin is locked out of everything behind requireWorkspaceAdmin —
 * including the members screen, which is the only place the role could be
 * granted. See CHANGELOG 0.18.8.
 *
 * Reads its credentials the way every other script in this directory does,
 * from apps/api/.env (or FIBRE_ENV_FILE). It used to require the caller to
 * remember `node --env-file=.env`, and the whole reward for forgetting was
 * a supabase-js stack trace reading "supabaseUrl is required." — which names
 * neither the script nor the missing file. An env value already in the
 * process still wins, so `--env-file` keeps working.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(__dirname, '..', process.env.FIBRE_ENV_FILE ?? '.env');
let fileEnv = {};
try {
  fileEnv = Object.fromEntries(
    readFileSync(envFile, 'utf-8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
      }),
  );
} catch {
  // Not fatal on its own — the values may already be in the environment.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fileEnv.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    `No Supabase credentials. Looked in the environment and in ${envFile}.\n` +
      `Set FIBRE_ENV_FILE to pick a different one (e.g. .env.staging).`,
  );
  process.exit(1);
}

console.log(`Auditing ${url.replace('https://', '').split('.')[0]}\n`);

const db = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const { data: roles } = await db.from('workspace_member').select('workspace_role');
const counts = {};
for (const r of roles ?? []) counts[r.workspace_role] = (counts[r.workspace_role] ?? 0) + 1;
console.log('workspace_role values in use:', counts, '\n');

const { data: ws } = await db.from('workspace').select('id, slug, created_at').order('created_at');
let locked = 0;
for (const w of ws ?? []) {
  const { count: users } = await db
    .from('user')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', w.id)
    .is('deleted_at', null);
  const { data: mems } = await db.from('workspace_member').select('workspace_role').eq('workspace_id', w.id);
  const admins = (mems ?? []).filter((m) => m.workspace_role === 'admin' || m.workspace_role === 'super_admin').length;
  const bad = (users ?? 0) > 0 && admins === 0;
  if (bad) locked++;
  console.log(
    `${w.slug.padEnd(30)} users=${String(users ?? 0).padEnd(3)} members=${String((mems ?? []).length).padEnd(3)} admins=${admins}${bad ? '   <-- NO ADMIN' : ''}`,
  );
}
console.log(`\n${locked} workspace(s) with users but no admin.`);
