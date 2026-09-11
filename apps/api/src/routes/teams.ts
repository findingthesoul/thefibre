import { Hono } from 'hono';
import { z } from 'zod';
import { userClient, adminClient } from '../db.js';
import { isAdminRole } from '../lib/workspace-roles.js';
import { can, needsPlan } from '../lib/plan.js';
import { syncTeam, syncUsers } from '../lib/team-grants.js';

// ===========================================================================
// Platform teams — the SPoT endpoint (build-plan 10b, decided 2026-07-07).
//
// The `team` table has always been the single source of truth; its CRUD
// doorway historically lived under /api/v1/meet/teams. This platform route
// starts the promotion: reads live here, app routes stay as aliases until
// their callers migrate. First consumer: Pulse's involved-teams picker.
//
// 2026-09-11 — teams became ACCESS GROUPS as well (Sjoerd: "the teams the
// admin makes can also be used for access levels"). The admin-facing half of
// that lives here rather than in Meet, because granting apps is not a Meet
// act. Meet keeps the team INVITATION flow (tokens, emails, accepting); the
// routes below manage grants and people who are already in the workspace.
//
// The two original routes keep their exact shapes — Pulse reads `items` from
// the list and `item` from the create. New fields are additive.
// See docs/teams-as-access-groups-proposal.md.
// ===========================================================================

export const teamsRoutes = new Hono();

// Apps an admin may confer through a team. Same rule as the Members page:
// first-party, approved, and never the platform itself.
async function grantableApps(): Promise<{ id: string; slug: string; name: string }[]> {
  const { data } = await adminClient
    .from('app')
    .select('id, slug, name')
    .eq('status', 'approved')
    .eq('kind', 'first_party')
    .neq('slug', 'fibre-platform');
  return data ?? [];
}

async function callerRole(userId: string, workspaceId: string): Promise<string | null> {
  const { data } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return data?.workspace_role ?? null;
}

/** Admin-only, and the team must belong to the caller's workspace. */
async function adminOwnsTeam(
  userId: string,
  workspaceId: string,
  teamId: string,
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  if (!isAdminRole(await callerRole(userId, workspaceId))) {
    return { ok: false, status: 403, error: 'workspace admin only' };
  }
  const { data: team } = await adminClient
    .from('team')
    .select('id, workspace_id')
    .eq('id', teamId)
    .maybeSingle();
  if (!team || team.workspace_id !== workspaceId) {
    return { ok: false, status: 404, error: 'team not found' };
  }
  return { ok: true };
}

// GET /api/v1/teams — workspace teams with member counts. RLS scopes rows.
teamsRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('team')
    .select(
      'id, name, slug, description, is_active, is_published, created_at, members:team_member (user_id, status)',
    )
    .order('name', { ascending: true });
  if (error) {
    console.error('[teams] list', error);
    return c.json({ error: error.message }, 500);
  }

  const ids = (data ?? []).map((t) => t.id);
  const { data: grants } = await adminClient
    .from('team_app_grant')
    .select('team_id, app_id, lead_is_app_admin, app:app_id (slug, name)')
    .in('team_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const appsByTeam = new Map<string, { slug: string; name: string; lead_is_app_admin: boolean }[]>();
  for (const g of grants ?? []) {
    const app = Array.isArray(g.app) ? g.app[0] : g.app;
    if (!app) continue;
    const list = appsByTeam.get(g.team_id) ?? [];
    list.push({ slug: app.slug, name: app.name, lead_is_app_admin: g.lead_is_app_admin });
    appsByTeam.set(g.team_id, list);
  }

  return c.json({
    items: (data ?? []).map((t) => {
      const members = Array.isArray((t as { members?: unknown }).members)
        ? ((t as { members: { status?: string }[] }).members ?? [])
        : [];
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        is_active: t.is_active,
        // Pending invitees are not in the team yet, and a count that included
        // them would overstate who a grant reaches.
        member_count: members.filter((m) => m.status === 'active').length,
        is_published: t.is_published,
        apps: appsByTeam.get(t.id) ?? [],
      };
    }),
    can_edit_grants: await can(ctx.workspaceId, 'team_access_groups'),
    is_admin: isAdminRole(await callerRole(ctx.userId, ctx.workspaceId)),
    grantable: await grantableApps(),
  });
});

// POST /api/v1/teams — create a team (the SPoT promotion, build-plan 10b:
// creation no longer requires Meet's doorway). Creator becomes lead, same
// as Meet's create. Slug derives from the name; the meet_root_slug check
// mirrors Meet's to keep the shared slug namespace collision-free.
//
// `is_published` is optional and defaults to the column default (true), so
// every existing caller keeps making publicly addressable teams exactly as
// before. The admin UI passes false to make an internal access group — the
// slug is claimed either way, so publishing later cannot collide.
const TeamCreate = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  is_published: z.boolean().optional(),
});

teamsRoutes.post('/', async (c) => {
  const body = TeamCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');

  const slug = body.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (!slug) return c.json({ error: 'name must contain letters or digits' }, 400);

  const [{ data: slugClash }, { data: teamClash }, { data: wsClash }] = await Promise.all([
    adminClient
      .from('meet_root_slug')
      .select('slug')
      .eq('workspace_id', ctx.workspaceId)
      .eq('slug', slug)
      .maybeSingle(),
    adminClient
      .from('team')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('slug', slug)
      .maybeSingle(),
    // Workspace slugs own the public URL namespace (brief-workspace-urls D3).
    adminClient.from('workspace').select('id').eq('slug', slug).maybeSingle(),
  ]);
  if (slugClash || teamClash || wsClash) return c.json({ error: `slug '${slug}' is taken` }, 409);

  const insert: Record<string, unknown> = {
    workspace_id: ctx.workspaceId,
    slug,
    name: body.data.name,
    description: body.data.description ?? null,
    is_active: true,
    created_by: ctx.userId,
  };
  if (body.data.is_published !== undefined) insert.is_published = body.data.is_published;

  const { data: team, error } = await adminClient
    .from('team')
    .insert(insert)
    .select('id, name, slug')
    .single();
  if (error || !team) {
    console.error('[teams] platform create failed', error);
    // public_root_slug claims the segment GLOBALLY (20260909210000), so a
    // name taken in another workspace surfaces here rather than as two
    // silently 404ing public pages.
    if (error?.code === '23505') {
      return c.json({ error: `slug '${slug}' is taken` }, 409);
    }
    return c.json({ error: error?.message ?? 'create failed' }, 500);
  }
  const { error: mErr } = await adminClient
    .from('team_member')
    .insert({ team_id: team.id, user_id: ctx.userId, role: 'lead' });
  if (mErr) console.error('[teams] auto-lead failed', mErr);
  return c.json({ item: team }, 201);
});

// ---------------------------------------------------------------------------
// GET /api/v1/teams/:id — one team, its roster and its grants.
// ---------------------------------------------------------------------------
teamsRoutes.get('/:id', async (c) => {
  const ctx = c.get('ctx');
  const id = c.req.param('id');

  const { data: team } = await adminClient
    .from('team')
    .select('id, slug, name, description, is_active, is_published, created_at, workspace_id')
    .eq('id', id)
    .maybeSingle();
  if (!team || team.workspace_id !== ctx.workspaceId) {
    return c.json({ error: 'team not found' }, 404);
  }

  const { data: members } = await adminClient
    .from('team_member')
    .select('user_id, role, status, user:user_id (id, full_name, email)')
    .eq('team_id', id);
  const { data: grants } = await adminClient
    .from('team_app_grant')
    .select('app_id, lead_is_app_admin, app:app_id (slug, name)')
    .eq('team_id', id);

  return c.json({
    team: {
      id: team.id,
      slug: team.slug,
      name: team.name,
      description: team.description,
      is_active: team.is_active,
      is_published: team.is_published,
      created_at: team.created_at,
    },
    members: (members ?? []).map((m) => {
      const u = Array.isArray(m.user) ? m.user[0] : m.user;
      return {
        user_id: m.user_id,
        role: m.role,
        status: m.status,
        full_name: u?.full_name ?? null,
        email: u?.email ?? null,
      };
    }),
    apps: (grants ?? []).map((g) => {
      const app = Array.isArray(g.app) ? g.app[0] : g.app;
      return {
        app_id: g.app_id,
        slug: app?.slug ?? null,
        name: app?.name ?? null,
        lead_is_app_admin: g.lead_is_app_admin,
      };
    }),
    can_edit_grants: await can(ctx.workspaceId, 'team_access_groups'),
    is_admin: isAdminRole(await callerRole(ctx.userId, ctx.workspaceId)),
    grantable: await grantableApps(),
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/teams/:id — name, description, active, published.
// ---------------------------------------------------------------------------
const TeamPatch = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
  is_published: z.boolean().optional(),
});

teamsRoutes.put('/:id', async (c) => {
  const ctx = c.get('ctx');
  const id = c.req.param('id');
  const gate = await adminOwnsTeam(ctx.userId, ctx.workspaceId, id);
  if (!gate.ok) return c.json({ error: gate.error }, gate.status);

  const body = TeamPatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const patch: Record<string, unknown> = {};
  if (body.data.name !== undefined) patch.name = body.data.name;
  if (body.data.description !== undefined) patch.description = body.data.description;
  if (body.data.is_active !== undefined) patch.is_active = body.data.is_active;
  if (body.data.is_published !== undefined) patch.is_published = body.data.is_published;
  if (!Object.keys(patch).length) return c.json({ ok: true });

  const { error } = await adminClient.from('team').update(patch).eq('id', id);
  if (error) {
    console.error('[teams] update failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return c.json({ error: error.message }, 500);
  }

  // Retiring a team withdraws what it conferred; reviving it hands it back.
  if (body.data.is_active !== undefined) await syncTeam(id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/teams/:id/apps — set the team's grants.
//
// The one route the Pro gate guards. Resolution itself is never gated: a
// workspace that drops below Pro keeps the access its people already have,
// it just cannot change it any more (Sjoerd, 2026-09-11).
// ---------------------------------------------------------------------------
const GrantsPut = z.object({
  apps: z
    .array(
      z.object({
        slug: z.string(),
        lead_is_app_admin: z.boolean().default(false),
      }),
    )
    .max(50),
});

teamsRoutes.put('/:id/apps', async (c) => {
  const ctx = c.get('ctx');
  const id = c.req.param('id');
  const gate = await adminOwnsTeam(ctx.userId, ctx.workspaceId, id);
  if (!gate.ok) return c.json({ error: gate.error }, gate.status);

  if (!(await can(ctx.workspaceId, 'team_access_groups'))) {
    return c.json({ error: needsPlan('Giving teams app access', 'Pro') }, 402);
  }

  const body = GrantsPut.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const grantable = await grantableApps();
  const bySlug = new Map(grantable.map((a) => [a.slug, a]));
  const wanted = body.data.apps.filter((a) => bySlug.has(a.slug));
  const wantedIds = new Set(wanted.map((a) => bySlug.get(a.slug)!.id));

  const { data: existing } = await adminClient
    .from('team_app_grant')
    .select('app_id')
    .eq('team_id', id);

  for (const row of existing ?? []) {
    if (!wantedIds.has(row.app_id)) {
      await adminClient.from('team_app_grant').delete().eq('team_id', id).eq('app_id', row.app_id);
    }
  }
  for (const a of wanted) {
    const app = bySlug.get(a.slug)!;
    const { error } = await adminClient.from('team_app_grant').upsert(
      {
        team_id: id,
        app_id: app.id,
        lead_is_app_admin: a.lead_is_app_admin,
        created_by: ctx.userId || null,
      },
      { onConflict: 'team_id,app_id' },
    );
    if (error) {
      console.error('[teams] grant upsert failed', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return c.json({ error: error.message }, 500);
    }
  }

  // Applies to everyone already in the team, not only to people added later.
  // The UI says how many people that is before the save, so the widening is
  // never silent.
  await syncTeam(id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /api/v1/teams/:id/members — add someone who is ALREADY in the
// workspace. Inviting a new person is the Members page's job, and the
// email-and-token invitation flow stays in Meet.
// ---------------------------------------------------------------------------
const MemberAdd = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['lead', 'member']).default('member'),
});

teamsRoutes.post('/:id/members', async (c) => {
  const ctx = c.get('ctx');
  const id = c.req.param('id');
  const gate = await adminOwnsTeam(ctx.userId, ctx.workspaceId, id);
  if (!gate.ok) return c.json({ error: gate.error }, gate.status);

  const body = MemberAdd.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const { data: member } = await adminClient
    .from('workspace_member')
    .select('user_id')
    .eq('user_id', body.data.user_id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!member) return c.json({ error: 'not a member of this workspace' }, 400);

  const { error } = await adminClient.from('team_member').upsert(
    {
      team_id: id,
      user_id: body.data.user_id,
      role: body.data.role,
      status: 'active',
      accepted_at: new Date().toISOString(),
    },
    { onConflict: 'team_id,user_id' },
  );
  if (error) {
    console.error('[teams] member add failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return c.json({ error: error.message }, 500);
  }

  await syncUsers([body.data.user_id]);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/teams/:id/members/:userId
// ---------------------------------------------------------------------------
teamsRoutes.delete('/:id/members/:userId', async (c) => {
  const ctx = c.get('ctx');
  const id = c.req.param('id');
  const userId = c.req.param('userId');
  const gate = await adminOwnsTeam(ctx.userId, ctx.workspaceId, id);
  if (!gate.ok) return c.json({ error: gate.error }, gate.status);

  const { error } = await adminClient
    .from('team_member')
    .delete()
    .eq('team_id', id)
    .eq('user_id', userId);
  if (error) {
    console.error('[teams] member remove failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return c.json({ error: error.message }, 500);
  }

  // Withdraws anything the team was conferring, unless another team or a
  // direct grant still owes it to them.
  await syncUsers([userId]);
  return c.json({ ok: true });
});
