-- ============================================================================
-- One account, several workspaces.
--
-- Until now the workspace a person was in lived in their login token and
-- nowhere else: the hook stamped one workspace_id, and every policy asked the
-- token rather than the person. current_workspace_id() is read 238 times
-- across 32 migrations, so the workspace was effectively welded to the session.
--
-- That is why Sjoerd needed a second email to reach a second workspace, and
-- why switching meant signing out.
--
-- WHAT DOES NOT CHANGE, deliberately: every RLS policy. They all read
-- current_workspace_id(), which still returns exactly one workspace. This
-- changes WHICH one it returns and lets a person move between them; it does
-- not make a token name two workspaces at once. A request is still answered
-- inside exactly one tenant, which is the property the whole data wall rests
-- on and the one worth not weakening.
--
-- THE MODEL. A person is one auth identity (one email). Inside each workspace
-- they have their own `public."user"` row — which is already how the schema
-- works: `unique (workspace_id, email)` has always permitted the same email in
-- two workspaces. What was missing was a way to say which of those rows a
-- session is currently acting as.
-- ============================================================================

-- Which workspace this sign-in is currently acting in.
--
-- Keyed by auth.users.id, because that is the identity that spans workspaces —
-- public."user".id does not, it IS the per-workspace row. No foreign key into
-- the auth schema: it is Supabase's, and a dangling row here is harmless
-- because the hook falls back when it does not resolve.
create table if not exists public.user_active_workspace (
  auth_user_id  uuid primary key,
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  updated_at    timestamptz not null default now()
);

comment on table public.user_active_workspace is
  'The workspace a signed-in person is currently acting in, when they belong to more than one. Read by custom_access_token_hook; written only through the API, which checks membership first. Absent means "the earliest one", which is what everybody had before this existed.';

-- Service-role only. RLS on, no policies: switching workspace must go through
-- the API, which verifies the person actually has a user row in the target.
-- A client that could write this table could put itself in any tenant.
alter table public.user_active_workspace enable row level security;

-- ---------------------------------------------------------------------------
-- The hook picks which of a person's user rows the session acts as.
--
-- Before: `limit 1` with no ordering — fine when there was only ever one row,
-- arbitrary the moment there were two.
-- After: the active workspace if one is set and still valid, otherwise the
-- earliest row. Deterministic either way, which matters more than the choice:
-- a hook that picks differently on two consecutive sign-ins would look exactly
-- like data disappearing.
-- ---------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := (event ->> 'user_id')::uuid;
  v_claims       jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  v_app_user_id  uuid;
  v_workspace_id uuid;
  v_app_slugs    text[];
begin
  select u.id, u.workspace_id
    into v_app_user_id, v_workspace_id
    from public."user" u
    join auth.users au on au.email = u.email
    left join public.user_active_workspace aw on aw.auth_user_id = au.id
   where au.id = v_auth_user_id
     and u.deleted_at is null
   order by
     -- the chosen workspace first, when there is one and it still exists
     (aw.workspace_id is not null and u.workspace_id = aw.workspace_id) desc,
     -- otherwise the oldest membership, so it never moves on its own
     u.created_at asc
   limit 1;

  if v_app_user_id is not null then
    v_claims := v_claims || jsonb_build_object('app_user_id', v_app_user_id);
  end if;

  if v_workspace_id is not null then
    v_claims := v_claims || jsonb_build_object('workspace_id', v_workspace_id);
  end if;

  -- App memberships belong to the user ROW, so they follow the active
  -- workspace rather than spanning them. Being an admin of one workspace's
  -- apps says nothing about another's.
  select array_agg(distinct a.slug)
    into v_app_slugs
    from public.app_membership am
    join public.app a on a.id = am.app_id
   where am.user_id = v_app_user_id;

  if v_app_slugs is not null then
    v_claims := v_claims || jsonb_build_object('app_memberships', v_app_slugs);
  end if;

  return jsonb_build_object('claims', v_claims);
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_sso_identity must stop matching an identity across workspaces.
-- (Full function re-emitted; the change is step 1 and the touch beneath it.)
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
  -- 1. Match by provider_user_id, WITHIN THIS WORKSPACE.
  --
  -- The workspace filter is what makes one person able to belong to several.
  -- The same Google identity is legitimately linked to a different user row in
  -- each workspace they are in; matching on the provider id alone would hand
  -- back whichever row happened to be found first and resolve a sign-in into
  -- the wrong tenant. There is deliberately no unique constraint on
  -- (provider, provider_user_id) — one identity, many rows, one per workspace.
  select uip.user_id into v_user_id
    from public.user_identity_provider uip
    join public."user" u on u.id = uip.user_id
   where uip.provider = p_provider
     and uip.provider_user_id = p_provider_user_id
     and u.workspace_id = p_workspace_id
     and u.deleted_at is null;

  if v_user_id is not null then
    v_resolution := 'matched';
    v_method     := 'provider_id';

    update public.user_identity_provider
       set last_used_at = now()
     where provider = p_provider
       and provider_user_id = p_provider_user_id
       and user_id = v_user_id;

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
