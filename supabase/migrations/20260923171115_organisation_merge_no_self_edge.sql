-- org_relationship is not an edge, so there is no self-edge to guard.
--
-- merge_organisation carried a block deleting `org_relationship` rows joining
-- the two organisations, modelled on the person merge's handling of
-- public.relationship. That was an assumption from the NAME: person
-- relationships are edges between two people, so an org_relationship sounded
-- like an edge between two organisations.
--
-- It is not. It is the per-organisation relationship RECORD — stage, health,
-- owners, history — keyed `org_id uuid not null unique`. One row per company,
-- no second endpoint. The block referenced `from_org_id` and `to_org_id`,
-- columns that do not exist, so the whole function raised
-- `column r.from_org_id does not exist` the first time it was called on an
-- organisation that had people to move.
--
-- Nothing replaces it, because the unique constraint is already handled: if
-- both organisations have a relationship record, repointing the second hits
-- `unique_violation`, the generic handler stores the row whole in `dropped`,
-- and undo restores it. The kept organisation's own record survives, which is
-- the right answer — you chose that row.
--
-- Found by calling the function on real data instead of only reading it.

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
