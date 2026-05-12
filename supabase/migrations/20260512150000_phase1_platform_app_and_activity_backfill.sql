-- ============================================================================
-- Phase 1 — register the platform itself as an app and backfill user_created.
-- ============================================================================

-- Relax the slug check constraint to admit 'fibre-platform' (and future apps).
-- We rely on `app_membership` for access control, not on hard-coded slugs.
alter table public.app drop constraint if exists app_slug_check;

insert into public.app (slug, name, base_url) values
  ('fibre-platform', 'The Fibre Platform', 'https://thefibre.app')
on conflict (slug) do nothing;

-- Backfill: write a user_created activity for every existing platform user.
-- Idempotent — uses NOT EXISTS to avoid duplicates if re-run.
insert into public.activity (workspace_id, person_id, app_id, type, subject, occurred_at, created_by)
select
  u.workspace_id,
  u.person_id,
  (select id from public.app where slug = 'fibre-platform'),
  'user_created',
  'Joined the workspace',
  u.created_at,
  u.id
from public."user" u
where u.person_id is not null
  and u.deleted_at is null
  and not exists (
    select 1 from public.activity a
     where a.person_id = u.person_id
       and a.type = 'user_created'
  );
