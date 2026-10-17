# For the foundation review

Written on 2026-10-17 for an engineering team that is weighing whether to
rebuild The Fibre's foundation. It says what we know, what we measured, what
we are already changing, and what any rebuild has to carry across. We would
rather you judge on facts than on impressions, including the unflattering
ones.

Read [`technical-overview.md`](technical-overview.md) first. It is the
summary of the whole system, written for a technical partner on 2026-10-01,
and its section 8 already lists our weaknesses in our own words. This file
adds what has changed since then and the questions a rebuild raises.

## 1. Where it stands today

Measured from the `staging` branch at v1.276.0. Production is the same code
minus the last few releases.

| | |
|---|---|
| TypeScript, apps and packages | about 350,000 lines (including translation catalogs in six languages) |
| API | about 650 route handlers on Hono |
| Database | 307 migrations, about 165 tables, row-level security on every table |
| Tests | about 280 unit test files, 125 integration test files against a real staging database, 57 end-to-end specs |
| History | about 1,800 commits since 2026-05-12 |

**It is in production with paying users.** A community (soul.com) runs
member subscriptions through it, on Stripe subscriptions under its own
connected account. Organisers sell tickets to learning journeys, people book
paid and free meetings, and participants use their own page (my.thread) for
tickets, invoices, files, calendar and notifications. A third party's
festival planner runs in production against the published app API.

## 2. Our own assessment of the foundation

**You are right about the core of it.** Tenant isolation was not designed in
at the layer where most code runs. The database has row-level security on
every table, but most API routes use the service-role client, which bypasses
it, and filter by workspace in code.

On 2026-10-17 we measured it with a syntax-tree scan of `apps/api/src`
(tests excluded):

| | |
|---|---|
| `adminClient.from()` chains (service role) | 1,700, in 140 files |
| … that filter `workspace_id` on the query itself | 624 |
| … on a table that has a `workspace_id` column, without that filter | 560 |
| … on a child table with no `workspace_id` column at all | 476 |
| the most common lone filter | `.eq('id', x)`, 267 times |

Spot checks show these are safe because an earlier line in the handler
proved the id belongs to the workspace. That is the problem in one sentence:
**isolation is a property you have to read the whole handler to see.** Two
cross-workspace holes of exactly this shape were found and closed in
September 2026, both by review, not by a tool.

**What we think is sound and worth keeping:**

- Postgres with row-level security on every table, enforced by a test that
  reads the migrations, and an anonymous-access probe of every table.
- The data model's rules: soft delete for personal data, an append-only
  activity log enforced by a trigger, one money ledger as the record (Stripe
  is the rail), and per-app ownership of fields.
- The published contracts, each with an executable check (section 5).
- Strict TypeScript, including typed translation catalogs.

**Also weak, besides tenancy:** no error tracking or alerting; third-party
refresh tokens not encrypted at rest; no MFA for admins; no admin audit
table; no content security policy; one API machine per stack with in-process
jobs; integration and end-to-end tests outside CI; two very large route
modules (Thread and Meet). `data-protection-approach.md` §5 has the full
security list with its status.

## 3. What we are changing now

A dedicated security workstream started on 2026-10-17, foundation first.
Each step lands as its own release, with a test that proves it.

| Step | What | Kind |
|---|---|---|
| F0 | A ratchet in the release gate: every service-role use is either through the tenant accessor, on a named and justified exception list, or on a baseline that may only shrink | Makes the unsafe path fail the release |
| F1 | `tenantDb(ctx)`: a database accessor that forces the workspace filter on every read, update and delete, stamps it on every insert, and refuses a row for another workspace. A child table is reachable only through its parent, after the parent is proven to be in the workspace | Isolation by construction |
| F2 | Module by module onto F1 (or onto the user's own JWT where row-level security already answers correctly), each with a test that attacks from a second workspace. Externally called routes first | Isolation by construction |
| F3 | In the database: `workspace_id` on child tables with a composite foreign key to the parent's `(id, workspace_id)`, so a cross-tenant row cannot exist whatever the code does | Isolation by construction |
| P, Q | Encrypted credentials at rest, MFA for admins, an append-only admin audit table, explicit cookie flags, a Stripe event replay guard, upload type sniffing, dependency scanning in the gate | Construction where possible |
| R | Log redaction, rate limits keyed on the target, CSP, error tracking, a rehearsed restore | Detection and resilience |

We measure ourselves against OWASP ASVS level 2. The scan above becomes a
script in the repository, so you can run it and watch the count fall.

## 4. What any rebuild has to carry across

These are the constraints that make a rebuild expensive. None of them is a
reason not to do it; all of them have to be in the plan.

1. **Live data**, moved without loss: people, organisations, consent records,
   the activity log, the ledger, enrolments, bookings, memberships, files.
2. **Sign-in.** Supabase Auth users, with Google sign-in and emailed codes.
   Users should not have to re-register.
3. **Money.** Stripe connected accounts per seller, live subscriptions with
   their renewal dates and tax rates, the platform fee, invoice and credit
   note numbering series, which are legal records and must continue
   unbroken.
4. **The published app API** (`/api/v1/apps/*`). It is additive-only by
   contract, and a third party's app depends on it in production.
5. **Public addresses.** Organiser and thread pages, website embeds (iframes
   on clients' Webflow sites), calendar feed URLs that people's calendars
   are subscribed to, invitation UIDs already in people's calendars, links
   in emails already sent.
6. **Behaviour that came from real cases.** VAT included or excluded, refund
   rules and credit notes, renewal and cancellation flows, calendar
   invitations and cancellations, timezone handling, six languages, approval
   flows, certificates. Most of it is covered by tests, and the changelog
   records why each rule exists.
7. **GDPR posture.** EU hosting, the data wall between apps, soft delete,
   consent, and a participant's own export and erasure request.
8. **Continuity.** Clients keep working, and keep getting fixes, while the
   new foundation is built.

## 5. What you can test a new foundation against

| Check | Proves |
|---|---|
| `apps/api/scripts/verify-external-app.mjs` | The published app API: registration, keys, scopes, every response shape |
| `apps/api/scripts/verify-public-api.mjs` | The public read API's shapes |
| `pnpm test:integration` (125 files) | Behaviour against a real database, including cross-workspace attacks |
| `pnpm test:e2e` (57 specs) | The main flows in a browser against the staging stack |
| `pnpm verify` | The release gate: typecheck, unit tests, contract checks, smoke tests |

A staged replacement can use these as its acceptance criteria: a module is
done when the same checks pass against the new code.

## 6. The options as we see them

- **A. Harden in place.** Section 3. Least risk to clients. The fix is
  structural but the codebase stays recognisably the same.
- **B. Staged replacement of the foundation.** A new data-access and tenancy
  layer, possibly a new API, built under the running product one module at a
  time behind the same contracts and tests. Clients notice nothing. This is
  where we think an outside team adds the most.
- **C. Full rebuild beside it, then a cut-over.** The cleanest result on
  paper. It carries every constraint in section 4 at once, and features stop
  while two systems run.

We lean towards B, and we are doing A meanwhile, because it is needed
whichever is chosen.

## 7. Questions we would like answered

1. Your specific findings: what did you look at, and what fell short of
   which standard?
2. What would you keep, and what would you replace?
3. Your proposed stack, and why.
4. How you would move live data, sign-ins, Stripe subscriptions and invoice
   series without interruption.
5. How you would keep the published API and the public addresses working.
6. Timeline, team, and who maintains the current system meanwhile.
7. Ownership of the code and intellectual property afterwards.

## 8. Access for the review

Read access to the repository and to the staging stack (`thefibre.tech`),
which holds test data only. Production holds personal data. Access there
would make you a processor under the GDPR, and needs a data processing
agreement first. Credentials are never shared by email or chat.
