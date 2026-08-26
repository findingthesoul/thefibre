/**
 * Read-only: which workspaces have nobody who can administer them.
 *
 *   node --env-file=.env scripts/audit-workspace-admins.mjs
 *
 * A workspace with users but no `workspace_member` row of role admin/
 * super_admin is locked out of everything behind requireWorkspaceAdmin —
 * including the members screen, which is the only place the role could be
 * granted. See CHANGELOG 0.18.8.
 */
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
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
