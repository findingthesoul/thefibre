# Launch-night verification — 13/14 October 2026

Every check run on the night of 13–14 October 2026, with its final result, so
the technical half of the launch decision can be re-run and checked by
somebody else later.

**What this is not.** It is not a claim that the system is correct. It is a
record of what was asked and what came back. The list of what was *not*
verified is at the bottom and is part of the record.

All of it ran against **staging** — the `thefibre.tech` stack, the
`lukhyylwhhjyihqtghvw` Supabase project, and Stripe **test** keys. Nothing on
this page touched production.

Where a command needs an env file, it is
`FIBRE_ENV_FILE=/Users/sjoerdair/Projects/thefibre/apps/api/.env.staging`.
Scripts refuse to run against anything else: each one checks the Stripe key
begins `sk_test` and the Supabase URL names the staging project.

---

## The suites

| Command | Result |
|---|---|
| `pnpm -r typecheck` | clean (after `pnpm --filter @thefibre/shared build` — four new subpath exports landed in this chain) |
| `pnpm test` | **825** API · **486** shared · **343** connections · **59** mcp · **118** root — 0 failed |
| `pnpm --filter @thefibre/api test:integration` | **549 passed, 0 failed** (61 files) against the deployed staging API |
| `pnpm test:e2e` | **78 passed, 9 skipped, 0 failed** (the 9 are owner specs, excluded unless `E2E_OWNER=1`) |
| `node scripts/smoke-staging.mjs` | all green, including the new terms-v1 assertions |

The e2e run matters more than its line suggests: it was **red** when first
run, and the failure was real. See "What the night found" below.

## The stress test

| Command | Result |
|---|---|
| `node apps/api/scripts/stress-join-shapes.mjs` | **10 of 10** join shapes collect what the panel promises |
| `node apps/api/scripts/stress-webhook-shapes.mjs` | **4 of 4** shapes recorded correctly by the deployed webhook |
| `node apps/api/scripts/probe-join-tenancy.mjs` | **8 of 8** boundaries hold — no holes |
| `node apps/api/scripts/rehearse-extras-ledger.mjs` | the seven-line join invoice reaches the ledger whole, once |
| `node apps/api/scripts/rehearse-cohort-extras.mjs` | €3.493,20 now, €2.493,20 at the anchor — matches the panel |
| `node apps/api/scripts/probe-anchor-billing-reason.mjs` | a trial expiring at the anchor **is** a `subscription_cycle` |
| `node apps/api/scripts/probe-option-grants.mjs` | every chosen extra gets its own grant row |

The ten shapes, each measured by asking **Stripe** what the session it
returned will collect:

```
1  yearly                      now 300.00   renews 300.00
2  monthly                     now  30.00   renews  30.00
3  cohort                      now 300.00   renews 300.00
4  cohort + 2 yearly + 1 once  now 3493.20  renews 2493.20
5  the same + 50% code         now 3343.20  renews 2493.20
6  the same + 100% code        now 3193.20  renews 2493.20
7  an expired code             refused 400
8  a used-up code              refused 400
9  a hidden tier by its link   now 150.00   renews 150.00
10 no terms accepted           refused 400
```

Case 4 is the real soul.com basket. Cases 7, 8 and 10 are there because a
route that accepts everything passes every positive test.

The eight boundaries, as a stranger, across two communities:

```
B's code validated on A's page              refused
B's code used on A's join                   refused
B's tier joined through A's page            refused
B's hidden tier via A's catalogue           not served
B's product ticked on A's join              refused
a product the tier does not offer           refused
an INCLUDED product ticked as an extra      refused
A's own optional product (the control)      collected 150.00 ✓
```

The last line is what makes the other seven mean anything.

## Things only a browser could answer

Walked at **375px** on staging against deployed code, with a throwaway
community built by `apps/api/scripts/staging-join-fixture.mjs`:

- a 50% code applied on Year, then the tab switched to Month → **no stale
  discount**; the code clears and the total is the monthly one;
- a yearly extra ticked, then the tab switched → it leaves the **total**, not
  only the tick-box;
- the totals column **adds up** with a code: `300 + 3.000 − 150 = 3.150`
  against a sentence promising €3.150;
- the hidden tier is **absent** from the list, and its link shows that tier
  alone above "This membership is by invitation…";
- the renewal figure excludes the one-time extra (€2.300, not €3.300);
- the terms link and the members-area link both point at **staging**.

Covered as tests rather than as a look, so they can be re-run:

| Command | Result |
|---|---|
| `playwright test e2e/portal-members-list.spec.ts` | 5 of 5 — includes an **unlisted** member seeing the list and being told they are not shown |
| `playwright test e2e/portal-purchases.spec.ts` | 2 of 2 — the row by label **and** by amount, at both widths |
| `playwright test e2e/member-price.spec.ts` | 3 of 3 — a signed-in member enrols at €35 → €28 through the invoice form |

## The deployed artefact, asked directly

```
fly ssh console -a thefibre-api-staging -C "printenv NEXT_PUBLIC_MY_URL"
  → https://my.thefibre.tech
```

and the welcome email rendered **inside the deployed image**, with its real
environment, carries exactly one portal link: `https://my.thefibre.tech/memberships`.

## The migration

One, additive: `20261013234750_hidden_tier.sql`, applied with
`./scripts/db-push-staging.sh` and then **checked by selecting the column**
rather than by trusting the CLI's summary — present, default `false`, zero
nulls. A null would have dropped every existing tier off every join page,
since the catalogue filters `hidden = false`.

---

## What happened to it

Batch 19 went to production on the morning of 14 October, at `93d7d49c`,
run by Sjoerd from his own terminal — the controller's session was refused
the production deploy by its permission system, and neither session routed
around that.

Checked afterwards against **production**, not taken on report:

- `GET /api/v1/membership/public/catalog/soul` answers 200 with three tiers,
  each carrying `hidden` and `price_logic`. Both are new in this batch, so
  that one call shows the migration applied AND the new API serving — a
  missing column would have been a 42703 on the endpoint every join page
  loads first.
- `thefibre.app/terms/standard` names `standard-terms-v1,` and contains no
  "Draft".

---

## What the night found

Not everything was green first time. The failures are the useful part.

- **`member-price.spec.ts` was red.** The country field stopped being a
  `<select>` when it became a searchable picker five days earlier, and nothing
  had run the e2e suite since. The product was fine; the walk was stale.
- **A test failed on an addition.** `profile-public-page` asserted a whole
  response body with `toEqual`, so an additive field broke a test about
  something else — the opposite of the additive-only contract the API is built
  on.
- **Two fixture workspaces leaked**, both mine, both swept. The second taught
  the rule: a paid join writes `activity`, activity is append-only **even
  against the service role**, so the activity pins the person and the person
  pins the workspace — forever. That is how staging came to carry 124 of them.
  The webhook script uses one permanent fixture now, and a leak **fails the
  run** rather than printing a warning beside exit code 0.
- **A cleanup fix was reverted over its author's shoulder** and had to be
  restored, which is why the "fails the run" part exists.

## What was NOT verified

- **No real card payment** went through any of this, on either stack. Every
  money figure above is what Stripe says it *will* collect, or what it
  collected from `pm_card_visa` in test mode. A human paying with a real card
  has not happened.
- **The welcome email has not been opened in a mail client.** The HTML was
  read and the 1.5× sizing confirmed in the inline styles, which is what mail
  clients use — but Outlook and Gmail are their own thing, and 22px is a large
  change.
- **The admin screens were not clicked**: the hidden-tier toggle, the
  copy-link button and the Generate button. The mechanisms behind two of them
  were changed to be testable rather than tested through a browser.
- **Add-on grant rows** are proven at the database constraint, not end to end:
  they are written from `checkout.session.completed`, and a script-made
  subscription never produces a checkout session.
- **A tier-specific pricing rule** is honoured by the panel in code, but no
  test creates one through `PUT /pricing-rules` and follows it to a charge.
- **The my.thread "You" page** was not walked.
