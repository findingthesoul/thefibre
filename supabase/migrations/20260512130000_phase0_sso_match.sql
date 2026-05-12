-- ============================================================================
-- SSO match logic — provider_user_id → email → create new
-- See: docs/fibre-technical-brief-v0.3.md §7
--
-- Returns the resolved user.id. Writes sso_match_log.
-- Called from the backend API after a successful OAuth callback.
-- ============================================================================

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
  v_user_id    uuid;
  v_person_id  uuid;
  v_resolution text;
  v_method     text;
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
-- Only the service role calls this (backend API only).
grant execute on function public.resolve_sso_identity to service_role;
