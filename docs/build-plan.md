# Build plan

Living document. Tracks what's queued, what's parked, and how we work.

For *what's done*, see [CHANGELOG.md](../CHANGELOG.md).
For *why*, see the canonical spec: [`fibre-technical-brief-v0.4.md`](fibre-technical-brief-v0.4.md).

Current version: **v0.13.108**. Live in production at https://thefibre.app (web on Vercel/fra1), https://meet.thefibre.app (Fibre Meet on Vercel/fra1), https://thread.thefibre.app (The Thread skeleton on Vercel/fra1) + https://thefibre-api.fly.dev (API on Fly.io/fra).

---

## Where the Fibre suite is right now (2026-07-07, v0.13.108 · Thread 3.31.1 · Meet 2.4.1 · Flow 1.10.0)

Four apps live: web (platform), Meet, Thread, Flow. **The Thread rebuild is
complete** (all 6 phases + certificates + templates + embeds + /my portal);
the **Invoices area + role tiers + payments SPoT** landed 2026-07-04
(docs/invoices-and-roles-proposal.md — all decisions resolved). CLAUDE.md's
"Where we left off" carries the detailed feature inventory; this file keeps
the queue.

### Open queue (in priority order — THE to-do list, keep it current)

_Last groomed 2026-08-22 (v0.14.0). Done items get removed, not ticked._

_Flow-as-planner-engine (docs/brief-flow-as-planner-engine.md) is complete
except gap 5, the communities/organisations variation — which the brief itself
says may not belong in Flow at all. That needs a design call before code._

_External apps (docs/brief-external-apps.md) shipped whole in v0.14.0 — open
catalogue + lifecycle, `app_key` with enforced scopes, org links, bulk links,
manifest-validated activity types. Follow-ups from its §4 that are still open
are items 10a–10c below._

_The Festival of Trust planner stays EXTERNAL (Sjoerd, 2026-08-22): its own
repo, consuming Fibre / Flow / later The Thread over the app-key surface. It is
the live proof that path works. Item 1b carries what that needs from us._

1. **Stripe secrets (Sjoerd, not code)** — `fly secrets set
   STRIPE_SECRET_KEY=…`; register the Thread webhook
   (`https://thefibre-api.fly.dev/api/v1/thread/stripe-webhook`,
   checkout.session.completed + .expired) + `STRIPE_THREAD_WEBHOOK_SECRET`;
   then an end-to-end paid test. Card payments stay hidden on public
   enrol forms until this lands.
1b. **Seed the planner's nine steps as a flow** — the platform work is DONE
   (0.15.0 app-key access to Flow; 0.16.0 `flow_task.step_id` +
   `flow_definition.progression`, with a self-paced toggle in Flow's UI;
   0.17.0 `flow_step.group_key/group_label` for the three phases and
   `meta jsonb` for purpose / trap / reflection, both on the app contract and
   both editable in the builder's step inspector). What
   remains needs content, not code: the nine steps as a workspace flow with a
   `system_key`, following the `pulse_pipeline` precedent. Blocked on the real
   step copy — what's in the planner's `festival-plan.ts` is placeholder (the
   spec sources it from "manual documents A2", not on this machine).
   After that: The Thread gets the same app-key treatment, so the planner can
   turn a festival into a public page with tickets. Same shape, new scope pair.

2. **Members UI role vocabulary** — API accepts
   super_admin/admin/organiser; the web Members page still shows the old
   labels. Facilitator = per-thread badge, not a workspace role.
3. **Org-share transfers** — thread_payout ledger rows exist ('pending');
   actual Stripe transfers of the workspace share are deferred.
4. **Role-gating beyond Invoices** — enrolments/contacts visibility per the
   tiers (proposal §3.8, deliberately out of v1).
5. **Certificate email i18n** (EN-only today) + `customer_tax_ids` so the
   Stripe legal invoice carries the buyer's VAT number.
6. **Uploads: per-app membership gate** — any workspace member can upload
   images today (MIME + 5MB limits exist since 0.13.108); the middleware
   never checks app_membership on /thread/uploads + /meet/uploads.
7. **Split apps/api/src/routes/thread.ts (~4.7k lines)** — mechanical
   module split; the full section/dependency map lives in
   docs/thread-split-map.md (2026-07-07). Pure moves only, typecheck
   between steps.
8. **Deduplicate the cross-app frontend** into packages/shared — same play
   as date-field. Ranked by the 2026-07-07 sweep (~4k duplicated lines):
   lib plumbing (prefs/api/supabase/upload, ~700), shell chrome
   (topbar/app-switcher/user-menu/sidebar, ~1,300), Invoices surface
   (thread+meet, ~610; actions.ts already byte-identical), ui kit
   (button/dialog/field/page, ~600), payments settings (3 files
   byte-identical, 352), sign-in button, no-access page, auth-callback
   core, upload lib. API-side dup worth a lib too: person find-or-create
   ×3, displayName join ×7, `one()` embed-normalize ×~80, activity-insert
   ×13 (`lib/activity.ts` — it IS the data wall), admin-role check ×2,
   slugField ×2.
8b. **ESLint flat config** — the four `next lint` scripts were zombies (no
   config existed, eslint 9 vs legacy scaffold) and were removed in
   0.13.109; add a real flat config + CI when wanted.
9a. **Curator-data write API** — an external app that wants to annotate a
   person (lead score, lifecycle stage) has no generic surface. A manifest can
   declare a `curator_data` mapping; nothing consumes it. Last of
   docs/brief-external-apps.md §4.
9b. **App-key liveness beyond `last_used_at`** — keys don't expire and nothing
   nags an admin to rotate one. `last_used_at` is shown; that's it.
9c. **Retrofit manifests onto first-party apps** — Meet/Thread/Flow/Pulse
   declare no `activity_types`, so they keep the permissive path in
   POST /activities. Declaring them would extend the typo guard to our own
   apps.
9. **Meet event types** — Group / One-off / Meeting poll stubs in
   new-menu.tsx.
10. **Fibre Pulse — business planner** — LIVE at pulse.thefibre.app,
    v0.13.0 after the 2026-07-07→09 marathon (CHANGELOG 0.13.112→136).
    Everything Sjoerd specced across two days is shipped: sheet-grid
    cashflow (BANK chain, Total column, virtual reserve growth,
    drag/⌥-drag, folds remembered, focus mode, toasts), invoice-style
    opportunity popup (offering rows × qty × price × repeat, VAT
    tariffs, transfer-to-invoice with numbering + ledger row + auto/
    manual email), two-way Flow pipeline sync, scopes with entry
    chooser, settings hub (Profile/Payments/Planner), projection
    history (cadence, 2y retention, first comparison view), Teams
    under People. Cashflow TABS with per-tab virtual banks + daily
    balance popup + focus date + row reorder shipped 0.15.0; **P4
    COMPLETE** 0.16.0 (settle-on-paid hook in recordPurchase,
    conservative auto-matching, receivable dedup). **NEXT**: P5 annual
    budget, P6 workbook importer (also sets the payroll-aligned
    anchor), payment-terms curator field (§2.5), comparison overlay,
    workspace-tab read/read-write grants.
10b. **Teams SPoT endpoint** (decided with Sjoerd 2026-07-07): the `team`
    table is already the single source of truth, but CRUD lives under
    /api/v1/meet/teams (historical). GET /api/v1/teams SHIPPED in
    0.13.113 (Pulse's involved-teams picker consumes it). Remaining:
    move create/update/member management to the platform route and thin
    Meet's routes to aliases. Same play as the payments/connections SPoTs.
11. **Platform**: Fibre Change app (home the change-facilitation fields),
    Article 15 export / retention admin / cross-app erasure, billing next
    phases, drop person_change_context table.

11. **Per-event enrolment** (Sjoerd 2026-07-10) — let people enrol in
    individual events within a thread, not only the whole thread.
    Per-thread toggle; one enrolment + a selected-events join table
    (thread_enrolment_event). Pricing model TBD with Sjoerd (free
    selection vs price-per-event vs access-tickets) — that decision
    sets the schema/checkout scope. Touches: schema, public enrol
    form, capacity (per-event?), API, /my, certificates, agenda UI.

Smaller / noted (from the 2026-07-05 debug pass): engagement status
'closed' collapses to draft in the editor (latent — nothing writes
'closed'); manually-added participants receive up to 72h of catch-up
messages (by design, at-most-once); date-picker min is date-only so the
server end-after-start check is the real guard for same-day times.

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
