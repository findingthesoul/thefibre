-- ============================================================================
-- thread_engagement gains source_app / source_ref.
--
-- Step 1 of §8 in docs/brief-thread-engagements-from-apps.md. Everything on the
-- app-facing engagement surface depends on this, so it lands first and alone.
--
-- WHY, in the brief's own terms:
--
-- IDEMPOTENCY. Publishing a thread is already idempotent on program.source_ref
-- (20260824170000), because a retried publish must not create a second public
-- page. The same has to be true one level down: a retried sync of a message
-- sequence must not create a second welcome email. thread_engagement had no way
-- to say "this is the same item you already have".
--
-- ANCHORING. trigger_engagement_id names another engagement. A planner laying
-- down "opening ceremony" and "reminder, two days before the opening ceremony"
-- in one sync has to name the first from inside the second, before it has been
-- told the first's platform id. With source_ref it can name its own id and the
-- server resolves it.
--
-- WHY NOT app_record_link. Its platform_entity is CHECK-constrained to
-- person / organisation / user (20260517100000_app_entity_mapping.sql:35-36).
-- Widening that to cover thread content would turn the entity-mapping table
-- into a general id registry — a larger and worse change than two columns here.
--
-- Scoped per THREAD, not per workspace, unlike program_source_ref_idx: an
-- engagement only means anything inside its thread, and two festivals may well
-- both call their opening message the same thing on the app's side.
-- ============================================================================

alter table public.thread_engagement
  add column if not exists source_app text,
  add column if not exists source_ref uuid;

-- Partial, because the overwhelming majority of engagements are written by a
-- person in The Thread's own editor and carry neither column.
create unique index if not exists thread_engagement_source_ref_idx
  on public.thread_engagement (thread_id, source_app, source_ref)
  where source_app is not null and source_ref is not null;

create index if not exists thread_engagement_source_app_idx
  on public.thread_engagement (source_app)
  where source_app is not null;

comment on column public.thread_engagement.source_app is
  'Slug of the external app that created this engagement, when one did. NULL for engagements written by a person in The Thread. Mirrors program.source_app.';
comment on column public.thread_engagement.source_ref is
  'That app''s own id for this item. Unique per (thread, source_app) — see thread_engagement_source_ref_idx — which is what makes an app''s create idempotent, and what lets one engagement anchor to another by the app''s own id before the platform id exists.';
