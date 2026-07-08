-- ============================================================================
-- Creating a NEW contact was impossible under RLS (Sjoerd hit it from
-- Pulse's combobox, 2026-07-08: "new row violates row-level security policy
-- for table organisation/person").
--
-- person_visibility / organisation_visibility are FOR ALL policies whose
-- WITH CHECK includes can_see_person(id) / can_see_organisation(id). Those
-- functions decide visibility from per-app curator data — which a freshly
-- inserted contact cannot have yet, so the check can never pass on INSERT.
--
-- Split the policies: visibility keeps gating what you can READ (and which
-- rows you may update/delete), but INSERT only requires the row to land in
-- your own workspace. New contacts are immediately visible to their creator
-- through the platform tier as before.
-- ============================================================================

-- person -----------------------------------------------------------------
drop policy if exists person_visibility on public.person;

create policy person_select on public.person
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.can_see_person(id)
  );

create policy person_insert on public.person
  for insert to authenticated
  with check (workspace_id = public.current_workspace_id());

create policy person_update on public.person
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.can_see_person(id)
  )
  with check (workspace_id = public.current_workspace_id());

create policy person_delete on public.person
  for delete to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.can_see_person(id)
  );

-- organisation -------------------------------------------------------------
drop policy if exists organisation_visibility on public.organisation;

create policy organisation_select on public.organisation
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.can_see_organisation(id)
  );

create policy organisation_insert on public.organisation
  for insert to authenticated
  with check (workspace_id = public.current_workspace_id());

create policy organisation_update on public.organisation
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.can_see_organisation(id)
  )
  with check (workspace_id = public.current_workspace_id());

create policy organisation_delete on public.organisation
  for delete to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.can_see_organisation(id)
  );
