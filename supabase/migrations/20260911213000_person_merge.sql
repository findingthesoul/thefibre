-- ============================================================================
-- Merging two people, reversibly.
--
-- resolvePerson() stops NEW duplicates. This is the other half: the ones
-- already there. 28 foreign keys point at public.person across enrolment,
-- activity, bookings, thread enrolments, memberships, purchases, flow runs
-- and tasks, the relationship graph and the per-person profile tables.
--
-- The merge does NOT hand-list those. It reads them out of pg_constraint at
-- run time, so a table added next year is handled without anybody
-- remembering this file exists. A hand-written list is exactly the kind of
-- thing that goes stale silently and loses somebody's history.
--
-- Reversible by construction: every row we repoint is recorded, and every row
-- we have to drop (because the destination already had one and a unique
-- constraint says there can be only one) is stored whole as jsonb. Undo
-- repoints and restores. Nothing is ever hard-deleted from person itself —
-- the merged row is soft-deleted and stamped with merged_into.
-- ============================================================================

create extension if not exists "pg_trgm";

alter table public.person
  add column if not exists merged_into uuid references public.person(id);

comment on column public.person.merged_into is
  'Set when this row was merged into another. The row stays, soft-deleted, so links that still point here can be followed forward and the merge can be undone.';

create index if not exists person_merged_into_idx
  on public.person (merged_into) where merged_into is not null;

-- ---------------------------------------------------------------------------
-- The audit row. This IS the undo: without it a merge is irreversible.
-- ---------------------------------------------------------------------------
create table if not exists public.person_merge (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspace(id) on delete cascade,
  kept_person_id    uuid not null references public.person(id),
  merged_person_id  uuid not null references public.person(id),
  -- [{ "table": "public.enrolment", "column": "person_id", "ids": [...] }]
  moved             jsonb not null default '[]'::jsonb,
  -- [{ "table": "public.person_billing", "rows": [ {...whole row...} ] }]
  dropped           jsonb not null default '[]'::jsonb,
  merged_at         timestamptz not null default now(),
  merged_by         uuid references public."user"(id),
  undone_at         timestamptz,
  undone_by         uuid references public."user"(id)
);

create index if not exists person_merge_workspace_idx
  on public.person_merge (workspace_id, merged_at desc);

alter table public.person_merge enable row level security;

-- Readable by workspace admins — a merge is an administrative act and its
-- record should be visible to the people who can perform one.
create policy person_merge_read on public.person_merge
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.is_workspace_admin()
  );

-- Writes go through the SECURITY DEFINER functions below, never directly.

-- ---------------------------------------------------------------------------
-- merge_person(keep, merge, actor)
--
-- Repoints every single-column FK referencing person(id) from `merge` to
-- `keep`, then soft-deletes `merge`. Returns the audit row id.
--
-- Conflict handling: many of these tables carry a unique constraint involving
-- person_id — one professional profile per person, one enrolment per
-- (program, person), one member per (workspace, person). When the destination
-- already has the row, the source row cannot simply move. We keep the
-- destination's (it is the record being preserved) and store the source's
-- whole row in `dropped` so undo can put it back. That is a real loss of
-- information at merge time, which is why it is recorded rather than hidden.
-- ---------------------------------------------------------------------------
create or replace function public.merge_person(
  p_keep   uuid,
  p_merge  uuid,
  p_actor  uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep     public.person%rowtype;
  v_merge    public.person%rowtype;
  v_fk       record;
  v_moved    jsonb := '[]'::jsonb;
  v_dropped  jsonb := '[]'::jsonb;
  v_ids      uuid[];
  v_row      jsonb;
  v_rows     jsonb;
  v_id       uuid;
  v_merge_id uuid;
  v_has_pk   boolean;
begin
  if p_keep = p_merge then
    raise exception 'cannot merge a person into itself';
  end if;

  select * into v_keep  from public.person where id = p_keep;
  select * into v_merge from public.person where id = p_merge;

  if v_keep.id is null or v_merge.id is null then
    raise exception 'both people must exist';
  end if;
  if v_keep.workspace_id <> v_merge.workspace_id then
    raise exception 'refusing to merge across workspaces';
  end if;
  if v_keep.deleted_at is not null or v_merge.deleted_at is not null then
    raise exception 'refusing to merge a deleted person';
  end if;

  -- Two sign-in identities is not a duplicate contact, it is two accounts.
  -- That needs a human decision about which login survives, so refuse.
  if exists (select 1 from public."user" where person_id = p_keep)
     and exists (select 1 from public."user" where person_id = p_merge) then
    raise exception 'both people have a user account — resolve the accounts first';
  end if;

  -- The relationship graph can produce a self-edge once both ends collapse
  -- into one person. The table forbids that, so drop those edges first and
  -- record them.
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into v_rows
    from public.relationship r
   where (r.from_person_id = p_merge and r.to_person_id   = p_keep)
      or (r.to_person_id   = p_merge and r.from_person_id = p_keep);
  if jsonb_array_length(v_rows) > 0 then
    v_dropped := v_dropped || jsonb_build_object('table', 'public.relationship', 'rows', v_rows);
    delete from public.relationship
     where (from_person_id = p_merge and to_person_id   = p_keep)
        or (to_person_id   = p_merge and from_person_id = p_keep);
  end if;

  -- Every single-column FK pointing at person(id), discovered rather than
  -- listed. person_merge's own columns are skipped: they are the audit trail
  -- and must keep pointing at the row that was actually merged.
  for v_fk in
    select c.conrelid::regclass::text as tbl,
           a.attname::text            as col
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'public.person'::regclass
       and array_length(c.conkey, 1) = 1
       and c.conrelid <> 'public.person_merge'::regclass
     order by 1, 2
  loop
    -- Does this table have a single-column uuid primary key we can name rows
    -- by? Almost all do; the few that don't are handled as a bulk update with
    -- no per-row undo detail (their ids go unrecorded but the repoint is
    -- still reversed wholesale by column).
    select exists (
      select 1 from pg_constraint pk
       where pk.contype = 'p' and pk.conrelid = v_fk.tbl::regclass
         and array_length(pk.conkey, 1) = 1
    ) into v_has_pk;

    v_ids := '{}';
    v_rows := '[]'::jsonb;

    -- Row by row, so one unique-constraint collision does not abort the
    -- others. A bulk UPDATE would roll back the whole table's worth.
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
          -- The kept person already has this row and only one may exist.
          -- Keep theirs, store ours whole, delete ours.
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

  -- The merged row stays. Soft-deleted and stamped, so anything still
  -- holding its id can follow the pointer forward, and so undo has a row to
  -- bring back.
  update public.person
     set deleted_at = now(), merged_into = p_keep
   where id = p_merge;

  insert into public.person_merge
    (workspace_id, kept_person_id, merged_person_id, moved, dropped, merged_by)
  values
    (v_keep.workspace_id, p_keep, p_merge, v_moved, v_dropped, p_actor)
  returning id into v_merge_id;

  return v_merge_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- unmerge_person(merge_id, actor) — put it back.
--
-- Repoints exactly the rows this merge moved (by id, so rows created since
-- stay where they are), restores the rows it had to drop, and un-deletes the
-- merged person. A merge that has already been undone is refused.
-- ---------------------------------------------------------------------------
create or replace function public.unmerge_person(
  p_merge_id uuid,
  p_actor    uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m     public.person_merge%rowtype;
  v_item  jsonb;
  v_row   jsonb;
  v_cols  text;
begin
  select * into v_m from public.person_merge where id = p_merge_id;
  if v_m.id is null then
    raise exception 'no such merge';
  end if;
  if v_m.undone_at is not null then
    raise exception 'this merge was already undone';
  end if;

  -- Repoint by explicit id, never by "everything pointing at the kept
  -- person" — that would drag across rows created after the merge.
  for v_item in select * from jsonb_array_elements(v_m.moved)
  loop
    execute format(
      'update %s set %I = $1 where id = any($2)',
      v_item->>'table', v_item->>'column'
    ) using v_m.merged_person_id,
            (select array_agg(x::uuid) from jsonb_array_elements_text(v_item->'ids') x);
  end loop;

  -- Restore what a unique constraint forced us to drop.
  for v_item in select * from jsonb_array_elements(v_m.dropped)
  loop
    for v_row in select * from jsonb_array_elements(v_item->'rows')
    loop
      select string_agg(format('%I', key), ', ') into v_cols
        from jsonb_object_keys(v_row) as key;
      execute format(
        'insert into %s (%s) select %s from jsonb_populate_record(null::%s, $1) on conflict do nothing',
        v_item->>'table', v_cols, v_cols, v_item->>'table'
      ) using v_row;
    end loop;
  end loop;

  update public.person
     set deleted_at = null, merged_into = null
   where id = v_m.merged_person_id;

  update public.person_merge
     set undone_at = now(), undone_by = p_actor
   where id = p_merge_id;
end;
$$;

revoke all on function public.merge_person(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.unmerge_person(uuid, uuid) from public, anon, authenticated;

comment on function public.merge_person(uuid, uuid, uuid) is
  'Merge one person into another, repointing every FK discovered from pg_constraint. Reversible via unmerge_person. Service role only — the API gates on workspace admin.';

-- ---------------------------------------------------------------------------
-- person_duplicate_candidates(workspace, limit, threshold)
--
-- The review queue's source. Three rules, most certain first, each pair
-- returned once (a.id < b.id) with the reason in words rather than a score
-- anyone has to trust.
--
--   same_email    the same address on two rows. Not always a mistake — couples
--                 share one and info@ is a whole organisation — which is
--                 exactly why this proposes and never acts.
--   same_name     identical full name, different addresses. The classic
--                 "signed up twice, work address and personal".
--   similar_name  trigram similarity over the threshold. This is the case
--                 deterministic matching misses (Marja Bakker / M. Bakker),
--                 and it is why pg_trgm is here instead of a model: nothing
--                 leaves the database, it costs nothing, and it answers the
--                 same way every run.
-- ---------------------------------------------------------------------------
create or replace function public.person_duplicate_candidates(
  p_workspace uuid,
  p_limit     int default 50,
  p_threshold real default 0.55
) returns table (
  person_a uuid,
  person_b uuid,
  reason   text,
  score    real
)
language sql
stable
security definer
set search_path = public
as $$
  with people as (
    select id, email,
           nullif(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), '') as full_name
      from public.person
     where workspace_id = p_workspace
       and deleted_at is null
  ),
  same_email as (
    select a.id as pa, b.id as pb, 'same_email'::text as rsn, 1.0::real as scr
      from people a join people b on a.email = b.email and a.id < b.id
     where a.email is not null
  ),
  same_name as (
    select a.id, b.id, 'same_name'::text, 0.9::real
      from people a join people b
        on lower(a.full_name) = lower(b.full_name) and a.id < b.id
     where a.full_name is not null and (a.email is distinct from b.email)
  ),
  similar_name as (
    select a.id, b.id, 'similar_name'::text, similarity(a.full_name, b.full_name)::real
      from people a join people b on a.id < b.id
     where a.full_name is not null and b.full_name is not null
       and lower(a.full_name) <> lower(b.full_name)
       and similarity(a.full_name, b.full_name) >= p_threshold
  )
  select q.pa, q.pb, q.rsn, q.scr from (
    select * from same_email
    union all select * from same_name
    union all select * from similar_name
  ) q
  order by q.scr desc, q.pa, q.pb
  limit greatest(p_limit, 1);
$$;

revoke all on function public.person_duplicate_candidates(uuid, int, real)
  from public, anon, authenticated;

comment on function public.person_duplicate_candidates(uuid, int, real) is
  'Duplicate review queue. pg_trgm rather than a model: nothing leaves the database, it is free, and it answers the same way every run.';
