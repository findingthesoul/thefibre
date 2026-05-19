# Build plan

Living document. Tracks what's queued, what's parked, and how we work.

For *what's done*, see [CHANGELOG.md](../CHANGELOG.md).
For *why*, see the canonical spec: [`fibre-technical-brief-v0.4.md`](fibre-technical-brief-v0.4.md).

Current version: **v0.8.0**. Live in production at https://thefibre.app (web on Vercel/fra1), https://meet.thefibre.app (Fibre Meet on Vercel/fra1), https://thread.thefibre.app (The Thread skeleton on Vercel/fra1) + https://thefibre-api.fly.dev (API on Fly.io/fra).

---

## Where Fibre Meet + The Fibre are right now (2026-05-17, v0.13.11 · Meet 2.1.3)

Working scheduler (Fibre Meet = Suite v2, now charging real money). Working platform (The Fibre = identity + contacts + orgs + programmes + activity + apps + per-person profile truthfulness). Live in production. Full architecture: [`meet-architecture.md`](./meet-architecture.md). API reference: [`meet-api.md`](./meet-api.md). Data model: [`meet-data-model.md`](./meet-data-model.md). Billing: [`billing/`](./billing/).

### Shipped (deployed) — accumulated through v0.13.11
- Public booking page (split card, month grid + time list, tz picker, 24h/AMPM, cancel + reschedule link)
- Dashboard, Bookings (multi-view + filters), tabbed MT editor (Basics / Availability / Conferencing / Pricing / Intake)
- Teams (CRUD, lead/member, two-step invite flow with copy-URL fallback)
- Round-robin + Collective event types
- Calendars role mgmt + re-sync; Google Calendar connect; Personal meeting room URL
- Identity invariant: every workspace user has a paired `public.person`
- Booking + cancellation + branded auth emails (Resend, branding.ts SPoT)
- Lucide icons everywhere, no emoji
- **v0.9.0** — Permission tiers: `workspace_member` pivot, per-resource `visibility`, `relationship_type` (internal/external), SECURITY DEFINER predicates
- **v0.10.0** — Branded auth emails via Supabase Send Email Hook. `/sign-in` on `thefibre.app`. 8-digit OTP. `branding.ts` SPoT. Logo asset wired. Fly pinned warm. Copy/Open icons on MT rows. Cream canvas. Scope=Team save fix.
- **v0.11.x – v0.12.x** — Workspace plumbing, settings UX, error formatting, API diagnostics, deploy doc clarifications (`NEXT_PUBLIC_COOKIE_DOMAIN` per Vercel project).
- **v0.13.0** — Intake forms end-to-end (editor + renderer + persisted answers).
- **v0.13.1 – v0.13.5** — Stripe Connect onboarding (paste flow), price on MT, Stripe Checkout for paid bookings, webhook completes deferred side-effects, 2% platform skim capped at €2 per booking. Meet version decoupled to v2.0.0.
- **v0.13.2** — Booking approval (host default + per-MT override).
- **v0.13.4** — Branded booking emails; stopped Google's duplicate invite.
- **v0.13.6 – v0.13.7** — Payments save cache fix; settings card 2-col grid; paid MT no longer silently reverts to Free (radio `value=` fix).
- **v0.13.8** (Meet 2.1.3) — Meet's contact tab now uses `person_meet_profile` (host notes / VIP / blocked / tz) instead of change-facilitation fields (which belong to a future Fibre Change app).
- **v0.13.9 – v0.13.11** — Contact profile now shows Org memberships + Workspace access + App memberships; dormant memberships no longer leak via `/persons/:id/memberships` or `/auth/me`.

### Open queue (in priority order)

#### Drop `person_change_context` table + Meet manifest reference
v0.13.8 stopped surfacing the table on the Meet contact tab; it's dead weight now. One migration to drop + remove from `apps/meet/fibre.app.json` manifest.

#### Fibre Change app — proper home for the ejected fields
Change-facilitation fields (Role in change, Stance, Readiness, Leadership style, Themes, Blockers, Motivators, Current challenge, Facilitator notes) need a new app: slug, manifest, curator tables, profile tab. Not started.

#### Org-side per-app dialog labelling
Contacts already say "Edit X — Fibre Meet" etc. Verify org-side dialogs (invoicing on Fibre Sales, etc.) follow the same convention; mirror if not.

#### ~~Group / One-off / Meeting poll event types~~ ✓ Done
Group landed in v0.11.1; One-off + Meeting poll in v0.12.0. All three are now selectable from "+ New".

#### Platform billing Phase 1
Workspace plan (Free / Pro / Org) + plan-aware skim (waive the 2%/€2 for Pro/Org). Roadmap in [`billing/`](./billing/).

#### Article 15 export / retention admin / cross-app erasure
Still not started.

#### Cross-app entity mapping — public-facing doc
Schema + API landed; needs a guide for third-party app builders. Confirm in-family apps (Meet/Thread/Flow) keep using platform tables natively — `app_entity_mapping` is for EXTERNAL apps only.

#### Visual fidelity passes vs Suite
Read the equivalent component from `/Users/sjoerdair/Projects/souls calendar/` before rebuilding — don't work from screenshots alone.

#### Fibre Flow — fourth app (briefing + decisions locked 2026-05-17, Phase A landed 2026-05-17)
Founding-team briefing: [`fibreflow-brief-v0.3.md`](./fibreflow-brief-v0.3.md). Review + gap analysis: [`fibreflow-review.md`](./fibreflow-review.md). Schema + scaffolding sketch: [`fibreflow-data-model.md`](./fibreflow-data-model.md). **Full build plan (10 phases, ~16–20 build-days):** [`fibreflow-build-plan.md`](./fibreflow-build-plan.md).

**Decisions locked by Sjoerd 2026-05-17:**
1. All seven §4 answers approved (gate logic configurable, snapshot versioning, new run on re-entry, default tasks yes, in-app notifications, manual Drive URLs).
2. **Generalise `meet_team` → `team` at platform level.** Fibre Flow uses platform structures natively, not via the cross-app entity-mapping layer. That layer is for connecting *external* systems to Fibre; Flow is built from scratch on the same foundation as Meet, so it consumes the same primitives.
3. **No terminology renaming.** "Workspace", "team", "person", "organisation" carry their platform meanings everywhere. If inconsistencies surface during build, flag them.
4. **One big v1.** "Can only see how the interface functions once we have data to work with."

**Phase status:**
- [x] **Phase A — `meet_team` → `team` rename** (v0.13.12, migration `20260517220000_rename_meet_team_to_team.sql`). Pending: apply to remote Supabase + redeploy API/web/meet.
- [ ] **Phase B — Fibre Flow shell** at `flow.thefibre.app` with sign-in.
- [ ] Phases C–J — see the build plan.

#### Future Meet features (parked)
- One-off meetings + meeting polls (UI shows them as "Soon" in the New dropdown)
- Zoom OAuth (provider field accepts 'zoom'; auth not wired)
- Reserved-slug validation (rejecting things like "settings", "invite")

---

## Outstanding for Sjoerd

- **Decide Meet ↔ Suite cutover** strategy (decided: hard swap, case-by-case for any slug breakage).
- **Add yourself as an org_membership** on Solidarity Lab B.V. via the UI so your own profile's Organisations section populates.

_(Resend rotated; Stripe Connect onboarded.)_

---

## Now — closing the post-deploy loop

- [x] **Tighten CORS** in `apps/api/src/server.ts` — done in v0.13.17. Allowlist covers the 5 thefibre.app subdomains, local dev (3000/3001/3002), opt-in `CORS_ORIGINS` env, and our own `*.vercel.app` previews. Unknown origins get no `Access-Control-Allow-Origin` header (browser blocks). Server-to-server (Stripe webhook, Supabase Send Email Hook) unaffected.
- [ ] **Custom API domain** — `fly certs add api.thefibre.app --config fly.toml`, add the CNAME at the registrar, then update Vercel's `NEXT_PUBLIC_API_BASE_URL` and redeploy. (Web is already at `thefibre.app`.)
- [ ] **Supabase Auth redirect URLs** — confirm `https://thefibre.app/**` and `https://*.thefibre.app/**` are listed (sign-in already works, so likely fine — verify).

---

## Next — feature gaps now that the platform feels real

### Quick wins (under an hour each)
- [ ] **App switcher in the top nav** — dropdown showing The Fibre / Fibre Meet / The Thread (only the apps activated for this workspace + the user has membership for). Surfaces in apps/web's Topbar and apps/meet's header. Each entry links to the relevant subdomain.
- [ ] Activity filter by `organisation_id` — join through `org_membership`. Unblocks org per-app tab timelines (currently EmptyState).
- [ ] Tags — create, assign, filter persons and orgs by them.
- [ ] Person ↔ person relationship form (the `relationship` table already exists, no UI).
- [ ] Microsoft + LinkedIn OAuth providers — Supabase Auth config only.

### Medium (a session or two each)
- [ ] App membership management UI — assign roles + permissions per app per user.
- [ ] Workspace creation + switching (currently one seeded workspace).
- [ ] Invite by email (magic link flow per brief §5.5b).
- [ ] Article 15 export — JSON of everything held about you.
- [ ] Article 16 rectification — link from privacy to self-edit fields.
- [ ] Article 20 portability — same payload as export with schema.
- [ ] Retention policy admin.
- [ ] Cross-app erasure webhook handlers (each delivery app registers an endpoint).

### Bigger (one of the delivery apps)
- [ ] The Thread frontend at `apps/thread/` — events + journeys + sessions. Best-specified in the brief (§8 EBBF Athens example). Once one delivery app exists writing activity events back, the full architecture loop closes.
- [ ] Fibre Meet frontend at `apps/meet/` — meetings + agendas + outcomes.
- [ ] Fibre Sales — sovereign app, gated, deal pipeline + handover webhook on `deal_won`.
- [ ] Fibre Learn — future, blocked on a content authoring system.

---

## Phase 2 — programme layer (mostly shipped in v0.4.1)

- [x] Create / list / view programmes (any format)
- [x] Enrol a person in a programme
- [x] Enrolment status transitions
- [ ] Activity write path from inside delivery apps (today the seed writes them via service role; once delivery apps exist they'll write via `POST /activities` with their `X-App-ID`)
- [ ] `progress_pct` updates on activity events (today set manually in the seed)
- [ ] Programme detail with per-format content (sessions for events, milestones for journeys) — that's delivery-app territory

---

## Phase 3 — GDPR UX (mostly shipped, see "Medium" above for what's left)

- [x] Privacy dashboard for the participant (v0.2.2)
- [x] Article 17 erasure request UI (v0.2.2); cross-app webhook fan-out still TODO
- [x] Data minimisation by construction (v0.4.0)
- [ ] Article 15, 16, 20 endpoints + UI
- [ ] Retention policy admin
- [ ] `processing_purpose` table populated with Supabase / Vercel / Resend / Stripe as documented processors
- [ ] Email service consent-gate (don't send `marketing_email` without active consent record)

---

## Phase 4 — Fibre Sales (gated app, when ready)

(See "Bigger" above. Schema in §5 Domain 8 of v0.3 brief still applies — it's the only delivery app whose schema is fully specified.)

---

## Operational & infra

- [ ] **Custom email domain** — Resend with `@thefibre.app`, SPF / DKIM / DMARC
- [ ] **Lint rule banning Supabase imports under `apps/web/app/api/`** — enforce brief rule §13
- [ ] **CI** — typecheck + build on every PR
- [ ] **Backups** — Supabase has them; confirm retention, document restore
- [ ] **Migrations workflow** — staging environment for trying migrations before prod
- [ ] **CORS hardening** on the API once it's public — restrict to production web origins

---

## Code-level TODOs left in place

- `apps/web/app/auth/callback/route.ts`: workspace resolution falls back to `DEFAULT_WORKSPACE_ID`. Replace with invite / magic-link / domain-matching logic once multi-workspace lands.
- `apps/web/lib/supabase/server.ts`: `setAll` swallows server-component cookie write errors. Add a Next middleware calling `supabase.auth.getUser()` so sessions auto-refresh between requests.
- `apps/api/src/routes/sso.ts`: gated by `SSO_INTERNAL_SECRET` — rotate before prod.
- `apps/web/lib/api.ts`: `PLATFORM_APP_ID = 'fibre-platform'` is the canonical now. Done.

---

## Gotchas we've hit (for memory)

- **Supabase migrations** need 14-digit timestamps (`YYYYMMDDHHMMSS`). Same-day shorter prefixes collide in the tracker.
- **`custom_access_token_hook`** must be enabled in the Auth dashboard or RLS denies everything authenticated.
- **JWT `sub` ≠ `public.user.id`.** Use the `app_user_id` claim (the hook injects it).
- **`userClient`** must use the anon key as base apikey. Service-role key elevates PostgREST out of RLS context. (Fixed v0.3.6.)
- **NOT NULL on text[] / int counters / booleans** with default values still rejects explicit nulls from the UI. Drop NOT NULL on optional columns. (Fixed v0.3.9, v0.3.10.)
- **`revalidatePath` from a server action** doesn't auto-refresh the active client route. Call `router.refresh()` in the dialog after a successful save. (Fixed v0.3.11.)
- **Vercel monorepo** framework preset defaults to "Other" and root directory defaults to repo root. Both must be set explicitly for `apps/web`. (`vercel.json` files in place.)
- **Next.js dev server + rapid file changes** (parallel agents): every route 500s. Fix: `Ctrl+C` and restart `pnpm dev` after a parallel batch.
- **Server Components + cookie writes:** Next.js 15 forbids cookie writes outside Route Handlers / Server Actions. Wrap Supabase SSR's `setAll` in try/catch.
- **`activity` has no `organisation_id`** — org per-app tabs render their curator section but EmptyState the timeline. Future fix via join through `org_membership`.
- **Workspace packages must emit compiled JS.** `@thefibre/shared` used to point `main` at `src/index.ts`; this works under tsx (dev) but Node 22 in production refuses to strip types from files under `node_modules`. Fix: emit a `dist/`, point `main` at it, and use the pnpm topological filter (`--filter @thefibre/web... build`) so consumers' build commands build deps first. (Fixed v0.4.8.)
- **Supabase migrations are tracked by filename, not checksum.** Editing an already-applied migration is a no-op on remote. Write a fresh migration (with a new timestamp) to re-apply. (Hit this for the relax-NOT-NULL change; see `20260514140000_relax_text_arrays_again.sql`.)
- **Fly machine leases can stall a redeploy** if an earlier deploy half-completed and the lease is held by a different (now-expired-on-our-end) token. `--force destroy` won't release it. Wait for the lease to expire (~15 min), then redeploy. The new deploy succeeds cleanly.

---

## How we ship

- One feature, one version. SemVer:
  - **patch** (`0.x.y+1`) — additions and fixes that don't change UX shape
  - **minor** (`0.x+1.0`) — UX milestone or new top-level page or schema principle
  - **major** — reserved for breaking API changes once we have external consumers
- Every shipped version updates: `package.json` × 4, `apps/web/app/(app)/layout.tsx` (sidebar footer), `CHANGELOG.md`.
- Build plan ticks come *off* when shipped — completed items move out of view here (CHANGELOG keeps them).

## How we use parallel agents

Worked for v0.3.0 (4 person tabs), v0.3.2 (3 org tabs), v0.4.0 (person + org refactor).

Rules:
1. Each agent owns one disjoint folder. No shared files.
2. Parent (me) builds the foundation first — layout, stubs, shared API. Agents only fill leaves.
3. After every parallel batch: full `pnpm -r typecheck`, then commit.
4. Sequential is faster for ≤2 tasks. Parallel pays off at 3+.

---

## Parked / decisions deferred

- **`person_app_profile` / `org_app_profile` JSONB extension tables** (brief v0.4 §5 Domain 5) — the canonical home for app-owned curator data once schema stabilises. Right now the existing app-tagged tables play that role.
- **Auto-edit / 10-step undo / change history** — good idea, premature. GDPR erasure must zero PII; storing old field values is a hidden second copy. Revisit once we know which fields people actually edit most.
- **Self-hosted Supabase on Hetzner** — migration trigger documented in brief §4 (client requiring no-US parent, scale ≥10k users, or sovereign regulator).
- **Fly.io vs Railway** — picked Fly.io. Config in `apps/api/fly.toml`.
- **Region** — project is West EU (Ireland). Both EU, GDPR-compliant. API will deploy to Fly Frankfurt to align with brief intent.
- **GraphQL via Hasura** — only if a contract requires it.
