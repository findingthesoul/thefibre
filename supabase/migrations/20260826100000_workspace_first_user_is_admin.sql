-- ---------------------------------------------------------------------------
-- Fix: a new workspace had no admin, and could not be given one from the UI.
--
-- Approving an access request creates a workspace. The first person signs in,
-- `resolve_sso_identity` creates their person + user + identity rows, and
-- everything looks normal. But nothing anywhere creates their
-- `workspace_member` row — the pivot that carries `workspace_role`.
--
-- So they have no role, so every route behind a workspace-admin check answers
-- 403: minting an app key, listing app keys, and — the part that closes the
-- loop — the members screen, which is the only place the role could be
-- granted. The only way to grant the role was a screen that required it.
--
-- The intent was already in this function. Branch 3 says, in a comment, "the
-- first user in a workspace gets fibre-platform admin — they own this
-- workspace", and grants `app_membership.role = 'admin'`. That is the Fibre
-- *app* role, not the *workspace* role. Two different pivots, one word.
--
-- Two changes here:
--   1. `ensure_workspace_member()` — every SSO-resolved user gets a membership
--      row. The first member of a workspace gets 'admin' (the person who asked
--      for the workspace administers it; there is nobody else to be), everyone
--      after gets the column default. Called from all three resolve branches,
--      so users who predate this heal on their next sign-in — same shape as
--      the existing `ensure_user_person` call.
--   2. Backfill: any workspace that has users but no admin gets its earliest
--      user promoted. That is the situation this bug already created.
--
-- NOTE for whoever reads the old brief: `super_admin` IS a valid
-- workspace_role. The two-value check `('admin','member')` from
-- 20260517000000 was replaced by 20260704090000_role_tiers with
-- ('super_admin','admin','organiser'), default 'organiser'.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. The helper
-- ---------------------------------------------------------------------------
create or replace function public.ensure_workspace_member(
  p_user_id      uuid,
  p_workspace_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_first boolean;
begin
  if p_user_id is null or p_workspace_id is null then
    return;
  end if;

  -- Already a member: leave the row exactly as it is. A demotion performed
  -- deliberately by an admin must not be undone by the demoted user signing
  -- in again.
  if exists (
    select 1 from public.workspace_member
     where user_id = p_user_id and workspace_id = p_workspace_id
  ) then
    return;
  end if;

  -- First member of this workspace? Then they administer it.
  select not exists (
    select 1 from public.workspace_member where workspace_id = p_workspace_id
  ) into v_is_first;

  insert into public.workspace_member (user_id, workspace_id, workspace_role, relationship_type)
  values (
    p_user_id,
    p_workspace_id,
    case when v_is_first then 'admin' else 'organiser' end,
    'internal'
  )
  on conflict (user_id, workspace_id) do nothing;
end;
$$;

revoke all on function public.ensure_workspace_member(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- 2. Call it from every branch of the SSO resolver.
--    Body is 20260824200000's, unchanged except for the three new PERFORMs.
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
  -- See 20260824200000 — without this, `on conflict (user_id, app_id)` below
  -- raises 42702 and every brand-new user's sign-in fails silently.
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
    perform public.ensure_workspace_member(v_user_id, p_workspace_id);

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
      perform public.ensure_workspace_member(v_user_id, p_workspace_id);

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
      -- This is the APP role. The WORKSPACE role is the line below it; the
      -- two were confused, which is the bug this migration fixes.
      select id into v_platform_app from public.app where slug = 'fibre-platform';
      if v_platform_app is not null then
        insert into public.app_membership (user_id, app_id, role)
        values (v_user_id, v_platform_app, 'admin')
        on conflict (user_id, app_id) do nothing;
      end if;

      perform public.ensure_workspace_member(v_user_id, p_workspace_id);

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

-- ---------------------------------------------------------------------------
-- 3. Backfill — every workspace that has users but no admin.
--
--    Two steps, because the earliest user may already have a NON-admin
--    membership row (Meet's invite paths write one): promote if the row
--    exists, insert if it does not.
-- ---------------------------------------------------------------------------
with orphaned as (
  select w.id as workspace_id
    from public.workspace w
   where exists (
     select 1 from public."user" u
      where u.workspace_id = w.id and u.deleted_at is null
   )
     and not exists (
     select 1 from public.workspace_member wm
      where wm.workspace_id = w.id
        and wm.workspace_role in ('admin','super_admin')
   )
),
earliest as (
  select distinct on (o.workspace_id) o.workspace_id, u.id as user_id
    from orphaned o
    join public."user" u
      on u.workspace_id = o.workspace_id
     and u.deleted_at is null
   order by o.workspace_id, u.created_at, u.id
)
insert into public.workspace_member (user_id, workspace_id, workspace_role, relationship_type)
select e.user_id, e.workspace_id, 'admin', 'internal'
  from earliest e
on conflict (user_id, workspace_id) do update set workspace_role = 'admin';
