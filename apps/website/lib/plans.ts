// The live plan catalogue — same shape and source the product itself uses
// (the brief's source-of-truth rule: marketing must never hold its own copy
// of prices). Trimmed from apps/web/lib/plans.ts.

import { API_BASE } from './site';

export type CataloguePlan = {
  id: string;
  name: string;
  price_cents_month: number;
  price_cents_year: number | null;
  meet_paid_pct: number;
  meet_paid_cap_cents: number | null;
  included_seats: number | null;
};

/** Enterprise is a conversation: the catalogue's `org` plan carries no
 *  public price (year is null) — treat it as price-on-application. */
export function isPoa(p: CataloguePlan): boolean {
  return p.id === 'org';
}

export type Catalogue = { plans: CataloguePlan[]; mode: 'open' | 'invited' };

export async function loadPlans(): Promise<Catalogue> {
  try {
    const r = await fetch(`${API_BASE}/api/v1/public/plans`, { next: { revalidate: 300 } });
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { plans: CataloguePlan[]; signup_mode?: string };
    return { plans: j.plans ?? [], mode: j.signup_mode === 'open' ? 'open' : 'invited' };
  } catch {
    return { plans: [], mode: 'invited' };
  }
}

export function eur(cents: number): string {
  const whole = cents / 100;
  return Number.isInteger(whole) ? `€${whole}` : `€${whole.toFixed(2)}`;
}

export function feePhrase(pct: number, capCents: number | null): string {
  // The catalogue carries the fee as a fraction (0.02 = 2%).
  if (pct <= 0) return 'no enrolment fee';
  const cap = capCents ? `, max ${eur(capCents)}` : '';
  return `${Math.round(pct * 100)}% enrolment fee${cap}`;
}
