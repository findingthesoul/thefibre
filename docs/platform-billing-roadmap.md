# Platform billing — model + roadmap

_Drafted 2026-05-17. Separate from the [Meet pricing roadmap](meet-pricing-roadmap.md):
that one is about Meet **hosts** charging **invitees** through Stripe
Connect. This one is about **The Fibre** charging **workspaces** to use
the platform. Both run on Stripe; they don't share an integration._

## The model — recommended

### Fibre platform

**Per-seat monthly subscription** with feature tiers. Counts users
who hold any `app_membership` in a workspace; counting contacts or
activities is punitive (you want users adding more, not less) and
makes pricing unpredictable for the buyer.

_All prices shown in EUR, ex-VAT for B2B clarity, with the
all-in (VAT + Stripe fee) cost laid bare so you can pick a sticker
price that nets the take-home you want._

| Plan | €/user/month (ex-VAT) | Display (incl 21% VAT, NL) | What's bundled | Suggested limits |
|---|---|---|---|---|
| **Free** | 0 | 0 | Platform read + Fibre Meet | 1 user, 100 contacts, 200 activities/month |
| **Pro** | **15** | 18.15 | All first-party apps (Meet, Thread, Sales, Learn) | unlimited users, unlimited contacts |
| **Org** | **30** | 36.30 | + SSO, audit log, retention controls, third-party app install, API keys, white-labelled invoices | unlimited |

**Annual: 20% off** → Pro €12/user/month billed yearly (€144/user/year
ex-VAT); Org €24/user/month billed yearly (€288/user/year ex-VAT).

### What Fibre actually keeps after Stripe fees

Stripe EU pricing: **1.5% + €0.25** per card transaction (EEA cards);
2.5% + €0.25 for non-EEA. Worst-case worked example on Pro (€15/user
ex-VAT) for a 10-user workspace billed monthly:

- Charged: €15 × 10 × 1.21 (VAT) = **€181.50**
- Stripe fee: €181.50 × 0.025 + €0.25 = **€4.79**
- VAT (you remit): **€31.50**
- **Net to Fibre per month: ~€145.21**

The take-home rate is ~80% of headline. Annual billing improves this
(one fixed fee on a bigger transaction). For the platform plan, this
is acceptable — the per-seat motion makes up the rest.

### Fibre Meet — sitting on top of the platform subscription

- **Per-host seat** already covered by the platform plan; Meet is
  bundled, not à la carte.
- **Paid-bookings fee** depends on the workspace's plan:
  - **Free workspaces**: small % on every paid booking — recommend
    **2%** capped at **€2** per booking. Stings just enough to push
    the workspace to upgrade once volume is real.
  - **Pro / Org workspaces**: **0% — fee waived.** Once you pay for
    a seat, your invitee revenue is yours.
- Implemented via Stripe Connect's `application_fee_amount` on the
  Checkout session created in [Meet roadmap](meet-pricing-roadmap.md)
  Phase 3. Skipped for Pro/Org by reading the workspace's plan at
  Checkout creation.

### Why not other models

- **Per-meeting metering**: creates anxiety ("can I afford this
  call?"), exactly the friction Meet is meant to remove.
- **% on all meetings (free + paid)**: same anxiety; also makes
  no sense for non-revenue meetings (intros, internal team syncs).
- **Per-contact**: punishes the behaviour the product encourages.
- **Per-activity**: noisy meter, hard for users to predict bills.

## Schema sketch (when it's time to build)

Two new tables on the platform side:

```sql
create table public.billing_plan (
  id                text primary key,        -- 'free' | 'pro' | 'org'
  name              text not null,
  price_cents_user_month integer not null,
  meet_paid_pct     numeric(5,4) not null default 0,   -- e.g. 0.01 = 1%
  features          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create table public.workspace_subscription (
  workspace_id        uuid primary key references public.workspace(id) on delete cascade,
  plan_id             text not null references public.billing_plan(id),
  status              text not null
                        check (status in ('trialing','active','past_due','canceled','incomplete','comped')),
  -- 'comped' = super-admin gave this workspace a plan with no payment.
  -- Stripe ids are NULL when comped; webhook never fires for these rows.
  comped_by           uuid references public."user"(id),
  comped_reason       text,                        -- short note, audit trail
  comped_until        timestamptz,                 -- NULL = permanent
  stripe_customer_id  text,
  stripe_subscription_id text unique,
  billing_interval    text not null default 'monthly'
                        check (billing_interval in ('monthly','annual')),
  current_period_end  timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_ends_at       timestamptz,
  seat_count          integer not null default 0,   -- denormalised from app_membership
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index workspace_subscription_status_idx on public.workspace_subscription (status);
```

RLS: workspace owners can read their own row; only the API
(service-role) writes. Stripe webhook handler updates `status`,
`current_period_end`, `cancel_at_period_end`.

## Phased plan

| Phase | Scope | Effort | Notes |
|---|---|---|---|
| **0. Decide pricing** | Lock plan names, prices, feature tiers | meeting | ✅ Done 2026-05-17 — see "Decisions — locked" below. |
| **0b. Stripe account setup** | API keys, webhook, Products + Prices, Tax, Billing portal | ~20 min | **Sjoerd-driven.** Step-by-step in [`docs/platform-billing-setup.md`](platform-billing-setup.md). |
| **1. Migrations** | `billing_plan` + `workspace_subscription` tables, seed Free/Pro/Org rows | ~0.5 day | No behaviour change yet; tables sit ready. |
| **2. Free-by-default** | Every workspace gets `workspace_subscription(plan_id='free')` on creation | ~0.5 day | Existing workspaces backfilled. |
| **3. Workspace billing page** | `/settings/workspace/billing` in Fibre web — shows current plan, seat count, upgrade button | ~1 day | UI only, no Stripe call yet. |
| **4. Stripe Checkout for upgrades** | Click Upgrade → Stripe Checkout in subscription mode → webhook on `checkout.session.completed` flips the row | ~1-2 days | Stripe **platform account** (not Connect — funds go to Solidarity Lab B.V.). |
| **5. Webhook lifecycle** | Handle `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` | ~1 day | Drives status transitions. |
| **6. Feature gates** | Enforce plan limits in API (e.g. 50-contact cap on Free) | ~1 day | One helper `requirePlan(min)` plus call-site sprinkles. |
| **7. Meet paid-booking fee** | Add `application_fee_amount` to the Connect Checkout session from Meet pricing roadmap Phase 3 | ~0.5 day | Depends on Meet Phase 3 landing first. |
| **8. Annual / billing portal** | Stripe Billing portal hosted page for invoice history, plan changes, cancellation | ~0.5 day | Stripe gives this almost for free. |

Total to viable platform billing: **~5-7 days** after Phase 0
decisions are made.

## Decisions — locked 2026-05-17

1. **Plan prices**: Pro **€15/user/month** ex-VAT, Org **€30/user/month**
   ex-VAT. Both displayed incl. 21% NL VAT in the UI. Annual −20%.
   Stripe fee absorbed by Fibre, not passed on.
2. **Free plan**: 1 user, 100 contacts, 200 activities/month. Super-admin
   can also **comp** any workspace onto Pro/Org with no payment
   (`status='comped'`, audit fields, optional expiry). Stripe never
   sees a comped workspace.
3. **Tier gating** (recommendation — confirm or adjust):
   - **Free**: Platform read + Fibre Meet (unlimited free MTs, capped
     contacts). One install of a third-party app via API.
   - **Pro**: All first-party apps (Meet + Thread + Sales + Learn).
     Unlimited contacts, unlimited activities. Email branding =
     Fibre's. Paid Meet bookings = 0% fee.
   - **Org**: SSO (Google Workspace + Microsoft), audit log,
     retention policy admin, API keys for third-party apps,
     white-labelled invoices, custom domain on `meet.<their-domain>`.
4. **Meet fee**: **2% capped at €2** on paid bookings — Free
   workspaces only. Pro/Org pay 0%. Each host still connects their
   own Stripe account (already designed in Meet Phase 2).
5. **Trial**: **14 days, card on file from day one**. Card lives in
   **Stripe** (not Fibre — see PCI note below). On day 15 Stripe
   auto-charges the first month unless cancelled.
6. **Billing intervals**: **monthly and annual** both supported at
   launch; user picks at Checkout. Switching mid-cycle prorates via
   Stripe's standard behaviour.

### PCI note (load-bearing)

Card data does **not** live in Fibre's database. It lives in
**Stripe** (PCI-DSS Level 1; their core competence). Fibre stores
only:
- `stripe_customer_id` (e.g. `cus_…`) on `workspace_subscription`
- `payment_method_id` (e.g. `pm_…`) on the same row when needed

Functionally identical to "card on file": Stripe charges the saved
method on every renewal automatically. Without this separation,
Fibre inherits PCI compliance burden — an annual audit
(€20K-60K/year) and a security perimeter we don't want.

The Stripe **billing portal** (hosted by Stripe under our brand)
lets users update / replace their card without our app ever
touching card data.

## What's *out of scope* for the first ship

- **Tax**: defer to Stripe Tax. The integration is a single flag on
  the Checkout session; we don't compute anything ourselves.
- **Invoicing**: Stripe Billing's hosted invoices are the artefact.
  No PDF generation on our side.
- **Coupons / discount codes**: Stripe coupons via the dashboard,
  no UI on our side until a real campaign needs it.
- **Usage-based add-ons**: the model above is per-seat flat;
  metering by contact volume / activity volume only kicks in if we
  decide later that the limits should be soft (charge for overage)
  instead of hard.

## Relationship to the Meet pricing roadmap

| Roadmap | What it integrates | Whose money |
|---|---|---|
| [Meet pricing](meet-pricing-roadmap.md) | Stripe **Connect** — host paste/OAuth `acct_…` | Invitee → host |
| **Platform billing (this doc)** | Stripe **platform account** — Solidarity Lab B.V.'s own Stripe | Workspace → Solidarity Lab B.V. |

The only crossover is Phase 7 above: when a paid Meet booking goes
through Stripe Connect, the platform Stripe account skims
`application_fee_amount` (the % defined on the workspace's plan).
That's the *only* line of money flowing into the platform's own
Stripe; everything else is subscription.
