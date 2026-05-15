import { Hono } from 'hono';
import { z } from 'zod';
import { adminClient, userClient } from '../db.js';

export const meetRoutes = new Hono();

// ===========================================================================
// PUBLIC endpoints — used by the booking-page (no auth, invitees have no Fibre
// account). Routes here MUST be in PUBLIC_PATHS so the JWT middleware lets
// them through. They use adminClient deliberately (bypass RLS), returning
// only the fields safe to expose publicly.
// ===========================================================================

// GET /api/v1/meet/public/host/:host_slug
// → { id, slug, full_name, bio, photo_url, timezone, meeting_types: [...] }
meetRoutes.get('/public/host/:host_slug', async (c) => {
  const hostSlug = c.req.param('host_slug');

  const { data: host, error: hErr } = await adminClient
    .from('meet_host')
    .select(
      'id, slug, bio, photo_url, location, timezone, personal_room_url, user:user_id (full_name, email, avatar_url), workspace_id',
    )
    .eq('slug', hostSlug)
    .single();

  if (hErr || !host) return c.json({ error: 'host not found' }, 404);

  const { data: mts } = await adminClient
    .from('meet_meeting_type')
    .select(
      'id, slug, name, description, duration_minutes, conferencing_provider, default_location, price_cents, price_currency',
    )
    .eq('host_id', host.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  const userObj = Array.isArray(host.user) ? host.user[0] : host.user;
  return c.json({
    id: host.id,
    slug: host.slug,
    full_name: userObj?.full_name ?? null,
    avatar_url: userObj?.avatar_url ?? null,
    bio: host.bio,
    photo_url: host.photo_url,
    location: host.location,
    timezone: host.timezone,
    meeting_types: mts ?? [],
  });
});

// GET /api/v1/meet/public/host/:host_slug/mt/:mt_slug
// → { ...mt, host: {...}, intake_form: {...} }
meetRoutes.get('/public/host/:host_slug/mt/:mt_slug', async (c) => {
  const hostSlug = c.req.param('host_slug');
  const mtSlug = c.req.param('mt_slug');

  const { data: host, error: hErr } = await adminClient
    .from('meet_host')
    .select(
      'id, slug, bio, photo_url, location, timezone, personal_room_url, workspace_id, user:user_id (full_name, email, avatar_url)',
    )
    .eq('slug', hostSlug)
    .single();

  if (hErr || !host) return c.json({ error: 'host not found' }, 404);

  const { data: mt, error: mErr } = await adminClient
    .from('meet_meeting_type')
    .select(
      '*, intake_form:intake_form_id (id, name, fields)',
    )
    .eq('host_id', host.id)
    .eq('slug', mtSlug)
    .eq('is_active', true)
    .single();

  if (mErr || !mt) return c.json({ error: 'meeting type not found' }, 404);

  const userObj = Array.isArray(host.user) ? host.user[0] : host.user;
  return c.json({
    meeting_type: mt,
    host: {
      id: host.id,
      slug: host.slug,
      full_name: userObj?.full_name ?? null,
      avatar_url: userObj?.avatar_url ?? null,
      bio: host.bio,
      photo_url: host.photo_url,
      location: host.location,
      timezone: host.timezone,
    },
  });
});

// POST /api/v1/meet/public/bookings
// Creates a booking. If the invitee email matches an existing person in the
// host's workspace, links to it; otherwise creates a new person row.
const CreateBookingBody = z.object({
  meeting_type_id: z.string().uuid(),
  invitee_email: z.string().email().toLowerCase(),
  invitee_name: z.string().min(1).max(200),
  invitee_answers: z.record(z.unknown()).optional(),
  starts_at: z.string().datetime(),
  request_id: z.string().min(8).max(80),
});

meetRoutes.post('/public/bookings', async (c) => {
  const body = CreateBookingBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const data = body.data;

  // Resolve meeting type + host (workspace_id, duration)
  const { data: mt, error: mErr } = await adminClient
    .from('meet_meeting_type')
    .select('id, host_id, workspace_id, duration_minutes, conferencing_provider, default_location, is_active')
    .eq('id', data.meeting_type_id)
    .single();
  if (mErr || !mt || !mt.is_active) {
    return c.json({ error: 'meeting type not available' }, 404);
  }

  // Find or create a person in the host's workspace for this email.
  let personId: string | null = null;
  const { data: existing } = await adminClient
    .from('person')
    .select('id')
    .eq('workspace_id', mt.workspace_id)
    .eq('email', data.invitee_email)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing) {
    personId = existing.id;
  } else {
    const parts = data.invitee_name.trim().split(/\s+/);
    const firstName = parts[0] ?? null;
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
    const { data: created, error: pErr } = await adminClient
      .from('person')
      .insert({
        workspace_id: mt.workspace_id,
        email: data.invitee_email,
        first_name: firstName,
        last_name: lastName,
      })
      .select('id')
      .single();
    if (pErr || !created) {
      console.error('[meet bookings] person create failed', pErr);
    } else {
      personId = created.id;
    }
  }

  const starts = new Date(data.starts_at);
  const ends = new Date(starts.getTime() + mt.duration_minutes * 60 * 1000);

  const { data: booking, error: bErr } = await adminClient
    .from('meet_booking')
    .insert({
      workspace_id: mt.workspace_id,
      meeting_type_id: mt.id,
      host_id: mt.host_id,
      invitee_person_id: personId,
      invitee_email: data.invitee_email,
      invitee_name: data.invitee_name,
      invitee_answers: data.invitee_answers ?? null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: 'confirmed',
      conferencing_provider: mt.conferencing_provider,
      alternative_location: mt.default_location,
      request_id: data.request_id,
    })
    .select('id, starts_at, ends_at, request_id')
    .single();

  if (bErr) {
    // Idempotency — same request_id returns the existing booking.
    if (bErr.code === '23505') {
      const { data: existing } = await adminClient
        .from('meet_booking')
        .select('id, starts_at, ends_at, request_id')
        .eq('request_id', data.request_id)
        .single();
      if (existing) return c.json({ booking: existing, idempotent: true });
    }
    console.error('[meet bookings] insert failed', bErr);
    return c.json({ error: bErr.message }, 500);
  }

  // Write an activity event so The Fibre's timeline knows a meeting was booked.
  // Non-fatal.
  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'fibre-meet')
    .single();
  if (app && personId) {
    await adminClient.from('activity').insert({
      workspace_id: mt.workspace_id,
      person_id: personId,
      app_id: app.id,
      type: 'meeting_booked',
      subject: `Meeting booked: ${data.invitee_name}`,
      occurred_at: new Date().toISOString(),
    });
  }

  return c.json({ booking });
});

// GET /api/v1/meet/public/bookings/:id  → minimal confirmation payload
meetRoutes.get('/public/bookings/:id', async (c) => {
  const id = c.req.param('id');
  const { data, error } = await adminClient
    .from('meet_booking')
    .select(
      'id, invitee_email, invitee_name, starts_at, ends_at, status, conferencing_provider, alternative_location, meeting_type:meeting_type_id (name, duration_minutes, host:host_id (slug, user:user_id (full_name)))',
    )
    .eq('id', id)
    .single();
  if (error || !data) return c.json({ error: 'booking not found' }, 404);
  return c.json(data);
});

// ===========================================================================
// AUTHENTICATED endpoints — facilitator UI (apps/meet dashboard). Gated by
// the existing JWT middleware and RLS (workspace + fibre-meet membership).
// ===========================================================================

// GET /api/v1/meet/me  — the current user's host config (auto-create on first read)
meetRoutes.get('/me', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  let { data: host } = await db
    .from('meet_host')
    .select('*')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (!host) {
    // First-time facilitator — provision a host row with a sensible default slug.
    // Use admin client because the row doesn't exist yet so RLS would block the insert
    // (it requires existing app_membership AND workspace match — both true, but
    // PostgREST sometimes order-of-checks trips here).
    const { data: u } = await adminClient
      .from('user')
      .select('email, full_name')
      .eq('id', ctx.userId)
      .single();
    const seed =
      (u?.full_name ?? u?.email ?? 'host')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30) || 'host';
    const slug = `${seed}-${Math.random().toString(36).slice(2, 5)}`;
    const { data: created, error: cErr } = await adminClient
      .from('meet_host')
      .insert({
        user_id: ctx.userId,
        workspace_id: ctx.workspaceId,
        slug,
      })
      .select('*')
      .single();
    if (cErr || !created) {
      console.error('[meet/me] auto-provision failed', cErr);
      return c.json({ error: 'failed to provision host' }, 500);
    }
    host = created;
  }

  return c.json(host);
});

// PATCH /api/v1/meet/me — update host config
const HostUpdate = z.object({
  slug: z.string().min(2).max(40).optional(),
  bio: z.string().max(2000).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  personal_room_url: z.string().max(500).nullable().optional(),
  timezone: z.string().max(100).optional(),
  working_hours: z.record(z.array(z.object({ start: z.string(), end: z.string() }))).nullable().optional(),
  photo_url: z.string().max(500).nullable().optional(),
});

meetRoutes.patch('/me', async (c) => {
  const body = HostUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('meet_host')
    .update(body.data)
    .eq('user_id', ctx.userId)
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// GET /api/v1/meet/meeting-types — list mine
meetRoutes.get('/meeting-types', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  // Resolve host id for current user
  const { data: host } = await db
    .from('meet_host')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!host) return c.json({ items: [] });
  const { data, error } = await db
    .from('meet_meeting_type')
    .select('*')
    .eq('host_id', host.id)
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

const MeetingTypeUpsert = z.object({
  slug: z.string().min(2).max(60),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  duration_minutes: z.number().int().min(5).max(480),
  buffer_before_minutes: z.number().int().min(0).max(240).optional(),
  buffer_after_minutes: z.number().int().min(0).max(240).optional(),
  min_notice_minutes: z.number().int().min(0).max(60 * 24 * 30).optional(),
  max_advance_days: z.number().int().min(1).max(365).optional(),
  conferencing_provider: z
    .enum(['google_meet', 'zoom', 'teams', 'in_person', 'personal_room', 'none'])
    .optional(),
  default_location: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
});

meetRoutes.post('/meeting-types', async (c) => {
  const body = MeetingTypeUpsert.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: host } = await db
    .from('meet_host')
    .select('id, workspace_id')
    .eq('user_id', ctx.userId)
    .single();
  if (!host) return c.json({ error: 'host not found' }, 404);
  const { data, error } = await db
    .from('meet_meeting_type')
    .insert({ ...body.data, host_id: host.id, workspace_id: host.workspace_id })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message, code: error.code }, 500);
  return c.json(data, 201);
});

meetRoutes.patch('/meeting-types/:id', async (c) => {
  const id = c.req.param('id');
  const body = MeetingTypeUpsert.partial().safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('meet_meeting_type')
    .update(body.data)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// GET /api/v1/meet/bookings — upcoming for current host
meetRoutes.get('/bookings', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: host } = await db
    .from('meet_host')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!host) return c.json({ items: [] });
  const { data, error } = await db
    .from('meet_booking')
    .select(
      'id, invitee_email, invitee_name, starts_at, ends_at, status, meeting_type:meeting_type_id (name)',
    )
    .eq('host_id', host.id)
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(100);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});
