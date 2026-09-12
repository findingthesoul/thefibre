-- ============================================================================
-- The sixth attention condition: a deal going stale.
--
-- Build-order step 4 — *"cadence and rotting, one mechanism for people and
-- deals"* — is finished here. People already rot: `went_quiet` measures
-- somebody against their own rhythm. Deals could not, because until
-- 20260913010000 nothing recorded when a commitment changed stage. Now it
-- does, `pulse_commitment_rot()` reads it, and the two halves meet on the
-- same list.
--
-- ── Why it lands on the PERSON list ─────────────────────────────────────────
--
-- Because a stalled deal is a stalled relationship wearing a number. The
-- action is almost never "update the pipeline", it is "talk to them", and the
-- person is where the conversation gets written down. Only commitments that
-- HAVE a person appear: one with an organisation and no named human is a
-- Pulse concern and belongs on Pulse's own board.
--
-- The detail carries both numbers and says whether the baseline was measured
-- from this workspace's own deals or is the conservative default, because a
-- number whose provenance is invisible is a number people stop trusting.
-- ============================================================================

create or replace function public.connections_attention(
  p_workspace uuid,
  p_limit     int default 100
) returns table (
  person_id  uuid,
  condition  text,
  since      timestamptz,
  detail     text
)
language sql
stable
security definer
set search_path = public
as $$
  with people as (
    select p.id, p.first_name, p.last_name, p.email
      from public.person p
     where p.workspace_id = p_workspace
       and p.deleted_at is null
       and p.merged_into is null
  ),
  -- Every dated thing that counts as contact, in one stream.
  events as (
    select a.person_id, a.occurred_at as at
      from public.activity a
      join people pe on pe.id = a.person_id
     where a.workspace_id = p_workspace
    union all
    select te.person_id, te.created_at
      from public.thread_enrolment te
      join people pe on pe.id = te.person_id
  ),
  stats as (
    select
      e.person_id,
      count(*)                        as n,
      max(e.at)                       as last_at,
      min(e.at)                       as first_at,
      -- Their own rhythm: average gap between first and last contact. Two
      -- events give one gap, which is a weak baseline but an honest one.
      case when count(*) > 1
        then (extract(epoch from (max(e.at) - min(e.at))) / nullif(count(*) - 1, 0))
      end                             as avg_gap_seconds
      from events e
     group by e.person_id
  ),
  -- Came to something at least once.
  attended as (
    select te.person_id, min(te.created_at) as first_at, count(*) as n
      from public.thread_enrolment te
      join people pe on pe.id = te.person_id
     group by te.person_id
  ),
  quiet as (
    select
      s.person_id,
      'went_quiet'::text as condition,
      s.last_at as since,
      -- The threshold is theirs, floored at 60 days so a flurry of three
      -- emails in one week does not mark somebody stale the following month.
      format('usually about every %s days; %s since',
             greatest(round(s.avg_gap_seconds / 86400.0)::int, 1),
             round(extract(epoch from (now() - s.last_at)) / 86400.0)::int) as detail
      from stats s
     where s.n >= 3
       and s.avg_gap_seconds is not null
       and now() - s.last_at > make_interval(secs => greatest(s.avg_gap_seconds * 2, 60 * 86400))
  ),
  unattended as (
    select
      a.person_id,
      'arrived_unattended'::text,
      a.first_at,
      'came, and nobody has been in touch since'::text
      from attended a
     where not exists (
       select 1 from public.activity ac
        where ac.person_id = a.person_id
          and ac.workspace_id = p_workspace
          and ac.occurred_at > a.first_at
     )
  ),
  nothing_next as (
    select
      a.person_id,
      'finished_nothing_next'::text,
      s.last_at,
      format('came %s times, nothing since', a.n)::text
      from attended a
      join stats s on s.person_id = a.person_id
     where a.n >= 2
       and now() - s.last_at > interval '90 days'
       -- Nothing on the books either. A thread carries no date of its own —
       -- the dates live on its engagements — so "upcoming" means enrolled in
       -- something that still has a session in the future.
       and not exists (
         select 1
           from public.thread_enrolment te2
           join public.thread_engagement en on en.thread_id = te2.thread_id
          where te2.person_id = a.person_id
            and en.starts_at >= now()
       )
  ),
  drifting as (
    select
      rc.person_id,
      'ambassador_drifting'::text,
      s.last_at,
      case when rc.is_ambassador then 'flagged as an ambassador'
           else 'flagged as a key contact' end::text
      from public.person_relationship_context rc
      join people pe on pe.id = rc.person_id
      join stats s on s.person_id = rc.person_id
     where (rc.is_ambassador or rc.is_key_contact or rc.relationship_strength = 'advocate')
       and now() - s.last_at > interval '90 days'
  ),
  -- ── The fifth: carrying too much ──────────────────────────────────────────
  -- Four sources of live load, each counted distinct, then summed. Every
  -- branch filters workspace_id explicitly: this function is `security
  -- definer`, so RLS is not doing it.
  load AS (
    select pe.id as person_id, sum(n) as things, min(oldest) as oldest
      from people pe
      join lateral (
        -- Threads with a session still ahead.
        select count(distinct te.thread_id)::int as n, min(te.created_at) as oldest
          from public.thread_enrolment te
         where te.person_id = pe.id
           and exists (
             select 1 from public.thread_engagement en
              where en.thread_id = te.thread_id and en.starts_at >= now()
           )
        union all
        -- Flows still running.
        select count(*)::int, min(fr.entered_at)
          from public.flow_run fr
         where fr.person_id = pe.id
           and fr.workspace_id = p_workspace
           and fr.status = 'active'
        union all
        -- Tasks about them that nobody has closed.
        select count(*)::int, min(ft.created_at)
          from public.flow_task ft
         where ft.contact_id = pe.id
           and ft.workspace_id = p_workspace
           and ft.status in ('open', 'in_progress')
        union all
        -- Money still on the table.
        select count(*)::int, min(pc.created_at)
          from public.pulse_commitment pc
          join public.pulse_stage ps
            on ps.workspace_id = pc.workspace_id and ps.key = pc.stage
         where pc.person_id = pe.id
           and pc.workspace_id = p_workspace
           and pc.deleted_at is null
           and ps.kind = 'open'
      ) src on true
     group by pe.id
    having sum(n) > 0
  ),
  -- The workspace's own cut-off, computed from the same population it judges.
  cutoff as (
    select greatest(
             coalesce(percentile_disc(0.9) within group (order by l.things), 0),
             4
           )::int as at_least
      from load l
  ),
  carrying as (
    select
      l.person_id,
      'carrying_too_much'::text,
      l.oldest,
      format('in %s live things at once; %s+ is the top tenth here',
             l.things, c.at_least)::text
      from load l
     cross join cutoff c
     where l.things >= c.at_least
  ),
  -- ── The sixth: a deal going stale ─────────────────────────────────────────
  -- Delegated to pulse_commitment_rot() rather than re-implemented, so the
  -- baseline logic has ONE definition. A second copy here would drift the
  -- first time somebody tuned the threshold.
  rotting as (
    select
      r.person_id,
      'deal_rotting'::text,
      r.since,
      format('%s — %s days at %s, usually about %s%s',
             r.label, r.days_at_stage, r.stage, r.typical_days,
             case when r.measured then '' else ' (no local baseline yet)' end)::text
      from public.pulse_commitment_rot(p_workspace, 100) r
      join people pe on pe.id = r.person_id
     where r.person_id is not null
  )
  select * from (
    select * from quiet
    union all select * from unattended
    union all select * from nothing_next
    union all select * from drifting
    union all select * from carrying
    union all select * from rotting
  ) q
  order by q.since asc nulls last
  limit greatest(p_limit, 1);
$$;

comment on function public.connections_attention(uuid, int) is
  'Named attention conditions with the fact behind each. Never a score: docs/connections-model.md §3.2 and D25. Six conditions. carrying_too_much uses a per-workspace 90th percentile with a floor of four; deal_rotting delegates to pulse_commitment_rot(). Neither is a fixed number.';

grant execute on function public.connections_attention(uuid, int)
  to authenticated, service_role;
