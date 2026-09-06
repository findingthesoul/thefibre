import { appUrl } from '@thefibre/shared';
import { adminClient } from '../db.js';
import { stripeOrNull } from './stripe/client.js';
import { workspaceStripeAccount } from './payment-accounts.js';

const MEMBERSHIP_APP_URL =
  process.env.MEMBERSHIP_APP_URL ?? appUrl('membership', process.env);

// The workspace's plan fee as a percent — the subscription-mode rule from
// routes/membership.ts, reused for one-off invoice payment links so both
// doors charge the same fee.
async function membershipFeePercent(workspaceId: string): Promise<number> {
  try {
    const { data: feeRows } = await adminClient.rpc('workspace_meet_fee', { ws_id: workspaceId });
    const row = Array.isArray(feeRows) ? (feeRows[0] as { pct: number | string } | undefined) : null;
    if (row) {
      const pct = typeof row.pct === 'string' ? parseFloat(row.pct) : row.pct;
      if (Number.isFinite(pct)) return Math.round(pct * 100 * 100) / 100;
    }
  } catch (e) {
    console.warn('[membership] fee lookup failed, defaulting to 2%', e);
  }
  return 2;
}

/** A Stripe Checkout session for a pending membership invoice, on the
 *  workspace's connected account. Stores the session id on the purchase row
 *  (expiring any previous one — a resend must kill the old payable link) and
 *  returns the URL. Null when payments aren't configured for this workspace —
 *  the invoice email simply goes out without a Pay button. */
export async function createMembershipPaymentLink(p: {
  purchaseId: string;
  workspaceId: string;
  amountCents: number;
  currency: string;
  itemLabel: string;
  payerEmail: string;
}): Promise<string | null> {
  const stripe = stripeOrNull();
  if (!stripe) return null;
  const account = await workspaceStripeAccount(p.workspaceId);
  if (!account) return null;

  const { data: prev } = await adminClient
    .from('purchase')
    .select('stripe_session_id')
    .eq('id', p.purchaseId)
    .maybeSingle();
  if (prev?.stripe_session_id) {
    try {
      await stripe.checkout.sessions.expire(prev.stripe_session_id, undefined, {
        stripeAccount: account,
      });
    } catch {
      /* already expired or completed — fine */
    }
  }

  const feePct = await membershipFeePercent(p.workspaceId);
  const applicationFeeCents = Math.round((p.amountCents * feePct) / 100);
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
          ...(applicationFeeCents > 0 ? { application_fee_amount: applicationFeeCents } : {}),
          metadata: { membership_purchase_id: p.purchaseId },
        },
        customer_email: p.payerEmail,
        metadata: { membership_purchase_id: p.purchaseId },
        billing_address_collection: 'required',
        success_url: `${MEMBERSHIP_APP_URL}/my?paid=success`,
        cancel_url: `${MEMBERSHIP_APP_URL}/my?paid=cancelled`,
      },
      { stripeAccount: account },
    );
    await adminClient
      .from('purchase')
      .update({ stripe_session_id: session.id, stripe_account_id: account })
      .eq('id', p.purchaseId);
    return session.url ?? null;
  } catch (e) {
    console.error('[membership] payment link creation failed', e);
    return null;
  }
}

/** Pay-online button HTML for receipt-styled emails. */
export function payButtonHtml(url: string): string {
  return `<p style="margin:24px 0 0;"><a href="${url}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">Pay online</a></p>
    <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">Prefer a bank transfer? Just ignore the button — the invoice stands.</p>`;
}
