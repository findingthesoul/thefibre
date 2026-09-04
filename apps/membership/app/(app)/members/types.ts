export type MemberStatus = 'active' | 'grace' | 'lapsed' | 'cancelled';

export type MemberPerson = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type Member = {
  id: string;
  person_id: string;
  tier_id: string;
  status: MemberStatus;
  started_at: string | null;
  renews_at: string | null;
  lapsed_at: string | null;
  notes: string | null;
  person: MemberPerson | null;
  tier: { id: string; name: string } | null;
};

export type MemberAccess = {
  id: string;
  access_grant_id: string;
  status: string;
  external_ref: string | null;
  last_error: string | null;
  synced_at: string | null;
};

export type Tier = {
  id: string;
  name: string;
  price_cents_year: number | null;
  price_cents_month: number | null;
  currency: string;
};

export function personName(p: MemberPerson | null): string {
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ');
  return name || p?.email || 'Unknown person';
}
