-- ============================================================================
-- What this workspace calls its axes, and which ones it uses at all.
--
-- Sjoerd, 2026-09-13: *"the whole categorisation should be editible. Which
-- charatceristics and how many. The characteristics of the landscape"* — and,
-- a moment later, *"And the title too"*.
--
-- This is the sibling of connections_band_label (20260912190000), one level
-- up. That table let a workspace name the BANDS on an axis; this one lets it
-- name the AXIS, and say whether that axis appears at all.
--
-- ── The same split as the bands, held deliberately ─────────────────────────
--
-- The rules stay derived. There is no column here that says what earns a
-- band, and none that invents an axis out of a predicate somebody typed. What
-- this table adds is vocabulary and visibility:
--
--   title    what this workspace calls the axis. Pure vocabulary, exactly
--            like a band name: renaming "Opportunity" to "Pipeline" cannot
--            make a single number wrong, because nothing computes on it.
--   hidden   whether the axis appears in the picker. A workspace that sells
--            nothing does not want an Opportunity axis on screen, and a
--            community that runs no events has nothing in Contribution. This
--            does NOT stop the axis being computed — the function is
--            unchanged, the query still answers — it says "not on my screen".
--
-- Hiding is not the same as deleting, and the difference is the reason this
-- is a boolean and not a delete: the rule still exists, so unhiding tomorrow
-- shows a complete and correct history rather than an axis that starts empty
-- on the day it is switched back on.
--
-- ── Why "how many" stops here, for now ─────────────────────────────────────
--
-- Sjoerd's desire was "which characteristics and HOW MANY", and hiding
-- answers half of that honestly: a workspace chooses how many of the five it
-- reads. Inventing a SIXTH is a different decision and is not in this
-- migration, because a new axis needs a rule, and a rule a workspace writes
-- is a rule a workspace has to maintain — the exact failure
-- connections-model.md was written to avoid, and the one the band_label
-- header already refused once.
--
-- There is an honest shape for it and it is already in this codebase: the
-- `closeness` axis is RATED by a human, not derived, and it tells the truth
-- about being so — `unrated` is a visible band rather than a silent default,
-- and the axis reports no movement because no history exists. A user-defined
-- axis of that kind invents no rules and lies about nothing. That is the
-- proposal in docs/build-plan.md; it is not built here.
--
-- ── No CHECK on axis ───────────────────────────────────────────────────────
--
-- Same reasoning as connections_band_label, verbatim: a CHECK would make
-- adding an axis a schema migration, and the vocabulary has one home in
-- apps/connections/app/(app)/landscape/axes.ts. A row naming an axis that no
-- longer exists is inert.
-- ============================================================================

create table if not exists public.connections_axis_label (
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  axis         text not null,
  -- Null means "use the shipped translation". An empty string would be a
  -- second way to say the same thing, and two ways to say one thing is how
  -- a fallback starts disagreeing with itself; the API rejects empty.
  title        text,
  hidden       boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public."user"(id),
  primary key (workspace_id, axis)
);

comment on table public.connections_axis_label is
  'Per-workspace title for a landscape axis, and whether it is shown. Vocabulary and visibility only — what earns a band is derived in connections_landscape/connections_landscape_axis and is deliberately not configurable. An absent row means "shipped name, visible".';

comment on column public.connections_axis_label.hidden is
  'Not shown in the picker. The axis is still computed and its history is intact, so unhiding restores a complete axis rather than an empty one.';

alter table public.connections_axis_label enable row level security;

-- Read: anybody in the workspace with Connections — every surface that
-- renders the picker needs these. Write: admins only, because an axis title
-- and which axes exist is shared vocabulary for the whole team, not a
-- personal preference. Identical to connections_band_label on purpose: two
-- neighbouring tables with different rules is a question nobody can answer
-- later.
drop policy if exists connections_axis_label_read on public.connections_axis_label;
create policy connections_axis_label_read on public.connections_axis_label
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-sales')
  );

drop policy if exists connections_axis_label_write on public.connections_axis_label;
create policy connections_axis_label_write on public.connections_axis_label
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
