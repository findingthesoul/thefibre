import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';

export const organisationsRoutes = new Hono();

const ListQuery = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().min(1).max(100).optional(),
});

organisationsRoutes.get('/', async (c) => {
  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { after, limit, q } = parsed.data;

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  let query = db
    .from('organisation')
    .select('id, name, domain, country, sector, org_type, created_at')
    .is('deleted_at', null)
    .order('id', { ascending: true })
    .limit(limit + 1);

  if (after) query = query.gt('id', after);
  if (q) query = query.or(`name.ilike.%${q}%,domain.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return c.json({ items, next: hasMore ? items[items.length - 1]?.id : null });
});

const OrgCreate = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().max(255).optional(),
  country: z.string().length(2).optional(),
  sector: z.string().max(100).optional(),
  org_type: z.enum(['private', 'public', 'ngo', 'cooperative', 'government', 'education']).optional(),
});

organisationsRoutes.post('/', async (c) => {
  const body = OrgCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('organisation')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

organisationsRoutes.get('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('organisation')
    .select('*, org_identity(*), org_system_context(*), org_relationship(*)')
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .single();
  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});

organisationsRoutes.get('/:id/members', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('org_membership')
    .select('id, title, department, is_primary, is_decision_maker, started_at, ended_at, person:person_id (id, first_name, last_name, email)')
    .eq('org_id', c.req.param('id'))
    .is('ended_at', null);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});
