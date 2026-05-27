-- ============================================================================
-- Fibre Flow — Phase B1: schema + app registration.
--
-- Sibling app to Meet and Thread. Consumes platform primitives natively
-- (person, organisation, team, workspace, activity, app_membership).
-- All tables live in public with the `flow_` prefix, matching Meet's pattern.
--
-- See docs/fibreflow-data-model.md for the conceptual model and
-- docs/fibreflow-build-plan.md for the rollout sequence.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Register the app
-- ---------------------------------------------------------------------------
alter table public.app drop constraint if exists app_slug_check;

insert into public.app (slug, name, base_url) values
  ('fibre-flow', 'Fibre Flow', 'https://flow.thefibre.app')
on conflict (slug) do nothing;

alter table public.app
  add constraint app_slug_check
  check (slug in (
    'fibre-platform','fibre-meet','the-thread',
    'fibre-sales','fibre-learn','fibre-flow'
  ));

-- ---------------------------------------------------------------------------
-- 2. flow_definition — the flow itself (a named, scoped, lifecycle-managed
--    container). Versions of the graph live in flow_version.
-- ---------------------------------------------------------------------------
create table public.flow_definition (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  name            text not null,
  description     text,
  scope           text not null
                    check (scope in ('personal','team','workspace')),
  owner_user_id   uuid not null references public."user"(id),
  team_id         uuid references public.team(id) on delete cascade,
  visibility      text not null default 'members_only'
                    check (visibility in ('members_only','org_wide')),
  lifecycle       text not null default 'draft'
                    check (lifecycle in ('draft','active','closed','archived')),
  current_version_id uuid,  -- FK added after flow_version exists
  created_at      timestamptz not null default now(),
  created_by      uuid not null references public."user"(id),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  -- Personal scope: must have an owner, must not have a team.
  -- Team scope:     must have a team.
  -- Workspace scope: no team.
  check ((scope = 'team') = (team_id is not null))
);
create index flow_definition_workspace_idx on public.flow_definition (workspace_id) where deleted_at is null;
create index flow_definition_team_idx      on public.flow_definition (team_id)      where team_id is not null;
create index flow_definition_owner_idx     on public.flow_definition (owner_user_id);

-- ---------------------------------------------------------------------------
-- 3. flow_version — an immutable-once-published snapshot of the graph.
--    Editing a Draft flow creates a new version row. Published versions are
--    immutable so flow_run rows can pin to the version they entered.
-- ---------------------------------------------------------------------------
create table public.flow_version (
  id              uuid primary key default gen_random_uuid(),
  flow_id         uuid not null references public.flow_definition(id) on delete cascade,
  version_number  int  not null,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid not null references public."user"(id),
  unique (flow_id, version_number)
);
create index flow_version_flow_idx on public.flow_version (flow_id);

alter table public.flow_definition
  add constraint flow_definition_current_version_fk
  foreign key (current_version_id) references public.flow_version(id);

-- ---------------------------------------------------------------------------
-- 4. flow_step — a state in the graph. Keyed by `key` within a version so
--    transitions can reference steps by stable identifier.
-- ---------------------------------------------------------------------------
create table public.flow_step (
  id              uuid primary key default gen_random_uuid(),
  flow_version_id uuid not null references public.flow_version(id) on delete cascade,
  key             text not null,
  name            text not null,
  description     text,
  kind            text not null default 'normal'
                    check (kind in ('entry','normal','end_positive','end_negative')),
  expected_duration_days int,
  default_assignee_role  text,
  canvas_x        real,
  canvas_y        real,
  ordinal         int not null default 0,
  unique (flow_version_id, key)
);
create index flow_step_version_idx on public.flow_step (flow_version_id);

-- ---------------------------------------------------------------------------
-- 5. flow_transition — directed edge between steps, with its own gate.
-- ---------------------------------------------------------------------------
create table public.flow_transition (
  id              uuid primary key default gen_random_uuid(),
  flow_version_id uuid not null references public.flow_version(id) on delete cascade,
  from_step_id    uuid not null references public.flow_step(id) on delete cascade,
  to_step_id      uuid not null references public.flow_step(id) on delete cascade,
  label           text not null,
  gate_logic      text not null default 'all'
                    check (gate_logic in ('all','any')),
  ordinal         int not null default 0,
  check (from_step_id <> to_step_id)
);
create index flow_transition_version_idx on public.flow_transition (flow_version_id);
create index flow_transition_from_idx    on public.flow_transition (from_step_id);

-- ---------------------------------------------------------------------------
-- 6. flow_gate_task — task template attached to a transition. Materialises
--    into a real flow_task when a flow_run enters the source step.
-- ---------------------------------------------------------------------------
create table public.flow_gate_task (
  id              uuid primary key default gen_random_uuid(),
  transition_id   uuid not null references public.flow_transition(id) on delete cascade,
  title           text not null,
  description     text,
  actor_type      text not null
                    check (actor_type in ('personal','team','contact')),
  default_assignee_role text,
  contact_action_type   text,                -- non-null iff actor_type='contact'
  required        boolean not null default true,
  ordinal         int not null default 0,
  check (
    (actor_type = 'contact' and contact_action_type is not null)
    or (actor_type <> 'contact' and contact_action_type is null)
  )
);
create index flow_gate_task_transition_idx on public.flow_gate_task (transition_id);

-- ---------------------------------------------------------------------------
-- 7. flow_step_default_task — task templates that materialise into real
--    flow_tasks when a flow_run lands on the step (not tied to a transition).
-- ---------------------------------------------------------------------------
create table public.flow_step_default_task (
  id              uuid primary key default gen_random_uuid(),
  step_id         uuid not null references public.flow_step(id) on delete cascade,
  title           text not null,
  description     text,
  actor_type      text not null
                    check (actor_type in ('personal','team','contact')),
  default_assignee_role text,
  due_days_after_entry  int,
  ordinal         int not null default 0
);
create index flow_step_default_task_step_idx on public.flow_step_default_task (step_id);

-- ---------------------------------------------------------------------------
-- 8. flow_run — a contact's journey through one flow. Snapshots the version
--    on entry; re-entry creates a fresh row (no unique on (flow_id, person_id)).
-- ---------------------------------------------------------------------------
create table public.flow_run (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  flow_id         uuid not null references public.flow_definition(id),
  flow_version_id uuid not null references public.flow_version(id),
  person_id       uuid not null references public.person(id) on delete cascade,
  organisation_id uuid references public.organisation(id) on delete set null,
  current_step_id uuid not null references public.flow_step(id),
  owner_user_id   uuid references public."user"(id),
  status          text not null default 'active'
                    check (status in ('active','completed','withdrawn')),
  entered_at      timestamptz not null default now(),
  current_step_entered_at timestamptz not null default now(),
  completed_at    timestamptz,
  withdrawn_reason text,
  deleted_at      timestamptz
);
create index flow_run_workspace_idx     on public.flow_run (workspace_id) where deleted_at is null;
create index flow_run_person_idx        on public.flow_run (person_id)    where deleted_at is null;
create index flow_run_flow_idx          on public.flow_run (flow_id)      where deleted_at is null;
create index flow_run_current_step_idx  on public.flow_run (current_step_id) where status = 'active';
create index flow_run_owner_idx         on public.flow_run (owner_user_id)   where status = 'active';

-- ---------------------------------------------------------------------------
-- 9. flow_task — the actual to-do row. Materialised from gate templates or
--    step defaults, or created manually (flow_run_id null).
-- ---------------------------------------------------------------------------
create table public.flow_task (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  flow_run_id     uuid references public.flow_run(id) on delete cascade,
  gate_task_id    uuid references public.flow_gate_task(id) on delete set null,
  step_default_task_id uuid references public.flow_step_default_task(id) on delete set null,
  title           text not null,
  description     text,
  actor_type      text not null
                    check (actor_type in ('personal','team','contact')),
  assignee_user_id uuid references public."user"(id) on delete set null,
  assignee_team_id uuid references public.team(id)   on delete set null,
  contact_id      uuid references public.person(id) on delete cascade,
  organisation_id uuid references public.organisation(id) on delete set null,
  due_at          timestamptz,
  status          text not null default 'open'
                    check (status in ('open','in_progress','done','cancelled')),
  completed_at    timestamptz,
  completed_by    uuid references public."user"(id) on delete set null,
  created_at      timestamptz not null default now(),
  created_by      uuid not null references public."user"(id),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index flow_task_workspace_idx on public.flow_task (workspace_id) where deleted_at is null;
create index flow_task_assignee_idx  on public.flow_task (assignee_user_id, status)
  where deleted_at is null;
create index flow_task_contact_idx   on public.flow_task (contact_id) where deleted_at is null;
create index flow_task_due_idx       on public.flow_task (due_at)
  where status in ('open','in_progress');
create index flow_task_run_idx       on public.flow_task (flow_run_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 10. flow_document_link — Google Drive / Docs URL attached to a person, org,
--     flow step, or flow run. Manual paste, no OAuth picker in v1.
-- ---------------------------------------------------------------------------
create table public.flow_document_link (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id) on delete cascade,
  url             text not null,
  title           text,
  attached_to     text not null
                    check (attached_to in ('person','organisation','flow_step','flow_run')),
  person_id       uuid references public.person(id) on delete cascade,
  organisation_id uuid references public.organisation(id) on delete cascade,
  step_id         uuid references public.flow_step(id) on delete cascade,
  flow_run_id     uuid references public.flow_run(id) on delete cascade,
  created_at      timestamptz not null default now(),
  created_by      uuid not null references public."user"(id),
  deleted_at      timestamptz,
  check (
    (attached_to = 'person'       and person_id       is not null) or
    (attached_to = 'organisation' and organisation_id is not null) or
    (attached_to = 'flow_step'    and step_id         is not null) or
    (attached_to = 'flow_run'     and flow_run_id     is not null)
  )
);
create index flow_document_link_person_idx on public.flow_document_link (person_id)
  where person_id is not null and deleted_at is null;
create index flow_document_link_org_idx    on public.flow_document_link (organisation_id)
  where organisation_id is not null and deleted_at is null;
create index flow_document_link_step_idx   on public.flow_document_link (step_id)
  where step_id is not null and deleted_at is null;
create index flow_document_link_run_idx    on public.flow_document_link (flow_run_id)
  where flow_run_id is not null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- 11. updated_at triggers
-- ---------------------------------------------------------------------------
create trigger flow_definition_updated_at
  before update on public.flow_definition
  for each row execute function public.set_updated_at();

create trigger flow_task_updated_at
  before update on public.flow_task
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 12. RLS — workspace + scope + visibility, mirroring v0.9.0 Meet pattern.
-- ---------------------------------------------------------------------------
alter table public.flow_definition         enable row level security;
alter table public.flow_version            enable row level security;
alter table public.flow_step               enable row level security;
alter table public.flow_transition         enable row level security;
alter table public.flow_gate_task          enable row level security;
alter table public.flow_step_default_task  enable row level security;
alter table public.flow_run                enable row level security;
alter table public.flow_task               enable row level security;
alter table public.flow_document_link      enable row level security;

-- 12a. flow_definition: visibility depends on scope.
create policy flow_definition_scope on public.flow_definition
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
    and deleted_at is null
    and (
      scope = 'workspace'
      or (scope = 'personal' and owner_user_id = public.current_user_id())
      or (scope = 'team' and team_id in (
        select team_id from public.team_member
         where user_id = public.current_user_id() and status = 'active'
      ))
    )
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
  );

-- 12b. flow_version / step / transition / gate_task / step_default_task:
-- visibility derives from the parent flow_definition. We piggy-back on the
-- definition's RLS by joining through it in an EXISTS predicate.
create policy flow_version_via_definition on public.flow_version
  for all to authenticated
  using (
    exists (
      select 1 from public.flow_definition d
       where d.id = flow_version.flow_id
    )
  )
  with check (
    exists (
      select 1 from public.flow_definition d
       where d.id = flow_version.flow_id
    )
  );

create policy flow_step_via_version on public.flow_step
  for all to authenticated
  using (
    exists (
      select 1 from public.flow_version v
       where v.id = flow_step.flow_version_id
    )
  )
  with check (
    exists (
      select 1 from public.flow_version v
       where v.id = flow_step.flow_version_id
    )
  );

create policy flow_transition_via_version on public.flow_transition
  for all to authenticated
  using (
    exists (
      select 1 from public.flow_version v
       where v.id = flow_transition.flow_version_id
    )
  )
  with check (
    exists (
      select 1 from public.flow_version v
       where v.id = flow_transition.flow_version_id
    )
  );

create policy flow_gate_task_via_transition on public.flow_gate_task
  for all to authenticated
  using (
    exists (
      select 1 from public.flow_transition t
       where t.id = flow_gate_task.transition_id
    )
  )
  with check (
    exists (
      select 1 from public.flow_transition t
       where t.id = flow_gate_task.transition_id
    )
  );

create policy flow_step_default_task_via_step on public.flow_step_default_task
  for all to authenticated
  using (
    exists (
      select 1 from public.flow_step s
       where s.id = flow_step_default_task.step_id
    )
  )
  with check (
    exists (
      select 1 from public.flow_step s
       where s.id = flow_step_default_task.step_id
    )
  );

-- 12c. flow_run: workspace + has_app_membership + parent flow visible.
create policy flow_run_scope on public.flow_run
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
    and deleted_at is null
    and exists (
      select 1 from public.flow_definition d
       where d.id = flow_run.flow_id
    )
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
  );

-- 12d. flow_task: workspace + has_app_membership + (assignee OR in a visible run OR creator).
create policy flow_task_scope on public.flow_task
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
    and deleted_at is null
    and (
      assignee_user_id = public.current_user_id()
      or created_by    = public.current_user_id()
      or flow_run_id in (select id from public.flow_run)   -- inherits flow_run's RLS
      or (assignee_team_id is not null and assignee_team_id in (
        select team_id from public.team_member
         where user_id = public.current_user_id() and status = 'active'
      ))
    )
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
  );

-- 12e. flow_document_link: workspace + has_app_membership; refinement via attachment.
create policy flow_document_link_scope on public.flow_document_link
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
    and deleted_at is null
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
  );
