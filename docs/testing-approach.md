# Testing approach

**Status: adopted 2026-09-07.** How The Fibre tests — what we do today, what
"internal vs external testing" means for us, and the concrete roadmap from
here. Written for the same reader as `docs/system-handbook.md`: a programmer
(likely LLM-assisted) making changes, and for Sjoerd deciding where testing
effort goes as the company grows.

**The honest baseline (2026-09-07):** this repo has **no unit-test files and
no test runner installed**. That is not an accident — it is a deliberate
early-stage trade: a strict type system, a handful of executable contract
checks, a full staging twin, and a disciplined manual loop bought more
correctness per hour than a test suite would have while the product was
being discovered. That trade changes as real customers arrive. This
document says what we keep, what we add, and in which order.

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
- **Phase 1 — CI.** Install `docs/ci-template/ci.yml` into
  `.github/workflows/` (blocked on a GitHub token with `workflow` scope —
  Sjoerd). Extends to run `pnpm verify`'s cheap layers on every push;
  contract checks against staging on a schedule (nightly), so a broken
  promise pages us before an integrator finds it.
- **Phase 2 — Vitest on the money/tenancy logic. STARTED v0.53.0** (sso-hop, branding, i18n, pricing; next: fee/proration extraction, scheduler transitions, vercel-ignore). Fees, VAT, plan
  gating, sso-hop, pricing rules. Small, fast, no DB. Wire into `pnpm -r
  test` and CI.
- **Phase 3 — integration pack on staging.** The RLS matrix, webhook
  idempotency, handoff race. Runs post-staging-deploy, before promoting
  the same commit's confidence to prod.
- **Phase 4 — Playwright golden paths on staging.** The ten scenarios of
  §3.5. Gate: staging deploy green before the prod push becomes routine
  for risky releases.
- **Ongoing — external programme.** Keep dogfooding on production; grow
  the comped beta circle deliberately (every beta workspace = named
  contact + feedback loop into build-plan); treat integrator-facing
  contracts as sacred (verify scripts run on every touch + nightly).

## 5. Release gates (the checklist)

Per release, today (Phase 0 discipline):

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
