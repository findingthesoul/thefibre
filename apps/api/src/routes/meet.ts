import { Hono } from 'hono';
import { z } from 'zod';
import { SignJWT, jwtVerify } from 'jose';
import { adminClient, userClient } from '../db.js';
import {
  generateSlots,
  type Schedule as WorkingSchedule,
  type Interval as BusyInterval,
} from '../lib/availability/engine.js';
import {
  buildAuthUrl,
  exchangeCode,
  listCalendars,
  freeBusy,
  createEvent,
  deleteEvent,
} from '../lib/google/client.js';

export const meetRoutes = new Hono();

// Helper: state-signing secret for the Google OAuth flow.
function stateSecret(): Uint8Array {
  const s =
    process.env.SSO_INTERNAL_SECRET ??
    process.env.GOOGLE_STATE_SECRET ??
    'dev-only-state-secret';
  return new TextEncoder().encode(s);
}

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

  // Resolve meeting type + host (workspace_id, duration, name + the host's
  // google refresh token + primary calendar id so we can create a GCal event).
  const { data: mt, error: mErr } = await adminClient
    .from('meet_meeting_type')
    .select(
      'id, host_id, workspace_id, name, description, duration_minutes, conferencing_provider, default_location, is_active, host:host_id (google_refresh_token, timezone)',
    )
    .eq('id', data.meeting_type_id)
    .single();
  if (mErr || !mt || !mt.is_active) {
    return c.json({ error: 'meeting type not available' }, 404);
  }
  const hostRow = Array.isArray(mt.host) ? mt.host[0] : mt.host;

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

  // If the host has Google Calendar connected, create the event there now.
  // Failure is non-fatal — the booking is already recorded; the host can
  // re-sync later. We do update the booking row with the resulting ids.
  if (hostRow?.google_refresh_token && booking) {
    try {
      // Find the primary write target.
      const { data: cal } = await adminClient
        .from('meet_calendar')
        .select('google_calendar_id')
        .eq('host_id', mt.host_id)
        .in('role', ['primary', 'write_target'])
        .limit(1)
        .maybeSingle();
      const calendarId = cal?.google_calendar_id ?? 'primary';
      const withMeet = mt.conferencing_provider === 'google_meet';
      const { eventId, meetUrl } = await createEvent(hostRow.google_refresh_token, {
        calendarId,
        summary: mt.name,
        description: mt.description ?? null,
        startsAt: starts,
        endsAt: ends,
        attendeeEmail: data.invitee_email,
        attendeeName: data.invitee_name,
        withMeet,
        location: mt.default_location ?? null,
      });
      await adminClient
        .from('meet_booking')
        .update({
          google_event_id: eventId,
          meet_url: meetUrl,
          conferencing_provider: mt.conferencing_provider,
        })
        .eq('id', booking.id);
    } catch (e) {
      console.error('[meet bookings] google event create failed (non-fatal)', e);
    }
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

// GET /api/v1/meet/public/host/:host_slug/mt/:mt_slug/slots?from=&to=
// Returns available start timestamps for booking. `from` and `to` are ISO
// instants; defaults to "next 14 days from now".
meetRoutes.get('/public/host/:host_slug/mt/:mt_slug/slots', async (c) => {
  const hostSlug = c.req.param('host_slug');
  const mtSlug = c.req.param('mt_slug');
  const url = new URL(c.req.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  const { data: host } = await adminClient
    .from('meet_host')
    .select('id, workspace_id, timezone, working_hours, google_refresh_token')
    .eq('slug', hostSlug)
    .single();
  if (!host) return c.json({ error: 'host not found' }, 404);

  const { data: mt } = await adminClient
    .from('meet_meeting_type')
    .select(
      'id, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_advance_days, is_active',
    )
    .eq('host_id', host.id)
    .eq('slug', mtSlug)
    .single();
  if (!mt || !mt.is_active) return c.json({ error: 'meeting type not found' }, 404);

  const now = new Date();
  const from = fromParam ? new Date(fromParam) : now;
  const to = toParam
    ? new Date(toParam)
    : new Date(
        now.getTime() + Math.min(mt.max_advance_days, 60) * 24 * 60 * 60 * 1000,
      );

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return c.json({ error: 'invalid from/to' }, 400);
  }
  if (to <= from) return c.json({ slots: [] });
  // Cap the range so noisy callers can't ask for years of slots.
  const MAX_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
  const cappedTo =
    to.getTime() - from.getTime() > MAX_WINDOW_MS
      ? new Date(from.getTime() + MAX_WINDOW_MS)
      : to;

  // Busy intervals from existing meet_bookings for this host (any meeting
  // type). Confirmed only — cancelled bookings don't block.
  const { data: bookings } = await adminClient
    .from('meet_booking')
    .select('starts_at, ends_at')
    .eq('host_id', host.id)
    .eq('status', 'confirmed')
    .gte('ends_at', from.toISOString())
    .lte('starts_at', cappedTo.toISOString());

  const busy: BusyInterval[] = (bookings ?? []).map((b) => ({
    start: new Date(b.starts_at),
    end: new Date(b.ends_at),
  }));

  // Layer in the host's Google Calendar freebusy if they're connected. We
  // freebusy-query the calendars they marked as primary or conflict_check.
  if (host.google_refresh_token) {
    const { data: cals } = await adminClient
      .from('meet_calendar')
      .select('google_calendar_id, role')
      .eq('host_id', host.id)
      .in('role', ['primary', 'conflict_check']);
    const ids = (cals ?? [])
      .map((c) => c.google_calendar_id)
      .filter((id): id is string => !!id);
    if (ids.length > 0) {
      try {
        const gbusy = await freeBusy(host.google_refresh_token, ids, from, cappedTo);
        busy.push(...gbusy);
      } catch (e) {
        console.error('[slots] freebusy failed (non-fatal)', e);
      }
    }
  }

  const workingHours = (host.working_hours as WorkingSchedule | null) ?? {};

  const slots = generateSlots({
    hostTimezone: host.timezone,
    workingHours,
    durationMinutes: mt.duration_minutes,
    bufferBeforeMinutes: mt.buffer_before_minutes,
    bufferAfterMinutes: mt.buffer_after_minutes,
    minNoticeMinutes: mt.min_notice_minutes,
    from,
    to: cappedTo,
    busy,
    now,
  });

  return c.json({ slots: slots.map((d) => d.toISOString()) });
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
// Google Calendar OAuth — connect, callback, disconnect.
// auth-callback is public (Google posts back with code+state — no JWT) but
// the state is signed and includes the user_id, so we know which host to
// attach the tokens to.
// ===========================================================================

// GET /api/v1/meet/google/auth-start — authenticated. Returns Google's consent
// URL. The caller's browser navigates to the URL; Google then redirects back
// to our /auth-callback with `code` and our `state`.
meetRoutes.get('/google/auth-start', async (c) => {
  const ctx = c.get('ctx');
  const state = await new SignJWT({
    user_id: ctx.userId,
    workspace_id: ctx.workspaceId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(stateSecret());
  try {
    const url = buildAuthUrl(state);
    return c.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'oauth not configured';
    return c.json({ error: msg }, 500);
  }
});

// GET /api/v1/meet/google/auth-callback — public. Receives code+state from
// Google, exchanges code for tokens, persists refresh_token on meet_host,
// upserts the user's calendars into meet_calendar, then redirects the
// browser back to the Meet settings page.
meetRoutes.get('/google/auth-callback', async (c) => {
  const url = new URL(c.req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const meetUrl = process.env.NEXT_PUBLIC_MEET_URL ?? 'https://meet.thefibre.app';
  if (!code || !state) {
    return c.redirect(`${meetUrl}/settings?google=error&reason=missing`);
  }
  let userId: string;
  let workspaceId: string;
  try {
    const { payload } = await jwtVerify(state, stateSecret());
    userId = payload.user_id as string;
    workspaceId = payload.workspace_id as string;
    if (!userId || !workspaceId) throw new Error('bad state');
  } catch {
    return c.redirect(`${meetUrl}/settings?google=error&reason=state`);
  }

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch (e) {
    console.error('[google/auth-callback] exchange', e);
    return c.redirect(`${meetUrl}/settings?google=error&reason=exchange`);
  }

  // Persist refresh_token on the host row.
  const { error: hErr } = await adminClient
    .from('meet_host')
    .update({ google_refresh_token: tokens.refreshToken })
    .eq('user_id', userId);
  if (hErr) {
    console.error('[google/auth-callback] update host', hErr);
    return c.redirect(`${meetUrl}/settings?google=error&reason=db`);
  }

  // Sync the user's own calendars into meet_calendar. The primary calendar
  // gets role=primary; others get role=conflict_check by default.
  try {
    const calendars = await listCalendars(tokens.refreshToken);
    const { data: host } = await adminClient
      .from('meet_host')
      .select('id')
      .eq('user_id', userId)
      .single();
    if (host) {
      for (const cal of calendars) {
        if (!cal.id) continue;
        await adminClient
          .from('meet_calendar')
          .upsert(
            {
              host_id: host.id,
              workspace_id: workspaceId,
              google_calendar_id: cal.id,
              summary: cal.summary,
              role: cal.primary ? 'primary' : 'conflict_check',
            },
            { onConflict: 'host_id,google_calendar_id' },
          );
      }
    }
  } catch (e) {
    console.error('[google/auth-callback] list/sync calendars', e);
    // Non-fatal — they can hit re-sync later
  }

  return c.redirect(`${meetUrl}/settings?google=connected`);
});

// POST /api/v1/meet/google/disconnect — authenticated. Clears the host's
// refresh token and removes the meet_calendar rows.
meetRoutes.post('/google/disconnect', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: host } = await db
    .from('meet_host')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (host) {
    await db.from('meet_calendar').delete().eq('host_id', host.id);
    await db
      .from('meet_host')
      .update({ google_refresh_token: null })
      .eq('user_id', ctx.userId);
  }
  return c.json({ ok: true });
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

  // Don't return the raw refresh token. Surface a boolean.
  const { google_refresh_token, ...safe } = host as Record<string, unknown> & {
    google_refresh_token: string | null;
  };
  return c.json({ ...safe, google_connected: !!google_refresh_token });
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
