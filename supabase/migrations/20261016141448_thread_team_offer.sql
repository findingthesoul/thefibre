-- thread_team_offer
--
-- A thread OFFERED to more teams than the one that owns it (Sjoerd,
-- 2026-10-14, "can a thread be owned by more than one team?"; the design he
-- approved 2026-10-16: "Yes, build it").
--
-- ONE owner stays: thread_thread.team_id (or none, for a workspace thread)
-- keeps the public address, the slug namespace and the money — seller,
-- payout account, invoice, refund. This table only adds AUDIENCE: the members
-- of an offered team see the thread as if it were their team's own — in
-- my.thread, on their team calendar, with their own team's member discount,
-- and in the new-thread notification. One reader answers "which teams is this
-- thread for" (apps/api/src/lib/thread-teams.ts); nothing else reads this table.
--
-- Same workspace only (v1). No accept step: the receiving team's admins can
-- remove an offer instead.
--
-- RLS on, no policies: reached only through the API (as the handover tables).

create table if not exists public.thread_team_offer (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspace(id) on delete cascade,
  thread_id           uuid not null references public.thread_thread(id) on delete cascade,
  team_id             uuid not null references public.team(id) on delete cascade,
  added_by_user_id    uuid references public."user"(id) on delete set null,
  created_at          timestamptz not null default now(),
  unique (thread_id, team_id)
);

create index if not exists thread_team_offer_team on public.thread_team_offer (team_id);
create index if not exists thread_team_offer_workspace on public.thread_team_offer (workspace_id);

alter table public.thread_team_offer enable row level security;
-- No policies on purpose: reached only through the API.

-- The row, the thread and the team are all in ONE workspace, and the team is
-- not the thread's owner (that would be the thread twice in one list). A
-- CHECK cannot reach other tables, so this is a trigger; it reads each by its
-- primary key and nothing else.
create or replace function public.thread_team_offer_guard() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.thread_thread t
     where t.id = new.thread_id and t.workspace_id = new.workspace_id
  ) then
    raise exception 'thread_team_offer: the thread is not in this workspace' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.team tm
     where tm.id = new.team_id and tm.workspace_id = new.workspace_id
  ) then
    raise exception 'thread_team_offer: the team is not in this workspace' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.thread_thread t
     where t.id = new.thread_id and t.team_id = new.team_id
  ) then
    raise exception 'thread_team_offer: that team already owns the thread' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists thread_team_offer_guard on public.thread_team_offer;
create trigger thread_team_offer_guard
  before insert or update on public.thread_team_offer
  for each row execute function public.thread_team_offer_guard();
