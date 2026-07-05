-- ============================================================================
-- Connections become a data-level platform SPoT (follow-up to v0.13.106,
-- which unified the UI/endpoints but left the data on meet_host).
--
-- google_refresh_token is a CREDENTIAL, so it does NOT go on user_profile —
-- that table is workspace-readable by design (public faces). It gets its own
-- table with RLS enabled and NO policies: service-role (the API) only.
--
-- meet_host.{google_refresh_token, personal_room_url} stay as READ FALLBACKS
-- for rows never migrated, but writes now clear them (write-through) so a
-- disconnect can't be resurrected by a stale app-local value.
-- ============================================================================

create table public.user_connection (
  user_id               uuid primary key references public."user"(id) on delete cascade,
  google_refresh_token  text,
  personal_room_url     text,
  updated_at            timestamptz not null default now()
);

alter table public.user_connection enable row level security;
-- No policies on purpose: nobody reads credentials through PostgREST.

-- Backfill from the previous home.
insert into public.user_connection (user_id, google_refresh_token, personal_room_url)
select mh.user_id, mh.google_refresh_token, mh.personal_room_url
  from public.meet_host mh
 where mh.google_refresh_token is not null
    or mh.personal_room_url is not null
on conflict (user_id) do update set
  google_refresh_token = coalesce(public.user_connection.google_refresh_token, excluded.google_refresh_token),
  personal_room_url    = coalesce(public.user_connection.personal_room_url, excluded.personal_room_url);
