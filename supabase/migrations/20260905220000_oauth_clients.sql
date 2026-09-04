-- Circle SSO spike (docs/spike-circle-sso.md): The Fibre as a minimal OAuth2
-- provider, shaped to fit Circle.so's "WordPress (WP-OAuth)" SSO preset.
--
-- Two tables, both credential-adjacent, both service-role only (the
-- membership_settings / Connections-SPoT precedent): RLS enabled, NO
-- authenticated policies. All access goes through the API's adminClient in
-- apps/api/src/routes/oauth-provider.ts, which filters explicitly.
--
-- No admin surface this spike — oauth_client rows are inserted by hand.
-- Provisioning SQL lives in docs/spike-circle-sso.md.

-- 1 · Registered OAuth clients (one row ≈ one Circle community) ------------

create table public.oauth_client (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspace(id) on delete cascade,
  name               text not null,
  client_id          text not null unique,
  -- sha256 hex of the client secret — the secret itself is never stored
  -- (same rule as app_key.token_hash).
  client_secret_hash text not null,
  redirect_uris      text[] not null default '{}',
  created_at         timestamptz not null default now()
);
create index oauth_client_ws on public.oauth_client (workspace_id);

-- 2 · Single-use authorization codes (60s TTL, marked used on exchange) ----

create table public.oauth_code (
  code         text primary key,
  client_id    text not null,
  member_email text not null,
  redirect_uri text not null,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- 3 · RLS: enabled, no policies — service role only ------------------------

alter table public.oauth_client enable row level security;
alter table public.oauth_code   enable row level security;

comment on table public.oauth_client is
  'OAuth2 clients (Circle SSO spike). Service-role only: RLS enabled, no policies. Provisioned by hand — see docs/spike-circle-sso.md.';
comment on table public.oauth_code is
  'Single-use OAuth2 authorization codes, 60s expiry. Service-role only.';
