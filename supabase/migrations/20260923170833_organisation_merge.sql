-- ============================================================================
-- Merging two organisations, reversibly.
--
-- Sjoerd, 2026-09-23: *"I see two companies that are double. I want to merge
-- them."* People have had this since 2026-09-11 (merge_person); organisations
-- never did, so a duplicate company could only be left alone.
--
-- This is the person merge applied to organisations, and deliberately so —
-- the hard parts were solved there and re-deciding them would produce a
-- second, drifting answer. In particular it does NOT hand-list the foreign
-- keys pointing at organisation: it reads them from pg_constraint at run
-- time, so a table added next year is handled without anybody remembering
-- this file exists.
--
-- Two things are organisation-specific and are why this is not a copy:
--
--   parent_org_id   organisations nest. Merging a child into its parent (or
--                   the reverse) would leave a row that is its own parent,
--                   which is a cycle the tree walkers would not survive.
--                   Cleared before the generic walk and recorded, so undo
--                   restores it.
--   org_relationship  an edge between two organisations. Collapsing both ends
--                   into one makes a self-edge; same treatment as
--                   public.relationship in the person merge.
--
-- Reversible by construction: every repointed row is recorded, every row that
-- had to be dropped (because a unique constraint says the destination may
-- have only one) is stored whole as jsonb. Nothing is ever hard-deleted from
-- organisation itself — the merged row is soft-deleted and stamped.
-- ============================================================================

create extension if not exists "pg_trgm";

alter table public.organisation
  add column if not exists merged_into uuid references public.organisation(id);

comment on column public.organisation.merged_into is
  'Set when this row was merged into another. The row stays, soft-deleted, so links that still point here can be followed forward and the merge can be undone.';

create index if not exists organisation_merged_into_idx
  on public.organisation (merged_into) where merged_into is not null;

-- ---------------------------------------------------------------------------
-- The audit row. This IS the undo.
-- ---------------------------------------------------------------------------
create table if not exists public.organisation_merge (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspace(id) on delete cascade,
  kept_org_id       uuid not null references public.organisation(id),
  merged_org_id     uuid not null references public.organisation(id),
  moved             jsonb not null default '[]'::jsonb,
  dropped           jsonb not null default '[]'::jsonb,
  merged_at         timestamptz not null default now(),
  merged_by         uuid references public."user"(id),
  undone_at         timestamptz,
  undone_by         uuid references public."user"(id)
);

create index if not exists organisation_merge_workspace_idx
  on public.organisation_merge (workspace_id, merged_at desc);

alter table public.organisation_merge enable row level security;

-- Readable by workspace admins: a merge is an administrative act and its
-- record belongs to the people who may perform one.
create policy organisation_merge_read on public.organisation_merge
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.is_workspace_admin()
  );

-- ---------------------------------------------------------------------------
-- The merge itself.
-- ---------------------------------------------------------------------------
create or replace function public.merge_organisation(
  p_keep   uuid,
  p_merge  uuid,
  p_actor  uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep     public.organisation%rowtype;
  v_merge    public.organisation%rowtype;
  v_fk       record;
  v_moved    jsonb := '[]'::jsonb;
  v_dropped  jsonb := '[]'::jsonb;
  v_ids      uuid[];
  v_row      jsonb;
  v_rows     jsonb;
  v_merge_id uuid;
  v_has_pk   boolean;
begin
  if p_keep = p_merge then
    raise exception 'cannot merge an organisation into itself';
  end if;

  select * into v_keep  from public.organisation where id = p_keep;
  select * into v_merge from public.organisation where id = p_merge;

  if v_keep.id is null or v_merge.id is null then
    raise exception 'both organisations must exist';
  end if;
  if v_keep.workspace_id <> v_merge.workspace_id then
    raise exception 'refusing to merge across workspaces';
  end if;
  if v_keep.deleted_at is not null or v_merge.deleted_at is not null then
    raise exception 'refusing to merge a deleted organisation';
  end if;

  -- A workspace's OWN organisation is not a duplicate to be absorbed: it is
  -- the row workspace.organisation_id points at, and merging it away would
  -- leave the workspace without a company. Keeping it is fine; merging it
  -- into something else is not.
  if exists (select 1 from public.workspace where organisation_id = p_merge) then
    raise exception 'that organisation is a workspace''s own — merge the other one into it instead';
  end if;

  -- parent_org_id: clear the link that would make the kept row its own
  -- parent, before the generic walk repoints anything.
  if v_merge.parent_org_id = p_keep or v_keep.parent_org_id = p_merge then
    v_dropped := v_dropped || jsonb_build_object(
      'table', 'public.organisation.parent_org_id',
      'rows', jsonb_build_array(jsonb_build_object(
        'id', p_keep, 'parent_org_id', v_keep.parent_org_id
      ))
    );
    update public.organisation set parent_org_id = null
     where id = p_keep and parent_org_id = p_merge;
    update public.organisation set parent_org_id = null
     where id = p_merge and parent_org_id = p_keep;
  end if;

  -- An edge between the two would become a self-edge.
  if to_regclass('public.org_relationship') is not null then
    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into v_rows
      from public.org_relationship r
     where (r.from_org_id = p_merge and r.to_org_id   = p_keep)
        or (r.to_org_id   = p_merge and r.from_org_id = p_keep);
    if jsonb_array_length(v_rows) > 0 then
      v_dropped := v_dropped || jsonb_build_object('table', 'public.org_relationship', 'rows', v_rows);
      delete from public.org_relationship
       where (from_org_id = p_merge and to_org_id   = p_keep)
          or (to_org_id   = p_merge and from_org_id = p_keep);
    end if;
  end if;

  for v_fk in
    select c.conrelid::regclass::text as tbl,
           a.attname::text            as col
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'public.organisation'::regclass
       and array_length(c.conkey, 1) = 1
       and c.conrelid <> 'public.organisation_merge'::regclass
       -- Append-only, exactly as for people: reads resolve forward instead.
       and c.conrelid <> 'public.activity'::regclass
     order by 1, 2
  loop
    select exists (
      select 1 from pg_constraint pk
       where pk.contype = 'p' and pk.conrelid = v_fk.tbl::regclass
         and array_length(pk.conkey, 1) = 1
    ) into v_has_pk;

    v_ids := '{}';
    v_rows := '[]'::jsonb;

    for v_row in
      execute format('select to_jsonb(t) from %s t where t.%I = $1', v_fk.tbl, v_fk.col)
      using p_merge
    loop
      begin
        if v_has_pk then
          execute format(
            'update %s set %I = $1 where %I = $2 and id = $3',
            v_fk.tbl, v_fk.col, v_fk.col
          ) using p_keep, p_merge, (v_row->>'id')::uuid;
          v_ids := v_ids || ((v_row->>'id')::uuid);
        else
          execute format('update %s set %I = $1 where %I = $2', v_fk.tbl, v_fk.col, v_fk.col)
            using p_keep, p_merge;
        end if;
      exception
        when unique_violation or check_violation then
          -- The destination already has one and there may be only one: the
          -- duplicate is recorded whole so undo can put it back.
          v_rows := v_rows || v_row;
          if v_has_pk then
            execute format('delete from %s where id = $1', v_fk.tbl)
              using (v_row->>'id')::uuid;
          end if;
      end;
    end loop;

    if array_length(v_ids, 1) > 0 then
      v_moved := v_moved || jsonb_build_object(
        'table', v_fk.tbl, 'column', v_fk.col, 'ids', to_jsonb(v_ids)
      );
    end if;
    if jsonb_array_length(v_rows) > 0 then
      v_dropped := v_dropped || jsonb_build_object('table', v_fk.tbl, 'rows', v_rows);
    end if;
  end loop;

  -- Facts the kept row is missing and the merged row has: a domain, a city, a
  -- registration number. Never overwrite something already answered — the
  -- person chose which row to keep, and this fills gaps rather than deciding
  -- between two answers.
  update public.organisation k
     set domain              = coalesce(k.domain, v_merge.domain),
         website             = coalesce(k.website, v_merge.website),
         legal_name          = coalesce(k.legal_name, v_merge.legal_name),
         vat_number          = coalesce(k.vat_number, v_merge.vat_number),
         registration_number = coalesce(k.registration_number, v_merge.registration_number),
         city                = coalesce(k.city, v_merge.city),
         country             = coalesce(k.country, v_merge.country),
         logo_url            = coalesce(k.logo_url, v_merge.logo_url)
   where k.id = p_keep;

  update public.organisation
     set deleted_at = now(), merged_into = p_keep
   where id = p_merge;

  insert into public.organisation_merge
    (workspace_id, kept_org_id, merged_org_id, moved, dropped, merged_by)
  values
    (v_keep.workspace_id, p_keep, p_merge, v_moved, v_dropped, p_actor)
  returning id into v_merge_id;

  return v_merge_id;
end;
$$;

revoke all on function public.merge_organisation(uuid, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Undo. Repoints what was moved, restores what was dropped.
-- ---------------------------------------------------------------------------
create or replace function public.unmerge_organisation(
  p_merge_id uuid,
  p_actor    uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m     public.organisation_merge%rowtype;
  v_entry jsonb;
  v_row   jsonb;
  v_cols  text;
  v_vals  text;
begin
  select * into v_m from public.organisation_merge where id = p_merge_id;
  if v_m.id is null then
    raise exception 'no such merge';
  end if;
  if v_m.undone_at is not null then
    raise exception 'that merge has already been undone';
  end if;

  for v_entry in select * from jsonb_array_elements(v_m.moved) loop
    execute format(
      'update %s set %I = $1 where id = any($2)',
      v_entry->>'table', v_entry->>'column'
    ) using v_m.merged_org_id,
            (select array_agg((x)::uuid) from jsonb_array_elements_text(v_entry->'ids') x);
  end loop;

  for v_entry in select * from jsonb_array_elements(v_m.dropped) loop
    -- The parent link is a column on organisation, not a table of rows.
    if v_entry->>'table' = 'public.organisation.parent_org_id' then
      for v_row in select * from jsonb_array_elements(v_entry->'rows') loop
        update public.organisation
           set parent_org_id = (v_row->>'parent_org_id')::uuid
         where id = (v_row->>'id')::uuid;
      end loop;
      continue;
    end if;
    for v_row in select * from jsonb_array_elements(v_entry->'rows') loop
      select string_agg(quote_ident(k), ', '), string_agg(format('%L', v), ', ')
        into v_cols, v_vals
        from jsonb_each_text(v_row);
      execute format('insert into %s (%s) values (%s) on conflict do nothing',
                     v_entry->>'table', v_cols, v_vals);
    end loop;
  end loop;

  update public.organisation
     set deleted_at = null, merged_into = null
   where id = v_m.merged_org_id;

  update public.organisation_merge
     set undone_at = now(), undone_by = p_actor
   where id = p_merge_id;
end;
$$;

revoke all on function public.unmerge_organisation(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The review queue. Proposes; never acts.
--
-- The signal that matters for organisations is the DOMAIN, not the name — it
-- is to a company what an email address is to a person. Sjoerd's own pair
-- proves it: "De Werkhaven" and "De Werkhaven Schouwen-Duiveland coöperatie
-- U.A." share dewerkhaven.nl (one capitalised, one not) and are far too
-- different by name for name-matching to find. A first pass that compared
-- folded names reported ZERO duplicates in his workspace while he was looking
-- at two on screen.
--
-- Three signals, strongest first:
--   domain    same host, case- and www-insensitive. Near-certain.
--   name      trigram similarity on the name with legal suffixes removed,
--             so "X B.V." and "X coöperatie U.A." can still meet.
--   contains  one name contains the other as a whole word — the "De
--             Werkhaven" / "De Werkhaven Schouwen-Duiveland" shape.
-- ---------------------------------------------------------------------------
create or replace function public.organisation_fold(p_name text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(
    regexp_replace(
      lower(coalesce(p_name, '')),
      '\y(b\.?v\.?|n\.?v\.?|u\.?a\.?|c\.?v\.?|ltd|limited|inc|llc|gmbh|sarl|coöperatie|cooperatie|coop|stichting|foundation|vereniging|association)\y',
      ' ', 'g'),
    '[^a-z0-9]+', ' ', 'g'));
$$;

-- The other answer: these are genuinely different companies with similar
-- names. Recorded so the pair never comes back.
create table if not exists public.organisation_distinct (
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  a_id         uuid not null references public.organisation(id) on delete cascade,
  b_id         uuid not null references public.organisation(id) on delete cascade,
  decided_at   timestamptz not null default now(),
  decided_by   uuid references public."user"(id),
  primary key (workspace_id, a_id, b_id),
  constraint organisation_distinct_ordered check (a_id < b_id)
);

alter table public.organisation_distinct enable row level security;

create policy organisation_distinct_read on public.organisation_distinct
  for select to authenticated
  using (workspace_id = public.current_workspace_id());

create or replace function public.organisation_duplicate_candidates(
  p_workspace uuid,
  p_limit     int default 50
) returns table (
  a_id uuid, a_name text, a_domain text, a_people bigint,
  b_id uuid, b_name text, b_domain text, b_people bigint,
  reason text, score real
)
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select o.id, o.name, o.domain,
           lower(regexp_replace(coalesce(o.domain, ''), '^www\.', '')) as host,
           public.organisation_fold(o.name) as folded
      from public.organisation o
     where o.workspace_id = p_workspace
       and o.deleted_at is null
       and o.merged_into is null
  ),
  pairs as (
    select a.id a_id, a.name a_name, a.domain a_domain,
           b.id b_id, b.name b_name, b.domain b_domain,
           case
             when a.host <> '' and a.host = b.host then 'same domain'
             when a.folded <> '' and a.folded = b.folded then 'same name'
             when a.folded <> '' and b.folded <> ''
              and (a.folded like b.folded || ' %' or b.folded like a.folded || ' %')
               then 'one name contains the other'
             else 'similar name'
           end as reason,
           case
             when a.host <> '' and a.host = b.host then 1.0
             when a.folded <> '' and a.folded = b.folded then 0.95
             when a.folded <> '' and b.folded <> ''
              and (a.folded like b.folded || ' %' or b.folded like a.folded || ' %')
               then 0.9
             else similarity(a.folded, b.folded)
           end::real as score
      from live a
      join live b on b.id > a.id
     where (a.host <> '' and a.host = b.host)
        or (a.folded <> '' and a.folded = b.folded)
        or (a.folded <> '' and b.folded <> ''
            and (a.folded like b.folded || ' %' or b.folded like a.folded || ' %'))
        or similarity(a.folded, b.folded) > 0.55
  ),
  -- "No, these are different companies" is an answer, and it has to stick.
  not_dismissed as (
    select p.* from pairs p
     where not exists (
       select 1 from public.organisation_distinct d
        where d.workspace_id = p_workspace
          and d.a_id = least(p.a_id, p.b_id)
          and d.b_id = greatest(p.a_id, p.b_id)
     )
  )
  select n.a_id, n.a_name, n.a_domain,
         (select count(*) from public.org_membership m where m.org_id = n.a_id),
         n.b_id, n.b_name, n.b_domain,
         (select count(*) from public.org_membership m where m.org_id = n.b_id),
         n.reason, n.score
    from not_dismissed n
   order by n.score desc, n.a_name
   limit p_limit;
$$;


revoke all on function public.organisation_duplicate_candidates(uuid, int) from public, anon, authenticated;
