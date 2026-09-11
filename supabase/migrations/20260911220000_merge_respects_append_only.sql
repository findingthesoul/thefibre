-- ============================================================================
-- The merge must not touch activity.
--
-- Found by the integration test, which is the whole reason it exists:
-- merge_person walked every FK pointing at person and hit
--
--     activity is append-only — write a correction row instead
--
-- from the trigger installed in the very first activity migration. Hard rule
-- 5: activity is append-only, corrections are new rows.
--
-- There were two ways out and only one of them is honest.
--
-- The tempting one is to exempt the merge — a session flag the trigger
-- checks. That puts a hole in the rule the whole data wall rests on, for the
-- convenience of an administrative action, and the hole would be there
-- forever for anything else that wanted it.
--
-- The other is to accept what the rule is telling us: the event really did
-- happen against that record, and saying otherwise is rewriting history.
-- So activity stays where it is, and READS resolve through merged_into
-- instead. person_and_merged() expands a person id into that person plus
-- everyone ever merged into them, transitively, and the timeline and the
-- app-tab derivation use it.
--
-- The trade, stated plainly: a merged person's events keep their original
-- person_id, so anything querying activity by a bare person_id and not using
-- the helper will under-report. That is a smaller and more visible failure
-- than a rewritable audit log.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- person_and_merged(id) — the person, plus everyone merged into them, plus
-- everyone merged into THOSE. Merges chain: A into B, later B into C.
-- ---------------------------------------------------------------------------
create or replace function public.person_and_merged(p_person uuid)
returns setof uuid
language sql
stable
as $$
  with recursive chain as (
    select p_person as id
    union
    select p.id
      from public.person p
      join chain c on p.merged_into = c.id
  )
  select id from chain;
$$;

comment on function public.person_and_merged(uuid) is
  'A person id expanded to include everyone merged into them, transitively. Any query reading a person''s history by person_id should go through this — merges do not repoint activity, because activity is append-only.';

grant execute on function public.person_and_merged(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- merge_person, with activity excluded from the repoint.
-- Same body as 20260911213000 apart from the skip and the note it records.
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

  insert into public.person_merge
    (workspace_id, kept_person_id, merged_person_id, moved, dropped, merged_by)
  values
    (v_keep.workspace_id, p_keep, p_merge, v_moved, v_dropped, p_actor)
  returning id into v_merge_id;

  return v_merge_id;
end;
$$;

revoke all on function public.merge_person(uuid, uuid, uuid) from public, anon, authenticated;
