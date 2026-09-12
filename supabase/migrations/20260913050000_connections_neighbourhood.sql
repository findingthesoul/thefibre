-- ============================================================================
-- Who is near a person, and why.
--
-- The neighbourhood half of the desktop map (docs/connections-desktop.md §5b).
-- Sjoerd, 2026-09-11: *"I click on a person.. zoom in... get info... but
-- around it other people appear"*, and D40, resolved: relatedness comes from
-- SHARED ATTRIBUTES, not only typed edges, which is what stops the map being
-- empty for a year.
--
-- ── Two kinds of nearness, kept apart on purpose ────────────────────────────
--
--   stated     a `relationship` row: somebody recorded that these two know
--              each other, and how. This is an EDGE.
--   shared     both carry the same tag, belong to the same organisation, or
--              were named in the same note. This is RELATEDNESS, not an edge.
--
-- The difference is enforced, not decorative. system-handbook §12: a signal
-- inferred from co-occurrence may be SHOWN — position, weight, a stated reason
-- — but must never be the input to another computation, and never becomes the
-- edge. So this function returns the reason on every row (D44, no unexplained
-- links) and the row is displayed, never stored (D26), and nothing downstream
-- reads it. The exemption for composing fact-derived computations does not
-- apply here, because `shared` is not a recorded fact about the two people; it
-- is an inference from proximity.
--
-- ── Rarity is the weight (D43) ──────────────────────────────────────────────
--
-- A tag on three people is a strong link; a tag on three hundred is not a link
-- at all. So a shared attribute weighs 1 / ln(1 + n), where n is how many
-- people in this workspace carry it. Nothing to configure, and it adapts per
-- workspace: "sdg13" on two people pulls them together, "newsletter" on
-- everybody pulls nobody. A stated relationship is weighted above any shared
-- attribute, because somebody said it.
--
-- ── What it is not ──────────────────────────────────────────────────────────
--
-- Not the entries function. connections_entries finds who can get you IN, by
-- warm paths, and falls back to people in the same sector when nobody can.
-- This finds who is NEAR, by what they share. Different question, and a
-- shared function would have to answer both badly.
-- ============================================================================

create or replace function public.connections_neighbourhood(
  p_workspace uuid,
  p_person    uuid,
  p_limit     int default 40
) returns table (
  person_id uuid,
  weight    real,
  -- One entry per reason: {kind, label}. kind is 'stated' | 'tag' |
  -- 'organisation' | 'mentioned'. The browser thins by kind (D47, D48).
  reasons   jsonb
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
       and p.merged_into is null
  ),

  -- ── stated: somebody recorded that these two know each other ─────────────
  stated as (
    select case when r.from_person_id = p_person then r.to_person_id else r.from_person_id end as pid,
           2.0::real as w,
           jsonb_build_object('kind', 'stated', 'label', r.type) as reason
      from public.relationship r
     where r.workspace_id = p_workspace
       and (r.from_person_id = p_person or r.to_person_id = p_person)
  ),

  -- ── shared tags, weighted by how rare the tag is ─────────────────────────
  my_tags as (
    select pt.tag_id from public.person_tag pt where pt.person_id = p_person
  ),
  tag_size as (
    select pt.tag_id, count(distinct pt.person_id) as n
      from public.person_tag pt
      join people pe on pe.id = pt.person_id
     where pt.tag_id in (select tag_id from my_tags)
     group by pt.tag_id
  ),
  shared_tags as (
    select pt.person_id as pid,
           (1.0 / ln(1 + ts.n))::real as w,
           jsonb_build_object('kind', 'tag', 'label', t.name) as reason
      from public.person_tag pt
      join tag_size ts on ts.tag_id = pt.tag_id
      join public.tag t on t.id = pt.tag_id and t.workspace_id = p_workspace
      join people pe on pe.id = pt.person_id
     where pt.person_id <> p_person
  ),

  -- ── shared organisations, current memberships only ────────────────────────
  my_orgs as (
    select m.org_id from public.org_membership m
     where m.person_id = p_person and m.ended_at is null
  ),
  org_size as (
    select m.org_id, count(distinct m.person_id) as n
      from public.org_membership m
      join people pe on pe.id = m.person_id
     where m.org_id in (select org_id from my_orgs) and m.ended_at is null
     group by m.org_id
  ),
  shared_orgs as (
    select m.person_id as pid,
           (1.0 / ln(1 + os.n))::real as w,
           jsonb_build_object('kind', 'organisation', 'label', o.name) as reason
      from public.org_membership m
      join org_size os on os.org_id = m.org_id
      join public.organisation o
        on o.id = m.org_id and o.workspace_id = p_workspace and o.deleted_at is null
      join people pe on pe.id = m.person_id
     where m.person_id <> p_person and m.ended_at is null
  ),

  -- ── named in the same note, either direction ─────────────────────────────
  -- A note about p_person that @-mentions somebody, or a note about somebody
  -- that @-mentions p_person. Weighted low and flat: being typed near each
  -- other is the weakest of these signals, and the handbook's co-occurrence
  -- rule exists precisely so it never masquerades as more.
  mentioned as (
    select distinct on (pid) pid, 0.5::real as w,
           jsonb_build_object('kind', 'mentioned', 'label', 'named in the same note') as reason
      from (
        select m.person_id as pid
          from public.flow_run_note n
          join public.flow_run_note_mention m on m.note_id = n.id
         where n.workspace_id = p_workspace and n.person_id = p_person
           and n.deleted_at is null and n.is_draft = false
        union
        select n.person_id
          from public.flow_run_note n
          join public.flow_run_note_mention m on m.note_id = n.id
         where n.workspace_id = p_workspace and m.person_id = p_person
           and n.deleted_at is null and n.is_draft = false
           and n.person_id is not null
      ) x
      join people pe on pe.id = x.pid
     where x.pid <> p_person
  ),

  everything as (
    select * from stated
    union all select * from shared_tags
    union all select * from shared_orgs
    union all select * from mentioned
  )
  select e.pid,
         sum(e.w)::real,
         jsonb_agg(e.reason order by e.w desc)
    from everything e
   group by e.pid
   order by sum(e.w) desc
   limit greatest(p_limit, 1);
$$;

comment on function public.connections_neighbourhood(uuid, uuid, int) is
  'People near one person, each with every reason. stated = a relationship row (an edge); tag/organisation/mentioned = shared attributes (relatedness, displayed never stored, weighted 1/ln(1+n) by rarity). Never feed this into another computation: system-handbook §12.';

grant execute on function public.connections_neighbourhood(uuid, uuid, int)
  to authenticated, service_role;
