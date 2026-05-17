# Fibre Meet — Intake, Pricing, Payments roadmap

_Drafted 2026-05-17 after reading Suite's implementation. Sjoerd's
ask spans nine distinct features; this is the phased plan, not a
single commit. Each phase is independently shippable._

> **Scope note**: this doc is about Meet's **hosts charging
> invitees** through Stripe Connect. **Platform billing** — Fibre
> charging workspaces to use the platform — is a separate roadmap:
> [`docs/platform-billing-roadmap.md`](platform-billing-roadmap.md).
> The only crossover is the paid-booking application fee that flows
> into the platform's Stripe account (Meet Phase 7 = Platform Phase 7).

## Suite is the design reference

Suite (`/Users/sjoerdair/Projects/souls calendar/`) already implements
the meaty parts; we follow it directly unless a different choice has
a clear reason. Suite's design summary (from a fresh read):

- **Intake**: per-MT, JSON `[{ key, label, type, required, options?, conditional_on? }]`. Field types: short, long, email, select, checkbox. Answers stored on the booking as JSON.
- **Pricing**: single-tier `price_cents` + `price_currency` on the MT. Free = `price_cents IS NULL`.
- **Payments**: **Stripe only** (no PayPal in Suite). Stripe Connect at host level (`Host.stripe_account_id`); Stripe Checkout redirect; funds direct to host.
- **Invoice mode**: two flavours — `EXTERNAL` (host invoices outside the app, booking flips to `INVOICE_PENDING` then host marks paid manually) and `SOUL_SUITE` (app issues a Stripe payment link + email).
- **Payment recording**: enum on the booking (`NOT_REQUIRED | PENDING | PAID | REFUNDED | FAILED | INVOICE_PENDING | INVOICE_SENT`). No separate `payment` table.
- **Refunds**: full-refund only, Stripe API call against `stripe_payment_intent`, host-triggered.
- **Invoice numbering**: sequential per workspace per year (`INV-{year}-{seq}`), stored in a counter table. No PDF — Stripe payment link is the artifact.
- **Tax**: not implemented in Suite. Captures VAT ID + billing country on the booking for display, no computation.

## What our schema already has (v0.10.x onwards)

- `meet_meeting_type.intake_form_id`, `price_cents`, `price_currency`
- `meet_host.stripe_account_id`
- `meet_booking.payment_status`, `payment_method`, `stripe_session_id`, `stripe_payment_intent`, `invitee_answers`
- `meet_intake_form` table with `fields jsonb`

So the foundations exist — code is just not wired to them.

## Sjoerd's additional ask vs Suite

- **PayPal** — Suite doesn't support it. Either we add it (extra integration surface) or we stop at Stripe + Invoice like Suite. Defer until a real user actually asks.
- **Tax** — Suite punts. Brief §6 implies we should be careful with computed financials. Defer past v1.

## Phased plan

| Phase | Scope | Effort | Notes |
|---|---|---|---|
| **1. Intake forms** | Editor on Intake tab; public-page renderer; answer storage on booking | ~1 day | Self-contained, no payment dependencies. **Starting here.** |
| **2. Pricing + Stripe Connect** | Settings → Payments page (paste-`acct_…` like Suite, or full OAuth?); price input on MT (already wired in form.tsx, behind v0.12.6 "coming when Stripe is wired" hint) | ~1 day | Mostly UI + a single Stripe SDK call. |
| **3. Stripe Checkout flow** | Booking flow detects paid MT, creates Checkout session, redirects, polls status; webhook flips `payment_status`; email on confirmation | ~1-2 days | Hardest piece — webhook + race handling. |
| **4. Invoice mode (EXTERNAL)** | Per-MT toggle "Stripe Checkout vs Manual invoice"; booking lands `INVOICE_PENDING`; admin Payments page with "Mark invoiced" + "Mark paid" buttons | ~1 day | Mirrors Suite's EXTERNAL mode. Simpler than Stripe-managed invoices. |
| **5. Invoice numbering + email** | Sequential per-workspace counter table; render Resend email template with line item, billing address, VAT ID; "Resend invoice" button | ~1 day | No PDF in v1 (Suite doesn't either). |
| **6. Refunds** | Admin Payments row "Refund" button; full-refund only; Stripe API call; flips status | ~0.5 day | Tight scope. |
| **7. PayPal** | Net-new integration. PayPal Checkout SDK, webhook, status mapping | ~1.5 days | **Defer until a user asks.** |
| **8. Tax** | EU OSS reverse-charge VAT logic, VIES VAT-ID validation, jurisdiction rate table | ~3-5 days+ | **Defer to v2.** Real legal/financial surface; needs an accountant in the loop, not just code. |

Total to feature parity with Suite (Phase 1-6): **~5-6 days of focused work** spread across iterations.

## What ships now (Phase 1)

- Intake-form editor on the MT editor's Intake tab (today it just says "Intake-form editor coming in the next pass")
- 5 field types matching Suite: short text, long text, email, single-select, checkbox
- `required` toggle per field
- Public booking page renders the questions between time-pick and confirm
- Answers stored on `meet_booking.invitee_answers`
- Email confirmation includes the answers (host-side notification only — invitees see their own answers on the confirmation page)

Out of scope for Phase 1: multi-select fields, conditional logic
(`conditional_on`), file uploads, intake-form reuse across MTs.

## Decision points for Sjoerd

Before Phase 2 ships, two questions:

1. **Stripe Connect onboarding**: paste-`acct_…` like Suite (simple, error-prone) or full OAuth flow (clean, more code)? Suite chose paste. I'd default to that.
2. **PayPal priority**: ship after Phase 6 (parity with Suite) or never (skip unless requested)? Recommend skip.

Tax: I'll always recommend deferring. If real users actually need it,
the right move is a third-party SaaS (Stripe Tax, Quaderno) not
in-house logic.
