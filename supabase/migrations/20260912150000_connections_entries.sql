-- ============================================================================
-- Entries — who can get me in.
--
-- docs/connections-model.md §3.6. An entry is a path from anyone in the
-- workspace to a person or an organisation you want to reach, with the reason
-- attached in words. "Marja worked at Acme until 2023, and you co-facilitated
-- Athens with her."
--
-- Three rules, and the whole thing produces noise without them:
--
--   1. TWO HOPS, HARD CAP. One hop is an entry, two is a maybe, three is a
--      coincidence with extra steps. There is deliberately no recursive CTE
--      here — the cap is structural, not a parameter somebody can raise.
--
--   2. PATH STRENGTH IS THE WEAKEST EDGE. `least()`, never a sum and never an
--      average. If you are close to Marja and Marja barely knows the Acme CEO,
--      that path is weak. Summing makes long weak chains outrank short strong
--      ones, which is exactly backwards, and is how most graph features
--      disappoint.
--
--   3. EVERY EDGE DECAYS. A strong connection from eight years ago is not a
--      strong connection. connections_edge_decay() halves an edge every three
--      years, floored so history never becomes literally worthless.
--
-- Nothing here is stored. Every edge except `relationship` and `introduced_by`
-- is DERIVED at read time from shared employment and shared threads — D26:
-- derived edges are displayed, never written down. The reason is always a
-- sentence, never a score (§3.6, D25).
--
-- `ended_at` on org_membership is the quiet gem. Because memberships have an
-- end date, Fibre knows where people USED to work, and a former employee is
-- one of the strongest warm paths that exists. Most CRMs cannot see it at all
-- because they only store where somebody works now. Past memberships are
-- included here and the reason says so.
--
-- An entry lands on a PERSON, and not all people are equal — so the reason
-- carries who it actually reaches: title, budget holder, decision maker,
-- champion, gatekeeper. And the vocabulary cuts both ways: an entry via
-- someone marked `sceptic` is a WARNING, not an opportunity. Those reasons are
-- prefixed with the literal 'Careful: ' — a small contract the API route reads
-- so the interface can show them as the caution they are.
-- ============================================================================

-- A person's display name, once, so every sentence below spells it the same.
create or replace function public.connections_person_label(
  p_first text,
  p_last  text,
  p_email text
) returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(coalesce(p_first, '') || ' ' || coalesce(p_last, '')), ''),
    p_email,
    'someone'
  );
$$;

comment on function public.connections_person_label(text, text, text) is
  'Display name for a person inside derived Connections sentences.';

-- Recency, applied to an EDGE rather than to a person. Half-life three years:
-- a co-facilitation last month counts fully, one from 2018 counts for about a
-- sixth of it. Floored at 0.05 rather than zero — an old link is faint, not
-- false, and zeroing it would silently drop the long-dormant former colleague
-- who is often the most interesting name on the page.
create or replace function public.connections_edge_decay(p_at timestamptz)
returns real
language sql
stable
as $$
  select greatest(
    0.05,
    exp(
      -ln(2::numeric)
      * least(
          greatest(extract(epoch from (now() - coalesce(p_at, now()))) / 31557600.0, 0),
          40
        )
      / 3.0
    )
  )::real;
$$;

comment on function public.connections_edge_decay(timestamptz) is
  'Time decay for one graph edge — half-life three years, floored at 0.05. docs/connections-model.md §3.6.';

create or replace function public.connections_entries(
  p_workspace     uuid,
  p_target_org    uuid default null,
  p_target_person uuid default null,
  p_limit         int  default 50
) returns table (
  via_person_id uuid,
  target_id     uuid,
  target_kind   text,
  hops          int,
  reason        text,
  strength      real
)
language sql
stable
security definer
set search_path = public
as $$
  -- Internal aliases deliberately avoid the RETURNS TABLE column names
  -- (hops / reason / strength / target_id): in a LANGUAGE SQL function those
  -- are in scope as parameters, and a bare reference to one is ambiguous.
  with people as (
    select p.id,
           public.connections_person_label(p.first_name, p.last_name, p.email::text) as label
      from public.person p
     where p.workspace_id = p_workspace
       and p.deleted_at is null
       and p.merged_into is null
  ),

  -- ── Person ↔ person edges ─────────────────────────────────────────────
  -- Two typed sources (human assertions) and two derived ones. The derived
  -- pair is what makes this work on day one: `relationship` is empty in a new
  -- workspace, so entries that launched on typed edges would launch on
  -- nothing (§3.6, "Cold start").

  -- Typed. A human said these out loud, so they outweigh anything inferred.
  rel_pairs as (
    select r.from_person_id as a,
           r.to_person_id   as b,
           (case r.strength
              when 'advocate' then 1.0
              when 'strong'   then 0.85
              when 'warm'     then 0.6
              when 'weak'     then 0.3
              -- No strength recorded: fall back to what the TYPE implies.
              else (case r.type
                      when 'co_facilitates' then 0.7
                      when 'mentor'         then 0.7
                      when 'introduced_by'  then 0.6
                      when 'referred'       then 0.5
                      when 'colleague'      then 0.5
                      else 0.4
                    end)
            end)::real as w,
           r.created_at as at,
           'rel_' || r.type as kind,
           null::text as extra
      from public.relationship r
     where r.workspace_id = p_workspace
       and exists (select 1 from people pa where pa.id = r.from_person_id)
       and exists (select 1 from people pb where pb.id = r.to_person_id)
  ),

  -- Typed, and the one edge the product already captures in practice: the
  -- `introduced_by` field on the relationship-context profile tab.
  intro_pairs as (
    select rc.introduced_by as a,
           rc.person_id     as b,
           (case rc.relationship_strength
              when 'advocate' then 1.0
              when 'strong'   then 0.85
              when 'warm'     then 0.6
              when 'weak'     then 0.3
              else 0.6
            end)::real as w,
           coalesce(rc.first_contact_at, rc.updated_at) as at
      from public.person_relationship_context rc
     where rc.introduced_by is not null
       and rc.introduced_by <> rc.person_id
       and exists (select 1 from people pa where pa.id = rc.introduced_by)
       and exists (select 1 from people pb where pb.id = rc.person_id)
  ),

  -- Derived: worked at the same place at the same time. Symmetric already —
  -- the self-join emits both directions — so this one is not swapped below.
  org_pairs as (
    select m1.person_id as a,
           m2.person_id as b,
           (case when m1.ended_at is null and m2.ended_at is null
                 then 0.5 else 0.4 end)::real as w,
           (least(coalesce(m1.ended_at, current_date),
                  coalesce(m2.ended_at, current_date)))::timestamptz as at,
           (case when m1.ended_at is null and m2.ended_at is null
                 then 'org_now' else 'org_past' end)::text as kind,
           o.name as extra
      from public.org_membership m1
      join public.org_membership m2
        on m2.org_id = m1.org_id
       and m2.person_id <> m1.person_id
      join public.organisation o on o.id = m1.org_id
     where o.workspace_id = p_workspace
       and o.deleted_at is null
       and exists (select 1 from people pa where pa.id = m1.person_id)
       and exists (select 1 from people pb where pb.id = m2.person_id)
       -- They have to have actually OVERLAPPED. Two people at the same
       -- employer a decade apart never met there, and an edge between them
       -- is a fabrication dressed up as data.
       and coalesce(m1.started_at, '-infinity'::date) <= coalesce(m2.ended_at, 'infinity'::date)
       and coalesce(m2.started_at, '-infinity'::date) <= coalesce(m1.ended_at, 'infinity'::date)
  ),

  -- Derived: in the same room. The weakest edge kind on purpose — forty
  -- people at a conference did not thereby become forty relationships — but
  -- several shared threads say more than one, so it climbs a little.
  thread_pairs as (
    select t1.person_id as a,
           t2.person_id as b,
           least(0.4, 0.25 + 0.05 * (count(*) - 1))::real as w,
           max(greatest(t1.created_at, t2.created_at)) as at,
           'thread'::text as kind,
           (array_agg(pr.title order by greatest(t1.created_at, t2.created_at) desc))[1] as extra
      from public.thread_enrolment t1
      join public.thread_enrolment t2
        on t2.thread_id = t1.thread_id
       and t2.person_id <> t1.person_id
      join public.thread_thread th on th.id = t1.thread_id
      join public.program pr on pr.id = th.program_id
     where t1.workspace_id = p_workspace
       and t2.workspace_id = p_workspace
       and exists (select 1 from people pa where pa.id = t1.person_id)
       and exists (select 1 from people pb where pb.id = t2.person_id)
     group by t1.person_id, t2.person_id
  ),

  -- One undirected edge list. The directed sources are emitted both ways;
  -- the introduction flips its wording when it flips direction.
  pairs as (
    select a, b, w, at, kind, extra from rel_pairs
    union all
    select b, a, w, at, kind, extra from rel_pairs
    union all
    select a, b, w, at, 'introduced'::text, null::text from intro_pairs
    union all
    select b, a, w, at, 'was_introduced'::text, null::text from intro_pairs
    union all
    select a, b, w, at, kind, extra from org_pairs
    union all
    select a, b, w, at, kind, extra from thread_pairs
  ),

  -- Decay lands here, once, on every edge regardless of where it came from.
  edges as (
    select p.a,
           p.b,
           (p.w * public.connections_edge_decay(p.at))::real as w,
           case p.kind
             when 'rel_co_facilitates' then format('%s and %s co-facilitate', la.label, lb.label)
             when 'rel_mentor'         then format('%s and %s have a mentoring relationship', la.label, lb.label)
             when 'rel_colleague'      then format('%s and %s are noted as colleagues', la.label, lb.label)
             when 'rel_peer'           then format('%s and %s are noted as peers', la.label, lb.label)
             when 'rel_referred'       then format('%s and %s are linked by a referral', la.label, lb.label)
             when 'rel_introduced_by'  then format('%s and %s are linked by an introduction', la.label, lb.label)
             when 'introduced'         then format('%s introduced %s', la.label, lb.label)
             when 'was_introduced'     then format('%s was introduced by %s', la.label, lb.label)
             when 'org_now'            then format('%s and %s both work at %s', la.label, lb.label, coalesce(p.extra, 'the same organisation'))
             when 'org_past'           then format('%s and %s were both at %s', la.label, lb.label, coalesce(p.extra, 'the same organisation'))
             when 'thread'             then format('%s and %s were both at %s', la.label, lb.label, coalesce(p.extra, 'the same thread'))
             else format('%s and %s are connected', la.label, lb.label)
           end as how
      from pairs p
      join people la on la.id = p.a
      join people lb on lb.id = p.b
  ),

  -- ── The last edge: somebody who touches the target directly ───────────
  -- For an organisation that is a membership, past or present, and this is
  -- where the row learns WHO it reaches. For a person it is any edge above.
  direct_org as (
    select distinct on (m.person_id)
           m.person_id,
           (case when m.ended_at is null then 0.8 else 0.6 end
            * public.connections_edge_decay(
                case when m.ended_at is null then now() else m.ended_at::timestamptz end
              ))::real as w,
           (m.role_in_change = 'sceptic') as warn,
           format('%s %s %s%s%s%s',
             pe.label,
             case when m.ended_at is null then 'works at' else 'worked at' end,
             o.name,
             case when m.ended_at is not null then ' until ' || to_char(m.ended_at, 'YYYY') else '' end,
             case when nullif(btrim(coalesce(m.title, '')), '') is not null then ' as ' || m.title else '' end,
             -- Who it actually reaches. Knowing the receptionist is not
             -- knowing the budget holder, and the sceptic is a warning.
             case
               when m.role_in_change = 'sceptic'    then ' — and is noted as sceptical about the change'
               when m.is_budget_holder              then ' — and holds the budget'
               when m.is_decision_maker             then ' — and is a decision maker'
               when m.is_champion                   then ' — and is a champion there'
               when m.role_in_change = 'gatekeeper' then ' — and is a gatekeeper'
               else ''
             end
           ) as clause
      from public.org_membership m
      join people pe on pe.id = m.person_id
      join public.organisation o on o.id = m.org_id
     where p_target_org is not null
       and m.org_id = p_target_org
       and o.workspace_id = p_workspace
       and o.deleted_at is null
     -- Current stint wins over a former one for the same person.
     order by m.person_id,
              (case when m.ended_at is null then 0 else 1 end),
              m.ended_at desc nulls first
  ),

  direct_person as (
    select distinct on (e.a)
           e.a as person_id,
           e.w,
           false as warn,
           e.how as clause
      from edges e
     where p_target_person is not null
       and p_target_org is null
       and e.b = p_target_person
     order by e.a, e.w desc
  ),

  direct as (
    select distinct on (d.person_id) d.person_id, d.w, d.warn, d.clause
      from (
        select * from direct_org
        union all
        select * from direct_person
      ) d
     order by d.person_id, d.w desc
  ),

  -- ── Hop one. You know somebody there. ─────────────────────────────────
  hop1 as (
    select d.person_id as via_id,
           1 as n_hops,
           d.w as score,
           d.warn,
           d.clause as why
      from direct d
  ),

  -- ── Hop two, and no further. ──────────────────────────────────────────
  -- strength = least(), the whole point: the chain is only as good as its
  -- thinnest edge.
  hop2 as (
    select distinct on (e.a)
           e.a as via_id,
           2 as n_hops,
           least(e.w, d.w)::real as score,
           d.warn,
           format('%s; %s', e.how, d.clause) as why
      from edges e
      join direct d on d.person_id = e.b
     where e.a <> d.person_id
       and (p_target_person is null or e.a <> p_target_person)
       -- Anybody who touches the target themselves is already a hop-1 row,
       -- and a shorter path always beats the longer one through them.
       and not exists (select 1 from direct d2 where d2.person_id = e.a)
     order by e.a, least(e.w, d.w) desc
  ),

  -- One ask per connector: the product is the introduction you request, and
  -- three variations on "ask Marja" is a list nobody acts on.
  best as (
    select distinct on (u.via_id) u.via_id, u.n_hops, u.score, u.warn, u.why
      from (
        select via_id, n_hops, score, warn, why from hop1
        union all
        select via_id, n_hops, score, warn, why from hop2
      ) u
     order by u.via_id, u.score desc, u.n_hops asc
  )

  select
    b.via_id,
    coalesce(p_target_org, p_target_person),
    case when p_target_org is not null then 'organisation' else 'person' end,
    b.n_hops,
    case when b.warn then 'Careful: ' || b.why else b.why end,
    b.score
  from best b
  where coalesce(p_target_org, p_target_person) is not null
    and b.score > 0
  order by b.score desc, b.n_hops asc, b.via_id
  limit greatest(coalesce(p_limit, 50), 1);
$$;

comment on function public.connections_entries(uuid, uuid, uuid, int) is
  'Who can get us in to a person or organisation. Two hops max, strength is the weakest edge, every edge decays. Reasons are sentences, never scores. docs/connections-model.md §3.6.';

grant execute on function public.connections_person_label(text, text, text)
  to authenticated, service_role;
grant execute on function public.connections_edge_decay(timestamptz)
  to authenticated, service_role;
grant execute on function public.connections_entries(uuid, uuid, uuid, int)
  to authenticated, service_role;
