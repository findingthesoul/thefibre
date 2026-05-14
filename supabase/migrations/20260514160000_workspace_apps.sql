-- ============================================================================
-- v0.5.1 — Per-workspace app activation.
--
-- workspace_app records which apps a given workspace has turned on.
-- This is independent of app_membership, which records whether a *user*
-- can access an app. A workspace can have Meet activated and only grant
-- meet membership to its facilitators.
--
-- Also formalises the difference between:
--   * workspace admin — runs their own workspace; can activate apps,
--     manage members within their workspace. Identified by app_membership
--     for 'fibre-platform' with role='admin'. (is_platform_admin())
--   * super admin — runs The Fibre itself (Sjoerd today); can approve
--     signup requests, see cross-workspace state. Flagged on public.user.
-- ============================================================================

-- 1. Super-admin flag on user --------------------------------------------------
alter table public."user"
  add column if not exists is_super_admin boolean not null default false;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public."user"
     where id = public.current_user_id()
       and is_super_admin = true
       and deleted_at is null
  )
$$;

-- Bootstrap: promote the founding user.
update public."user"
   set is_super_admin = true
 where email = 'sjoerd@soul.com';

-- Re-point signup_request policies at super-admin (was platform-admin).
-- The old policy was scoped to "anyone with fibre-platform role=admin",
-- which now matches every workspace creator. Cross-workspace approval is
-- a super-admin concern.
drop policy if exists signup_request_select_admin on public.signup_request;
drop policy if exists signup_request_update_admin on public.signup_request;

create policy signup_request_select_super on public.signup_request
  for select
  to authenticated
  using (public.is_super_admin());

create policy signup_request_update_super on public.signup_request
  for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- 2. workspace_app ------------------------------------------------------------
create table public.workspace_app (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  app_id          uuid not null references public.app(id),
  activated_at    timestamptz not null default now(),
  activated_by    uuid references public."user"(id),
  deactivated_at  timestamptz,
  settings        jsonb not null default '{}'::jsonb,
  unique (workspace_id, app_id)
);

create index workspace_app_workspace_idx
  on public.workspace_app (workspace_id)
  where deactivated_at is null;

alter table public.workspace_app enable row level security;

-- SELECT: anyone in the workspace can see which apps are active.
drop policy if exists workspace_app_select on public.workspace_app;
create policy workspace_app_select on public.workspace_app
  for select
  to authenticated
  using (workspace_id = public.current_workspace_id());

-- INSERT/UPDATE/DELETE: only workspace admins.
drop policy if exists workspace_app_write on public.workspace_app;
create policy workspace_app_write on public.workspace_app
  for all
  to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.is_platform_admin()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.is_platform_admin()
  );

-- 3. Bootstrap existing workspaces -------------------------------------------
-- Anyone in the default workspace currently has memberships for all four
-- delivery apps; the seed installed them. Mirror that into workspace_app so
-- the toggles in the UI reflect reality.
insert into public.workspace_app (workspace_id, app_id, activated_by)
select w.id, a.id, (
  select id from public."user"
   where workspace_id = w.id and is_super_admin = true
   order by created_at asc
   limit 1
)
  from public.workspace w
  cross join public.app a
 where a.slug in ('fibre-meet', 'the-thread', 'fibre-sales', 'fibre-learn')
on conflict (workspace_id, app_id) do nothing;

-- 4. New workspaces start with no apps activated and the creator as workspace
--    admin (fibre-platform role='admin'). resolve_sso_identity is updated to
--    grant that membership the first time a brand-new user signs in.
create or replace function public.resolve_sso_identity(
  p_workspace_id        uuid,
  p_provider            text,
  p_provider_user_id    text,
  p_provider_email      citext,
  p_provider_name       text default null,
  p_provider_avatar_url text default null,
  p_provider_metadata   jsonb  default '{}'::jsonb
) returns table (user_id uuid, resolution text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id        uuid;
  v_person_id      uuid;
  v_resolution     text;
  v_method         text;
  v_platform_app   uuid;
begin
  -- 1. Match by provider_user_id (fastest)
  select uip.user_id into v_user_id
    from public.user_identity_provider uip
   where uip.provider = p_provider
     and uip.provider_user_id = p_provider_user_id;

  if v_user_id is not null then
    v_resolution := 'matched';
    v_method     := 'provider_id';

    update public.user_identity_provider
       set last_used_at = now()
     where provider = p_provider
       and provider_user_id = p_provider_user_id;

  else
    -- 2. Match by email
    select u.id into v_user_id
      from public."user" u
     where u.workspace_id = p_workspace_id
       and u.email = p_provider_email
       and u.deleted_at is null;

    if v_user_id is not null then
      v_resolution := 'linked';
      v_method     := 'email';

      insert into public.user_identity_provider (
        user_id, provider, provider_user_id, provider_email,
        provider_name, provider_avatar_url, provider_metadata, last_used_at
      )
      values (
        v_user_id, p_provider, p_provider_user_id, p_provider_email,
        p_provider_name, p_provider_avatar_url, p_provider_metadata, now()
      );

    else
      -- 3. Create new user + person
      insert into public.person (workspace_id, email, first_name, last_name)
      values (
        p_workspace_id,
        p_provider_email,
        split_part(coalesce(p_provider_name, p_provider_email), ' ', 1),
        nullif(substr(coalesce(p_provider_name, ''), strpos(coalesce(p_provider_name, ' '), ' ') + 1), '')
      )
      returning id into v_person_id;

      insert into public."user" (
        workspace_id, person_id, email, full_name, avatar_url,
        primary_auth_method, email_verified
      )
      values (
        p_workspace_id, v_person_id, p_provider_email, p_provider_name, p_provider_avatar_url,
        p_provider, true
      )
      returning id into v_user_id;

      update public.person set user_id = v_user_id where id = v_person_id;

      insert into public.user_identity_provider (
        user_id, provider, provider_user_id, provider_email,
        provider_name, provider_avatar_url, provider_metadata,
        is_primary, last_used_at
      )
      values (
        v_user_id, p_provider, p_provider_user_id, p_provider_email,
        p_provider_name, p_provider_avatar_url, p_provider_metadata,
        true, now()
      );

      -- The first user in a workspace gets fibre-platform admin — they
      -- own this workspace. Idempotent: ON CONFLICT keeps existing rows.
      select id into v_platform_app from public.app where slug = 'fibre-platform';
      if v_platform_app is not null then
        insert into public.app_membership (user_id, app_id, role)
        values (v_user_id, v_platform_app, 'admin')
        on conflict (user_id, app_id) do nothing;
      end if;

      v_resolution := 'created';
      v_method     := 'created_new';
    end if;
  end if;

  insert into public.sso_match_log (user_id, person_id, provider, match_method, resolution)
  values (v_user_id, (select person_id from public."user" where id = v_user_id), p_provider, v_method, v_resolution);

  return query select v_user_id, v_resolution;
end;
$$;

revoke all on function public.resolve_sso_identity from public;
grant execute on function public.resolve_sso_identity to service_role;
