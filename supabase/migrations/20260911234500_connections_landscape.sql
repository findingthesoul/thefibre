-- ============================================================================
-- The landscape — where everybody stands in the community.
--
-- Derived, never typed. Nobody hand-maintains four hundred people's stage,
-- and a stored one is wrong within a month. Every rung below is computed
-- from tables that already hold years of data, which is why this surface
-- shows something useful on the day it ships and asks nobody to fill
-- anything in.
--
-- The ladder is a real facilitation progression — showing up, coming back,
-- contributing, holding space — and highest rung wins:
--
--   facilitator   holds space: runs a thread, as an organiser or a named helper
--   contributor   has paid for something, or is a member
--   returned      came to two or more things
--   attended      came to one
--   touched       something happened involving them, but they never came
--   never         a contact record and nothing else
--
-- `p_as_of` is the point that makes movement free. Because every source is
-- an event with a timestamp, "what did this look like a month ago" is the
-- same query with a different cutoff — no snapshot table, no history to
-- maintain, and the answer can never drift from the underlying facts.
--
-- Deliberately NOT here: dormancy. "Gone quiet" has to be measured against
-- a person's own rhythm rather than a global threshold — somebody you speak
-- to yearly is not stale at ninety days — and that belongs with the
-- attention conditions, not with the ladder.
-- ============================================================================

create or replace function public.connections_landscape(
  p_workspace uuid,
  p_as_of     timestamptz default now()
) returns table (
  person_id uuid,
  rung      text,
  last_seen timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with people as (
    select p.id
      from public.person p
     where p.workspace_id = p_workspace
       and p.deleted_at is null
       and p.merged_into is null          -- a merged record is not a person
       and p.created_at <= p_as_of
  ),
  -- Anything that counts as "they came to something", from either enrolment
  -- table. Distinct per subject so two tickets to one thread stay one visit.
  attendance as (
    select te.person_id, te.thread_id::text as subject, te.created_at
      from public.thread_enrolment te
      join people pe on pe.id = te.person_id
     where te.created_at <= p_as_of
    union
    -- Platform enrolment dates with enrolled_at, and it is nullable. A row
    -- with no date cannot be placed in time, so it counts towards the rung
    -- at every cutoff and therefore never shows up as movement. Truthful:
    -- we do not know when it happened, so we cannot claim it happened since.
    select e.person_id, e.program_id::text, e.enrolled_at
      from public.enrolment e
      join people pe on pe.id = e.person_id
     where e.enrolled_at is null or e.enrolled_at <= p_as_of
  ),
  attend_counts as (
    select person_id, count(distinct subject) as n, max(created_at) as last_at
      from attendance group by person_id
  ),
  -- Money in, or membership. Either is a real commitment beyond turning up.
  contributors as (
    select pu.person_id, max(pu.created_at) as last_at
      from public.purchase pu
      join people pe on pe.id = pu.person_id
     where pu.workspace_id = p_workspace and pu.created_at <= p_as_of
     group by pu.person_id
    union
    select mm.person_id, max(mm.created_at)
      from public.membership_member mm
      join people pe on pe.id = mm.person_id
     where mm.workspace_id = p_workspace
       and mm.created_at <= p_as_of
       and mm.status in ('active', 'grace')
     group by mm.person_id
  ),
  -- Holding space: an organiser of a thread (via their user account), or a
  -- person named directly as a helper on one.
  facilitators as (
    select u.person_id, max(tto.created_at) as last_at
      from public.thread_thread_organiser tto
      join public.thread_organiser org on org.id = tto.organiser_id
      join public."user" u on u.id = org.user_id
     where u.person_id is not null and tto.created_at <= p_as_of
     group by u.person_id
    union
    select tto.person_id, max(tto.created_at)
      from public.thread_thread_organiser tto
     where tto.person_id is not null and tto.created_at <= p_as_of
     group by tto.person_id
  ),
  touches as (
    select a.person_id, max(a.occurred_at) as last_at
      from public.activity a
      join people pe on pe.id = a.person_id
     where a.workspace_id = p_workspace and a.occurred_at <= p_as_of
     group by a.person_id
  )
  select
    pe.id,
    case
      when f.person_id is not null then 'facilitator'
      when c.person_id is not null then 'contributor'
      when coalesce(ac.n, 0) >= 2   then 'returned'
      when coalesce(ac.n, 0) = 1    then 'attended'
      when t.person_id is not null  then 'touched'
      else 'never'
    end,
    greatest(
      coalesce(t.last_at,  '-infinity'::timestamptz),
      coalesce(ac.last_at, '-infinity'::timestamptz),
      coalesce(c.last_at,  '-infinity'::timestamptz),
      coalesce(f.last_at,  '-infinity'::timestamptz)
    )
  from people pe
  left join attend_counts ac on ac.person_id = pe.id
  left join (select person_id, max(last_at) last_at from contributors group by person_id) c
    on c.person_id = pe.id
  left join (select person_id, max(last_at) last_at from facilitators group by person_id) f
    on f.person_id = pe.id
  left join touches t on t.person_id = pe.id;
$$;

comment on function public.connections_landscape(uuid, timestamptz) is
  'Everyone in the workspace placed on the community ladder, derived from activity, enrolment, purchases, membership and who runs things. p_as_of makes movement free: the same query with an earlier cutoff is what last month looked like.';

grant execute on function public.connections_landscape(uuid, timestamptz)
  to authenticated, service_role;
