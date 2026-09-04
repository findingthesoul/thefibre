# Membership — community subscriptions proposal

_Drafted 2026-09-04 from a design conversation with Sjoerd about soul.com:
community members register, pay a yearly tiered subscription, come and go,
and get access to member things (Circle.so community, threads, …). The
question was **where this lives** — inside The Thread, a separate platform,
or something else. This doc records the answer (a new Fibre app), what it
reuses, what it owns, and the decisions — three accepted in the chat, three
still pending (§5). Name per the naming brief (tools are function names):
**Membership**, slug `membership`._

## 1 · The ask

soul.com wants:

- **Members** (individuals now; organisations with seats later — prep for it)
- **Yearly subscriptions** with multiple tiers and prices
- **Products** — a catalogue: name, description, price, characteristics,
  links out to things (a thread, an event, a Circle space)
- **Invoices + payments** for the subscriptions
- **"SSO"** — which on inspection means: membership controls access to
  external tools, concretely **Circle.so**
- Members **come and go**: join, renew, lapse, rejoin

## 2 · Where it lives

**A new in-family Fibre app.** Not The Thread, not a separate platform, not
Memberful. Reasoning, recorded so it doesn't get re-litigated:

- **Not The Thread.** Thread models *journeys* — enrolments with timelines
  and one-off payments. A membership is a *standing recurring relationship*:
  tiers, renewal dates, grace, lapse, rejoin. Thread has no recurring
  billing and no subscription state; forcing membership into an evergreen
  thread fights the model on every feature. Thread stays involved as the
  *benefit delivery* layer ("members get access to these programmes").
- **Not a separate platform.** The bullet list above is Contacts,
  Organisations, Payments, Auth — all of which the platform already is.
  Separate platform = second contacts DB + second Stripe integration +
  second auth + a sync problem forever. The app model exists precisely so
  this isn't rebuilt.
- **Not `billing_plan`.** The productisation tiers are *The Fibre charging
  workspaces*. Membership tiers are *a workspace charging its community*.
  Two different money layers; similar shape, zero shared code. Member
  subscriptions are app content; the money lands in the purchase ledger
  like every other money event (Stripe is rails, the ledger is the record).
- **Not Memberful** (checked 2026-09-04, memberful.com — Patreon-owned,
  $49/mo + **4.9% of every transaction** on your own Stripe account;
  hosted checkout, tiers, group subscriptions, Discord/Discourse access
  sync, GraphQL API + webhooks, OAuth 2.0 SSO where *Memberful is the
  identity provider*). Three strikes for us: the 4.9% forever; member data
  at a US company next to our EU data wall; and strategically, **every
  association/community workspace The Fibre wants needs exactly this app**
  — soul.com is workspace #1 and the dogfood case, the app becomes a
  sellable member of the family. **Memberful is the blueprint, not the
  vendor.** Two of its choices we copy outright: access-sync integrations
  (invite on join, deactivate on lapse) as the v1 "SSO", and
  OAuth-provider-as-a-service as the credible phase-2 SSO (their build
  proves it's one auth flow + one member-info endpoint, not an
  enterprise-OIDC project). Notably Memberful has **no native Circle
  integration either** — Circle is API glue in both worlds, so buying
  wouldn't even save that work.

soul.com runs as a **workspace on the production Fibre** (the invited-in
door from /admin/workspaces), on whatever billing plan Sjoerd comps or
picks — unrelated to what its members pay it.

## 3 · Proposed design

### 3.1 Primitives (membership schema, app-owned)

```
membership_tier (
  id, workspace_id, name, description,
  price_cents_year, price_cents_month,   -- month nullable; yearly-first
  characteristics jsonb,                 -- marketing bullets
  stripe_price_id_year/month,            -- on the WORKSPACE's Stripe account
  sort_order, archived_at
)

membership_product (
  id, workspace_id, name, description, characteristics jsonb,
  price_cents,                           -- nullable: included-in-tier vs à la carte
  links jsonb,                           -- [{kind: thread|meet|circle_space|url, ref}]
  sort_order, archived_at
)
membership_tier_product (tier_id, product_id)   -- what a tier includes

member (
  id, workspace_id,
  person_id,                             -- individuals now
  organisation_id, seat_allowance,       -- NULL today; the org-prep (§3.5)
  tier_id, status,                       -- active | grace | lapsed | cancelled
  started_at, renews_at, lapsed_at,
  stripe_subscription_id, stripe_customer_id
)

access_grant (
  id, workspace_id, tier_id,
  kind,                                  -- circle | thread | … (deploy-time enum, like scopes)
  config jsonb                           -- e.g. {space_id} or {thread_slug}
)
member_access (
  id, member_id, access_grant_id,
  status, synced_at, external_ref        -- granted | revoked | error
)                                        -- the sync journal; idempotent workers read it
```

Persons/organisations are platform rows (in-family rule — no app-owned
copy). The app justifies curator fields on `person`: tier, member-since,
status, renewal date — so the **Membership profile tab appears emergently**
on every member, like every other app.

### 3.2 What the platform already provides

- **Contacts + orgs** — done. Joining creates/matches a person (the
  Thread enrolment auto-account pattern: email-only, verify at sign-in).
- **Money record** — subscription payments land as `purchase` rows via
  `recordPurchase` (update-first-insert-second on `(app_id, item_ref)`,
  webhook-retry safe). Pulse sees membership income with zero new wiring.
- **Payments SPoT** — the workspace's Stripe account via
  `lib/payment-accounts.ts`. No new credential storage.
- **Activity** — joined / renewed / tier-changed / lapsed / rejoined as
  activity events (type + subject only), validated against the manifest.
- **Consent, soft delete, RLS, cursor pagination, the dialog contract** —
  inherited like every in-family app.

### 3.3 Money flow

Member-level **Stripe Billing subscriptions** on the workspace's connected
Stripe account (NOT the platform's billing account). New webhook route
(`/api/v1/membership/stripe-webhook`, own secret, same shape as Thread's):
`invoice.paid` → extend `renews_at` + `recordPurchase`; payment failure →
`grace`; final failure / cancellation → `lapsed` + revoke access grants.
**Stripe Tax on from day one** (D5) so B2C VAT data is right from the first
member.

### 3.4 Lifecycle + renewal machinery

States live on `member.status`; transitions emit activity events. Renewal
reminders and dunning emails run on the in-API scheduler pattern (5-min
tick, dedup table, 72h lookback — extend the existing scheduler, don't fork
a second one). Rejoin = new subscription on the same `member` row (history
preserved; soft delete only). A Flow definition *visualising* the member
lifecycle is a nice later demo, not a dependency.

### 3.5 Org membership (prep only)

`member` already carries nullable `organisation_id` + `seat_allowance`; a
later `member_seat (member_id, person_id)` table gives org members their
seats (Memberful's "group subscriptions", and the same shape as our own
seat billing). **v1 ships individuals only** — the prep is the two columns
and not baking `person_id NOT NULL` into any logic.

### 3.6 "SSO" = access grants; Circle first

v1 is **access sync, not shared login**: a `circle` access-grant worker on
the Circle.so **Admin API** — member activates → invite to the tier's
space(s); lapses → deactivate. Members hold a Circle password; no identity
federation. `member_access` is the journal so syncs are idempotent and
re-runnable. The same worker shape covers Discord or anything else later —
adding a `kind` is a deploy, like app-key scopes.

**Phase 2 (parked, now credible):** The Fibre as OAuth 2.0 provider
(authorization-code + PKCE + a member-info endpoint, Memberful-style), for
tools that consume OIDC — noting Circle's own SSO consumption is
Enterprise-plan-gated, so this waits for scale that justifies both builds.

### 3.7 Surfaces

- **Public join page** (per workspace): tiers, checkout — Webflow-embeddable
  like Thread's (the te-* class + iframe pattern; embeds stay iframes).
- **Member self-serve**: manage subscription, switch tier, Stripe customer
  portal for card updates, invoices — extends the `/my` portal.
- **Workspace admin**: members list (status/tier/renewal filters), tiers +
  products editors, access grants, the standard dialog contract.
- **Fibre web**: the emergent Membership tab on person profiles.

## 4 · Phasing

1. **v1**: tiers + products, join page + Stripe subscription checkout,
   webhook + ledger, lifecycle + scheduler emails, members admin, Circle
   sync, member self-serve, curator fields/profile tab. Individuals only.
2. **v1.x**: org membership + seats; more grant kinds; embed generator.
3. **v2 (parked)**: OAuth provider ("Sign in with The Fibre").

## 5 · Decisions

Accepted in chat (Sjoerd, 2026-09-04):

- **D1 — Where**: new in-family app **Membership**, not Thread, not a
  separate platform.
- **D2 — Who**: individuals in v1, organisations prepped per §3.5.
- **D3 — Workspace**: soul.com is a workspace on the production Fibre;
  "SSO" v1 = Circle.so access sync via Admin API.

Pending (recommendations stated, Sjoerd decides):

- **D4 — Tier changes**: recommend **upgrade = immediate + prorated
  charge; downgrade/cancel = takes effect at renewal, no refunds** (Stripe
  Billing's native behaviour, and consistent with the 2026-09-04 seat
  decision).
- **D5 — VAT**: B2C consumer rules apply (VAT at the member's country once
  past the €10k cross-border threshold). Recommend **Stripe Tax from day
  one**; **OSS registration** with the Belastingdienst when the threshold
  nears (that step is Sjoerd's, not code).
- **D6 — Build vs Memberful**: recommend **build** (reasons in §2).
  Memberful stays the reference spec; it is also the fallback if speed ever
  trumps the 4.9% + data-residency + family-app arguments.
