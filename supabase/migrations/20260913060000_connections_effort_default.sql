-- ============================================================================
-- How long things take, per workspace. Step 6b, connections-overview.md §3.
--
-- An estimate on a piece of work turns Today from a list into a plan: "next
-- week holds four meetings and six hours of preparation" is a sentence a
-- facilitator can act on, and nothing in Fibre could say it before this.
--
-- ── The trap this table is shaped to avoid ─────────────────────────────────
--
-- Asking for an estimate is a threshold, and a task form that demands a
-- number before it accepts the task is how people stop writing tasks down
-- (connections-data-integrity.md §7.2: default from context, never ask). So
-- there is NO estimate column on flow_task. Work carries its KIND's default,
-- the kind is already known from where the work came from, and a workspace
-- adjusts the default in one place — a facilitator who needs forty minutes
-- to prepare a session changes it once, not on every task.
--
-- ── Sparse, like connections_band_label ────────────────────────────────────
--
-- The shipped defaults live in apps/api/src/lib/effort.ts. A row here means
-- "this workspace disagrees"; an absent row means "use the default". A
-- workspace that changes two kinds stores two rows, and a later change to a
-- shipped default reaches every workspace that never overrode it.
--
-- No CHECK on `kind`, for the band-label reason: the vocabulary has one home
-- in code, and a constraint would turn a new kind into a schema migration. A
-- row naming a kind that no longer exists is inert.
--
-- Not learned from completion times, deliberately (§3): a task marked done
-- three days late was not a three-day task, and the value over a decent
-- default is small until there are thousands of completions.
-- ============================================================================

create table if not exists public.connections_effort_default (
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  kind         text not null,
  -- A day is the ceiling: an estimate longer than that is a project, and a
  -- project is not a row on Today.
  minutes      integer not null check (minutes between 0 and 1440),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public."user"(id),
  primary key (workspace_id, kind)
);

comment on table public.connections_effort_default is
  'Per-workspace minutes per kind of work on Today. Sparse: an absent row means the shipped default in apps/api/src/lib/effort.ts. There is deliberately no per-task estimate — asking for one is a threshold (connections-overview.md §3).';

alter table public.connections_effort_default enable row level security;

-- Read: anyone in the workspace with Connections, because Today shows the
-- numbers to everybody. Write: admins, because a default is shared — changing
-- it changes every colleague's week.
drop policy if exists connections_effort_default_read on public.connections_effort_default;
create policy connections_effort_default_read on public.connections_effort_default
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-sales')
  );

drop policy if exists connections_effort_default_write on public.connections_effort_default;
create policy connections_effort_default_write on public.connections_effort_default
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-sales')
    and public.current_workspace_role() in ('super_admin', 'admin')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-sales')
    and public.current_workspace_role() in ('super_admin', 'admin')
  );
