import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';
import { ACTIVITY_TYPES } from '@thefibre/shared';

export const activitiesRoutes = new Hono();

const ListQuery = z.object({
  person_id: z.string().uuid().optional(),
  // Either a UUID or a slug (e.g. "fibre-platform").
  app_id: z.string().min(1).max(64).optional(),
  type: z.enum(ACTIVITY_TYPES).optional(),
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

activitiesRoutes.get('/', async (c) => {
  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  let q = db
    .from('activity')
    .select('id, person_id, app_id, type, subject, occurred_at, created_by, app:app_id (slug, name)')
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(parsed.data.limit + 1);

  if (parsed.data.person_id) q = q.eq('person_id', parsed.data.person_id);
  if (parsed.data.app_id) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.data.app_id);
    if (isUuid) {
      q = q.eq('app_id', parsed.data.app_id);
    } else {
      const { data: app } = await db.from('app').select('id').eq('slug', parsed.data.app_id).single();
      if (app) q = q.eq('app_id', app.id);
      else return c.json({ items: [], next: null });
    }
  }
  if (parsed.data.type) q = q.eq('type', parsed.data.type);
  if (parsed.data.after) q = q.lt('id', parsed.data.after);

  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);

  const rows = data ?? [];
  const hasMore = rows.length > parsed.data.limit;
  const items = hasMore ? rows.slice(0, parsed.data.limit) : rows;
  return c.json({ items, next: hasMore ? items[items.length - 1]?.id : null });
});

const ActivityCreate = z.object({
  person_id: z.string().uuid(),
  type: z.enum(ACTIVITY_TYPES),
  // Subject must be short and never sensitive — see brief §6.
  subject: z.string().min(1).max(200),
  occurred_at: z.string().datetime().optional(),
});

activitiesRoutes.post('/', async (c) => {
  const body = ActivityCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // Resolve the X-App-ID slug into the app.id UUID.
  const { data: app, error: appErr } = await db
    .from('app')
    .select('id')
    .eq('slug', ctx.appId)
    .single();
  if (appErr || !app) return c.json({ error: 'app not found' }, 500);

  const { data, error } = await db
    .from('activity')
    .insert({
      workspace_id: ctx.workspaceId,
      person_id: body.data.person_id,
      app_id: app.id,
      type: body.data.type,
      subject: body.data.subject,
      occurred_at: body.data.occurred_at ?? new Date().toISOString(),
      created_by: ctx.userId,
    })
    .select('id, type, subject, occurred_at')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});
