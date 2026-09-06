-- Cross-apex SSO handoff codes (the thethread.app domain split): a signed-in
-- user hopping from an app on one apex to an app on the other carries their
-- session via a single-use 60-second code — minted by POST /api/v1/sso/handoff,
-- claimed by POST /api/v1/sso/redeem (apps/api/src/routes/sso.ts), which
-- exchanges it for a Supabase magic-link token_hash (no email sent).
--
-- Service-role only (the oauth_code precedent, 20260905220000): RLS enabled,
-- NO policies. All access goes through the API's adminClient with explicit
-- filters. Rows are dead 60 seconds after creation; no cleanup job — the
-- table stays tiny and stale rows are inert (expires_at is checked on claim).

create table public.sso_handoff (
  code       text primary key,
  -- auth.users.id of the initiating user (audit; the code itself is the
  -- bearer credential, deliberately like oauth_code.member_email).
  user_id    uuid not null,
  email      text not null,
  -- public.app.slug of the app allowed to redeem this code.
  target_app text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table public.sso_handoff enable row level security;

comment on table public.sso_handoff is
  'Single-use cross-apex SSO handoff codes, 60s expiry. Service-role only: RLS enabled, no policies. See apps/api/src/routes/sso.ts.';
