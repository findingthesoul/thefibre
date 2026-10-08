# Free-plan limits, and what Meet sells

A proposal, for Sjoerd to accept or change before any code. Two jobs he asked
for on 2026-10-08 — *"limits real"* and *"meet paid feautres"* — and both
touch real customers, so everything below is read from the code and the plan
table rather than remembered. Where I am proposing rather than reporting, it
says so.

---

## Part A — the limits are already real, except in two places

The brief was "the Free plan's paper limits become enforced". That premise is
mostly wrong, and in a good way: `apps/api/src/lib/usage-meters.ts` (527
lines, running every five minutes under the scheduler lease) already does
three of the four things the brief asks for.

**Already true today:**

| | |
|---|---|
| **80% warning** | When email or storage crosses 80% of the allowance, the workspace's admins get ONE email per meter per calendar month. Dedup is a unique row in `usage_warning`, so the five-minute tick cannot spam. It covers EVERY workspace, Free included — all 119 on staging have a `workspace_subscription` row. |
| **Overage billing** | Last month's usage past the allowance becomes a Stripe invoice item on the next subscription invoice. Dedup per (workspace, meter, closed month). |
| **Inactivity archive** | A Free workspace with no sign-ins and no activity for 12 months is warned by email with an export pointer; at 13 months, and never less than 30 days after that warning, it is **flagged** archived. Nothing is deleted. `POST /billing/reactivate` undoes it. |

**The plan matrix as it actually stands** (read from `billing_plan`):

| Plan | Seats | Emails/month | Overage per 1,000 | Storage | Retention |
|---|---|---|---|---|---|
| Free | 1 | 200 | **none — soft** | 1 GB | 13 months |
| Starter €29 | 2 | 2,000 | €1.00 | 5 GB | unlimited |
| Pro €59 | 5 | 10,000 | €1.00 | 25 GB | unlimited |
| Enterprise / Beta | ∞ | unlimited | — | ∞ | unlimited |

### What counts as an email

Exactly one thing: a row in `thread_message_send` — a **scheduled message
from a Thread** (`emailsSentBetween` in `lib/plan.ts`). Booking
confirmations, receipts, invoices, certificates, sign-in codes, membership
mail and everything else are **not counted at all**.

So the brief's "never block transactional mail" is already true by
construction, and more strongly than it asked: transactional mail is not even
measured. **That is worth keeping explicitly**, because the obvious "fix"
later — count all mail — would quietly make a sign-in code a billable event.

### Gap 1: nothing happens at the Free cap

Free's overage price is NULL, which the code reads as *the allowance is soft
and nothing bills*. So a Free workspace that sends 5,000 scheduled messages
gets a warning at 160 and then nothing. The cap is a number on a pricing page.

**Three ways to close it. My recommendation is the second.**

1. **Hard stop at 200.** The scheduler stops sending that workspace's thread
   messages until the month turns. Honest, and brutal: the messages people
   had scheduled for their event simply do not arrive, and the first they
   know is a participant asking why.
2. **Hold and ask.** Past the cap, scheduled messages QUEUE instead of
   sending; the workspace's admins get one mail saying how many are waiting,
   what it costs to release them (upgrade, or the €1/1,000 the paid plans
   already carry), and that nothing was lost. Releasing is one button. This
   is the only option where the customer's event is not damaged by our
   pricing decision.
3. **Soft forever, warn harder.** Keep sending; warn at 80%, 100%, 200%.
   Costs us money and teaches that the number is decorative.

Whichever is chosen: **an upgrade must release everything immediately**, and
the warning mail has to say what the limit is FOR, not just that it exists.

### Gap 2: `retention_months` is read by nobody

It is selected into the `Plan` object and never used. There is a
`retention_controls` feature key, also unused. So "13 months" on Free is not
enforced anywhere — no job archives or removes anything on age.

This is the larger of the two gaps and the one I would NOT rush. It needs
Sjoerd to say what retention *means* before anyone writes it:

- **Archive, never delete** is already the house posture, and the brief
  repeats it. So: 13 months of what — no activity on a thread? on the
  workspace? since a person's last event?
- **What does an archived thread look like** to the organiser who comes back
  for last year's attendee list? If the answer is "they can still read it",
  this is a view filter, not a retention policy, and should be sold as
  tidiness rather than as a limit.
- **Export must exist first.** Telling somebody their data will be archived
  while the export is a manual queue (`docs/data-protection-approach.md`) is
  a promise we cannot keep on the day they act on it.

**Recommendation: do Gap 1 now, and treat Gap 2 as its own piece of work**
after the export question is answered.

### How many workspaces are over the limits today

Not guessed — this is a read-only count for Sjoerd to run against production:

```bash
cd ~/Projects/thefibre/apps/api && npx tsx --env-file=.env scripts/count-over-limits.ts
```

*(That script does not exist yet; it is one of the things to build with
whichever option above is chosen. It must count per workspace: scheduled
messages this month against the allowance, storage against it, and months
since last activity.)*

---

## Part B — what Meet sells

**Today Meet has no plan gates at all.** Not one `can()`, `needsPlan()` or
`planFor()` in `routes/meet.ts`. Every Meet feature is identical on Free and
on Pro.

**What a Free workspace's booking pages show today** (looked at on staging,
`docs/zoom-marketplace/draft/3-public-booking-page.png`): the host's name,
photo and bio, the meeting type, the duration, the location line ("Zoom —
link in invite"), the date and time picker with a timezone selector, and a
footer reading **"Powered by The Thread: Meet"**. That footer is on both
public pages — the host page and the meeting-type page — and it is plain
text from the public i18n catalog, not a plan decision.

The guest emails carry the workspace's sender where one is set (the domain
package, v1.113.1) and The Thread's otherwise; there is no "powered by" line
in them.

### Proposed

1. **The footer stays on Free and is removable from Starter up.** One new
   feature key, `remove_branding`, in the `plan.ts` union, set on the rows at
   /admin/plans. The two pages ask `can(workspaceId, 'remove_branding')`.
   This is the cal.com pattern and it is the right one: the free tier is the
   advertisement.
2. **Custom reminder emails from Starter up.** Meet sends no reminders today
   (I looked — there is no Meet reminder template or scheduler entry), so
   this is not a gate on an existing feature; it is a feature to build, sold
   from Starter. Worth saying plainly, because "custom reminders from
   Starter" reads as though plain reminders already exist and Free is losing
   something.
3. **Nothing is taken from existing Free workspaces.** Both items above are
   additions, so nobody loses anything on the day this ships. If a future
   gate ever would remove something, that is a different decision and needs
   its own announcement and date.

### Not proposed, deliberately

Gating what a booking page can DO — paid bookings, Zoom, approval flows — on
a plan. Those are the product; gating them would make the free tier useless
as an advertisement, which defeats the point of having one.

---

## Part C — the pricing document was wrong

`docs/pricing-proposal.md` said Starter €19 and Pro €49. The live plans are
**€29 and €59** (read from `billing_plan`). Corrected in the same commit as
this file.
