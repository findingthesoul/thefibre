-- Four corrections to 20260925053333, from a stress-test review the same day.
--
-- 1. UNDO NO LONGER DISCARDS A LATER EDIT.  `filled` recorded only the value
--    from BEFORE the merge, and undo wrote it back unconditionally. So:
--    merge fills a blank phone from the merged record; an admin then corrects
--    that phone by hand; somebody undoes the merge; the correction is gone,
--    replaced by NULL. The audit now stores {before, after} and undo restores
--    only where the column is STILL the value the merge wrote. Anything a
--    human touched since is left alone — an undo is meant to reverse the
--    merge, not the afternoon's work.
--
-- 2. THE COLUMN FILTER NO LONGER TRUSTS A LIST OF NAMES.  It excluded seven
--    columns by name. Correct for every column that exists today and wrong
--    for the first one that does not: `erased_at`, `marketing_consent`,
--    `verified_by` would each have travelled from the merged record to the
--    kept one, quietly, and two of those three are legal facts about a
--    specific person. The rule is now what a fillable column IS rather than
--    which ones we remembered: text-ish and array and jsonb content, never a
--    boolean, a timestamp or a uuid, never a name ending _at / _by / _id /
--    _hash / _token, and still never anything under a unique constraint.
--    `person_fillable_columns()` is the single answer, and an integration
--    test classifies every column on person against it so a new one fails the
--    build rather than defaulting to "carry it".
--
-- 3. AN EMPTY JSONB OBJECT COUNTS AS BLANK.  `custom_fields` is
--    `not null default '{}'`, so under the old rule it could never be blank
--    and never travelled — while the comment above it said it would. `{}` now
--    reads as blank, which is what it means.
--
-- 4. The two trigger functions give up their default EXECUTE grants. Not
--    exploitable — Postgres refuses to call a trigger function directly
--    (0A000) and PostgREST omits trigger-returning procedures (PGRST202) —
--    but `person_contact_point_sync` is revoked and these should match it.

-- ---------------------------------------------------------------------------
-- Blank, in one place: null, empty text, empty array, empty object.
create or replace function public.jsonb_is_blank(v jsonb)
returns boolean
language sql
immutable
as $$
  select v is null
      or jsonb_typeof(v) = 'null'
      or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '')
      or (jsonb_typeof(v) = 'array'  and jsonb_array_length(v) = 0)
      or (jsonb_typeof(v) = 'object' and v = '{}'::jsonb)
$$;

-- ---------------------------------------------------------------------------
-- What may be filled, as a question the catalogue answers.
create or replace function public.person_fillable_columns()
returns table (name text)
language sql
stable
set search_path = public
as $$
  select a.attname::text
    from pg_attribute a
    join pg_type t on t.oid = a.atttypid
   where a.attrelid = 'public.person'::regclass
     and a.attnum > 0
     and not a.attisdropped
     -- content, not identity or state: text, arrays of text, jsonb
     and (t.typname in ('text', 'varchar', 'bpchar', 'citext', 'jsonb', 'json')
          or (t.typcategory = 'A' and t.typname in ('_text', '_varchar', '_citext')))
     -- a name that announces itself as a reference, a time or a secret
     and a.attname !~ '_(at|by|id|hash|token)$'
     and a.attname not in ('id', 'workspace_id', 'created_via', 'merged_into')
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

comment on function public.person_fillable_columns() is
  'The columns a person-merge may carry from the merged record into a blank on the kept one. Derived from the catalogue, never a list. See 20260925095318.';

-- ---------------------------------------------------------------------------
create or replace function public.person_merge_fill_blanks(
  p_keep  uuid,
  p_merge uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col     record;
  v_before  jsonb := '{}'::jsonb;
  v_keepv   jsonb;
  v_losev   jsonb;
  v_keep    jsonb;
  v_lose    jsonb;
  v_free    text;
  v_addr    text;
begin
  select to_jsonb(p) into v_keep from public.person p where id = p_keep;
  select to_jsonb(p) into v_lose from public.person p where id = p_merge;
  if v_keep is null or v_lose is null then
    return v_before;
  end if;

  for v_col in select name from public.person_fillable_columns()
  loop
    v_keepv := v_keep -> v_col.name;
    v_losev := v_lose -> v_col.name;

    -- blank: null, empty/whitespace text, empty array, or an empty object
    continue when not public.jsonb_is_blank(v_keepv);
    continue when public.jsonb_is_blank(v_losev);

    execute format(
      'update public.person set %I = (jsonb_populate_record(null::public.person, $1)).%I where id = $2',
      v_col.name, v_col.name
    ) using jsonb_build_object(v_col.name, v_losev), p_keep;

    -- both halves: what it was, and what we made it. Undo needs the second to
    -- know whether anybody has touched it since.
    v_before := v_before || jsonb_build_object(
      v_col.name, jsonb_build_object('before', v_keepv, 'after', v_losev)
    );
  end loop;

  -- The second address. Re-read: the loop may have just filled `email`.
  select to_jsonb(p) into v_keep from public.person p where id = p_keep;

  foreach v_free in array array['email', 'phone']
  loop
    continue when coalesce(btrim(v_keep ->> (v_free || '_secondary')), '') <> '';

    select cp.value into v_addr
      from public.person_contact_point cp
     where cp.person_id = p_keep
       and cp.kind = v_free
       and cp.value is distinct from public.contact_point_normalise(v_free, v_keep ->> v_free)
     order by cp.is_primary desc, cp.created_at
     limit 1;

    continue when v_addr is null;

    execute format('update public.person set %I = $1 where id = $2', v_free || '_secondary')
      using v_addr, p_keep;
    v_before := v_before || jsonb_build_object(
      v_free || '_secondary',
      jsonb_build_object('before', to_jsonb(null::text), 'after', to_jsonb(v_addr))
    );
  end loop;

  return v_before;
end
$$;


-- ---------------------------------------------------------------------------
-- Undo, now conditional.
create or replace function public.person_merge_unfill_on_undo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col     text;
  v_entry   jsonb;
  v_now     jsonb;
  v_person  jsonb;
begin
  if old.undone_at is not null or new.undone_at is null then
    return new;
  end if;

  select to_jsonb(p) into v_person from public.person p where id = old.kept_person_id;
  if v_person is null then
    return new;
  end if;

  for v_col in select jsonb_object_keys(old.filled)
  loop
    v_entry := old.filled -> v_col;

    -- Rows written before 20260925095318 stored the bare prior value. Restore
    -- those the old way: there is no 'after' to compare against, and refusing
    -- would strand them filled forever.
    if jsonb_typeof(v_entry) <> 'object' or not (v_entry ? 'after') then
      execute format(
        'update public.person set %I = (jsonb_populate_record(null::public.person, $1)).%I where id = $2',
        v_col, v_col
      ) using jsonb_build_object(v_col, v_entry), old.kept_person_id;
      continue;
    end if;

    v_now := v_person -> v_col;
    -- somebody edited it after the merge: theirs wins, leave it
    continue when v_now is distinct from (v_entry -> 'after');

    execute format(
      'update public.person set %I = (jsonb_populate_record(null::public.person, $1)).%I where id = $2',
      v_col, v_col
    ) using jsonb_build_object(v_col, v_entry -> 'before'), old.kept_person_id;
  end loop;

  return new;
end
$$;

-- ---------------------------------------------------------------------------
revoke execute on function public.person_merge_fill_on_insert()  from public, anon, authenticated;
revoke execute on function public.person_merge_unfill_on_undo()  from public, anon, authenticated;
revoke execute on function public.person_fillable_columns()      from public, anon, authenticated;
grant  execute on function public.person_fillable_columns()      to service_role;
