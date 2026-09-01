# Productisation — website, tiers, tailored pricing, Stripe Billing, operator economics

_Drafted 2026-09-01 from Sjoerd's brief: build the products for The Fibre — a
commercially better website; a super-admin page presenting the tiers with every
functionality of The Fibre / The Thread / Meet / Pulse / Flow as checkboxes,
priced monthly and yearly; a way to add workspaces for social enterprises with
tailored pricing; the request-to-join flow; working Stripe; and a dashboard of
operating costs (Supabase, Vercel, Fly, Resend, Stripe, …) against actual
income per account — "for the last you can use Pulse of course." This doc
thinks it through and names the conflicts before any code._

Builds directly on [`pricing-proposal.md`](pricing-proposal.md) (prices set by
Sjoerd 2026-08-31) and the `20260901120000_plan_packages.sql` migration
(gates live since v0.19.24). [`platform-billing-roadmap.md`](platform-billing-roadmap.md)
remains useful only for its Stripe Checkout/webhook/portal sequencing — its
per-seat model is superseded.

---

## 1 · What exists today (inventory)

| Concern | State |
|---|---|
| Pricing model | **Decided.** Free / Starter €19 / Pro €49 / Enterprise POA, per workspace. Seats 1/2/5/∞, +€8/extra seat. Email 200/2k/10k, storage 1/5/25 GB, retention 13 mo on Free. Fee ladder 2%→1%→0. Seeded in `billing_plan`. |
| Feature gates | **Live.** `lib/plan.ts` is the single reader (`planFor`/`can`/`needsPlan`, 60 s cache, fails open). Flow, Pulse and third-party apps 402 at activation below Pro. |
| Plan API | `GET /api/v1/plan` returns plan + usage + full catalogue. **Zero frontend consumers.** |
| Plan screen | **Missing.** `needsPlan()` refusal copy tells users "Settings → Plan has the details" — that page does not exist. `/settings/about` shows the **legacy, ignored** `workspace.plan` column. |
| Yearly price | Decided ("two months free": €190 / €490) but `billing_plan` has no yearly column. |
| Comped / tailored | `workspace_subscription.status='comped'` + `comped_by/reason/until` exist; every current workspace sits comped on `org` (displayed "Enterprise"). **No custom price, no admin UI** — `/admin/workspaces` is read-only. |
| Stripe | Connect (one-off Checkout, `application_fee_amount`) is mature for ticket money. **Zero subscription code**: `workspace_subscription.stripe_*` columns never written, no Products/Prices, no portal. |
| Request to join | Works end-to-end (`/request-access` → `signup_request` → `/admin/access-requests` → workspace created). **But approval sends no email**, despite both the form and `/access-pending` promising one. Approval also still writes the legacy `workspace.plan` column. |
| Public website | Landing + sign-in + request-access + 4 legal pages. No `/pricing`, no product pages, one brand PNG, no favicon/OG image. |
| Operator economics | Nothing. Pulse can hold costs (`pulse_budget_line`) and income (`pulse_commitment` + items, recurring), and `recordPurchase` already settles paid rows into Pulse (`settleFromPurchase`). The cost floor (~€75/mo) is prose in pricing-proposal.md. |

---

## 2 · Proposed design

### 2.1 The tier matrix — `/admin/plans` (super-admin)

One page, plans as columns, functionality as rows **grouped by app** — The
Fibre (platform), Meet, The Thread, Flow, Pulse, plus cross-cutting rows
(email branding, own sending domain, API keys + external apps, SSO / audit /
retention). Monthly and yearly price per column.

The page reads and writes `billing_plan` — **the same rows the gates read**,
so the matrix cannot drift from enforcement. Checkbox toggles edit
`billing_plan.features`; price fields edit `price_cents_month` /
`price_cents_year` (new column). Edits take effect within 60 s (the
`planFor` cache TTL).

Honest limit, stated on the page: the matrix toggles **existing** feature
keys. Adding a *new* gate is code (`PlanFeature` union in `lib/plan.ts` plus a
call site) — a deploy, on purpose, same as scopes.

### 2.2 Workspace plan controls — tailored pricing + social enterprises

On `/admin/workspaces`, each workspace row gains controls (super-admin API):

- **Set plan** — move a workspace between packages.
- **Comp** — `status='comped'` with `comped_reason` (+ optional
  `comped_until`). This is the social-enterprise lever when the answer is
  "free, and say why".
- **Tailored price** — new nullable `custom_price_cents_month` /
  `custom_price_cents_year` on `workspace_subscription`. Null = list price.
  This is the lever when the answer is "the Pro package at €25".
- **Create workspace** — a super-admin "New workspace" action (name → slug,
  pick plan/comp at creation), so onboarding a chosen organisation no longer
  requires them to file a signup request first.

Tenant-side, Settings → Plan (2.3) shows the *effective* price. The controls
live on the admin side, not in the tenant's own workspace settings — a
workspace must not set its own price.

### 2.3 Settings → Plan (tenant-facing, fibre web)

What you are on, what you are using (seats, emails vs included), what the
other packages offer, and the upgrade CTA. Until Stripe Billing lands the CTA
is "get in touch" (mailto hello@); after P4 it becomes Checkout. Kills the
dead "Settings → Plan" reference and replaces `/settings/about`'s legacy
`workspace.plan` read.

### 2.4 Stripe Billing (the subscription itself)

On the **platform Stripe account** (Solidarity Lab B.V.) — entirely separate
from Connect, which stays as-is for ticket money.

- One Product per plan; monthly + yearly Prices. A sync script
  (`apps/api/scripts/sync-stripe-plans.mjs`) creates them and writes
  `stripe_product_id` / `stripe_price_id_month` / `stripe_price_id_year`
  onto `billing_plan`. Tailored prices use inline `price_data` on the plan's
  Product at subscription time.
- Upgrade = Checkout `mode:'subscription'` → webhook
  `POST /api/v1/billing/stripe-webhook` handling
  `checkout.session.completed`, `customer.subscription.updated/deleted`,
  `invoice.paid`, `invoice.payment_failed` → drives
  `workspace_subscription.status` / period / cancel flags.
- Stripe **billing portal** for card changes, plan switches, cancellation —
  no card data ever near Fibre (PCI note in the 2026-05 roadmap stands).
- Comped rows never touch Stripe (already designed that way).
- Rules carried from pricing-proposal.md, restated as code requirements:
  **downgrade deletes nothing** (read-only, not gone); **never break a live
  event** (enrolment/tickets/check-in work regardless of `past_due`);
  **existing workspaces lose nothing**.
- Sjoerd-side steps (like the still-outstanding Thread webhook): register
  the billing webhook endpoint and `fly secrets set
  STRIPE_BILLING_WEBHOOK_SECRET=whsec_…`; run the sync script once.

### 2.5 The public website

- **Landing** (`/`) redesigned commercially: hero, a section per product
  (Meet, The Thread, Flow, Pulse — pulled from `packages/shared/branding.ts`
  so names/taglines stay single-sourced), pricing teaser, and a visible
  **trial banner**: The Fibre is in an invited trial; access is by request.
  Every CTA routes to `/request-access`.
- **`/pricing`** — public page rendering the live catalogue via a new
  no-auth endpoint `GET /api/v1/public/plans` (catalogue only, no PII, no
  CORS widening beyond what the public web needs). Because it reads the same
  `billing_plan` rows as the gates and the admin matrix, the public page,
  the matrix and enforcement can never disagree.
- **Approval email** — the missing piece of request-to-join: on approve,
  send a branded welcome ("your workspace is ready, sign in here") through
  the existing mailer. The UI has been promising this since v0.14.
- Stays on the white/neutral public style with the handwritten wordmark
  (no rebrand this pass); add a favicon and OG image so shared links stop
  looking bare.

### 2.6 Operator economics

Two halves, split along the data wall:

**(a) `/admin/economics` (super-admin, platform tables only).** MRR by plan
(`workspace_subscription` × effective price, comped = €0 with reasons
listed), plan distribution, platform-fee + purchase income (30/90-day sums
from the `purchase` ledger), signup-request pipeline. No app-owned data is
read — this is the platform's own bookkeeping view.

**(b) Pulse is the business view.** Operating costs become
`pulse_budget_line` rows in the Solidarity Lab workspace — seeded from the
cost-floor table (Fly ~€7, Supabase ~€25, Vercel ~€20, Resend ~€20, domains
~€2), then corrected against real invoices. Subscription income flows in
**automatically**: the billing webhook records each paid subscription
invoice in the `purchase` ledger under `fibre-platform`, and the existing
`settleFromPurchase` loop carries it into Pulse — income per account, per
counterparty, exactly the view Pulse was built for. Automated ingestion of
provider bills (Vercel/Fly/Supabase billing APIs) is parked as an optional
later phase; hand-kept budget lines are honest enough at ~€75/mo.

---

## 3 · Conflicts with the current design (the honest list)

1. **Matrix edits vs. code-defined gates.** `PlanFeature` keys live in
   `lib/plan.ts`; the matrix can only toggle known keys. _Resolution:_ the
   page renders exactly the keys the code knows and says so; new gates are
   deploys, mirroring the app-scopes decision of v0.14.0.
2. **`workspace.plan` is legacy but still written and shown.** Signup
   approval writes it; `/settings/about` and `/admin/workspaces` display it.
   _Resolution:_ stop writing it, point every reader at
   `workspace_subscription` + `billing_plan`, leave the column dead.
3. **Every workspace is comped on Enterprise.** The first Stripe flows must
   not disturb them. _Resolution:_ comped rows are invisible to Stripe by
   design; the admin matrix and economics page show comps explicitly.
4. **Trial messaging vs. a public price list.** The site says invited trial
   while `/pricing` shows a Free tier anyone would want. _Resolution:_
   publish real prices, but every CTA is "request access" during trial;
   self-serve signup is a later flip, not a rebuild.
5. **Yearly price: derived or stored?** "Two months free" could be computed.
   _Resolution:_ store `price_cents_year` explicitly — Enterprise is null,
   and a stored number survives a future promo that breaks the ×10 rule.
6. **Public catalogue endpoint.** `/api/v1/plan` is authenticated;
   the website needs plans signed-out. _Resolution:_ a separate
   `GET /api/v1/public/plans` returning catalogue fields only — same rows,
   no usage, no workspace context; added to the API's public paths like
   `signup-requests` POST.
7. **The approval email was promised, never built.** _Resolution:_ send it
   on approve; template lives with the other auth templates.
8. **Economics vs. the data wall.** The admin dashboard must not read
   app-owned tables. _Resolution:_ `/admin/economics` reads platform tables
   (`workspace_subscription`, `billing_plan`, `purchase`, `signup_request`)
   only; the richer business view lives in Pulse, in Sjoerd's own workspace,
   fed through the sanctioned `purchase` crossing.
9. **Stripe webhooks are Sjoerd-gated.** Code can ship first, but nothing
   confirms until the endpoint + secret are registered (the Thread webhook
   from July is *still* unregistered — this makes it two).
10. **`billing_plan` writes.** No authenticated write policy exists (good).
    _Resolution:_ super-admin edits go through the API with an explicit
    `is_super_admin` check + service role, mirroring `/admin/apps`.

---

## 4 · Build plan (phased)

_Status 2026-09-01, same day: **P1 shipped as v0.20.0, P2 + P3 as v0.21.0**
(Sjoerd: "continue building, don't wait with questions"). P2 confirms
end-to-end only after Sjoerd's Stripe steps — there is currently NO
`STRIPE_SECRET_KEY` on Fly at all. P4 + P5 open._

- **P1 — Plan surfaces (no Stripe):** `price_cents_year` +
  `custom_price_cents_*` migration; `/admin/plans` matrix (view + edit);
  Settings → Plan; `/api/v1/public/plans` + public `/pricing` page; landing
  trial messaging; approval email; workspace-create + plan/comp/tailored
  controls on `/admin/workspaces`; retire legacy `workspace.plan` reads.
- **P2 — Stripe Billing:** sync script, subscription Checkout, billing
  webhook, portal link, status-driven UI on Settings → Plan. Sjoerd
  registers the webhook + secret.
- **P3 — Operator economics:** `/admin/economics`; Pulse cost seed;
  subscription income → purchase ledger → Pulse settle.
- **P4 — Meters that bill:** ~~seat billing~~ shipped 0.22.0
  (lib/seat-billing.ts — quantity on the subscription, prorated; billable
  invites are charged, not refused). Remaining: email/storage overage lines
  on the monthly invoice, 80% warnings, the 13-month Free archive (warning
  email + export first).
- **P5 — Website polish:** product pages per app, favicon/OG, screenshots,
  and the self-serve flip when the trial ends.

## 5 · Decisions for Sjoerd

_All six were built as recommended on 2026-09-01 under the standing "keep
building" instruction. Nothing is hard to reverse — say the word and any of
them changes. Mark this section RESOLVED once read._

- **D1** — The `/admin/plans` matrix is *editable* (prices + feature
  checkboxes, live within 60 s), not just a presentation? (§2.1 —
  recommended: yes)
- **D2** — Tailored pricing and comps are super-admin controls on
  `/admin/workspaces`, shown to the tenant as their effective price on
  Settings → Plan — not a tenant-editable workspace setting? (§2.2 —
  recommended: yes)
- **D3** — `/pricing` shows the real prices during the invited trial, with
  every CTA routed to request-access? (§3.4 — recommended: yes)
- **D4** — Subscription income enters Pulse via the `purchase` ledger
  (`fibre-platform` rows) and operating costs are seeded budget lines in the
  Solidarity Lab workspace? (§2.6 — recommended: yes)
- **D5** — Public site keeps the white/neutral style + handwritten wordmark
  for this pass (favicon + OG added, no rebrand)? (§2.5 — recommended: yes)
- **D6** — Inherited from pricing-proposal.md, still formally open there:
  Starter fee 1% capped €1 (recommended: keep), Free is permanent not a
  trial (recommended: permanent), Meet in every tier (recommended: yes).
