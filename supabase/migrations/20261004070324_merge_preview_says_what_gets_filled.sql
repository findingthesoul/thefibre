-- What a merge would fill in, said before you press it.
--
-- Sjoerd, 2026-10-04: *"when there is an assumed duplicate, I also thought we
-- could do merge (so address and phone numbers aren't lost) as one of the
-- options. Not just a pref. Is this right?"*
--
-- It already was a merge — person_merge_fill_blanks has filled the keeper's
-- empty fields from the loser since 2026-09-25, and rescues a second email or
-- phone into the _secondary slot. But the screen asks "Which record do you
-- keep?" and offers "Keep this one", which reads as choose-one-lose-the-other.
-- Somebody reasonably concluded the data was being thrown away. A feature
-- nobody can tell is running is not far from one that isn't.
--
-- So the screen is going to say what each choice would gain. For that it needs
-- the answer from the same place the merge gets it, not a second opinion
-- computed in TypeScript from the handful of fields the page happens to have
-- fetched. A preview that disagrees with the behaviour is worse than none: it
-- would promise a field that does not move, or stay silent about one that
-- does.
--
-- Hence: one function, the same `person_fillable_columns()` and
-- `jsonb_is_blank()` the fill itself uses, and the same two conditions in the
-- same order — keeper blank, loser not. An integration test merges a real pair
-- and asserts the preview named exactly the columns the merge then recorded in
-- `filled`.

-- ── one pair, one direction ─────────────────────────────────────────────────
--
-- "If you keep p_keep and merge p_merge away, these columns gain a value."
-- Pure read: it decides nothing and writes nothing.
create or replace function public.person_merge_fill_preview(
  p_keep  uuid,
  p_merge uuid
) returns text[]
language plpgsql
stable
set search_path = public
as $$
declare
  v_keep text[] := '{}';
  v_k    jsonb;
  v_l    jsonb;
  v_col  record;
  v_free text;
  v_addr text;
begin
  select to_jsonb(p) into v_k from public.person p where id = p_keep;
  select to_jsonb(p) into v_l from public.person p where id = p_merge;
  if v_k is null or v_l is null then
    return v_keep;
  end if;

  -- Mirrors person_merge_fill_blanks exactly: a column moves when the keeper
  -- has nothing there and the loser has something.
  for v_col in select name from public.person_fillable_columns()
  loop
    continue when not public.jsonb_is_blank(v_k -> v_col.name);
    continue when public.jsonb_is_blank(v_l -> v_col.name);
    v_keep := v_keep || v_col.name;
  end loop;

  -- The second email and the second phone. These do not need the keeper's own
  -- field to be blank — that is the point of them — only its _secondary slot
  -- to be free, and a contact point that differs from what the keeper already
  -- shows. Same conditions as the rescue in the fill.
  foreach v_free in array array['email', 'phone']
  loop
    continue when coalesce(btrim(v_k ->> (v_free || '_secondary')), '') <> '';
    select cp.value into v_addr
      from public.person_contact_point cp
     where cp.person_id = p_keep
       and cp.kind = v_free
       and cp.value is distinct from public.contact_point_normalise(v_free, v_k ->> v_free)
     order by cp.is_primary desc, cp.created_at
     limit 1;
    continue when v_addr is null;
    v_keep := v_keep || (v_free || '_secondary');
  end loop;

  return v_keep;
end;
$$;

comment on function public.person_merge_fill_preview(uuid, uuid) is
  'Columns that would gain a value if p_keep were kept and p_merge merged away. '
  'Same source of truth as person_merge_fill_blanks; see 20261004070324.';

-- ── a page of pairs, both directions, one round trip ────────────────────────
--
-- The review queue draws many pairs at once and each needs BOTH answers —
-- keeping A, and keeping B — because the whole point is to show what each
-- choice costs. Two RPCs per pair would be forty round trips for a page of
-- twenty, so the set comes back in one.
create or replace function public.person_merge_fill_preview_pairs(
  p_pairs jsonb
) returns table (person_a uuid, person_b uuid, a_gains text[], b_gains text[])
language sql
stable
set search_path = public
as $$
  select
    (e ->> 'a')::uuid,
    (e ->> 'b')::uuid,
    public.person_merge_fill_preview((e ->> 'a')::uuid, (e ->> 'b')::uuid),
    public.person_merge_fill_preview((e ->> 'b')::uuid, (e ->> 'a')::uuid)
  from jsonb_array_elements(coalesce(p_pairs, '[]'::jsonb)) as e;
$$;

comment on function public.person_merge_fill_preview_pairs(jsonb) is
  'Both directions for many pairs in one call, for the duplicates review queue.';

-- Born closed, like every definer-adjacent function here: the API reaches the
-- database as service_role and nothing else may call these.
revoke all on function public.person_merge_fill_preview(uuid, uuid) from public, anon, authenticated;
revoke all on function public.person_merge_fill_preview_pairs(jsonb) from public, anon, authenticated;
grant execute on function public.person_merge_fill_preview(uuid, uuid) to service_role;
grant execute on function public.person_merge_fill_preview_pairs(jsonb) to service_role;
