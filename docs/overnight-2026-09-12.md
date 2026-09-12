# Overnight pass — 2026-09-12

The full cycle you asked for: debug, legacy, optimisation, documentation,
debug again. Ran unattended from 01:06 to 02:40, after the 23:00 scheduled
attempt stalled on an unanswered permission prompt without running a single
test.

## Read this first

**Bypass permissions is still ON.** You switched it on at about 01:10 so this
could run without stalling, and asked to be reminded. It was a sound bet while
nobody is on the platform and every change lands as a commit — that reasoning
expires when your first client arrives next week. Turn it back off.

**The single most useful finding is at the bottom, under Phase 5.** Every
scripted layer passed, and then opening staging in an actual browser found
that its footer sends visitors into production.

## What shipped

| Version | What |
|---|---|
| 0.72.3 | Two scripts that could not say what was wrong |
| 0.72.4 | A sign-in stops writing twelve rows one at a time |
| 0.72.5 | The staging footer stops walking people into production |
| 0.72.6 | A new thread stops being born broken |
| two `docs:` commits | Three documents corrected; 81 runs of mojibake repaired |

The API was deployed to staging and then production, both verified after.

---

## Phase 1 — Debug

| Layer | Result |
|---|---|
| Typecheck, 12 projects | pass |
| Unit tests | 185 pass |
| Production smoke | pass |
| Staging smoke | pass |
| Published contract, production | pass |
| Published contract, staging | could not run |
| Integration, staging | 40 pass |
| Playwright, staging | 16 pass |
| External-app contract, staging | pass |
| Stripe webhooks, staging | 4 problems |
| Stripe webhooks, production | could not run |
| Root-slug audit, both | pass |
| Workspace-admin audit, both | crashed, then passed |

**The workspace-admin audit crashed on both environments.** It alone required
`node --env-file=.env` while every sibling script takes `FIBRE_ENV_FILE`, and
the reward for forgetting was a supabase-js stack trace saying
`supabaseUrl is required.` — naming neither the script, nor the file, nor the
flag. Now reads the house way, still accepts the old flag, prints the path it
looked for, and announces which project it is auditing so pointing it at
production by accident is visible. Result once running: zero locked-out
workspaces, both environments.

**The published-contract check could not say why staging had no fixture.** It
needs a thread that is public-listed, owned, and on an active or completed
programme. It used to say only "publish one, or run seed-ebbf" — so draft
threads read exactly like no threads, and the advice was wrong for both. It
now names each candidate and the condition it failed: `single-event —
programme is draft`. It also stopped recommending `seed-ebbf.mjs` on staging,
which targets the workspace that is the Stripe payment-rehearsal rig.

## Phase 2 — Legacy

**The finding is a negative one, and it is worth recording as such: there is
almost no dead code.** Zero TODO, FIXME or deprecated markers in the entire
codebase. A sweep of every exported symbol in the API's lib and the shared
package found four functions nothing calls, and three are unfinished features
with scaffolding in place — seat overage, Zoom's host lookup — not corpses.

What there is instead is comments that describe code that no longer does what
they say. Those cost more than dead code, because dead code is inert and a
wrong comment actively misdirects.

**The rate limiter had a test seam and no test.** `resetAllBuckets` claimed the
contract script used it. That script talks to a deployed API over HTTP and
cannot reach an in-process Map, so nothing had ever called it and the file had
never been tested — while guarding whether strangers can keep reading the
published routes. Ten tests now cover the limit boundary, that `remaining`
never goes negative because it ships in a header, that the window is fixed
rather than sliding, and that an unidentifiable caller shares one bucket
instead of escaping the limit.

**`vat.ts` claimed a job `seller-vat.ts` does.** Its header called `computeVat`
the calculator for invoice-method purchases. Untrue: app sales on every rail
get tax from `seller-vat.ts`, on an inclusive-split model against the seller's
own registration. `computeVat` is called by nothing. Kept, because a
non-Stripe PSP would need exactly those destination rules and the platform is
deliberately PSP-agnostic, but now labelled untested reference code that must
be tested before it touches money.

## Phase 3 — Optimisation

**A sign-in wrote twelve rows one at a time.** `ensurePlanApps` ran a nested
loop over apps × users doing one awaited upsert per pair, and `sso/resolve`
calls it on every single sign-in. A six-person workspace on two apps paid
twelve sequential writes each time anybody logged in, almost always to insert
rows that already existed. Now one upsert of the whole grid. A failed app
activation still skips only that app's memberships, and the membership write
reports its own error rather than discarding it.

Left alone deliberately: the admin workspace list's N×5 head-count queries are
a documented decision with a stated revisit point at ~100 workspaces, not an
oversight.

## Phase 4 — Documentation

**`testing-approach.md` said the repo had no unit tests and no test runner.**
It has had both for five days. Replaced with measured counts and an explicit
statement of what green does not mean.

**`CLAUDE.md`'s "State as of v0.4.8" described May 2026** — apps on
`thefibre.app`, eight seeded contacts, shipped work listed as pending.
Replaced with a verified section pointing at the sources that cannot lie. Its
dev-port list also stopped at 3007 and omitted Connections on 3008, going
stale exactly as its own comment predicted it would.

**`build-plan.md` had 81 runs of mojibake across 64 lines**, from a double
utf-8-read-as-latin-1 at some point, which had eaten every section mark,
multiplication sign, en dash and arrow in your to-do list. Repaired per
fragment, because whole-line repair fails where clean and damaged characters
share a line. Zero suspect characters remain.

## Phase 5 — Debug again, and the one that mattered

Everything re-ran green: typecheck, 185 unit, 40 integration, 16 Playwright,
both smokes, the published contract, the external-app walk, all four audits.

Then I opened staging in a real browser, which I had skipped earlier and
should not have.

**Every link in the shared marketing footer pointed at production.** On
`thefibre.tech`: Why The Thread, The workshop, Pricing, About, Contact, the
legal links, the logo — and **Sign in**. A person testing on staging who
clicks Sign in lands on the live app, against production data. That is
precisely the environment bleed the separate staging apex was chosen to
prevent, and it would have undermined your plan to do everything in staging
from next week.

The cause: `const WEBSITE = 'https://thethread.app'` and `APPS[...].url` read
directly instead of the env-aware `appUrl`. The comment above it said "Links
are absolute for the same reason" — and absolute was right, because this
footer renders into emails too. Absolute and hardcoded-to-production had been
conflated.

Fixed by registering the marketing site as a SURFACE beside `my-portal`, the
way the registry's own comment says surfaces exist so URLs derive from one
place. Email links stay pinned to production on purpose: an inbox is read from
anywhere, long after sending, and a staging host in one is a dead link.
**Sign in corrects itself on deploy**, since staging already sets the Thread
URL. The rest follows once `NEXT_PUBLIC_WEBSITE_URL` is set on staging.

---

## Open for you

1. **Turn bypass permissions back off.**

2. **Set `NEXT_PUBLIC_WEBSITE_URL` on staging's Vercel projects** (apps/web and
   apps/website), so the rest of the footer follows staging too. Until then
   those links still resolve to production, which is the old behaviour, not a
   new break.

3. **Staging's Stripe webhooks are registered against the wrong account.**
   Thread, Meet and Membership all take money on connected accounts; all three
   staging endpoints listen on the platform's own. Meet's is also missing
   `payment_intent.payment_failed`. The mode is fixed at creation, so each must
   be deleted and recreated and the new signing secrets pushed to Fly.
   Recreating them without the secrets would leave staging payments worse off,
   so they were left alone. **A staging payment rehearsal cannot confirm until
   this is done.**

4. **Decide how staging gets a published-contract fixture.** Its one listed
   thread is in draft, so the published contract is only verifiable against
   production — after it ships, which is backwards for staging-first. Moving
   that thread's programme to active would do it, but it lives in a real
   workspace so the call is yours.

5. **A flaky integration test.** `person-merge` failed once, during the Fly
   deploy, and passed in four runs before and after. The integration config
   itself warns that the staging scheduler touches that database on a timer.
   Probable cause, not proven. It sits in the release gate, so it will block a
   release at an inconvenient moment eventually.

6. **No Stripe key in `apps/api/.env`**, so the production webhook check cannot
   run from a shell. Production's Fly host has its own; this is a local gap,
   the same shape as the missing SSO secret found on 09-09.

7. **Staging is accumulating fixture workspaces** — five `int-test-merge-*`,
   four `retired-*`, plus two permanent ones. The append-only activity log pins
   them, so they cannot simply be deleted. Worth deciding whether the merge
   tests should reuse one workspace.

8. **The promote gate still does not exist.** `release.sh` pushes `main` and
   `main:staging` in one command, so staging and production receive identical
   code at the same moment. Your "staging first, then a second instruction for
   live" needs production to follow a separate branch that only moves when you
   say so. Cheapest to set up before a client exists.

9. **`CLAUDE.md`'s three "Where we left off" sections run to ~180 lines** and
   load into every session. `CHANGELOG.md` carries the same record in more
   detail. Left alone because they are your narrative and trimming them is your
   call, not a passing agent's.

## The cold first-client walkthrough — done after all

I flagged this as the highest-value thing I had skipped, then did it. It found
the worst bug of the night, and it took eleven minutes.

**The tool first.** `apps/api/scripts/cold-organiser.mjs` creates a brand-new
workspace, person, user, admin membership, plan apps and Supabase auth account
on staging, and prints a single-use sign-in link. Every other fixture path
reuses an account that already has a workspace, contacts and habits — exactly
what a first client does not have, which is why empty states and first-run
prompts are invisible from a seeded account. `--list` and `--signin <slug>`
come back to one later. It refuses to run anywhere but staging.

```bash
FIBRE_ENV_FILE=.env.staging node scripts/cold-organiser.mjs --name "Riverside Choir"
```

**What the first hour actually looks like.** Good, mostly. The dashboard opens
with "Shall I guide you to your first journey?" and, if you accept, highlights
the Thread card and says why. Clicking it hops apexes and signs you straight
in — the cross-apex handoff works. Thread greets you with five event shapes,
three marked as needing a higher plan. You pick one, name it, and the public
URL derives from your own name on the staging host.

**Then it breaks, in the first minute.** You give the event a date, click
Create, and land in an editor showing:

    NO DATE   The event                                    Draft
              Thank you · 1d after The event · 10:00
              won't send: the anchor has no date

The date you just typed went to the `program` row and never reached the
timeline, so a brand-new organiser's very first thread arrives carrying a
warning about a problem they did not cause and could not have avoided.

Fixed in v0.72.6, verified by walking it again: the event now reads
`DEC 5 · 10:00` and the thank-you resolves to `DEC 6` with no warning. The
stored value is `2026-12-05T09:00:00Z` — 10:00 Amsterdam in winter, so the
timezone is right rather than an hour out.

**One inconsistency I did not fix.** The template-DUPLICATION path still
builds timestamps as `new Date(\`${date}T${time}:00Z\`)`, which treats a wall
clock as UTC. The correct helper existed already and Meet's availability
engine already used it; the new seeding path uses it too. So a duplicated
thread and a newly seeded one now disagree by the UTC offset. That is a real
bug, it predates tonight, and it is the last one of its kind — but changing
the duplication path moves existing threads' times, which is your call.

## What was not covered

The **signed-in** exploratory pass. I checked the public surfaces in a real
browser — landing, pricing, sign-in, mobile width — but did not drive a
signed-in session through the Thread editor, enrolment, or a Stripe Connect
run. The Playwright suite covers a thin signed-in path and v0.72.2's session
did an exploratory pass over v0.69–v0.72 the evening before, so this is not
untouched ground, but it is not the same thing as walking it.

~~**The cold first-client walkthrough did not happen.**~~ It happened after
all — see the section above. What remains unwalked from it: **publishing** the
thread, **enrolling** a participant, and a **Stripe Connect payment run**. I
stopped at the editor because the bug was there and worth fixing first. Those
three are the next thing to walk, and `cold-organiser.mjs` makes it a
two-minute setup now rather than an afternoon.
