-- ============================================================================
-- v0.14.0 — External apps: an open catalogue, an app lifecycle, and
-- server-to-server keys with enforced scopes.
--
-- docs/brief-external-apps.md is the spec. Three changes, in that brief's
-- order:
--
--   §1  public.app stops being an allow-list. Slugs are validated by FORMAT;
--       the guard the allow-list stood in for moves onto the row itself as a
--       lifecycle (pending → approved → suspended) that can be administered
--       rather than deployed. Deliberately mirrors signup_request.
--   §2  app_key — a credential scoped to (app × workspace), so an external
--       app can act without a human's live browser session AND without the
--       user's full platform authority.
--   §3  scopes stop being decorative. A key carries them; the API enforces
--       them (apps/api/src/middleware/app-context.ts + lib/app-keys.ts).
--       This migration supplies the storage; the canonical scope vocabulary
--       lives in the API so adding a scope is a deploy, not a migration —
--       the same mistake §1 exists to undo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The catalogue opens
-- ---------------------------------------------------------------------------

-- Every app since phase 0 registered itself by dropping this constraint,
-- inserting, and re-adding it with its own slug appended — i.e. registering
-- an app was a schema migration. It stops here.
alter table public.app drop constraint if exists app_slug_check;

alter table public.app
  add constraint app_slug_format
  check (slug ~ '^[a-z][a-z0-9-]{1,48}[a-z0-9]$');

alter table public.app
  add column if not exists owner_user_id  uuid references public."user"(id),
  add column if not exists status         text not null default 'pending',
  add column if not exists kind           text not null default 'third_party',
  add column if not exists manifest       jsonb,
  add column if not exists description    text,
  add column if not exists homepage_url   text,
  add column if not exists contact_email  citext,
  add column if not exists submitted_at   timestamptz,
  add column if not exists reviewed_by    uuid references public."user"(id),
  add column if not exists reviewed_at    timestamptz,
  add column if not exists review_notes   text,
  add column if not exists created_at     timestamptz not null default now();

-- Existing in-family apps keep their standing. Must run BEFORE the check
-- constraints go on, since the column defaults land everyone on 'pending'.
update public.app
   set status = 'approved',
       kind   = 'first_party',
       reviewed_at = coalesce(reviewed_at, now())
 where status <> 'approved' or kind <> 'first_party';

alter table public.app drop constraint if exists app_status_check;
alter table public.app
  add constraint app_status_check
  check (status in ('pending','approved','suspended'));

alter table public.app drop constraint if exists app_kind_check;
alter table public.app
  add constraint app_kind_check
  check (kind in ('first_party','third_party'));

create index if not exists app_status_idx on public.app (status);
create index if not exists app_owner_idx  on public.app (owner_user_id);

-- Read policy: an approved app is reference data every authenticated user
-- needs (route handlers resolve app_id by slug all over the codebase).
-- A pending or suspended one is visible only to its submitter and to super
-- admins — the people who act on it.
drop policy if exists app_public_read on public.app;
drop policy if exists app_read_visible on public.app;
create policy app_read_visible on public.app
  for select
  to authenticated
  using (
    status = 'approved'
    or public.is_super_admin()
    or owner_user_id = public.current_user_id()
  );

-- Writes stay service-role only. Registration and review both go through the
-- API (POST /api/v1/apps, PATCH /api/v1/apps/:slug), which does its own
-- super-admin check.

-- ---------------------------------------------------------------------------
-- 1b. Activation refuses anything not approved
--
-- The gate moves from "is this slug in a hardcoded list" to "has a human
-- approved this app". A CHECK can't reach another table, so it's a trigger.
-- Only fires for rows that end up ACTIVE — deactivating a suspended app must
-- always be allowed, or a suspension would trap the workspace.
-- ---------------------------------------------------------------------------
create or replace function public.workspace_app_requires_approved_app()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_slug   text;
begin
  if new.deactivated_at is not null then
    return new;   -- deactivating, or already inactive: nothing to gate
  end if;

  select a.status, a.slug into v_status, v_slug
    from public.app a
   where a.id = new.app_id;

  if v_status is distinct from 'approved' then
    raise exception 'app % is not approved for activation (status: %)',
      coalesce(v_slug, new.app_id::text), coalesce(v_status, 'unknown')
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists workspace_app_approved_gate on public.workspace_app;
create trigger workspace_app_approved_gate
  before insert or update on public.workspace_app
  for each row execute function public.workspace_app_requires_approved_app();

-- ---------------------------------------------------------------------------
-- 2. app_key — server-to-server credentials scoped to (app × workspace)
--
-- Today an external app is handed a user-scoped Supabase JWT pulled from a
-- signed-in browser. That means no background sync, and — the serious half —
-- a third-party app holding the USER's full platform authority in every app,
-- regardless of what its manifest asked for. A key carries the APP's
-- authority in ONE workspace, bounded by scopes.
--
-- Credential table: service-role only, same treatment as user_connection
-- (see apps/api/src/lib/connections.ts). RLS is enabled with NO policies, so
-- authenticated reads return zero rows. The plaintext token is returned once,
-- at mint time, and never stored.
-- ---------------------------------------------------------------------------
create table if not exists public.app_key (
  id            uuid primary key default gen_random_uuid(),
  app_id        uuid not null references public.app(id) on delete cascade,
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  name          text,
  token_prefix  text not null,                    -- shown in the UI to identify a key
  token_hash    text not null unique,             -- sha256 hex; never the token itself
  scopes        text[] not null default '{}',
  created_by    uuid not null references public."user"(id),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  revoked_by    uuid references public."user"(id)
);

-- NOTE — deviation from the brief's sketch, which had unique (app_id,
-- workspace_id). That makes rotation a hard cutover: you cannot mint the
-- replacement before revoking the incumbent. Several live keys per pair are
-- allowed instead, so an app can rotate with an overlap window.
create index if not exists app_key_pair_idx
  on public.app_key (app_id, workspace_id)
  where revoked_at is null;

alter table public.app_key enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Scope vocabulary (documentation only — enforcement is in the API)
--
--   read:persons        GET person data via the app endpoints
--   write:persons       create / link persons
--   read:organisations  GET organisation data
--   write:organisations create / link organisations
--   write:activities    append to the workspace timeline
--   read:activities     read the workspace timeline
--   write:curator_data  write this app's own curator fields on a person/org
--
-- apps/api/src/lib/app-keys.ts holds the canonical list. A request outside a
-- key's scopes 403s.
-- ---------------------------------------------------------------------------

comment on column public.app_key.scopes is
  'Subset of the vocabulary in apps/api/src/lib/app-keys.ts. Enforced per request by the API, not by RLS.';
comment on column public.app.status is
  'pending → approved → suspended. Only approved apps can be activated on a workspace (workspace_app_approved_gate).';
comment on column public.app.kind is
  'first_party = in this monorepo; third_party = registered from outside via POST /api/v1/apps.';
