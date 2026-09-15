-- ---------------------------------------------------------------------------
-- The in-app assistant: who may use it, on whose key, within what budget.
-- docs/assistant-in-app.md §1.4 + §6.2, decided by Sjoerd 2026-09-15:
--   Free — no assistant. Starter and Pro — an allowance on the platform's
--   key. Any workspace may bring its own Anthropic key, which lifts the
--   allowance and moves the bill to them. A daily token budget protects the
--   platform key throughout.
--
-- Three pieces:
--   1. assistant_usage — tokens per workspace per day. One row per
--      (workspace, day); the API adds to it after every turn and reads it
--      before one. Members may see their own workspace's rows (a bill is not
--      a secret from the people it covers); writes are service-role only.
--   2. workspace_assistant — the workspace's own model key, ENCRYPTED by the
--      API (AES-256-GCM, key derived from SSO_INTERNAL_SECRET; see
--      lib/assistant/secret.ts). Service-role only, RLS with NO policies, same
--      treatment as user_connection and app_key. Unlike an app key this one
--      cannot be hashed: the API needs the plaintext to call the model. It is
--      shown once, kept as a 4-character hint, and never logged.
--   3. Plan features — `assistant` (flag) and `assistant_tokens_day` (limit)
--      on billing_plan.features, editable on /admin/plans like every other
--      feature key. Seeded here for the tiers that exist; Free gets neither.
-- ---------------------------------------------------------------------------

-- 1 · Usage per workspace per day ------------------------------------------

create table if not exists public.assistant_usage (
  workspace_id   uuid not null references public.workspace(id) on delete cascade,
  day            date not null,
  turns          integer not null default 0,
  input_tokens   bigint  not null default 0,
  output_tokens  bigint  not null default 0,
  -- Which key paid: 'platform' or 'workspace'. Split so a workspace that
  -- brings its own key later still shows what the platform carried before.
  source         text not null default 'platform' check (source in ('platform', 'workspace')),
  updated_at     timestamptz not null default now(),
  primary key (workspace_id, day, source)
);
create index if not exists assistant_usage_workspace_idx on public.assistant_usage (workspace_id, day desc);

alter table public.assistant_usage enable row level security;
drop policy if exists "assistant_usage read" on public.assistant_usage;
create policy "assistant_usage read" on public.assistant_usage
  for select to authenticated
  using (workspace_id in (
    select wm.workspace_id from public.workspace_member wm where wm.user_id = auth.uid()
  ));

comment on table public.assistant_usage is
  'Tokens the in-app assistant used, per workspace per day per paying key. Written by the API after every turn; read before one to enforce the daily budget on the platform key.';

-- 2 · A workspace''s own model key ------------------------------------------

create table if not exists public.workspace_assistant (
  workspace_id    uuid primary key references public.workspace(id) on delete cascade,
  -- base64: iv || ciphertext || tag. Decrypted only inside the API process.
  key_ciphertext  text not null,
  -- The last four characters, for "…a1b2 is connected". Never more.
  key_hint        text not null,
  added_by        uuid references public."user"(id) on delete set null,
  added_at        timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.workspace_assistant enable row level security;
-- No policies on purpose: nobody reads a credential through PostgREST.

comment on table public.workspace_assistant is
  'A workspace''s own Anthropic API key for the in-app assistant, encrypted by the API. Service-role only. Its presence lifts the platform allowance and moves the bill to the workspace.';

-- 3 · Plan features -----------------------------------------------------------

-- Free stays as it is: no `assistant` key, so can() answers false.
update public.billing_plan
   set features = coalesce(features, '{}'::jsonb)
                  || jsonb_build_object('assistant', true, 'assistant_tokens_day', 200000)
 where id in ('starter', 'pro')
   and not (coalesce(features, '{}'::jsonb) ? 'assistant');

update public.billing_plan
   set features = coalesce(features, '{}'::jsonb)
                  || jsonb_build_object('assistant', true, 'assistant_tokens_day', 1000000)
 where id in ('org', 'enterprise')
   and not (coalesce(features, '{}'::jsonb) ? 'assistant');
