-- refund_rules_and_credit_notes
--
-- Refund rules, slice 1 of 4: the columns and the table, nothing reads them
-- yet (Sjoerd's 2iv part 2; his answers A–G, 2026-10-17: "refunds as
-- recommended").
--
-- 1. THE RULE. What a cancelled place gets back, counted back from the
--    thread's start. Shape (validated by the API, lib/refund-rules.ts
--    invalidRule; the CHECKs below only keep it an object with a steps list):
--      { "steps": [ { "until_days_before": 30, "refund_pct": 100 },
--                   { "until_days_before": 7,  "refund_pct": 50 } ],
--        "fee_cents": 1000 }            -- A: optional fixed fee, default none
--    · thread_settings.refund_rule — the workspace default. NULL = no rule:
--      today's behaviour, the organiser may refund in full.
--    · thread_thread.refund_rule — this thread's own. NULL = the workspace
--      default; {"steps": []} = no rule for this thread even when the
--      workspace has one.
--    The date that counts is the REQUEST's (C) —
--    thread_cancellation_request.created_at, which exists.
--
-- 2. THE CREDIT NOTE. Every refund, full or partial, and every reduction of
--    an unpaid invoice (G), is one credit note (F). It is the record of what
--    went back, so a partial refund needs no new purchase status: what is
--    refunded is the sum of a purchase's credit notes, and the purchase turns
--    'refunded' only when that sum reaches what was paid. Numbered in the
--    invoice's own series: for a Stripe invoice it is Stripe's credit note
--    number on that invoice (stripe_credit_note_id beside it); the API
--    assigns the same pattern otherwise. The series belongs to the SELLER,
--    not the workspace — Thread sells as the person, each organiser on their
--    own Stripe account — so two organisers may both issue
--    "INV-0001-CN-01": unique per (seller_ref, number). A money record:
--    never deleted, so the purchase cannot be deleted from under it (NO
--    ACTION, not RESTRICT: checked at the end of the statement, so deleting a
--    whole workspace — which cascades to both — still works).
--
--    It shows net + VAT like the invoice it corrects (net + vat = amount).
--
--    NEVER MORE THAN WAS PAID. A BEFORE INSERT trigger on the note locks its
--    purchase row and refuses a note that would take the credited total past
--    the purchase's amount — two refunds racing on one purchase (a double
--    click, two admins) are serialised on that lock, and the second sees the
--    first. A trigger, not a CHECK: it reads another table.
--
--    AN ISSUED NOTE IS FINAL. A BEFORE UPDATE trigger refuses any change to
--    what it says (purchase, workspace, series, number, amounts, currency,
--    kind); only the delivery facts may be filled in afterwards (emailed_at,
--    the Stripe ids). A BEFORE DELETE trigger refuses a delete unless the
--    note's WORKSPACE is already gone — the cascade of a workspace hard-delete
--    — checked by EXISTS on the workspace row, never by trigger depth (the
--    depth guard of 2026-10 broke every user delete on staging).
--
-- Reads follow the purchase: whoever may see the purchase may see its credit
-- notes. Writes are service role only, like the ledger itself.
--
-- Additive. No published shape changes here (the public thread payload gains
-- the rule in slice 4, PENDING until production serves it).

alter table public.thread_settings
  add column if not exists refund_rule jsonb
    check (refund_rule is null
           or (jsonb_typeof(refund_rule) = 'object'
               and jsonb_typeof(refund_rule -> 'steps') = 'array'));

alter table public.thread_thread
  add column if not exists refund_rule jsonb
    check (refund_rule is null
           or (jsonb_typeof(refund_rule) = 'object'
               and jsonb_typeof(refund_rule -> 'steps') = 'array'));

create table public.purchase_credit_note (
  id                           uuid primary key default gen_random_uuid(),
  workspace_id                 uuid not null references public.workspace(id) on delete cascade,
  purchase_id                  uuid not null references public.purchase(id) on delete no action,
  -- The request it answers, when it answers one (an organiser may also
  -- refund from the invoices page with no request).
  cancellation_request_id      uuid references public.thread_cancellation_request(id) on delete set null,
  -- Whose series: the seller's Stripe account id (acct_…), or the key of
  -- the series the API numbers itself for a purchase with no Stripe invoice.
  seller_ref                   text not null check (length(seller_ref) between 1 and 255),
  -- In that seller's invoice series (see the header).
  number                       text not null check (length(number) between 1 and 64),
  -- What this note credits, VAT included, in the purchase's currency, and
  -- its split, as on the invoice it corrects. vat_rate is the percentage
  -- (NULL when no VAT applies — vat_cents is then 0).
  amount_cents                 integer not null check (amount_cents > 0),
  net_cents                    integer not null check (net_cents >= 0),
  vat_cents                    integer not null default 0 check (vat_cents >= 0),
  vat_rate                     numeric(5,2) check (vat_rate is null or vat_rate between 0 and 100),
  currency                     char(3) not null,
  -- E: the platform fee returned with it, in proportion on a partial refund.
  platform_fee_refunded_cents  integer not null default 0 check (platform_fee_refunded_cents >= 0),
  -- What the rule said, for the note and the audit: the percentage it gave
  -- and the fixed fee it kept (A). NULL pct = no rule applied (no rule, or
  -- the organiser set the amount by hand).
  rule_pct                     numeric(5,2) check (rule_pct is null or rule_pct between 0 and 100),
  rule_fee_kept_cents          integer not null default 0 check (rule_fee_kept_cents >= 0),
  -- 'refund': money went back (card). 'reduction': an unpaid invoice now
  -- owes less (G); no money moved.
  kind                         text not null check (kind in ('refund', 'reduction')),
  reason                       text check (reason is null or length(reason) <= 2000),
  stripe_refund_id             text,
  stripe_credit_note_id        text,
  issued_by_user_id            uuid references public."user"(id) on delete set null,
  emailed_at                   timestamptz,
  created_at                   timestamptz not null default now(),
  check (net_cents + vat_cents = amount_cents),
  unique (seller_ref, number)
);

-- (purchase_id first: the guard's sum reads by it.)
create index purchase_credit_note_purchase_idx on public.purchase_credit_note (purchase_id, created_at);
create index purchase_credit_note_request_idx on public.purchase_credit_note (cancellation_request_id)
  where cancellation_request_id is not null;

-- The guard. BEFORE INSERT on the credit note itself: it is never reached
-- through a cascade (nothing inserts notes but the API), so the cascade-
-- trigger lessons of 2026-10 (pg_trigger_depth, parent EXISTS) do not apply.
-- Plain invoker function: it only reads the purchase the note names.
create or replace function public.purchase_credit_note_within_paid()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  paid      integer;
  ws        uuid;
  credited  integer;
begin
  -- Serialise every note for this purchase on its row.
  select p.amount_cents, p.workspace_id into paid, ws
    from public.purchase p
   where p.id = new.purchase_id
     for update;
  if not found then
    raise exception 'credit note for a purchase that does not exist' using errcode = '23503';
  end if;
  if ws <> new.workspace_id then
    raise exception 'credit note and purchase are in different workspaces' using errcode = '23514';
  end if;
  select coalesce(sum(n.amount_cents), 0) into credited
    from public.purchase_credit_note n
   where n.purchase_id = new.purchase_id;
  if credited + new.amount_cents > paid then
    raise exception 'credit notes would exceed the purchase: % already credited, % more, % paid',
      credited, new.amount_cents, paid
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger purchase_credit_note_within_paid
  before insert on public.purchase_credit_note
  for each row execute function public.purchase_credit_note_within_paid();

create or replace function public.purchase_credit_note_final()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.purchase_id is distinct from old.purchase_id
     or new.workspace_id is distinct from old.workspace_id
     or new.seller_ref is distinct from old.seller_ref
     or new.number is distinct from old.number
     or new.amount_cents is distinct from old.amount_cents
     or new.net_cents is distinct from old.net_cents
     or new.vat_cents is distinct from old.vat_cents
     or new.vat_rate is distinct from old.vat_rate
     or new.currency is distinct from old.currency
     or new.kind is distinct from old.kind
     or new.platform_fee_refunded_cents is distinct from old.platform_fee_refunded_cents
     or new.rule_pct is distinct from old.rule_pct
     or new.rule_fee_kept_cents is distinct from old.rule_fee_kept_cents then
    raise exception 'an issued credit note cannot be changed; issue another one'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger purchase_credit_note_final
  before update on public.purchase_credit_note
  for each row execute function public.purchase_credit_note_final();

create or replace function public.purchase_credit_note_no_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- The workspace's own hard-delete cascades here: its row is already gone
  -- by the time this fires, and then the note goes with it.
  if exists (select 1 from public.workspace w where w.id = old.workspace_id) then
    raise exception 'an issued credit note cannot be deleted'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger purchase_credit_note_no_delete
  before delete on public.purchase_credit_note
  for each row execute function public.purchase_credit_note_no_delete();

alter table public.purchase_credit_note enable row level security;

-- Visible exactly when its purchase is: the subquery runs under the
-- purchase's own policy (purchase_visibility and its successors), so this
-- can never show more than the ledger does.
create policy purchase_credit_note_visibility on public.purchase_credit_note
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and exists (select 1 from public.purchase p where p.id = purchase_credit_note.purchase_id)
  );
-- No authenticated write policy, on purpose: the API writes, as the ledger.
