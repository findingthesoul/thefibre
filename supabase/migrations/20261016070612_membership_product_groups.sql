-- PRODUCT GROUPS — for organising a community's products (Sjoerd, approved
-- 2026-10-16), in Members → Products and as headings on the join page.
--
-- Deliberately NOT the directory categories (membership_directory_category):
-- those decide who is seen in the members area and carry the price-
-- disclosure caution. A group decides only WHERE a product is listed. It
-- has no effect on access, pricing or the directory. In the UI it is
-- "Product group"; the other stays "Directory category".
--
-- Each product sits in at most one group (nullable FK). Order is drag-and-
-- drop: sort_order is written by the drop and never shown as a number.
-- Archived, never deleted (like products): archiving a group ungroups its
-- products in the API and never hides them.

create table public.membership_product_group (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index membership_product_group_ws on public.membership_product_group (workspace_id);

alter table public.membership_product
  add column if not exists group_id uuid references public.membership_product_group(id) on delete set null;
create index if not exists membership_product_group_id on public.membership_product (group_id);

-- RLS: the same shape as membership_product (read for the workspace with the
-- app; write for a workspace admin or a Members admin). No delete policy:
-- groups are archived.
alter table public.membership_product_group enable row level security;

create policy membership_product_group_read on public.membership_product_group
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
  );
create policy membership_product_group_insert on public.membership_product_group
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );
create policy membership_product_group_update on public.membership_product_group
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );
