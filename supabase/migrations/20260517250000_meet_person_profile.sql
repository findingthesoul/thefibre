-- Per-person curator data Meet actually justifies (brief §5).
--
-- The earlier person_change_context fields (role_in_change, stance_on_change,
-- readiness_level, leadership_style, change_themes, blockers, motivators,
-- current_challenge, facilitator_notes) were modelled when Meet was framed
-- as a change-facilitation tool. Meet is a scheduling tool — those fields
-- belong to a future Fibre Change app, not Meet.
--
-- This migration introduces person_meet_profile with the minimal set Meet
-- can justify: the host's private notes about this invitee, a VIP/blocked
-- flag pair, and the invitee's preferred timezone. The old table stays in
-- place for now (existing data is preserved); a follow-up drops it once we
-- confirm no workspace relies on the historical fields.

create table public.person_meet_profile (
  workspace_id        uuid not null references public.workspace(id) on delete cascade,
  person_id           uuid not null references public.person(id) on delete cascade,
  app_id              uuid not null references public.app(id) on delete cascade,
  -- Free-form host notes. Sensitive by design — never crosses the wall via
  -- activity (brief §13).
  host_notes          text,
  vip                 boolean not null default false,
  blocked             boolean not null default false,
  -- Preferred IANA timezone the host should suggest slots in when emailing
  -- this person. Optional — falls back to the invitee's browser tz.
  invitee_timezone    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (workspace_id, person_id)
);

create index person_meet_profile_app_idx
  on public.person_meet_profile (app_id);
create index person_meet_profile_person_idx
  on public.person_meet_profile (person_id);

-- RLS: workspace member with fibre-meet app_membership. Same pattern as
-- other per-app curator tables.
alter table public.person_meet_profile enable row level security;

create policy person_meet_profile_scope on public.person_meet_profile
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  );

comment on table public.person_meet_profile is
  'Per-person curator data justified by Fibre Meet: host notes, VIP/blocked flags, preferred invitee timezone. Replaces the change-facilitation fields on person_change_context (which belong to a future Fibre Change app).';
