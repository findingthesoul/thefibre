-- ============================================================================
-- Business Models (fibre-models) — schema. Sjoerd, 2026-09-25.
--
-- "We use the workspace Solidarity Lab. Then we make teams, give people
-- access to a team. They can see the business models for that team."
--
-- One table. A model is a plain JSON definition (turnover generators with
-- their own cost structure, generic costs, investment, the canvas text) plus
-- the JSON of edited inputs. The calculation runs in the browser; the API
-- only stores. Teams are the platform primitive (20260517220000): a model
-- with a team_id is visible to that team's active members, a model without
-- one to the whole workspace. Workspace admins see everything.
-- ============================================================================

-- 1 · App catalogue row. beta_at rather than released_at: the app renders
-- once its Vercel project serves, and until then a workspace on a plan with
-- beta_apps may switch it on (20260912090000). Flip released_at with the
-- branding `available: true` in the deploy commit.
insert into public.app (slug, name, base_url, status, kind, released_at, beta_at, description)
values (
  'fibre-models',
  'Business Models',
  'https://models.thethread.app',
  'approved',
  'first_party',
  null,
  now(),
  'Business model generators per team: turnover generators with their own cost structure, generic costs, investment need, break even, and the Business Model Canvas.'
)
on conflict (slug) do nothing;

-- 2 · The model.
create table public.models_model (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  -- null = workspace wide. set null on team delete: the model survives, admins reassign it.
  team_id       uuid references public.team(id) on delete set null,
  slug          text not null,
  name          text not null,
  tagline       text,
  description   text,
  -- The definition the generator reads (docs: solidarity-lab/business-models README, "Model definition").
  definition    jsonb not null default '{}'::jsonb,
  -- Edited numbers, keyed like the definition: {settings:{}, generators:{<id>:{}}, fixed:{}, investment:{}, refMonth, horizon}.
  inputs        jsonb not null default '{}'::jsonb,
  created_by    uuid references public."user"(id),
  updated_by    uuid references public."user"(id),
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index models_model_ws on public.models_model (workspace_id);
create index models_model_team on public.models_model (team_id);
-- A deleted model frees its slug; the live ones stay unique per workspace.
create unique index models_model_slug_live on public.models_model (workspace_id, slug) where deleted_at is null;

comment on table public.models_model is
  'Business Models app: one interactive business model (definition + edited inputs), scoped to a team or the workspace.';

create or replace function public.models_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger models_model_touch before update on public.models_model
  for each row execute function public.models_touch_updated_at();

-- 3 · RLS. Read: your workspace, the app granted, and (workspace wide | your
-- team | you are an admin). Write: the same, but a team model needs an
-- ACTIVE membership of that team; a workspace wide model needs admin.
alter table public.models_model enable row level security;

create policy models_model_read on public.models_model
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-models')
    and deleted_at is null
    and (
      team_id is null
      or public.is_workspace_admin()
      or team_id in (
        select team_id from public.team_member
         where user_id = public.current_user_id() and status = 'active'
      )
    )
  );

create policy models_model_insert on public.models_model
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-models')
    and (
      public.is_workspace_admin()
      or team_id in (
        select team_id from public.team_member
         where user_id = public.current_user_id() and status = 'active'
      )
    )
  );

create policy models_model_update on public.models_model
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-models')
    and (
      public.is_workspace_admin()
      or team_id in (
        select team_id from public.team_member
         where user_id = public.current_user_id() and status = 'active'
      )
    )
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-models')
  );
