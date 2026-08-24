-- ============================================================================
-- v0.17.0 — flow_step gains grouping and app-defined metadata.
--
-- docs/brief-flow-as-planner-engine.md gaps 3 and 4, the last two structural
-- gaps under the Festival planner.
--
-- Gap 3 — no phase grouping. The planner's nine steps fall into three phases
-- (orientation 1–3, doing 4–6, culmination 7–9) which drive its whole visual
-- system, and `flow_step` had `ordinal`, `kind`, `canvas_x/y` and nothing to
-- say "these three belong together". Any flow long enough to need sections
-- wants this, so it is a platform column rather than app metadata.
--
-- Gap 4 — steps carry one description, the planner needs three: a purpose
-- (one-line intent), a trap ("watch for"), and a reflection (open question).
--
-- `meta jsonb` rather than purpose/trap/reflection columns, deliberately.
-- Hard-coding one app's three fields into the platform's step table invites
-- the next app's four; the brief calls this "the curator-data problem in
-- miniature", and it is the same answer — the app justifies the field, so the
-- app carries it. `flow_step` has taken no new columns since it was created
-- (only its `kind` check widened, in 20260529230000) and that restraint is
-- worth keeping.
--
-- NOTE for whoever adds the next column here: apps/api/src/routes/flow.ts
-- WIPES AND RE-INSERTS every step when a graph is saved. A column that isn't
-- carried through GraphStep → loadGraph → stepRows is silently destroyed the
-- first time someone opens the builder and hits save. All three below are
-- wired through that round-trip in the same release.
-- ============================================================================

alter table public.flow_step
  add column if not exists group_key   text,
  add column if not exists group_label text,
  add column if not exists meta        jsonb;

-- group_key travels to external apps as an object key / CSS-ish token, so keep
-- it to a shape a consumer can use without escaping it.
alter table public.flow_step drop constraint if exists flow_step_group_key_format;
alter table public.flow_step
  add constraint flow_step_group_key_format
  check (group_key is null or group_key ~ '^[a-z][a-z0-9_-]{0,48}$');

-- An object, not an array or a bare scalar — so a consumer can always do
-- meta.whatever without type-sniffing first. Size is bounded by the API's
-- zod schema rather than a CHECK, since the obvious length test isn't
-- immutable and a trigger is more machinery than this warrants.
alter table public.flow_step drop constraint if exists flow_step_meta_is_object;
alter table public.flow_step
  add constraint flow_step_meta_is_object
  check (meta is null or jsonb_typeof(meta) = 'object');

-- Sections are read in step order, so the index that matters is the one the
-- reads already use (flow_step_version_idx). A partial index on group_key
-- helps "which sections does this version have" without carrying cost for the
-- flows — the overwhelming majority — that never group anything.
create index if not exists flow_step_group_idx
  on public.flow_step (flow_version_id, group_key)
  where group_key is not null;

comment on column public.flow_step.group_key is
  'Optional section this step belongs to, e.g. ''orientation''. Stable identifier; consumers group on this, not on group_label.';
comment on column public.flow_step.group_label is
  'Human label for group_key, e.g. ''Orientation''. Renaming it must not change group_key.';
comment on column public.flow_step.meta is
  'App-defined extra fields on a step (the planner keeps purpose/trap/reflection here). The platform never interprets these — see docs/brief-flow-as-planner-engine.md gap 4.';
