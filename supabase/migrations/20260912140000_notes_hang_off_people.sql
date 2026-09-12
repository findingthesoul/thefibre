-- ============================================================================
-- A conversation note can hang off a person, not only a flow run.
--
-- The capture primitive everything else waits on
-- (docs/connections-overview.md §6 step 3). Before this, the only place a
-- BODY could live against a person was flow_run_note — and it required a run,
-- so "I spoke to Marja" had nowhere to go unless Marja happened to be on a
-- flow. activity deliberately holds type and subject and never a body, and
-- that rule stands: this is app-owned content in Flow's tables, and only a
-- type + subject line crosses to the platform.
--
-- WIDENED IN PLACE, not renamed. `flow_run_note` is now a slightly wrong
-- name — a note may have no run — but nine call sites reference it and four
-- of them are in routes/app-flow.ts, which backs the published external-app
-- contract. Renaming buys a better name and risks that; it is not worth it.
--
-- The columns below are the ones docs/connections-data-integrity.md argues
-- are impossible to backfill and trivial now:
--
--   client_ref   idempotency AND autosave. The client mints a uuid before
--                the first attempt; every keystroke batch and every retry
--                upserts the same row. §4.1 and §7.1 are the same mechanism.
--   origin       manual | calendar_scan | bcc | import. Without it a bad
--                auto-capture run is unfixable, because nothing separates
--                machine rows from human ones. §4.3.
--   happened_at  when the conversation happened, distinct from when it was
--                typed. You log Tuesday's call on Thursday.
--   is_draft     autosave creates a row before the user has decided
--                anything. A draft is not a conversation, and an abandoned
--                one must never read as "you spoke to Marja". §7.1.
-- ============================================================================

alter table public.flow_run_note
  alter column flow_run_id drop not null,
  add column if not exists person_id       uuid references public.person(id) on delete cascade,
  add column if not exists organisation_id uuid references public.organisation(id) on delete cascade,
  add column if not exists kind            text not null default 'note',
  add column if not exists happened_at     timestamptz not null default now(),
  add column if not exists happened_tz     text,
  add column if not exists origin          text not null default 'manual',
  add column if not exists client_ref      uuid,
  add column if not exists is_draft        boolean not null default false,
  add column if not exists follow_up_at    timestamptz,
  add column if not exists follow_up_task_id uuid references public.flow_task(id) on delete set null,
  add column if not exists updated_at      timestamptz not null default now();

-- A note must be ABOUT something. Without this a row can exist attached to
-- nothing, which is the shape a half-written client produces.
alter table public.flow_run_note
  drop constraint if exists flow_run_note_has_subject;
alter table public.flow_run_note
  add constraint flow_run_note_has_subject
  check (flow_run_id is not null or person_id is not null or organisation_id is not null);

-- kind and origin are deliberately plain text with no CHECK: the vocabularies
-- live in the API (NoteKind / NoteOrigin), so adding one is a deploy rather
-- than a migration. Same call as app-key scopes in v0.14.0 and person.created_via.
comment on column public.flow_run_note.kind is
  'call | meeting | email | message | note — vocabulary in apps/api/src/routes/notes.ts, deliberately not a CHECK.';
comment on column public.flow_run_note.origin is
  'manual | calendar_scan | bcc | import. How this row came to exist; without it a bad auto-capture run cannot be separated from human work.';
comment on column public.flow_run_note.client_ref is
  'Client-generated uuid. Retries and autosave batches upsert the same row — the idempotency key and the autosave key are the same key.';

-- Idempotency. Partial so historical rows (client_ref null) do not collide.
create unique index if not exists flow_run_note_client_ref_idx
  on public.flow_run_note (workspace_id, client_ref)
  where client_ref is not null;

-- The two reads this table now has to serve fast: a person's timeline, and
-- "when did we last actually speak" for cadence.
create index if not exists flow_run_note_person_idx
  on public.flow_run_note (workspace_id, person_id, happened_at desc)
  where deleted_at is null and person_id is not null;
create index if not exists flow_run_note_org_idx
  on public.flow_run_note (workspace_id, organisation_id, happened_at desc)
  where deleted_at is null and organisation_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
--
-- The existing policy requires a parent flow_run to exist, which a
-- person-attached note has none of. Replaced with one that covers both
-- shapes: still Flow-app-gated and workspace-scoped, but a note about a
-- person stands on the person's workspace instead of a run's.
-- ---------------------------------------------------------------------------
drop policy if exists flow_run_note_scope on public.flow_run_note;
create policy flow_run_note_scope on public.flow_run_note
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
    and deleted_at is null
    and (
      flow_run_id is null
      or exists (select 1 from public.flow_run r where r.id = flow_run_note.flow_run_id)
    )
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
  );

-- ---------------------------------------------------------------------------
-- last_spoken_at(person) — "when did we last ACTUALLY speak".
--
-- Only personal kinds count. A newsletter is not a conversation
-- (docs/connections-newsletter.md D19): if a mailshot reset this, the
-- attention conditions would cheerfully report a dead relationship as
-- healthy. Drafts are excluded for the same reason — an abandoned draft is
-- not a conversation either.
-- ---------------------------------------------------------------------------
create or replace function public.last_spoken_at(p_person uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select max(n.happened_at)
    from public.flow_run_note n
   where n.person_id = p_person
     and n.deleted_at is null
     and n.is_draft = false
     and n.kind in ('call', 'meeting', 'message', 'note');
$$;

comment on function public.last_spoken_at(uuid) is
  'Last PERSONAL contact. Broadcast kinds are excluded on purpose — a newsletter is not a conversation, and counting one would make a dead relationship look healthy.';

grant execute on function public.last_spoken_at(uuid) to authenticated, service_role;
