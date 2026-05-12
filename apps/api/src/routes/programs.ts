import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';
import { PROGRAM_FORMATS, ENROLMENT_STATUSES } from '@thefibre/shared';

export const programsRoutes = new Hono();

programsRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('program')
    .select('id, title, format, status, starts_on, ends_on, app:app_id (slug, name)')
    .order('starts_on', { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

const ProgramCreate = z.object({
  title: z.string().min(1).max(200),
  format: z.enum(PROGRAM_FORMATS),
  starts_on: z.string().date().optional(),
  ends_on: z.string().date().optional(),
});

programsRoutes.post('/', async (c) => {
  const body = ProgramCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data: app, error: appErr } = await db
    .from('app')
    .select('id')
    .eq('slug', ctx.appId)
    .single();
  if (appErr || !app) return c.json({ error: 'app not found' }, 500);

  const { data, error } = await db
    .from('program')
    .insert({
      workspace_id: ctx.workspaceId,
      app_id: app.id,
      title: body.data.title,
      format: body.data.format,
      starts_on: body.data.starts_on ?? null,
      ends_on: body.data.ends_on ?? null,
    })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

const EnrolmentCreate = z.object({
  person_id: z.string().uuid(),
  status: z.enum(ENROLMENT_STATUSES).default('invited'),
});

programsRoutes.post('/:id/enrolments', async (c) => {
  const body = EnrolmentCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data, error } = await db
    .from('enrolment')
    .insert({
      program_id: c.req.param('id'),
      person_id: body.data.person_id,
      status: body.data.status,
      enrolled_at: body.data.status === 'enrolled' ? new Date().toISOString() : null,
    })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});
