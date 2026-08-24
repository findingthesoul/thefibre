-- ---------------------------------------------------------------------------
-- Fix: resolve_sso_identity failed for every BRAND-NEW user.
--
-- `returns table (user_id uuid, resolution text)` declares `user_id` as an OUT
-- parameter. In the create-a-new-user branch the function does:
--
--     insert into public.app_membership (user_id, app_id, role)
--     values (v_user_id, v_platform_app, 'admin')
--     on conflict (user_id, app_id) do nothing;
--
-- An ON CONFLICT target cannot be table-qualified, so `user_id` there is
-- ambiguous against the OUT parameter and Postgres raises 42702
-- "column reference user_id is ambiguous". The whole call fails.
--
-- WHY THIS SAT UNNOTICED SINCE 2026-05-16
-- Only the third branch — create a new person + user — touches it. Branches 1
-- and 2 (match by provider id, match by email) do not, and every sign-in since
-- that migration has taken one of those, because the account already existed:
-- accounts are auto-created at enrolment, and the seeded users predate it. The
-- first person to hit branch 3 was the first user of a NEW workspace.
--
-- The symptom is nasty: Supabase Auth signs you in fine, so you land in the app
-- with a valid session, but no `public.user` row is ever created. The access
-- token hook then injects no app_user_id / workspace_id claim, and every single
-- API call 401s — contacts, settings, profile, all of it. The auth callback
-- logs the resolve failure and deliberately carries on, so nothing surfaces.
--
-- The fix is one pragma. `#variable_conflict use_column` makes bare identifiers
-- resolve to columns rather than to the OUT parameters. Safe here because the
-- body reads v_user_id / v_resolution throughout and never the OUT names.
-- ---------------------------------------------------------------------------

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
  -- Bare column names win over the OUT parameters `user_id` / `resolution`.
  -- Without this, `on conflict (user_id, app_id)` below is ambiguous (42702)
  -- because `user_id` is also an OUT parameter. Nothing in this body reads
  -- those OUT names as variables (it uses v_user_id / v_resolution), so
  -- resolving bare names to columns is exactly what we want.
  -- Must sit before DECLARE, per the plpgsql docs.
  #variable_conflict use_column
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

    -- Heal old rows.
    perform public.ensure_user_person(v_user_id);

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

      perform public.ensure_user_person(v_user_id);

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
  select v_user_id, u.person_id, p_provider, v_method, v_resolution
    from public."user" u where u.id = v_user_id;

  return query select v_user_id, v_resolution;
end;
$$;
