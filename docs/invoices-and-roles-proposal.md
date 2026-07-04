# Invoices area + role tiers — design proposal

_Drafted 2026-07-04 from Sjoerd's brief: a Fibre-wide Invoices area (Meet +
Thread purchases), reimbursements, resend-invoice, purchase-item lists,
search; scopable to me / team / workspace; role-gated (Super Admin, Admin,
Organiser, Facilitator). This doc thinks it through and names the conflicts
with the current design before any code._

## 1 · What exists today (inventory)

**Money lives in two app-owned tables, differently shaped:**

| | Fibre Meet | The Thread |
|---|---|---|
| Purchase row | `meet_booking` (payment_status, stripe_session_id, payment_intent) | `thread_enrolment` (payment_status, amount_cents, currency, coupon_id, stripe ids) |
| Legal invoice | Stripe auto-invoice; **`stripe_invoice_id/url` stored** | Stripe auto-invoice enabled; **URL not retrieved/stored** (gap) |
| Split ledger | — (fee only, via application_fee) | `thread_payout` (gross / platform fee / vendor share / org share) |
| Invoice-method (manual) | pay-per-invoice flow | payment_methods `invoice` + organiser Mark-paid |
| Refunds | `payment_status='refunded'` enum exists, **no flow** | same — enum exists, **no flow** |

**Roles today:** `workspace_member.workspace_role ∈ {admin, member}` +
`relationship_type` + per-app `app_membership` (permission tiers, v0.9.0).
Per-object roles exist only in Thread: `thread_thread_organiser.role ∈
{host, facilitator}`. Meet has a host per meeting type. Both apps
auto-provision an organiser/host profile on first use — so "every account
is an organiser at minimum" is already true in behaviour, just not in
vocabulary.

**The data wall (brief §2/§5):** each app owns its content; apps cross the
wall only via the `activity` log (type + subject). Platform owns identity,
enrolment state, consent.

## 2 · Proposed design

### 2.1 A platform `purchase` ledger (new primitive)

One row per money event, written by the app at the moment it happens —
the same pattern as the activity log, but for commerce:

```
purchase (
  id, workspace_id, app_id,                 -- who sold it, from which app
  person_id,                                -- the buyer (platform person)
  payer_name, payer_email,                  -- denormalised at purchase time
  item_label,                               -- "Vertrouwen als de basis · Standard"
  item_ref,                                 -- app-local id (booking id / thread_enrolment id)
  organiser_user_id,                        -- whose sale this is (scoping "me")
  team_id,                                  -- nullable (scoping "team")
  amount_cents, currency,
  platform_fee_cents, vendor_share_cents, org_share_cents,
  method            stripe | invoice,
  status            pending | paid | refunded | failed,
  stripe_payment_intent, stripe_invoice_id, stripe_invoice_url,
  paid_at, refunded_at, created_at
)
```

RLS: workspace-scoped + role-gated (see §2.3). Apps write via the API
(adminClient) at: checkout completion, mark-paid, refund. Existing paid
rows are backfilled by migration from `meet_booking` + `thread_enrolment`.
`thread_payout` stays as Thread's internal split ledger; the purchase row
carries a copy of the split for display.

### 2.2 The Invoices area

A page in **both Meet and Thread sidebars** (same component shape), backed
by one platform API (`/api/v1/purchases`):

- **Scope switcher:** Me / Team (picker) / Workspace — workspace only for
  Admin+.
- **List:** payer, item, app badge, date, amount, method, status; cursor
  pagination (hard rule #6); **search field** (payer name/email, item).
- **Row functions:** open Stripe invoice, **Resend invoice** (email the
  hosted invoice link, branded), **Reimburse** (Stripe refund on the
  connected account; invoice-method → "Mark refunded"), Mark paid
  (invoice-method, already exists — moves here too), open the underlying
  booking/enrolment.
- **Totals bar** per current filter (sum, fees, refunds).

### 2.3 Role model

Workspace-level (extends `workspace_role`, one migration):

| | Super Admin | Admin | Organiser (default) |
|---|---|---|---|
| See invoices: own sales | ✓ | ✓ | ✓ |
| See invoices: team | ✓ | ✓ | if team member |
| See invoices: whole workspace | ✓ | ✓ | — |
| Reimburse / resend / mark paid | all | all | own sales only |
| Workspace settings, plans, Stripe | ✓ | — | — |
| Manage members + roles | ✓ | ✓ (not Super Admins) | — |

**Facilitator is NOT a workspace role.** It stays what it already is: a
per-object role (on a thread, later per meeting type). "Every account is
an organiser at minimum, but can facilitate someone else's" = workspace
role `organiser` + a `facilitator` row on specific threads. Facilitators
see **no financial data** by default (money is the organiser's business).

JWT: the auth hook additionally injects `workspace_role` so RLS policies
on `purchase` can gate without an extra join.

## 3 · Conflicts with the current design (the honest list)

1. **The data wall.** Brief v0.4 says apps cross the wall only via the
   activity log. A platform purchase ledger is a second crossing.
   _Resolution:_ amend the brief (v0.5) — commerce is a platform concern
   like enrolment state; the ledger carries transactional metadata, not
   app content. Precedent: the SPoT members/profile decision.
2. **Role vocabulary collision.** Today: `admin | member`. Proposed:
   `super_admin | admin | organiser`. Migration renames `member →
   organiser` and promotes exactly one existing admin (Sjoerd) per
   workspace to `super_admin`. Every place that checks
   `workspace_role = 'admin'` (permission-tier RLS helpers, members API)
   must accept `super_admin` too — a sweep, not a rewrite.
3. **"Organiser" is overloaded.** `thread_organiser` (an app object) and
   the new workspace role would share a name. Accepted — context
   disambiguates — but the members UI should say "Organiser (default)".
4. **Facilitator-as-workspace-role would conflict** with the existing
   per-thread `facilitator`. Resolved by keeping it per-object (§2.3).
   If a facilitator-only *account tier* is ever wanted (cheaper seat,
   no organiser profile), that contradicts "every account is an organiser
   at minimum" — parked.
5. **Thread doesn't store the Stripe invoice URL.** The webhook enables
   invoice creation but never retrieves `hosted_invoice_url` (Meet does).
   Must be fixed for resend-invoice; also backfill can't recover URLs for
   past Thread payments without a Stripe API sweep.
6. **Invoice-method purchases have no document.** "Resend the invoice"
   can only resend Stripe-hosted invoices. For manual-invoice sales the
   organiser sends their own document; v1 resends the payment-pending
   email instead. (Generating our own PDF invoices = a later phase with
   numbering/VAT obligations — deliberately out of scope.)
7. **Refunds × Connect mechanics.** Refunds run on the connected account
   (`stripeAccount` header) against the payment intent. Decisions baked
   in: v1 = full refunds only; `refund_application_fee: true` (the
   platform gives its skim back — fair, and simpler accounting);
   Stripe does not auto-issue credit notes — noted as a limitation.
   `thread_payout` rows flip to `refunded` (new status value).
8. **Existing surfaces aren't role-gated.** Registrations/enrolments
   pages show all workspace data to any member with the app. Introducing
   tiers for invoices creates an expectation that other surfaces follow.
   _Scope decision:_ v1 gates the Invoices area only; a later pass aligns
   enrolments/contacts visibility with roles.
9. **Not the same thing as platform billing.** The Invoices area is money
   the workspace's organisers *receive*. The workspace's own Fibre
   subscription (billing plans, fee waiver) is separate and stays in
   Settings. The sidebar label should avoid confusion — "Invoices" is
   fine if the page only ever shows sales.
10. **Cross-workspace "me".** A person can organise in several
    workspaces; the ledger is workspace-scoped like everything else. The
    "me" scope is me-within-this-workspace. No global earnings view in v1.

## 4 · Build plan (phased)

1. **P1 — Ledger + roles:** `purchase` table + RLS + role migration
   (`super_admin/admin/organiser`) + auth-hook claim + backfill from both
   apps + write-paths (Meet webhook, Thread webhook, mark-paid). Thread
   webhook starts storing invoice id/url.
2. **P2 — Invoices UI:** sidebar entry in Meet + Thread, scope switcher,
   search, cursor-paginated list, totals, row detail popup (per the
   dialog contract).
3. **P3 — Functions:** resend invoice (email), reimburse (Stripe refund +
   ledger + payout flip; mark-refunded for invoice-method), mark paid.
4. **P4 — Members UI update:** role picker with the four-tier vocabulary
   (Facilitator shown as per-thread badge, not a workspace role).

## 5 · Decisions — RESOLVED 2026-07-04

All four accepted as recommended and shipped (v0.13.93 → 0.13.95+):
**D1** ledger amendment ✓ · **D2** facilitator per-object, no money ✓ ·
**D3** refunds return the platform fee ✓ · **D4** Invoices in both app
sidebars ✓. Additions since: receipt-styled emails with seller identity
(user_profile/workspace.invoice_details), invoice payment links,
billing fields on enrol (incl. tax no.), payment-method inheritance
account → thread → ticket, payments settings as a true platform SPoT
(user_profile + workspace columns; app-local columns are read fallbacks).

Original questions for the record:

- **D1** Amend the brief to allow the platform purchase ledger? (§3.1 —
  recommended: yes)
- **D2** Facilitator = per-object role, invisible in Invoices? (§2.3 —
  recommended: yes)
- **D3** Refunds return the platform fee? (§3.7 — recommended: yes)
- **D4** Invoices page in both app sidebars (shared component) vs only on
  thefibre.app? (recommended: both apps, same API)
