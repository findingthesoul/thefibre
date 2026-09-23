-- "Anker Gilde" is not "Anker Stichting".
--
-- The contains rule matched any organisation whose whole name is one word
-- plus a legal form: folding strips the form, "Anker Stichting" becomes
-- "anker", and "anker" is then a prefix of every other Anker in the
-- workspace. On the staging set that produced six confident false pairs —
-- Anker Gilde against Anker Stichting, Stroom Instituut against Stroom
-- Coöperatie — each offered at 0.90.
--
-- The shorter side must now be at least TWO words. That keeps the case this
-- was built for, "De Werkhaven" inside "De Werkhaven Schouwen-Duiveland",
-- and drops the ones where the only thing shared is a first name.
--
-- Caught by running the finder against real data before shipping it rather
-- than after — the pairs were wrong in a way no type or test would show.

create or replace function public.words_in(p text)
returns int
language sql
immutable
as $$
  select coalesce(array_length(regexp_split_to_array(btrim(coalesce(p, '')), '\s+'), 1), 0);
$$;

create or replace function public.organisation_duplicate_candidates(
  p_workspace uuid,
  p_limit     int default 50
) returns table (
  a_id uuid, a_name text, a_domain text, a_people bigint,
  b_id uuid, b_name text, b_domain text, b_people bigint,
  reason text, score real
)
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select o.id, o.name, o.domain,
           lower(regexp_replace(coalesce(o.domain, ''), '^www\.', '')) as host,
           public.organisation_fold(o.name) as folded
      from public.organisation o
     where o.workspace_id = p_workspace
       and o.deleted_at is null
       and o.merged_into is null
  ),
  pairs as (
    select a.id a_id, a.name a_name, a.domain a_domain,
           b.id b_id, b.name b_name, b.domain b_domain,
           case
             when a.host <> '' and a.host = b.host then 'same domain'
             when a.folded <> '' and a.folded = b.folded then 'same name'
             when a.folded <> '' and b.folded <> ''
              and (((a.folded like b.folded || ' %') and public.words_in(b.folded) >= 2)
             or ((b.folded like a.folded || ' %') and public.words_in(a.folded) >= 2))
               then 'one name contains the other'
             else 'similar name'
           end as reason,
           case
             when a.host <> '' and a.host = b.host then 1.0
             when a.folded <> '' and a.folded = b.folded then 0.95
             when a.folded <> '' and b.folded <> ''
              and (((a.folded like b.folded || ' %') and public.words_in(b.folded) >= 2)
             or ((b.folded like a.folded || ' %') and public.words_in(a.folded) >= 2))
               then 0.9
             else similarity(a.folded, b.folded)
           end::real as score
      from live a
      join live b on b.id > a.id
     where (a.host <> '' and a.host = b.host)
        or (a.folded <> '' and a.folded = b.folded)
        or (a.folded <> '' and b.folded <> ''
            and (((a.folded like b.folded || ' %') and public.words_in(b.folded) >= 2)
             or ((b.folded like a.folded || ' %') and public.words_in(a.folded) >= 2)))
        or similarity(a.folded, b.folded) > 0.55
  ),
  -- "No, these are different companies" is an answer, and it has to stick.
  not_dismissed as (
    select p.* from pairs p
     where not exists (
       select 1 from public.organisation_distinct d
        where d.workspace_id = p_workspace
          and d.a_id = least(p.a_id, p.b_id)
          and d.b_id = greatest(p.a_id, p.b_id)
     )
  )
  select n.a_id, n.a_name, n.a_domain,
         (select count(*) from public.org_membership m where m.org_id = n.a_id),
         n.b_id, n.b_name, n.b_domain,
         (select count(*) from public.org_membership m where m.org_id = n.b_id),
         n.reason, n.score
    from not_dismissed n
   order by n.score desc, n.a_name
   limit p_limit;
$$;
