// Can this MEETING TYPE take money right now? One answer, for every place that
// needs it: the save guard, the public booking page, the booking route, the
// audit script. The Meet twin of lib/thread-payment-route.ts.
//
// Sjoerd, 2026-10-16, asked whether Meet needs the same publish guard as
// Thread: "of course. No stripe, or invoice only." Before this, the editor
// refused a price only when the SAVE carried one, judged against the EDITOR's
// Stripe (a team lead editing a colleague's type), and never when a type was
// switched on or its methods narrowed to card. And the booking route found the
// missing account only AFTER inserting the booking — so the invitee got
// "host has not connected Stripe" and the slot stayed held by a booking nobody
// could pay for.
//
// A WORKING ROUTE, as the booking route will actually complete it:
//   · card — the effective methods include it AND the platform key exists AND
//     the OWNER host has a connected account (personalStripeAccount, the same
//     function the booking route charges through);
//   · invoice — the effective methods include it. Nothing external is needed.
// The effective methods are the type's own list, else the owner's account
// default from Settings → Payments.
//
// "Bookable" is is_active alone: an unlisted type is still bookable by its
// link, so is_public_listed does not decide it.

import { adminClient } from '../db.js';
import { defaultPaymentMethods, personalStripeAccount } from './payment-accounts.js';
import { stripeOrNull } from './stripe/client.js';

export type MeetMethod = 'stripe' | 'invoice';

export type RouteMeetingType = {
  host_id: string;
  payment_methods?: string[] | null;
};

/** The sentence the editor and the refusal both show. */
export const MEET_NO_ROUTE_MESSAGE =
  'Connect Stripe or allow invoice to open a paid meeting type for booking. Settings → Payments.';

async function ownerOf(hostId: string): Promise<{ user_id: string | null; stripe_account_id: string | null } | null> {
  const { data, error } = await adminClient
    .from('meet_host')
    .select('user_id, stripe_account_id')
    .eq('id', hostId)
    .maybeSingle();
  if (error) throw new Error(`meet host: ${error.message}`);
  return (data as { user_id: string | null; stripe_account_id: string | null } | null) ?? null;
}

/** The methods as configured: the type's own, else the owner's default. */
export async function configuredMethods(mt: RouteMeetingType): Promise<MeetMethod[]> {
  const own = (mt.payment_methods ?? []).filter((m): m is MeetMethod => m === 'stripe' || m === 'invoice');
  if (own.length) return own;
  const owner = await ownerOf(mt.host_id);
  return owner?.user_id ? await defaultPaymentMethods(owner.user_id) : ['stripe'];
}

/** The methods that would actually complete a booking. Empty = nobody can pay. */
export async function workingMethods(
  mt: RouteMeetingType,
  /** For the audit script only: judge card as if the platform Stripe key is
   *  set, as it is on the running server (see audit-paid-thread-routes.ts). */
  opts: { assumePlatformKey?: boolean } = {},
): Promise<MeetMethod[]> {
  const methods = await configuredMethods(mt);
  const out: MeetMethod[] = [];
  if (methods.includes('stripe') && (opts.assumePlatformKey || !!stripeOrNull())) {
    const owner = await ownerOf(mt.host_id);
    // The same lookup the booking route charges through: the platform value
    // first, the meet_host column only when there is no user behind the host.
    const account = owner?.user_id ? await personalStripeAccount(owner.user_id) : (owner?.stripe_account_id ?? null);
    if (account) out.push('stripe');
  }
  if (methods.includes('invoice')) out.push('invoice');
  return out;
}

/** Why this meeting type may not be bookable as it stands, or null when it
 *  may. A free type, or one that is switched off, needs no route. */
export async function meetRouteProblem(
  mt: RouteMeetingType & { price_cents?: number | null; is_active?: boolean | null },
  opts: { assumePlatformKey?: boolean } = {},
): Promise<string | null> {
  if (mt.is_active === false) return null;
  if (!((mt.price_cents ?? 0) > 0)) return null;
  return (await workingMethods(mt, opts)).length ? null : MEET_NO_ROUTE_MESSAGE;
}
