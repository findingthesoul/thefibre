# Working notes for Claude

Read this before doing anything. Orientation document for whoever picks up this codebase next.

## Source of truth

- **Vision (current):** [`docs/fibre-technical-brief-v0.4.md`](docs/fibre-technical-brief-v0.4.md) — the canonical spec. Read §1 (vision), §2 (data wall + profile structure), §5 (data model with app-owned curator extensions), §6 (data ownership + minimisation), §13 (developer rules), §15 (principles).
- **Previous brief:** [`docs/fibre-technical-brief-v0.3.md`](docs/fibre-technical-brief-v0.3.md) — kept in repo for traceability. **v0.4 supersedes for new work.**
- **Operational plan:** [`docs/build-plan.md`](docs/build-plan.md) — what's queued, what's parked, gotchas.
- **Shipped record:** [`CHANGELOG.md`](CHANGELOG.md).
- **Deploy procedure:** [`docs/deploy.md`](docs/deploy.md).

If those contradict each other, the brief wins.

## Architecture in one paragraph

Hono API at `:8080` reads Supabase (EU). Next.js 15 web at `:3000` calls the API for everything — **no direct Supabase from web** (brief §13). User signs in via Google OAuth; Supabase Auth mints a JWT; the API trusts that JWT for tenant + user resolution. RLS is the enforcement layer; the API is a thin convenience wrapper. The data wall (brief §2): platform owns identity + contact graph edges + activity events + enrolment state + consent. Each **app** owns its own content (separate schemas) AND the curator-data fields it justifies on persons/orgs (rows in shared tables tagged with `app_id`). Apps cross the wall only via the `activity` event log (type + subject, never body).

## Two principles formalised in v0.4

1. **Per-app profile tabs.** A person's or org's profile is composed of an Identity tab (Fibre Platform) plus one tab per app that has data on them. Tabs appear emergently from `GET /persons/:id/apps` and `/organisations/:id/apps`.
2. **The app justifies the field.** Every field stored exists because a specific app needs it. No "general useless stuff". RLS enforces this — a user only sees curator rows for apps they have `app_membership` for. GDPR Article 5(1)(c) by construction.

When designing a new field: which app justifies it? If none, don't add it.

## Hard rules — never violate

1. **No personal data in Vercel.** Frontend is stateless. Every PII operation goes through the EU API.
2. **`X-App-ID` header** on every API request.
3. **RLS on every table.** Workspace + (where applicable) app-membership scoping mandatory.
4. **Soft delete only** for personal data.
5. **Activity is append-only.** Type + subject only. Corrections = new rows.
6. **Cursor pagination only.**
7. **Connection pooling from day one** (PgBouncer transaction mode, port 6543).

## Working with this codebase

### Local dev

```bash
export PATH="$HOME/.local/bin:$PATH"
cd ~/Projects/thefibre
pnpm dev          # both API (:8080) and web (:3000) in parallel
```

### Version bumps
Every shipped change updates **four** `package.json` files plus `apps/web/app/(app)/layout.tsx` (the `VERSION` constant shown in the sidebar footer). The CHANGELOG entry lands in the same commit.

### Seed realistic data

```bash
cd apps/api && node scripts/seed-ebbf.mjs
```

Creates the brief §8 worked example: EBBF Athens 2026 conference + post-Athens journey + board working session, 7 people, EBBF org with members + identity + system context, ~11 enrolments, ~21 activity events spread across 90 days, per-app curator data for Marja and Daniel. Idempotent — safe to re-run.

### Parallel agents — when to use them

Worked well for v0.3.0 (4 person tabs), v0.3.2 (3 org tabs), v0.4.0 (person + org refactor). Rules:
1. Each agent owns a disjoint folder. No shared files.
2. The parent builds the foundation first — layout, stubs, shared API. Agents only fill leaves.
3. After every parallel batch: `pnpm -r typecheck`, then commit.
4. Sequential is faster for ≤2 tasks. Parallel pays off at 3+.

Worktree isolation isn't available in this repo — agents share the working directory. Strict file lanes prevent corruption. **The Next.js dev server gets confused when many files arrive at once** — kill and restart `pnpm dev` after a parallel batch.

### Debugging API failures

**Don't pattern-match — read the API server log.** Both `upsertProfile` (persons) and `upsertOrgProfile` (orgs) log full Postgres errors (code/details/hint) to stderr. The constraint name is right there. Order: Network tab in browser → API stderr → THEN hypothesise.

### Gotchas (from hard-won experience)

- Supabase migration filenames need 14-digit timestamps. Shorter prefixes collide same-day.
- Supabase tracks applied migrations by filename, not checksum. Editing a previously-applied migration file is a no-op on remote — write a fresh migration to re-apply changes (see `20260514140000_relax_text_arrays_again.sql` for an example).
- `custom_access_token_hook` must be enabled in the Supabase dashboard. Without it, RLS denies everything authenticated.
- JWT `sub` is `auth.users.id` — NOT `public.user.id`. Use the `app_user_id` claim (added v0.3.8) for any FK to `user(id)`. The hook injects this.
- text[] and integer counters that were `NOT NULL DEFAULT` are now nullable so the UI can clear them.
- `revalidatePath` from a server action doesn't auto-refresh the client route in this flow. Call `router.refresh()` from the dialog after a successful save (added v0.3.11).
- `userClient` MUST use the anon key as base apikey, not the service-role key. Otherwise PostgREST elevates to service_role and ignores the user JWT for RLS (fixed v0.3.6).
- After parallel agent runs, the Next.js dev server can wedge. Kill + restart.
- `@thefibre/shared` emits a compiled `dist/` (since v0.4.8). Both apps must build it first. Done via the pnpm topological filter `--filter @thefibre/web... build` (the trailing `...` = "and its workspace dependencies"). Don't hand-chain build commands.
- Fly will refuse to release a machine lease until it expires (~15 min). If a deploy half-completes, you can't `fly machine destroy --force` it from a different token. Wait it out, then redeploy.

## Where we left off — 2026-05-16 (v0.10.0)

Two big landings since v0.8.0: **permission tiers** (v0.9.0, multi-org-ready
workspace_member pivot + per-resource visibility) and **branded auth emails
via Supabase Send Email Hook** (v0.10.0, packages/shared as the SPoT).

### Docs to read first
- `CHANGELOG.md` — v0.9.0 + v0.10.0 entries cover everything new since v0.8.0.
- `docs/meet-architecture.md` / `meet-api.md` / `meet-data-model.md` — still
  the canonical maps of Fibre Meet.
- `docs/permission-tiers-proposal.md` (v2, decisions resolved) — the
  workspace_member + visibility model that landed in v0.9.0.
- `docs/build-plan.md` — current queue.

### Recent commits to anchor on

```
8c04427  Fix team scope flipping back to personal; mirror MT list on team page
69b5c07  Meeting types: copy + open icons per row; harden conflict-cal default
a9c031e  Meet content area on soft-cream canvas (bg-surface-sunken)
ba4fa17  v0.10.0 — branded auth emails via Send Email Hook
1209a44  Auth-hook: warm Fly machine + accept v1,whsec_xxx secret format
8623029  Sign-in code field accepts 8 digits (Supabase OTP length)
ff8519c  Expose email-code sign-in on thefibre.app (/sign-in page)
df067d3  Wire the Fibre wordmark into auth emails
<earlier> v0.9.0 — permission tiers (workspace_member + visibility)
```

### Where The Fibre + Fibre Meet are right now

**Platform** (`thefibre.app` on Vercel · `thefibre-api.fly.dev` on Fly · v0.10.0)
- Sign in works both ways: Google OAuth and 8-digit email code. `/sign-in` page
  on `thefibre.app` mirrors the public sign-in on `meet.thefibre.app`.
- Every Supabase auth email (signup / login / magiclink / invite / recovery /
  email change × 2 / reauthentication) is rendered by our API from
  `packages/shared/src/branding.ts`. Logo image lives at
  `https://thefibre.app/brand/the-fibre.png`.
- `workspace_member` pivot table with `relationship_type` (internal/external)
  + per-resource `visibility` (members_only/org_wide) on `meet_team` + `program`.
  RLS rewritten on `person` / `organisation` / `activity` / `meet_booking` with
  SECURITY DEFINER predicates.

**Fibre Meet** (`meet.thefibre.app`, v0.10.0)
- Cream content canvas (`bg-surface-sunken`) so white cards lift cleanly.
- Meeting-types list rows have Lucide Copy + ExternalLink icon buttons that
  stop propagation. Team detail page mirrors the same row style.
- Tabbed MT editor (Basics / Availability / Conferencing / Pricing / Intake).
  Conflict-calendars override correctly defaults to "Use host default" even
  when previously saved as `[]`.
- Scope=Team now saves correctly even if the user trusts the visible default
  in the Team dropdown (fix: `effectiveTeamId` falls back to `teams[0]?.id`).
- Round-robin + Collective enabled when you're a lead of at least one team.
  Group / One-off / Meeting poll are still hard-coded `disabled: true` stubs.

### Infra invariants (don't regress)

- Fly machine pinned warm: `min_machines_running = 1`,
  `auto_stop_machines = off`. Required because Supabase auth hooks have a 5s
  ceiling and cold starts blow it.
- Auth-hook HMAC parser accepts `v1,whsec_xxx | whsec_xxx | bare base64` so
  dashboard copy-paste of the webhook secret just works.
- Supabase OTP length is **8** (configurable in Supabase dashboard →
  Authentication → Sign In/Providers → Email). Both `sign-in-button.tsx` files
  hardcode `maxLength={8}`; if Sjoerd changes OTP length, change both.

### What's queued (in order)

1. **Fibre web — label per-app curator-data tabs.** Done in apps/web for
   contacts (chip on each section), but verify the same lands on org pages.
2. **Per-app curator data labelling: app chip on every "Edit X" dialog
   title** — partially done (the four contact dialogs say "Edit change
   context — Fibre Meet", etc.). Check org-side dialogs follow the pattern.
3. **Cross-app entity mapping** — schema landed (`app_entity_mapping` +
   `app_record_link`) with `/api/v1/apps/...` routes. Used internally by
   Meet so far; needs documenting + a demo of how a third-party app would
   register and link records.
4. **Article 15 export / retention policy admin / cross-app erasure**
   webhook handlers — still not started.
5. **Group / One-off / Meeting poll** event types — stubs reserved in the
   New-MT menu; not built. Easiest is Group (capacity + waitlist field).
6. **Cutover plan: Suite → Fibre Meet** for `suite.soul.com`. Sjoerd owns
   the timing/strategy decision; no code yet.

### Outstanding for Sjoerd (not code)

- _(Nothing outstanding as of v0.10.0. The Resend API key rotation that was
  flagged from v0.8.0 was completed by Sjoerd; the leaked `re_AR5QNQot…`
  value is dead.)_

### Hot-button design feedback (still active)

- **Lucide icons, never emoji.**
- **Slug UX is centralised** in `apps/meet/components/ui/name-slug.tsx`.
- **Content left-aligned, not centered.**
- **Number-of-minutes fields are curated dropdowns**, not free-form inputs.
- **Personal vs Team is a 2-card chooser**, never a select.
- **Read the Suite source before reimplementing** — don't rebuild from a
  screenshot. Sjoerd's pinned note: "Suite was built in a week — by Claude.
  Don't excuse design fidelity with timing."

### Things proven this session worth remembering

- **End-to-end auth email pipeline works**: Supabase Send Email Hook →
  Fly API (`/api/v1/auth-hook/email`) → Resend, with branding from
  `packages/shared`. A name change or white-label is one file edit.
- **`branding.ts` is the SPoT** — `APPS`, `ENTITY`, `FOOTER_LINKS`,
  `BRAND_ASSETS`, `appName()`, `legalFooterLine()`, `emailSignoff()`,
  `defaultEmailFrom()` are the public surface. Public legal footer
  intentionally excludes `ENTITY.name` (Solidarity Lab B.V.) — that
  stays in branding.ts for internal billing only.
- **Common pitfall pattern in this codebase**: a React `<select>` whose
  visible default isn't the state's actual value. Always derive the
  posted value with a fallback to the visible default — don't trust
  that state matches what the user sees. (See the Scope=Team fix in
  `8c04427`.)

---

## State as of v0.4.8 (live in production)

### Live URLs
- **Web** — https://thefibre.app (Vercel, fra1) and the project's preview deployments
- **API** — https://thefibre-api.fly.dev (Fly.io, fra region, 1 shared-cpu-1x 1GB machine)
- **DB + Auth** — Supabase project `zfsyyokepyycefbxiblc`, West EU (Ireland)
- Google OAuth signed-in user (sjoerd@soul.com) hits the real API; RLS scopes data; the 8 seeded contacts render.

### What works end-to-end
- Sign in via Google → land on dashboard → see your apps
- Contacts (8 seeded people) → click one → Overview + Profile + per-app tabs that exist (Fibre Meet, Fibre Sales, Fibre Learn — emergent from actual data)
- Edit basic identity (with searchable country picker, address, language), edit per-app curator data. All saves persist.
- Organisations → EBBF → Overview + members + per-app tabs (including invoicing on Fibre Sales)
- Programmes (3 seeded: Athens, post-Athens journey, board session) → enrol people → see enrolment list with status + progress
- Workspace-wide Activity timeline (~21 events across 90 days), filterable by app + type
- Privacy page (consents + erasure request)
- Settings page (profile + workspace + app memberships)

### Not yet shipped
- The four delivery-app frontends (meet.thefibre.app, thread.thefibre.app, sales.thefibre.app, learn.thefibre.app).
- Article 15 export, retention policy admin, cross-app erasure webhook handlers.
- Activity filter by `organisation_id` (only person_id today — org per-app tab timelines render EmptyState).
- Microsoft / LinkedIn OAuth.
- Custom `api.thefibre.app` CNAME (API is reachable at `thefibre-api.fly.dev` for now).
- Tightened CORS on the API — currently allows any origin (`apps/api/src/server.ts`).

### Data state
Workspace `eaf096f8…` (default), real user `sjoerd@soul.com`, 8 seeded sample people, 1 org (EBBF), 3 programmes, ~11 enrolments, ~21 activity events.

## Suggested next moves

Superseded by `docs/build-plan.md` (the "Open queue" section under "Where Fibre Meet is right now"). Highest-priority items today:
1. Magic-link auth (so non-Google invitees can sign in)
2. Fibre web: label per-app curator-data tabs by app name
3. Cutover plan for Meet ↔ Suite (Sjoerd owns)

## Reviewer's note

In v0.3.x I burned six versions chasing a single "Save doesn't work" bug because I pattern-matched instead of reading the API log. The verbose error logging in `upsertProfile` / `upsertOrgProfile` exists *because* of that. Use it. When something doesn't save: open `/tmp/api.log` (or wherever the API stderr is going) first, hypothesise second.
