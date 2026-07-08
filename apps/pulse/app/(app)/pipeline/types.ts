// Shared shapes for the pipeline surface. The Commitment shape mirrors the
// API's COMMITMENT_SELECT (apps/api/src/routes/pulse.ts) — raw FK ids are
// included so the edit dialog can preselect pickers.

export type Line = {
  id: string;
  expected_date: string;
  amount_cents: number;
  invoice_ref: string | null;
  invoiced_at: string | null;
  purchase_id?: string | null;
  settled_at: string | null;
};

export type Commitment = {
  id: string;
  direction: 'in' | 'out';
  label: string;
  stage: string;
  probability: number;
  notes: string | null;
  person_id: string | null;
  organisation_id: string | null;
  team_id: string | null;
  project_id: string | null;
  offering_id: string | null;
  owner_user_id: string | null;
  person: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  organisation: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  offering: { id: string; name: string } | null;
  lines: Line[];
};

export type OrgOption = { id: string; name: string };

export type PersonOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

// team embeds can come back as object OR single-element array from PostgREST.
export type InvolvedTeam = {
  id: string;
  team_id: string;
  team: { id: string; name: string } | { id: string; name: string }[] | null;
};

export type ProjectOption = { id: string; name: string; team_id: string | null };

export type OfferingOption = { id: string; name: string };

export type MemberOption = { user_id: string; full_name: string | null; email: string | null };

export type Pickers = {
  orgs: OrgOption[];
  persons: PersonOption[];
  teams: InvolvedTeam[];
  projects: ProjectOption[];
  offerings: OfferingOption[];
  members: MemberOption[];
};

export function teamName(t: InvolvedTeam['team']): string {
  const one = Array.isArray(t) ? t[0] : t;
  return one?.name ?? 'Unnamed team';
}

export function personName(p: PersonOption): string {
  const full = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
  return full || p.email || 'Unnamed';
}
