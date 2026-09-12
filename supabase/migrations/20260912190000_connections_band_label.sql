-- ============================================================================
-- What this workspace calls the bands.
--
-- Sjoerd, 2026-09-12, on being shown the six lifecycle steps: *"those six
-- steps... not sure where they came from. Can they be edited?"* They came
-- from me, written on 2026-09-11 and unreviewed since. The answer he chose
-- is the one this table implements: the RULES stay fixed, the NAMES become
-- the workspace's own.
--
-- The distinction is the whole design and it is worth stating plainly.
--
--   The rules are derived from what actually happened — attendance,
--   purchases, membership, who runs a thread — which is why the landscape
--   was useful on the day it shipped and asked nobody to fill anything in.
--   A workspace that could rewrite the rules would have to MAINTAIN them,
--   and a hand-maintained ladder is wrong within a month. That is the exact
--   failure connections-model.md was written to avoid, and this table does
--   not open a door to it: there is no way to say what earns a band, only
--   what a band is called.
--
--   The names carry community vocabulary and nothing depends on them.
--   "Holds space" may be "convenes" at soul.com and something else again at
--   EBBF. Renaming one cannot make any number wrong.
--
-- Keyed by (workspace, axis, band) rather than by the maturity ladder alone,
-- because all five axes have band names and a rename mechanism that covered
-- only one of them would be an arbitrary distinction to explain. The rows
-- are sparse: an unnamed band falls back to the shipped translation, so a
-- workspace that renames two of twenty-two stores two rows.
--
-- ── Not translated, deliberately ────────────────────────────────────────────
--
-- One label per band, no locale column. The shipped names live in a typed
-- catalog in six languages; a name a workspace TYPED is content, and this
-- codebase does not translate content (CLAUDE.md: budget line names,
-- scenario names, notes and anything else the user typed). A workspace that
-- renames a band has chosen a word, and showing that word to everyone is
-- more honest than machine-translating somebody's own vocabulary.
--
-- ── No CHECK on axis or band ────────────────────────────────────────────────
--
-- Same reasoning as person.created_via: a CHECK constraint here would make
-- adding an axis a schema migration, and the vocabulary already has one home
-- in apps/connections/app/(app)/landscape/axes.ts. A row naming a band that
-- no longer exists is inert — nothing reads it — and is cheaper than a
-- constraint that has to be dropped and re-added to ship a new axis.
-- ============================================================================

create table if not exists public.connections_band_label (
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  axis         text not null,
  band         text not null,
  label        text not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public."user"(id),
  primary key (workspace_id, axis, band)
);

comment on table public.connections_band_label is
  'Per-workspace names for landscape bands. Names only — what EARNS a band is derived in connections_landscape/connections_landscape_axis and is deliberately not configurable. An absent row means "use the shipped translation".';

alter table public.connections_band_label enable row level security;

-- Read: anybody in the workspace with Connections, because every surface that
-- renders a band needs the name. Write: admins only — this is shared
-- vocabulary, and one person renaming "contributes" changes what the whole
-- team reads on every screen.
drop policy if exists connections_band_label_read on public.connections_band_label;
create policy connections_band_label_read on public.connections_band_label
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-sales')
  );

drop policy if exists connections_band_label_write on public.connections_band_label;
create policy connections_band_label_write on public.connections_band_label
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
