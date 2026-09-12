-- ============================================================================
-- The fifth attention condition: carrying too much.
--
-- docs/connections-model.md §3.2 named five; four shipped on 2026-09-12 and
-- this one was deferred with a note saying it "needs task load, which lands
-- with the note/task work". That work landed the same day (flow_task
-- follow-ups from notes, 20260912140000), so the reason to wait is gone.
--
-- What it is, from the model doc: *"Appearing in many active things at once.
-- This one points at your own team as much as the community, and it is the
-- burnout signal no CRM has because no CRM knows what delivery looks like."*
--
-- ── Why the threshold is relative, not a number ─────────────────────────────
--
-- "Many" has no fixed value. Four live commitments is a heavy week for a
-- volunteer and a quiet one for a full-time facilitator, and a global
-- threshold would flag the second forever while never noticing the first.
-- connections-model.md §3.5 already settled this for counts: band by
-- quantiles WITHIN the workspace, never fixed thresholds — "the top decile of
-- meeting frequency means something in every workspace, more than ten
-- meetings means something in only some".
--
-- So: the 90th percentile of concurrent load among people who are carrying
-- anything at all, with a FLOOR of four. The floor exists because a
-- percentile alone is degenerate in a small or quiet workspace — with five
-- active people the busiest is automatically the top decile, and flagging
-- somebody for holding two things would teach everyone to ignore this list.
-- A condition that fires on an ordinary Tuesday is furniture.
--
-- ── What counts as carrying something ───────────────────────────────────────
--
-- Four sources, all of them things that are OPEN right now rather than things
-- that happened. This is a load measure, not a history:
--
--   live threads     enrolled in a thread that still has a session ahead of
--                    it. A thread carries no date of its own — the dates live
--                    on its engagements — so "live" has to be asked of
--                    thread_engagement, the same join nothing_next uses.
--   running flows    a flow_run with status 'active'.
--   open tasks       flow_task rows ABOUT this person (contact_id), still
--                    open or in progress. Deliberately contact_id and not
--                    assignee_user_id: this condition is about what a person
--                    is carrying, not about who is doing the work on them.
--   open commitments a pulse_commitment at a stage whose kind is still open.
--
-- Counted DISTINCT per source and summed, so one thread with three sessions
-- is one thing, not three.
--
-- ── What it deliberately is not ─────────────────────────────────────────────
--
-- Not a score, like the other four. The row carries the count and the
-- workspace's own cut-off in its detail text, so the interface can say why
-- this person and not somebody else, rather than asking to be trusted. And
-- not a judgement: "carrying too much" is a sentence you could say to
-- somebody's face, which is the test every condition here has to pass.
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
  )
  select * from (
    select * from quiet
    union all select * from unattended
    union all select * from nothing_next
    union all select * from drifting
    union all select * from carrying
  ) q
  order by q.since asc nulls last
  limit greatest(p_limit, 1);
$$;

comment on function public.connections_attention(uuid, int) is
  'Named attention conditions with the fact behind each. Never a score: docs/connections-model.md §3.2 and D25. Five conditions since 2026-09-12 — carrying_too_much uses a per-workspace 90th percentile with a floor of four, never a fixed number.';

grant execute on function public.connections_attention(uuid, int)
  to authenticated, service_role;
