import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';

export const personsRoutes = new Hono();

const ListQuery = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().min(1).max(100).optional(),
});

personsRoutes.get('/', async (c) => {
  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { after, limit, q } = parsed.data;

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  let query = db
    .from('person')
    .select('id, first_name, last_name, email, country, created_at')
    .is('deleted_at', null)
    .order('id', { ascending: true })
    .limit(limit + 1);

  if (after) query = query.gt('id', after);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return c.json({
    items,
    next: hasMore ? items[items.length - 1]?.id : null,
  });
});

const PersonCreate = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  preferred_name: z.string().max(100).optional(),
  country: z.string().length(2).optional(),
});

personsRoutes.post('/', async (c) => {
  const body = PersonCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('person')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('id, first_name, last_name, email, country, created_at')
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Write a platform activity event. Non-fatal if it fails.
  const { data: platformApp } = await db
    .from('app')
    .select('id')
    .eq('slug', 'fibre-platform')
    .single();
  if (platformApp) {
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.email;
    await db.from('activity').insert({
      workspace_id: ctx.workspaceId,
      person_id: data.id,
      app_id: platformApp.id,
      type: 'user_created',
      subject: `Added ${name} to the workspace`,
      created_by: ctx.userId,
    });
  }

  return c.json(data, 201);
});

personsRoutes.get('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('person')
    .select('*')
    .eq('id', c.req.param('id'))
    .is('deleted_at', null)
    .single();
  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});
