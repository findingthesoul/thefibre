-- ============================================================================
-- Plans become packages — free / starter / pro / enterprise.
--
-- docs/pricing-proposal.md, decided by Sjoerd 2026-08-31. The spine already
-- existed (20260519100000): billing_plan, workspace_subscription with a
-- `comped` status, and a fee ladder read at every Stripe Checkout through
-- lib/fees.ts. What was missing is what a plan BUYS.
--
-- THE MODEL CHANGED: per workspace, not per seat. billing_plan was built
-- around price_cents_user_month; a festival has two organisers and four
-- hundred participants, so per-seat prices the two, ignores the four hundred,
-- and charges more every time you add the co-organiser the product wants you
-- to add. The old column stays (nothing may break) and is no longer read.
--
-- Seats are not gone, they are a limit rather than the price: 2 on Starter,
-- 5 on Pro, unlimited on Enterprise, extra seats billed. A seat is somebody
-- who RUNS events. Participants are never seats.
--
-- IDS ARE NOT RENAMED. 'org' keeps its id and becomes "Enterprise" — the id is
-- a foreign key from every workspace_subscription row, and renaming it to read
-- nicely in one admin screen would be a migration across live subscriptions
-- for no functional gain.
-- ============================================================================

alter table public.billing_plan
  add column if not exists price_cents_month        integer not null default 0,
  add column if not exists included_seats           integer,          -- null = unlimited
  add column if not exists extra_seat_cents_month   integer,
  add column if not exists included_emails_month    integer,          -- null = unlimited
  add column if not exists included_storage_gb      integer,
  add column if not exists retention_months         integer;          -- null = kept while you pay

comment on column public.billing_plan.price_cents_month is
  'What the workspace pays per month, ex-VAT. Replaces price_cents_user_month: the model is per workspace (docs/pricing-proposal.md).';
comment on column public.billing_plan.included_seats is
  'People who can RUN events. Null = unlimited. Participants are never seats.';
comment on column public.billing_plan.retention_months is
  'Months past an event before its data is archived. Null = kept for as long as the workspace pays. Free is 13 — twelve would remove last year''s edition the week an annual festival came to plan the next one.';

-- ---------------------------------------------------------------------------
-- The four packages.
--
-- `features` is the whole gate vocabulary; lib/plan.ts is the only thing that
-- reads it. Adding a capability means a key here and one `can()` call there.
-- ---------------------------------------------------------------------------

insert into public.billing_plan (
  id, name, price_cents_user_month, price_cents_month,
  included_seats, extra_seat_cents_month,
  included_emails_month, included_storage_gb, retention_months,
  meet_paid_pct, meet_paid_cap_cents, features
) values
  ('starter', 'Starter', 0, 1900, 2, 800, 2000, 5, null,
    0.0100, 100,
    jsonb_build_object(
      'thread', true,
      'thread_live_limit', null,
      'thread_custom_templates', false,
      'certificates', true,
      'flow', false,
      'pulse', false,
      'email_branding', true,
      'custom_sender_domain', false,
      'app_keys', false,
      'third_party_apps', false,
      'sso', false,
      'audit_log', false,
      'retention_controls', false
    ))
on conflict (id) do update set
  name                   = excluded.name,
  price_cents_month      = excluded.price_cents_month,
  included_seats         = excluded.included_seats,
  extra_seat_cents_month = excluded.extra_seat_cents_month,
  included_emails_month  = excluded.included_emails_month,
  included_storage_gb    = excluded.included_storage_gb,
  retention_months       = excluded.retention_months,
  meet_paid_pct          = excluded.meet_paid_pct,
  meet_paid_cap_cents    = excluded.meet_paid_cap_cents,
  features               = excluded.features;

update public.billing_plan set
  name = 'Free',
  price_cents_month = 0,
  included_seats = 1,
  extra_seat_cents_month = null,
  included_emails_month = 200,
  included_storage_gb = 1,
  retention_months = 13,
  meet_paid_pct = 0.0200,
  meet_paid_cap_cents = 200,
  features = jsonb_build_object(
    'thread', true,
    -- One live event at a time. Not a trial — a community group running one
    -- gathering a year should be able to stay here forever.
    'thread_live_limit', 1,
    'thread_custom_templates', false,
    'certificates', false,
    'flow', false,
    'pulse', false,
    'email_branding', false,
    'custom_sender_domain', false,
    'app_keys', false,
    'third_party_apps', false,
    'sso', false,
    'audit_log', false,
    'retention_controls', false
  )
where id = 'free';

update public.billing_plan set
  name = 'Pro',
  price_cents_month = 4900,
  included_seats = 5,
  extra_seat_cents_month = 800,
  included_emails_month = 10000,
  included_storage_gb = 25,
  retention_months = null,
  meet_paid_pct = 0,
  meet_paid_cap_cents = null,
  features = jsonb_build_object(
    'thread', true,
    'thread_live_limit', null,
    'thread_custom_templates', true,
    'certificates', true,
    'flow', true,
    'pulse', true,
    'email_branding', true,
    'custom_sender_domain', true,
    'app_keys', true,
    'third_party_apps', true,
    'sso', false,
    'audit_log', false,
    'retention_controls', false
  )
where id = 'pro';

update public.billing_plan set
  name = 'Enterprise',
  price_cents_month = 0,           -- a conversation, not a price list
  included_seats = null,
  extra_seat_cents_month = null,
  included_emails_month = null,
  included_storage_gb = null,
  retention_months = null,
  meet_paid_pct = 0,
  meet_paid_cap_cents = null,
  features = jsonb_build_object(
    'thread', true,
    'thread_live_limit', null,
    'thread_custom_templates', true,
    'certificates', true,
    'flow', true,
    'pulse', true,
    'email_branding', true,
    'custom_sender_domain', true,
    'app_keys', true,
    'third_party_apps', true,
    'sso', true,
    'audit_log', true,
    'retention_controls', true
  )
where id = 'org';

-- ---------------------------------------------------------------------------
-- NOBODY LOSES ANYTHING TODAY.
--
-- Every workspace on the platform right now is on `free` + `comped`, from
-- before any of this was gated, and several of them are using Flow, Pulse,
-- app keys and custom templates. Leaving them on Free would take those away
-- the moment the gates land — the first bill that removes something is a
-- betrayal, and these are the people who trusted it first.
--
-- So every existing comped workspace moves to Enterprise, comped, with the
-- reason written next to it. New workspaces still start on Free (the trigger
-- from 20260519100000 is untouched), and Sjoerd's own two businesses are
-- exactly where he said they should be.
-- ---------------------------------------------------------------------------
update public.workspace_subscription
   set plan_id = 'org',
       comped_reason = coalesce(
         nullif(comped_reason, ''),
         'grandfathered at the plan gates (20260901120000)'
       ),
       updated_at = now()
 where status = 'comped'
   and plan_id = 'free';
