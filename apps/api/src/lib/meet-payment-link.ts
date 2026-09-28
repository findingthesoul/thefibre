// Stripe Checkout session for a Meet booking the host added by hand — the
// sibling of lib/thread-payment-link.ts and lib/membership-payment-link.ts,
// and the item build-plan.md has carried since v0.75.17 ("Meet invoice
// bookings: Send payment link").
//
// Same convergence contract as the other two: the session id lands on
// meet_booking.stripe_session_id, which is exactly what the existing Meet
// webhook looks a booking up by. So a link sent from here settles through the
// same `checkout.session.completed` handler as a payment made on the public
// booking page — no second settlement path, no second place to get it wrong.
//
// Null when payments are not configured. The caller then sends the booking
// confirmation without a Pay button rather than failing the whole booking:
// the appointment is real whether or not Stripe is wired up.

import { appUrl } from '@thefibre/shared';
import { adminClient } from '../db.js';
import { stripeOrNull } from './stripe/client.js';
import { chargeAccountForItem } from './payment-accounts.js';
import { platformFeeCents } from './fees.js';

export async function createMeetPaymentLink(p: {
  bookingId: string;
  workspaceId: string;
  amountCents: number;
  currency: string;
  itemLabel: string;
  payerEmail: string;
  /** `/{owner}/{mt}` — where the invitee lands after paying. */
  publicPath: string;
}): Promise<string | null> {
  const stripe = stripeOrNull();
  if (!stripe) return null;
  const account = await chargeAccountForItem('fibre-meet', p.bookingId);
  if (!account) return null;

  const { data: booking } = await adminClient
    .from('meet_booking')
    .select('stripe_session_id')
    .eq('id', p.bookingId)
    .maybeSingle();
  if (!booking) return null;

  // A fresh session must kill any previous one — the old link would stay
  // payable while the webhook only knows the newest session id.
  if (booking.stripe_session_id) {
    try {
      await stripe.checkout.sessions.expire(booking.stripe_session_id, undefined, {
        stripeAccount: account,
      });
    } catch {
      /* already expired or completed — fine */
    }
  }

  const meetUrl = process.env.MEET_APP_URL ?? appUrl('fibre-meet', process.env);
  const base = `${meetUrl}${p.publicPath}/confirmed/${p.bookingId}`;

  // Same plan-aware fee rule as checkout and the other payment links.
  const applicationFeeCents = await platformFeeCents(p.workspaceId, p.amountCents, account);
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        // No pinned methods: the connected account's payment-method
        // configuration governs, so enabling iDEAL or SEPA there just works.
        line_items: [
          {
            price_data: {
              currency: (p.currency || 'EUR').toLowerCase(),
              unit_amount: p.amountCents,
              product_data: { name: p.itemLabel },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: applicationFeeCents,
          metadata: { booking_id: p.bookingId },
        },
        customer_email: p.payerEmail,
        metadata: { booking_id: p.bookingId },
        // EU VAT: the Checkout receipt is not a legal invoice, so Stripe
        // issues one on the host's connected account, as the booking page
        // already does for a paid booking.
        invoice_creation: { enabled: true },
        billing_address_collection: 'required',
        success_url: `${base}?stripe=success`,
        cancel_url: `${base}?stripe=cancelled`,
      },
      { stripeAccount: account },
    );
    await adminClient
      .from('meet_booking')
      .update({ stripe_session_id: session.id })
      .eq('id', p.bookingId);
    return session.url ?? null;
  } catch (e) {
    console.error('[meet] payment link creation failed', e);
    return null;
  }
}

/** Pay-online button for the booking email, matching the Thread/Membership shape. */
export function meetPayButtonHtml(url: string): string {
  return `<p style="margin:24px 0 0;"><a href="${url}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">Pay online</a></p>
    <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">Prefer a bank transfer? Just ignore the button — the invoice stands.</p>`;
}
