import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient, userClient } from '../db.js';

export const authRoutes = new Hono();

// ---------------------------------------------------------------------------
// The workspaces this person belongs to, and which one they are acting in.
//
// A person is one email. Inside each workspace they have their own
// `public."user"` row — which is what `unique (workspace_id, email)` has always
// allowed. These two routes are the only way to see and change which of those
// rows a session acts as.
//
// adminClient, not userClient: RLS answers "what can I see IN my workspace",
// and the whole point here is to look ACROSS them. The gate is the email match
// below — a person can only ever see rows carrying their own address.
// ---------------------------------------------------------------------------

/** Every live user row sharing this session's email. */
async function myMemberships(ctx: { userId: string }) {
  const { data: me } = await adminClient
    .from('user')
    .select('email')
    .eq('id', ctx.userId)
    .maybeSingle();
  if (!me?.email) return [];

  const { data } = await adminClient
    .from('user')
    .select('id, workspace_id, created_at, workspace:workspace_id (id, name, slug, plan)')
    .eq('email', me.email)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  return data ?? [];
}

authRoutes.get('/workspaces', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId) {
    return c.json({ error: 'user session required' }, 403);
  }

  const rows = await myMemberships(ctx);
  return c.json({
    // The one this token is acting in — not the stored choice. If the two ever
    // disagree, what the token says is what the request will actually do.
    active_workspace_id: ctx.workspaceId,
    workspaces: rows.map((r) => {
      const w = Array.isArray(r.workspace) ? r.workspace[0] : r.workspace;
      return {
        id: r.workspace_id,
        name: w?.name ?? null,
        slug: w?.slug ?? null,
        plan: w?.plan ?? null,
        is_active: r.workspace_id === ctx.workspaceId,
      };
    }),
  });
});

const SwitchBody = z.object({ workspace_id: z.string().uuid() });

authRoutes.post('/workspace', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId || !ctx.authUserId) {
    return c.json({ error: 'user session required' }, 403);
  }
  const body = SwitchBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  // Membership is the gate, and it is checked here rather than in RLS because
  // user_active_workspace has no policies at all — a client that could write
  // that table directly could put itself in any tenant on the platform.
  const rows = await myMemberships(ctx);
  const target = rows.find((r) => r.workspace_id === body.data.workspace_id);
  if (!target) {
    return c.json({ error: 'you are not a member of that workspace' }, 403);
  }

  const { error } = await adminClient
    .from('user_active_workspace')
    .upsert(
      {
        auth_user_id: ctx.authUserId,
        workspace_id: body.data.workspace_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'auth_user_id' },
    );
  if (error) {
    console.error('[auth/workspace] could not record the choice', error);
    return c.json({ error: error.message }, 500);
  }

  // The workspace lives in the token, so the caller has to get a new one
  // before anything changes. Said out loud rather than left to be discovered.
  return c.json({
    ok: true,
    workspace_id: body.data.workspace_id,
    refresh_required: true,
  });
});

authRoutes.get('/me', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data: user, error } = await db
    .from('user')
    .select('id, email, full_name, avatar_url, person_id, workspace_id, primary_auth_method, last_sign_in, is_super_admin')
    .eq('id', ctx.userId)
    .is('deleted_at', null)
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Filter app_membership to apps the workspace has actually activated
  // (workspace_app row with deactivated_at IS NULL). A leftover membership
  // for an app that's currently off is dormant, not access — and showing
  // it on /settings made the page contradict /settings/apps (v0.13.10
  // fixed the same bug on the contact-profile endpoint).
  const [{ data: rawMemberships }, { data: activeApps }] = await Promise.all([
    db
      .from('app_membership')
      .select('app_id, role, permissions, app:app_id (slug, name)')
      .eq('user_id', ctx.userId),
    db
      .from('workspace_app')
      .select('app_id')
      .eq('workspace_id', user.workspace_id)
      .is('deactivated_at', null),
  ]);
  const activeAppIds = new Set((activeApps ?? []).map((r) => r.app_id as string));
  // fibre-platform is The Fibre itself — there's no workspace_app row for it
  // because you can't deactivate the platform from itself. Always include
  // it so the workspace-admin gate on /settings/apps keeps working.
  const memberships = (rawMemberships ?? []).filter((m) => {
    const appRow = Array.isArray(m.app) ? m.app[0] : m.app;
    if (appRow?.slug === 'fibre-platform') return true;
    return activeAppIds.has(m.app_id as string);
  });

  const { data: workspace } = await db
    .from('workspace')
    .select('id, slug, name, plan, created_at')
    .eq('id', user.workspace_id)
    .single();

  return c.json({ user, workspace, memberships, app_id: ctx.appId });
});

const MeUpdate = z.object({
  full_name: z.string().min(1).max(200).optional(),
  avatar_url: z.string().max(500).nullable().optional(),
});

authRoutes.patch('/me', async (c) => {
  const body = MeUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('user')
    .update(body.data)
    .eq('id', ctx.userId)
    .is('deleted_at', null)
    .select('id, email, full_name, avatar_url')
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});
