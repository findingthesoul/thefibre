-- role_change triggers, v2 — after the emergency drop (20261016112042).
--
-- WHAT WENT WRONG IN v1 (20261016111516): the logging triggers skipped a
-- cascaded delete by `pg_trigger_depth() > 1`. An AFTER ROW trigger fired by
-- an FK cascade runs once the referential action completes — NOT at depth
-- > 1 — so hard-deleting a user wrote a role_change row pointing at the user
-- being deleted, and the delete failed with 23503. Every user hard-delete on
-- staging failed until the triggers were dropped.
--
-- v2 never asks about depth. It asks whether the rows a log line would point
-- at still EXIST, in ONE place (role_change_write), so every trigger path
-- has the same rule:
--   · the SUBJECT user is gone (hard-deleted, or going in this statement) →
--     nothing is written: a removal nobody made, from a row that is vanishing;
--   · the WORKSPACE is gone (a workspace hard-delete cascading) → nothing;
--   · the ACTOR is gone → the line is written with changed_by NULL.
-- In an AFTER trigger the deleted parent is already invisible within the
-- statement, which is what makes this reliable where depth was not.
--
-- The append-only guard on role_change itself is unchanged: it is a BEFORE
-- trigger, where the referential action's own statements DO run at depth
-- > 1 — proven when the leftover workspace from the failed read-back was
-- deleted (its rows cascaded, its users' pointers were set to null, the guard
-- let both through).

create or replace function public.role_change_write(
  p_workspace uuid, p_subject uuid, p_kind text, p_app uuid, p_old text, p_new text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := nullif(current_setting('fibre.actor', true), '')::uuid;
begin
  if p_subject is not null and not exists (select 1 from public."user" where id = p_subject) then
    return;
  end if;
  if p_workspace is not null and not exists (select 1 from public.workspace where id = p_workspace) then
    return;
  end if;
  if v_actor is not null and not exists (select 1 from public."user" where id = v_actor) then
    v_actor := null;
  end if;
  insert into public.role_change (workspace_id, subject_user_id, kind, app_id, old_value, new_value, changed_by, source)
  values (
    p_workspace, p_subject, p_kind, p_app, p_old, p_new, v_actor,
    coalesce(nullif(current_setting('fibre.source', true), ''), 'unattributed')
  );
end;
$$;

-- The three trigger functions, now without any depth check: role_change_write
-- decides whether there is anything left to point at.
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

create or replace function public.role_change_on_app_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_user uuid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
begin
  if tg_op = 'UPDATE' and new.role is not distinct from old.role then
    return new;
  end if;
  -- The per-workspace user row says which workspace; gone, nothing to say.
  select workspace_id into v_ws from public."user" where id = v_user;
  if v_ws is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    perform public.role_change_write(v_ws, old.user_id, 'app_role', old.app_id, old.role, null);
    return old;
  end if;
  perform public.role_change_write(
    v_ws, new.user_id, 'app_role', new.app_id,
    case when tg_op = 'UPDATE' then old.role else null end, new.role
  );
  return new;
end;
$$;

-- (role_change_on_super_admin is unchanged: an UPDATE of a row that exists.)

create trigger role_change_workspace_member
  after insert or update of workspace_role, relationship_type or delete on public.workspace_member
  for each row execute function public.role_change_on_workspace_member();
create trigger role_change_app_membership
  after insert or update of role or delete on public.app_membership
  for each row execute function public.role_change_on_app_membership();
create trigger role_change_super_admin
  after update of is_super_admin on public."user"
  for each row execute function public.role_change_on_super_admin();

-- Born closed, again (create or replace keeps grants, but say it).
revoke all on function public.role_change_write(uuid, uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.role_change_write(uuid, uuid, text, uuid, text, text) to service_role;
revoke all on function public.role_change_on_workspace_member() from public, anon, authenticated;
revoke all on function public.role_change_on_app_membership() from public, anon, authenticated;
