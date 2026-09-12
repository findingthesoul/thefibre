-- ============================================================================
-- The hygiene sweep's review queue.
--
-- docs/connections-data-integrity.md §9.3, from Sjoerd: *"how do we keep the
-- data clean? Can we make a procedure to clean up the database regularly —
-- auto, with AI support maybe?"*
--
-- THE RULE THAT SHAPES EVERYTHING HERE: **it produces a review queue, it does
-- not silently repair.** A sweep that quietly rewrites a workspace's records
-- at 3am is indistinguishable from corruption the morning somebody notices.
-- So findings are rows, with the evidence attached, and a person decides.
--
-- The exception is a narrow class of fixes that are provably safe and
-- reversible — trimming whitespace, lowercasing an email. Those are applied,
-- and they still land here as rows with status 'fixed', because "we changed
-- your data and told nobody" is the thing this table exists to prevent. An
-- audit trail is not optional just because the change was small.
--
-- NEVER, not even as a proposal: filling in a blank. Cleaning means removing
-- wrongness, not inventing completeness. A suggestion that somebody
-- "probably works at Acme" is enrichment wearing a hygiene badge, and
-- enrichment is refused on principle (connections-market.md §8). It will be
-- proposed one day, and it will sound helpful.
--
-- ── Why a run table as well ─────────────────────────────────────────────────
--
-- The scheduler guard cannot live in memory. `usage-meters.ts` keeps its
-- hourly guard in a module variable, which is right for hourly work on a warm
-- machine — but this repo deploys several times a day, and an in-memory guard
-- resets on every deploy, so a "nightly" sweep would run on every one. The
-- stamp has to outlive the process, and the honest place to keep it is the
-- record of the last run.
-- ============================================================================

create table if not exists public.hygiene_run (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  workspaces   int not null default 0,
  found        int not null default 0,
  fixed        int not null default 0,
  -- A run that threw still gets a row. A sweep that silently stopped running
  -- three weeks ago is the failure mode of every scheduled job ever written,
  -- and an empty table is the only symptom.
  error        text
);

comment on table public.hygiene_run is
  'One row per hygiene sweep. Also the scheduler guard: the latest finished_at is what makes it nightly, because an in-memory guard resets on every deploy and this repo deploys several times a day.';

create index if not exists hygiene_run_started_idx on public.hygiene_run (started_at desc);

create table if not exists public.hygiene_finding (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  run_id        uuid references public.hygiene_run(id) on delete set null,

  -- What kind of dirt. Plain text, no CHECK — the same rule as
  -- person.created_via and connections_band_label.axis: a CHECK would make
  -- adding a check a schema migration, and the vocabulary belongs with the
  -- code that writes it (apps/api/src/lib/hygiene.ts).
  kind          text not null,

  -- What it is about. `subject_table` is carried rather than inferred because
  -- a finding can be about a person, a note or a flow run, and a column per
  -- table would be five nullable FKs that mean the same thing.
  subject_table text not null,
  subject_id    uuid not null,
  /** The other row, when the finding is about a PAIR — the second person in a
   *  duplicate. Null for everything else. */
  related_id    uuid,

  -- Why. Whatever the check needs to show its work: the matching emails, the
  -- days stranded, the value before a fix. The interface renders this, so a
  -- proposal can be judged without trusting the sweep.
  evidence      jsonb not null default '{}'::jsonb,

  --   open       proposed, waiting for a person
  --   fixed      applied automatically, recorded so it is not invisible
  --   accepted   a person agreed and it was applied
  --   dismissed  a person said no. Kept, so the next sweep does not re-raise
  --              it — a queue that keeps proposing what you already refused
  --              is one people stop opening.
  status        text not null default 'open',

  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public."user"(id) on delete set null
);

-- Re-running the sweep must not pile up copies of the same finding. The pair
-- columns are coalesced to a fixed uuid so a null related_id still collides
-- with itself — a partial index per shape would leave the common case
-- unguarded.
create unique index if not exists hygiene_finding_uniq
  on public.hygiene_finding (
    workspace_id, kind, subject_id, coalesce(related_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists hygiene_finding_open_idx
  on public.hygiene_finding (workspace_id, status, created_at desc);

comment on table public.hygiene_finding is
  'The hygiene sweep review queue. Proposals with evidence, never silent repair. Auto-applied fixes land here too with status fixed, because an unlogged change is the thing this table prevents. Dismissed rows are kept so the sweep does not re-raise what was refused.';

alter table public.hygiene_finding enable row level security;
alter table public.hygiene_run     enable row level security;

-- Findings are workspace data and admin-only: they expose duplicate people
-- and stale records across the whole workspace, which is an admin's view
-- rather than a member's. Writes go through the API on the user's client, so
-- the policy is the enforcement and the route does not re-derive it.
drop policy if exists hygiene_finding_scope on public.hygiene_finding;
create policy hygiene_finding_scope on public.hygiene_finding
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.current_workspace_role() in ('super_admin', 'admin')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.current_workspace_role() in ('super_admin', 'admin')
  );

-- The run log has no workspace column — a sweep spans all of them — so it is
-- service-role only. Nothing in any app reads it; it exists for the guard and
-- for somebody debugging a sweep that stopped.
-- (RLS enabled with NO policy = deny all for authenticated. Deliberate.)
