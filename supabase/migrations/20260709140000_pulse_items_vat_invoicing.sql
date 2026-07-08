-- ============================================================================
-- Offering lines, VAT tariffs, and invoicing (proposal §2.8, Sjoerd
-- 2026-07-08): an opportunity holds offering rows; a VAT tariff from the
-- settings list; transfer-to-invoice assigns a number from the workspace
-- sequence and writes a purchase-ledger row.
-- ============================================================================

-- 1. Offering rows — the multi-line deal. When items exist they are the
--    deal size (quantity/unit on the commitment stay as legacy fallback).
create table public.pulse_commitment_item (
  id                 uuid primary key default gen_random_uuid(),
  commitment_id      uuid not null references public.pulse_commitment(id) on delete cascade,
  offering_id        uuid references public.pulse_offering(id) on delete set null,
  name               text not null,
  quantity           numeric(12,2) not null default 1,
  unit_amount_cents  bigint not null,
  repeat_cadence     text check (repeat_cadence in ('weekly','fortnightly','monthly','quarterly','yearly')),
  sort_order         int not null default 0,
  created_at         timestamptz not null default now()
);
create index pulse_commitment_item_commitment_idx
  on public.pulse_commitment_item (commitment_id, sort_order);

alter table public.pulse_commitment_item enable row level security;
create policy pulse_commitment_item_scope on public.pulse_commitment_item
  for all to authenticated
  using (
    public.has_app_membership('fibre-pulse')
    and exists (
      select 1 from public.pulse_commitment cm
       where cm.id = pulse_commitment_item.commitment_id
         and cm.workspace_id = public.current_workspace_id()
         and cm.deleted_at is null
         and (public.is_workspace_admin() or cm.owner_user_id = public.current_user_id())
    )
  )
  with check (
    public.has_app_membership('fibre-pulse')
    and exists (
      select 1 from public.pulse_commitment cm
       where cm.id = pulse_commitment_item.commitment_id
         and cm.workspace_id = public.current_workspace_id()
         and cm.deleted_at is null
         and (public.is_workspace_admin() or cm.owner_user_id = public.current_user_id())
    )
  );

-- 2. VAT tariff + invoice stamp on the opportunity.
alter table public.pulse_commitment
  add column if not exists vat_pct numeric(5,2)
    check (vat_pct is null or (vat_pct >= 0 and vat_pct <= 100)),
  add column if not exists invoice_no text,
  add column if not exists invoice_issued_at timestamptz,
  add column if not exists purchase_id uuid references public.purchase(id) on delete set null;

-- 3. Settings: VAT tariffs list, invoice numbering sequence, auto-send.
alter table public.pulse_settings
  add column if not exists vat_tariffs jsonb not null
    default '[{"label":"Hoog 21%","pct":21},{"label":"Laag 9%","pct":9},{"label":"Vrijgesteld 0%","pct":0}]'::jsonb,
  add column if not exists invoice_prefix text not null default '',
  add column if not exists invoice_next_number int not null default 1,
  add column if not exists invoice_auto_send boolean not null default false;
