-- ============================================================================
-- Platform purchase ledger (Invoices proposal §2.1, D1 accepted 2026-07-04:
-- the second sanctioned data-wall crossing after the activity log).
-- One row per money event; Meet + Thread write via the API (service role)
-- at checkout completion / mark-paid / refund. Backfilled below.
-- ============================================================================

create table public.purchase (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspace(id) on delete cascade,
  app_id                 uuid not null references public.app(id),
  person_id              uuid references public.person(id) on delete set null,
  payer_name             text not null default '',
  payer_email            citext,
  item_label             text not null,
  item_ref               text not null,        -- app-local row id (booking / thread_enrolment)
  organiser_user_id      uuid references public."user"(id) on delete set null,
  team_id                uuid references public.team(id) on delete set null,
  amount_cents           integer not null default 0,
  currency               char(3) not null default 'EUR',
  platform_fee_cents     integer not null default 0,
  vendor_share_cents     integer not null default 0,
  org_share_cents        integer not null default 0,
  method                 text not null default 'stripe'
                           check (method in ('stripe','invoice')),
  status                 text not null default 'pending'
                           check (status in ('pending','paid','refunded','failed')),
  stripe_payment_intent  text,
  stripe_invoice_id      text,
  stripe_invoice_url     text,
  paid_at                timestamptz,
  refunded_at            timestamptz,
  created_at             timestamptz not null default now(),
  unique (app_id, item_ref)                    -- idempotent writes per source row
);
create index purchase_workspace_idx on public.purchase (workspace_id, created_at desc);
create index purchase_organiser_idx on public.purchase (organiser_user_id, created_at desc);
create index purchase_team_idx      on public.purchase (team_id, created_at desc);

alter table public.purchase enable row level security;

-- Read: workspace match AND (admin-or-above, OR it's my sale, OR it's a
-- sale of a team I'm an active member of). Facilitators (a per-thread role)
-- get nothing extra by design (D2). Writes: service role only — no
-- authenticated write policy on purpose.
create policy purchase_visibility on public.purchase
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and (
      public.is_workspace_admin()
      or organiser_user_id = public.current_user_id()
      or (
        team_id is not null
        and exists (
          select 1 from public.team_member tm
           where tm.team_id = purchase.team_id
             and tm.user_id = public.current_user_id()
             and tm.status  = 'active'
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Backfill: The Thread — every enrolment with money involved.
-- ---------------------------------------------------------------------------
insert into public.purchase (
  workspace_id, app_id, person_id, payer_name, payer_email,
  item_label, item_ref, organiser_user_id, team_id,
  amount_cents, currency, platform_fee_cents, vendor_share_cents, org_share_cents,
  method, status, stripe_payment_intent, paid_at, created_at
)
select
  te.workspace_id,
  a.id,
  te.person_id,
  coalesce(nullif(trim(concat(p.first_name, ' ', p.last_name)), ''), p.email, ''),
  p.email,
  concat(pr.title, case when tk.name is not null then ' · ' || tk.name else '' end),
  te.id::text,
  torg.user_id,
  tt.team_id,
  coalesce(te.amount_cents, tk.price_cents, tt.price_cents, 0),
  coalesce(te.currency, tk.price_currency, tt.price_currency, 'EUR'),
  coalesce(po.platform_fee_cents, 0),
  coalesce(po.vendor_share_cents, 0),
  coalesce(po.org_share_cents, 0),
  case when te.stripe_session_id is not null then 'stripe' else 'invoice' end,
  te.payment_status,
  te.stripe_payment_intent,
  case when te.payment_status = 'paid' then te.created_at end,
  te.created_at
from public.thread_enrolment te
join public.thread_thread tt   on tt.id = te.thread_id
join public.program pr         on pr.id = tt.program_id
join public.thread_organiser torg on torg.id = tt.organiser_id
left join public.person p      on p.id = te.person_id
join public.app a              on a.slug = 'the-thread'
left join public.thread_ticket tk on tk.id = te.ticket_id
left join public.thread_payout po on po.thread_enrolment_id = te.id
where te.payment_status in ('pending','paid','refunded','failed')
on conflict (app_id, item_ref) do nothing;

-- ---------------------------------------------------------------------------
-- Backfill: Fibre Meet — every booking with money involved.
-- ---------------------------------------------------------------------------
insert into public.purchase (
  workspace_id, app_id, person_id, payer_name, payer_email,
  item_label, item_ref, organiser_user_id, team_id,
  amount_cents, currency,
  method, status, stripe_payment_intent, stripe_invoice_id, stripe_invoice_url,
  paid_at, created_at
)
select
  b.workspace_id,
  a.id,
  b.invitee_person_id,
  b.invitee_name,
  b.invitee_email,
  mt.name,
  b.id::text,
  h.user_id,
  mt.team_id,
  coalesce(mt.price_cents, 0),
  coalesce(mt.price_currency, 'EUR'),
  case when b.stripe_session_id is not null then 'stripe' else 'invoice' end,
  b.payment_status,
  b.stripe_payment_intent,
  b.stripe_invoice_id,
  b.stripe_invoice_url,
  case when b.payment_status = 'paid' then b.created_at end,
  b.created_at
from public.meet_booking b
join public.meet_meeting_type mt on mt.id = b.meeting_type_id
join public.meet_host h          on h.id = b.host_id
join public.app a                on a.slug = 'fibre-meet'
where b.payment_status in ('pending','paid','refunded','failed')
on conflict (app_id, item_ref) do nothing;

-- Refunds flip the split ledger too — the original check lacked the value.
alter table public.thread_payout
  drop constraint if exists thread_payout_status_check;
alter table public.thread_payout
  add constraint thread_payout_status_check
  check (status in ('pending','transferred','failed','not_applicable','refunded'));
