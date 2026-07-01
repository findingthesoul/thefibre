import { Hono } from 'hono';
import { z } from 'zod';
import { userClient, adminClient } from '../db.js';
import { RESERVED_SLUGS, SLUG_PATTERN } from '../lib/reserved-slugs.js';

// ===========================================================================
// The Thread — rebuild of thethread-v3, Fibre-native.
//
// A thread IS a platform program row (format event|journey, app_id
// the-thread) plus a thread_thread extension row. An enrolment IS a platform
// enrolment row plus a thread_enrolment companion. This file is the
// authenticated CRUD foundation (Phase 1b): organiser config, settings,
// threads, engagements. Public pages, payments, certificates and the
// message scheduler land in later phases.
//
// RLS does the heavy lifting via userClient(jwt). Full Postgres errors go
// to stderr (feedback_api_logs_first).
// ===========================================================================

export const threadRoutes = new Hono();

// Thread's own route names, on top of the shared reserved set. Organiser
// slugs route at thread.thefibre.app/{organiserSlug}, so anything matching
// an app route would make the organiser unreachable (same bug class as
// Meet's v0.13.19 fix).
const THREAD_RESERVED = new Set<string>([
  ...RESERVED_SLUGS,
  'threads',
  'thread',
  'enrolments',
  'enrolment',
  'engagements',
  'certificates',
  'certificate',
  'coupons',
  'agenda',
  'enrol',
  'register',
]);

function isReserved(slug: string): boolean {
  return THREAD_RESERVED.has(slug.trim().toLowerCase());
}

const slugField = z
  .string()
  .min(2)
  .max(60)
  .regex(SLUG_PATTERN, 'lowercase letters, digits, hyphens; no leading/trailing hyphen')
  .refine((s) => !isReserved(s), {
    message: 'reserved word — pick something else',
  });

// Engagement families — type may only change within its family after
// creation (thethread-v3 rule; see docs/thread-rebuild-plan.md).
const ACTIVITY_TYPES = ['event', 'conversation', 'workshop'] as const;
const MESSAGE_TYPES = ['reflection', 'practice', 'message', 'document', 'inspiration'] as const;
const ENGAGEMENT_TYPES = [...ACTIVITY_TYPES, ...MESSAGE_TYPES] as const;

function engagementFamily(type: string): 'activity' | 'message' {
  return (ACTIVITY_TYPES as readonly string[]).includes(type) ? 'activity' : 'message';
}

// ---------------------------------------------------------------------------
// GET /api/v1/thread/me — current user's organiser config (auto-provisions)
// ---------------------------------------------------------------------------
threadRoutes.get('/me', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  let { data: organiser } = await db
    .from('thread_organiser')
    .select('*')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!organiser) {
    // First visit — provision an organiser row with a sensible default slug.
    // Admin client for the same PostgREST order-of-checks reason as meet/me.
    const { data: u } = await adminClient
      .from('user')
      .select('email, full_name')
      .eq('id', ctx.userId)
      .single();
    const seed =
      (u?.full_name ?? u?.email ?? 'organiser')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30) || 'organiser';
    const slug = `${seed}-${Math.random().toString(36).slice(2, 5)}`;
    const { data: created, error: cErr } = await adminClient
      .from('thread_organiser')
      .insert({
        user_id: ctx.userId,
        workspace_id: ctx.workspaceId,
        slug,
        display_name: u?.full_name ?? null,
      })
      .select('*')
      .single();
    if (cErr || !created) {
      console.error('[thread/me] auto-provision failed', cErr);
      return c.json({ error: 'failed to provision organiser' }, 500);
    }
    organiser = created;
  }

  return c.json(organiser);
});

// PATCH /api/v1/thread/me — update organiser config
const OrganiserUpdate = z.object({
  slug: slugField.optional(),
  display_name: z.string().max(200).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  photo_url: z.string().max(500).nullable().optional(),
  timezone: z.string().max(100).optional(),
  // Stripe Connect account id (paste flow, like Meet). Empty string clears.
  stripe_account_id: z
    .string()
    .max(64)
    .regex(/^(acct_[A-Za-z0-9]+)?$/, 'Must be a Stripe account id like acct_…')
    .nullable()
    .optional(),
  // Share of net revenue this organiser keeps (workspace admin decision).
  vendor_cut_percent: z.number().min(0).max(100).optional(),
});

threadRoutes.patch('/me', async (c) => {
  const body = OrganiserUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const patch: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };
  if (patch.stripe_account_id === '') patch.stripe_account_id = null;

  const { data, error } = await db
    .from('thread_organiser')
    .update(patch)
    .eq('user_id', ctx.userId)
    .select('*')
    .single();
  if (error) {
    console.error('[thread/me] update failed', { patch, error });
    const status = error.code === '23505' ? 409 : 500;
    return c.json({ error: error.code === '23505' ? 'slug already taken' : error.message }, status);
  }
  return c.json(data);
});

// ---------------------------------------------------------------------------
// GET/PATCH /api/v1/thread/settings — workspace-level settings (auto-provisions)
// ---------------------------------------------------------------------------
threadRoutes.get('/settings', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  let { data: settings } = await db
    .from('thread_settings')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (!settings) {
    const { data: created, error: cErr } = await adminClient
      .from('thread_settings')
      .insert({ workspace_id: ctx.workspaceId })
      .select('*')
      .single();
    if (cErr || !created) {
      console.error('[thread/settings] auto-provision failed', cErr);
      return c.json({ error: 'failed to provision settings' }, 500);
    }
    settings = created;
  }
  return c.json(settings);
});

const SettingsUpdate = z.object({
  stripe_account_id: z
    .string()
    .max(64)
    .regex(/^(acct_[A-Za-z0-9]+)?$/, 'Must be a Stripe account id like acct_…')
    .nullable()
    .optional(),
  default_vendor_cut_percent: z.number().min(0).max(100).optional(),
  email_from_name: z.string().max(200).nullable().optional(),
  email_footer_note: z.string().max(1000).nullable().optional(),
});

threadRoutes.patch('/settings', async (c) => {
  const body = SettingsUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const patch: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };
  if (patch.stripe_account_id === '') patch.stripe_account_id = null;

  const { data, error } = await db
    .from('thread_settings')
    .update(patch)
    .eq('workspace_id', ctx.workspaceId)
    .select('*')
    .single();
  if (error) {
    console.error('[thread/settings] update failed', { patch, error });
    return c.json({ error: error.message }, 500);
  }
  return c.json(data);
});

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

const THREAD_SELECT = `
  id, workspace_id, program_id, organiser_id, slug, intention, timezone,
  cover_url, is_public_listed, requires_approval, price_cents, price_currency,
  capacity, registration_fields, certificate_enabled, certificate_criteria,
  certificate_template_id, created_at, updated_at,
  program:program_id (id, title, format, status, starts_on, ends_on),
  organiser:organiser_id (id, slug, display_name, user_id)
`;

// GET /api/v1/thread/threads — all threads in the workspace
threadRoutes.get('/threads', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('thread_thread')
    .select(THREAD_SELECT)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('[thread/threads] list failed', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ items: data ?? [] });
});

// POST /api/v1/thread/threads — create thread (+ paired program row)
const ThreadCreate = z.object({
  title: z.string().min(1).max(200),
  format: z.enum(['event', 'journey']),
  slug: slugField,
  intention: z.string().max(2000).nullable().optional(),
  starts_on: z.string().date().nullable().optional(),
  ends_on: z.string().date().nullable().optional(),
  timezone: z.string().max(100).optional(),
});

threadRoutes.post('/threads', async (c) => {
  const body = ThreadCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // The creator's organiser row is the primary organiser (vendor).
  const { data: organiser, error: oErr } = await db
    .from('thread_organiser')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (oErr || !organiser) {
    return c.json({ error: 'no organiser profile — visit Settings first' }, 400);
  }

  const { data: app, error: appErr } = await db
    .from('app')
    .select('id')
    .eq('slug', 'the-thread')
    .single();
  if (appErr || !app) return c.json({ error: 'the-thread app row missing' }, 500);

  const { data: program, error: pErr } = await db
    .from('program')
    .insert({
      workspace_id: ctx.workspaceId,
      app_id: app.id,
      title: body.data.title,
      format: body.data.format,
      starts_on: body.data.starts_on ?? null,
      ends_on: body.data.ends_on ?? null,
    })
    .select('id')
    .single();
  if (pErr || !program) {
    console.error('[thread/threads] program insert failed', pErr);
    return c.json({ error: pErr?.message ?? 'program insert failed' }, 500);
  }

  const { data: thread, error: tErr } = await db
    .from('thread_thread')
    .insert({
      workspace_id: ctx.workspaceId,
      program_id: program.id,
      organiser_id: organiser.id,
      slug: body.data.slug,
      intention: body.data.intention ?? null,
      timezone: body.data.timezone ?? 'Europe/Amsterdam',
      created_by: ctx.userId,
    })
    .select(THREAD_SELECT)
    .single();
  if (tErr || !thread) {
    console.error('[thread/threads] thread insert failed', tErr);
    // Clean up the orphaned program row so retries don't accumulate them.
    await adminClient.from('program').delete().eq('id', program.id);
    const status = tErr?.code === '23505' ? 409 : 500;
    return c.json(
      { error: tErr?.code === '23505' ? 'slug already taken for this organiser' : tErr?.message },
      status,
    );
  }
  return c.json(thread, 201);
});

// GET /api/v1/thread/threads/:id — thread detail + engagements + co-organisers
threadRoutes.get('/threads/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data: thread, error } = await db
    .from('thread_thread')
    .select(THREAD_SELECT)
    .eq('id', c.req.param('id'))
    .single();
  if (error || !thread) return c.json({ error: 'not found' }, 404);

  const [{ data: engagements }, { data: coOrganisers }] = await Promise.all([
    db
      .from('thread_engagement')
      .select('*')
      .eq('thread_id', thread.id)
      .order('position', { ascending: true }),
    db
      .from('thread_thread_organiser')
      .select('role, organiser:organiser_id (id, slug, display_name, user_id)')
      .eq('thread_id', thread.id),
  ]);

  return c.json({
    ...thread,
    engagements: engagements ?? [],
    co_organisers: coOrganisers ?? [],
  });
});

// PATCH /api/v1/thread/threads/:id — update thread + paired program fields
const ThreadUpdate = z.object({
  // program-side
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  starts_on: z.string().date().nullable().optional(),
  ends_on: z.string().date().nullable().optional(),
  // thread-side
  slug: slugField.optional(),
  intention: z.string().max(2000).nullable().optional(),
  timezone: z.string().max(100).optional(),
  cover_url: z.string().max(500).nullable().optional(),
  is_public_listed: z.boolean().optional(),
  requires_approval: z.boolean().optional(),
  price_cents: z.number().int().min(0).nullable().optional(),
  price_currency: z.string().length(3).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  registration_fields: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        label: z.string().min(1).max(200),
        type: z.enum(['short', 'long', 'select', 'checkbox']),
        required: z.boolean().default(false),
        options: z.array(z.string().max(200)).optional(),
      }),
    )
    .optional(),
  certificate_enabled: z.boolean().optional(),
  certificate_criteria: z.string().max(2000).nullable().optional(),
  certificate_template_id: z.string().uuid().nullable().optional(),
});

threadRoutes.patch('/threads/:id', async (c) => {
  const body = ThreadUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');

  const { title, status, starts_on, ends_on, ...threadPatch } = body.data;

  // Fetch the thread first — we need program_id and it confirms visibility.
  const { data: existing, error: eErr } = await db
    .from('thread_thread')
    .select('id, program_id')
    .eq('id', id)
    .single();
  if (eErr || !existing) return c.json({ error: 'not found' }, 404);

  const programPatch: Record<string, unknown> = {};
  if (title !== undefined) programPatch.title = title;
  if (status !== undefined) programPatch.status = status;
  if (starts_on !== undefined) programPatch.starts_on = starts_on;
  if (ends_on !== undefined) programPatch.ends_on = ends_on;

  if (Object.keys(programPatch).length > 0) {
    const { error: pErr } = await db
      .from('program')
      .update(programPatch)
      .eq('id', existing.program_id);
    if (pErr) {
      console.error('[thread/threads] program update failed', { programPatch, pErr });
      return c.json({ error: pErr.message }, 500);
    }
  }

  if (Object.keys(threadPatch).length > 0) {
    const { error: tErr } = await db
      .from('thread_thread')
      .update({ ...threadPatch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (tErr) {
      console.error('[thread/threads] thread update failed', { threadPatch, tErr });
      const s = tErr.code === '23505' ? 409 : 500;
      return c.json({ error: tErr.code === '23505' ? 'slug already taken' : tErr.message }, s);
    }
  }

  const { data: updated } = await db
    .from('thread_thread')
    .select(THREAD_SELECT)
    .eq('id', id)
    .single();
  return c.json(updated);
});

// ---------------------------------------------------------------------------
// Engagements
// ---------------------------------------------------------------------------

const EngagementCreate = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(ENGAGEMENT_TYPES),
  description: z.string().max(5000).nullable().optional(),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  meeting_url: z.string().max(1000).nullable().optional(),
  scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
  content: z.record(z.unknown()).optional(),
  show_in_agenda: z.boolean().optional(),
});

threadRoutes.post('/threads/:id/engagements', async (c) => {
  const body = EngagementCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const threadId = c.req.param('id');

  // Next position = max + 1 within the thread.
  const { data: last } = await db
    .from('thread_engagement')
    .select('position')
    .eq('thread_id', threadId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await db
    .from('thread_engagement')
    .insert({
      workspace_id: ctx.workspaceId,
      thread_id: threadId,
      title: body.data.title,
      type: body.data.type,
      description: body.data.description ?? null,
      starts_at: body.data.starts_at ?? null,
      ends_at: body.data.ends_at ?? null,
      location: body.data.location ?? null,
      meeting_url: body.data.meeting_url ?? null,
      scheduled_at: body.data.scheduled_at ?? null,
      content: body.data.content ?? {},
      show_in_agenda: body.data.show_in_agenda ?? true,
      position: (last?.position ?? -1) + 1,
      created_by: ctx.userId,
    })
    .select('*')
    .single();
  if (error) {
    console.error('[thread/engagements] insert failed', { body: body.data, error });
    return c.json({ error: error.message }, 500);
  }
  return c.json(data, 201);
});

const EngagementUpdate = EngagementCreate.partial().extend({
  status: z.enum(['draft', 'published', 'closed']).optional(),
  position: z.number().int().min(0).optional(),
});

threadRoutes.patch('/engagements/:id', async (c) => {
  const body = EngagementUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');

  // Type may only move within its family after creation (v3 rule).
  if (body.data.type) {
    const { data: existing } = await db
      .from('thread_engagement')
      .select('type')
      .eq('id', id)
      .single();
    if (!existing) return c.json({ error: 'not found' }, 404);
    if (engagementFamily(existing.type) !== engagementFamily(body.data.type)) {
      return c.json(
        { error: 'type can only change within its family (activity ↔ activity, message ↔ message)' },
        400,
      );
    }
  }

  const { data, error } = await db
    .from('thread_engagement')
    .update({ ...body.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.error('[thread/engagements] update failed', { body: body.data, error });
    return c.json({ error: error.message }, 500);
  }
  return c.json(data);
});

threadRoutes.delete('/engagements/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db.from('thread_engagement').delete().eq('id', c.req.param('id'));
  if (error) {
    console.error('[thread/engagements] delete failed', error);
    return c.json({ error: error.message }, 500);
  }
  return c.body(null, 204);
});
