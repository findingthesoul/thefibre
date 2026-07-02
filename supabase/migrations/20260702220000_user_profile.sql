-- Platform public profile (docs/platform-spot-members-profile.md, Phase B):
-- one profile per user; apps (Meet, Thread) inherit display fields and may
-- override locally. Backfilled by coalescing meet_host ← thread_organiser.
create table public.user_profile (
  user_id       uuid primary key references public."user"(id) on delete cascade,
  display_name  text,
  bio           text,
  photo_url     text,
  timezone      text not null default 'Europe/Amsterdam',
  updated_at    timestamptz not null default now()
);

alter table public.user_profile enable row level security;

-- Everyone in the workspace can read profiles (they're public faces);
-- only the owner writes.
create policy user_profile_read on public.user_profile
  for select to authenticated
  using (exists (
    select 1 from public."user" u
     where u.id = user_profile.user_id
       and u.workspace_id = public.current_workspace_id()
  ));

create policy user_profile_write on public.user_profile
  for all to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

-- Backfill: Meet's host profile wins, Thread's organiser fills the gaps.
insert into public.user_profile (user_id, display_name, bio, photo_url, timezone)
select
  u.id,
  coalesce(u.full_name, torg.display_name),
  coalesce(mh.bio, torg.bio),
  coalesce(mh.photo_url, torg.photo_url),
  coalesce(mh.timezone, torg.timezone, 'Europe/Amsterdam')
from public."user" u
left join public.meet_host mh on mh.user_id = u.id
left join public.thread_organiser torg on torg.user_id = u.id
where u.deleted_at is null
on conflict (user_id) do nothing;
