# Testing approach

**Status: adopted 2026-09-07.** How The Fibre tests — what we do today, what
"internal vs external testing" means for us, and the concrete roadmap from
here. Written for the same reader as `docs/system-handbook.md`: a programmer
(likely LLM-assisted) making changes, and for Sjoerd deciding where testing
effort goes as the company grows.

**The baseline as adopted (2026-09-07):** the repo had **no unit-test files
and no test runner installed**. That was a deliberate early-stage trade — a
strict type system, a handful of executable contract checks, a full staging
twin and a disciplined manual loop bought more correctness per hour than a
test suite would have while the product was still being discovered.

**Where it actually stands (2026-09-15).** Counted by running them, not by
reading the previous count:

| Layer | Files | Assertions |
|---|---|---|
| Unit (vitest) | 57 | 679 |
| Integration, real Postgres + RLS on staging | 13 | 93 |
| End-to-end (Playwright, staging) | 4 | 24 |

Plus the executable contract checks, which are not counted above because they
assert against deployed environments rather than a test runner: the two smoke
scripts, the published Thread read API, the external-app walk, the Stripe
webhook registration check, and four data audits — root slugs, workspace
admins, app names, and (since 2026-09-14) which SECURITY DEFINER functions
each database role may execute.

**What that green does NOT mean.** Coverage attaches to contracts, money,
sign-in and tenancy, and deliberately not to interface plumbing. A fully green
run says the promises hold. It does not say the screens are right — which is
why §1.5's render-check rule is a rule and not a nicety.

---

## 1. Principles

1. **Test the promises, not the plumbing.** The things that must never
   break are *contracts*: the published external-app API, the Thread public
   read API, money handling, sign-in, RLS tenancy. Tests attach to those
   promises. We do not chase coverage numbers on UI plumbing.
2. **Every test must be runnable by one command by someone with zero
   context** (human or LLM). A test that needs tribal knowledge to run is
   documentation, not a test.
3. **The type system is the first test suite.** Typed i18n catalogs
   (missing translation = compile error), typed API responses, `pnpm -r
   typecheck` before every ship. Prefer making an invariant a *type* over
   making it a test.
4. **Real database, fake money, fake people.** Integration and E2E tests
   run against real Postgres+RLS (staging or a scratch workspace) with
   seeded fixtures and Stripe *test* keys — never mocks of the database
   (RLS is the enforcement layer; mocking it tests nothing), and never
   destructive writes against production data (standing rule: reads on
   prod are fine; writes need a fixture or a check-in first).
5. **Typecheck-clean ≠ render-correct.** Any shell/chrome/layout change
   requires a signed-in render check in a real browser before it ships.
6. **Testing in production is legitimate** — monitoring, smoke checks and
   staged rollout are part of the approach, not an admission of failure.
7. **An empty list is indistinguishable from a working one.** When a
   feature's whole point is a LIST of something, assert it is NON-EMPTY for
   somebody who should have entries. (Written down 2026-09-23 by the session
   that promoted To do, after the one before it shipped a team picker whose
   query named a column that does not exist. PostgREST answers that with a
   400 at RUNTIME — a string TypeScript never reads — so the function caught
   the error, logged a warning nobody watches, and returned `[]`. Every check
   passed: the list loaded, an add succeeded, the re-read was fine. The
   picker simply never appeared, and filing under a team was refused as "not
   a member of that team". The feature looked shipped and did nothing. The
   narrower lesson is not "test more": it is that the empty path is the
   SILENT one, and the happy case walks straight past it.)
8. **Run every new PostgREST select against the real database** before
   believing it. Related to 7 and to the three latent 400s of 2026-09-15:
   a `.select('a, b, c')` is a string the compiler never validates, so a
   typo or a column that moved is only ever a runtime answer.
9. **Never coalesce an error into an empty collection.** This is the CAUSE
   that 7 and 8 are symptoms of, and it earned its own line the same day, in
   the worst possible way: the session that wrote 7 then made the mistake
   itself, three hours later, in a throwaway script — `.select('full_name')`
   against a table whose columns are `first_name`/`last_name`, a `data ?? []`
   swallowing the 400, and a confident report of **"0 people"** in a
   workspace holding 42. It was caught only because zero was absurd on its
   face. Had the true answer been 2 and the broken query said 0, the report
   would have been "no backlog, nothing to do" — indistinguishable from the
   truth, and nobody had reason to doubt it.

   Every silent failure of 2026-09-23 had the same middle: a `catch → []`, a
   `?? []`, a caught error logged to a warning nobody reads. Each turned a
   failure into a plausible answer. So: `if (error) throw` in a script,
   surface it in a route, and let a check that cannot answer FAIL rather than
   answer nothing. An empty result must only ever mean "there are none".
10. **A status-code rule is scoped to the endpoint it came from.** "403 means
   the shared secret is wrong" is true of `POST /api/v1/sso/redeem` and false
   of the OAuth provider, where 403 is only `membership_inactive` and a wrong
   client secret is a 401. Carried across, such a rule reads as knowledge and
   is a guess. (2026-09-23: stated wrongly twice in an hour by a session
   quoting a legend it had not opened. The legend named its endpoint.)
11. **Grep for the question, not for the shape you expect.** Hunting those
   403s, `", 403)"` returned nothing and nearly became "this file has no 403
   at all" — both real ones are multi-line `c.json({ … },\n  403,\n)`. A
   pattern that encodes your guess about the formatting answers a different
   question from the one you asked, and answers it confidently. Same family as
   9: the tool returns emptiness and emptiness reads as fact.
12. **An empty FIELD reads as an empty fact.** One layer up from 9. A label
   lookup that fails and returns nothing is indistinguishable from a person
   who genuinely has no organisation — so the row looks right. 2026-09-23: an
   org read named the wrong column, failed on every row for everyone, and the
   author's own verification quoted the broken row as proof it worked, because
   the assertions covered the name and the tags and not the field that was
   broken. **Assert the fields you added, by name, against a fixture you know
   has them.**
13. **A migration's filename states its intent, not the objects it touches.**
   Verifying a freshly promoted production, a session queried for a `todo`
   TABLE because the file was called `…_todo_is_an_org_feature.sql`, got
   `PGRST205 table not found`, and was one step from reporting a failed
   migration on live. There is no such table: the file only sets
   `billing_plan.features`. Open the migration.

   Entries 7 and 9–12 are five faces of one move — **inferring where you could
   check** — hit by three different sessions inside one day, twice by the
   session that had just written the entry above. Frequency is the finding.
   When a tool answers with nothing, nothing is the least trustworthy answer
   it can give, and the cost of confirming is a single command.

---

## 2. Internal vs external testing

The phrase means two different things; we use both, so both get defined.

### 2.1 As *who is testing* (the software-company sense)

| Stage | Who | Where | What it catches |
|---|---|---|---|
| **Internal — developer loop** | the person/LLM making the change | local dev + staging | logic errors, type errors, broken flows — before a commit |
| **Internal — dogfooding** | Solidarity Lab itself | production, real workspace | the gap between "works" and "works for real work". We run our own conferences, memberships, and cashflow on the platform; that IS the alpha programme. |
| **External — closed beta** | invited real organisations (the "invited-in door": comped workspaces created at /admin/workspaces with a reason) | production | workflows we never imagined, onboarding friction, data-shape surprises. Feedback goes to `docs/build-plan.md`'s Open queue. |
| **External — open use** | self-serve signups, embed integrators, external-app developers | production | scale, abuse, contract regressions. Guarded by the published-contract verify scripts + monitoring. |

Rules of engagement for external testing:
- Beta users are **real users on production** — soft-delete discipline,
  consent records, and the data wall apply fully. There is no "it's only
  beta" exemption from GDPR posture.
- Every beta workspace gets a named contact and a feedback channel; every
  reported issue lands as a build-plan item (groomed, not a separate
  tracker).
- **Never test destructively on external users' data.** Rehearsals of
  risky flows (payments, erasure, cutover) happen on staging or on a
  Solidarity Lab-owned fixture workspace in prod.

### 2.2 As *what is being tested* (black-box vs white-box)

- **External (black-box) tests** exercise the system through its published
  surfaces exactly as an outsider would, with no knowledge of internals.
  These are our most valuable tests because our promises are external:
  - `apps/api/scripts/verify-external-app.mjs` — registers a throwaway
    external app, walks the whole app-key contract (register → approve →
    key mint → scoped calls → links → activity), asserts every published
    response shape, cleans up. Run after touching anything under
    `/api/v1/apps/*`.
  - `apps/api/scripts/verify-public-api.mjs` — asserts the three Thread
    public read routes: shapes, `origin: *` CORS on exactly those paths,
    third-party rate limiting metered while our own origins are not.
  - `scripts/smoke-staging.mjs` — black-box "does each domain serve its
    own app" by `<title>`, apex-derived so it survives domain moves.
- **Internal (white-box) tests** know the code: unit tests on pure logic
  (fees, VAT, plan gating, code-claim races), integration tests that call
  route handlers with crafted contexts. We add these where the logic is
  intricate and the blast radius is money or tenancy (§4, phase 2).

The bias: **external-style tests guard contracts; internal-style tests
guard algorithms.** When in doubt, write the external one — it survives
refactors and tests what users actually feel.

---

## 3. The layers (our version of the pyramid)

From cheapest/always-on to most expensive/occasional:

1. **Types** — `pnpm -r typecheck`. Runs before every release, and in CI
   on every push once installed (§5). Free regression coverage for
   catalogs, API client shapes, component props.
2. **Contract checks** — the three verify scripts above plus
   `scripts/verify-vercel-env.mjs` (the env matrix as executable truth:
   cookie domains per project, Supabase keys per scope). These are
   *executable documentation of promises*.
3. **Unit tests** (to be added, §4) — pure functions only: `lib/fees.ts`,
   VAT math (`lib/vat*.ts`, `vies.ts` parsing), plan gating (`lib/plan.ts`),
   `sso-hop.ts` (`isCrossApex`, `crossAppHref`, `next` sanitisation),
   pricing rules, date/locale formatting. Runner: **Vitest** (fits the
   ESM/TS monorepo; one `vitest.config.ts` per package, `pnpm -r test`).
4. **Integration tests** (to be added) — API routes against the **staging
   database** with a dedicated fixture workspace: the RLS-critical paths
   (a user of workspace A must never read workspace B; app-key default
   deny; archived-workspace gate), the money convergence points
   (`finalizePaidEnrolment`, `recordPurchase` idempotency on webhook
   retries), the SSO handoff (single-use claim race: redeem twice, second
   must fail).
5. **E2E smoke** (to be added) — **Playwright**, headless, against staging
   after every staging deploy: the golden paths only —
   sign-in (OTP path — Google can't be automated), see dashboard, switch
   app (same-apex + cross-apex hop), public thread page renders, enrol
   with a test ticket through Stripe test checkout, /my shows the
   enrolment, embed page loads and postMessage-resizes. Ten-ish scenarios,
   kept ruthlessly small so they stay green and trusted.
6. **Manual/visual** — the signed-in render check for shell changes; a
   release-note-driven click-through for anything user-visible. The
   live-test loop (deploy to staging → click → fix → redeploy) remains a
   first-class technique, not a fallback.
7. **Production monitoring as testing** — Fly logs (API stderr is verbose
   on purpose — Postgres error codes/details/hints are logged at the
   failure site), Stripe dashboard webhook delivery status, Vercel deploy
   status, and a post-deploy prod smoke (same pattern as smoke-staging
   against the live domains). Silence is not success: check the log after
   shipping anything on a money or auth path.

What we deliberately do **not** do (for now): UI snapshot tests (churn >
value at this design velocity), mocked-database tests (RLS is the point),
coverage targets (they optimise the wrong thing), and load testing (revisit
at the first workspace with >5k persons).

---

## 4. Adoption roadmap

Phased so each step pays for itself; groomed like everything else via
`docs/build-plan.md`.

- **Phase 0 — formalise what exists (zero new tech). DONE v0.53.0.**
  A `pnpm verify` root script that runs: typecheck → verify-public-api →
  verify-external-app (staging API) → smoke-staging. Add a
  `smoke-prod.mjs` twin (apex-derived, read-only). Make "run `pnpm
  verify`" the standing pre-release gate in CLAUDE.md.
- **Phase 1 — CI. DONE 2026-09-07.** The "token blocker" was a phantom —
  this repo pushes over SSH, which carries no workflow-scope restriction.
  `.github/workflows/ci.yml` runs typecheck + the unit tests + web/api
  builds on every push and PR; `nightly-contracts.yml` smokes prod and
  staging daily (public surfaces only — verify-public-api needs the
  service-role key, so it stays in the local `pnpm verify` gate, pinned
  at the prod API, until Sjoerd decides on repo Actions secrets).
- **Phase 2 — Vitest on the money/tenancy logic. STARTED v0.53.0** (sso-hop, branding, i18n, pricing; next: fee/proration extraction, scheduler transitions, vercel-ignore). Fees, VAT, plan
  gating, sso-hop, pricing rules. Small, fast, no DB. Wire into `pnpm -r
  test` and CI.
- **Phase 3 — integration pack on staging. STARTED v0.55.0** (RLS anon-floor ×14 tables, recordPurchase idempotency, sso_handoff race, the two-user cross-workspace RLS matrix, thread tenancy, person merge, and since 2026-09-14 the SECURITY DEFINER guard: every definer function in the migrations probed as anon and as a signed-in fixture against a reviewed allowlist, handbook §11.3b; remaining: scheduler transitions). The RLS matrix, webhook
  idempotency, handoff race. Runs post-staging-deploy, before promoting
  the same commit's confidence to prod.
- **Phase 4 — Playwright golden paths on staging. STARTED v0.56.0** —
  6 scenarios green (landing, pricing, sign-in page, embed-loader JS, a
  SIGNED-IN Meet dashboard via a minted /sso/land handoff code — the hop
  machinery doubles as the E2E session fixture, no OTP inbox needed — and
  the bogus-code degradation path). Remaining scenarios (enrol via Stripe
  test checkout, /my, cross-app switch) need a public staging thread
  fixture. Run: `pnpm test:e2e`.
- **Ongoing — external programme.** Keep dogfooding on production; grow
  the comped beta circle deliberately (every beta workspace = named
  contact + feedback loop into build-plan); treat integrator-facing
  contracts as sacred (verify scripts run on every touch + nightly).

## 5. Release gates (the checklist)

Per release, today (Phase 0 discipline):

(The security gates per change — a new table, definer function, public route,
filter or secret — live in `docs/data-protection-approach.md` §6 and are part
of this checklist.)

1. `pnpm -r typecheck` — always.
2. The verify script for any touched contract area (`/api/v1/apps/*` →
   verify-external-app; Thread public/CORS/rate-limit → verify-public-api;
   env/domains → verify-vercel-env + smoke).
3. Shell/layout change → signed-in browser render check.
4. Money/auth path change → staging rehearsal with Stripe test keys, then
   watch the API log during the first prod exercise.
5. Migrations → applied to **both** databases in the same ship.
6. After deploy: prod smoke (domains by title), and read the Fly log.

The multi-session serialization protocol (handbook §10) is part of testing
too: one release at a time, explicit-path staging, and post-commit import
resolution checks are what keep *other people's* half-finished work out of
your tested artifact.
