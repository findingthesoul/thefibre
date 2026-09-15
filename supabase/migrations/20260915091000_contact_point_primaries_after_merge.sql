-- ============================================================================
-- Two refinements to 20260915090000, found by exercising it on staging.
--
-- 1. "0031612345678" and "+31612345678" are the same number. The international
--    00 prefix now normalises to +, and existing rows are rewritten.
--
-- 2. A merge moves the other person's primary address across, still flagged
--    primary, so the kept person has two primaries per kind; an undo moves it
--    back. person_contact_point_remark(person) re-derives the flags from
--    person.email / person.phone. The API calls it after merge and undo.
-- ============================================================================

create or replace function public.contact_point_normalise(p_kind text, p_value text)
returns text
language sql
immutable
as $$
  select case
    when p_value is null or btrim(p_value) = '' then null
    when p_kind = 'email' then lower(btrim(p_value))
    else nullif(
      regexp_replace(
        regexp_replace(btrim(p_value), '[^0-9+]', '', 'g'),
        '^00', '+'),
      '')
  end
$$;

-- Rewrite phones that change under the new rule, unless that would collide
-- with the same number already on the person (then the old spelling goes).
delete from public.person_contact_point cp
 where cp.kind = 'phone'
   and cp.value like '00%'
   and exists (
     select 1 from public.person_contact_point o
      where o.person_id = cp.person_id and o.kind = 'phone'
        and o.value = public.contact_point_normalise('phone', cp.value)
   );
update public.person_contact_point
   set value = public.contact_point_normalise('phone', value)
 where kind = 'phone' and value like '00%';

create or replace function public.person_contact_point_remark(p_person uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_phone text;
begin
  select public.contact_point_normalise('email', email::text),
         public.contact_point_normalise('phone', phone)
    into v_email, v_phone
    from public.person where id = p_person;

  update public.person_contact_point
     set is_primary = case kind when 'email' then value = coalesce(v_email, '')
                                else value = coalesce(v_phone, '') end
   where person_id = p_person;
end
$$;

revoke execute on function public.person_contact_point_remark(uuid) from public, anon, authenticated;
grant execute on function public.person_contact_point_remark(uuid) to service_role;
