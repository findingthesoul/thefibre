-- membership_google_account
--
-- A member's Google Workspace ADDRESS (Sjoerd, 2026-10-16; plan approved by
-- the coordinator the same day). When a membership includes a Google account,
-- the member sees a SUGGESTED address (firstname.lastname@<the workspace's
-- Google domain>) and accepts it or asks for another; an ADMIN creates the
-- account by hand in Google and marks it created here. The Fibre still never
-- creates accounts (lib/google-admin.ts).
--
-- Why a row of its own: the grant worker used to manage the account at the
-- member's PERSON email, so somebody who signed up as x@gmail.com could never
-- match an account in the workspace's domain and sat in `error`. Once a row
-- here says `created`, the worker manages created_address instead.
--
-- One row per membership. RLS on, no policies: reached only through the API.

create table if not exists public.membership_google_account (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspace(id) on delete cascade,
  member_id            uuid not null unique references public.membership_member(id) on delete cascade,
  person_id            uuid not null references public.person(id) on delete cascade,
  status               text not null default 'suggested'
                         check (status in ('suggested', 'requested', 'created', 'declined')),
  suggested_address    text,
  requested_address    text,
  note                 text check (note is null or char_length(note) <= 1000),
  created_address      text,
  decline_reason       text check (decline_reason is null or char_length(decline_reason) <= 1000),
  requested_at         timestamptz,
  -- When the admins were last emailed about this row: one email per member
  -- per quiet window, however often the member changes their ask (B3's
  -- review, 2026-10-16).
  admin_notified_at    timestamptz,
  decided_at           timestamptz,
  decided_by_user_id   uuid references public."user"(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- A created row always says which address was made.
  check (status <> 'created' or created_address is not null)
);

create index if not exists membership_google_account_ws_status
  on public.membership_google_account (workspace_id, status);
-- No two memberships in a workspace may be promised the same address.
create unique index if not exists membership_google_account_ws_requested
  on public.membership_google_account (workspace_id, lower(requested_address))
  where requested_address is not null and status in ('requested', 'created');
create unique index if not exists membership_google_account_ws_created
  on public.membership_google_account (workspace_id, lower(created_address))
  where created_address is not null;

alter table public.membership_google_account enable row level security;
-- No policies on purpose: reached only through the API.
