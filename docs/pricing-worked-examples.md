# What a workspace pays — worked examples

_2026-09-01. Numbers from the live catalogue (`/admin/plans`); market prices
from Calendly/Eventbrite 2026 public pricing. A **seat** is a person who runs
things (a workspace user). Participants, enrollees and invitees never count._

## The packages

| Per workspace / month, ex-VAT | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Base | €0 | €19 | €49 | talk to us |
| Yearly (2 months free) | €0 | €190 | €490 | — |
| Seats included | 1 | 2 | 5 | unlimited |
| Extra seat | — | €8/mo | €8/mo | included |
| Fee on paid enrolments | 2%, max €2 | 1%, max €1 | 0% | 0% |
| Email / month | 200 | 2,000 | 10,000 | negotiated |
| Flow + Pulse | — | — | ✓ | ✓ |
| Design your own threads | — | templates only | ✓ | ✓ |

## Example 1 — soul.com (14 users)

| | Starter | Pro |
|---|---|---|
| Base | €19 | €49 |
| Extra seats | 12 × €8 = €96 | 9 × €8 = €72 |
| **Per month** | **€115** | **€121** |
| Per year (annual billing) | €190 + 12×€80 = **€1,150** | €490 + 9×€80 = **€1,210** |
| Fee on paid enrolments | 1%, max €1 | 0% |

_Yearly seats follow the same two-months-free rule as the base (€80/seat/yr),
so "yearly is two months free" is true of the whole invoice._

→ At 14 seats the two plans nearly converge, so **Pro is the obvious choice**
(€6 more buys Flow, Pulse, custom threads, 0% fees).
→ Market: 14 users on Calendly Teams alone ≈ **$224/month** — scheduling only.
→ Today: soul.com is comped on Enterprise (€0) as one of Sjoerd's own
businesses.

## Example 2 — a festival (2 organisers, 400 participants, 350 × €80 tickets/yr)

| | Base / yr | Fees / yr | **Total / yr** |
|---|---|---|---|
| Free | won't fit — 1 seat | | |
| Starter | €228 | 350 × €0.80 = €280 | **€508** |
| Pro | €588 | €0 | **€588** |

→ Starter wins on cash; Pro wins the moment they want Flow, Pulse or their own
thread designs.
→ Eventbrite on the same 350 tickets: ≈ **€2,300** in fees.

## Example 3 — a community group (1 person, one gathering, 60 × €10 tickets)

| | Per year |
|---|---|
| Free base | €0 |
| Fees | 60 × €0.20 = €12 |
| **Total** | **€12** |

→ The "Free pays its own postage" design. Permanent, not a trial.

## Example 4 — an invited social enterprise (tailored)

Created on `/admin/workspaces` → New workspace → plan **Pro**, tailored
**€25/month** (or comped with a written reason).

| | |
|---|---|
| They get | all of Pro: 5 seats, Flow + Pulse, 0% fees |
| They pay | €25/mo — shown as their price on Settings → Plan |
| You see | €25 in /admin/economics MRR, flagged "tailored" |

## How seats bill (wired v0.22.0)

Extra seats are a second item on the Stripe subscription, quantity = seats
over the allowance, prorated by Stripe on every change
(`lib/seat-billing.ts`):

- **Checkout** counts existing seats against the plan being bought — soul.com
  buying Pro is billed €49 + 9×€8 from day one.
- **An invite past the allowance** on a subscribed workspace is *charged*
  (prorated €8), not refused. The 402 remains only where there is nothing to
  charge: Free, comped, or unpaid workspaces.
- **A plan switch in the portal** re-counts seats against the new allowance
  automatically (webhook → reconcile).
- Nobody is ever removed by a pricing change — the limit still only binds on
  the next invite.
