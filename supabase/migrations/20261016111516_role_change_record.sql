-- role_change — a record of who changed someone's role (plan approved by the
-- coordinator, 2026-10-16).
--
-- WHAT COUNTS: a workspace role, the internal/external relationship, a member
-- added to or removed from a workspace, an app role (added, changed, removed),
-- and the platform super-admin flag.
--
-- THE FLOOR IS A TRIGGER. Every role write in the API goes through the
-- service role, which RLS and auth.uid() cannot see — so the database records
-- every change itself, whoever made it, and nothing can change a role
-- silently: a path the API forgets, a hand-run SQL statement, a future script.
--
-- THE NAME COMES FROM THE API. The RPCs below do a role write AND set two
-- transaction-local settings first (fibre.actor, fibre.source), which the
-- triggers read. A write that did not come through them is still recorded,
-- with changed_by NULL and source 'unattributed' — named as such, not hidden.
--
-- APPEND-ONLY, like activity: no update and no delete path. The one
-- exception is the database's own cascade (a workspace or user hard-deleted),
-- which the guard lets through by trigger depth; the logging triggers skip a
-- cascaded delete for the same reason, so deleting a workspace never fails
-- on its own history.
--
-- Read through the API only: RLS on, no policies.

create table public.role_change (
  id               uuid primary key default gen_random_uuid(),
  -- NULL only for the platform super-admin flag, which belongs to no
  -- workspace; those rows are read by super admins only (lib/super-admin.ts).
  workspace_id     uuid references public.workspace(id) on delete cascade,
  subject_user_id  uuid references public."user"(id) on delete set null,
  kind             text not null check (kind in (
                     'workspace_role', 'relationship', 'member_added', 'member_removed',
                     'app_role', 'super_admin')),
  app_id           uuid references public.app(id) on delete set null,
  old_value        text,
  new_value        text,
  changed_by       uuid references public."user"(id) on delete set null,
  source           text not null,
  created_at       timestamptz not null default now(),
  check (kind = 'super_admin' or workspace_id is not null)
);
create index role_change_subject_idx on public.role_change (subject_user_id, created_at desc);
create index role_change_workspace_idx on public.role_change (workspace_id, created_at desc);

alter table public.role_change enable row level security;
-- No policies on purpose: reached only through the API.

-- Append-only. Depth > 1 is the database's own referential action (a cascade
-- or a SET NULL from a deleted workspace/user), never a statement somebody ran.
create or replace function public.role_change_is_append_only()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'role_change is append-only — a correction is a new row';
end;
$$;
create trigger role_change_no_update before update on public.role_change
  for each row execute function public.role_change_is_append_only();
create trigger role_change_no_delete before delete on public.role_change
  for each row execute function public.role_change_is_append_only();

-- One row, attributed if an RPC said who.
create or replace function public.role_change_write(
  p_workspace uuid, p_subject uuid, p_kind text, p_app uuid, p_old text, p_new text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.role_change (workspace_id, subject_user_id, kind, app_id, old_value, new_value, changed_by, source)
  values (
    p_workspace, p_subject, p_kind, p_app, p_old, p_new,
    nullif(current_setting('fibre.actor', true), '')::uuid,
    coalesce(nullif(current_setting('fibre.source', true), ''), 'unattributed')
  );
end;
$$;

-- workspace_member: added, removed, role, relationship.
create or replace function public.role_change_on_workspace_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.role_change_write(new.workspace_id, new.user_id, 'member_added', null, null, new.workspace_role);
    return new;
  end if;
  if tg_op = 'DELETE' then
    -- A cascade from a deleted workspace or user is not a removal anybody made.
    if pg_trigger_depth() > 1 then return old; end if;
    perform public.role_change_write(old.workspace_id, old.user_id, 'member_removed', null, old.workspace_role, null);
    return old;
  end if;
  if new.workspace_role is distinct from old.workspace_role then
    perform public.role_change_write(new.workspace_id, new.user_id, 'workspace_role', null, old.workspace_role, new.workspace_role);
  end if;
  if new.relationship_type is distinct from old.relationship_type then
    perform public.role_change_write(new.workspace_id, new.user_id, 'relationship', null, old.relationship_type, new.relationship_type);
  end if;
  return new;
end;
$$;
create trigger role_change_workspace_member
  after insert or update of workspace_role, relationship_type or delete on public.workspace_member
  for each row execute function public.role_change_on_workspace_member();

-- app_membership: an app role added, changed or removed. The workspace is the
-- per-workspace user row's.
create or replace function public.role_change_on_app_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    select workspace_id into v_ws from public."user" where id = old.user_id;
    if v_ws is not null then
      perform public.role_change_write(v_ws, old.user_id, 'app_role', old.app_id, old.role, null);
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.role is not distinct from old.role then
    return new;
  end if;
  select workspace_id into v_ws from public."user" where id = new.user_id;
  if v_ws is not null then
    perform public.role_change_write(
      v_ws, new.user_id, 'app_role', new.app_id,
      case when tg_op = 'UPDATE' then old.role else null end, new.role
    );
  end if;
  return new;
end;
$$;
create trigger role_change_app_membership
  after insert or update of role or delete on public.app_membership
  for each row execute function public.role_change_on_app_membership();

-- The platform super-admin flag. Set by hand today (no API path), so these
-- rows read 'unattributed' — which is the truth about how it was set.
create or replace function public.role_change_on_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin then
    perform public.role_change_write(null, new.id, 'super_admin', null, old.is_super_admin::text, new.is_super_admin::text);
  end if;
  return new;
end;
$$;
create trigger role_change_super_admin
  after update of is_super_admin on public."user"
  for each row execute function public.role_change_on_super_admin();

-- ---------------------------------------------------------------------------
-- The attributed writes. Each sets who and why for THIS transaction, then
-- does the write the route used to do itself; the trigger above records it.
-- ---------------------------------------------------------------------------

create or replace function public.role_attribute(p_actor uuid, p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('fibre.actor', coalesce(p_actor::text, ''), true);
  perform set_config('fibre.source', coalesce(nullif(p_source, ''), 'unattributed'), true);
end;
$$;

-- Update an existing membership: role and/or relationship (and Meet's
-- cosmetic member_status, which it saves in the same statement).
create or replace function public.member_role_write(
  p_workspace uuid, p_user uuid,
  p_role text, p_relationship text,
  p_set_member_status boolean, p_member_status text,
  p_actor uuid, p_source text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  perform public.role_attribute(p_actor, p_source);
  update public.workspace_member
     set workspace_role    = coalesce(p_role, workspace_role),
         relationship_type = coalesce(p_relationship, relationship_type),
         member_status     = case when p_set_member_status then p_member_status else member_status end
   where workspace_id = p_workspace and user_id = p_user;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Add a membership. p_upsert: an existing row takes the given role and
-- relationship (first admin); otherwise an existing row is left as it is
-- (invite: "an existing row is not rewritten"). Returns true when a row was
-- inserted or updated.
create or replace function public.member_add(
  p_workspace uuid, p_user uuid, p_role text, p_relationship text, p_upsert boolean,
  p_actor uuid, p_source text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  perform public.role_attribute(p_actor, p_source);
  if p_upsert then
    insert into public.workspace_member (user_id, workspace_id, workspace_role, relationship_type)
    values (p_user, p_workspace, p_role, p_relationship)
    on conflict (user_id, workspace_id) do update
      set workspace_role = excluded.workspace_role, relationship_type = excluded.relationship_type;
  else
    insert into public.workspace_member (user_id, workspace_id, workspace_role, relationship_type)
    values (p_user, p_workspace, p_role, p_relationship)
    on conflict (user_id, workspace_id) do nothing;
  end if;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Remove a member from a workspace: the membership edge and their app grants
-- (grants belong to the per-workspace user row, so nothing elsewhere moves).
create or replace function public.member_remove(
  p_workspace uuid, p_user uuid, p_actor uuid, p_source text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.role_attribute(p_actor, p_source);
  delete from public.workspace_member where workspace_id = p_workspace and user_id = p_user;
  delete from public.app_membership where user_id = p_user;
end;
$$;

-- Give or change an app role.
create or replace function public.app_role_set(
  p_user uuid, p_app uuid, p_role text, p_is_direct boolean, p_actor uuid, p_source text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.role_attribute(p_actor, p_source);
  insert into public.app_membership (user_id, app_id, role, is_direct)
  values (p_user, p_app, p_role, p_is_direct)
  on conflict (user_id, app_id) do update set role = excluded.role, is_direct = excluded.is_direct;
end;
$$;

-- Born closed: the service role only (definer-functions.int.test.ts).
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.role_change_write(uuid, uuid, text, uuid, text, text)',
    'public.role_attribute(uuid, text)',
    'public.member_role_write(uuid, uuid, text, text, boolean, text, uuid, text)',
    'public.member_add(uuid, uuid, text, text, boolean, uuid, text)',
    'public.member_remove(uuid, uuid, uuid, text)',
    'public.app_role_set(uuid, uuid, text, boolean, uuid, text)',
    'public.role_change_on_workspace_member()',
    'public.role_change_on_app_membership()',
    'public.role_change_on_super_admin()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
