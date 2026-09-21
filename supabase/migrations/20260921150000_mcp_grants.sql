-- ---------------------------------------------------------------------------
-- The Fibre in a person's own assistant — docs/mcp-personal-access-plan.md.
--
-- A person connects Claude (or another MCP client) to their account. The
-- connection is a GRANT: one person, one workspace, one client, a few scopes,
-- and the credential that lets the API act as that person — a dedicated
-- Supabase session's refresh token, encrypted the way workspace model keys
-- already are (lib/secret-box.ts, key-id byte, ASSISTANT_KEY_SECRET root).
-- Every MCP call turns it into a fresh user JWT, so every existing route runs
-- under the person's own RLS unchanged.
--
-- Three pieces:
--   1. oauth_client grows a KIND. The Circle SSO clients stay 'sso' (secret,
--      one workspace). MCP clients register themselves (RFC 7591), carry no
--      secret (public clients, PKCE), and belong to no workspace.
--   2. oauth_code carries what the MCP flow needs to finish the exchange:
--      the PKCE challenge, the scopes, and the grant it will activate.
--   3. mcp_grant — the connection itself. Service-role only: RLS on, no
--      policies. The API returns the refresh token once and stores its hash.
-- ---------------------------------------------------------------------------

-- 1 · Clients: two kinds --------------------------------------------------------

alter table public.oauth_client
  add column if not exists kind text not null default 'sso'
    check (kind in ('sso', 'mcp')),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  alter column client_secret_hash drop not null,
  alter column workspace_id drop not null;

comment on column public.oauth_client.kind is
  'sso = a Circle-style client with a secret, bound to one workspace. mcp = a self-registered MCP client (Claude, ChatGPT…): public, PKCE, no workspace — the workspace is chosen per grant at consent.';
comment on column public.oauth_client.metadata is
  'What the client said about itself at registration (client_name, client_uri, logo_uri, software_id). Shown on the consent page; never trusted for anything else.';

-- 2 · Codes: what the exchange needs ---------------------------------------------

alter table public.oauth_code
  add column if not exists grant_id uuid,
  add column if not exists code_challenge text,
  add column if not exists code_challenge_method text,
  add column if not exists scope text,
  add column if not exists resource text;

-- 3 · Grants ----------------------------------------------------------------------

create table if not exists public.mcp_grant (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references public."user"(id) on delete cascade,
  workspace_id               uuid not null references public.workspace(id) on delete cascade,
  client_id                  text not null,
  client_name                text not null,
  scopes                     text[] not null default '{}',
  -- The dedicated Supabase session's refresh token: base64(kid || iv || ct || tag).
  session_refresh_ciphertext text not null,
  -- The OAuth refresh token The Fibre handed the client, sha256 hex. Null until
  -- the code is exchanged; rotated on every use.
  refresh_token_hash         text unique,
  refresh_token_expires_at   timestamptz,
  created_at                 timestamptz not null default now(),
  activated_at               timestamptz,
  last_used_at               timestamptz,
  revoked_at                 timestamptz
);
create index if not exists mcp_grant_user_idx on public.mcp_grant (user_id, created_at desc);

alter table public.mcp_grant enable row level security;
-- No policies on purpose: a credential table. The API lists a person's own
-- grants through /api/v1/mcp-auth/grants with an explicit user_id filter.

comment on table public.mcp_grant is
  'A person''s connection of an MCP client (their own Claude, ChatGPT…) to their account: one workspace, a few scopes, and an encrypted dedicated Supabase session so the API can act as them under their own RLS. Service-role only.';
