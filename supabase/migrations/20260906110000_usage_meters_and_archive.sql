-- ---------------------------------------------------------------------------
-- P4 remainder — meters that bill (docs/productisation-proposal.md §4).
--
-- Four pieces:
--   1. Overage unit prices on billing_plan (editable on /admin/plans, read by
--      lib/plan.ts). NULL = overage is NOT billed — the allowance stays soft.
--      Deliberately seeded NULL everywhere: nothing bills until a super admin
--      types a price into the matrix.
--   2. usage_warning — the once-per-period stamp behind the 80% emails.
--      One row per (workspace, meter, period); the UNIQUE constraint is the
--      dedup, so a crossing emails exactly once however often the tick runs.
--   3. usage_overage_charge — the once-per-period stamp behind the Stripe
--      invoice items. Same shape, same dedup idea, plus what was billed.
--   4. The 13-month Free archive: two timestamps on workspace. Archive is a
--      FLAG plus a gate — soft, reversible, never a deletion (brief §6).
--
-- Metering sources (nothing new is instrumented):
--   emails  — thread_message_send rows, one per (engagement, person) send,
--             already written by every triggered send (lib/plan.ts emailUsage).
--   storage — storage.objects under the workspace-prefixed paths both upload
--             routes write ('<workspace_id>/<uuid>.<ext>' in thread-assets
--             and fibre-assets). Summed by workspace_storage_bytes below.
-- ---------------------------------------------------------------------------

-- 1 · Overage unit prices ---------------------------------------------------

alter table public.billing_plan
  add column if not exists email_overage_cents_per_1000 integer
    check (email_overage_cents_per_1000 is null or email_overage_cents_per_1000 >= 0),
  add column if not exists storage_overage_cents_per_gb integer
    check (storage_overage_cents_per_gb is null or storage_overage_cents_per_gb >= 0);

comment on column public.billing_plan.email_overage_cents_per_1000 is
  'Cents per 1,000 emails past included_emails_month, billed monthly as an invoice item on the workspace''s subscription. NULL = overage not billed (soft allowance).';
comment on column public.billing_plan.storage_overage_cents_per_gb is
  'Cents per GB (decimal, 10^9 bytes) past included_storage_gb per month, measured at month end. NULL = overage not billed (soft allowance).';

-- 2 · 80% warning dedup -----------------------------------------------------

create table public.usage_warning (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  meter         text not null check (meter in ('emails', 'storage')),
  -- First day of the calendar month the warning covers (emails reset monthly;
  -- storage is re-warned each month it still sits past 80%).
  period_start  date not null,
  used          bigint not null,
  allowance     bigint not null,
  sent_at       timestamptz not null default now(),
  unique (workspace_id, meter, period_start)
);
create index usage_warning_workspace_idx on public.usage_warning (workspace_id, period_start desc);

-- 3 · Overage charge dedup + record -----------------------------------------

create table public.usage_overage_charge (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspace(id) on delete cascade,
  meter                   text not null check (meter in ('emails', 'storage')),
  -- First day of the calendar month the charge covers (always a CLOSED month).
  period_start            date not null,
  -- Emails over the allowance, or GB over the allowance — the billed units.
  quantity                bigint not null,
  amount_cents            integer not null,
  -- Filled once the Stripe invoice item exists; a row without one is mid-
  -- flight and gets deleted on Stripe failure so the next tick retries.
  stripe_invoice_item_id  text,
  created_at              timestamptz not null default now(),
  unique (workspace_id, meter, period_start)
);
create index usage_overage_charge_workspace_idx on public.usage_overage_charge (workspace_id, period_start desc);

-- RLS: members may SEE their workspace's warnings and charges (a bill is not
-- a secret from the people it covers). All writes are service-role only —
-- the API's scheduler tick is the single writer.
alter table public.usage_warning enable row level security;
alter table public.usage_overage_charge enable row level security;

create policy "usage_warning read" on public.usage_warning
  for select to authenticated
  using (workspace_id in (
    select wm.workspace_id from public.workspace_member wm where wm.user_id = auth.uid()
  ));
create policy "usage_overage_charge read" on public.usage_overage_charge
  for select to authenticated
  using (workspace_id in (
    select wm.workspace_id from public.workspace_member wm where wm.user_id = auth.uid()
  ));

-- 4 · 13-month Free archive -------------------------------------------------

alter table public.workspace
  add column if not exists archive_warned_at timestamptz,
  add column if not exists archived_at       timestamptz;

comment on column public.workspace.archive_warned_at is
  'When the 12-months-inactive warning email went to the admins of a Free workspace. Cleared automatically if the workspace becomes active again before archiving.';
comment on column public.workspace.archived_at is
  'Free workspace archived after 13 months of inactivity (no sign-ins, no activity rows). A FLAG, never a deletion: data stays, the UI gates on it, and reactivation is one click (POST /api/v1/billing/reactivate).';

-- 5 · Storage meter ----------------------------------------------------------
-- Sums what the workspace has uploaded: both upload routes write workspace-
-- prefixed paths into the two public asset buckets. SECURITY DEFINER because
-- storage.objects is not reachable through PostgREST's public schema;
-- execution is service-role only.

create or replace function public.workspace_storage_bytes(ws uuid)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
    from storage.objects o
   where o.bucket_id in ('thread-assets', 'fibre-assets')
     and o.name like ws::text || '/%';
$$;

revoke all on function public.workspace_storage_bytes(uuid) from public;
revoke all on function public.workspace_storage_bytes(uuid) from anon;
revoke all on function public.workspace_storage_bytes(uuid) from authenticated;
grant execute on function public.workspace_storage_bytes(uuid) to service_role;
