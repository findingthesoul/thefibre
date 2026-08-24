import { Hono } from 'hono';
import { adminClient } from '../db.js';

export const workspacesRoutes = new Hono();

/**
 * Every workspace on the platform, with live counts. Super-admin only.
 *
 * DELIBERATELY READ-ONLY, and it should stay that way:
 *
 *  - There is no create. Approving a signup request is the only path that
 *    makes a workspace (`routes/signup-requests.ts`), and that gate — a human
 *    reading an application — is the point.
 *  - There is no delete. `workspace_id` is referenced by 54 tables; removing
 *    one is a cascade you cannot preview from a confirm dialog. If a delete is
 *    ever added it must refuse unless the workspace is provably empty, the way
 *    the Festival-of-Trust cleanup did.
 *
 * Runs on `adminClient` because the `workspace_self` RLS policy scopes SELECT
 * to `current_workspace_id()` — even a super admin's own JWT cannot see anyone
 * else's workspace. So the super-admin check below is the entire gate, not a
 * nicety on top of RLS. Do not remove it.
 */

type CountSpec = { table: string; key: string; filter?: (q: any) => any };

const COUNTS: CountSpec[] = [
  { table: 'user', key: 'users', filter: (q) => q.is('deleted_at', null) },
  { table: 'person', key: 'people', filter: (q) => q.is('deleted_at', null) },
  { table: 'organisation', key: 'organisations', filter: (q) => q.is('deleted_at', null) },
  // activity is append-only — it has no deleted_at to filter on, by design.
  { table: 'activity', key: 'activities' },
  { table: 'workspace_app', key: 'apps', filter: (q) => q.is('deactivated_at', null) },
];

workspacesRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');

  // An app key has no user, so it can never be a super admin. Refuse early and
  // explicitly rather than letting the lookup below quietly return nothing.
  if (ctx.auth !== 'user' || !ctx.userId) {
    return c.json({ error: 'user session required' }, 403);
  }

  const { data: me } = await adminClient
    .from('user')
    .select('is_super_admin')
    .eq('id', ctx.userId)
    .maybeSingle();
  if (!me?.is_super_admin) {
    return c.json({ error: 'super admin required' }, 403);
  }

  const { data: rows, error } = await adminClient
    .from('workspace')
    .select('id, slug, name, plan, created_at')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[workspaces GET] list failed', error);
    return c.json({ error: error.message }, 500);
  }

  // N × 5 head-count queries. Fine at the scale this platform runs at, and
  // honest — a cached aggregate would go stale exactly when you are using this
  // page to check whether something is real. Revisit past ~100 workspaces.
  const items = await Promise.all(
    (rows ?? []).map(async (w) => {
      const counts: Record<string, number> = {};
      await Promise.all(
        COUNTS.map(async ({ table, key, filter }) => {
          let q = adminClient
            .from(table)
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', w.id);
          if (filter) q = filter(q);
          const { count, error: cErr } = await q;
          if (cErr) {
            console.error(`[workspaces GET] count ${table} failed`, cErr);
            counts[key] = -1; // surfaced as "?" rather than a false zero
            return;
          }
          counts[key] = count ?? 0;
        }),
      );
      return {
        ...w,
        counts,
        // A workspace nobody has ever signed into. This is the signal the page
        // exists for — an accidental or abandoned tenant, visible at a glance.
        is_empty: counts.users === 0 && counts.people === 0 && counts.activities === 0,
        is_yours: w.id === ctx.workspaceId,
      };
    }),
  );

  return c.json({ items });
});
