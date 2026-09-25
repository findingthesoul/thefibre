-- A merge combines two contacts. Until now it only combined their ROWS.
--
-- Sjoerd, 2026-09-25: *"with duplicates - can you also merge contact (not
-- just choose). For example: two email addresses belong to each other"*.
--
-- merge_person() walks every FK pointing at person(id) and repoints those
-- rows onto the kept person. It never touched the person ROW itself, so every
-- column the keeper left blank stayed blank even when the merged record had
-- filled it in. Proved on staging with a fixture before writing this:
--
--   keeper: first_name 'Probe', no last_name, email A, no phone
--   loser:  first_name 'Probe', last_name 'Surname', email B, phone +316…
--   after:  last_name null, email_secondary null, phone null
--
-- The emails and the phone were not LOST — person_contact_point is FK'd to
-- person, so those rows moved across and all three were there. But
-- person.email/phone/last_name are what ~15 readers actually render, so the
-- phone vanished from the product and the surname was simply gone. Merging
-- somebody who has a surname into somebody who does not gave you a person
-- with no surname.
--
-- WHAT THIS DOES
-- ---------------------------------------------------------------------------
-- After the FK walk, fill each BLANK column on the keeper from the merged
-- record. Blank means null, empty text, or an empty array. A value the keeper
-- already holds is never overwritten — that half stays a human decision, and
-- "keep this one" must keep meaning what it says.
--
-- Columns are DISCOVERED, not listed, for the same reason the FK walk
-- discovers: a hand list goes stale the first time somebody adds a column,
-- silently and in the direction of losing data. Skipped:
--
--   * identity and bookkeeping — id, workspace_id, created_at, deleted_at,
--     created_via, merged_into, user_id. user_id especially: carrying a login
--     across is exactly the thing merge_person refuses to decide.
--   * anything under a UNIQUE constraint or unique index. Those are
--     identifiers, and moving one is either a collision or an impersonation.
--
-- Then the email/phone pairs, which the generic rule cannot reach. The
-- keeper's `email` is filled, so nothing fills `email_secondary` — yet the
-- merged record's PRIMARY address is precisely the second address Sjoerd
-- means. So after the generic pass, any address still homeless goes into the
-- free secondary slot.
--
-- Every write is recorded in person_merge.filled as {column: prior value},
-- and unmerge_person puts them back. A merge that cannot be undone completely
-- is not reversible, and reversibility is the whole reason this function is
-- allowed to exist.

alter table public.person_merge
  add column if not exists filled jsonb not null default '{}'::jsonb;

comment on column public.person_merge.filled is
  'Columns on the kept person that this merge filled in from the merged record, as {column: value BEFORE the merge}. unmerge_person restores them. See 20260925053333.';

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

  for v_col in
    select a.attname::text as name
      from pg_attribute a
     where a.attrelid = 'public.person'::regclass
       and a.attnum > 0
       and not a.attisdropped
       and a.attname not in (
         'id', 'user_id', 'workspace_id', 'created_at',
         'deleted_at', 'created_via', 'merged_into'
       )
       -- never move a value that identifies a row
       and not exists (
         select 1 from pg_constraint c
          where c.conrelid = a.attrelid
            and c.contype in ('p', 'u')
            and a.attnum = any (c.conkey)
       )
       and not exists (
         select 1 from pg_index i
          where i.indrelid = a.attrelid
            and i.indisunique
            and a.attnum = any (i.indkey)
       )
     order by a.attnum
  loop
    v_keepv := v_keep -> v_col.name;
    v_losev := v_lose -> v_col.name;

    -- blank: null, empty string, or empty array
    continue when not (
      v_keepv is null or jsonb_typeof(v_keepv) = 'null'
      or (jsonb_typeof(v_keepv) = 'string' and btrim(v_keepv #>> '{}') = '')
      or (jsonb_typeof(v_keepv) = 'array'  and jsonb_array_length(v_keepv) = 0)
    );
    continue when v_losev is null or jsonb_typeof(v_losev) = 'null'
      or (jsonb_typeof(v_losev) = 'string' and btrim(v_losev #>> '{}') = '')
      or (jsonb_typeof(v_losev) = 'array'  and jsonb_array_length(v_losev) = 0);

    -- jsonb_populate_record casts the value to the COLUMN'S OWN type. A
    -- naive `($1 -> col) #>> '{}'` renders text fine and mangles everything
    -- else: languages_spoken (text[]) would receive the literal '["nl","en"]'
    -- and custom_fields would lose its shape. Found by writing it that way
    -- first and looking at the column list.
    execute format(
      'update public.person set %I = (jsonb_populate_record(null::public.person, $1)).%I where id = $2',
      v_col.name, v_col.name
    ) using jsonb_build_object(v_col.name, v_losev), p_keep;

    v_before := v_before || jsonb_build_object(v_col.name, v_keepv);
  end loop;

  -- The second address. Re-read: the loop above may have just filled `email`.
  select to_jsonb(p) into v_keep from public.person p where id = p_keep;

  foreach v_free in array array['email', 'phone']
  loop
    continue when coalesce(btrim(v_keep ->> (v_free || '_secondary')), '') <> '';

    -- the best address on this person that is not already their primary
    select cp.value into v_addr
      from public.person_contact_point cp
     where cp.person_id = p_keep
       and cp.kind = v_free
       and cp.value is distinct from public.contact_point_normalise(v_free, v_keep ->> v_free)
     order by cp.is_primary desc, cp.created_at
     limit 1;

    continue when v_addr is null;

    execute format('update public.person set %I = $1 where id = $2', v_free || '_secondary')
      using v_addr, p_keep;  -- text column; no cast needed
    v_before := v_before || jsonb_build_object(v_free || '_secondary', to_jsonb(null::text));
  end loop;

  return v_before;
end
$$;

revoke execute on function public.person_merge_fill_blanks(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.person_merge_fill_blanks(uuid, uuid) to service_role;


-- ---------------------------------------------------------------------------
-- Hooking it up, without restating merge_person().
--
-- merge_person() is 150 lines of FK discovery and its current definition
-- lives in a LATER migration than the one that created it (20260911220000).
-- `create or replace`-ing it here to add two lines would mean copying all of
-- it forward — a second copy to keep in step, which is how the four-places
-- theme bug happened one day earlier. So the hook is a trigger on the audit
-- row instead.
--
-- The timing is not incidental, it is why this works. merge_person inserts
-- person_merge LAST: after the FK walk has repointed every contact point onto
-- the kept person. So at BEFORE INSERT the addresses are already there to be
-- found, and setting NEW.filled needs no second statement.
create or replace function public.person_merge_fill_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.filled := public.person_merge_fill_blanks(new.kept_person_id, new.merged_person_id);
  return new;
end
$$;

drop trigger if exists person_merge_fill on public.person_merge;
create trigger person_merge_fill
  before insert on public.person_merge
  for each row execute function public.person_merge_fill_on_insert();

-- And the reverse. unmerge_person() sets undone_at LAST, after it has put the
-- rows back and un-deleted the person, so restoring here restores onto a
-- record that is otherwise already whole.
create or replace function public.person_merge_unfill_on_undo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col text;
begin
  if old.undone_at is null and new.undone_at is not null then
    for v_col in select jsonb_object_keys(old.filled)
    loop
      execute format(
        'update public.person set %I = (jsonb_populate_record(null::public.person, $1)).%I where id = $2',
        v_col, v_col
      ) using jsonb_build_object(v_col, old.filled -> v_col), old.kept_person_id;
    end loop;
  end if;
  return new;
end
$$;

drop trigger if exists person_merge_unfill on public.person_merge;
create trigger person_merge_unfill
  before update on public.person_merge
  for each row execute function public.person_merge_unfill_on_undo();
