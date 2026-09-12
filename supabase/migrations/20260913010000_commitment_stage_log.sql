-- ============================================================================
-- When a deal moved, and where it moved to.
--
-- Build-order step 4: *"cadence and rotting, one mechanism for people and
-- deals"*. People already rot — the cadence axis measures somebody against
-- their own rhythm. Deals do not rot at all, and could not, because nothing
-- records when a commitment changed stage.
--
-- `pulse_commitment` carries `stage` and `updated_at`, and `updated_at` moves
-- when anything changes: a note, a label, a probability. So "how long has
-- this been sitting at proposal" was unanswerable, and
-- 20260912160000_connections_axes.sql said so out loud rather than faking it:
--
--     opportunity  pulse_commitment.stage is likewise current-state ... the
--                  band a commitment sat in a month ago is not recorded
--                  anywhere and is not invented here.
--
-- and connections-data-integrity.md named the fix: *"The honest fix for both
-- is a stage/strength change log, which is a decision about writes, not a
-- thing to paper over in a read."* This is that decision.
--
-- ── Why a trigger and not application code ──────────────────────────────────
--
-- Because there is more than one writer and there will be more later. Pulse's
-- board moves a stage by drag-and-drop, the commitment dialog moves it by
-- select, and anything reaching the table through PostgREST moves it without
-- passing through either. A log maintained by whichever code path remembered
-- is a log with holes, and a log with holes is worse than none: it reads as
-- authoritative and is silently wrong. The same argument the activity table
-- already won.
--
-- ── The backfill is honest about what it does not know ──────────────────────
--
-- Existing commitments have no history and none can be invented. A deal
-- created as a lead and now committed did not become committed at creation,
-- so backfilling one event at `created_at` with today's stage would be a
-- fabrication that every later read would trust.
--
-- Instead each existing commitment gets ONE row marked `source = 'backfill'`,
-- dated `updated_at` — the last moment anything about it changed, which is
-- the best available UPPER BOUND on when its stage last moved — with
-- `from_stage` null, meaning "before this, unknown". Readers treat a backfill
-- row as the earliest thing known rather than as the beginning of time.
-- ============================================================================

create table if not exists public.pulse_commitment_stage_event (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  commitment_id uuid not null references public.pulse_commitment(id) on delete cascade,
  -- Null means "what came before is unknown": the first observation of a
  -- backfilled row, or a commitment's creation.
  from_stage    text,
  to_stage      text not null,
  changed_at    timestamptz not null default now(),
  changed_by    uuid references public."user"(id) on delete set null,
  -- 'trigger' for anything observed since this migration, 'backfill' for the
  -- one row per pre-existing commitment. Plain text, no CHECK — the same rule
  -- as person.created_via: the vocabulary lives with the code that writes it.
  source        text not null default 'trigger'
);

comment on table public.pulse_commitment_stage_event is
  'Append-only record of stage moves on a commitment, maintained by trigger so every writer is covered. A row with source=backfill is the earliest thing known about that commitment, not the beginning of its history.';

create index if not exists pulse_commitment_stage_event_commitment_idx
  on public.pulse_commitment_stage_event (commitment_id, changed_at desc);
create index if not exists pulse_commitment_stage_event_workspace_idx
  on public.pulse_commitment_stage_event (workspace_id, changed_at desc);

alter table public.pulse_commitment_stage_event enable row level security;

-- Readable by anyone who can read the commitment it belongs to. Writable by
-- nobody: the trigger runs as the table owner and application code must never
-- insert here by hand, for the same reason activity is append-only — a log
-- anybody can write is a log nobody can trust.
drop policy if exists pulse_commitment_stage_event_read on public.pulse_commitment_stage_event;
create policy pulse_commitment_stage_event_read on public.pulse_commitment_stage_event
  for select to authenticated
  using (workspace_id = public.current_workspace_id());

-- ---------------------------------------------------------------------------
-- The trigger.
-- ---------------------------------------------------------------------------
create or replace function public.pulse_commitment_log_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.pulse_commitment_stage_event
      (workspace_id, commitment_id, from_stage, to_stage, changed_at, source)
    values (new.workspace_id, new.id, null, new.stage, new.created_at, 'trigger');
    return new;
  end if;

  -- Only a stage move. An edit to the label, the notes or the probability is
  -- not a move, and logging those would drown the signal this exists for.
  if new.stage is distinct from old.stage then
    insert into public.pulse_commitment_stage_event
      (workspace_id, commitment_id, from_stage, to_stage, changed_at, source)
    values (new.workspace_id, new.id, old.stage, new.stage, now(), 'trigger');
  end if;
  return new;
end;
$$;

drop trigger if exists pulse_commitment_stage_log on public.pulse_commitment;
create trigger pulse_commitment_stage_log
  after insert or update of stage on public.pulse_commitment
  for each row execute function public.pulse_commitment_log_stage();

-- ---------------------------------------------------------------------------
-- Backfill: one row per existing commitment, marked as such.
-- ---------------------------------------------------------------------------
insert into public.pulse_commitment_stage_event
  (workspace_id, commitment_id, from_stage, to_stage, changed_at, source)
select c.workspace_id, c.id, null, c.stage, c.updated_at, 'backfill'
  from public.pulse_commitment c
 where c.deleted_at is null
   and not exists (
     select 1 from public.pulse_commitment_stage_event e where e.commitment_id = c.id
   );

-- ---------------------------------------------------------------------------
-- Rotting deals — the other half of "one mechanism for people and deals".
--
-- A deal is rotting when it has sat at its current stage for longer than
-- deals at THAT stage usually sit in THIS workspace. Not a fixed number of
-- days, for the same reason cadence is not: a proposal that takes three weeks
-- is normal in one practice and alarming in another, and a global threshold
-- would be wrong in both.
--
-- The baseline is the workspace's own median time-in-stage for that stage,
-- computed from completed moves only — a stage somebody LEFT, so the duration
-- is known. Stages nobody has ever left have no baseline and are skipped
-- rather than guessed at.
--
-- Floored at 30 days, so a workspace whose deals normally move in two days
-- does not report everything older than a week as rotting.
-- ---------------------------------------------------------------------------
create or replace function public.pulse_commitment_rot(
  p_workspace uuid,
  p_limit     int default 100
) returns table (
  commitment_id uuid,
  person_id     uuid,
  label         text,
  stage         text,
  since         timestamptz,
  days_at_stage int,
  typical_days  int
)
language sql
stable
security definer
set search_path = public
as $$
  with latest as (
    -- When each live commitment arrived at its current stage. distinct on is
    -- the cheapest way to take one row per commitment from an ordered set.
    select distinct on (e.commitment_id)
           e.commitment_id, e.to_stage, e.changed_at
      from public.pulse_commitment_stage_event e
     where e.workspace_id = p_workspace
     order by e.commitment_id, e.changed_at desc
  ),
  -- How long a stage usually lasts here, from moves that actually completed.
  durations as (
    select e.to_stage as stg,
           extract(epoch from (nxt.changed_at - e.changed_at)) as secs
      from public.pulse_commitment_stage_event e
      join lateral (
        select e2.changed_at
          from public.pulse_commitment_stage_event e2
         where e2.commitment_id = e.commitment_id
           and e2.changed_at > e.changed_at
         order by e2.changed_at asc
         limit 1
      ) nxt on true
     where e.workspace_id = p_workspace
  ),
  typical as (
    select d.stg,
           greatest(
             percentile_cont(0.5) within group (order by d.secs),
             30 * 86400
           ) as secs
      from durations d
     group by d.stg
  )
  select c.id,
         c.person_id,
         c.label,
         c.stage,
         l.changed_at,
         (extract(epoch from (now() - l.changed_at)) / 86400)::int,
         (t.secs / 86400)::int
    from public.pulse_commitment c
    join latest l on l.commitment_id = c.id
    join public.pulse_stage s
      on s.workspace_id = c.workspace_id and s.key = c.stage
    join typical t on t.stg = c.stage
   where c.workspace_id = p_workspace
     and c.deleted_at is null
     -- Only deals still in play. A won or lost deal cannot rot.
     and s.kind = 'open'
     and now() - l.changed_at > make_interval(secs => t.secs * 2)
   order by l.changed_at asc
   limit greatest(p_limit, 1);
$$;

comment on function public.pulse_commitment_rot(uuid, int) is
  'Deals sitting at a stage longer than twice this workspace''s own median for that stage, floored at 30 days. The deal half of build-order step 4 — one rotting mechanism for people and deals.';

grant execute on function public.pulse_commitment_rot(uuid, int)
  to authenticated, service_role;
