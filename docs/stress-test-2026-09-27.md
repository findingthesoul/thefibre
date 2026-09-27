# Stress-test pass — 2026-09-27

Third round, two days after `docs/stress-test-2026-09-25.md`, from v1.77.0
(staging and production level) in worktree fable-stress, beside eleven peer
sessions. Sjoerd's go-ahead arrived relayed through the launch chat; the
round ran staging-only as before.

## Read this first

1. **Your no-access page now says which workspace it is talking about.**
   You opened Thread with Doab.ai active and read "You don't have a seat in
   Thread" — false; the seat is in another workspace. The shared page now
   takes context from the same shell loader that sent you there: it names
   the active workspace, offers "Continue in <workspace>" for every
   workspace where the app is on and you hold a seat (one press: switch,
   refresh the token, land on the app's home), and links The Fibre and your
   page. Without a session or a loader answer it keeps the member-first copy.
   Six apps (Thread, Meet, Flow, Connect, Models, Pulse); Members keeps its
   own member-redirecting wall and The Fibre never lands there.
   `e2e/no-access.spec.ts` proves it end to end on staging with a
   two-workspace fixture.
2. **Staging's plan catalogue had been overwritten** — every `billing_plan`
   name was a person's name (Maren Brandt, Joris Lindqvist…), which is why
   `smoke-staging` failed on "/pricing has no Starter". A blast-radius query
   over every `name`/`title`/`full_name` column on staging found billing_plan
   to be the only casualty. thefibre-0f owned it: a private variant of the
   clone script with a table-wide `name` rewrite and no exemption for
   billing_plan. I restored the five names from production's catalogue
   (Free, Starter, Pro, Enterprise, Beta) as a staging-fixture repair before
   the owner was known. **Still open, yours:** the same run nulled the
   SANDBOX Stripe product/price ids on Starter and Pro; they need a re-mint
   against the staging sandbox (`sync-stripe-plans.mjs`), never a copy from
   production's live ids. `billing_plan` has no `updated_at`, which is why
   nobody could date it — build plan.
3. **No RLS breach, and the anon-floor test now probes every table.** The
   coverage audit of the thirteen tables created since 2026-09-14 found RLS
   on all of them and no anon-readable policy; but the floor test was a hand
   list of fourteen names that included none of them — mcp_grant (encrypted
   session), workspace_assistant (encrypted key), person_calendar_feed
   (token), person_contact_point (every email) among the missing. The list
   is now derived from the migrations: 140 tables probed, none returns a row
   to anon.

## Layers, as run (before any edit)

| Layer | Result |
|---|---|
| `pnpm verify` | green |
| Integration pack on staging | 18 files pass; `enrol-free` failed on three connect timeouts to the staging API over ~40 s, passed 3/3 on re-run alone (network, not code) |
| External-app walk, MCP personal (new connector root), public API — staging | green |
| Stripe webhooks staging, definer audits both stacks, root slugs both, workspace admins both, SSO hop | green |
| Smoke staging | two failures: the plan names (item 2) and no entry for `fibre-models` (added) |
| Playwright pack | green |

## Hunts and what they found

- **RLS coverage since 2026-09-14** (item 3). Two hygiene notes, not
  breaches, in the build plan: `assistant_usage`'s read policy compares
  `auth.uid()` with `public.user.id` and so never matches (fails closed; the
  API reads it as service role) — the same inert pattern sits in three older
  migrations; `user_task_read` has no workspace term in USING (the route
  filters workspace explicitly). Every definer function since the 14th is
  closed; three `create or replace` re-definitions omit the same-file
  revoke and inherit the earlier ACL.
- **The Help manuals (v1.77.0).** Every link in nine apps resolves to a real
  page. Two pointed near their target rather than at it (Thread's website
  guide opened on embeds; Members' Access row opened on products) — fixed.
  The one English literal on eight apps' Help pages, the "building against
  the platform" paragraph in the shared component, now goes through the
  chrome catalogue in six locales. Three apps describe the "connect your
  own Claude" procedure in three wordings — build plan. `e2e/help-pages.spec.ts`
  renders Help signed in for six apps and checks the first guide's link.
- **Silent-empty conversions**, continuing the 25th's list with the
  `rows()` helper (which thefibre-60 extended with `count()`): team grants
  (a failed read resolved to "no grants" and, through the sync, would have
  deleted memberships), the archived-workspace gate (its catch never fired —
  PostgREST does not throw — so a failed refresh unlocked archived
  workspaces for a minute), membership price rules (a member charged the
  default because a query broke), the composed to-do list (per source, on
  thefibre-05's argument that a plausible list is worse than an error),
  public organiser and host pages, `/public/my-enrolments`, the Members
  page's grantable apps (which cached an empty failure for five minutes),
  team detail, the profile's per-app tabs. Peers flagged three deliberate
  shapes not to "fix": Meet returns archived meeting types on purpose,
  the calendar-feed table has RLS with no policies on purpose, and
  thread_task is shared with every Thread seat while user_task is private.

## What I did not do

- Did not touch production data; the plan-name repair was on staging.
- Did not re-mint the staging Stripe ids (yours).
- Did not render Outlook/Apple Mail or an image-background certificate.
- Members' no-access wall keeps its own shape; the Doab.ai case there is
  the same and is listed for its owner.

## Open for you

- Promote when ready. Nothing in this round is production-only urgent.
- Re-mint Starter/Pro sandbox Stripe ids on staging.
- The merged-address decision from the 25th is still open.
