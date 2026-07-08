import { Hono } from 'hono';
import { userClient } from '../db.js';

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
