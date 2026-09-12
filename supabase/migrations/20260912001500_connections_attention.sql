-- ============================================================================
-- What requires attention.
--
-- Named conditions, never a score. A single number is lead scoring wearing
-- community clothes: wrong in ways nobody can argue with, and for a
-- facilitation business it quietly turns people into a ranking. Each
-- condition here is a sentence you could say to the person's face, and each
-- carries the fact that produced it so the interface can explain itself
-- rather than ask to be trusted.
--
--   went_quiet          in touch on some rhythm, and now past it — measured
--                       against THEIR OWN baseline, because somebody you
--                       speak to yearly is not stale at ninety days
--   arrived_unattended  came to something, and nobody has been in touch since
--   finished_nothing_next  came more than once, nothing since, nothing booked
--   ambassador_drifting an advocate or key contact whose cadence has stopped
--
-- "Carrying too much" (the fifth in docs/connections-model.md §3.2) is not
-- here: it needs task load, which lands with the note/task work.
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
  )
  select * from (
    select * from quiet
    union all select * from unattended
    union all select * from nothing_next
    union all select * from drifting
  ) q
  order by q.since asc nulls last
  limit greatest(p_limit, 1);
$$;

comment on function public.connections_attention(uuid, int) is
  'Named attention conditions with the fact behind each. Never a score: docs/connections-model.md §3.2 and D25.';

grant execute on function public.connections_attention(uuid, int)
  to authenticated, service_role;
