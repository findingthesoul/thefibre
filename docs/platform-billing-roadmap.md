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

| Plan | $/user/month | Limits | Apps |
|---|---|---|---|
| **Free** | 0 | 1 user, 50 contacts | Platform read + 1 app |
| **Pro** | ~12 | unlimited users, unlimited contacts | All first-party apps |
| **Org** | ~25 | adds SSO, audit log, retention controls | + API keys + third-party install |

Annual: 20% off.

### Fibre Meet — sitting on top of the platform subscription

- **Per-host seat** already covered by the platform Pro/Org plan
  (Meet is bundled, not à la carte).
- **Paid-bookings fee**: a small % on revenue collected through
  Stripe Connect for paid MTs (recommended **1%**, capped at, say,
  $2 per booking so high-ticket bookings don't sting). Computed on
  the platform's webhook side at booking time, deducted via Stripe
  Connect's `application_fee_amount`. Free bookings pay nothing
  extra.

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
                        check (status in ('trialing','active','past_due','canceled','incomplete')),
  stripe_customer_id  text,
  stripe_subscription_id text unique,
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
| **0. Decide pricing** | Lock plan names, prices, feature tiers | meeting | **Sjoerd decision.** Until this is done, everything below stalls. |
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

## Decision points for Sjoerd (must come before Phase 1)

1. **Actual plan prices.** $12/user (Pro), $25/user (Org), or
   different? European market, EUR base? VAT-inclusive or exclusive?
2. **Free plan limits.** 50 contacts feels right; could be 100. What
   about activity volume — capped or unlimited on Free?
3. **What gates each tier?** SSO + audit log on Org is conventional.
   API keys / third-party app install on Org or Pro? White-labelling?
4. **Meet paid-booking fee.** 1% feels modest; 2% if we want the fee
   to actually matter. Cap per booking? Skip the fee entirely for
   workspaces on Org plan ("fee waived at enterprise tier")?
5. **Trial length.** 14 days no-card, 30 days no-card, or
   card-on-file from day one? Free plan basically removes the need
   for a trial.
6. **Annual vs monthly only.** Annual at -20% is conventional. Some
   B2B SaaS only sell annual. Start monthly; add annual in Phase 8.

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
