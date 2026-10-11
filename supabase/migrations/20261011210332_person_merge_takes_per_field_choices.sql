-- Merging two people: choose, per field, which value wins.
--
-- Sjoerd asked for the duplicates screen to let the person merging decide,
-- rather than always keeping the keeper's answer. Today the keeper always
-- wins and only its BLANKS are filled from the record being merged away
-- (person_merge_fill_blanks, 2026-09-25) — so where both records have a
-- phone number, the merged one's is simply dropped.
--
-- This is the database half. No screen yet; nothing changes until a caller
-- sends choices.
--
-- ── A CHOICE NAMES A SIDE, NEVER A VALUE ────────────────────────────────────
--
-- `{"phone": "merge"}`, not `{"phone": "+31 6 ..."}`. This is the security
-- line of the whole feature, so it is written down rather than left to be
-- inferred from the type.
--
-- A merge that accepted VALUES would be an arbitrary field writer: whoever
-- may merge could set any fillable column of any person to anything, through
-- an endpoint that applies none of the validation the profile routes do
-- (FIELD_LIMITS, the contact-point normalisation, the lot). Naming a side
-- means the merge can only ever choose between two values that already exist
-- on the two records — and it makes the audit self-evidently right, because
-- `after` is whichever side was named.
--
-- ── WHAT THE AUDIT DOES NOT NEED ────────────────────────────────────────────
--
-- Nothing. `filled` is already {column: {before, after}} and undo already
-- restores `before` only where the column still holds `after`
-- (20260925095318). Today `before` is always blank because only blanks are
-- filled; with a choice it becomes whatever the keeper actually had, and the
-- same rule puts it back — including the protection that an edit made since
-- the merge wins over the undo. So unmerge is untouched by this migration.
--
-- ── WHY merge_person IS COPIED FORWARD ──────────────────────────────────────
--
-- 20260925053333 deliberately did NOT do this: it hung the fill on a trigger
-- precisely to avoid carrying 150 lines of FK discovery into a new file. That
-- reasoning still holds, and the trigger stays — but a trigger reads the ROW,
-- and the choices have to get onto the row, which only the INSERT can do. So
-- the function is reproduced here with exactly two edits, both marked, and
-- the copy was made by extracting the text rather than retyping it.
--
-- The 3-argument version is DROPPED first. A 4th parameter with a default
-- would otherwise leave two candidates for a 3-argument call and Postgres
-- answers that with "function is not unique" — at call time, in production,
-- not here.

-- ---------------------------------------------------------------------------
-- The decisions, kept with the audit they belong to.
alter table public.person_merge
  add column if not exists choices jsonb not null default '{}'::jsonb;

comment on column public.person_merge.choices is
  'Per-column decisions made when merging: {"column": "keep"|"merge"}. A side, never a value. Empty = nobody chose, and the merge filled blanks only. See 20261011210332.';

-- ---------------------------------------------------------------------------
-- What the two records DISAGREE about: both answered, and differently.
--
-- The screen needs this to ask the question at all. Deliberately not "every
-- fillable column and both its values" — only the ones in conflict travel, so
-- reviewing a pair does not ship two whole records to a browser.
--
-- Blank-versus-filled is NOT a conflict: that is the existing fill, it needs
-- no decision, and the screen already says so through the gains line.
create or replace function public.person_merge_conflicts(
  p_keep  uuid,
  p_merge uuid
) returns table (name text, keep_value jsonb, merge_value jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with k as (select to_jsonb(p) as r from public.person p where id = p_keep),
       m as (select to_jsonb(p) as r from public.person p where id = p_merge)
  select c.name,
         (select r from k) -> c.name,
         (select r from m) -> c.name
    from public.person_fillable_columns() c
   where not public.jsonb_is_blank((select r from k) -> c.name)
     and not public.jsonb_is_blank((select r from m) -> c.name)
     and ((select r from k) -> c.name) is distinct from ((select r from m) -> c.name)
$$;

comment on function public.person_merge_conflicts(uuid, uuid) is
  'Columns where both people answered and the answers differ — the questions a per-field merge has to ask. Same column set as the fill. See 20261011210332.';

-- ---------------------------------------------------------------------------
-- The fill, now able to take a decision.
--
-- Three cases per column, and the DEFAULT one is today's behaviour unchanged:
--
--   no choice   fill only if the keeper is blank and the other is not.
--   "merge"     take the other record's value even over an answer. The
--               keeper's value goes into `before`, so undo restores it.
--   "keep"      do nothing at all — including no blank-fill. An explicit
--               instruction is honoured literally rather than second-guessed.
--               The screen only ever asks about genuine conflicts, where the
--               keeper is not blank, so this arises only from a hand-made
--               request; honouring it is still the least surprising answer to
--               somebody who wrote it.
--
-- An unknown column or a value that is not keep/merge RAISES. Silently
-- ignoring a decision is how somebody's choice disappears without anyone
-- learning that it did.
drop function if exists public.person_merge_fill_blanks(uuid, uuid);

create or replace function public.person_merge_fill_blanks(
  p_keep    uuid,
  p_merge   uuid,
  p_choices jsonb default '{}'::jsonb
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
  v_choice  text;
  v_bad     text;
  v_choices jsonb := coalesce(p_choices, '{}'::jsonb);
begin
  if jsonb_typeof(v_choices) <> 'object' then
    raise exception 'choices must be an object of column -> keep|merge';
  end if;

  -- Refuse the whole call on a bad key or value, before writing anything.
  select k into v_bad
    from jsonb_object_keys(v_choices) k
   where k not in (select name from public.person_fillable_columns())
   limit 1;
  if v_bad is not null then
    raise exception 'cannot choose for %: not a column a merge may carry', v_bad;
  end if;

  select k into v_bad
    from jsonb_each_text(v_choices) e(k, v)
   where e.v not in ('keep', 'merge')
   limit 1;
  if v_bad is not null then
    raise exception 'choice for % must be keep or merge', v_bad;
  end if;

  select to_jsonb(p) into v_keep from public.person p where id = p_keep;
  select to_jsonb(p) into v_lose from public.person p where id = p_merge;
  if v_keep is null or v_lose is null then
    return v_before;
  end if;

  for v_col in select name from public.person_fillable_columns()
  loop
    v_keepv  := v_keep -> v_col.name;
    v_losev  := v_lose -> v_col.name;
    v_choice := v_choices ->> v_col.name;

    -- Nothing to take, whatever anybody chose.
    continue when public.jsonb_is_blank(v_losev);
    -- An explicit "keep" ends it here.
    continue when v_choice = 'keep';
    -- Without a choice this stays what it has always been: blanks only.
    continue when v_choice is null and not public.jsonb_is_blank(v_keepv);
    -- Identical answers are not a change worth recording or undoing.
    continue when v_keepv is not distinct from v_losev;

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
      jsonb_build_object('before', v_keep -> (v_free || '_secondary'), 'after', to_jsonb(v_addr))
    );
  end loop;

  return v_before;
end;
$$;

comment on function public.person_merge_fill_blanks(uuid, uuid, jsonb) is
  'Carries content from the merged person into the kept one. Without choices: blanks only, as since 2026-09-25. With {"column":"keep"|"merge"}: that column obeys the decision. Returns {column: {before, after}} for the audit. See 20261011210332.';

-- ---------------------------------------------------------------------------
-- The trigger hands the row's own decisions to the fill.
create or replace function public.person_merge_fill_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.filled := public.person_merge_fill_blanks(
    new.kept_person_id, new.merged_person_id, coalesce(new.choices, '{}'::jsonb)
  );
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- merge_person, carrying the choices to the audit row. Two marked edits.
drop function if exists public.merge_person(uuid, uuid, uuid);

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
  v_ids      uuid[];
  v_row      jsonb;
  v_rows     jsonb;
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

-- ---------------------------------------------------------------------------
-- Born closed, and the dropped functions take their old grants with them.
revoke all on function public.merge_person(uuid, uuid, uuid, jsonb)            from public, anon, authenticated;
revoke all on function public.person_merge_fill_blanks(uuid, uuid, jsonb)      from public, anon, authenticated;
revoke all on function public.person_merge_conflicts(uuid, uuid)               from public, anon, authenticated;

grant execute on function public.person_merge_fill_blanks(uuid, uuid, jsonb)   to service_role;
grant execute on function public.person_merge_conflicts(uuid, uuid)            to service_role;
grant execute on function public.merge_person(uuid, uuid, uuid, jsonb)         to service_role;
