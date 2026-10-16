-- thread_organiser_handover
--
-- Handing ONE thread to another organiser, with both of them saying yes
-- (Sjoerd, 2026-10-14: "change organiser for a thread. With approval from the
-- departing organiser and the new one"). Design: docs/organiser-handover-design.md.
--
-- Two tables, both reached only through the API (RLS on, no policies — the
-- same posture as thread_slug_history). The accept step and its function
-- come with the code, in a later migration.

-- ---------------------------------------------------------------------------
-- THE REQUEST. The current organiser proposes; the new one accepts. Or, on
-- the second door, a workspace admin proposes for an organiser who has LEFT
-- the workspace — with a reason, which the new organiser sees. Expiry is
-- checked when the request is read or accepted, not swept: a stored
-- 'pending' past its expires_at is reported, and refused, as expired.
create table if not exists public.thread_organiser_handover (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspace(id) on delete cascade,
  thread_id           uuid not null references public.thread_thread(id) on delete cascade,
  from_organiser_id   uuid not null references public.thread_organiser(id),
  to_organiser_id     uuid not null references public.thread_organiser(id),
  proposed_by_user_id uuid not null references public."user"(id),
  door                text not null default 'organiser'
                        check (door in ('organiser', 'admin_departed')),
  reason              text check (reason is null or char_length(reason) <= 1000),
  keep_as_host        boolean not null default true,
  status              text not null default 'pending'
                        check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  expires_at          timestamptz not null,
  decided_at          timestamptz,
  decided_by_user_id  uuid references public."user"(id),
  created_at          timestamptz not null default now(),
  check (from_organiser_id <> to_organiser_id),
  -- The second door always says why.
  check (door <> 'admin_departed' or (reason is not null and char_length(btrim(reason)) > 0))
);

-- One open request per thread: a second proposal while one is pending is a
-- conflict to resolve, not a race to win.
create unique index if not exists thread_organiser_handover_one_pending
  on public.thread_organiser_handover (thread_id) where status = 'pending';
create index if not exists thread_organiser_handover_to
  on public.thread_organiser_handover (to_organiser_id, status);
create index if not exists thread_organiser_handover_from
  on public.thread_organiser_handover (from_organiser_id, status);

alter table public.thread_organiser_handover enable row level security;
-- No policies on purpose: reached only through the API.

-- ---------------------------------------------------------------------------
-- A THREAD'S EARLIER OWNERS. A personal-scope thread lives at
-- /{organiserSlug}/{threadSlug}; a new organiser changes the first half, and
-- every link people already have would 404. thread_slug_history cannot carry
-- this: it is keyed on the THREAD slug and looked up through the CURRENT
-- owner. So a public lookup that finds nothing under an organiser owner asks
-- here by (old owner slug, thread slug) and answers moved_to, as a renamed
-- thread already does.
create table if not exists public.thread_owner_history (
  id             uuid primary key default gen_random_uuid(),
  thread_id      uuid not null references public.thread_thread(id) on delete cascade,
  workspace_id   uuid not null references public.workspace(id) on delete cascade,
  old_owner_slug text not null,
  thread_slug    text not null,
  changed_at     timestamptz not null default now(),
  unique (thread_id, old_owner_slug, thread_slug)
);
create index if not exists thread_owner_history_lookup
  on public.thread_owner_history (old_owner_slug, thread_slug, changed_at desc);

alter table public.thread_owner_history enable row level security;
-- No policies on purpose: reached only through the API.
