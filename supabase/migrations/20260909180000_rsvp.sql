-- ===========================================================================
-- RSVP — "are you coming to this?"
--
-- Shape decided by Sjoerd, 2026-09-09: "Setting in workspace: default RSVP
-- on... and can be put out per thread." So the switch is two-level, and the
-- ANSWER is per agenda item, because that is the unit a person is or is not
-- coming to.
--
-- Two things are deliberately kept apart:
--
--  1. Whether the QUESTION IS ASKED — the organiser's axis. Workspace
--     default (on), overridable per thread. Inheritance by NULL, the same
--     pattern payment methods already use here: null means "inherit", a
--     value means "override". That is why thread_thread.rsvp_enabled is
--     nullable rather than a boolean with a default; a default would freeze
--     each thread at whatever the workspace said on the day it was created.
--
--  2. What SILENCE MEANS — the participant's axis, which Sjoerd has not
--     specified. It is NOT collapsed into a boolean here. A missing row is
--     "no answer", distinct from an explicit 'not_coming'. Forty declines
--     and forty non-replies are different facts and a caterer needs to tell
--     them apart; storing a boolean would destroy that difference forever.
--     Whatever presentation rule gets chosen later can be built on this;
--     the reverse is a migration.
-- ===========================================================================

-- 1. The workspace default.
alter table public.thread_settings
  add column if not exists rsvp_default_enabled boolean not null default true;

comment on column public.thread_settings.rsvp_default_enabled is
  'Workspace default for whether threads ask participants to RSVP. Threads inherit this unless thread_thread.rsvp_enabled overrides it.';

-- 2. The per-thread override. NULL = inherit the workspace default.
alter table public.thread_thread
  add column if not exists rsvp_enabled boolean;

comment on column public.thread_thread.rsvp_enabled is
  'Per-thread RSVP override. NULL means inherit thread_settings.rsvp_default_enabled — NOT a boolean default, so a thread follows the workspace as it changes rather than freezing at creation time.';

-- 3. The answers. One row per (agenda item, person); absence = no answer.
create table if not exists public.thread_rsvp (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  engagement_id   uuid not null references public.thread_engagement(id) on delete cascade,
  person_id       uuid not null references public.person(id) on delete cascade,
  response        text not null check (response in ('coming','not_coming')),
  -- Who last changed it, when. An RSVP is a person speaking for themselves,
  -- so this is the person's own act; responded_at is what an organiser sorts
  -- by when chasing.
  responded_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- One current answer per person per item. Changing your mind updates the
  -- row; the activity log is where the history lives, per the append-only
  -- rule (activity is type + subject, never the body).
  unique (engagement_id, person_id)
);

create index if not exists thread_rsvp_engagement_idx
  on public.thread_rsvp (engagement_id, response);
create index if not exists thread_rsvp_person_idx
  on public.thread_rsvp (person_id);

alter table public.thread_rsvp enable row level security;

-- Workspace + app-membership scoping, identical to every other Thread table.
-- The participant's own read/write does NOT come through here: the portal
-- runs on the service-role client and filters person_id explicitly, exactly
-- as GET /me/portal already does, because a visitor is not a workspace
-- member and has no RLS identity in this workspace.
create policy thread_rsvp_scope on public.thread_rsvp
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));

comment on table public.thread_rsvp is
  'One current RSVP per (agenda item, person). A MISSING row means "no answer" and is not the same as response=not_coming — see 20260909180000_rsvp.sql for why that distinction is load-bearing.';
