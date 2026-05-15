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

## Where we left off — 2026-05-16 (Fibre Meet @ v0.7.0+)

The conversation that built most of Fibre Meet stretched too long; this section is the handoff so the next chat lands running. Live in production.

### Recent commits to anchor on

```
d74dae9  New menu skips team sub-picker; cleaner slug-prefix fallback
7341602  Unified slug UX (prefix + Alt), 2-card scope chooser, dropdown selects, Personal room → Connections
16b912d  Tabbed meeting-type editor + per-MT availability/calendar overrides
4b07a5a  Lucide icons everywhere; Calendars re-sync (Google API needed enabling)
82f0c5f  Two-step team invites with accept page + copy-URL fallback
92ea693  Every workspace user has a paired public.person row (identity invariant)
88b02a4  Waves 8 + 9 — contacts + internal team
9033aa8  Waves 5–7 — settings index, availability page, calendars w/ role mgmt
eeeb0e3  Waves 2–4 — dashboard, bookings, new-MT menu (Suite layouts)
b642315  Wave 1 — public booking page split-card layout
5dffa50  Step 7 — round-robin + collective event types
0d32baa  Step 5 + 6 — booking emails + cancel + Teams
```

### Where Fibre Meet is right now (the working app)

- **Public booking** at `meet.thefibre.app/<slug>/<mt-slug>`: split card with month grid + time list + tz picker + 24h/AMPM. Cancel + reschedule link on the confirmation page.
- **Dashboard**: Quick Links (top 3 active MTs, copy + open icons) + Today + Next Up.
- **Bookings**: tabbed Upcoming/Past/All · List/Week/Month · scope filter · include-cancelled.
- **Meeting types**: tabbed editor (Basics / Availability / Conferencing / Pricing / Intake). Basics has a 2-card Personal/Team scope chooser; Availability has a per-MT working-hours override; Conferencing has a per-MT conflict-calendar override.
- **Teams**: members + pending invites (status='invited' until they sign in + Accept). `/invite/[token]` public accept page.
- **Round-robin + Collective**: schema + engine + UI in place. Assignees list excludes pending invites.
- **Calendars**: Google sync, role per calendar (primary / conflict_check / write_target / ignore), Re-sync button.
- **Identity invariant**: every workspace user has a paired `public.person` row; both invite paths + the SSO resolver enforce it.

### What's queued (in order)

1. **Magic-link auth** — so invitees without Google can sign in. Supabase Auth supports it; needs an extra button on sign-in pages + a tiny tweak to the auth callback. NOT started yet — this is the right thing for the next chat to pick up.
2. **Fibre web (apps/web) — label per-app curator data tabs.** The "Edit change context" modal on a person's profile shows fields owned by an external app, but the panel doesn't say which app. Add an app-name header to each curator-data section.
3. **Cutover strategy conversation** with Sjoerd. Suite (suite.soul.com) is still live and in use by soul.com. Decide whether Meet runs parallel for a while or aims for a clean swap. Owner is Sjoerd; no code work yet.
4. **Visual fidelity to Suite is still an active concern.** Going forward, read the actual Suite component before reimplementing (e.g. via `find "/Users/sjoerdair/Projects/souls calendar" …`), don't rebuild from a screenshot — Sjoerd has called this out twice.
5. **Per-user permission tiers** (Sjoerd's longer-term ask): contacts visible only to people who are on the meetings/teams/orgs they belong to. Plus per-user "internal / external / team-member" status labels. Needs a brief amendment before any code.

### Outstanding for Sjoerd (not code)

- **Rotate the Resend API key** — the `re_AR5QNQot…` value ended up in a screenshot earlier in the conversation. Resend dashboard → API Keys → delete + create → `fly secrets set RESEND_API_KEY=…` from repo root.

### Hot-button design feedback Sjoerd has flagged

- **Icons must be lucide, never emoji.** Settings, bookings view toggle, new-MT menu, public booking meta — all converted in `4b07a5a`. Watch for any future drift.
- **Slug UX is now centralised** in `apps/meet/components/ui/name-slug.tsx`: `[prefix/][input][Alt]`. Every form that takes a slug uses this. The Profile slug field in `apps/meet/app/(app)/settings/profile/form.tsx` follows the same visual pattern by hand.
- **Content left-aligned, not centered.** `PageContainer` dropped `mx-auto` (commit `d4b2006`).
- **Number-of-minutes fields are curated dropdowns**, not free-form inputs (Buffer / Notice / Advance).
- **Personal vs Team is a 2-card chooser**, never a select. When Team is chosen, a Team picker dropdown appears below the cards (not a sub-picker inside the New menu).

### A pinned note from Sjoerd

> Suite was built in a week — by Claude. So "we got the design right in v1, the gap in v2 is on me, not on the time budget." Don't excuse design fidelity with timing. Study the source before reimplementing.

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

## Suggested next moves (in priority order)

1. **One delivery app frontend.** Pick The Thread (best-specified). A real `thread.thefibre.app` that writes `session_attended` events back through the platform demonstrates the full architecture.
2. **Tighten CORS** on the API to the production web origins before opening to outside traffic. One line in `apps/api/src/server.ts`.
3. **Custom API domain.** `fly certs add api.thefibre.app --config fly.toml` + a CNAME at the registrar, then update Vercel's `NEXT_PUBLIC_API_BASE_URL`.
4. **Activity filter by organisation_id.** Small API + UI change; unblocks org tab timelines.
5. **Microsoft + LinkedIn OAuth.** Supabase Auth config; new `user_identity_provider` rows.
6. **Article 15 export.** GDPR table-stakes; the data is all there.
7. **Tags + person↔person relationships UI.**

## Reviewer's note

In v0.3.x I burned six versions chasing a single "Save doesn't work" bug because I pattern-matched instead of reading the API log. The verbose error logging in `upsertProfile` / `upsertOrgProfile` exists *because* of that. Use it. When something doesn't save: open `/tmp/api.log` (or wherever the API stderr is going) first, hypothesise second.
