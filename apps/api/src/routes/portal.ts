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

import { getBuyerDetails } from '../lib/buyer-details.js';
import { hostedThreadsFor } from '../lib/main-facilitator.js';
import { Hono } from 'hono';
import { adminClient } from '../db.js';
import { rows } from '../lib/rows.js';
import { participantEmailFromAuth } from '../lib/participant-auth.js';
import { ProfilePatch, ProfileWhereabouts, nullEmptyFace } from './profile.js';
import { syncSeatsFromProfile } from '../lib/identity-profile.js';
import { sanitizeRichText } from '../lib/rich-text.js';
import { removeStoredImage, storeImage } from '../lib/uploads.js';
import { PHOTO_TYPES } from '../lib/strip-metadata.js';
import { z } from 'zod';
import { cancellationStateFor, REQUESTABLE_STATUSES, threadIsOver, type CancellationState } from './thread-cancellation.js';
import {
  markEmailProven,
  personIdsForProvenEmail,
  personsForProvenEmail,
} from '../lib/proven-email.js';
import {
  enrolmentCanRespond,
  groupOwnedProducts,
  mergeById,
  resolveRsvpEnabled,
  ticketIsAdmissible,
} from '../lib/portal.js';
import { loadAgendaByThread, personsForEmail, type AgendaItem } from '../lib/portal-agenda.js';
import { publicOwnerSlug } from '../lib/public-owner-slug.js';
import { placesByThread } from '../lib/place-state.js';
import { ensurePref } from '../lib/member-notify.js';
import { communityView, memberCommunities, signedDocumentUrl } from '../lib/member-page.js';
import { filesFor } from '../lib/portal-files.js';
import { admittedDriveEntry, prepareDownload, serveDownload } from '../lib/drive-connect.js';
import { publicOrigin } from './mcp-discovery.js';
import { DriveError, listFolder } from '../lib/drive.js';
import {
  couldJoinFrom,
  entitlementsByMember,
  holdsTeamCalendar,
  pageCouldJoin,
  sortCouldJoin,
  type CouldJoin,
} from '../lib/could-join.js';
// The entitlement walk and the price arithmetic moved WITH the walk, into
// lib/could-join.ts — this route no longer prices anything itself, which is
// the point of the extraction.
import {
  buildFeedForEmail,
  feedEmailForToken,
  feedStatusForEmail,
  mintFeed,
  revokeFeed,
} from '../lib/calendar-feed.js';
import { erasurePicture, fileErasureRequest } from '../lib/portal-erasure.js';
import { appUrl, isLocale } from '@thefibre/shared';
import { publicOriginFor, threadPublicUrl } from '../lib/public-origin.js';
import { appleWalletConfig, googleWalletConfig } from '../lib/checkin.js';
import { buildInvoicePdf, type PdfInvoice } from '../lib/invoice-pdf.js';
// THE seller resolver, not a copy of it: the same function the receipt email,
// the invoice PDF and now the member's own invoice list all use, so the From
// block cannot differ between a member's screen and their emailed copy.
import { sellerForSale, type SellerDetails } from './purchases.js';
import { threadSlugFromConfig } from '../lib/thread-access.js';
import { cardDatesByWorkspace, loadThreadDates, publicDateFields } from '../lib/thread-dates.js';
import { selectIn } from '../lib/select-in.js';
import { LIVE_PURCHASE_STATUSES } from '../lib/product-ownership.js';

/** A product's `links` column, read defensively — it is jsonb and a product
 *  can be older than the shape. */
function linkList(links: unknown): { kind: string; ref: string; label: string | null }[] {
  if (!Array.isArray(links)) return [];
  return links
    .filter(
      (l): l is { kind?: unknown; ref?: unknown; label?: unknown } =>
        !!l && typeof l === 'object',
    )
    .map((l) => ({
      kind: typeof l.kind === 'string' ? l.kind : '',
      ref: typeof l.ref === 'string' ? l.ref : '',
      label: typeof l.label === 'string' ? l.label : null,
    }))
    .filter((l) => l.kind && l.ref);
}

export const portalRoutes = new Hono();

/**
 * Which wallet buttons the portal may show. The QR and both passes are
 * already served by Thread at /thread/public/checkin/:code/*, and the portal
 * holds the check-in code, so it builds those URLs itself — no route here.
 * What it cannot know is whether the credentials exist: both config readers
 * return null without them and the pass routes 503. A button that fails is
 * worse than no button, so the answer travels with the payload.
 */

function walletAvailability(): { apple: boolean; google: boolean } {
  return { apple: !!appleWalletConfig(), google: !!googleWalletConfig() };
}

const one = <T>(v: T | T[] | null | undefined): T | null =>
  !v ? null : Array.isArray(v) ? v[0] ?? null : v;

// How far back a finished thing stays on the page. Long enough to find last
// month's invoice, short enough that the page is about what's next.
const PAST_WINDOW_DAYS = 90;

/** How many "what you can join" rows the Memberships card shows before
 *  sending the reader to the full list. A glance, not a catalogue. */
const MEMBERSHIP_CARD_ROWS = 6;

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
  /** Who the sessions are FROM. A calendar entry with no organiser is a block
   *  of time from nobody; this is the name a person recognises, and the
   *  address their mail from this thread already comes from. Null when the
   *  owner is a workspace or team rather than a person. */
  organiser_name: string | null;
  organiser_email: string | null;
  /**
   * The certificate this person was issued for this thread, if any.
   *
   * The NUMBER and the date only — never the design. The snapshot is a page
   * of JSON per certificate and the portal payload is already the heaviest
   * call this app makes; the drawing is fetched by the thumbnail, from the
   * public endpoint that renders it for anybody holding the number. So the
   * list stays cheap and nothing is duplicated.
   */
  certificate: { number: string; issued_at: string } | null;
  agenda: AgendaItem[];
  /** You host or facilitate this thread. A HOSTED thread lists only the
   *  sessions you are ticked on, with no RSVP, ticket or certificate — those
   *  are a participant's. A host who is also enrolled appears once, as host. */
  my_role: 'host' | 'facilitator' | null;
  /** Additive (cancellation requests, 2026-10-16): the place this person
   *  holds, its latest cancellation request, and whether they may ask now.
   *  Null / false on a hosted-only thread. */
  enrolment_id?: string | null;
  cancellation_request?: CancellationState;
  can_request_cancellation?: boolean;
  /** Additive (thread dates slice 4): the key-moment span and when sign-ups
   *  close, so my.thread reads the thread's dates through the shared rule
   *  (cardDateLine) like every other surface. */
  event_starts_at?: string | null;
  event_ends_at?: string | null;
  key_moment_count?: number;
  signups_close_at?: string | null;
  timezone?: string | null;
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
  /** Whether Stripe holds a subscription for this member. Manual and comped
   *  members have none, so a "manage payment" control would only ever 409 —
   *  the payload says so rather than the page guessing. */
  has_stripe: boolean;
  /** What this membership actually gets you. Empty is a real answer: a tier
   *  can include nothing but belonging. */
  includes: Included[];
  /** What it lets you JOIN next, at your price. Empty is a real answer too —
   *  a membership may carry no calendar, or its calendars may have nothing
   *  coming up. */
  could_join: CouldJoin[];
};

/** One thing this membership lets you join, and what you would pay.
 *
 *  Only threads that are actually reachable: listed, open for enrolment, on a
 *  published team's calendar, not already joined, not already over. An
 *  unreachable row is worse than no row — it is a promise the member cannot
 *  act on, which is the failure this whole feature keeps circling.
 */

/** One thing a membership includes.
 *
 *  `url` is null when we know you have it but cannot hand you a link — a
 *  Circle space or a Meet booking page needs per-workspace knowledge this
 *  route does not have. Naming it without a link is still worth more than
 *  omitting it, because the member is entitled to know what they are paying
 *  for; a DEAD link would be worth less than nothing.
 */
type Included = {
  name: string;
  description: string | null;
  url: string | null;
};

/** One product this person BOUGHT, and when.
 *
 *  Separate from `Included` because the two answer different questions. A
 *  membership INCLUDES things for as long as you are a member; a product you
 *  bought is yours, and survives a tier change and a lapse. Putting the date
 *  on the second and not the first is the honest shape: there is no date on
 *  which a tier's product became yours, only the day you joined.
 *
 *  Sjoerd asked for the date, and it is the thing a person actually looks for
 *  — "when did I buy this" is the question a receipt answers and a list of
 *  names does not. */
type OwnedProduct = Included & {
  /** The day it was bought, ISO. Never null: a purchase row has a
   *  database-set `created_at`, so an absent date would mean a bug rather
   *  than an unknown. */
  bought_on: string;
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
  /** What this person BOUGHT here, whether or not they are a member.
   *
   *  THE GAP THIS CLOSES: the list of bought products used to be assembled
   *  inside the membership loop and filtered to the workspaces the person
   *  held a membership in — so somebody who bought a product from a community
   *  they had never joined owned it, was granted by it, and could see no sign
   *  of it anywhere. The one surface that should have shown it was keyed on
   *  the wrong thing.
   *
   *  It is PERSON-keyed now. A product-only buyer gets a group of their own,
   *  with no membership card in it and this list in it — which matters more
   *  now that the Members app's `/my` sends everybody here. */
  products: OwnedProduct[];
};

// GET /me/nav — only what my.thread's frame needs on EVERY page.
//
// The layout used to fetch the whole /me/portal (tickets, threads, bookings,
// memberships, products, could-join lists) to read three numbers from it,
// so every page — Members, You, Purchases — paid for the heaviest call in
// the app before it could ask its own question. This answers the three, from
// the same sources and the same rules as /me/portal: the same person scope
// (personsForEmail), the same entitlement walk (entitlementsByMember) for
// `upcoming`, the same statuses for `communities`, the same unread count.
// /me/portal still returns all three, unchanged — additive, for any reader
// that has not moved.
portalRoutes.get('/nav', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  await markEmailProven(email);
  // The reader's chosen language rides along (2026-10-16, my.thread in six
  // languages): the layout decides the language of every page, and this is
  // the one call it already makes. identity_profile is keyed by email — the
  // same row the You page's picker writes and every email reads. ADDITIVE:
  // an older web ignores it, and the web treats a missing field as "no
  // choice made" (lib/locale.ts). A failed read is the same: null, and the
  // page falls back to the browser's language rather than failing.
  const [persons, identity] = await Promise.all([
    personsForEmail(email),
    adminClient.from('identity_profile').select('locale').eq('email', email).maybeSingle(),
  ]);
  if (identity.error) console.error('[portal/nav] locale read failed', identity.error);
  const locale = isLocale(identity.data?.locale as string | null) ? (identity.data?.locale as string) : null;
  const personIds = persons.map((p) => p.id);
  if (!personIds.length) return c.json({ upcoming: false, communities: 0, unread_notifications: 0, locale });

  const [members, unread] = await Promise.all([
    adminClient
      .from('membership_member')
      .select('id, workspace_id, person_id, status')
      .in('person_id', personIds)
      .is('deleted_at', null)
      .then((r) => rows('portal nav: memberships', r)),
    adminClient
      .from('member_notification')
      .select('id', { count: 'exact', head: true })
      .in('person_id', personIds)
      .is('read_at', null),
  ]);
  const entitlements = await entitlementsByMember(
    (members as Record<string, unknown>[])
      .filter((m) => m.person_id)
      .map((m) => ({
        id: m.id as string,
        person_id: m.person_id as string,
        workspace_id: m.workspace_id as string,
      })),
  );
  return c.json({
    upcoming: holdsTeamCalendar(entitlements),
    communities: new Set(
      (members as Record<string, unknown>[])
        .filter((m) => m.status === 'active' || m.status === 'grace')
        .map((m) => m.workspace_id as string),
    ).size,
    unread_notifications: unread.count ?? 0,
    locale,
  });
});

portalRoutes.get('/portal', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);

  // The token in hand proves this person reads this mailbox — it was minted
  // by Google or by the platform's 8-digit code, and nothing else mints one.
  // Record that, so the address keeps reaching their records after a merge
  // moves it off `person.email`.
  //
  // Here rather than at sign-in because the API never sees a sign-in: the
  // session is minted by Supabase and first appears on a request like this
  // one. Idempotent and narrow (it only touches unstamped rows), so the
  // steady state is a no-op, and never fatal — a failure leaves the address
  // unverified and the next visit stamps it.
  await markEmailProven(email);

  // One person row per workspace that knows this email. This list is the
  // scope of everything below (lib/portal-agenda.ts holds the definition, so
  // the calendar feed cannot be scoped by a slightly different rule).
  const persons = await personsForEmail(email);

  const personIds = persons.map((p) => p.id);
  const me = {
    first_name: persons[0]?.first_name ?? null,
    last_name: persons[0]?.last_name ?? null,
    email,
  };
  // The threads this address HOSTS — its own source, beside enrolments,
  // bookings and memberships (lib/main-facilitator.ts hostedThreadsFor).
  // Never part of the ledger or membership logic.
  //
  // Started now and awaited with the reads below: none of them needs it, and
  // it was a full wait (~150ms) in front of all of them.
  const hostedQuery = hostedThreadsFor(email, personIds);
  hostedQuery.catch(() => {});

  const since = new Date(Date.now() - PAST_WINDOW_DAYS * 86400_000).toISOString();
  const sinceDate = since.slice(0, 10);

  // -- Memberships, STARTED HERE and awaited far below ----------------------
  //
  // This query needs `personIds` and nothing else. It used to sit after the
  // enrolments, the certificates and the bookings purely because that is the
  // order somebody wrote them in, so it waited for three waves it has no
  // relationship with. Starting it now costs nothing and removes it from the
  // critical path.
  //
  // `Promise.resolve(...)` AROUND THE BUILDER, and the result is what is kept.
  //
  // A PostgREST builder is NOT a promise. It is a thenable whose `then()`
  // BUILDS THE HEADERS AND PERFORMS THE FETCH — every time it is called
  // (postgrest-js 2.105.4, PostgrestBuilder.ts:256). So holding the builder
  // and awaiting it later does not start anything early; and "starting" it by
  // calling `then()` once and awaiting the builder again runs the query
  // TWICE, throwing the first result away and leaving the latency exactly
  // where it was. That is what the first version of this did, and it was
  // caught in review before it shipped.
  //
  // `Promise.resolve` calls `then()` once, now, and hands back a real promise
  // that settles with that one result. Awaiting it below costs nothing.
  //
  // The `catch` is a guard, not error handling: if a read above throws before
  // this is awaited, an un-awaited rejection would crash the process instead
  // of surfacing the first failure. The real error still arrives at the
  // `await` below, through `rows()`, exactly as before.
  const membersQuery = Promise.resolve(
    adminClient
      .from('membership_member')
      .select(
        `id, workspace_id, person_id, tier_id, status, started_at, renews_at, stripe_customer_id,
       tier:tier_id (name)`,
      )
      .in('person_id', personIds)
      .is('deleted_at', null)
      .order('started_at', { ascending: false }),
  );
  membersQuery.catch(() => {});

  // THE SAME FOR EVERY OTHER READ THAT NEEDS ONLY `personIds` (or the email):
  // the enrolments, the bookings, what was bought, the unread count. They were
  // awaited one after another, each where its section begins — six waits in a
  // row for answers none of the others needed. Started together here, each
  // section below awaits its own, and the handler waits about as long as the
  // slowest of them. Measured against staging for a member of two
  // communities (2026-10-16): 3.1s before, with the could-join walk's own
  // fix (lib/could-join.ts) — see CHANGELOG for the after.
  //
  // The meet bookings are two queries merged, deliberately, rather than one
  // `.or(...)`. PostgREST's or() takes a STRING, so an email would be
  // interpolated into filter syntax — and `,` `(` `)` `.` are all meaningful
  // there. The email is verified, not trusted-safe: what a token proves is
  // that someone receives mail at that address, not that the address is inert
  // inside a query language. Two typed filters have no such surface.
  const meetSelect = `id, workspace_id, starts_at, ends_at, status, meet_url, alternative_location,
       meeting_type:meeting_type_id (name),
       host:host_id (slug, user:user_id (full_name))`;
  const bookingsQuery = Promise.all([
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
  const boughtQuery = Promise.resolve(
    personIds.length
      ? adminClient
          .from('membership_product_purchase')
          .select('workspace_id, product_id, created_at')
          .in('person_id', personIds)
          .in('status', LIVE_PURCHASE_STATUSES)
          .order('created_at', { ascending: false })
      : { data: [] },
  );
  const unreadQuery = Promise.resolve(
    adminClient
      .from('member_notification')
      .select('id', { count: 'exact', head: true })
      .in('person_id', personIds)
      .is('read_at', null),
  );
  // -- Threads + tickets ----------------------------------------------------
  // The lists on this page throw on a failed read (lib/rows.ts). "No tickets"
  // with a 200 because a select broke is the silent failure §1.9 is about.
  const enrolmentsQuery = Promise.resolve(
    adminClient
      .from('thread_enrolment')
      .select(
        `id, workspace_id, checkin_code, checked_in_at, payment_status, created_at,
       enrolment:enrolment_id (status, progress_pct),
       thread:thread_id (id, slug, language, cover_url, public_scope,
         organiser:organiser_id (slug, display_name, user:user_id (email, full_name)),
         team:team_id (slug, name),
         program:program_id (title, format, status, starts_on, ends_on))`,
      )
      .in('person_id', personIds)
      .order('created_at', { ascending: false }),
  );
  for (const q of [bookingsQuery, boughtQuery, unreadQuery, enrolmentsQuery]) q.catch(() => {});

  const hosted = await hostedQuery;
  const hostedRole = new Map(hosted.map((h) => [h.thread_id, h.role]));
  if (!personIds.length && !hosted.length) return c.json({ person: me, wallet: walletAvailability(), groups: [] });

  const enrolments = rows('portal: enrolments', await enrolmentsQuery);

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

  const enrolledThreadIds = new Set(threadIds);
  const hostedOnly = hosted.map((h) => h.thread_id).filter((id) => !enrolledThreadIds.has(id));
  // Hosted-only threads ask for no RSVP: nothing to answer as a host.
  for (const id of hostedOnly) droppedThreads.add(id);

  // THREE READS THAT NEED ONLY WHAT IS NOW IN HAND, together: the agenda, the
  // certificates and the hosted-only threads' details. Each is described
  // where it is used below.
  const enrolmentIds = (enrolments ?? []).map((e) => e.id as string);
  const certsQuery = Promise.resolve(
    enrolmentIds.length
      ? adminClient
          .from('thread_certificate')
          .select('thread_enrolment_id, certificate_number, issued_at')
          .in('thread_enrolment_id', enrolmentIds)
      : { data: [], error: null },
  );
  const hostedThreadsQuery = Promise.resolve(
    hostedOnly.length
      ? adminClient
          .from('thread_thread')
          .select(
            `id, workspace_id, slug, language, cover_url, public_scope,
             organiser:organiser_id (slug, display_name, user:user_id (email, full_name)),
             team:team_id (slug, name),
             program:program_id (title, format, status, starts_on, ends_on)`,
          )
          .in('id', hostedOnly)
      : { data: [], error: null },
  );
  for (const q of [certsQuery, hostedThreadsQuery]) q.catch(() => {});

  // WHAT THIS MEMBERSHIP LETS YOU JOIN, started here and awaited far below.
  // It needs the memberships and the enrolments and nothing in between, and
  // it is the slowest walk on the page (the entitlements, then the open
  // threads and their payment routes): run after the products, as it was, it
  // added its whole length to theirs. The walk is described where its result
  // is read.
  const joinWalk = (async () => {
    const members = rows('portal: memberships', await membersQuery);
    const [places, entitlements] = await Promise.all([
      placesByThread(
        (enrolments ?? []).map((e) => ({
          id: e.id as string,
          thread_id: (one(e.thread as never) as { id?: string } | null)?.id ?? null,
          payment_status: (e.payment_status as string | null) ?? null,
          enrolment_status:
            (one(e.enrolment as never) as { status?: string | null } | null)?.status ?? null,
        })),
      ),
      entitlementsByMember(
        ((members ?? []) as Record<string, unknown>[])
          .filter((m) => m.person_id)
          .map((m) => ({
            id: m.id as string,
            person_id: m.person_id as string,
            workspace_id: m.workspace_id as string,
          })),
      ),
    ]);
    return { entitlements, couldJoinByMemberId: await couldJoinFrom(entitlements, places, MEMBERSHIP_CARD_ROWS) };
  })();
  joinWalk.catch(() => {});

  const agendaByThread = await loadAgendaByThread({
    threadIds: [...threadIds, ...hostedOnly],
    // A host with an account may have no person row here; the RSVP read then
    // matches nothing, which is right for a host.
    personIds: personIds.length ? personIds : ['00000000-0000-0000-0000-000000000000'],
    droppedThreads,
    email,
  });
  for (const [threadId, items] of agendaByThread) {
    // A session YOU host is not one you answer for, enrolled or not.
    for (const it of items) if (it.my_role) it.rsvp_enabled = false;
    // A hosted-only thread shows only the sessions you are ticked on.
    if (hostedOnly.includes(threadId)) agendaByThread.set(threadId, items.filter((it) => it.my_role));
  }

  // -- Certificates ---------------------------------------------------------
  //
  // Keyed on the ENROLMENT, one per enrolment, which is how the issuer writes
  // them. Scoped by the enrolment ids we just found — those came from
  // personIds, so this inherits the same filter rather than trusting a second
  // one (Sjoerd, 2026-09-25: certificates belong on the person's own page).
  const certByEnrolment = new Map<string, { number: string; issued_at: string }>();
  {
    const certs = rows('portal: certificates', await certsQuery);
    for (const c of certs ?? []) {
      certByEnrolment.set(c.thread_enrolment_id as string, {
        number: c.certificate_number as string,
        issued_at: c.issued_at as string,
      });
    }
  }

  // -- Meets (dual key: person id OR the email on the booking) --------------
  // Two typed queries, started at the top (the comment there says why not one
  // `.or(...)`).
  const [byPerson, byEmail] = await bookingsQuery;
  const bookings = mergeById(
    rows('portal: bookings by person', byPerson),
    rows('portal: bookings by email', byEmail),
  ).sort((a, b) =>
    (a.starts_at as string).localeCompare(b.starts_at as string),
  );

  // -- Memberships ----------------------------------------------------------
  // Started at the top of the handler; by here it has almost always landed.
  const members = rows('portal: memberships', await membersQuery);

  // WHAT A MEMBERSHIP INCLUDES.
  //
  // Sjoerd: "click and then what it contains, with links to what is
  // included". Two sources, and both are the member's by different routes:
  // the non-optional products of their TIER, which they hold for as long as
  // they are a member, and the products they BOUGHT à la carte, which they
  // own outright and keep through a tier change or a lapse. That is the same
  // pair `applyEntitlements` resolves grants from — this is the same fact
  // shown to the person rather than executed against a tool.
  //
  // Optional products are excluded because ENTITLEMENTS exclude them —
  // `applyEntitlements` filters `optional = false` too, so listing them here
  // would tell a member "your membership includes X" for an X the system
  // does not grant them. Listing what is not granted is worse than listing
  // nothing. (An optional product bought à la carte arrives through the
  // purchase side below, which is the path that DOES grant it.)
  const includesByMember = new Map<string, Included[]>();
  const productsByWorkspace = new Map<string, OwnedProduct[]>();
  const memberRows = (members ?? []) as Record<string, unknown>[];

  // WHAT THIS PERSON BOUGHT — asked of the PERSON, not of their memberships.
  //
  // This query used to live inside `if (memberRows.length)` and carry a
  // `.in('workspace_id', <workspaces I am a member of>)`. Both were wrong in
  // the same direction: a purchase belongs to the person, survives a tier
  // change and a lapse, and does not need a membership to exist. So somebody
  // who bought a product from a community they had never joined owned it, was
  // granted access by it, and could see no sign of it anywhere.
  //
  // `created_at` comes back now, because "when did I buy this" is the
  // question a person actually asks of a list like this.
  const { data: bought } = await boughtQuery;
  const boughtRows = (bought ?? []) as {
    workspace_id: string;
    product_id: string;
    created_at: string;
  }[];

  if (memberRows.length || boughtRows.length) {
    const tierIds = [...new Set(memberRows.map((m) => m.tier_id as string).filter(Boolean))];
    const { data: tierProducts } = tierIds.length
      ? await adminClient
          .from('membership_tier_product')
          .select('tier_id, product_id')
          .in('tier_id', tierIds)
          .eq('optional', false)
      : { data: [] };
    const tierProductRows = (tierProducts ?? []) as { tier_id: string; product_id: string }[];

    const productIds = [
      ...new Set([
        ...tierProductRows.map((r) => r.product_id),
        ...boughtRows.map((r) => r.product_id),
      ]),
    ];
    const { data: products } = productIds.length
      ? await adminClient
          .from('membership_product')
          .select('id, workspace_id, name, description, links')
          .in('id', productIds)
      : { data: [] };
    const productRows = (products ?? []) as {
      id: string;
      workspace_id: string;
      name: string;
      description: string | null;
      links: unknown;
    }[];

    // A `thread` link stores a REF, not a URL, so it needs resolving before
    // it can be offered — one query for all of them rather than one each.
    const threadSlugs = new Set<string>();
    for (const p of productRows) {
      for (const l of linkList(p.links)) {
        if (l.kind === 'thread') {
          const slug = threadSlugFromConfig({ thread_slug: l.ref });
          if (slug) threadSlugs.add(slug);
        }
      }
    }
    const threadUrlByKey = new Map<string, string>();
    if (threadSlugs.size) {
      // Scoped to the workspaces this person actually belongs to, and keyed
      // by (workspace, slug): a thread slug is unique per organiser, never
      // globally. Resolving by slug alone would hand someone another
      // community's thread.
      const memberWorkspaces = [...new Set(memberRows.map((m) => m.workspace_id as string))];
      const { data: threads } = await adminClient
        .from('thread_thread')
        .select('slug, workspace_id, public_scope, team:team_id (slug), organiser:organiser_id (slug)')
        .in('workspace_id', memberWorkspaces)
        .in('slug', [...threadSlugs]);
      const wsSlug = new Map<string, string>();
      const { data: wsRows } = await adminClient
        .from('workspace')
        .select('id, slug')
        .in('id', memberWorkspaces);
      for (const w of wsRows ?? []) wsSlug.set(w.id as string, w.slug as string);
      for (const t of (threads ?? []) as Record<string, unknown>[]) {
        const team = one(t.team as never) as { slug: string } | null;
        const organiser = one(t.organiser as never) as { slug: string } | null;
        const ownerSlug = publicOwnerSlug({
          publicScope: t.public_scope as string | null,
          workspaceSlug: wsSlug.get(t.workspace_id as string),
          teamSlug: team?.slug,
          organiserSlug: organiser?.slug,
        });
        if (!ownerSlug) continue;
        threadUrlByKey.set(
          `${t.workspace_id as string}:${t.slug as string}`,
          await threadPublicUrl(ownerSlug, t.slug as string),
        );
      }

      // A RENAMED thread: a product link still holding its old slug resolves
      // through the slug history to where the thread lives now — in the same
      // community, and only when exactly one thread ever wore that slug there.
      const found = new Set((threads ?? []).map((t) => t.slug as string));
      const missing = [...threadSlugs].filter((sl) => !found.has(sl));
      if (missing.length) {
        const { data: hist } = await adminClient
          .from('thread_slug_history')
          .select('thread_id, workspace_id, old_slug')
          .in('workspace_id', memberWorkspaces)
          .in('old_slug', missing);
        const byKey = new Map<string, Set<string>>();
        for (const h of hist ?? []) {
          const key = `${h.workspace_id as string}:${h.old_slug as string}`;
          byKey.set(key, (byKey.get(key) ?? new Set()).add(h.thread_id as string));
        }
        const single = [...byKey].filter(([, ids]) => ids.size === 1).map(([key, ids]) => [key, [...ids][0]!] as const);
        if (single.length) {
          const { data: moved } = await adminClient
            .from('thread_thread')
            .select('id, slug, workspace_id, public_scope, team:team_id (slug), organiser:organiser_id (slug)')
            .in('id', single.map(([, id]) => id));
          const byId = new Map(((moved ?? []) as Record<string, unknown>[]).map((t) => [t.id as string, t]));
          for (const [key, id] of single) {
            const t = byId.get(id);
            if (!t) continue;
            const ownerSlug = publicOwnerSlug({
              publicScope: t.public_scope as string | null,
              workspaceSlug: wsSlug.get(t.workspace_id as string),
              teamSlug: (one(t.team as never) as { slug: string } | null)?.slug,
              organiserSlug: (one(t.organiser as never) as { slug: string } | null)?.slug,
            });
            if (ownerSlug) threadUrlByKey.set(key, await threadPublicUrl(ownerSlug, t.slug as string));
          }
        }
      }
    }

    const productById = new Map(productRows.map((p) => [p.id, p]));
    const toIncluded = (productId: string, workspaceId: string): Included | null => {
      const p = productById.get(productId);
      if (!p) return null;
      // ONE destination per included thing, chosen by KIND and not by the
      // order somebody happened to add the links in. The product dialog has
      // no reorder control — links are appended and deleted — so first-wins
      // would make the answer an editing artefact: the same product could
      // point two different places depending on which link was typed first.
      //
      // A `thread` beats a `url` because it is the one we RESOLVED: looked up
      // in this member's own workspace and confirmed to exist. A url is
      // whatever was pasted, checked only for a scheme. When a product has
      // both, the resolved one lands the member inside the thing rather than
      // on a page about it.
      const links = linkList(p.links);
      let url: string | null = null;
      for (const l of links) {
        if (l.kind !== 'thread') continue;
        const slug = threadSlugFromConfig({ thread_slug: l.ref });
        const resolved = slug ? threadUrlByKey.get(`${workspaceId}:${slug}`) : undefined;
        if (resolved) {
          url = resolved;
          break;
        }
      }
      if (!url) {
        url = links.find((l) => l.kind === 'url' && /^https?:\/\//.test(l.ref))?.ref ?? null;
      }
      return { name: p.name, description: p.description ?? null, url };
    };

    // "WHAT THIS INCLUDES" IS NOW THE TIER'S, AND ONLY THE TIER'S.
    //
    // A product bought à la carte used to be listed here as well, which read
    // as though the membership included it — and then it stayed listed after
    // a lapse, when the membership included nothing at all. It moves to "Your
    // products" below, where it keeps its date and does not depend on a
    // membership to be shown. Nothing is lost from the page; it moves, and
    // gains the day it was bought.
    for (const m of memberRows) {
      const workspaceId = m.workspace_id as string;
      const ids = tierProductRows
        .filter((r) => r.tier_id === m.tier_id)
        .map((r) => r.product_id);
      includesByMember.set(
        m.id as string,
        [...new Set(ids)]
          .map((id) => toIncluded(id, workspaceId))
          .filter((x): x is Included => !!x),
      );
    }

    // "YOUR PRODUCTS", per workspace, membership or no membership. The
    // grouping is `lib/portal.ts` so the ordering and the de-duplication can
    // be stated in a test rather than read out of this loop.
    for (const [ws, list] of groupOwnedProducts(boughtRows, toIncluded)) {
      productsByWorkspace.set(ws, list);
    }
  }

  // -- WHAT THIS MEMBERSHIP LETS YOU JOIN -----------------------------------
  //
  // The member price has been charged correctly since v1.164.0 and quoted on
  // the public page since v1.166.0 — but only to somebody who had already
  // found the thread. A membership that carries a team's whole calendar had
  // nowhere to show that calendar. This is it.
  //
  // THE WALK ITSELF MOVED to lib/could-join.ts, so the full "Upcoming
  // threads" page can call the same one. A second walk would eventually
  // quote a different price from this card, and the person who found the
  // disagreement would be a member who clicked one number and was charged
  // another.
  //
  // SIX HERE, and the page shows the rest. A card is a glance, not a
  // catalogue — and the sort runs before the cap inside the walk, so these
  // are the soonest six rather than an arbitrary six.
  // The enrol route's own decision (lib/place-state.ts): only an unpaid card
  // attempt is offered again; a held place, an open invoice or a place the
  // organiser closed is not.
  // The entitlements are kept, not only the list: whether ANY membership
  // carries a team calendar is what shows "Upcoming" in my.thread's nav.
  // (Both started as `joinWalk` above.)
  const { entitlements, couldJoinByMemberId } = await joinWalk;
  const upcoming = holdsTeamCalendar(entitlements);
  // The dot on my.thread's bell (lib/member-notify.ts). Counted across every
  // community this address is a person in.
  const { count: unreadCount } = await unreadQuery;
  const unread_notifications = unreadCount ?? 0;
  // How many communities this address is a live member of: one means
  // my.thread lands on that community's page; any means a Community item.
  const communities = new Set(
    ((members ?? []) as Record<string, unknown>[])
      .filter((m) => m.status === 'active' || m.status === 'grace')
      .map((m) => m.workspace_id as string),
  ).size;

  // -- Hosted threads: the details the enrolments brought for theirs ---------
  const hostedThreads = rows('portal: hosted threads', await hostedThreadsQuery);

  // -- Group by workspace ---------------------------------------------------
  const workspaceIds = [
    ...new Set([
      ...(enrolments ?? []).map((e) => e.workspace_id as string),
      ...bookings.map((b) => b.workspace_id as string),
      ...(members ?? []).map((m) => m.workspace_id as string),
      // A BOUGHT PRODUCT IS A REASON TO HAVE A GROUP. Without this line the
      // person who only ever bought something has no workspace here at all,
      // and the endpoint answers `groups: []` — an empty page for somebody
      // who has paid. Which is what it did until 2026-10-14.
      ...productsByWorkspace.keys(),
      ...hostedThreads.map((t) => t.workspace_id as string),
    ]),
  ].filter(Boolean);

  if (!workspaceIds.length) {
    return c.json({ person: me, wallet: walletAvailability(), groups: [], upcoming, unread_notifications, communities });
  }

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
      products: productsByWorkspace.get(w.id as string) ?? [],
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
    const org = one(t.organiser as never) as
      | { slug: string; display_name: string; user: unknown }
      | null;
    const orgUser = one(org?.user as never) as { email: string | null; full_name: string | null } | null;
    const team = one(t.team as never) as { slug: string; name: string } | null;
    const enr = one(e.enrolment as never) as { status: string | null; progress_pct: number | null } | null;

    // Finished threads fall off the page after the window; anything current
    // or upcoming stays regardless of date.
    const ended = prog?.ends_on ?? prog?.starts_on ?? null;
    if (ended && ended < sinceDate && enr?.status === 'completed') continue;

    // Public URL owner segment — lib/public-owner-slug.ts holds the rule and
    // the history of getting it wrong. Not a 404 when it is wrong: brief D2
    // keeps /{organiser}/{thread} valid as a second address, so the cost is
    // canonicality, not reachability, which is exactly why it went unnoticed.
    const ownerSlug = publicOwnerSlug({
      publicScope: t.public_scope,
      workspaceSlug: g.slug,
      teamSlug: team?.slug,
      organiserSlug: org?.slug,
    });

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
      url: await threadPublicUrl(ownerSlug, t.slug as string),
      organiser_name: org?.display_name ?? orgUser?.full_name ?? g.name ?? null,
      organiser_email: orgUser?.email ?? null,
      certificate: certByEnrolment.get(e.id as string) ?? null,
      agenda: agendaByThread.get(t.id) ?? [],
      // Enrolled AND hosting: one entry, marked as host.
      my_role: hostedRole.get(t.id) ?? null,
      enrolment_id: e.id as string,
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

  // HOSTED threads the person is not enrolled in. No ticket and no
  // certificate (a participant's), no RSVP (switched off above).
  for (const t of hostedThreads) {
    const g = groups.get(t.workspace_id as string);
    if (!g) continue;
    const prog = one(t.program as never) as
      | { title: string; format: string; status: string; starts_on: string | null; ends_on: string | null }
      | null;
    const org = one(t.organiser as never) as { slug: string; display_name: string; user: unknown } | null;
    const orgUser = one(org?.user as never) as { email: string | null; full_name: string | null } | null;
    const team = one(t.team as never) as { slug: string; name: string } | null;
    const ownerSlug = publicOwnerSlug({
      publicScope: t.public_scope as string | null,
      workspaceSlug: g.slug,
      teamSlug: team?.slug,
      organiserSlug: org?.slug,
    });
    g.threads.push({
      thread_id: t.id as string,
      title: prog?.title ?? (t.slug as string),
      format: prog?.format ?? 'event',
      status: prog?.status ?? 'active',
      starts_on: prog?.starts_on ?? null,
      ends_on: prog?.ends_on ?? null,
      language: (t.language as string | null) ?? 'en',
      cover_url: (t.cover_url as string | null) ?? null,
      enrolment_status: null,
      progress_pct: null,
      url: await threadPublicUrl(ownerSlug, t.slug as string),
      organiser_name: org?.display_name ?? orgUser?.full_name ?? g.name ?? null,
      organiser_email: orgUser?.email ?? null,
      certificate: null,
      agenda: agendaByThread.get(t.id as string) ?? [],
      my_role: hostedRole.get(t.id as string) ?? null,
    });
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
      has_stripe: !!m.stripe_customer_id,
      includes: includesByMember.get(m.id as string) ?? [],
      could_join: couldJoinByMemberId.get(m.id as string) ?? [],
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

  // The dates of every thread listed, in one batched read, merged in last so
  // neither push site above has to know about them (thread dates slice 4).
  const listedThreads = out.flatMap((g) => g.threads);
  if (listedThreads.length) {
    const ids = listedThreads.map((t) => t.thread_id);
    const [datesById, zones] = await Promise.all([
      loadThreadDates(ids),
      // The zone the dates are read in — a key moment at 23:30 in New York is
      // a different DAY in Amsterdam.
      selectIn<{ id: string; timezone: string | null }>('portal: thread zones', ids, (chunk) =>
        adminClient.from('thread_thread').select('id, timezone').in('id', chunk).order('id'),
      ),
    ]);
    const zoneOf = new Map(zones.map((z) => [z.id, z.timezone]));
    for (const t of listedThreads) {
      Object.assign(t, publicDateFields(datesById.get(t.thread_id)), { timezone: zoneOf.get(t.thread_id) ?? null });
    }

    // Cancellation: the latest request per place, and whether the button is
    // offered — the same three rules the POST refuses by
    // (routes/thread-cancellation.ts whyNotRequestable): a place that still
    // holds, no certificate, the thread not over. Offer and refusal read the
    // same facts, so the button never promises what the route then refuses.
    const placeIds = listedThreads.map((t) => t.enrolment_id).filter((x): x is string => !!x);
    const requests = await cancellationStateFor(placeIds);
    const now = new Date();
    for (const t of listedThreads) {
      if (!t.enrolment_id) continue;
      const req = requests.get(t.enrolment_id) ?? null;
      t.cancellation_request = req;
      t.can_request_cancellation =
        req?.status !== 'pending' &&
        req?.status !== 'approved' &&
        REQUESTABLE_STATUSES.includes((t.enrolment_status ?? '') as (typeof REQUESTABLE_STATUSES)[number]) &&
        !t.certificate &&
        !threadIsOver(datesById.get(t.thread_id), now);
    }
  }
  return c.json({ person: me, wallet: walletAvailability(), groups: out, upcoming, unread_notifications, communities });
});

// ===========================================================================
// Notifications — GET /me/portal/notifications, POST …/read,
// GET/PUT /me/portal/notification-prefs
//
// The member's in-app list (lib/member-notify.ts): type + subject + date,
// newest first, across every community this address is a person in. Reading
// the list marks it read; the email switch is per community.
// ===========================================================================

const NOTIFICATION_PAGE = 30;

portalRoutes.get('/portal/notifications', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const persons = await personsForEmail(email);
  if (!persons.length) return c.json({ items: [], next_cursor: null });

  // Cursor = created_at|id of the last row: a total order, so a page boundary
  // between two rows written in one instant neither skips nor repeats one.
  const cursor = c.req.query('cursor') ?? null;
  let q = adminClient
    .from('member_notification')
    .select('id, workspace_id, kind, thread_id, subject, starts_at, read_at, created_at, workspace:workspace_id (name)')
    .in('person_id', persons.map((p) => p.id))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(NOTIFICATION_PAGE + 1);
  if (cursor) {
    // The cursor comes from the query string and goes into a PostgREST
    // `.or()`, which is a filter LANGUAGE — interpolating it unchecked lets a
    // caller write their own filter. So it must be exactly an ISO timestamp
    // and a uuid, or it is refused.
    const m = /^(\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))\|([0-9a-f-]{36})$/i.exec(cursor);
    if (!m) return c.json({ error: 'bad cursor' }, 400);
    const [, at, id] = m;
    q = q.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`);
  }
  const list = rows('portal: notifications', await q);
  const page = list.slice(0, NOTIFICATION_PAGE);
  const last = page[page.length - 1];
  return c.json({
    items: page.map((n) => ({
      id: n.id,
      kind: n.kind,
      thread_id: n.thread_id,
      subject: n.subject,
      starts_at: n.starts_at,
      read: !!n.read_at,
      created_at: n.created_at,
      community: (one(n.workspace as never) as { name?: string } | null)?.name ?? null,
    })),
    next_cursor: list.length > NOTIFICATION_PAGE && last ? `${last.created_at}|${last.id}` : null,
  });
});

portalRoutes.post('/portal/notifications/read', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const persons = await personsForEmail(email);
  if (persons.length) {
    await adminClient
      .from('member_notification')
      .update({ read_at: new Date().toISOString() })
      .in('person_id', persons.map((p) => p.id))
      .is('read_at', null);
  }
  return c.json({ ok: true });
});

portalRoutes.get('/portal/notification-prefs', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const persons = await personsForEmail(email);
  if (!persons.length) return c.json({ items: [] });
  const ids = persons.map((p) => p.id);
  const [{ data: personRows }, { data: prefs }] = await Promise.all([
    adminClient.from('person').select('id, workspace_id, workspace:workspace_id (name)').in('id', ids),
    adminClient.from('member_notification_pref').select('person_id, email_off').in('person_id', ids),
  ]);
  const off = new Map((prefs ?? []).map((p) => [p.person_id as string, p.email_off as boolean]));
  return c.json({
    items: ((personRows ?? []) as Record<string, unknown>[]).map((p) => ({
      workspace_id: p.workspace_id,
      community: (one(p.workspace as never) as { name?: string } | null)?.name ?? null,
      email_off: off.get(p.id as string) ?? false,
    })),
  });
});

portalRoutes.put('/portal/notification-prefs', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const body = (await c.req.json().catch(() => null)) as { workspace_id?: unknown; email_off?: unknown } | null;
  if (!body || typeof body.workspace_id !== 'string' || typeof body.email_off !== 'boolean') {
    return c.json({ error: 'workspace_id and email_off are required' }, 400);
  }
  // Only a community this verified address is a person in — never one named
  // by the body alone.
  const ids = (await personsForEmail(email)).map((p) => p.id);
  const { data: person } = ids.length
    ? await adminClient
        .from('person')
        .select('id, workspace_id')
        .in('id', ids)
        .eq('workspace_id', body.workspace_id)
        .limit(1)
        .maybeSingle()
    : { data: null };
  if (!person) return c.json({ error: 'not found' }, 404);
  await ensurePref(person.id as string, person.workspace_id as string);
  await adminClient
    .from('member_notification_pref')
    .update({ email_off: body.email_off, updated_at: new Date().toISOString() })
    .eq('person_id', person.id);
  return c.json({ ok: true, email_off: body.email_off });
});

// ===========================================================================
// The community page — GET /me/portal/community,
// GET /me/portal/community/:ws/documents/:id (lib/member-page.ts)
//
// Active or grace members only. A document is never a lasting address: the
// second route checks membership and answers a 60-second signed URL.
// ===========================================================================

portalRoutes.get('/portal/community', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const mine = await memberCommunities(email);
  const items = await Promise.all(mine.map((m) => communityView(m)));
  return c.json({ items: items.sort((a, b) => a.name.localeCompare(b.name)) });
});

portalRoutes.get('/portal/community/:ws/documents/:id', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const url = await signedDocumentUrl(email, c.req.param('ws'), c.req.param('id'));
  // One answer for "not a member" and "no such document": the difference is
  // nobody's business but a member's.
  if (!url) return c.json({ error: 'not found' }, 404);
  return c.json({ url });
});

// A connected Google Drive folder (lib/drive.ts, lib/drive-connect.ts;
// 2026-10-17). Admitted on EVERY request by the member-page predicate plus
// the binding; `?folder=` must sit under the bound root (the parents walk), so
// another community's folder id answers 404 like a folder that is not there.
portalRoutes.get('/portal/community/:ws/drive/:docId', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const ws = c.req.param('ws');
  const doc = await admittedDriveEntry(email, ws, c.req.param('docId'));
  if (!doc) return c.json({ error: 'not found', code: 'not_found' }, 404);
  try {
    return c.json(await listFolder(ws, doc.folder_id, c.req.query('folder') ?? null, c.req.query('locale') ?? 'en'));
  } catch (e) {
    if (e instanceof DriveError) {
      if (e.code === 'not_found') return c.json({ error: 'not found', code: 'not_found' }, 404);
      if (e.code === 'not_shared') return c.json({ error: 'this folder is not available right now', code: 'not_shared' }, 409);
      return c.json({ error: 'files are not available right now', code: 'unavailable' }, 503);
    }
    throw e;
  }
});

// A 60-second link to one file of a connected folder. my.thread POSTs with
// the member's session and redirects the browser to `url`, so the bytes come
// from this API (Fly), never through a Next route, and no Drive URL ever
// reaches the browser.
portalRoutes.post('/portal/community/:ws/drive/:docId/download', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const body = (await c.req.json().catch(() => null)) as { file_id?: unknown } | null;
  const r = await prepareDownload(email, c.req.param('ws'), c.req.param('docId'), body?.file_id, publicOrigin(c.req.raw.headers));
  if ('error' in r && r.error) return c.json({ error: r.error.code.replace('_', ' '), code: r.error.code }, r.error.status);
  return c.json(r);
});

// The stream. The token IS the authority (no session, no X-App-ID: a browser
// redirect carries neither); it is re-checked against the membership, the
// audience, the binding and the bound root before a byte moves.
portalRoutes.get('/portal/drive-download', async (c) => {
  const r = await serveDownload(c.req.query('token'));
  if ('error' in r && r.error) {
    // A browser landed here: words, not JSON.
    const words: Record<string, string> = {
      not_found: 'This link has expired or is not yours. Go back to Files and open it again.',
      not_shared: 'This folder is not available right now.',
      not_exportable: 'This kind of file cannot be downloaded here.',
      too_large: 'This file is too large to download here.',
      unavailable: 'Google Drive did not answer. Try again in a minute.',
      drive_not_configured: 'Google Drive is not set up here yet.',
    };
    return c.text(words[r.error.code] ?? 'Not available.', r.error.status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  }
  const headers = new Headers({
    'Content-Type': r.contentType || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${r.filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(r.filename)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  const len = r.body!.headers.get('content-length');
  if (len) headers.set('Content-Length', len);
  return new Response(r.body!.body, { status: 200, headers });
});

// ===========================================================================
// Files — GET /me/portal/files (lib/portal-files.ts, Sjoerd 2ij)
//
// Every document this verified address may open: its communities' member
// pages (tier-filtered) and what its live threads have released to it. No
// rule of its own — see the head of lib/portal-files.ts. A stored file is
// opened through the community document route above, which signs it.
// ===========================================================================

portalRoutes.get('/portal/files', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  return c.json({ items: await filesFor(email) });
});

// ===========================================================================
// Upcoming threads — GET /me/portal/upcoming?cursor=&size=
//
// Everything the member's team calendars let them join, uncapped and paged:
// the full list behind the Memberships card's six. The SAME walk as the card
// (lib/could-join.ts), so the two can never quote different prices.
//
// `entitled` is separate from `items` on purpose: an entitled member with an
// empty calendar this month is told "nothing coming up", and somebody with no
// team calendar at all is told they have none — two different sentences.
// ===========================================================================

const UPCOMING_PAGE = 20;

portalRoutes.get('/portal/upcoming', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);

  const personIds = (await personsForEmail(email)).map((p) => p.id);
  if (!personIds.length) return c.json({ entitled: false, items: [], next_cursor: null });

  const [members, enrolled] = await Promise.all([
    adminClient
      .from('membership_member')
      .select('id, workspace_id, person_id')
      .in('person_id', personIds)
      .is('deleted_at', null)
      .then((r) => rows('portal upcoming: members', r)),
    adminClient
      .from('thread_enrolment')
      .select('id, thread_id, payment_status, enrolment:enrolment_id (status)')
      .in('person_id', personIds)
      .then((r) => rows('portal upcoming: enrolments', r)),
  ]);

  const entitlements = await entitlementsByMember(
    members.map((m) => ({
      id: m.id as string,
      person_id: m.person_id as string,
      workspace_id: m.workspace_id as string,
    })),
  );
  const places = await placesByThread(
    enrolled.map((e) => ({
      id: e.id as string,
      thread_id: (e.thread_id as string | null) ?? null,
      payment_status: (e.payment_status as string | null) ?? null,
      enrolment_status:
        (one(e.enrolment as never) as { status?: string | null } | null)?.status ?? null,
    })),
  );
  const byMember = await couldJoinFrom(entitlements, places, null);

  // ONE ROW PER THREAD. Two memberships can reach the same calendar (a tier
  // and a separately bought product in one workspace are two routes to one
  // team), and the member is charged the better of the two — so that is the
  // one shown.
  const best = new Map<string, CouldJoin>();
  for (const list of byMember.values()) {
    for (const row of list) {
      const seen = best.get(row.thread_id);
      if (!seen || row.your_price_cents < seen.your_price_cents) best.set(row.thread_id, row);
    }
  }

  const size = Math.min(Math.max(Number(c.req.query('size')) || UPCOMING_PAGE, 1), 50);
  const { items, nextCursor } = pageCouldJoin(
    sortCouldJoin([...best.values()]),
    c.req.query('cursor') ?? null,
    size,
  );
  // Each community's card choice, keyed by workspace (additive, thread dates
  // slice 4): these rows are cards from a community's calendar, so each reads
  // its dates the way that community chose for its cards.
  const card_dates = await cardDatesByWorkspace(items.map((i) => i.workspace_id ?? ''));
  return c.json({ entitled: holdsTeamCalendar(entitlements), items, next_cursor: nextCursor, card_dates });
});

// ===========================================================================
// Removing your data — GET/POST /me/portal/erasure
//
// The reasoning, and the answer to "what if they also organise things", is in
// lib/portal-erasure.ts. In short: the request is always accepted, the person
// is told beforehand what is kept by law and what is blocked because other
// people depend on it, and a human does the erasing.
// ===========================================================================

portalRoutes.get('/portal/erasure', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  return c.json(await erasurePicture(email));
});

portalRoutes.post('/portal/erasure', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const body = (await c.req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 500) : null;
  return c.json(await fileErasureRequest({ email, reason }));
});

// ===========================================================================
// The subscribable calendar — GET/POST/DELETE /me/portal/calendar, and the
// feed itself at GET /me/calendar/:token
//
// Sjoerd, 2026-09-23: "can I also subscribe to the whole sequence? And do
// things get updates when there is a change in date?" One feature, because a
// downloaded .ics can never answer the second question — the calendar owns
// that copy from the moment it lands.
//
// The reasoning about the token, and why it is the only credential a calendar
// client can carry, is in lib/calendar-feed.ts. Read it before touching the
// feed handler.
// ===========================================================================

portalRoutes.get('/portal/calendar', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  return c.json(await feedStatusForEmail(email));
});

// Create the address, or replace one that leaked. Same handler for both:
// minting always retires whatever came before, so "give me a new one" cannot
// leave the old one alive through a forgotten second step.
portalRoutes.post('/portal/calendar', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  await mintFeed(email);
  return c.json(await feedStatusForEmail(email));
});

portalRoutes.delete('/portal/calendar', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  await revokeFeed(email);
  return c.json({ subscribed: false, created_at: null, last_read_at: null, url: null, webcal: null });
});

// The feed. NO SESSION — see lib/calendar-feed.ts: a calendar client cannot
// carry one, so the token in the path is the whole authentication. This is
// the one handler under /me that does not call participantEmailFromAuth, and
// it is deliberate; feedEmailForToken is what stands in its place.
//
// A bad token answers 404, not 401: there is no credential to re-present and
// nothing to be gained by telling a prober which addresses have ever existed.
portalRoutes.get('/calendar/:token', async (c) => {
  // The `.ics` suffix is for the calendar clients that decide what a URL is
  // by looking at its extension. It is not part of the token.
  const token = c.req.param('token').replace(/\.ics$/i, '');
  const email = await feedEmailForToken(token);
  if (!email) return c.text('Not found', 404);

  const ics = await buildFeedForEmail(email);
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="my-sessions.ics"',
      // Always re-read. The whole point is that a moved session moves.
      'Cache-Control': 'no-store, max-age=0',
    },
  });
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

  // Their own address OR one they have PROVEN belongs to them — see
  // lib/proven-email.ts. Asking `person.email` alone locked people out of
  // their own portal the moment two of their records were merged.
  const persons = await personsForProvenEmail(email);
  const personByWorkspace = new Map(persons.map((p) => [p.workspace_id, p.id]));
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

// ===========================================================================
// GET /api/v1/me/invoices — every invoice, across every app
// ===========================================================================
//
// Sjoerd: "invoices please — it was there in version 1." They were, per
// membership: `/membership/portal/me/invoices?member_id=…` answers for ONE
// membership and nothing else. A member also buys thread tickets, meet
// bookings and one-off products, and none of those had a member-facing
// endpoint at all — the ledger's own routes scope to organiser-or-admin,
// which is precisely what a member is not.
//
// Money asked about later is asked about AS MONEY ("what did I pay"), not as
// "which of my four memberships was that under" — so this is one list, not a
// section inside each thing (docs/member-portal-plan.md §3).
//
// SECURITY: the same rule as every handler above — adminClient bypasses RLS,
// so the email filter IS the model. `purchase` is one of the DUAL-KEY tables:
// a row written before a person existed carries an email and no person id, a
// row an organiser typed carries a person id and no email. Both are matched,
// as two typed queries merged by id — never a PostgREST `.or()` string with
// an email interpolated into it.

type PortalInvoice = {
  id: string;
  app: string;
  workspace: string;
  item_label: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  stripe_invoice_url: string | null;
  // ── what the DOCUMENT needs (2026-10-11) ───────────────────────────────
  // The list showed a row and a PDF link; a member could never read the
  // invoice itself. These are the fields InvoicePurchase wants so the shared
  // dialog — the same one Thread, Meet and the platform open — can render it
  // here too, read-only.
  //
  // All of it is the member's OWN data about their own purchase: their name,
  // their billing block, how they paid. Nothing about the seller's internals
  // and nothing about anybody else is added by this.
  method: string;
  payer_name: string;
  payer_email: string | null;
  billing: unknown;
  /** Who sold it, composed by the SAME resolver the receipt email and the
   *  PDF use (sellerForSale) — personal-first for Thread and Meet, the
   *  workspace for Membership. A second rule here would be a second answer
   *  to "whose invoice is this", on the one document where that must not
   *  vary. */
  seller: SellerDetails | null;
};

// `organiser_user_id` is selected for the SELLER LOOKUP ONLY and never
// returned: whose user id ran the sale is the workspace's business, not the
// buyer's.
const INVOICE_SELECT =
  'id, workspace_id, item_label, amount_cents, currency, status, method, created_at, paid_at, stripe_invoice_url, person_id, payer_name, payer_email, billing, organiser_user_id, app:app_id (slug, name)';

portalRoutes.get('/invoices', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);

  const personIds = await personIdsForProvenEmail(email);

  type LedgerRow = Record<string, unknown> & { id: string };
  const [byPerson, byEmail] = await Promise.all([
    personIds.length
      ? adminClient.from('purchase').select(INVOICE_SELECT).in('person_id', personIds)
      : Promise.resolve({ data: [] }),
    adminClient.from('purchase').select(INVOICE_SELECT).eq('payer_email', email),
  ]);
  const rows = mergeById(
    byPerson.data as unknown as LedgerRow[],
    byEmail.data as unknown as LedgerRow[],
  );
  if (!rows.length) return c.json({ items: [] });

  // Workspace names, one query — the member knows the community, not its id.
  const workspaceIds = [...new Set(rows.map((r) => r.workspace_id as string))];
  const { data: workspaces } = await adminClient
    .from('workspace')
    .select('id, name')
    .in('id', workspaceIds);
  const nameOf = new Map((workspaces ?? []).map((w) => [w.id as string, w.name as string]));

  // Sellers, resolved ONCE per distinct (app, workspace, organiser) rather
  // than once per row: a member with eight tickets from one organiser is the
  // ordinary case, and sellerForSale is three queries each time.
  const sellerKey = (r: LedgerRow) => {
    const app = one(r.app as never) as { slug: string } | null;
    return `${app?.slug ?? ''}|${r.workspace_id as string}|${(r.organiser_user_id as string) ?? ''}`;
  };
  const sellers = new Map<string, SellerDetails | null>();
  await Promise.all(
    [...new Set(rows.map(sellerKey))].map(async (key) => {
      const [appSlug, workspaceId, organiserUserId] = key.split('|');
      try {
        sellers.set(
          key,
          await sellerForSale(appSlug ?? '', workspaceId ?? '', organiserUserId || null),
        );
      } catch (e) {
        // Never fatal: an invoice with no From block is still the invoice,
        // and a member looking for what they paid should not meet an error
        // because a workspace has not filled in its address.
        console.error('[portal invoices] seller lookup failed', e);
        sellers.set(key, null);
      }
    }),
  );

  const items: PortalInvoice[] = rows
    .map((r) => {
      const app = one(r.app as never) as { slug: string; name: string } | null;
      return {
        id: r.id as string,
        app: app?.slug ?? '',
        workspace: nameOf.get(r.workspace_id as string) ?? '',
        item_label: (r.item_label as string) ?? '',
        amount_cents: (r.amount_cents as number) ?? 0,
        currency: (r.currency as string) ?? 'EUR',
        status: (r.status as string) ?? 'pending',
        created_at: r.created_at as string,
        paid_at: (r.paid_at as string | null) ?? null,
        stripe_invoice_url: (r.stripe_invoice_url as string | null) ?? null,
        method: (r.method as string) ?? 'invoice',
        payer_name: (r.payer_name as string) ?? '',
        payer_email: (r.payer_email as string | null) ?? null,
        billing: (r.billing as unknown) ?? null,
        seller: sellers.get(sellerKey(r)) ?? null,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return c.json({ items });
});

// GET /api/v1/me/invoices/:id/pdf — the document itself, for any app.
//
// The membership-only twin at /membership/portal/me/invoices/:id/pdf stays:
// Membership's own /my calls it, and it is deployed and verified. This one
// answers for a thread ticket and a meet booking too, which that one cannot.
// Both prove ownership the same way and both resolve the seller through
// `sellerForSale`, so a membership invoice names the community and a thread
// invoice names the person — see its comment for why that difference exists.
portalRoutes.get('/invoices/:id/pdf', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);

  const personIds = await personIdsForProvenEmail(email);

  const { data: purchase } = await adminClient
    .from('purchase')
    .select('*, app:app_id (slug)')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (!purchase) return c.json({ error: 'not found' }, 404);

  // Not 403: whether a given invoice id exists is not this person's business.
  const mine =
    (purchase.person_id && personIds.includes(purchase.person_id as string)) ||
    (typeof purchase.payer_email === 'string' &&
      purchase.payer_email.toLowerCase() === email.toLowerCase());
  if (!mine) return c.json({ error: 'not found' }, 404);

  const appSlug = (one(purchase.app as never) as { slug: string } | null)?.slug ?? '';
  const seller = (await sellerForSale(
    appSlug,
    purchase.workspace_id as string,
    (purchase.organiser_user_id as string | null) ?? null,
  )) ?? { legal_name: '' };
  const pdf = await buildInvoicePdf(purchase as unknown as PdfInvoice, {
    legal_name: seller.legal_name ?? '',
    ...seller,
  });
  const number = String(
    (purchase.billing as { number?: string } | null)?.number ?? (purchase.id as string),
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${number.replace(/[^A-Za-z0-9-]/g, '')}.pdf"`,
    },
  });
});

// ===========================================================================
// GET / PATCH /api/v1/me/profile — the member's own details
// ===========================================================================
//
// Slice 5 of docs/member-portal-plan.md, and the one destination that was
// read-only: the YOU tab could show a name and no way to correct it.
//
// WHAT A MEMBER MAY CHANGE, and where each thing lives:
//
//   name      → every `person` row that carries their verified email.
//               `person` is PER WORKSPACE, so someone in three communities
//               has three rows, and a name corrected in one place and not
//               the others is a worse state than not offering the edit. All
//               of them, or none.
//
//   language  → `identity_profile.locale`, which is keyed by EMAIL and is
//               already what the email templates and the app chrome read
//               (i18n P2, D1). One identity, one preference, everywhere.
//
// WHAT THEY MAY NOT: the email. It is the key this entire route is scoped
// by — changing it here would not move their tickets, it would orphan them.
// Nor anything an app collected ABOUT them: that is curator data, it exists
// because a specific app justified it (brief §5), and it is not the person's
// to rewrite from here.
//
// Why a member editing organiser-visible rows is correct rather than
// alarming: a name is identity, not curator data, and GDPR Article 16 is a
// right to RECTIFY inaccurate personal data. "My name is spelled wrong on my
// invoice" is exactly the case, and routing it through an email to an
// organiser is the thing this portal exists to stop.

/** Trim to null — an empty box means "cleared", not the empty string. */
function trimmed(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

portalRoutes.get('/profile', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);

  const [{ data: persons }, { data: identity }] = await Promise.all([
    adminClient
      .from('person')
      .select('first_name, last_name, created_at')
      .eq('email', email)
      .is('deleted_at', null)
      // `person` has no updated_at — newest row first is the closest proxy
      // for "most recently typed" when two organisers disagree. Checked
      // against the live schema, which is the only way to know: a PostgREST
      // select is a string and the type-checker never reads it.
      .order('created_at', { ascending: false }),
    adminClient
      .from('identity_profile')
      .select('locale, display_name, bio, short_bio, photo_url, timezone, city, website_url, linkedin_url')
      .eq('email', email)
      .maybeSingle(),
  ]);

  // The newest row WITH A NAME wins when they disagree, which they can: two
  // organisers typed the name independently before this page existed. "With
  // a name" since 2026-10-15 — the newest row alone let a nameless contact
  // in another community blank the page (marieke@soul.com). The platform
  // profile's name is the last resort.
  const rowsByAge = (persons ?? []) as { first_name?: string | null; last_name?: string | null }[];
  const named = rowsByAge.find((p) => p.first_name?.trim() || p.last_name?.trim());
  const platformName = ((identity?.display_name as string | null) ?? '').trim();
  const [pFirst, ...pRest] = platformName ? platformName.split(/\s+/) : [];

  // THE BILLING DETAILS (lib/buyer-details.ts): the member's own, kept in
  // The Fibre and edited on Purchases; else the last checkout's snapshot.
  const buyer = await getBuyerDetails(email);
  const b = buyer.address || buyer.company || buyer.country ? (buyer as unknown as Record<string, unknown>) : null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  return c.json({
    email,
    first_name: named?.first_name?.trim() || (named ? null : (pFirst ?? null)),
    last_name: named?.last_name?.trim() || (named ? null : (pRest.join(' ') || null)),
    locale: (identity?.locale as string | null) ?? null,
    // THE ONE PROFILE (additive, 2026-10-16; Sjoerd: "the same profile as
    // people would have in the Thread. Not a new profile."): identity_profile,
    // the row Settings → Profile in The Fibre edits, keyed by this email. A
    // member who later gets a seat finds it there with nothing to re-enter.
    // `display_name` is null when never written; the form seeds it from the
    // name above.
    face: {
      display_name: (identity?.display_name as string | null) ?? null,
      bio: (identity?.bio as string | null) ?? null,
      short_bio: (identity?.short_bio as string | null) ?? null,
      photo_url: (identity?.photo_url as string | null) ?? null,
      timezone: (identity?.timezone as string | null) ?? null,
      city: (identity?.city as string | null) ?? null,
      website_url: (identity?.website_url as string | null) ?? null,
      linkedin_url: (identity?.linkedin_url as string | null) ?? null,
    },
    // Additive (2026-10-15): read-only, null when no checkout carried one.
    billing_details: b
      ? {
          company: str(b.company),
          address: str(b.address),
          postal_code: str(b.postal_code),
          city: str(b.city),
          country: str(b.country),
          tax_no: str(b.tax_no),
        }
      : null,
    /** How many communities the change will reach. The page says so before
     *  they save, because "this updates your name everywhere" is a fact they
     *  are entitled to before they press it, not after. */
    person_rows: (persons ?? []).length,
  });
});

portalRoutes.patch('/profile', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: 'expected a JSON body' }, 400);

  const first_name = trimmed(body.first_name, 100);
  const last_name = trimmed(body.last_name, 100);
  const locale = typeof body.locale === 'string' ? body.locale : undefined;
  if (locale !== undefined && locale !== '' && !isLocale(locale)) {
    return c.json({ error: 'not a language we speak' }, 400);
  }

  // A name that is blank on both halves would leave the person unnameable on
  // every list an organiser reads. Refuse rather than accept it silently.
  if (first_name === null && last_name === null) {
    return c.json({ error: 'a name cannot be empty' }, 400);
  }

  const namePatch: Record<string, string | null> = {};
  if (first_name !== undefined) namePatch.first_name = first_name;
  if (last_name !== undefined) namePatch.last_name = last_name;

  if (Object.keys(namePatch).length) {
    const { error } = await adminClient
      .from('person')
      .update(namePatch)
      .eq('email', email)
      .is('deleted_at', null);
    if (error) {
      console.error('[portal/profile] name update failed', error);
      return c.json({ error: 'could not save your name' }, 500);
    }
  }

  if (locale !== undefined) {
    const { error } = await adminClient.from('identity_profile').upsert(
      {
        email,
        locale: locale === '' ? null : locale,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    );
    if (error) {
      console.error('[portal/profile] locale update failed', error);
      return c.json({ error: 'could not save your language' }, 500);
    }
  }

  // THE FACE — the same fields and the same rules as Settings → Profile
  // (routes/profile.ts ProfilePatch): one schema, one sanitiser, one limit.
  // The photo is not taken from here: it is set by POST /profile/photo, so a
  // member can never point their face at an arbitrary URL. `photo_url: null`
  // is the one value accepted — it removes the photo.
  const face = FacePatch.safeParse(body.face ?? {});
  if (!face.success) return c.json({ error: 'some fields were not accepted', fieldErrors: face.error.flatten().fieldErrors }, 400);
  const f: Record<string, unknown> = { ...face.data };
  if (typeof f.bio === 'string') f.bio = sanitizeRichText(f.bio as string);
  if (f.display_name === '') f.display_name = null;
  nullEmptyFace(f);
  const removePhoto = f.photo_url === null;
  delete f.photo_url;
  if (Object.keys(f).length || removePhoto) {
    const before = removePhoto ? await identityRow(email) : null;
    const { error } = await adminClient
      .from('identity_profile')
      .upsert({ email, ...f, ...(removePhoto ? { photo_url: null } : {}), updated_at: new Date().toISOString() }, { onConflict: 'email' });
    if (error) {
      console.error('[portal/profile] face update failed', error);
      return c.json({ error: 'could not save your profile' }, 500);
    }
    if (before?.photo_url) await removeStoredImage(before.photo_url, `profiles/${before.id}`);
    // The seats this person holds show the same name and photo (v1.253.1).
    await syncSeatsFromProfile(email, {
      ...(typeof f.display_name === 'string' ? { full_name: f.display_name } : {}),
      ...(removePhoto ? { avatar_url: null } : {}),
    });
  }

  return c.json({ ok: true });
});

const FacePatch = ProfilePatch.pick({ display_name: true, bio: true, short_bio: true, timezone: true })
  .extend(ProfileWhereabouts)
  .extend({ photo_url: z.null().optional() });

/** The person's identity_profile row, made when there is none yet — a
 *  participant without a seat has no row until they first save. */
async function identityRow(email: string): Promise<{ id: string; photo_url: string | null }> {
  const read = await adminClient.from('identity_profile').select('id, photo_url').eq('email', email).maybeSingle();
  if (read.error) throw new Error(`identity_profile read failed: ${read.error.message}`);
  if (read.data) return read.data as { id: string; photo_url: string | null };
  const made = await adminClient
    .from('identity_profile')
    .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true })
    .select('id, photo_url')
    .maybeSingle();
  if (made.data) return made.data as { id: string; photo_url: string | null };
  const again = await adminClient.from('identity_profile').select('id, photo_url').eq('email', email).single();
  if (again.error || !again.data) throw new Error(`identity_profile create failed: ${again.error?.message ?? made.error?.message}`);
  return again.data as { id: string; photo_url: string | null };
}

// POST /api/v1/me/profile/photo — the member's own photo, through THE upload
// pipeline (lib/uploads.ts storeImage: 5MB, metadata stripped). Stored under
// profiles/<identity_profile.id>/ in the shared public bucket — never under a
// workspace (a participant has none) and never with the email in the path.
// Saved at once; the photo it replaces is deleted, but only when it lies
// under that same folder.
portalRoutes.post('/profile/photo', async (c) => {
  const email = await participantEmailFromAuth(c);
  if (!email) return c.json({ error: 'sign in required' }, 401);
  const body = await c.req.parseBody().catch(() => null);
  const file = body?.file;
  if (!(file instanceof File)) return c.json({ error: 'multipart field "file" required' }, 400);
  let row: { id: string; photo_url: string | null };
  try {
    row = await identityRow(email);
  } catch (e) {
    console.error('[portal/profile] photo: profile row', (e as Error).message);
    return c.json({ error: 'could not save your photo' }, 500);
  }
  const prefix = `profiles/${row.id}`;
  // A 5-minute CDN cache: a photo the member removes stops being served
  // within minutes (the storage default is an hour).
  const stored = await storeImage(file, prefix, PHOTO_TYPES, 300);
  if ('error' in stored) return c.json({ error: stored.error }, stored.status);
  const { error } = await adminClient
    .from('identity_profile')
    .update({ photo_url: stored.url, updated_at: new Date().toISOString() })
    .eq('email', email);
  if (error) {
    console.error('[portal/profile] photo save failed', error);
    await removeStoredImage(stored.url, prefix);
    return c.json({ error: 'could not save your photo' }, 500);
  }
  if (row.photo_url && row.photo_url !== stored.url) await removeStoredImage(row.photo_url, prefix);
  await syncSeatsFromProfile(email, { avatar_url: stored.url });
  return c.json({ url: stored.url }, 201);
});
