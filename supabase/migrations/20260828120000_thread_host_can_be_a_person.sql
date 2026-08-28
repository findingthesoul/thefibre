-- ---------------------------------------------------------------------------
-- A thread host can be a person who has no Fibre account.
--
-- §1 of docs/brief-thread-event-settings.md. The Hosts & Facilitators list is
-- `thread_thread_organiser`, and it points at `thread_organiser` — a storefront,
-- which requires a Fibre `user`. A festival's hosts sign in to the planner's own
-- database and will never have one, so they could not be listed at all.
--
-- ONE LIST, NOT TWO. The alternative was a second table for "credited on this
-- thread", which would have meant two lists meaning nearly the same thing and
-- every reader joining both. This keeps the list that already exists and lets a
-- row name either kind:
--
--   organiser_id  -> someone with a storefront (unchanged, what the UI writes)
--   person_id     -> someone who just helps run it (new)
--
-- Exactly one of the two, enforced below.
--
-- WHY THE PRIMARY KEY MOVES
-- It was (thread_id, organiser_id), so organiser_id could not be null. It
-- becomes a surrogate id, and both pairings become plain UNIQUE constraints.
--
-- Deliberately NOT partial unique indexes. `ON CONFLICT (thread_id,
-- organiser_id)` in routes/thread.ts can only infer a full unique index; a
-- partial one would need a matching WHERE clause that PostgREST does not send,
-- and the existing members upsert would break. A plain UNIQUE does the job
-- because Postgres treats NULLs as distinct: person rows all carry a NULL
-- organiser_id and never collide with each other.
-- ---------------------------------------------------------------------------

alter table public.thread_thread_organiser
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.thread_thread_organiser
  add column if not exists person_id uuid references public.person(id) on delete cascade;

-- Swap the primary key. The old one is what pins organiser_id to NOT NULL.
alter table public.thread_thread_organiser
  drop constraint if exists thread_thread_organiser_pkey;

alter table public.thread_thread_organiser
  add constraint thread_thread_organiser_pkey primary key (id);

alter table public.thread_thread_organiser
  alter column organiser_id drop not null;

-- The two pairings. Full (not partial) so ON CONFLICT can still infer them.
alter table public.thread_thread_organiser
  drop constraint if exists thread_thread_organiser_thread_organiser_key;
alter table public.thread_thread_organiser
  add constraint thread_thread_organiser_thread_organiser_key
  unique (thread_id, organiser_id);

alter table public.thread_thread_organiser
  drop constraint if exists thread_thread_organiser_thread_person_key;
alter table public.thread_thread_organiser
  add constraint thread_thread_organiser_thread_person_key
  unique (thread_id, person_id);

-- One kind or the other, never both, never neither.
alter table public.thread_thread_organiser
  drop constraint if exists thread_thread_organiser_one_subject;
alter table public.thread_thread_organiser
  add constraint thread_thread_organiser_one_subject
  check (
    (organiser_id is not null and person_id is null)
    or
    (organiser_id is null and person_id is not null)
  );

create index if not exists thread_thread_organiser_person_idx
  on public.thread_thread_organiser (person_id);

comment on column public.thread_thread_organiser.person_id is
  'A host with no Fibre account — named directly rather than through a storefront. Exactly one of organiser_id / person_id is set.';
