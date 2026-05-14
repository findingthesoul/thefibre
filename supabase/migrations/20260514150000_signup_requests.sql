-- ============================================================================
-- v0.5.0 — Self-serve apply + admin approval for Fibre.
--
-- A visitor fills the public /request-access form; we land a row in
-- signup_request with status='pending'. An admin reviews from the admin UI
-- and either approves (which provisions a workspace + user + person record
-- on the user's first sign-in) or denies.
-- ============================================================================

create table public.signup_request (
  id                 uuid primary key default gen_random_uuid(),
  email              citext not null,
  full_name          text not null,
  organisation_name  text,
  reason             text,
  status             text not null default 'pending'
                       check (status in ('pending','approved','denied')),
  workspace_id       uuid references public.workspace(id),   -- set on approval
  decided_by         uuid references public."user"(id),
  decided_at         timestamptz,
  decision_notes     text,
  created_at         timestamptz not null default now(),
  ip_address         inet,
  user_agent         text
);

-- One active (pending or approved) request per email at a time.
-- Denied requests don't block re-application.
create unique index signup_request_active_email_idx
  on public.signup_request (email)
  where status in ('pending','approved');

alter table public.signup_request enable row level security;

-- INSERT — allow anonymous and authenticated visitors to create a request.
-- We rely on application-level rate limiting (Vercel edge); the table itself
-- accepts the row.
drop policy if exists signup_request_insert_anyone on public.signup_request;
create policy signup_request_insert_anyone on public.signup_request
  for insert
  to anon, authenticated
  with check (status = 'pending');

-- SELECT/UPDATE — only platform admins (app_membership for fibre-platform
-- with role = 'admin').
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from public.app_membership am
      join public.app a on a.id = am.app_id
     where am.user_id = public.current_user_id()
       and a.slug = 'fibre-platform'
       and am.role = 'admin'
  )
$$;

drop policy if exists signup_request_select_admin on public.signup_request;
create policy signup_request_select_admin on public.signup_request
  for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists signup_request_update_admin on public.signup_request;
create policy signup_request_update_admin on public.signup_request
  for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Bootstrap: promote the founding user (Sjoerd) to fibre-platform admin so
-- the admin UI is usable from day one. Idempotent.
update public.app_membership
   set role = 'admin'
 where user_id = (select id from public."user" where email = 'sjoerd@soul.com' limit 1)
   and app_id  = (select id from public.app where slug = 'fibre-platform');
