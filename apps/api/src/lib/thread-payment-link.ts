// Stripe Checkout session for a pending Thread invoice — the manual-add
// sibling of POST /purchases/:id/send-payment-link (routes/purchases.ts),
// shaped after lib/membership-payment-link.ts. Same convergence contract:
// the session carries `thread_enrolment_id` metadata and its id lands on
// thread_enrolment.stripe_session_id, so the existing Thread webhook and
// mark-paid (which expires the session) treat it exactly like a link sent
// from the Invoices page. Null when payments aren't configured — the
// invoice email simply goes out without a Pay button.

import { adminClient } from '../db.js';
import { stripeOrNull } from './stripe/client.js';
import { chargeAccountForItem } from './payment-accounts.js';
import { platformFeeCents } from './fees.js';

export async function createThreadPaymentLink(p: {
  purchaseId: string;
  threadEnrolmentId: string;
  workspaceId: string;
  amountCents: number;
  currency: string;
  itemLabel: string;
  payerEmail: string;
}): Promise<string | null> {
  const stripe = stripeOrNull();
  if (!stripe) return null;
  const account = await chargeAccountForItem('the-thread', p.threadEnrolmentId);
  if (!account) return null;

  const { data: te } = await adminClient
    .from('thread_enrolment')
    .select(
      'stripe_session_id, thread:thread_id (slug, organiser:organiser_id (slug), team:team_id (slug))',
    )
    .eq('id', p.threadEnrolmentId)
    .maybeSingle();
  if (!te) return null;

  // A fresh session must kill any previous one — the old link would stay
  // payable while the webhook only knows the newest session id.
  if (te.stripe_session_id) {
    try {
      await stripe.checkout.sessions.expire(te.stripe_session_id, undefined, {
        stripeAccount: account,
      });
    } catch {
      /* already expired or completed — fine */
    }
  }

  const thread = Array.isArray(te.thread) ? te.thread[0] : te.thread;
  const organiser =
    thread && (Array.isArray(thread.organiser) ? thread.organiser[0] : thread.organiser);
  const team = thread && (Array.isArray(thread.team) ? thread.team[0] : thread.team);
  const threadUrl = process.env.THREAD_APP_URL ?? 'https://thread.thefibre.app';
  const publicBase = `${threadUrl}/${team?.slug ?? organiser?.slug ?? ''}/${thread?.slug ?? ''}`;

  // Same plan-aware fee rule as checkout and the Invoices-page link (lib/fees).
  const applicationFeeCents = await platformFeeCents(p.workspaceId, p.amountCents);
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
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
          metadata: { thread_enrolment_id: p.threadEnrolmentId },
        },
        customer_email: p.payerEmail,
        metadata: { thread_enrolment_id: p.threadEnrolmentId },
        invoice_creation: { enabled: true },
        billing_address_collection: 'required',
        success_url: `${publicBase}?paid=success`,
        cancel_url: `${publicBase}?paid=cancelled`,
      },
      { stripeAccount: account },
    );
    await adminClient
      .from('thread_enrolment')
      .update({ stripe_session_id: session.id })
      .eq('id', p.threadEnrolmentId);
    await adminClient
      .from('purchase')
      .update({ stripe_account_id: account })
      .eq('id', p.purchaseId);
    return session.url ?? null;
  } catch (e) {
    console.error('[thread] payment link creation failed', e);
    return null;
  }
}

/** Pay-online button HTML for receipt-styled emails (the membership shape). */
export function threadPayButtonHtml(url: string): string {
  return `<p style="margin:24px 0 0;"><a href="${url}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">Pay online</a></p>
    <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">Prefer a bank transfer? Just ignore the button — the invoice stands.</p>`;
}
