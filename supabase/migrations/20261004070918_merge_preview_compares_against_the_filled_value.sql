-- The preview must compare against the value the keeper will HAVE, not the
-- one it has now.
--
-- Third and last correction to person_merge_fill_preview, and the two before
-- it were the same mistake in different clothes: a preview that reasons about
-- the state in front of it rather than the state at the moment it is
-- predicting.
--
--   20261004070324 looked only at the keeper's contact points, so it never saw
--   the second email the merge would rescue from the loser's.
--   20261004070803 fixed that, and then over-promised `phone_secondary`: a
--   keeper whose phone is BLANK has its phone filled from the loser first, and
--   the rescue then finds the loser's number is the number it just took and
--   rescues nothing. The preview still compared against the blank, so every
--   blank-phoned keeper was promised a second number it would never get.
--
-- I wrote that corner case into 070803's own comment and shipped it anyway,
-- reasoning it was "one line of text". It is not: the whole point of the line
-- is that it can be trusted, and a promise that is usually true is worse than
-- no promise, because nobody checks the usual case.
--
-- So the comparison now uses the EFFECTIVE value — the keeper's own where it
-- has one, the loser's where the blank-filling loop is about to supply it —
-- which is exactly what person_merge_fill_blanks compares against, because by
-- the time its rescue runs the fill has already happened.

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
  v_eff  text;
begin
  select to_jsonb(p) into v_k from public.person p where id = p_keep;
  select to_jsonb(p) into v_l from public.person p where id = p_merge;
  if v_k is null or v_l is null then
    return v_keep;
  end if;

  -- Mirrors person_merge_fill_blanks: a column moves when the keeper has
  -- nothing there and the loser has something.
  for v_col in select name from public.person_fillable_columns()
  loop
    continue when not public.jsonb_is_blank(v_k -> v_col.name);
    continue when public.jsonb_is_blank(v_l -> v_col.name);
    v_keep := v_keep || v_col.name;
  end loop;

  foreach v_free in array array['email', 'phone']
  loop
    continue when coalesce(btrim(v_k ->> (v_free || '_secondary')), '') <> '';

    -- What the keeper's email/phone will be when the rescue runs: its own if
    -- it has one, otherwise the one the loop above is about to give it.
    v_eff := case
               when public.jsonb_is_blank(v_k -> v_free) then v_l ->> v_free
               else v_k ->> v_free
             end;

    -- Both records' contact points: the loser's are repointed onto the keeper
    -- before the rescue, so they are the keeper's by then.
    select cp.value into v_addr
      from public.person_contact_point cp
     where cp.person_id in (p_keep, p_merge)
       and cp.kind = v_free
       and cp.value is distinct from public.contact_point_normalise(v_free, v_eff)
     order by (cp.person_id = p_keep) desc, cp.is_primary desc, cp.created_at
     limit 1;
    continue when v_addr is null;
    v_keep := v_keep || (v_free || '_secondary');
  end loop;

  return v_keep;
end;
$$;

comment on function public.person_merge_fill_preview(uuid, uuid) is
  'Columns that would gain a value if p_keep were kept and p_merge merged away. '
  'Agrees column-for-column with person_merge_fill_blanks; asserted by the '
  'integration test "the preview names exactly the columns the merge then fills".';
