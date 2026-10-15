// What a member pays, and whether they are one.
//
// Sjoerd, 2026-10-12: *"another membersjip access thing could be: give
// default discount to threads from the community you're part of."* The grant
// kind is `team_calendar` — one team, one percentage — and this file is the
// two halves of acting on it: the ENTITLEMENT (is this person a member whose
// tier carries this thread's team, and at what percentage) and the PRICE (one
// calculation, shared by whoever needs the number).
//
// ─────────────────────────────────────────────────────────────────────────────
// ONE CALCULATION. This is the point of the file.
// ─────────────────────────────────────────────────────────────────────────────
// A second place that works out what somebody pays is the offer-versus-
// enforcement bug with a longer fuse: one surface promises a member price and
// another charges the list price, and the first person to notice is a member.
// So `enrolmentPrice` is pure, it is the only arithmetic, and every caller
// gets both the number AND the reason it is that number — because the ledger
// has to answer "why was this €7 and not €35?" without reconstructing a tier
// definition that may since have changed.
//
// The coupon half moved here from routes/thread.ts for the same reason; that
// file now calls this one, so there is no second copy to drift.

import { adminClient } from '../db.js';

/** The coupon fields the arithmetic needs — deliberately not the whole row,
 *  so this module has no opinion about how a coupon is found or validated. */
export type CouponAmount = {
  type: string;
  discount_percentage?: number | null;
  discount_amount_cents?: number | null;
};

/** The thread's own currency, read defensively (the column may be null). */
export function priceCurrencyOf(t: { price_currency?: string | null }): string {
  return t.price_currency ?? 'EUR';
}

/** WHICH ticket, and therefore WHAT base price — the one resolution.
 *
 *  A chosen ticket wins; otherwise the cheapest open one; otherwise the
 *  thread's own price. No availability checks: this answers "what does it
 *  cost", and the POST adds its own sold-out refusals on top, because a
 *  quote is not a reservation. */
export function resolveBasePrice(
  thread: { price_cents: number | null; price_currency: string },
  openTickets: { id: string; price_cents: number; price_currency?: string }[],
  ticketId: string | null,
): { ticketId: string | null; basePriceCents: number; priceCurrency: string } {
  const chosen = ticketId ? openTickets.find((t) => t.id === ticketId) : undefined;
  const pick = chosen ?? (openTickets.length ? [...openTickets].sort((a, b) => a.price_cents - b.price_cents)[0]! : null);
  if (!pick) {
    return {
      ticketId: null,
      basePriceCents: thread.price_cents ?? 0,
      priceCurrency: thread.price_currency,
    };
  }
  return {
    ticketId: pick.id,
    basePriceCents: pick.price_cents,
    priceCurrency: pick.price_currency ?? thread.price_currency,
  };
}

/** Why a price is what it is. Written to the ledger beside the amount. */
export type PriceReason = 'full' | 'coupon' | 'membership';

export function couponPriceOf(coupon: CouponAmount, baseCents: number): number {
  if (coupon.type === 'free') return 0;
  if (coupon.type === 'percentage') {
    return Math.max(0, Math.round(baseCents * (1 - (coupon.discount_percentage ?? 0) / 100)));
  }
  return Math.max(0, baseCents - (coupon.discount_amount_cents ?? 0));
}

/**
 * What this person pays for this thread, and why.
 *
 * BEST OF THE TWO, NEVER STACKED. A 30% member discount plus a 50% code is
 * not an offer anybody made, and the person who discovers it will not be the
 * organiser. Best-of is still generous in both directions: a member is never
 * worse off for holding a code, and a code-holder is never worse off for
 * being a member.
 *
 * A tie goes to `coupon`, because the person typed it and expects to see it
 * acknowledged — the amount is identical either way, so this only decides the
 * word in the ledger.
 */
export function enrolmentPrice(
  baseCents: number,
  coupon: CouponAmount | null,
  memberPct: number | null,
): { cents: number; reason: PriceReason } {
  const base = Math.max(0, Math.round(baseCents));
  const withCoupon = coupon ? couponPriceOf(coupon, base) : null;
  // A percentage outside 1..100 is not a discount this product offers; the
  // write path refuses to store one (routes/membership.ts), and this treats
  // anything else as no membership rather than inventing a price from it.
  const pct = memberPct !== null && memberPct >= 1 && memberPct <= 100 ? memberPct : null;
  const withMember = pct === null ? null : Math.max(0, Math.round(base * (1 - pct / 100)));

  if (withCoupon === null && withMember === null) return { cents: base, reason: 'full' };
  if (withCoupon !== null && (withMember === null || withCoupon <= withMember)) {
    return { cents: withCoupon, reason: 'coupon' };
  }
  return { cents: withMember!, reason: 'membership' };
}

/** `{ team_id, discount_pct }` as stored, read defensively. */
export function teamCalendarConfig(
  config: Record<string, unknown> | null,
): { teamId: string; pct: number } | null {
  const teamId = config?.team_id;
  if (typeof teamId !== 'string' || !teamId.trim()) return null;
  const raw = config?.discount_pct;
  // DEFAULT 100, and only for a MISSING value. A stored 0 is refused at the
  // door, so finding one here means somebody wrote it another way — and
  // reading it as 100 would turn a nonsense grant into a free calendar.
  const pct = raw === undefined || raw === null ? 100 : Number(raw);
  if (!Number.isFinite(pct) || pct < 1 || pct > 100) return null;
  return { teamId: teamId.trim(), pct: Math.round(pct) };
}

/**
 * Is this person a member whose tier carries this thread's team calendar?
 *
 * Returns the percentage and the grant it came from, or null. It answers
 * ENTITLEMENT only — no money — so the price can be worked out in exactly one
 * place by whoever needs it.
 *
 * `active` and `grace` both count, which is the same predicate the rest of
 * membership uses: grace means a payment is late, not that somebody left.
 * When a membership ends this starts answering null — new joins stop and
 * existing enrolments are untouched, because the platform rule is soft delete
 * only and a record of taking part is not something a lapse should erase.
 */
/**
 * The best member discount ANY tier offers for this thread's team, or null.
 *
 * A fact about the offer, not about a person: it is safe on a public page,
 * where it lets the enrol form say "Member? Sign in for your member price"
 * only on threads where that sentence is true. It answers nothing about who
 * is a member — that question is the one the member price itself must never
 * answer to a stranger.
 */
export async function memberDiscountOffered(threadId: string): Promise<number | null> {
  const { data: thread } = await adminClient
    .from('thread_thread')
    .select('team_id')
    .eq('id', threadId)
    .maybeSingle();
  if (!thread?.team_id) return null;
  const { data: grants } = await adminClient
    .from('membership_access_grant')
    .select('config')
    .eq('kind', 'team_calendar');
  let best: number | null = null;
  for (const g of grants ?? []) {
    const cfg = teamCalendarConfig(g.config as Record<string, unknown> | null);
    if (!cfg || cfg.teamId !== thread.team_id) continue;
    if (best === null || cfg.pct > best) best = cfg.pct;
  }
  return best;
}

/** Whether this request has PROVED the address it is enrolling.
 *
 *  `verified` is the output of `participantEmailFromAuth` — a Supabase JWT
 *  checked against JWKS — and nothing else may be passed as it. `enrolling`
 *  is what the form typed. The member price applies only when they are the
 *  same person:
 *
 *    anonymous, expired, forged  → null (no token verifies, so none is trusted)
 *    signed in as somebody else  → null (the entitlement belongs to the member,
 *                                   not to whoever is filling the form)
 *    signed in as this address   → the address
 *
 *  Compared trimmed and case-insensitively, because an address is the same
 *  address whatever a form did to its whitespace or capitals.
 */
export function provenEmail(verified: string | null, enrolling: string): string | null {
  const a = (verified ?? '').trim().toLowerCase();
  const b = enrolling.trim().toLowerCase();
  if (!a || !b) return null;
  return a === b ? b : null;
}

/**
 * The member entitlement for a VERIFIED address.
 *
 * The name says `Verified` because that is the contract: the only acceptable
 * argument is `provenEmail(await participantEmailFromAuth(c), typedEmail)`.
 * A type cannot stop somebody passing a form field here, so the name, this
 * comment and a source assertion in the gate test are what do.
 */
export async function memberDiscountForVerifiedEmail(
  verifiedEmail: string,
  threadId: string,
): Promise<{ pct: number; via: string } | null> {
  const clean = verifiedEmail.trim().toLowerCase();
  if (!clean) return null;
  const { data: thread } = await adminClient
    .from('thread_thread')
    .select('workspace_id, team_id')
    .eq('id', threadId)
    .maybeSingle();
  if (!thread?.team_id) return null;
  const { data: person } = await adminClient
    .from('person')
    .select('id')
    .eq('workspace_id', thread.workspace_id)
    .eq('email', clean)
    .is('deleted_at', null)
    .maybeSingle();
  if (!person) return null;
  return memberDiscountFor(person.id as string, threadId);
}

// THERE IS NO `memberDiscountForEmail`, and that is on purpose.
//
// It existed for about an hour, so the anonymous enrol POST could price on
// the address typed into the form, and review caught what that means: an
// email is not a secret, so anybody who knows a member's address could enrol
// them for nothing. A function that prices on an unproven identity is the
// kind of thing that gets called again by somebody who does not know why it
// was wrong, so it is gone rather than deprecated.
//
// The entitlement below takes a PERSON — resolved from a session, never from
// a form field.
/** One team calendar this person's membership carries, and at what. */
export type TeamCalendarEntitlement = {
  teamId: string;
  pct: number;
  /** The grant row it came from, so a surface can say which promise this was. */
  via: string;
};

/**
 * EVERY team calendar this person is entitled to in this workspace.
 *
 * THE ONE WALK. `memberDiscountFor` is this plus "and which of them is this
 * thread's team", and the member's own list of what they could join is this
 * plus "and what is on those calendars". Two walks would be two statements of
 * one entitlement, and the first person to notice they disagree is a member
 * who was shown a price and charged another.
 *
 * `active` and `grace` both count — the same predicate the rest of membership
 * uses: grace means a payment is late, not that somebody left.
 *
 * The best percentage wins per calendar. A tier can carry the same calendar
 * twice (two products that both include it), and taking the first would make
 * the price depend on row order — not something anybody can explain to the
 * member who paid more.
 */
export async function teamCalendarEntitlements(
  personId: string,
  workspaceId: string,
): Promise<TeamCalendarEntitlement[]> {
  const { data: member } = await adminClient
    .from('membership_member')
    .select('id, tier_id, status')
    .eq('workspace_id', workspaceId)
    .eq('person_id', personId)
    .is('deleted_at', null)
    .in('status', ['active', 'grace'])
    .maybeSingle();
  if (!member) return [];

  const { data: bought } = await adminClient
    .from('membership_product_purchase')
    .select('product_id')
    .eq('workspace_id', workspaceId)
    .eq('person_id', personId)
    .eq('status', 'paid');

  return teamCalendarsCarriedBy(
    member.tier_id as string,
    [...new Set((bought ?? []).map((b) => b.product_id as string))].filter(Boolean),
  );
}

/**
 * WHICH CALENDARS A TIER CARRIES — the grant walk, with no membership gate.
 *
 * Split out of `teamCalendarEntitlements` on 2026-10-14 so the welcome email
 * can ask what a membership includes. The entitlement walk above gates on an
 * active/grace membership, which is right for pricing and wrong here: the
 * email is sent moments after the row is written, sometimes from a detached
 * task, and a status gate in that moment is a race whose only symptom is a
 * member getting a thinner email than the person who joined beside them.
 *
 * Still ONE resolution of the question. The gate moved above it, not away.
 *
 * `boughtProductIds` is for products owned outright — pass `[]` when the
 * question is only "what does this tier include".
 *
 * The best percentage wins per calendar. A tier can carry the same calendar
 * twice (two products that both include it), and taking the first would make
 * the price depend on row order — not something anybody can explain to the
 * member who paid more.
 */
export async function teamCalendarsCarriedBy(
  tierId: string,
  boughtProductIds: string[] = [],
): Promise<TeamCalendarEntitlement[]> {
  // The same pair of sources the journal and the portal's "what this
  // includes" use: the tier's own grants, the grants of the products the tier
  // includes, and the grants of products bought outright (those were paid for
  // and do not lapse with the subscription).
  const [{ data: tierGrants }, { data: tierProducts }] = await Promise.all([
    adminClient
      .from('membership_access_grant')
      .select('id, kind, config')
      .eq('tier_id', tierId)
      .eq('kind', 'team_calendar'),
    adminClient
      .from('membership_tier_product')
      .select('product_id')
      .eq('tier_id', tierId)
      .eq('optional', false),
  ]);

  const productIds = [
    ...new Set([
      ...(tierProducts ?? []).map((p) => p.product_id as string),
      ...boughtProductIds,
    ]),
  ].filter(Boolean);
  const { data: productGrants } = productIds.length
    ? await adminClient
        .from('membership_access_grant')
        .select('id, kind, config')
        .in('product_id', productIds)
        .eq('kind', 'team_calendar')
    : { data: [] as { id: string; kind: string; config: Record<string, unknown> | null }[] };

  return pickTeamCalendars(
    (tierGrants ?? []) as GrantRow[],
    (productGrants ?? []) as GrantRow[],
  );
}

type GrantRow = { id: string; config: Record<string, unknown> | null };

/**
 * THE RULE, with no database in it: which calendar each grant opens, and at
 * what, when several grants reach the same one.
 *
 * The best percentage wins per calendar. On an equal percentage the TIER's
 * grant beats a product's, and then the lower grant id — so `via` (which
 * promise a price came from) never depends on the order rows came back in.
 * Until 2026-10-16 an equal-percentage tie went to whichever row the
 * database happened to return first: the PRICE was always the same, the
 * `via` was not. Pinned now because the batched walk below reads the same
 * grants through different queries, and "the same answer" has to include
 * `via` (docs/handover-portal-entitlements-batching.md, step 2).
 *
 * Exported for the test, and shared by the one-membership walk and the
 * batched one so there is one statement of it.
 */
export function pickTeamCalendars(
  tierGrants: GrantRow[],
  productGrants: GrantRow[],
): TeamCalendarEntitlement[] {
  const byId = (a: GrantRow, b: GrantRow) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const ordered = [...tierGrants].sort(byId).concat([...productGrants].sort(byId));
  const best = new Map<string, TeamCalendarEntitlement>();
  for (const g of ordered) {
    const cfg = teamCalendarConfig(g.config);
    if (!cfg) continue;
    const held = best.get(cfg.teamId);
    if (!held || cfg.pct > held.pct) {
      best.set(cfg.teamId, { teamId: cfg.teamId, pct: cfg.pct, via: g.id });
    }
  }
  return [...best.values()];
}

/** One membership to resolve: a person, in a workspace. */
export type EntitlementKey = { personId: string; workspaceId: string };
export const entitlementKey = (k: EntitlementKey) => `${k.personId}|${k.workspaceId}`;

/**
 * `teamCalendarEntitlements` for MANY memberships at once — the same answer,
 * in five queries however many there are.
 *
 * The one-at-a-time walk made three to five round trips per membership, in
 * sequence, and every my.thread page paid for it through /me/portal (docs/
 * handover-portal-entitlements-batching.md). This asks each SOURCE once:
 * the memberships, the paid purchases, the tiers' grants, the tiers'
 * products, and those products' grants; then resolves each membership in
 * memory through `pickTeamCalendars`, the same rule.
 *
 * Kept equal to the per-membership walk by `entitlements-batched.int.test.ts`
 * — percentages AND `via` — on the staging fixtures. Until that has run green
 * on staging the money path (enrol pricing) still uses the old walk; this is
 * what the portal's lists and nav read.
 *
 * A failed read answers nothing for the memberships it covered, as the old
 * walk did — logged here, which the old walk never was. (Two rows for one
 * person in one workspace would also answer nothing, as the old
 * `.maybeSingle()` did; membership_member is unique on that pair, so it is
 * a guard, not a case.)
 */
export async function teamCalendarEntitlementsFor(
  keys: EntitlementKey[],
): Promise<Map<string, TeamCalendarEntitlement[]>> {
  const out = new Map<string, TeamCalendarEntitlement[]>();
  for (const k of keys) out.set(entitlementKey(k), []);
  if (!keys.length) return out;
  const personIds = [...new Set(keys.map((k) => k.personId))];
  const workspaceIds = [...new Set(keys.map((k) => k.workspaceId))];
  const wanted = new Set(out.keys());
  const fail = (what: string, error: { message: string }) => {
    console.error(`[member-discount] batched entitlements: ${what}`, { error: error.message });
  };

  const [members, bought] = await Promise.all([
    adminClient
      .from('membership_member')
      .select('person_id, workspace_id, tier_id')
      .in('person_id', personIds)
      .in('workspace_id', workspaceIds)
      .is('deleted_at', null)
      .in('status', ['active', 'grace']),
    adminClient
      .from('membership_product_purchase')
      .select('person_id, workspace_id, product_id')
      .in('person_id', personIds)
      .in('workspace_id', workspaceIds)
      .eq('status', 'paid'),
  ]);
  if (members.error) {
    fail('members', members.error);
    return out;
  }
  if (bought.error) fail('purchases', bought.error);

  // One tier per membership; two rows for one key is the old walk's "none".
  const tierOf = new Map<string, string | null>();
  for (const m of members.data ?? []) {
    const key = entitlementKey({ personId: m.person_id as string, workspaceId: m.workspace_id as string });
    if (!wanted.has(key)) continue;
    tierOf.set(key, tierOf.has(key) ? null : (m.tier_id as string));
  }
  const boughtOf = new Map<string, Set<string>>();
  for (const b of bought.error ? [] : (bought.data ?? [])) {
    const key = entitlementKey({ personId: b.person_id as string, workspaceId: b.workspace_id as string });
    if (!tierOf.get(key) || !b.product_id) continue;
    const set = boughtOf.get(key) ?? new Set<string>();
    set.add(b.product_id as string);
    boughtOf.set(key, set);
  }

  const tierIds = [...new Set([...tierOf.values()].filter((t): t is string => !!t))];
  if (!tierIds.length) return out;
  const [tierGrants, tierProducts] = await Promise.all([
    adminClient
      .from('membership_access_grant')
      .select('id, tier_id, config')
      .in('tier_id', tierIds)
      .eq('kind', 'team_calendar'),
    adminClient
      .from('membership_tier_product')
      .select('tier_id, product_id')
      .in('tier_id', tierIds)
      .eq('optional', false),
  ]);
  if (tierGrants.error) fail('tier grants', tierGrants.error);
  if (tierProducts.error) fail('tier products', tierProducts.error);

  const productsOfTier = new Map<string, string[]>();
  for (const tp of tierProducts.error ? [] : (tierProducts.data ?? [])) {
    const list = productsOfTier.get(tp.tier_id as string) ?? [];
    list.push(tp.product_id as string);
    productsOfTier.set(tp.tier_id as string, list);
  }
  const productIds = [
    ...new Set([
      ...[...productsOfTier.values()].flat(),
      ...[...boughtOf.values()].flatMap((s) => [...s]),
    ]),
  ].filter(Boolean);
  const productGrants = productIds.length
    ? await adminClient
        .from('membership_access_grant')
        .select('id, product_id, config')
        .in('product_id', productIds)
        .eq('kind', 'team_calendar')
    : { data: [] as { id: string; product_id: string; config: Record<string, unknown> | null }[], error: null };
  if (productGrants.error) fail('product grants', productGrants.error);

  const grantsOfTier = new Map<string, GrantRow[]>();
  for (const g of tierGrants.error ? [] : (tierGrants.data ?? [])) {
    const list = grantsOfTier.get(g.tier_id as string) ?? [];
    list.push({ id: g.id as string, config: (g.config as Record<string, unknown> | null) ?? null });
    grantsOfTier.set(g.tier_id as string, list);
  }
  const grantsOfProduct = new Map<string, GrantRow[]>();
  for (const g of productGrants.error ? [] : (productGrants.data ?? [])) {
    const list = grantsOfProduct.get(g.product_id as string) ?? [];
    list.push({ id: g.id as string, config: (g.config as Record<string, unknown> | null) ?? null });
    grantsOfProduct.set(g.product_id as string, list);
  }

  for (const [key, tierId] of tierOf) {
    if (!tierId) continue;
    const products = new Set([...(productsOfTier.get(tierId) ?? []), ...(boughtOf.get(key) ?? [])]);
    out.set(
      key,
      pickTeamCalendars(
        grantsOfTier.get(tierId) ?? [],
        [...products].flatMap((p) => grantsOfProduct.get(p) ?? []),
      ),
    );
  }
  return out;
}

/**
 * The NAMES of the calendars this membership opens, for the welcome email.
 *
 * Reads the grants, never a guess — the email says "your membership includes
 * {team}'s calendar", and a sentence like that must not be printed on a hope.
 *
 * `owner` is the person the membership is for, and passing it adds the
 * calendars carried by products they bought OUTRIGHT. A tier includes some
 * products and merely offers others, so without this somebody who ticked an
 * optional extra that carries a calendar — the Fellowship, on soul.com — got
 * a welcome email that never mentioned the calendar they had just paid for.
 * The lookup lives here rather than at the call sites, because a call site
 * that has to remember it is a call site that will forget it.
 *
 * `alsoBought` is for ids the CALLER knows about and the table may not yet:
 * on a paid join the purchase rows are written by one Stripe event and the
 * welcome composed from another, in an order Stripe does not promise. The two
 * sources are UNIONED rather than chosen between — the caller's ids are this
 * join, the table's are every earlier one, and either alone drops a calendar
 * somebody paid for.
 *
 * Sorted by name so two members of one tier get the same email. Returns []
 * rather than throwing: a missing calendar line is better than a failed
 * welcome.
 */
export async function teamCalendarNamesFor(
  tierId: string,
  owner?: { personId: string; workspaceId: string; alsoBought?: string[] } | null,
): Promise<string[]> {
  try {
    const { data: bought } = owner
      ? await adminClient
          .from('membership_product_purchase')
          .select('product_id')
          .eq('workspace_id', owner.workspaceId)
          .eq('person_id', owner.personId)
          .eq('status', 'paid')
      : { data: [] as { product_id: string }[] };
    const held = await teamCalendarsCarriedBy(
      tierId,
      [
        ...new Set([
          ...(bought ?? []).map((b) => b.product_id as string),
          ...(owner?.alsoBought ?? []),
        ]),
      ].filter(Boolean),
    );
    if (!held.length) return [];
    const { data: teams } = await adminClient
      .from('team')
      .select('id, name')
      .in(
        'id',
        held.map((h) => h.teamId),
      );
    return (teams ?? [])
      .map((t) => String((t as { name?: string }).name ?? '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  } catch (e) {
    console.error('[membership] calendar names lookup failed', e);
    return [];
  }
}

export async function memberDiscountFor(
  personId: string,
  threadId: string,
): Promise<{ pct: number; via: string } | null> {
  const { data: thread } = await adminClient
    .from('thread_thread')
    .select('id, team_id, workspace_id')
    .eq('id', threadId)
    .maybeSingle();
  // No team, no team calendar. A workspace thread carries team_id NULL and is
  // nobody's calendar (design: team_id NULL is not personal).
  if (!thread?.team_id) return null;

  // THE ONE WALK, then this thread's team. Nothing here decides entitlement.
  const held = await teamCalendarEntitlements(personId, thread.workspace_id as string);
  const mine = held.find((e) => e.teamId === thread.team_id);
  return mine ? { pct: mine.pct, via: mine.via } : null;
}
