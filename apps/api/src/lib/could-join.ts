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
import { rows } from './rows.js';
import { publicOwnerSlug } from './public-owner-slug.js';
import { threadPublicUrl } from './public-origin.js';
import {
  enrolmentPrice,
  priceCurrencyOf,
  resolveBasePrice,
  teamCalendarEntitlements,
} from './member-discount.js';

export type CouldJoin = {
  thread_id: string;
  title: string;
  url: string;
  starts_on: string | null;
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
};

/** One membership, as this walk needs it. */
export type CouldJoinMember = {
  id: string;
  person_id: string | null;
  workspace_id: string;
};

const one = <T>(v: T | T[] | null | undefined): T | null =>
  !v ? null : Array.isArray(v) ? v[0] ?? null : v;


/** Everything these memberships can join, by membership id.
 *
 *  `alreadyIn` is the set of thread ids this person already holds an
 *  enrolment for — joining twice is not an offer, and the caller knows its
 *  own enrolments.
 *
 *  `limit` caps each member's list. The Memberships card wants a few; the
 *  full page wants all of them. Null means no cap, and the sort runs before
 *  the slice either way, so a capped list is the SOONEST few rather than an
 *  arbitrary few. */
export async function couldJoinByMember(
  members: CouldJoinMember[],
  alreadyIn: Set<string>,
  limit: number | null,
): Promise<Map<string, CouldJoin[]>> {
  const out = new Map<string, CouldJoin[]>();
  if (!members.length) return out;

  // One walk per membership. Lapsed and cancelled memberships answer an
  // empty list by the walk's own predicate (active and grace only) rather
  // than by a filter here — one place decides who is entitled.
  const entitlements = new Map<string, { teamId: string; pct: number }[]>();
  for (const m of members) {
    if (!m.person_id) continue;
    entitlements.set(m.id, await teamCalendarEntitlements(m.person_id, m.workspace_id));
  }

  const teamIds = [
    ...new Set([...entitlements.values()].flatMap((list) => list.map((e) => e.teamId))),
  ];
  if (!teamIds.length) return out;

  const today = new Date().toISOString().slice(0, 10);
  const candidates = rows(
    'portal: could join',
    await adminClient
      .from('thread_thread')
      .select(
        `id, slug, workspace_id, team_id, price_cents, price_currency, public_scope,
         team:team_id (slug, name, is_published, is_active),
         organiser:organiser_id (slug),
         program:program_id (title, status, starts_on)`,
      )
      .in('team_id', teamIds)
      .eq('is_public_listed', true)
      .eq('public_enrolment_open', true),
  );

  // Reachable, or it does not belong in a list of what you can join.
  const open = candidates.filter((t) => {
    const team = one(t.team as never) as
      | { slug: string; name: string; is_published: boolean | null; is_active: boolean | null }
      | null;
    const program = one(t.program as never) as
      | { title: string; status: string; starts_on: string | null }
      | null;
    if (!team || team.is_published !== true || team.is_active === false) return false;
    if (!program || program.status !== 'active') return false;
    if (program.starts_on && program.starts_on < today) return false;
    if (alreadyIn.has(t.id as string)) return false;
    return true;
  });

  // Tickets for all of them at once, and the price from the same two
  // functions the enrol POST uses.
  const nowIso = new Date().toISOString();
  const ticketsByThread = new Map<
    string,
    { id: string; price_cents: number; price_currency?: string }[]
  >();
  if (open.length) {
    const { data: tickets } = await adminClient
      .from('thread_ticket')
      .select('id, thread_id, price_cents, price_currency, sales_open_at, sales_close_at')
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
      mine.push({
        thread_id: t.id as string,
        title: program.title,
        url: await threadPublicUrl(ownerSlug, t.slug as string),
        starts_on: program.starts_on ?? null,
        team: team.name,
        list_price_cents: base.basePriceCents,
        your_price_cents: priced.cents,
        currency: base.priceCurrency,
        pct,
      });
    }
    // Soonest first, and undated last: a list of what is coming up is
    // ordered by when, not by when it was created. BEFORE any cap, so a
    // capped list is the soonest few and not an arbitrary few.
    mine.sort((a, b) => (a.starts_on ?? '9999').localeCompare(b.starts_on ?? '9999'));
    out.set(memberId, limit === null ? mine : mine.slice(0, limit));
  }
  return out;
}
