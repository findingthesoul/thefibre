// An organisation's billing details — ONE reader (docs/people-in-two-
// capacities-proposal.md §B), the payer-side twin of payment-accounts.ts.
//
// The facts live in two places today: `org_billing` (the curator billing
// record: billing email, tax id, a separate billing address) and the
// `organisation` row itself (legal name, VAT number, street…). Every invoice
// to an organisation reads through here, billing record first, organisation
// row as the fallback, so the precedence is decided once.

import { adminClient } from '../db.js';

export type OrganisationBilling = {
  name: string;
  legal_name: string | null;
  tax_no: string | null;
  billing_email: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
};

export async function organisationBilling(orgId: string): Promise<OrganisationBilling | null> {
  const [{ data: org }, { data: ob }] = await Promise.all([
    adminClient
      .from('organisation')
      .select('name, legal_name, vat_number, street, postal_code, city, country')
      .eq('id', orgId)
      .maybeSingle(),
    adminClient
      .from('org_billing')
      .select('legal_name, tax_id, billing_email, billing_street, billing_postal_code, billing_city, billing_country')
      .eq('org_id', orgId)
      .maybeSingle(),
  ]);
  if (!org) return null;
  return {
    name: org.name as string,
    legal_name: (ob?.legal_name ?? org.legal_name ?? null) as string | null,
    tax_no: (ob?.tax_id ?? org.vat_number ?? null) as string | null,
    billing_email: (ob?.billing_email ?? null) as string | null,
    address: (ob?.billing_street ?? org.street ?? null) as string | null,
    postal_code: (ob?.billing_postal_code ?? org.postal_code ?? null) as string | null,
    city: (ob?.billing_city ?? org.city ?? null) as string | null,
    country: (ob?.billing_country ?? org.country ?? null) as string | null,
  };
}

/** The invoice's buyer block for an organisation. */
export function organisationBillingSnapshot(b: OrganisationBilling): Record<string, unknown> {
  return {
    payer: 'organisation',
    company: b.legal_name ?? b.name,
    address: b.address,
    postal_code: b.postal_code,
    city: b.city,
    country: b.country,
    ...(b.tax_no ? { tax_no: b.tax_no } : {}),
  };
}
