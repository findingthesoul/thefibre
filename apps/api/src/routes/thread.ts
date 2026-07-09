import { Hono } from 'hono';
import { z } from 'zod';
import { userClient, adminClient } from '../db.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { RESERVED_SLUGS, SLUG_PATTERN } from '../lib/reserved-slugs.js';
import { sendEmail } from '../lib/email/client.js';
import { shell, escapeHtml } from '../lib/email/templates.js';
import { recordPurchase } from '../lib/purchases.js';
import { userPersonalRoom } from '../lib/connections.js';
import {
  personalStripeAccount,
  workspaceStripeAccount,
  resolvePaymentMethods,
  chargeAccountForItem,
  threadDestinationAccount,
} from '../lib/payment-accounts.js';
import {
  enrolmentConfirmation,
  enrolmentPending,
  engagementMessage,
} from '../lib/email/thread-templates.js';
import { appUrl } from '@thefibre/shared';

function threadAppUrl(): string {
  return appUrl('the-thread', process.env as Record<string, string>);
}

// ---------------------------------------------------------------------------
// Participant identity (Sjoerd 2026-07-02, revised): participants sign IN
// (Google SSO now; emailed login code already supported by the platform;
// more providers later). Their Supabase JWT is verified directly here —
// no workspace claims required, because visitors aren't workspace members.
// ---------------------------------------------------------------------------

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { platformFeeCents } from '../lib/fees.js';
import { zonedTimeToUtc } from '../lib/availability/timezone.js';

const participantJwks = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createRemoteJWKSet(
      new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
    )
  : null;

async function participantEmailFromAuth(c: {
  req: { header: (n: string) => string | undefined };
}): Promise<string | null> {
  const auth = c.req.header('authorization');
  if (!auth?.startsWith('Bearer ') || !participantJwks) return null;
  try {
    const { payload } = await jwtVerify(auth.slice(7), participantJwks, {
      audience: process.env.API_JWT_AUDIENCE ?? 'authenticated',
    });
    return (payload.email as string | undefined) ?? null;
  } catch {
    return null;
  }
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

  // Connection + payment settings are user-level SPoTs shared across the
  // Fibre apps: personal room via lib/connections, Stripe via
  // lib/payment-accounts (user_profile first, app columns as fallback).
  // Platform profile provides the shared display fields; the organiser row
  // holds app-level overrides (docs/platform-spot-members-profile.md).
  const { data: profile } = await adminClient
    .from('user_profile')
    .select('display_name, bio, photo_url, timezone')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  return c.json({
    ...organiser,
    display_name: organiser.display_name ?? profile?.display_name ?? null,
    bio: organiser.bio ?? profile?.bio ?? null,
    photo_url: organiser.photo_url ?? profile?.photo_url ?? null,
    personal_room_url: await userPersonalRoom(ctx.userId),
    stripe_account_id: await personalStripeAccount(ctx.userId),
  });
});

// PATCH /api/v1/thread/me — update organiser config
const OrganiserUpdate = z.object({
  slug: slugField.optional(),
  display_name: z.string().max(200).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  photo_url: z.string().max(500).nullable().optional(),
  timezone: z.string().max(100).optional(),
  // (stripe_account_id intentionally NOT accepted here — payments are a
  // platform SPoT; Settings → Payments writes /api/v1/profile.)
  // Share of net revenue this organiser keeps (workspace admin decision).
  vendor_cut_percent: z.number().min(0).max(100).optional(),
  // Invoice issuer identity (legal name / address / tax no) — personal level.
  invoice_details: z
    .object({
      legal_name: z.string().max(200).optional(),
      address: z.string().max(500).optional(),
      tax_no: z.string().max(60).optional(),
    })
    .nullable()
    .optional(),
});

threadRoutes.patch('/me', async (c) => {
  const body = OrganiserUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const patch: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };

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
  // Workspace Stripe account resolves through the payments SPoT.
  return c.json({
    ...settings,
    stripe_account_id: await workspaceStripeAccount(ctx.workspaceId),
  });
});

const SettingsUpdate = z.object({
  // (stripe_account_id intentionally NOT accepted — the payments SPoT
  // writes workspace-level config via /api/v1/workspace-billing.)
  default_vendor_cut_percent: z.number().min(0).max(100).optional(),
  email_from_mode: z.enum(['workspace', 'team', 'personal', 'custom']).optional(),
  email_from_name: z.string().max(200).nullable().optional(),
  email_footer_note: z.string().max(1000).nullable().optional(),
  // Invoice issuer identity — workspace level.
  invoice_details: z
    .object({
      legal_name: z.string().max(200).optional(),
      address: z.string().max(500).optional(),
      tax_no: z.string().max(60).optional(),
    })
    .nullable()
    .optional(),
});

threadRoutes.patch('/settings', async (c) => {
  const body = SettingsUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const patch: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };

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
  price_cents, price_currency, payment_destination, payment_methods, language, public_interaction, share_participants_public, share_participants_participants, capacity, registration_fields,
  certificate_enabled, certificate_criteria, certificate_template_id,
  created_at, updated_at,
  program:program_id (id, title, format, status, starts_on, ends_on),
  organiser:organiser_id (id, slug, display_name, user_id),
  team:team_id (id, name, slug),
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
  if (body.data.starts_on && body.data.ends_on && body.data.ends_on < body.data.starts_on) {
    return c.json({ error: 'the end date cannot be before the start date' }, 400);
  }
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
  payment_destination: z.enum(['workspace', 'personal']).nullable().optional(),
  language: z.enum(['en', 'nl', 'es', 'pt', 'de']).optional(),
  public_interaction: z.enum(['page', 'popup']).optional(),
  payment_methods: z.array(z.enum(['stripe', 'invoice'])).min(1).optional(),
  share_participants_public: z.boolean().optional(),
  share_participants_participants: z.boolean().optional(),
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

  // End-before-start guard — the picker constrains this client-side; the
  // API is the backstop (checks the values as they'll be after the shift).
  if (starts_on !== undefined || ends_on !== undefined) {
    const { data: prog } = await db
      .from('program')
      .select('starts_on, ends_on')
      .eq('id', existing.program_id)
      .single();
    const effStart =
      'starts_on' in programPatch ? (programPatch.starts_on as string | null) : prog?.starts_on ?? null;
    const effEnd =
      'ends_on' in programPatch ? (programPatch.ends_on as string | null) : prog?.ends_on ?? null;
    if (effStart && effEnd && effEnd < effStart) {
      return c.json({ error: 'the end date cannot be before the start date' }, 400);
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

// DELETE /api/v1/thread/threads/:id — the thread, its engagements, tickets,
// coupons and enrolment companions (cascade) + the paired program row.
threadRoutes.delete('/threads/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: existing } = await db
    .from('thread_thread')
    .select('id, program_id')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!existing) return c.json({ error: 'not found' }, 404);
  const { error } = await db.from('thread_thread').delete().eq('id', existing.id);
  if (error) return c.json({ error: error.message }, 500);
  // Program second: deleting it cascades platform enrolments.
  await adminClient.from('program').delete().eq('id', existing.program_id);
  return c.body(null, 204);
});

// POST /api/v1/thread/threads/:id/duplicate — clone as a draft (title
// "(copy)", fresh slug, engagements cloned; enrolments NOT copied).
threadRoutes.post('/threads/:id/duplicate', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: src } = await db
    .from('thread_thread')
    .select('*, program:program_id (title, format, starts_on, ends_on)')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!src) return c.json({ error: 'not found' }, 404);
  const prog = Array.isArray(src.program) ? src.program[0] : src.program;

  const { data: app } = await db.from('app').select('id').eq('slug', 'the-thread').single();
  const { data: newProgram, error: pErr } = await db
    .from('program')
    .insert({
      workspace_id: ctx.workspaceId,
      app_id: app!.id,
      title: `${prog?.title ?? src.slug} (copy)`,
      format: prog?.format ?? 'event',
      starts_on: prog?.starts_on ?? null,
      ends_on: prog?.ends_on ?? null,
      status: 'draft',
    })
    .select('id')
    .single();
  if (pErr || !newProgram) return c.json({ error: pErr?.message ?? 'program failed' }, 500);

  const slug = `${src.slug}-copy-${Math.random().toString(36).slice(2, 5)}`;
  const { data: newThread, error: tErr } = await db
    .from('thread_thread')
    .insert({
      workspace_id: ctx.workspaceId,
      program_id: newProgram.id,
      organiser_id: src.organiser_id,
      team_id: src.team_id,
      slug,
      intention: src.intention,
      timezone: src.timezone,
      language: src.language,
      cover_url: src.cover_url,
      is_public_listed: false,
      requires_approval: src.requires_approval,
      price_cents: src.price_cents,
      price_currency: src.price_currency,
      payment_destination: src.payment_destination,
      public_interaction: src.public_interaction,
      capacity: src.capacity,
      registration_fields: src.registration_fields,
      certificate_enabled: src.certificate_enabled,
      certificate_criteria: src.certificate_criteria,
      certificate_template_id: src.certificate_template_id,
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (tErr || !newThread) {
    await adminClient.from('program').delete().eq('id', newProgram.id);
    return c.json({ error: tErr?.message ?? 'thread failed' }, 500);
  }

  // Clone engagements (positions preserved; sends logs NOT copied).
  const { data: engagements } = await db
    .from('thread_engagement')
    .select('*')
    .eq('thread_id', src.id)
    .order('position');
  for (const e of engagements ?? []) {
    await db.from('thread_engagement').insert({
      workspace_id: ctx.workspaceId,
      thread_id: newThread.id,
      title: e.title,
      description: e.description,
      type: e.type,
      // Keep the source status — an all-draft copy silently empties the
      // public agenda and mutes every message (review 2026-07-05).
      status: e.status === 'published' ? 'published' : 'draft',
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      location: e.location,
      location_url: e.location_url,
      meeting_url: e.meeting_url,
      meeting_provider: e.meeting_provider,
      scheduled_at: e.scheduled_at,
      trigger_kind: e.trigger_kind,
      trigger_anchor: e.trigger_anchor,
      trigger_offset_days: e.trigger_offset_days,
      trigger_time: e.trigger_time,
      content: e.content,
      position: e.position,
      show_in_agenda: e.show_in_agenda,
      created_by: ctx.userId,
    });
  }

  return c.json({ id: newThread.id }, 201);
});

// ---------------------------------------------------------------------------
// Engagements
// ---------------------------------------------------------------------------

const EngagementCreate = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(ENGAGEMENT_TYPES),
  // The editor publishes new engagements by default; server default stays draft.
  status: z.enum(['draft', 'published']).optional(),
  description: z.string().max(5000).nullable().optional(),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  // Per-day times for multi-day activities (null/absent = single range).
  daily_schedule: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      }),
    )
    .max(366)
    .nullable()
    .optional(),
  location: z.string().max(500).nullable().optional(),
  location_url: z.string().max(1000).nullable().optional(),
  meeting_url: z.string().max(1000).nullable().optional(),
  meeting_provider: z
    .enum(['google_meet', 'zoom', 'teams', 'personal_room', 'custom'])
    .nullable()
    .optional(),
  scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
  // Message-family send triggers (see migration 20260702100000).
  trigger_kind: z
    .enum(['fixed', 'on_enrolment', 'on_approval', 'on_completion', 'relative'])
    .optional(),
  trigger_anchor: z.enum(['start', 'end', 'engagement']).nullable().optional(),
  trigger_engagement_id: z.string().uuid().nullable().optional(),
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
  if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
    return 'the end must come after the start';
  }
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

/** Per-day schedule sanity: each day's end must be after its start. */
function dailyScheduleError(
  sched: { date: string; start: string; end: string }[] | null | undefined,
): string | null {
  if (!sched || sched.length === 0) return null;
  for (const d of sched) {
    if (d.end <= d.start) return `each day's end time must be after its start (${d.date})`;
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
  const schedErr = dailyScheduleError(body.data.daily_schedule);
  if (schedErr) return c.json({ error: schedErr }, 400);

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
      status: body.data.status ?? 'draft',
      description: body.data.description ?? null,
      starts_at: body.data.starts_at ?? null,
      ends_at: body.data.ends_at ?? null,
      daily_schedule: body.data.daily_schedule ?? null,
      location: body.data.location ?? null,
      location_url: body.data.location_url ?? null,
      meeting_url: body.data.meeting_url ?? null,
      meeting_provider: body.data.meeting_provider ?? null,
      scheduled_at: body.data.scheduled_at ?? null,
      trigger_kind: body.data.trigger_kind ?? 'fixed',
      trigger_anchor: body.data.trigger_anchor ?? null,
      trigger_engagement_id: body.data.trigger_engagement_id ?? null,
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
  const schedErr = dailyScheduleError(body.data.daily_schedule);
  if (schedErr) return c.json({ error: schedErr }, 400);

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
  let items = data ?? [];
  // ?mine=1 — only teams the caller is an active member of (the Invoices
  // team scope shows nothing for other teams anyway).
  if (c.req.query('mine') === '1' && items.length) {
    const { data: memberships } = await adminClient
      .from('team_member')
      .select('team_id')
      .eq('user_id', ctx.userId)
      .eq('status', 'active');
    const mine = new Set((memberships ?? []).map((m) => m.team_id));
    items = items.filter((t) => mine.has(t.id));
  }
  return c.json({ items });
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
    .select('id, name, slug, description, is_active, payout_destination')
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

// PATCH /teams/:id — description + payout routing. Team leads and
// workspace admins only (RLS lets leads write the team row; admins pass
// via the explicit check).
const TeamPatch = z.object({
  description: z.string().max(2000).nullable().optional(),
  payout_destination: z.enum(['workspace', 'lead']).optional(),
});

threadRoutes.patch('/teams/:id', async (c) => {
  const body = TeamPatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');

  const { data: wm } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', ctx.userId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  const isAdmin = wm?.workspace_role === 'admin' || wm?.workspace_role === 'super_admin';
  if (!isAdmin) {
    const { data: lead } = await adminClient
      .from('team_member')
      .select('user_id')
      .eq('team_id', c.req.param('id'))
      .eq('user_id', ctx.userId)
      .eq('role', 'lead')
      .maybeSingle();
    if (!lead) return c.json({ error: 'only the team lead (or an admin) can edit the team' }, 403);
  }

  const { data, error } = await adminClient
    .from('team')
    .update(body.data)
    .eq('id', c.req.param('id'))
    .eq('workspace_id', ctx.workspaceId)
    .select('id, name, slug, description, payout_destination')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
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
// Thread templates — v3 model: a thread + its engagements captured with
// RELATIVE timing (day_offset from thread start, time_of_day, duration),
// so instantiating rebases everything onto a new start date. Messages and
// their triggers are captured too (Sjoerd 2026-07-02: "including messages").
// ---------------------------------------------------------------------------

const THREAD_TEMPLATE_SELECT =
  'id, title, scope, owner_user_id, owner_team_id, structure, created_by, created_at, updated_at';

threadRoutes.get('/thread-templates', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('thread_template')
    .select(THREAD_TEMPLATE_SELECT)
    .order('updated_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  const visible = await filterVisibleTemplates(data ?? [], 'thread', ctx.userId);
  return c.json({ items: visible });
});

threadRoutes.get('/thread-templates/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data } = await db
    .from('thread_template')
    .select(THREAD_TEMPLATE_SELECT)
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!data) return c.json({ error: 'not found' }, 404);
  const [visible] = await filterVisibleTemplates([data], 'thread', ctx.userId);
  if (!visible) return c.json({ error: 'not found' }, 404);
  return c.json(data);
});

const ThreadTemplatePatch = z.object({
  title: z.string().min(1).max(200).optional(),
  scope: z.enum(['personal', 'team', 'workspace']).optional(),
  owner_team_id: z.string().uuid().nullable().optional(),
  structure: z.record(z.unknown()).optional(),
});

threadRoutes.patch('/thread-templates/:id', async (c) => {
  const body = ThreadTemplatePatch.safeParse(await c.req.json().catch(() => null));
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
    .from('thread_template')
    .update(patch)
    .eq('id', c.req.param('id'))
    .select(THREAD_TEMPLATE_SELECT)
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

threadRoutes.delete('/thread-templates/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db.from('thread_template').delete().eq('id', c.req.param('id'));
  if (error) return c.json({ error: error.message }, 500);
  await adminClient
    .from('thread_template_share')
    .delete()
    .eq('template_kind', 'thread')
    .eq('template_id', c.req.param('id'));
  return c.body(null, 204);
});

// POST /threads/:id/save-as-template — capture the thread with relative timing.
const SaveAsTemplate = z.object({
  title: z.string().min(1).max(200),
  scope: z.enum(['personal', 'team', 'workspace']).default('personal'),
});

threadRoutes.post('/threads/:id/save-as-template', async (c) => {
  const body = SaveAsTemplate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data: thread } = await db
    .from('thread_thread')
    .select('*, program:program_id (title, format, starts_on, ends_on)')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!thread) return c.json({ error: 'not found' }, 404);
  const prog = Array.isArray(thread.program) ? thread.program[0] : thread.program;

  const { data: engagements } = await db
    .from('thread_engagement')
    .select('*')
    .eq('thread_id', thread.id)
    .order('position');

  const startMs = prog?.starts_on ? Date.parse(`${prog.starts_on}T00:00:00Z`) : null;
  const dayOffset = (iso: string | null) =>
    iso && startMs != null ? Math.round((Date.parse(iso) - startMs) / 86_400_000) : null;
  const timeOf = (iso: string | null) => (iso ? iso.slice(11, 16) : null);
  const durationMin = (a: string | null, b: string | null) =>
    a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 60_000) : null;

  const structure = {
    version: 1,
    format: prog?.format ?? 'event',
    intention: thread.intention,
    timezone: thread.timezone,
    language: thread.language,
    cover_url: thread.cover_url,
    requires_approval: thread.requires_approval,
    public_interaction: thread.public_interaction,
    price_cents: thread.price_cents,
    price_currency: thread.price_currency,
    payment_methods: thread.payment_methods,
    capacity: thread.capacity,
    registration_fields: thread.registration_fields,
    certificate_enabled: thread.certificate_enabled,
    certificate_criteria: thread.certificate_criteria,
    certificate_template_id: thread.certificate_template_id,
    duration_days:
      prog?.starts_on && prog?.ends_on
        ? Math.round((Date.parse(prog.ends_on) - Date.parse(prog.starts_on)) / 86_400_000)
        : null,
    engagements: (engagements ?? []).map((e) => ({
      type: e.type,
      title: e.title,
      description: e.description,
      position: e.position,
      location: e.location,
      location_url: e.location_url,
      meeting_url: e.meeting_url,
      meeting_provider: e.meeting_provider,
      show_in_agenda: e.show_in_agenda,
      content: e.content,
      trigger_kind: e.trigger_kind,
      trigger_anchor: e.trigger_anchor === 'engagement' ? 'start' : e.trigger_anchor,
      trigger_offset_days: e.trigger_offset_days,
      trigger_time: e.trigger_time,
      day_offset: dayOffset(e.starts_at ?? e.scheduled_at),
      time_of_day: timeOf(e.starts_at ?? e.scheduled_at),
      duration_minutes: durationMin(e.starts_at, e.ends_at),
    })),
  };

  const { data: tpl, error } = await db
    .from('thread_template')
    .insert({
      workspace_id: ctx.workspaceId,
      title: body.data.title,
      scope: body.data.scope,
      owner_user_id: body.data.scope === 'personal' ? ctx.userId : null,
      owner_team_id: body.data.scope === 'team' ? thread.team_id : null,
      structure,
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ id: tpl.id }, 201);
});

// POST /thread-templates/:id/instantiate — new thread from a template,
// dates rebased onto the given start date.
const Instantiate = z.object({
  title: z.string().min(1).max(200),
  slug: slugField,
  starts_on: z.string().date().nullable().optional(),
});

threadRoutes.post('/thread-templates/:id/instantiate', async (c) => {
  const body = Instantiate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  const { data: tpl } = await db
    .from('thread_template')
    .select('structure')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!tpl) return c.json({ error: 'not found' }, 404);
  const st = tpl.structure as Record<string, unknown>;

  const { data: organiser } = await db
    .from('thread_organiser')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!organiser) return c.json({ error: 'no organiser profile' }, 400);

  const { data: app } = await db.from('app').select('id').eq('slug', 'the-thread').single();
  const startsOn = body.data.starts_on ?? null;
  const endsOn =
    startsOn && typeof st.duration_days === 'number'
      ? shiftDateOnly(startsOn, st.duration_days)
      : null;

  const { data: program, error: pErr } = await db
    .from('program')
    .insert({
      workspace_id: ctx.workspaceId,
      app_id: app!.id,
      title: body.data.title,
      format: (st.format as string) ?? 'event',
      starts_on: startsOn,
      ends_on: endsOn,
      status: 'draft',
    })
    .select('id')
    .single();
  if (pErr || !program) return c.json({ error: pErr?.message ?? 'program failed' }, 500);

  const { data: thread, error: tErr } = await db
    .from('thread_thread')
    .insert({
      workspace_id: ctx.workspaceId,
      program_id: program.id,
      organiser_id: organiser.id,
      slug: body.data.slug,
      intention: (st.intention as string) ?? null,
      timezone: (st.timezone as string) ?? 'Europe/Amsterdam',
      language: (st.language as string) ?? 'en',
      cover_url: (st.cover_url as string) ?? null,
      is_public_listed: false,
      requires_approval: !!st.requires_approval,
      public_interaction: (st.public_interaction as string) ?? 'page',
      price_cents: (st.price_cents as number) ?? null,
      price_currency: (st.price_currency as string) ?? null,
      payment_methods: (st.payment_methods as string[]) ?? ['stripe'],
      capacity: (st.capacity as number) ?? null,
      registration_fields: st.registration_fields ?? [],
      certificate_enabled: !!st.certificate_enabled,
      certificate_criteria: (st.certificate_criteria as string) ?? null,
      certificate_template_id: (st.certificate_template_id as string) ?? null,
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (tErr || !thread) {
    await adminClient.from('program').delete().eq('id', program.id);
    const status = tErr?.code === '23505' ? 409 : 500;
    return c.json({ error: tErr?.code === '23505' ? 'slug already taken' : tErr?.message }, status);
  }

  const engagements = Array.isArray(st.engagements) ? (st.engagements as Record<string, unknown>[]) : [];
  for (const e of engagements) {
    let startsAt: string | null = null;
    let endsAt: string | null = null;
    let scheduledAt: string | null = null;
    if (startsOn && typeof e.day_offset === 'number' && typeof e.time_of_day === 'string') {
      const base = new Date(`${startsOn}T${e.time_of_day}:00Z`);
      base.setUTCDate(base.getUTCDate() + e.day_offset);
      const iso = base.toISOString();
      const isActivity = ['event', 'conversation', 'workshop'].includes(String(e.type));
      if (isActivity) {
        startsAt = iso;
        if (typeof e.duration_minutes === 'number') {
          endsAt = new Date(base.getTime() + e.duration_minutes * 60_000).toISOString();
        }
      } else if (e.trigger_kind === 'fixed') {
        scheduledAt = iso;
      }
    }
    await db.from('thread_engagement').insert({
      workspace_id: ctx.workspaceId,
      thread_id: thread.id,
      title: e.title,
      description: e.description ?? null,
      type: e.type,
      status: e.status === 'published' ? 'published' : 'draft',
      starts_at: startsAt,
      ends_at: endsAt,
      scheduled_at: scheduledAt,
      location: e.location ?? null,
      location_url: e.location_url ?? null,
      meeting_url: e.meeting_url ?? null,
      meeting_provider: e.meeting_provider ?? null,
      trigger_kind: e.trigger_kind ?? 'fixed',
      trigger_anchor: e.trigger_anchor ?? null,
      trigger_offset_days: e.trigger_offset_days ?? null,
      trigger_time: e.trigger_time ?? null,
      content: e.content ?? {},
      position: (e.position as number) ?? 0,
      show_in_agenda: e.show_in_agenda ?? true,
      created_by: ctx.userId,
    });
  }

  return c.json({ id: thread.id }, 201);
});

// ---------------------------------------------------------------------------
// Certificate issuance — numbers THR-YYYY-XXXXX, template snapshotted at
// issue time so later edits never change issued certificates.
// ---------------------------------------------------------------------------

const CERT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

async function generateCertNumber(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    let suffix = '';
    for (let i = 0; i < 5; i++) {
      suffix += CERT_ALPHABET[Math.floor(Math.random() * CERT_ALPHABET.length)];
    }
    const number = `THR-${new Date().getFullYear()}-${suffix}`;
    const { data } = await adminClient
      .from('thread_certificate')
      .select('id')
      .eq('certificate_number', number)
      .maybeSingle();
    if (!data) return number;
  }
  throw new Error('certificate number collision');
}

type IssueResult =
  | { ok: true; certificate_number: string }
  | { ok: false; error: string; skipped?: boolean };

async function issueCertificate(
  threadEnrolmentId: string,
  issuedBy: string | null,
): Promise<IssueResult> {
  const { data: te } = await adminClient
    .from('thread_enrolment')
    .select(
      `id, workspace_id, thread_id,
       person:person_id (id, first_name, last_name, email),
       thread:thread_id (id, slug, language, certificate_enabled, certificate_criteria,
         certificate_template_id, organiser_id,
         organiser:organiser_id (slug, display_name),
         team:team_id (slug, name),
         program:program_id (title, starts_on, ends_on))`,
    )
    .eq('id', threadEnrolmentId)
    .maybeSingle();
  if (!te) return { ok: false, error: 'enrolment not found' };

  const thread = Array.isArray(te.thread) ? te.thread[0] : te.thread;
  const person = Array.isArray(te.person) ? te.person[0] : te.person;
  if (!thread || !person) return { ok: false, error: 'enrolment incomplete' };
  if (!thread.certificate_enabled) return { ok: false, error: 'certificates not enabled' };
  if (!thread.certificate_template_id) return { ok: false, error: 'no template selected' };

  // Already issued? One per enrolment.
  const { data: existing } = await adminClient
    .from('thread_certificate')
    .select('certificate_number')
    .eq('thread_enrolment_id', te.id)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: 'already issued', skipped: true };
  }

  const { data: template } = await adminClient
    .from('thread_certificate_template')
    .select('name, page_size, orientation, background_url, elements')
    .eq('id', thread.certificate_template_id)
    .maybeSingle();
  if (!template) return { ok: false, error: 'template missing' };

  const prog = Array.isArray(thread.program) ? thread.program[0] : thread.program;
  const org = Array.isArray(thread.organiser) ? thread.organiser[0] : thread.organiser;
  const team = Array.isArray(thread.team) ? thread.team[0] : thread.team;

  const recipientName =
    [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email || '';
  const number = await generateCertNumber();

  const fmt = (d: string | null) =>
    d
      ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(
          new Date(d),
        )
      : '';

  // The full snapshot: template doc + resolved token values. The public page
  // renders exactly this, forever.
  const snapshot = {
    template: {
      page_size: template.page_size,
      orientation: template.orientation,
      background_url: template.background_url,
      elements: template.elements,
    },
    values: {
      recipient_name: recipientName,
      thread_title: prog?.title ?? thread.slug,
      org_name: team?.name ?? org?.display_name ?? '',
      issue_date: fmt(new Date().toISOString()),
      start_date: fmt(prog?.starts_on ?? null),
      end_date: fmt(prog?.ends_on ?? null),
      certificate_number: number,
      criteria: thread.certificate_criteria ?? '',
      issued_by: org?.display_name ?? '',
    },
  };

  const { error: insErr } = await adminClient.from('thread_certificate').insert({
    workspace_id: te.workspace_id,
    thread_id: thread.id,
    thread_enrolment_id: te.id,
    certificate_number: number,
    recipient_name: recipientName,
    recipient_email: person.email,
    template_snapshot: snapshot,
    issued_by: issuedBy,
  });
  if (insErr) {
    console.error('[thread/certificates] insert failed', insErr);
    return { ok: false, error: insErr.message };
  }

  // Notify the recipient — non-fatal.
  if (person.email) {
    try {
      const certUrl = `${threadAppUrl()}/certificate/${number}`;
      const msg = engagementMessage({
        title: `Your certificate — ${prog?.title ?? thread.slug}`,
        bodyText: `Congratulations, ${recipientName.split(/\s+/)[0]}!\n\nYour certificate for ${prog?.title ?? thread.slug} is ready:\n${certUrl}\n\nCertificate number: ${number}`,
        threadTitle: prog?.title ?? thread.slug,
      });
      await sendEmail({ to: person.email, ...msg });
    } catch (e) {
      console.warn('[thread/certificates] email failed', e);
    }
  }

  return { ok: true, certificate_number: number };
}

// Reissue — the explicit exception to snapshot immutability: regenerate the
// snapshot from the CURRENT template + values, keeping the number, recipient
// and original issue date (shared verification/LinkedIn links keep working).
async function reissueCertificate(threadEnrolmentId: string): Promise<IssueResult> {
  const { data: te } = await adminClient
    .from('thread_enrolment')
    .select(
      `id, workspace_id, thread_id,
       person:person_id (id, first_name, last_name, email),
       thread:thread_id (id, slug, language, certificate_enabled, certificate_criteria,
         certificate_template_id, organiser_id,
         organiser:organiser_id (slug, display_name),
         team:team_id (slug, name),
         program:program_id (title, starts_on, ends_on))`,
    )
    .eq('id', threadEnrolmentId)
    .maybeSingle();
  if (!te) return { ok: false, error: 'enrolment not found' };

  const thread = Array.isArray(te.thread) ? te.thread[0] : te.thread;
  const person = Array.isArray(te.person) ? te.person[0] : te.person;
  if (!thread || !person) return { ok: false, error: 'enrolment incomplete' };
  if (!thread.certificate_template_id) return { ok: false, error: 'no template selected' };

  const { data: existing } = await adminClient
    .from('thread_certificate')
    .select('id, certificate_number, issued_at, recipient_name')
    .eq('thread_enrolment_id', te.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'nothing issued yet — use issue instead' };

  const { data: template } = await adminClient
    .from('thread_certificate_template')
    .select('name, page_size, orientation, background_url, elements')
    .eq('id', thread.certificate_template_id)
    .maybeSingle();
  if (!template) return { ok: false, error: 'template missing' };

  const prog = Array.isArray(thread.program) ? thread.program[0] : thread.program;
  const org = Array.isArray(thread.organiser) ? thread.organiser[0] : thread.organiser;
  const team = Array.isArray(thread.team) ? thread.team[0] : thread.team;
  const recipientName =
    [person.first_name, person.last_name].filter(Boolean).join(' ') ||
    existing.recipient_name ||
    person.email ||
    '';

  const fmt = (d: string | null) =>
    d
      ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(
          new Date(d),
        )
      : '';

  const snapshot = {
    template: {
      page_size: template.page_size,
      orientation: template.orientation,
      background_url: template.background_url,
      elements: template.elements,
    },
    values: {
      recipient_name: recipientName,
      thread_title: prog?.title ?? thread.slug,
      org_name: team?.name ?? org?.display_name ?? '',
      // The attestation date does NOT change on reissue.
      issue_date: fmt(existing.issued_at),
      start_date: fmt(prog?.starts_on ?? null),
      end_date: fmt(prog?.ends_on ?? null),
      certificate_number: existing.certificate_number,
      criteria: thread.certificate_criteria ?? '',
      issued_by: org?.display_name ?? '',
    },
  };

  const { error: upErr } = await adminClient
    .from('thread_certificate')
    .update({
      template_snapshot: snapshot,
      recipient_name: recipientName,
      reissued_at: new Date().toISOString(),
    })
    .eq('id', existing.id);
  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true, certificate_number: existing.certificate_number };
}

// POST /api/v1/thread/enrolments/:id/reissue-certificate
threadRoutes.post('/enrolments/:id/reissue-certificate', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: visible } = await db
    .from('thread_enrolment')
    .select('id')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!visible) return c.json({ error: 'not found' }, 404);

  const r = await reissueCertificate(c.req.param('id'));
  if (!r.ok) return c.json({ error: r.error }, 400);
  return c.json({ ok: true, certificate_number: r.certificate_number });
});

// POST /api/v1/thread/enrolments/:id/certificate — issue one
threadRoutes.post('/enrolments/:id/certificate', async (c) => {
  const ctx = c.get('ctx');
  // Visibility check through RLS first.
  const db = userClient(ctx.jwt);
  const { data: visible } = await db
    .from('thread_enrolment')
    .select('id')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!visible) return c.json({ error: 'not found' }, 404);

  const r = await issueCertificate(c.req.param('id'), ctx.userId);
  if (!r.ok) return c.json({ error: r.error }, r.skipped ? 409 : 400);
  return c.json({ ok: true, certificate_number: r.certificate_number }, 201);
});

// POST /api/v1/thread/threads/:id/certificates/bulk — issue to every
// COMPLETED enrolment without a certificate yet.
threadRoutes.post('/threads/:id/certificates/bulk', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: thread } = await db
    .from('thread_thread')
    .select('id')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!thread) return c.json({ error: 'not found' }, 404);

  const { data: enrolments } = await adminClient
    .from('thread_enrolment')
    .select('id, enrolment:enrolment_id (status)')
    .eq('thread_id', thread.id);

  let issued = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const te of enrolments ?? []) {
    const enr = Array.isArray(te.enrolment) ? te.enrolment[0] : te.enrolment;
    if (enr?.status !== 'completed') {
      skipped++;
      continue;
    }
    const r = await issueCertificate(te.id, ctx.userId);
    if (r.ok) issued++;
    else if (r.skipped) skipped++;
    else errors.push(r.error);
  }
  return c.json({ issued, skipped, errors });
});

// GET /api/v1/thread/public/certificate/:number — the public certificate.
// Snapshot-only: nothing here depends on live template/thread state.
threadRoutes.get('/public/certificate/:number', async (c) => {
  const { data } = await adminClient
    .from('thread_certificate')
    .select('certificate_number, recipient_name, issued_at, template_snapshot')
    .eq('certificate_number', c.req.param('number').toUpperCase())
    .maybeSingle();
  if (!data) return c.json({ error: 'not found' }, 404);
  return c.json(data);
});

// ---------------------------------------------------------------------------
// Tickets + coupons (v3-style pricing lists; editors open in popups)
// ---------------------------------------------------------------------------

const TicketBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  price_cents: z.number().int().min(0),
  price_currency: z.string().length(3).default('EUR'),
  quantity_limit: z.number().int().positive().nullable().optional(),
  available_until: z.string().datetime({ offset: true }).nullable().optional(),
  is_active: z.boolean().optional(),
  // Null = inherit thread-level (which may inherit the account default).
  payment_methods: z.array(z.enum(['stripe', 'invoice'])).nullable().optional(),
});

threadRoutes.get('/threads/:id/tickets', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('thread_ticket')
    .select('*')
    .eq('thread_id', c.req.param('id'))
    .order('position', { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

threadRoutes.post('/threads/:id/tickets', async (c) => {
  const body = TicketBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const threadId = c.req.param('id');
  const { data: last } = await db
    .from('thread_ticket')
    .select('position')
    .eq('thread_id', threadId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from('thread_ticket')
    .insert({
      workspace_id: ctx.workspaceId,
      thread_id: threadId,
      ...body.data,
      position: (last?.position ?? -1) + 1,
    })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

threadRoutes.patch('/tickets/:id', async (c) => {
  const body = TicketBody.partial().safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('thread_ticket')
    .update(body.data)
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

threadRoutes.delete('/tickets/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db.from('thread_ticket').delete().eq('id', c.req.param('id'));
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

const CouponBody = z.object({
  code: z.string().min(2).max(60),
  name: z.string().max(200).nullable().optional(),
  type: z.enum(['percentage', 'amount', 'free']),
  discount_percentage: z.number().min(0).max(100).nullable().optional(),
  discount_amount_cents: z.number().int().min(0).nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  is_early_bird: z.boolean().optional(),
  early_bird_deadline: z.string().datetime({ offset: true }).nullable().optional(),
  is_active: z.boolean().optional(),
  ticket_id: z.string().uuid().nullable().optional(),
});

threadRoutes.get('/threads/:id/coupons', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('thread_coupon')
    .select('*')
    .eq('thread_id', c.req.param('id'))
    .order('created_at', { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

threadRoutes.post('/threads/:id/coupons', async (c) => {
  const body = CouponBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('thread_coupon')
    .insert({
      workspace_id: ctx.workspaceId,
      thread_id: c.req.param('id'),
      ...body.data,
      code: body.data.code.trim().toUpperCase(),
    })
    .select('*')
    .single();
  if (error) {
    const s = error.code === '23505' ? 409 : 500;
    return c.json({ error: error.code === '23505' ? 'code already exists' : error.message }, s);
  }
  return c.json(data, 201);
});

threadRoutes.patch('/coupons/:id', async (c) => {
  const body = CouponBody.partial().safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const patch = { ...body.data };
  if (patch.code) patch.code = patch.code.trim().toUpperCase();
  const { data, error } = await db
    .from('thread_coupon')
    .update(patch)
    .eq('id', c.req.param('id'))
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

threadRoutes.delete('/coupons/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db.from('thread_coupon').delete().eq('id', c.req.param('id'));
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Asset upload — images for certificate backgrounds/elements (and covers).
// Multipart form: field "file". Stored in the public thread-assets bucket.
// ---------------------------------------------------------------------------

threadRoutes.post('/uploads', async (c) => {
  const ctx = c.get('ctx');
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: 'multipart field "file" required' }, 400);
  if (file.size > 5 * 1024 * 1024) return c.json({ error: 'max 5MB' }, 400);
  // Raster images only — SVG/HTML in a public bucket is stored XSS.
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) {
    return c.json({ error: 'images only (png, jpeg, webp, gif, avif)' }, 400);
  }
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${ctx.workspaceId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await adminClient.storage
    .from('thread-assets')
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (error) {
    console.error('[thread/uploads] failed', error);
    return c.json({ error: error.message }, 500);
  }
  const { data } = adminClient.storage.from('thread-assets').getPublicUrl(path);
  return c.json({ url: data.publicUrl }, 201);
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
  'id, name, scope, owner_user_id, owner_team_id, page_size, orientation, background_url, elements, archived_at, created_by, created_at, updated_at';

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

// POST /enrolments/:id/send-certificate — email the participant their
// certificate link. Explicit, per-selection — never automatic.
threadRoutes.post('/enrolments/:id/send-certificate', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: te } = await db
    .from('thread_enrolment')
    .select(
      `id,
       person:person_id (first_name, email),
       thread:thread_id (slug, program:program_id (title)),
       certificate:thread_certificate (certificate_number)`,
    )
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!te) return c.json({ error: 'not found' }, 404);

  const person = Array.isArray(te.person) ? te.person[0] : te.person;
  const thread = Array.isArray(te.thread) ? te.thread[0] : te.thread;
  const cert = Array.isArray(te.certificate) ? te.certificate[0] : te.certificate;
  const program = thread && (Array.isArray(thread.program) ? thread.program[0] : thread.program);
  if (!cert) return c.json({ error: 'no certificate issued for this enrolment' }, 409);
  if (!person?.email) return c.json({ error: 'no email address on file' }, 409);

  const certUrl = `${threadAppUrl()}/certificate/${encodeURIComponent(cert.certificate_number)}`;
  const title = program?.title ?? 'your thread';
  try {
    await sendEmail({
      to: person.email,
      subject: `Your certificate — ${title}`,
      html: shell(
        'Your certificate',
        `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hi ${escapeHtml(person.first_name ?? '')},</p>
         <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Congratulations — your certificate for <strong>${escapeHtml(title)}</strong> is ready.</p>
         <p style="margin:24px 0;"><a href="${certUrl}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">View your certificate</a></p>
         <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0;">Certificate ${escapeHtml(cert.certificate_number)} — this page verifies it, prints it, and adds it to your LinkedIn profile.</p>`,
      ),
      text: `Congratulations — your certificate for ${title} is ready: ${certUrl}`,
    });
  } catch (e) {
    console.error('[thread/certificates] send email failed', e);
    return c.json({ error: 'sending the email failed — try again' }, 500);
  }
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Approval + completion (Phase: enrolment lifecycle). Read through the
// user's RLS to prove access; mutate via adminClient (platform enrolment).
// ---------------------------------------------------------------------------

const ENROLMENT_ACTION_SELECT = `id, thread_id, enrolment_id,
  person:person_id (id, first_name, last_name, email),
  thread:thread_id (id, slug, language, workspace_id, certificate_enabled,
    organiser:organiser_id (display_name, user_id),
    team:team_id (name),
    program:program_id (title, status, starts_on))`;

async function loadEnrolmentForAction(
  jwt: string,
  threadEnrolmentId: string,
  actor?: { userId: string; workspaceId: string },
) {
  const db = userClient(jwt);
  const { data: te } = await db
    .from('thread_enrolment')
    .select(ENROLMENT_ACTION_SELECT)
    .eq('id', threadEnrolmentId)
    .maybeSingle();
  if (!te) return null;
  const person = Array.isArray(te.person) ? te.person[0] : te.person;
  const thread = Array.isArray(te.thread) ? te.thread[0] : te.thread;
  const organiser =
    thread && (Array.isArray(thread.organiser) ? thread.organiser[0] : thread.organiser);
  const team = thread && (Array.isArray(thread.team) ? thread.team[0] : thread.team);
  const program =
    thread && (Array.isArray(thread.program) ? thread.program[0] : thread.program);
  if (!person || !thread || !program) return null;

  // Money/lifecycle authority (review finding #1): workspace visibility is
  // NOT authority. Only admins, the thread's organiser, or its co-organiser
  // hosts may act on an enrolment.
  if (actor) {
    const { data: wm } = await adminClient
      .from('workspace_member')
      .select('workspace_role')
      .eq('user_id', actor.userId)
      .eq('workspace_id', actor.workspaceId)
      .maybeSingle();
    const isAdmin = wm?.workspace_role === 'admin' || wm?.workspace_role === 'super_admin';
    const ownerUserId = (organiser as { user_id?: string } | null)?.user_id ?? null;
    let allowed = isAdmin || ownerUserId === actor.userId;
    if (!allowed) {
      const { data: co } = await adminClient
        .from('thread_thread_organiser')
        .select('role, organiser:organiser_id (user_id)')
        .eq('thread_id', thread.id);
      allowed = (co ?? []).some((row) => {
        const o = Array.isArray(row.organiser) ? row.organiser[0] : row.organiser;
        return o?.user_id === actor.userId && row.role === 'host';
      });
    }
    if (!allowed) return 'forbidden' as const;
  }

  return {
    te,
    person,
    thread,
    program,
    organiserName: team?.name ?? organiser?.display_name ?? '',
    personName:
      [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email || '',
  };
}

async function logEnrolmentActivity(
  workspaceId: string,
  personId: string,
  type: string,
  subject: string,
) {
  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'the-thread')
    .single();
  if (!app) return;
  await adminClient.from('activity').insert({
    workspace_id: workspaceId,
    person_id: personId,
    app_id: app.id,
    type,
    subject: subject.slice(0, 200),
    occurred_at: new Date().toISOString(),
  });
}

// POST /enrolments/:id/approve — invited → enrolled. Sends the standard
// confirmation and fires on_enrolment + on_approval messages.
threadRoutes.post('/enrolments/:id/approve', async (c) => {
  const ctx = c.get('ctx');
  const loaded = await loadEnrolmentForAction(ctx.jwt, c.req.param('id'), {
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
  });
  if (!loaded) return c.json({ error: 'not found' }, 404);
  if (loaded === 'forbidden') {
    return c.json({ error: 'only the thread organiser (or an admin) can do that' }, 403);
  }
  const { te, person, thread, program, organiserName, personName } = loaded;

  const { data: enr } = await adminClient
    .from('enrolment')
    .select('status')
    .eq('id', te.enrolment_id)
    .maybeSingle();
  if (!enr) return c.json({ error: 'platform enrolment missing' }, 500);
  if (enr.status !== 'invited') return c.json({ ok: true, already: true, status: enr.status });

  const { error: upErr } = await adminClient
    .from('enrolment')
    .update({ status: 'enrolled', enrolled_at: new Date().toISOString() })
    .eq('id', te.enrolment_id);
  if (upErr) return c.json({ error: upErr.message }, 500);

  await logEnrolmentActivity(
    thread.workspace_id,
    person.id,
    'enrolment_approved',
    `Approved: ${program.title}`,
  );

  if (person.email) {
    try {
      const msg = enrolmentConfirmation({
        participantName: personName,
        threadTitle: program.title,
        intention: null,
        organiserName,
        startsOn: program.starts_on,
        threadUrl: `${threadAppUrl()}/my`,
        locale: (thread as { language?: string }).language ?? 'en',
      });
      await sendEmail({ to: person.email, ...msg });
    } catch (e) {
      console.warn('[thread/approve] confirmation email failed', e);
    }
    // Welcome (on_enrolment) waits for approval on gated threads; plus any
    // explicit on_approval messages. Both dedup via thread_message_send.
    for (const trigger of ['on_enrolment', 'on_approval'] as const) {
      try {
        await sendTriggeredMessages({
          threadId: thread.id,
          trigger,
          personId: person.id,
          email: person.email,
          name: personName,
          threadTitle: program.title,
          organiserName,
          startsOn: program.starts_on,
        });
      } catch (e) {
        console.warn('[thread/approve] triggered messages failed', { trigger, e });
      }
    }
  }
  return c.json({ ok: true });
});

// POST /threads/:id/participants — the organiser adds someone by hand
// (walk-ins, phone signups, imports). Skips payment and approval: the
// person lands as 'enrolled' immediately. Authority = admins, the thread
// organiser, co-organiser hosts, or members of the owning team (workspace
// visibility is NOT authority — review finding #1 applies to enrolment
// creation too).
const ManualParticipant = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  notify: z.boolean().optional(),
});

threadRoutes.post('/threads/:id/participants', async (c) => {
  const body = ManualParticipant.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: thread } = await db
    .from('thread_thread')
    .select(
      'id, workspace_id, program_id, team_id, capacity, language, organiser:organiser_id (user_id, display_name, user:user_id (full_name)), program:program_id (id, title, starts_on, status)',
    )
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!thread) return c.json({ error: 'not found' }, 404);
  const program = Array.isArray(thread.program) ? thread.program[0] : thread.program;
  if (!program) return c.json({ error: 'thread has no program' }, 500);
  const organiser = Array.isArray(thread.organiser) ? thread.organiser[0] : thread.organiser;
  const orgUser = organiser
    ? Array.isArray(organiser.user)
      ? organiser.user[0]
      : organiser.user
    : null;
  const organiserName = organiser?.display_name ?? orgUser?.full_name ?? 'The organiser';

  // Enrolment-creation authority (review 2026-07-05): same rule as the
  // lifecycle actions in loadEnrolmentForAction.
  const { data: wm } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', ctx.userId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  let allowed =
    wm?.workspace_role === 'admin' ||
    wm?.workspace_role === 'super_admin' ||
    (organiser as { user_id?: string } | null)?.user_id === ctx.userId;
  if (!allowed) {
    const { data: co } = await adminClient
      .from('thread_thread_organiser')
      .select('role, organiser:organiser_id (user_id)')
      .eq('thread_id', thread.id);
    allowed = (co ?? []).some((row) => {
      const o = Array.isArray(row.organiser) ? row.organiser[0] : row.organiser;
      return o?.user_id === ctx.userId && row.role === 'host';
    });
  }
  const threadTeamId = (thread as { team_id?: string | null }).team_id ?? null;
  if (!allowed && threadTeamId) {
    const { data: tm } = await adminClient
      .from('team_member')
      .select('user_id')
      .eq('team_id', threadTeamId)
      .eq('user_id', ctx.userId)
      .eq('status', 'active')
      .maybeSingle();
    allowed = !!tm;
  }
  if (!allowed) {
    return c.json({ error: 'only the thread organiser (or an admin) can add participants' }, 403);
  }

  // Closed threads don't take new people.
  const programStatus = (program as { status?: string }).status;
  if (programStatus === 'archived' || programStatus === 'completed') {
    return c.json(
      { error: `this thread is ${programStatus} — participants can no longer be added` },
      409,
    );
  }

  // Capacity holds for manual adds too — raise it to add more.
  const capacity = (thread as { capacity?: number | null }).capacity ?? null;
  if (capacity) {
    const { count } = await adminClient
      .from('thread_enrolment')
      .select('id', { count: 'exact', head: true })
      .eq('thread_id', thread.id)
      .neq('payment_status', 'failed');
    if ((count ?? 0) >= capacity) {
      return c.json({ error: 'this thread is full — raise its capacity to add more people' }, 409);
    }
  }

  const email = body.data.email.trim().toLowerCase();
  const name = body.data.name.trim();

  // Same account auto-create as the public form (email-only; they verify
  // via OTP/Google at first sign-in).
  try {
    const { data: hasAccount } = await adminClient.rpc('auth_user_exists', { p_email: email });
    if (hasAccount !== true) {
      await adminClient.auth.admin.createUser({ email, email_confirm: true });
    }
  } catch (e) {
    console.warn('[thread/participants] account auto-create failed', e);
  }

  let { data: person } = await adminClient
    .from('person')
    .select('id, first_name')
    .eq('workspace_id', thread.workspace_id)
    .eq('email', email)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (!person) {
    const parts = name.split(/\s+/);
    const { data: created, error: pErr } = await adminClient
      .from('person')
      .insert({
        workspace_id: thread.workspace_id,
        first_name: parts[0] ?? name,
        last_name: parts.slice(1).join(' ') || null,
        email,
      })
      .select('id, first_name')
      .single();
    if (pErr || !created) {
      console.error('[thread/participants] person insert failed', pErr);
      return c.json({ error: 'could not create the person' }, 500);
    }
    person = created;
  }

  // Platform enrolment — reuse if present; existing companion = already in.
  let enrolmentId: string;
  const { data: platEnrolment } = await adminClient
    .from('enrolment')
    .select('id, status')
    .eq('program_id', thread.program_id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (platEnrolment) {
    const { data: dup } = await adminClient
      .from('thread_enrolment')
      .select('id')
      .eq('enrolment_id', platEnrolment.id)
      .maybeSingle();
    if (dup) {
      // Companion exists. Door override: invited (unapproved/unpaid) and
      // dropped people get re-activated; live or finished states are
      // reported honestly and left alone (review 2026-07-05).
      if (platEnrolment.status === 'invited' || platEnrolment.status === 'dropped') {
        await adminClient
          .from('enrolment')
          .update({ status: 'enrolled', enrolled_at: new Date().toISOString() })
          .eq('id', platEnrolment.id);
        return c.json({ ok: true, enrolment_id: dup.id, reactivated: true });
      }
      return c.json({ ok: true, already_enrolled: true, enrolment_id: dup.id });
    }
    enrolmentId = platEnrolment.id;
    // Only lift invited/dropped — never regress completed/active platform
    // state (it would leave completed_at set with status 'enrolled').
    if (platEnrolment.status === 'invited' || platEnrolment.status === 'dropped') {
      await adminClient
        .from('enrolment')
        .update({ status: 'enrolled', enrolled_at: new Date().toISOString() })
        .eq('id', enrolmentId);
    }
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
      console.error('[thread/participants] enrolment insert failed', eErr);
      return c.json({ error: 'could not enrol' }, 500);
    }
    enrolmentId = enr.id;
  }

  const { data: te, error: teErr } = await adminClient
    .from('thread_enrolment')
    .insert({
      workspace_id: thread.workspace_id,
      thread_id: thread.id,
      enrolment_id: enrolmentId,
      person_id: person.id,
      payment_status: 'not_required',
      request_id: `manual:${crypto.randomUUID()}`,
    })
    .select('id')
    .single();
  if (teErr || !te) {
    console.error('[thread/participants] thread_enrolment insert failed', teErr);
    return c.json({ error: teErr?.message ?? 'could not enrol' }, 500);
  }

  // Transactional consent (contract basis) — same as the public form.
  const { data: activeConsent } = await adminClient
    .from('consent_record')
    .select('id')
    .eq('person_id', person.id)
    .eq('purpose_code', 'transactional_email')
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
  if (!activeConsent) {
    await adminClient.from('consent_record').insert({
      person_id: person.id,
      purpose_code: 'transactional_email',
      legal_basis: 'contract',
    });
  }

  await logEnrolmentActivity(
    thread.workspace_id,
    person.id,
    'event_registered',
    `Registered: ${program.title}`,
  );

  if (body.data.notify !== false) {
    try {
      const msg = enrolmentConfirmation({
        participantName: name,
        threadTitle: program.title,
        intention: null,
        organiserName,
        startsOn: program.starts_on,
        threadUrl: `${threadAppUrl()}/my`,
        locale: (thread as { language?: string }).language ?? 'en',
      });
      await sendEmail({ to: email, ...msg });
    } catch (e) {
      console.warn('[thread/participants] confirmation email failed', e);
    }
    try {
      await sendTriggeredMessages({
        threadId: thread.id,
        trigger: 'on_enrolment',
        personId: person.id,
        email,
        name,
        threadTitle: program.title,
        organiserName,
        startsOn: program.starts_on,
      });
    } catch (e) {
      console.warn('[thread/participants] triggered messages failed', e);
    }
  }
  return c.json({ ok: true, enrolment_id: te.id }, 201);
});

// POST /enrolments/:id/decline — invited → dropped. No email (organisers
// decline for many reasons; a generic rejection mail does more harm).
threadRoutes.post('/enrolments/:id/decline', async (c) => {
  const ctx = c.get('ctx');
  const loaded = await loadEnrolmentForAction(ctx.jwt, c.req.param('id'), {
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
  });
  if (!loaded) return c.json({ error: 'not found' }, 404);
  if (loaded === 'forbidden') {
    return c.json({ error: 'only the thread organiser (or an admin) can do that' }, 403);
  }
  const { te, person, thread, program } = loaded;

  const { error: upErr } = await adminClient
    .from('enrolment')
    .update({ status: 'dropped' })
    .eq('id', te.enrolment_id);
  if (upErr) return c.json({ error: upErr.message }, 500);

  // A declined participant must not be able to pay through a checkout tab
  // that is still open (review finding #5) — expire any pending session.
  const { data: teRow } = await adminClient
    .from('thread_enrolment')
    .select('stripe_session_id, payment_status')
    .eq('id', te.id)
    .maybeSingle();
  if (teRow?.stripe_session_id && teRow.payment_status === 'pending') {
    const stripe = stripeOrNull();
    if (stripe) {
      try {
        const account = await chargeAccountForItem('the-thread', te.id);
        if (account) {
          await stripe.checkout.sessions.expire(teRow.stripe_session_id, undefined, {
            stripeAccount: account,
          });
        }
      } catch {
        /* already expired/completed — the webhook path handles the rest */
      }
    }
  }

  await logEnrolmentActivity(
    thread.workspace_id,
    person.id,
    'enrolment_declined',
    `Declined: ${program.title}`,
  );
  return c.json({ ok: true });
});

// POST /enrolments/:id/complete — → completed. Fires on_completion messages
// and auto-issues the certificate when the thread awards one (the email
// with the certificate stays a separate, explicit action).
threadRoutes.post('/enrolments/:id/complete', async (c) => {
  const ctx = c.get('ctx');
  const loaded = await loadEnrolmentForAction(ctx.jwt, c.req.param('id'), {
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
  });
  if (!loaded) return c.json({ error: 'not found' }, 404);
  if (loaded === 'forbidden') {
    return c.json({ error: 'only the thread organiser (or an admin) can do that' }, 403);
  }
  const { te, person, thread, program, organiserName, personName } = loaded;

  const { data: enr } = await adminClient
    .from('enrolment')
    .select('status')
    .eq('id', te.enrolment_id)
    .maybeSingle();
  if (!enr) return c.json({ error: 'platform enrolment missing' }, 500);
  if (enr.status === 'completed') return c.json({ ok: true, already: true });

  const { error: upErr } = await adminClient
    .from('enrolment')
    .update({
      status: 'completed',
      progress_pct: 100,
      completed_at: new Date().toISOString(),
    })
    .eq('id', te.enrolment_id);
  if (upErr) return c.json({ error: upErr.message }, 500);

  await logEnrolmentActivity(
    thread.workspace_id,
    person.id,
    'enrolment_completed',
    `Completed: ${program.title}`,
  );

  let certificateNumber: string | null = null;
  if (thread.certificate_enabled) {
    const issued = await issueCertificate(te.id, ctx.userId);
    if (issued.ok) certificateNumber = issued.certificate_number;
    else if (!('skipped' in issued && issued.skipped)) {
      console.warn('[thread/complete] auto-issue failed', issued.error);
    }
  }

  if (person.email) {
    try {
      await sendTriggeredMessages({
        threadId: thread.id,
        trigger: 'on_completion',
        personId: person.id,
        email: person.email,
        name: personName,
        threadTitle: program.title,
        organiserName,
        startsOn: program.starts_on,
      });
    } catch (e) {
      console.warn('[thread/complete] on_completion messages failed', e);
    }
  }
  return c.json({ ok: true, certificate_number: certificateNumber });
});

// ---------------------------------------------------------------------------
// Paid enrolments — completion side-effects (webhook + invoice mark-paid).
// ---------------------------------------------------------------------------

/** Runs after a payment lands: activity, and (unless approval-gated) the
 *  enrolled status + confirmation + on_enrolment messages. */
export async function finalizePaidEnrolment(threadEnrolmentId: string): Promise<void> {
  const { data: te } = await adminClient
    .from('thread_enrolment')
    .select(
      `id, thread_id, enrolment_id,
       person:person_id (id, first_name, last_name, email),
       thread:thread_id (id, slug, language, workspace_id, requires_approval,
         organiser:organiser_id (display_name),
         team:team_id (name),
         program:program_id (title, starts_on))`,
    )
    .eq('id', threadEnrolmentId)
    .maybeSingle();
  if (!te) return;
  const person = Array.isArray(te.person) ? te.person[0] : te.person;
  const thread = Array.isArray(te.thread) ? te.thread[0] : te.thread;
  if (!person || !thread) return;
  const program = Array.isArray(thread.program) ? thread.program[0] : thread.program;
  const organiser = Array.isArray(thread.organiser) ? thread.organiser[0] : thread.organiser;
  const team = Array.isArray(thread.team) ? thread.team[0] : thread.team;
  const organiserName = team?.name ?? organiser?.display_name ?? '';
  const personName =
    [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email || '';

  await logEnrolmentActivity(
    thread.workspace_id,
    person.id,
    'payment_received',
    `Paid: ${program?.title ?? thread.slug}`,
  );

  // Approval-gated threads stay 'invited' — the participant already has the
  // "request received" email; approval runs the confirmation.
  if (thread.requires_approval) return;

  const { data: enr } = await adminClient
    .from('enrolment')
    .select('status')
    .eq('id', te.enrolment_id)
    .maybeSingle();
  if (enr?.status !== 'invited') {
    // Already finalized on an earlier run — never re-send the confirmation
    // (webhook retries, mark-paid after repair; review finding #6/#7).
    return;
  }
  await adminClient
    .from('enrolment')
    .update({ status: 'enrolled', enrolled_at: new Date().toISOString() })
    .eq('id', te.enrolment_id);

  if (!person.email || !program) return;
  try {
    const msg = enrolmentConfirmation({
      participantName: personName,
      threadTitle: program.title,
      intention: null,
      organiserName,
      startsOn: program.starts_on,
      threadUrl: `${threadAppUrl()}/my`,
      locale: (thread as { language?: string }).language ?? 'en',
    });
    await sendEmail({ to: person.email, ...msg });
  } catch (e) {
    console.warn('[thread/paid] confirmation email failed', e);
  }
  try {
    await sendTriggeredMessages({
      threadId: thread.id,
      trigger: 'on_enrolment',
      personId: person.id,
      email: person.email,
      name: personName,
      threadTitle: program.title,
      organiserName,
      startsOn: program.starts_on,
    });
  } catch (e) {
    console.warn('[thread/paid] on_enrolment messages failed', e);
  }
}

// POST /api/v1/thread/stripe-webhook — same contract as Meet's. The endpoint
// must be registered in the Stripe dashboard; its signing secret comes from
// STRIPE_THREAD_WEBHOOK_SECRET (falls back to STRIPE_WEBHOOK_SECRET when the
// two endpoints share one).
threadRoutes.post('/stripe-webhook', async (c) => {
  const stripe = stripeOrNull();
  const secret =
    process.env.STRIPE_THREAD_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.error('[thread stripe-webhook] Stripe secret(s) missing');
    return c.json({ error: 'webhook not configured' }, 503);
  }
  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'missing stripe-signature header' }, 400);
  const raw = await c.req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    console.error('[thread stripe-webhook] signature verification failed', e);
    return c.json({ error: 'invalid signature' }, 400);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        id: string;
        amount_total?: number | null;
        currency?: string | null;
        payment_intent?: string | null;
      };
      let { data: te } = await adminClient
        .from('thread_enrolment')
        .select('id, thread_id, payment_status, amount_cents, currency, workspace_id')
        .eq('stripe_session_id', session.id)
        .maybeSingle();
      if (!te) {
        // An older (since-replaced) payment link was paid — the session id on
        // the row is newer, but the session metadata still knows the row.
        const metaRef = (event.data.object as { metadata?: { thread_enrolment_id?: string } })
          .metadata?.thread_enrolment_id;
        if (metaRef) {
          const { data: byMeta } = await adminClient
            .from('thread_enrolment')
            .select('id, thread_id, payment_status, amount_cents, currency, workspace_id')
            .eq('id', metaRef)
            .maybeSingle();
          te = byMeta ?? null;
        }
      }
      if (!te) {
        console.warn('[thread stripe-webhook] completed for unknown session', session.id);
        return c.json({ received: true });
      }
      if (te.payment_status === 'paid') {
        // Only fully done when the ledger row is paid too — otherwise a
        // retry is our chance to repair a partial earlier run (finding #7).
        const { data: app } = await adminClient
          .from('app')
          .select('id')
          .eq('slug', 'the-thread')
          .single();
        const { data: pRow } = await adminClient
          .from('purchase')
          .select('status')
          .eq('app_id', app!.id)
          .eq('item_ref', te.id)
          .maybeSingle();
        if (pRow?.status === 'paid') return c.json({ received: true, idempotent: true });
      }

      const gross = session.amount_total ?? te.amount_cents ?? 0;
      const currency = (session.currency ?? te.currency ?? 'eur').toUpperCase();
      await adminClient
        .from('thread_enrolment')
        .update({
          payment_status: 'paid',
          amount_cents: gross,
          currency,
          stripe_payment_intent:
            typeof session.payment_intent === 'string' ? session.payment_intent : null,
        })
        .eq('id', te.id);

      // Hosted invoice URL — resolved on the connected account (Meet's
      // pattern); non-fatal, resend-invoice just reports absence.
      let invoiceId: string | null = null;
      let invoiceUrl: string | null = null;
      const sessInvoice = (session as { invoice?: string | null }).invoice;
      if (typeof sessInvoice === 'string') {
        try {
          const ev = event as { account?: string };
          const inv = await stripe.invoices.retrieve(
            sessInvoice,
            undefined,
            ev.account ? { stripeAccount: ev.account } : undefined,
          );
          invoiceId = inv.id ?? null;
          invoiceUrl = (inv as { hosted_invoice_url?: string | null }).hosted_invoice_url ?? null;
        } catch (e) {
          console.warn('[thread stripe-webhook] invoice lookup failed', e);
        }
      }

      // Revenue-split record (brief: gross = platform fee + vendor share +
      // org share). Transfers themselves land with the payouts phase — this
      // is the auditable ledger row.
      try {
        const platformFee = await platformFeeCents(te.workspace_id, gross);
        const { data: ws } = await adminClient
          .from('thread_settings')
          .select('default_vendor_cut_percent')
          .eq('workspace_id', te.workspace_id)
          .maybeSingle();
        const vendorPct = Number(ws?.default_vendor_cut_percent ?? 100);
        const net = Math.max(0, gross - platformFee);
        const vendorShare = Math.round((net * vendorPct) / 100);
        const orgShare = net - vendorShare;
        await adminClient.from('thread_payout').upsert(
          {
            workspace_id: te.workspace_id,
            thread_id: te.thread_id,
            thread_enrolment_id: te.id,
            gross_cents: gross,
            platform_fee_cents: platformFee,
            vendor_share_cents: vendorShare,
            org_share_cents: orgShare,
            currency,
            status: orgShare > 0 ? 'pending' : 'not_applicable',
          },
          { onConflict: 'thread_enrolment_id' },
        );
        await recordPurchase({
          appSlug: 'the-thread',
          workspaceId: te.workspace_id,
          itemRef: te.id,
          amountCents: gross,
          currency,
          platformFeeCents: platformFee,
          vendorShareCents: vendorShare,
          orgShareCents: orgShare,
          status: 'paid',
          stripeAccountId: (event as { account?: string }).account ?? null,
          stripePaymentIntent:
            typeof session.payment_intent === 'string' ? session.payment_intent : null,
          stripeInvoiceId: invoiceId,
          stripeInvoiceUrl: invoiceUrl,
        });
      } catch (e) {
        console.warn('[thread stripe-webhook] payout record failed', e);
      }

      await finalizePaidEnrolment(te.id);
      return c.json({ received: true });
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as { id: string };
      const { data: pendingRows } = await adminClient
        .from('thread_enrolment')
        .select('id, workspace_id')
        .eq('stripe_session_id', session.id)
        .eq('payment_status', 'pending');
      for (const row of pendingRows ?? []) {
        // Invoice-method sales use sessions only as OPTIONAL payment links —
        // an expired link never fails the invoice (review finding #4).
        const { data: app } = await adminClient
          .from('app')
          .select('id')
          .eq('slug', 'the-thread')
          .single();
        const { data: pRow } = await adminClient
          .from('purchase')
          .select('method')
          .eq('app_id', app!.id)
          .eq('item_ref', row.id)
          .maybeSingle();
        if (pRow?.method === 'invoice') {
          await adminClient
            .from('thread_enrolment')
            .update({ stripe_session_id: null })
            .eq('id', row.id);
          continue;
        }
        await adminClient
          .from('thread_enrolment')
          .update({ payment_status: 'failed' })
          .eq('id', row.id);
        await recordPurchase({
          appSlug: 'the-thread',
          workspaceId: row.workspace_id,
          itemRef: row.id,
          status: 'failed',
        });
      }
      return c.json({ received: true });
    }
  } catch (e) {
    console.error('[thread stripe-webhook] handler failed', e);
    return c.json({ error: 'handler failed' }, 500);
  }
  return c.json({ received: true });
});

// POST /enrolments/:id/mark-paid — the invoice path: the organiser confirms
// the money arrived; the same confirmation side-effects run as for Stripe.
threadRoutes.post('/enrolments/:id/mark-paid', async (c) => {
  const ctx = c.get('ctx');
  const loaded = await loadEnrolmentForAction(ctx.jwt, c.req.param('id'), {
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
  });
  if (!loaded) return c.json({ error: 'not found' }, 404);
  if (loaded === 'forbidden') {
    return c.json({ error: 'only the thread organiser (or an admin) can do that' }, 403);
  }

  const { data: teRow } = await adminClient
    .from('thread_enrolment')
    .select('id, payment_status, stripe_session_id')
    .eq('id', loaded.te.id)
    .maybeSingle();
  if (!teRow) return c.json({ error: 'not found' }, 404);
  if (teRow.payment_status === 'paid') return c.json({ ok: true, already: true });
  if (teRow.payment_status !== 'pending') {
    return c.json({ error: `a ${teRow.payment_status} payment cannot be marked paid` }, 409);
  }

  // A live checkout session would stay payable after the manual mark —
  // expire it (double-pay guard, review 2026-07-05).
  if (teRow.stripe_session_id) {
    const stripe = stripeOrNull();
    if (stripe) {
      const { data: pur } = await adminClient
        .from('purchase')
        .select('stripe_account_id')
        .eq('item_ref', loaded.te.id)
        .limit(1)
        .maybeSingle();
      const account =
        pur?.stripe_account_id ?? (await chargeAccountForItem('the-thread', loaded.te.id));
      if (account) {
        try {
          await stripe.checkout.sessions.expire(teRow.stripe_session_id, undefined, {
            stripeAccount: account,
          });
        } catch {
          /* already expired or completed */
        }
      }
    }
  }

  const { error: upErr } = await adminClient
    .from('thread_enrolment')
    .update({ payment_status: 'paid' })
    .eq('id', loaded.te.id);
  if (upErr) return c.json({ error: upErr.message }, 500);

  await recordPurchase({
    appSlug: 'the-thread',
    workspaceId: loaded.thread.workspace_id,
    itemRef: loaded.te.id,
    status: 'paid',
  });
  await finalizePaidEnrolment(loaded.te.id);
  return c.json({ ok: true });
});

// Archive / restore — the safe alternative to deleting a template in use.
threadRoutes.post('/certificate-templates/:id/archive', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const archive = ((await c.req.json().catch(() => ({}))) as { archived?: boolean }).archived;
  const { data, error } = await db
    .from('thread_certificate_template')
    .update({ archived_at: archive === false ? null : new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select(CERT_TEMPLATE_SELECT)
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

threadRoutes.delete('/certificate-templates/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const id = c.req.param('id');

  // In use → archive, never delete. "In use" = a thread points at it.
  // (Issued certificates carry full snapshots — they never break — but a
  // referencing thread would lose its selection.)
  const { count: usedByThreads } = await adminClient
    .from('thread_thread')
    .select('id', { count: 'exact', head: true })
    .eq('certificate_template_id', id)
    .eq('workspace_id', ctx.workspaceId);
  if ((usedByThreads ?? 0) > 0) {
    return c.json(
      { error: 'this template is in use by a thread — archive it instead of deleting' },
      409,
    );
  }

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
  const ctx = c.get('ctx');
  // Scope check — this was an unauthenticated-by-workspace adminClient read
  // (review 2026-07-05).
  const { data: tpl } = await adminClient
    .from('thread_certificate_template')
    .select('workspace_id')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!tpl || tpl.workspace_id !== ctx.workspaceId) return c.json({ error: 'not found' }, 404);
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
      `id, thread_id, payment_status, amount_cents, currency, answers, billing, stripe_session_id, created_at,
       person:person_id (id, first_name, last_name, email, phone, city, country, preferred_language),
       enrolment:enrolment_id (id, status, progress_pct, enrolled_at, completed_at),
       certificate:thread_certificate (certificate_number),
       ticket:ticket_id (name, price_cents, price_currency),
       coupon:coupon_id (code),
       thread:thread_id (id, slug, certificate_enabled, program:program_id (title, format, status))`,
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

// Public URLs group by owner: personal threads live under the organiser's
// slug, team threads under the TEAM's slug (Sjoerd 2026-07-02). One root
// namespace, resolved organiser-first (Meet's pattern).
type PublicOwner =
  | { kind: 'organiser'; organiser: { id: string; workspace_id: string; slug: string; display_name: string | null; bio: string | null; photo_url: string | null; timezone: string } }
  | { kind: 'team'; team: { id: string; workspace_id: string; slug: string; name: string; description: string | null } };

async function resolvePublicOwner(slug: string): Promise<PublicOwner | null> {
  const { data: organiser } = await adminClient
    .from('thread_organiser')
    .select(PUBLIC_ORGANISER_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  if (organiser) return { kind: 'organiser', organiser };
  const { data: team } = await adminClient
    .from('team')
    .select('id, workspace_id, slug, name, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (team) return { kind: 'team', team };
  return null;
}

/** The slug a thread's public URL lives under. */
function ownerSlugOf(thread: { team?: unknown }, organiserSlug: string | null): string {
  const team = Array.isArray(thread.team) ? (thread.team as { slug?: string }[])[0] : (thread.team as { slug?: string } | null);
  return team?.slug ?? organiserSlug ?? '';
}

// Public price display: tickets are the source of truth when they exist —
// the lowest active, non-expired ticket wins (Sjoerd 2026-07-02: a thread
// had a €250 ticket yet the public card said Free, because the card read
// the legacy thread.price_cents). Ticket *selection* at enrol lands with
// the payments phase; until then the label is honest and paid enrolment
// stays blocked on the derived price.
async function ticketPrices(
  threadIds: string[],
): Promise<Map<string, { price_cents: number; price_currency: string }>> {
  const map = new Map<string, { price_cents: number; price_currency: string }>();
  if (!threadIds.length) return map;
  const { data } = await adminClient
    .from('thread_ticket')
    .select('thread_id, price_cents, price_currency, available_until')
    .in('thread_id', threadIds)
    .eq('is_active', true);
  const now = Date.now();
  for (const t of data ?? []) {
    if (t.available_until && new Date(t.available_until).getTime() < now) continue;
    const cur = map.get(t.thread_id);
    if (!cur || t.price_cents < cur.price_cents) {
      map.set(t.thread_id, { price_cents: t.price_cents, price_currency: t.price_currency });
    }
  }
  return map;
}

/** Effective public price: cheapest active ticket, else legacy price_cents. */
function effectivePrice(
  t: { id: string; price_cents: number | null; price_currency?: string | null },
  tickets: Map<string, { price_cents: number; price_currency: string }>,
): { price_cents: number | null; price_currency: string | null } {
  const tk = tickets.get(t.id);
  if (tk) return { price_cents: tk.price_cents, price_currency: tk.price_currency };
  return { price_cents: t.price_cents, price_currency: t.price_currency ?? null };
}

// GET /api/v1/thread/public/organiser/:slug — organiser page payload
threadRoutes.get('/public/organiser/:slug', async (c) => {
  const owner = await resolvePublicOwner(c.req.param('slug'));
  if (!owner) return c.json({ error: 'not found' }, 404);

  let q = adminClient
    .from('thread_thread')
    .select(
      `id, slug, intention, cover_url, price_cents, price_currency, capacity,
       public_interaction,
       program:program_id (title, format, status, starts_on, ends_on)`,
    )
    .eq('is_public_listed', true);
  q =
    owner.kind === 'organiser'
      ? q.eq('organiser_id', owner.organiser.id).is('team_id', null)
      : q.eq('team_id', owner.team.id);
  const { data: threads } = await q;

  let listed = (threads ?? []).filter((t) => {
    const p = Array.isArray(t.program) ? t.program[0] : t.program;
    return p && (p.status === 'active' || p.status === 'completed');
  });
  const prices = await ticketPrices(listed.map((t) => t.id));
  listed = listed.map((t) => ({ ...t, ...effectivePrice(t, prices) }));

  const organiser =
    owner.kind === 'organiser'
      ? owner.organiser
      : {
          id: owner.team.id,
          workspace_id: owner.team.workspace_id,
          slug: owner.team.slug,
          display_name: owner.team.name,
          bio: owner.team.description,
          photo_url: null,
          timezone: 'Europe/Amsterdam',
        };
  return c.json({ organiser, threads: listed, owner_kind: owner.kind });
});

// GET /api/v1/thread/public/organiser/:slug/thread/:threadSlug — thread page
threadRoutes.get('/public/organiser/:slug/thread/:threadSlug', async (c) => {
  const owner = await resolvePublicOwner(c.req.param('slug'));
  if (!owner) return c.json({ error: 'not found' }, 404);

  let tq = adminClient
    .from('thread_thread')
    .select(
      `id, slug, intention, timezone, language, cover_url, capacity, requires_approval,
       workspace_id, team_id, payment_destination,
       price_cents, price_currency, payment_methods, registration_fields, certificate_enabled, organiser_id,
       share_participants_public,
       program:program_id (title, format, status, starts_on, ends_on)`,
    )
    .eq('slug', c.req.param('threadSlug'));
  tq =
    owner.kind === 'organiser'
      ? tq.eq('organiser_id', owner.organiser.id).is('team_id', null)
      : tq.eq('team_id', owner.team.id);
  const { data: thread } = await tq.maybeSingle();
  if (!thread) return c.json({ error: 'not found' }, 404);

  const program = Array.isArray(thread.program) ? thread.program[0] : thread.program;
  // Draft/archived threads are not public, even by direct link.
  if (!program || (program.status !== 'active' && program.status !== 'completed')) {
    return c.json({ error: 'not found' }, 404);
  }

  // The public agenda: published activities flagged show_in_agenda.
  const { data: agenda } = await adminClient
    .from('thread_engagement')
    .select('id, title, description, type, starts_at, ends_at, daily_schedule, location, meeting_url')
    .eq('thread_id', thread.id)
    .eq('status', 'published')
    .eq('show_in_agenda', true)
    .in('type', ['event', 'conversation', 'workshop'])
    .order('starts_at', { ascending: true, nullsFirst: false });

  const { count } = await adminClient
    .from('thread_enrolment')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', thread.id);

  // Public participant list — first names only, and ONLY for people who
  // opted into the cohort directory at enrolment (brief §9).
  let participants: string[] = [];
  if ((thread as { share_participants_public?: boolean }).share_participants_public) {
    const { data: enrols } = await adminClient
      .from('thread_enrolment')
      .select('person:person_id (id, first_name, last_name)')
      .eq('thread_id', thread.id)
      .limit(60);
    const personIds = (enrols ?? [])
      .map((e) => (Array.isArray(e.person) ? e.person[0] : e.person)?.id)
      .filter(Boolean) as string[];
    if (personIds.length) {
      const { data: consents } = await adminClient
        .from('consent_record')
        .select('person_id')
        .eq('purpose_code', 'cohort_directory')
        .is('revoked_at', null)
        .in('person_id', personIds);
      const consented = new Set((consents ?? []).map((c) => c.person_id));
      participants = (enrols ?? [])
        .map((e) => (Array.isArray(e.person) ? e.person[0] : e.person))
        .filter((p) => p && consented.has(p.id))
        .map((p) => `${p!.first_name ?? ''} ${(p!.last_name ?? '').slice(0, 1)}`.trim())
        .filter(Boolean);
    }
  }

  const organiser =
    owner.kind === 'organiser'
      ? owner.organiser
      : {
          id: owner.team.id,
          workspace_id: owner.team.workspace_id,
          slug: owner.team.slug,
          display_name: owner.team.name,
          bio: owner.team.description,
          photo_url: null,
          timezone: 'Europe/Amsterdam',
        };

  const prices = await ticketPrices([thread.id]);

  // Ticket list for the enrol form — active, non-expired, with sold-out
  // flags so the form can grey them out (multiple prices → ticket chooser).
  const { data: ticketRows } = await adminClient
    .from('thread_ticket')
    .select(
      'id, name, description, price_cents, price_currency, quantity_limit, available_until, payment_methods',
    )
    .eq('thread_id', thread.id)
    .eq('is_active', true)
    .order('position');
  const { data: pubOrg } = await adminClient
    .from('thread_organiser')
    .select('user_id')
    .eq('id', thread.organiser_id)
    .maybeSingle();
  const pubThread = thread as {
    workspace_id: string;
    team_id?: string | null;
    payment_destination?: string | null;
    payment_methods?: string[] | null;
  };
  let threadMethods = await resolvePaymentMethods({
    threadMethods: pubThread.payment_methods ?? null,
    organiserUserId: pubOrg?.user_id ?? null,
    workspaceId: pubThread.workspace_id,
    workspaceRoot: !!pubThread.team_id || pubThread.payment_destination !== 'personal',
  });
  // Never offer card when it cannot work: platform key missing or no
  // connected account for this thread's payout destination.
  if (threadMethods.includes('stripe')) {
    const stripeReady =
      !!stripeOrNull() &&
      !!(await threadDestinationAccount({
        workspace_id: pubThread.workspace_id,
        team_id: pubThread.team_id ?? null,
        payment_destination: pubThread.payment_destination,
        organiser_user_id: pubOrg?.user_id ?? null,
      }));
    if (!stripeReady) {
      const filtered = threadMethods.filter((m) => m !== 'stripe');
      if (filtered.length) threadMethods = filtered;
    }
  }
  const nowMs = Date.now();
  const openTix = (ticketRows ?? []).filter(
    (t) => !t.available_until || new Date(t.available_until).getTime() >= nowMs,
  );
  const soldPerTicket = new Map<string, number>();
  if (openTix.some((t) => t.quantity_limit)) {
    const { data: enrTix } = await adminClient
      .from('thread_enrolment')
      .select('ticket_id')
      .eq('thread_id', thread.id)
      .not('ticket_id', 'is', null);
    for (const e of enrTix ?? []) {
      if (e.ticket_id) soldPerTicket.set(e.ticket_id, (soldPerTicket.get(e.ticket_id) ?? 0) + 1);
    }
  }
  const tickets = openTix.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    price_cents: t.price_cents,
    price_currency: t.price_currency,
    // Inheritance resolved server-side: ticket ?? thread(+account default).
    // Tickets can't resurrect card if the thread-level filter dropped it.
    payment_methods: ((t as { payment_methods?: string[] | null }).payment_methods?.length
      ? (t as { payment_methods: string[] }).payment_methods.filter(
          (m) => m !== 'stripe' || threadMethods.includes('stripe'),
        )
      : threadMethods),
    sold_out: !!t.quantity_limit && (soldPerTicket.get(t.id) ?? 0) >= t.quantity_limit,
  }));

  return c.json({
    organiser,
    thread: {
      ...thread,
      ...effectivePrice(thread, prices),
      payment_methods: threadMethods,
      tickets,
      agenda: (agenda ?? []).map(({ meeting_url, ...rest }) => ({
        ...rest,
        is_online: !!meeting_url,
      })),
      enrolled_count: count ?? 0,
      enrolment_open: program.status === 'active',
      participants,
    },
  });
});


// GET /api/v1/thread/public/embed/threads — listing for website embeds
// (Webflow etc.). Filter by ?organiser=<slug> | ?team=<uuid> | ?org=<uuid>.
threadRoutes.get('/public/embed/threads', async (c) => {
  const organiserSlug = c.req.query('organiser');
  const teamId = c.req.query('team');
  const orgId = c.req.query('org');
  const workspaceId = c.req.query('workspace');
  if (!organiserSlug && !teamId && !orgId && !workspaceId) {
    return c.json({ error: 'pass organiser, team, org or workspace' }, 400);
  }

  let q = adminClient
    .from('thread_thread')
    .select(
      `id, slug, intention, cover_url, price_cents, price_currency, language, public_interaction,
       organiser:organiser_id (slug, display_name),
       team:team_id (slug, name),
       organisation:organisation_id (id, name),
       program:program_id (title, format, status, starts_on, ends_on)`,
    )
    .eq('is_public_listed', true);
  if (teamId) q = q.eq('team_id', teamId);
  if (orgId) q = q.eq('organisation_id', orgId);
  // Whole workspace: every public thread, personal and team alike.
  if (workspaceId) q = q.eq('workspace_id', workspaceId);
  if (organiserSlug) {
    const { data: org } = await adminClient
      .from('thread_organiser')
      .select('id')
      .eq('slug', organiserSlug)
      .maybeSingle();
    if (!org) return c.json({ items: [] });
    q = q.eq('organiser_id', org.id);
  }

  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);
  const live = (data ?? []).filter((t) => {
    const p = Array.isArray(t.program) ? t.program[0] : t.program;
    return p && (p.status === 'active' || p.status === 'completed');
  });
  const prices = await ticketPrices(live.map((t) => t.id));
  const items = live
    .map((t) => ({ ...t, ...effectivePrice(t, prices) }))
    .map((t) => {
      const p = Array.isArray(t.program) ? t.program[0] : t.program;
      const o = Array.isArray(t.organiser) ? t.organiser[0] : t.organiser;
      const tm = Array.isArray(t.team) ? t.team[0] : t.team;
      // Team threads resolve under the team's slug, personal ones under the organiser's.
      const ownerSlug = tm?.slug ?? o?.slug;
      return {
        id: t.id,
        slug: t.slug,
        organiser_slug: ownerSlug ?? null,
        organiser_name: tm?.name ?? o?.display_name ?? null,
        title: p?.title ?? t.slug,
        format: p?.format ?? 'event',
        status: p?.status ?? 'active',
        starts_on: p?.starts_on ?? null,
        ends_on: p?.ends_on ?? null,
        intention: t.intention,
        cover_url: t.cover_url,
        price_cents: t.price_cents,
        price_currency: t.price_currency,
        language: (t as { language?: string }).language ?? 'en',
        public_interaction: (t as { public_interaction?: string }).public_interaction ?? 'page',
        url: `${threadAppUrl()}/${ownerSlug}/${t.slug}`,
      };
    })
    .sort((a, b) => (a.starts_on ?? '9999').localeCompare(b.starts_on ?? '9999'));
  return c.json({ items });
});

// GET /api/v1/thread/public/my-enrolments — the signed-in participant's
// personal page payload. Bearer = their Supabase session token (verified
// here without workspace claims). Persons are matched by email across
// workspaces — one person per workspace that knows them.
threadRoutes.get('/public/my-enrolments', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);

  const { data: persons } = await adminClient
    .from('person')
    .select('id, first_name, last_name, email')
    .eq('email', email.toLowerCase())
    .is('deleted_at', null);
  if (!persons?.length) {
    return c.json({ person: { first_name: null, last_name: null, email }, items: [] });
  }

  const { data: enrolments } = await adminClient
    .from('thread_enrolment')
    .select(
      `id, created_at,
       enrolment:enrolment_id (status, progress_pct),
       thread:thread_id (id, slug, intention, language, cover_url, share_participants_participants,
         organiser:organiser_id (slug, display_name),
         team:team_id (slug, name),
         program:program_id (title, format, status, starts_on, ends_on))`,
    )
    .in('person_id', persons.map((p) => p.id))
    .order('created_at', { ascending: false });

  // Cohort directory (share_participants_participants): fellow participants,
  // first name + initial, ONLY those who opted into cohort_directory —
  // the same consent gate as the public Who's-coming list.
  const cohortThreadIds = [
    ...new Set(
      (enrolments ?? [])
        .map((e) => {
          const t = Array.isArray(e.thread) ? e.thread[0] : e.thread;
          return t && (t as { share_participants_participants?: boolean }).share_participants_participants
            ? (t as { id: string }).id
            : null;
        })
        .filter(Boolean) as string[],
    ),
  ];
  const cohorts = new Map<string, string[]>();
  if (cohortThreadIds.length) {
    const { data: fellow } = await adminClient
      .from('thread_enrolment')
      .select('thread_id, person:person_id (id, first_name, last_name)')
      .in('thread_id', cohortThreadIds)
      .limit(400);
    const fellowIds = (fellow ?? [])
      .map((f) => (Array.isArray(f.person) ? f.person[0] : f.person)?.id)
      .filter(Boolean) as string[];
    if (fellowIds.length) {
      const { data: consents } = await adminClient
        .from('consent_record')
        .select('person_id')
        .eq('purpose_code', 'cohort_directory')
        .is('revoked_at', null)
        .in('person_id', fellowIds);
      const consented = new Set((consents ?? []).map((r) => r.person_id));
      for (const f of fellow ?? []) {
        const p = Array.isArray(f.person) ? f.person[0] : f.person;
        if (!p || !consented.has(p.id)) continue;
        const label = `${p.first_name ?? ''} ${(p.last_name ?? '').slice(0, 1)}`.trim();
        if (!label) continue;
        if (!cohorts.has(f.thread_id)) cohorts.set(f.thread_id, []);
        cohorts.get(f.thread_id)!.push(label);
      }
    }
  }

  const items = (enrolments ?? [])
    .map((e) => {
      const t = Array.isArray(e.thread) ? e.thread[0] : e.thread;
      if (!t) return null;
      const prog = Array.isArray(t.program) ? t.program[0] : t.program;
      const org = Array.isArray(t.organiser) ? t.organiser[0] : t.organiser;
      const enr = Array.isArray(e.enrolment) ? e.enrolment[0] : e.enrolment;
      return {
        thread_id: t.id,
        title: prog?.title ?? t.slug,
        format: prog?.format ?? 'event',
        thread_status: prog?.status ?? 'active',
        starts_on: prog?.starts_on ?? null,
        ends_on: prog?.ends_on ?? null,
        intention: t.intention,
        cover_url: t.cover_url,
        language: (t as { language?: string }).language ?? 'en',
        enrolment_status: enr?.status ?? 'enrolled',
        url: `${threadAppUrl()}/${ownerSlugOf(t, org?.slug ?? null)}/${t.slug}`,
        enrolled_at: e.created_at,
        cohort: cohorts.get(t.id) ?? [],
      };
    })
    .filter(Boolean);

  // The participant's own activity trail (type + subject — exactly what
  // crosses the data wall, shown back to the person it's about).
  const { data: activityRows } = await adminClient
    .from('activity')
    .select('type, subject, occurred_at, app:app_id (name)')
    .in('person_id', persons.map((p) => p.id))
    .order('occurred_at', { ascending: false })
    .limit(20);
  const activity = (activityRows ?? []).map((a) => {
    const app = Array.isArray(a.app) ? a.app[0] : a.app;
    return {
      type: a.type,
      subject: a.subject,
      occurred_at: a.occurred_at,
      app: app?.name ?? null,
    };
  });

  const first = persons[0]!;
  return c.json({
    person: { first_name: first.first_name, last_name: first.last_name, email },
    items,
    activity,
  });
});

// ---------------------------------------------------------------------------
// Public coupon validation — shared by the enrol form's "Apply" and the
// enrol POST itself (never trust the client's price).
// ---------------------------------------------------------------------------

type CouponCheck = {
  id: string;
  code: string;
  type: 'percentage' | 'amount' | 'free';
  discount_percentage: number | null;
  discount_amount_cents: number | null;
  usage_limit: number | null;
  used_count: number;
  expires_at: string | null;
  is_early_bird: boolean;
  early_bird_deadline: string | null;
  ticket_id: string | null;
};

function couponPrice(coupon: CouponCheck, baseCents: number): number {
  if (coupon.type === 'free') return 0;
  if (coupon.type === 'percentage') {
    return Math.max(0, Math.round(baseCents * (1 - (coupon.discount_percentage ?? 0) / 100)));
  }
  return Math.max(0, baseCents - (coupon.discount_amount_cents ?? 0));
}

async function findValidCoupon(
  threadId: string,
  code: string,
  ticketId: string | null,
): Promise<{ coupon: CouponCheck } | { error: string }> {
  // unique(thread_id, code); ilike without wildcards = case-insensitive match.
  const { data: coupon } = await adminClient
    .from('thread_coupon')
    .select(
      'id, code, type, discount_percentage, discount_amount_cents, usage_limit, used_count, expires_at, is_early_bird, early_bird_deadline, ticket_id',
    )
    .eq('thread_id', threadId)
    .ilike('code', code.trim())
    .eq('is_active', true)
    .maybeSingle();
  if (!coupon) return { error: 'this code is not valid' };
  const nowMs = Date.now();
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < nowMs) {
    return { error: 'this code has expired' };
  }
  if (
    coupon.is_early_bird &&
    coupon.early_bird_deadline &&
    new Date(coupon.early_bird_deadline).getTime() < nowMs
  ) {
    return { error: 'the early-bird period for this code is over' };
  }
  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    return { error: 'this code has been fully used' };
  }
  if (coupon.ticket_id && coupon.ticket_id !== ticketId) {
    return { error: 'this code applies to a different ticket' };
  }
  return { coupon: coupon as CouponCheck };
}

// POST /api/v1/thread/public/validate-coupon — live check for the enrol form.
const ValidateCoupon = z.object({
  organiser_slug: z.string().min(1),
  thread_slug: z.string().min(1),
  code: z.string().min(1).max(60),
  ticket_id: z.string().uuid().optional(),
});

threadRoutes.post('/public/validate-coupon', async (c) => {
  const body = ValidateCoupon.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const d = body.data;

  const owner = await resolvePublicOwner(d.organiser_slug);
  if (!owner) return c.json({ valid: false, reason: 'thread not found' });
  let tq = adminClient
    .from('thread_thread')
    .select('id, price_cents, price_currency')
    .eq('slug', d.thread_slug);
  tq =
    owner.kind === 'organiser'
      ? tq.eq('organiser_id', owner.organiser.id).is('team_id', null)
      : tq.eq('team_id', owner.team.id);
  const { data: thread } = await tq.maybeSingle();
  if (!thread) return c.json({ valid: false, reason: 'thread not found' });

  // Base price: the chosen ticket's, else the thread's effective price.
  let base = thread.price_cents ?? 0;
  let currency = thread.price_currency ?? 'EUR';
  if (d.ticket_id) {
    const { data: ticket } = await adminClient
      .from('thread_ticket')
      .select('price_cents, price_currency')
      .eq('id', d.ticket_id)
      .eq('thread_id', thread.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!ticket) return c.json({ valid: false, reason: 'this ticket is not available' });
    base = ticket.price_cents;
    currency = ticket.price_currency;
  } else {
    const prices = await ticketPrices([thread.id]);
    const eff = effectivePrice(thread, prices);
    base = eff.price_cents ?? 0;
    currency = eff.price_currency ?? currency;
  }

  const r = await findValidCoupon(thread.id, d.code, d.ticket_id ?? null);
  if ('error' in r) return c.json({ valid: false, reason: r.error });
  return c.json({
    valid: true,
    code: r.coupon.code,
    price_cents: couponPrice(r.coupon, base),
    price_currency: currency,
  });
});

// POST /api/v1/thread/public/enrol — free enrolment (paid flow lands Phase 4)
const PublicEnrol = z.object({
  organiser_slug: z.string().min(1),
  thread_slug: z.string().min(1),
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  answers: z.record(z.unknown()).optional(),
  ticket_id: z.string().uuid().optional(),
  coupon_code: z.string().min(1).max(60).optional(),
  payment_method: z.enum(['stripe', 'invoice']).optional(),
  billing: z
    .object({
      company: z.string().max(200).optional(),
      address: z.string().max(500).optional(),
      postal_code: z.string().max(30).optional(),
      city: z.string().max(120).optional(),
      country: z.string().max(120).optional(),
      tax_no: z.string().max(60).optional(),
    })
    .optional(),
  marketing_opt_in: z.boolean().optional(),
  cohort_opt_in: z.boolean().optional(),
  policy_accepted: z.boolean().optional(),
  policy_version: z.string().max(200).optional(),
  request_id: z.string().min(8).max(80),
});

threadRoutes.post('/public/enrol', async (c) => {
  const body = PublicEnrol.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const d = body.data;

  // Privacy-policy agreement is required to enrol (Sjoerd 2026-07-02).
  if (!d.policy_accepted) {
    return c.json({ error: 'privacy policy agreement is required' }, 400);
  }

  // Idempotency first: same request_id → same result.
  const { data: existing } = await adminClient
    .from('thread_enrolment')
    .select('id, enrolment_id')
    .eq('request_id', d.request_id)
    .maybeSingle();
  if (existing) return c.json({ ok: true, enrolment_id: existing.id, idempotent: true });

  // Resolve owner (organiser or team slug) → thread → program.
  const owner = await resolvePublicOwner(d.organiser_slug);
  if (!owner) return c.json({ error: 'thread not found' }, 404);

  let eq = adminClient
    .from('thread_thread')
    .select(
      'id, workspace_id, program_id, organiser_id, slug, intention, language, capacity, price_cents, price_currency, requires_approval, payment_destination, payment_methods, team_id, program:program_id (title, status, starts_on)',
    )
    .eq('slug', d.thread_slug);
  eq =
    owner.kind === 'organiser'
      ? eq.eq('organiser_id', owner.organiser.id).is('team_id', null)
      : eq.eq('team_id', owner.team.id);
  const { data: thread } = await eq.maybeSingle();
  if (!thread) return c.json({ error: 'thread not found' }, 404);

  // Display name for emails: the team for team threads, else the organiser.
  const { data: primaryOrganiser } = await adminClient
    .from('thread_organiser')
    .select('slug, display_name')
    .eq('id', thread.organiser_id)
    .maybeSingle();
  const organiser = {
    slug: d.organiser_slug,
    display_name:
      owner.kind === 'team' ? owner.team.name : primaryOrganiser?.display_name ?? null,
  };

  const program = Array.isArray(thread.program) ? thread.program[0] : thread.program;
  if (!program || program.status !== 'active') {
    return c.json({ error: 'enrolment is closed for this thread' }, 409);
  }
  // Resolve the ticket. Explicit ticket_id wins; without one (older embeds)
  // fall back to the cheapest open ticket. Paid enrolment lands with the
  // Stripe phase — only free tickets pass for now.
  let ticketId: string | null = null;
  const { data: activeTickets } = await adminClient
    .from('thread_ticket')
    .select('id, name, price_cents, price_currency, quantity_limit, available_until, payment_methods')
    .eq('thread_id', thread.id)
    .eq('is_active', true)
    .order('position');
  const nowMs = Date.now();
  const openTickets = (activeTickets ?? []).filter(
    (t) => !t.available_until || new Date(t.available_until).getTime() >= nowMs,
  );
  let basePriceCents = 0;
  let priceCurrency: string = (thread as { price_currency?: string | null }).price_currency ?? 'EUR';
  if (d.ticket_id) {
    const chosen = openTickets.find((t) => t.id === d.ticket_id);
    if (!chosen) return c.json({ error: 'this ticket is not available' }, 409);
    if (chosen.quantity_limit) {
      const { count: soldCount } = await adminClient
        .from('thread_enrolment')
        .select('id', { count: 'exact', head: true })
        .eq('ticket_id', chosen.id)
        .neq('payment_status', 'failed');
      if ((soldCount ?? 0) >= chosen.quantity_limit) {
        return c.json({ error: 'this ticket is sold out' }, 409);
      }
    }
    ticketId = chosen.id;
    basePriceCents = chosen.price_cents;
    priceCurrency = (chosen as { price_currency?: string }).price_currency ?? priceCurrency;
  } else if (openTickets.length) {
    const cheapest = [...openTickets].sort((a, b) => a.price_cents - b.price_cents)[0]!;
    // Same sold-out enforcement as the explicit-ticket path (finding #11).
    if (cheapest.quantity_limit) {
      const { count: soldCount } = await adminClient
        .from('thread_enrolment')
        .select('id', { count: 'exact', head: true })
        .eq('ticket_id', cheapest.id)
        .neq('payment_status', 'failed');
      if ((soldCount ?? 0) >= cheapest.quantity_limit) {
        return c.json({ error: 'this ticket is sold out' }, 409);
      }
    }
    ticketId = cheapest.id;
    basePriceCents = cheapest.price_cents;
    priceCurrency = (cheapest as { price_currency?: string }).price_currency ?? priceCurrency;
  } else {
    basePriceCents = thread.price_cents ?? 0;
  }

  // Discount code — validated server-side, never trusting the form's price.
  let coupon: CouponCheck | null = null;
  if (d.coupon_code) {
    const r = await findValidCoupon(thread.id, d.coupon_code, ticketId);
    if ('error' in r) return c.json({ error: r.error }, 409);
    coupon = r.coupon;
  }
  const finalPriceCents = coupon ? couponPrice(coupon, basePriceCents) : basePriceCents;
  const requiresPayment = finalPriceCents > 0;
  // Inheritance: ticket ?? thread ?? organiser's account default ?? {stripe}.
  const { data: enrolOrg } = await adminClient
    .from('thread_organiser')
    .select('user_id')
    .eq('id', thread.organiser_id)
    .maybeSingle();
  const chosenForMethods = openTickets.find((t) => t.id === ticketId) as
    | { payment_methods?: string[] | null }
    | undefined;
  const paymentMethods = await resolvePaymentMethods({
    ticketMethods: chosenForMethods?.payment_methods ?? null,
    threadMethods: thread.payment_methods as string[] | null,
    organiserUserId: enrolOrg?.user_id ?? null,
    workspaceId: thread.workspace_id,
    workspaceRoot: !!thread.team_id || thread.payment_destination !== 'personal',
  });
  const paymentMethod = d.payment_method ?? 'stripe';
  if (requiresPayment && !paymentMethods.includes(paymentMethod)) {
    return c.json({ error: 'this payment method is not available for this thread' }, 409);
  }

  // Capacity check.
  if (thread.capacity) {
    const { count } = await adminClient
      .from('thread_enrolment')
      .select('id', { count: 'exact', head: true })
      .eq('thread_id', thread.id)
      .neq('payment_status', 'failed');
    if ((count ?? 0) >= thread.capacity) {
      return c.json({ error: 'this thread is full' }, 409);
    }
  }

  // Create-or-match the platform person (identity is platform-owned).
  const email = d.email.trim().toLowerCase();

  // One Fibre account covers everything (Thread, Meet, …). Existing account
  // → the form says "sign in"; none → "create your account" (created on
  // first sign-in with this email — no separate signup step).
  let { data: hasAccount } = await adminClient.rpc('auth_user_exists', { p_email: email });
  if (hasAccount !== true) {
    try {
      const { error: createErr } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (!createErr) hasAccount = true;
    } catch (e) {
      console.warn('[thread/public/enrol] account auto-create failed', e);
    }
  }
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

  // A prior enrolment with an unpaid checkout gets its companion row reused
  // (set in the duplicate branch below) instead of a new insert.
  let reusedEnrolment: { id: string } | null = null;

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
      .select('id, payment_status')
      .eq('enrolment_id', platEnrolment.id)
      .maybeSingle();
    if (dup && (dup.payment_status === 'pending' || dup.payment_status === 'failed') && requiresPayment) {
      // Outstanding payment (bailed checkout, expired session): reuse the
      // row and run the payment branch again — never a dead end (finding #9).
      reusedEnrolment = { id: dup.id };
    } else if (dup) {
      return c.json({
        ok: true,
        enrolment_id: dup.id,
        already_enrolled: true,
        has_account: hasAccount === true,
      });
    }
    enrolmentId = platEnrolment.id;
  } else {
    const { data: enr, error: eErr } = await adminClient
      .from('enrolment')
      .insert({
        program_id: thread.program_id,
        person_id: person.id,
        // Approval-required and paid threads park the enrolment at
        // 'invited' until approval / payment completes.
        status: thread.requires_approval || requiresPayment ? 'invited' : 'enrolled',
        enrolled_at:
          thread.requires_approval || requiresPayment ? null : new Date().toISOString(),
      })
      .select('id')
      .single();
    if (eErr || !enr) {
      console.error('[thread/public/enrol] enrolment insert failed', eErr);
      return c.json({ error: 'could not enrol you — try again' }, 500);
    }
    enrolmentId = enr.id;
  }

  const { data: threadEnrolment, error: teErr } = reusedEnrolment
    ? { data: reusedEnrolment as { id: string }, error: null }
    : await adminClient
    .from('thread_enrolment')
    .insert({
      workspace_id: thread.workspace_id,
      thread_id: thread.id,
      enrolment_id: enrolmentId,
      person_id: person.id,
      ticket_id: ticketId,
      coupon_id: coupon?.id ?? null,
      amount_cents: requiresPayment || coupon ? finalPriceCents : null,
      currency: requiresPayment ? priceCurrency : null,
      payment_status: requiresPayment ? 'pending' : 'not_required',
      billing: paymentMethod === 'invoice' && d.billing ? d.billing : null,
      answers: d.answers ?? null,
      request_id: d.request_id,
      policy_version: d.policy_version ?? null,
      policy_accepted_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (teErr || !threadEnrolment) {
    console.error('[thread/public/enrol] thread_enrolment insert failed', teErr);
    return c.json({ error: 'could not enrol you — try again' }, 500);
  }
  if (reusedEnrolment) {
    // The retry may carry a different ticket/coupon/billing choice.
    await adminClient
      .from('thread_enrolment')
      .update({
        ticket_id: ticketId,
        coupon_id: coupon?.id ?? null,
        amount_cents: requiresPayment || coupon ? finalPriceCents : null,
        currency: requiresPayment ? priceCurrency : null,
        payment_status: requiresPayment ? 'pending' : 'not_required',
        billing: paymentMethod === 'invoice' && d.billing ? d.billing : null,
      })
      .eq('id', threadEnrolment.id);
  }

  // Coupon redemption bookkeeping — after the enrolment is committed.
  // (Not on reuse — the first attempt already counted it.)
  if (coupon && !reusedEnrolment) {
    await adminClient
      .from('thread_coupon')
      .update({ used_count: coupon.used_count + 1 })
      .eq('id', coupon.id);
  }

  // €0-via-discount-code IS a purchase (Sjoerd 2026-07-04): method 'free',
  // amount 0, settled — the code shows in the item label.
  if (coupon && !requiresPayment) {
    const { data: freeOrg } = await adminClient
      .from('thread_organiser')
      .select('user_id')
      .eq('id', thread.organiser_id)
      .maybeSingle();
    const freeTicket = openTickets.find((t) => t.id === ticketId) as
      | { name?: string }
      | undefined;
    await recordPurchase({
      appSlug: 'the-thread',
      workspaceId: thread.workspace_id,
      itemRef: threadEnrolment.id,
      personId: person.id,
      payerName: d.name.trim(),
      payerEmail: email,
      itemLabel: `${program.title}${freeTicket?.name ? ` · ${freeTicket.name}` : ''} · ${coupon.code}`,
      organiserUserId: freeOrg?.user_id ?? null,
      teamId: (thread as { team_id?: string | null }).team_id ?? null,
      amountCents: 0,
      currency: priceCurrency,
      method: 'free' as never,
      status: 'paid',
    });
  }

  // Consent records (brief §9): transactional is contract-based; marketing
  // only on explicit opt-in.
  const consents: { purpose_code: string; legal_basis: string }[] = [
    { purpose_code: 'transactional_email', legal_basis: 'contract' },
  ];
  if (d.marketing_opt_in) {
    consents.push({ purpose_code: 'marketing_email', legal_basis: 'consent' });
  }
  if (d.cohort_opt_in) {
    consents.push({ purpose_code: 'cohort_directory', legal_basis: 'consent' });
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
      subject: `${thread.requires_approval ? 'Requested' : 'Registered'}: ${program.title}`.slice(0, 200),
      occurred_at: new Date().toISOString(),
    });
  }

  // Rollback for failed checkout starts: drop the companion row AND release
  // the coupon use it consumed (review finding #8).
  async function rollbackPendingEnrolment() {
    if (!reusedEnrolment) {
      await adminClient.from('thread_enrolment').delete().eq('id', threadEnrolment!.id);
    }
    if (coupon && !reusedEnrolment) {
      await adminClient
        .from('thread_coupon')
        .update({ used_count: Math.max(0, coupon.used_count) })
        .eq('id', coupon.id)
        .gt('used_count', 0);
      // (used_count was coupon.used_count + 1 after the increment; setting it
      // back to the pre-increment value releases this use without going
      // negative under concurrency.)
    }
  }

  // Ledger row for the Invoices area — one per money event (proposal §2.1).
  async function recordThreadPurchase(status: 'pending' | 'paid', stripeAccountId?: string | null) {
    if (!thread || !threadEnrolment || !person || !program) return;
    const chosenTicket = openTickets.find((t) => t.id === ticketId) as
      | { name?: string }
      | undefined;
    const { data: torg } = await adminClient
      .from('thread_organiser')
      .select('user_id')
      .eq('id', thread.organiser_id)
      .maybeSingle();
    await recordPurchase({
      appSlug: 'the-thread',
      workspaceId: thread.workspace_id,
      itemRef: threadEnrolment.id,
      personId: person.id,
      payerName: d.name.trim(),
      payerEmail: email,
      itemLabel: `${program.title}${chosenTicket?.name ? ` · ${chosenTicket.name}` : ''}`,
      organiserUserId: torg?.user_id ?? null,
      teamId: (thread as { team_id?: string | null }).team_id ?? null,
      amountCents: finalPriceCents,
      currency: priceCurrency,
      method: paymentMethod as 'stripe' | 'invoice',
      status,
      billing: paymentMethod === 'invoice' && d.billing ? d.billing : null,
      stripeAccountId: stripeAccountId ?? null,
    });
  }

  // Payment outstanding: no emails yet — the webhook (Stripe) or the
  // organiser's mark-paid (invoice) runs the confirmation side-effects.
  if (requiresPayment && paymentMethod === 'invoice') {
    await recordThreadPurchase('pending');
    return c.json(
      {
        ok: true,
        enrolment_id: threadEnrolment.id,
        invoice_pending: true,
        has_account: hasAccount === true,
      },
      201,
    );
  }
  if (requiresPayment) {
    const stripe = stripeOrNull();
    if (!stripe) {
      await rollbackPendingEnrolment();
      return c.json({ error: 'payments are not configured yet' }, 503);
    }
    // Destination account per the payout rule: personal → the organiser's
    // connected account (Meet's as fallback — one Stripe per person across
    // Fibre); workspace → thread_settings.
    // SPoT + team payout routing (lib/payment-accounts).
    const destAccount = await threadDestinationAccount({
      workspace_id: thread.workspace_id,
      team_id: (thread as { team_id?: string | null }).team_id ?? null,
      payment_destination: thread.payment_destination,
      organiser_user_id: enrolOrg?.user_id ?? null,
    });
    if (!destAccount) {
      await rollbackPendingEnrolment();
      return c.json({ error: 'the organiser has not connected payments yet' }, 409);
    }

    // Platform fee — same plan-aware rule as Meet, via lib/fees.
    const applicationFeeCents = await platformFeeCents(thread.workspace_id, finalPriceCents);

    const publicBase = `${threadAppUrl()}/${d.organiser_slug}/${thread.slug}`;
    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: priceCurrency.toLowerCase(),
                unit_amount: finalPriceCents,
                product_data: { name: program.title },
              },
              quantity: 1,
            },
          ],
          payment_intent_data: {
            application_fee_amount: applicationFeeCents,
            metadata: { thread_enrolment_id: threadEnrolment.id, thread_slug: thread.slug },
          },
          customer_email: email,
          metadata: { thread_enrolment_id: threadEnrolment.id, thread_slug: thread.slug },
          // Auto-generated legal invoice on the connected account (EU VAT) —
          // same choice as Fibre Meet.
          invoice_creation: {
            enabled: true,
            invoice_data: {
              description: `${program.title} — enrolment via The Thread`,
              footer: 'Issued automatically by The Thread on behalf of the organiser.',
            },
          },
          billing_address_collection: 'required',
          success_url: `${publicBase}?paid=success`,
          cancel_url: `${publicBase}?paid=cancelled`,
        },
        { stripeAccount: destAccount },
      );
      await adminClient
        .from('thread_enrolment')
        .update({ stripe_session_id: session.id })
        .eq('id', threadEnrolment.id);
      await recordThreadPurchase('pending', destAccount);
      return c.json(
        {
          ok: true,
          enrolment_id: threadEnrolment.id,
          payment_required: true,
          checkout_url: session.url,
          has_account: hasAccount === true,
        },
        201,
      );
    } catch (e) {
      console.error('[thread/enrol] checkout session failed', e);
      // Roll the companion row back so a stale pending doesn't block retries;
      // the platform enrolment stays and is reused on the next attempt.
      await rollbackPendingEnrolment();
      return c.json({ error: 'could not start the payment — try again' }, 502);
    }
  }

  // Approval-required: a "request received" email; the confirmation +
  // on-enrolment messages follow at approval. Non-fatal either way.
  if (thread.requires_approval) {
    try {
      const msg = enrolmentPending({
        participantName: d.name.trim(),
        threadTitle: program.title,
        organiserName: organiser.display_name ?? '',
        locale: (thread as { language?: string }).language ?? 'en',
      });
      await sendEmail({ to: email, ...msg });
    } catch (e) {
      console.warn('[thread/public/enrol] pending email failed', e);
    }
    return c.json(
      {
        ok: true,
        enrolment_id: threadEnrolment.id,
        pending_approval: true,
        has_account: hasAccount === true,
      },
      201,
    );
  }

  // Confirmation email — non-fatal.
  try {
    const msg = enrolmentConfirmation({
      participantName: d.name.trim(),
      threadTitle: program.title,
      intention: thread.intention,
      organiserName: organiser.display_name ?? '',
      startsOn: program.starts_on,
      threadUrl: `${threadAppUrl()}/my`,
      locale: (thread as { language?: string }).language ?? 'en',
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

  return c.json(
    { ok: true, enrolment_id: threadEnrolment.id, has_account: hasAccount === true },
    201,
  );
});

// ---------------------------------------------------------------------------
// Triggered message delivery — called by enrol (on_enrolment), approval,
// completion, manual add and the 5-minute scheduler.
// ---------------------------------------------------------------------------

/** Rich-text fields store HTML; plain-text email parts need it stripped. */
function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderMessageBody(
  type: string,
  content: Record<string, unknown>,
  description: string | null,
): string {
  const str = (k: string) =>
    typeof content[k] === 'string' ? stripHtml(content[k] as string) : '';
  const list = (k: string, prefix: string) =>
    Array.isArray(content[k])
      ? (content[k] as string[]).map((x, i) => `${prefix}${i + 1}. ${x}`).join('\n')
      : '';
  const parts: string[] = [];
  if (description) parts.push(stripHtml(description));
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

// ---------------------------------------------------------------------------
// Message scheduler — Phase 6. Sends FIXED and RELATIVE messages when their
// moment arrives (on_enrolment/approval/completion fire from their own flows
// above). Runs on an interval from server.ts; every send is dedup-logged in
// thread_message_send, so overlapping runs and retries are safe.
// ---------------------------------------------------------------------------

/** Interpret `${date}T${time}` as wall time in a timezone → UTC instant. */
function wallTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  try {
    // DST-safe shared implementation (lib/availability/timezone) — replaces
    // a drifted sv-SE-locale copy that skipped the DST re-check.
    return zonedTimeToUtc(y ?? 1970, mo ?? 1, d ?? 1, h ?? 0, mi ?? 0, timeZone);
  } catch {
    return new Date(`${dateStr}T${timeStr}:00Z`); // unknown timezone → UTC
  }
}

// Only send messages that came due recently — a scheduler (re)starting on a
// long-existing thread must not blast months-old messages. Anything older
// stays unsent (visible on the timeline, never emailed late).
const SCHEDULER_LOOKBACK_MS = 72 * 60 * 60 * 1000;

export async function runThreadMessageScheduler(): Promise<{ due: number; sent: number }> {
  const now = Date.now();

  const { data: candidates, error } = await adminClient
    .from('thread_engagement')
    .select(
      `id, thread_id, title, type, description, content, status,
       trigger_kind, trigger_anchor, trigger_engagement_id, trigger_offset_days, trigger_time, scheduled_at,
       thread:thread_id (id, timezone,
         organiser:organiser_id (display_name),
         team:team_id (name),
         program:program_id (title, status, starts_on, ends_on))`,
    )
    .eq('status', 'published')
    .in('type', MESSAGE_TYPES as unknown as string[])
    .in('trigger_kind', ['fixed', 'relative']);
  if (error) {
    console.error('[thread/scheduler] candidate query failed', error);
    return { due: 0, sent: 0 };
  }

  // Anchor engagements for relative triggers (one fetch for all).
  const anchorIds = [
    ...new Set(
      (candidates ?? [])
        .filter((c) => c.trigger_kind === 'relative' && c.trigger_engagement_id)
        .map((c) => c.trigger_engagement_id as string),
    ),
  ];
  const anchorStarts = new Map<string, string | null>();
  if (anchorIds.length) {
    const { data: anchors } = await adminClient
      .from('thread_engagement')
      .select('id, starts_at')
      .in('id', anchorIds);
    for (const a of anchors ?? []) anchorStarts.set(a.id, a.starts_at);
  }

  type Due = {
    engagement: NonNullable<typeof candidates>[number];
    threadTitle: string;
    organiserName: string;
    threadId: string;
    startsOn: string | null;
  };
  const due: Due[] = [];
  for (const c of candidates ?? []) {
    const thread = Array.isArray(c.thread) ? c.thread[0] : c.thread;
    if (!thread) continue;
    const program = Array.isArray(thread.program) ? thread.program[0] : thread.program;
    // Draft/archived threads never send. Completed threads may — a journey's
    // tail messages can outlive the closing date.
    if (!program || (program.status !== 'active' && program.status !== 'completed')) continue;

    let dueAt: Date | null = null;
    if (c.trigger_kind === 'fixed') {
      dueAt = c.scheduled_at ? new Date(c.scheduled_at) : null;
    } else {
      // relative: anchor date + signed offset days, at trigger_time in the
      // thread's timezone.
      let anchorDate: string | null = null;
      if (c.trigger_anchor === 'engagement' && c.trigger_engagement_id) {
        const s = anchorStarts.get(c.trigger_engagement_id);
        anchorDate = s ? s.slice(0, 10) : null;
      } else if (c.trigger_anchor === 'end') {
        anchorDate = program.ends_on;
      } else {
        anchorDate = program.starts_on;
      }
      if (anchorDate) {
        const base = new Date(`${anchorDate}T00:00:00Z`);
        base.setUTCDate(base.getUTCDate() + (c.trigger_offset_days ?? 0));
        dueAt = wallTimeToUtc(
          base.toISOString().slice(0, 10),
          c.trigger_time ?? '09:00',
          thread.timezone ?? 'Europe/Amsterdam',
        );
      }
    }
    if (!dueAt) continue;
    if (dueAt.getTime() > now || dueAt.getTime() < now - SCHEDULER_LOOKBACK_MS) continue;

    const organiser = Array.isArray(thread.organiser) ? thread.organiser[0] : thread.organiser;
    const team = Array.isArray(thread.team) ? thread.team[0] : thread.team;
    due.push({
      engagement: c,
      threadId: thread.id,
      threadTitle: program.title,
      organiserName: team?.name ?? organiser?.display_name ?? '',
      startsOn: program.starts_on ?? null,
    });
  }

  let sent = 0;
  for (const d of due) {
    // Everyone enrolled (not dropped) in the thread gets the message once.
    const { data: enrolments } = await adminClient
      .from('thread_enrolment')
      .select(
        'person:person_id (id, first_name, last_name, email), enrolment:enrolment_id (status)',
      )
      .eq('thread_id', d.threadId);

    const dateLabel = d.startsOn
      ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(
          new Date(d.startsOn),
        )
      : '';
    for (const te of enrolments ?? []) {
      const person = Array.isArray(te.person) ? te.person[0] : te.person;
      const enr = Array.isArray(te.enrolment) ? te.enrolment[0] : te.enrolment;
      // Content goes only to people who are actually in — 'invited'
      // (awaiting approval or payment) and 'dropped' are both out
      // (review 2026-07-05: invited used to receive everything).
      const enrStatus = enr?.status ?? null;
      if (!person?.email || enrStatus === 'dropped' || enrStatus === 'invited') continue;

      // Insert-first dedup — same mechanism as the lifecycle sends.
      const { error: logErr } = await adminClient.from('thread_message_send').insert({
        engagement_id: d.engagement.id,
        person_id: person.id,
        email: person.email,
      });
      if (logErr) {
        if (logErr.code !== '23505') console.warn('[thread/scheduler] send log failed', logErr);
        continue;
      }

      const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email;
      const tokens: Record<string, string> = {
        '{name}': person.first_name ?? name,
        '{thread}': d.threadTitle,
        '{organiser}': d.organiserName,
        '{date}': dateLabel,
      };
      const substitute = (s: string) =>
        Object.entries(tokens).reduce((acc, [k, v]) => acc.replaceAll(k, v), s);
      const body = substitute(
        renderMessageBody(
          d.engagement.type,
          (d.engagement.content ?? {}) as Record<string, unknown>,
          d.engagement.description,
        ),
      );
      const msg = engagementMessage({
        title: substitute(d.engagement.title),
        bodyText: body,
        threadTitle: d.threadTitle,
      });
      try {
        await sendEmail({ to: person.email, ...msg });
        sent += 1;
      } catch (e) {
        console.warn('[thread/scheduler] send failed', { engagement: d.engagement.id, e });
      }
    }
  }

  if (due.length || sent) {
    console.log(`[thread/scheduler] ${due.length} due engagement(s), ${sent} email(s) sent`);
  }
  return { due: due.length, sent };
}

// Manual trigger for verification/ops — any authenticated workspace member.
threadRoutes.post('/scheduler/run', async (c) => {
  const result = await runThreadMessageScheduler();
  return c.json(result);
});
