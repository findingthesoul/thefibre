// The Stripe customer a membership join bills, and where their invoicing
// details come from.
//
// Until 2026-10-13 the join handed Checkout a bare `customer_email` and let
// Stripe's page ask for the billing address. That made Stripe the place the
// details live, which is the opposite of how this platform is meant to work
// (Sjoerd: "nothing of Stripe is the rule, except payment", "it should be a
// single point,,, invoicing payments"). The panel asks now, and what it
// collects is written onto the customer the charge is made against — so the
// invoice Stripe issues carries OUR data, and `purchase.billing` keeps
// reading from that invoice exactly as it always has.
//
// Two things this deliberately does NOT do:
//
//  • It never uses Stripe customer search to find somebody. The record of
//    which customer belongs to which person is OURS —
//    `membership_member.stripe_customer_id`, on the workspace's own account —
//    and asking the rails instead would make Stripe the system of record for
//    a relationship we already store. It would also be wrong: the same email
//    can exist several times on one account.
//
//  • It never fails the join. A customer that cannot be created or updated
//    leaves the checkout to run the way it did before — with the email, and
//    Stripe asking for the address — because a person who wants to pay must
//    be able to pay. The failure is logged, not shown.

import type Stripe from 'stripe';
import { adminClient } from '../db.js';
import { invoiceName, stripeAddress, type BillingFieldsInput } from './billing-fields.js';

export type CustomerForJoin = {
  /** Pass as `customer` on the Checkout session; null means fall back to
   *  `customer_email` and let Stripe collect what it needs. */
  id: string | null;
  /** True when this id came from our own record rather than being created —
   *  what the rehearsal checks when the same person joins twice. */
  reused: boolean;
  /** Whether the customer now HAS a billing address.
   *
   *  This decides `billing_address_collection`, and getting it from "did we
   *  make a customer" instead was a quiet regression: with 'auto' and a
   *  customer carrying no address, Stripe may not ask for one at all for an
   *  ordinary card, and every invoice for somebody who typed nothing would
   *  lose its address block — which the old 'required' always captured.
   *  Measured in the rehearsal, case 4. */
  hasAddress: boolean;
};

/**
 * Find or make the customer for (workspace, person) on `account`.
 *
 * `billing` is whatever the panel collected, which may be nothing at all: an
 * individual paying by card types none of it, and that join must still work.
 * With no address we still create the customer — the name and email alone are
 * worth having, and Stripe then asks for the address itself.
 *
 * `proven` IS THE SECURITY BOUNDARY, and nothing else here is.
 *
 * `/public/join` is unauthenticated and the email is simply typed. Reusing an
 * existing customer on the strength of a typed address would let anybody who
 * knows a member's email: overwrite that member's name and address on the
 * community's Stripe account (so their next renewal invoice carries a
 * stranger's details — and no payment is needed, because the update happens
 * before Checkout); open a Checkout session against the member's customer,
 * which pre-fills what Stripe has on them; and learn from the address-
 * collection mode whether that email is already a customer at all. Three
 * harms, one of them an edit, from typing somebody else's address into a
 * public form.
 *
 * So an existing customer is touched only when the requester has PROVEN they
 * read that mailbox — the same bar as the member-price endpoint. Unproven, we
 * neither read nor update the stored id: a fresh customer is created from
 * what THIS request typed, which duplicates a customer on the account and is
 * the right trade. Duplicates are untidy; the alternative is an edit to
 * somebody else's billing identity by a stranger.
 */
export async function customerForJoin(
  stripe: Stripe,
  account: string,
  args: {
    workspaceId: string;
    personId: string;
    email: string;
    personName: string;
    billing?: BillingFieldsInput | null;
    /** Has the requester proven they read this mailbox (a session whose email
     *  is the one being joined)? Unproven joins never touch a stored
     *  customer. */
    proven: boolean;
  },
): Promise<CustomerForJoin> {
  const name = invoiceName(args.billing, args.personName);
  const address = stripeAddress(args.billing);

  // OUR record of the relationship, never Stripe's search index — and only
  // when the address has been proven. An unproven join does not even LOOK:
  // what it cannot read it cannot leak, and the collection mode below is then
  // decided purely by what this request typed.
  let existing: string | null = null;
  if (args.proven) {
    const { data: member } = await adminClient
      .from('membership_member')
      .select('stripe_customer_id')
      .eq('workspace_id', args.workspaceId)
      .eq('person_id', args.personId)
      .maybeSingle();
    existing = (member?.stripe_customer_id as string | null) ?? null;
  }

  try {
    if (existing) {
      // Rejoining, or joining a second tier. Update rather than create, so
      // one person on one community's account stays one customer and their
      // invoices stay in one place. Newer details win; a field the panel did
      // not collect is left alone rather than blanked.
      await stripe.customers.update(
        existing,
        {
          name,
          email: args.email,
          ...(address ? { address } : {}),
        },
        { stripeAccount: account },
      );
      // A customer we did not just give an address to may still have one
      // from an earlier join, and asking again would be the double-typing
      // this change exists to remove.
      const had = address ? true : await customerHasAddress(stripe, account, existing);
      return { id: existing, reused: true, hasAddress: had };
    }

    const created = await stripe.customers.create(
      {
        name,
        email: args.email,
        ...(address ? { address } : {}),
        metadata: { workspace_id: args.workspaceId, person_id: args.personId },
      },
      { stripeAccount: account },
    );
    return { id: created.id, reused: false, hasAddress: Boolean(address) };
  } catch (e) {
    // Including the case where our stored id no longer exists on that
    // account (a test-mode reset, a disconnected account): the update throws,
    // and the join carries on with the email.
    console.error('[membership] stripe customer for join failed', e);
    return { id: null, reused: false, hasAddress: false };
  }
}

/** Does this customer already have an address on file? Only asked when the
 *  panel collected none, so that a returning member who gave one last time is
 *  not made to type it again. A failure here reads as "no", which costs one
 *  Stripe page asking for an address — the safe direction. */
async function customerHasAddress(
  stripe: Stripe,
  account: string,
  id: string,
): Promise<boolean> {
  try {
    const c = await stripe.customers.retrieve(id, {}, { stripeAccount: account });
    return Boolean((c as Stripe.Customer).address?.line1);
  } catch {
    return false;
  }
}

/**
 * The part of the panel's billing details that a Stripe invoice CANNOT carry
 * back to us: the company name when somebody is paying as an organisation,
 * and the tax number.
 *
 * `purchase.billing` is written in the webhook from `invoice.customer_*`, so
 * the address, postcode, city and country make the round trip through the
 * customer we just wrote. A tax number does not — Stripe keeps those as
 * separate TaxID objects with a type we would have to guess at, and guessing
 * `eu_vat` for a number that is not one is worse than not sending it. So
 * these ride the subscription metadata and are merged back in.
 *
 * Returns an object with at most one short key, or `{}` when there is nothing
 * worth carrying. Stripe allows 500 characters per metadata value; the schema
 * caps company at 200 and tax_no at 60, so the JSON cannot approach it, and
 * it is truncated anyway rather than risking a Checkout error over a field
 * nobody can see.
 */
export function billingMetadata(billing?: BillingFieldsInput | null): Record<string, string> {
  if (!billing) return {};
  const carried: Record<string, string> = {};
  if (billing.payer) carried.payer = billing.payer;
  if (billing.company?.trim()) carried.company = billing.company.trim();
  if (billing.tax_no?.trim()) carried.tax_no = billing.tax_no.trim();
  if (!Object.keys(carried).length) return {};
  return { billing_extra: JSON.stringify(carried).slice(0, 480) };
}

/** The other end of `billingMetadata`. Anything unparseable is nothing — a
 *  truncated or hand-edited value must not take the webhook down with it. */
export function readBillingMetadata(
  meta: Record<string, string | undefined> | null | undefined,
): { payer?: string; company?: string; tax_no?: string } {
  const raw = meta?.billing_extra;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: { payer?: string; company?: string; tax_no?: string } = {};
    for (const k of ['payer', 'company', 'tax_no'] as const) {
      if (typeof parsed[k] === 'string') out[k] = parsed[k] as string;
    }
    return out;
  } catch {
    return {};
  }
}
