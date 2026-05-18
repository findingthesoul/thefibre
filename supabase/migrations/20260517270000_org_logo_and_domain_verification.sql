-- Org logo (just expose the existing column at the API boundary) +
-- DNS-based domain verification.
--
-- The `organisation` table already has `domain` and `logo_url` columns
-- (see 20260512100000_phase0_identity_and_contact_graph.sql). The UI
-- never wired logo_url, and `domain` was just a free-text field with
-- no proof of ownership. This migration adds the verification surface
-- so an org can prove it owns the domain it claims — needed for the
-- next step (auto-attribute new persons by email domain to a verified
-- org), and for trust UX on profile pages.
--
-- Design: TXT challenge. Caller asks for a challenge; we generate a
-- 24-byte random token, store it in org_domain_verification, and
-- return the TXT record name + value. Caller adds the record to
-- their DNS. Caller hits "Check" → API does `dns.resolveTxt(domain)`
-- and compares.
--
-- Only one outstanding challenge per (org, domain). Re-issuing a
-- challenge overwrites the previous one.

alter table public.organisation
  add column if not exists domain_verified_at timestamptz;

comment on column public.organisation.domain_verified_at is
  'When the org last verified ownership of its `domain` via DNS TXT challenge. Null = unverified.';

create table if not exists public.org_domain_verification (
  org_id        uuid primary key references public.organisation(id) on delete cascade,
  workspace_id  uuid not null,
  domain        text not null,
  challenge     text not null,
  created_at    timestamptz not null default now(),
  verified_at   timestamptz
);

comment on table  public.org_domain_verification is
  'In-flight or completed DNS TXT challenges per organisation. One row per org. Holds the challenge token until verification completes.';
comment on column public.org_domain_verification.challenge is
  'The token the caller must publish at _fibre-verify.<domain> as a TXT record. Compared verbatim against dns.resolveTxt() output.';

create index if not exists org_domain_verification_workspace_idx
  on public.org_domain_verification (workspace_id);

alter table public.org_domain_verification enable row level security;

-- Workspace members can read + write challenges for orgs in their workspace.
-- The check is intentionally lax (any workspace member) because domain
-- verification isn't a privacy boundary — it's an ownership proof. The
-- domain string itself is already public on the org row.
create policy "org_domain_verification read"
  on public.org_domain_verification
  for select
  to authenticated
  using (
    workspace_id in (
      select wm.workspace_id
        from public.workspace_member wm
       where wm.user_id = auth.uid()
    )
  );

create policy "org_domain_verification write"
  on public.org_domain_verification
  for all
  to authenticated
  using (
    workspace_id in (
      select wm.workspace_id
        from public.workspace_member wm
       where wm.user_id = auth.uid()
    )
  )
  with check (
    workspace_id in (
      select wm.workspace_id
        from public.workspace_member wm
       where wm.user_id = auth.uid()
    )
  );
