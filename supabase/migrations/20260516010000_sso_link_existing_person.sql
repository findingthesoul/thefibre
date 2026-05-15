-- SSO email-match path was creating a user without ensuring a paired person.
-- This is a problem for the invite-then-signin flow: the invite endpoint
-- pre-creates the user; the user then signs in; SSO matches by email and
-- adds a user_identity_provider link, but if the row had no person_id it
-- stayed disconnected from the contact graph.
--
-- This migration rewrites resolve_sso_identity to backfill the link:
--   * Match by provider_user_id → backfill person if user lacks one.
--   * Match by email           → backfill person if user lacks one.
--   * Create new user          → unchanged (already creates + links).
--
-- ensure_user_person() is a small helper used by both backfill paths.

create or replace function public.ensure_user_person(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_email        citext;
  v_full_name    text;
  v_person_id    uuid;
  v_first        text;
  v_last         text;
begin
  select u.person_id, u.workspace_id, u.email, u.full_name
    into v_person_id, v_workspace_id, v_email, v_full_name
    from public."user" u
   where u.id = p_user_id;
  if v_person_id is not null then
    return v_person_id;
  end if;

  -- Existing person in this workspace by email?
  select id into v_person_id
    from public.person
   where workspace_id = v_workspace_id
     and email = v_email
     and deleted_at is null
   limit 1;

  if v_person_id is null then
    v_first := split_part(coalesce(v_full_name, v_email::text), ' ', 1);
    v_last  := nullif(
      substr(coalesce(v_full_name, ''), strpos(coalesce(v_full_name, ' '), ' ') + 1),
      ''
    );
    insert into public.person (workspace_id, email, first_name, last_name, user_id)
    values (v_workspace_id, v_email, v_first, v_last, p_user_id)
    returning id into v_person_id;
  else
    update public.person set user_id = p_user_id where id = v_person_id;
  end if;

  update public."user" set person_id = v_person_id where id = p_user_id;
  return v_person_id;
end;
$$;

revoke all on function public.ensure_user_person from public;
grant execute on function public.ensure_user_person to service_role;

-- Patch resolve_sso_identity: at the end of both match paths, call the
-- helper. Create-path remains unchanged.
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

revoke all on function public.resolve_sso_identity from public;
grant execute on function public.resolve_sso_identity to service_role;

-- Heal any existing rows that pre-date the invariant.
do $$
declare
  r record;
begin
  for r in
    select id from public."user" where person_id is null and deleted_at is null
  loop
    perform public.ensure_user_person(r.id);
  end loop;
end $$;
