# Stress-test pass — 2026-09-14

The cycle from `docs/overnight-2026-09-12.md`, run again on the whole
platform: debug, single point of truth, optimise, document, debug again.
Ran in its own worktree beside two live peer sessions (Connections released
v0.73.60 and v0.73.61 during it; both merged in before the bump). Shipped as
**v0.74.0 to staging**. Nothing is on production until you promote.

## Read this first

1. **Production is behind.** Six migrations and one API deploy:
   `20260913080000`, `20260913140000`, `20260913160000`, `20260914090000`
   (Connections, from yesterday) and `20260914170000`, `20260914171000` (the
   security pair below). `bash scripts/db-push-prod.sh` then
   `fly deploy --remote-only`, in that order, are yours to run — the
   Connections session was refused on the first and I did not try. Until
   then production shows the same nine functions open to the anon key that
   staging no longer does (`node apps/api/scripts/audit-definer-functions.mjs`
   prints them), and the two known Connections errors the peer reported.
2. **Staging's Stripe webhooks are still wrong**, unchanged from 09-12: the
   Thread, Meet and Membership endpoints listen on the platform account and
   need connected-account mode; Meet's lacks `payment_intent.payment_failed`.
   Dashboard-side, recreate and push the new secrets to Fly. A staging
   payment rehearsal cannot confirm until then.
3. **Look at staging before promoting.** Every scripted layer is green and I
   walked the signed-in shell in a browser after the deploy (below), but the
   change touches every app's layout (the switcher now knows its host) and
   the render-check rule stands.

## Phase 1 — Debug, first pass

| Layer | Result |
|---|---|
| Typecheck, 13 projects | pass |
| Unit tests | 465 pass |
| Integration, staging | 68 pass |
| Playwright, staging | 16 pass |
| Smoke, prod and staging | pass |
| Published Thread contract, prod and staging | pass (staging had no fixture on 09-12; it has one now) |
| External-app contract, staging | **failed once, passed alone** — see below |
| Stripe webhooks, staging | 4 known problems |
| Stripe webhooks, prod | no key locally, unrun |
| Root-slug, workspace-admin, app-name audits, both | pass |

**The external-app walk fails at sign-in when it runs beside the integration
pack.** `verifyOtp failed: Email link is invalid or has expired` on the first
run, which overlapped the integration tests; the same command alone passed
twice more. The integration fixtures mint their own throwaway users, so it is
not the one-outstanding-token-per-user rule. Not proven; recorded. Keep
these two serial — `pnpm verify:full` already does — and treat the message
as a retry, not a contract failure.

## Phase 2 — Debug: the open security item

The build-plan item from 09-13 said five functions were still executable
with the anon key and asked for a standing guard. The probe found nine:

    can_see_person  can_see_organisation  can_see_activity  meet_is_team_lead
    is_workspace_admin  current_workspace_role
    pulse_can_read_workspace  pulse_can_write_workspace
    workspace_meet_fee

Reviewed by body. The first eight read the caller from the JWT and return a
boolean or role about that caller — anon gets false or null, exposure nil,
door open. The ninth returns any workspace's plan fee to whoever names the
workspace; low value, nothing anonymous needs it.

**Two migrations, because the first taught something.** `20260914170000`
revoked anon from every definer function by OID and four stayed open: the
four that had never had a REVOKE of any kind still carried Postgres's
implicit grant to PUBLIC, which anon inherits. Handbook §11.3b described the
mirror-image mistake (revoke PUBLIC, forget anon); this is the other half.
`20260914171000` revokes PUBLIC and anon on every definer function, grants
service_role, grants the nine reviewed helpers to `authenticated` explicitly
(policies evaluate them as the signed-in role — several had been reaching it
through PUBLIC), and changes the default privileges so a function created
from now on carries no grant to PUBLIC or anon. A new RLS helper needs
nothing extra; a new service-only function needs one revoke from
authenticated, and the guard names it when missing.

**The guard.** `apps/api/scripts/lib/definer-probe.mjs` reads every SECURITY
DEFINER function out of the migrations and probes it with a malformed uuid:
`42501` closed, `22P02` open, no body ever runs.
`src/integration/definer-functions.int.test.ts` asserts anon may execute
none, a signed-in fixture may execute only the allowlist, and — the success
twin — that the allowlisted helpers ARE open to authenticated (or the app
would go blank). `scripts/audit-definer-functions.mjs` is the same probe as a
report for any project. The allowlist in the probe module is the review
record.

Verified after each migration: the audit, the guard, the RLS floor and
matrix, thread tenancy, and the signed-in Playwright paths.

## Phase 3 — Single point of truth

A read-only sweep of the repo listed every fact defined in more than one
place. The ones folded, most impactful first:

| Was | Now |
|---|---|
| `lib/available-apps.ts` ×7, drifted: Connections passed the serving host so a staging menu stays on staging; the other six sent people to production | `@thefibre/shared/available-apps`, host + env required |
| `lib/api.ts` ×7 (50 lines each, one constant apart; Thread alone had `errorMessage`) | `@thefibre/shared/api-fetch`; each app a 6-line binding |
| `money()` + `formatPeriod()` in Membership and Pulse, drifted both ways | `@thefibre/shared/money` with a `decimals` option |
| `CURRENCY_OPTIONS` ×2 | `@thefibre/shared/currencies` |
| `slugify` ×3 (one NFD, two NFKD) | `@thefibre/shared/slug`; also folds ø æ œ ß ł đ |
| `LINK_KINDS` in the API's zod enum and the Membership app | `@thefibre/shared/link-kinds` |
| `uploadAsset` ×3 | `@thefibre/shared/upload` |
| `COOKIE_LOCALE` declared in 7 `lib/locale.ts` | `@thefibre/shared/prefs` |
| Thread's public host derived in 15 files | `apps/thread/lib/public-host.ts`, as Meet already had |
| `PUBLIC_API_URL ?? fly.dev` ×3 in the API | `lib/public-url.ts` |
| `noreply@thefibre.app` literal in the iCal organiser | the email client's one sender |
| hand-written app lists on About and the website's workshop page | derived from `APP_DISPLAY_ORDER` |
| the website's own host constants | `appUrl` / `surfaceUrl`, env-overridable |
| 18 API scripts, 9 variants of one dotenv parser | `scripts/lib/env.mjs` |
| `apps/web/lib/countries.ts`, byte-identical to shared, six importers left | deleted |

88 files, 467 lines added, 1340 removed; no exported name changed. The
Next.js bindings (`lib/supabase/server.ts`, `locale.ts`,
`workspace-actions.ts`, `prefs-actions.ts`) stay per app on purpose — they
ARE the framework binding, and the shared package keeps no Next import.
`apps/connections` was left to its owning session, which will take the same
bindings after this release.

Behaviour that changed rather than moved: staging menus stay on staging in
six more apps; Meet's "moving to the platform" link hops the apex with the
session; a generated slug for Søren is `soren`; the About page lists the live
apps in canonical order (Thread, Meet, Pulse, Flow); the website's hosts
honour `NEXT_PUBLIC_*_URL`.

## Phase 4 — Optimise

**Sixty visitors to `/pricing` each waited 1.3 s.** A 60-way concurrent
probe of the public catalogue on staging: every request 200, p50 1274 ms,
against 140 ms for a single request — one machine, one pool, sixty identical
queries. The rows are now held in-process for sixty seconds and dropped by
the same `forgetAllPlans()` an `/admin/plans` edit already calls. `/health`
under the same load: p95 72 ms. Left alone: the sign-in path and the
admin list, both already documented decisions.

## Phase 5 — Documentation

`docs/system-handbook.md` §11.3b carries the PUBLIC-grant lesson, the new
default, and the guard. `docs/testing-approach.md` counts what exists today.
`docs/build-plan.md` loses the closed security item. This file.

## Phase 6 — Debug again, on the merged tree

| Layer | Result |
|---|---|
| Typecheck, 13 projects | pass |
| Unit tests | 502 pass |
| Integration, staging | 73 pass (incl. the new guard) |
| Playwright, staging | 16 pass |
| Smoke, prod and staging | pass |
| Published Thread contract, prod and staging | pass |
| External-app contract, staging (run after the pack, not beside it) | pass |
| Every API script, re-run on staging after the env refactor | pass |
| Definer audit, staging | closed or allowlisted |
| Definer audit, prod | 7 open — migrations pending, expected |
| Stripe webhooks, staging | 4 known |

## Closed the next day (2026-09-15)

- Production promoted through v0.74.4 on Sjoerd's word, migrations first,
  API deployed; later promotions by other sessions carried the rest.
- Staging's Stripe webhooks recreated by script; the verifier fixed (it read
  a field Stripe never returns); **production's Thread and Meet webhooks
  found in platform mode and recreated in connected-account mode** — see the
  incident record in `docs/data-protection-approach.md` §4.
- A third filter injection (purchases search) found and fixed by the Meet
  session; `orIlike()`/`orEq()` now carry all three.
- Security headers, the public-POST brake and Dependabot shipped as v0.75.0;
  `docs/data-protection-approach.md` written.

- **The Thread card path rehearsed end to end on staging** (2026-09-15,
  00:25): public enrol → €10 Rehearsal ticket → Checkout on the connected
  test account → webhook (signature verified, session matched) →
  enrolment `paid`, ledger row `paid` with the platform fee → confirmation
  message attempted. Meet's and Membership's endpoints received the same
  event and correctly ignored a session that was not theirs. The only
  failure was Resend refusing the placeholder `@example.com` address, which
  says nothing about the payment path.

## Open for you

1. Push the six migrations to production and deploy the production API
   (item 1 above), then promote.
2. Recreate the three staging Stripe webhooks in connected-account mode.
3. Meet: "Bookable up to" above 60 days does nothing — still in the queue,
   the Meet session's lane.
4. The pricing page's own fetch (`apps/web`) uses `cache: 'no-store'` by
   design; the API-side cache is what carries the load now. If `/pricing`
   ever sits behind a CDN, the `Cache-Control: max-age=300` it already sends
   will do the rest.
