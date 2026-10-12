-- The organisation undo could not put back a row the merge had dropped.
--
-- Five minutes after 20261012104325 fixed the crash, the new integration test
-- reached a path that had never run: a merge where BOTH organisations have an
-- org_domain_verification row drops one (only one can exist per org) and
-- records it whole so the undo can restore it. The undo answered
-- `column "k" does not exist`.
--
--     select string_agg(quote_ident(k), ', '), string_agg(format('%L', v), ', ')
--       from jsonb_each_text(v_row);
--
-- jsonb_each_text returns `key` and `value`; the alias `e(k, v)` the author
-- used everywhere else in these functions was missing here. Zero merges had
-- ever dropped a row, so nothing had asked.
--
-- Rather than add the alias, this takes the PERSON undo's version of the same
-- block: the column list comes from jsonb_object_keys and the values through
-- jsonb_populate_record, so every column is cast to its own type instead of
-- being inserted as a string literal and hoping.

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
      -- The person undo's shape, which works: the columns are named by
      -- jsonb_object_keys and the VALUES come back through
      -- jsonb_populate_record, so each one is cast to its real type. The
      -- previous version read `jsonb_each_text(v_row)` without an alias and
      -- then referred to `k` and `v` — the columns are `key` and `value`, so
      -- it raised `column "k" does not exist` the first time anything
      -- reached it, which was 2026-10-12.
      select string_agg(format('%I', key), ', ') into v_cols
        from jsonb_object_keys(v_row) as key;
      execute format(
        'insert into %s (%s) select %s from jsonb_populate_record(null::%s, $1) on conflict do nothing',
        v_entry->>'table', v_cols, v_cols, v_entry->>'table'
      ) using v_row;
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
