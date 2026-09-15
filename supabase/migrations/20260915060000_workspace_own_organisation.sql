-- ============================================================================
-- Two things found on production on 2026-09-15 while Sjoerd was setting up
-- soul.com.
--
-- 1. DOMAIN VERIFICATION NEVER WORKED. "new row violates row-level security
--    policy for table org_domain_verification" on Start DNS verification.
--    Both policies (20260517270000) compared workspace_member.user_id with
--    auth.uid() — the AUTH user id. workspace_member.user_id is the PLATFORM
--    user id (public."user".id, the app_user_id claim; CLAUDE.md gotcha). The
--    two never match, so the subquery was always empty. Replaced with the
--    workspace claim every other workspace-scoped policy uses, plus: the
--    challenge must belong to an organisation in that same workspace.
--
-- 2. A WORKSPACE IS AN ORGANISATION TOO (Sjoerd: "soul.com should have itself
--    as a" organisation; "my first contacts are working there"). A fresh
--    workspace showed "No organisations yet" — while the people in it all
--    work for the organisation the workspace IS.
--
--    workspace.organisation_id points at that organisation.
--    public.workspace_own_organisation(workspace) makes it exist, idempotently:
--      - already linked → nothing;
--      - an organisation in the workspace with exactly the workspace's name
--        → link that one (never a duplicate);
--      - otherwise create it: name = workspace name, legal name from the
--        workspace's invoice details, domain = the name when the name IS a
--        domain ("soul.com");
--    and makes the workspace's INTERNAL members members of it, matching their
--    contact record in this workspace by platform user id OR email (one human
--    has a user row per workspace, and a contact may point at another one of
--    them — Sjoerd's soul.com contact does).
--
--    Fires for every new workspace (trigger), for every new internal member
--    (trigger), and once now for every existing workspace.
-- ============================================================================

-- 1. org_domain_verification --------------------------------------------------

drop policy if exists "org_domain_verification read" on public.org_domain_verification;
drop policy if exists "org_domain_verification write" on public.org_domain_verification;

create policy org_domain_verification_select on public.org_domain_verification
  for select to authenticated
  using (workspace_id = public.current_workspace_id());

create policy org_domain_verification_write on public.org_domain_verification
  for all to authenticated
  using (workspace_id = public.current_workspace_id())
  with check (
    workspace_id = public.current_workspace_id()
    and exists (
      select 1
        from public.organisation o
       where o.id = org_domain_verification.org_id
         and o.workspace_id = org_domain_verification.workspace_id
    )
  );

-- 2. workspace.organisation_id ------------------------------------------------

alter table public.workspace
  add column if not exists organisation_id uuid
    references public.organisation(id) on delete set null;

comment on column public.workspace.organisation_id is
  'The organisation this workspace IS (soul.com in the soul.com workspace). Created with the workspace; internal members are its members. See 20260915060000.';

-- Link one person (by platform user) to their workspace's own organisation.
create or replace function public.workspace_link_member_to_own_organisation(
  p_workspace_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_email text;
begin
  select organisation_id into v_org from public.workspace where id = p_workspace_id;
  if v_org is null then return; end if;
  select lower(email) into v_email from public."user" where id = p_user_id;

  insert into public.org_membership (person_id, org_id, is_primary)
  select p.id, v_org, false
    from public.person p
   where p.workspace_id = p_workspace_id
     and p.deleted_at is null
     and p.merged_into is null
     and (p.user_id = p_user_id or (v_email is not null and lower(p.email) = v_email))
     and not exists (
       select 1 from public.org_membership om
        where om.person_id = p.id and om.org_id = v_org
     );
end
$$;

create or replace function public.workspace_own_organisation(p_workspace_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  w record;
  v_org uuid;
  m record;
begin
  select id, name, invoice_details, organisation_id
    into w
    from public.workspace
   where id = p_workspace_id;
  if w.id is null then return null; end if;

  v_org := w.organisation_id;

  if v_org is null then
    select o.id into v_org
      from public.organisation o
     where o.workspace_id = w.id
       and o.deleted_at is null
       and lower(o.name) = lower(w.name)
     order by o.created_at
     limit 1;
  end if;

  if v_org is null then
    insert into public.organisation (workspace_id, name, legal_name, domain)
    values (
      w.id,
      w.name,
      nullif(trim(w.invoice_details ->> 'legal_name'), ''),
      case when w.name ~* '^[a-z0-9-]+(\.[a-z0-9-]+)+$' then lower(w.name) end
    )
    returning id into v_org;
  end if;

  if w.organisation_id is distinct from v_org then
    update public.workspace set organisation_id = v_org where id = w.id;
  end if;

  for m in
    select wm.user_id
      from public.workspace_member wm
     where wm.workspace_id = w.id
       and wm.relationship_type = 'internal'
  loop
    perform public.workspace_link_member_to_own_organisation(w.id, m.user_id);
  end loop;

  return v_org;
end
$$;

create or replace function public.workspace_own_organisation_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.workspace_own_organisation(new.id);
  return null;
end
$$;

create or replace function public.workspace_member_own_organisation_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.relationship_type = 'internal' then
    perform public.workspace_link_member_to_own_organisation(new.workspace_id, new.user_id);
  end if;
  return null;
end
$$;

drop trigger if exists workspace_own_organisation on public.workspace;
create trigger workspace_own_organisation
  after insert on public.workspace
  for each row execute function public.workspace_own_organisation_on_insert();

drop trigger if exists workspace_member_own_organisation on public.workspace_member;
create trigger workspace_member_own_organisation
  after insert on public.workspace_member
  for each row execute function public.workspace_member_own_organisation_on_insert();

-- Service-only: born closed gives authenticated EXECUTE by default
-- (20260914171000); none of these is an RLS helper. Triggers fire without it.
revoke execute on function public.workspace_link_member_to_own_organisation(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.workspace_own_organisation(uuid) from public, anon, authenticated;
revoke execute on function public.workspace_own_organisation_on_insert() from public, anon, authenticated;
revoke execute on function public.workspace_member_own_organisation_on_insert() from public, anon, authenticated;
grant execute on function public.workspace_link_member_to_own_organisation(uuid, uuid) to service_role;
grant execute on function public.workspace_own_organisation(uuid) to service_role;

-- Every existing workspace, once.
select public.workspace_own_organisation(id) from public.workspace;
