# Pricing — a proposal

**Status:** proposal, 2026-08-31. Nothing built. **Prices set by Sjoerd
2026-08-31: Starter €14, Pro €39.** The rest of this argues for a shape and
shows what it costs to run.

Sjoerd's constraints, taken as fixed:

1. **Sell the package, not the parts.** One subscription, the whole Fibre.
2. **Nobody uses the platform without Meet or Thread.** The platform on its own
   is not a product anyone buys.
3. **Flow and Pulse from the second paid level.**
4. **Starter Thread gets predefined templates only** — no free-form design.
5. **Prices low enough that nobody is tempted to build it themselves.**
6. **A monthly fee plus a usage fee** (email, data).
7. **Solidarity Lab and Festival of Trust sit at the top tier, at zero.**

---

## What already exists (and why it changes the answer)

This is not a green field. `20260519100000_platform_billing_phase1.sql` shipped
a working spine:

- **`billing_plan`** — id, name, `price_cents_user_month`, a transaction fee
  (`meet_paid_pct` + `meet_paid_cap_cents`), and a `features` jsonb already
  carrying `max_users`, `max_contacts`, `max_activities_month`. Seeded free /
  pro / org.
- **`workspace_subscription`** — plan, Stripe customer + subscription ids,
  interval, period end, trial, seat count, and a **`comped`** status with
  `comped_by` / `comped_reason` / `comped_until`.
- **`workspace_meet_fee(ws_id)`** — read at every Stripe Checkout through
  `lib/fees.ts`. **The fee ladder is already live.** Free workspaces are
  charged 2% capped at €2; paid plans are waived.

Both of Sjoerd's workspaces already hold `comped` rows. Constraint 7 is a data
change, not a feature.

Two corrections worth carrying forward:

- **`workspace.plan` is legacy and ignored.** The authoritative plan is
  `workspace_subscription.plan_id`. Anything gating on the text column is
  gating on the wrong thing.
- **The 2026-05-17 model was per-seat** (€15/user Pro, €30/user Org). I think
  that is now the wrong shape, and the rest of this document says why.

---

## The shape: per workspace, not per seat

Per-seat is the SaaS default and it is wrong for these buyers.

A festival has two organisers and four hundred participants. Per-seat prices
the two and ignores the four hundred — so revenue does not follow the value
delivered, and every co-organiser added is a small punishment for using the
product properly. The Thread wants more facilitators on a thread, not fewer.

Per workspace, with a seat allowance nobody normally hits, is:

- **predictable** — one number, no bill that moves when a volunteer is added;
- **cheap to say** — "€19 a month" fits in a sentence, which matters for
  constraint 5;
- **honest about the cost driver** — what actually costs money is email and
  storage, and those are metered separately below.

---

## The tiers

Prices ex-VAT, per workspace per month. Annual: two months free.

| | **Free** | **Starter** | **Pro** | **Enterprise** |
|---|---|---|---|---|
| Price | €0 | **€14** | **€39** | talk to us |
| Annual (2 months free) | €0 | €140/yr | €390/yr | — |
| Organisers | 1 | 5 | unlimited | unlimited |
| Contacts | 250 | unlimited | unlimited | unlimited |
| **Meet** | ✓ | ✓ | ✓ | ✓ |
| **The Thread** | 1 live event | unlimited, **predefined templates** | unlimited, **design your own** | ✓ |
| Certificates | — | ✓ | ✓ | ✓ |
| **Flow** | — | — | ✓ | ✓ |
| **Pulse** | — | — | ✓ | ✓ |
| Your logo + sender name on email | — | ✓ | ✓ | ✓ |
| Your own sending domain | — | — | ✓ | ✓ |
| External apps + API keys | — | — | ✓ | ✓ |
| Fee on paid enrolments | 2%, max €2 | 1%, max €1 | **0%** | 0% |
| Email included / month | 200 | 2,000 | 10,000 | negotiated |
| Storage included | 1 GB | 5 GB | 25 GB | negotiated |
| SSO, audit log, retention controls | — | — | — | ✓ |

**Usage above the bundle:** €1 per 1,000 emails · €0.50 per GB per month.

**Enterprise** is a conversation, not a price list. It exists so that the two
workspaces that are Sjoerd's own businesses sit somewhere truthful — a `comped`
row on the top plan, with a reason written next to it — rather than looking
like customers who never pay.

### Why these numbers

**€14 Starter.** Below the threshold where an organisation convenes a meeting
about it — the kind of number a treasurer approves without an agenda item. The
competition at that price is not another product, it is Mailchimp plus
Eventbrite plus a spreadsheet, which costs more and does less.

**€39 Pro.** Flow and Pulse are what you reach for when the work is continuous
rather than one event a year — the point at which someone is running an
operation rather than an occasion. Roughly the price of one hour of the
bookkeeping Pulse replaces.

**What the fee ladder actually does.** An earlier draft of this document
claimed Pro paid for itself at about €2,500 of ticket revenue. That was wrong,
and wrong in the flattering direction: 2% of €2,500 is €50, nowhere near a
year of Pro. The cap is per ticket, so the honest sum is per ticket too. On
€80 tickets: Free costs €1.60 each, Starter €0.80, Pro nothing.

| Tickets a year, at €80 | Free | Starter €14 | Pro €39 |
|---|---|---|---|
| 100 | €160 | €248 | €468 |
| 400 | €640 | €488 | €468 |
| 1,000 | €1,600 | €968 | €468 |

Which says something better than a sales line: **below roughly 250 tickets a
year, Free is genuinely the cheapest place to be**, and it should be — that is
the community group running one gathering. Around 300–500 tickets Starter wins.
Past that Pro is cheaper than the fee it removes, and the organiser can check
that themselves on the back of an envelope.

So Pro is sold by Flow, Pulse and designing your own threads. The fee ladder is
a nudge at the edges, not the argument.

**Free keeps one live event, permanently.** Not a trial. A small community
group can run a gathering a year and never pay, which is a decision about what
this platform is for — and a 2% fee on paid enrolments means it still pays for
its own postage.

---

## Why a usage fee at all

Because email is the one thing that genuinely costs per unit, and because
someone with a 5,000-person list is imposing a real cost that €19 does not
cover.

Everything else is a bad meter. The 2026-05-17 doc argued this and it still
holds: metering contacts punishes the behaviour the product exists to
encourage, and metering activities makes the bill unpredictable for a number
the user cannot see themselves accumulating.

The meters already exist:

- **`thread_message_send`** — one row per (engagement, person), which is
  exactly one email. Nothing new to instrument.
- Supabase storage reports bytes per bucket for the storage line.

**Rule: a bundle nobody normal exceeds, and an overage that never surprises.**
Warn at 80%, invoice the overage on the next monthly invoice, and never refuse
to send. A ticket that does not arrive because a workspace crossed a threshold
is not a billing event, it is a failure.

---

## What it costs to run

Roughly, at today's scale (EUR/month, my estimates — check against the actual
invoices before quoting them):

| | |
|---|---|
| Fly (API, 1 shared-cpu-1x 1GB, fra) | ~7 |
| Supabase Pro (EU, Ireland) | ~25 |
| Vercel (five apps) | ~20 |
| Resend | ~20 |
| Domains | ~2 |
| **Fixed floor** | **~€75** |

**Break-even is six Starter customers, or two Pro.** Everything above that is
close to margin, because the marginal cost of one more workspace is a few
database rows and its own email.

That is the real argument for constraint 5. The cost of building this yourself
is not €14 a month, it is a developer — and the person who says "I'll just
build it" is comparing against a price low enough that the comparison is
embarrassing.

---

## What downgrading does

**It never deletes anything.** A workspace that drops from Pro to Starter keeps
its flows, its Pulse figures and its custom-designed threads: they become
read-only, not gone. The upgrade path back is a click, and nothing has to be
rebuilt.

This needs saying in writing because it is the one place a plan gate can do
real harm, and because the alternative is a support conversation that begins
with "where did our data go".

Two more rules of the same kind:

- **Never break a live event.** Enrolment, tickets, check-in and the QR at the
  door keep working regardless of plan state — including `past_due`. Payment
  problems are settled with the organiser, never at the door with a participant.
- **Existing workspaces lose nothing.** Everyone currently using the platform
  keeps what they have. The first bill that takes something away is a betrayal,
  and the people affected are the ones who trusted it first.

---

## What building it needs

The spine is there; the gates are not. Roughly:

1. **A plan seed update** — add `starter`, restate `pro`, rename `org` to
   `enterprise`, move the feature list into `billing_plan.features`. One
   migration.
2. **`lib/plan.ts` — one reader.** `planFor(workspaceId)` and `can(workspace,
   feature)`. Every gate asks it. A plan check scattered across routes cannot
   be reasoned about or changed, which is the mistake this note exists to
   prevent.
3. **The gates themselves** — six or seven places: thread creation past the
   free limit, template design, Flow, Pulse, app keys, custom sender domain,
   certificates.
4. **Stripe Billing** for the subscription itself (Checkout + customer portal +
   webhook on `customer.subscription.*`). Separate from Connect, which is
   already live for ticket money.
5. **The usage meter** — a monthly count from `thread_message_send`, a storage
   read, an overage line on the invoice, and the 80% warning.
6. **A plan screen** — what you are on, what you are using, what you would get.

Phases 3–6 of `platform-billing-roadmap.md` still describe most of this
accurately; it was written before Thread, Flow and Pulse existed, so its
per-seat model and its app list are the parts to ignore.

---

## What I need decided

1. **Per workspace, or per seat?** Everything above assumes per workspace.
2. ~~€19 / €49~~ — **settled: €14 / €39** (2026-08-31).
3. **Does Starter really waive most of the fee?** 1% capped at €1 is generous.
   The alternative is Starter at 2% and only Pro waiving it, which pushes
   harder toward Pro.
4. **Is Free permanent, or a 30-day trial?** I argue permanent, above.
5. **Does Meet stay in every tier?** It is the least differentiated of the
   apps, and it is what someone signs up for first.
