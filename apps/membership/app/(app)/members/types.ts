export type MemberStatus = 'active' | 'grace' | 'lapsed' | 'cancelled';

export type MemberPerson = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type MemberOrganisation = {
  id: string;
  name: string | null;
};

export type Member = {
  id: string;
  // Exactly one of person_id / organisation_id is set: organisation_id set
  // = an ORG membership whose people occupy seats under it.
  person_id: string | null;
  organisation_id?: string | null;
  seat_allowance?: number | null;
  // Set on a person row that occupies a seat under an org membership.
  org_member_id?: string | null;
  tier_id: string;
  status: MemberStatus;
  started_at: string | null;
  renews_at: string | null;
  country?: string | null;
  lapsed_at: string | null;
  notes: string | null;
  person: MemberPerson | null;
  organisation?: MemberOrganisation | null;
  org_member?: { id: string; organisation: MemberOrganisation | null } | null;
  tier: { id: string; name: string } | null;
};

export type Seat = {
  id: string;
  person_id: string;
  status: MemberStatus;
  started_at: string | null;
  lapsed_at: string | null;
  created_at: string;
  person: MemberPerson | null;
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

export function memberName(m: Member): string {
  if (m.organisation_id) return m.organisation?.name ?? 'Unknown organisation';
  return personName(m.person);
}
