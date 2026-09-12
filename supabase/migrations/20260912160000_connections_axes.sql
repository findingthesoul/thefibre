-- ============================================================================
-- The landscape, read five ways.
--
-- docs/connections-mobile.md §2 and D32: the same population, re-segmented by
-- a chosen axis, in an IDENTICAL visual. The picker changes what the bands
-- MEAN; the grammar never changes. Learn it once, read it five ways. That is
-- what keeps this surface simple instead of sprawling into five pages — and
-- it is why the sales pipeline is one axis among several rather than a
-- separate place.
--
-- One function, one contract: (person_id, band) for a workspace at a point in
-- time. Everything downstream — counts, proportions, movement, arrivals — is
-- the same arithmetic over whichever axis was asked for.
--
--   maturity      never / touched / attended / returned / contributor /
--                 facilitator                     — delegates to
--                 connections_landscape, which stays the one definition of
--                 the ladder. Do not re-implement it here.
--   closeness     unrated / weak / warm / strong / advocate
--   cadence       never_spoken / quiet / slowing / in_rhythm
--   opportunity   none / open / proposal / committed
--   contribution  brought_nobody / brought_someone / brings_regularly
--
-- ── p_as_of, and where it is honest ─────────────────────────────────────────
--
-- Movement is free when every source is a timestamped event: "what did this
-- look like a month ago" is the same query with an earlier cutoff, with no
-- snapshot table and no history that can drift from the facts.
--
-- Three of the five axes honour that fully. Two cannot, and say so rather
-- than faking it:
--
--   closeness    relationship_strength is a CURRENT-STATE column with no
--                history — the row carries one updated_at for the whole
--                record, so yesterday's value is simply gone. Every cutoff
--                returns today's rating. Closeness therefore shows
--                proportions truthfully and reports NO movement, which is
--                correct: we genuinely do not know that anybody moved.
--   opportunity  pulse_commitment.stage is likewise current-state. Existence
--                IS time-travelled (a deal created last week did not exist a
--                month ago), so arrivals into the pipeline are real; the band
--                a commitment sat in a month ago is not recorded anywhere and
--                is not invented here.
--
-- The honest fix for both is a stage/strength change log, which is a decision
-- about writes, not a thing to paper over in a read.
-- ============================================================================

create or replace function public.connections_landscape_axis(
  p_workspace uuid,
  p_axis      text,
  p_as_of     timestamptz default now()
) returns table (
  person_id uuid,
  band      text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- ── maturity ──────────────────────────────────────────────────────────────
  -- Delegated, never mirrored. The ladder has one definition
  -- (20260911234500_connections_landscape.sql) and a second copy here would
  -- drift the first time somebody adds a rung.
  if p_axis = 'maturity' then
    return query
      select l.person_id, l.rung::text
        from public.connections_landscape(p_workspace, p_as_of) l;
    return;
  end if;

  -- ── closeness ─────────────────────────────────────────────────────────────
  -- The one axis a human types in by hand, and the only place in this surface
  -- where that is right: how close somebody feels is not derivable from
  -- events. `unrated` is a band rather than a silent default — calling four
  -- hundred unassessed people "weak" would be a judgement nobody made.
  --
  -- p_as_of is accepted and deliberately ignored for the rating itself (see
  -- the header). Person existence still respects it, so the population is the
  -- population of that day.
  if p_axis = 'closeness' then
    return query
      select p.id,
             case rc.relationship_strength
               when 'advocate' then 'advocate'
               when 'strong'   then 'strong'
               when 'warm'     then 'warm'
               when 'weak'     then 'weak'
               else 'unrated'
             end
        from public.person p
        left join public.person_relationship_context rc on rc.person_id = p.id
       where p.workspace_id = p_workspace
         and p.deleted_at is null
         and p.merged_into is null
         and p.created_at <= p_as_of;
    return;
  end if;

  -- ── cadence ───────────────────────────────────────────────────────────────
  -- Who is drifting. Measured against THEIR OWN rhythm: somebody you speak to
  -- yearly is not stale at ninety days, and a global threshold would say they
  -- were. Same baseline as connections_attention.went_quiet, so the axis and
  -- the attention queue can never disagree about the same person.
  --
  -- What counts as contact is exactly what last_spoken_at(person) counts —
  -- personal kinds only, no drafts. A newsletter is not a conversation
  -- (docs/connections-newsletter.md D19); if a mailshot reset this, the whole
  -- axis would report dead relationships as healthy. The predicate is
  -- restated inline rather than calling the function because the function has
  -- no cutoff parameter, and a cutoff is the entire point of p_as_of. If
  -- last_spoken_at's definition changes, change it here too.
  if p_axis = 'cadence' then
    return query
      with spoken as (
        select n.person_id as pid, n.happened_at as at
          from public.flow_run_note n
         where n.workspace_id = p_workspace
           and n.person_id is not null
           and n.deleted_at is null
           and n.is_draft = false
           and n.kind in ('call', 'meeting', 'message', 'note')
           and n.happened_at <= p_as_of
      ),
      stats as (
        select s.pid,
               count(*) as n,
               max(s.at) as last_at,
               -- Their rhythm: the average gap between first and last
               -- conversation. Two conversations give one gap — a weak
               -- baseline, but an honest one.
               case when count(*) > 1
                 then extract(epoch from (max(s.at) - min(s.at))) / nullif(count(*) - 1, 0)
               end as avg_gap_seconds
          from spoken s
         group by s.pid
      ),
      expected as (
        -- Floored at 60 days so a flurry of three emails in one week does not
        -- mark somebody stale the following month. Somebody with a single
        -- conversation has no measurable rhythm, so they get the floor.
        select st.pid,
               st.last_at,
               greatest(coalesce(st.avg_gap_seconds, 0), 60 * 86400) as gap_seconds
          from stats st
      )
      select p.id,
             case
               when e.pid is null then 'never_spoken'
               when (p_as_of - e.last_at) > make_interval(secs => e.gap_seconds * 2) then 'quiet'
               when (p_as_of - e.last_at) > make_interval(secs => e.gap_seconds)     then 'slowing'
               else 'in_rhythm'
             end
        from public.person p
        left join expected e on e.pid = p.id
       where p.workspace_id = p_workspace
         and p.deleted_at is null
         and p.merged_into is null
         and p.created_at <= p_as_of;
    return;
  end if;

  -- ── opportunity ───────────────────────────────────────────────────────────
  -- The sales lens, as one axis among five. Bands come from pulse_stage.kind
  -- rather than from stage keys, because the pipeline is a configurable flow
  -- (20260708090000_pulse_stages_flow.sql) and hardcoding 'lead'/'proposal'
  -- here would break the moment a workspace relabels its own stages.
  --
  --   kind committed | won  → committed   money agreed; won is a committed
  --                                       deal that already landed, and with
  --                                       four bands it belongs at the top
  --                                       rather than in a fifth band nobody
  --                                       asked for.
  --   kind open, last open stage → proposal   the step before committing,
  --                                       whatever this workspace calls it.
  --   kind open, earlier        → open
  --   kind lost                 → ignored; the person falls back to their
  --                                       best surviving commitment, or none.
  --
  -- Highest band wins: one person may carry several commitments.
  if p_axis = 'opportunity' then
    return query
      with last_open as (
        -- The furthest-along open stage per workspace — "proposal" in the
        -- default flow, whatever it is called in a custom one.
        select s.workspace_id, max(s.sort_order) as sort_order
          from public.pulse_stage s
         where s.kind = 'open'
         group by s.workspace_id
      ),
      ranked as (
        select c.person_id as pid,
               max(
                 case
                   when s.kind in ('committed', 'won') then 3
                   when s.kind = 'open' and s.sort_order = lo.sort_order then 2
                   when s.kind = 'open' then 1
                   else 0
                 end
               ) as r
          from public.pulse_commitment c
          join public.pulse_stage s
            on s.workspace_id = c.workspace_id and s.key = c.stage
          left join last_open lo on lo.workspace_id = c.workspace_id
         where c.workspace_id = p_workspace
           and c.person_id is not null
           and c.deleted_at is null
           -- Existence time-travels; the stage itself does not (header).
           and c.created_at <= p_as_of
         group by c.person_id
      )
      select p.id,
             case coalesce(rk.r, 0)
               when 3 then 'committed'
               when 2 then 'proposal'
               when 1 then 'open'
               else 'none'
             end
        from public.person p
        left join ranked rk on rk.pid = p.id
       where p.workspace_id = p_workspace
         and p.deleted_at is null
         and p.merged_into is null
         and p.created_at <= p_as_of;
    return;
  end if;

  -- ── contribution ──────────────────────────────────────────────────────────
  -- Who multiplies. In a community the people who bring others are worth more
  -- than the people who spend most, and no CRM shows this
  -- (docs/connections-model.md §3.3).
  --
  -- Two sources, because the introduction fact is stored twice in this schema:
  --   relationship            typed person-to-person edges, dated. The type
  --                           names are read literally: `introduced_by` means
  --                           FROM was introduced by TO, so the introducer is
  --                           to_person_id; `referred` means FROM referred TO,
  --                           so the introducer is from_person_id. Nothing
  --                           writes these edges yet, so this reading is the
  --                           contract as much as it is an observation.
  --   person_relationship_context.introduced_by
  --                           the live single field, edited on the web
  --                           relationship tab. It carries no date of its own
  --                           — the row has one updated_at for every field —
  --                           so it counts at every cutoff. Truthful: we do
  --                           not know when it was recorded, so we cannot
  --                           claim it was recorded since.
  --
  -- Counted as DISTINCT people introduced, so the same introduction recorded
  -- in both places is one.
  if p_axis = 'contribution' then
    return query
      with people as (
        select p.id
          from public.person p
         where p.workspace_id = p_workspace
           and p.deleted_at is null
           and p.merged_into is null
           and p.created_at <= p_as_of
      ),
      brought as (
        select r.to_person_id as introducer, r.from_person_id as introduced
          from public.relationship r
          join people a on a.id = r.to_person_id
          join people b on b.id = r.from_person_id
         where r.workspace_id = p_workspace
           and r.type = 'introduced_by'
           and r.created_at <= p_as_of
        union
        select r.from_person_id, r.to_person_id
          from public.relationship r
          join people a on a.id = r.from_person_id
          join people b on b.id = r.to_person_id
         where r.workspace_id = p_workspace
           and r.type = 'referred'
           and r.created_at <= p_as_of
        union
        select rc.introduced_by, rc.person_id
          from public.person_relationship_context rc
          join people a on a.id = rc.introduced_by
          join people b on b.id = rc.person_id
         where rc.introduced_by is not null
      ),
      tally as (
        select b.introducer as pid, count(distinct b.introduced) as n
          from brought b
         group by b.introducer
      )
      select pe.id,
             case
               when coalesce(t.n, 0) >= 2 then 'brings_regularly'
               when coalesce(t.n, 0) = 1  then 'brought_someone'
               else 'brought_nobody'
             end
        from people pe
        left join tally t on t.pid = pe.id;
    return;
  end if;

  raise exception 'unknown axis %', p_axis
    using hint = 'one of: maturity, closeness, cadence, opportunity, contribution';
end;
$$;

comment on function public.connections_landscape_axis(uuid, text, timestamptz) is
  'The same population re-segmented by a chosen axis, in one shape: (person_id, band). docs/connections-mobile.md §2, D32. maturity delegates to connections_landscape. p_as_of is honoured fully by maturity, cadence and contribution; closeness and opportunity read current-state columns with no history and return today''s value at every cutoff — deliberately, rather than inventing one.';

grant execute on function public.connections_landscape_axis(uuid, text, timestamptz)
  to authenticated, service_role;
