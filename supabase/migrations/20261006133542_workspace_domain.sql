-- workspace_domain
--
-- A domain a workspace has claimed for itself (docs/domain-package.md). Two
-- kinds: `email` — the domain its mail is sent FROM, registered with the mail
-- provider (Resend) and verified by three DNS records the customer adds; and
-- `web` — a host for its public pages (book.soul.com), registered with the
-- page host (Vercel) and verified by a CNAME. Part 1 (2026-10-06) uses
-- `email`; `web` is the same row shape so part 2 adds no table.
--
-- One row per (kind, host): a domain belongs to one workspace, and the second
-- claimant is refused by the index rather than quietly sharing a sender.
--
-- `records` is the provider's own answer — the DNS records to add, each with
-- the provider's per-record status — stored as given so the settings page
-- shows exactly what the provider will check, and so we never type a DNS
-- value by hand. `status` mirrors the provider's domain status
-- (not_started | pending | verified | failed | temporary_failure).
--
-- Machine state, service-role only, like public_root_slug: every read and
-- write goes through the API (routes/workspace-domain.ts), which checks the
-- caller is a workspace admin and the plan carries the feature. RLS is on
-- with no policies, which is "nobody but the service role".

create table public.workspace_domain (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  kind          text not null check (kind in ('email', 'web')),
  host          text not null,
  provider      text not null check (provider in ('resend', 'vercel')),
  provider_id   text,
  status        text not null default 'not_started',
  records       jsonb not null default '[]'::jsonb,
  verified_at   timestamptz,
  checked_at    timestamptz,
  created_at    timestamptz not null default now(),
  check (host = lower(trim(host)))
);
create unique index workspace_domain_kind_host_uq on public.workspace_domain (kind, host);
create index workspace_domain_workspace_idx on public.workspace_domain (workspace_id, kind);
comment on table public.workspace_domain is
  'A domain a workspace has claimed: kind email (sender, Resend) or web (public pages, Vercel). Provider state mirrored as given. Service-role only; the API is the door (docs/domain-package.md).';

alter table public.workspace_domain enable row level security;
