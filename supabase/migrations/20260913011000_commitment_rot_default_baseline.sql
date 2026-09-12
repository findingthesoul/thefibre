-- ============================================================================
-- Rot detection has to work on day one, not in six weeks.
--
-- 20260913010000 computed each stage's typical duration from COMPLETED moves
-- — a stage somebody left, so the elapsed time is known — and skipped stages
-- with no such moves rather than guessing. That is the right instinct and it
-- produced a function that finds nothing at all:
--
--   * the backfill writes ONE event per existing commitment, so no existing
--     commitment has a completed move,
--   * a stage nobody has left since the trigger was installed has no
--     durations,
--   * therefore `typical` is empty, the inner join drops every row, and the
--     function returns zero for every workspace until deals start moving
--     AFTER this migration.
--
-- Caught by fixture rather than by reading: the fixture was flagged NO with
-- no error anywhere. An inner join to an empty CTE fails silently and looks
-- exactly like "nothing is rotting", which is the most expensive shape a bug
-- can take on a surface whose entire job is to tell you something is wrong.
--
-- ── The fix, without reintroducing a fixed threshold ────────────────────────
--
-- A stage with no measured baseline falls back to the FLOOR that was already
-- in the function — 30 days, so rot at twice that. This is not the global
-- threshold the design refuses, for two reasons worth stating because the
-- distinction is easy to lose: it is a starting point rather than the answer,
-- and it is replaced by the workspace's own median the moment that workspace
-- has moved two deals through a stage. The row says which one it used, so
-- nobody has to guess whether a number is measured or assumed.
-- ============================================================================

-- The signature changes — `measured` is a new output column — and Postgres
-- refuses to change the return type of an existing function with CREATE OR
-- REPLACE. Dropping first is the only way, and it is safe here because
-- nothing has been wired to this function yet.
drop function if exists public.pulse_commitment_rot(uuid, int);

create function public.pulse_commitment_rot(
  p_workspace uuid,
  p_limit     int default 100
) returns table (
  commitment_id uuid,
  person_id     uuid,
  label         text,
  stage         text,
  since         timestamptz,
  days_at_stage int,
  typical_days  int,
  -- False means "this workspace has not moved enough deals through this stage
  -- yet, so the conservative default was used". The interface says so; a
  -- number whose provenance is invisible is a number people stop trusting.
  measured      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with latest as (
    select distinct on (e.commitment_id)
           e.commitment_id, e.to_stage, e.changed_at
      from public.pulse_commitment_stage_event e
     where e.workspace_id = p_workspace
     order by e.commitment_id, e.changed_at desc
  ),
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
    -- Two completed moves minimum. One is not a rhythm, and a single fast
    -- deal would make everything after it look rotten.
    select d.stg,
           greatest(percentile_cont(0.5) within group (order by d.secs), 30 * 86400) as secs
      from durations d
     group by d.stg
    having count(*) >= 2
  )
  select c.id,
         c.person_id,
         c.label,
         c.stage,
         l.changed_at,
         (extract(epoch from (now() - l.changed_at)) / 86400)::int,
         (coalesce(t.secs, 30 * 86400) / 86400)::int,
         (t.secs is not null)
    from public.pulse_commitment c
    join latest l on l.commitment_id = c.id
    join public.pulse_stage s
      on s.workspace_id = c.workspace_id and s.key = c.stage
    -- LEFT, so a stage with no measured baseline still produces rows. This is
    -- the whole fix: the inner join here is what returned nothing.
    left join typical t on t.stg = c.stage
   where c.workspace_id = p_workspace
     and c.deleted_at is null
     and s.kind = 'open'
     and now() - l.changed_at > make_interval(secs => coalesce(t.secs, 30 * 86400) * 2)
   order by l.changed_at asc
   limit greatest(p_limit, 1);
$$;

comment on function public.pulse_commitment_rot(uuid, int) is
  'Deals sitting at an open stage longer than twice the baseline for that stage: the workspace''s own median once it has two completed moves through it, otherwise a conservative 30-day default. `measured` says which. The deal half of build-order step 4.';

grant execute on function public.pulse_commitment_rot(uuid, int)
  to authenticated, service_role;
