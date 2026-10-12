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

  const { data: member } = await adminClient
    .from('membership_member')
    .select('id, tier_id, status')
    .eq('workspace_id', thread.workspace_id)
    .eq('person_id', personId)
    .is('deleted_at', null)
    .in('status', ['active', 'grace'])
    .maybeSingle();
  if (!member) return null;

  // The same walk the journal does: the tier's own grants, the grants of the
  // products the tier includes, and the grants of products this person bought
  // outright (those were paid for and do not lapse with the subscription).
  const [{ data: tierGrants }, { data: tierProducts }, { data: bought }] = await Promise.all([
    adminClient
      .from('membership_access_grant')
      .select('id, kind, config')
      .eq('tier_id', member.tier_id)
      .eq('kind', 'team_calendar'),
    adminClient
      .from('membership_tier_product')
      .select('product_id')
      .eq('tier_id', member.tier_id)
      .eq('optional', false),
    adminClient
      .from('membership_product_purchase')
      .select('product_id')
      .eq('workspace_id', thread.workspace_id)
      .eq('person_id', personId)
      .eq('status', 'paid'),
  ]);

  const productIds = [
    ...new Set([
      ...(tierProducts ?? []).map((p) => p.product_id as string),
      ...(bought ?? []).map((p) => p.product_id as string),
    ]),
  ].filter(Boolean);
  const { data: productGrants } = productIds.length
    ? await adminClient
        .from('membership_access_grant')
        .select('id, kind, config')
        .in('product_id', productIds)
        .eq('kind', 'team_calendar')
    : { data: [] as { id: string; kind: string; config: Record<string, unknown> | null }[] };

  const all = [...(tierGrants ?? []), ...(productGrants ?? [])] as {
    id: string;
    config: Record<string, unknown> | null;
  }[];

  // THE BEST ONE WINS when a person's tier carries the same calendar twice —
  // two products that both include it, say. Taking the first would make the
  // price depend on row order, which is the kind of thing nobody can explain
  // to the member who paid more.
  let best: { pct: number; via: string } | null = null;
  for (const g of all) {
    const cfg = teamCalendarConfig(g.config);
    if (!cfg || cfg.teamId !== thread.team_id) continue;
    if (!best || cfg.pct > best.pct) best = { pct: cfg.pct, via: g.id };
  }
  return best;
}
