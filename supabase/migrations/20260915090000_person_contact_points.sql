-- ============================================================================
-- One person, labelled addresses (docs/people-in-two-capacities-proposal.md
-- §A and §D). Sjoerd, 2026-09-15: "Sjoerd Luteyn is a business owner
-- (sjoerd@soul.com) but also a private person… should a person have multiple
-- addresses with an indication (work, private) like on an Apple phone?"
--
-- person_contact_point holds every email and phone a person has, each with a
-- label (work · private · other), optionally the organisation a work address
-- is for, a primary flag per kind, and verified_at.
--
-- person.email / person.phone STAY — they are the primary copies ~15 readers
-- and the published app contract use. A trigger keeps the table in step with
-- them in one direction (person → contact points), so no existing writer has
-- to change and nothing can loop:
--   * a new value on person.email/phone becomes (or re-marks) the primary row;
--   * a legacy edit that REPLACES the value (a typo fix) renames the old row
--     when that row carries nothing a person added (no label, not verified);
--     otherwise the old address is kept as a secondary one;
--   * email_secondary / phone_secondary likewise, never primary.
-- The API writes the table directly and then sets person.email/phone to the
-- primaries, which the same trigger re-marks.
--
-- Merging: merge_person() (20260911213000) repoints every FK to person, so
-- contact points follow the kept person with no change to it, and undo puts
-- them back. A collision (both had the same address) is its usual recorded
-- drop.
--
-- Duplicate candidates learn one rule: two people who share ANY address.
-- ============================================================================

create table if not exists public.person_contact_point (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  person_id     uuid not null references public.person(id) on delete cascade,
  kind          text not null check (kind in ('email', 'phone')),
  -- Normalised: emails lower-cased and trimmed; phones reduced to + and digits.
  value         text not null,
  label         text check (label in ('work', 'private', 'other')),
  org_id        uuid references public.organisation(id) on delete set null,
  is_primary    boolean not null default false,
  verified_at   timestamptz,
  created_at    timestamptz not null default now(),
  constraint person_contact_point_uniq unique (person_id, kind, value)
);

comment on table public.person_contact_point is
  'Every email and phone of a person, labelled work/private/other. person.email/phone remain the primary copies, synced by trigger. See 20260915090000.';

create index if not exists person_contact_point_lookup_idx
  on public.person_contact_point (workspace_id, kind, value);

alter table public.person_contact_point enable row level security;

-- Read: whoever may see the person. Writes go through the API (service role),
-- which checks visibility first — the same arrangement as person inserts.
create policy person_contact_point_select on public.person_contact_point
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.can_see_person(person_id)
  );

-- ---------------------------------------------------------------------------
-- Normalisers
-- ---------------------------------------------------------------------------
create or replace function public.contact_point_normalise(p_kind text, p_value text)
returns text
language sql
immutable
as $$
  select case
    when p_value is null or btrim(p_value) = '' then null
    when p_kind = 'email' then lower(btrim(p_value))
    else nullif(regexp_replace(btrim(p_value), '[^0-9+]', '', 'g'), '')
  end
$$;

-- ---------------------------------------------------------------------------
-- The person → contact point sync
-- ---------------------------------------------------------------------------
create or replace function public.person_contact_point_sync_one(
  p_person uuid,
  p_workspace uuid,
  p_kind text,
  p_old text,
  p_new text,
  p_primary boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text := public.contact_point_normalise(p_kind, p_old);
  v_new text := public.contact_point_normalise(p_kind, p_new);
begin
  if v_new is not distinct from v_old then
    return;
  end if;

  if v_new is not null then
    if v_old is not null
       and not exists (
         select 1 from person_contact_point
          where person_id = p_person and kind = p_kind and value = v_new
       )
    then
      -- A replacement: rename the old row when nobody added anything to it.
      update person_contact_point
         set value = v_new
       where person_id = p_person and kind = p_kind and value = v_old
         and label is null and verified_at is null and org_id is null;
    end if;

    insert into person_contact_point (workspace_id, person_id, kind, value, is_primary)
    values (p_workspace, p_person, p_kind, v_new, p_primary)
    on conflict (person_id, kind, value) do nothing;

    if p_primary then
      update person_contact_point
         set is_primary = (value = v_new)
       where person_id = p_person and kind = p_kind
         and is_primary is distinct from (value = v_new);
    end if;
  elsif p_primary and v_old is not null then
    -- Primary cleared: the address stays on the person, just not primary.
    update person_contact_point
       set is_primary = false
     where person_id = p_person and kind = p_kind and value = v_old;
  end if;
end
$$;

create or replace function public.person_contact_point_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.person_contact_point_sync_one(new.id, new.workspace_id, 'email',
    case when tg_op = 'UPDATE' then old.email::text end, new.email::text, true);
  perform public.person_contact_point_sync_one(new.id, new.workspace_id, 'email',
    case when tg_op = 'UPDATE' then old.email_secondary::text end, new.email_secondary::text, false);
  perform public.person_contact_point_sync_one(new.id, new.workspace_id, 'phone',
    case when tg_op = 'UPDATE' then old.phone end, new.phone, true);
  perform public.person_contact_point_sync_one(new.id, new.workspace_id, 'phone',
    case when tg_op = 'UPDATE' then old.phone_secondary end, new.phone_secondary, false);
  return null;
end
$$;

drop trigger if exists person_contact_point_sync on public.person;
create trigger person_contact_point_sync
  after insert or update of email, email_secondary, phone, phone_secondary on public.person
  for each row execute function public.person_contact_point_sync();

revoke execute on function public.person_contact_point_sync_one(uuid, uuid, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.person_contact_point_sync() from public, anon, authenticated;
grant execute on function public.person_contact_point_sync_one(uuid, uuid, text, text, text, boolean) to service_role;

-- Backfill every person (merged rows included, so an undo finds theirs).
insert into public.person_contact_point (workspace_id, person_id, kind, value, is_primary)
select p.workspace_id, p.id, v.kind, v.value, v.is_primary
  from public.person p
 cross join lateral (values
   ('email', public.contact_point_normalise('email', p.email::text), true),
   ('email', public.contact_point_normalise('email', p.email_secondary::text), false),
   ('phone', public.contact_point_normalise('phone', p.phone), true),
   ('phone', public.contact_point_normalise('phone', p.phone_secondary), false)
 ) as v(kind, value, is_primary)
 where v.value is not null
on conflict (person_id, kind, value) do nothing;

-- A person who signed in with their primary address has proven it.
update public.person_contact_point cp
   set verified_at = now()
  from public.person p
  join public."user" u on u.id = p.user_id
 where cp.person_id = p.id
   and cp.kind = 'email'
   and cp.value = lower(u.email::text)
   and cp.verified_at is null;

-- ---------------------------------------------------------------------------
-- Duplicate candidates: + shared_address
-- ---------------------------------------------------------------------------
create or replace function public.person_duplicate_candidates(
  p_workspace uuid,
  p_limit     int default 50,
  p_threshold real default 0.55
) returns table (
  person_a uuid,
  person_b uuid,
  reason   text,
  score    real
)
language sql
stable
security definer
set search_path = public
as $$
  with people as (
    select id, email,
           nullif(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), '') as full_name
      from public.person
     where workspace_id = p_workspace
       and deleted_at is null
  ),
  same_email as (
    select a.id as pa, b.id as pb, 'same_email'::text as rsn, 1.0::real as scr
      from people a join people b on a.email = b.email and a.id < b.id
     where a.email is not null
  ),
  -- Any address in common that is not the primary email pair above: a work
  -- address on one and the same address as a private one on the other, or a
  -- shared phone number.
  shared_address as (
    select distinct a.person_id, b.person_id, 'shared_address'::text, 0.95::real
      from public.person_contact_point a
      join public.person_contact_point b
        on a.workspace_id = b.workspace_id and a.kind = b.kind and a.value = b.value
       and a.person_id < b.person_id
      join people pa on pa.id = a.person_id
      join people pb on pb.id = b.person_id
     where a.workspace_id = p_workspace
       and pa.email is distinct from pb.email
  ),
  same_name as (
    select a.id, b.id, 'same_name'::text, 0.9::real
      from people a join people b
        on lower(a.full_name) = lower(b.full_name) and a.id < b.id
     where a.full_name is not null and (a.email is distinct from b.email)
  ),
  similar_name as (
    select a.id, b.id, 'similar_name'::text, similarity(a.full_name, b.full_name)::real
      from people a join people b on a.id < b.id
     where a.full_name is not null and b.full_name is not null
       and lower(a.full_name) <> lower(b.full_name)
       and similarity(a.full_name, b.full_name) >= p_threshold
  ),
  ranked as (
    select q.pa, q.pb, q.rsn, q.scr,
           row_number() over (partition by q.pa, q.pb order by q.scr desc) as rn
      from (
        select * from same_email
        union all select * from shared_address
        union all select * from same_name
        union all select * from similar_name
      ) q
  )
  -- One row per pair, its strongest reason.
  select pa, pb, rsn, scr from ranked
   where rn = 1
   order by scr desc, pa, pb
   limit greatest(p_limit, 1);
$$;

revoke all on function public.person_duplicate_candidates(uuid, int, real)
  from public, anon, authenticated;
grant execute on function public.person_duplicate_candidates(uuid, int, real) to service_role;
