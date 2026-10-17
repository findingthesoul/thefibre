-- ============================================================================
-- activity_ref — WHAT an activity row is about (contacts follow the
-- hierarchy, slice 2; Sjoerd, 2026-10-17: "I can only see what those contacts
-- have done in relation to my organisation, not the whole workspace").
--
-- An activity row says WHO (person_id), WHICH APP and WHAT HAPPENED (type +
-- subject), and nothing about which thread or booking it belongs to: every
-- writer puts a label and a title in `subject` (census, 2026-10-17). So a
-- visible person's whole workspace timeline was visible. Scoping the timeline
-- to the things you hold a role on needs the thing's id.
--
-- A SIDE TABLE, not columns on activity, because activity is append-only
-- (activity_no_update / activity_no_delete): new rows can carry a ref from
-- birth either way, but rows already written can only be given one HERE —
-- by a per-database backfill script that inserts refs and never touches
-- activity (hard rule 5; "bulk data conversions: a script per database").
--
-- One ref per activity row. ref_kind is the thing's table, by name:
--   · 'thread'       → thread_thread.id
--   · 'meet_booking' → meet_booking.id
-- More kinds are a CHECK change in a later migration, on purpose: a kind
-- must come with its visibility rule in can_see_activity.
--
-- A ref, once written, is final like the row it describes: no UPDATE. A row
-- goes only with its activity row (cascade; activity itself is never deleted
-- outside a workspace's own removal).
--
-- It carries its own workspace_id (= its activity row's, enforced below), so
-- the API reaches it like every tenant table — tenantDb, workspace stamped
-- and filtered (security F1, 2026-10-17) — and never through an unscoped
-- service-role chain.
--
-- Service role only: RLS on, no policies. can_see_activity (SECURITY
-- DEFINER) is the only reader on a user's behalf, from a later migration.
-- ============================================================================

create table public.activity_ref (
  activity_id  uuid primary key references public.activity(id) on delete cascade,
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  ref_kind     text not null check (ref_kind in ('thread', 'meet_booking')),
  ref_id       uuid not null,
  created_at   timestamptz not null default now()
);

-- The rule reads "refs of this kind on these things".
create index activity_ref_kind_id_idx on public.activity_ref (ref_kind, ref_id);

alter table public.activity_ref enable row level security;

-- One workspace, by construction: the ref's workspace IS its activity row's,
-- AND the thing it points at lives in that same workspace (both thread_thread
-- and meet_booking carry workspace_id). So no writer or backfill bug can
-- attach a row of one tenant to another tenant's thread or booking — the
-- database refuses it, not only the read rule. A trigger, not a CHECK: it
-- reads other tables.
create or replace function public.activity_ref_same_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.activity a
     where a.id = new.activity_id and a.workspace_id = new.workspace_id
  ) then
    raise exception 'activity_ref: workspace_id must be its activity row''s'
      using errcode = '23514';
  end if;
  if new.ref_kind = 'thread' and not exists (
    select 1 from public.thread_thread t
     where t.id = new.ref_id and t.workspace_id = new.workspace_id
  ) then
    raise exception 'activity_ref: the thread is not in this workspace'
      using errcode = '23514';
  end if;
  if new.ref_kind = 'meet_booking' and not exists (
    select 1 from public.meet_booking b
     where b.id = new.ref_id and b.workspace_id = new.workspace_id
  ) then
    raise exception 'activity_ref: the booking is not in this workspace'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger activity_ref_same_workspace
  before insert on public.activity_ref
  for each row execute function public.activity_ref_same_workspace();

create or replace function public.activity_ref_is_final()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'an activity ref is final; it goes only with its activity row'
    using errcode = '23514';
end;
$$;

create trigger activity_ref_no_update
  before update on public.activity_ref
  for each row execute function public.activity_ref_is_final();
