-- ============================================================================
-- Fibre Flow — per-user favourite flows.
--
-- Lets a user star flows so they surface on the Home dashboard. Per-user
-- (not per-flow), so a join table keyed on (user_id, flow_id).
-- ============================================================================

create table public.flow_favorite (
  user_id    uuid not null references public."user"(id) on delete cascade,
  flow_id    uuid not null references public.flow_definition(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, flow_id)
);
create index flow_favorite_user_idx on public.flow_favorite (user_id);

alter table public.flow_favorite enable row level security;

-- A user manages only their own favourites, and only for flows they can see
-- (the flow_definition EXISTS check inherits its RLS).
create policy flow_favorite_own on public.flow_favorite
  for all to authenticated
  using (
    user_id = public.current_user_id()
    and public.has_app_membership('fibre-flow')
    and exists (select 1 from public.flow_definition d where d.id = flow_favorite.flow_id)
  )
  with check (
    user_id = public.current_user_id()
    and public.has_app_membership('fibre-flow')
    and exists (select 1 from public.flow_definition d where d.id = flow_favorite.flow_id)
  );
