import { Hono } from 'hono';
import { z } from 'zod';
import { userClient, adminClient } from '../db.js';
import { RESERVED_SLUGS, SLUG_PATTERN } from '../lib/reserved-slugs.js';
import { sendEmail } from '../lib/email/client.js';
import { enrolmentConfirmation, engagementMessage } from '../lib/email/thread-templates.js';
import { appUrl } from '@thefibre/shared';

function threadAppUrl(): string {
  return appUrl('the-thread', process.env as Record<string, string>);
}

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
  id, workspace_id, program_id, organiser_id, team_id, organisation_id, slug,
  intention, timezone, cover_url, is_public_listed, requires_approval,
  price_cents, price_currency, capacity, registration_fields,
  certificate_enabled, certificate_criteria, certificate_template_id,
  created_at, updated_at,
  program:program_id (id, title, format, status, starts_on, ends_on),
  organiser:organiser_id (id, slug, display_name, user_id),
  team:team_id (id, name),
  organisation:organisation_id (id, name)
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
  team_id: z.string().uuid().nullable().optional(),
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
      team_id: body.data.team_id ?? null,
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
  team_id: z.string().uuid().nullable().optional(),
  organisation_id: z.string().uuid().nullable().optional(),
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

  // When the start date moves, everything moves with it (Sjoerd 2026-07-02,
  // v3's shiftAllEngagementDates): fixed engagement dates shift by the same
  // delta, and so does the end date — unless this same save explicitly
  // changed it. Relative/lifecycle triggers follow automatically (computed).
  let shiftDays = 0;
  if (starts_on) {
    const { data: prog } = await db
      .from('program')
      .select('starts_on, ends_on')
      .eq('id', existing.program_id)
      .single();
    if (prog?.starts_on && starts_on !== prog.starts_on) {
      shiftDays = Math.round(
        (Date.parse(starts_on) - Date.parse(prog.starts_on)) / 86_400_000,
      );
      const endUnchanged = ends_on === undefined || ends_on === prog.ends_on;
      if (shiftDays !== 0 && endUnchanged && prog.ends_on) {
        programPatch.ends_on = shiftDateOnly(prog.ends_on, shiftDays);
      }
    }
  }

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

  // Shift all fixed engagement dates by the same delta.
  if (shiftDays !== 0) {
    const { data: engagements } = await db
      .from('thread_engagement')
      .select('id, starts_at, ends_at, scheduled_at')
      .eq('thread_id', id);
    for (const e of engagements ?? []) {
      const patch: Record<string, string> = {};
      if (e.starts_at) patch.starts_at = shiftTimestamp(e.starts_at, shiftDays);
      if (e.ends_at) patch.ends_at = shiftTimestamp(e.ends_at, shiftDays);
      if (e.scheduled_at) patch.scheduled_at = shiftTimestamp(e.scheduled_at, shiftDays);
      if (Object.keys(patch).length) {
        await db.from('thread_engagement').update(patch).eq('id', e.id);
      }
    }
  }

  const { data: updated } = await db
    .from('thread_thread')
    .select(THREAD_SELECT)
    .eq('id', id)
    .single();
  return c.json({ ...updated, shifted_engagement_days: shiftDays || undefined });
});

function shiftDateOnly(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function shiftTimestamp(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

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
  // Message-family send triggers (see migration 20260702100000).
  trigger_kind: z
    .enum(['fixed', 'on_enrolment', 'on_approval', 'on_completion', 'relative'])
    .optional(),
  trigger_anchor: z.enum(['start', 'end']).nullable().optional(),
  trigger_offset_days: z.number().int().min(-365).max(365).nullable().optional(),
  trigger_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM')
    .nullable()
    .optional(),
  content: z.record(z.unknown()).optional(),
  show_in_agenda: z.boolean().optional(),
});

// Activities must fall inside the thread's date window (Sjoerd 2026-07-02).
// Message-family items are exempt — their whole point is firing before/after
// the thread (relative + lifecycle triggers).
async function activityWindowError(
  threadId: string,
  type: string,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): Promise<string | null> {
  if (!(ACTIVITY_TYPES as readonly string[]).includes(type)) return null;
  if (!startsAt && !endsAt) return null;
  const { data: thread } = await adminClient
    .from('thread_thread')
    .select('program:program_id (starts_on, ends_on, title)')
    .eq('id', threadId)
    .maybeSingle();
  const program = Array.isArray(thread?.program) ? thread?.program[0] : thread?.program;
  if (!program) return null;
  const min = program.starts_on ? new Date(`${program.starts_on}T00:00:00Z`) : null;
  const max = program.ends_on ? new Date(`${program.ends_on}T23:59:59Z`) : null;
  for (const iso of [startsAt, endsAt]) {
    if (!iso) continue;
    const d = new Date(iso);
    if (min && d < min)
      return `activities must fall inside the thread dates (starts ${program.starts_on})`;
    if (max && d > max)
      return `activities must fall inside the thread dates (ends ${program.ends_on})`;
  }
  return null;
}

threadRoutes.post('/threads/:id/engagements', async (c) => {
  const body = EngagementCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const threadId = c.req.param('id');

  const windowErr = await activityWindowError(
    threadId,
    body.data.type,
    body.data.starts_at,
    body.data.ends_at,
  );
  if (windowErr) return c.json({ error: windowErr }, 400);

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
      trigger_kind: body.data.trigger_kind ?? 'fixed',
      trigger_anchor: body.data.trigger_anchor ?? null,
      trigger_offset_days: body.data.trigger_offset_days ?? null,
      trigger_time: body.data.trigger_time ?? null,
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

  const { data: existing } = await db
    .from('thread_engagement')
    .select('type, thread_id, starts_at, ends_at')
    .eq('id', id)
    .single();
  if (!existing) return c.json({ error: 'not found' }, 404);

  // Type may only move within its family after creation (v3 rule).
  if (body.data.type) {
    if (engagementFamily(existing.type) !== engagementFamily(body.data.type)) {
      return c.json(
        { error: 'type can only change within its family (activity ↔ activity, message ↔ message)' },
        400,
      );
    }
  }

  const windowErr = await activityWindowError(
    existing.thread_id,
    body.data.type ?? existing.type,
    body.data.starts_at !== undefined ? body.data.starts_at : existing.starts_at,
    body.data.ends_at !== undefined ? body.data.ends_at : existing.ends_at,
  );
  if (windowErr) return c.json({ error: windowErr }, 400);

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

// ---------------------------------------------------------------------------
// Teams + workspace members (pickers for scope + invites)
// ---------------------------------------------------------------------------

threadRoutes.get('/teams', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('team')
    .select('id, name, slug')
    .eq('workspace_id', ctx.workspaceId)
    .eq('is_active', true)
    .order('name');
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

// POST /teams — create a team; creator becomes lead (Meet's pattern; team is
// a platform primitive shared by all in-family apps).
const TeamCreate = z.object({
  name: z.string().min(1).max(200),
  slug: slugField,
  description: z.string().max(2000).nullable().optional(),
});

threadRoutes.post('/teams', async (c) => {
  const body = TeamCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const { data: team, error } = await adminClient
    .from('team')
    .insert({
      workspace_id: ctx.workspaceId,
      name: body.data.name,
      slug: body.data.slug,
      description: body.data.description ?? null,
      created_by: ctx.userId,
    })
    .select('id, name, slug, description')
    .single();
  if (error) {
    const s = error.code === '23505' ? 409 : 500;
    return c.json({ error: error.code === '23505' ? 'slug already taken' : error.message }, s);
  }
  await adminClient
    .from('team_member')
    .insert({ team_id: team.id, user_id: ctx.userId, role: 'lead', status: 'active' });
  return c.json(team, 201);
});

threadRoutes.get('/teams/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: team, error } = await db
    .from('team')
    .select('id, name, slug, description, is_active')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (error || !team) return c.json({ error: 'not found' }, 404);
  const { data: members } = await adminClient
    .from('team_member')
    .select('user_id, role, status, user:user_id (id, full_name, email)')
    .eq('team_id', team.id);
  return c.json({
    ...team,
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
  });
});

const TeamMemberAdd = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['lead', 'member']).default('member'),
});

threadRoutes.post('/teams/:id/members', async (c) => {
  const body = TeamMemberAdd.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { error } = await adminClient.from('team_member').upsert(
    {
      team_id: c.req.param('id'),
      user_id: body.data.user_id,
      role: body.data.role,
      status: 'active',
    },
    { onConflict: 'team_id,user_id' },
  );
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true }, 201);
});

threadRoutes.delete('/teams/:id/members/:userId', async (c) => {
  const { error } = await adminClient
    .from('team_member')
    .delete()
    .eq('team_id', c.req.param('id'))
    .eq('user_id', c.req.param('userId'));
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

// GET /contacts — the people Thread knows: everyone with a thread enrolment.
threadRoutes.get('/contacts', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('thread_enrolment')
    .select(
      `person:person_id (id, first_name, last_name, email),
       thread:thread_id (id, slug, program:program_id (title)),
       enrolment:enrolment_id (status),
       created_at`,
    )
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return c.json({ error: error.message }, 500);
  // Group by person.
  type ContactEntry = {
    person: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    };
    threads: { id: string; title: string; status: string }[];
    last_enrolled_at: string;
  };
  const byPerson = new Map<string, ContactEntry>();
  for (const row of data ?? []) {
    const p = Array.isArray(row.person) ? row.person[0] : row.person;
    if (!p) continue;
    const t = Array.isArray(row.thread) ? row.thread[0] : row.thread;
    const prog = t ? (Array.isArray(t.program) ? t.program[0] : t.program) : null;
    const enr = Array.isArray(row.enrolment) ? row.enrolment[0] : row.enrolment;
    const e: ContactEntry =
      byPerson.get(p.id) ?? { person: p, threads: [], last_enrolled_at: row.created_at };
    if (t && prog) e.threads.push({ id: t.id, title: prog.title, status: enr?.status ?? '' });
    byPerson.set(p.id, e);
  }
  return c.json({ items: [...byPerson.values()] });
});

// GET /internal-team — workspace members + the-thread app membership state.
threadRoutes.get('/internal-team', async (c) => {
  const ctx = c.get('ctx');
  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'the-thread')
    .single();
  const { data: members, error } = await adminClient
    .from('workspace_member')
    .select('user_id, workspace_role, relationship_type, user:user_id (id, full_name, email)')
    .eq('workspace_id', ctx.workspaceId);
  if (error) return c.json({ error: error.message }, 500);
  const { data: memberships } = await adminClient
    .from('app_membership')
    .select('user_id, role')
    .eq('app_id', app?.id ?? '');
  const roleByUser = new Map((memberships ?? []).map((m) => [m.user_id, m.role]));
  return c.json({
    items: (members ?? []).map((m) => {
      const u = Array.isArray(m.user) ? m.user[0] : m.user;
      return {
        user_id: m.user_id,
        full_name: u?.full_name ?? null,
        email: u?.email ?? null,
        workspace_role: m.workspace_role,
        relationship_type: m.relationship_type,
        thread_role: roleByUser.get(m.user_id) ?? null,
      };
    }),
  });
});

// POST /internal-team — grant the-thread membership to a workspace member.
const InternalGrant = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'member']).default('member'),
});

threadRoutes.post('/internal-team', async (c) => {
  const body = InternalGrant.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'the-thread')
    .single();
  if (!app) return c.json({ error: 'app row missing' }, 500);
  const { error } = await adminClient
    .from('app_membership')
    .upsert(
      { user_id: body.data.user_id, app_id: app.id, role: body.data.role },
      { onConflict: 'user_id,app_id' },
    );
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true }, 201);
});

threadRoutes.get('/workspace-members', async (c) => {
  const ctx = c.get('ctx');
  // adminClient scoped by the JWT's validated workspace_id — same pattern as
  // Meet's internal-team listing.
  const { data, error } = await adminClient
    .from('workspace_member')
    .select('user_id, workspace_role, user:user_id (id, full_name, email)')
    .eq('workspace_id', ctx.workspaceId);
  if (error) return c.json({ error: error.message }, 500);
  const items = (data ?? []).map((m) => {
    const u = Array.isArray(m.user) ? m.user[0] : m.user;
    return {
      user_id: m.user_id,
      full_name: u?.full_name ?? null,
      email: u?.email ?? null,
      workspace_role: m.workspace_role,
    };
  });
  return c.json({ items });
});

// ---------------------------------------------------------------------------
// Thread members — hosts + facilitators (thread_thread_organiser)
// ---------------------------------------------------------------------------

const ThreadMemberAdd = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['host', 'facilitator']),
});

threadRoutes.post('/threads/:id/members', async (c) => {
  const body = ThreadMemberAdd.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const threadId = c.req.param('id');

  // Visibility check through RLS.
  const { data: thread } = await db
    .from('thread_thread')
    .select('id, workspace_id')
    .eq('id', threadId)
    .maybeSingle();
  if (!thread) return c.json({ error: 'not found' }, 404);

  // The invited user needs a thread_organiser row — auto-provision like /me.
  let { data: organiser } = await adminClient
    .from('thread_organiser')
    .select('id')
    .eq('user_id', body.data.user_id)
    .maybeSingle();
  if (!organiser) {
    const { data: u } = await adminClient
      .from('user')
      .select('email, full_name')
      .eq('id', body.data.user_id)
      .single();
    const seed =
      (u?.full_name ?? u?.email ?? 'organiser')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30) || 'organiser';
    const { data: created, error: cErr } = await adminClient
      .from('thread_organiser')
      .insert({
        user_id: body.data.user_id,
        workspace_id: thread.workspace_id,
        slug: `${seed}-${Math.random().toString(36).slice(2, 5)}`,
        display_name: u?.full_name ?? null,
      })
      .select('id')
      .single();
    if (cErr || !created) {
      console.error('[thread/members] organiser provision failed', cErr);
      return c.json({ error: 'could not provision organiser profile' }, 500);
    }
    organiser = created;
  }

  const { data, error } = await adminClient
    .from('thread_thread_organiser')
    .upsert(
      { thread_id: threadId, organiser_id: organiser.id, role: body.data.role },
      { onConflict: 'thread_id,organiser_id' },
    )
    .select('role, organiser:organiser_id (id, slug, display_name, user_id)')
    .single();
  if (error) {
    console.error('[thread/members] upsert failed', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json(data, 201);
});

threadRoutes.delete('/threads/:id/members/:organiserId', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  // RLS-scoped delete through the join policy.
  const { error } = await db
    .from('thread_thread_organiser')
    .delete()
    .eq('thread_id', c.req.param('id'))
    .eq('organiser_id', c.req.param('organiserId'));
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Certificate templates — CRUD + personal/team/workspace visibility.
// Scope rules (Sjoerd 2026-07-02): personal = owner only; team = team
// members; workspace = everyone, unless shares exist — then only granted
// users/teams (+ the creator).
// ---------------------------------------------------------------------------

async function userTeamIds(userId: string): Promise<Set<string>> {
  const { data } = await adminClient
    .from('team_member')
    .select('team_id')
    .eq('user_id', userId);
  return new Set((data ?? []).map((r) => r.team_id));
}

type ScopedTemplate = {
  id: string;
  scope: string;
  owner_user_id: string | null;
  owner_team_id: string | null;
  created_by: string | null;
};

async function filterVisibleTemplates<T extends ScopedTemplate>(
  rows: T[],
  kind: 'certificate' | 'thread',
  userId: string,
): Promise<T[]> {
  const teamIds = await userTeamIds(userId);
  const workspaceScoped = rows.filter((r) => r.scope === 'workspace').map((r) => r.id);
  const sharesByTemplate = new Map<string, { users: Set<string>; teams: Set<string> }>();
  if (workspaceScoped.length) {
    const { data: shares } = await adminClient
      .from('thread_template_share')
      .select('template_id, grantee_user_id, grantee_team_id')
      .eq('template_kind', kind)
      .in('template_id', workspaceScoped);
    for (const s of shares ?? []) {
      const e = sharesByTemplate.get(s.template_id) ?? { users: new Set(), teams: new Set() };
      if (s.grantee_user_id) e.users.add(s.grantee_user_id);
      if (s.grantee_team_id) e.teams.add(s.grantee_team_id);
      sharesByTemplate.set(s.template_id, e);
    }
  }
  return rows.filter((r) => {
    if (r.scope === 'personal') return r.owner_user_id === userId || r.created_by === userId;
    if (r.scope === 'team') return !!r.owner_team_id && teamIds.has(r.owner_team_id);
    // workspace
    const share = sharesByTemplate.get(r.id);
    if (!share) return true; // no grants = whole workspace
    if (r.created_by === userId) return true;
    if (share.users.has(userId)) return true;
    return [...share.teams].some((t) => teamIds.has(t));
  });
}

const CERT_TEMPLATE_SELECT =
  'id, name, scope, owner_user_id, owner_team_id, page_size, orientation, background_url, elements, created_by, created_at, updated_at';

threadRoutes.get('/certificate-templates', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('thread_certificate_template')
    .select(CERT_TEMPLATE_SELECT)
    .order('updated_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  const visible = await filterVisibleTemplates(data ?? [], 'certificate', ctx.userId);
  return c.json({ items: visible });
});

const CertTemplateCreate = z.object({
  name: z.string().min(1).max(200),
  scope: z.enum(['personal', 'team', 'workspace']).default('personal'),
  owner_team_id: z.string().uuid().nullable().optional(),
});

threadRoutes.post('/certificate-templates', async (c) => {
  const body = CertTemplateCreate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  if (body.data.scope === 'team' && !body.data.owner_team_id) {
    return c.json({ error: 'team-scoped templates need owner_team_id' }, 400);
  }
  const { data, error } = await db
    .from('thread_certificate_template')
    .insert({
      workspace_id: ctx.workspaceId,
      name: body.data.name,
      scope: body.data.scope,
      owner_user_id: body.data.scope === 'personal' ? ctx.userId : null,
      owner_team_id: body.data.scope === 'team' ? body.data.owner_team_id : null,
      created_by: ctx.userId,
    })
    .select(CERT_TEMPLATE_SELECT)
    .single();
  if (error) {
    console.error('[thread/cert-templates] insert failed', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json(data, 201);
});

threadRoutes.get('/certificate-templates/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('thread_certificate_template')
    .select(CERT_TEMPLATE_SELECT)
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (error || !data) return c.json({ error: 'not found' }, 404);
  const [visible] = await filterVisibleTemplates([data], 'certificate', ctx.userId);
  if (!visible) return c.json({ error: 'not found' }, 404);
  return c.json(data);
});

const CertTemplateUpdate = z.object({
  name: z.string().min(1).max(200).optional(),
  page_size: z.enum(['a4', 'letter']).optional(),
  orientation: z.enum(['portrait', 'landscape']).optional(),
  background_url: z.string().max(1000).nullable().optional(),
  elements: z.array(z.record(z.unknown())).optional(),
  scope: z.enum(['personal', 'team', 'workspace']).optional(),
  owner_team_id: z.string().uuid().nullable().optional(),
});

threadRoutes.patch('/certificate-templates/:id', async (c) => {
  const body = CertTemplateUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const patch: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };
  if (body.data.scope === 'personal') {
    patch.owner_user_id = ctx.userId;
    patch.owner_team_id = null;
  } else if (body.data.scope === 'workspace') {
    patch.owner_user_id = null;
    patch.owner_team_id = null;
  } else if (body.data.scope === 'team') {
    patch.owner_user_id = null;
  }
  const { data, error } = await db
    .from('thread_certificate_template')
    .update(patch)
    .eq('id', c.req.param('id'))
    .select(CERT_TEMPLATE_SELECT)
    .single();
  if (error) {
    console.error('[thread/cert-templates] update failed', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json(data);
});

threadRoutes.delete('/certificate-templates/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db
    .from('thread_certificate_template')
    .delete()
    .eq('id', c.req.param('id'));
  if (error) return c.json({ error: error.message }, 500);
  await adminClient
    .from('thread_template_share')
    .delete()
    .eq('template_kind', 'certificate')
    .eq('template_id', c.req.param('id'));
  return c.body(null, 204);
});

// Replace the grants on a workspace-scoped template.
const SharesPut = z.object({
  user_ids: z.array(z.string().uuid()).default([]),
  team_ids: z.array(z.string().uuid()).default([]),
});

threadRoutes.put('/certificate-templates/:id/shares', async (c) => {
  const body = SharesPut.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const id = c.req.param('id');
  await adminClient
    .from('thread_template_share')
    .delete()
    .eq('template_kind', 'certificate')
    .eq('template_id', id);
  const rows = [
    ...body.data.user_ids.map((u) => ({
      workspace_id: ctx.workspaceId,
      template_kind: 'certificate',
      template_id: id,
      grantee_user_id: u,
    })),
    ...body.data.team_ids.map((t) => ({
      workspace_id: ctx.workspaceId,
      template_kind: 'certificate',
      template_id: id,
      grantee_team_id: t,
    })),
  ];
  if (rows.length) {
    const { error } = await adminClient.from('thread_template_share').insert(rows);
    if (error) return c.json({ error: error.message }, 500);
  }
  return c.json({ ok: true, count: rows.length });
});

threadRoutes.get('/certificate-templates/:id/shares', async (c) => {
  const { data, error } = await adminClient
    .from('thread_template_share')
    .select('grantee_user_id, grantee_team_id')
    .eq('template_kind', 'certificate')
    .eq('template_id', c.req.param('id'));
  if (error) return c.json({ error: error.message }, 500);
  return c.json({
    user_ids: (data ?? []).map((r) => r.grantee_user_id).filter(Boolean),
    team_ids: (data ?? []).map((r) => r.grantee_team_id).filter(Boolean),
  });
});

// ---------------------------------------------------------------------------
// Enrolments (authenticated, workspace view)
// ---------------------------------------------------------------------------

threadRoutes.get('/enrolments', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const threadId = c.req.query('thread_id');

  let q = db
    .from('thread_enrolment')
    .select(
      `id, thread_id, payment_status, amount_cents, currency, answers, created_at,
       person:person_id (id, first_name, last_name, email),
       enrolment:enrolment_id (id, status, progress_pct, enrolled_at, completed_at),
       thread:thread_id (id, slug, program:program_id (title, format, status))`,
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (threadId) q = q.eq('thread_id', threadId);

  const { data, error } = await q;
  if (error) {
    console.error('[thread/enrolments] list failed', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ items: data ?? [] });
});

// ===========================================================================
// PUBLIC endpoints — no JWT (see PUBLIC_PREFIXES in app-context.ts).
// RLS blocks anon, so these read via adminClient and expose only what the
// public page needs. Same pattern as Meet's /public routes.
// ===========================================================================

const PUBLIC_ORGANISER_SELECT = 'id, workspace_id, slug, display_name, bio, photo_url, timezone';

// GET /api/v1/thread/public/organiser/:slug — organiser page payload
threadRoutes.get('/public/organiser/:slug', async (c) => {
  const { data: organiser } = await adminClient
    .from('thread_organiser')
    .select(PUBLIC_ORGANISER_SELECT)
    .eq('slug', c.req.param('slug'))
    .maybeSingle();
  if (!organiser) return c.json({ error: 'not found' }, 404);

  const { data: threads } = await adminClient
    .from('thread_thread')
    .select(
      `id, slug, intention, cover_url, price_cents, price_currency, capacity,
       program:program_id (title, format, status, starts_on, ends_on)`,
    )
    .eq('organiser_id', organiser.id)
    .eq('is_public_listed', true);

  const listed = (threads ?? []).filter((t) => {
    const p = Array.isArray(t.program) ? t.program[0] : t.program;
    return p && (p.status === 'active' || p.status === 'completed');
  });

  return c.json({ organiser, threads: listed });
});

// GET /api/v1/thread/public/organiser/:slug/thread/:threadSlug — thread page
threadRoutes.get('/public/organiser/:slug/thread/:threadSlug', async (c) => {
  const { data: organiser } = await adminClient
    .from('thread_organiser')
    .select(PUBLIC_ORGANISER_SELECT)
    .eq('slug', c.req.param('slug'))
    .maybeSingle();
  if (!organiser) return c.json({ error: 'not found' }, 404);

  const { data: thread } = await adminClient
    .from('thread_thread')
    .select(
      `id, slug, intention, timezone, cover_url, capacity, requires_approval,
       price_cents, price_currency, registration_fields, certificate_enabled,
       program:program_id (title, format, status, starts_on, ends_on)`,
    )
    .eq('organiser_id', organiser.id)
    .eq('slug', c.req.param('threadSlug'))
    .maybeSingle();
  if (!thread) return c.json({ error: 'not found' }, 404);

  const program = Array.isArray(thread.program) ? thread.program[0] : thread.program;
  // Draft/archived threads are not public, even by direct link.
  if (!program || (program.status !== 'active' && program.status !== 'completed')) {
    return c.json({ error: 'not found' }, 404);
  }

  // The public agenda: published activities flagged show_in_agenda.
  // Messages are internal to the thread — never exposed here.
  const { data: agenda } = await adminClient
    .from('thread_engagement')
    .select('id, title, description, type, starts_at, ends_at, location, meeting_url')
    .eq('thread_id', thread.id)
    .eq('status', 'published')
    .eq('show_in_agenda', true)
    .in('type', ['event', 'conversation', 'workshop'])
    .order('starts_at', { ascending: true, nullsFirst: false });

  // Enrolled count for the capacity indicator.
  const { count } = await adminClient
    .from('thread_enrolment')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', thread.id);

  return c.json({
    organiser,
    thread: {
      ...thread,
      // meeting_url stays hidden until enrolment — strip it from the agenda.
      agenda: (agenda ?? []).map(({ meeting_url, ...rest }) => ({
        ...rest,
        is_online: !!meeting_url,
      })),
      enrolled_count: count ?? 0,
      enrolment_open: program.status === 'active',
    },
  });
});

// POST /api/v1/thread/public/enrol — free enrolment (paid flow lands Phase 4)
const PublicEnrol = z.object({
  organiser_slug: z.string().min(1),
  thread_slug: z.string().min(1),
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  answers: z.record(z.unknown()).optional(),
  marketing_opt_in: z.boolean().optional(),
  request_id: z.string().min(8).max(80),
});

threadRoutes.post('/public/enrol', async (c) => {
  const body = PublicEnrol.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const d = body.data;

  // Idempotency first: same request_id → same result.
  const { data: existing } = await adminClient
    .from('thread_enrolment')
    .select('id, enrolment_id')
    .eq('request_id', d.request_id)
    .maybeSingle();
  if (existing) return c.json({ ok: true, enrolment_id: existing.id, idempotent: true });

  // Resolve organiser → thread → program.
  const { data: organiser } = await adminClient
    .from('thread_organiser')
    .select('id, workspace_id, slug, display_name')
    .eq('slug', d.organiser_slug)
    .maybeSingle();
  if (!organiser) return c.json({ error: 'thread not found' }, 404);

  const { data: thread } = await adminClient
    .from('thread_thread')
    .select(
      'id, workspace_id, program_id, slug, intention, capacity, price_cents, program:program_id (title, status, starts_on)',
    )
    .eq('organiser_id', organiser.id)
    .eq('slug', d.thread_slug)
    .maybeSingle();
  if (!thread) return c.json({ error: 'thread not found' }, 404);

  const program = Array.isArray(thread.program) ? thread.program[0] : thread.program;
  if (!program || program.status !== 'active') {
    return c.json({ error: 'enrolment is closed for this thread' }, 409);
  }
  if (thread.price_cents && thread.price_cents > 0) {
    // Paid enrolments arrive with the Stripe phase.
    return c.json({ error: 'paid enrolment is not available yet' }, 409);
  }

  // Capacity check.
  if (thread.capacity) {
    const { count } = await adminClient
      .from('thread_enrolment')
      .select('id', { count: 'exact', head: true })
      .eq('thread_id', thread.id);
    if ((count ?? 0) >= thread.capacity) {
      return c.json({ error: 'this thread is full' }, 409);
    }
  }

  // Create-or-match the platform person (identity is platform-owned).
  const email = d.email.trim().toLowerCase();
  let { data: person } = await adminClient
    .from('person')
    .select('id, first_name')
    .eq('workspace_id', thread.workspace_id)
    .eq('email', email)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (!person) {
    const parts = d.name.trim().split(/\s+/);
    const firstName = parts[0] ?? d.name.trim();
    const lastName = parts.slice(1).join(' ') || null;
    const { data: created, error: pErr } = await adminClient
      .from('person')
      .insert({
        workspace_id: thread.workspace_id,
        first_name: firstName,
        last_name: lastName,
        email,
      })
      .select('id, first_name')
      .single();
    if (pErr || !created) {
      console.error('[thread/public/enrol] person insert failed', pErr);
      return c.json({ error: 'could not register you — try again' }, 500);
    }
    person = created;
  }

  // Platform enrolment (unique per program+person) — reuse if it exists.
  let enrolmentId: string;
  const { data: platEnrolment } = await adminClient
    .from('enrolment')
    .select('id')
    .eq('program_id', thread.program_id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (platEnrolment) {
    // Already enrolled on the platform; if the thread companion also exists,
    // this is a duplicate signup.
    const { data: dup } = await adminClient
      .from('thread_enrolment')
      .select('id')
      .eq('enrolment_id', platEnrolment.id)
      .maybeSingle();
    if (dup) return c.json({ ok: true, enrolment_id: dup.id, already_enrolled: true });
    enrolmentId = platEnrolment.id;
  } else {
    const { data: enr, error: eErr } = await adminClient
      .from('enrolment')
      .insert({
        program_id: thread.program_id,
        person_id: person.id,
        status: 'enrolled',
        enrolled_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (eErr || !enr) {
      console.error('[thread/public/enrol] enrolment insert failed', eErr);
      return c.json({ error: 'could not enrol you — try again' }, 500);
    }
    enrolmentId = enr.id;
  }

  const { data: threadEnrolment, error: teErr } = await adminClient
    .from('thread_enrolment')
    .insert({
      workspace_id: thread.workspace_id,
      thread_id: thread.id,
      enrolment_id: enrolmentId,
      person_id: person.id,
      payment_status: 'not_required',
      answers: d.answers ?? null,
      request_id: d.request_id,
    })
    .select('id')
    .single();
  if (teErr || !threadEnrolment) {
    console.error('[thread/public/enrol] thread_enrolment insert failed', teErr);
    return c.json({ error: 'could not enrol you — try again' }, 500);
  }

  // Consent records (brief §9): transactional is contract-based; marketing
  // only on explicit opt-in.
  const consents: { purpose_code: string; legal_basis: string }[] = [
    { purpose_code: 'transactional_email', legal_basis: 'contract' },
  ];
  if (d.marketing_opt_in) {
    consents.push({ purpose_code: 'marketing_email', legal_basis: 'consent' });
  }
  for (const consent of consents) {
    const { data: active } = await adminClient
      .from('consent_record')
      .select('id')
      .eq('person_id', person.id)
      .eq('purpose_code', consent.purpose_code)
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle();
    if (!active) {
      await adminClient.from('consent_record').insert({
        person_id: person.id,
        purpose_code: consent.purpose_code,
        legal_basis: consent.legal_basis,
      });
    }
  }

  // Activity: type + subject only — the data wall (brief §3).
  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'the-thread')
    .single();
  if (app) {
    await adminClient.from('activity').insert({
      workspace_id: thread.workspace_id,
      person_id: person.id,
      app_id: app.id,
      type: 'event_registered',
      subject: `Registered: ${program.title}`.slice(0, 200),
      occurred_at: new Date().toISOString(),
    });
  }

  // Confirmation email — non-fatal.
  try {
    const msg = enrolmentConfirmation({
      participantName: d.name.trim(),
      threadTitle: program.title,
      intention: thread.intention,
      organiserName: organiser.display_name ?? '',
      startsOn: program.starts_on,
      threadUrl: `${threadAppUrl()}/${organiser.slug}/${thread.slug}`,
    });
    await sendEmail({ to: email, ...msg });
  } catch (e) {
    console.warn('[thread/public/enrol] confirmation email failed', e);
  }

  // On-enrolment triggered messages — sent to this person right away.
  // Non-fatal; each send is logged in thread_message_send (dedup).
  try {
    await sendTriggeredMessages({
      threadId: thread.id,
      trigger: 'on_enrolment',
      personId: person.id,
      email,
      name: d.name.trim(),
      threadTitle: program.title,
      organiserName: organiser.display_name ?? '',
      startsOn: program.starts_on,
    });
  } catch (e) {
    console.warn('[thread/public/enrol] on_enrolment messages failed', e);
  }

  return c.json({ ok: true, enrolment_id: threadEnrolment.id }, 201);
});

// ---------------------------------------------------------------------------
// Triggered message delivery. Used by the enrol flow (on_enrolment) today;
// approval and completion flows will call the same helper when they land.
// ---------------------------------------------------------------------------

function renderMessageBody(
  type: string,
  content: Record<string, unknown>,
  description: string | null,
): string {
  const str = (k: string) => (typeof content[k] === 'string' ? (content[k] as string) : '');
  const list = (k: string, prefix: string) =>
    Array.isArray(content[k])
      ? (content[k] as string[]).map((x, i) => `${prefix}${i + 1}. ${x}`).join('\n')
      : '';
  const parts: string[] = [];
  if (description) parts.push(description);
  switch (type) {
    case 'reflection':
      parts.push(list('questions', ''));
      break;
    case 'practice':
      parts.push(list('assignments', ''));
      break;
    case 'document':
    case 'inspiration':
      if (str('body')) parts.push(str('body'));
      if (str('external_url')) parts.push(str('external_url'));
      break;
    default:
      if (str('body')) parts.push(str('body'));
  }
  return parts.filter(Boolean).join('\n\n');
}

export async function sendTriggeredMessages(opts: {
  threadId: string;
  trigger: 'on_enrolment' | 'on_approval' | 'on_completion';
  personId: string;
  email: string;
  name: string;
  threadTitle: string;
  organiserName: string;
  startsOn: string | null;
}): Promise<void> {
  const { data: messages } = await adminClient
    .from('thread_engagement')
    .select('id, title, type, description, content')
    .eq('thread_id', opts.threadId)
    .eq('status', 'published')
    .eq('trigger_kind', opts.trigger)
    .in('type', MESSAGE_TYPES as unknown as string[])
    .order('position', { ascending: true });
  if (!messages?.length) return;

  const tokens: Record<string, string> = {
    '{name}': opts.name.split(/\s+/)[0] ?? opts.name,
    '{thread}': opts.threadTitle,
    '{organiser}': opts.organiserName,
    '{date}': opts.startsOn
      ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(
          new Date(opts.startsOn),
        )
      : '',
  };
  const substitute = (s: string) =>
    Object.entries(tokens).reduce((acc, [k, v]) => acc.replaceAll(k, v), s);

  for (const m of messages) {
    // Dedup: one send per (engagement, person). Insert first — if the row
    // already exists, skip (idempotent under retries).
    const { error: logErr } = await adminClient.from('thread_message_send').insert({
      engagement_id: m.id,
      person_id: opts.personId,
      email: opts.email,
    });
    if (logErr) {
      if (logErr.code !== '23505') {
        console.warn('[thread] message send log failed', logErr);
      }
      continue; // already sent (or unlogable) — don't email twice
    }
    const body = substitute(
      renderMessageBody(m.type, (m.content ?? {}) as Record<string, unknown>, m.description),
    );
    const msg = engagementMessage({
      title: substitute(m.title),
      bodyText: body,
      threadTitle: opts.threadTitle,
    });
    try {
      await sendEmail({ to: opts.email, ...msg });
    } catch (e) {
      console.warn('[thread] triggered message send failed', { engagement: m.id, e });
    }
  }
}
