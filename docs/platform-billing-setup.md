# Platform billing — Stripe setup (Sjoerd's checklist)

_2026-05-17. Walkthrough for the new Stripe account you just
created. Do these steps once before Phase 1 code lands. Total time:
~20 minutes._

You need to do this **before** I can build Phase 1 — the keys and
webhook signing secret you collect here go on Fly as environment
variables. No code change runs end-to-end without them.

## What you're setting up

| Thing | Where it lives | Why |
|---|---|---|
| **Secret API key** (`sk_live_…`) | Fly secret `STRIPE_SECRET_KEY` | Server-to-server calls (create Checkout session, fetch subscription). |
| **Publishable key** (`pk_live_…`) | Vercel env `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional — only if we ever embed Stripe Elements (we won't initially; hosted Checkout doesn't need it). |
| **Webhook signing secret** (`whsec_…`) | Fly secret `STRIPE_WEBHOOK_SECRET` | HMAC-verifies every webhook event so we trust it actually came from Stripe. |
| **Three Products + their Prices** | Stripe dashboard, then `billing_plan` table | Free / Pro monthly / Pro annual / Org monthly / Org annual. |
| **Billing portal config** | Stripe dashboard | Lets users self-serve card updates + invoice history. |

You can do all of this in **Test mode first** (`sk_test_…` /
`pk_test_…` / `whsec_…` from test endpoints). Toggle to live mode
later by setting the same secrets to the live values. Recommend:
build + ship Phase 1-3 against test mode, then flip to live.

---

## Step 1 — Pull the API keys

1. Stripe dashboard → **Developers → API keys**.
2. Copy **Secret key** (`sk_test_…` for now). **Never** commit this.
3. Copy **Publishable key** (`pk_test_…`). Safe to expose in the web bundle.

## Step 2 — Set up the webhook endpoint

The webhook lives at `https://thefibre-api.fly.dev/api/v1/billing/webhook`
(not built yet — Phase 1 will). Configure Stripe to send to it now
so the secret exists when the code lands.

1. Stripe dashboard → **Developers → Webhooks → Add endpoint**.
2. **Endpoint URL**: `https://thefibre-api.fly.dev/api/v1/billing/webhook`
3. **Listen to events**: pick exactly these (don't subscribe to all events; it's noisy):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Click **Add endpoint**.
5. On the endpoint detail page, copy **Signing secret** (`whsec_…`).

## Step 3 — Set the Fly secrets

From the repo root, on the same Mac that has Fly CLI installed:

```bash
fly secrets set \
  STRIPE_SECRET_KEY="sk_test_…" \
  STRIPE_WEBHOOK_SECRET="whsec_…" \
  -a thefibre-api
```

This deploys to all machines and restarts them. ~1 minute.

## Step 4 — Set the Vercel env vars

Only needed if we eventually embed Elements; harmless to set now:

1. Vercel dashboard → `thefibre` project → **Settings → Environment Variables**.
2. Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…` to **Production and Preview**.
3. Same for `thefibre-meet` project if Meet ever needs Elements (not initially).

## Step 5 — Create the Products + Prices

In Stripe Test mode → **Products → Add product**. Create three
products, each with two prices (monthly + annual):

| Product | Lookup key | Monthly price | Annual price |
|---|---|---|---|
| Fibre Free | `fibre_free` | €0 / month | (skip — no annual on free) |
| Fibre Pro | `fibre_pro` | €15 / user / month | €144 / user / year |
| Fibre Org | `fibre_org` | €30 / user / month | €288 / user / year |

For each price:
- **Pricing model**: Standard pricing → Per unit
- **Billing period**: Monthly or Yearly
- **Lookup key**: `pro_monthly`, `pro_annual`, `org_monthly`,
  `org_annual` (these strings go into Fibre's `billing_plan` table)
- **Currency**: EUR

Copy each Price's `price_…` id — Phase 1 seeds them into
`billing_plan` rows.

## Step 6 — Enable Stripe Tax

Stripe Tax handles VAT (NL + EU) automatically. Saves us from
computing rates or filing reverse-charge ourselves.

1. **Settings → Tax → Activate tax calculation**.
2. Add your **tax registration**: NL VAT number → fill in details.
3. Pick the markets you collect tax in (NL + every EU country you
   sell into — start with NL only if you want simple).
4. On every Checkout session we create, set `automatic_tax: { enabled: true }`.
   The code does this for you.

## Step 7 — Configure the Billing portal

1. **Settings → Billing → Customer portal**.
2. Turn on:
   - **Invoice history**
   - **Update payment method**
   - **Cancel subscriptions** (set to "Cancel at end of period")
   - **Switch plans** (let users move Free ↔ Pro ↔ Org, monthly ↔ annual)
3. Set **Business information**: legal name (Solidarity Lab B.V.),
   support email, privacy + terms URLs.
4. **Branding**: upload the Fibre wordmark, set the accent colour to
   match the platform. (Optional but makes the portal feel like
   yours.)
5. Save.

## Step 8 — Tell me when done

Once steps 1-7 are checked off, message "billing setup done" and
I'll:

- Add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to
  `apps/api/.env.example`
- Land Phase 1 (migrations + the billing_plan seed with your real
  Price IDs)
- Add the Stripe SDK to `apps/api`
- Wire `POST /api/v1/billing/checkout` (Stripe Checkout session
  for an upgrade)
- Wire `POST /api/v1/billing/webhook` (signature-verified, idempotent
  handler for the six events)
- Build `/settings/workspace/billing` on the web (current plan,
  seat count, upgrade button, "manage in Stripe" portal link)

Total Phase 1-3 work after your green light: ~3-4 days.

---

## Going live later

When Phase 1-3 is shipped and tested in Test mode, switch to live:

1. Stripe dashboard → toggle **Test mode → Live mode** (top right).
2. Re-do Step 1 (Secret key + Publishable key are different in
   Live mode).
3. Re-do Step 2 (Live webhook endpoint, new `whsec_…`).
4. Re-create the Products + Prices in Live mode (Stripe doesn't
   copy them across). Or use Stripe CLI:
   `stripe products create --copy-from <test_product_id>` works
   for some accounts.
5. Update the same Fly + Vercel secrets to the live values.
6. Update the `billing_plan` rows in prod DB to point at the live
   Price IDs.

Recommended: keep Test-mode keys on the Fly *staging* app
(`thefibre-api-staging` if you ever spin one up) and Live keys on
prod. Until staging exists, swap the prod secrets when ready to
flip — Stripe will reject signatures from the wrong mode, which
is the safety net.
