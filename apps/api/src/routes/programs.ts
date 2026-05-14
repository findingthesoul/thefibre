import { Hono } from 'hono';
import { z } from 'zod';
import { userClient } from '../db.js';
import { PROGRAM_FORMATS, ENROLMENT_STATUSES, type ProgramFormat } from '@thefibre/shared';

export const programsRoutes = new Hono();

// Brief §3 + §5 Domain 5: each format belongs to a specific app.
const FORMAT_TO_APP_SLUG: Record<ProgramFormat, string> = {
  meeting: 'fibre-suite',
  event: 'the-thread',
  journey: 'the-thread',
  self_paced: 'fibre-learn',
  blended: 'fibre-learn',
};

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

  // Derive the owning app from the format (brief §5 Domain 5).
  const ownerSlug = FORMAT_TO_APP_SLUG[body.data.format];
  const { data: app, error: appErr } = await db
    .from('app')
    .select('id')
    .eq('slug', ownerSlug)
    .single();
  if (appErr || !app) return c.json({ error: `owning app not found: ${ownerSlug}` }, 500);

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
  if (error) {
    console.error('[programs.create] failed', { body: body.data, error });
    return c.json({ error: error.message }, 500);
  }
  return c.json(data, 201);
});

programsRoutes.get('/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('program')
    .select('id, title, format, status, starts_on, ends_on, created_at, app:app_id (slug, name)')
    .eq('id', c.req.param('id'))
    .single();
  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});

programsRoutes.get('/:id/enrolments', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('enrolment')
    .select('id, status, progress_pct, enrolled_at, completed_at, person:person_id (id, first_name, last_name, email)')
    .eq('program_id', c.req.param('id'))
    .order('enrolled_at', { ascending: false, nullsFirst: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
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
