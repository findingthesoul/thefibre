// The visitor's subscribable calendar.
//
// "Can I subscribe to the whole sequence, and do things update when a date
// changes?" (Sjoerd, 2026-09-23). Both halves are one feature: a subscription
// is the only shape that answers the second question, because a downloaded
// .ics is a copy the calendar owns from the moment it lands and nothing we do
// afterwards can reach it.
//
// ---------------------------------------------------------------------------
// THE TOKEN IS THE CREDENTIAL, AND IT IS THE ONLY ONE
// ---------------------------------------------------------------------------
// A calendar client fetches this URL from its own servers on its own
// schedule. No cookie, no bearer, no session, no way to add one. So the
// random string in the path is the whole authentication, exactly as it is for
// every calendar subscription anyone has ever used.
//
// What that buys us is a hard rule for this file: `feedEmailForToken` is the
// ONLY thing standing between a stranger and somebody's agenda. Everything
// downstream of it is scoped by the email it returns, the same way the portal
// page is. Never add a path into this file that skips it, and never widen
// what the feed carries beyond what the person's own portal already shows —
// a subscription is a weaker credential than a signed-in session, so it may
// show less, never more.
//
// Looked up by sha256, and ALSO kept readable so the portal can show it
// again. It was hash-only at first, on the app_key pattern — write once, show
// once, unrecoverable. Android is where that broke: Google Calendar cannot
// add a subscription from its phone app, so the real flow is "press Subscribe
// on the phone, then walk to a computer", and a write-once address is on the
// wrong device by the time you get there. Every calendar service shows you
// your own secret address whenever you ask, for exactly this reason.
//
// The hash bought less here than it does for an app key: an app key opens
// other data, while this URL leads to an agenda that sits in plain rows in
// this same database. Anyone who can read this table can already read what it
// protects.
// ---------------------------------------------------------------------------

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { adminClient } from '../db.js';
import { appUrl, surfaceUrl } from '@thefibre/shared';
import {
  DEFAULT_EVENT_MINUTES,
  agendaEventUid,
  buildCalendarFeed,
  type IcalEventInput,
} from '@thefibre/shared/ical';
import { enrolmentCanRespond } from './portal.js';
import { loadAgendaByThread, personsForEmail } from './portal-agenda.js';
import { publicOwnerSlug } from './public-owner-slug.js';

/** Same window the portal page uses. The feed shows what the page shows. */
const PAST_WINDOW_DAYS = 90;

/** 32 bytes of randomness, hex. Long enough that guessing is not a strategy,
 *  short enough to survive being pasted into a settings field by hand. */
function newToken(): string {
  return randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** The address a person pastes into their calendar. Built from the PORTAL's
 *  URL, deliberately, not the API's: a subscription lives in someone's
 *  calendar for years, and the API is still answering on `thefibre-api.fly.dev`
 *  with its own CNAME unshipped. Baking that host into people's calendars is
 *  a decision that cannot be taken back. The portal proxies the fetch. */
export function feedAddress(token: string): { url: string; webcal: string } {
  const url = `${surfaceUrl('my-portal', process.env)}/calendar/${token}.ics`;
  // webcal:// is not a real scheme — it is a hint that makes one click hand
  // the URL to the calendar app instead of the browser. Every major client
  // understands it; the https form stays for the ones that do not.
  return { url, webcal: url.replace(/^https?:\/\//, 'webcal://') };
}

export type FeedStatus = {
  subscribed: boolean;
  created_at: string | null;
  /** When a calendar client last collected it. The only honest answer to
   *  "is my calendar actually following this?" */
  last_read_at: string | null;
  /** The address itself. Null only for rows minted before 2026-09-24, when
   *  nothing but the hash was kept — there is nothing to recover from a hash,
   *  so the portal offers those a new address instead. */
  url: string | null;
  webcal: string | null;
};

export async function feedStatusForEmail(email: string): Promise<FeedStatus> {
  const { data } = await adminClient
    .from('person_calendar_feed')
    .select('created_at, last_read_at, token')
    .eq('email', email)
    .is('revoked_at', null)
    .maybeSingle();

  const token = (data?.token as string | null) ?? null;
  const address = token ? feedAddress(token) : null;
  return {
    subscribed: !!data,
    created_at: (data?.created_at as string | null) ?? null,
    last_read_at: (data?.last_read_at as string | null) ?? null,
    url: address?.url ?? null,
    webcal: address?.webcal ?? null,
  };
}

/**
 * Mint an address, retiring any address this person already had.
 *
 * Deliberately one call for "subscribe" and "this leaked, give me a new one":
 * they are the same operation, and having one path means the revoke can never
 * be the step somebody forgot to run.
 */
export async function mintFeed(email: string): Promise<{ url: string; webcal: string }> {
  const now = new Date().toISOString();
  await adminClient
    .from('person_calendar_feed')
    .update({ revoked_at: now })
    .eq('email', email)
    .is('revoked_at', null);

  const token = newToken();
  const { error } = await adminClient
    .from('person_calendar_feed')
    .insert({ email, token_hash: hashToken(token), token });
  if (error) throw new Error(`could not create calendar address: ${error.message}`);

  return feedAddress(token);
}

export async function revokeFeed(email: string): Promise<void> {
  await adminClient
    .from('person_calendar_feed')
    .update({ revoked_at: new Date().toISOString() })
    .eq('email', email)
    .is('revoked_at', null);
}

/**
 * Whose calendar this token opens, or null.
 *
 * The lookup is by hash — an indexed equality, so an attacker learns nothing
 * from how long it takes. The constant-time compare afterwards is belt and
 * braces against a future where that index goes away; it is what app-keys.ts
 * does and it costs nothing to keep the two consistent.
 */
export async function feedEmailForToken(token: string): Promise<string | null> {
  // Reject before touching the database: the only tokens we ever issue are
  // 64 hex characters, so anything else is someone probing.
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const hash = hashToken(token);
  const { data } = await adminClient
    .from('person_calendar_feed')
    .select('id, email, token_hash')
    .eq('token_hash', hash)
    .is('revoked_at', null)
    .maybeSingle();
  if (!data) return null;

  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(String(data.token_hash), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Not awaited: a calendar client does not care, and a failed bookkeeping
  // write must never cost somebody their calendar.
  void adminClient
    .from('person_calendar_feed')
    .update({ last_read_at: new Date().toISOString() })
    .eq('id', data.id as string)
    .then(undefined, () => {});

  return data.email as string;
}

/**
 * The calendar document for one person.
 *
 * Scoped by email through `personsForEmail`, the same single definition the
 * portal page is scoped by. Threads the person has LEFT are dropped entirely
 * — the page still shows them, because the record of having taken part is
 * theirs, but nobody wants sessions they withdrew from sitting in their
 * calendar for the next six months.
 */
export async function buildFeedForEmail(email: string): Promise<string> {
  const persons = await personsForEmail(email);
  const personIds = persons.map((p) => p.id);
  const attendeeName =
    [persons[0]?.first_name, persons[0]?.last_name].filter(Boolean).join(' ') || null;

  const events: IcalEventInput[] = [];
  if (personIds.length) {
    const { data: enrolments } = await adminClient
      .from('thread_enrolment')
      .select(
        `workspace_id,
         enrolment:enrolment_id (status),
         thread:thread_id (id, slug, public_scope,
           organiser:organiser_id (slug, display_name, user:user_id (email, full_name)),
           team:team_id (slug),
           program:program_id (title))`,
      )
      .in('person_id', personIds);

    // One row per thread: a person can hold more than one enrolment in the
    // same thread, and each would otherwise contribute its agenda again.
    type ThreadRow = {
      workspaceId: string;
      slug: string;
      publicScope: string | null;
      teamSlug: string | null;
      organiserSlug: string | null;
      title: string;
      organiserName: string | null;
      organiserEmail: string | null;
    };
    const live = new Map<string, ThreadRow>();
    for (const e of (enrolments ?? []) as Record<string, unknown>[]) {
      const t = one(e.thread) as Record<string, unknown> | null;
      if (!t) continue;
      const enr = one(e.enrolment) as { status: string | null } | null;
      // A withdrawn enrolment takes the thread off the calendar — unless the
      // person also holds a live one, which the `set` ordering below would
      // get wrong, so a live row is never overwritten by a dropped one.
      if (!enrolmentCanRespond(enr?.status ?? null)) continue;
      const prog = one(t.program) as { title: string } | null;
      const org = one(t.organiser) as
        | { slug: string; display_name: string | null; user: unknown }
        | null;
      const orgUser = one(org?.user) as { email: string | null; full_name: string | null } | null;
      live.set(t.id as string, {
        workspaceId: e.workspace_id as string,
        slug: t.slug as string,
        publicScope: (t.public_scope as string | null) ?? null,
        teamSlug: (one(t.team) as { slug: string } | null)?.slug ?? null,
        organiserSlug: org?.slug ?? null,
        title: prog?.title ?? (t.slug as string),
        // Who the sessions are from, so a subscribed calendar names them.
        organiserName: org?.display_name ?? orgUser?.full_name ?? null,
        organiserEmail: orgUser?.email ?? null,
      });
    }

    const threadIds = [...live.keys()];
    const wsSlug = new Map<string, string>();
    if (threadIds.length) {
      const { data: wsRows } = await adminClient
        .from('workspace')
        .select('id, slug')
        .in('id', [...new Set([...live.values()].map((t) => t.workspaceId))]);
      for (const w of wsRows ?? []) wsSlug.set(w.id as string, w.slug as string);
    }

    const agenda = await loadAgendaByThread({
      threadIds,
      personIds,
      // Nothing here is dropped: withdrawn threads never made it into the
      // list above. The RSVP flag this drives is unused by a calendar.
      droppedThreads: new Set(),
    });

    const since = Date.now() - PAST_WINDOW_DAYS * 86400_000;
    const threadBase = appUrl('the-thread', process.env);

    for (const [threadId, t] of live) {
      const ownerSlug = publicOwnerSlug({
        publicScope: t.publicScope,
        workspaceSlug: wsSlug.get(t.workspaceId),
        teamSlug: t.teamSlug,
        organiserSlug: t.organiserSlug,
      });
      const threadUrl = ownerSlug ? `${threadBase}/${ownerSlug}/${t.slug}` : null;

      for (const item of agenda.get(threadId) ?? []) {
        if (!item.starts_at) continue;
        const startsAt = new Date(item.starts_at);
        if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() < since) continue;
        const endsAt = item.ends_at
          ? new Date(item.ends_at)
          : new Date(startsAt.getTime() + DEFAULT_EVENT_MINUTES * 60_000);

        events.push({
          // The same uid the one-off download uses, so the two are one event.
          uid: agendaEventUid(item.id),
          startsAt,
          endsAt,
          summary: item.title,
          // The thread is the context a calendar entry loses otherwise:
          // three months later "Opening circle" alone means nothing.
          description: [item.description, t.title].filter(Boolean).join('\n\n'),
          location: item.location,
          url: item.meeting_url ?? item.external_url ?? threadUrl,
          organizerName: t.organiserName,
          organizerEmail: t.organiserEmail,
          attendeeName,
          attendeeEmail: email,
        });
      }
    }

    events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  return buildCalendarFeed({
    name: 'My sessions',
    description: 'Everything you are taking part in, from my.thread.',
    prodId: '-//The Fibre//Portal//EN',
    events,
  });
}

const one = <T>(v: unknown): T | null =>
  !v ? null : Array.isArray(v) ? ((v[0] ?? null) as T | null) : (v as T);
