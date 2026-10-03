-- ============================================================================
-- Member directory, slice 1: CATEGORIES.
--
-- docs/member-directory-spec.md §3.1–3.4. A category is the workspace's own
-- vocabulary; a PRODUCT carries categories; a member's categories are the
-- union over what they hold. Visibility in the directory follows from that,
-- so nobody administers a list of who may see whom.
--
-- A category is NOT a tier and must not be named after one. A category shown
-- beside a member discloses which product they hold, and a product has a
-- price — "Soul Fellowship" as a visible category tells every member who paid
-- €2,000. Hence `directory_show_category` defaults FALSE (§9.2) and the admin
-- UI carries that sentence.
--
-- Nothing here is read by the member-facing directory yet: slice 1 is the
-- vocabulary and the link, no listing. New tables and new columns only —
-- nothing existing is changed.
-- ============================================================================

-- 1. The workspace's categories ----------------------------------------------

create table public.membership_directory_category (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  name         text not null,
  sort_order   int  not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Case-insensitive uniqueness per workspace: "Fellows" and "fellows" are one
-- category typed twice, and a member filtered by the wrong one is invisible.
create unique index membership_directory_category_name_uniq
  on public.membership_directory_category (workspace_id, lower(name));

create index membership_directory_category_ws
  on public.membership_directory_category (workspace_id);

alter table public.membership_directory_category enable row level security;

create policy membership_directory_category_read on public.membership_directory_category
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
  );

create policy membership_directory_category_insert on public.membership_directory_category
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );

create policy membership_directory_category_update on public.membership_directory_category
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );

create policy membership_directory_category_delete on public.membership_directory_category
  for delete to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );

-- 2. Which categories a product confers --------------------------------------
--
-- No `workspace_id` column on purpose. Denormalising it would make two places
-- able to disagree about which workspace a row belongs to, and a CHECK cannot
-- reach another table to stop it. The product already knows, so every policy
-- asks the product.

create table public.membership_product_category (
  product_id  uuid not null references public.membership_product(id) on delete cascade,
  category_id uuid not null references public.membership_directory_category(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (product_id, category_id)
);

create index membership_product_category_category
  on public.membership_product_category (category_id);

alter table public.membership_product_category enable row level security;

create policy membership_product_category_read on public.membership_product_category
  for select to authenticated
  using (
    public.has_app_membership('membership')
    and exists (
      select 1 from public.membership_product p
      where p.id = membership_product_category.product_id
        and p.workspace_id = public.current_workspace_id()
    )
  );

create policy membership_product_category_insert on public.membership_product_category
  for insert to authenticated
  with check (
    public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
    -- BOTH sides must be this workspace's, or a product could be linked to
    -- another community's category and inherit its visibility.
    and exists (
      select 1 from public.membership_product p
      where p.id = membership_product_category.product_id
        and p.workspace_id = public.current_workspace_id()
    )
    and exists (
      select 1 from public.membership_directory_category c
      where c.id = membership_product_category.category_id
        and c.workspace_id = public.current_workspace_id()
    )
  );

create policy membership_product_category_delete on public.membership_product_category
  for delete to authenticated
  using (
    public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
    and exists (
      select 1 from public.membership_product p
      where p.id = membership_product_category.product_id
        and p.workspace_id = public.current_workspace_id()
    )
  );

-- 3. The workspace's directory settings --------------------------------------

alter table public.membership_settings
  -- 'everybody' | 'category' — who a member may see.
  add column directory_visibility text not null default 'everybody',
  -- The DEFAULT for a member's own contact check; the member may override it
  -- (membership_directory_entry.show_contact, slice 2, null = follow this).
  add column directory_show_contact boolean not null default false,
  -- §9.2. Off by default: a category beside a member's name tells every other
  -- member what they hold.
  add column directory_show_category boolean not null default false,
  -- §9.3. When set, a product carrying no category confers this one. When
  -- NULL (the default) an uncategorised member is not listed in 'category'
  -- mode and sees nobody — it fails CLOSED, and the admin screen shows how
  -- many products are uncategorised, because a member silently missing from a
  -- list is the empty that reads as working.
  add column directory_default_category_id uuid
    references public.membership_directory_category(id) on delete set null;

alter table public.membership_settings
  add constraint membership_settings_directory_visibility_check
  check (directory_visibility in ('everybody', 'category'));
