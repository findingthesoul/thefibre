// Can this thread take money RIGHT NOW? One answer, for every place that
// needs it: the publish guard, the "Join" lists, the audit script.
//
// Found on staging on 2026-10-14: Sjoerd pressed "Join for €40.00" on a
// published paid thread and got "the organiser has not connected payments
// yet", and the "sign up on its page instead" link led to the same dead end.
// His rule: "if someone is organising a thread that comes with a price...
// before publish one needs to have a stripe or needs to select invoice."
//
// A WORKING ROUTE is a payment method that would actually complete:
//   · card — the effective methods include it AND the platform key exists AND
//     the thread's payout destination resolves to a connected account
//     (threadDestinationAccount — the same function the enrol route charges
//     through);
//   · invoice — the effective methods include it. Nothing external is needed.
// The effective methods are the inheritance chain the enrol route resolves
// (resolvePaymentMethods: ticket → thread → account default).
//
// Nothing here restates either rule: both functions are the enrol route's
// own, so "the guard let it through" and "the enrol route refused it" cannot
// disagree.

import { adminClient } from '../db.js';
import { resolvePaymentMethods, threadDestinationAccount } from './payment-accounts.js';
import { stripeOrNull } from './stripe/client.js';

export type Method = 'stripe' | 'invoice';

/** The parts of a thread the route depends on. */
export type RouteThread = {
  workspace_id: string;
  team_id: string | null;
  payment_destination: string | null;
  payment_methods: string[] | null;
  organiser_user_id: string | null;
};

/** A thread's routes, with the card check done once. A thread has one payout
 *  destination whatever the ticket, so the account is resolved once and each
 *  ticket's methods are filtered against it. */
export async function routeResolver(
  t: RouteThread,
  /** For the audit script only: judge card as if the platform Stripe key is
   *  set (as it is on the running server), so nobody pastes a live secret
   *  into a script that never calls Stripe and only asks whether one exists. */
  opts: { assumePlatformKey?: boolean } = {},
): Promise<(ticketMethods: string[] | null) => Promise<Method[]>> {
  let cardReady: boolean | null = null;
  const card = async () => {
    if (cardReady === null) {
      cardReady =
        (opts.assumePlatformKey || !!stripeOrNull()) &&
        !!(await threadDestinationAccount({
          workspace_id: t.workspace_id,
          team_id: t.team_id,
          payment_destination: t.payment_destination,
          organiser_user_id: t.organiser_user_id,
        }));
    }
    return cardReady;
  };
  return async (ticketMethods) => {
    const methods = await resolvePaymentMethods({
      ticketMethods,
      threadMethods: t.payment_methods,
      organiserUserId: t.organiser_user_id,
      workspaceId: t.workspace_id,
      workspaceRoot: !!t.team_id || t.payment_destination !== 'personal',
    });
    const out: Method[] = [];
    if (methods.includes('stripe') && (await card())) out.push('stripe');
    if (methods.includes('invoice')) out.push('invoice');
    return out;
  };
}

/** What a member at `yourPriceCents` meets on the list: nothing to pay, a card
 *  checkout, an invoice (which needs billing details, so the thread's page),
 *  or no way to pay at all. */
export type JoinPayment = 'none_needed' | 'card' | 'invoice_only' | 'unavailable';

export function joinPayment(yourPriceCents: number, routes: Method[]): JoinPayment {
  if (yourPriceCents <= 0) return 'none_needed';
  if (routes.includes('stripe')) return 'card';
  if (routes.includes('invoice')) return 'invoice_only';
  return 'unavailable';
}

/** The sentence the editor and the refusal both show. */
export const NO_ROUTE_MESSAGE =
  'Connect Stripe or allow invoice to publish a paid thread. Settings → Payments.';

/** Why this thread may not be live with sign-up open, or null when it may.
 *
 *  PAID means a price above zero on what a sign-up would actually buy: the
 *  open tickets when there are any (each one priced above zero must have a
 *  route — a free ticket beside it does not rescue a paid one that dead-ends),
 *  else the thread's own price. A free thread needs no route at all. */
export async function paymentRouteProblem(
  threadId: string,
  /** The values a pending save would write, judged as if already saved — so a
   *  refused save changes nothing. */
  pending: {
    price_cents?: number | null;
    payment_methods?: string[] | null;
    payment_destination?: string | null;
    /** One ticket's pending price and methods (a ticket create or edit). */
    ticket?: { id: string | null; price_cents: number; payment_methods: string[] | null; is_active: boolean };
  } = {},
  opts: { assumePlatformKey?: boolean } = {},
): Promise<string | null> {
  const { data: row } = await adminClient
    .from('thread_thread')
    .select('workspace_id, team_id, payment_destination, payment_methods, price_cents, organiser:organiser_id (user_id)')
    .eq('id', threadId)
    .maybeSingle();
  if (!row) return null;
  const t = { ...row } as Record<string, unknown>;
  if ('price_cents' in pending) t.price_cents = pending.price_cents;
  if ('payment_methods' in pending) t.payment_methods = pending.payment_methods;
  if ('payment_destination' in pending) t.payment_destination = pending.payment_destination;

  const { data: ticketRows } = await adminClient
    .from('thread_ticket')
    .select('id, price_cents, payment_methods, available_until')
    .eq('thread_id', threadId)
    .eq('is_active', true);
  let tickets = (ticketRows ?? []) as Record<string, unknown>[];
  if (pending.ticket) {
    const pt = pending.ticket;
    tickets = tickets.filter((k) => k.id !== pt.id);
    if (pt.is_active) tickets.push({ id: pt.id, price_cents: pt.price_cents, payment_methods: pt.payment_methods, available_until: null });
  }
  const now = Date.now();
  const open = tickets.filter(
    (k) => !k.available_until || new Date(k.available_until as string).getTime() >= now,
  );
  const paidPoints: (string[] | null)[] = open.length
    ? open.filter((k) => ((k.price_cents as number | null) ?? 0) > 0).map((k) => (k.payment_methods as string[] | null) ?? null)
    : ((t.price_cents as number | null) ?? 0) > 0
      ? [null]
      : [];
  if (!paidPoints.length) return null;

  const organiser = Array.isArray(t.organiser) ? t.organiser[0] : t.organiser;
  const routesFor = await routeResolver({
    workspace_id: t.workspace_id as string,
    team_id: (t.team_id as string | null) ?? null,
    payment_destination: (t.payment_destination as string | null) ?? null,
    payment_methods: (t.payment_methods as string[] | null) ?? null,
    organiser_user_id: (organiser as { user_id?: string | null } | null)?.user_id ?? null,
  }, opts);
  for (const ticketMethods of paidPoints) {
    if ((await routesFor(ticketMethods)).length === 0) return NO_ROUTE_MESSAGE;
  }
  return null;
}
