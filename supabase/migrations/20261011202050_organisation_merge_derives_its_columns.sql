-- Organisation merge: derive the columns, and make undo able to reverse it.
--
-- `merge_organisation` carried a hand-written list of EIGHT columns from the
-- merged row into the kept row's blanks: domain, website, legal_name,
-- vat_number, registration_number, city, country, logo_url. Correct for the
-- columns that existed when it was written, and silently wrong for every one
-- added since.
--
-- Measured against the live schema on 2026-10-11: `organisation` has 28
-- columns, and THIRTEEN of them are content the merge drops on the floor —
-- street, postal_code, region, linkedin_url, short_name, other_names, sector,
-- industry, org_type, size_band, operating_countries, name, search_names. So
-- merging two records of one company loses the address, the LinkedIn page,
-- the abbreviation, the former names and the classification, with nothing
-- said. Person merge stopped working this way on 2026-09-25 for exactly this
-- reason (20260925095318, correction #2); organisations never caught up.
--
-- THE FILL IS ONLY HALF OF IT, and the other half is why this migration is
-- not three lines. `merge_organisation` records what it MOVED and what it
-- DROPPED, and `unmerge_organisation` restores both — but it records nothing
-- about what it FILLED, so an undo leaves those values on the kept row for
-- good. Widening the fill from 8 columns to 17 without fixing that would make
-- the undo lossier in exact proportion to the improvement, which is a worse
-- bug than the one being fixed. So the audit grows a `filled` column and undo
-- learns to reverse it.
--
-- And it reverses it the careful way person merge settled on: only where the
-- column is STILL the value the merge wrote. Merge fills a blank street; an
-- admin corrects that street by hand; somebody undoes the merge — the
-- correction survives. An undo is meant to reverse the merge, not the
-- afternoon's work.

-- ---------------------------------------------------------------------------
-- What may be filled, as a question the catalogue answers.
--
-- The rule is what a fillable column IS, not which ones anybody remembered:
-- text-ish, array and jsonb content; never a boolean, timestamp or uuid;
-- never a name ending _at / _by / _id / _hash / _token; never anything under
-- a unique constraint, because moving an identifier is a collision or an
-- impersonation. Same rule as `person_fillable_columns()`, one table over.
--
-- The named exclusions are short and each has a reason:
--   id, workspace_id, merged_into  identity and tenancy, never content.
--   search_names                   maintained by a TRIGGER
--                                  (organisation_search_names_sync, see
--                                  20260914191000) from name/short_name/
--                                  other_names. Writing it is a no-op the
--                                  trigger immediately overwrites, so listing
--                                  it as fillable would be a lie in a
--                                  comment, not a bug in behaviour.
create or replace function public.organisation_fillable_columns()
returns table (name text)
language sql
stable
set search_path = public
as $$
  select a.attname::text
    from pg_attribute a
    join pg_type t on t.oid = a.atttypid
   where a.attrelid = 'public.organisation'::regclass
     and a.attnum > 0
     and not a.attisdropped
     -- content, not identity or state: text, arrays of text, jsonb
     and (t.typname in ('text', 'varchar', 'bpchar', 'citext', 'jsonb', 'json')
          or (t.typcategory = 'A' and t.typname in ('_text', '_varchar', '_citext')))
     -- a name that announces itself as a reference, a time or a secret
     and a.attname !~ '_(at|by|id|hash|token)$'
     and a.attname not in ('id', 'workspace_id', 'merged_into', 'search_names')
     -- a generated column cannot be written at all
     and a.attgenerated = ''
     -- identifiers: moving one is a collision or an impersonation
     and not exists (
       select 1 from pg_constraint c
        where c.conrelid = a.attrelid and c.contype in ('p', 'u')
          and a.attnum = any (c.conkey)
     )
     and not exists (
       select 1 from pg_index i
        where i.indrelid = a.attrelid and i.indisunique
          and a.attnum = any (i.indkey)
     )
   order by a.attnum
$$;

comment on function public.organisation_fillable_columns() is
  'The columns an organisation-merge may carry from the merged record into a blank on the kept one. Derived from the catalogue, never a list. See 20261011202050.';

-- ---------------------------------------------------------------------------
-- The audit gains what was filled, so undo can reverse it. `{}` for every
-- merge made before this migration: those fills are not recoverable, and
-- claiming otherwise would be worse than admitting it.
alter table public.organisation_merge
  add column if not exists filled jsonb not null default '{}'::jsonb;

comment on column public.organisation_merge.filled is
  'Per column: {before, after}. Undo restores `before` only where the value is still `after`, so a correction made since the merge survives. Empty for merges made before 20261011202050.';

-- ---------------------------------------------------------------------------
-- Fill the kept row's blanks from the merged row, and say what was done.
create or replace function public.organisation_merge_fill_blanks(
  p_keep  uuid,
  p_merge uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col    record;
  v_before jsonb := '{}'::jsonb;
  v_keepv  jsonb;
  v_losev  jsonb;
  v_keep   jsonb;
  v_lose   jsonb;
begin
  select to_jsonb(o) into v_keep from public.organisation o where id = p_keep;
  select to_jsonb(o) into v_lose from public.organisation o where id = p_merge;
  if v_keep is null or v_lose is null then
    return v_before;
  end if;

  for v_col in select name from public.organisation_fillable_columns()
  loop
    v_keepv := v_keep -> v_col.name;
    v_losev := v_lose -> v_col.name;

    -- blank: null, empty/whitespace text, empty array, or an empty object
    continue when not public.jsonb_is_blank(v_keepv);
    continue when public.jsonb_is_blank(v_losev);

    execute format(
      'update public.organisation set %I = (jsonb_populate_record(null::public.organisation, $1)).%I where id = $2',
      v_col.name, v_col.name
    ) using jsonb_build_object(v_col.name, v_losev), p_keep;

    -- Both halves: what it was, and what we made it. Undo needs the second to
    -- know whether anybody has touched it since.
    v_before := v_before || jsonb_build_object(
      v_col.name, jsonb_build_object('before', v_keepv, 'after', v_losev)
    );
  end loop;

  return v_before;
end;
$$;

comment on function public.organisation_merge_fill_blanks(uuid, uuid) is
  'Carries content from the merged organisation into the kept one''s blanks. Never overwrites an answer. Returns {column: {before, after}} for the audit. See 20261011202050.';

-- ---------------------------------------------------------------------------
-- merge_organisation: same body as 20260923171115, with the eight-column
-- update replaced by the derived fill and its result stored.
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
  v_filled   jsonb := '{}'::jsonb;
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

  -- Facts the kept row is missing and the merged row has. Never overwrite
  -- something already answered — the person chose which row to keep, and this
  -- fills gaps rather than deciding between two answers.
  --
  -- WHICH columns is no longer written down here. It is derived from the
  -- catalogue, so a column added to `organisation` next year is carried or
  -- excluded by what it IS, and an integration test makes a new one a red
  -- build rather than a silent omission.
  v_filled := public.organisation_merge_fill_blanks(p_keep, p_merge);

  update public.organisation
     set deleted_at = now(), merged_into = p_keep
   where id = p_merge;

  insert into public.organisation_merge
    (workspace_id, kept_org_id, merged_org_id, moved, dropped, filled, merged_by)
  values
    (v_keep.workspace_id, p_keep, p_merge, v_moved, v_dropped, v_filled, p_actor)
  returning id into v_merge_id;

  return v_merge_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- unmerge_organisation: same body as 20260923170833, plus the filled columns.
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
  v_col   text;
  v_now   jsonb;
  v_keep  jsonb;
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

  -- The filled blanks, put back ONLY where nobody has touched them since.
  --
  -- The merge recorded {before, after} per column. If the column still holds
  -- `after`, the merge is the last thing that wrote it and `before` is the
  -- right answer. If it holds anything else, a human has been there, and an
  -- undo is meant to reverse the merge rather than the afternoon's work.
  -- Empty for merges made before 20261011202050, which simply restore nothing.
  if v_m.filled is not null and v_m.filled <> '{}'::jsonb then
    select to_jsonb(o) into v_keep from public.organisation o where id = v_m.kept_org_id;
    if v_keep is not null then
      for v_col in select jsonb_object_keys(v_m.filled) loop
        v_now := v_keep -> v_col;
        continue when v_now is distinct from (v_m.filled -> v_col -> 'after');
        execute format(
          'update public.organisation set %I = (jsonb_populate_record(null::public.organisation, $1)).%I where id = $2',
          v_col, v_col
        ) using jsonb_build_object(v_col, v_m.filled -> v_col -> 'before'), v_m.kept_org_id;
      end loop;
    end if;
  end if;

  update public.organisation
     set deleted_at = null, merged_into = null
   where id = v_m.merged_org_id;

  update public.organisation_merge
     set undone_at = now(), undone_by = p_actor
   where id = p_merge_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Born closed. `revoke ... from public` alone leaves Supabase's separate
-- grants to anon and authenticated in place (handbook §11.3b), which is how
-- every definer function written before 2026-09-14 ended up reachable.
revoke all on function public.organisation_fillable_columns()             from public, anon, authenticated;
revoke all on function public.organisation_merge_fill_blanks(uuid, uuid)  from public, anon, authenticated;
revoke all on function public.merge_organisation(uuid, uuid, uuid)        from public, anon, authenticated;
revoke all on function public.unmerge_organisation(uuid, uuid)            from public, anon, authenticated;

grant execute on function public.organisation_fillable_columns()            to service_role;
grant execute on function public.organisation_merge_fill_blanks(uuid, uuid) to service_role;
