-- A lease so that one process at a time runs a scheduled tick.
--
-- Born 2026-09-26 from the launch list: the API is one Fly machine, and to
-- stop a deploy from being a 502 window the Fly config goes blue-green — the
-- new machine boots BESIDE the old one, passes its checks, takes the traffic,
-- then the old one is destroyed. During that window both processes are up,
-- and server.ts fires every scheduler 20 s after boot. The usage meter's
-- hourly guard was `let lastSweepAt = 0` — module memory, so a fresh process
-- never declines — and the access syncs pick "pending" rows with no lock at
-- all. Two runners would bill overage twice and invite twice.
--
-- The hygiene sweep already learned the lesson (hygiene_run persists its
-- guard). This generalises it: a named lease with an expiry. try_scheduler_lease
-- wins when the name is free or its lease has expired; the holder releases
-- when done; a holder that dies releases by expiry. Service-role only —
-- no policy, no grant to authenticated — the API's adminClient is the one
-- caller. See apps/api/src/lib/scheduler-lease.ts.

create table if not exists public.scheduler_lease (
  name         text primary key,
  holder       text not null,
  acquired_at  timestamptz not null default now(),
  expires_at   timestamptz not null
);

comment on table public.scheduler_lease is
  'One row per scheduled job name. Whoever holds an unexpired lease runs the tick; everybody else skips it. Lets the API deploy blue-green (two processes for a moment) and, later, run on two machines. Service-role only.';

alter table public.scheduler_lease enable row level security;
-- No policies on purpose: RLS enabled + no policy = nothing but service_role.

create or replace function public.try_scheduler_lease(
  p_name text,
  p_holder text,
  p_ttl_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  won integer;
begin
  insert into public.scheduler_lease (name, holder, expires_at)
  values (p_name, p_holder, now() + make_interval(secs => p_ttl_seconds))
  on conflict (name) do update
    set holder = excluded.holder,
        acquired_at = now(),
        expires_at = excluded.expires_at
    where public.scheduler_lease.expires_at < now()
       or public.scheduler_lease.holder = excluded.holder;
  get diagnostics won = row_count;
  return won > 0;
end;
$$;

create or replace function public.release_scheduler_lease(
  p_name text,
  p_holder text
) returns void
language sql
security definer
set search_path = public
as $$
  update public.scheduler_lease
     set expires_at = now()
   where name = p_name and holder = p_holder;
$$;

-- Definer functions are born closed (handbook §11.3b): nobody but the
-- service role may execute these.
revoke all on function public.try_scheduler_lease(text, text, integer) from public, anon, authenticated;
revoke all on function public.release_scheduler_lease(text, text) from public, anon, authenticated;
grant execute on function public.try_scheduler_lease(text, text, integer) to service_role;
grant execute on function public.release_scheduler_lease(text, text) to service_role;
