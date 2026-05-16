import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';

export const activitiesRoutes = new Hono();

// Activity `type` is a short machine label, not user content. We accept any
// snake_case identifier so third-party apps can declare their own types in
// their manifest (e.g. `newsletter_opened`) without us pre-registering them.
// `subject` is where content goes and is length-limited per brief §6.
const ACTIVITY_TYPE_RE = /^[a-z][a-z0-9_]{1,63}$/;
const activityType = z
  .string()
  .min(2)
  .max(64)
  .regex(ACTIVITY_TYPE_RE, 'type must be snake_case (a-z, 0-9, _)');

const ListQuery = z.object({
  person_id: z.string().uuid().optional(),
  // Organisation activity = union of activity for all current org members.
  // Joins through org_membership where ended_at IS NULL.
  organisation_id: z.string().uuid().optional(),
  // Either a UUID or a slug (e.g. "fibre-platform").
  app_id: z.string().min(1).max(64).optional(),
  type: activityType.optional(),
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

activitiesRoutes.get('/', async (c) => {
  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // If organisation_id is given, resolve to the list of current member person_ids
  // and use those as an `in` filter. Two-step query — no Postgres-side join.
  let memberPersonIds: string[] | null = null;
  if (parsed.data.organisation_id) {
    const { data: members, error: mErr } = await db
      .from('org_membership')
      .select('person_id')
      .eq('org_id', parsed.data.organisation_id)
      .is('ended_at', null);
    if (mErr) return c.json({ error: mErr.message }, 500);
    memberPersonIds = (members ?? []).map((m) => m.person_id as string);
    if (memberPersonIds.length === 0) {
      return c.json({ items: [], next: null });
    }
  }

  let q = db
    .from('activity')
    .select('id, person_id, app_id, type, subject, occurred_at, created_by, app:app_id (slug, name)')
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(parsed.data.limit + 1);

  if (parsed.data.person_id) q = q.eq('person_id', parsed.data.person_id);
  if (memberPersonIds) q = q.in('person_id', memberPersonIds);
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
  type: activityType,
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
