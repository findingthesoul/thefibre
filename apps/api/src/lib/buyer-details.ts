// A person's billing details as a BUYER — kept in The Fibre, edited by them.
//
// Sjoerd, 2026-10-15: "Manage payment should not go to Stripe. We want to
// organise everything in THE FIBRE." identity_billing.buyer_details (keyed by
// email, so it follows the person across communities) is the record; Stripe
// customers are told on save and never read back. Each purchase keeps its own
// snapshot (purchase.billing), so an edit never rewrites an issued invoice.
//
// A change of country or VAT number re-runs THE VAT rule (lib/sale-vat.ts) for
// each running membership subscription and updates its tax rate, platform-fee
// percentage and VAT metadata — from the NEXT invoice, nothing prorated.

import { adminClient } from '../db.js';
import { stripeOrNull } from './stripe/client.js';
import { workspaceStripeAccount } from './payment-accounts.js';
import { saleVat } from './sale-vat.js';
import { connectedTaxRateId } from './vat-stripe.js';
import { platformFeePercent, feeOnNetPercent } from '../routes/membership.js';

export type BuyerDetails = {
  name: string | null;
  company: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  /** ISO 3166-1 alpha-2, upper case. */
  country: string | null;
  tax_no: string | null;
};

const EMPTY: BuyerDetails = { name: null, company: null, address: null, postal_code: null, city: null, country: null, tax_no: null };
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export function cleanBuyerDetails(v: unknown): BuyerDetails {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const country = str(o.country, 2)?.toUpperCase() ?? null;
  return {
    name: str(o.name, 200),
    company: str(o.company, 200),
    address: str(o.address, 500),
    postal_code: str(o.postal_code, 30),
    city: str(o.city, 120),
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    tax_no: str(o.tax_no, 60),
  };
}

/** The stored details, else the snapshot of the last paid checkout (shown as
 *  a starting point, marked `from_checkout` so the page can say so). */
export async function getBuyerDetails(email: string): Promise<BuyerDetails & { from_checkout: boolean }> {
  const e = email.trim().toLowerCase();
  const { data } = await adminClient.from('identity_billing').select('buyer_details').eq('email', e).maybeSingle();
  if (data?.buyer_details) return { ...cleanBuyerDetails(data.buyer_details), from_checkout: false };
  const { data: billed } = await adminClient
    .from('purchase')
    .select('billing, payer_name')
    .eq('payer_email', e)
    .eq('status', 'paid')
    .not('billing->>address', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(1);
  const row = (billed ?? [])[0];
  if (!row) return { ...EMPTY, from_checkout: false };
  const b = (row.billing ?? {}) as Record<string, unknown>;
  return { ...cleanBuyerDetails({ ...b, name: b.payer === 'organisation' ? null : row.payer_name }), from_checkout: true };
}

export type SaveOutcome = {
  saved: BuyerDetails;
  /** Per running membership subscription: what changed at Stripe. */
  subscriptions: { member_id: string; community: string; vat: string | null; updated: boolean; error?: string }[];
};

export async function saveBuyerDetails(email: string, input: unknown): Promise<SaveOutcome> {
  const e = email.trim().toLowerCase();
  const next = cleanBuyerDetails(input);
  const { data: before } = await adminClient.from('identity_billing').select('buyer_details').eq('email', e).maybeSingle();
  const prev = before?.buyer_details ? cleanBuyerDetails(before.buyer_details) : null;
  const { error } = await adminClient.from('identity_billing').upsert({ email: e, buyer_details: next }, { onConflict: 'email' });
  if (error) throw new Error(`buyer details: ${error.message}`);

  const vatChanged = !prev || prev.country !== next.country || (prev.tax_no ?? '') !== (next.tax_no ?? '');
  const out: SaveOutcome = { saved: next, subscriptions: [] };
  const stripe = stripeOrNull();
  if (!stripe) return out;

  // Every running membership held by persons with this email.
  const { data: persons } = await adminClient.from('person').select('id').eq('email', e).is('deleted_at', null);
  const ids = (persons ?? []).map((p) => p.id as string);
  if (!ids.length) return out;
  const { data: members } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, stripe_customer_id, stripe_subscription_id, workspace:workspace_id (name)')
    .in('person_id', ids)
    .is('deleted_at', null)
    .in('status', ['active', 'grace', 'past_due']);

  for (const m of members ?? []) {
    const community = ((Array.isArray(m.workspace) ? m.workspace[0] : m.workspace) as { name?: string } | null)?.name ?? '';
    const account = await workspaceStripeAccount(m.workspace_id as string);
    if (!account || !m.stripe_customer_id) continue;
    const entry: SaveOutcome['subscriptions'][number] = { member_id: m.id as string, community, vat: null, updated: false };
    try {
      // TO Stripe, never from it: the name and address Stripe prints on its
      // own receipts follow ours.
      await stripe.customers.update(
        m.stripe_customer_id as string,
        {
          ...(next.company || next.name ? { name: (next.company || next.name)! } : {}),
          address: {
            line1: next.address ?? '',
            postal_code: next.postal_code ?? '',
            city: next.city ?? '',
            ...(next.country ? { country: next.country } : {}),
          },
        },
        { stripeAccount: account },
      );
      if (vatChanged && m.stripe_subscription_id) {
        const sub = await stripe.subscriptions.retrieve(m.stripe_subscription_id as string, {}, { stripeAccount: account });
        // Only a subscription under the excl. rule carries VAT on top; an
        // older one keeps its inclusive split until it is moved deliberately
        // (scripts/apply-vat-to-subscriptions.ts).
        if (sub.metadata?.vat_rule === 'excl' && sub.status !== 'canceled') {
          const net = sub.items.data.reduce((sum, it) => sum + (it.price.unit_amount ?? 0) * (it.quantity ?? 1), 0);
          const vat = await saleVat({ workspaceId: m.workspace_id as string, net_cents: net, country: next.country, vat_id: next.tax_no });
          const rateId = vat.rate_pct > 0 && vat.rate_country ? await connectedTaxRateId(account, vat.rate_country, vat.rate_pct) : null;
          const fee = await platformFeePercent(m.workspace_id as string);
          await stripe.subscriptions.update(
            sub.id,
            {
              // '' unsets: no VAT due now (reverse charge, outside the EU).
              default_tax_rates: rateId ? [rateId] : ('' as unknown as string[]),
              ...(fee > 0 ? { application_fee_percent: feeOnNetPercent(fee, vat.rate_pct) } : {}),
              proration_behavior: 'none',
              metadata: {
                ...sub.metadata,
                vat_rule: 'excl',
                vat_rate_pct: String(vat.rate_pct),
                vat_label: vat.label ?? '',
                billing_extra: JSON.stringify({ ...(next.company ? { company: next.company } : {}), ...(next.tax_no ? { tax_no: next.tax_no } : {}) }).slice(0, 480),
              },
            },
            { stripeAccount: account },
          );
          entry.vat = vat.label;
        }
      }
      entry.updated = true;
    } catch (err) {
      entry.error = (err as Error).message;
      console.error('[buyer-details] Stripe sync failed', { member: m.id, message: entry.error });
    }
    out.subscriptions.push(entry);
  }
  return out;
}
