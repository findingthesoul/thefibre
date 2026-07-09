import { Hono } from 'hono';
import { z } from 'zod';
import { userClient, adminClient } from '../db.js';

// ===========================================================================
// Platform teams — the SPoT endpoint (build-plan 10b, decided 2026-07-07).
//
// The `team` table has always been the single source of truth; its CRUD
// doorway historically lived under /api/v1/meet/teams. This platform route
// starts the promotion: reads live here, app routes stay as aliases until
// their callers migrate. First consumer: Pulse's involved-teams picker.
// ===========================================================================

export const teamsRoutes = new Hono();

// GET /api/v1/teams — workspace teams with member counts. RLS scopes rows.
teamsRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('team')
    .select('id, name, slug, description, is_active, created_at, members:team_member (user_id)')
    .order('name', { ascending: true });
  if (error) {
    console.error('[teams] list', error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    items: (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      is_active: t.is_active,
      member_count: Array.isArray((t as any).members) ? (t as any).members.length : 0,
    })),
  });
});

// POST /api/v1/teams — create a team (the SPoT promotion, build-plan 10b:
// creation no longer requires Meet's doorway). Creator becomes lead, same
// as Meet's create. Slug derives from the name; the meet_root_slug check
// mirrors Meet's to keep the shared slug namespace collision-free.
const TeamCreate = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
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

  const [{ data: slugClash }, { data: teamClash }] = await Promise.all([
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
  ]);
  if (slugClash || teamClash) return c.json({ error: `slug '${slug}' is taken` }, 409);

  const { data: team, error } = await adminClient
    .from('team')
    .insert({
      workspace_id: ctx.workspaceId,
      slug,
      name: body.data.name,
      description: body.data.description ?? null,
      is_active: true,
      created_by: ctx.userId,
    })
    .select('id, name, slug')
    .single();
  if (error || !team) {
    console.error('[teams] platform create failed', error);
    return c.json({ error: error?.message ?? 'create failed' }, 500);
  }
  const { error: mErr } = await adminClient
    .from('team_member')
    .insert({ team_id: team.id, user_id: ctx.userId, role: 'lead' });
  if (mErr) console.error('[teams] auto-lead failed', mErr);
  return c.json({ item: team }, 201);
});
