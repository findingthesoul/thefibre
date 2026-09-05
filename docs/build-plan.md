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

_Last groomed 2026-09-01 (v0.21.0). Done items get removed, not ticked._

**Productisation — Sjoerd's two Stripe steps, then the metered phases.**
The plans are decided (docs/pricing-proposal.md), gated (0.19.24), surfaced
and chargeable (0.20.0 + 0.21.0 — docs/productisation-proposal.md is the
umbrella): /admin/plans matrix, Settings → Plan, public /pricing, tailored
pricing + comps + New workspace on /admin/workspaces, approval email, Stripe
Billing code (checkout/portal/webhook), /admin/economics, operating costs
seeded into Pulse. What remains:

1. ~~Stripe~~ **DONE 2026-09-03**: live key + all three webhook secrets on
   prod (meet/thread/billing — the July item, finally), sandbox twins on
   staging, live + test Products/Prices synced. ⚠️ Residual: the Stripe
   account showed "capabilities paused — required task overdue" in the
   sandbox view; if a real charge bounces, complete that verification task
   in the Stripe dashboard. First real end-to-end charge still unrehearsed —
   staging test-card rehearsal is armed and waiting.
1e. **Event template library (Thread)** — the plan dimension shipped 0.24.3
   (`thread_template_limit`: 1 / 5 / ∞ / ∞, editable on /admin/plans, shown
   on /pricing). What remains needs CONTENT + enforcement: Sjoerd designs
   the standard event templates; the platform grows a shared template
   library (today's thread templates are workspace-scoped duplicates); the
   new-thread flow offers library templates filtered by the plan's limit;
   the designer stays behind thread_custom_templates (Pro+).
1f3. **Members page redo (Sjoerd spec, 2026-09-05)**: list rows; click a
   name → settings popup; Add button → invite popup (house pattern, like
   Membership's members page). Same session: **profile convergence** —
   Fibre /settings/profile and Meet/Thread profile overlays must share
   ONE layout (platform identity block + app overlay block beneath,
   shared components); "does not feel trustworthy" when they differ.
1g. **Standard components, one implementation (Sjoerd, 2026-09-05:
   "every setting page, profile page, invoice screen — standard platform
   components; same look, same data, same behaviour everywhere")**:
   converge the per-app copies into `@thefibre/shared/ui` the way
   invoice-dialog and the settings hub already are. Known drift:
   full sweep 2026-09-05 in docs/component-inventory.md (~8,000
   duplicated lines, four extraction phases). Invoices area DONE
   (@thefibre/shared/ui/invoices, v0.33.0). Work the phases in order;
   NEVER add another copy. Companion UI rules standing: ordering is
   drag-and-drop, never a numeric sort field; dates use the shared
   DateField; selected states are the dark-pill treatment (v0.33.2).
2. **P4 — meters that bill** (proposal §4): ~~seat billing~~ (done 0.22.0 —
   quantity item on the subscription, prorated; invites past the allowance
   are charged, not refused). Remaining: email/storage overage lines on the
   monthly invoice, 80% warnings, the 13-month Free archive (warning email +
   export first). Seat follow-ups (Sjoerd, 2026-09-04):
   - **Member removal doesn't exist yet** — /members has GET/POST/PATCH but
     no DELETE, so a seat can't be closed. Build it, call
     `reconcileSeatBilling` after. DECIDED (Sjoerd, 2026-09-04): a removed
     seat stops billing FROM THE NEXT PERIOD, no mid-month credit — shrink
     the quantity with `proration_behavior: 'none'` ("only active and
     minimum"; the paid month runs out, the next invoice counts fewer).
     Additions stay prorated from the day they land.
   - **Confirm the cost when an invite adds a paid seat** ("if you go
     beyond accepting a seat, you have to accept the monthly extra pay"):
     invite past the allowance → the admin sees "this adds €8/month to your
     subscription" and confirms before the invite sends.
3. **P5 — website polish**: OG image (favicon shipped), screenshots,
   self-serve signup flip when the trial ends. Now under the naming brief
   (docs/naming-brief.md): Thread-first — NO per-app product pages (Meet /
   Sales / Flow are functions in Thread's service, never sibling products).
3a. **Invoiced manual add, everywhere (Sjoerd, 2026-09-05: "should be a
   shared too — adding people manually to a paid course should be an ask
   to send an invoice")**: Membership's Add-member intake (v0.40.0 —
   contact details + country + VAT, billing choice Invoice/Comped that
   writes a pending ledger row and emails the invoice, invite email) is
   the pattern. Port it to THREAD's manual enrolment: adding someone to
   a PAID thread asks "send an invoice?" and reuses the same machinery
   (recordPurchase pending + sendReceipt + payment link). Extract the
   billing-choice block + intake fields into @thefibre/shared/ui at this
   second use (the components-first rule).
3b. **Thread asks (Sjoerd, 2026-09-05)**: (a) WORKSPACE-scoped threads —
   New-thread offers Personal/Team only; workspace scope touches the
   public-URL contract (organiser/team slugs are published), needs a
   design call (workspace slug as public face?). (b) Per-EVENT images
   inside a thread (cover_url exists thread-wide; events in the timeline
   have none). (c) Adopt shared SearchSelect for timezone pickers +
   converge the three comboboxes (inventory).
4. **Naming brief follow-ups** (docs/naming-brief.md, decided 2026-09-01;
   display renames + Thread-first landing shipped v0.23.0):
   - Meet standalone vs event-type-inside-Thread — PRODUCT decision, Sjoerd.
   - Domain strategy (thread-branded public domain?) — decide with the
     staging build (docs/environments.md Phase 0), one DNS afternoon.
   - /terms + /privacy-policy still carry old names — bundle with the lawyer
     review (queue item 1c), don't edit unreviewed legal text piecemeal.
5. Decisions D1–D6 in docs/productisation-proposal.md §5 were built as
   recommended ("continue building, don't wait" — Sjoerd, 2026-09-01, while
   sporting); mark the section RESOLVED once he has read it.
6. **First-visit onboarding for Meet + Thread** (Sjoerd's refinement note,
   2026-09-03): role-aware "Set up" card on each dashboard (person steps +
   workspace-admin steps, all DERIVED from data, no stored wizard state) and
   a first-visit tour offer. Proposal with decisions D1–D3 in
   docs/onboarding-proposal.md — Sjoerd decides, then ~one session to build.
6b. **Multilingual platform** — docs/i18n-proposal.md; D1–D5 decided
   2026-09-05 (D4 overridden: FRENCH NOW). **P1 SHIPPED in v0.41.0**:
   @thefibre/shared ./i18n (six locales incl. fr), Thread catalog+emails
   ×6, thread.language split into page vs facilitation language,
   Membership public surfaces + lifecycle emails ×6, certificate emails
   ×6, membership_settings.locale + membership_member.locale. Same round:
   ONE shared embed integration (@thefibre/shared/embed-loader — both
   apps serve /embed.js from it; Membership embeds are now script+div).
   **NEXT: P2** — auth-templates ×6 (8 templates), platform-templates ×6,
   user_profile.locale + Settings field + fibre_locale in savePref's
   allow-list (~1–2 sessions). Admin UIs (P3) stay demand-driven; API
   errors (P4) never. MT burn-down: `grep -rn '// MT'` lists every
   machine-drafted string awaiting native review (NL: Sjoerd).
7. **Membership app (soul.com community)** — **v1 SHIPPED whole in
   v0.31.0** (2026-09-05, docs/membership-proposal.md; D1–D6 accepted):
   7th app, slug `membership` (display name may become **Hyve** — one
   branding.ts edit), schema+RLS, subscription checkout on the
   workspace's Stripe account, Connect webhook, renewal scheduler,
   Circle sync worker, all six admin surfaces, public join page,
   website embeds (/embed/tiers + /embed/button, me-* classes), Fibre
   web profile tab, workspace-level currency SPoT. Migrations applied
   staging+prod; API deployed both. FULLY DEPLOYED 2026-09-05: Vercel
   project + both domains live, sign-in verified, activated on the
   default workspace (prod+staging). The setup day also yielded v0.31.1
   (activation now really grants app_membership — RLS had no write
   policy) and scripts/verify-vercel-env.mjs (env-matrix audit/fix;
   first run caught a staging anon key in membership's PROD scope).
   Prod SSO_INTERNAL_SECRET rotated 2026-09-05.
   **Remaining — Sjoerd, not code:**
   - Stripe **Connect** webhook endpoint
     `https://thefibre-api.fly.dev/api/v1/membership/stripe-webhook`
     (checkout.session.completed, invoice.paid, invoice.payment_failed,
     customer.subscription.updated/deleted — MUST pick "listen on
     Connected accounts" AT CREATION, it can't be flipped later) →
     `fly secrets set STRIPE_MEMBERSHIP_WEBHOOK_SECRET`. Was mid-redo
     2026-09-05. Staging twin (test mode → thefibre-api-staging)
     recommended for the test-card rehearsal.
   - Create the soul.com workspace, activate Membership there, connect
     its Stripe account, add the Circle API token, create the first
     tier, rehearse a test join on membership.thefibre.tech.
   SHIPPED 2026-09-05 pm (the parallel-agents round): pricing rules
   §3.9 as the generalised LOGIC BUILDER (Settings → Pricing rules;
   country self-declared on join; card-mismatch admin email; country
   change reprices from next renewal); member self-serve portal (/my on
   the membership app + /api/v1/membership/portal, Stripe billing-portal
   handoff); per-event images in threads; extraction PHASE 1 (~1,640
   net lines into @thefibre/shared). Circle SSO spike:
   docs/spike-circle-sso.md + /api/v1/oauth endpoints — TEST ON STAGING
   before touching Circle's SSO screen. Workspace-threads design:
   docs/brief-workspace-threads.md (D1–D3 await Sjoerd).
   STILL QUEUED: à-la-carte product buying; i18n P1 (D1–D5 unread);
   extraction phases 2–4; SearchSelect adoption sweep.
   **Roadmap (proposal §3.6):** Memberful-style integrations catalogue —
   each tool = a new access_grant kind + worker (deploy, not migration);
   then org seats (§3.5), OAuth provider phase 2, plan-gating +
   /pricing surface when Membership gets a price.

_The Thread's public read API is a published contract as of v0.18.15
(docs/brief-thread-public-api.md): three CORS-open GET routes, rate limiting,
`thread.thefibre.app/developers`, and `scripts/verify-public-api.mjs` — run it
after touching anything under `/api/v1/thread/public/*`, the same way
verify-external-app.mjs guards the app surface. Enrolment and coupon
validation stay same-origin deliberately; that is a decision, not a gap._

_The dead-public-link family is closed. v0.18.1 gave the sidebar Help link a
destination in all five apps (`@thefibre/shared/ui/help` + a per-app `/help`);
v0.18.2 built the four public routes every transactional email footers to
(`/about`, `/support`, `/terms`, `/privacy-policy`, in `app/(public)/`) and
repointed The Thread's required privacy policy at the one that is actually a
privacy policy. **Both legal documents are unreviewed** — a lawyer reading
`/terms` and `/privacy-policy` is item 1c below._

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

0. **Wallet issuer credentials (Sjoerd, not code)** — check-in ships with
   QR-in-email working everywhere; the two wallet buttons appear only once
   the platform can sign passes. Apple: a Pass Type ID + certificate from the
   Apple Developer account → `fly secrets set APPLE_WALLET_CERT_PEM
   APPLE_WALLET_KEY_PEM APPLE_WALLET_WWDR_PEM APPLE_WALLET_PASS_TYPE_ID
   APPLE_WALLET_TEAM_ID` (optional `APPLE_WALLET_KEY_PASSPHRASE`). Google: a
   Google Wallet issuer account + service account →
   `GOOGLE_WALLET_ISSUER_ID GOOGLE_WALLET_SA_EMAIL GOOGLE_WALLET_SA_KEY_PEM`.
   Code path is live and tested (503 with a sentence until configured).

1. ~~Stripe secrets~~ — DONE 2026-09-03 (see the productisation block at the
   top: live key + meet/thread/billing webhooks on prod, sandbox on staging).
   The end-to-end paid test is the one remaining piece of this item.
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
   The Thread's app-key surface shipped in v0.18.0 (`routes/app-thread.ts`:
   publish a programme as a public page, edit it, read its registrations;
   `read:programs` / `write:programs` / `read:enrolments`, and deliberately no
   `write:enrolments`). So the whole arc — plan on Flow, publish on The Thread,
   read who came — is reachable from outside. What remains is content.

   **v0.18.7 removed the last code blocker.** The step copy now exists
   (`~/Projects/festivaloftrust.com/supabase/seed/fot_festival_graph.json` —
   nine steps, eight transitions, 39 default tasks, four `meta` fields each),
   and the flow builder can import it: *Design file* → paste/choose → Check →
   Import. `progression` and `system_key` travel in the file's `flow` block,
   so the SQL seed is no longer needed. Add
   `"flow": { "progression": "open", "system_key": "fot_festival" }` to the
   top of that JSON and import it as a workspace admin. Verify the file first
   with `pnpm --filter @thefibre/api exec tsx
   scripts/verify-flow-design-file.ts <file>`.

1c. **Legal review of /terms and /privacy-policy (Sjoerd, not code)** — both
   went live in v0.18.2 written from what the platform actually does, because
   the routes they replaced 404'd and enrolees were ticking "I accept the
   privacy policy" against nothing. They are accurate and conservative but
   have not been near a lawyer. A Dutch commercial/privacy lawyer should read
   both; the source files carry a ⚠️ comment saying so. When the text changes,
   bump `TERMS_UPDATED` / `POLICY_UPDATED` in the pages and
   `POLICIES[].version` in `apps/thread/lib/policies.ts` together.
   Also still open: `support@thefibre.app` and `hello@thefibre.app` are
   published on /support — confirm both actually deliver to a human.

2. ~~**Members UI role vocabulary**~~ — **done in v0.18.8.** The web Members
   page was already correct; the stale surface was **Meet → Internal team**,
   whose dropdown posted `'member'` — a value the DB has rejected since
   `20260704090000_role_tiers` — so changing a role there 500'd. Fixed, along
   with its admin gate, which excluded `super_admin`. Facilitator = per-thread
   badge, not a workspace role. Role vocabulary now has a SPoT:
   `apps/api/src/lib/workspace-roles.ts`.
3. **Org-share transfers** — thread_payout ledger rows exist ('pending');
   actual Stripe transfers of the workspace share are deferred.
4. **Role-gating beyond Invoices** — enrolments/contacts visibility per the
   tiers (proposal §3.8, deliberately out of v1).
5. ~~Certificate email i18n~~ **done in v0.41.0** (×6, thread's page
   language). Still open here: `customer_tax_ids` so the Stripe legal
   invoice carries the buyer's VAT number.
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
