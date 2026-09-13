-- ============================================================================
-- What connects the people already on screen, to each other.
--
-- Sjoerd, 2026-09-13, on the moving web: *"Some words are not only connected
-- to the central word (read: contact), but also to other words that are shown
-- (in our case: relations between contacts) ... sometimes — or most of the
-- time if not always — there is a connection between a word and a related
-- word."*
--
-- connections_neighbourhood answers "who is near ONE person". This answers
-- "and how are THOSE people tied to each other", for a set the caller already
-- has on screen. Without it the web is a star: everything radiates from the
-- middle and the picture says nothing about the community's own shape.
--
-- ── Same grammar as connections_neighbourhood, deliberately ────────────────
--
--   stated     a `relationship` row — somebody recorded it. An EDGE. Weight 2.
--   shared     same tag, same current organisation, named in the same note.
--              RELATEDNESS, not an edge, weighted 1/ln(1+n) by how rare the
--              thing is, so a tag on three people ties them and a tag on three
--              hundred ties nobody (D43).
--
-- Every row carries its reason, so nothing is drawn unexplained (D44), and the
-- result is DISPLAYED and never stored or fed into another computation
-- (system-handbook §12). A shared tag between two people is not a claim that
-- they know each other, and the interface draws it dashed for exactly that
-- reason.
--
-- ── Bounded by the caller's set ─────────────────────────────────────────────
--
-- It only ever looks at `p_people`, which is the dozen names already on the
-- screen. No fan-out, no transitive walk: this is the cheap question, asked
-- about a set that is small by construction.
--
-- ── Locked to the API, from the first line ─────────────────────────────────
--
-- SECURITY DEFINER, so RLS does not apply and the workspace filter is this
-- function's own job — and therefore EXECUTE is revoked from public, anon AND
-- authenticated, leaving service_role. Tonight's finding (§11.3b): a
-- `grant ... to authenticated` reads like an access list and is not, because
-- Postgres grants new functions to PUBLIC and Supabase grants anon and
-- authenticated separately. Every definer function that takes a workspace as
-- a parameter must be closed this way or the anon key can ask it about any
-- tenant.
-- ============================================================================

create or replace function public.connections_links_among(
  p_workspace uuid,
  p_people    uuid[]
) returns table (
  a_person_id uuid,
  b_person_id uuid,
  weight      real,
  reasons     jsonb
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
       and p.id = any(p_people)
  ),

  -- ── stated: somebody recorded that these two know each other ─────────────
  -- Normalised so each pair appears once, smallest id first, whichever way
  -- round the row was written.
  stated as (
    select least(r.from_person_id, r.to_person_id) as a,
           greatest(r.from_person_id, r.to_person_id) as b,
           2.0::real as w,
           jsonb_build_object('kind', 'stated', 'label', r.type) as reason
      from public.relationship r
      join people pa on pa.id = r.from_person_id
      join people pb on pb.id = r.to_person_id
     where r.workspace_id = p_workspace
  ),

  -- ── shared tags, weighted by rarity across the whole workspace ───────────
  -- n counts every person in the workspace carrying the tag, not just those
  -- on screen: rarity is a property of the vocabulary, not of this view.
  tag_size as (
    select pt.tag_id, count(distinct pt.person_id) as n
      from public.person_tag pt
      join public.person p
        on p.id = pt.person_id
       and p.workspace_id = p_workspace
       and p.deleted_at is null
       and p.merged_into is null
     group by pt.tag_id
  ),
  shared_tags as (
    select least(x.person_id, y.person_id) as a,
           greatest(x.person_id, y.person_id) as b,
           (1.0 / ln(1 + ts.n))::real as w,
           jsonb_build_object('kind', 'tag', 'label', t.name) as reason
      from public.person_tag x
      join public.person_tag y on y.tag_id = x.tag_id and y.person_id > x.person_id
      join tag_size ts on ts.tag_id = x.tag_id
      join public.tag t on t.id = x.tag_id and t.workspace_id = p_workspace
      join people pa on pa.id = x.person_id
      join people pb on pb.id = y.person_id
  ),

  -- ── shared current organisation ─────────────────────────────────────────
  org_size as (
    select m.org_id, count(distinct m.person_id) as n
      from public.org_membership m
      join public.person p
        on p.id = m.person_id
       and p.workspace_id = p_workspace
       and p.deleted_at is null
       and p.merged_into is null
     where m.ended_at is null
     group by m.org_id
  ),
  shared_orgs as (
    select least(x.person_id, y.person_id) as a,
           greatest(x.person_id, y.person_id) as b,
           (1.0 / ln(1 + os.n))::real as w,
           jsonb_build_object('kind', 'organisation', 'label', o.name) as reason
      from public.org_membership x
      join public.org_membership y
        on y.org_id = x.org_id and y.person_id > x.person_id and y.ended_at is null
      join org_size os on os.org_id = x.org_id
      join public.organisation o
        on o.id = x.org_id and o.workspace_id = p_workspace and o.deleted_at is null
      join people pa on pa.id = x.person_id
      join people pb on pb.id = y.person_id
     where x.ended_at is null
  ),

  -- ── named in the same note ──────────────────────────────────────────────
  -- Weakest of the signals and flat-weighted, for the reason the handbook's
  -- co-occurrence rule exists: being typed near each other is not knowing
  -- each other. Counted once per pair, however many notes.
  same_note as (
    select distinct
           least(m1.person_id, m2.person_id) as a,
           greatest(m1.person_id, m2.person_id) as b,
           0.5::real as w,
           jsonb_build_object('kind', 'mentioned', 'label', 'named in the same note') as reason
      from public.flow_run_note n
      join public.flow_run_note_mention m1 on m1.note_id = n.id
      join public.flow_run_note_mention m2 on m2.note_id = n.id and m2.person_id > m1.person_id
      join people pa on pa.id = m1.person_id
      join people pb on pb.id = m2.person_id
     where n.workspace_id = p_workspace
       and n.deleted_at is null
       and n.is_draft = false
  ),

  everything as (
    select * from stated
    union all select * from shared_tags
    union all select * from shared_orgs
    union all select * from same_note
  )
  select e.a,
         e.b,
         sum(e.w)::real,
         jsonb_agg(e.reason order by e.w desc)
    from everything e
   group by e.a, e.b;
$$;

comment on function public.connections_links_among(uuid, uuid[]) is
  'How the people already on screen are tied to each other, for the map web. stated = a relationship row (an edge); tag/organisation/mentioned = shared attributes (relatedness, displayed never stored, weighted 1/ln(1+n) by rarity). Never feed into another computation: system-handbook §12.';

-- Locked to the API. See the header: revoke from all three, grant service_role.
revoke all on function public.connections_links_among(uuid, uuid[]) from public;
revoke all on function public.connections_links_among(uuid, uuid[]) from anon;
revoke all on function public.connections_links_among(uuid, uuid[]) from authenticated;
grant execute on function public.connections_links_among(uuid, uuid[]) to service_role;
