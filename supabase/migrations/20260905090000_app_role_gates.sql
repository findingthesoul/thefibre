-- App-level admin role gates (Sjoerd, 2026-09-05: "some people in my
-- workspace should have access to membership, other than the workspace
-- admin — not all need that").
--
-- app_membership.role always existed; nothing read it. From here on:
-- role 'admin' ON THE APP manages that app's content without holding
-- workspace admin. Membership is the first consumer — its write policies
-- widen from is_workspace_admin() to admin-or-app-admin. Reads stay as
-- they were (any app member sees; the join page stays public via the API).

create or replace function public.has_app_role(p_app_slug text, p_role text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from public.app_membership am
      join public.app a on a.id = am.app_id
     where am.user_id = public.current_user_id()
       and a.slug = p_app_slug
       and am.role = p_role
  );
$$;

-- Rebuild the Membership write policies with the widened gate. (CREATE OR
-- REPLACE doesn't exist for policies — drop + create.)

drop policy if exists membership_tier_insert on public.membership_tier;
create policy membership_tier_insert on public.membership_tier
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );

drop policy if exists membership_tier_update on public.membership_tier;
create policy membership_tier_update on public.membership_tier
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );

drop policy if exists membership_product_insert on public.membership_product;
create policy membership_product_insert on public.membership_product
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );

drop policy if exists membership_product_update on public.membership_product;
create policy membership_product_update on public.membership_product
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );

drop policy if exists membership_tier_product_write on public.membership_tier_product;
create policy membership_tier_product_write on public.membership_tier_product
  for all to authenticated
  using (exists (
    select 1 from public.membership_tier t
     where t.id = membership_tier_product.tier_id
       and t.workspace_id = public.current_workspace_id()
       and public.has_app_membership('membership')
       and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  ))
  with check (exists (
    select 1 from public.membership_tier t
     where t.id = membership_tier_product.tier_id
       and t.workspace_id = public.current_workspace_id()
       and public.has_app_membership('membership')
       and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  ));

drop policy if exists membership_member_insert on public.membership_member;
create policy membership_member_insert on public.membership_member
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );

drop policy if exists membership_member_update on public.membership_member;
create policy membership_member_update on public.membership_member
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );

drop policy if exists membership_access_grant_scope on public.membership_access_grant;
create policy membership_access_grant_scope on public.membership_access_grant
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );

drop policy if exists membership_member_access_scope on public.membership_member_access;
create policy membership_member_access_scope on public.membership_member_access
  for select to authenticated
  using (exists (
    select 1 from public.membership_member m
     where m.id = membership_member_access.member_id
       and m.workspace_id = public.current_workspace_id()
       and public.has_app_membership('membership')
       and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  ));
