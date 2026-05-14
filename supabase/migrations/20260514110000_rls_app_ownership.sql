-- ============================================================================
-- v0.4 RLS — enforce "the app justifies the field" at the database layer.
--
-- A user sees a row of curator data only if:
--   1. the row's parent (person/org) belongs to the user's workspace, AND
--   2. the user has app_membership for the row's owning app_id.
-- ============================================================================

-- Helper: does the current user have app_membership for this app uuid?
create or replace function public.has_app_id(p_app_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.app_membership am
     where am.user_id = public.current_user_id()
       and am.app_id = p_app_id
  )
$$;

-- Replace each curator-table policy with one that adds the app-membership clause.
-- USING applies to reads; WITH CHECK applies to writes.

drop policy if exists person_prof_via_parent on public.person_professional;
create policy person_prof_app_gated on public.person_professional
  for all
  using (
    exists (select 1 from public.person p where p.id = person_professional.person_id and p.workspace_id = public.current_workspace_id())
    and public.has_app_id(person_professional.app_id)
  )
  with check (
    exists (select 1 from public.person p where p.id = person_professional.person_id and p.workspace_id = public.current_workspace_id())
    and public.has_app_id(person_professional.app_id)
  );

drop policy if exists person_relctx_via_parent on public.person_relationship_context;
create policy person_relctx_app_gated on public.person_relationship_context
  for all
  using (
    exists (select 1 from public.person p where p.id = person_relationship_context.person_id and p.workspace_id = public.current_workspace_id())
    and public.has_app_id(person_relationship_context.app_id)
  )
  with check (
    exists (select 1 from public.person p where p.id = person_relationship_context.person_id and p.workspace_id = public.current_workspace_id())
    and public.has_app_id(person_relationship_context.app_id)
  );

drop policy if exists person_change_via_parent on public.person_change_context;
create policy person_change_app_gated on public.person_change_context
  for all
  using (
    exists (select 1 from public.person p where p.id = person_change_context.person_id and p.workspace_id = public.current_workspace_id())
    and public.has_app_id(person_change_context.app_id)
  )
  with check (
    exists (select 1 from public.person p where p.id = person_change_context.person_id and p.workspace_id = public.current_workspace_id())
    and public.has_app_id(person_change_context.app_id)
  );

drop policy if exists person_learning_via_parent on public.person_learning;
create policy person_learning_app_gated on public.person_learning
  for all
  using (
    exists (select 1 from public.person p where p.id = person_learning.person_id and p.workspace_id = public.current_workspace_id())
    and public.has_app_id(person_learning.app_id)
  )
  with check (
    exists (select 1 from public.person p where p.id = person_learning.person_id and p.workspace_id = public.current_workspace_id())
    and public.has_app_id(person_learning.app_id)
  );

drop policy if exists org_identity_via_parent on public.org_identity;
create policy org_identity_app_gated on public.org_identity
  for all
  using (
    exists (select 1 from public.organisation o where o.id = org_identity.org_id and o.workspace_id = public.current_workspace_id())
    and public.has_app_id(org_identity.app_id)
  )
  with check (
    exists (select 1 from public.organisation o where o.id = org_identity.org_id and o.workspace_id = public.current_workspace_id())
    and public.has_app_id(org_identity.app_id)
  );

drop policy if exists org_sysctx_via_parent on public.org_system_context;
create policy org_sysctx_app_gated on public.org_system_context
  for all
  using (
    exists (select 1 from public.organisation o where o.id = org_system_context.org_id and o.workspace_id = public.current_workspace_id())
    and public.has_app_id(org_system_context.app_id)
  )
  with check (
    exists (select 1 from public.organisation o where o.id = org_system_context.org_id and o.workspace_id = public.current_workspace_id())
    and public.has_app_id(org_system_context.app_id)
  );

drop policy if exists org_rel_via_parent on public.org_relationship;
create policy org_rel_app_gated on public.org_relationship
  for all
  using (
    exists (select 1 from public.organisation o where o.id = org_relationship.org_id and o.workspace_id = public.current_workspace_id())
    and public.has_app_id(org_relationship.app_id)
  )
  with check (
    exists (select 1 from public.organisation o where o.id = org_relationship.org_id and o.workspace_id = public.current_workspace_id())
    and public.has_app_id(org_relationship.app_id)
  );
