-- The preview could not see the second email, because it looked too early.
--
-- 20261004070324 added person_merge_fill_preview so the duplicates screen can
-- say what a merge will fill in. It was wrong about one thing, caught by
-- running it against staging before shipping: it promised three columns and
-- the merge then filled four.
--
-- The missing one was `email_secondary`, and the reason is an ordering the
-- preview cannot observe from where it stands. merge_person repoints the
-- loser's contact points onto the keeper FIRST, and only then rescues a second
-- email or phone out of them. So at merge time the keeper owns both addresses
-- and the rescue finds one; at PREVIEW time the loser still owns its own, and
-- a query restricted to the keeper's contact points sees nothing to rescue.
--
-- The preview therefore has to look at the union — the contact points of both
-- records — because that is what the keeper will own by the time the rescue
-- runs. It is the same question asked about a moment that has not happened
-- yet, which is what a preview is.
--
-- Left in place rather than edited into the earlier file: Supabase tracks
-- migrations by filename, so editing one already applied to staging would
-- change nothing there and silently leave the two stacks running different
-- definitions of the same function.

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

  -- The second email and the second phone, asked about the state the rescue
  -- will actually see: BOTH records' contact points, because the loser's will
  -- have been repointed onto the keeper by then. Restricting this to p_keep
  -- was the bug in 20261004070324.
  --
  -- One deliberate difference from the fill: this compares against the
  -- keeper's CURRENT email, while the merge compares against whatever the
  -- email is after the blank-filling loop. They agree except in one corner —
  -- a keeper with no email at all, whose email is about to be filled from the
  -- loser. There, the fill has an email to compare against and this does not,
  -- so the preview may name a second address the merge then decides is the
  -- first. It over-promises by one line of text in a case where the keeper had
  -- no email to begin with, and the test asserts the ordinary case rather than
  -- pretending this one does not exist.
  foreach v_free in array array['email', 'phone']
  loop
    continue when coalesce(btrim(v_k ->> (v_free || '_secondary')), '') <> '';
    select cp.value into v_addr
      from public.person_contact_point cp
     where cp.person_id in (p_keep, p_merge)
       and cp.kind = v_free
       and cp.value is distinct from public.contact_point_normalise(v_free, v_k ->> v_free)
     order by (cp.person_id = p_keep) desc, cp.is_primary desc, cp.created_at
     limit 1;
    continue when v_addr is null;
    v_keep := v_keep || (v_free || '_secondary');
  end loop;

  return v_keep;
end;
$$;

comment on function public.person_merge_fill_preview(uuid, uuid) is
  'Columns that would gain a value if p_keep were kept and p_merge merged away, '
  'including a second email/phone rescued from either record''s contact points. '
  'Same source of truth as person_merge_fill_blanks; see 20261004070803.';
