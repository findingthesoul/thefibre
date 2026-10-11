-- Merging two organisations: choose, per field, which value wins.
--
-- The organisation half of 20261011210332, and the same three rules:
--
--   * a choice names a SIDE, never a value, so the merge can only ever pick
--     between two values that already exist on the two records and can never
--     be used to write an arbitrary one;
--   * an unnamed column keeps today's behaviour exactly — blanks filled, the
--     keeper's answer kept — so nothing changes for a caller that sends
--     nothing;
--   * an unknown column, or a value that is not keep/merge, RAISES and names
--     the column, because silently ignoring a decision is how somebody's
--     choice disappears without anybody learning that it did.
--
-- The audit needs nothing new: `filled` is already {column: {before, after}}
-- and the undo added in 20261011202050 already restores `before` only where
-- the column still holds `after`. A choice simply makes `before` a real value
-- rather than always blank.
--
-- Simpler than the person version in one way: an organisation merge CALLS the
-- fill, where the person one hangs it on a BEFORE INSERT trigger, so the
-- decisions reach it directly instead of having to ride the row first. The
-- row keeps them anyway, because an audit that records what was decided is
-- worth more than one recording only what resulted.

-- ---------------------------------------------------------------------------
alter table public.organisation_merge
  add column if not exists choices jsonb not null default '{}'::jsonb;

comment on column public.organisation_merge.choices is
  'Per-column decisions made when merging: {"column": "keep"|"merge"}. A side, never a value. Empty = nobody chose, and the merge filled blanks only. See 20261011213516.';

-- ---------------------------------------------------------------------------
-- What the two records DISAGREE about: both answered, and differently.
--
-- Only the conflicting columns travel, so reviewing a pair does not ship two
-- whole organisations to a browser. Blank-versus-filled is NOT a conflict —
-- that is the existing fill and needs no decision.
create or replace function public.organisation_merge_conflicts(
  p_keep  uuid,
  p_merge uuid
) returns table (name text, keep_value jsonb, merge_value jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with k as (select to_jsonb(o) as r from public.organisation o where id = p_keep),
       m as (select to_jsonb(o) as r from public.organisation o where id = p_merge)
  select c.name,
         (select r from k) -> c.name,
         (select r from m) -> c.name
    from public.organisation_fillable_columns() c
   where not public.jsonb_is_blank((select r from k) -> c.name)
     and not public.jsonb_is_blank((select r from m) -> c.name)
     and ((select r from k) -> c.name) is distinct from ((select r from m) -> c.name)
$$;

comment on function public.organisation_merge_conflicts(uuid, uuid) is
  'Columns where both organisations answered and the answers differ — the questions a per-field merge has to ask. Same column set as the fill. See 20261011213516.';

-- ---------------------------------------------------------------------------
-- The fill, now able to take a decision. Three cases per column, and the
-- default one is unchanged:
--
--   no choice   fill only if the keeper is blank and the other is not.
--   "merge"     take the other record's value even over an answer.
--   "keep"      do nothing at all, including no blank fill — an explicit
--               instruction is honoured literally rather than second-guessed.
drop function if exists public.organisation_merge_fill_blanks(uuid, uuid);

create or replace function public.organisation_merge_fill_blanks(
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
   where k not in (select name from public.organisation_fillable_columns())
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

  select to_jsonb(o) into v_keep from public.organisation o where id = p_keep;
  select to_jsonb(o) into v_lose from public.organisation o where id = p_merge;
  if v_keep is null or v_lose is null then
    return v_before;
  end if;

  for v_col in select name from public.organisation_fillable_columns()
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
      'update public.organisation set %I = (jsonb_populate_record(null::public.organisation, $1)).%I where id = $2',
      v_col.name, v_col.name
    ) using jsonb_build_object(v_col.name, v_losev), p_keep;

    v_before := v_before || jsonb_build_object(
      v_col.name, jsonb_build_object('before', v_keepv, 'after', v_losev)
    );
  end loop;

  return v_before;
end;
$$;

comment on function public.organisation_merge_fill_blanks(uuid, uuid, jsonb) is
  'Carries content from the merged organisation into the kept one. Without choices: blanks only. With {"column":"keep"|"merge"}: that column obeys the decision. Returns {column: {before, after}} for the audit. See 20261011213516.';

-- ---------------------------------------------------------------------------
-- merge_organisation, carrying the choices. Three marked edits against
-- 20261011202050, and the body was extracted rather than retyped.
--
-- The 3-argument version is DROPPED first: a 4th parameter with a default
-- would otherwise leave two candidates for a 3-argument call, and Postgres
-- answers that with "function is not unique" at call time.
drop function if exists public.merge_organisation(uuid, uuid, uuid);

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

-- ---------------------------------------------------------------------------
-- Born closed; the dropped functions took their old grants with them.
revoke all on function public.merge_organisation(uuid, uuid, uuid, jsonb)           from public, anon, authenticated;
revoke all on function public.organisation_merge_fill_blanks(uuid, uuid, jsonb)     from public, anon, authenticated;
revoke all on function public.organisation_merge_conflicts(uuid, uuid)              from public, anon, authenticated;

grant execute on function public.merge_organisation(uuid, uuid, uuid, jsonb)        to service_role;
grant execute on function public.organisation_merge_fill_blanks(uuid, uuid, jsonb)  to service_role;
grant execute on function public.organisation_merge_conflicts(uuid, uuid)           to service_role;
