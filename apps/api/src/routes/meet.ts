import { Hono } from 'hono';
import { profileFor } from '../lib/identity-profile.js';
import { z } from 'zod';
import { SignJWT, jwtVerify } from 'jose';
import { adminClient, userClient } from '../db.js';
import {
  isAdminRole,
  wouldOrphanWorkspace,
  ORPHAN_ERROR,
  type WorkspaceRole,
} from '../lib/workspace-roles.js';
import {
  RESERVED_SLUGS,
  isReservedSlug,
  SLUG_PATTERN,
} from '../lib/reserved-slugs.js';
import {
  generateSlots,
  generateMultiHostSlots,
  rankAssigneesForSlot,
  type Schedule as WorkingSchedule,
  type Interval as BusyInterval,
  type PerHostArgs,
} from '../lib/availability/engine.js';
import {
  buildAuthUrl,
  exchangeCode,
  listCalendars,
  freeBusy,
  createEvent,
  deleteEvent,
} from '../lib/google/client.js';
import {
  userGoogleToken,
  hostGoogleToken,
  userPersonalRoom,
  saveGoogleToken,
  savePersonalRoom,
} from '../lib/connections.js';
import { sendEmail } from '../lib/email/client.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { recordPurchase } from '../lib/purchases.js';
import { personalStripeAccount } from '../lib/payment-accounts.js';
import {
  bookingConfirmationInvitee,
  bookingNotificationHost,
  bookingCancellation,
  escapeHtml,
  type EmailCommon,
} from '../lib/email/templates.js';
import {
  APPS,
  appUrl,
  emailSignoff,
  legalFooterLine,
} from '@thefibre/shared';
import { platformFeeCents } from '../lib/fees.js';

const MEET = APPS['fibre-meet'];
const PLATFORM = APPS['fibre-platform'];

function meetAppUrl(): string {
  return appUrl('fibre-meet', process.env);
}

// ---------------------------------------------------------------------------
// Identity helpers — every workspace user must have a paired person row in
// the platform contact graph (brief §2). These helpers keep that invariant.
// ---------------------------------------------------------------------------

function splitName(full: string | null): { first: string | null; last: string | null } {
  if (!full) return { first: null, last: null };
  const parts = full.trim().split(/\s+/);
  const first = parts[0] ?? null;
  const last = parts.length > 1 ? parts.slice(1).join(' ') : null;
  return { first, last };
}

/** Find-or-create a person for (workspace, email). Returns the person id. */
async function ensurePersonForEmail(
  workspaceId: string,
  email: string,
  fullName: string | null,
): Promise<string | null> {
  const { data: existing } = await adminClient
    .from('person')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing) return existing.id;
  const { first, last } = splitName(fullName);
  const { data: created, error } = await adminClient
    .from('person')
    .insert({
      workspace_id: workspaceId,
      email,
      first_name: first,
      last_name: last,
    })
    .select('id')
    .single();
  if (error || !created) {
    console.error('[identity] person create failed', error);
    return null;
  }
  return created.id;
}

/** Ensure a workspace_member row exists for (user, workspace). Idempotent.
 *  Used by invite paths so every new user has explicit role + relationship.
 *  If the row already exists, fields are NOT overwritten — callers can
 *  upgrade an external to internal via the dedicated endpoint.
 *
 *  `role` must be one of the values 20260704090000_role_tiers permits:
 *  super_admin | admin | organiser. It said 'admin' | 'member' until v0.18.8,
 *  and 'member' has not been a legal value since that migration — so every
 *  insert from here violated the CHECK constraint and, because the error was
 *  never read, failed in silence. Invite paths believed they were writing a
 *  membership row and were not. Hence the explicit error check below. */
async function ensureWorkspaceMember(
  userId: string,
  workspaceId: string,
  opts: {
    role?: 'super_admin' | 'admin' | 'organiser';
    relationship?: 'internal' | 'external';
    memberStatus?: string | null;
  } = {},
): Promise<void> {
  const { data: existing } = await adminClient
    .from('workspace_member')
    .select('user_id')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (existing) return;
  const { error } = await adminClient.from('workspace_member').insert({
    user_id: userId,
    workspace_id: workspaceId,
    workspace_role: opts.role ?? 'organiser',
    relationship_type: opts.relationship ?? 'internal',
    member_status: opts.memberStatus ?? null,
  });
  if (error) console.error('[meet] ensureWorkspaceMember', { userId, workspaceId, error });
}

/** Heal old user rows that were created before the user↔person invariant
 *  was enforced. No-op if already linked. */
async function linkPersonIfMissing(
  userId: string,
  workspaceId: string,
  email: string,
  fullName: string | null,
): Promise<void> {
  const { data: u } = await adminClient
    .from('user')
    .select('person_id')
    .eq('id', userId)
    .maybeSingle();
  if (u?.person_id) return;
  const pid = await ensurePersonForEmail(workspaceId, email, fullName);
  if (!pid) return;
  await adminClient.from('user').update({ person_id: pid }).eq('id', userId);
  await adminClient.from('person').update({ user_id: userId }).eq('id', pid);
}

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
      'id, slug, bio, photo_url, location, timezone, user:user_id (full_name, email, avatar_url), workspace_id',
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
    .eq('is_public_listed', true)
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
      'id, slug, bio, photo_url, location, timezone, workspace_id, user:user_id (full_name, email, avatar_url)',
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

  // Poll MTs: attach candidate slots so the public page can render checkboxes.
  let pollSlots: { starts_at: string; ends_at: string }[] | undefined;
  if (mt.event_type === 'poll') {
    const { data: ps } = await adminClient
      .from('meet_poll_slot')
      .select('starts_at, ends_at')
      .eq('meeting_type_id', mt.id)
      .order('starts_at', { ascending: true });
    pollSlots = ps ?? [];
  }

  const userObj = Array.isArray(host.user) ? host.user[0] : host.user;
  return c.json({
    meeting_type: { ...mt, poll_slots: pollSlots },
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
      'id, slug, host_id, team_id, event_type, workspace_id, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, conferencing_provider, default_location, is_active, capacity, fixed_starts_at, fixed_ends_at, requires_approval, price_cents, price_currency',
    )
    .eq('id', data.meeting_type_id)
    .single();
  if (mErr || !mt || !mt.is_active) {
    return c.json({ error: 'meeting type not available' }, 404);
  }

  // Approval mode: MT-level value wins; null falls back to the owner host's
  // default. Computed up front so the rest of this handler can branch on it.
  let effectiveRequiresApproval = false;
  if (mt.requires_approval === true) {
    effectiveRequiresApproval = true;
  } else if (mt.requires_approval === false) {
    effectiveRequiresApproval = false;
  } else {
    const { data: ownerHost } = await adminClient
      .from('meet_host')
      .select('requires_approval')
      .eq('id', mt.host_id)
      .maybeSingle();
    effectiveRequiresApproval = !!ownerHost?.requires_approval;
  }

  const starts0 = new Date(data.starts_at);
  const ends0 = new Date(starts0.getTime() + mt.duration_minutes * 60 * 1000);

  // One-off: starts_at must equal the fixed window the host configured.
  // Reject anything else so an invitee can't synthesise a non-fixed slot.
  // Poll MTs don't accept direct bookings via this endpoint at all — the
  // host converts a winning poll slot into a booking via a separate route.
  if (mt.event_type === 'poll') {
    return c.json({ error: 'poll meeting types are not booked directly', code: 'poll_not_bookable' }, 400);
  }
  if (mt.event_type === 'one_off') {
    if (!mt.fixed_starts_at) {
      return c.json({ error: 'one-off has no fixed time set', code: 'no_fixed_time' }, 409);
    }
    const fixed = new Date(mt.fixed_starts_at).toISOString();
    if (starts0.toISOString() !== fixed) {
      return c.json({ error: 'starts_at does not match the fixed slot', code: 'wrong_fixed_time' }, 409);
    }
    // Capacity check — reuse v0.11.1 semantics: count confirmed bookings on
    // (mt.id, starts_at). If capacity is null, single-attendee (1) is the cap.
    const cap = mt.capacity && mt.capacity > 0 ? mt.capacity : 1;
    const { count: bookedCount, error: cntErr } = await adminClient
      .from('meet_booking')
      .select('id', { count: 'exact', head: true })
      .eq('meeting_type_id', mt.id)
      .eq('starts_at', starts0.toISOString())
      .eq('status', 'confirmed');
    if (cntErr) {
      console.error('[meet bookings] one-off capacity count failed', cntErr);
      return c.json({ error: 'capacity check failed' }, 500);
    }
    if ((bookedCount ?? 0) >= cap) {
      return c.json({ error: 'fully booked', code: 'slot_full' }, 409);
    }
  }

  // Group event types: enforce per-slot capacity. Multiple invitees share the
  // same (meeting_type_id, starts_at) tuple; once `capacity` confirmed
  // bookings exist for that tuple, reject with 409 "fully booked".
  if (mt.event_type === 'group' && mt.capacity && mt.capacity > 0) {
    const { count: bookedCount, error: cntErr } = await adminClient
      .from('meet_booking')
      .select('id', { count: 'exact', head: true })
      .eq('meeting_type_id', mt.id)
      .eq('starts_at', starts0.toISOString())
      .eq('status', 'confirmed');
    if (cntErr) {
      console.error('[meet bookings] group capacity count failed', cntErr);
      return c.json({ error: 'capacity check failed' }, 500);
    }
    if ((bookedCount ?? 0) >= mt.capacity) {
      return c.json({ error: 'fully booked', code: 'slot_full' }, 409);
    }
  }

  // Determine which host runs this booking.
  //  - one_on_one / group : mt.host_id
  //  - collective         : the primary assignee (first in resolveAssigneeHostIds)
  //  - round_robin        : the least-loaded assignee free at this slot
  let chosenHostId: string = mt.host_id;
  let collectiveExtras: { host_id: string; user_id: string }[] = [];
  if (mt.event_type === 'round_robin' || mt.event_type === 'collective') {
    const hostIds = await resolveAssigneeHostIds(mt);
    if (mt.event_type === 'collective') {
      chosenHostId = hostIds[0] ?? mt.host_id;
    } else {
      // Round-robin: pick least-loaded free host.
      const window = {
        from: new Date(starts0.getTime() - 24 * 60 * 60 * 1000),
        to: new Date(starts0.getTime() + 30 * 24 * 60 * 60 * 1000),
      };
      const args = await buildPerHostArgs(hostIds, mt, window.from, window.to, new Date());
      // Count upcoming confirmed bookings per host as the "load".
      const { data: counts } = await adminClient
        .from('meet_booking')
        .select('host_id')
        .in('host_id', hostIds)
        .eq('status', 'confirmed')
        .gte('starts_at', new Date().toISOString());
      const loadByKey: Record<string, number> = {};
      for (const r of counts ?? []) {
        loadByKey[r.host_id] = (loadByKey[r.host_id] ?? 0) + 1;
      }
      const ranked = rankAssigneesForSlot(starts0, mt.duration_minutes, args, loadByKey);
      if (ranked.length === 0) {
        return c.json({ error: 'no host available for this slot' }, 409);
      }
      chosenHostId = ranked[0] ?? mt.host_id;
    }
    if (mt.event_type === 'collective') {
      // The other assignees' user ids — used to add them as event attendees.
      const { data: assignees } = await adminClient
        .from('meet_meeting_type_assignee')
        .select('user_id')
        .eq('meeting_type_id', mt.id);
      const otherUserIds = (assignees ?? [])
        .map((a) => a.user_id)
        // Strip the primary (already on the event as organiser).
        .filter(Boolean);
      if (otherUserIds.length > 0) {
        const { data: theirHosts } = await adminClient
          .from('meet_host')
          .select('id, user_id')
          .in('user_id', otherUserIds);
        const primaryHost = (theirHosts ?? []).find((h) => h.id === chosenHostId);
        collectiveExtras = (theirHosts ?? [])
          .filter((h) => h.id !== primaryHost?.id)
          .map((h) => ({ host_id: h.id, user_id: h.user_id }));
      }
    }
  }

  // Now load the chosen host (refresh token, slug, user info — for emails + GCal).
  const { data: chosenHostRow } = await adminClient
    .from('meet_host')
    .select(
      'id, timezone, slug, user:user_id (full_name, email)',
    )
    .eq('id', chosenHostId)
    .single();
  const hostRow = chosenHostRow;
  const hostUser = hostRow?.user
    ? Array.isArray(hostRow.user)
      ? hostRow.user[0]
      : hostRow.user
    : null;

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

  const starts = starts0;
  const ends = ends0;

  // Phase 3: paid MTs pre-empt approval — payment is the hard gate, and
  // once paid we auto-confirm. The host can still issue a refund if they
  // need to reject after the fact. If a workspace really wants payment-
  // AND-approval, we'll add a combined flow when someone asks for it.
  const isPaidBooking = !!(mt.price_cents && mt.price_cents > 0);
  const bookingStatus =
    isPaidBooking ? 'confirmed' : effectiveRequiresApproval ? 'pending_approval' : 'confirmed';
  const initialPaymentStatus = isPaidBooking ? 'pending' : 'not_required';

  const { data: booking, error: bErr } = await adminClient
    .from('meet_booking')
    .insert({
      workspace_id: mt.workspace_id,
      meeting_type_id: mt.id,
      host_id: chosenHostId,
      invitee_person_id: personId,
      invitee_email: data.invitee_email,
      invitee_name: data.invitee_name,
      invitee_answers: data.invitee_answers ?? null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: bookingStatus,
      payment_status: initialPaymentStatus,
      conferencing_provider: mt.conferencing_provider,
      alternative_location: mt.default_location,
      request_id: data.request_id,
    })
    .select('id, starts_at, ends_at, request_id, status')
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

  // Phase 3 — paid booking: create a Stripe Connect Checkout session
  // against the host's stripe_account_id. Return the URL so the public
  // flow can redirect the invitee to pay. The webhook flips
  // payment_status='paid' and triggers the deferred side-effects
  // (Calendar event, confirmation email, activity). See
  // POST /meet/stripe-webhook below.
  if (isPaidBooking && booking) {
    const stripe = stripeOrNull();
    if (!stripe) {
      console.error('[meet bookings] STRIPE_SECRET_KEY missing — cannot collect payment');
      return c.json(
        { error: 'payment processor not configured', code: 'stripe_not_configured' },
        503,
      );
    }
    // Need the host's connected account.
    const { data: ownerHost } = await adminClient
      .from('meet_host')
      .select('stripe_account_id, slug, user_id')
      .eq('id', mt.host_id)
      .single();
    // Payments SPoT: platform value first, the meet_host column as fallback.
    const hostAccount = ownerHost?.user_id
      ? await personalStripeAccount(ownerHost.user_id)
      : ownerHost?.stripe_account_id ?? null;
    if (!ownerHost || !hostAccount) {
      // Bookings UI should have prevented this — defence in depth.
      return c.json(
        { error: 'host has not connected Stripe', code: 'host_stripe_unconnected' },
        409,
      );
    }
    // Application fee — plan-aware as of v0.13.18 (Platform Billing
    // Phase 1). Reads the workspace's plan via the `workspace_meet_fee`
    // helper which returns (pct, cap_cents) from billing_plan:
    //   - Free workspace: 0.0200 (2%), cap 200 cents (€2)
    //   - Pro / Org:      0,            null
    // If the helper returns nothing (workspace_subscription row missing
    // for some pathological reason), default to the historical Free rate
    // so we never under-skim. Conservative on the platform side; harmless
    // on the host side.
    const grossCents = mt.price_cents!;
    const applicationFeeCents = await platformFeeCents(mt.workspace_id, grossCents);

    const successUrl = `${meetAppUrl()}/${ownerHost.slug ?? 'host'}/${mt.slug}/confirmed/${booking.id}?stripe=success`;
    const cancelUrl = `${meetAppUrl()}/${ownerHost.slug ?? 'host'}/${mt.slug}?stripe=cancelled&booking=${booking.id}`;

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: (mt.price_currency ?? 'eur').toLowerCase(),
                unit_amount: grossCents,
                product_data: {
                  name: mt.name,
                  description: mt.description ?? undefined,
                },
              },
              quantity: 1,
            },
          ],
          payment_intent_data: {
            application_fee_amount: applicationFeeCents,
            // Idempotent — same booking id ⇒ same payment intent metadata
            // so duplicate webhooks find the right row.
            metadata: { booking_id: booking.id, mt_slug: mt.slug },
          },
          customer_email: data.invitee_email,
          metadata: { booking_id: booking.id, mt_slug: mt.slug },
          // Automatic invoice generation. Stripe creates a finalised
          // invoice (with the host's connected-account branding + tax
          // ID + business address) once the payment succeeds, emails
          // a hosted PDF link to the invitee, and stores the invoice
          // on the connected account's Invoices dashboard. No extra
          // tables or code on our side. EU VAT requires this — the
          // Checkout receipt is not a legal invoice.
          invoice_creation: {
            enabled: true,
            invoice_data: {
              description: `${mt.name} — booking on Fibre Meet`,
              metadata: {
                booking_id: booking.id,
                mt_slug: mt.slug,
                booking_url: successUrl,
              },
              // The footer surfaces on the PDF beneath the line items —
              // good place for the support address per ENTITY in
              // packages/shared/branding.ts. Hard-coded here because
              // this string ends up on the host's invoice, not ours.
              footer: 'Issued automatically by Fibre Meet on behalf of the host.',
            },
          },
          // Collect a billing address so the auto-generated invoice
          // has a "Bill to" block — required for EU reverse-charge
          // VAT. Stripe Tax is not enabled here; hosts who want
          // automatic tax-rate calculation must turn it on inside
          // their connected Stripe account, and we'll opt-in per
          // workspace once Platform Billing Phase 1 lands.
          billing_address_collection: 'required',
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
        { stripeAccount: hostAccount },
      );
      // Stash the session id so the webhook can find this booking.
      await adminClient
        .from('meet_booking')
        .update({ stripe_session_id: session.id })
        .eq('id', booking.id);
      // Ledger row for the Invoices area (proposal §2.1).
      await recordPurchase({
        appSlug: 'fibre-meet',
        workspaceId: mt.workspace_id,
        itemRef: booking.id,
        payerName: data.invitee_name,
        payerEmail: data.invitee_email,
        itemLabel: mt.name,
        organiserUserId: (ownerHost as { user_id?: string | null }).user_id ?? null,
        teamId: (mt as { team_id?: string | null }).team_id ?? null,
        amountCents: grossCents,
        currency: (mt.price_currency ?? 'EUR').toUpperCase(),
        method: 'stripe',
        status: 'pending',
        stripeAccountId: hostAccount,
      });
      return c.json({
        booking,
        payment_required: true,
        checkout_url: session.url,
      });
    } catch (e) {
      console.error('[meet bookings] checkout session create failed', e);
      // Roll the booking back so a stale 'pending' row doesn't block the slot.
      await adminClient.from('meet_booking').delete().eq('id', booking.id);
      return c.json(
        { error: 'failed to start checkout', detail: (e as Error).message },
        500,
      );
    }
  }

  // If the booking requires host approval, skip Google Calendar + the
  // confirmation emails. Send a "request received" email pair instead and
  // exit the side-effects block early — the host will trigger the rest via
  // POST /meet/bookings/:id/approve.
  let resolvedMeetUrl: string | null = null;
  if (effectiveRequiresApproval && booking) {
    const hostEmail = hostUser?.email ?? null;
    const inviteeName = data.invitee_name;
    const inviteeEmail = data.invitee_email;
    const hostName = hostUser?.full_name ?? hostRow?.slug ?? 'your host';
    try {
      await sendEmail({
        to: inviteeEmail,
        subject: `Request received: ${mt.name}`,
        text: `Hi ${inviteeName.split(' ')[0] ?? ''},\n\nYour booking request has been sent to ${hostName}. You'll get a confirmation email once it's approved.\n\n${emailSignoff()}`,
        html: `<p>Hi ${escapeHtml(inviteeName.split(' ')[0] ?? '')},</p><p>Your booking request has been sent to ${escapeHtml(hostName)}. You'll get a confirmation email once it's approved.</p>`,
        replyTo: hostEmail ?? undefined,
      });
    } catch (e) {
      console.error('[meet bookings] approval-pending invitee email failed (non-fatal)', e);
    }
    if (hostEmail) {
      try {
        await sendEmail({
          to: hostEmail,
          subject: `Approval needed: ${mt.name} — ${inviteeName}`,
          text: `${inviteeName} (${inviteeEmail}) requested ${mt.name} for ${starts.toISOString()}.\n\nReview and approve at ${meetAppUrl()}/bookings\n\n${emailSignoff()}`,
          html: `<p><strong>${escapeHtml(inviteeName)}</strong> (${escapeHtml(inviteeEmail)}) requested <strong>${escapeHtml(mt.name)}</strong>.</p><p><a href="${meetAppUrl()}/bookings">Review in Fibre Meet →</a></p>`,
          replyTo: inviteeEmail,
        });
      } catch (e) {
        console.error('[meet bookings] approval-pending host email failed (non-fatal)', e);
      }
    }
    // Activity event: meeting_requested so the timeline shows the pending state.
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
        type: 'meeting_requested',
        subject: `Meeting requested: ${data.invitee_name}`,
        occurred_at: new Date().toISOString(),
      });
    }
    return c.json({ booking });
  }

  // If the host has Google Calendar connected, create the event there now.
  // Failure is non-fatal — the booking is already recorded; the host can
  // re-sync later. We do update the booking row with the resulting ids.
  const bookingGToken = booking ? await hostGoogleToken(chosenHostId) : null;
  if (bookingGToken && booking) {
    try {
      // Find the primary write target on the chosen host's calendars.
      const { data: cal } = await adminClient
        .from('meet_calendar')
        .select('google_calendar_id')
        .eq('host_id', chosenHostId)
        .in('role', ['primary', 'write_target'])
        .limit(1)
        .maybeSingle();
      const calendarId = cal?.google_calendar_id ?? 'primary';
      const withMeet = mt.conferencing_provider === 'google_meet';
      // For collective bookings, add the other team members as attendees.
      let extras: { email: string; name?: string | null }[] = [];
      if (collectiveExtras.length > 0) {
        const { data: extraUsers } = await adminClient
          .from('user')
          .select('id, email, full_name')
          .in(
            'id',
            collectiveExtras.map((e) => e.user_id),
          );
        extras = (extraUsers ?? []).map((u) => ({ email: u.email, name: u.full_name }));
      }
      const { eventId, meetUrl } = await createEvent(bookingGToken, {
        calendarId,
        summary: mt.name,
        description: mt.description ?? null,
        startsAt: starts,
        endsAt: ends,
        attendeeEmail: data.invitee_email,
        attendeeName: data.invitee_name,
        extraAttendees: extras,
        withMeet,
        location: mt.default_location ?? null,
      });
      resolvedMeetUrl = meetUrl;
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

  // Send confirmation emails. Non-fatal — if email fails the booking still
  // succeeded, we just log it. Google Calendar already emailed the invitee an
  // ICS invite via sendUpdates:'all', but we send our own branded note too so
  // the cancel link surfaces clearly.
  if (booking && hostRow) {
    const common: EmailCommon = {
      inviteeName: data.invitee_name,
      inviteeEmail: data.invitee_email,
      hostName: hostUser?.full_name ?? hostRow.slug ?? 'your host',
      hostEmail: hostUser?.email ?? null,
      meetingName: mt.name,
      startsAt: starts,
      endsAt: ends,
      hostTimezone: hostRow.timezone ?? 'UTC',
      meetUrl: resolvedMeetUrl,
      location: mt.default_location ?? null,
      bookingId: booking.id,
      meetAppUrl: meetAppUrl(),
      hostSlug: hostRow.slug ?? '',
      meetingTypeSlug: mt.slug,
    };
    try {
      const invitee = bookingConfirmationInvitee(common);
      await sendEmail({
        to: data.invitee_email,
        subject: invitee.subject,
        text: invitee.text,
        html: invitee.html,
        replyTo: common.hostEmail ?? undefined,
      });
    } catch (e) {
      console.error('[meet bookings] invitee email failed (non-fatal)', e);
    }
    if (common.hostEmail) {
      try {
        const host = bookingNotificationHost(common);
        await sendEmail({
          to: common.hostEmail,
          subject: host.subject,
          text: host.text,
          html: host.html,
          replyTo: data.invitee_email,
        });
      } catch (e) {
        console.error('[meet bookings] host email failed (non-fatal)', e);
      }
    }
    // Collective: also notify the other assignees.
    if (collectiveExtras.length > 0) {
      const { data: extraUsers } = await adminClient
        .from('user')
        .select('id, email, full_name')
        .in('id', collectiveExtras.map((e) => e.user_id));
      for (const u of extraUsers ?? []) {
        if (!u.email || u.email === common.hostEmail) continue;
        try {
          const m = bookingNotificationHost(common);
          await sendEmail({
            to: u.email,
            subject: m.subject,
            text: m.text,
            html: m.html,
            replyTo: data.invitee_email,
          });
        } catch (e) {
          console.error('[meet bookings] collective host email failed (non-fatal)', e);
        }
      }
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
    .select('id, user_id, workspace_id, timezone, working_hours')
    .eq('slug', hostSlug)
    .single();
  if (!host) return c.json({ error: 'host not found' }, 404);

  const { data: mt } = await adminClient
    .from('meet_meeting_type')
    .select(
      'id, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_advance_days, is_active, working_hours_override, conflict_calendar_ids, event_type, capacity, fixed_starts_at, fixed_ends_at',
    )
    .eq('host_id', host.id)
    .eq('slug', mtSlug)
    .single();
  if (!mt || !mt.is_active) return c.json({ error: 'meeting type not found' }, 404);

  // One-off: there is exactly one slot. Skip working-hours generation
  // entirely; just return the fixed window (subject to capacity).
  if (mt.event_type === 'one_off') {
    if (!mt.fixed_starts_at) return c.json({ slots: [] });
    const cap = mt.capacity && mt.capacity > 0 ? mt.capacity : 1;
    const { count } = await adminClient
      .from('meet_booking')
      .select('id', { count: 'exact', head: true })
      .eq('meeting_type_id', mt.id)
      .eq('starts_at', mt.fixed_starts_at)
      .eq('status', 'confirmed');
    const booked = count ?? 0;
    if (booked >= cap) return c.json({ slots: [], slots_meta: [] });
    const iso = new Date(mt.fixed_starts_at).toISOString();
    return c.json({
      slots: [iso],
      slots_meta: [{ starts_at: iso, capacity: cap, booked, remaining: cap - booked }],
    });
  }

  // Poll: no slots to book through this endpoint. Voters use /public/poll-votes.
  if (mt.event_type === 'poll') return c.json({ slots: [] });

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
  // Group MTs: bookings on this MT itself do NOT block, since the slot
  // stays open until capacity is reached. We track per-slot counts below.
  const { data: bookings } = await adminClient
    .from('meet_booking')
    .select('starts_at, ends_at, meeting_type_id')
    .eq('host_id', host.id)
    .eq('status', 'confirmed')
    .gte('ends_at', from.toISOString())
    .lte('starts_at', cappedTo.toISOString());

  const isGroup = mt.event_type === 'group';
  const busy: BusyInterval[] = (bookings ?? [])
    .filter((b) => !(isGroup && b.meeting_type_id === mt.id))
    .map((b) => ({
      start: new Date(b.starts_at),
      end: new Date(b.ends_at),
    }));

  // Per-slot booked counts for group MTs (keyed by starts_at ISO string).
  const groupCounts: Record<string, number> = {};
  if (isGroup) {
    for (const b of bookings ?? []) {
      if (b.meeting_type_id !== mt.id) continue;
      const k = new Date(b.starts_at).toISOString();
      groupCounts[k] = (groupCounts[k] ?? 0) + 1;
    }
  }

  // Layer in the host's Google Calendar freebusy if they're connected. The
  // meeting type can override which calendars to conflict-check; otherwise
  // we use every primary / conflict_check calendar on the host.
  const slotsGToken = await userGoogleToken(host.user_id);
  if (slotsGToken) {
    let calsQuery = adminClient
      .from('meet_calendar')
      .select('id, google_calendar_id, role')
      .eq('host_id', host.id);
    if (mt.conflict_calendar_ids && mt.conflict_calendar_ids.length > 0) {
      calsQuery = calsQuery.in('id', mt.conflict_calendar_ids);
    } else {
      calsQuery = calsQuery.in('role', ['primary', 'conflict_check']);
    }
    const { data: cals } = await calsQuery;
    const ids = (cals ?? [])
      .map((c) => c.google_calendar_id)
      .filter((id): id is string => !!id);
    if (ids.length > 0) {
      try {
        const gbusy = await freeBusy(slotsGToken, ids, from, cappedTo);
        busy.push(...gbusy);
      } catch (e) {
        console.error('[slots] freebusy failed (non-fatal)', e);
      }
    }
  }

  // Use the meeting type's override if set, otherwise the host's default.
  const workingHours =
    (mt.working_hours_override as WorkingSchedule | null) ??
    (host.working_hours as WorkingSchedule | null) ??
    {};

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

  const slotsIso = slots.map((d) => d.toISOString());

  if (isGroup && mt.capacity && mt.capacity > 0) {
    const filtered: string[] = [];
    const slotsMeta: { starts_at: string; capacity: number; booked: number; remaining: number }[] = [];
    for (const s of slotsIso) {
      const booked = groupCounts[s] ?? 0;
      const remaining = mt.capacity - booked;
      if (remaining <= 0) continue;
      filtered.push(s);
      slotsMeta.push({ starts_at: s, capacity: mt.capacity, booked, remaining });
    }
    return c.json({ slots: filtered, slots_meta: slotsMeta });
  }

  return c.json({ slots: slotsIso });
});

// POST /api/v1/meet/public/bookings/:id/cancel — invitee-initiated cancel.
// No auth — the booking id is a uuid (unguessable) and the only handle the
// invitee has. Flips status, deletes the GCal event, and emails both sides.
meetRoutes.post('/public/bookings/:id/cancel', async (c) => {
  const id = c.req.param('id');

  const { data: booking, error } = await adminClient
    .from('meet_booking')
    .select(
      'id, workspace_id, host_id, invitee_email, invitee_name, starts_at, ends_at, status, meet_url, google_event_id, alternative_location, meeting_type:meeting_type_id (name, slug, default_location), host:host_id (timezone, slug, user:user_id (full_name, email))',
    )
    .eq('id', id)
    .single();
  if (error || !booking) return c.json({ error: 'booking not found' }, 404);

  if (booking.status === 'cancelled') {
    return c.json({ ok: true, alreadyCancelled: true });
  }

  const { error: uErr } = await adminClient
    .from('meet_booking')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (uErr) {
    console.error('[meet bookings/cancel] update failed', uErr);
    return c.json({ error: uErr.message }, 500);
  }

  const hostRow = Array.isArray(booking.host) ? booking.host[0] : booking.host;
  const hostUser = hostRow?.user
    ? Array.isArray(hostRow.user)
      ? hostRow.user[0]
      : hostRow.user
    : null;
  const mt = Array.isArray(booking.meeting_type)
    ? booking.meeting_type[0]
    : booking.meeting_type;

  // Best-effort GCal cleanup.
  const cancelGToken = booking.google_event_id ? await hostGoogleToken(booking.host_id) : null;
  if (booking.google_event_id && cancelGToken) {
    try {
      const { data: cal } = await adminClient
        .from('meet_calendar')
        .select('google_calendar_id')
        .eq('host_id', booking.host_id)
        .in('role', ['primary', 'write_target'])
        .limit(1)
        .maybeSingle();
      await deleteEvent(
        cancelGToken,
        cal?.google_calendar_id ?? 'primary',
        booking.google_event_id,
      );
    } catch (e) {
      console.error('[meet bookings/cancel] google delete failed (non-fatal)', e);
    }
  }

  // Cancellation emails.
  if (mt && hostRow) {
    const common: EmailCommon = {
      inviteeName: booking.invitee_name,
      inviteeEmail: booking.invitee_email,
      hostName: hostUser?.full_name ?? hostRow.slug ?? 'your host',
      hostEmail: hostUser?.email ?? null,
      meetingName: mt.name,
      startsAt: new Date(booking.starts_at),
      endsAt: new Date(booking.ends_at),
      hostTimezone: hostRow.timezone ?? 'UTC',
      meetUrl: booking.meet_url,
      location: booking.alternative_location ?? mt.default_location ?? null,
      bookingId: booking.id,
      meetAppUrl: meetAppUrl(),
      hostSlug: hostRow.slug ?? '',
      meetingTypeSlug: mt.slug ?? '',
    };
    try {
      const m = bookingCancellation(common, 'invitee');
      await sendEmail({
        to: booking.invitee_email,
        subject: m.subject,
        text: m.text,
        html: m.html,
        replyTo: common.hostEmail ?? undefined,
      });
    } catch (e) {
      console.error('[meet bookings/cancel] invitee email failed (non-fatal)', e);
    }
    if (common.hostEmail) {
      try {
        const m = bookingCancellation(common, 'host');
        await sendEmail({
          to: common.hostEmail,
          subject: m.subject,
          text: m.text,
          html: m.html,
        });
      } catch (e) {
        console.error('[meet bookings/cancel] host email failed (non-fatal)', e);
      }
    }
  }

  return c.json({ ok: true });
});

// GET /api/v1/meet/public/bookings/:id  → minimal confirmation payload
meetRoutes.get('/public/bookings/:id', async (c) => {
  const id = c.req.param('id');
  const { data, error } = await adminClient
    .from('meet_booking')
    .select(
      'id, invitee_email, invitee_name, starts_at, ends_at, status, conferencing_provider, alternative_location, payment_status, stripe_invoice_url, meeting_type:meeting_type_id (name, duration_minutes, host:host_id (slug, user:user_id (full_name)))',
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
  // Connections are a user-level SPoT surfaced in more than one app — the
  // callback returns to whichever app started the flow.
  const returnTo = c.req.query('return') === 'thread' ? 'thread' : 'meet';
  const state = await new SignJWT({
    user_id: ctx.userId,
    workspace_id: ctx.workspaceId,
    return_to: returnTo,
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
    return c.redirect(`${meetUrl}/settings/integrations?google=error&reason=missing`);
  }
  let userId: string;
  let workspaceId: string;
  // /settings/integrations is the page that reads ?google=/?reason=.
  let settingsUrl = `${meetUrl}/settings/integrations`;
  try {
    const { payload } = await jwtVerify(state, stateSecret());
    userId = payload.user_id as string;
    workspaceId = payload.workspace_id as string;
    if (payload.return_to === 'thread') {
      const threadUrl = process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.app';
      settingsUrl = `${threadUrl}/settings/connections`;
    }
    if (!userId || !workspaceId) throw new Error('bad state');
  } catch {
    return c.redirect(`${meetUrl}/settings/integrations?google=error&reason=state`);
  }

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch (e) {
    console.error('[google/auth-callback] exchange', e);
    return c.redirect(`${settingsUrl}?google=error&reason=exchange`);
  }

  // Persist the refresh token at platform level (user_connection).
  const { error: hErr } = await saveGoogleToken(userId, tokens.refreshToken);
  if (hErr) {
    console.error('[google/auth-callback] save token', hErr);
    return c.redirect(`${settingsUrl}?google=error&reason=db`);
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

  return c.redirect(`${settingsUrl}?google=connected`);
});

// POST /api/v1/meet/google/disconnect — authenticated. Clears the host's
// refresh token and removes the meet_calendar rows.
meetRoutes.post('/google/disconnect', async (c) => {
  const ctx = c.get('ctx');
  // admin client (own row only): Thread-only users have no fibre-meet
  // membership, so the meet_* RLS would silently keep their calendar rows
  // (review 2026-07-05).
  const { data: host } = await adminClient
    .from('meet_host')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (host) {
    await adminClient.from('meet_calendar').delete().eq('host_id', host.id);
  }
  await saveGoogleToken(ctx.userId, null);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Uploads — profile photos etc. Public `fibre-assets` bucket; 5MB cap, same
// contract as the Thread uploads route (multipart "file" → { url }).
// ---------------------------------------------------------------------------

meetRoutes.post('/uploads', async (c) => {
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
    .from('fibre-assets')
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (error) {
    console.error('[meet/uploads] failed', error);
    return c.json({ error: error.message }, 500);
  }
  const { data } = adminClient.storage.from('fibre-assets').getPublicUrl(path);
  return c.json({ url: data.publicUrl }, 201);
});

// ---------------------------------------------------------------------------
// Connections — user-level SPoT (Google Calendar + personal meeting room).
// The data lives on the user's meet_host row but belongs to the whole Fibre
// family: Thread's Settings → Connections manages the same row Meet's does.
// ---------------------------------------------------------------------------

/** The user's own host row — provisioned on first touch (same defaults as /me). */
async function ensureHostRow(userId: string, workspaceId: string) {
  const { data: host } = await adminClient
    .from('meet_host')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (host) return host;
  const { data: u } = await adminClient
    .from('user')
    .select('email, full_name')
    .eq('id', userId)
    .single();
  const seed =
    (u?.full_name ?? u?.email ?? 'host')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'host';
  const slug = `${seed}-${Math.random().toString(36).slice(2, 5)}`;
  const { data: created, error } = await adminClient
    .from('meet_host')
    .insert({ user_id: userId, workspace_id: workspaceId, slug })
    .select('id')
    .single();
  if (error) {
    // Lost a provisioning race (user_id is unique) — take the winner's row.
    if (error.code === '23505') {
      const { data: winner } = await adminClient
        .from('meet_host')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      return winner ?? null;
    }
    console.error('[meet/connections] auto-provision failed', error);
  }
  return created ?? null;
}

meetRoutes.get('/connections', async (c) => {
  const ctx = c.get('ctx');
  // Host row still provisioned here — meet_calendar rows hang off it.
  const host = await ensureHostRow(ctx.userId, ctx.workspaceId);
  if (!host) return c.json({ error: 'failed to provision host' }, 500);
  return c.json({
    google_connected: !!(await userGoogleToken(ctx.userId)),
    personal_room_url: await userPersonalRoom(ctx.userId),
  });
});

const ConnectionsUpdate = z.object({
  personal_room_url: z.string().max(500).nullable().optional(),
});

meetRoutes.patch('/connections', async (c) => {
  const body = ConnectionsUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const host = await ensureHostRow(ctx.userId, ctx.workspaceId);
  if (!host) return c.json({ error: 'failed to provision host' }, 500);
  if ('personal_room_url' in body.data) {
    const { error } = await savePersonalRoom(ctx.userId, body.data.personal_room_url ?? null);
    if (error) return c.json({ error }, 500);
  }
  return c.json({ ok: true });
});

// ===========================================================================
// Internal team — workspace-level users who can sign in to Meet. Read-only
// list right now; invite goes through the team-member invite flow.
// ===========================================================================

meetRoutes.get('/internal-team', async (c) => {
  const ctx = c.get('ctx');
  // Resolve fibre-meet app id.
  const { data: meetApp } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'fibre-meet')
    .single();
  // All users in this workspace, with whether they have a fibre-meet membership.
  const { data: users, error } = await adminClient
    .from('user')
    .select('id, email, full_name, avatar_url, email_verified, created_at')
    .eq('workspace_id', ctx.workspaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  let memberships: { user_id: string }[] = [];
  if (meetApp) {
    const { data } = await adminClient
      .from('app_membership')
      .select('user_id')
      .eq('app_id', meetApp.id);
    memberships = data ?? [];
  }
  const meetUserIds = new Set(memberships.map((m) => m.user_id));
  // Pull workspace_member attributes in one go.
  const { data: wmRows } = await adminClient
    .from('workspace_member')
    .select('user_id, workspace_role, relationship_type, member_status')
    .eq('workspace_id', ctx.workspaceId);
  const wmByUser = new Map(
    (wmRows ?? []).map((w) => [
      w.user_id,
      {
        workspace_role: w.workspace_role as WorkspaceRole,
        relationship_type: w.relationship_type as 'internal' | 'external',
        member_status: w.member_status as string | null,
      },
    ]),
  );
  const items = (users ?? []).map((u) => {
    const wm = wmByUser.get(u.id);
    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      avatar_url: u.avatar_url,
      email_verified: u.email_verified,
      has_meet: meetUserIds.has(u.id),
      workspace_role: wm?.workspace_role ?? 'organiser',
      relationship_type: wm?.relationship_type ?? 'internal',
      member_status: wm?.member_status ?? null,
    };
  });
  return c.json({ items });
});

// PATCH /api/v1/meet/internal-team/:userId — admin-only edit of a workspace
// member's role / relationship / cosmetic status. Used by the internal-team
// page to flip Internal↔External or promote to admin.
const PatchInternalBody = z.object({
  // super_admin | admin | organiser — see lib/workspace-roles. This said
  // ['admin','member'] until v0.18.8, so the role dropdown on this screen
  // wrote a value the CHECK constraint rejects and the save 500'd.
  workspace_role: z.enum(['super_admin', 'admin', 'organiser']).optional(),
  relationship_type: z.enum(['internal', 'external']).optional(),
  member_status: z.string().max(80).nullable().optional(),
});
meetRoutes.patch('/internal-team/:userId', async (c) => {
  const userId = c.req.param('userId');
  const body = PatchInternalBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  // Admin-only.
  const { data: me } = await adminClient
    .from('workspace_member')
    .select('workspace_role')
    .eq('user_id', ctx.userId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!isAdminRole(me?.workspace_role)) {
    return c.json({ error: 'admin only' }, 403);
  }
  if (
    body.data.workspace_role &&
    (await wouldOrphanWorkspace(userId, ctx.workspaceId, body.data.workspace_role))
  ) {
    return c.json({ error: ORPHAN_ERROR }, 409);
  }
  // Ensure the row exists before patching.
  await ensureWorkspaceMember(userId, ctx.workspaceId, { role: 'organiser' });
  const updates: Record<string, unknown> = {};
  if (body.data.workspace_role) updates.workspace_role = body.data.workspace_role;
  if (body.data.relationship_type) updates.relationship_type = body.data.relationship_type;
  if (body.data.member_status !== undefined) updates.member_status = body.data.member_status;
  const { data, error } = await adminClient
    .from('workspace_member')
    .update(updates)
    .eq('user_id', userId)
    .eq('workspace_id', ctx.workspaceId)
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

const InviteInternalBody = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().max(200).optional(),
  relationship_type: z.enum(['internal', 'external']).optional(),
});

// POST /api/v1/meet/internal-team — invite a workspace-level Meet user.
// Mirrors the team-member invite flow but only grants fibre-meet; it does
// not add them to any team.
meetRoutes.post('/internal-team', async (c) => {
  const body = InviteInternalBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');

  // Existing user in this workspace?
  let { data: u } = await adminClient
    .from('user')
    .select('id, email, full_name, workspace_id')
    .eq('email', body.data.email)
    .is('deleted_at', null)
    .maybeSingle();
  if (u && u.workspace_id !== ctx.workspaceId) {
    return c.json(
      { error: 'that email already belongs to another Fibre workspace' },
      409,
    );
  }
  let invited = false;
  if (!u) {
    invited = true;
    const personId = await ensurePersonForEmail(
      ctx.workspaceId,
      body.data.email,
      body.data.name ?? null,
    );
    const { data: created, error: cErr } = await adminClient
      .from('user')
      .insert({
        workspace_id: ctx.workspaceId,
        person_id: personId,
        email: body.data.email,
        full_name: body.data.name ?? null,
        primary_auth_method: 'google',
        email_verified: false,
      })
      .select('id, email, full_name, workspace_id')
      .single();
    if (cErr || !created) {
      console.error('[internal-team] pending user create failed', cErr);
      return c.json({ error: cErr?.message ?? 'create failed' }, 500);
    }
    u = created;
    if (personId) {
      await adminClient
        .from('person')
        .update({ user_id: u.id })
        .eq('id', personId);
    }
  } else {
    await linkPersonIfMissing(u.id, ctx.workspaceId, u.email, u.full_name);
  }
  // Grant fibre-meet app_membership (member role).
  const { data: meetApp } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'fibre-meet')
    .single();
  if (meetApp) {
    await adminClient
      .from('app_membership')
      .upsert(
        { user_id: u.id, app_id: meetApp.id, role: 'member' },
        { onConflict: 'user_id,app_id' },
      );
  }
  // Workspace membership: fresh users use the requested relationship_type
  // (defaults to internal). Existing users keep whatever they had.
  await ensureWorkspaceMember(u.id, ctx.workspaceId, {
    role: 'organiser',
    relationship: invited ? body.data.relationship_type ?? 'internal' : 'internal',
  });
  // Best-effort invite email.
  if (invited) {
    try {
      const { data: inviter } = await adminClient
        .from('user')
        .select('full_name, email')
        .eq('id', ctx.userId)
        .single();
      const inviterName = inviter?.full_name ?? inviter?.email ?? 'a teammate';
      const signInUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://thefibre.app';
      await sendEmail({
        to: u.email,
        subject: `${inviterName} invited you to ${MEET.name}`,
        text: `${inviterName} added you to their ${PLATFORM.name} workspace and granted you access to ${MEET.name}.\n\nSign in at ${signInUrl} (using ${u.email}) to start using ${MEET.shortName}.\n\n${emailSignoff()}`,
        html: `<p><strong>${inviterName}</strong> invited you to ${MEET.name}.</p><p><a href="${signInUrl}">Sign in to ${PLATFORM.name}</a> using <strong>${u.email}</strong>.</p>`,
      });
    } catch (e) {
      console.error('[internal-team] invite email failed (non-fatal)', e);
    }
  }
  return c.json({ id: u.id, email: u.email, full_name: u.full_name, invited }, 201);
});

// ===========================================================================
// Contacts — people Meet has a reason to know about.
//
// Brief §5 ("the app justifies the field") and §13 (data wall): Meet is
// scoped to its own slice of the contact graph, not the whole workspace.
// A person appears here iff at least one of:
//   * they've been an invitee on a meet_booking, OR
//   * they're a member of a team in this workspace
// The `source` field on each row explains *why* they're surfaced, so the
// UI can show the justification (and so future audits can replay it).
// ===========================================================================

meetRoutes.get('/contacts', async (c) => {
  const ctx = c.get('ctx');
  const url = new URL(c.req.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

  // 1) Booking summary per invitee email in this workspace.
  const { data: bookings } = await adminClient
    .from('meet_booking')
    .select('invitee_email, starts_at')
    .eq('workspace_id', ctx.workspaceId)
    .order('starts_at', { ascending: false })
    .limit(5000);
  const bookingSummary = new Map<string, { last: string; count: number }>();
  for (const b of bookings ?? []) {
    const email = (b.invitee_email ?? '').toLowerCase();
    if (!email) continue;
    const cur = bookingSummary.get(email);
    if (!cur) bookingSummary.set(email, { last: b.starts_at, count: 1 });
    else cur.count += 1;
  }

  // 2) Team-member user_ids in this workspace.
  const { data: teamRows } = await adminClient
    .from('team_member')
    .select('user_id, team:team!inner(workspace_id)')
    .eq('team.workspace_id', ctx.workspaceId);
  const teamUserIds = new Set<string>(
    (teamRows ?? []).map((r) => r.user_id as string).filter(Boolean),
  );

  // 3) Fetch persons that match either source.
  const bookingEmails = Array.from(bookingSummary.keys());
  const teamIds = Array.from(teamUserIds);
  if (bookingEmails.length === 0 && teamIds.length === 0) {
    return c.json({ items: [] });
  }

  // PostgREST `or` filter: email in (...) or user_id in (...).
  const orClauses: string[] = [];
  if (bookingEmails.length) {
    orClauses.push(`email.in.(${bookingEmails.map((e) => `"${e}"`).join(',')})`);
  }
  if (teamIds.length) {
    orClauses.push(`user_id.in.(${teamIds.join(',')})`);
  }
  const { data: people, error } = await adminClient
    .from('person')
    .select('id, email, first_name, last_name, user_id')
    .eq('workspace_id', ctx.workspaceId)
    .is('deleted_at', null)
    .or(orClauses.join(','))
    .limit(5000);
  if (error) return c.json({ error: error.message }, 500);

  let items = (people ?? []).map((p) => {
    const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ');
    const name = fullName.length ? fullName : null;
    const email = (p.email ?? '').toLowerCase();
    const s = email ? bookingSummary.get(email) : undefined;
    const isTeamMember = !!p.user_id && teamUserIds.has(p.user_id);
    const sources: string[] = [];
    if (s) sources.push('booking');
    if (isTeamMember) sources.push('team');
    const domain = p.email && p.email.includes('@')
      ? p.email.split('@')[1] ?? null
      : null;
    return {
      id: p.id,
      name,
      email: p.email,
      domain,
      is_user: !!p.user_id,
      is_team_member: isTeamMember,
      meet_bookings: s?.count ?? 0,
      meet_last_booked_at: s?.last ?? null,
      source: sources,
    };
  });

  if (q) {
    items = items.filter(
      (c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.domain ?? '').toLowerCase().includes(q),
    );
  }
  items.sort((a, b) => (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? ''));
  return c.json({ items });
});

// ===========================================================================
// Calendars — list the current user's meet_calendar rows + their role, and
// update a row's role. Connected by the Google OAuth flow; users tune which
// calendars block bookings and which receive new events.
// ===========================================================================

// POST /api/v1/meet/calendars/sync — re-pulls the calendar list from Google
// and upserts any newly-visible calendars as conflict_check. Doesn't touch
// rows the user has already assigned a role to.
meetRoutes.post('/calendars/sync', async (c) => {
  const ctx = c.get('ctx');
  const { data: host } = await adminClient
    .from('meet_host')
    .select('id, google_refresh_token, workspace_id')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!host) return c.json({ error: 'host not found' }, 404);
  const syncGToken = await userGoogleToken(ctx.userId);
  if (!syncGToken) {
    return c.json({ error: 'google not connected' }, 400);
  }
  try {
    const remote = await listCalendars(syncGToken);
    let added = 0;
    for (const cal of remote) {
      if (!cal.id) continue;
      const role = cal.primary ? 'primary' : 'conflict_check';
      const { data: existing } = await adminClient
        .from('meet_calendar')
        .select('id')
        .eq('host_id', host.id)
        .eq('google_calendar_id', cal.id)
        .maybeSingle();
      if (existing) continue;
      const { error } = await adminClient.from('meet_calendar').insert({
        host_id: host.id,
        workspace_id: host.workspace_id,
        google_calendar_id: cal.id,
        summary: cal.summary,
        role,
      });
      if (!error) added += 1;
    }
    return c.json({ ok: true, found: remote.length, added });
  } catch (e) {
    console.error('[meet/calendars/sync] failed', e);
    return c.json(
      { error: e instanceof Error ? e.message : 'sync failed' },
      500,
    );
  }
});

meetRoutes.get('/calendars', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: host } = await db
    .from('meet_host')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!host) return c.json({ items: [] });
  const { data, error } = await db
    .from('meet_calendar')
    .select('id, google_calendar_id, summary, role, created_at')
    .eq('host_id', host.id)
    .order('role', { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

const CalendarRolePatch = z.object({
  role: z.enum(['primary', 'conflict_check', 'write_target', 'ignore']),
});
meetRoutes.patch('/calendars/:id', async (c) => {
  const id = c.req.param('id');
  const body = CalendarRolePatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  // Look up the host first so we can clear conflicting roles atomically.
  const { data: host } = await db
    .from('meet_host')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!host) return c.json({ error: 'host not found' }, 404);

  // primary and write_target are at-most-one. If we're setting one of those,
  // demote any existing holder to conflict_check first.
  if (body.data.role === 'primary' || body.data.role === 'write_target') {
    await db
      .from('meet_calendar')
      .update({ role: 'conflict_check' })
      .eq('host_id', host.id)
      .eq('role', body.data.role);
  }

  const { data, error } = await db
    .from('meet_calendar')
    .update({ role: body.data.role })
    .eq('id', id)
    .eq('host_id', host.id)
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
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

  // Don't return the raw refresh token. Surface a boolean.
  const { google_refresh_token, ...safe } = host as Record<string, unknown> & {
    google_refresh_token: string | null;
  };
  // One profile, and it is the platform's (20260901140000). meet_host.bio and
  // .photo_url are read fallbacks for anything not yet migrated; nothing
  // writes them. The host row keeps what is genuinely Meet's: the slug its
  // booking page lives at, working hours, the room.
  const profile = await profileFor(ctx.userId);

  return c.json({
    ...safe,
    display_name: profile?.display_name ?? null,
    bio: profile?.bio ?? (safe as { bio?: string | null }).bio ?? null,
    photo_url: profile?.photo_url ?? (safe as { photo_url?: string | null }).photo_url ?? null,
    timezone: profile?.timezone ?? (safe as { timezone?: string | null }).timezone ?? null,
    personal_room_url: await userPersonalRoom(ctx.userId),
    // Payments SPoT — user_profile first, the old column only as fallback.
    stripe_account_id: await personalStripeAccount(ctx.userId),
    google_connected: !!(await userGoogleToken(ctx.userId)),
  });
});

// PATCH /api/v1/meet/me — update host config
const HostUpdate = z.object({
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(SLUG_PATTERN, 'lowercase letters, digits, hyphens; no leading/trailing hyphen')
    .refine((s) => !isReservedSlug(s), {
      message: `reserved word — pick something else (reserved: ${[...RESERVED_SLUGS].sort().slice(0, 8).join(', ')}…)`,
    })
    .optional(),
  bio: z.string().max(2000).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  personal_room_url: z.string().max(500).nullable().optional(),
  timezone: z.string().max(100).optional(),
  working_hours: z.record(z.array(z.object({ start: z.string(), end: z.string() }))).nullable().optional(),
  photo_url: z.string().max(500).nullable().optional(),
  // (stripe_account_id intentionally NOT accepted — payments are a
  // platform SPoT; Settings → Payments writes /api/v1/profile.)
  // Host-level default for new MTs. Per-MT override lives on
  // meet_meeting_type.requires_approval (nullable).
  requires_approval: z.boolean().optional(),
});

meetRoutes.patch('/me', async (c) => {
  const body = HostUpdate.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    console.error('[meet/me PATCH] zod rejection', body.error.flatten());
    return c.json({ error: body.error.flatten() }, 400);
  }
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  // personal_room_url is platform-level (connections SPoT) — split it off.
  const { personal_room_url: roomPatch, ...hostPatch } = body.data;
  if ('personal_room_url' in body.data) {
    const { error: roomErr } = await savePersonalRoom(ctx.userId, roomPatch ?? null);
    if (roomErr) return c.json({ error: roomErr }, 500);
  }
  if (Object.keys(hostPatch).length === 0) {
    const { data: current } = await db
      .from('meet_host')
      .select('*')
      .eq('user_id', ctx.userId)
      .single();
    // Same contract as GET /me: never return the raw refresh token, and
    // report the platform personal room (review 2026-07-05).
    const { google_refresh_token: _t1, ...safeCurrent } = (current ?? {}) as Record<string, unknown>;
    return c.json({ ...safeCurrent, personal_room_url: await userPersonalRoom(ctx.userId) });
  }
  const { data, error } = await db
    .from('meet_host')
    .update(hostPatch)
    .eq('user_id', ctx.userId)
    .select('*')
    .single();
  if (error) {
    console.error('[meet/me PATCH] update failed', {
      userId: ctx.userId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      keys: Object.keys(body.data),
    });
    return c.json({ error: error.message, code: error.code, details: error.details }, 500);
  }
  // Same contract as GET /me: strip the token, overlay the platform room.
  const { google_refresh_token: _t2, ...safeData } = (data ?? {}) as Record<string, unknown>;
  return c.json({ ...safeData, personal_room_url: await userPersonalRoom(ctx.userId) });
});

// GET /api/v1/meet/meeting-types — list mine.
// Returns both personal types (host_id = my host) and team-owned types for
// any team I'm a member of.
meetRoutes.get('/meeting-types', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: host } = await db
    .from('meet_host')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  // Team ids the user is a member of.
  const { data: memberships } = await db
    .from('team_member')
    .select('team_id')
    .eq('user_id', ctx.userId);
  const teamIds = (memberships ?? []).map((m) => m.team_id);

  // Build the OR filter. If neither personal nor team membership exists, no rows.
  if (!host && teamIds.length === 0) return c.json({ items: [] });
  const orParts: string[] = [];
  if (host) orParts.push(`and(host_id.eq.${host.id},team_id.is.null)`);
  if (teamIds.length > 0) orParts.push(`team_id.in.(${teamIds.join(',')})`);
  const { data, error } = await db
    .from('meet_meeting_type')
    .select('*, team:team_id (id, name, slug), intake_form:intake_form_id (id, name, fields)')
    .or(orParts.join(','))
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

const MeetingTypeUpsert = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(SLUG_PATTERN, 'lowercase letters, digits, hyphens; no leading/trailing hyphen')
    .refine((s) => !isReservedSlug(s), {
      message: 'reserved word — would collide with a Meet route',
    }),
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
  is_public_listed: z.boolean().optional(),
  // Approval mode. NULL = inherit from meet_host.requires_approval;
  // true/false = explicit override on this MT.
  requires_approval: z.boolean().nullable().optional(),
  // Pricing — Phase 2 of the payments roadmap. Free MTs send null/0.
  // Stripe lower-bound is ~50¢; we keep validation simple here and let
  // the Checkout API surface specific minimums later in Phase 3.
  price_cents: z.number().int().min(0).max(100_000_00).nullable().optional(),
  price_currency: z
    .string()
    .regex(/^[a-z]{3}$/, 'Currency must be a 3-letter ISO code (e.g. eur)')
    .nullable()
    .optional(),
  // When set, the meeting type lives under the team's slug instead of the
  // host's. The caller must be a lead of the team.
  team_id: z.string().uuid().nullable().optional(),
  // Event-routing strategy. Only team-owned types may use round_robin or
  // collective in phase 1.
  event_type: z
    .enum(['one_on_one', 'round_robin', 'collective', 'group', 'one_off', 'poll'])
    .optional(),
  // Fixed window for event_type='one_off'. Both must be present together,
  // ends_at > starts_at. NULL otherwise.
  fixed_starts_at: z.string().datetime().nullable().optional(),
  fixed_ends_at: z.string().datetime().nullable().optional(),
  // Per-MT availability override (Schedule shape). NULL = use host's default.
  working_hours_override: z
    .record(z.array(z.object({ start: z.string(), end: z.string() })))
    .nullable()
    .optional(),
  // Per-MT conflict-calendar override. NULL = use host's defaults.
  conflict_calendar_ids: z.array(z.string().uuid()).nullable().optional(),
  // Capacity for event_type='group' — max invitees per slot. NULL or absent
  // means uncapped (only meaningful when event_type='group').
  capacity: z.number().int().min(1).max(1000).nullable().optional(),
});

meetRoutes.post('/meeting-types', async (c) => {
  const body = MeetingTypeUpsert.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  // Same NOT NULL coercion as PATCH — see comment there.
  if (body.data.conflict_calendar_ids === null) body.data.conflict_calendar_ids = [];
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: host } = await db
    .from('meet_host')
    .select('id, workspace_id, stripe_account_id')
    .eq('user_id', ctx.userId)
    .single();
  if (!host) return c.json({ error: 'host not found' }, 404);

  // Phase 2 guard: a paid MT requires a Stripe Connect account on the host.
  if (
    body.data.price_cents &&
    body.data.price_cents > 0 &&
    !host.stripe_account_id
  ) {
    return c.json(
      { error: 'connect Stripe in Settings → Payments before setting a price' },
      400,
    );
  }

  // If team-owned, verify current user is a lead of that team. RLS would
  // technically accept the row (only workspace+app-membership are checked on
  // meet_meeting_type), so we have to enforce lead-ness here.
  if (body.data.team_id) {
    const { data: membership } = await adminClient
      .from('team_member')
      .select('role')
      .eq('team_id', body.data.team_id)
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if (!membership || membership.role !== 'lead') {
      return c.json({ error: 'not a lead of this team' }, 403);
    }
  }

  const { data, error } = await db
    .from('meet_meeting_type')
    .insert({ ...body.data, host_id: host.id, workspace_id: host.workspace_id })
    .select('*')
    .single();
  if (error) return c.json({ error: error.message, code: error.code }, 500);
  return c.json(data, 201);
});

// ---------------------------------------------------------------------------
// PUT /api/v1/meet/meeting-types/:id/intake — replace the intake-form fields
// attached to this MT. Idempotent. Creates a new meet_intake_form row on
// first save, then overwrites .fields on subsequent saves. Empty array =
// detach the form (sets intake_form_id back to NULL).
// ---------------------------------------------------------------------------
const IntakeFieldsBody = z.object({
  fields: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/),
        label: z.string().trim().min(1).max(120),
        type: z.enum(['short', 'long', 'email', 'select', 'checkbox']),
        required: z.boolean(),
        options: z.array(z.string().trim().min(1).max(80)).optional(),
        conditionalOn: z
          .object({ fieldKey: z.string().min(1), equals: z.string().min(1) })
          .optional(),
      }),
    )
    .max(40),
});

meetRoutes.put('/meeting-types/:id/intake', async (c) => {
  const id = c.req.param('id');
  const body = IntakeFieldsBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // Find the MT + its current intake_form_id.
  const { data: mt, error: mtErr } = await db
    .from('meet_meeting_type')
    .select('id, host_id, workspace_id, intake_form_id, name')
    .eq('id', id)
    .single();
  if (mtErr || !mt) return c.json({ error: 'meeting type not found' }, 404);

  // Empty fields → detach + clean up the old form row.
  if (body.data.fields.length === 0) {
    if (mt.intake_form_id) {
      await db.from('meet_meeting_type').update({ intake_form_id: null }).eq('id', id);
      await db.from('meet_intake_form').delete().eq('id', mt.intake_form_id);
    }
    return c.json({ ok: true, intake_form_id: null });
  }

  // Existing form: just overwrite the fields. New form: create + link.
  if (mt.intake_form_id) {
    const { error } = await db
      .from('meet_intake_form')
      .update({ fields: body.data.fields })
      .eq('id', mt.intake_form_id);
    if (error) {
      console.error('[mt/intake] update form failed', error);
      return c.json({ error: error.message }, 500);
    }
    return c.json({ ok: true, intake_form_id: mt.intake_form_id });
  }
  const { data: form, error: insErr } = await db
    .from('meet_intake_form')
    .insert({
      workspace_id: mt.workspace_id,
      host_id: mt.host_id,
      name: `${mt.name} intake`,
      fields: body.data.fields,
    })
    .select('id')
    .single();
  if (insErr || !form) {
    console.error('[mt/intake] insert form failed', insErr);
    return c.json({ error: insErr?.message ?? 'failed' }, 500);
  }
  const { error: linkErr } = await db
    .from('meet_meeting_type')
    .update({ intake_form_id: form.id })
    .eq('id', id);
  if (linkErr) {
    console.error('[mt/intake] link form failed', linkErr);
    return c.json({ error: linkErr.message }, 500);
  }
  return c.json({ ok: true, intake_form_id: form.id });
});

meetRoutes.patch('/meeting-types/:id', async (c) => {
  const id = c.req.param('id');
  const body = MeetingTypeUpsert.partial().safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    console.error('[mt/patch] zod rejection', { id, errors: body.error.flatten() });
    return c.json({ error: body.error.flatten() }, 400);
  }
  // Schema gotcha: conflict_calendar_ids is NOT NULL DEFAULT '{}' but the
  // UI sends `null` to mean "use host default". Same applies to a few other
  // array columns the editor can clear. Coerce null → [] here so callers
  // (web, third-party apps) don't have to know which columns are nullable.
  if (body.data.conflict_calendar_ids === null) body.data.conflict_calendar_ids = [];
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);

  // Phase 2 guard: paid MT requires the host to have connected Stripe.
  if (body.data.price_cents && body.data.price_cents > 0) {
    const { data: host } = await adminClient
      .from('meet_host')
      .select('stripe_account_id')
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if (!host?.stripe_account_id) {
      return c.json(
        { error: 'connect Stripe in Settings → Payments before setting a price' },
        400,
      );
    }
  }

  // If the caller is moving the MT from personal → team (or between teams),
  // verify they're a lead of the destination team. Without this the PATCH
  // would silently succeed on a row they shouldn't own — and we previously
  // saw cases where the column came back null after PATCH because of an RLS
  // sub-policy interaction. Mirror the POST guard exactly.
  if (body.data.team_id) {
    const { data: membership } = await adminClient
      .from('team_member')
      .select('role')
      .eq('team_id', body.data.team_id)
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if (!membership || membership.role !== 'lead') {
      console.warn('[mt/patch] not lead of destination team', {
        id,
        userId: ctx.userId,
        team_id: body.data.team_id,
        membership,
      });
      return c.json({ error: 'not a lead of this team' }, 403);
    }
  }

  const { data, error } = await db
    .from('meet_meeting_type')
    .update(body.data)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    console.error('[mt/patch] update failed', {
      id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return c.json({ error: error.message, code: error.code, details: error.details }, 500);
  }
  return c.json(data);
});

// ===========================================================================
// POLL — candidate slots + invitee votes for event_type='poll' meeting types.
// ===========================================================================

const PollSlotsReplace = z.object({
  slots: z
    .array(
      z.object({
        starts_at: z.string().datetime(),
        ends_at: z.string().datetime(),
      }),
    )
    .min(2)
    .max(5),
});

// GET /api/v1/meet/meeting-types/:id/poll — slots + votes for the host UI.
meetRoutes.get('/meeting-types/:id/poll', async (c) => {
  const id = c.req.param('id');
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  // RLS on meet_meeting_type ensures this only works if the caller can see it.
  const { data: mt, error: mErr } = await db
    .from('meet_meeting_type')
    .select('id, event_type')
    .eq('id', id)
    .single();
  if (mErr || !mt) return c.json({ error: 'meeting type not found' }, 404);
  const [{ data: slots }, { data: votes }] = await Promise.all([
    db
      .from('meet_poll_slot')
      .select('starts_at, ends_at')
      .eq('meeting_type_id', id)
      .order('starts_at', { ascending: true }),
    db
      .from('meet_poll_vote')
      .select('voter_email, voter_name, slot_starts_at, created_at')
      .eq('meeting_type_id', id),
  ]);
  return c.json({ slots: slots ?? [], votes: votes ?? [] });
});

// PUT /api/v1/meet/meeting-types/:id/poll-slots — replace candidate slots.
meetRoutes.put('/meeting-types/:id/poll-slots', async (c) => {
  const id = c.req.param('id');
  const body = PollSlotsReplace.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  // Verify the caller can see the MT (RLS handles auth).
  const { data: mt, error: mErr } = await db
    .from('meet_meeting_type')
    .select('id')
    .eq('id', id)
    .single();
  if (mErr || !mt) return c.json({ error: 'meeting type not found' }, 404);
  // Replace: drop existing slots then insert new. Votes cascade with slot
  // removal? No — meet_poll_vote references the MT, not the slot. Stale votes
  // for removed slots become orphaned; the host UI just ignores them.
  const { error: dErr } = await adminClient
    .from('meet_poll_slot')
    .delete()
    .eq('meeting_type_id', id);
  if (dErr) return c.json({ error: dErr.message }, 500);
  const rows = body.data.slots.map((s) => ({
    meeting_type_id: id,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
  }));
  const { error: iErr } = await adminClient.from('meet_poll_slot').insert(rows);
  if (iErr) return c.json({ error: iErr.message }, 500);
  return c.json({ ok: true, slots: rows });
});

// POST /api/v1/meet/meeting-types/:id/confirm-poll-slot — host picks the
// winning slot. We create a normal meet_booking for one of the voters'
// emails (the host can re-invite the others manually); for v1 the chosen
// slot becomes one booking per voter who ticked it.
const ConfirmPollBody = z.object({
  starts_at: z.string().datetime(),
});
meetRoutes.post('/meeting-types/:id/confirm-poll-slot', async (c) => {
  const id = c.req.param('id');
  const body = ConfirmPollBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  // RLS gate.
  const { data: mt, error: mErr } = await db
    .from('meet_meeting_type')
    .select('id, event_type, host_id, workspace_id, duration_minutes')
    .eq('id', id)
    .single();
  if (mErr || !mt) return c.json({ error: 'meeting type not found' }, 404);
  if (mt.event_type !== 'poll') {
    return c.json({ error: 'not a poll meeting type' }, 400);
  }
  // Verify the slot was one of the candidates.
  const { data: slot } = await adminClient
    .from('meet_poll_slot')
    .select('starts_at, ends_at')
    .eq('meeting_type_id', id)
    .eq('starts_at', body.data.starts_at)
    .maybeSingle();
  if (!slot) return c.json({ error: 'slot is not a candidate' }, 404);
  // Flip the MT into a one_off + capacity = (number of voters who picked
  // this slot, max). We don't try to auto-create bookings here — the host
  // can do that with normal flow now that the MT has a fixed time.
  // Simpler v1: just mark the MT as one_off with the chosen window.
  const { error: uErr } = await adminClient
    .from('meet_meeting_type')
    .update({
      event_type: 'one_off',
      fixed_starts_at: slot.starts_at,
      fixed_ends_at: slot.ends_at,
    })
    .eq('id', id);
  if (uErr) return c.json({ error: uErr.message }, 500);
  // Clean up: votes + remaining poll slots stay in the table as history but
  // the MT no longer reads them. (Erasure handled via cascading FK on delete.)
  return c.json({ ok: true, converted_to: 'one_off' });
});

// POST /api/v1/meet/public/poll-votes — invitee submits their picks.
// Bypasses auth (public endpoint, like /public/bookings). Body shape:
//   { meeting_type_id, voter_email, voter_name, slot_starts_ats: string[] }
const PublicPollVoteBody = z.object({
  meeting_type_id: z.string().uuid(),
  voter_email: z.string().email().toLowerCase(),
  voter_name: z.string().min(1).max(200),
  slot_starts_ats: z.array(z.string().datetime()).min(1).max(5),
});
meetRoutes.post('/public/poll-votes', async (c) => {
  const body = PublicPollVoteBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const data = body.data;
  // Verify MT exists and is a poll.
  const { data: mt } = await adminClient
    .from('meet_meeting_type')
    .select('id, event_type, is_active')
    .eq('id', data.meeting_type_id)
    .single();
  if (!mt || !mt.is_active || mt.event_type !== 'poll') {
    return c.json({ error: 'poll not available' }, 404);
  }
  // Verify each ticked slot is actually a candidate.
  const { data: candidates } = await adminClient
    .from('meet_poll_slot')
    .select('starts_at')
    .eq('meeting_type_id', data.meeting_type_id);
  const valid = new Set((candidates ?? []).map((s) => new Date(s.starts_at).toISOString()));
  const filtered = data.slot_starts_ats.filter((s) => valid.has(new Date(s).toISOString()));
  if (filtered.length === 0) return c.json({ error: 'no valid slots ticked' }, 400);
  // Replace this voter's existing rows so re-submission overrides.
  await adminClient
    .from('meet_poll_vote')
    .delete()
    .eq('meeting_type_id', data.meeting_type_id)
    .eq('voter_email', data.voter_email);
  const rows = filtered.map((s) => ({
    meeting_type_id: data.meeting_type_id,
    voter_email: data.voter_email,
    voter_name: data.voter_name,
    slot_starts_at: s,
  }));
  const { error: iErr } = await adminClient.from('meet_poll_vote').insert(rows);
  if (iErr) {
    console.error('[poll-votes] insert failed', iErr);
    return c.json({ error: iErr.message }, 500);
  }
  return c.json({ ok: true, recorded: rows.length });
});

// ===========================================================================
// Deferred confirmation side-effects.
// Two flows write a booking with side-effects skipped:
//   - Approval flow (requires_approval=true): host approves via /approve.
//   - Paid flow (price_cents>0): invitee pays via Stripe Checkout, webhook
//     fires checkout.session.completed.
// Both ultimately call the same logic: create the Google Calendar event,
// send the branded confirmation email, write a meeting_booked activity.
// Extracted so the two paths stay in lockstep.
// ===========================================================================

async function runConfirmationSideEffects(
  bookingId: string,
): Promise<{ ok: boolean; meetUrl?: string | null }> {
  const { data: booking, error } = await loadBookingWithJoins(bookingId);
  if (error || !booking) {
    console.error('[meet confirm-side-effects] booking not found', { bookingId, error });
    return { ok: false };
  }
  const mt = Array.isArray(booking.meeting_type)
    ? booking.meeting_type[0]
    : booking.meeting_type;
  const hostRow = Array.isArray(booking.host) ? booking.host[0] : booking.host;
  const hostUser = hostRow?.user
    ? Array.isArray(hostRow.user)
      ? hostRow.user[0]
      : hostRow.user
    : null;
  if (!mt || !hostRow) return { ok: false };

  let meetUrl: string | null = null;
  const confirmGToken = await hostGoogleToken(booking.host_id);
  if (confirmGToken) {
    try {
      const { data: cal } = await adminClient
        .from('meet_calendar')
        .select('google_calendar_id')
        .eq('host_id', booking.host_id)
        .in('role', ['primary', 'write_target'])
        .limit(1)
        .maybeSingle();
      const calendarId = cal?.google_calendar_id ?? 'primary';
      const withMeet = mt.conferencing_provider === 'google_meet';
      const { eventId, meetUrl: m } = await createEvent(confirmGToken, {
        calendarId,
        summary: mt.name,
        description: mt.description ?? null,
        startsAt: new Date(booking.starts_at),
        endsAt: new Date(booking.ends_at),
        attendeeEmail: booking.invitee_email,
        attendeeName: booking.invitee_name,
        withMeet,
        location: booking.alternative_location ?? mt.default_location ?? null,
      });
      meetUrl = m ?? null;
      await adminClient
        .from('meet_booking')
        .update({ google_event_id: eventId, meet_url: meetUrl })
        .eq('id', bookingId);
    } catch (e) {
      console.error('[meet confirm-side-effects] google event failed (non-fatal)', e);
    }
  }

  // Confirmation email — branded shell, same as the auto-confirm path.
  const common: EmailCommon = {
    inviteeName: booking.invitee_name,
    inviteeEmail: booking.invitee_email,
    hostName: hostUser?.full_name ?? hostRow.slug ?? 'your host',
    hostEmail: hostUser?.email ?? null,
    meetingName: mt.name,
    startsAt: new Date(booking.starts_at),
    endsAt: new Date(booking.ends_at),
    hostTimezone: hostRow.timezone ?? 'UTC',
    meetUrl,
    location: booking.alternative_location ?? mt.default_location ?? null,
    bookingId: booking.id,
    meetAppUrl: meetAppUrl(),
    hostSlug: hostRow.slug ?? '',
    meetingTypeSlug: mt.slug ?? '',
  };
  try {
    const m = bookingConfirmationInvitee(common);
    await sendEmail({
      to: booking.invitee_email,
      subject: m.subject,
      text: m.text,
      html: m.html,
      replyTo: common.hostEmail ?? undefined,
    });
  } catch (e) {
    console.error('[meet confirm-side-effects] invitee email failed (non-fatal)', e);
  }
  if (common.hostEmail) {
    try {
      const m = bookingNotificationHost(common);
      await sendEmail({
        to: common.hostEmail,
        subject: m.subject,
        text: m.text,
        html: m.html,
        replyTo: booking.invitee_email,
      });
    } catch (e) {
      console.error('[meet confirm-side-effects] host email failed (non-fatal)', e);
    }
  }

  // Activity event for the platform timeline.
  const { data: app } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'fibre-meet')
    .single();
  if (app && booking.invitee_person_id) {
    await adminClient.from('activity').insert({
      workspace_id: booking.workspace_id,
      person_id: booking.invitee_person_id,
      app_id: app.id,
      type: 'meeting_booked',
      subject: `Meeting confirmed: ${booking.invitee_name}`,
      occurred_at: new Date().toISOString(),
    });
  }
  return { ok: true, meetUrl };
}

// ===========================================================================
// Stripe webhook — paid bookings.
//
// PUBLIC endpoint (no JWT). Stripe POSTs here; we verify the signature
// against STRIPE_WEBHOOK_SECRET before trusting any payload. The endpoint
// is registered in apps/api/src/middleware/app-context.ts's PUBLIC_PATHS.
//
// We listen for three events on connected accounts (Stripe Connect):
//   * checkout.session.completed       — flip payment_status='paid', confirm
//   * checkout.session.expired         — abandon: cancel the booking
//   * payment_intent.payment_failed    — same: cancel the booking
// ===========================================================================
meetRoutes.post('/stripe-webhook', async (c) => {
  const stripe = stripeOrNull();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.error('[meet stripe-webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET missing');
    return c.json({ error: 'webhook not configured' }, 503);
  }
  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'missing stripe-signature header' }, 400);
  const raw = await c.req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    console.error('[meet stripe-webhook] signature verification failed', e);
    return c.json({ error: 'invalid signature' }, 400);
  }

  async function abandonBookingForSession(sessionId: string, reason: string) {
    const { data: booking } = await adminClient
      .from('meet_booking')
      .select('id, status, payment_status')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();
    if (!booking) {
      console.warn('[meet stripe-webhook] no booking for session', { sessionId, reason });
      return;
    }
    if (booking.status === 'cancelled') return; // already done
    await adminClient
      .from('meet_booking')
      .update({ status: 'cancelled', payment_status: 'failed' })
      .eq('id', booking.id);
    const { data: bWs } = await adminClient
      .from('meet_booking')
      .select('workspace_id')
      .eq('id', booking.id)
      .maybeSingle();
    if (bWs) {
      await recordPurchase({
        appSlug: 'fibre-meet',
        workspaceId: bWs.workspace_id,
        itemRef: booking.id,
        status: 'failed',
      });
    }
    console.log('[meet stripe-webhook] booking abandoned', { id: booking.id, reason });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        id: string;
        payment_intent?: string | null;
        invoice?: string | null;
      };
      const { data: booking, error } = await adminClient
        .from('meet_booking')
        .select('id, payment_status, status')
        .eq('stripe_session_id', session.id)
        .maybeSingle();
      if (error) console.error('[meet stripe-webhook] booking lookup failed', error);
      if (!booking) {
        console.warn('[meet stripe-webhook] checkout.completed for unknown session', session.id);
        return c.json({ received: true });
      }
      if (booking.payment_status === 'paid') {
        const { data: app } = await adminClient
          .from('app')
          .select('id')
          .eq('slug', 'fibre-meet')
          .single();
        const { data: pRow } = await adminClient
          .from('purchase')
          .select('status')
          .eq('app_id', app!.id)
          .eq('item_ref', booking.id)
          .maybeSingle();
        if (pRow?.status === 'paid') return c.json({ received: true, idempotent: true });
      }

      // Resolve the hosted invoice URL if Stripe auto-created one.
      // invoice_creation.enabled=true on the session makes Stripe
      // generate a finalised Invoice synchronously; the session
      // carries the invoice id and we look up hosted_invoice_url.
      // Best-effort: a missing invoice (e.g. host not yet eligible
      // for invoice creation on their connected account) must not
      // block the booking confirmation.
      let stripeInvoiceId: string | null = null;
      let stripeInvoiceUrl: string | null = null;
      if (session.invoice && stripe) {
        try {
          // Fetch on the same connected account that created the session.
          // The header lives on Stripe.RawRequestOptions via stripeAccount.
          const ev = event as { account?: string };
          const invoice = await stripe.invoices.retrieve(
            session.invoice,
            undefined,
            ev.account ? { stripeAccount: ev.account } : undefined,
          );
          stripeInvoiceId = invoice.id ?? null;
          stripeInvoiceUrl = invoice.hosted_invoice_url ?? null;
        } catch (e) {
          console.warn('[meet stripe-webhook] invoice lookup failed', {
            session_id: session.id,
            invoice_id: session.invoice,
            err: (e as Error).message,
          });
        }
      }

      await adminClient
        .from('meet_booking')
        .update({
          payment_status: 'paid',
          stripe_payment_intent: session.payment_intent ?? null,
          stripe_invoice_id: stripeInvoiceId,
          stripe_invoice_url: stripeInvoiceUrl,
        })
        .eq('id', booking.id);
      {
        const { data: bFull } = await adminClient
          .from('meet_booking')
          .select('workspace_id')
          .eq('id', booking.id)
          .maybeSingle();
        if (bFull) {
          await recordPurchase({
            appSlug: 'fibre-meet',
            workspaceId: bFull.workspace_id,
            itemRef: booking.id,
            status: 'paid',
            stripeAccountId: (event as { account?: string }).account ?? null,
            stripePaymentIntent:
              typeof session.payment_intent === 'string' ? session.payment_intent : null,
            stripeInvoiceId,
            stripeInvoiceUrl,
          });
        }
      }
      // Run the deferred side-effects exactly like the approve path.
      await runConfirmationSideEffects(booking.id);
      return c.json({ received: true });
    }
    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as { id: string };
      await abandonBookingForSession(session.id, 'checkout.session.expired');
      return c.json({ received: true });
    }
    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as { id: string };
      // Try to find the booking via stripe_payment_intent if we already
      // captured it (rare on failure since we only set it on success), else
      // by the session that wraps this PI.
      const { data: booking } = await adminClient
        .from('meet_booking')
        .select('id, status, payment_status, stripe_session_id')
        .eq('stripe_payment_intent', pi.id)
        .maybeSingle();
      if (booking) {
        await adminClient
          .from('meet_booking')
          .update({ status: 'cancelled', payment_status: 'failed' })
          .eq('id', booking.id);
      }
      return c.json({ received: true });
    }
    // Unhandled event type — ack so Stripe doesn't retry.
    return c.json({ received: true, ignored: event.type });
  } catch (e) {
    console.error('[meet stripe-webhook] handler error', e);
    // Return 500 so Stripe retries — better than swallowing and losing the
    // payment confirmation.
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ===========================================================================
// Booking approval — when a meeting type requires approval, the booking sits
// in 'pending_approval'. The host then approves (runs the calendar + email
// side-effects skipped at booking time) or rejects (flips to 'cancelled').
// ===========================================================================

async function loadBookingWithJoins(id: string) {
  return adminClient
    .from('meet_booking')
    .select(
      'id, workspace_id, host_id, meeting_type_id, invitee_person_id, invitee_email, invitee_name, starts_at, ends_at, status, meet_url, google_event_id, alternative_location, meeting_type:meeting_type_id (id, name, slug, description, conferencing_provider, default_location), host:host_id (id, timezone, slug, user:user_id (full_name, email))',
    )
    .eq('id', id)
    .single();
}

meetRoutes.post('/bookings/:id/approve', async (c) => {
  const id = c.req.param('id');
  const ctx = c.get('ctx');

  // Verify the caller is the host on this booking. Use admin for the read
  // because RLS would otherwise scope by app_membership which is fine — but
  // the calendar token resolves via lib/connections at use time.
  const { data: booking, error } = await loadBookingWithJoins(id);
  if (error || !booking) return c.json({ error: 'booking not found' }, 404);
  const { data: callerHost } = await adminClient
    .from('meet_host')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!callerHost || callerHost.id !== booking.host_id) {
    return c.json({ error: 'only the host can approve' }, 403);
  }
  if (booking.status === 'confirmed') return c.json({ ok: true, already: true });
  if (booking.status !== 'pending_approval') {
    return c.json({ error: `cannot approve a booking in status ${booking.status}` }, 409);
  }

  // Flip status first so subsequent fetches reflect the new state.
  const { error: uErr } = await adminClient
    .from('meet_booking')
    .update({ status: 'confirmed' })
    .eq('id', id);
  if (uErr) {
    console.error('[meet bookings/approve] status flip failed', uErr);
    return c.json({ error: uErr.message }, 500);
  }

  // Calendar + email + activity via the shared helper.
  await runConfirmationSideEffects(id);
  return c.json({ ok: true });
});

const RejectBody = z.object({
  reason: z.string().max(500).optional(),
});

meetRoutes.post('/bookings/:id/reject', async (c) => {
  const id = c.req.param('id');
  const ctx = c.get('ctx');
  const body = RejectBody.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const { data: booking, error } = await loadBookingWithJoins(id);
  if (error || !booking) return c.json({ error: 'booking not found' }, 404);
  const { data: callerHost } = await adminClient
    .from('meet_host')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!callerHost || callerHost.id !== booking.host_id) {
    return c.json({ error: 'only the host can reject' }, 403);
  }
  if (booking.status === 'cancelled') return c.json({ ok: true, already: true });
  if (booking.status !== 'pending_approval') {
    return c.json({ error: `cannot reject a booking in status ${booking.status}` }, 409);
  }
  const { error: uErr } = await adminClient
    .from('meet_booking')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (uErr) return c.json({ error: uErr.message }, 500);

  const hostRow = Array.isArray(booking.host) ? booking.host[0] : booking.host;
  const hostUser = hostRow?.user
    ? Array.isArray(hostRow.user)
      ? hostRow.user[0]
      : hostRow.user
    : null;
  const mt = Array.isArray(booking.meeting_type)
    ? booking.meeting_type[0]
    : booking.meeting_type;
  if (mt && hostRow) {
    const hostName = hostUser?.full_name ?? hostRow.slug ?? 'your host';
    const reasonLine = body.data.reason
      ? `\n\nNote from ${hostName}: ${body.data.reason}\n`
      : '';
    try {
      await sendEmail({
        to: booking.invitee_email,
        subject: `Declined: ${mt.name}`,
        text: `Hi ${booking.invitee_name.split(' ')[0] ?? ''},\n\n${hostName} was unable to confirm your booking request for ${mt.name}.${reasonLine}\n${emailSignoff()}`,
        html: `<p>Hi ${escapeHtml(booking.invitee_name.split(' ')[0] ?? '')},</p><p>${escapeHtml(hostName)} was unable to confirm your booking request for <strong>${escapeHtml(mt.name)}</strong>.</p>${body.data.reason ? `<p><em>${escapeHtml(body.data.reason)}</em></p>` : ''}`,
        replyTo: hostUser?.email ?? undefined,
      });
    } catch (e) {
      console.error('[meet bookings/reject] invitee email failed (non-fatal)', e);
    }
  }
  return c.json({ ok: true });
});

// GET /api/v1/meet/bookings — bookings I host.
//   ?scope=upcoming|past|all  (default upcoming)
//   ?include_cancelled=1      (default 0 — confirmed only)
//   ?team_id=<uuid>           (filter to one team's MTs; "personal" → host_id only, no team)
meetRoutes.get('/bookings', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const url = new URL(c.req.url);
  const scope = (url.searchParams.get('scope') ?? 'upcoming') as
    | 'upcoming'
    | 'past'
    | 'all';
  const includeCancelled = url.searchParams.get('include_cancelled') === '1';
  const teamFilter = url.searchParams.get('team_id'); // uuid | 'personal' | null
  // Optional: ?invitee_email=foo@bar.com — used by the Meet contact popup
  // to list a single person's bookings.
  const inviteeEmail = url.searchParams.get('invitee_email')?.toLowerCase();

  const { data: host } = await db
    .from('meet_host')
    .select('id')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!host) return c.json({ items: [] });

  let q = db
    .from('meet_booking')
    .select(
      'id, invitee_email, invitee_name, starts_at, ends_at, status, meet_url, alternative_location, meeting_type:meeting_type_id (id, name, slug, team_id, team:team_id (id, name, slug))',
    )
    .eq('host_id', host.id);

  if (inviteeEmail) q = q.eq('invitee_email', inviteeEmail);

  const nowIso = new Date().toISOString();
  if (scope === 'upcoming') q = q.gte('ends_at', nowIso);
  else if (scope === 'past') q = q.lt('ends_at', nowIso);

  // Pending_approval bookings are always shown (the host needs to act on
  // them). "Include cancelled" just toggles whether cancelled rows appear.
  if (!includeCancelled) q = q.in('status', ['confirmed', 'pending_approval']);

  q = q
    .order('starts_at', { ascending: scope !== 'past' })
    .limit(200);

  const { data, error } = await q;
  if (error) return c.json({ error: error.message }, 500);

  let items = data ?? [];
  if (teamFilter) {
    items = items.filter((row) => {
      const mt = Array.isArray(row.meeting_type)
        ? row.meeting_type[0]
        : row.meeting_type;
      if (!mt) return false;
      if (teamFilter === 'personal') return !mt.team_id;
      return mt.team_id === teamFilter;
    });
  }
  return c.json({ items });
});

// ===========================================================================
// TEAMS — authenticated CRUD + member management.
// ===========================================================================

// GET /api/v1/meet/teams — list teams I'm an ACTIVE member of, with my role.
// Pending invites don't count; the user sees the team only after accepting.
meetRoutes.get('/teams', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: memberships, error } = await db
    .from('team_member')
    .select('role, team:team_id (id, slug, name, description, is_active, created_at)')
    .eq('user_id', ctx.userId)
    .eq('status', 'active');
  if (error) {
    console.error('[meet/teams] list failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return c.json({ error: error.message, code: error.code, details: error.details }, 500);
  }
  const items = (memberships ?? [])
    .map((m) => {
      const t = Array.isArray(m.team) ? m.team[0] : m.team;
      return t ? { ...t, my_role: m.role } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  return c.json({ items });
});

const TeamUpsert = z.object({
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(SLUG_PATTERN, 'lowercase letters, digits, hyphens; no leading/trailing hyphen')
    .refine((s) => !isReservedSlug(s), {
      message: 'reserved word — would collide with a Meet route',
    }),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
  visibility: z.enum(['members_only', 'org_wide']).optional(),
});

// POST /api/v1/meet/teams — create a team. Creator becomes lead.
meetRoutes.post('/teams', async (c) => {
  const body = TeamUpsert.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  // Use admin client so the team and the lead-membership row land atomically
  // before RLS could trip on either. We re-check workspace + app-membership
  // explicitly below.
  const { data: hasMembership } = await adminClient
    .from('app_membership')
    .select('user_id, app:app_id (slug)')
    .eq('user_id', ctx.userId);
  const ok = (hasMembership ?? []).some((m) => {
    const a = Array.isArray(m.app) ? m.app[0] : m.app;
    return a?.slug === 'fibre-meet';
  });
  if (!ok) return c.json({ error: 'fibre-meet membership required' }, 403);

  // Reject slug collisions with existing host slugs.
  const { data: clash } = await adminClient
    .from('meet_root_slug')
    .select('slug')
    .eq('workspace_id', ctx.workspaceId)
    .eq('slug', body.data.slug)
    .maybeSingle();
  if (clash) return c.json({ error: 'slug taken' }, 409);

  const { data: team, error } = await adminClient
    .from('team')
    .insert({
      workspace_id: ctx.workspaceId,
      slug: body.data.slug,
      name: body.data.name,
      description: body.data.description ?? null,
      is_active: body.data.is_active ?? true,
      created_by: ctx.userId,
    })
    .select('*')
    .single();
  if (error || !team) {
    console.error('[teams] create failed', error);
    return c.json({ error: error?.message ?? 'create failed' }, 500);
  }
  // Creator becomes lead.
  const { error: mErr } = await adminClient
    .from('team_member')
    .insert({ team_id: team.id, user_id: ctx.userId, role: 'lead' });
  if (mErr) {
    console.error('[teams] auto-lead failed', mErr);
  }
  return c.json(team, 201);
});

// Helper: assert current user is a lead of the team.
async function assertLead(teamId: string, userId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('team_member')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.role === 'lead';
}

// GET /api/v1/meet/teams/:id — team detail + members + meeting types
meetRoutes.get('/teams/:id', async (c) => {
  const id = c.req.param('id');
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: team, error } = await db
    .from('team')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !team) return c.json({ error: 'team not found' }, 404);
  const { data: members } = await db
    .from('team_member')
    .select(
      'role, status, invite_token, invited_at, created_at, user:user_id (id, email, full_name, avatar_url)',
    )
    .eq('team_id', id);
  const { data: mts } = await db
    .from('meet_meeting_type')
    .select('*')
    .eq('team_id', id)
    .order('created_at', { ascending: true });
  // What's my role?
  const myMembership = (members ?? []).find((m) => {
    const u = Array.isArray(m.user) ? m.user[0] : m.user;
    return u?.id === ctx.userId;
  });
  return c.json({
    ...team,
    members: members ?? [],
    meeting_types: mts ?? [],
    my_role: myMembership?.role ?? null,
  });
});

// PATCH /api/v1/meet/teams/:id — leads only
meetRoutes.patch('/teams/:id', async (c) => {
  const id = c.req.param('id');
  const body = TeamUpsert.partial().safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  if (!(await assertLead(id, ctx.userId))) {
    return c.json({ error: 'leads only' }, 403);
  }
  // Slug change -> recheck namespace.
  if (body.data.slug) {
    const { data: clash } = await adminClient
      .from('meet_root_slug')
      .select('slug, team_id, host_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('slug', body.data.slug)
      .maybeSingle();
    if (clash && clash.team_id !== id) {
      return c.json({ error: 'slug taken' }, 409);
    }
  }
  const { data, error } = await adminClient
    .from('team')
    .update(body.data)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// POST /api/v1/meet/teams/:id/members — add by email. Leads only.
//
// If no user exists for this email in the inviter's workspace, we create a
// pending user row (no auth link yet), grant fibre-meet app_membership, and
// send them an invite email. When they next sign in with Google, the
// access-check route matches by email and places them in this workspace; the
// SSO resolver then links the Google identity to the pre-created user row.
//
// Email addresses already present in OTHER workspaces are rejected — we
// don't move users across workspaces silently.
const AddMemberBody = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().max(200).optional(),
  role: z.enum(['lead', 'member']).optional(),
  // Workspace-level relationship (defaults to 'internal' if omitted).
  // Only meaningful for brand-new users; ignored for existing workspace members.
  relationship_type: z.enum(['internal', 'external']).optional(),
});
meetRoutes.post('/teams/:id/members', async (c) => {
  const id = c.req.param('id');
  const body = AddMemberBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  if (!(await assertLead(id, ctx.userId))) {
    return c.json({ error: 'leads only' }, 403);
  }

  // 1. User already in this workspace?
  let { data: u } = await adminClient
    .from('user')
    .select('id, email, full_name, workspace_id')
    .eq('email', body.data.email)
    .is('deleted_at', null)
    .maybeSingle();

  let invited = false;
  if (u && u.workspace_id !== ctx.workspaceId) {
    return c.json(
      { error: 'that email already belongs to another Fibre workspace' },
      409,
    );
  }

  if (!u) {
    // 2. Create a pending user + matching person in this workspace, and
    //    link them. Everybody in the workspace shows up in the platform
    //    contact graph (brief §2): user is "can sign in", person is
    //    "presence in the workspace's contact graph". Both, always linked.
    invited = true;
    const personId = await ensurePersonForEmail(
      ctx.workspaceId,
      body.data.email,
      body.data.name ?? null,
    );
    const { data: created, error: cErr } = await adminClient
      .from('user')
      .insert({
        workspace_id: ctx.workspaceId,
        person_id: personId,
        email: body.data.email,
        full_name: body.data.name ?? null,
        primary_auth_method: 'google',
        email_verified: false,
      })
      .select('id, email, full_name, workspace_id')
      .single();
    if (cErr || !created) {
      console.error('[teams/members] pending user create failed', cErr);
      return c.json({ error: cErr?.message ?? 'create failed' }, 500);
    }
    u = created;
    // Backfill person.user_id (the contact graph row points back to the user).
    if (personId) {
      await adminClient
        .from('person')
        .update({ user_id: u.id })
        .eq('id', personId);
    }

    // 3. Grant fibre-meet app_membership so they land with Meet on first sign-in.
    const { data: meetApp } = await adminClient
      .from('app')
      .select('id')
      .eq('slug', 'fibre-meet')
      .single();
    if (meetApp) {
      await adminClient
        .from('app_membership')
        .upsert(
          { user_id: u.id, app_id: meetApp.id, role: 'member' },
          { onConflict: 'user_id,app_id' },
        );
    }
    // 4. Workspace membership with the chosen relationship type. Defaults
    //    to 'internal'. The inviter can pass 'external' to scope down access.
    await ensureWorkspaceMember(u.id, ctx.workspaceId, {
      role: 'organiser',
      relationship: body.data.relationship_type ?? 'internal',
    });
  } else {
    // Existing user — make sure they have a linked person row too (heal old
    // rows created before this fix).
    await linkPersonIfMissing(u.id, ctx.workspaceId, u.email, u.full_name);
    // And a workspace_member row in case they pre-date the slice.
    await ensureWorkspaceMember(u.id, ctx.workspaceId, { role: 'organiser' });
  }

  // 4. Add to the team.
  //   - For brand-new invites (the email didn't have a user row yet) the
  //     membership starts as 'invited' with a token. They become 'active'
  //     when they sign in and click Accept.
  //   - For existing workspace users (no token needed; they're already in
  //     this workspace and can be trusted) it's 'active' immediately.
  const memberStatus = invited ? 'invited' : 'active';
  const inviteToken = invited
    ? `inv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`
    : null;
  const { data, error } = await adminClient
    .from('team_member')
    .upsert(
      {
        team_id: id,
        user_id: u.id,
        role: body.data.role ?? 'member',
        status: memberStatus,
        invite_token: inviteToken,
        invited_at: invited ? new Date().toISOString() : null,
        accepted_at: invited ? null : new Date().toISOString(),
      },
      { onConflict: 'team_id,user_id' },
    )
    .select('role, status, invite_token, user:user_id (id, email, full_name)')
    .single();
  if (error) return c.json({ error: error.message }, 500);

  // 5. Send invite email (best-effort, non-fatal). Only when newly created.
  if (invited && inviteToken) {
    try {
      const { data: team } = await adminClient
        .from('team')
        .select('name')
        .eq('id', id)
        .single();
      const { data: inviter } = await adminClient
        .from('user')
        .select('full_name, email')
        .eq('id', ctx.userId)
        .single();
      const teamName = team?.name ?? 'a team';
      const inviterName = inviter?.full_name ?? inviter?.email ?? 'a teammate';
      const acceptUrl = `${meetAppUrl()}/invite/${inviteToken}`;
      const signInUrl = appUrl('fibre-platform', process.env);
      await sendEmail({
        to: u.email,
        subject: `${inviterName} invited you to ${teamName} on ${PLATFORM.name}`,
        text: `${inviterName} invited you to the team "${teamName}" on ${MEET.name}.

Accept the invite: ${acceptUrl}

You'll be asked to sign in with Google (using ${u.email}) and then taken to a page to accept. After accepting you'll start receiving bookings.

${emailSignoff()}`,
        html: `<!doctype html><html><body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#171717;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
        <tr><td>
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#737373;">You've been invited</div>
          <h1 style="margin:8px 0 0 0;font-size:24px;font-weight:500;letter-spacing:-0.01em;">${inviterName} added you to ${teamName}.</h1>
          <p style="margin-top:18px;font-size:14px;line-height:1.6;color:#404040;">Open the link below to review and accept. You'll be asked to sign in with Google.</p>
          <p style="margin-top:24px;"><a href="${acceptUrl}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;font-size:14px;padding:10px 20px;border-radius:6px;">Accept invite</a></p>
          <p style="margin-top:18px;font-size:12px;color:#737373;">Use your Google account for <strong>${u.email}</strong>.</p>
          <p style="margin-top:24px;font-size:11px;color:#a3a3a3;word-break:break-all;">Or copy this link: ${acceptUrl}</p>
          <p style="margin-top:18px;font-size:11px;color:#a3a3a3;">If you didn't expect this, just ignore the email. ${signInUrl}</p>
        </td></tr>
      </table>
      <div style="margin-top:16px;font-size:11px;color:#a3a3a3;">${legalFooterLine()}</div>
    </td></tr>
  </table>
</body></html>`,
      });
    } catch (e) {
      console.error('[teams/members] invite email failed (non-fatal)', e);
    }
  }

  return c.json({ ...data, invited }, 201);
});

// GET /api/v1/meet/public/invite/:token — read-only peek used by the accept
// page. No auth required; the token itself is the capability. Returns just
// enough to render the page; rejects expired/used tokens (status != 'invited').
meetRoutes.get('/public/invite/:token', async (c) => {
  const token = c.req.param('token');
  const { data: row, error } = await adminClient
    .from('team_member')
    .select(
      'team_id, user_id, role, status, invite_token, team:team_id (id, name, slug, workspace_id), user:user_id (id, email, full_name)',
    )
    .eq('invite_token', token)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!row) return c.json({ error: 'invite not found' }, 404);
  if (row.status !== 'invited') {
    return c.json({ error: 'invite already used' }, 410);
  }
  const team = Array.isArray(row.team) ? row.team[0] : row.team;
  const user = Array.isArray(row.user) ? row.user[0] : row.user;
  // Inviter (best-effort).
  const { data: log } = await adminClient
    .from('team_member')
    .select('user_id')
    .eq('team_id', row.team_id)
    .eq('role', 'lead')
    .limit(1);
  let inviter: { full_name: string | null; email: string | null } | null = null;
  if (log && log[0]) {
    const { data: iu } = await adminClient
      .from('user')
      .select('full_name, email')
      .eq('id', log[0].user_id)
      .maybeSingle();
    inviter = iu ?? null;
  }
  return c.json({
    team: team ? { id: team.id, name: team.name, slug: team.slug } : null,
    invitee: user ? { id: user.id, email: user.email, full_name: user.full_name } : null,
    role: row.role,
    inviter,
  });
});

// POST /api/v1/meet/teams/accept-invite/:token — authenticated. The signed-in
// user must have the same email as the invitee user row. On success the
// membership flips to active, token is cleared, fibre-meet membership is
// granted (the pre-creation step skipped it for invited users in some paths;
// upsert is idempotent).
meetRoutes.post('/teams/accept-invite/:token', async (c) => {
  const token = c.req.param('token');
  const ctx = c.get('ctx');
  const { data: row } = await adminClient
    .from('team_member')
    .select(
      'team_id, user_id, role, status, team:team_id (id, slug, name)',
    )
    .eq('invite_token', token)
    .maybeSingle();
  if (!row) return c.json({ error: 'invite not found' }, 404);
  if (row.status !== 'invited') return c.json({ error: 'invite already used' }, 410);
  // The signed-in user must own the invitee row. We allow this either when
  // the user IDs match directly, or when the emails match — the invite row
  // gets retargeted to the signed-in user if email match is via a different
  // user row (covers edge cases where the SSO created a new row).
  const { data: signedIn } = await adminClient
    .from('user')
    .select('id, email')
    .eq('id', ctx.userId)
    .single();
  const { data: invitee } = await adminClient
    .from('user')
    .select('id, email')
    .eq('id', row.user_id)
    .single();
  if (!signedIn || !invitee) return c.json({ error: 'user not resolvable' }, 500);
  const sameUser = signedIn.id === invitee.id;
  const sameEmail =
    signedIn.email &&
    invitee.email &&
    signedIn.email.toLowerCase() === invitee.email.toLowerCase();
  if (!sameUser && !sameEmail) {
    return c.json({ error: 'this invite is for a different email' }, 403);
  }
  // Update the row; if the user_id differs from the signed-in user, retarget.
  const updates = {
    status: 'active',
    invite_token: null,
    accepted_at: new Date().toISOString(),
    ...(sameUser ? {} : { user_id: signedIn.id }),
  };
  const { error: uErr } = await adminClient
    .from('team_member')
    .update(updates)
    .eq('team_id', row.team_id)
    .eq('user_id', invitee.id);
  if (uErr) return c.json({ error: uErr.message }, 500);
  // Make sure they have fibre-meet membership (idempotent).
  const { data: meetApp } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'fibre-meet')
    .single();
  if (meetApp) {
    await adminClient
      .from('app_membership')
      .upsert(
        { user_id: signedIn.id, app_id: meetApp.id, role: 'member' },
        { onConflict: 'user_id,app_id' },
      );
  }
  const team = Array.isArray(row.team) ? row.team[0] : row.team;
  return c.json({ ok: true, team_id: row.team_id, team_slug: team?.slug ?? null });
});

// POST /api/v1/meet/teams/:id/members/:userId/resend-invite — leads only.
// Regenerates the invite token (invalidating the old link) and re-sends the
// invite email. Useful when the invitee can't find the original.
meetRoutes.post('/teams/:id/members/:userId/resend-invite', async (c) => {
  const id = c.req.param('id');
  const userId = c.req.param('userId');
  const ctx = c.get('ctx');
  if (!(await assertLead(id, ctx.userId))) {
    return c.json({ error: 'leads only' }, 403);
  }
  const { data: row } = await adminClient
    .from('team_member')
    .select('status, user:user_id (email, full_name)')
    .eq('team_id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!row || row.status !== 'invited') {
    return c.json({ error: 'not a pending invite' }, 400);
  }
  const inviteToken = `inv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
  await adminClient
    .from('team_member')
    .update({ invite_token: inviteToken, invited_at: new Date().toISOString() })
    .eq('team_id', id)
    .eq('user_id', userId);
  const u = Array.isArray(row.user) ? row.user[0] : row.user;
  const acceptUrl = `${meetAppUrl()}/invite/${inviteToken}`;
  if (u?.email) {
    try {
      const { data: team } = await adminClient
        .from('team')
        .select('name')
        .eq('id', id)
        .single();
      await sendEmail({
        to: u.email,
        subject: `Reminder: accept your invite to ${team?.name ?? 'a team'}`,
        text: `Accept the invite: ${acceptUrl}\n\n${emailSignoff()}`,
        html: `<p>Open <a href="${acceptUrl}">${acceptUrl}</a> to accept the invite.</p>`,
      });
    } catch (e) {
      console.error('[teams/resend-invite] email failed (non-fatal)', e);
    }
  }
  return c.json({ ok: true, invite_url: acceptUrl });
});

// DELETE /api/v1/meet/teams/:id/members/:userId — leads only.
// Refuse to remove the last lead.
meetRoutes.delete('/teams/:id/members/:userId', async (c) => {
  const id = c.req.param('id');
  const userId = c.req.param('userId');
  const ctx = c.get('ctx');
  if (!(await assertLead(id, ctx.userId))) {
    return c.json({ error: 'leads only' }, 403);
  }
  const { data: target } = await adminClient
    .from('team_member')
    .select('role')
    .eq('team_id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!target) return c.json({ ok: true });
  if (target.role === 'lead') {
    const { count } = await adminClient
      .from('team_member')
      .select('user_id', { count: 'exact', head: true })
      .eq('team_id', id)
      .eq('role', 'lead');
    if ((count ?? 0) <= 1) {
      return c.json({ error: 'cannot remove the last lead' }, 400);
    }
  }
  await adminClient
    .from('team_member')
    .delete()
    .eq('team_id', id)
    .eq('user_id', userId);
  return c.json({ ok: true });
});

// ===========================================================================
// PUBLIC team booking routes.
// /api/v1/meet/public/team/:teamSlug
// /api/v1/meet/public/team/:teamSlug/mt/:mtSlug
// /api/v1/meet/public/team/:teamSlug/mt/:mtSlug/slots
//
// Plus a resolver so the Meet front-end can do /<slug> lookup and learn
// whether the root slug is a host or a team.
// ===========================================================================

// GET /api/v1/meet/public/resolve/:slug?workspace_id=...
// Used by the Meet app's /[slug]/page.tsx to figure out which page to render.
// Workspace_id is optional; if absent we resolve across all workspaces but
// reject ambiguity (more than one match). For the public booking page we
// have no workspace context so this is the simplest contract.
meetRoutes.get('/public/resolve/:slug', async (c) => {
  const slug = c.req.param('slug');
  const { data, error } = await adminClient
    .from('meet_root_slug')
    .select('slug, kind, host_id, team_id, workspace_id')
    .eq('slug', slug);
  if (error) return c.json({ error: error.message }, 500);
  const rows = data ?? [];
  if (rows.length === 0) return c.json({ error: 'not found' }, 404);
  if (rows.length > 1) return c.json({ error: 'ambiguous slug' }, 409);
  return c.json(rows[0]);
});

// GET /api/v1/meet/public/team/:team_slug — team + active meeting types.
meetRoutes.get('/public/team/:team_slug', async (c) => {
  const slug = c.req.param('team_slug');
  const { data: team, error } = await adminClient
    .from('team')
    .select('id, slug, name, description, is_active, workspace_id')
    .eq('slug', slug)
    .single();
  if (error || !team) return c.json({ error: 'team not found' }, 404);
  if (!team.is_active) return c.json({ error: 'team is inactive' }, 404);
  const { data: mts } = await adminClient
    .from('meet_meeting_type')
    .select(
      'id, slug, name, description, duration_minutes, conferencing_provider, default_location',
    )
    .eq('team_id', team.id)
    .eq('is_active', true)
    .eq('is_public_listed', true)
    .order('created_at', { ascending: true });
  return c.json({
    id: team.id,
    slug: team.slug,
    name: team.name,
    description: team.description,
    meeting_types: mts ?? [],
  });
});

// GET /api/v1/meet/public/team/:team_slug/mt/:mt_slug
meetRoutes.get('/public/team/:team_slug/mt/:mt_slug', async (c) => {
  const teamSlug = c.req.param('team_slug');
  const mtSlug = c.req.param('mt_slug');
  const { data: team } = await adminClient
    .from('team')
    .select('id, slug, name, description, is_active')
    .eq('slug', teamSlug)
    .single();
  if (!team || !team.is_active) return c.json({ error: 'team not found' }, 404);
  const { data: mt } = await adminClient
    .from('meet_meeting_type')
    .select(
      'id, slug, name, description, duration_minutes, conferencing_provider, default_location, price_cents, price_currency, event_type, capacity, fixed_starts_at, fixed_ends_at, host:host_id (slug, user:user_id (full_name, avatar_url))',
    )
    .eq('team_id', team.id)
    .eq('slug', mtSlug)
    .eq('is_active', true)
    .single();
  if (!mt) return c.json({ error: 'meeting type not found' }, 404);
  let pollSlots: { starts_at: string; ends_at: string }[] | undefined;
  if (mt.event_type === 'poll') {
    const { data: ps } = await adminClient
      .from('meet_poll_slot')
      .select('starts_at, ends_at')
      .eq('meeting_type_id', mt.id)
      .order('starts_at', { ascending: true });
    pollSlots = ps ?? [];
  }
  return c.json({ ...mt, poll_slots: pollSlots, team });
});

// GET /api/v1/meet/public/team/:team_slug/mt/:mt_slug/slots
// Mirrors the host slots endpoint but resolves through the team and handles
// round-robin (union of assignees' availability) and collective (intersection).
meetRoutes.get('/public/team/:team_slug/mt/:mt_slug/slots', async (c) => {
  const teamSlug = c.req.param('team_slug');
  const mtSlug = c.req.param('mt_slug');
  const url = new URL(c.req.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  const { data: team } = await adminClient
    .from('team')
    .select('id, workspace_id')
    .eq('slug', teamSlug)
    .single();
  if (!team) return c.json({ error: 'team not found' }, 404);

  const { data: mt } = await adminClient
    .from('meet_meeting_type')
    .select(
      'id, host_id, event_type, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_advance_days, is_active, capacity, fixed_starts_at, fixed_ends_at',
    )
    .eq('team_id', team.id)
    .eq('slug', mtSlug)
    .single();
  if (!mt || !mt.is_active) return c.json({ error: 'meeting type not found' }, 404);

  if (mt.event_type === 'one_off') {
    if (!mt.fixed_starts_at) return c.json({ slots: [] });
    const cap = mt.capacity && mt.capacity > 0 ? mt.capacity : 1;
    const { count } = await adminClient
      .from('meet_booking')
      .select('id', { count: 'exact', head: true })
      .eq('meeting_type_id', mt.id)
      .eq('starts_at', mt.fixed_starts_at)
      .eq('status', 'confirmed');
    const booked = count ?? 0;
    if (booked >= cap) return c.json({ slots: [], slots_meta: [] });
    const iso = new Date(mt.fixed_starts_at).toISOString();
    return c.json({
      slots: [iso],
      slots_meta: [{ starts_at: iso, capacity: cap, booked, remaining: cap - booked }],
    });
  }
  if (mt.event_type === 'poll') return c.json({ slots: [] });

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
  const MAX_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
  const cappedTo =
    to.getTime() - from.getTime() > MAX_WINDOW_MS
      ? new Date(from.getTime() + MAX_WINDOW_MS)
      : to;

  // Resolve the eligible-host roster. For one_on_one we use mt.host_id alone;
  // for round_robin / collective we union with the assignee table.
  const hostIds = await resolveAssigneeHostIds(mt);
  if (hostIds.length === 0) {
    return c.json({ slots: [] });
  }

  const hostArgs = await buildPerHostArgs(hostIds, mt, from, cappedTo, now);
  if (hostArgs.length === 0) return c.json({ slots: [] });

  let slots: Date[];
  if (mt.event_type === 'collective') {
    slots = generateMultiHostSlots('collective', hostArgs);
  } else if (mt.event_type === 'round_robin') {
    slots = generateMultiHostSlots('round_robin', hostArgs);
  } else {
    // one_on_one (team-owned, single host) — defer to single-host generator.
    const h = hostArgs[0];
    if (!h) return c.json({ slots: [] });
    slots = generateSlots(h);
  }

  const slotsIso = slots.map((d) => d.toISOString());

  // Group MTs (team-owned) — same capacity behaviour as the host endpoint.
  if (mt.event_type === 'group' && mt.capacity && mt.capacity > 0) {
    const { data: existing } = await adminClient
      .from('meet_booking')
      .select('starts_at')
      .eq('meeting_type_id', mt.id)
      .eq('status', 'confirmed')
      .gte('starts_at', from.toISOString())
      .lte('starts_at', cappedTo.toISOString());
    const counts: Record<string, number> = {};
    for (const b of existing ?? []) {
      const k = new Date(b.starts_at).toISOString();
      counts[k] = (counts[k] ?? 0) + 1;
    }
    const filtered: string[] = [];
    const slotsMeta: { starts_at: string; capacity: number; booked: number; remaining: number }[] = [];
    for (const s of slotsIso) {
      const booked = counts[s] ?? 0;
      const remaining = mt.capacity - booked;
      if (remaining <= 0) continue;
      filtered.push(s);
      slotsMeta.push({ starts_at: s, capacity: mt.capacity, booked, remaining });
    }
    return c.json({ slots: filtered, slots_meta: slotsMeta });
  }

  return c.json({ slots: slotsIso });
});

// ---------------------------------------------------------------------------
// Multi-host helpers — used by both the team slots endpoint and the team
// booking POST. Pulled out to keep both code paths consistent.
// ---------------------------------------------------------------------------

type MeetingTypeForResolve = {
  id: string;
  host_id: string;
  event_type: string;
};

/** Resolve the meet_host ids eligible to take a booking for this MT. */
async function resolveAssigneeHostIds(mt: MeetingTypeForResolve): Promise<string[]> {
  if (mt.event_type === 'one_on_one' || mt.event_type === 'group') {
    return [mt.host_id];
  }
  // Assignees who are currently ACTIVE members of the meeting type's team.
  // Pending invites are excluded — they can't be routed to until they accept.
  const { data: rows } = await adminClient
    .from('meet_meeting_type_assignee')
    .select(
      'user_id, is_primary, meeting_type:meeting_type_id (team_id)',
    )
    .eq('meeting_type_id', mt.id);
  const allAssignees = rows ?? [];
  if (allAssignees.length === 0) return [mt.host_id]; // fallback
  const teamId = (() => {
    const m = allAssignees[0]?.meeting_type;
    const mt0 = Array.isArray(m) ? m[0] : m;
    return mt0?.team_id ?? null;
  })();
  let assignees: { user_id: string; is_primary: boolean }[];
  if (teamId) {
    const { data: activeMembers } = await adminClient
      .from('team_member')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('status', 'active');
    const activeIds = new Set((activeMembers ?? []).map((m) => m.user_id));
    assignees = allAssignees.filter((a) => activeIds.has(a.user_id));
    if (assignees.length === 0) return [mt.host_id];
  } else {
    assignees = allAssignees;
  }
  // Resolve each user_id to their meet_host row (one host per user).
  const userIds = assignees.map((a) => a.user_id);
  const { data: hosts } = await adminClient
    .from('meet_host')
    .select('id, user_id')
    .in('user_id', userIds);
  // Preserve primary-first ordering.
  const primaryUserId = assignees.find((a) => a.is_primary)?.user_id ?? null;
  const idsByUser = new Map((hosts ?? []).map((h) => [h.user_id, h.id]));
  const ordered: string[] = [];
  if (primaryUserId && idsByUser.has(primaryUserId)) {
    ordered.push(idsByUser.get(primaryUserId)!);
  }
  for (const a of assignees) {
    if (a.user_id === primaryUserId) continue;
    const hid = idsByUser.get(a.user_id);
    if (hid) ordered.push(hid);
  }
  return ordered;
}

type MeetingTypeForArgs = MeetingTypeForResolve & {
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
};

/** Load each host's working_hours + busy and shape into PerHostArgs. */
async function buildPerHostArgs(
  hostIds: string[],
  mt: MeetingTypeForArgs,
  from: Date,
  to: Date,
  now: Date,
): Promise<PerHostArgs[]> {
  const { data: hosts } = await adminClient
    .from('meet_host')
    .select('id, user_id, timezone, working_hours')
    .in('id', hostIds);
  if (!hosts || hosts.length === 0) return [];

  // All confirmed bookings touching the window for any of these hosts.
  // For group MTs we omit bookings on the MT itself — the slot stays open
  // (and shareable) until capacity is reached.
  const { data: bookings } = await adminClient
    .from('meet_booking')
    .select('host_id, starts_at, ends_at, meeting_type_id')
    .in('host_id', hostIds)
    .eq('status', 'confirmed')
    .gte('ends_at', from.toISOString())
    .lte('starts_at', to.toISOString());
  const isGroup = mt.event_type === 'group';
  const busyByHost = new Map<string, BusyInterval[]>();
  for (const b of bookings ?? []) {
    if (isGroup && b.meeting_type_id === mt.id) continue;
    const list = busyByHost.get(b.host_id) ?? [];
    list.push({ start: new Date(b.starts_at), end: new Date(b.ends_at) });
    busyByHost.set(b.host_id, list);
  }

  // GCal calendars per host — only the ones we conflict-check against.
  // 'ignore' calendars are explicitly excluded.
  const { data: cals } = await adminClient
    .from('meet_calendar')
    .select('host_id, google_calendar_id, role')
    .in('host_id', hostIds)
    .in('role', ['primary', 'conflict_check', 'write_target']);
  const calsByHost = new Map<string, string[]>();
  for (const c of cals ?? []) {
    if (!c.google_calendar_id) continue;
    const list = calsByHost.get(c.host_id) ?? [];
    list.push(c.google_calendar_id);
    calsByHost.set(c.host_id, list);
  }

  const out: PerHostArgs[] = [];
  // Run freebusy in parallel.
  await Promise.all(
    hosts.map(async (h) => {
      const busy = busyByHost.get(h.id) ?? [];
      const calendarIds = calsByHost.get(h.id) ?? [];
      const hGToken = calendarIds.length > 0 ? await userGoogleToken(h.user_id) : null;
      if (hGToken && calendarIds.length > 0) {
        try {
          const gbusy = await freeBusy(
            hGToken,
            calendarIds,
            from,
            to,
          );
          busy.push(...gbusy);
        } catch (e) {
          console.error('[multi-host slots] freebusy failed', e);
        }
      }
      out.push({
        hostKey: h.id,
        hostTimezone: h.timezone ?? 'UTC',
        workingHours: (h.working_hours as WorkingSchedule | null) ?? {},
        durationMinutes: mt.duration_minutes,
        bufferBeforeMinutes: mt.buffer_before_minutes,
        bufferAfterMinutes: mt.buffer_after_minutes,
        minNoticeMinutes: mt.min_notice_minutes,
        from,
        to,
        busy,
        now,
      });
    }),
  );
  // Preserve the input ordering so the primary stays first (matters for
  // round-robin tie-breaking and for the canonical-host pick in collective).
  out.sort(
    (a, b) => hostIds.indexOf(a.hostKey) - hostIds.indexOf(b.hostKey),
  );
  return out;
}

// ===========================================================================
// Assignees — team meeting types only. Leads of the meeting-type's team can
// add or remove assignees. The meeting-type's host_id (the creator) is the
// natural "primary"; we expose explicit primary marking through this API
// because round-robin / collective semantics depend on it.
// ===========================================================================

// GET /api/v1/meet/meeting-types/:id/assignees
meetRoutes.get('/meeting-types/:id/assignees', async (c) => {
  const id = c.req.param('id');
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('meet_meeting_type_assignee')
    .select(
      'user_id, is_primary, created_at, user:user_id (id, email, full_name, avatar_url)',
    )
    .eq('meeting_type_id', id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

const AssigneeBody = z.object({
  user_id: z.string().uuid(),
  is_primary: z.boolean().optional(),
});

// POST /api/v1/meet/meeting-types/:id/assignees — add or set primary.
meetRoutes.post('/meeting-types/:id/assignees', async (c) => {
  const id = c.req.param('id');
  const body = AssigneeBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');

  const { data: mt } = await adminClient
    .from('meet_meeting_type')
    .select('team_id')
    .eq('id', id)
    .single();
  if (!mt || !mt.team_id) {
    return c.json({ error: 'meeting type is not team-owned' }, 400);
  }
  // Lead-only.
  const { data: lead } = await adminClient
    .from('team_member')
    .select('role')
    .eq('team_id', mt.team_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!lead || lead.role !== 'lead') {
    return c.json({ error: 'leads only' }, 403);
  }
  // The target user must be a member of the same team.
  const { data: target } = await adminClient
    .from('team_member')
    .select('user_id')
    .eq('team_id', mt.team_id)
    .eq('user_id', body.data.user_id)
    .maybeSingle();
  if (!target) return c.json({ error: 'user is not on this team' }, 400);

  // If is_primary=true, clear any existing primary on this MT first.
  if (body.data.is_primary) {
    await adminClient
      .from('meet_meeting_type_assignee')
      .update({ is_primary: false })
      .eq('meeting_type_id', id)
      .eq('is_primary', true);
  }
  const { data, error } = await adminClient
    .from('meet_meeting_type_assignee')
    .upsert(
      {
        meeting_type_id: id,
        user_id: body.data.user_id,
        is_primary: body.data.is_primary ?? false,
      },
      { onConflict: 'meeting_type_id,user_id' },
    )
    .select('user_id, is_primary')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

// DELETE /api/v1/meet/meeting-types/:id/assignees/:userId
meetRoutes.delete('/meeting-types/:id/assignees/:userId', async (c) => {
  const id = c.req.param('id');
  const userId = c.req.param('userId');
  const ctx = c.get('ctx');

  const { data: mt } = await adminClient
    .from('meet_meeting_type')
    .select('team_id')
    .eq('id', id)
    .single();
  if (!mt || !mt.team_id) {
    return c.json({ error: 'meeting type is not team-owned' }, 400);
  }
  const { data: lead } = await adminClient
    .from('team_member')
    .select('role')
    .eq('team_id', mt.team_id)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (!lead || lead.role !== 'lead') {
    return c.json({ error: 'leads only' }, 403);
  }
  await adminClient
    .from('meet_meeting_type_assignee')
    .delete()
    .eq('meeting_type_id', id)
    .eq('user_id', userId);
  return c.json({ ok: true });
});
