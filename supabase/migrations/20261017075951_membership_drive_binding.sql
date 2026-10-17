-- membership_drive_binding
--
-- A Google Drive folder shown inside my.thread → Files (Sjoerd, 2026-10-17:
-- "go Drive folders"; plan agreed with the coordinator and builder 3). Slice
-- 1 of 4: this table alone; nothing reads it yet.
--
-- WHY A TABLE. The folder itself is an entry in the community's member page
-- documents (kind 'drive', folder_id, the same tier/category audience and the
-- same drag order as every other document). What cannot live there is the
-- BINDING: one service account per stack reads every community's shared
-- folders, so "the service account can see it" says nothing about whose it
-- is. A community proves control by putting a one-time code in the folder's
-- Drive description (the API reads it); the proof is recorded here, and the
-- primary key makes a folder belong to ONE workspace — a second community
-- pasting the same link is refused. That uniqueness spans workspaces, which a
-- per-workspace JSON document cannot enforce.
--
-- The one-time code is not stored: it is an HMAC over (workspace, folder,
-- the hour it was issued), recomputed when the admin presses Verify, so only
-- the PROOF needs a row.
--
-- What the app justifies (brief §5, the Members app): which folder, whose,
-- who proved it and when. Nothing about the files is stored, anywhere.
--
-- Reads: the workspace's members of the Members app (Settings shows the
-- binding). Writes: the API, service role only — verifying is a server-side
-- read of Drive.

create table public.membership_drive_binding (
  -- Google's folder id. Unique across ALL workspaces, on purpose.
  drive_folder_id  text primary key check (drive_folder_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  workspace_id     uuid not null references public.workspace(id) on delete cascade,
  -- The person who proved control. A user hard-delete must never be blocked.
  verified_by      uuid references public."user"(id) on delete set null,
  verified_at      timestamptz not null default now()
);

create index membership_drive_binding_workspace_idx on public.membership_drive_binding (workspace_id);

alter table public.membership_drive_binding enable row level security;

create policy membership_drive_binding_read on public.membership_drive_binding
  for select to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('membership'));
-- No authenticated write policy: the API writes after reading Drive.
