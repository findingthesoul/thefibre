-- A merge may not assume a child table's key is called `id`.
--
-- FOUND ON PRODUCTION, 2026-10-12. Sjoerd merged two organisations through
-- Organisations → Possible duplicates with per-field answers and got
-- `column "id" does not exist`. Nothing merged: a plpgsql function that
-- raises takes its whole statement with it, so both rows are still there,
-- undeleted, with no audit row — confirmed before anything was changed.
--
-- The FK loop asked the catalogue whether a child table has a SINGLE-COLUMN
-- primary key, and then wrote the column's NAME itself:
--
--     update %s set %I = $1 where %I = $2 and id = $3
--
-- `public.org_domain_verification` is keyed `org_id uuid primary key
-- references organisation(id)`, and the merged organisation had a row in it —
-- a DNS challenge Sjoerd started on 2026-09-23 for "Dewerkhaven.nl". The
-- staging fixture pair has no such row, which is why the browser pack passed.
--
-- So: the key is read BY NAME, carried into the audit row, and used by the
-- undo — which had the same assumption and could not have reversed such a
-- move either. Both merges are patched, organisation and person: no person
-- child table has a single-column key that is not `id` today, so that half is
-- a trap being disarmed rather than a bug being fixed.
--
-- WHAT HAPPENS when both rows exist and only one can (org_domain_verification
-- keyed by org): the KEEPER'S row stays and the merged row is recorded whole
-- for the undo. That is the generic rule this loop already had for a unique
-- violation, and it is the right one here — the kept record keeps its own
-- answer, and a DNS challenge proves a DOMAIN rather than an organisation, so
-- inheriting somebody else's is not obviously truer. When the keeper has NO
-- row the merged one moves across; if its domain is not the domain the kept
-- organisation ended up with, the screen already treats it as no challenge
-- (`row.domain === org.domain` in routes/organisations.ts), so nothing false
-- is shown and re-verifying is one button.
--
-- STILL OPEN, deliberately, as its own change: a child with a COMPOSITE key
-- takes the bulk branch, and when that update violates a constraint the row
-- is recorded but cannot be deleted — so it stays pointing at the merged
-- organisation. `organisation_distinct` is such a table.

-- --------------------------------------------------------------------------
-- merge_organisation
-- --------------------------------------------------------------------------
create or replace function public.merge_organisation(
  p_keep    uuid,
  p_merge   uuid,
  p_actor   uuid default null,
  -- EDIT 1 of 3 against 20261011202050. Per-column decisions, as
  -- {"street": "merge"}. A side, never a value — see the person equivalent
  -- (20261011210332) for why that distinction is the security line.
  p_choices jsonb default '{}'::jsonb
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
  v_ids      text[];
  v_row      jsonb;
  v_rows     jsonb;
  v_merge_id uuid;
  v_pk_col   text;
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
    -- The key's NAME, not just whether there is one. Asking only
    -- "does it have a single-column primary key" and then writing `id`
    -- is what broke a real merge on production (2026-10-12):
    -- org_domain_verification's key is `org_id`, so the update read
    -- `where org_id = $2 and id = $3` and Postgres answered
    -- `column "id" does not exist`. The whole merge rolled back.
    select a.attname::text into v_pk_col
      from pg_constraint pk
      join pg_attribute a
        on a.attrelid = pk.conrelid and a.attnum = pk.conkey[1]
     where pk.contype = 'p' and pk.conrelid = v_fk.tbl::regclass
       and array_length(pk.conkey, 1) = 1;

    v_ids := '{}';
    v_rows := '[]'::jsonb;

    for v_row in
      execute format('select to_jsonb(t) from %s t where t.%I = $1', v_fk.tbl, v_fk.col)
      using p_merge
    loop
      begin
        if v_pk_col is not null then
          -- The key compared AS TEXT, so this does not assume a uuid
          -- either: a child keyed on a text column works the same way.
          execute format(
            'update %s set %I = $1 where %I = $2 and %I::text = %L',
            v_fk.tbl, v_fk.col, v_fk.col, v_pk_col, v_row->>v_pk_col
          ) using p_keep, p_merge;
          -- WHAT TO RECORD for the undo: the value that identifies the
          -- row AFTER the move. For a table whose key IS the foreign
          -- key (org_domain_verification), the move changes the key, so
          -- recording the old one would leave the undo looking for a row
          -- that no longer answers to it.
          v_ids := v_ids || (
            case when v_pk_col = v_fk.col then p_keep::text
                 else v_row->>v_pk_col end
          );
        else
          execute format('update %s set %I = $1 where %I = $2', v_fk.tbl, v_fk.col, v_fk.col)
            using p_keep, p_merge;
        end if;
      exception
        when unique_violation or check_violation then
          -- The destination already has one and there may be only one: the
          -- duplicate is recorded whole so undo can put it back.
          v_rows := v_rows || v_row;
          if v_pk_col is not null then
            -- The move FAILED, so the row still answers to its original
            -- key; `v_dropped` keeps it whole and the undo re-inserts it.
            execute format(
              'delete from %s where %I::text = %L',
              v_fk.tbl, v_pk_col, v_row->>v_pk_col
            );
          end if;
      end;
    end loop;

    if array_length(v_ids, 1) > 0 then
      -- `key` is new: the undo used to assume `id` as well. An audit row
      -- written before today carries no key and the undo reads `id` for
      -- it, which is what those rows were recorded with.
      v_moved := v_moved || jsonb_build_object(
        'table', v_fk.tbl, 'column', v_fk.col, 'key', v_pk_col,
        'ids', to_jsonb(v_ids)
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
  -- EDIT 2 of 3. The decisions reach the fill directly, because an
  -- organisation merge calls it rather than hanging it on a trigger the way
  -- the person one does.
  v_filled := public.organisation_merge_fill_blanks(p_keep, p_merge, coalesce(p_choices, '{}'::jsonb));

  update public.organisation
     set deleted_at = now(), merged_into = p_keep
   where id = p_merge;

  -- EDIT 3 of 3. The decisions stay on the audit row, so it records what
  -- somebody DECIDED and not only what resulted.
  insert into public.organisation_merge
    (workspace_id, kept_org_id, merged_org_id, moved, dropped, filled, choices, merged_by)
  values
    (v_keep.workspace_id, p_keep, p_merge, v_moved, v_dropped, v_filled,
     coalesce(p_choices, '{}'::jsonb), p_actor)
  returning id into v_merge_id;

  return v_merge_id;
end;
$$;

-- --------------------------------------------------------------------------
-- merge_person — the same shape, before it is somebody's bug
-- --------------------------------------------------------------------------
create or replace function public.merge_person(
  p_keep    uuid,
  p_merge   uuid,
  p_actor   uuid default null,
  -- EDIT 1 of 2 against 20260911220000. Per-column decisions, as
  -- {"phone": "merge", "city": "keep"}. See the header for why a side and
  -- never a value. Defaulted, so a three-argument call behaves exactly as it
  -- did — including the route, until it starts sending them.
  p_choices jsonb default '{}'::jsonb
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
  v_ids      text[];
  v_row      jsonb;
  v_rows     jsonb;
  v_merge_id uuid;
  v_pk_col   text;
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
  if exists (select 1 from public."user" where person_id = p_keep)
     and exists (select 1 from public."user" where person_id = p_merge) then
    raise exception 'both people have a user account — resolve the accounts first';
  end if;

  -- Collapsing both ends of an edge into one person would make a self-edge,
  -- which the table forbids. Drop those first and record them.
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
       -- Append-only. Reads resolve through person_and_merged() instead.
       and c.conrelid <> 'public.activity'::regclass
     order by 1, 2
  loop
    -- The key's NAME, not just whether there is one. Asking only
    -- "does it have a single-column primary key" and then writing `id`
    -- is what broke a real merge on production (2026-10-12):
    -- org_domain_verification's key is `org_id`, so the update read
    -- `where org_id = $2 and id = $3` and Postgres answered
    -- `column "id" does not exist`. The whole merge rolled back.
    select a.attname::text into v_pk_col
      from pg_constraint pk
      join pg_attribute a
        on a.attrelid = pk.conrelid and a.attnum = pk.conkey[1]
     where pk.contype = 'p' and pk.conrelid = v_fk.tbl::regclass
       and array_length(pk.conkey, 1) = 1;

    v_ids := '{}';
    v_rows := '[]'::jsonb;

    for v_row in
      execute format('select to_jsonb(t) from %s t where t.%I = $1', v_fk.tbl, v_fk.col)
      using p_merge
    loop
      begin
        if v_pk_col is not null then
          -- The key compared AS TEXT, so this does not assume a uuid
          -- either: a child keyed on a text column works the same way.
          execute format(
            'update %s set %I = $1 where %I = $2 and %I::text = %L',
            v_fk.tbl, v_fk.col, v_fk.col, v_pk_col, v_row->>v_pk_col
          ) using p_keep, p_merge;
          -- WHAT TO RECORD for the undo: the value that identifies the
          -- row AFTER the move. For a table whose key IS the foreign
          -- key (org_domain_verification), the move changes the key, so
          -- recording the old one would leave the undo looking for a row
          -- that no longer answers to it.
          v_ids := v_ids || (
            case when v_pk_col = v_fk.col then p_keep::text
                 else v_row->>v_pk_col end
          );
        else
          execute format('update %s set %I = $1 where %I = $2', v_fk.tbl, v_fk.col, v_fk.col)
            using p_keep, p_merge;
        end if;
      exception
        when unique_violation or check_violation then
          v_rows := v_rows || v_row;
          if v_pk_col is not null then
            -- The move FAILED, so the row still answers to its original
            -- key; `v_dropped` keeps it whole and the undo re-inserts it.
            execute format(
              'delete from %s where %I::text = %L',
              v_fk.tbl, v_pk_col, v_row->>v_pk_col
            );
          end if;
      end;
    end loop;

    if array_length(v_ids, 1) > 0 then
      -- `key` is new: the undo used to assume `id` as well. An audit row
      -- written before today carries no key and the undo reads `id` for
      -- it, which is what those rows were recorded with.
      v_moved := v_moved || jsonb_build_object(
        'table', v_fk.tbl, 'column', v_fk.col, 'key', v_pk_col,
        'ids', to_jsonb(v_ids)
      );
    end if;
    if jsonb_array_length(v_rows) > 0 then
      v_dropped := v_dropped || jsonb_build_object('table', v_fk.tbl, 'rows', v_rows);
    end if;
  end loop;

  update public.person
     set deleted_at = now(), merged_into = p_keep
   where id = p_merge;

  -- EDIT 2 of 2. The choices ride ON the audit row, which is what lets the
  -- BEFORE INSERT trigger see them without this function needing to know how
  -- the fill works. They also stay there afterwards, so the record says what
  -- somebody DECIDED and not only what resulted.
  insert into public.person_merge
    (workspace_id, kept_person_id, merged_person_id, moved, dropped, choices, merged_by)
  values
    (v_keep.workspace_id, p_keep, p_merge, v_moved, v_dropped, coalesce(p_choices, '{}'::jsonb), p_actor)
  returning id into v_merge_id;

  return v_merge_id;
end;
$$;

-- --------------------------------------------------------------------------
-- the two undos, which assumed `id` as well
-- --------------------------------------------------------------------------
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
    -- The key by NAME, defaulting to `id` for audit rows written before
    -- 2026-10-12 — which is what those rows were recorded with. Compared
    -- as text, for the same reason the merge does it: a child table's key
    -- need not be a uuid either.
    execute format(
      'update %s set %I = $1 where %I::text = any($2::text[])',
      v_entry->>'table', v_entry->>'column', coalesce(v_entry->>'key', 'id')
    ) using v_m.merged_org_id,
            (select array_agg(x) from jsonb_array_elements_text(v_entry->'ids') x);
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
    -- The key by NAME, defaulting to `id` for audit rows written before
    -- 2026-10-12 — which is what those rows were recorded with. Compared
    -- as text, for the same reason the merge does it: a child table's key
    -- need not be a uuid either.
    execute format(
      'update %s set %I = $1 where %I::text = any($2::text[])',
      v_item->>'table', v_item->>'column', coalesce(v_item->>'key', 'id')
    ) using v_m.merged_person_id,
            (select array_agg(x) from jsonb_array_elements_text(v_item->'ids') x);
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
