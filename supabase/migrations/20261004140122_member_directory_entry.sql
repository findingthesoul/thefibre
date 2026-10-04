-- ============================================================================
-- Member directory, slice 2a: THE MEMBER'S OWN CHOICE.
--
-- docs/member-directory-spec.md §3.3, §4 and §9.6. Slice 1 gave a workspace
-- its vocabulary; this gives a member the switch. No list is served yet —
-- deliberately, so somebody can state their choice before anyone can see
-- them, which is the right order for a choice that defaults to off.
--
-- `listed` DEFAULTS TO FALSE. Sjoerd, 2026-10-04: "Always opt-in", reversing
-- his own default-on wording from the same day after being asked whether a
-- pre-ticked switch was safe for a community whose membership itself
-- discloses a special category — a faith-linked community publishes
-- religious affiliation by listing somebody. A default of true IS a
-- pre-ticked box, which Art 4(11) and Recital 32 say cannot carry consent.
-- So the default is the one that needs no justification, and the consent
-- record is written when the member switches it ON.
-- ============================================================================

-- 1. The purpose this consent is FOR ----------------------------------------
--
-- 'member_directory' is separate from 'cohort_directory' on purpose:
-- agreeing to appear among your community is not agreeing to appear in a
-- course cohort, and revoking one must not revoke the other.

-- Dropped BY DISCOVERY rather than by name. The constraint was created
-- inline on the column in 20260512120000, so its name is whatever Postgres
-- generated — almost certainly consent_record_purpose_code_check, but a
-- migration that fails on an assumption about a generated name fails after
-- it has already been applied to one remote and not another.
do $$
declare con_name text;
begin
  select conname into con_name
    from pg_constraint
   where conrelid = 'public.consent_record'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%purpose_code%';
  if con_name is null then
    raise exception 'no CHECK constraint on consent_record.purpose_code found';
  end if;
  execute format('alter table public.consent_record drop constraint %I', con_name);
end $$;

alter table public.consent_record
  add constraint consent_record_purpose_code_check
  check (purpose_code in (
    'transactional_email',
    'marketing_email',
    'learning_analytics',
    'cohort_directory',
    'facilitation_data',
    'sales_contact',
    'member_directory'
  ));

-- 2. The entry ---------------------------------------------------------------

create table public.membership_directory_entry (
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  person_id    uuid not null references public.person(id) on delete cascade,

  -- §9.6: opt-IN. False until the member says otherwise.
  listed       boolean not null default false,

  -- Deliberately NULLABLE, with three meanings: true show, false hide, NULL
  -- follow the workspace default. A plain boolean cannot express "follow the
  -- default", so a member who never touched it would stop moving when the
  -- admin changes the default — the same inheritance the payment methods use.
  show_contact boolean,

  -- Slice 4. Max 3, enforced in the API rather than here: the limit is a
  -- product decision that will be argued about, and a CHECK makes changing it
  -- a migration.
  tags         text[] not null default '{}',

  updated_at   timestamptz not null default now(),
  primary key (workspace_id, person_id)
);

create index membership_directory_entry_listed
  on public.membership_directory_entry (workspace_id)
  where listed;

-- A member's choice is written to EVERY person row their proven email owns in
-- that workspace, which is why this table tolerates duplicates of one human
-- rather than trying to prevent them.
--
-- The reason is `merge_person`: it discovers every FK pointing at
-- public.person and repoints it, but this table is unique on
-- (workspace_id, person_id), so when BOTH rows carry an entry only one can
-- survive — the merge keeps the DESTINATION row and records the loss
-- (person-merge.int.test.ts, "keeps the destination row when a unique
-- constraint forbids two"). With the default OFF, a choice written to only
-- the losing row would silently un-list somebody who deliberately opted in.
-- Writing all of them makes the merge's own rule harmless: whichever row
-- survives already carries the choice, and the dropped duplicate was
-- identical.
--
-- Measured 2026-10-04 before building for it: on production, zero addresses
-- resolve to more than one person row in one workspace; on staging all 51
-- are synthetic duplicate-detection fixtures. So this is built ahead of the
-- case, not in response to it — but nothing prevents it, there is no unique
-- constraint on person(workspace_id, email), and the duplicates review queue
-- exists because duplicates do arrive.

alter table public.membership_directory_entry enable row level security;

-- Nothing in the portal reads through RLS — a member has no app membership
-- and usually no user account, so the portal runs on the service role with
-- every query explicitly scoped to the person ids a proven email owns. RLS
-- here is the floor beneath the ADMIN surfaces: an admin may count who has
-- opted in, and nobody may read another workspace's entries.
create policy membership_directory_entry_read on public.membership_directory_entry
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
  );

-- No insert/update/delete policy for `authenticated` ON PURPOSE. The member's
-- choice is theirs, and the only sanctioned writer is the portal route acting
-- for a proven email. An admin who could flip `listed` could list a member
-- who declined, which is the one thing this table exists to prevent.
