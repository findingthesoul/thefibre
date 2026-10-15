// What a membership lets somebody join — the one walk, for every surface.
//
// This lived inside `routes/portal.ts`, producing the six-row card on the
// Memberships page. "Upcoming threads" needs the same list, uncapped and
// paginated, and the one thing it must not be is a second walk: a member who
// found a different price on the full list from the one on the card would
// have found a disagreement about money, and neither number would be
// obviously the wrong one.
//
// So it moved here unchanged, and both surfaces call it. The functions it
// leans on are the ones that CHARGE — `teamCalendarEntitlements` for who is
// entitled, `resolveBasePrice` for which ticket, `enrolmentPrice` for the
// number — because a list that worked its own prices out would be a third
// statement of one rule.
import { adminClient } from '../db.js';
import { loadThreadDates, type ThreadDates } from './thread-dates.js';
import { signupsOpenAt } from '@thefibre/shared/thread-dates';
import { rows } from './rows.js';
import { publicOwnerSlug } from './public-owner-slug.js';
import { threadPublicUrl } from './public-origin.js';
import { joinableFromList, type PlaceState } from './place-state.js';
import { joinPayment, routeResolver, type JoinPayment, type Method } from './thread-payment-route.js';
import {
  enrolmentPrice,
  priceCurrencyOf,
  resolveBasePrice,
  entitlementKey,
  teamCalendarEntitlementsFor,
} from './member-discount.js';

export type CouldJoin = {
  thread_id: string;
  title: string;
  url: string;
  starts_on: string | null;
  /** Additive (thread dates): the first key moment, and when sign-ups close —
   *  so the list can say "Sign up by …". */
  event_starts_at?: string | null;
  signups_close_at?: string | null;
  /** The calendar it is on, by name — the member joined a community, not a
   *  uuid. */
  team: string;
  /** What anybody pays, so the member can see what the membership is worth. */
  list_price_cents: number;
  /** What THEY pay, from the same function that charges them. */
  your_price_cents: number;
  currency: string;
  /** The percentage, so the page can say "included" at 100 without a second
   *  rule for which sentence to use. */
  pct: number;
  /** The two halves of the public address, so my.thread can enrol the member
   *  through the ONE enrol route (POST /thread/public/enrol) rather than a
   *  second one that would price on its own. */
  owner_slug: string;
  thread_slug: string;
  /** True when one click can complete the sign-up: no REQUIRED question
   *  (that is answered on the thread's page), and either nothing to pay or a
   *  card checkout that actually works. */
  direct: boolean;
  /** How this member would pay (lib/thread-payment-route.ts): nothing,
   *  card, an invoice (billing details, so the thread's page), or not at all
   *  — a paid thread with no working route, which shows "Sign-up not open
   *  yet" and never a button into a dead end. */
  payment: JoinPayment;
};

/** One membership, as this walk needs it. */
export type CouldJoinMember = {
  id: string;
  person_id: string | null;
  workspace_id: string;
};

const one = <T>(v: T | T[] | null | undefined): T | null =>
  !v ? null : Array.isArray(v) ? v[0] ?? null : v;

/** Is this thing still joinable on `today`?
 *
 *  THE END DATE DECIDES WHEN THERE IS ONE. This used to drop anything whose
 *  START was in the past, which is right for a one-day workshop and wrong for
 *  the shape soul.com actually sells: "Community agenda 2026" opened on 1
 *  October and runs the year, so on 2 October it vanished from the list of
 *  what a membership lets you join — while still being, in life, the main
 *  thing the membership was for. (Found on production 2026-10-14 while
 *  working out why the card was empty; the rule is Sjoerd's call, made the
 *  same day.)
 *
 *  So: a thread with an end date is joinable until that date passes, and only
 *  a thread with NO end date falls back to its start. A dateless thread is
 *  always joinable — it has made no claim about when it happens.
 *
 *  `today` is an argument, never `new Date()` inside: a wall-clock test
 *  passes in UTC CI and fails in Amsterdam.
 */
export function stillJoinable(
  program: { starts_on?: string | null; ends_on?: string | null },
  today: string,
): boolean {
  if (program.ends_on) return program.ends_on >= today;
  if (program.starts_on) return program.starts_on >= today;
  return true;
}


/** Is this thread ON its team's calendar, as a member sees it: team
 *  published and active, programme active, and its SIGN-UP WINDOW still open
 *  at `now` (thread dates, 2026-10-16 — @thefibre/shared/thread-dates; with
 *  no key moment a team-calendar thread keeps the old rule, open through its
 *  last day, now in its own zone). `dates` missing (a failed load) falls back
 *  to stillJoinable, so a read error never empties a member's calendar.
 *  (Sign-up open is filtered in the query that loads the candidates.)
 *
 *  ONE definition, for the Upcoming list and for "new on your calendar"
 *  (lib/member-notify.ts): a thread announced as new must be a thread the
 *  member then finds in the list. */
export function calendarVisible(t: Record<string, unknown>, dates: ThreadDates | undefined, now: Date): boolean {
  const team = one(t.team as never) as { is_published: boolean | null; is_active: boolean | null } | null;
  const program = one(t.program as never) as
    | { status: string; starts_on: string | null; ends_on: string | null }
    | null;
  if (!team || team.is_published !== true || team.is_active === false) return false;
  if (!program || program.status !== 'active') return false;
  return dates ? signupsOpenAt(dates, now) : stillJoinable(program, now.toISOString().slice(0, 10));
}

/** Everything these memberships can join, by membership id.
 *
 *  `places` is the state of every place this person already has, by thread
 *  id (lib/place-state.ts). Only an unpaid card attempt is offered again —
 *  exactly when the enrol route would accept; a held, invoiced or closed
 *  place is not.
 *
 *  `limit` caps each member's list. The Memberships card wants a few; the
 *  full page wants all of them. Null means no cap, and the sort runs before
 *  the slice either way, so a capped list is the SOONEST few rather than an
 *  arbitrary few. */
export async function couldJoinByMember(
  members: CouldJoinMember[],
  places: Map<string, PlaceState>,
  limit: number | null,
): Promise<Map<string, CouldJoin[]>> {
  return couldJoinFrom(await entitlementsByMember(members), places, limit);
}

export type Entitlements = Map<string, { teamId: string; pct: number }[]>;

/** Which team calendars each membership carries, by membership id.
 *
 *  ONE BATCHED WALK for all of them (since 2026-10-16) — it was one walk per
 *  membership, three to five sequential round trips each, and every my.thread
 *  page paid for it. Same answer by construction (`pickTeamCalendars`) and by
 *  test (entitlements-batched.int.test.ts). Lapsed and cancelled memberships
 *  still answer an empty list by the walk's own predicate (active and grace
 *  only) rather than by a filter here — one place decides who is entitled. */
export async function entitlementsByMember(members: CouldJoinMember[]): Promise<Entitlements> {
  const live = members.filter((m): m is CouldJoinMember & { person_id: string } => !!m.person_id);
  const byKey = await teamCalendarEntitlementsFor(
    live.map((m) => ({ personId: m.person_id, workspaceId: m.workspace_id })),
  );
  const entitlements: Entitlements = new Map();
  for (const m of live) {
    entitlements.set(m.id, byKey.get(entitlementKey({ personId: m.person_id, workspaceId: m.workspace_id })) ?? []);
  }
  return entitlements;
}

/** Does any membership carry a team calendar at all? This decides whether
 *  my.thread shows "Upcoming" — and it is asked of the ENTITLEMENT, not of the
 *  list, so a member whose calendar is empty this month still finds the page
 *  and is told so, rather than the nav changing shape with the calendar. */
export function holdsTeamCalendar(entitlements: Entitlements): boolean {
  return [...entitlements.values()].some((list) => list.length > 0);
}

/** A required sign-up question means the thread's own form, not one click. */
export function hasRequiredQuestion(fields: unknown): boolean {
  return (
    Array.isArray(fields) &&
    fields.some((f) => !!f && typeof f === 'object' && (f as { required?: unknown }).required === true)
  );
}

/** The walk, from entitlements already in hand. */
export async function couldJoinFrom(
  entitlements: Entitlements,
  places: Map<string, PlaceState>,
  limit: number | null,
): Promise<Map<string, CouldJoin[]>> {
  const out = new Map<string, CouldJoin[]>();

  const teamIds = [
    ...new Set([...entitlements.values()].flatMap((list) => list.map((e) => e.teamId))),
  ];
  if (!teamIds.length) return out;

  const now = new Date();
  const candidates = rows(
    'portal: could join',
    await adminClient
      .from('thread_thread')
      .select(
        `id, slug, workspace_id, team_id, price_cents, price_currency, public_scope,
         registration_fields,
         team:team_id (slug, name, is_published, is_active),
         payment_destination, payment_methods,
         organiser:organiser_id (slug, user_id),
         program:program_id (title, status, starts_on, ends_on)`,
      )
      .in('team_id', teamIds)
      // NOT `is_public_listed`. That switch decides whether a thread shows on
      // the PUBLIC organiser page; it says nothing about whether a member may
      // see it. Sjoerd, 2026-10-14: "As it is published they can see it. Even
      // if the button Public is switched off." The thread page itself never
      // checked it either, so every link here still resolves.
      .eq('public_enrolment_open', true),
  );

  // Reachable, or it does not belong in a list of what you can join.
  const datesById = await loadThreadDates(candidates.map((t) => t.id as string));
  const open = candidates.filter((t) => calendarVisible(t, datesById.get(t.id as string), now));

  // Tickets for all of them at once, and the price from the same two
  // functions the enrol POST uses.
  const nowIso = new Date().toISOString();
  const ticketsByThread = new Map<
    string,
    { id: string; price_cents: number; price_currency?: string; payment_methods: string[] | null }[]
  >();
  if (open.length) {
    const { data: tickets } = await adminClient
      .from('thread_ticket')
      .select('id, thread_id, price_cents, price_currency, payment_methods, sales_open_at, sales_close_at')
      .in(
        'thread_id',
        open.map((t) => t.id as string),
      )
      .eq('is_active', true);
    for (const tk of (tickets ?? []) as Record<string, unknown>[]) {
      const openAt = tk.sales_open_at as string | null;
      const closeAt = tk.sales_close_at as string | null;
      if (openAt && openAt > nowIso) continue;
      if (closeAt && closeAt < nowIso) continue;
      const list = ticketsByThread.get(tk.thread_id as string) ?? [];
      list.push({
        id: tk.id as string,
        price_cents: tk.price_cents as number,
        payment_methods: (tk.payment_methods as string[] | null) ?? null,
        ...(tk.price_currency ? { price_currency: tk.price_currency as string } : {}),
      });
      ticketsByThread.set(tk.thread_id as string, list);
    }
  }

  const wsSlugById = new Map<string, string>();
  if (open.length) {
    const { data: wsRows } = await adminClient
      .from('workspace')
      .select('id, slug')
      .in('id', [...new Set(open.map((t) => t.workspace_id as string))]);
    for (const w of wsRows ?? []) wsSlugById.set(w.id as string, w.slug as string);
  }

  // How each thread can be paid, resolved at most once per thread and only
  // for a thread somebody would actually pay for (a 100% member needs no
  // route). Keyed by thread, then by the ticket's methods.
  const resolvers = new Map<string, Promise<(m: string[] | null) => Promise<Method[]>>>();
  const routesOf = (t: Record<string, unknown>, ticketMethods: string[] | null) => {
    const id = t.id as string;
    if (!resolvers.has(id)) {
      const organiser = one(t.organiser as never) as { user_id?: string | null } | null;
      resolvers.set(
        id,
        routeResolver({
          workspace_id: t.workspace_id as string,
          team_id: (t.team_id as string | null) ?? null,
          payment_destination: (t.payment_destination as string | null) ?? null,
          payment_methods: (t.payment_methods as string[] | null) ?? null,
          organiser_user_id: organiser?.user_id ?? null,
        }),
      );
    }
    return resolvers.get(id)!.then((r) => r(ticketMethods));
  };

  for (const [memberId, held] of entitlements) {
    const byTeam = new Map(held.map((e) => [e.teamId, e.pct]));
    const mine: CouldJoin[] = [];
    for (const t of open) {
      const pct = byTeam.get(t.team_id as string);
      if (pct === undefined) continue;
      // Narrowed above in `open`; re-read rather than carried, and still
      // guarded, because a cast is not a check.
      const team = one(t.team as never) as { slug: string; name: string } | null;
      const organiser = one(t.organiser as never) as { slug: string } | null;
      const program = one(t.program as never) as { title: string; starts_on: string | null } | null;
      if (!team || !program) continue;
      const ownerSlug = publicOwnerSlug({
        publicScope: t.public_scope as string | null,
        workspaceSlug: wsSlugById.get(t.workspace_id as string),
        teamSlug: team.slug,
        organiserSlug: organiser?.slug,
      });
      // No address, no offer: a row the member cannot click is worse than
      // no row.
      if (!ownerSlug) continue;
      const base = resolveBasePrice(
        {
          price_cents: (t.price_cents as number | null) ?? null,
          price_currency: priceCurrencyOf(t as { price_currency?: string | null }),
        },
        ticketsByThread.get(t.id as string) ?? [],
        null,
      );
      const priced = enrolmentPrice(base.basePriceCents, null, pct);
      // An existing place: offered exactly when the enrol route would take
      // the sign-up (lib/place-state.ts), with the route's own notion of
      // "requires payment" — this member's price above zero.
      if (!joinableFromList(places.get(t.id as string), priced.cents > 0)) continue;
      const ticketMethods =
        (ticketsByThread.get(t.id as string) ?? []).find((k) => k.id === base.ticketId)?.payment_methods ?? null;
      const payment = joinPayment(priced.cents, priced.cents > 0 ? await routesOf(t, ticketMethods) : []);
      mine.push({
        thread_id: t.id as string,
        title: program.title,
        url: await threadPublicUrl(ownerSlug, t.slug as string),
        starts_on: program.starts_on ?? null,
        event_starts_at: datesById.get(t.id as string)?.event?.start ?? null,
        signups_close_at: datesById.get(t.id as string)?.signupsCloseAt ?? null,
        team: team.name,
        list_price_cents: base.basePriceCents,
        your_price_cents: priced.cents,
        currency: base.priceCurrency,
        pct,
        owner_slug: ownerSlug,
        thread_slug: t.slug as string,
        direct:
          !hasRequiredQuestion(t.registration_fields) &&
          (payment === 'none_needed' || payment === 'card'),
        payment,
      });
    }
    // Soonest first, and undated last: a list of what is coming up is
    // ordered by when, not by when it was created. BEFORE any cap, so a
    // capped list is the soonest few and not an arbitrary few.
    //
    // AND THE ORDER IS TOTAL — `thread_id` breaks a tie on the date.
    //
    // It was by date alone, which is fine for a card that shows six and
    // stops. It is not fine for a paginated list: two threads starting the
    // same day had no defined order between them, so the row that ended page
    // one could be a different row on the next request, and the cursor would
    // skip one or repeat one. A sort that is "good enough to look at" is not
    // good enough to paginate.
    mine.sort(
      (a, b) =>
        (a.starts_on ?? '9999').localeCompare(b.starts_on ?? '9999') ||
        a.thread_id.localeCompare(b.thread_id),
    );
    out.set(memberId, limit === null ? mine : mine.slice(0, limit));
  }
  return out;
}

// ---------------------------------------------------------------------------
// PAGING THE LIST.
//
// Pure, and separate from the route, because the property that matters is one
// a database cannot demonstrate: walking the pages must visit every row
// exactly once. A cursor that skips a row loses an offer the member was
// entitled to; one that repeats a row looks like a duplicate in the data.
// Both are invisible in a single-page test.
// ---------------------------------------------------------------------------

/** The sort key a cursor is made of. Date first, then id — the id is not
 *  decoration: without it two threads starting on one day have no defined
 *  order, and the row that ends a page could be a different row next time. */
export function couldJoinCursor(row: { starts_on: string | null; thread_id: string }): string {
  return `${row.starts_on ?? '9999'}|${row.thread_id}`;
}

/** Order a list the way the cursor expects. Undated last. */
export function sortCouldJoin<T extends { starts_on: string | null; thread_id: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => couldJoinCursor(a).localeCompare(couldJoinCursor(b)));
}

/** One page of an ALREADY SORTED list, and the cursor for the next.
 *
 *  `null` back means there is no next page. It is returned only when the page
 *  came back short — a full last page hands out one more cursor, and the
 *  request after it answers empty. One wasted round trip is a much smaller
 *  cost than claiming there is no more when there is. */
export function pageCouldJoin<T extends { starts_on: string | null; thread_id: string }>(
  sorted: T[],
  cursor: string | null,
  size: number,
): { items: T[]; nextCursor: string | null } {
  const from = cursor ? sorted.findIndex((r) => couldJoinCursor(r) > cursor) : 0;
  // A cursor past the end, or one matching nothing because the list changed
  // under the reader — a thread filled or withdrawn between pages. An empty
  // page is the truthful answer; an error would turn somebody else's edit
  // into this reader's problem.
  if (from === -1) return { items: [], nextCursor: null };
  const items = sorted.slice(from, from + size);
  const nextCursor = items.length === size ? couldJoinCursor(items[items.length - 1]!) : null;
  return { items, nextCursor };
}
