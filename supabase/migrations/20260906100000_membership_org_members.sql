-- ===========================================================================
-- Org memberships with seats (membership-proposal §3.5, v1).
--
-- MODEL — a self-reference, not a new table. An ORGANISATION holds a
-- membership and its people occupy seats under it:
--
--   * ORG row:  membership_member with organisation_id set, person_id NULL,
--     seat_allowance = how many people may occupy seats. One org membership
--     per (workspace, organisation) — partial unique index below.
--   * SEAT row: an ordinary person-keyed membership_member row whose new
--     org_member_id points at the org row. It IS an individual membership
--     in every mechanical sense — same tier as the org, same access-grant
--     journal (membership_member_access), same sync workers, same /my
--     portal, same emergent profile tab — so "each seated person's grants
--     journal like an individual member's" holds by construction, with
--     zero changes to the workers.
--
-- Why not a membership_org_seat table: the journal + every worker joins
-- through membership_member.person_id. A separate seat table would need a
-- person dimension bolted onto the journal AND worker rewrites; the
-- self-reference reuses all of it. Least invention wins.
--
-- person_id semantics after this migration: EXACTLY ONE of person_id /
-- organisation_id is set (CHECK below). person_id NULL ⇒ org membership;
-- organisation_id NULL ⇒ person membership (possibly a seat, when
-- org_member_id is set). Org rows can never themselves be seats.
--
-- Consequence (documented, deliberate): unique (workspace_id, person_id)
-- still holds, so a person holds ONE membership per workspace — their own
-- OR a seat, never both. Adding a seat for someone who already has a
-- membership is a 409 in the API.
--
-- Seat status convention: 'cancelled' on a seat row means INDIVIDUALLY
-- REMOVED by an admin (soft — the row and its journal history stay).
-- Org-driven transitions set seats 'active' / 'lapsed' only, so a
-- reactivating org membership can re-arm its lapsed seats without
-- resurrecting deliberately removed ones.
--
-- Billing (v1, deliberate): org memberships are manual/invoice only — the
-- org pays by invoice via the existing manual-add machinery (pending
-- purchase-ledger row + emailed invoice). NO Stripe subscription for orgs
-- in v1; org rows keep stripe_subscription_id NULL and therefore ride the
-- manual-member scheduler rules (overdue → grace → lapsed).
-- ===========================================================================

-- Org rows have no person.
alter table public.membership_member
  alter column person_id drop not null;

-- Seat rows point at the org membership they occupy a seat under.
alter table public.membership_member
  add column if not exists org_member_id uuid references public.membership_member(id) on delete cascade;

-- Exactly one of person / organisation semantics; org rows are never seats;
-- seat_allowance only means something on org rows.
alter table public.membership_member
  add constraint membership_member_person_xor_org
  check (
    (person_id is not null and organisation_id is null)
    or (organisation_id is not null and person_id is null and org_member_id is null)
  );
alter table public.membership_member
  add constraint membership_member_allowance_on_org
  check (seat_allowance is null or organisation_id is not null);

-- One org membership per (workspace, organisation) — the org-side twin of
-- the existing unique (workspace_id, person_id); partial because person
-- rows carry organisation_id NULL.
create unique index if not exists membership_member_ws_org
  on public.membership_member (workspace_id, organisation_id)
  where organisation_id is not null;

-- Seat lookups fan out from the org row.
create index if not exists membership_member_org_member
  on public.membership_member (org_member_id)
  where org_member_id is not null;
