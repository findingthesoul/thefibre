# The Thread — rebuild plan (v3 → Fibre-native)

_Decisions locked with Sjoerd 2026-07-01. This supersedes the scope of
[`the-thread-integration-brief-v0.3.md`](./the-thread-integration-brief-v0.3.md)
for the app build; that brief remains valid for the data-wall rules._

## What this is

The Thread rebuilt from scratch inside the Fibre monorepo — simpler than
`~/Projects/thethread-v3` (v3.3.0), built on Fibre contacts and platform
primitives, in the Fibre interface family. thethread-v3 is the functional
reference (read the source before reimplementing — same rule as Suite→Meet);
its interface is NOT ported.

## Scope — the 8 features (locked)

1. Threads with different types of engagements — **all 8 v3 types**
2. Enrolments per thread — paid, coupons (percentage/amount/free, early-bird)
3. Certificate per thread + certificate designer — **print-quality HTML output**
   (element-based designer ported from v3; server-side PDF deferred)
4. Zoom/Teams links on engagements — plain `meeting_url` field (v3 approach; no OAuth)
5. Multi-organiser — co-organisers per thread, one primary
6. Per-organiser Stripe — **v3's full revenue split ported**:
   platform skim (plan-aware, `workspace_meet_fee()`) → vendor cut → workspace share
7. Public front end — organiser page, thread page + agenda, enrolment flow
8. Email sequences — v3 model: message-type engagements with `scheduled_at`,
   sent by an in-API scheduler (Fly is always warm — no Vercel cron)

Explicitly NOT ported (the v3 bloat): thread chat/entries/memory, interactions
dashboard, facilitator studio, Accredible, custom domains, i18n, PWA, SaaS
package admin, 7 page styles, templates, org calendars.

## Design contracts honoured

- **In-family apps use platform tables natively.** A thread IS a platform
  `program` row (`format: 'event' | 'journey'`, `app_id = 'the-thread'`).
  An enrolment IS a platform `enrolment` row. Thread owns only what it
  justifies (brief v0.4 §2): engagements, pricing, coupons, certificates,
  message sends, payouts.
- **Data wall:** activity rows carry type + subject only
  (`event_registered`, `session_attended`, `journey_step_completed`,
  `programme_completed`). Registration answers, message bodies, certificates
  stay in Thread tables.
- **Fibre interface family:** the existing `apps/thread/` shell
  (sidebar/topbar/app-switcher), cream canvas, Lucide, left-aligned,
  `NameAndSlugFields`, 2-card choosers, curated dropdowns.
- **Versioning:** Thread has its own user-facing version (`v3.x` — the rebuild
  of thethread-v3), decoupled from the monorepo cadence, same rule as Meet's v2.x.

## Data model (all `thread_` prefixed, Meet RLS pattern)

| Table | Purpose |
|---|---|
| `thread_organiser` | One per user: slug, bio, photo, timezone, `stripe_account_id` (paste flow), `vendor_cut_percent` |
| `thread_settings` | One per workspace: workspace `stripe_account_id` (org share destination), default vendor cut, email branding |
| `thread_thread` | The thread: `program_id` 1:1 → `program` (title/status/dates live there), organiser (primary/vendor), slug, intention, pricing, capacity, registration_fields JSONB, certificate config, `is_public_listed` |
| `thread_thread_organiser` | Co-organisers (role: co_organiser \| facilitator) |
| `thread_engagement` | 8 types in two families — activities: `event`, `conversation`, `workshop` (starts/ends, location, `meeting_url`); messages: `reflection`, `practice`, `message`, `document`, `inspiration` (`scheduled_at`, `content` JSONB). Type may only change within its family after save (v3 rule) |
| `thread_enrolment` | Companion to platform `enrolment` (1:1): payment_status, amount, coupon, Stripe ids, registration answers, idempotency `request_id` |
| `thread_coupon` | code, percentage/amount/free, usage limit, expiry, early-bird deadline. Discount applied at Checkout creation — no Stripe coupon sync |
| `thread_certificate_template` | Designer doc: page_size, orientation, background_url, `elements` JSONB (%-positioned text/field/image/line, field tokens) |
| `thread_certificate` | Issued: `THR-YYYY-XXXXX` unique number, recipient snapshot, template snapshot (issued certs never change) |
| `thread_message_send` | Send log per (engagement, person) — dedup + idempotency |
| `thread_payout` | Per paid enrolment: gross / platform fee / vendor share / org share, transfer id, status |

## Revenue split (feature 6, v3 semantics on Fibre billing)

```
gross
 ├─ platform skim  = workspace_meet_fee(workspace_id)   -- 2% capped €2 (Free), 0% (Pro/Org)
 └─ net            = gross - skim
     ├─ vendor share = net × organiser.vendor_cut_percent
     └─ org share    = net - vendor share  → workspace's thread_settings.stripe_account_id
```

Checkout Session runs against the **primary organiser's** connected account
(`transfer_data` / direct charge like Meet), `application_fee_amount` = skim +
org share; the webhook transfers the org share to the workspace account and
writes a `thread_payout` row. If the organiser has no Stripe account, the
workspace account is the destination and vendor share is 0. Default
`vendor_cut_percent` = 100 (solo organiser keeps everything net of skim) —
workspace admin lowers it per organiser when the org takes a cut.
Webhook edge cases from v3 to keep: empty-string metadata treated as falsy;
idempotency via `payment_status='paid'` check; free coupons bypass Stripe
entirely (enrolment confirmed immediately).

## Public routes (thread.thefibre.app)

- `/{organiserSlug}` — organiser page: photo, bio, listed threads
- `/{organiserSlug}/{threadSlug}` — thread page: cover, intention, agenda
  (activities with `show_in_agenda`), enrol CTA, price
- `/{organiserSlug}/{threadSlug}/enrol` — registration: name/email +
  `registration_fields`, coupon entry, consent (transactional required,
  marketing opt-in) → person create/match → enrolment → Checkout if paid
- `/certificate/{number}` — public certificate view + A4 print route

## Phases (one version each)

1. **Schema + plan doc** — this file + `20260701090000_thread_schema.sql`
2. **API foundation + threads CRUD** — organiser auto-create, threads
   list/new/editor (Basics), program-row sync, nav
3. **Engagements** — timeline editor, 8 types, meeting links
4. **Public pages + free enrolment** — closes the platform loop
   (person + consent + enrolment + activity + email)
5. **Payments** — Stripe paste flow, coupons, Checkout, webhook, split, payouts
6. **Certificates** — designer, issuance, public page + print
7. **Email sequences** — in-API scheduler, personalisation, send log

## v3 gotchas ported forward

- Store engagement times in UTC; convert to thread timezone at display only.
- Mark messages sent immediately (send log row) before side-effects to avoid retry races.
- Dedup message recipients by person across cohorts/enrolments.
- Early-bird deadline validated at registration time, not checkout time.
- Certificate element positioning is %-based, never px.
- Public pages read via service-role (admin client) — RLS blocks anon.
- Publish button on an already-active thread must be a no-op, not an error.
