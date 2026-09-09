// ===========================================================================
// The visitor's own place: GET /api/v1/me/portal
//
// One page showing everything a person is part of — tickets, threads, meets,
// memberships — grouped by the organiser they know, which is the workspace.
// docs/visitor-portal-proposal.md holds the reasoning and Sjoerd's decisions.
//
// ---------------------------------------------------------------------------
// THE DATA WALL (brief §2) — read this before adding a query
// ---------------------------------------------------------------------------
// This route reads three apps' schemas in one response, which every other
// part of the system is forbidden to do. It is allowed here, and the
// distinction is not a loophole:
//
//   The wall stops APPS reading each OTHER's data. This is the PLATFORM
//   composing, for the data subject, a view of that person's own data.
//
// That is GDPR Article 15 territory, and no app gains a read it did not have.
// Recorded as the third sanctioned crossing beside the activity log and the
// purchase ledger (D1, accepted by Sjoerd 2026-09-08). If you are here to
// "fix" a wall violation: this is not one. If you are here to add a fourth
// app's data to the payload, that is in the spirit of the route — but it
// belongs in THIS file, not in a new cross-app read somewhere else.
//
// ---------------------------------------------------------------------------
// THE SECURITY MODEL — the email filter IS the security model
// ---------------------------------------------------------------------------
// RLS does not protect a single handler in this file. Everything runs on
// adminClient, which bypasses it entirely. What keeps one visitor from
// reading another's tickets is that EVERY query below is explicitly scoped to
// person rows matching the verified email, and nothing else.
//
// So: never add a query here that is not filtered by `personIds` (or, where
// the row may predate a person id, by personIds OR the email itself — see
// the note on dual keys below). A query without that filter returns the whole
// platform's data to whoever asked.
//
// `person.email` is citext, so `eq` is already case-insensitive; the email is
// lowercased in participantEmailFromAuth regardless.
//
// ---------------------------------------------------------------------------
// DUAL KEYS — why some filters match on two columns
// ---------------------------------------------------------------------------
// Rows that were written before a person row existed carry an email and a
// null person id; rows an organiser entered by hand may carry a person id and
// no email. Neither column alone finds all of a visitor's rows:
//
//   purchase.person_id           nullable (on delete set null)
//   purchase.payer_email         nullable citext
//   meet_booking.invitee_person_id  nullable
//   meet_booking.invitee_email      citext not null
//
// Match `person_id in (…) OR <email column> = email` on those tables — and
// match it as two queries merged by id, never as a PostgREST `.or()` string
// with the email interpolated into it (see the note at the meet query).
//
// thread_enrolment and membership_member always carry a person id, so those
// filter on personIds alone. `purchase` is listed here because it has the
// same shape and the same trap; this route does not read it yet (invoices
// are not on the visitor's page), so treat that line as the instruction for
// whoever adds them.
// ===========================================================================

import { Hono } from 'hono';
import { adminClient } from '../db.js';
import { participantEmailFromAuth } from '../lib/participant-auth.js';
import { enrolmentCanRespond, mergeById, resolveRsvpEnabled, ticketIsAdmissible } from '../lib/portal.js';
import { appUrl } from '@thefibre/shared';
import { appleWalletConfig, googleWalletConfig } from '../lib/checkin.js';

export const portalRoutes = new Hono();

/**
 * Which wallet buttons the portal may show. The QR and both passes are
 * already served by Thread at /thread/public/checkin/:code/*, and the portal
 * holds the check-in code, so it builds those URLs itself — no route here.
 * What it cannot know is whether the credentials exist: both config readers
 * return null without them and the pass routes 503. A button that fails is
 * worse than no button, so the answer travels with the payload.
 */
/**
 * A thread's public page lives on THE THREAD's domain, not the portal's.
 *
 * This was `/${ownerSlug}/${slug}` — a bare path — until 2026-09-09, and it
 * was wrong for both of its consumers, which is why it goes here once rather
 * than being patched in either. "Open the full page" resolved the path
 * against my.thethread.app and 404'd for every thread; and the .ics fell
 * back to it, emitting `URL:/owner/slug`, which is not a URI (RFC 5545 wants
 * a scheme) so calendars ignored or mangled it.
 *
 * Found by the membership session driving the real signed-in portal on
 * staging — neither bug is reachable without a session, which is exactly the
 * gap that verification existed to close.
 */
function threadPublicUrl(ownerSlug: string, threadSlug: string): string {
  return `${appUrl('the-thread', process.env)}/${ownerSlug}/${threadSlug}`;
}

function walletAvailability(): { apple: boolean; google: boolean } {
  return { apple: !!appleWalletConfig(), google: !!googleWalletConfig() };
}

const one = <T>(v: T | T[] | null | undefined): T | null =>
  !v ? null : Array.isArray(v) ? v[0] ?? null : v;

// How far back a finished thing stays on the page. Long enough to find last
// month's invoice, short enough that the page is about what's next.
const PAST_WINDOW_DAYS = 90;

type Ticket = {
  enrolment_id: string;
  thread_id: string;
  title: string;
  starts_on: string | null;
  /**
   * There is no location on a thread — `thread_thread` has no such column,
   * and the ticket email leaves it null for exactly that reason. The place
   * a person actually goes is named on the engagement, so this is the first
   * agenda item that has one.
   */
  location: string | null;
  /** Present only once the enrolment is actually admissible — see below. */
  checkin_code: string | null;
  checked_in_at: string | null;
};

type AgendaItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  meeting_url: string | null;
  external_url: string | null;
  /**
   * Whether this item asks for an RSVP. Resolved server-side: the workspace
   * default, overridden per thread, overridden per ITEM, each level's NULL
   * meaning inherit. The client is told the answer, never the rule.
   */
  rsvp_enabled: boolean;
  /** This person's current answer. `null` is NO ANSWER, which is a third
   *  state and not the same as 'not_coming'. */
  rsvp: 'coming' | 'not_coming' | null;
};

type ThreadItem = {
  thread_id: string;
  title: string;
  format: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  language: string;
  cover_url: string | null;
  enrolment_status: string | null;
  progress_pct: number | null;
  url: string;
  agenda: AgendaItem[];
};

type MeetItem = {
  booking_id: string;
  title: string;
  host: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  meet_url: string | null;
  location: string | null;
};

type MembershipItem = {
  member_id: string;
  tier: string | null;
  status: string;
  started_at: string | null;
  renews_at: string | null;
};

type Group = {
  workspace_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  tickets: Ticket[];
  threads: ThreadItem[];
  meets: MeetItem[];
  memberships: MembershipItem[];
};

portalRoutes.get('/portal', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);

  // One person row per workspace that knows this email. This list is the
  // scope of everything below.
  const { data: persons } = await adminClient
    .from('person')
    .select('id, first_name, last_name, email')
    .eq('email', email)
    .is('deleted_at', null);

  const personIds = (persons ?? []).map((p) => p.id as string);
  const me = {
    first_name: (persons?.[0]?.first_name as string | null) ?? null,
    last_name: (persons?.[0]?.last_name as string | null) ?? null,
    email,
  };
  if (!personIds.length) return c.json({ person: me, wallet: walletAvailability(), groups: [] });

  const since = new Date(Date.now() - PAST_WINDOW_DAYS * 86400_000).toISOString();
  const sinceDate = since.slice(0, 10);

  // -- Threads + tickets ----------------------------------------------------
  const { data: enrolments } = await adminClient
    .from('thread_enrolment')
    .select(
      `id, workspace_id, checkin_code, checked_in_at, payment_status, created_at,
       enrolment:enrolment_id (status, progress_pct),
       thread:thread_id (id, slug, language, cover_url, public_scope,
         organiser:organiser_id (slug, display_name),
         team:team_id (slug, name),
         program:program_id (title, format, status, starts_on, ends_on))`,
    )
    .in('person_id', personIds)
    .order('created_at', { ascending: false });

  // -- Agenda, for the threads we just found --------------------------------
  const threadIds = [
    ...new Set(
      (enrolments ?? [])
        .map((e) => one(e.thread as { id: string } | { id: string }[] | null))
        .filter((t): t is { id: string } => !!t)
        .map((t) => t.id),
    ),
  ];
  // Threads this person has dropped out of. They still see them — the record
  // of having taken part is theirs — but the RSVP control is not offered,
  // matching the write path's refusal.
  const droppedThreads = new Set<string>();
  for (const e of enrolments ?? []) {
    const t = one(e.thread as { id: string } | { id: string }[] | null);
    const enr = one(e.enrolment as never) as { status: string | null } | null;
    if (t && !enrolmentCanRespond(enr?.status ?? null)) droppedThreads.add(t.id);
  }

  const agendaByThread = new Map<string, AgendaItem[]>();
  if (threadIds.length) {
    // An item asks only when its own switch is on (lib/portal.ts
    // resolveRsvpEnabled). Two queries stood here — the thread's override and
    // the workspace default — and both are gone with the inheritance chain
    // they served.
    const { data: engagements } = await adminClient
      .from('thread_engagement')
      .select(
        'id, thread_id, title, description, type, starts_at, ends_at, location, meeting_url, content, position, rsvp_enabled',
      )
      .in('thread_id', threadIds)
      .eq('status', 'published')
      .eq('show_in_agenda', true)
      .order('position', { ascending: true });

    // This person's own answers. Scoped by person_id exactly as everything
    // else here is — a visitor has no RLS identity in these workspaces.
    const { data: rsvps } = await adminClient
      .from('thread_rsvp')
      .select('engagement_id, response')
      .in('person_id', personIds);
    const answerByEngagement = new Map(
      (rsvps ?? []).map((r) => [r.engagement_id as string, r.response as 'coming' | 'not_coming']),
    );

    for (const e of engagements ?? []) {
      const content = (e.content ?? {}) as { external_url?: string; file_url?: string };
      const list = agendaByThread.get(e.thread_id as string) ?? [];
      list.push({
        id: e.id as string,
        title: e.title as string,
        description: (e.description as string | null) ?? null,
        type: e.type as string,
        starts_at: (e.starts_at as string | null) ?? null,
        ends_at: (e.ends_at as string | null) ?? null,
        location: (e.location as string | null) ?? null,
        meeting_url: (e.meeting_url as string | null) ?? null,
        external_url: content.external_url ?? content.file_url ?? null,
        // One resolver, shared with the write path and the organiser panel.
        // A dropped participant is refused separately: they still SEE the
        // thread, they just stop answering for it.
        rsvp_enabled:
          !droppedThreads.has(e.thread_id as string) &&
          resolveRsvpEnabled({
            item: e.rsvp_enabled as boolean | null,
            hasStart: !!e.starts_at,
          }),
        rsvp: answerByEngagement.get(e.id as string) ?? null,
      });
      agendaByThread.set(e.thread_id as string, list);
    }
  }

  // -- Meets (dual key: person id OR the email on the booking) --------------
  //
  // Two queries merged, deliberately, rather than one `.or(...)`. PostgREST's
  // or() takes a STRING, so an email would be interpolated into filter syntax
  // — and `,` `(` `)` `.` are all meaningful there. The email is verified, not
  // trusted-safe: what a token proves is that someone receives mail at that
  // address, not that the address is inert inside a query language. Two typed
  // filters have no such surface.
  const meetSelect = `id, workspace_id, starts_at, ends_at, status, meet_url, alternative_location,
       meeting_type:meeting_type_id (name),
       host:host_id (slug, user:user_id (full_name))`;
  const [byPerson, byEmail] = await Promise.all([
    adminClient
      .from('meet_booking')
      .select(meetSelect)
      .in('invitee_person_id', personIds)
      .neq('status', 'cancelled')
      .gte('starts_at', since),
    adminClient
      .from('meet_booking')
      .select(meetSelect)
      .eq('invitee_email', email)
      .neq('status', 'cancelled')
      .gte('starts_at', since),
  ]);
  const bookings = mergeById(byPerson.data, byEmail.data).sort((a, b) =>
    (a.starts_at as string).localeCompare(b.starts_at as string),
  );

  // -- Memberships ----------------------------------------------------------
  const { data: members } = await adminClient
    .from('membership_member')
    .select(
      `id, workspace_id, status, started_at, renews_at,
       tier:tier_id (name)`,
    )
    .in('person_id', personIds)
    .is('deleted_at', null)
    .order('started_at', { ascending: false });

  // -- Group by workspace ---------------------------------------------------
  const workspaceIds = [
    ...new Set([
      ...(enrolments ?? []).map((e) => e.workspace_id as string),
      ...bookings.map((b) => b.workspace_id as string),
      ...(members ?? []).map((m) => m.workspace_id as string),
    ]),
  ].filter(Boolean);

  if (!workspaceIds.length) return c.json({ person: me, wallet: walletAvailability(), groups: [] });

  const { data: workspaces } = await adminClient
    .from('workspace')
    .select('id, name, slug, brand_logo_url')
    .in('id', workspaceIds);

  const groups = new Map<string, Group>();
  for (const w of workspaces ?? []) {
    groups.set(w.id as string, {
      workspace_id: w.id as string,
      name: (w.name as string) ?? '',
      slug: (w.slug as string) ?? '',
      logo_url: (w.brand_logo_url as string | null) ?? null,
      tickets: [],
      threads: [],
      meets: [],
      memberships: [],
    });
  }

  for (const e of enrolments ?? []) {
    const g = groups.get(e.workspace_id as string);
    if (!g) continue;
    const t = one(e.thread as never) as
      | {
          id: string;
          slug: string;
          language: string | null;
          cover_url: string | null;
          public_scope: string | null;
          organiser: unknown;
          team: unknown;
          program: unknown;
        }
      | null;
    if (!t) continue;
    const prog = one(t.program as never) as
      | { title: string; format: string; status: string; starts_on: string | null; ends_on: string | null }
      | null;
    const org = one(t.organiser as never) as { slug: string; display_name: string } | null;
    const team = one(t.team as never) as { slug: string; name: string } | null;
    const enr = one(e.enrolment as never) as { status: string | null; progress_pct: number | null } | null;

    // Finished threads fall off the page after the window; anything current
    // or upcoming stays regardless of date.
    const ended = prog?.ends_on ?? prog?.starts_on ?? null;
    if (ended && ended < sinceDate && enr?.status === 'completed') continue;

    // Public URL owner segment. THREE kinds, not two: a workspace-scoped
    // thread has team_id NULL by design (brief D1), so `team ?? organiser`
    // silently falls through to the organiser and emits an address that is
    // reachable but not canonical — the page's own canonical tag points
    // somewhere else. Same order the web app's builders use
    // (apps/thread timeline.tsx, settings/embeds).
    //
    // Found 2026-09-09 by the thread session chasing the coupling between
    // this and `public_root_slug`. Not a 404: brief D2 keeps
    // /{organiser}/{thread} valid as a second address for exactly this case,
    // and the one active workspace-scoped thread in production resolves 200
    // under both. The cost is canonicality, not reachability.
    const ownerSlug =
      (t.public_scope === 'workspace' ? g.slug : null) ?? team?.slug ?? org?.slug ?? '';

    g.threads.push({
      thread_id: t.id,
      title: prog?.title ?? t.slug,
      format: prog?.format ?? 'event',
      status: prog?.status ?? 'draft',
      starts_on: prog?.starts_on ?? null,
      ends_on: prog?.ends_on ?? null,
      language: t.language ?? 'en',
      cover_url: t.cover_url ?? null,
      enrolment_status: enr?.status ?? null,
      progress_pct: enr?.progress_pct ?? null,
      url: threadPublicUrl(ownerSlug, t.slug as string),
      agenda: agendaByThread.get(t.id) ?? [],
    });

    if (e.checkin_code && ticketIsAdmissible(enr?.status ?? null, (e.payment_status as string | null) ?? null)) {
      g.tickets.push({
        enrolment_id: e.id as string,
        thread_id: t.id,
        title: prog?.title ?? t.slug,
        starts_on: prog?.starts_on ?? null,
        location: (agendaByThread.get(t.id) ?? []).find((a) => a.location)?.location ?? null,
        checkin_code: e.checkin_code as string,
        checked_in_at: (e.checked_in_at as string | null) ?? null,
      });
    }
  }

  for (const b of bookings) {
    const g = groups.get(b.workspace_id as string);
    if (!g) continue;
    const mt = one(b.meeting_type as never) as { name: string } | null;
    const hostRow = one(b.host as never) as
      | { slug: string | null; user: unknown }
      | null;
    const hostUser = one(hostRow?.user as never) as { full_name: string | null } | null;
    g.meets.push({
      booking_id: b.id as string,
      title: mt?.name ?? 'Meeting',
      host: hostUser?.full_name ?? hostRow?.slug ?? null,
      starts_at: b.starts_at as string,
      ends_at: b.ends_at as string,
      status: b.status as string,
      meet_url: (b.meet_url as string | null) ?? null,
      location: (b.alternative_location as string | null) ?? null,
    });
  }

  for (const m of members ?? []) {
    const g = groups.get(m.workspace_id as string);
    if (!g) continue;
    const tier = one(m.tier as never) as { name: string } | null;
    g.memberships.push({
      member_id: m.id as string,
      tier: tier?.name ?? null,
      status: m.status as string,
      started_at: (m.started_at as string | null) ?? null,
      renews_at: (m.renews_at as string | null) ?? null,
    });
  }

  // Organisers the visitor has nothing with any more drop off entirely.
  const out = [...groups.values()].filter(
    (g) => g.tickets.length || g.threads.length || g.meets.length || g.memberships.length,
  );
  // Busiest first — the organiser you have most with is the one you came for.
  out.sort(
    (a, b) =>
      b.tickets.length + b.threads.length + b.meets.length + b.memberships.length -
      (a.tickets.length + a.threads.length + a.meets.length + a.memberships.length),
  );

  return c.json({ person: me, wallet: walletAvailability(), groups: out });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/me/portal/rsvp — the visitor answers.
//
// The only write this app makes. Everything about it is scoped by the SAME
// verified email the read is scoped by: a person can only answer for an
// agenda item that belongs to a thread they are enrolled in, and only when
// that thread is actually asking. Nothing here trusts an id from the client
// beyond using it to look inside the caller's own reachable set.
//
// PUT rather than POST because it is idempotent: one current answer per
// (item, person), and changing your mind replaces it. The history of changes
// is not this table's job — the activity log is append-only and holds the
// fact that something happened, never the body.
// ---------------------------------------------------------------------------
portalRoutes.put('/portal/rsvp', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);

  const body = (await c.req.json().catch(() => null)) as {
    engagement_id?: unknown;
    response?: unknown;
  } | null;
  const engagementId = typeof body?.engagement_id === 'string' ? body.engagement_id : null;
  const response = body?.response;
  // 'none' withdraws an answer and returns the person to "no answer", which
  // is a real state and has to be reachable — otherwise a mis-tap is
  // permanent and every count is quietly wrong.
  if (!engagementId || (response !== 'coming' && response !== 'not_coming' && response !== 'none')) {
    return c.json({ error: 'engagement_id and response (coming|not_coming|none) required' }, 400);
  }

  const { data: persons } = await adminClient
    .from('person')
    .select('id, workspace_id')
    .eq('email', email);
  const personByWorkspace = new Map(
    (persons ?? []).map((p) => [p.workspace_id as string, p.id as string]),
  );
  if (!personByWorkspace.size) return c.json({ error: 'not found' }, 404);

  // The item, its thread, and whether either of them asks.
  const { data: engagement } = await adminClient
    .from('thread_engagement')
    .select(
      'id, workspace_id, thread_id, starts_at, status, rsvp_enabled',
    )
    .eq('id', engagementId)
    .maybeSingle();
  if (!engagement || engagement.status !== 'published' || !engagement.starts_at) {
    return c.json({ error: 'not found' }, 404);
  }

  const personId = personByWorkspace.get(engagement.workspace_id as string);
  if (!personId) return c.json({ error: 'not found' }, 404);

  // Enrolled in that thread, and still a participant of it? Same table the
  // read uses. A membership that lapses leaves the enrolment standing as
  // 'dropped' (soft delete — v0.68.31's thread worker), so existence alone
  // is not enough: that person keeps SEEING the thread and must stop
  // ANSWERING for its future sessions.
  const { data: enrolled } = await adminClient
    .from('thread_enrolment')
    .select('id, enrolment:enrolment_id (status)')
    .eq('person_id', personId)
    .eq('thread_id', engagement.thread_id as string)
    .limit(1);
  if (!enrolled?.length) return c.json({ error: 'not found' }, 404);
  const enrolmentStatus =
    one(
      enrolled[0]?.enrolment as unknown as
        | { status: string | null }
        | { status: string | null }[]
        | null,
    )?.status ?? null;
  if (!enrolmentCanRespond(enrolmentStatus)) {
    return c.json({ error: 'you are no longer taking part in this thread' }, 409);
  }

  // The SAME resolver the read uses. The write must refuse exactly what the
  // read declined to offer: a control that is absent while the endpoint still
  // accepts is a stale tab writing answers nobody asked for.
  const asks = resolveRsvpEnabled({
    item: engagement.rsvp_enabled as boolean | null,
    hasStart: !!engagement.starts_at,
  });
  if (!asks) return c.json({ error: 'this item is not asking for RSVPs' }, 409);

  if (response === 'none') {
    await adminClient
      .from('thread_rsvp')
      .delete()
      .eq('engagement_id', engagementId)
      .eq('person_id', personId);
    return c.json({ engagement_id: engagementId, rsvp: null });
  }

  const now = new Date().toISOString();
  const { error } = await adminClient.from('thread_rsvp').upsert(
    {
      workspace_id: engagement.workspace_id as string,
      engagement_id: engagementId,
      person_id: personId,
      response,
      responded_at: now,
      updated_at: now,
    },
    { onConflict: 'engagement_id,person_id' },
  );
  if (error) {
    console.error('[portal/rsvp] upsert failed', error);
    return c.json({ error: 'could not save your answer' }, 500);
  }

  return c.json({ engagement_id: engagementId, rsvp: response });
});
