# Changelog

All notable changes to The Fibre. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

The displayed version comes from the `VERSION` constant in `apps/web/lib/version.ts`. Bump it whenever a change ships.

## [Unreleased]

## [0.46.1] — 2026-09-06 — branded auth emails: text part agrees

### Fixed
- The plain-text half of a community-branded sign-in email still opened
  with "The Fibre" while the subject and HTML said the community —
  buildText now receives the sender name. (Cross-session review nit.)

## [0.46.0] — 2026-09-06 — Membership 0.10.0: orgs hold seats, meters bill, emails come from the community

Three parallel lanes + Sjoerd's live rehearsal findings, one release.

### Added
- **Org memberships with seats** (§3.5 v1): an organisation holds a
  membership (tier × seat allowance, invoice/comped billing — org as
  payer, price × seats); its people occupy seats that get the tier's
  access grants through the same journal and workers as individual
  members. Seat management on the member dialog ("4 of 10 seats",
  add/remove soft); org lapse fans out to every seat (bought products
  exempt, as ever).
- **P4 metering**: email + storage usage against plan allowances
  (progress bars on Settings → Plan), one 80%-warning email per meter
  per month to admins, overage invoice items on the Stripe subscription
  for closed months (prices per-plan on /admin/plans; empty = soft
  allowance, nothing bills), and the 13-month Free archive (12-month
  warning w/ export pointer → soft archive flag + reactivation, never
  deletion).
- **SearchSelect async search** (loadOptions): web's person + country
  comboboxes and Flow's add-contact dialog converge on the shared
  component (~250 lines retired). Pulse's create-flow combobox stays —
  it's not a list-with-filter.
- Phase-4 shared factories: root layout, no-access page, app landing,
  invoice-pdf route — ported ×5/×4/×4/×4.

### Fixed (from Sjoerd's live testing)
- **Invoices/receipts send AS THE WORKSPACE** (sender name, reply-to,
  logo) with **our own PDF attached** — the Stripe-hosted invoice page
  is gone from emails entirely. Platform-sent invoices still come from
  The Fibre, correctly.
- **Sign-in-code emails brand as the community** when the address
  belongs to exactly one workspace's member; platform users keep The
  Fibre.
- Membership → Invoices opens on the Workspace scope (membership sales
  have no personal seller — "Me" was always empty); non-admins fall
  back to Me.
- Access page: the "Tier-level grant (legacy)" button is gone (access
  is configured on products); remaining legacy rows are labeled for
  migration.
- Membership's landing page carried Pulse's copy wholesale; its invoice
  PDF route sent X-App-ID fibre-meet (invoices mislabeled as Meet's).
  Both caught by the phase-4 sweep.

### Notes
- Migrations 20260906100000 (org members) + 20260906110000 (usage
  meters + archive) applied to BOTH databases.
- Queued next: google_user grant kind (suspend Google Workspace account
  on lapse), optional add-on products on the join page.

## [0.45.6] — 2026-09-06 — CORS origins come from the registry

### Fixed
- The API's CORS allowlist is derived from the app registry (APP_IDS x
  appUrl) instead of a hand-written list — the hand-list pattern struck
  a third time when membership.thefibre.tech was missing from staging's
  CORS_ORIGINS and blocked the join page during the payment rehearsal
  (staging secret also fixed). An eighth app can no longer be forgotten.

### Rehearsed
- **First end-to-end membership payment on staging**: join page → Stripe
  Checkout (test card) on the connected account → webhook 200s → active
  member with subscription + correct renewal → EUR 2,000 paid ledger row
  → access grants journaled. Production webhook armed and waiting for
  the first real member.

## [0.45.5] — 2026-09-05 — skip-builds diffs the whole push

### Fixed
- vercel-ignore diffed only the LAST commit (HEAD^), but Vercel builds
  once per push — an app-touching commit buried in a multi-commit push
  would have been silently skipped. The diff base is now the branch's
  last deployed sha (VERCEL_GIT_PREVIOUS_SHA) when resolvable, HEAD^ as
  fallback, build-to-be-safe otherwise. (Caught in cross-session
  review.)

## [0.45.4] — 2026-09-05 — builds only what changed

### Changed
- **Vercel skips builds for unchanged apps** (Sjoerd: €150 of usage in
  five days — every release rebuilt all six apps on both branches, ~150
  builds on the busiest day). Each app's vercel.json now carries an
  `ignoreCommand` (scripts/vercel-ignore.mjs): build only when the app's
  own folder, packages/shared, or the lockfile changed — the release
  ritual's version-bump churn (nine package.json fields) deliberately
  does NOT trigger builds. All six vercel.json files made identical in
  shape while at it.

## [0.45.3] — 2026-09-05 — the sidebar gets its height back

### Fixed
- **Desktop sidebars collapsed to a sliver in all six apps** (Sjoerd,
  live: "scroll shows the buttons are there"): v0.45.0's responsive
  wrapper around the sidebar broke its height chain — the shell's aside
  positions absolutely against a parent whose height fell to zero, so
  the nav squeezed into an invisible scroll strip. The shell root now
  carries `h-full`.

## [0.45.2] — 2026-09-05 — interval row wraps in sheet form

### Fixed
- Membership's yearly/monthly interval row inside the billing choice
  wraps at phone width (dialogs render as bottom sheets below `sm`
  since v0.45.0 — the fixed row clipped there).

## [0.45.1] — 2026-09-05 — one billing choice

### Changed
- **BillingChoice extracted to @thefibre/shared/ui** (second-use rule):
  the Invoice-or-Comped block born in Membership's Add-member and
  copied into Thread's Add-participant is one component now — apps pass
  labels/descriptions and optional sub-options (Membership's
  yearly/monthly row); the box, radios and disabled-invoice handling
  live in shared.

## [0.45.0] — 2026-09-05 — the mobile round (all six apps · bottom menu)

### Added
- **The signed-in apps are mobile-ready** (Sjoerd: "make the interface of
  fibre and thread mobile ready — bottom menu"; shipped to ALL six since
  the shell is one shared component). Below `md` the sidebar hides and a
  bottom tab bar takes over: the first four nav items as tabs plus a
  "More" sheet carrying the full sectioned nav, Help and the version
  line. `@thefibre/shared/ui/bottom-nav` (createBottomNav factory, same
  Link/usePathname injection as the sidebar shell) is fed by the SAME
  per-app `SidebarNavSection[]` arrays — one nav, two chromes. Web's
  admin sections ride along via the extracted `buildSections()`.
- **Dialogs become bottom sheets on phones**: the shared Dialog slides to
  the bottom edge below `sm` (full width, rounded top, safe-area
  padding) — every app inherits it, zero call-site changes.

### Changed
- App shells use `h-dvh` (mobile URL-bar-correct) instead of `h-screen`;
  the bottom bar is a flex sibling of `<main>`, never overlaying content.
  Desktop is pixel-identical: the SidebarShell itself is untouched.


## [0.44.1] — 2026-09-05 — one email-locale resolver

### Changed
- The auth hook now resolves the recipient's language through
  `platformEmailLocale()` (platform-i18n.ts) instead of its own inline
  identity_profile lookup — one resolver for every platform-side email.


## [0.44.0] — 2026-09-05 — auth emails speak six languages (i18n P2 complete)

### Added
- **All 8 auth emails ×6** (sign-in code, signup confirm, invite, password
  reset, both email-change confirms, reauthentication) — the last open P2
  surface. OTP codes are seen by every non-Google invitee, so this is
  effectively public. Locale: `identity_profile.locale` where the recipient
  has one (resolved in the auth hook by email, non-fatal on miss), English
  otherwise. Copy tables are `Record<Locale, …>` — a missing locale fails
  typecheck; non-EN lines carry `// MT` for native review. With v0.43.0's
  platform emails + Settings language picker, **i18n P2 is complete**.

### Fixed
- `apps/web/lib/version.ts` was committed EMPTY in v0.43.1 (a write race
  between two parallel sessions sharing the working tree) while the layout
  still imports `VERSION` from it — the web app could not build from main.
  Restored.

## [0.43.2] — 2026-09-05 — rejoining members get their access back

### Fixed
- **Rejoin grant gap**: a member who lapsed (grants revoked) and later
  rejoined never re-synced — reconcileMemberAccess's inserts no-op on
  the unique key and the revoked rows stayed revoked. Entitled grants
  now re-arm to pending on an active/grace reconcile, mirroring the
  bought-product re-arm path.

## [0.43.1] — 2026-09-05 — the shell is one component

### Changed
- **Extraction phases 2–4, app ports** (~1,900 more duplicated lines
  retired): all six apps now render their sidebar via the shared
  SidebarShell (NAV stays per-app; web passes its wordmark image and
  admin sections in), the shared UserMenu (savePref / workspace switch /
  sign-out injected), the shared TopbarFrame, the shared page-chrome kit
  (page/danger-confirm/form-error shims), and @thefibre/shared/prefs.
  Five auth callbacks (meet, flow, pulse, thread, membership) are now
  the ONE shared factory — the superset of the drifted copies, so
  thread/flow/pulse gain the verifyOtp arrival path and the magic-link
  provider mapping they silently lacked. Web's callback keeps its own
  richer flow (access-pending handling) — noted in the inventory.
- Flow's user-menu Settings link now respects the environment
  (NEXT_PUBLIC_FIBRE_URL) — the old copy hardcoded production, the same
  env-leak class as v0.39.1's dashboard cards.

## [0.43.0] — 2026-09-05 — Membership 0.8.0 · Thread 3.34.0 · Meet 2.5.0: the backlog round

Five parallel lanes (strict file ownership, one combined typecheck), plus
extraction phases 2–4 shared-side on the main line. Sjoerd's standing
order: "Once done, don't wait for me. Build everything."

### Added
- **Thread: manual adds to paid threads ask to send an invoice** (the
  Membership v0.40 pattern, ported): Add participant dialog offers
  Invoice (default, ticket-priced server-side) or Comped. Invoice parks
  the enrolment at invited/payment-pending, records the pending purchase
  (adding admin as seller), emails the invoice with a Pay online button
  on the organiser's connected account; mark-paid / payment-link /
  webhook all converge on finalizePaidEnrolment, which lifts the
  enrolment and fires the confirmation emails.
- **Membership: à-la-carte product buying** — products gain "Can be
  bought on its own"; the public page shows an Also-available grid; a
  one-off Checkout on the connected account (flat price, plan-aware fee)
  lands in membership_product_purchase (person-keyed — no fake member
  rows), grants ride the existing access journal (and survive lapse —
  bought outright), purchases show on /my, receipts carry the product
  links. i18n ×6.
- **i18n P2** — user-level UI language: identity_profile.locale (the
  profile SPoT; the proposal's user_profile is a dead fallback), profile
  API + Settings → Profile picker + domain-wide thefibre.locale cookie;
  platform welcome email now renders in the recipient's locale ×6.
  App-chrome translation is P3.
- **Workspace seats: removal + cost confirm** — DELETE /members/:userId
  (soft delete; last-super-admin and last-admin guards; re-invite
  resurrects the row), seat SHRINK bills from the next period
  (proration none) while additions stay prorated; invites past the
  allowance 402 with the server-computed monthly cost and the UI
  confirms explicitly before re-submitting. POST/PATCH /members now
  require admin (was page-redirect-only).
- **SearchSelect sweep** — meet availability + all three public-booking
  timezone pickers, thread embed generator's thread picker; shared
  SearchSelect gains a `name` prop; the shared profile form's timezone
  is a SearchSelect now.
- **@thefibre/shared extraction phases 2–4 (shared side)** — ui/page
  (align + leading superset), ui/danger-confirm, ui/form-error, ui/toast,
  ./prefs, ui/user-menu (callbacks injected), ui/sidebar-shell (factory),
  ui/topbar, ./auth-callback (superset of six drifted copies). Pulse
  fully ported (~470 lines removed); remaining app ports queued.

### Notes
- Migrations: identity_profile.locale + membership_product_purchase
  (+ product.purchasable) — applied to BOTH databases.
- Known gap queued: rejoining members' revoked tier grants never re-arm
  (fixed for bought products only) — see build-plan.

## [0.42.0] — 2026-09-05 — the invoice email pays online

### Added
- **Pay button in the manual-add invoice email** (Sjoerd: "No payment
  link though… in the email"): adding a member with Invoice billing now
  creates a Stripe Checkout session on the workspace's connected account
  (plan-aware fee) and the invoice email carries Pay online next to the
  bank-transfer default. No connected account → the invoice still goes
  out, without the button.
- **Send payment link works for Membership invoices** (was Thread-only);
  the membership Connect webhook completes payment-mode sessions (marks
  the ledger row paid + mails the receipt), and Mark paid expires any
  live session — the Thread double-pay guard, same rule.
- `purchase.stripe_session_id` column (both DBs migrated) — one-off
  payment-link sessions live on the ledger row itself.

### Fixed
- **Manual-add invoices were invisible on the admin's Me scope** ("my
  invoice list is also empty"): the adding admin is now stamped as
  organiser on the purchase row; the Workspace scope always had it.

## [0.41.0] — 2026-09-05 — i18n P1 + one shared embed integration (Thread 3.34.0 · Membership 0.8.0)

### Added
- **French is a platform language.** `@thefibre/shared` gained the `./i18n`
  module — `LOCALES` (now en/nl/es/pt/de/**fr**), `Locale`, `LOCALE_LABELS`,
  `INTL_LOCALES`, `makeT` — the ONE definition the typed catalogs consume
  (i18n proposal D1–D5, decided 2026-09-05). Thread's catalog (74 keys) and
  all thread email tables carry FR; machine-drafted lines are marked `// MT`
  for native review.
- **The language split** (D1 sharpened): `thread.language` is now explicitly
  the PAGE language (buttons, system messages, emails — ours); the new
  free-text `facilitation_language` says what the course is RUN in (the
  organiser's, informational). Editor has both fields; public + embed thread
  pages show a "Facilitated in …" chip when it differs.
- **Membership speaks six languages on its money surfaces**: join page, tier
  grid, joined page, tier/button embeds and the /my portal render through a
  new typed catalog (43 keys ×6). Workspace default via Settings → Join
  page → "Public page language" (`membership_settings.locale`); `?lang=` /
  `data-lang` override; the joining member's active language is stamped on
  `membership_member.locale` (via Stripe metadata — the row is
  webhook-created) so scheduler emails know it forever.
- **Membership lifecycle emails ×6** (welcome, renewal reminder, payment
  failed, lapsed) — locale chain member → workspace default → en; dates and
  amounts format per locale. **Certificate emails ×6** too (closes the
  build-plan item), including locale-formatted dates on the certificate
  snapshot itself.
- **One embed integration for every app** (Sjoerd: "embeds should be
  @thefibre/shared"). The loader mechanism moved to
  `@thefibre/shared/embed-loader`; Thread's `/embed.js` is now served from
  it (behavior-identical port of the static file, which is deleted), and
  Membership gained its own `/embed.js` — integrators paste one script +
  `<div data-membership-embed="tiers|button" data-workspace="…">` with
  auto-sizing, `data-lang`, and `<style>`-inside-the-div custom CSS, exactly
  like Thread. The iframe-side halves (height reporter, CSS receiver) are
  shared components; both apps' copies are shims. Settings → Website embeds
  in Membership now emits the script+div snippets.

### Changed
- Public thread payloads (incl. `/public/…` routes) additively carry
  `facilitation_language`; membership public catalog carries `locale`;
  membership settings GET/PUT and the /my portal payload carry `locale`.
- Migration `20260905230000`: thread language CHECK widened for fr,
  `thread_thread.facilitation_language`, `membership_settings.locale`,
  `membership_member.locale` (applied to both DBs).

## [0.40.0] — 2026-09-05 — Membership 0.7.0: manual add is an invoiced intake

### Added
- **Add member is now a full intake** (Sjoerd: contact details "from
  moment one", "people receive an invoice right?"). The dialog takes
  phone, street/postal/city, country (SearchSelect, feeds the pricing
  rules) and a VAT number (stored as Membership's app-tagged
  person_billing row — the app justifies the field).
- **Billing choice on manual add**: Invoice (default when the tier is
  priced) creates a PENDING purchase-ledger row — tier price × pricing
  rules for the declared country — and emails the invoice in the house
  style; Mark paid / Send payment link work from the Invoices page like
  any other invoice. Comped stays free and quiet.
- **Invitation email** (checkbox, on by default): ensures the auth
  account exists and sends a workspace-branded welcome linking the
  member portal (/my).

### Changed
- `POST /persons` accepts phone/street/postal_code/city; `person` table
  gained a `phone` column (both DBs migrated).
- `PATCH /persons/:id/billing` now tags the curator row with the CALLING
  app instead of a hardcoded slug.
- chargeAccountForItem resolves membership invoices to the workspace's
  connected Stripe account, so Send payment link works for them.

## [0.39.1] — 2026-09-05 — staging links stay on staging

### Fixed
- **The Fibre dashboard's app cards linked to PRODUCTION from staging**
  (Sjoerd: "going to Meet lands me on a login page" — his .tech session
  doesn't exist on .app). The cards used the registry's raw production
  URLs instead of env-aware appUrl, AND the hardcoded map was missing
  Membership — now derived from APP_IDS so a new app can't be forgotten.
  Settings → Apps got the same treatment (the catalogue's base_url is
  the production address even in the staging DB; in-family links now go
  through appUrl, third-party apps keep their declared link).

## [0.39.0] — 2026-09-05 — Membership 0.6.0 · Thread 3.33.0: the parallel round

Six lanes, one afternoon — five agents + the main line, strict file
lanes, everything typechecked together before this commit.

### Added
- **Pricing rules as a LOGIC BUILDER** (§3.9 generalised, Sjoerd: "other
  people can build other logic"): declarative rows (when country/interval
  is/is-not-one-of → price %), first match wins, editor at Membership →
  Settings → Pricing rules with SearchSelect country chips. Join page:
  self-declared country + live adjusted preview; the server recomputes
  authoritatively at checkout and stamps country+pct into subscription
  metadata. Country stored on the member; admin change REPRICES FROM THE
  NEXT RENEWAL (new Price on the connected account, proration none).
  Card-country mismatch emails the admins (deduped) — never blocks.
- **Member self-serve portal**: membership.thefibre.app/my — every
  membership the signed-in email holds (any workspace), invoices, and
  Manage payment via a Stripe billing-portal session on the connected
  account; manual/comped members get the quiet "managed by the
  community" note. Auth callback learned member routes (/my,
  /oauth-continue) need a session, not a workspace account.
- **Per-event images in threads** (Thread 3.33.0): activity-family
  engagements carry image_url — edit dialog upload (cover pipeline),
  public agenda + embeds render it (te-agenda-image hook), duplication
  and templates keep it.
- **Circle SSO spike** (docs/spike-circle-sso.md): /api/v1/oauth
  {authorize, continue, token, me} shaped to Circle's WP-OAuth preset —
  membership-gated sign-in (active/grace only, re-checked live). NOT
  wired to Circle; staging test first, the doc says exactly how.
- **docs/brief-workspace-threads.md**: workspace-scoped threads design
  (recommendation: a workspace-kind organiser row, zero new public
  routes); D1–D3 await Sjoerd.

### Changed
- **Extraction phase 1 executed** (component-inventory): button, dialog,
  switch, list, fields, theme-script, app-switcher live ONCE in
  @thefibre/shared; six apps hold 4-line shims. ~1,640 net lines gone,
  zero page changes.

## [0.38.0] — 2026-09-05 — the trust items: Members list + one profile everywhere

### Changed
- **Fibre Members page rebuilt to the house pattern** (Sjoerd's spec):
  a list — Name / Email / Role / Relationship / Apps summary / Joined;
  clicking a row opens the settings dialog (role, relationship, per-app
  — / Member / Admin, saves-on-change with optimistic revert); Add
  member opens the invite dialog (which now grants app-ADMIN at invite
  time too). 309 inline-card lines → list + two dialogs.
- **Meet's profile page ported to the converged model** (Thread's, decided
  2026-09-01 but never applied to Meet): "Public page" = URL + location
  (Meet's own fields) + a read-only echo of name/photo/bio with "Edit
  your profile in The Fibre". PATCH /meet/me no longer accepts
  bio/photo_url (write-dead columns stop resurrecting); timezone stays
  Meet-owned — it anchors availability math.
- **Public booking pages read the platform profile first** (bio/photo/
  name) with meet_host as fallback — a bio edited in The Fibre now
  actually reaches the booking page.
- **Pulse's orphaned duplicate profile editor deleted** (its hub already
  linked to The Fibre; the page was a third editor waiting to drift).

## [0.37.1] — 2026-09-05 — Membership 0.5.1: access is VISIBLY under products

### Changed
- Sjoerd's close-of-day check was right: grants moved onto products in
  0.36.0 but the EXPERIENCE hadn't — Access still sat in the sidebar as
  its own page. Now: product cards show what they unlock, the sidebar
  entry is gone, the sync overview hangs off Products, help copy updated.
  Half-done is not done.

## [0.37.0] — 2026-09-05 — Membership 0.5.0: seats wait for a yes

### Added
- **Seat approvals**: fibre_seat grants park as awaiting_approval — an
  Approve-seat button on the member provisions synchronously. Policy
  lives on the built-in Fibre integration row (Integrations page):
  approve-or-auto, plus the standing consent "seats above the allowance
  may be billed" (without it a costing seat ALWAYS waits). Lapse cleans
  parked rows up like pending ones.
- **The Fibre hosts /settings/connections** (was a 404 from every hub —
  the canon linked a page only Thread had). Ported with return=fibre on
  the Google flow.

### Fixed
- **Meet profile save 500** ("row violates RLS for meet_root_slug"): the
  slug-registry sync triggers lacked SECURITY DEFINER, so user-session
  saves wrote the registry as authenticated — same disease as the
  v0.31.1 grant bug, found by Sjoerd on staging.

### Queued
- Fibre Members page redo to the house list+dialog pattern (Sjoerd's
  spec) and profile-page convergence (platform block + app overlay, one
  shared layout) — trust depends on it.

## [0.36.0] — 2026-09-05 — Membership 0.4.0: the product carries its access

### Changed
- **Access grants attach to PRODUCTS** (Sjoerd: "why is this not under
  products" — the product is the promise, so it carries the fulfillment):
  the product dialog gains an Access section (Circle space / Thread /
  Fibre seat with the billed-seat warning); a tier grants everything its
  included products carry; entitlement re-reconciles when a tier's
  product set or a product's access changes. The Access page becomes the
  overview (sync status + retry); tier-level grants stay valid as legacy.

### Added
- **Shared SearchSelect** (@thefibre/shared/ui/search-select) — the
  list-with-search-field component; first consumer is the thread picker
  (which also showed BLANK rows: a thread's title lives on its paired
  program — mapping fixed). Timezone pickers + the three hand-rolled
  comboboxes converge here (inventory item).

### Queued
- Pricing rules (§3.9) pinned as the NEXT Membership increment.
- Thread: workspace-scope threads (design call — public URL contract) and
  per-event images inside a thread — both Sjoerd asks, 2026-09-05.

## [0.35.0] — 2026-09-05 — Membership 0.3.0: the seat grant + currencies go platform-wide

### Added
- **Grant kind fibre_seat** (proposal §3.10 built): a tier can grant a
  workspace seat — the worker provisions user + workspace_member with the
  invite flow's exact seat policy (allowance → billable → refuse, error
  surfaced in the journal), reconciles seat billing both ways, revoke
  closes the seat from the next period. The grant dialog names the
  billed-seat cost before save. The built-in integration — same journal
  and cadence as Circle.
- **ECB reference rates** (/api/v1/currencies/rates, Frankfurter mirror,
  12h cache): indicative conversion display; charging never converts.

### Changed
- **Currencies is a platform-wide setting now** (Sjoerd: "currency should
  be a platform-wide setting… a module"): settings-canon key under
  Workspace, edited at The Fibre → Settings → Currencies (shared
  CurrencyEditor component with injected save), every app's hub links
  there; Membership's app-section copy removed. Per-product currency
  shift stays (built yesterday); ECB rates shown on the editor.

## [0.34.0] — 2026-09-05 — app access without workspace admin

### Added
- **Per-app access with roles on the Members page** (Fibre web): each
  activated app gets a — / Member / Admin select per person. The
  checkboxes existed but their allow-list was stale (Pulse and Membership
  missing — now the catalogue answers, the v0.14.0 rule) and every save
  silently downgraded app-admins to member (role now explicit).
- **App-level admin** (has_app_role): role 'admin' on the Membership app
  manages tiers/members/grants/settings WITHOUT workspace admin — the
  "soul office" case: grant the office people Membership (Admin), the
  rest stay out entirely; members themselves get the self-serve portal
  (queued).

### Notes
- Member portal (each member sees only their own membership) queued as
  its own build in the proposal §3.7 follow-up.

## [0.33.2] — 2026-09-05 — selected means selected

### Fixed
- **Selected state is unmistakable platform-wide**: the shared Invoices
  area's Me/Team/Workspace switch and app chips (one edit → Meet, Thread
  and Membership at once — the extraction paying for itself same-day),
  plus Membership's filter chips: active = dark pill, inverse text.
- **Four sign-in screens were broken in dark mode** (meet/flow/pulse/
  membership carried raw bg-white/neutral-* classes) — swapped to
  semantic tokens. Found by the component sweep.

### Added
- **docs/component-inventory.md** — the full six-app duplication sweep
  (~8,000 lines, mostly byte-identical), four extraction phases queued
  under build-plan 1g. docs/i18n-proposal.md (D1–D5 pending) landed the
  same evening.

## [0.33.1] — 2026-09-05 — Membership 0.2.3: thread links are picked, not typed

### Changed
- Thread-kind product links offer a picker of the workspace's actual
  threads (cross-app read on the user's own RLS identity; empty list
  falls back to the text field). Circle-space picking waits on a token +
  spaces proxy.
- Proposal §3.10: grant kind fibre_seat designed (tier ⇒ workspace seat;
  billed-seat caveat stated in the dialog) — build on Sjoerd's go.

## [0.33.0] — 2026-09-05 — components first

### Changed
- **THE Invoices area is a shared component**
  (@thefibre/shared/ui/invoices): Meet, Thread and Membership each
  collapsed their ~450-line invoices-client into a dozen-line wrapper
  injecting server actions. One implementation, one app-chip list (now
  incl. Pulse + Membership) everywhere. Pulse's variant carries ledger
  extras — converge when next touched.
- **Membership renews-on fields use the shared DateField** (Sjoerd's
  screenshot: native browser calendar vs Thread's — "thread is
  leading").
- **CLAUDE.md gains the binding Components-first rule**: check shared +
  the other apps before building any surface; new recurring surfaces are
  born in @thefibre/shared; never fork a per-app variant. Component
  inventory rescan + i18n architecture proposal both running as
  background agents.

## [0.32.1] — 2026-09-05 — Membership 0.2.1: the invisible link field

### Fixed
- **The links saga's true root cause**: the link-row kind select carried
  both w-full (shared INPUT class) and w-36 — w-full won, the select
  swallowed the row, and the ref + label fields rendered off-dialog.
  The user was asked to fill a field he could not see. Select now has
  its own width-free class. (Sjoerd's screenshot found it.)

## [0.32.0] — 2026-09-05 — Membership 0.2.0: one way of working

### Added
- **Invoices page** in Membership (ported byte-true from Meet's, ledger
  scope Me/Workspace, Membership chip in the app filter) + **Settings →
  Payments** (the Pulse form). Sidebar grows a Money section.
- **Drag-and-drop ordering** for tiers and products — the numeric Sort
  order fields are gone (Sjoerd: "order of things is always drag and
  drop, not with numbers"). New items join at the end.

### Changed
- **Settings is the canonical hub** (platformSettings + SettingsCards —
  "same four sections, same order, same words as every other app");
  Join page / Integrations / Website embeds / Currencies became
  subpages. **Circle.so is row one of an Integrations LIST**, the
  Memberful-style catalogue the roadmap names.
- Standing rule recorded (build-plan 1g): recurring surfaces are shared
  platform components — never another per-app copy.

## [0.31.4] — 2026-09-05 — Membership 0.1.3: Meet's warm palette

### Changed
- Membership wears Meet's interface palette (warm neutrals) instead of
  the cool slate it inherited from the Pulse scaffold (Sjoerd: "make the
  color setting the same as in meet"). One globals.css swap — the token
  system did its job.

## [0.31.3] — 2026-09-05 — Membership 0.1.2: link rows stop failing silently

### Fixed
- **Product links "didn't save"** — they were never sent: the dialog
  silently dropped any link row whose middle (ref) field was empty.
  Caught live: PATCH 200 with links []. An added row with an empty ref
  now blocks the save with a message naming the field, instead of
  discarding the user's intent.

## [0.31.2] — 2026-09-05 — Membership 0.1.1: add-member creates contacts

### Fixed
- **Add member dead-ended on people who weren't contacts yet** ("Pick a
  person first" with no way forward): the dialog now offers Create
  "<name>" as a new contact — inline name+email, POST /persons, then the
  membership. First caught adding Peter Test member on staging.

### Decided
- **Pricing rules designed** (proposal §3.9): purchasing-power pricing as
  a rule layer (kind 'region', config per workspace). Country
  self-declared at join; card-country mismatch warns the admin;
  migration is deliberate and reprices from the next renewal. Build is
  the next Membership increment.

### Known
- Product links reported as not saving — reproduction pending (dialog,
  schema and route all check out in isolation; needs a live request in
  the API log).

## [0.31.1] — 2026-09-05 — the activation grant was never landing

### Fixed
- **Activating an app never granted the activator app_membership** —
  app_membership deliberately has no authenticated write policy, so the
  workspace-apps route's userClient upsert was silently RLS-refused since
  the day it was written. Every earlier app's grants came from migrations
  and bootstraps; Membership was the first activation with no fallback
  (symptom: toggle says ACTIVE, app switcher never shows it, the app
  itself bounces to no-access). The grant now runs on adminClient — the
  one deliberate code path allowed to write that table; the table stays
  locked to self-serve writes on purpose. Sjoerd's staging grant
  backfilled by hand.

## [0.31.0] — 2026-09-05 — Membership 0.1.0: the 7th app, whole

*"I want to build. No question asked. A full integrated platform."*

The soul.com community case, built as a family app in one day
(docs/membership-proposal.md, D1–D6 all accepted 2026-09-04). Slug
`membership` — display name deliberately swappable in branding.ts alone
(Hyve is on the table).

### Added
- **Membership app** (membership.thefibre.app, port 3005, own VERSION
  0.1.0): tiered recurring community memberships on the workspace's
  connected Stripe account. Schema `membership_*` (tiers, products,
  tier↔product links, members, access grants, sync journal, settings,
  reminder dedup) with the house RLS shapes; app row via the open
  catalogue, `released_at` latch flipped in this release.
- **Money**: public join page (`/<workspace-slug>`) → subscription
  Checkout (price_data, plan fee as `application_fee_percent` — no fixed
  cap in subscription mode, documented); Connect webhook
  (`STRIPE_MEMBERSHIP_WEBHOOK_SECRET`, no fallback) where
  checkout.completed and the first invoice.paid converge idempotently;
  one ledger row per billing period keyed by Stripe invoice id; receipts
  with the workspace as seller. DIY VAT rails (inclusive split via
  recordPurchase), NOT Stripe Tax — proposal §3.3 amended.
- **Lifecycle machinery** on the 5-min tick: 14-day renewal reminders
  (deduped per cycle), grace/lapse sweep for manual members, and the
  **Circle.so access sync worker** draining the journal (invite on join,
  space/community removal on revoke, errors surfaced +
  `POST /membership/access/retry`). Activity events for every transition
  — Flow reacts, never decides (proposal §3.8).
- **Surfaces**: dashboard (actives, grace, annual value, renewing soon),
  members (filters, add/edit dialogs, access journal), tiers + products
  (catalogue with links), access grants, settings (join page copy, Circle
  token, embed-code generator). **Website embeds** (`/embed/tiers`,
  `/embed/button`) — iframe + height postMessage, stable `me-*` classes,
  the Thread pattern.
- **Fibre web**: emergent Membership profile tab on contacts (member row
  IS the curator data; `/persons/:id/apps` + `/persons/:id/membership`).
- **Workspace currency SPoT** (Sjoerd: "single point of truth on
  workspace level"): `workspace.default_currency` + `workspace.currencies`
  read/written through `/api/v1/workspace`; membership tier/product
  dialogs offer the workspace's list; Settings → Currencies card writes
  the platform endpoint. Organiser-level override deliberately deferred
  (follows the payment-accounts chain when needed).

### Decided
- Integrations roadmap: a growing Memberful-style catalogue — each tool =
  a new `access_grant.kind` + worker (deploy, not migration); Circle is
  worker #1 and the template.
- Plan-gating for Membership deliberately deferred — any workspace can
  activate it while soul.com dogfoods; gate when pricing is decided.

### Fixed / guarded
- **Staging app domains misrouted** (Sjoerd: "Meet and The Thread does not
  open in my .tech account"): meet/thread/flow/pulse.thefibre.tech all serve
  the WEB app — every CNAME points at the web project's Vercel DNS target.
  Fix is dashboard work (per-project domain + CNAME; steps in
  docs/environments.md gotchas). `scripts/smoke-staging.mjs` now asserts
  each app subdomain serves its own app by `<title>`, so the promote gate
  catches domain misroutes from now on.

### Proposed
- **First-visit onboarding for Meet + Thread** — docs/onboarding-proposal.md:
  role-aware derived "Set up" card (person + workspace-admin steps) and a
  first-visit tour offer. Decisions D1–D3 with Sjoerd; queued as build-plan
  item 6.

## [0.30.0] — 2026-09-04 — VAT on sales: workspace, then organiser

*"VAT is workspace and then organiser. Workspace is organiser too."*

### Added
- **Seller-side VAT on app sales** (`lib/seller-vat.ts`): the workspace's
  invoice details carry the default VAT config; a person selling under
  their own name overrides with their profile's. Team and workspace sales
  follow the workspace — the workspace IS an organiser.
- **Settings → Payments (Thread + Meet)** grew "VAT on sales": a
  VAT-registered toggle + rate, at both My-account and Workspace level,
  stored in the payments SPoT (invoice_details jsonb — no migration).
- **Ticket prices stay what buyers see**: rates are INCLUSIVE. At
  `recordPurchase` every app sale gets the split stamped into billing
  (subtotal / tax / "incl. VAT 21%"), so the invoice popup, page, PDF and
  receipt email all show it — one stamping point covers Thread card +
  invoice-method enrolments and Meet bookings. Platform (fibre-platform)
  rows keep their Stripe-computed tax untouched.
- recordPurchase now merges billing over the existing row's on updates —
  a webhook confirm can no longer clobber the enrol form's buyer details.

## [0.29.0] — 2026-09-04 — one invoice viewer for the whole family

*"One ref of truth for the whole app (fibre, meet, thread)"* — now actually
true everywhere ("make it so").

### Changed
- **Thread, Meet and Pulse adopt the shared invoice dialog**
  (`@thefibre/shared/ui/invoice-dialog`) for the purchase detail view —
  the same document popup as Settings → Plan: share link, Download PDF
  (each app grew its own `/invoices/:id/pdf` session-carrying pass-through),
  Email to… (any address), subtotal/VAT/total when the row carries tax.
- The shared dialog grew an `actions` slot (app-side management buttons —
  Reimburse, Mark paid incl. Pulse's account+date variant, Send payment
  link, Resend invoice — stay each app's own) and a `children` slot (fee
  split, refund note); `seller` became optional (hidden when an app cannot
  name it yet — the organiser-VAT work will fill it).
- Three near-identical 100-line detail dialogs deleted.

## [0.28.5] — 2026-09-04

### Fixed
- **Invoice labels name the plan on the invoice, not the workspace's plan
  of the moment**: invoice.paid can race checkout.completed, which labeled
  the first Starter invoice "The Fibre — Free". The plan now resolves from
  the invoice's own line prices (reverse order, so a proration names the
  plan being bought); workspace plan stays as fallback.
- Also in this release: two staging-rebuild touches of @thefibre/shared
  (no behaviour change) from the env-var repair.

## [0.28.4] — 2026-09-04 — SVG logos, sanitised

### Added
- **SVG upload** ("Logo upload: no SVG?" — logos are SVGs): accepted on the
  shared upload route, but every SVG passes through DOMPurify's SVG profile
  first (scripts, event handlers, javascript: URIs, foreignObject stripped
  by an audited sanitizer — the raw-SVG stored-XSS reason for the old block
  stays answered). An SVG that sanitises to nothing is refused with advice.

### Fixed
- Bucket mime allowlist aligned with the route on BOTH projects — it
  omitted gif/avif (route accepted them, storage then 500'd) and svg.

## [0.28.3] — 2026-09-04

### Fixed
- **Share link shares OUR invoice page**, not Stripe's hosted copy — the
  dialog preferred `stripe_invoice_url`; now the app's own invoice page
  leads and Stripe is the fallback only when no page href was wired.

## [0.28.2] — 2026-09-04 — the billing country moves in-app

### Fixed
- **Checkout 500**: Stripe has removed `dynamic_tax_rates` from current API
  versions ("the feature you are trying to use is deprecated") — the
  address-driven rate pick chosen in 0.28.0 cannot exist anymore. The rate
  must be known BEFORE the session: the upgrade panel now carries a
  billing-country select (defaults NL), and `/billing/checkout` pins that
  country's rate as the subscription's default tax rate from birth — the
  first invoice is taxed. Non-EU country → out of scope, no rate.
- **Typed-address reconciliation** (`reconcileSubscriptionTax`): after
  checkout the webhook compares the address the buyer actually typed at
  Stripe with the pinned rate; a mismatch corrects every future invoice and
  logs loudly so the first one can be checked. The reverse-charge pass runs
  inside the same call.

## [0.28.1] — 2026-09-04 — legacy subscriptions accept our tax rates

### Fixed
- **Switch 500 on subscriptions born under Stripe Tax**: a subscription
  created via checkout while `automatic_tax` was still in the charge path
  refuses manual rates ("Manual tax rates cannot be used when
  automatic_tax[enabled]=true"). The switch update now disables automatic
  tax in the same call that pins the country rate — a no-op on post-0.28
  subscriptions.
- **The release record itself**: v0.24.2 through v0.28.0 shipped as commits
  without CHANGELOG entries or version bumps (the sidebar sat on 0.24.1 for
  ten releases). Backfilled below from the commit record; versions
  re-synced at 0.28.1.

## [0.28.0] — 2026-09-04 — the Fibre collects its own VAT

*"We can do tax collections ourselves, no?"* Go given. Stripe Tax (and its
0.5% per transaction) is out of the money path; the /admin/vat table now
collects directly.

### Added
- **Our rates become Stripe tax_rate objects** (`lib/vat-stripe.ts`):
  mirrored at boot, on every /admin/vat save, and when the weekly sensor
  applies a law change. Stripe rates are immutable — a change archives the
  old object and creates a new one; removed countries archive.
- **Checkout charges from OUR table**: `dynamic_tax_rates` on every line —
  Stripe picks the country's rate from the billing address the customer
  types, applying a number it did not choose.
- **Switches invoice tax correctly**: the customer's country rate rides on
  the same subscription update that generates the proration invoice.
- **Reverse charge, validated by the EU itself** (`lib/vies.ts`): after
  checkout, an EU non-NL business customer's VAT number is checked against
  VIES; valid → `tax_exempt='reverse'` on the customer. VIES down → soft
  fail, never blocking a checkout.
- Ledger capture, dialog, page, PDF and receipt email needed no changes —
  manual rates populate the same tax fields.

Stripe Tax stays activated ONLY as the sensor behind the weekly rate probe,
never in the charge path.

## [0.27.1] — 2026-09-04 — VAT auto-sync, the Fibre's own invoice PDF

### Added
- **The VAT table syncs itself** (`lib/vat-sync.ts`): weekly probe of
  Stripe's tax engine (a €100 test calculation per EU country), drift
  applied to the /admin/vat table, operator email on every change, log in
  `platform_setting.vat_sync_log`. Piggybacks on the scheduler interval.
- **Download PDF downloads OUR PDF** ("Download PDF opens Stripe" — no):
  pdfkit A4 invoice (`lib/invoice-pdf.ts`) served at
  `GET /purchases/:id/pdf`, reached from the web app via a
  session-carrying pass-through route.
- Portal button shrinks to "Payment method" — its last remaining duty.

## [0.27.0] — 2026-09-04 — VAT: computed on card rails, owned by the Fibre

### Added
- **The VAT module** ("build a VAT module… so we can update it regularly"):
  EU-27 rate table stored as platform data (`lib/vat.ts`,
  `platform_setting.vat_rates`), editable at /admin/vat, `computeVat()`
  (home rate / EU reverse charge / destination rate / out of scope) for
  non-Stripe rails. Migration `20260904120000_vat_rates`.
- Stripe Tax on checkout (with graceful fallback until activated) — later
  replaced by DIY collection in 0.28.0.
- Tax breakdown (subtotal/tax_cents/tax_label) captured into
  `purchase.billing` by the webhook and rendered on the invoice dialog,
  the invoice page, the PDF and the receipt email.

## [0.26.1] — 2026-09-04 — the invoice popup

### Added
- **THE canonical invoice viewer** ("one ref of truth for the whole app —
  fibre, meet, thread"): `@thefibre/shared/ui/invoice-dialog`, self-contained
  popup with Share link / Download PDF / Email to… / Print, adopted on
  Settings → Plan. Family-wide adoption queued (build-plan 1f).
- Webhook captures the Stripe-hosted PDF url; `POST
  /purchases/:id/resend-invoice` takes a `to` override and uses the
  platform seller for fibre-platform rows.

### Fixed
- Follow-up commit: ENTITY import + an overreaching `recipient` rename that
  broke purchases.ts (and both deploys). Build gating tightened.

## [0.26.0] — 2026-09-04 — the invoice lives in the Fibre

### Added
- **Webhook writes the invoice onto the ledger**: number, buyer
  company/address/tax id, service period, subtotal — the Fibre document is
  complete without asking Stripe anything.
- **In-Fibre invoice page** (`/settings/plan/invoices/:id`), print-ready
  (`?print=1` auto-opens the dialog).
- **Receipt email from the platform**: shared receipt machinery with
  Solidarity Lab as seller block. Stripe's hosted copy demoted to a
  footnote link.

## [0.25.3] — 2026-09-03

### Fixed
- **SCA fallback on switches**: when the proration charge needs
  confirmation, the open invoice's hosted page is returned and the browser
  redirected there instead of failing silently.

## [0.25.2] — 2026-09-03

### Fixed
- Plan buttons stay visible during a pending cancellation — picking a plan
  un-cancels and switches in one act (was: cancelled workspaces had no way
  back to a paid plan).

## [0.25.1] — 2026-09-03

### Added
- Billing-interval toggle on the plan controls ("1 subscription with a
  toggle for per year"): Monthly / Yearly — 2 months free, switch invoiced
  like any other plan change.

### Fixed
- Follow-up commit: leftover `options` reference in the interval-toggle
  panel broke the web build.

## [0.25.0] — 2026-09-03 — in-app plan switching

*"Why can't someone upgrade or downgrade themselves?"* Now they can,
without leaving the Fibre.

### Added
- **`POST /billing/switch`**: updates the Stripe subscription directly
  (base item swapped, seat riders re-created by the reconciler),
  `proration_behavior: 'always_invoice'` so every change produces a real
  invoice in our ledger immediately.
- **Cancel / Resume** endpoints + confirm dialogs on Settings → Plan; the
  full control set lives in the app, Stripe demoted to rails.

## [0.24.8] — 2026-09-03

### Added
- Amber banner with the exact end date for cancelled subscriptions ("It
  would be nice that the end date would be shown").

## [0.24.7] — 2026-09-03 — the seller side of the ledger

### Added
- **/admin/invoices**: cross-workspace invoice list for the platform
  operator, read from the purchase ledger. Doctrine locked in: Stripe is
  rails (payment + tax + legal PDF); the Fibre ledger is the system of
  record. A future PSP is a `method` value + a webhook calling
  `recordPurchase()`.

## [0.24.6] — 2026-09-03

### Added
- Fibre invoices on Settings → Plan ("Where can I see my invoice as a
  workspace?") — the workspace's own purchases from the ledger.

## [0.24.5] — 2026-09-03

### Fixed
- Checkout 400 with an existing customer: `tax_id_collection` requires
  `customer_update: {name: 'auto', address: 'auto'}`.

## [0.24.4] — 2026-09-03

### Fixed
- **New workspaces start `active` on Free, not comped**: the auto-create
  trigger's 'comped' default hid all self-serve billing from every new
  customer ("Still no way to upgrade for me as client"). Migration
  `20260903160000`; deliberate comps untouched.

## [0.24.3] — 2026-09-03

### Added
- **Event templates join the price list** (1 / 5 / unlimited / unlimited):
  `thread_template_limit` as a numeric plan dimension — seeded,
  matrix-editable, public on /pricing, exposed on the Plan type. Library +
  enforcement queued (1e) pending template designs.

## [0.24.2] — 2026-09-03

### Changed
- The portal button says what it does (change plan, cancel) — superseded in
  0.27.1 when the portal shrank to "Payment method".

## [0.24.1] — 2026-09-03 — the welcome parade is two apps

*"Pulse can stay out of the loop for now, as does flow."* Auto-activation now
covers Meet + Thread only. Pro still makes Flow + Pulse AVAILABLE in
Settings → Apps — switching them on stays a human act, fitting the naming
brief: backstage tools, not sibling products.

## [0.24.0] — 2026-09-03 — sign up like a customer, not an applicant

Sjoerd walked the funnel as a customer and called it: *"Very nonlogical.
Sign up: choose your plan, fill in your payment info, apps are activated…
other apps are not visible. By default approve (make a toggle)."* This is
that funnel.

### Added
- **Auto-approve signups (default ON)** — a signup approves itself:
  workspace created, plan apps switched on, welcome email sent, and the form
  says "Your workspace is ready — sign in now" instead of "we'll be in
  touch". `platform_setting` table (migration `20260903120000`) carries the
  switch; a **toggle on /admin/access-requests** restores the velvet rope.
  One shared implementation (`lib/signup-approval.ts`) serves both the auto
  path and the admin's Approve button.
- **The plan assembles the product** (`lib/plan-apps.ts`): Meet + Thread
  activate on every plan at approval; Pro's checkout webhook auto-activates
  Flow + Pulse (and seeds the Pulse pipeline flow). Runs again at every
  sign-in to fill app memberships for new users. Idempotent, respects
  deliberate deactivations, never blocks the caller.
- **Apps outside the plan are invisible** on Settings → Apps (active ones
  stay visible so a downgrade never hides a switch). Fails open like the
  gates.
- **Paid pick lands on payment**: a first sign-in whose signup chose a paid
  package is routed to Settings → Plan (welcome banner naming the package)
  instead of an empty dashboard.
- **Self-serve downgrade**: sync-stripe-plans.mjs now provisions a Stripe
  billing-portal configuration (switch Starter↔Pro monthly/yearly, cancel at
  period end; id stored per-database in platform_setting and passed
  explicitly). A subscription that ends drops the workspace to **Free** —
  data kept, active apps stay active; gates bind on the next activation,
  mirroring the seat rule.
- **The public site follows the door**: `signup_mode` on
  `GET /api/v1/public/plans`; landing + pricing + the form swap chip, copy
  and CTAs ("Start free" / "Get started") when self-serve is on.

### Ops (same day)
Staging got real email (Resend key, "(staging)" sender) and a pinned machine
(the email hook's 5s ceiling + the in-process scheduler both need a warm
machine); Stripe live + sandbox fully wired incl. both portal configs.

## [0.23.1] — 2026-09-02 — staging prep, and links that tell the truth

Phase 1 of docs/environments.md, done before the clicking starts.

### Added
- `scripts/db-push-staging.sh` / `db-push-prod.sh` — the staging wrapper
  links, pushes, and ALWAYS restores the prod link (trap on exit), so a bare
  `supabase db push` afterwards still means prod. Staging ref goes in
  `supabase/.staging-ref`.
- `scripts/smoke-staging.mjs` — health, plan catalogue, 401 enforcement,
  landing/pricing/sign-in render; gates the promote.

### Changed
- Meet's booking-link host displays (slug prefixes, team + meeting-type
  lists, profile "Public URL") and Pulse's invite hint now derive from
  `appUrl(...)` (`apps/meet/lib/public-host.ts`) instead of a hardcoded
  `meet.thefibre.app` — staging will show staging URLs.

### Domain news
Sjoerd owns **thethread.app** (currently an earlier standalone Thread).
Architecture agreed in principle: thethread.app becomes the public face
(marketing + public thread pages) — customers meet Thread; the signed-in
operator apps stay on *.thefibre.app (shared SSO cookie apex, Fibre
backstage). Cutover is its own slice pending one answer: what still lives on
the old app. Staging stays on a neutral apex regardless.

## [0.23.0] — 2026-09-01 — Thread stands alone

The naming brief arrived and was decided in one message (saved verbatim:
docs/naming-brief.md): **Fibre is the invisible foundation. Thread is the
flagship, the product people meet and feel. Meet, Sales and Flow are
functional tools that serve Thread, not siblings competing with it.** The
test that decided it: a word only earns textile language if a customer would
say it out loud.

### Changed
- **branding.ts, the single source, renamed**: Thread ("The learning journey
  a person walks."), Meet ("How meetings happen inside a Thread."), Flow,
  Pulse, Sales, Learn. The Fibre keeps its name, backstage. **Slugs, ids and
  URLs did not move** — `the-thread`, `fibre-meet` etc. are FKs and published
  API contract; the plan-ids precedent (`org` displays as "Enterprise")
  applied family-wide.
- **The landing page is Thread-first** (Brief B): Thread as the name and the
  journey as the story; four *functions* it carries instead of the
  one-platform-four-apps sibling grid; Fibre reduced to one "under the hood"
  paragraph. Tone per the brief: accompaniers who walk alongside.
- **~55 files of display copy swept across all five apps + shared + API**
  (four parallel agents, strict lanes): dialog titles, settings labels,
  invoice filter chips, no-access pages, help pages, metadata titles,
  powered-by footers ("Thread · The Fibre"), wallet passes
  (Apple organizationName / Google issuerName), Stripe invoice descriptions
  and footers, host-approval email, 402 plan-gate labels, error messages,
  Flow/Pulse cross-references ("authored in Flow", "Deactivate Pulse").
- The 5-language Thread catalog needed **nothing** — the brand was never in
  translated strings; every translated "thread" is the common noun for a
  journey, which stays by design.
- Stripe SDK `appInfo` renamed 'Fibre Meet' → 'The Fibre' (it is the
  platform-wide client; dashboard telemetry only).

### Deliberately not changed
- `/terms` + `/privacy-policy` (one "Fibre Meet" sentence remains) — legal
  text pending lawyer review; renamed with that review, not piecemeal.
- Google Wallet classId `…the_thread_ticket` — a registered identifier at
  Google; renaming orphans the class.
- Code comments naming the old brands — history, not copy.
- Reserved/rejected names (Tapestry, Stitch, Knot, Loom, Warp, Shuttle,
  Spindle) appear nowhere in product code; kept that way.

### Parked, per the brief + tomorrow's session
Meet standalone vs an event type inside Thread (product decision); the
domain strategy (with the staging build, docs/environments.md Phase 0);
Thread-as-platform (do not build for it yet).

## [0.22.3] — 2026-09-01 — the operator sees the costs, and the tools get their own tab

Two of Sjoerd's observations, minutes apart: "on the economics page I don't
see the costs" and "I want to see a separate cashflow for the tools."

### Added
- **/admin/economics shows operating costs** — the Pulse budget lines with
  category "Platform infrastructure", cadence-normalised to €/month, with a
  total and a **Net/month** headline (MRR − costs). Read under the operator's
  own authority, scoped to workspaces the requesting super admin is a member
  of — not a peek into any tenant's books. Editing stays in Pulse → Budget;
  this page only reads.
- **"The Fibre" cashflow tab in Pulse** — tabs are separate cashflows keyed
  on teams, so the tools now live on a team of their own:
  seed-operating-costs.mjs v2 creates team "The Fibre" (slug the-fibre) in
  Solidarity Lab, registers it as a Pulse involved team, and stamps the six
  cost lines with it. Run tonight: the workspace cashflow is clean of tooling
  again, and Pulse → Cashflow has a The Fibre tab with its own virtual bank
  and projection.
- **docs/environments.md** — the staging plan for tomorrow, step by step:
  two decisions (separate apex domain for cookie isolation; free-tier
  Supabase), six lettered blocks of Sjoerd clicks (~45 min), first-light
  checklist ending in a test-card Pro purchase, the promote rhythm, and the
  gotcha list. `fly.staging.toml` checked in (scale-to-zero — staging skips
  the email hook, so cold starts are harmless there).

## [0.22.2] — 2026-09-01 — the form asks which product

*"I have registered — but never I had to make the choice for a product."*
Sjoerd, testing his own funnel. /pricing said €19 and €49 and then the
request form ignored the answer.

### Added
- **Package choice on /request-access** — pill selector (Free / Starter /
  Pro / Enterprise / "Not sure yet"), rendered from the same public catalogue
  as /pricing so names and prices cannot drift. Arriving from a /pricing card
  preselects it (`?plan=starter`); `signup_request.desired_plan` carries it
  (migration `20260901230000`, FK to billing_plan; unknown ids degrade to
  null, never fail a signup).
- **/admin/access-requests shows it** — a "wants Pro" chip beside the name,
  so approval decisions see intent.
- **The welcome email closes the loop** — a paid pick adds "your workspace
  starts on Free; activate Pro under Settings → Plan once you're in."
  Deliberate: approval still provisions Free — a paid plan begins at
  checkout, after sign-in, when there is somebody to charge.
- The form says so too: "your workspace starts free either way, and nothing
  is charged until you choose to upgrade inside."

## [0.22.1] — 2026-09-01 — an hour after signing in, everything broke

Contacts: "Couldn't load contacts: API 401". Settings → Apps: the same. Admin →
Apps and Access requests: Next's white "Application error" page. All at once,
to somebody who was plainly signed in — his name and both his workspaces were
right there in the menu.

**Not an authentication failure. A token-refresh failure**, and it has been
latent since the beginning: it needs a tab open for an hour to appear.

A Supabase access token lasts an hour. The browser refreshes it in the
background — but a **server component cannot**, because it may read cookies and
not write them. `lib/supabase/server.ts` has always swallowed that write with a
comment saying as much. So once the token aged out, every server-rendered page
asked for a session, got null, and threw its own 401 before reaching the API.
Pages that caught it printed "API 401"; pages that did not crashed.

### Fixed
- **`middleware.ts` in all five apps.** Middleware is the one place in Next
  that can read the request's cookies *and* write cookies onto the response, so
  the refresh belongs there: `getUser()` performs it as a side effect when the
  token is stale, and the new cookies go back with the response.

  Both halves of `setAll` matter — the request copy so the rest of that pass
  sees the new token, the response copy so the browser keeps it.

  Public pages are untouched: a visitor with no session has nothing to refresh.

_Read the API log first, says CLAUDE.md, and it was right here too: the 401 was
never in the API's logs, because no request ever reached it._

## [0.22.0] — 2026-09-01 — a seat costs eight euros, and now it says so on the bill

*"We should wire it."* Extra-seat billing, end to end
(migration `20260901210000`, `lib/seat-billing.ts`).

### Added
- **Seat Prices per plan** — `billing_plan.stripe_price_id_seat_{month,year}`,
  created by `sync-stripe-plans.mjs` on the plan's Product. Yearly seats
  follow the same two-months-free rule as the base (€80/seat/yr), so "yearly
  is two months free" is true of the whole invoice.
- **One reconciler** (`reconcileSeatBilling`) — the subscription carries an
  extra-seat item with quantity = seats over the allowance, prorated by
  Stripe. Compares before touching, so the webhook echo of its own update is
  a no-op. Fails SOFT: a Stripe hiccup logs and lets the invite through; the
  quantity converges on the next event.
- **Checkout counts existing seats** against the plan being bought — a
  14-seat workspace buying Pro is billed €49 + 9×€8 from day one (503 with a
  clear message if seat prices aren't synced yet).
- **An invite past the allowance is now charged, not refused** — on a
  workspace with a live subscription, the 6th Pro seat adds a prorated €8
  item. The 402 remains exactly where there is nothing to charge: Free,
  comped, unpaid.
- **Portal plan switches re-count** — the billing webhook resolves the plan
  from the price actually on the subscription (never items[0], which may be
  the seat item) and re-reconciles against the new allowance.
- Settings → Plan shows the arithmetic: "9 extra × €8 = €72/month, on your
  subscription". docs/pricing-worked-examples.md updated (soul.com yearly:
  Starter €1,150 / Pro €1,210).

Still standing from 0.21.0: nothing charges until Sjoerd sets the Stripe key
+ webhook secrets and runs the sync script.

## [0.21.1] — 2026-09-01 — a face for the tab

- **Favicon at last** (`apps/web/app/icon.svg`) — the yellow sidebar tile
  with the lowercase letters, now in the browser tab. `public/` had exactly
  one file since day one; shared links stop looking bare. (OG image is P5.)
- Docs groomed to match the two productisation releases: build-plan Open
  queue rewritten (Sjoerd's Stripe steps are item 1 — no STRIPE_SECRET_KEY
  exists on Fly at all), CLAUDE.md "Where we left off", proposal §4/§5
  status lines, platform-billing-setup.md updated for the package model +
  sync script.

## [0.21.0] — 2026-09-01 — the subscription itself, and the operator's ledger

Productisation slices 2 + 3 (docs/productisation-proposal.md). Slice 1 gave
the plans their surfaces; this makes them chargeable, and gives the operator
somewhere to look.

### Added
- **Stripe Billing** (`routes/billing.ts`) — the workspace's own Fibre
  subscription, on the PLATFORM Stripe account, fully separate from Connect:
  - `POST /api/v1/billing/checkout` — subscription-mode Checkout (admin+).
    Tailored prices ride as inline `price_data` on the plan's Product; VAT id
    collection + promotion codes on. Comped workspaces are refused politely;
    a live subscription is redirected to the portal.
  - `POST /api/v1/billing/portal` — Stripe's hosted portal (card, plan
    switches, cancellation, invoice history).
  - `POST /api/v1/billing/stripe-webhook` — its OWN secret
    (`STRIPE_BILLING_WEBHOOK_SECRET`, no fallback). Drives
    `workspace_subscription`; **every paid subscription invoice lands in the
    purchase ledger under `fibre-platform`**, so a workspace sees its Fibre
    invoices on the same Invoices page as everything else, and Pulse's settle
    loop can see them. A canceled subscription moves status, never features —
    what a lapsed plan may DO is a later, deliberate decision.
  - `scripts/sync-stripe-plans.mjs` — one Product per plan, monthly + yearly
    Prices, ids written onto `billing_plan`
    (migration `20260901200000`). Checkout 503s until run.
  - Settings → Plan grew the money buttons: upgrade (monthly/yearly per
    package) when Stripe is configured, "Manage billing" once subscribed,
    renews/ends line from the live subscription.
- **/admin/economics** — the operator's view from platform tables only: MRR /
  ARR, by-plan distribution, paying workspaces (tailored + past_due flagged),
  the on-the-house list with reasons, 30/90-day ledger income (subscription
  invoices vs Connect fees), access-request pipeline. Costs are deliberately
  NOT here — the data wall applies to the operator too.
- **Operating costs seeded into Pulse** (`scripts/seed-operating-costs.mjs`,
  run today): Fly €7, Supabase €25, Vercel €20, Resend €20, domains €2,
  Stripe ~€5 as monthly budget lines ("Platform infrastructure") in
  Solidarity Lab's workspace — correct the amounts there as real invoices
  arrive. Pulse remains the business view; /admin/economics the platform one.
- Catalogues everywhere now sort Free → Starter → Pro → Enterprise
  (`sortPlans`) instead of by price, which put Enterprise (€0, POA) first.

### For Sjoerd (nothing confirms until these are done)
1. Register the billing webhook:
   `https://thefibre-api.fly.dev/api/v1/billing/stripe-webhook`
   (checkout.session.completed, customer.subscription.updated/deleted,
   invoice.paid, invoice.payment_failed) and
   `fly secrets set STRIPE_BILLING_WEBHOOK_SECRET=whsec_…`.
2. Run `node apps/api/scripts/sync-stripe-plans.mjs` once (needs
   STRIPE_SECRET_KEY in apps/api/.env or the environment).
3. The Thread Connect webhook from July is STILL unregistered — that makes
   two on the list.

## [0.20.0] — 2026-09-01 — the plans get their surfaces

Productisation, slice one (docs/productisation-proposal.md). The pricing
model was decided 2026-08-31 and the gates went live in 0.19.24 — but every
*surface* was missing: no plan screen, no admin matrix, no public price list,
no way to give a social enterprise a tailored deal, and the approval email
the request-access flow had been promising since v0.14 was never sent.

### Added
- **/admin/plans — the tier matrix, editable.** Plans as columns, every
  functionality as checkbox rows grouped by app (The Thread, Flow, Pulse,
  platform), monthly + yearly prices, allowances and the fee ladder. It edits
  the same `billing_plan` rows the gates read, so the matrix, the public
  pricing page and enforcement cannot drift. New feature *keys* remain a
  deploy, deliberately (same rule as app-key scopes).
- **Settings → Plan** — the page every `needsPlan()` refusal has pointed at.
  What you are on (incl. comped / tailored badges and effective price), what
  you are using (seats, email vs bundle), and all packages side by side. The
  shared settings card existed since the settings hub; it is un-omitted.
- **/pricing** — public price list on the marketing site, rendered from the
  new no-auth `GET /api/v1/public/plans` (catalogue only, no PII; server-side
  fetch, CORS untouched). Trial banner; every CTA routes to request-access.
- **Tailored pricing + comps on /admin/workspaces.** Each workspace row shows
  its REAL plan (`workspace_subscription`, not the legacy text column) with a
  Plan… dialog: move plan, comp with a written reason, or set a custom price
  (`workspace_subscription.custom_price_cents_month/year`, null = list).
  Prices never gate features — gates always follow the plan.
- **New workspace button** — the invited-in door for social enterprises,
  with plan/comp/tailored price set at creation
  (`POST /api/v1/workspaces`, super-admin). The signup request stays the door
  for people who ask; there is still no delete.
- **`billing_plan.price_cents_year`** — yearly prices stored (€190/€490, two
  months free), not computed, so a future promo can break the ×10 rule
  without lying. Migration `20260901190000` (…180000 was taken — the
  same-day-collision gotcha, again).
- **The approval email exists.** Approving an access request now sends the
  branded "Your workspace is ready" welcome (`platform-templates.ts`) —
  /request-access and /access-pending had promised it since v0.14.
- **Landing page grows up a little**: invited-trial chip, the four-app family
  section (from `branding.ts`, single-sourced), pricing links.

### Changed
- `GET /api/v1/plan` also returns yearly + *effective* prices (tailored ?? 
  list) and a `tailored` flag.
- `/settings/about` and `/admin/workspaces` stopped reading the legacy
  `workspace.plan` column; signup approval stopped writing it. The column is
  now fully dead.
- `lib/plan.ts` gained `forgetAllPlans()` — a plan edit invalidates the whole
  60s cache, not one workspace's entry.
- Super-admin checks share one helper (`lib/super-admin.ts`).

### Still not built (next slices, in the proposal)
Stripe Billing for the subscription itself (P2), /admin/economics + Pulse
cost seed (P3), metered overage + the 13-month archive (P4).

## [0.19.33] — 2026-09-01 — the enrolment emails belong to the thread

*"Enrolment emails — should that not be part of a thread? With a default text
that can be altered?"*

Yes. The Thread already had messages that fire on enrolment and on approval,
token substitution, per-person dedup, five languages and an editor people
know — and the platform was sending its own email straight past all of it.
Last night's editable *note* was a paragraph inserted into an email you could
not see. This is the right shape: the email **is** a message in the timeline.

### Added
- **`thread_engagement.system_role`** — `enrolment_received` /
  `enrolment_confirmed`. Ordinary messages in every other respect: they sit in
  the timeline, read in the thread's language, and are edited like any other.
- **Seeded, not required.** A new thread gets them at creation; an existing one
  the first time it is opened. The default wording is composed from the strings
  the compiled emails already use, in all five languages — so a seeded default
  says exactly what today's email says, without anybody inventing prose in a
  language they do not speak.
- **`on_application`** joins the trigger vocabulary. There was `on_enrolment`
  and `on_approval`, but the moment somebody *applies* to a gated thread had no
  name — which is precisely why that email could only ever be the platform's.
- **The ticket attaches itself.** For `enrolment_confirmed` the sender appends
  the QR block; it is not a token in the body. An organiser rewriting their
  welcome must not be able to delete the ticket from their own ticket email.
- **`{start_date}`** as an alias for `{date}` — the token Sjoerd reached for
  unprompted, and the one that reads better in a sentence written by hand.

### Changed
- **Transactional messages are exempt from the freeze** (Sjoerd's call,
  2026-09-01). `20260829140000` froze a message once sent, because two people
  receiving different words under one title is a lie the system tells for you.
  A ticket email meets that rule on the first enrolment and would be stuck with
  any typo for the life of the thread. These are addressed to one person at the
  moment they enrol, not broadcast to a cohort, so the wording may change and
  reaches whoever enrols next.
- **The compiled emails stand down** when a thread has its own, and remain the
  fallback when it does not. Delete a seeded message and enrolment still works
  — nobody loses a ticket by tidying up.
- **Triggered sends now carry the workspace's logo and sender**, which they
  did not: only the platform's own emails had been given the branding shipped
  in v0.19.17.

## [0.19.32] — 2026-09-01 — the whole logo

The workspace logo preview showed "festiv / tru" — a wordmark cropped to a
square and presented as if that were the logo.

### Fixed
- **`PhotoField` emitted `object-cover` and `object-contain` together** for the
  square shape. Both are the same utility group, so the stylesheet's order
  decided it, not the order they were written in, and cover won. A class list
  that contradicts itself has an answer; it just is not the one you meant.
- **A logo is no longer forced into a square.** Fixed height, free width, up to
  240px, on white with a little padding — the proportions the logo was drawn
  with. A face is still cropped to a circle, which is what a face wants.

## [0.19.31] — 2026-09-01 — the door answers out loud

The Thread's door now behaves exactly like festivaloftrust.com's, so both
feel identical at the entrance.

### Added
- **A camera scanner on the door list.** BarcodeDetector where the browser
  really has it — only when it names `qr_code`, because on desktop the
  constructor exists while the implementation answers `[]` forever — and a
  jsQR frame-grab fallback everywhere else (Safari).
- **Full-screen verdict, ~2.2s.** Green with a huge ✓ and the guest's name in
  display type over "Checked in"; red with ✕ and the reason over "Not
  admitted". Tap dismisses early, scanning continues underneath,
  `aria-live="assertive"`, and one buzz for green / three for red where
  `navigator.vibrate` exists.
- **Already scanned is a refusal, in red**: "«name» was already checked in at
  14:32", in the EVENT's timezone. A ticket opens the door once; the same QR
  twice is what a door exists to notice. Undo in the list, then rescan, is
  the way back.
- Repeat reads of the same code are ignored for 4s, so one ticket held in
  front of the lens does not strobe.

### Changed
- **One door at a time.** While the camera is live the per-guest taps are
  disabled and greyed, with a line saying why — a thumb resting on the list
  must not admit someone mid-scan. Search stays live in both modes.

## [0.19.30] — 2026-09-01 — your profile is yours, not your seat's

*"If I'm in various workspaces, do I need to make a profile over and over?"*

He did. The data said so: his Solidarity Lab profile held a bio and his invoice
details, his Festival of Trust profile held a photo and neither. Tahirih had
one profile and one blank. Yesterday's "one profile" was only ever one profile
*per workspace*.

One line caused it. `user_profile.user_id` references `public."user"(id)`, and
a user row is per workspace. A seat is per workspace on purpose — role, apps,
visibility all differ per tenant. A face is not one of those things.

### Added
- **`identity_profile`**, keyed by email — the same key that already finds
  someone's seats across workspaces (v0.19.1). The backfill takes the fullest
  answer per field rather than picking a row: Sjoerd's merged profile has the
  photo from one workspace and the bio from the other.
- **`identity_billing`**, keyed by email, **owner-only**.
- **`lib/identity-profile.ts`** — one reader, so the fallback to the old
  per-seat rows exists in one place and can be deleted in one place.
- **A "Signing in" section** on the profile page: email, method, last sign-in,
  and a plain statement that the email cannot be changed here yet because it is
  the key to every workspace you belong to.

### Fixed
- **Personal invoice details were readable by the whole workspace.**
  `user_profile`'s read policy is workspace-wide — correct when the row held a
  name, a bio and a photo ("they're public faces"), and quietly wrong from
  v0.13.95, when the payments SPoT added `invoice_details` and
  `stripe_account_id` to the same row. Since then a member's personal legal
  name, home address and tax number have been readable by every other member of
  their workspace.

  RLS cannot withhold a column, so the private half moved to its own table with
  its own policy. Nobody but the owner can read `identity_billing`.

### Changed
- `/api/v1/profile`, The Thread's and Meet's `/me`, and every personal reader
  in `lib/payment-accounts.ts` now resolve identity-first, with the per-seat
  rows as fallbacks. Nothing writes the old columns.

## [0.19.29] — 2026-09-01 — the same page, not the same content twice

Sjoerd, on the two profile screens side by side: *"It's not the same yet."*
Then, when they matched: *"It should be exactly the same page.. not different
pages with the same content. Right?"* And before both: *"the settings should be
the same in the whole app environment. Otherwise it is mystery meat."*

Right. Sharing a component was half an answer — two URLs that edit the same
person are still two places to keep in step, and the one that gets forgotten is
where the drift starts.

### Changed
- **One profile, in The Fibre.** The Thread and Meet no longer edit your name,
  photo, bio or timezone. They keep what is genuinely theirs — the ADDRESS of
  their public page — and link to the profile for the rest, showing a read-only
  preview of what that page will display.

  `20260901140000` fills the platform profile from whatever the apps already
  held, then clears their copies. Before it, the app columns won: Sjoerd's face
  was on his organiser row while his platform profile sat empty, which is
  exactly the screen he was looking at. `thread_organiser` and `meet_host` keep
  the columns as read fallbacks, marked deprecated. Nothing writes them.

  The cost, stated: an organiser who deliberately used a different name or
  photo on their public page than on their profile loses the distinction.
  Today that is nobody.

- **The same four sections in all five apps** — You · Workspace · This app ·
  The Fibre — from one definition in `@thefibre/shared/ui/settings`. Same
  order, same words, same descriptions, so muscle memory survives moving
  between apps.

  An entry that lives in The Fibre is **labelled "in The Fibre"** and carries
  an external-link icon. A card that silently changes domain is precisely the
  mystery meat being removed.

- **Flow has a settings page for the first time.** Its gear went nowhere. It
  has nothing of its own to configure yet, and says so.

- **The Fibre's settings index** drops the read-only block that repeated the
  workspace's name, slug, plan and creation date, and the list of app
  memberships. Facts on a page you could not act on; the name is now editable
  at Settings → Workspace.

- **The Thread's Emails & defaults is gone**, having become the second page
  editing the workspace — Settings → Workspace in The Fibre is the one.

### Added
- **`@thefibre/shared/ui/profile-form`** — the form itself, not just its
  widgets. Both apps had the same fields and the same field kit, byte for byte,
  and still produced different screens: one led with the name and paired photo
  with timezone, the other led with a full-width photo. Layout is what drifts.
- **`@thefibre/shared/ui/fields`** — the field kit, which existed identically
  in two apps. The per-app copies stay for now; moving every consumer is its
  own sweep.

### Not yet
Payments still has a page in both Meet and The Thread, both writing the same
platform values. Same duplication, one level down — it needs a payments page in
The Fibre before those two can become links.

## [0.19.28] — 2026-09-01 — one profile, one workspace

Two questions on the same evening, with the same answer underneath.

*"How come the profile page of The Thread has improved, but it is not the same
as The Fibre? It should be one. The Thread should be leading."*

*"Where can I change info from the workspace? Like name, address, logo,
invoice."*

### Changed
- **The Fibre's profile is now The Thread's.** It had two forms: "Your details"
  (full name, **Avatar URL**) writing `user`, and "Public profile" (display
  name, bio, **Photo URL**, timezone) writing `user_profile`. Two names and two
  pictures, in two tables, free to disagree — and neither was the good version,
  which had been in The Thread all along.

  One form now: upload a photo, name, bio, timezone. It saves the profile every
  app inherits **and** keeps `user.full_name` / `avatar_url` in step, because
  those are what the sidebar and the member list read; left apart they drift,
  which is how there came to be two of everything.

  The timezone stays a picker rather than The Thread's free-text IANA field —
  the one place The Fibre was ahead. "Europe/Amsterdam" typed by hand is a
  support ticket waiting to happen.

- **`PhotoField` moved to `@thefibre/shared/ui/photo-field`** and both apps use
  it. `upload` is injected rather than imported: each app talks to the API with
  its own session and `X-App-ID`, and a shared component reaching for one app's
  client would work there and mysteriously fail next door.

### Added
- **Settings → Workspace, in The Fibre.** Name, logo, invoice details (legal
  name, address, tax number), sender name, reply-to, sending domain, and the
  enrolment note.

  The name **could not be changed at all** before this — read-only on the
  settings page, with no endpoint behind it. The address and tax number lived
  in Settings → Payments inside two other apps; the logo in The Thread's email
  settings. Three places and a hole.

- **`GET/PATCH /api/v1/workspace`** — the same handler as `/workspace-brand`
  (which stays, because The Thread's settings page is written against it),
  widened with `name` and `invoice_details`.

- **`POST /api/v1/uploads`** — an image, from any app. Was `/thread/uploads`,
  which is still mounted and still works; the handler moved to
  `lib/uploads.ts` when The Fibre needed the same thing. The bucket keeps the
  name `thread-assets`: renaming it would mean rewriting stored URLs across
  live threads to make one identifier read nicely.

### Removed
- `settings/profile-form.tsx` and the two actions behind it (`updateMe`,
  `updateProfile`). Superseded, and a second way to write a profile is exactly
  how the two drifted apart.

## [0.19.27] — 2026-09-01 — a certificate that names itself

### Added
- **A saved certificate PDF is named after its holder.** The browser takes a
  "Save as PDF" filename from the page title, so the title is now
  `Name · Course · THR-2026-XXXXXX` instead of something decorative — a
  folder of them sorts and searches the way an administrator needs.
  Filename-hostile characters are replaced, not stripped.

## [0.19.26] — 2026-09-01 — show the whole logo

### Fixed
- **The logo preview cropped the logo.** `object-cover` in a short box filled
  the frame by cutting the image — a square mark lost its top, which is
  exactly the half you look at to check the upload worked. It is `contain`
  now, on a taller frame so a square logo is still legible, with padding so
  it does not touch the border. Applies to the certificate builder's
  background and element previews too, which shared the component.

## [0.19.25] — 2026-09-01 — upload the logo, don't host it first

### Changed
- **Settings → Emails & defaults takes a logo upload.** It asked for a public
  URL, which meant finding somewhere to host a PNG before you could brand an
  email. Pick the file; pasting a URL still works for anyone who already has
  one.
- `ImageUpload` moved out of the certificate builder into
  `components/ui/image-upload.tsx` — extracted the first time a second screen
  needed it, rather than copied. The DateField copies that drifted
  (v0.13.104) are why.

## [0.19.24] — 2026-09-01 — the plans mean something

`docs/pricing-proposal.md`, decided: Free · Starter €19 · Pro €49 ·
Enterprise. Seats 1 / 2 / 5 / unlimited. Free keeps 13 months.

The billing spine has existed since May — `billing_plan`,
`workspace_subscription` with a `comped` status, and a fee ladder read at
every Stripe Checkout. What was missing is what a plan BUYS.

_Housekeeping: the API code below was committed inside 1446b05 (a parallel
session's `git add`), so it is not in that commit's diff by intent and its
changelog entry does not mention it. It is described here, where it belongs._

### Added
- **`billing_plan` becomes a package.** New columns: `price_cents_month`,
  `included_seats`, `extra_seat_cents_month`, `included_emails_month`,
  `included_storage_gb`, `retention_months`. The old
  `price_cents_user_month` stays and is no longer read — the model is per
  workspace now, because a festival has two organisers and four hundred
  participants, and per-seat prices the two while ignoring the four hundred.

  Ids are not renamed: `org` keeps its id and reads as "Enterprise". It is a
  foreign key from every live subscription, and renaming it to look nicer in
  one admin screen is a migration across paying customers for no function.

- **`lib/plan.ts` — the only thing that reads a plan.** `planFor`, `can`,
  `seatAvailable`, `emailUsage`. Cached 60s: long enough to matter on every
  gated request, short enough that an upgrade lands while the person who paid
  is still looking at the screen.

  **It fails open.** If the lookup errors, `can()` says yes. The asymmetry is
  not close — a database hiccup that quietly downgrades a paying festival
  mid-event costs trust that months of correct billing will not win back,
  while the same hiccup letting someone design a template they had not paid
  for costs nothing anyone will notice.

- **The gates**, all answering 402 with the feature named and the plan that
  has it:
  - Flow and Pulse at app **activation** — one gate each, not a check
    scattered through their routes. Both apps already refuse to render for a
    workspace that has not activated them, so refusing the activation gates
    the whole app with nothing left half-open.
  - Third-party app installs (Pro), API-key minting (Pro).
  - Email logo + sender name (Starter); sending from your own domain (Pro).
  - Designing thread templates (Pro). **Using** one stays open on every plan —
    the gate is on authoring, or Starter would have no templates at all.
  - Certificates (Starter).
  - Events live at once (Free: one). Only the transition INTO live is checked;
    a thread already live stays live, because a plan change must never take an
    event off the air while people are enrolling.
  - Seats, on invite. Keys already minted keep working, and a workspace over
    its allowance keeps everybody — the limit binds on the next invite, never
    retroactively.

- **`GET /api/v1/plan`** — what you are on, what you are using, what the next
  one gives. Readable by any member: a plan is not a secret from the people it
  limits. The catalogue comes from the same rows the gates read, so a pricing
  screen cannot drift from what is enforced.

- **An email meter that needed no instrumentation.** `thread_message_send` is
  already one row per (engagement, person) — one email. Counted per calendar
  month through the engagement's thread.

### Changed
- **Every existing workspace moved to Enterprise, comped.** They were all on
  `free` + `comped` from before any of this was gated, and several are using
  Flow, Pulse, app keys and custom templates. Leaving them on Free would have
  taken those away the moment the gates landed. The first bill that removes
  something is a betrayal, and these are the people who trusted it first. New
  workspaces still start on Free.

### Not yet
Stripe Billing for the subscription itself, the plan screen, seat and overage
invoicing, and the 13-month archive — which ships only with a warning, an
export, and an upgrade that stops the clock.

## [0.19.23] — 2026-09-01 — rulers, guides, magnetism

### Added
- **Alignment guides on certificate templates, saved with the template.**
  Rulers along the top and left of the canvas: drag off one to lay a guide,
  drag a guide to move it, drop it back on the ruler to remove it. Positions
  are percentages, so a guide keeps its place if the page size or orientation
  changes.
- **Snapping.** While dragging, an element's left/centre/right and
  top/middle/bottom edges catch guides and the page's own edges and centres
  within ~1%. Hold **Alt** to place freely; a "Snap to guides" checkbox turns
  it off entirely.
- Guides live in their own `guides` column
  (`20260901100000_certificate_guides.sql`), not among `elements` — so the
  snapshot an issued certificate keeps (page, background, elements) cannot
  include them by construction. A design aid never becomes content.

## [0.19.22] — 2026-08-31 — a certificate that proves itself

### Added
- **A QR code element for certificate templates.** Drop it on the design and
  every issued certificate carries a code linking to its own verification
  page — which is the point on paper: whoever is handed the certificate can
  check it is real. `GET /public/certificate/:number/qr.png` generates it, so
  it prints at whatever resolution the printer asks for. The builder shows a
  placeholder, because the number only exists once a certificate is issued.

## [0.19.21] — 2026-08-31 — type the position, not drag it

### Added
- **A position tool in the certificate builder, Illustrator-style.** A
  nine-square reference picker chooses which point of the PAGE the numbers are
  measured from — top-left, top-centre, right-middle, and so on — then X and Y
  are typed in **mm or px**. Positive always points inward, so "10 from the
  right" means the same whichever corner is selected. The element's own
  matching edge is what gets measured, and its height comes from the DOM,
  because how tall a line of text wraps is not in the model.
- **Width is typeable** in the same unit, not only draggable.
- **Opacity is typeable** as a percentage, next to its slider.
- **Type is set in points.** Stored as px and converted for display
  (1pt = 96/72px), so every existing design keeps the size it had.

Page geometry lives in `lib/certificate-types.ts`: A4 210×297mm, Letter
215.9×279.4mm, px at 96dpi — the ratio a browser prints at.

## [0.19.20] — 2026-08-31 — remove it where it is

### Changed
- **Delete moved onto the element.** A small dark dot with a cross sits on the
  selected element's top-right corner, the way every design tool does it —
  instead of a button in the toolbar, far from the thing it deletes. On all
  three kinds (text/field, image, line); hidden while a text element is being
  edited. Delete/Backspace still works, and the toolbar is one control
  lighter.

## [0.19.19] — 2026-08-31 — the controls come with you

### Fixed
- **The certificate builder's formatting bar sticks to the top while you
  scroll.** An A4 canvas is taller than the viewport, so working on anything
  near the bottom of the page meant scrolling to it and leaving every
  control — font, size, colour, alignment, arrange, delete — behind. It now
  follows down the page, opaque so the canvas passes underneath it.

## [0.19.18] — 2026-08-31 — a card keeps you where you are

### Changed
- **A card embed always opens the enrolment popup**, never links out to the
  thread page. It used to defer to the thread's `public_interaction`, so a
  page-interaction thread sent the visitor off the site — to read the same
  cover, title, date and price the card had just shown them.
  `public_interaction` decides how a LISTING opens a thread; a card has
  already made that choice.

### Added
- **Card with the registration form in it** — `data-form="1"`, the third
  shape: no click at all, the form sits inside the card. Offered in both
  generators (Settings → Website embeds, and a thread's own Embed tab) and
  documented at /developers.

## [0.19.17] — 2026-08-31 — whose email is this

An enrolment sent three emails. The first ("request received") and the third
("you're enrolled", with the QR ticket) are the platform's — compiled in,
translated into five languages, editable nowhere. The second existed only
because the other two could not be written in.

And all three arrived branded The Fibre, from The Fibre, for a festival that
is not The Fibre.

### Added
- **The organiser's own words, inside the platform's two enrolment emails.**
  Set once for the workspace at Settings → Emails & defaults, overridable per
  thread on the Registration tab. Write it and the middle email is no longer
  needed.

  Null at the thread inherits the workspace's; empty string means this thread
  deliberately adds nothing. A textarea cannot say both, so the thread carries
  a switch — the same null-means-inherit shape as payment methods.

  Newlines become paragraphs and everything else is escaped: this is text on
  its way into HTML, written by someone who is not writing markup.

- **Workspace branding on outgoing email.** `workspace.brand_logo_url` replaces
  the platform wordmark at the top. The footer links, whitelist hint and legal
  line stay — those are obligations, not decoration, and remain true whoever
  the mail looks like it came from.

- **A sender, in two halves with very different costs.** `email_from_name` is
  free: a mailbox shows the display name, and the address behind it can stay
  ours, so mail reads as "Festival of Trust" tonight with no setup at all.
  `email_from_address` needs SPF and DKIM on that domain, verified with Resend.
  `email_reply_to` is free again — the cheap way to be reachable under your own
  domain while DNS is pending.

  Set an address before the domain is verified and mail still arrives: the
  send is retried from the platform address, keeping your name, and the refusal
  is logged with what to do about it. Losing somebody's ticket to a DNS record
  is not an acceptable way to find out.

- **`GET/PATCH /api/v1/workspace-brand`** — admin-only, sibling of
  workspace-billing. Read everywhere through `lib/workspace-brand.ts`.

### Fixed
- **Settings → Emails & defaults has been writing to nothing since v0.13.x.**
  `thread_settings.email_from_name` and `email_footer_note` were stored and
  editable, and no send site ever read them: someone set a sender name, saved
  it, and every email since went out saying The Fibre. They are now read
  fallbacks behind the platform values (the payments-SPoT arrangement), so
  those saves finally mean something. Never written again.

## [0.19.16] — 2026-08-31 — the tokens, on screen

### Added
- **A Tokens panel in the certificate builder's left column** — all nine, each
  showing the literal token, what it means, and what it becomes
  (`{start_date}` · Start date · *8 Aug 2026*). Click one to insert it into
  the selected text element. A list you can read beats a list you have to go
  looking for.

### Fixed
- **Delete moved out of the scrolling properties bar.** It has been there
  since v0.13.68, pinned right — but the bar scrolls horizontally, so with a
  text element's full set of controls it sat past the scroll edge and read as
  "there is no way to delete this". It is now outside the scroll area,
  always visible. (Correcting the previous entry: the control existed; it was
  unreachable, not absent. The duplicate "Remove" added in 0.19.14 is gone;
  the Delete/Backspace shortcut stays.)

## [0.19.15] — 2026-08-31 — the box fits the words

### Fixed
- **A text element shrank when you started editing it** in the certificate
  builder. Reading, it was a div that grew to its content; editing, it became
  a `rows={3}` textarea with `overflow: hidden` — so anything longer than
  three lines collapsed on double-click, and what you typed past that was
  clipped out of sight. The textarea now grows to fit, so editing looks like
  the certificate will.

## [0.19.14] — 2026-08-31 — take it off the certificate, and say the date

### Fixed
- **You could not remove an element from a certificate template.**
  `deleteSelected()` had been there since the builder shipped and nothing ever
  called it. The properties bar now ends in **Remove**, and Delete/Backspace
  does it too (ignored while a caret is in a field).

### Added
- **Every token, offered.** The bar named `{recipient_name}` and left the
  other eight invisible — they all worked, `substituteFields` has handled any
  `{token}` since the start. A picker now inserts any of them:
  `{thread_title}`, `{start_date}`, `{end_date}`, `{issue_date}`,
  `{org_name}`, `{certificate_number}`, `{criteria}`, `{issued_by}`.
  Unknown tokens still pass through untouched rather than rendering as blanks.

## [0.19.13] — 2026-08-31 — a copy that is actually a copy

### Fixed
- **Duplicating a thread lost its pricing.** Tickets were never copied — and
  when a thread has tickets they ARE its price (`effectivePrice` takes the
  lowest active one), so the copy read "Free" no matter how carefully
  `price_cents` was carried over. Verified against a real €1850/€500 thread:
  the copy now carries both tickets, limits included.
- Discount codes come along too, with `used_count` reset — the new run starts
  its allowance at zero. `ticket_id` scoping is dropped rather than guessed at
  (it pointed at the source thread's ticket).
- **Columns that shipped after this route was written and were never added to
  it**: `payment_methods`, `share_participants_public`,
  `share_participants_participants`, `public_agenda` — each silently reverted
  to its column default on every copy. Categories now copy as well.
- **`daily_schedule`** on engagements: a duplicated two-day event lost its
  per-day times.
- **Event-anchored messages are re-anchored to the copy.** A message set to
  "1 day after the opening ceremony" pointed at the ORIGINAL's ceremony, so
  moving the copy's dates would not move it. Two-pass insert with an
  old-id→new-id map.

### Added
- **Click a discount code to copy it.** The row still opens the editor; the
  code itself is now its own button — a code exists to be sent to someone,
  and retyping it off the screen is how a typo reaches a customer.

## [0.19.12] — 2026-08-31 — the address knows where it is

### Added
- **Type an address, get the map link offered.** Under Location link, once
  there is an address and no link yet: "Use a Google Maps link for …" — one
  click fills it. Built from Google's documented search URL, so there is no
  geocoding service, no API key, and the address never leaves the browser
  until someone clicks the finished link. Offered rather than auto-written:
  a venue with its own page deserves that link instead, and silently
  overwriting would bury it.

## [0.19.11] — 2026-08-31 — days that belong together, and a refusal you can read

### Changed
- **The timeline moulds a multi-day activity to the days it covers.** A
  two-day event and a conversation on its second day used to render as two
  free-floating groups; the second day now attaches to the first as one
  continuous block, each day keeping its own date badge. Days a single
  activity spans form a "run"; separate days still sit apart.

### Fixed
- **"Delete does nothing"** on a message that had already been sent. Two
  faults stacked: the dialog discarded the result of `deleteEngagement`, so a
  refusal closed the dialog and left the item there; and `pgErrorMessage`
  replaced the trigger's own carefully-written sentence with a generic line.
  Our triggers (SQLSTATE P0001) now speak for themselves and answer 409 —
  "This message has already been sent to 2 people and cannot be deleted…" —
  and the dialog shows it instead of pretending to succeed.

## [0.19.10] — 2026-08-31 — the end follows the beginning

### Fixed
- **Moving an activity's start date left the end date behind.** Ends was an
  uncontrolled field with a `min`: picking a new start tightened the
  constraint but never touched the value, so the dialog would sit there
  reading "Starts 17 Sept · Ends 2 Sept" until someone noticed. Ends is
  controlled now and moves with the start, **keeping the gap** — a 7½-hour
  day stays 7½ hours, a two-day activity stays two days — the same way a
  thread's engagements shift when the thread's own start date moves. With no
  end yet (or one stranded before the start) it opens an hour.

## [0.19.9] — 2026-08-31 — a thread belongs somewhere

Categories, as Sjoerd specified them: made in Settings, scoped to the
workspace or to one organiser, and a thread picks one or more. **Not tags** —
a curated list, not free text on the thread.

### Added
- **Settings → Categories** — add, rename, delete; "Whole workspace" or "Only
  me". Renaming keeps the slug on purpose: the slug is the public filter other
  websites may already embed, so a wording tweak must not break their
  listings. Migration `20260831140000_thread_categories.sql`
  (`thread_category` + `thread_thread_category`, slug unique per workspace so
  a public filter is never ambiguous).
- **Categories on the thread** — a chip row in thread settings → Basics,
  multi-select, saved with the rest of the form
  (`PUT /threads/:id/categories`, replace-the-set).
- **Public + embeds** — `categories: {name, slug}[]` on the listing and
  thread payloads (additive, rule 8), `?category=<slug>` on the listing,
  `data-category` on the list embed, and a Category picker in the Settings →
  Website embeds generator. /developers and verify-public-api.mjs updated.
- **Through the app key** — `categories: string[]` on the thread PATCH, BY
  NAME: the planner sends its own vocabulary and the platform resolves each
  name to the workspace's category, minting missing ones workspace-scoped, so
  a sync never manages platform ids.

## [0.19.8] — 2026-08-31 — a string, not a proxy

### Fixed
- **Settings → Website embeds 500'd in production** ("Application error",
  digest only). `DEFAULT_EMBED_CSS` lived in embed-generator.tsx — a
  `'use client'` module — and every export of a client module reaches a
  Server Component as a client-reference proxy, not the value. The page
  calls `.split('\n')` on it during SSR; on the proxy that throws. The
  constant now lives in its own server-safe module
  (`default-embed-css.ts`), imported by both sides as a plain string.

## [0.19.7] — 2026-08-31 — the event on your own website

Website integration, both places Sjoerd named.

### Added
- **Card embed** — one thread as a compact card (cover, title, date, price,
  one button honouring the thread's page/popup interaction):
  `data-thread-embed="card"`, rendered by `/embed/card`. The thread-level
  counterpart of the list.
- **Thread settings → Embed tab** — the generator scoped to ONE thread: card
  or registration button, language, and an Any-website / Webflow toggle that
  labels the two blocks with Webflow's actual place names (Site settings →
  Custom code → Head code; Embed element). Any-website also offers an
  all-in-one block (embed.js is idempotent, a doubled script tag is safe).
- **Settings → Website embeds generator** grows the same Webflow toggle, the
  Card kind, and a list "Kind" filter — events only / journeys only — backed
  by `?format=event|journey` on `GET /public/embed/threads` (additive,
  ignored when invalid so a typo degrades to the full list, not a broken
  widget) and `data-format` on the list embed. /developers documents both.

## [0.19.6] — 2026-08-31 — every app can switch workspace, to the ones it works in

The switcher shipped in v0.19.1 only in The Fibre. Thread, Meet, Flow and Pulse
have the same account menu, so being in the wrong workspace there meant going
to The Fibre, switching, and coming back.

### Added
- **Workspace section in the account menu of Thread, Meet, Flow and Pulse.**
  Same behaviour as The Fibre's: record the choice, refresh the token so the
  access-token hook stamps the new workspace, re-read. Hidden when there is
  nothing to choose between.
- **`has_app` on `GET /auth/workspaces`.** Per workspace, whether the app that
  asked — the `X-App-ID` on the request — can actually be used there: switched
  on for the workspace, and granted to that person's seat in it. A seat is per
  workspace, so the grant is looked up per seat; the same person can hold The
  Thread in one workspace and not in another.

  Each app lists only those. Without the filter the menu would offer dead
  ends — every one of these apps redirects to `/no-access` without both halves,
  so switching into a workspace you have no grant in would bounce you straight
  out of the app you were using.

  The Fibre is exempt and lists every seat: it is not an app a workspace
  activates, it is where the account lives.

### Changed
- **Switching lands on the dashboard** rather than refreshing where you stood.
  A contact, a thread, a flow run — every id on screen belongs to the workspace
  being left, and means nothing in the one being entered. Refreshing in place
  showed an empty page or a 404 as the reward for switching.

## [0.19.5] — 2026-08-31 — work can change hands without the seat being retired

v0.19.3 gave us the wrong-address case: make the seat, move the grants, retire
the old one. It refuses outright when the old seat owns anything. This is that
refusal's other half — a seat that has been *used*, whose work should now sit
under the address its owner actually signs in with, while the old seat stays
usable as a way back in.

### Added
- **`apps/api/scripts/hand-over.mjs`** — `--workspace <slug> --from <email>
  --to <email>`, a dry run unless `FIBRE_HANDOVER_CONFIRM=1`. Moves the Thread
  storefront (every thread hangs off it, so they follow), template and
  certificate-design authorship, engagements, flow ownership and versions,
  runs and open tasks, the Meet host record, Pulse budget lines and
  commitments. The destination is granted whatever apps the source holds, or
  it could not open what it now owns.

  Four things it deliberately leaves, and prints as STAYS rather than passing
  over in silence:

  - `activity.created_by` — the log is append-only (brief §5). It records who
    did a thing on a day; rewriting it makes the past say something that did
    not happen.
  - `workspace_app.activated_by` — the same kind of fact, and it grants
    nothing today.
  - `user_profile` — display name, timezone, payment details keyed to that
    seat. The old seat is being kept, so it keeps its own.
  - `app_membership` / `workspace_member` / `user_identity_provider` —
    stripping these would leave a backup account that cannot sign in, which is
    not a backup.

  It stops before writing if the destination already has a Thread storefront:
  two cannot be merged, and finding that out halfway through a run is worse
  than not starting.

Run today for the Festival of Trust workspace, moving the storefront, both
threads, two templates, three engagements and two flows from
`sjoerd+fot@soul.com` to `sjoerd@soul.com` — one account to sign in with, the
plus-address kept as a way back in.

## [0.19.4] — 2026-08-31 — the person field is a search field

Linking a person to an organisation, or enrolling one in a programme, meant
picking from a dropdown of the first hundred contacts. Both halves of that fail
as a workspace fills up: a hundred names is not a list you read, and contact
101 was not offered at all — the person you wanted could be missing with
nothing on screen to say so.

### Changed
- **`PersonCombobox`** replaces the person `<select>` in the organisation's
  Add member dialog and the programme's Enrol dialog. Type a name; it queries
  `/persons?q=` after a 200ms pause and lists matches with their email beside
  them. Arrow keys and Enter work, as in the country picker it is shaped after.

  It shows the page's first twenty contacts before you type, so picking a
  recent one is still a single click and the field is never empty.

  Search runs on the API under the caller's own RLS, so a picker can never
  surface somebody its user could not already see. Out-of-order replies are
  dropped rather than applied: without that guard a slow "ma" can land after a
  fast "marja" and quietly replace the results you are looking at.

  Typing after a pick clears the pick. The alternative — leaving the id set
  while the text says something else — submits a person nobody chose.

  Members already linked are excluded by id, which the page now passes down
  rather than pre-filtering its list: a name typed in has to be filtered too,
  not only a seeded one.

## [0.19.3] — 2026-08-30 — a seat can be moved to the right address

An invite goes to an address, and a workspace membership IS that address: a row
in `public."user"` keyed by (workspace_id, email). So an invite sent to the
wrong one is not a field to correct — it is a seat under a name that is not
theirs, holding the app grants somebody meant to give them.

The Members screen can invite and can remove. It cannot say "this is the same
person, under the address they actually use", because that is three writes that
have to happen together: make the seat, move the grants, retire the old one.

### Added
- **`apps/api/scripts/transfer-membership.mjs`** — does exactly those three,
  and nothing else. `--workspace <slug> --from <email> --to <email>`; a dry run
  unless `FIBRE_TRANSFER_CONFIRM=1`. Where the target already holds a seat, the
  grants are added to it rather than a second one being made.

  It refuses to run if the old address owns anything — a thread, a flow, an
  invoice, a Meet host record. Moving content is a different job and a person
  should look at it; silently orphaning it is the failure this guard exists to
  prevent. In practice a mis-addressed invite has never been signed into and
  owns nothing.

  The old user and person rows are soft-deleted (brief §6). The
  `workspace_member` and `app_membership` rows are join rows and go outright —
  left behind, a retired seat keeps appearing in the Members list.

  It does not touch that person's seats in other workspaces. Since v0.19.1 one
  account may hold several, and the usual reason to run this is to make the
  address here match the one they already use elsewhere.

## [0.19.2] — 2026-08-30 — a second membership must not lock you out

v0.19.1 let one account hold a user row in several workspaces. Two places still
assumed exactly one, and the first person to gain a second membership was shown
the request-access form on their own account.

### Fixed
- **`/sso/access-check` treated a second membership as no account at all.**
  It looked the person up with `.maybeSingle()`, which treats more than one row
  as an **error** rather than a result: `data` came back null, the check read as
  "no account", and a returning member was sent to sign up. Now ordered,
  `limit 1`.

  Which workspace it returns barely matters, deliberately: the callback resolves
  into it, refreshes the session, and the access-token hook decides the active
  workspace by applying the person's own choice. This only has to name a
  workspace they really belong to — and the earliest is the hook's own fallback,
  so the two cannot disagree.

- **Inviting a colleague refused anyone who was already in another workspace**,
  with "that email already belongs to another Fibre workspace". That was correct
  when an email meant one workspace and is exactly backwards now. The lookup is
  scoped to the current workspace, where `unique (workspace_id, email)` makes
  `.maybeSingle()` safe again, and the refusal is gone: inviting someone who
  works in another workspace now does what you would expect.

### Note
Both are the same mistake — code that read "the user with this email" when the
question had become "the user with this email, in this workspace". Every other
by-email lookup in the API was checked; these were the two.


## [0.19.1] — 2026-08-30 — one account, several workspaces

Until now the workspace you were in lived in your login token and nowhere else.
The hook stamped one `workspace_id`; every policy asked the token rather than
the person. `current_workspace_id()` is read **238 times across 32 migrations**,
so the workspace was welded to the session — which is why reaching a second
workspace meant a second email address, and switching meant signing out.

### Added
- **`user_active_workspace`** — which workspace a sign-in is currently acting
  in. Keyed by `auth.users.id`, because that is the identity that spans
  workspaces; `public."user".id` does not, it *is* the per-workspace row.
  RLS on, **no policies**: only the service role writes it, so a client cannot
  put itself in a tenant by writing the table directly.
- **`GET /api/v1/auth/workspaces`** — the workspaces you belong to, and which
  one this token is acting in.
- **`POST /api/v1/auth/workspace`** — switch. Membership is the gate: you must
  already have a live `user` row in the target. Returns `refresh_required`,
  because recording the choice changes nothing until a new token is minted.
- **A workspace section in the account menu**, which hides itself when there is
  only one — as there is for almost everybody. Switching records the choice,
  calls `refreshSession()` so the hook re-stamps the token, then re-renders.

### Changed
- **The token hook picks deterministically.** It was `limit 1` with no ordering
  — fine with one row, arbitrary with two. Now: the chosen workspace if one is
  set and still valid, otherwise the earliest membership. A hook that picked
  differently on two consecutive sign-ins would look exactly like data
  disappearing.
- **`resolve_sso_identity` matches an identity within one workspace.** Step 1
  matched on `(provider, provider_user_id)` alone, which is global — the same
  Google identity legitimately has a row in each workspace, so it would have
  resolved a sign-in into whichever was found first. There is deliberately no
  unique constraint on that pair: one identity, many rows, one per workspace.

### What deliberately did not change
**Every RLS policy.** They all read `current_workspace_id()`, which still
returns exactly one workspace. This changes *which* one and lets a person move
between them; it does not let a token name two at once. A request is still
answered inside exactly one tenant — the property the whole data wall rests on,
and the one not worth trading for convenience.

### Verified
Against the live database, with a real second membership: with no choice set
the session stays put; choosing a workspace lands the next token in it, with
the right `app_user_id`; choosing back returns. Switching to a workspace you
are not a member of is refused. And the data follows — 12 contacts in Festival
of Trust, 23 in Solidarity Lab, same account, policies untouched.


## [0.19.0] — 2026-08-30 — the door

Check-in, end to end (Sjoerd 2026-08-30). Migration
`20260830120000_thread_checkin.sql`: every registration carries a
`checkin_code` — a capability that only ever OPENS read surfaces; the state
change always runs the organiser authority check (loadEnrolmentForAction).

### Added
- **The ticket in the confirmation email** — a QR block (image served by the
  API; data URIs get stripped by mail clients) in all four sends: instant
  enrol, approval, paid finalization, manually-added participant. i18n ×5.
- **Wallet passes, env-gated** (`lib/checkin.ts`): Apple `.pkpass` (signed
  event ticket, passkit-generator) and Save-to-Google-Wallet (RS256 JWT via
  jose, object inline — no Wallet API round-trip). The email offers each
  button only when the platform can honour it; unconfigured endpoints answer
  503 with a sentence. Credentials are issuer accounts only Sjoerd can
  create — new build-plan item.
- **`/checkin/[code]`** in The Thread — the scan landing. Camera → link →
  signed-in organiser one tap from done; first tap wins (two volunteers
  scanning the same ticket both see "checked in", one timestamp). Undo for
  mistaken taps. A guest scanning their own ticket gets a polite refusal.
- **`/threads/[id]/checkin`** — the door list, mobile-first: search by name
  or email, tap a row to check in/undo, running count, "not approved yet" /
  "payment pending" flags. Linked from the timeline header (ScanLine icon).
  Declined applications don't appear.
- **The door through the app key** (the FOT planner's ask), riding on
  `review:enrolments` — door admission is the same authority family as
  application review: `checkin_code` + `checked_in_at` on the enrolments
  list, `GET /apps/:slug/thread/checkin/:code`,
  `POST /apps/:slug/thread/enrolments/:id/checkin` `{undo?}`. Same
  `performCheckinEnrolment` core as The Thread's own door. Verifier 7d
  extended: scan-resolve, tap, second-scan-harmless, refusal without scope.
- `checked_in_at` on The Thread's own enrolments list (registrations dialog
  data source, door list).

## [0.18.27] — 2026-08-30 — the agenda reads back

### Added
- **Activity fields on the app-key engagement read** — `starts_at`, `ends_at`,
  `daily_schedule`, `location`, `location_url`, `meeting_url`,
  `meeting_provider` (additive). An app could always WRITE them; now it reads
  them back, which is the door the planner's agenda migration was waiting on:
  the site lays its sessions down in The Thread and renders its public agenda
  from here, organiser edits included. `verify-external-app.mjs` pins the
  full 24-key engagement shape and asserts the timing/place round-trip.

## [0.18.26] — 2026-08-30 — the organiser decides where they already look

The festival planner's brief "enrolment review through the app key", both
asks. A gated festival receives applications; its organiser reviews them on
the site, not in The Thread.

### Added
- **`awaiting_approval`** on the app-key enrolments list (additive). The
  platform `status` was already there, but 'invited' is ambiguous — it also
  means "hasn't paid yet" on ungated paid threads. This is true exactly when
  the organiser's decision is what the person is waiting for.
- **`review:enrolments` scope** +
  `POST /apps/:slug/thread/enrolments/:id/{approve,decline}`. A decision on
  an enrolment the person created themselves — the app still cannot conjure
  one (no `write:enrolments`, unchanged). Constrained to the app's own
  threads (`source_app`), like every Thread surface. Both routes converge on
  the SAME cores as The Thread's signed-in buttons —
  `performApprove/DeclineEnrolment`, extracted from the existing routes, so
  the confirmation email, the waiting on-enrolment/on-approval messages, the
  activity rows and the checkout-session expiry on decline cannot drift
  between the two doors.
- `verify-external-app.mjs` step 7d: applications marked, refusal without the
  scope, admit → enrolled, decline → dropped. All steps pass.
- `docs/building-on-the-fibre.md` §5.5 documents the surface.

## [0.18.25] — 2026-08-30 — the editor is for the timeline

### Changed
- The thread editor no longer renders the intention under the title. It was
  fine when intentions were a sentence; once the Festival planner started
  syncing full festival descriptions into the field, the whole text sat
  between the title and the timeline and pushed the actual work below the
  fold. It still lives in Settings → Basics and on the public page — the two
  places it is actually for. The Team chip stays.

## [0.18.24] — 2026-08-29 — the app edits the agenda, because The Thread owns it

`docs/brief-thread-engagements-from-apps.md` §7 held the activity family back:
"two systems both authoring the agenda is a sync problem nobody has scoped…
Activities can follow once someone has decided which side owns the agenda."

Sjoerd decided: The Thread owns it, and the planner's editing screen is a
window onto that rather than a second copy. So activities open.

### Changed
- **Both engagement families are writable** on `POST /apps/:slug/thread/threads/:id/engagements`
  and `PATCH /apps/:slug/thread/engagements/:id`. Type may still only move
  within its family — an agenda item does not become a message by being
  retyped.
- **The scope split follows what the thing can do**, not which route it arrives
  on. Both routes are allow-listed under `write:programs`, which owns thread
  content; the handler additionally demands `write:messages` when the type is
  message-family, because only that family can cause an email to reach a human.
  The route table cannot see the body, so the check lives where the body is.

  This is a **relaxation** for the agenda and unchanged for messages: a key
  without `write:messages` gained the ability to write agenda items and still
  cannot write, edit or send a message.

### Verified
`verify-external-app.mjs`, all steps passing, four new:
an agenda item is written; one outside the event's dates is refused
(`activityWindowError` still applies); an agenda item cannot be retyped into a
message; and a key without `write:messages` still cannot write one.


## [0.18.23] — 2026-08-29 — whether the page has an agenda at all

### Added
- **Public agenda switch** on thread settings (Sharing, next to "List on the
  organiser's public page"). Two layers on purpose: this switch decides
  whether the public page HAS an agenda; the per-element "Show on the public
  agenda" toggle decides what it is made of. Off = `agenda` is `[]` in the
  public payload and neither the page nor the embed renders the section.
  Defaults on — every existing public page keeps its agenda. Published as
  `public_agenda` on the thread payload (additive, rule 8); /developers and
  verify-public-api.mjs updated. Migration
  `20260829170000_thread_public_agenda.sql` (renamed past the parallel
  session's 20260829110000 — same-day timestamp collision).

## [0.18.22] — 2026-08-29 — the organiser picks the structure

Several thread templates, and the event organiser chooses between them from the
app that owns the festival. Structure, not design: a template is the shape of a
thread — its settings and its items — and the organiser fills in the content per
event.

### Added
- **`GET /apps/:slug/thread/templates`** (`read:programs`) — what a festival can
  be built from. Returns `title`, `scope`, `item_count` and `sends_messages`.
  **`structure` itself is deliberately not returned**: it is The Thread's
  internal shape, and an app that read it would end up depending on it. What an
  organiser needs to choose is the name, a sense of size, and whether picking it
  will email anyone.
- **`template_id` on `POST /apps/:slug/thread/threads`** — build the event from
  the chosen structure, its items rebased onto `starts_on`.

### Security
- **A template is not a way around `write:messages`.** The allow-list gates
  publishing on `write:programs` and cannot see inside a template — but a
  template carrying message-family items can email everyone who enrols. The
  route loads the template first, and refuses with `missing-scope` when it
  contains messages and the key lacks `write:messages`. Asserted in
  `verify-external-app.mjs`: *"a template full of messages is not a way around
  write:messages"* → 403.

### Changed
- **`seedTemplateEngagements` extracted** from The Thread's own
  `/thread-templates/:id/instantiate`, which now calls it. One implementation
  with two callers rather than two that drift — and the one that drifted would
  be the one nobody was looking at. `templateHasMessages` alongside it.
- The template is loaded and its scope checked **before** anything is written,
  so a bad id or a missing scope cannot leave a half-built event behind.

### Notes
- `created_by` is null on the app path: there is no user behind a key.
- All templates in the workspace are listed, not only workspace-scoped ones. A
  template is authored structure with no personal data, and the key is
  workspace-bound; `scope` is returned so an app can show or filter on it.
- Verified end to end: the list reads, a festival builds from a template, and
  the template's items arrive with it.


## [0.18.21] — 2026-08-29 — editing and deleting a message, and a refusal that reads like one

Steps 4 and 5 of §8 in `docs/brief-thread-engagements-from-apps.md`, closing it.

### Added
- **`PATCH`** and **`DELETE /apps/:slug/thread/engagements/:id`**, both
  `write:messages`. Ownership is checked **one level down**, as the brief
  insists: the engagement resolves to its thread, and the thread must belong to
  the calling app. `workspace_id` alone would let one app edit a message on a
  thread another app published.
- Neither route enforces "sent messages are frozen" itself — the trigger from
  v0.18.20 does, so The Thread's editor obeys the same rule. These surface the
  refusal properly.

### Fixed
- **A deliberate refusal read as a server error.** `pgErrorStatus` had no case
  for `P0001`, so every `raise exception` in the platform — append-only
  activity, the super-admin interlock, and now freeze-once-sent — came back as
  **500**, and `pgErrorMessage` replaced the trigger's carefully written
  sentence with the generic *"The database would not accept this change."*
  `P0001` now maps to **409**, and its message passes through untouched.

  Every `raise exception` in the codebase was checked before doing this: all of
  them are written for a person, which is what makes passing the text through
  safe rather than a leak.

  This fixes The Thread's editor as much as the app surface — the sentence
  explaining *why* and what to do instead is the only useful part, and it was
  being thrown away.

### Verified
`verify-external-app.mjs` passes in full, now including re-wording and deleting
an unsent message, and refusing both without `write:messages`. Separately,
through the running API on the human path: editing an unsent message returns
200; editing a sent one returns **409** carrying *"this message has already been
sent to 1 person and its wording cannot be changed…"*.

### Notes
- `EngagementUpdate` is imported from `routes/thread.ts`, like the create schema.
  No `omit` needed — it is `EngagementCreate.partial()`, and `source_ref` only
  ever existed on the app-side create. An app names its own ref once, at
  creation, and addresses the engagement by id afterwards.


## [0.18.20] — 2026-08-29 — a message that has been sent cannot be altered

Sjoerd's rule, and the reason he gave is the whole argument: a message sends to
whoever is enrolled at the time, and the scheduler keeps sending it to people
who enrol later — dedup is per `(engagement_id, person_id)`, so a later
registrant is a fresh send. Edit the text after the first send and two people
receive different words under one title, with nothing recording that they differ.

**This was a live hole in The Thread, not a gap on the app surface.** `PATCH
/thread/engagements/:id` and `DELETE` had no such guard, so a human could do
exactly this today. Guarding only the app surface would have left the real bug
in place and made an app stricter than the people using the product.

### Added
- **`thread_engagement_frozen_once_sent()`**, a trigger on `thread_engagement`
  before update and before delete. Once any `thread_message_send` row exists:
  - `title`, `description` and `content` are immutable — what a recipient
    receives is fixed;
  - the row cannot be deleted at all. `thread_message_send.engagement_id`
    cascades, so deleting a sent message drops the record of who received it,
    and a planner re-creating it from its own copy would send to them again.
- **Deliberately still editable:** `status`, `position`, `show_in_agenda` and the
  trigger/timing columns. You must be able to **stop** a message reaching future
  registrants (`status` → `draft`), reorder a timeline, or re-time what has not
  gone yet. Freezing those would make "sent to one person" mean "this thread can
  no longer be managed".

### Notes
- In the database rather than in either route, because both surfaces have to
  obey it and the human one is where the hole actually was.
- Safe against the senders: `sendTriggeredMessages` and
  `runThreadMessageScheduler` only **read** engagements, so nothing here can
  block a send in progress. Checked before writing the trigger.
- Verified against the live database: before a send everything is editable;
  after one, wording, title and delete are refused while stop and reorder still
  work.
- Two follow-up migrations are grammar on the message a person reads
  ("1 people" → "2 persons" → "1 person / 2 people"). Behaviour unchanged.
- Still open from `docs/brief-thread-engagements-from-apps.md` §8: steps 4 and 5,
  the app-surface PATCH and DELETE. Both now inherit this rule for free.


## [0.18.19] — 2026-08-29 — an app can write the messages around its own event

Steps 2, 3 and 6 of §8 in `docs/brief-thread-engagements-from-apps.md`. The
planner could publish a festival, describe it, credit its hosts, open enrolment
and read who registered — and then not write a word that goes out to those
people.

### Added
- **`write:messages`** — a new scope, deliberately not folded into
  `write:programs`. Nothing on this surface could previously cause an email to
  reach a human: `write:programs` publishes a page and edits settings, and every
  send originates from the public enrolment form. The moment an app can publish
  a message-family engagement, whatever scope allows it also means *this
  credential can email everyone enrolled, from the platform's domain, on a
  five-minute timer*. Folding that in would have granted it silently to every
  key already holding `write:programs`.
- **`POST /apps/:slug/thread/threads/:id/engagements`** (`write:messages`) and
  **`GET`** the same path (`read:programs`).
  - **Message family only.** Activities are the public agenda, validated against
    the programme's dates, and the planner has its own sessions model — two
    systems authoring one agenda is a sync problem nobody has scoped.
  - **Idempotent** on `(thread_id, source_app, source_ref)`, returning
    `created: true|false` exactly as the thread publish does, so a retried sync
    cannot produce a second welcome email. A losing race on the unique index is
    read back rather than failed.
  - **`trigger_anchor_ref`** names the anchor by the app's *own* ref, resolved
    server-side, so a sequence can be laid down in one pass before platform ids
    exist. Naming both it and `trigger_engagement_id` is a 400.
- **Verification, before the routes shipped rather than after** (§8 step 6):
  `thread_message_send`, `sends`, `sent_at` and `recipients` joined `WALLED_OFF`,
  and `verify-external-app.mjs` now writes an engagement, checks the wall on both
  the create and the list response, and asserts a key **without**
  `write:messages` is refused. All steps pass.

### Notes
- `EngagementCreate`, `MESSAGE_TYPES`, `activityWindowError` and
  `dailyScheduleError` are **imported** from `routes/thread.ts`, not restated. A
  second copy would drift from the first.
- `created_by` stays null on app writes — it is a FK to `public."user"` and there
  is no user behind an app key.
- Delivery data stays behind the wall: no `thread_message_send`, no app-addressed
  sends, and token substitution stays server-side. The app writes the token; it
  never sees what the token resolves to.
- **Action needed before the planner can use this:** `app_key.scopes` is a stored
  column, so an existing key does not acquire the new scope. The fot-planner
  manifest must declare `write:messages` and its key be re-minted.
- Still open from the brief: §8 steps 4 (PATCH) and 5 (DELETE, which needs the
  `thread_message_send` guard — deleting an engagement that has already sent
  takes the dedup log with it and re-sends to everyone).


## [0.18.18] — 2026-08-29 — an engagement can carry the app's own id

Step 1 of §8 in `docs/brief-thread-engagements-from-apps.md`. Nothing on the
app surface uses it yet; everything planned there depends on it, so it lands
first and alone.

### Added
- **`thread_engagement.source_app` / `source_ref`**, with a partial unique index
  on `(thread_id, source_app, source_ref)`.
  - **Idempotency.** Publishing a thread is already idempotent on
    `program.source_ref` (20260824170000) so a retried publish cannot create a
    second public page. The same has to hold one level down: a retried sync of a
    message sequence must not create a second welcome email.
  - **Anchoring.** `trigger_engagement_id` names another engagement. A planner
    laying down "opening ceremony" and "reminder, two days before the opening
    ceremony" in one sync must name the first from inside the second, before it
    has been told the first's platform id. Its own ref makes that possible.

### Notes
- Scoped per **thread**, not per workspace as `program_source_ref_idx` is: an
  engagement only means anything inside its thread, and two festivals may both
  call their opening message the same thing on the app's side.
- Partial, because almost every engagement is written by a person in The
  Thread's editor and carries neither column.
- `app_record_link` deliberately not reused — its `platform_entity` is
  CHECK-constrained to person / organisation / user, and widening that would
  turn the entity-mapping table into a general id registry.
- No routes yet. The scope decision in §8 step 2 comes before those.


## [0.18.17] — 2026-08-29 — a message that would never have sent

Found while debugging, live on tester-2: a "Thank you" message anchored to an
event that has no date. The scheduler resolves the anchor to null and skips
the message every run — no error, no warning, discovered the day after the
festival or never.

### Fixed
- The anchor picker names the problem in the option itself: an activity
  without a date reads "Festival of Trust — has no date yet".
- The timeline card stops lying: "1d after Festival of Trust · 11:00" gains
  "— won't send: the anchor has no date" when that is the truth.

## [0.18.16] — 2026-08-29 — a draft you can look at

"Open public page" on a draft thread was a guaranteed 404. The public detail
route refuses anything not active or completed — correct for the public,
but the editor offered a preview the API would never serve, so there was no
way to see the page before publishing.

### Added
- **Draft preview.** The public thread page forwards the visitor's session
  token when one exists; the API serves an unpublished thread to members of
  the workspace that owns it, flagged `is_preview` (additive, rule 8), with
  an amber banner and enrolment closed. Anonymous visitors keep the 404 and
  cannot tell a draft from a thread that never existed — verified all three
  ways, including that a member of a *different* workspace still gets 404.

## [0.18.15] — 2026-08-29 — the read API is a contract

`docs/brief-thread-public-api.md`, all five items. The standalone Thread at
thethread.app had a /developers page and a CORS-open read API; the rebuild had
neither — not by decision, but because a security hardening (the CORS
allowlist, v0.13.17) and the embed build (3.10.0) each happened without
knowing about the other. This closes that gap on purpose, with the discipline
the platform already applies to `/api/v1/apps/*`.

### Fixed
- **The public thread payload no longer spreads the raw row.** `{ ...thread }`
  shipped `workspace_id`, `team_id`, `organiser_id` and `payment_destination`
  to the internet — and would have shipped every future `thread_thread`
  column too. All three public read routes now build their responses through
  explicit mappers; appearing in public is a decision, not a migration side
  effect.
- **Thread's top-level routes joined RESERVED_SLUGS** (`certificate`,
  `developers`, `embed`, `my`). An organiser named `my` would have been
  silently unreachable — the exact bug the reserved-slug file was created for
  in Meet, never extended to Thread. No existing organiser or team held one.

### Added
- **`GET /public/embed/threads`, `/public/organiser/:slug` and
  `/public/organiser/:slug/thread/:threadSlug` are published.** CORS open
  (`*`, no credentials, GET only) on those three exact paths — never the
  `/public/` prefix, because POST `/public/enrol` and `/public/validate-coupon`
  live on it and the enrol form calls them from the browser; a prefix-wide
  cors() would have broken enrolment in production. Enrolment and coupon
  validation stay same-origin deliberately: one writes personal data, the
  other is a discount-code oracle.
- **Rate limiting** (`lib/rate-limit.ts`): 60/min per IP, in-memory fixed
  window (one Fly machine — Redis when that changes). Keyed on what the
  opening actually invites: browser traffic from foreign origins. Our own
  pages funnel through a handful of Vercel egress IPs and are not metered —
  a naive per-IP limit would have throttled the whole site while missing
  every scraper.
- **`thread.thefibre.app/developers`** — the three routes with full field
  tables, the widget snippets, the rate limits, a stability promise, and an
  honest section on why registration is not part of the API. Linked from
  Settings → Website embeds.
- **`scripts/verify-public-api.mjs`** — the contract, runnable (read-only, no
  confirm gate). Asserts every published key, that the internal columns stay
  out, that CORS is open on exactly three paths and closed on their
  neighbours, that our own enrol form still gets its preflight answered, and
  that only third-party browser traffic is metered. 25 checks.

## [0.18.14] — 2026-08-28 — an anchor the database allowed

A message set to send relative to an *activity* — "1 day after the Festival of
Trust" — could never be saved. The dialog returned `new row for relation
"thread_engagement" violates check constraint
"thread_engagement_trigger_anchor_check"`.

Event anchoring shipped on 2026-07-02 in two migrations a few hours apart. The
second added `trigger_engagement_id` and the whole reading side learned
`trigger_anchor = 'engagement'` — the scheduler, the timeline preview, the
public payload. The first had written the column's CHECK the day it only knew
`'start'` and `'end'`, and nobody went back to widen it. Anchoring to the thread
start or end worked, so the gap stayed invisible until someone anchored to an
actual event.

### Fixed
- `thread_engagement.trigger_anchor` now accepts `'engagement'`. The migration
  drops the old constraint by shape rather than by name — it was an inline
  column check, so its name was Postgres's to choose.

### Changed — the error line in a dialog says something
The reason that bug read as `new row for relation "thread_engagement"
viola…` is two separate faults, both now fixed.

- `apps/api/src/lib/pg-error.ts` turns a Postgres error into one sentence a
  person can act on ("The end time has to be after the start time."), keyed on
  constraint name first and SQLSTATE second, with an honest generic fallback.
  The raw driver text rides along under `detail`, and the full error object
  still goes to the server log — that stays the first stop when debugging.
  Wired into the engagement, ticket and coupon writes: the six routes behind
  the four dialogs that show an error line.
- `components/ui/form-error.tsx` replaces `truncate max-w-xs`, which clipped
  every message at roughly half a sentence regardless of what it said. Wraps,
  keeps the full text in `title`, `role="alert"`.

## [0.18.13] — 2026-08-28 — a host who has no Fibre account

§1 of `docs/brief-thread-event-settings.md`. Hosts & Facilitators on a thread
is `thread_thread_organiser`, which pointed only at `thread_organiser` — a
storefront, needing a Fibre `user`. A festival's hosts sign in to the planner's
own database and never will have one, so they could not be listed at all.

**One list, not two.** The alternative was a second table for "credited on this
thread", which would have left two lists meaning nearly the same thing and every
reader joining both.

### Added
- **`thread_thread_organiser.person_id`** — a row now names either an organiser
  (a storefront, unchanged) or a person directly. Exactly one of the two,
  enforced by a check constraint.
- **`POST /apps/:slug/thread/threads/:id/hosts`** — credit a host by the app's
  own record id, already linked through `/links`, so the app never handles a
  platform UUID. `role` is `host` or `facilitator`. Idempotent on
  `(thread_id, person_id)`: a repeat call updates the role rather than adding a
  second row. Scoped `write:programs`, matching the other thread writes —
  crediting a host writes to the thread, not to the person.
- The workspace-side thread read returns `person` alongside `organiser`, so the
  rows are not invisible to The Thread.

### Notes
- **The primary key moved** from `(thread_id, organiser_id)` to a surrogate
  `id`. That pair is what pinned `organiser_id` to NOT NULL. Both pairings are
  now plain UNIQUE constraints — deliberately **not** partial indexes, because
  `ON CONFLICT (thread_id, organiser_id)` in `routes/thread.ts` can only infer a
  full unique index, and a partial one would have broken the existing members
  upsert. Postgres treats NULLs as distinct, so person rows carry a NULL
  `organiser_id` and never collide.
- The brief's suggested `role` values (`co_organiser`) are stale; the column was
  widened to `host | facilitator` in 20260702110000. The route follows the
  column.
- **The Thread's own UI does not render person hosts yet.** The data is
  returned; the members screen still assumes an organiser and its invite
  dropdown still says "Choose a workspace member…". Nothing breaks — a person
  host simply does not appear there until that screen is updated.


## [0.18.12] — 2026-08-28 — an event the owning app can actually describe

§2 of `docs/brief-thread-event-settings.md`. A festival could be published as a
draft thread and then not described: every setting an organiser reaches for
lived in The Thread's own UI, behind a workspace login the festival's organiser
does not have. The columns already existed; the app surface did not expose them.

### Added
- **Eight fields on `PATCH /apps/:slug/thread/threads/:id`** —
  `timezone`, `language`, `requires_approval`, `public_interaction`,
  `share_participants_public`, `share_participants_participants`,
  `price_cents`, `price_currency`. No schema, no new route.
  Each Zod shape mirrors its column exactly: a NOT NULL column is
  optional-but-not-nullable, so a null is a 400 from us rather than a 500 from
  Postgres, and `language` / `public_interaction` are enums matching their check
  constraints instead of free text.
- **`language`, `public_interaction` and both `share_participants_*` are now
  returned** by the thread response. They were settable-but-unreadable
  otherwise, and the planner has to render current values to mirror them as its
  own settings screen. Additive, per the rules at the top of `app-thread.ts`.

### Notes
- `price_cents` and `price_currency` stay nullable: a free event is null stated
  deliberately, not a field left unset.
- **`registration_fields` is deliberately not exposed.** It shapes what is asked
  of a registrant, and the data wall exists precisely so an app does not reach
  into that — the caution is in the brief and now in the code.
- `status: 'active'` is commented as the single act it is: the page is live
  *and* enrolment is open. That is §3 of the brief, which asks for naming rather
  than a column, so the note lives where someone would change it.
- Still open from the brief: §1 (hosts — needs a design decision, see below),
  §4 (event templates).


## [0.18.11] — 2026-08-28 — primary means primary

### Fixed
- **`is_primary` on `POST /apps/:slug/memberships` now does what it said.**
  The field was documented as "only one per person ends up marked" and nothing
  did that — no constraint in the schema, and the route did not unset the
  others. Marking one now unsets the rest for that person, kept in the route
  because `org_membership` carries no `workspace_id` for a partial unique index
  to be scoped by.
- **A repeat call is no longer a silent no-op.** It applies `is_primary` and
  `title` to the existing row instead of returning early, so promoting a
  membership to primary works whether or not it already existed.

### Correction to v0.18.10
That release's commit message claims no app route compares the URL `:slug`
against the key's own app, and calls it a pre-existing authorization hole.
**That is wrong.** The check has been in `middleware/app-context.ts` since
v0.14.0 — it compares the path slug to `key.appSlug` and returns
`403 wrong-app` — and `scripts/verify-external-app.mjs` asserts it under "a key
cannot act as another app". The claim came from grepping `routes/` for
comparisons against `ctx.appId`, which is not where the check lives or what it
compares. Nothing was open, and nothing needed fixing.


## [0.18.10] — 2026-08-28 — an app can say who belongs to what

An app could create a person and create an organisation and had no way to
connect them. The graph knew both parties and never the relationship, so the
question "which contacts did this organisation have" had nothing to compute
from — gap 2 in `docs/brief-contacts-from-apps.md`, now closed.

### Added
- **`POST /api/v1/apps/:slug/memberships`** — connect a linked person to a
  linked organisation. Both sides are named by the app's **own** record ids,
  already matched through `/links`, so the app never handles a platform UUID —
  the same reasoning as Flow steps being addressed by key. Optional `title` and
  `is_primary`. Scoped on `write:organisations`, because the edge belongs to the
  organisation's graph.
- Added to `APP_KEY_ROUTES`; without that entry the route would have been
  default-denied and unreachable.

### Notes
- `org_membership` carries no `workspace_id` of its own — it inherits one from
  both ends. Both lookups are already scoped to the key's workspace, so a
  cross-workspace pair cannot be assembled.
- Idempotent by hand on `(person_id, org_id)` where `ended_at is null`, since
  there is no unique constraint to lean on. A second call returns the existing
  row with `created: false`. Two *simultaneous* calls could still both insert;
  a partial unique index would settle it if that ever matters.
- `is_primary` is written as given. Nothing enforces one primary per person —
  no constraint in the schema, and this route does not unset the others — so
  an app can mark several. Worth a decision if it starts mattering.


## [0.18.9] — 2026-08-28 — publish under the workspace when an app names nobody

`POST /apps/:slug/thread/threads` required `organiser_person_id`, and required
that person to have a Fibre account and a Thread organiser profile. The check
was right; what it left the app holding was not.

An external app's organisers sign in to the app's own database. They have no
Fibre account and never will — that is the point of an external app — so they
can never satisfy the check. And no app-facing route lists who in the workspace
*could*, so the app had to supply a UUID it had no way to obtain. In the
Festival of Trust planner that became an environment variable holding an email
address, resolved through `/links` at publish time: configuration standing in
for something the platform already knows.

### Changed
- **`organiser_person_id` is now optional.** Omit it and the workspace publishes
  under its own Thread organiser. Additive — every existing caller still works.
- **A workspace with no organiser gets one derived from its admin**, rather than
  being told to go and visit a settings screen. Rights follow function: a
  workspace admin already holds the authority to publish on the workspace's
  behalf, so requiring a manual visit was a step standing in for a lookup the
  platform can do itself. The storefront is named after the workspace, owned by
  its earliest admin, with no payout account — all editable in The Thread
  afterwards.
- When a workspace has several organisers and the app names nobody, the
  earliest wins. Stable beats arbitrary; `docs/brief-thread-default-organiser.md`
  leaves a `thread_organiser` default flag open for when it matters.

### Notes
- The derived slug follows the same shape as the auto-provision in
  `routes/thread.ts` — a seed plus a short random suffix — rather than the bare
  workspace slug, which would collide with a person who already took it under
  `unique (workspace_id, slug)`.
- `thread_organiser.user_id` is unique across the **whole table**, not per
  workspace, so the insert-conflict recovery looks up by user alone and reports
  clearly when the admin already organises elsewhere.
- Depends on v0.18.8: a workspace with no admin has nobody to derive from and
  returns `this workspace has no admin to publish as` rather than publishing
  under nobody.


## [0.18.8] — 2026-08-26 — a new workspace had no admin, and no way to get one · Meet 2.4.3

Approve an access request, and a workspace is created. The first person signs
in and everything looks normal — workspace, contacts, apps. Then every route
behind a workspace-admin check answers 403: listing app keys, minting one, and
**the members screen**, which is the only place the role could be granted. The
only way to grant the role was a screen that required the role.

An external app could be approved platform-wide, activated on the workspace,
and still never given a credential there.

### Fixed
- **The first user of a workspace is now its admin.** Nothing created the
  `workspace_member` row — the pivot carrying `workspace_role`. Not the
  approval handler (the user doesn't exist yet), and not `resolve_sso_identity`
  when it creates them. The intent was already written down: branch 3 of that
  function says *"the first user in a workspace gets fibre-platform admin —
  they own this workspace"* and grants `app_membership.role = 'admin'`. That is
  the **app** role. The **workspace** role is a different pivot. One word, two
  meanings, and the second one was never written.

  New `ensure_workspace_member()` is called from all three resolve branches, so
  users who predate it heal on next sign-in — the same shape as the existing
  `ensure_user_person` call. First member of a workspace gets `admin`; everyone
  after gets the column default.
- **Backfilled every workspace that already had users but no admin.** One did.
- **`ensureWorkspaceMember` had been failing silently since 2026-07-04.** Its
  signature said `role?: 'admin' | 'member'` and it defaulted to `'member'` —
  but `20260704090000_role_tiers` replaced that check constraint with
  `('super_admin','admin','organiser')`. Every insert violated the CHECK, and
  the error was never read, so all four Meet invite paths believed they were
  writing a membership row and were not. Roles corrected, error now logged.
- **Meet → Internal team could not change anyone's role.** Its dropdown offered
  Member/Admin and posted `'member'`, which the database rejects — the save
  500'd. It now offers Organiser / Admin / Super admin.
- **A workspace super_admin was locked out of Meet → Internal team.** The gate
  read `workspace_role !== 'admin'`, excluding the role above it.

### Added
- **The last admin cannot step down.** `wouldOrphanWorkspace` refuses a
  demotion that would leave a workspace with no admin, on both the Fibre
  members screen and Meet's — the one path that could recreate this bug.
- **`lib/workspace-roles.ts`** — the role vocabulary and `isAdminRole` in one
  place, with the distinction spelled out: workspace admin is **not**
  `user.is_super_admin`. That is the *platform* super admin — what lets someone
  approve an app registration — and it confers no authority over any workspace.
  Same word, unrelated thing.
- **`scripts/audit-workspace-admins.mjs`** — read-only: which workspaces have
  users but nobody who can administer them.

### Note on the bug report
The report's second finding — that the `super_admin` branch of
`requireWorkspaceAdmin` is unreachable because the column only permits
`('admin','member')` — reads the **superseded** constraint from
`20260517000000_permission_tiers`. `20260704090000_role_tiers` replaced it with
`('super_admin','admin','organiser')`, default `'organiser'`. `super_admin` is
a real workspace role, the branch is reachable, and the guard is correct as
written. The stale vocabulary is real, but it lives in Meet's internal-team
surface (fixed above), not in that guard.


## [0.18.7] — 2026-08-25 — a flow you can hand a file · Flow 1.14.0

A nine-step method with 39 default tasks and four `meta` fields per step is an
afternoon of typing in the builder, and a transcription error is invisible
until someone reads a step and finds the wrong trap under it. The Festival of
Trust flow shipped as SQL for exactly this reason. `PUT /flows/:id/graph`
already accepted the whole design — validated, structural checks and all —
but nothing anywhere could hand it a file.

### Added
- **Design file · import.** *Design file* in the flow builder toolbar: paste
  JSON or choose a file, **Check**, then **Import**. Check is a real dry run —
  `PUT /flows/:id/graph?dry_run=1` runs the entire validation and returns the
  plan without touching a row.
- **The plan, before the wipe.** Saving a graph deletes every step of the
  version and re-inserts them. That is fine on a draft nobody has run and it
  must never be a surprise, so the preview states counts (*9 steps replacing
  0, 8 transitions, 39 default tasks*), **which step keys disappear**, whether
  a new version appears because the latest is published, how many runs exist,
  and any `system_key` collision.
- **Design file · export.** `GET /flows/:id/graph` — the same shape the PUT
  accepts, so a flow round-trips: export it, keep the method in version
  control, import it into another workspace. `?version=published` pins to the
  current published version. Import stops being an import feature and becomes
  a way to move a method around.
- **A flow-level block in the design file.** `progression` and `system_key`
  live on `flow_definition`, not the version, so neither travelled in the
  graph — and a design for a self-paced method is not fully expressed without
  `progression`. `system_key` was settable from **neither the UI nor the API**;
  Pulse's pipeline got its own from a migration. Now:

  ```jsonc
  { "flow": { "progression": "open", "system_key": "fot_festival" },
    "steps": [...], "transitions": [...], "step_default_tasks": [...] }
  ```

  `system_key` requires the workspace **admin** role — it is the handle other
  apps resolve the flow by, so repointing it is an administrative act, not an
  editing one. An editor who lacks the role is refused **loudly**, not silently
  dropped: a quietly-unset key means the consuming app finds nothing and nobody
  knows why.
- **`scripts/verify-flow-design-file.ts`** — validate a design file against the
  real schema with no server and no session, before anyone opens the builder.

### Fixed
- **The builder was silently eating fields on every save.** `serialise()`
  emitted only `step`/`title`/`actor_type` for default tasks, dropping
  `description`, `default_assignee_role` and `due_days_after_entry`, and
  dropped step-level `default_assignee_role` too. Because the save wipes and
  re-inserts, opening any flow that had those values and pressing Save
  destroyed them — and it would have turned every import of a rich design into
  a trap. The canvas has no inputs for these fields; it now carries them
  through untouched.
- **`step_key` is accepted as an alias for `step`** on default tasks, and a
  stray `ordinal` no longer fails the parse (order comes from the array, so a
  file whose ordinals restart per step still lands correctly). The Festival of
  Trust design file used both and could not be imported at all.


## [0.18.6] — 2026-08-24 — an app you can switch on is an app that exists

Fibre Sales and Fibre Learn have been placeholders since the phase-0 seed, and
until now a workspace admin could switch either of them on. The toggle worked,
the `workspace_app` row landed, and the workspace then "had" an app that will
never render a page.

### Added
- **`app.released_at`** — null means not built yet. `status` (pending →
  approved → suspended) is about *review*: has a human allowed this app to act.
  `released_at` is about *existence*. Sales and Learn are approved in the review
  sense — they are ours, their curator tables and RLS policies shipped — but
  there is no product behind either. Two questions, so two columns; overloading
  `status` would have made the app-review UI fight this concept over one field.

  Not a hardcoded list in the API or the web app, deliberately: that is the
  mistake v0.14.0 removed with the slug allow-list. If you want to know which
  apps are real, ask the catalogue.

### Changed
- `resolveInstallableApp` refuses an unreleased app with `app "x" is not built
  yet`, so the API and the UI now agree instead of the UI being the only guard.
- Third-party apps get `released_at` at registration — somebody wrote them
  before they registered, so they exist by definition.
- **Settings → Apps** greys unreleased apps out, sorts them to the bottom, and
  shows a **Not built yet** label where the toggle was. No disabled toggle: a
  control you cannot use is worse than no control.

### Notes
- `available: false` in `packages/shared/src/branding.ts` already kept Sales and
  Learn out of the app switcher, so that surface was never wrong. What was
  missing was the same truth on the server, where it can actually be enforced.


## [0.18.5] — 2026-08-24 — the first user of a new workspace could never sign in

Creating the second workspace on this platform surfaced a bug that had been
sitting in `resolve_sso_identity` since 2026-05-16. **Anyone who was the first
user of a new workspace got a completely broken account**: Supabase Auth signed
them in, they landed in the app, and then every single API call returned 401 —
contacts, settings, profile, all of it.

### Fixed
- **`resolve_sso_identity` raised 42702 in its create-a-new-user branch.**
  The function is declared `returns table (user_id uuid, resolution text)`, so
  `user_id` is an OUT parameter. The branch that provisions a brand-new person
  ends with:

  ```sql
  insert into public.app_membership (user_id, app_id, role)
  values (v_user_id, v_platform_app, 'admin')
  on conflict (user_id, app_id) do nothing;
  ```

  An ON CONFLICT target cannot be table-qualified, so that `user_id` is
  ambiguous against the OUT parameter and Postgres refuses the whole call.
  Fixed with `#variable_conflict use_column`, which makes bare identifiers
  resolve to columns. Safe because the body reads `v_user_id` / `v_resolution`
  throughout and never the OUT names.

- **`/sso/resolve` now logs the Postgres error** (code, message, details,
  hint) instead of returning a bare 500. See below for why that mattered.

### Why it hid for three months
Only the third branch of the resolver — create a new person *and* user — hits
that statement. Branches 1 and 2 (match by provider id, match by email) do not,
and every sign-in since May took one of those, because the account already
existed: accounts are auto-created at enrolment, and the seeded users predate
the migration. **The first person ever to reach branch 3 was the first user of
the second workspace.**

The failure mode made it worse. `apps/web/app/auth/callback/route.ts` treats a
resolve failure as non-fatal and carries on — reasonable, since the Supabase
session is genuinely valid — so the user is dropped into the app with no
`public.user` row. The access-token hook then injects no `app_user_id` or
`workspace_id` claim, and the API rejects everything. Nothing anywhere said
why. The only trace was `POST /api/v1/sso/resolve 500` in the Fly access log.

That is the second time the reviewer's note in CLAUDE.md has been earned: the
diagnosis took twenty minutes of hypothesising and about ninety seconds once
the RPC was called directly and Postgres was allowed to say what was wrong.
`/sso/resolve` logs properly now.


### Fixed
- **The user menu had two entries that did the same thing** (Sjoerd, 2026-08-24:
  "under SL (right top), profile and settings are the same"). It was three
  different faults behind one symptom, so three different fixes:
  - **Pulse** was the real bug. It has its own `/settings` *and*
    `/settings/profile`, but both menu items pointed at
    `https://thefibre.app/settings` — so Pulse's own settings (payments, teams,
    offerings, reservations, stages) were unreachable from the menu, and both
    entries bounced you out of the app. Now points at its own two pages, like
    Meet and Thread.
  - **Flow** has no settings of its own; profile and preferences live on the
    platform. Two items to the same external page is noise, so it is one item.
  - **Fibre web** was the platform being the odd one out: Meet, Thread and
    Pulse all have a `/settings/profile`, and web kept those two sections
    inline on `/settings`, so a "Profile" menu entry had nowhere to point but
    the same page as "Settings". It now has the page the others have — your
    details and your public profile moved to `/settings/profile`, and
    `/settings` links to it the way it already links "How The Fibre works".

  Meet and Thread were already correct, which is why the symptom only showed up
  in three of the five apps.


## [0.18.4] — 2026-08-24 — super admins cannot be deleted

The platform has one super admin, and nothing stopped that row being removed.
There is no UI anywhere to grant the flag, so losing it would have meant
nobody could approve a person or an app onto the platform ever again, and
putting it right would have needed a direct write with the service-role key.

### Added
- **`protect_super_admin()` trigger** on `public."user"` — before update and
  before delete. Three rules:
  - a super admin cannot be hard-deleted;
  - a super admin cannot be soft-deleted while they still hold the flag;
  - the flag cannot be removed from the **last** remaining super admin.

  The third is what makes the first two mean anything. Without it the guard is
  bypassable in two innocent-looking steps — revoke from everyone, then delete
  everyone — and the platform ends up with users and no way to administer it.

  It is an **interlock, not immortality**: revoke the flag first, then delete.
  Setting `deleted_at` and `is_super_admin = false` in the same statement is
  allowed, because that is someone saying both things on purpose.

### Notes
- **A trigger rather than app code, deliberately.** `public."user"` is written
  from the API on a user JWT, the API on the service role, the erasure flow,
  one-off scripts and the Supabase SQL editor. RLS does not apply to the
  service role and app code cannot see the SQL editor at all. The database is
  the only place a guarantee like this holds.
- **It guards the role, not two email addresses.** Hardcoding the two current
  admins would rot at the first address change and would say nothing about
  why those rows are special. The real rule is "you must not be able to lock
  yourself out", which is what `is_super_admin` expresses.
- **It cannot cover `auth.users`.** Deleting the Supabase Auth record breaks
  sign-in even though `public."user"` survives. That table belongs to
  `supabase_auth_admin` and adding triggers to it risks breaking Supabase's
  own operations, so it is left alone. The Auth users list stays a sharp edge.
- Verified against the live database: hard delete, soft delete and last-admin
  revoke all refused; ordinary users still soft- and hard-deletable.


### Added
- `apps/api/scripts/grant-super-admin.mjs` — grant, revoke or list platform
  super-admins. No UI for this by design: it is the flag that unlocks Admin →
  Access requests, App registry and Workspaces across *every* workspace, so it
  should be a deliberate act rather than a toggle. Refuses an unknown or
  soft-deleted email, and refuses to revoke the last remaining super admin.
  `--list` is read-only and needs no confirmation.

  Two things its header records, because both are easy to assume wrongly:
  super-admin is **not** in the JWT — it is read from `public.user` on every
  request, so a change lands on the target's next page load with no sign-out —
  and it is **independent of how someone authenticates**, because it follows
  the email address rather than the credential. Google SSO and the emailed
  passcode reach the same account with the same rights.


## [0.18.3] — 2026-08-24 — Admin → Workspaces

A super admin could not see the tenants of their own platform. There was no
workspace list anywhere in the product and no endpoint behind one; the only
way to enumerate them was a script. That gap is how a workspace created by
mistake stayed invisible — Access requests looks like a workspace list and is
not one (it lists `signup_request` rows, so a workspace born any other way,
including the original seeded one, never appears there).

### Added
- **`GET /api/v1/workspaces`** — every workspace with live counts of users,
  contacts, organisations, activity and active apps. Super-admin only.
  Deliberately read-only: no create (approving an access request is the only
  path, and that human gate is the point) and no delete (`workspace_id` is
  referenced by 54 tables — a cascade you cannot preview from a confirm
  dialog). Runs on `adminClient`, because the `workspace_self` RLS policy
  scopes SELECT to `current_workspace_id()` and even a super admin's own JWT
  cannot see another workspace. **The explicit `is_super_admin` check is
  therefore the entire gate, not a nicety on top of RLS — do not remove it.**
- **Admin → Workspaces** (`/admin/workspaces`), plus its sidebar entry.
  An **Empty** badge marks any workspace nobody has ever signed into (no
  users, no contacts, no activity) — the signal the page exists for. A count
  that fails renders `?` rather than `0`, because on this page a false zero is
  the one genuinely wrong answer: zero is exactly what "safe to delete" looks
  like.

### Notes
- Counts filter soft-deleted rows, so they read lower than raw table counts —
  23 live contacts against 38 rows, 4 active apps against 6 `workspace_app`
  rows. That is the intended reading: what is actually in the workspace.
- If a delete is ever added here, it must refuse unless the workspace is
  provably empty, the way the one-off Festival-of-Trust cleanup did. A confirm
  dialog is not a substitute for a precondition.


### Added
- `apps/api/scripts/inspect-tenancy.mjs` — read-only diagnostic printing every
  workspace, signup request, user and organisation, plus per-workspace row
  counts. Writes nothing. Added while undoing an accidentally-provisioned
  workspace; the useful lesson was that `approve` on a signup request is the
  *only* thing that creates a `workspace`, and it is not reversible from any UI.

## [0.18.2] — 2026-08-24 — The pages our email has always linked to

`FOOTER_LINKS` in `packages/shared/src/branding.ts` has footered every
transactional email we have ever sent with Help / About us / Legal, pointing at
`thefibre.app/support`, `/about` and `/terms`. None of the three routes
existed. Worse, `apps/thread/lib/policies.ts` made `/terms` the **privacy
policy a participant is required to tick before enrolling** — so every enrolee
so far has accepted a document that 404'd.

### Added
- **Four public routes** in a new `app/(public)/` group — outside `(app)`,
  whose layout bounces anyone without a session back to `/`. These are read by
  people who are not signed in and may not have an account at all.
  - **`/about`** — what the platform is for, the apps, who operates it.
  - **`/support`** — where to write, what to try first, response times,
    how to report a vulnerability.
  - **`/terms`** — terms of use: access, acceptable use (including the duty
    that comes with recording data about other people), ownership, apps and
    the wall, payments through an organiser's Stripe account, availability,
    liability, Dutch law.
  - **`/privacy-policy`** — the real GDPR statement: the controller/processor
    split, what is held and why, what does *not* cross the data wall, legal
    bases, EU locations, the complete sub-processor list (Supabase, Fly.io,
    Vercel, Resend, Stripe, Google), retention and soft delete, Article 15/17,
    and why there is no cookie banner.
  - Both legal documents carry a visible "last updated" date and a source
    comment saying they have **not been through a lawyer**.

### Changed
- **The Thread's required policy now points at `/privacy-policy`**, via
  `FOOTER_LINKS.privacy` rather than a hardcoded URL, and its version moves to
  `2026-08-24` — enrolments from here on record acceptance of a document that
  exists. Earlier enrolments hold `privacy@2026-07-02`, which never did.
- **`FOOTER_LINKS` gains `privacy`**, and email footers (HTML and plain text,
  both template files) gain the matching link.
- **The landing page's "Privacy" link** pointed at `/privacy`, the signed-in
  consent dashboard inside `(app)` — a logged-out visitor clicking it was
  redirected straight back to the landing page. It now goes to
  `/privacy-policy`, alongside new Terms and About links.

## [0.18.1] — 2026-08-24 — The Help link goes somewhere

Every Fibre sidebar has had a **Help** link in its footer since the shell was
first built. In all five apps it pointed at `/help`, and in all five apps that
route did not exist — clicking Help 404'd. Pre-existing, not introduced by
v0.17.1; found while wiring up Settings → How The Fibre works.

### Added
- **`/help` in all five apps** — The Fibre, Meet, The Thread, Flow and Pulse.
  Each page is app-specific and has three parts:
  - **Getting around** — one card per sidebar entry, saying what it is for.
    The blurbs are lifted verbatim from the pages' own headers, so Help can
    never quietly contradict the page it describes.
  - **The rest of your Fibre** — the other apps, with their taglines, built
    from `buildAppList()`. Same rule as the app switcher: switched on for the
    workspace *and* you are a member. No hardcoded app list (v0.14.0's rule).
  - **Read more** — through to *How The Fibre works*, plus where the app
    contract and the changelog live for anyone building against the platform.
- **`@thefibre/shared/ui/help`** — the page chrome, written once. Server
  renderable (no hooks, no `'use client'`); `next/link` is injected as a prop
  so the shared package keeps no Next.js dependency. Five copies of this
  layout would have drifted the way `date-field` did before v0.13.105.

### Changed
- The sidebar Help link now takes the selected style when you are on `/help`,
  like every other nav item.

## [0.18.0] - 2026-08-24 - The Thread opens to external apps

`docs/brief-thread-and-registrations.md` §1-§3. The planner could already run
the nine steps on Flow; it could not publish the festival or see who came. The
Thread had no app-facing surface at all - every `/api/v1/thread/*` route runs on
`userClient(ctx.jwt)` and is bounded by RLS acting on a real signed-in user, so
an app key was denied everything.

### Added
- **`routes/app-thread.ts`** - publish a programme as a public page, read it
  back, edit it as the plan firms up, and see who registered. Deliberately
  narrow, following `app-flow.ts` rather than inventing a second shape: app keys
  only, an app sees only what it created, published shape rather than table
  shape, additive-only contract, asserted in `verify-external-app.mjs`.
- **Three scopes** - `read:programs`, `write:programs`, `read:enrolments`. There
  is **no `write:enrolments`**, by design: an app that could write enrolments
  could enrol arbitrary people in arbitrary programmes, and that row is what the
  whole certificate and payout chain hangs off. Registration comes from the
  public form, never from an app.
- **`program.source_app` / `source_ref`** - a festival is a `flow_run` in Flow
  and a `program` + `thread_thread` in The Thread, and nothing connected them.
  Same columns as `flow_run` got in 20260709080000, deliberately: this is the
  third time "which app owns this mirrored row" has come up, and a third
  convention would be the mistake. A planner sets `source_ref` to its own plan
  id on both, and the edge is derivable with no join table. It also makes
  publishing idempotent - a retry returns the same page, not a second one.

### The wall through `thread_enrolment`
A registration is a **platform** row (`enrolment`); The Thread layers commerce
and form answers on top. So the enrolments route reads platform data through a
Thread-shaped lens rather than reaching into another app's private tables - but
`answers` (the registration form responses, marked "never crosses the wall" in
the schema since it was written), `amount_cents`, `coupon_id`,
`stripe_session_id` and `stripe_payment_intent` must never leave.

`payment_status` does leave. It is a state, not an instrument, and a
registration list without it would be useless.

**The wall assertion was tested by sabotage rather than assumed.** That
established something worth writing down: `select('*')` on its own leaks
nothing, because the response is built field by field and the mapping filters.
The regression to fear is a `...r` spread in that mapping, which reads as a
harmless tidy-up - and which the assertion does catch, loudly. The file's
comment originally claimed the select was the protection; it now says which
does the work, and why the column list is still worth keeping.

### Fixed
- **`docs/fibre-briefing.md` listed every app path without its `/api/v1`
  prefix.** A client written from that table verbatim would 404 on every call,
  and it is the first thing an integrator copies. Paths are now written in full.

### Notes
- An app cannot invent an organiser. `POST /thread/threads` takes an
  `organiser_person_id` - a person, because the app already links its organiser
  to a Fibre person and should not have to learn about platform user rows - and
  that person must have both a Fibre account and a Thread organiser profile.
  Publishing under a storefront nobody owns would leave a public page with no
  human behind it.
- `PATCH` deliberately cannot touch price, payment destination, certificates,
  tickets or registration fields. Those are money and credentials, and they
  belong to a human in The Thread's own UI.

## [0.17.1] — 2026-08-24 — Settings → How The Fibre works

The platform could explain itself to a developer (`docs/building-on-the-fibre.md`)
and to nobody else. This is the same contract, in the product, in plain words —
so a workspace admin deciding whether to switch an outside app on can actually
see what they are agreeing to.

### Added
- **Settings → How The Fibre works** (`/settings/about`). One page, twelve
  sections, three hand-drawn SVG diagrams:
  - **The building** — the front desk keeps the register; each app keeps its
    own files; outside apps come through one door with a badge.
  - **The data wall** — what the platform owns, what an app owns, and the three
    openings between them.
  - **The badge** — the same app, drawn twice: reaching everything a borrowed
    staff sign-in reaches, versus the two things an `app_key` reaches. The
    blast-radius difference is the whole argument for v0.14.0, and it is much
    easier to see than to read.
  Plus the complete app-key route list with the scope each one costs, the
  permission vocabulary (including `write:flows` struck through, because it
  deliberately does not exist), a rule-by-rule table of *what actually enforces
  this*, why it was built this way, what it costs, and a glossary that
  translates every term on the page.
- The diagrams are drawn entirely with the app's own tokens (`surface` / `ink` /
  `line`), so both themes come for free; amber is reserved for "outside the
  building" and red for "refused".
- Live facts on the same page: version, workspace, plan, and which apps are
  actually switched on here.

### Changed
- **`VERSION` moved to `apps/web/lib/version.ts`.** It was a private const in
  `app/(app)/layout.tsx`, which meant a second surface wanting to show it had
  no way to ask. The sidebar footer and the new page now read the same
  constant. `CLAUDE.md` updated to point at the new file.

### Notes for whoever picks this up
- `settings/about/reference.tsx` restates `APP_KEY_ROUTES`
  (`middleware/app-context.ts`) and `APP_SCOPES` (`lib/app-keys.ts`) in plain
  English. Those two files are the source of truth — add a route or a scope
  there and this page starts lying to people until it is updated too. The file
  header says so.


## [0.17.0] — 2026-08-24 — Flow 1.13.0: steps gain sections and app-defined fields

The last two structural gaps under the Festival planner
(`docs/brief-flow-as-planner-engine.md` gaps 3 and 4). `flow_step` had taken no
new columns since it was created; these three are the ones it needed.

### Added
- **`flow_step.group_key` + `group_label`** — an optional section. The
  planner's nine steps fall into three phases (orientation, doing,
  culmination) that drive its whole visual system, and a step had `ordinal`,
  `kind`, `canvas_x/y` and nothing to say "these three belong together". Any
  flow long enough to need sections wants this, so it is a platform column.
  `group_key` is the stable one consumers group on; renaming `group_label`
  moves nothing.
- **`flow_step.meta jsonb`** — app-defined fields the platform never
  interprets. The planner needs three descriptions per step (purpose, trap,
  reflection) where `flow_step` offers one. Deliberately not three columns:
  hard-coding one app's fields invites the next app's four. The brief calls it
  "the curator-data problem in miniature" and it gets the same answer — the app
  justifies the field, so the app carries it.
- Both are **exposed on the app-key contract**, additive per the rules at the
  top of `routes/app-flow.ts`: `group_key`, `group_label` and `meta` appear on
  every step in `GET /apps/:slug/flow/flows/:id` and
  `GET /apps/:slug/flow/runs/:id`. `meta` is `{}` rather than null when unset,
  so a consumer can read `meta.whatever` without a guard.
- **A UI home in Flow's builder**, not just columns. The step inspector gets a
  Section pair and an Extra-fields JSON editor. Without it these would be
  settable only by SQL — the exact pattern v0.14.0 removed from the app
  catalogue.

### Fixed
- **The graph save would have silently destroyed all three.** Saving a flow
  wipes and re-inserts every step, so a column not carried through
  `GraphStep` → `loadGraph` → `stepRows` is lost the first time anyone opens
  the builder and hits save. All three are wired through that round-trip, and
  the migration carries a note for whoever adds the next column.
- A step whose `meta` won't parse now **blocks the save** rather than being
  dropped — since the save wipes first, dropping it would destroy the stored
  value.
- **`verify-external-app.mjs` no longer strands a person per run.** Each run
  soft-deleted the person its activity pinned and the next run created another,
  so the residue only ever grew (it reached 13). A re-run now revives exactly
  one dormant row instead. Two subtleties, both found by running it rather than
  reasoning about it: reviving *all* of them made the linker's `maybeSingle()`
  match many rows and create yet another, and doing the revive before the
  soft-delete loop meant the same pass undid it.

### Notes
- The 13 already-stranded rows can't be collected — each is pinned by its own
  append-only activity row. All are soft-deleted and invisible.

## [0.16.1] — 2026-08-23 — The app contract, written down and enforced

Sjoerd asked the right question before building the Festival planner's UI
layer: *"is there a proxy where all input and output can be translated even if
changes happen, or does the planner need an update every time Flow gets an
update?"*

The proxy already existed — `/api/v1/apps/*` is deliberately not the shape of
our tables, which is why 0.16.0 could rebuild how Flow stores and materialises
tasks without a consumer noticing. What was missing was the discipline that
makes the indirection worth anything, and a document saying so.

### Added
- **The additive-only rule**, stated where it will be read: a `THE CONTRACT`
  block at the top of `routes/app-flow.ts`, and hard rule #8 in CLAUDE.md. A
  response key that has shipped is permanent — no renames, no removals, no
  retypes, and no quiet changes of meaning, which break a caller just as hard
  and no type checker catches.
- **`CONTRACT_SHAPES` in `verify-external-app.mjs`** (step 7b) — every
  app-facing response asserted key by key, so a rename fails CI instead of
  somebody's integration. It caught a wrong assumption on its first run.
- **`docs/building-on-the-fibre.md`** — the canonical instruction document for
  *any* app on the platform, in-family or external. The data wall and why it
  is not negotiable, the app-justifies-the-field rule, the three sanctioned
  crossings, the seven platform rules, manifest → register → approve →
  activate → key, every surface including Flow, the stability contract in
  full, what differs for in-family apps, and what is honestly not built yet.
  Replaces `third-party-app-guide.md` (renamed; its content is §3–5).

### Why 0.15.0's rename is called out by name
It returned `step_filed` from the create-task route and 0.16.0 renamed it to
`step_key`. Nothing consumed it, so nothing broke — but nothing stopped it
either, and that is exactly the class of change this release exists to catch.
The contract block cites it rather than hiding it.

## [0.16.0] — 2026-08-22 — Flow: a task knows its step, and a flow can be self-paced

The rest of `docs/brief-flow-as-planner-engine.md` (items 4 + 6). 0.15.0 let an
app key own Flow runs; this makes the engine itself able to hold a sequence
somebody walks at their own pace. Flow 1.12.0.

### Added
- **`flow_task.step_id`.** A task's step used to be *derived* — through
  `flow_step_default_task.step_id`, or through gate → transition →
  `from_step_id` — so a manually created task belonged to no step at all. That
  was a defect in Flow, not merely something the planner wanted: "add a task to
  this step" is an ordinary thing to do and the row could not record it.
  Backfilled from both templates; indexed on `(flow_run_id, step_id)`.
- **`flow_definition.progression`** — `'gated'` (unchanged: one cursor,
  authored edges, gates that hold a contact until required tasks are done) or
  `'open'` (a sequence you move through at your own pace). An open flow
  materialises **every** step's tasks when a run starts, so all of them carry a
  real status from the first render, and writes **no due dates**, so nothing in
  it can ever be overdue. Arriving at a step no longer re-seeds it.
- **A "Make self-paced" toggle** in Flow's own lifecycle menu, with a
  self-paced marker in the flow header. `POST /flow/flows` and
  `PATCH /flow/flows/:id` accept `progression`.

### Why open flows write no due date
The engine is perfectly able to express lateness; the surfaces built on it must
never surface it. Rather than teach every reader to suppress overdue styling
for one kind of flow, an open flow simply never writes a `due_at` — including
ignoring a template's `due_days_after_entry`. A schema that can represent an
overdue festival step would eventually show one.

### Changed
- The app-facing surface reads `step_id` directly instead of reconstructing it,
  and `POST /apps/:slug/flow/runs/:id/tasks` now stores the `step_key` it has
  been accepting since 0.15.0. `unfiled_tasks` holds only legacy rows whose
  step could not be recovered at backfill time.
- `materialiseTasksForStep` stamps `step_id` on everything it creates and takes
  a `noDueDates` option; `materialiseAllSteps` is the open-flow entry point.
  Both surfaces share them rather than forking.

### Verified
`verify-external-app.mjs` step 7 now also proves: a step the run never visited
already holds its tasks, no task anywhere carries a due date (the fixture sets
`due_days_after_entry` on purpose), and a task the app adds with a `step_key`
comes back filed under that step with nothing adrift. All eight steps pass.

## [0.15.0] — 2026-08-22 — Flow, reachable by an app key

The Festival of Trust planner stays **external** (Sjoerd, 2026-08-22: "It is an
external app, that can communicate with everything from Fibre: the Fibre, the
Flow and also the Thread later"). v0.14.0 gave external apps a credential; this
lets that credential own Flow runs, so an app outside the monorepo can run a
shared, durable process without inventing its own tables.

`docs/brief-flow-as-planner-engine.md` items 1–3. `verify-external-app.mjs`
grew a seventh step covering the whole surface; all eight pass against the live
database.

### Added
- **`read:flows` + `write:flow_runs`** in `APP_SCOPES`. Deliberately no
  `write:flows` — an app *consumes* a flow, it never authors one. Steps,
  transitions and gates stay with the people in Flow.
- **The app-facing Flow surface** (`apps/api/src/routes/app-flow.ts`), under
  `/api/v1/apps/:slug/flow/*`: list consumable flows, read a flow's published
  shape (steps in order with their task templates), start a run, read it back
  as steps-with-tasks-and-status, move it, add and check off tasks, and keep
  one note per step. Steps are addressed by `key`, never uuid — an external
  app should not have to carry platform identifiers it cannot interpret.
- **A per-(run, step) note an app can rewrite.** `flow_run_note.app_id`
  separates an app's single reflection from the append log a person keeps in
  Flow, with a unique index so concurrent writes can't leave duplicates.
  Empty body clears it.
- **Idempotent run creation.** Pass your own `source_ref` and a retry returns
  the run that already exists — no duplicate, no 409.

### Why a separate route file rather than allow-listing `/api/v1/flow/*`
Every route in `routes/flow.ts` runs on `userClient(ctx.jwt)` and is bounded by
RLS acting on a signed-in user. There is no user behind an app key, so those
routes would have denied everything. This mirrors the choice v0.14.0 already
made for persons and organisations: the app-facing equivalents live under
`/apps/:slug/*` and filter by workspace explicitly on the service-role client.
Because that client bypasses RLS, the handlers carry the rules themselves —
app keys only (a user session is refused and pointed at `/api/v1/flow/*`), and
an app reaches only runs whose `source_app` is its own. Reading definitions is
limited to workspace-scoped flows; personal and team flows are somebody's
private working set, not a public capability.

### Changed
- `flow_task.created_by` and `flow_run_note.created_by` are **nullable**. They
  assumed a human behind every write; `actorUserId()` returns null for an app
  key by design, so an app creating a task or a note violated the constraint.
  Null now means "an app wrote this", and the owning app is recoverable — from
  the run's `source_app`, and for notes from `app_id`.
- `materialiseTasksForStep` is exported from `routes/flow.ts` and takes a
  nullable `personId` / `createdBy`, so both surfaces seed tasks the same way
  instead of forking the logic.
- Tasks an app creates carry no `due_at`. A companion-style app cannot
  accidentally start nagging.

### Notes
- A run needs no person: `person_id`, `organisation_id`, `subject_label` or any
  combination. A festival is a legitimate subject.
- Per-step status is derived from task counts (`not_started` / `in_progress` /
  `done`), not from `current_step_id`. `POST /runs/:id/move` already jumped to
  any step bypassing gates, so free navigation needed nothing built — the
  cursor is reported as `current_step_key` and a companion app can ignore it.
- Still open, and the next item: `flow_task.step_id`. A task's step is derived
  through whichever template created it, so a task an app adds comes back under
  `unfiled_tasks`. `step_key` is accepted and validated on create so callers
  write against the final contract, but it cannot be stored yet.

## [0.14.0] — 2026-08-22 — The Fibre welcomes external apps

`docs/brief-external-apps.md` came out of a real attempt to integrate the
Festival of Trust planner from outside this monorepo. Its honest verdict on
"can The Fibre host external apps?" was **not yet** — one structural blocker
and a set of missing pieces. This closes all of them.

`apps/api/scripts/verify-external-app.mjs` runs the brief's six-step
verification end-to-end against a live API. All six pass.

### Added
- **An open app catalogue.** `public.app.slug` carried an allow-list
  (`app_slug_check`), so every app since phase 0 registered itself by dropping
  the constraint, inserting, and re-adding it with its own slug appended —
  inside a platform migration. Registering an app was a *schema change against
  the platform database*, which meant the set of installable apps was fixed at
  platform build time and nobody outside the platform team could add one.
  Slugs are now validated by **format**; the guard the allow-list stood in for
  moved onto the row as a lifecycle: `pending → approved → suspended`, plus
  `kind`, `owner_user_id` and `manifest`. Deliberately shaped like
  `signup_request` rather than inventing a second review pattern.
- **`POST /api/v1/apps/register`** — unauthenticated, because an app
  registering itself has no credential yet. Lands a `pending` row.
- **Admin → App registry** (`/admin/apps`) — super admins approve, reject,
  suspend and reinstate. The card shows the scopes the app asked for and the
  activity types it declared, because that is what you are actually deciding
  about. Suspending revokes its keys and deactivates it everywhere.
- **`app_key` — server-to-server credentials scoped to (app × workspace).**
  Before this, an external app authenticated with a *user-scoped* Supabase JWT
  pulled from a signed-in browser. That ruled out background sync, and — the
  serious half — handed a third-party app the user's full platform authority
  in every app, whatever its manifest asked for. A key carries the app's
  authority, in one workspace, bounded by scopes. The token is returned once
  at mint time; only its SHA-256 hash is stored.
- **Settings → Apps → Manage API keys** — mint (scopes ticked from what the
  manifest requested), see `last_used_at`, revoke.
- **Scope enforcement.** `scopes_requested` was "declarative only — not checked
  at request time". Now: a key can never carry a scope its manifest didn't ask
  for, and an app key reaches an explicit allow-list of routes and nothing
  else. Everything outside is a 403 regardless of scopes held, so widening an
  app's surface is a deliberate edit rather than a side effect of granting a
  scope. General `/persons` and `/organisations` stay unreachable — they run on
  a user's RLS identity and a key has none.
- **Organisation links.** `POST /apps/:slug/links` was person-only, so the
  planner's declared `festival_host → organisation` mapping could not be
  written at all. Orgs match on `domain`, then `name`. The required scope
  follows the mapping's target, not the URL.
- **Bulk linking** — `POST /apps/:slug/links:bulk` (and `/links/bulk`), up to
  500 per call, bounded concurrency. Partial success is the honest outcome for
  a batch, so every item reports its own result and the response is 207 unless
  all landed.
- **`GET /apps/:slug/organisations/:app_entity/:app_record_id`** — the org twin
  of the person resolver.
- **`PUT /apps/:slug/manifest`** — install entity mappings and declared
  activity types into a workspace. Was SQL.
- **`GET /apps/whoami`** — an app verifying its own credential and scopes.

### Changed
- **Activity types are validated against the manifest.** The API accepted any
  snake_case type, so a typo landed silently on a workspace timeline — and
  activity is append-only, so it stayed there. An app that declared types is
  now held to them (400 with the declared list). Apps that declare none keep
  the old behaviour; every first-party app relies on that.
- **`workspace_app` activation refuses anything not `approved`**, enforced by a
  trigger so it holds regardless of which client writes the row. Deactivation
  is always allowed, or a suspension would trap the workspace.
- **Settings → Apps is catalogue-driven.** The installable list was a constant
  in the page — the web-side twin of the closed allow-list. An approved
  third-party app now appears with no code change.
- `X-App-ID` is only accepted for **approved** apps.
- `app` read policy: approved apps stay readable by everyone (they are
  reference data); pending and suspended ones are visible only to their
  submitter and to super admins.
- `docs/third-party-app-guide.md` rewritten around registration and keys. Its
  "Open gaps" list lost five of its seven entries.

### Notes
- `scripts/verify-external-app.mjs` requires `FIBRE_VERIFY_CONFIRM=1`. There is
  one Supabase project, so "local" only ever describes the API process — the
  script always writes to the real workspace. It cleans up after itself, with
  two exceptions forced by the platform's own rules: `activity` is append-only,
  so its one activity row is permanent, and that row pins both its person (soft
  deleted, per the personal-data rule) and the app row (left `suspended`).
- Deviation from the brief's sketch: `app_key` has **no** `unique (app_id,
  workspace_id)`. That would make rotation a hard cutover — you could not mint
  the replacement before revoking the incumbent. Several live keys per pair are
  allowed instead.

## [0.13.155] — 2026-07-15 — Pulse 0.27.0: pick the cashflow you land on (home page)

### Added
- **A cashflow chooser on the home page** (Sjoerd 2026-07-15: "in the home
  page you should be able to select the cashflow of pref you want to land
  on"). The dashboard header now carries a **Cashflow** dropdown — Me, each
  team you're in, and Workspace (admins/granted). The projection, the stat
  cards and the runway sentence all follow the choice.
- It writes the **same** preference the cashflow tab bar uses, so it's a
  shared "preferred cashflow": pick it once on the home page and both the
  dashboard AND the cashflow grid land on it next time. Selecting refreshes
  the home page in place (no jump to the grid).
- The chooser only appears when there's more than one cashflow to pick from;
  Workspace collapses to Me when you can't read it, and a stale team choice
  falls back to Me.

## [0.13.154] — 2026-07-15 — Pulse 0.26.1: "Later" money no longer inflates the last month's end position

### Fixed
- **The END POSITION stops at the visible horizon** (Sjoerd 2026-07-15: "what
  comes later is not in the last month"). Money expected beyond the projection
  window ("Later") was being bucketed into the final visible month, so the
  last column's end position absorbed income that hasn't arrived yet (e.g. a
  €17.280 "Later" receivable flipping Jan 2027 from a deficit to a surplus).
  `bucketFor` now returns no bucket for at/after-horizon dates, matching the
  grid's own Later boundary — the Later column still shows the money; the
  running balance simply doesn't count it.

## [0.13.153] — 2026-07-15 — Pulse 0.26.0: per-row payment dates (multiple payments per project)

### Added
- **A date at row level** (Sjoerd 2026-07-15: "if it has multiple payments
  per project, there should be a date added at row level"). Once an offer has
  **2+ offering rows**, each row gains an **Expected** date column. Set
  different dates and the project fans out into **one payment per date** in
  the cashflow; leave a row's date blank and it inherits the offer's top-level
  Expected date. A single-row offer is unchanged (one date, one payment).
- Repeating rows are timed by their cadence, so they show "—" instead of a
  date (no one-off date applies).

### How it flows
- The per-row date is stored on the offering row (`pulse_commitment_item.
  expected_date`) and DERIVES the payment-line schedule on save — the
  projection still reads lines, so the grid, totals and reserves need no
  change. Existing un-invoiced lines are reused by date to avoid churn; once
  an offer is invoiced/settled its schedule is locked.

### Fixed (infra)
- Resolved a same-day migration-timestamp collision (two `20260710120000_*`
  files) that was blocking `supabase db push`. `pulse_cashflow_grants` moved
  to `20260710130000`; both were already live on remote.

## [0.13.152] — 2026-07-15 — Pulse 0.25.0: duplicate an offer into an independent row

### Added
- **Duplicate an offer** (Sjoerd 2026-07-15: "copy a project no. → it should
  duplicate the row, so each offer can be altered separately"). The offer
  dialog now carries a **Duplicate** button (Fibre dialog contract:
  Delete·Duplicate left, Cancel·Save right). It deep-copies the deal —
  fields, offering rows AND expected payments — into a brand-new row named
  "… (copy)" in the same cashflow, right after the original. Each copy is
  fully independent from then on.
- The copy is a **fresh, not-yet-invoiced** offer: the invoice number,
  invoice date, purchase-ledger link and per-payment invoice/settle state
  are never carried over (same convention as ⌥-drag line copies).

## [0.13.151] — 2026-07-10 — Pulse 0.24.0: currency picker (and the grid respects it)

### Added
- **Currency is a picker** (Sjoerd's 8: Euro, US Dollar, South African
  Rand, Swiss Franc, Chilean Peso, El Salvador (USD), Brazilian Real,
  UAE Dirham) in Settings → Planner → Time rhythm & currency.
### Fixed
- **The cashflow grid now formats in the chosen currency** — it was
  hardcoded to € regardless of the setting. All grid amounts follow
  the workspace currency now.

### Note
- This is the workspace-level default. Per-team / per-person overrides
  (workspace > team > person) are the next step — they slot onto the
  existing cashflow-scope model.

## [0.13.150] — 2026-07-10 — Thread 3.32.0: per-day timing for multi-day activities

### Added
- **Time per day** — a switch on the activity dialog (Sjoerd 2026-07-10).
  When on, set a First/Last day and a daily begin/end time that prefills
  every day; edit any single day's row to override it (e.g. a shorter
  final day). Stored as `thread_engagement.daily_schedule` (jsonb; null =
  the previous single start/end range). The public thread page and the
  in-app timeline render one row per day (Mon 2 Mar · 09:00–17:00); the
  outer `starts_at`/`ends_at` envelope stays populated so sorting and the
  scheduler are unaffected. Migration `20260710120000`.

## [0.13.149] — 2026-07-10 — Thread 3.31.5: new thread/team lands on a filled page (was empty until refresh)

### Fixed
- Creating a thread (or team) navigated to a blank page — no title, no
  settings — until a manual browser refresh. A `router.refresh()` fired
  synchronously right after `router.push()`, racing the navigation so the
  destination mounted against a cleared router cache. Removed it; `push`
  alone fetches the new route fresh (matching the certificate, duplicate
  and template-instantiate flows that never had the bug).

## [0.13.148] — 2026-07-10 — Fibre Pulse joins the platform app surfaces

### Fixed
- **Pulse (and Flow) were missing from the web dashboard's app tiles** —
  a hardcoded APP_DOMAINS map on thefibre.app listed only meet/thread/
  sales/learn. Both added. Also registered fibre-pulse in the web app
  catalogue (apps/web/lib/apps.ts: descriptor + APP_ORDER) so it appears
  in the members grant grid and can carry a per-app contact/org profile
  tab. The app-switcher dropdowns already derived from the shared
  registry, so they had Pulse already.

## [0.13.147] — 2026-07-10 — Pulse 0.21.0: the payment is derived, not a separate list

### Changed
- **The "Expected payments" editor is gone** (Sjoerd: "all info is above
  — I don't need that separate list"). A deal is now just its offering
  rows + the Expected date; the single payment that drives the cashflow
  is DERIVED from them (deal total on the expected date) — no parallel
  list to keep in sync, so a price edit always flows through. Invoice
  and settled state still freeze a line; any pre-existing staged
  (multi-payment) schedule is preserved untouched.

## [0.13.146] — 2026-07-10 — Pulse 0.20.2: editing a price flows to the payment

### Fixed
- **"I changed the amount in an income and the list wasn't adapted"**:
  offering rows (or legacy quantity × unit price) describe the deal;
  the payment line is what actually lands in the grid, and the two
  could drift after a price edit. Now a single, not-yet-invoiced
  payment auto-resyncs to the deal total on save — editing the price
  flows straight to the cashflow. Staged multi-payment schedules are
  still yours to manage by hand.

## [0.13.145] — 2026-07-10 — Pulse 0.20.1: drag a recurring occurrence to reschedule the series

### Added
- **Recurring rows are draggable now** (Sjoerd: "why can't I drag costs
  like income" — they were recurring, and recurring occurrences weren't
  draggable, in either direction). Dragging any occurrence of a
  repeating item onto another period sets the item's start
  (repeat_starts_on) there — the whole series shifts. One-off payments
  still drag per-payment; the distinction is one-off vs recurring, not
  income vs cost.

## [0.13.144] — 2026-07-10 — Pulse 0.20.0: Invoices page, per-cashflow settings, blue receivables, paid-with-account

### Added
- **Invoices page** (Money → Invoices, the Meet/Thread surface): scope
  switcher, search, totals, detail actions — Pulse-issued invoices show
  alongside Meet/Thread ledger money.
- **Mark-paid asks for a date + receiving account**: it stamps the paid
  date, adds a balance snapshot to the chosen Pulse account (so the BANK
  row moves by itself), and settles the matching plan line.
- **Per-cashflow settings gear** on the tab bar: the active tab's banks
  &amp; reserves (+ create, update balances) and reservation rules (+ add,
  remove), with a pointer to planner-wide settings (VAT, rhythm,
  invoicing).
- **Invoiced amounts are blue** (sky) — a receivable with a number on
  it, distinct from emerald expectations — in the grid pills, the
  counterparty totals and the org dialog's receivables; settled money
  leaves the view.

## [0.13.143] — 2026-07-10 — Pulse 0.19.0: repeats repeat, accounts connect, teams create

### Fixed
- **"Repeat is on, but does not repeat"**: per-item cadences on offering
  rows now expand — in the projection AND the grid (each item by its own
  rhythm from the expected date, incl VAT; non-repeating items once;
  lines skipped for such items to avoid double counting).

### Added
- **Connect any account to a cashflow**: the Accounts page shows a
  Cashflow chip per row and a selector in the dialog (Workspace / Me /
  any involved team) — reserves included; reassignment moves it between
  tabs instantly. Foreign personal accounts are shown but never
  clobbered.
- **Create teams from Pulse** (completes the teams-SPoT promotion,
  build-plan 10b): POST /api/v1/teams (creator becomes lead, Meet's
  slug rules respected); the Teams page gets "New team" — Pulse-created
  teams join the planner immediately (tab, bank prompt, reservations).
- **The Workspace tab wears the company name** (from the platform
  workspace, renameable in workspace settings).

## [0.13.142] — 2026-07-10 — Pulse 0.18.0: tabs are separate cashflows

### Changed
- **An item belongs to the cashflow it was created in** (Sjoerd: "If I
  delete something from ME it is also deleted from WORKSPACE" — it no
  longer appears there at all). Migration `20260710090000`: personal
  flag; strict partition — Me = your personal items, a team tab = its
  items (Team locked to the tab on create), Workspace = the company's.
  Creation stamps the home cashflow; edits never move it; the popup
  shows a "Personal / <Team> cashflow" chip away from workspace.
  Existing items live in the Workspace cashflow.

## [0.13.141] — 2026-07-09 — Pulse 0.17.0: the invoice button appears; reservations go per-cashflow

### Fixed
- **"Turn offering into an invoice" was invisible on new items** — the
  section only rendered for saved commitments, so the green-+ flow
  never showed it. It now always shows for income: "Save first, then
  invoice." while unsaved, the button once saved, the invoice
  date/expected/badge once invoiced.

### Changed
- **Reservations are per-cashflow** (migration `20260709230000`): rules
  carry the same scope as banks; each tab's RESERVATIONS header gets a
  "+" creating rules for THAT cashflow (target buckets = the tab's own
  reserves); the settings card manages workspace rules only; the
  projection follows the active scope.
- **Layout pass**: CASHFLOW title above the tabs; the filter row is
  gone; view choice is a compact "By contact / By period" select next
  to Per month; green + / red − sit left of that cluster; a new
  All / Only invoiced / Not invoiced filter (totals stay honest).

## [0.13.140] — 2026-07-09 — Pulse 0.16.0: P4 complete — paid becomes settled, by itself

### Added
- **The ledger↔plan loop closes**: every ledger write now fires a settle
  hook — a paid Pulse-issued invoice settles its whole opportunity
  (lines settled, stage → done, the Flow card completes); a paid
  purchase linked to a specific expected payment settles that line.
- **Conservative auto-matching**: Meet/Thread money that was also
  planned in Pulse links itself — exact amount + same counterparty
  person + a single unambiguous candidate (paid → settled; pending →
  linked). Matched purchases stop double-counting as ledger
  receivables in the projection. Throttled like the stages sync.

## [0.13.139] — 2026-07-09 — Pulse 0.15.0: cashflows are tabs, each with its own bank

### Changed
- **The tab system** (Sjoerd's morning pt 1): Me · a tab per involved
  team · Workspace (only with access) — the tab bar replaces the
  chooser and switcher; each tab anchors on ITS OWN accounts, and an
  empty tab offers "Create bank" (a virtual bank/reserve, in a popup).
- **The daily bank popup** (pt 2, "not a row"): the first visit each
  day opens that tab's balances ready to type (checkbox to disable per
  tab); it is THE balance-editing surface — the grid's BANK rows are
  display-only, with a pencil on the header to summon the popup any
  time.
- **Focus date** (pt 3): "First column on" — Today or any weekday
  (the first upcoming Friday, say) — in the rhythm settings; grid and
  projection shift together.
- **Tab-level + / −** (pt 4): a green + ("Add income — a contact and
  an amount is enough") and red − ("Add a cost") on the tab bar; the
  Quick add / New income / New cost header buttons retired.
- **Drag rows into your order**: grip handles on item rows and client
  groups under Income/Costs, insertion lines, order persisted
  (sort_order), optimistic with toast-on-error.
- **Columns obey the horizon**: 6 months = exactly 6 monthly columns
  (or the fortnights that fit) — the fixed 10-column tail is gone;
  Later only appears when something is truly dated beyond the horizon.

## [0.13.138] — 2026-07-09 — Pulse 0.14.0: the popup calms down; scopes get their own banks

### Changed
- **Popup polish (Sjoerd's morning list 5–12)**: uniform h-9 controls
  (calmer UX), a "More" disclosure under the contact (Project · Owner ·
  Team · the new Offer/quotation link with a clickable icon), the
  Income|Cost choice as a compact icon switch behind the contact,
  Name · narrow Expected date · Stage on one line, "Turn offering into
  an invoice" as a full-width bottom section (invoiced → Invoice date +
  Expected + the number badge), Notes last.

### Added (backend for wave 2)
- **Scoped accounts** (migration `20260709190000`): a bank/reserve
  belongs to the workspace, a team (its virtual bank) or a person;
  personal accounts manageable by their owner; the projection anchors
  each scope on ITS OWN accounts; focus_weekday setting (first column =
  e.g. first upcoming Friday).
- quote_url on opportunities (`20260709200000`); manual row order
  sort_order + ordered lists (`20260709210000`) — the drag UI ships in
  wave 2 (tabs).

## [0.13.137] — 2026-07-09 — Pulse 0.13.1: the 2-second tax removed

### Fixed
- **Every interaction felt 2–3s slow** (Sjoerd, first coffee): each
  change refreshes the page's data, and GET /pulse/stages was re-running
  the full Flow-mirror sync (~6 queries) PLUS an O(N) run-backfill walk
  on every single read — the logs showed it at 2s. Now: the mirror
  syncs at most once a minute per workspace (Flow edits surface within
  60s; Pulse-side stage edits hit the mirror directly), and the
  backfill only walks when a cheap count-parity check says a run is
  actually missing. Interactions drop to the sub-second roundtrip.

## [0.13.136] — 2026-07-09 — Pulse 0.13.0: whose cashflow?, the settings hub, and the rear-view mirror

### Added
- **The cashflow chooser**: opening /cashflow without a remembered scope
  asks whose cashflow you're opening — My cashflow, each involved team
  you can access, Workspace when you have access. Choice remembered;
  "Switch cashflow" returns to the chooser.
- **Settings is a hub** (the Thread pattern): Profile · Payments ·
  Planner cards. Profile edits the platform profile; Payments is the
  payments-SPoT form; all seven planner cards moved to
  /settings/planner.
- **History**: cadence select (off / 7 / 14 / 30 days) for the
  projection snapshots, the two-year retention note, the stored
  overviews list, and a first comparison popup (period table of any
  stored moment).
- Reservation rules default their target to the workspace's single
  reserve account (tonight's virtual-growth gap can't recur).

## [0.13.135] — 2026-07-09 — Pulse 0.12.2: the popup is an invoice; warnings are toasts

### Changed
- **The opportunity popup reads like an invoice**: letterhead contact
  band (org + person side by side, Invoice badge top-right), Name with
  the Income|Costs toggle inline behind it, columned meta row, offering
  rows as a full-bleed hairline table with right-aligned numbers, and
  an invoice-style totals block (weighted / full / VAT / bold TOTAL
  incl VAT). Owner/Team/Notes folded into More options.
- **Clicking a number in the sheet opens the popup** (drag moves,
  ⌥-drag copies, empty-cell + still adds inline, BANK balances still
  edit in place).
- **Warnings are popups**: a toast stack (top-right, auto-dismiss)
  carries every server error — nothing hides at the scrolled bottom of
  a dialog anymore. Field validation stays inline next to its field.
- Virtual reserve growth data-fix: both reservation rules now target
  the Saving account (they had no bucket — set in Settings anytime).

## [0.13.134] — 2026-07-09 — Pulse 0.12.1: ⌥-drag duplicates

### Added
- **Option-drag copies** ("Select + option = duplicate in the same
  row"): hold ⌥ while dropping an amount chip — or a whole org-level
  subtotal — on another period and the payment(s) are duplicated there
  instead of moved (cursor shows copy; invoice/settle state never
  copies). POST /pulse/lines/duplicate behind it.

## [0.13.133] — 2026-07-09 — Pulse 0.12.0: the popup rebuilt + ten grid refinements

### Changed
- **The opportunity popup, Sjoerd's exact order**: direction → name →
  contact (org selected → ONLY its people; "Add person…" opens a nested
  search-or-create popup; unlinked picks still confirm) → expected date
  → stage → **offering rows** (select-or-type × qty × price × repeat,
  weighted amounts, + add offering) → weighted/full totals → **VAT
  tariff** + total incl VAT → owner | auto team → notes. Saved income
  gets **Invoice…** (nested confirm: create / create & send; number,
  ledger row, email) with "Invoice {no}" badges everywhere.
- **The grid, ten refinements in one pass**: BANK rename with the
  workbook chain (Bank(n) = End(n−1)); RESERVATIONS rename; reserve
  accounts grow virtually (greyed cumulative from their feeding rules);
  the yellow **Total** column at row end; org-level subtotals drag
  whole groups; client groups default closed with fold-state remembered
  per view; focus mode (active row pushed forward, rest folds/dims);
  cost rows lose the committed/↻ chips; one-line sticky labels with
  hover tooltips; reservation rows aligned to column keys (off-by-one
  fixed).
- **Settings: Invoicing card** (prefix, next-number preview, auto-send,
  VAT tariff editor) — plus the API-side schema fields the card needs.

## [0.13.132] — 2026-07-09 — Pulse 0.11.1: backend train + Teams under People

Interim ship (the popup-redesign agent is still building the UI half).

### Added
- **Offering rows + VAT + invoicing (backend)** (migration
  `20260709140000`): pulse_commitment_item (offering × qty × price ×
  repeat), VAT tariffs list + invoice numbering/auto-send in settings,
  and POST /commitments/:id/invoice — number from the workspace
  sequence, purchase-ledger row (SPoT), stage→invoiced, receipt email
  (manual or auto). UI follows with the agent batch.
- **Projection history (backend)** (migration `20260709160000`):
  snapshot_cadence_days in settings; the projection stores itself on
  cadence (workspace scope), keeps two years, GET /pulse/snapshots
  lists/serves them — comparison material.
- **Teams under People** (the Thread sidebar pattern): new /teams page —
  all workspace teams, member counts, planner-involvement toggle, "Open
  cashflow" per involved team. Projects page is purely Projects.
- Reservation rules expose their target bucket to the grid (reserve
  accounts will show virtual growth in the agent batch).

### Fixed
- **Deleting an income/cost 500'd on RLS despite owner+admin** — the
  soft delete now verifies visibility through RLS and stamps via the
  service role (the contact-creation pattern), with full error logging.

## [0.13.131] — 2026-07-08 — Pulse 0.11.0: the org popup, scopes, and the day's last batch

### Added
- **Per-organisation popup** ("I want per org a popup... a list of
  opportunities and invoices... clicking on one opens a popup with
  info... adding one opens a popup to add one"): click a client's name
  in either view — identity header, Opportunities group, Invoices &
  receivables group, + Add. Rows and Add open the opportunity popup
  LAYERED on top (Escape closes only the top; scroll-lock nests; the
  outer list refreshes after inner saves).
- **Me / Team / Workspace scope switcher** on Cashflow — URL params +
  per-user cookie; the projection and all rows follow; Workspace hides
  for users without access (RLS refuses them the data regardless).
- **Default probability per stage** editable in the stages card (empty
  = keep the row's value; committed/won always 100); stage changes in
  the table and popup apply the entering stage's default.
- **Ledger invoices card** in Settings: the include_ledger Switch +
  expected-settlement days. Open Stripe/invoice purchases from Meet and
  The Thread project as receivables.

## [0.13.130] — 2026-07-08 — Pulse 0.10.2: every reservation visible

### Changed
- RESERVES folds open like the other sections: header keeps the total
  per period; expanded shows one row per reservation rule (label + %,
  per-period amount = % of that period's weighted income). The
  projection response now carries the included rules.

## [0.13.129] — 2026-07-08 — Pulse 0.10.1: financial position = current

### Changed
- FINANCIAL POSITION shows one number: the current position (bank
  anchor, editable per account in the now column). The running
  projection across periods is END POSITION's job — showing both spread
  out duplicated the same series shifted by a column.

## [0.13.128] — 2026-07-08 — Pulse 0.10.0 · Flow 1.11.0: opportunities live in Flow

### Added
- **The Pulse↔Flow runtime bridge** (Sjoerd: "when opportunities are in
  the pipeline (Pulse), they should of course also be visible in FLOW").
  Migration `20260709080000`: flow_run supports external subjects
  (person_id nullable; subject_label, organisation_id, source_app +
  source_ref, unique per flow). Every opportunity mirrors to a run on
  the Pipeline flow — created/moved/completed as its stage changes
  (create/patch/delete hooks + idempotent backfill on the stages sync).
  **Two-way**: transitioning a mirrored run in Flow (kanban, run view)
  updates the commitment's stage and forces 100% for committed/won
  kinds — Flow's gates apply to those transitions. Flow renders
  person-less runs via label/organisation with a "Pulse" source chip
  (runs panel, kanban, run view, tasks, contacts).
- **Invoiced is a stage** (Sjoerd: "lead, proposal, committed, done,
  cancelled or an invoice"): seeded into new pipelines and retrofitted
  into existing ones by migration `20260709100000` (committed → Invoice
  sent → invoiced → Paid → done); money-kind committed — the receivable
  state.
- **Per-stage default probability** (same migration): lead 25 ·
  proposal 60 · committed/invoiced/done 100 · cancelled 0, stored on
  pulse_stage, editable via the stages API, applied automatically when
  a row enters a stage unless explicitly overridden per row.
- **Cashflow per me / team / workspace (backend)** (migration
  `20260709110000`): pulse_budget_line gains team_id (null = workspace
  overhead); the projection + budget-lines endpoints accept ?team_id=
  and ?owner=me, scoping commitments + recurring lines. Workspace scope
  stays admin-gated by RLS ("workspace may only be visible to the ones
  who have access" — organisers' reads are self-scoped by policy). The
  visible Me/Team/Workspace switcher follows in the UI batch.
- **Company-aware person picker**: with an organisation selected, its
  people list first; new people auto-link to the company; picking an
  unlinked person asks before creating the connection (org_membership —
  the real contact graph). Fold arrows on company rows in both views.

## [0.13.127] — 2026-07-08 — Pulse 0.9.0: every line works on its own

### Changed
- Sjoerd: "every line should just work on its own... this popup is very
  unclear. Just make it editable line per line, organised per org or
  pers." Both cashflow views became direct editors:
  - **By counterparty** is an inline-editable table — per org/person
    group, one line per income/cost: Label · No. · Unit € · = Total ·
    Recurring · Stage · Probability, every cell click-to-edit in place;
    a pencil opens the dialog for the rest.
  - **By period**: click an amount chip to edit it in place; click an
    empty cell in a line's row to add a payment in that period (hover
    shows a faint +); dragging still re-dates.
  - **The dialog is progressive** — counterparty, deal size, repeats,
    stage up front; label/team/project/offering/owner/notes folded
    behind "More options" (auto-expanded when set).

## [0.13.126] — 2026-07-08 — Pulse 0.8.1: chevron folds + teams endpoint fix

### Fixed
- **GET /api/v1/teams 500'd in production** — the member-count embed
  selected team_member.id, a column that table doesn't have (fly logs:
  "column team_member_1.id does not exist"). Counts now embed user_id.
  The workspace-teams fallback in the income/cost dialog and the
  Settings picker were failing silently because of this.
- ("The costs repetitive does not save" — diagnosis, not a code change:
  the deployed API predated the recurrence fields, so zod stripped them
  on save. Both migrations are already applied; one fly deploy closes it.)

### Changed
- **Section headers fold with a chevron** — the whole INCOME/COSTS/
  FINANCIAL POSITION header cell is the toggle (▸ closed / ▾ open);
  the "Show more/less" text links are gone.

## [0.13.125] — 2026-07-08 — Pulse 0.8.0: recurring is a characteristic; the grid grows up

### Changed
- **Recurring is a characteristic, not a separate thing** (Sjoerd; migration
  `20260708220000`): a commitment may carry repeat_cadence + first-on/until.
  One dialog for everything — a "Repeats" select reveals the window and
  hides the payment schedule (occurrences come from quantity × unit price,
  weighted by stage like everything else; the projection expands them
  server-side, the grid client-side under their client group as ↻ rows).
  "Opportunity is just income": buttons/titles say New income / New cost;
  the grid's add-rows are + Income / + Cost. The separate recurring dialog
  (0.7.2) is gone; the Budget page remains for counterparty-less overhead.
- **Drag-drop hardening**: hover highlight no longer dies when the cursor
  crosses a chip (relatedTarget guard); re-render churn fixed; move errors
  are explicit in the banner. The wiring itself was sound — every cell in
  a row was already a drop target.
- **Costs/income design identity**: emerald/rose accent bars + tinted
  titles on section headers, amount pills (rounded, ringed, grab cursor,
  − prefix on costs), semibold client rows, guide-border indents, slate
  ↻ cadence pills, zebra striping. Yellow totals + red END POSITION stay.
- **Fit to screen** toggle (persisted per user via cookie): the whole
  horizon in the viewport — fixed table, 160px label column, compact
  cells; or the normal scrollable layout.
- **FINANCIAL POSITION is editable in place**: Show more lists every bank
  account (reserves badged); the current-period cell is click-to-edit —
  type the balance, Enter saves today's append-only snapshot, positions
  recompute. The every-session ritual without leaving the grid.
- **Overdue can hide**: the column renders only when overdue unsettled
  amounts exist; otherwise the grid starts at the current period.

## [0.13.124] — 2026-07-08 — Pulse 0.7.2: recurring lines add inline from the grid

### Changed
- "I don't see the recurring costs/income": the grid's + Recurring
  income / + Recurring cost now open the Budget line dialog RIGHT THERE
  (shared LineDialog, direction preset) instead of navigating to the
  Budget page; budget actions also revalidate /cashflow so new
  recurring lines appear in the grid immediately. Recurring rows render
  inside the expanded Income/Costs sections as the "Recurring (budget)"
  group; totals include them even when collapsed.

## [0.13.123] — 2026-07-08 — Pulse 0.7.1: show per week/month/quarter, + rows in the grid

### Added
- **"Show per…" switcher on the grid** (week / fortnight / month /
  quarter): a display rhythm independent of the settings rhythm, via
  ?show= — the projection re-fetches on the requested grid (quarter
  added to the projection endpoint as calendar quarters) so the
  position rows always align with the columns.
- **"+" rows at the bottom of Income and Costs**: + Opportunity /
  + Cost open the dialog with the right direction; + Recurring
  income / + Recurring cost link to the Budget page (recurring lines
  live there, both directions).

## [0.13.122] — 2026-07-08 — Pulse 0.7.0: deal size as quantity × unit price

### Added
- Opportunities carry an amount as **quantity × unit price** (Sjoerd:
  "16 * product x / € 1.350") — migration `20260708190000` adds
  quantity + unit_amount_cents to pulse_commitment. The dialog gets a
  deal-size row (picking an offering prefills the unit price from its
  default amount; the computed total shows live, with an "insert as
  payment" shortcut that drops it into the schedule); the counterparty
  list shows "16 × Product X". Payment lines remain the schedule; the
  deal size is the expression.

## [0.13.121] — 2026-07-08 — Pulse 0.6.2: grid polish from Sjoerd's walkthrough

### Changed
- **Total rows have a distinct colour**: section headers (Financial
  position / Income / Costs) sit on the Fibre yellow tint; End position
  on a stronger tint, negatives still red — like the workbook's grey
  totals + red row, in house colours.
- **The period grid is the default Cashflow view**, and the choice is
  remembered per user (thefibre.pulse.cashflow-view cookie via the
  savePref pattern — settings are per-user, not per-app).
- **The grid runs the full width of the screen**; the by-counterparty
  list keeps its reading width.
- **Empty financial position points at the fix**: when no balances are
  filled in, a "Fill in your bank balances →" row links to Accounts
  (manual each session for now; auto-connect is the future).

## [0.13.120] — 2026-07-08 — Pulse 0.6.1: a cost is not an opportunity

### Changed
- Sjoerd: "With costs — it is not an opportunity... there are repetitive
  costs (and income)." The dialog now speaks accordingly: choosing
  **Costs** hides Stage + Probability entirely (a new cost saves as
  committed money at 100%; existing rows keep their stored stage) and
  shows a note pointing repeating costs AND repeating income to the
  Budget page's recurring lines. Titles follow ("New cost" / "Edit
  cost"), and the Cashflow header gains a **New cost** button beside
  New opportunity, opening the same dialog preset to Costs. Recurring
  income budget lines were already routed to the INCOME section of the
  grid (0.6.0).

## [0.13.119] — 2026-07-08 — Pulse 0.6.0: the cashflow grid — the spreadsheet's anatomy, live

### Changed
- **"By period" is now a sheet-shaped grid** (replaces the card board):
  sticky label column, period columns on the anchor grid (Overdue first,
  Later overflow), ‹ › scroll buttons so horizontal scrolling never
  depends on the input device. Rows in the workbook's order:
  FINANCIAL POSITION (balance entering each period) → INCOME (section
  totals + Show more; expanded = client group rows with opportunities
  stacked beneath, amounts as draggable chips in period cells — drag =
  re-date) → COSTS (outgoing commitments per client + budget lines
  expanded by cadence as non-draggable "Recurring" rows) → RESERVES →
  END POSITION (bold, red cells when negative — the sheet's red row).
  Live row filter (totals stay honest, "(filtered view)" note).
  Non-admins degrade to INCOME + COSTS.
- **Opportunity label prefills** from the picked project/offering
  ("Label of an opportunity is: project/offering").

## [0.13.118] — 2026-07-08 — Pulse 0.5.1: contact creation via the platform pattern

### Fixed
- **Creating contacts STILL 500'd after the 0.13.117 policy split** (the
  RLS violation surfaced on the insert's returning read even for a
  super_admin). Rather than a third policy iteration, POST /persons and
  POST /organisations now follow the established platform pattern for
  contact creation (as Meet/Thread enrolment always has): adminClient
  with explicit `workspace_id: ctx.workspaceId` — membership is
  guaranteed by the auth middleware; reads stay fully RLS-gated. Both
  routes also finally log full Postgres errors (code/details/hint) to
  stderr, which they never did — the one route class that violated
  feedback_api_logs_first.

## [0.13.117] — 2026-07-08 — Pulse 0.5.0: quick add, the period board, and the fixes from Sjoerd's test-drive

### Fixed
- **Creating a NEW contact was impossible under RLS** (platform-wide, hit
  from Pulse's combobox: "new row violates row-level security policy").
  person/organisation policies had can_see_* in their WITH CHECK — never
  true for a fresh row. Migration `20260708150000` splits the policies:
  visibility gates reads/updates/deletes; INSERT needs only your own
  workspace.
- **GET /pulse/stages self-heals**: if the Pipeline flow is missing (the
  migration backfill needs a super-admin owner and skips otherwise), the
  first read creates it. (Also the diagnosis for "I don't see it": the
  running Fly API predated the stages routes entirely — logs showed 404.)

### Added
- **Quick add** on the Cashflow page: one combobox over ALL contacts
  (people + organisations, create-org inline), an amount, a date —
  defaults handle the rest (income, Lead, 50%, you as owner). The
  extended dialog remains for everything else.
- **By-period board**: view toggle on Cashflow — columns per period
  (week/fortnight/month per settings, Overdue first, Later overflow),
  unsettled expected payments as draggable cards; drop on a column
  re-dates the payment (the spreadsheet's drag-a-number-to-a-column,
  formalised). Weighted net total per column.
- **Direction is two buttons** in the opportunity dialog — Income (green,
  arrow in) / Costs (red, arrow out) — replacing the select.

### Changed
- **Team select falls back to all workspace teams** (with a "scope in
  Settings" hint) when no involved teams are picked yet.
- **Every date input in Pulse uses the shared DateField SPoT** (date-only)
  via the standard re-export shim — lines editor, budget dates, balance
  as-of, quick add.
- **Settings: "How far ahead" presets** (2 / 3 / 6 / 12 months / 2 years)
  replace the horizon number input; the confusing period-anchor-date
  field is gone from the UI (grid anchors on today; the P6 importer sets
  the payroll-aligned anchor from the workbook).

## [0.13.116] — 2026-07-08 — Pulse 0.4.0: the Pipeline lives in Fibre Flow; Pulse speaks cashflow

Sjoerd's correction, verbatim: "FLOW is the other app... there the pipeline
should be built. That FLOW could then be used in the CASHFLOW tool, which
is in PULSE." And: "Still I see pipeline in pulse... not cashflow."

### Changed
- **The Pipeline is a real Fibre Flow** (migration `20260708120000`):
  `flow_definition.system_key` marks app-owned flows; a "Pipeline" flow
  (5 steps, transitions, canvas positions) is backfilled for Pulse
  workspaces and seeded on future activations (lib/pulse-pipeline.ts).
  Flow's DELETE guards it with a 409 while Pulse is active. Pulse
  consumes it read-only: GET /pulse/stages now syncs the `pulse_stage`
  mirror from the flow's current version (labels + order from Flow;
  end_positive→won, end_negative→lost) before answering, and returns
  `pipeline_flow_id`. POST/DELETE /pulse/stages answer 409 "authored in
  Fibre Flow"; PATCH is kind-only (the money-semantics overlay — the one
  thing that stays Pulse's). Third sanctioned wall crossing: flow
  definitions are consumable cross-app, Flow owns authoring
  (proposal §3.12 rewritten).
- **Pulse says Cashflow, not Pipeline**: sidebar item, page title and
  copy renamed; the route moved /pipeline → /cashflow with a redirect;
  Settings' stages card is now a read-only reflection of the flow with
  per-stage money-semantics editing and an "Edit the flow in Fibre
  Flow" link.

## [0.13.115] — 2026-07-08 — Pulse 0.3.0: the pipeline is a flow, the chart is visual

From Sjoerd's P2 test-drive, five asks in one release.

### Added
- **Stages are a flow, not an enum** (migration `20260708090000`):
  `pulse_stage` — the workspace's pipeline flow, seeded on Pulse
  activation with the default sales flow (Lead → Proposal → Committed →
  Done, + Cancelled). System stages are undeletable (RLS-enforced, not
  just API); custom stages can be added/renamed/reordered around them.
  `kind` (open | committed | won | lost) carries the projection math:
  open = probability-weighted, committed = 100%, won = done, lost =
  excluded. Commitment stage validation + probability forcing now run
  against the table; the old check constraint is dropped (seeded keys
  match the old enum — zero data change). Settings gets a "Pipeline
  stages" card; the opportunity dialog's stage select and the list's
  stage chips are data-driven. (Deliberately Pulse-owned, not a Fibre
  Flow definition — proposal §3.12 explains; the shape maps onto Flow
  if the apps ever converge.)
- **Type-ahead counterparty pickers with inline create** — organisation
  and person fields in the opportunity dialog are now comboboxes: type
  to filter, and "Create '<name>'" makes the contact on the spot (POST
  /organisations, /persons) and selects it. Contacts born in Pulse are
  ordinary platform contacts (proposal §3.5).
- **Owner defaults to the signed-in user** on new opportunities.
- **The cashflow overview is visual**: per-period income (emerald) and
  cost (rose) bars — costs were always in the math, now they're on
  screen — under committed (solid) + expected (dashed) balance lines,
  zero line with below-zero shading, hover tooltip per period,
  Expected / Committed / Best-case layer toggle, legend; the period
  table is collapsible behind it.

## [0.13.114] — 2026-07-07 — teams are workspace-visible (RLS fix)

Sjoerd: "the team is not the same as in thread or meet." Two causes:

### Fixed
- **`team` + `team_member` RLS still required fibre-meet membership** — a
  leftover from teams' Meet era (meet_team_scope, renamed 2026-05-17).
  A Pulse-only user saw an empty picker and zero member counts. New
  migration `20260707210000`: read = any workspace member; team writes =
  workspace admin or fibre-meet (behaviour-preserving); lead-gated
  team_member writes unchanged. Teams are a platform primitive — their
  visibility can't hang off one app's membership.

### Clarified (by design, not a bug)
- Meet's team list shows *teams you're an active member of* (it's "my
  teams"). Pulse's involved-teams picker shows *all workspace teams* —
  an admin marks any team as a hub, including ones they're not in. Same
  table, different lens.

## [0.13.113] — 2026-07-07 — Pulse 0.2.0: P2 — every Pulse surface is editable

Three parallel agents, one lane each; foundation (teams endpoint + Switch)
built first. All dialogs follow the Fibre dialog contract; every money
input accepts comma decimals and stores integer cents.

### Added
- **Platform `/api/v1/teams`** (build-plan 10b, the teams SPoT doorway):
  workspace teams with member counts. Meet's team routes stay as aliases;
  Pulse's involved-teams picker is the first consumer.
- **Settings**: rhythm/currency edit dialog (granularity, anchor date,
  fiscal year start, horizon), reservation rules (inline include Switch,
  add/edit/delete, target reserve-bucket select), involved-teams picker
  (excludes already-involved, shows member counts), and a new Offerings
  section (name/category/default amount/notes, archive).
- **Accounts**: new/edit account dialogs (bank|reserve, parent bank for
  reserves, archive), and the **Update balances** dialog — every account
  with euro inputs prefilled from latest snapshots, one as-of date,
  dirty-tracking, append-only snapshot writes.
- **Budget**: new/edit line dialog (category, direction, amount, cadence,
  start/end, owner from workspace members, include SwitchField) + inline
  optimistic include toggle per row; archive as Delete.
- **Pipeline**: the opportunity dialog (xl) — direction, label, mutually-
  exclusive organisation/person counterparty pickers, team (involved
  teams), project (grouped by chosen team), offering, owner, stage +
  probability (forced 100 & disabled for committed/done), notes, and the
  Expected-payments lines editor (date, euro amount, invoice #, invoiced/
  settled dates, add/remove, live total). One server action saves the
  commitment then diffs lines (create/patch/delete). Two-click delete
  (soft). Rows in the counterparty-grouped list open the dialog.
- **Teams & projects**: new/edit project dialog (name, team with
  hubs-are-teams hint, notes), archive; clickable rows.

### Known limits (deliberate, P2 scope)
- Owner can be reassigned but not cleared back to nobody (API defaults
  the caller on create; omitted-on-edit = unchanged).
- Pickers cap at 100 persons/organisations (search comes with the
  counterparty view phase).

## [0.13.112] — 2026-07-07 — Pulse 0.1.0: Fibre Pulse P1 — the business planner is born

The 6th Fibre app (5th delivery app): cashflow projection + budgeting built
on contacts and offerings. docs/fibre-pulse-proposal.md is the spec; this
release is P1 of its build plan (schema + API + walking-skeleton app).

### Added
- **pulse schema** (migration `20260707120000`): settings, involved teams,
  accounts + append-only balance snapshots, offerings, projects (under
  platform teams — hubs/incubators), commitments (opportunities: stage
  lead→done + probability %) with dated lines carrying real-invoice refs
  and purchase-ledger links, budget lines (recurring, include toggle),
  user-defined reservation rules (VAT = just another rule), annual budgets
  + quarterly targets. RLS: money surfaces admin+, pipeline admin-or-owner.
  App registered as `fibre-pulse`; activated + admin-membership granted for
  existing workspaces in the migration (unlike Flow, which was hand-done).
- **`/api/v1/pulse/*`** — CRUD for all of the above plus `GET /projection`:
  period buckets (week/fortnight/month, anchor-date grid), three layers
  (committed / probability-weighted expected / best case), budget-line
  cadence expansion, reservation deduction, running balances, and the
  dips-below-zero answer.
- **apps/pulse** (`:3004`, pulse.thefibre.app, Vercel project TBD) — Flow's
  shell pattern: landing, auth, no-access, app-switcher gating. Pages:
  Pulse (runway sentence + SVG balance chart + period table), Pipeline
  (grouped by counterparty, stage + probability), Teams & projects, Budget,
  Accounts, Settings (rhythm/currency/reservations/teams read-out). P2
  brings the edit dialogs; P6 imports the real Soul Lab workbook.
- `fibre-pulse` in the shared APPS registry, workspace-apps INSTALLABLE,
  CORS allowlists (plus Vercel preview regex).

### Fixed
- **flow.thefibre.app was missing from the API CORS allowlist** (and the
  Vercel preview regex) — production Flow presumably rode on the
  `CORS_ORIGINS` env override. Both lists now carry flow + pulse.

## [0.13.111] — 2026-07-07 — Thread 3.31.4: toggle switches for every boolean setting

### Changed
- All single on/off settings in Thread now use the toggle switch (label
  left, yellow when on): show-on-public-agenda (engagement dialog),
  list-on-organiser-page (Basics), approval required + both participant
  visibility options (Registration tab), award-certificate (Certificates
  tab), early-bird + active (coupon dialog), active (ticket dialog), and
  send-confirmation (Add participant). New `SwitchField` handles both
  FormData forms (hidden 'on' input) and controlled state.
- Checklists (payment options, embed elements, share grantees, bulk row
  selection) and the public form's consent boxes deliberately stay
  checkboxes — different semantics.

## [0.13.110] — 2026-07-07 — Thread 3.31.3: publish is a toggle switch next to the title

### Changed
- The engagement dialog's publish control is now an iOS-style toggle
  (yellow when on, per Sjoerd's reference) sitting to the right of the
  Title field — replaces the pill in the dialog header (3.30.3). New
  `Switch` component in components/ui. Behaviour unchanged: new
  engagements start published; toggling off keeps them as drafts.

## [0.13.109] — 2026-07-07 — Thread 3.31.2 · Meet 2.4.2 · Flow 1.10.1: whole-Fibre code cleanup

Four inventory agents swept every package; each claim re-verified before
touching anything. Net −~2,600 lines with zero intended behaviour change,
plus a handful of real fixes the sweep surfaced.

### Fixed (found by the sweep)
- **Tailwind purge now scans `packages/shared`** — all four apps' content
  globs missed it, so the shared date-picker's arbitrary-value classes
  (e.g. `w-[292px]`) could vanish from production CSS.
- **Meet's invite page Sign out button worked again** — it posted to
  `/auth/sign-out`, a route that didn't exist (added).
- **Thread + Meet `GET /me` / `GET /settings` report Stripe connection
  through the payments SPoT** — they read only the legacy columns, so the
  pricing panel showed "connect Stripe first" to users who had connected
  via Settings → Payments. The app-local PATCHes no longer accept
  `stripe_account_id` at all ("never write the old columns again" is now
  enforced by the schema).
- **Scheduler timezone conversion is DST-safe** — thread.ts carried its
  own sv-SE-locale hack without the DST re-check; it now delegates to the
  shared implementation.
- **Flow's sidebar Settings link went nowhere** (no settings route) — removed.
- Thread's pricing tab still told organisers "checkout lands with the
  payments phase" (it shipped weeks ago) — three user-visible strings fixed.

### Removed (verified dead)
- **~30 dead files** across thread/meet/flow (~1,300 lines): unused ui
  primitives (tabs/card/avatar/bottom-sheet/…, both apps), sign-out
  components ×3, Meet's stale availability-engine copy (the live one is
  in the API), scheduling-rules, ical builder, old settings form,
  skeletons/save-bar/prefetch helpers, empty workspace skeletons
  (packages/config·db·ui).
- Dead code: `moveEngagement` action, `requireStripe`, `fmtDate`,
  `cookieDomain`, unused imports/consts, a hot-path debug `console.log`
  on meeting-type PATCH.
- Unused dependencies: zod (thread, flow, meet), radix dropdown (meet,
  flow), class-variance-authority (meet, flow), clsx+tailwind-merge
  (flow), prettier (root), and the four zombie `next lint` scripts +
  eslint deps (no config ever existed; queued as a real task).

### Changed (consolidation, no behaviour change)
- `errorMessage()` — nine drifted copies across Thread's server actions →
  one export in `lib/api.ts`. `one()` PostgREST normalizer — local copies →
  the `lib/thread-types` export. One `Billing` type instead of four inline
  literals. Prefs cookie names from `prefs-shared` constants.
- **`lib/fees.ts`** — the plan-aware platform-fee block existed four times
  (Meet checkout, Thread enrol, webhook payout, payment links); one
  implementation now.
- `escapeHtml` deduped in the email templates; credential columns dropped
  from a dozen selects that no longer read them.

### Docs & config grooming
- build-plan.md "Open queue" is now THE maintained to-do list (groomed
  stamp; done items removed). New: docs/thread-split-map.md — full
  section/dependency map for splitting the 4.7k-line thread.ts.
- CLAUDE.md / build-plan / deploy.md version markers and stale claims
  fixed ("five package.json" → six, CORS note, Sales/Learn references).
- `.env.example` rewritten against what the code actually reads.
- Flow's dev server moved to :3003 (thread and flow both claimed :3002);
  CORS allowlist follows. Root package.json version aligned.

## [0.13.108] — 2026-07-05 — Thread 3.31.1 · Meet 2.4.1: full-app debug pass (21 fixes)

Four parallel review agents swept the releases since the last adversarial
pass (0.13.98–0.13.107) plus the standing money/auth flows; every finding
was re-verified against the source before fixing. 31 findings → 21 fixed,
the rest judged working-as-intended and documented.

### Security / authority
- **Manual add participant now requires real authority** — admins, the
  thread organiser, co-organiser hosts, or owning-team members; before,
  any workspace member could inject enrolled participants (and trigger
  emails) into any thread, bypassing payment and approval.
- **PATCH /meet/me no longer returns the Google refresh token** (GET
  already stripped it; PATCH leaked the raw row — and always, after the
  personal-room-only save split).
- **Uploads take raster images only** (png/jpeg/webp/gif/avif) — SVG/HTML
  in a public bucket is stored XSS.
- **Certificate-template shares endpoint scoped to the workspace** (was an
  unscoped read by template UUID).

### Money
- **Mark-paid now expires a live Stripe Checkout session** (both the
  Invoices route and the thread route) — the payment link stayed payable
  after a bank transfer was marked received: a real double-payment window
  the webhook then swallowed silently.
- **Payment links follow team payout routing** — chargeAccountForItem now
  uses the same destination resolution as checkout, so lead-payout team
  threads no longer get their resent links charged to the workspace
  account (which also left two payable sessions alive).
- **Receipts read seller details through the payments SPoT** — Settings →
  Payments edits (legal name, VAT) finally reach the receipt emails.
- **Reimburse refuses €0 discount-code purchases** (flipping them to
  refunded irreversibly mislabeled a free enrolment as a refunded payment).
- **Pending purchases mail as "Invoice", not "Receipt"** (with "awaiting
  payment"), and free purchases say "Free (discount code)" instead of
  "Card".

### Enrolment correctness
- **Manual add checks thread state**: completed/archived threads refuse
  new people; full threads (capacity) refuse with a clear message.
- **Manual add re-activates instead of lying**: adding someone who was
  declined or stuck at unpaid/unapproved now re-enrols them (door
  override) instead of replying "already enrolled" while leaving them out;
  completed/active enrolments are never regressed.
- **The message scheduler skips 'invited' enrolments** — people awaiting
  approval or payment no longer receive all scheduled course content.
- **Duplicates and templates keep engagement statuses** — an all-draft
  copy silently emptied the public agenda and muted every message; now
  published source engagements stay published in the copy.

### Dates
- **The API rejects end-before-start** on thread create/update (aware of
  the auto-shift) and on activities (end must follow start — same-day
  end-times before the start were accepted).
- **The date picker's "Today" button respects min/max** — it was a
  one-click bypass of the end-after-start constraint.

### Connections polish
- **Meet's OAuth feedback lands on Settings → Connections** (redirects
  targeted /settings, which never read the ?google= params — success and
  errors were invisible).
- **Disconnect cleans calendar rows for Thread-only users** (the delete
  ran under Meet-membership RLS and silently no-op'd for them).
- **Host provisioning survives a first-touch race** (unique-violation now
  resolves to the winner's row instead of a 500).
- **Credential columns dropped from a dozen unused selects** on public
  endpoints (they pulled the token into memory for nothing).

### Registrations dialog
- **Lifecycle action failures are surfaced** (approve/decline/complete/
  mark-paid errors used to vanish — the list just re-rendered unchanged).
- **"Already enrolled" renders as info, not an error**, and reactivation
  gets its own message.

### Noted, not changed (deliberate)
- Manual adds receive up to 72h of catch-up messages via the scheduler
  lookback (at-most-once send semantics stay as designed).
- Engagement status 'closed' collapses to draft in the editor — latent;
  nothing writes 'closed' today.
- Uploads still don't check per-app membership (any workspace member may
  upload); MIME + size limits added, membership gate deferred.

## [0.13.107] — 2026-07-05 — Connections data moves to platform level

### Changed
- **Connections are now a data-level SPoT** (follow-up to 0.13.106, which
  unified the UI but left the data on `meet_host`). New `user_connection`
  table holds `google_refresh_token` + `personal_room_url` per user —
  deliberately NOT on `user_profile`, which is workspace-readable by RLS
  design; the token is a credential, so the new table has RLS enabled with
  no policies (API service-role only). Backfilled from `meet_host`
  (migration `20260705090000`).
- All readers (booking create/cancel/confirm, slots, multi-host
  availability, calendar sync, `/me`, connections, Thread's organiser
  payload) resolve through `apps/api/src/lib/connections.ts` —
  platform value first, old `meet_host` columns as read fallback. Writes
  (OAuth callback, disconnect, personal-room saves from either app) go to
  the platform table and clear the fallback so a disconnect can't be
  resurrected by a stale app-local value.

## [0.13.106] — 2026-07-04 — Thread 3.31.0 · Meet 2.4.0: manual add participant, photo upload, Connections SPoT

### Added
- **Manual add participant** (Thread) — the Registrations popup gains an
  "Add participant" button: name + email, optional confirmation/welcome
  messages. Skips payment and approval — the person is enrolled
  immediately (walk-ins, phone signups). Same account auto-create and
  consent bookkeeping as the public form; duplicates are detected.
  New API: `POST /thread/threads/:id/participants`.
- **Profile photo upload** (Thread + Meet) — the Photo URL text field in
  Settings → Profile is now an image upload with thumbnail,
  replace/remove. Meet gained an uploads endpoint backed by a new public
  `fibre-assets` bucket (migration `20260704220000`).

### Changed
- **Connections is a SPoT now** — Thread has its own Settings →
  Connections page (Google Calendar + personal meeting room) managing the
  same user-level data as Meet's; the settings card no longer bounces you
  to Meet in a new tab. The Google OAuth flow returns to whichever app
  started it (signed `return_to` in the state), and the connections
  endpoints provision the host row on first touch so Thread-only
  organisers can connect too. The engagement dialog's "no personal room"
  hint now points at Settings → Connections.

## [0.13.105] — 2026-07-04 — One date-field component for all apps

### Changed
- **`DateField`/`DateTimeField` moved to `@thefibre/shared`** (`src/ui/
  date-field.tsx`) — the per-app copies in Thread, Meet and Fibre web had
  drifted (the 22:00 time cap was fixed in one but not the others). The
  app-local files are now one-line re-exports, so existing imports keep
  working; the shared package gained JSX/DOM compilation and a
  `./ui/date-field` subpath export. Edit the shared copy from now on.

## [0.13.104] — 2026-07-04 — Meet 2.3.3: full-day time picker in Meet and Fibre web too

### Fixed
- The 00:00–23:45 time-picker range (3.30.3) had only reached The Thread's
  copy of the date-field component — Meet's and Fibre web's copies still
  stopped at 22:00. All three now cover the whole day.

## [0.13.103] — 2026-07-04 — Thread 3.30.3: publish pill on engagements, complete billing address, full-day time picker

### Added
- **Publish pill in the engagement dialog** — a green Published / grey Draft
  toggle sits top-right next to the title (replaces the Status control in
  the sidebar column). New engagements are published by default; click the
  pill to keep one as a draft.
- **Complete billing address on the enrol form** — the single address
  textarea is now street + number, postal code, city and country (labels
  translated ×5). The receipt email, participant popup and both Invoices
  detail dialogs render the composed address.

### Changed
- **Time picker covers the whole day** — the date-time selector's time
  column now runs 00:00–23:45 (was 06:00–22:00), still in 15-minute steps.

## [0.13.102] — 2026-07-04 — Thread 3.30.2: receipt resend + contact info in participant popup, end-after-start dates

### Added
- **Send receipt from the participant popup** — the detail popup (Enrolments
  page + per-thread Registrations dialog) gains a "Send receipt" button in
  the footer for anyone with a purchase, including free-via-code enrolments.
  Backed by `POST /api/v1/purchases/resend-by-ref` ({app, item_ref}), which
  reuses the shared receipt email; the invoice-PDF button appears when
  Stripe issued one.
- **Contact info in the participant popup** — email, phone, city/country and
  preferred language now show in a Contact section (the API's enrolment list
  select was extended with those person fields).

### Fixed
- **End date can no longer precede the start date** — picking a start date
  constrains the end-date picker in the new-thread form, the thread Basics
  form, and the activity dialog (where Ends also stays within the thread
  window).

## [0.13.101] — 2026-07-04 — Thread 3.30.1: Invoices team picker shows only your teams

### Fixed
- The Team scope on the Invoices page listed every workspace team (Meet's
  listed only yours) — selecting a team you're not in could only ever show
  "0 purchases". The picker now offers only teams you're an active member
  of (`/thread/teams?mine=1`); admins see everything via the Workspace
  scope as before.

## [0.13.100] — 2026-07-04 — Thread 3.30.0: approval toggle, hosts into settings, free-code purchases, detail popup everywhere

### Added
- **The approval toggle exists now** — it never had UI. Thread settings →
  Registration tab → "Approval required": enrolments wait as requests until
  approved (the flow itself shipped in 3.22.0; the switch was missing).
- **Discount-code people are purchases** (migration `20260704200000`) —
  €0-via-code enrolments land in the Invoices area as method "Free (code)",
  amount €0, settled, with the code in the item label; existing ones
  backfilled.
- **Participant detail popup in the Registrations dialog** — the per-thread
  popup's rows now open the same full detail view (answers, payment,
  billing, certificate) as the Enrolments page.

### Changed
- **Hosts & facilitators moved into thread settings** (Sjoerd's earlier
  request, recovered) — the people icon left the timeline header; the
  management panel lives in the Basics tab under language/timezone, next to
  the page/popup and listing settings.

## [0.13.99] — 2026-07-04 — Workspace payment defaults, team payout routing, honest card availability (Thread 3.29.0 · Meet 2.3.2)

### Fixed
- **"payments are not configured yet" on enrol** — root cause found:
  `STRIPE_SECRET_KEY` was never set on Fly, so the card path could never
  work (Meet's included). Two changes make the system honest until it is:
  the public payload now **drops the card option whenever it cannot work**
  (platform key missing, or no connected account for the thread's payout
  destination) — leaving invoice when enabled, so invoice-method
  enrolments work today; tickets cannot resurrect a dropped card option.
  Setting the key remains Sjoerd's action.

### Added
- **Workspace-level default payment options** (migration
  `20260704180000`) — the inheritance root now follows the money:
  team/workspace-destination threads inherit the WORKSPACE defaults
  (Settings → Payments → Workspace account gains the same checkboxes);
  personal threads keep inheriting the organiser's.
- **Team settings + payout routing** — the team page gains a settings
  section: description, and "payments from this team's threads go to"
  with a 2-card chooser: **Workspace account** (default) or the **team
  lead's personal account** (named). Editable by the team lead or a
  workspace admin; checkout and refunds resolve accordingly. This answers
  "who is the team admin": the existing `lead` role.

## [0.13.98] — 2026-07-04 — Thread 3.28.0: enrolments search + participant detail popup

### Added
- **Search on the Enrolments page** — name, email, thread or ticket,
  filtering live; select-all follows the filtered view.
- **Participant detail popup** — clicking a participant opens everything
  about their enrolment: thread, status + progress, signed-up/enrolled/
  completed dates, certificate link, the payment block (amount, card vs
  invoice, ticket, discount code, billing incl. tax no.) and — visible for
  the first time — their **registration answers** (the intake questions
  collected on the enrol form).

## [0.13.97] — 2026-07-04 — Security & money hardening: 14 review findings fixed (Thread 3.27.1 · Meet 2.3.1)

An independent adversarial review of the payments/invoices surface produced
15 findings (most confirmed). 14 fixed, 1 accepted with documentation.

### Fixed — authority & safety
- **Any workspace member could mark-paid / approve / decline / complete
  other organisers' enrolments** — the lifecycle routes now require admin,
  the thread's organiser, or a co-organiser host (matching the purchases
  routes' authority model).
- **Disconnecting Stripe now sticks** — clearing the platform value also
  clears the legacy fallback columns (meet_host / thread_organiser /
  thread_settings); previously the old account silently kept charging.
- **Declining a participant expires their open checkout session** — no more
  paying through a tab that was still open after a decline.

### Fixed — money correctness
- **Refunds run on the account the charge landed on** (stored per purchase
  at record time), not on today's possibly-changed settings.
- **Resending a payment link expires the previous session** and the webhook
  resolves stale sessions by metadata — no orphaned still-payable links, no
  unrecorded charges.
- **A payment-link expiry no longer fails an outstanding invoice** — the
  email said "the invoice stands" and now the ledger agrees.
- **Mark-paid only applies to pending purchases** — refunded/failed sales
  can't be resurrected, and confirmation side-effects never re-fire
  (finalize is idempotent on retries).
- **Webhook retries repair partial runs** — the idempotency guard now also
  checks the ledger row; payout inserts are conflict-proof.
- **Coupons aren't burned by failed checkout starts** — rollbacks release
  the use; retries with the same code work.
- **Abandoned checkouts no longer eat capacity/quantity forever** — failed
  enrolments are excluded from sold-out and capacity counts, the
  cheapest-ticket fallback path enforces quantity, and a bailed-out payer
  gets a fresh checkout instead of a false "already enrolled".
- **Meet's expired sessions flip the ledger to failed** (pending totals no
  longer inflate forever).
- **Totals are per currency** — a £ sale no longer inflates the € figure.
- **Concurrent ledger writes can't drop the paid state** (insert-race
  retry-as-update).

### Accepted (documented)
- The payment-SPoT migration converted explicit card-only thread settings
  into "inherit" (indistinguishable from the old default). Identical
  behaviour until an account default changes — organisers who want
  card-only-per-thread set it in the Pricing tab.

## [0.13.96] — 2026-07-04 — Payments as a true SPoT, payment-type inheritance, auto-accounts (Thread 3.27.0 · Meet 2.3.0)

Sjoerd's diagnosis was correct: the Stripe connection was "a setting in one
app used in others" — Meet wrote meet_host, Thread wrote thread_organiser,
edits forked. Fixed structurally.

### Changed — payments SPoT (migration `20260704150000`)
- **Personal payment settings live on `user_profile`** (stripe_account_id,
  invoice_details, default_payment_methods) and **workspace settings on the
  `workspace` row** — backfilled from the app-local columns (Meet's value
  wins; the old columns remain read fallbacks and are never written again).
- **One resolution path**: `apps/api/src/lib/payment-accounts.ts` — every
  reader (Thread checkout, Meet checkout, refunds, payment links) resolves
  through it: platform value → app-local fallback.
- **Settings → Payments is the same page in Thread AND Meet**, writing the
  platform endpoints (`/api/v1/profile`, new `/api/v1/workspace-billing`,
  admin-gated). Two levels: My account + Workspace account, each with the
  Stripe id and the invoice issuer identity. Teams inherit the workspace
  account by design (noted on the page).

### Added — payment-type inheritance (account → thread → ticket)
- **Account default** (Settings → Payments → "Default payment options":
  pay online / pay per invoice), **thread override** (Pricing tab: inherit
  or custom), **ticket override** (ticket popup: inherit or custom). Null =
  inherit at every level; resolved server-side including the public enrol
  payload, so the enrol form's method toggle follows the SELECTED ticket.

### Changed — participant accounts
- **Accounts are created automatically at enrolment** (email-only — Google/
  the 8-digit code still verify ownership at first sign-in). The enrol form
  now always says "Sign in to your personal page".

### Also
- Members page role picker speaks the new vocabulary (Super Admin / Admin /
  Organiser (default)).
- Full debug sweep: production builds of all five packages pass; migrations
  applied; independent code review of the payments/invoices surface ran in
  parallel (findings follow as a patch release if any).
- Documentation refreshed across CLAUDE.md, docs/build-plan.md,
  docs/deploy.md (Stripe webhook matrix), docs/invoices-and-roles-proposal.md
  (decisions recorded as resolved).

## [0.13.95] — 2026-07-04 — App filter on Invoices, invoice issuer identity (Thread 3.26.1 · Meet 2.2.2)

### Added
- **App filter chips on the Invoices page** (All apps / Fibre Meet /
  The Thread) — defaulting to the app you're in, one click to the
  cross-app view.
- **Invoice issuer identity** (migration `20260704140000`) — Settings →
  Payments now carries the seller's legal name, address and tax/VAT
  number at BOTH levels: personal (organiser profile — used for personal
  sales) and workspace (used for team/workspace sales). Receipts and
  invoice emails show a From/seller block resolved per purchase
  (organiser's details first, workspace's as fallback).

## [0.13.94] — 2026-07-04 — Payments settings native, receipt emails, invoice payment links (Thread 3.26.0 · Meet 2.2.1)

### Added
- **Payments settings live in Thread** (Settings → Payments) — no more
  new-tab bounce to Meet. Two levels: **My account** (the personal Stripe
  Connect id — the same value Meet reads: one connection per person) and
  **Workspace account** (admin-gated). Teams hold no accounts by design —
  team sales pay out to the workspace account per the payout rule; noted
  on the page.
- **Receipt-styled emails** — resend-invoice (and the new payment-link
  mail) now render an actual receipt: item, date, payment method, billing
  block, total, and the button (View invoice PDF / Pay online).
- **Payment link for invoice-method sales** — the Invoices detail dialog
  gains "Send payment link" on pending invoice purchases: a Stripe
  Checkout session for the open amount, emailed as a receipt with a Pay
  online button; the existing webhook completes it (confirmation, ledger,
  split). Thread purchases in v1; Meet's invoice bookings stay mark-paid.
- **Billing fields on the enrol form** (migration `20260704120000`) —
  choosing "Receive an invoice" reveals company/organisation, billing
  address and tax/VAT number (i18n ×5); stored on the enrolment and the
  purchase row, shown in the Invoices detail dialog.

## [0.13.93] — 2026-07-04 — Invoices area + role tiers (Thread 3.25.0 · Meet 2.2.0)

The big one from docs/invoices-and-roles-proposal.md — all four design
decisions accepted as recommended.

### Added — platform
- **`purchase` ledger** (migration `20260704091000`) — the second
  sanctioned data-wall crossing after the activity log: one row per money
  event across Meet + Thread (payer, item, amount, split, method, status,
  Stripe invoice link), written by both apps at checkout completion /
  mark-paid / refund and **backfilled** from every existing booking and
  enrolment with money involved. RLS: admins see the workspace, organisers
  their own sales + their teams'.
- **Role tiers** (migration `20260704090000`) — `workspace_role` becomes
  `super_admin | admin | organiser` ("every account is an organiser at
  minimum"); existing members migrated, earliest admin per workspace
  promoted to Super Admin. `is_workspace_admin` / `can_see_person` /
  `can_see_organisation` widened; new `current_workspace_role()` helper.
  **Facilitator stays a per-thread role** and sees no financial data.
- **Purchases API** — `GET /api/v1/purchases` (scope me/team/workspace,
  search, app filter, cursor pagination, totals; workspace scope is
  admin-only) + `resend-invoice` (branded email with the hosted Stripe
  invoice), `refund` (full refund on the connected account, **platform fee
  returned**; invoice-method = recorded), `mark-paid` (invoice-method,
  runs the same side-effects as the webhook).
- **Thread webhook now stores the hosted Stripe invoice URL** (closed the
  gap Meet never had).

### Added — apps
- **Invoices in the sidebar of Thread AND Meet** — scope toggle
  Me / Team / Workspace (workspace disabled without an admin role), search
  across payer/email/item, totals bar (paid / pending / refunded / fees),
  load-more pagination, and a detail dialog on the Fibre bottom-bar
  contract with Reimburse (confirm, full only), Mark paid, Resend invoice
  and the hosted-invoice link.

### Notes
- Refunds are v1: full amount only, no partial; Stripe issues no automatic
  credit note (proposal §3.7).
- Invoice-method sales carry no Stripe document — resend applies to card
  payments; organisers send their own invoice documents.

## [0.13.92] — 2026-07-04 — Thread 3.24.0: embed custom CSS — every element named

### Added
- **Stable `te-*` classes on every embed element** — card, cover, kicker,
  title, intention, meta, price, label, list, agenda(+item), enrol card,
  input, button — across the list embed, thread embed and enrol card.
- **Custom CSS that crosses the iframe** — a `<style>` block placed INSIDE
  the embed element is lifted off the host page by embed.js and injected
  into the embed iframe (`thread-embed:ready`/`:css` handshake; capped,
  CSS-only). Popups inherit the CSS of the embed/trigger that opened them.
  Injected last, so overrides win without `!important`.
- **The default stylesheet, documented and generated** — Settings → Website
  embeds shows the complete element reference with the default look (change
  the values, keep the selectors), and the code generator gains an
  "Include the starter stylesheet" checkbox that writes it into the snippet.

## [0.13.91] — 2026-07-04 — Thread 3.23.1: workspace-wide list embeds

### Added
- **`data-workspace` on list embeds** — a list of every public thread in
  the workspace, across all organisers and teams. Supported end-to-end:
  embed listing API (`?workspace=`), embed.js attribute, embed list page,
  and a "Whole workspace — everyone's public threads" option in the code
  generator's Which-threads picker. Docs updated.

## [0.13.90] — 2026-07-03 — Thread 3.23.0: embed code generator

### Added
- **Embed code generator** at the bottom of Settings → Website embeds:
  choose what to embed (thread list / one thread / enrol button), which
  thread (a real picker of your threads — team threads automatically get
  the team's public slug), which sections (cover, intention, agenda, price,
  enrol), the language (automatic = the thread's own, or fixed), and the
  button text for the popup variant. The copy-paste code builds itself —
  script tag + snippet, each with a Copy button. Unlisted threads get an
  honest note (embed works by direct link, won't appear in list embeds).

## [0.13.89] — 2026-07-03 — Flow 1.10.0: shared dialog component + bottom-bar contract

### Changed
- **Flow gets the shared Dialog/Button primitives** (ported from The
  Thread's, the pinned Fibre SPoT) — `apps/flow/components/ui/`. Migrated:
  New flow (footer Cancel · Create via form id), Add contact to flow, and
  the run popup's confirm-move and manual-move/revert sub-dialogs. The
  lifecycle menu's `window.confirm`/`window.alert` calls are gone —
  close/archive/delete now use the proper ConfirmDialog (delete styled
  destructive), errors render inline instead of browser alerts.
- Deliberately left custom: the run viewer itself and the visual flow
  canvas — they are interactive workspaces (React Flow graph, view
  toggles), not dialogs.

## [0.13.88] — 2026-07-03 — Thread 3.22.1: certificate reissue

### Added
- **Reissue certificate** — the explicit exception to snapshot immutability
  (migration `20260703100000`). The refresh button next to the Certificate
  chip on the Enrolments page regenerates the snapshot from the CURRENT
  template design after a confirm; the certificate number, recipient and
  original issue date stay unchanged, so shared verification and LinkedIn
  links keep working. `reissued_at` records the correction. No email is
  sent — resending stays the separate explicit action.

## [0.13.87] — 2026-07-03 — Thread 3.22.0: paid enrolments, approval + completion, /my code sign-in, dialog-bar rollout

### Added — payments (Phase 4 core)
- **Stripe Checkout for paid enrolments** — a paid ticket (after any
  discount code) now creates the enrolment as `payment_status='pending'`,
  opens a Checkout session against the payout account (personal → the
  organiser's connected account with Meet's as fallback; workspace →
  thread settings), with the plan-aware platform fee (2% capped €2 on
  Free, waived Pro/Org via `workspace_meet_fee`) and Stripe's
  auto-generated legal invoice (EU VAT), then redirects — escaping the
  iframe when enrolling inside a website embed. Success/cancel return to
  the public page (`?paid=…`) with honest localized messages.
- **Webhook** `POST /api/v1/thread/stripe-webhook` (signature-verified;
  `STRIPE_THREAD_WEBHOOK_SECRET`, falls back to the Meet secret) flips the
  enrolment to paid, writes the **revenue-split ledger row**
  (`thread_payout`: gross = platform fee + organiser share by the stored
  default cut + org share; actual transfers land with the payouts phase),
  and runs the confirmation side-effects. Expired sessions → failed.
- **Invoice path** — threads accepting `invoice` offer a Pay online /
  Receive an invoice toggle on the enrol card; invoice enrolments wait as
  pending with a clear message, and the organiser's **Mark paid** runs the
  same confirmation side-effects as Stripe.

### Added — approval + completion (#14)
- **Approval flow** — approval-required threads park enrolments at
  `invited`: participant gets a localized "request received" email (×5);
  the Registrations popup shows **Approve / Decline** chips. Approve →
  enrolled + confirmation + on_enrolment AND on_approval messages;
  decline → dropped (no email, deliberately).
- **Completion flow** — **Complete** per row and **Mark completed (n)** in
  the Enrolments bulk bar: status completed (100%), fires on_completion
  messages, and **auto-issues the certificate** when the thread awards one
  (the certificate email stays a separate explicit step).

### Added — participant side
- **/my sign-in with an emailed 8-digit code** next to Google (#13) —
  account created on first sign-in, i18n ×5.
- **/my cohort directory** (#16) — threads sharing participants with
  participants now show consent-gated fellow-participant chips on the
  personal page.

### Changed
- **Dialog bottom bar rolled out to web** (#17) — 14 web dialogs moved
  their Save into the footer (Cancel · Save right, destructive left);
  Meet's dialogs already complied; Flow has no shared dialog component yet
  (noted for later).
- **Embeds** (#15) — `data-lang` on all embed kinds (falls back to the
  thread's language); embedded lists open popup-interaction threads as the
  Luma-style overlay on the host page (new `thread-embed:open-enrol`
  postMessage) instead of linking out; snippets page documents both.

### Ops note
- Register the webhook endpoint in the Stripe dashboard:
  `https://thefibre-api.fly.dev/api/v1/thread/stripe-webhook`
  (event: `checkout.session.completed`, `checkout.session.expired`) and
  set `STRIPE_THREAD_WEBHOOK_SECRET` on Fly (or reuse the shared secret).

## [0.13.86] — 2026-07-02 — Thread 3.21.0: the message scheduler — sequences actually send

### Added
- **Message scheduler (Phase 6)** — fixed-date and relative messages
  ("7d after start · 09:00", "2d before end", "3d after workshop X") now
  actually send. An in-process interval on the warm Fly machine runs every
  5 minutes: finds published messages whose moment arrived (relative times
  resolved in the thread's timezone, engagement anchors supported), fans out
  to everyone enrolled (dropped excluded), renders the same per-type email
  as the on-enrolment flow with {name}/{thread}/{organiser}/{date} tokens,
  and dedup-logs every send in `thread_message_send` — restarts and
  overlapping runs can never double-send. A 72-hour lookback stops a
  (re)starting scheduler from blasting months-old messages: anything older
  stays visible on the timeline but is never emailed late. Drafts and
  archived threads never send; completed threads still can (journey tails
  outlive the closing date). Manual trigger for ops:
  `POST /api/v1/thread/scheduler/run`.

## [0.13.85] — 2026-07-02 — Thread 3.20.0: bulk certificates, LinkedIn share, compact choosers

### Added
- **Select participants → certificates in bulk** (v3 parity) — the
  Enrolments list gains per-row checkboxes + select-all and an action bar:
  Issue certificates (for the selection), Download for print (one combined
  print view at `/certificate/print?numbers=…` — auto-opens the print
  dialog, save as PDF), and Send by email (each participant gets their
  certificate link; explicit, never automatic —
  `POST /enrolments/:id/send-certificate`).
- **LinkedIn on the public certificate page** — "Add to LinkedIn profile"
  (pre-filled certification entry: name, organisation, issue date, URL,
  certificate id), Share, and Print/PDF buttons under the certificate.
- **New thread from a template** — hovering "New thread" reveals the saved
  templates; picking one opens its Use dialog (`/templates/threads?use=id`),
  clicking the button starts from scratch.

### Changed
- **Kind and Scope are compact toggles** in the new-thread form — the
  explanation of the active choice sits underneath; the big cards are gone.
- **Applied discount codes show the old price struck through** next to the
  new price on the public enrol card.
- **Certificate builder properties bar has a fixed height** — selecting an
  element no longer shifts the canvas; overflow scrolls horizontally.
- **Email sender options lose "The organiser's name"** (existing workspaces
  on it fall back to the workspace name) and **"Default organiser share"
  left Emails & defaults** — it's a payment decision, it returns with the
  payments settings.

## [0.13.84] — 2026-07-02 — Thread 3.19.0: timeline polish, editable template content, cert-template archiving

### Fixed
- **Rail dots no longer sit on top of the date badges** — the badge stacks
  above the cards' type dots (z-10) and gets a subtle shadow.
- **On-completion messages moved to the end of the timeline** — they fire at
  the end, so they render at the end; enrolment/approval messages keep
  opening it.
- **Typing in rich-text fields (Description/Body) is reliable again** — the
  editor's initial HTML is now written imperatively on mount instead of via
  dangerouslySetInnerHTML, so no re-render can reset the caret (typed text
  came out reversed).

### Changed
- **Messages default to NOT showing on the public agenda** — activities
  still default to visible; messages are the participant journey.
- **Thread templates are editable in full** — a template is a complete
  duplicate (texts, message bodies, triggers — capture and instantiate were
  already full-fidelity). The template editor now opens each engagement in
  a sub-dialog with the same content fields as the live editor: title,
  rich-text description, per-type message content (questions, assignments,
  body, links), day/time/duration. Changes persist with the template's Save.
- **Certificate templates archive instead of delete when in use**
  (migration `20260702260000`): deleting a template a thread points at
  returns "archive it instead"; the builder gains Archive/Restore, archived
  templates show dimmed with a Archived chip in the list, disappear from
  thread pickers, and issued certificates are untouched (they carry full
  snapshots).

## [0.13.83] — 2026-07-02 — Thread 3.18.0: account-aware enrolment, discount codes public, activity on /my

### Added
- **Register / sign in after enrolling** — the enrol endpoint checks whether
  the email already has a Fibre account (`auth_user_exists`, service-role
  only, migration `20260702250000`). The success and already-enrolled states
  now end with "Sign in to your personal page" (account exists) or "Create
  your account" (none — created on first sign-in, no separate signup), plus
  the note that one Fibre account covers threads, bookings and certificates
  across all apps. i18n ×5.
- **Discount codes on the public enrol form** — a "Discount code?" reveal
  under the ticket chooser, validated live via
  `POST /public/validate-coupon` (active, not expired, early-bird window,
  usage limit, ticket scope — all server-side). An applied code updates the
  shown price and button; a code that brings the price to €0 (e.g. type
  "free") enrols immediately — `coupon_id` + final `amount_cents` land on
  the enrolment and `used_count` increments. Paid remainders still wait for
  the Stripe phase. Switching tickets clears the applied code (scope).
- **Recent activity on /my** — the personal page shows the participant's own
  activity trail (subject, app, date; type + subject only — the same data
  that crosses the wall, shown to the person it's about).
- **Styling (CSS) instructions in the interface** — Settings → Website
  embeds now documents how to style embeds: container CSS (iframes — your
  site styles the frame), the `.thread-embed-wrap` snippet, and the
  "build natively, embed only the enrol card / popup trigger" pattern.

## [0.13.82] — 2026-07-02 — Thread 3.17.1: honest "already enrolled" state

### Fixed
- **Enrolling twice with the same email now says so** — the API already
  detected the duplicate (same person, same thread → no second enrolment, no
  second email), but the form showed the standard "confirmation is on its
  way" anyway. The form now reads the `already_enrolled` flag and shows
  "You're already enrolled with this email address" plus an "Open your
  personal page" button to `/my` (new tab — embeds must not open the portal
  inside the iframe). i18n ×5. Person matching stays by email: no duplicate
  contacts, and the personal page picks up all enrolments for the address
  the moment they sign in.

## [0.13.81] — 2026-07-02 — Thread 3.17.0: ticket chooser on the public enrol form

### Added
- **Ticket selection at enrolment** — with multiple prices the enrol card
  shows a radio-card list (name, description, price, sold-out state; never a
  dropdown — the Fibre chooser pattern). The selection drives the header
  price and the button label ("Enrol — €250"). Works on the public thread
  page, the Luma popup and the website embeds — all three read the same
  detail payload, which now carries `tickets` (active, non-expired, with
  sold-out flags from `quantity_limit`).
- **Enrol accepts `ticket_id`** — validated against the thread (active, open,
  not sold out) and stored on the enrolment. Without one (older embeds) the
  cheapest open ticket is assumed. Free tickets enrol directly; paid tickets
  still return "paid enrolment is not available yet" until the Stripe phase,
  which now has the chosen ticket to charge for.

## [0.13.80] — 2026-07-02 — Thread 3.16.2: one bottom bar in thread settings

### Changed
- **Save moved to the dialog footer** in thread settings — the Fibre dialog
  contract: Delete · Duplicate · Save as template on the left, Cancel · Save
  on the right. No more inline Save buttons floating inside the tabs. The
  footer Save submits the active tab's form by id (`thread-{tab}-form`);
  Basics, Registration, Certificate and Pricing (payout) all save-and-close
  through it. Pricing uses a hidden sibling form — its ticket/coupon popups
  carry their own forms and nesting would break submit semantics; their
  buttons keep their own popup bottom bars, as before.

## [0.13.79] — 2026-07-02 — Thread 3.16.1: team threads open under the team's public URL

### Fixed
- **"Open public page" 404'd for team threads** — the timeline header built
  the URL with the organiser's personal slug, but since the team-leak fix
  (3.16.0) team threads only resolve under the team's slug. The timeline
  link, the embed-listing URLs, and the new-thread URL preview now all use
  the team slug when the thread belongs to a team.

## [0.13.78] — 2026-07-02 — Thread 3.16.0: templates, truthful pricing, participant sharing

### Added
- **Thread templates end-to-end** — "Save as template" in the thread settings
  gear captures the whole design (engagements, messages, triggers) with
  relative timing; `/templates/threads` lists them with edit (name + sharing:
  personal / team / workspace), delete, and "Use template" which rebases every
  date onto the new start. Templates hub card un-stubbed.
- **Registrations popup** — the registrations icon on the timeline opens
  everyone enrolled for *this* thread (status, payment, certificate badges)
  without leaving the editor; links to the full enrolments page.
- **Participant sharing** — Registration tab gains "share publicly" (Who's
  coming on the public page) and "share with participants" toggles; names show
  only for enrollees who opted into the cohort directory (consent-gated,
  brief §9). Migration `20260702240000` + enrol-form opt-in checkbox, i18n ×5.
- **Payment methods** on threads (`stripe` / `invoice`, migration
  `20260702230000`) — stored now; the invoice flow ports from Meet with the
  payments phase.
- **Website embeds discoverable** — Settings → Website embeds shows the four
  copy-paste snippets (script, list, single thread, enrol popup).

### Fixed
- **Public price now reads tickets** — a thread with a €250 ticket said "Free"
  on the public page because the card read the legacy `price_cents`. The
  organiser page, thread page, embed listing and the enrol guard now derive
  the price from the cheapest active, non-expired ticket (fallback:
  `price_cents`). Paid threads are blocked from free enrolment on the same
  derived price; a genuinely free ticket keeps the free path open.
- **User-menu Settings/Profile were dead buttons** in Thread — they never had
  a link. Now: Profile → `/settings/profile`, Settings → `/settings`; "Take a
  tour" visibly disabled until a tour exists. Flow's menu pointed at settings
  pages Flow doesn't have — both entries now go to the platform settings.
- **Team threads no longer leak** onto the organiser's personal public page —
  organiser-kind public queries filter `team_id IS NULL` (listing, detail,
  enrol).

## [0.13.77] — 2026-07-02 — Thread 3.15.0: certificate issuance + public certificate page

Certificates close the loop from designer to artefact:

- **Issue** — per-enrolment "Issue certificate" on the Enrolments page
  (threads with certificates enabled), plus **"Issue to completed"** bulk
  when filtered to a thread. Numbers `THR-YYYY-XXXXX` (unambiguous
  alphabet, collision-checked); the **template + resolved values are
  snapshotted** at issue time — later edits never change an issued
  certificate. One per enrolment; re-issuing 409s. The recipient gets a
  branded email with their link + number.
- **Public page** `/certificate/{number}` — anyone with the number can
  verify: the snapshot renders with the builder's exact %-element model,
  scaled to fit, with a **Print / Save as PDF** button (A4/Letter
  `@page` CSS, backgrounds preserved — the print-quality-HTML decision
  from day one). `?print=1` auto-opens the dialog.
- Issued certificates show as green chips on enrolment rows, linking to
  the public page.
- Auto-issue on completion connects when the completion flow (#14) lands.

Implements [`docs/platform-spot-members-profile.md`](docs/platform-spot-members-profile.md)
(migration `20260702220000_user_profile.sql`, applied + backfilled):

- **thefibre.app Settings → Members is canonical** (admin-gated): member
  list with workspace-role, internal/external relationship and one
  checkbox per activated app; invite by email (pending user + person +
  app grants + branded invite — Meet's mechanics generalised). API:
  `GET/POST /api/v1/members`, `PATCH /api/v1/members/:userId`.
- **Public profile at platform level**: new `user_profile` (display
  name, bio, photo, timezone), backfilled from Meet ← Thread. Edited on
  thefibre.app Settings ("shared across the Fibre apps"); API
  `GET/PATCH /api/v1/profile`. **Thread inherits** — organiser fields
  become overrides, `/thread/me` merges the platform profile.
- **Apps show, the platform manages**: Thread's Internal team is
  read-only with a "Manage in The Fibre" link; Meet keeps its page one
  release with a transition banner.
- **Interface fixes**: user-menu dropdown gained `z-50` in all four apps
  (timeline cards painted over it); Thread sidebar's Certificates became
  **Templates** — a hub for certificate templates (live) and thread
  templates (next).

## [0.13.75] — 2026-07-02 — Thread 3.14.0: destructive-action SPoT, team URLs, shared payments

(Migrations `…200000_thread_coupon_ticket_scope` +
`…210000_thread_email_from_mode`, applied.)

- **Thread settings footer = engagement parity**: Delete · Duplicate ·
  Close. **Duplicate** clones the thread + engagements as an unlisted
  draft. **Delete** uses the new app-wide `DangerConfirmDialog` — type
  DELETE to arm the button — now the single point of truth for every
  hard delete (thread + engagement switched to it).
- **Popups close after save**; closing with unsaved changes warns first
  (settings + engagement dialogs).
- **Public URLs group by owner**: team threads live under the **team's
  slug** (`thread.thefibre.app/{team}/{thread}`), personal under the
  organiser's. One root namespace, organiser-first resolution; public
  pages, enrolment, embeds and email links all follow.
- **Payments settings shared with Meet** (SPoT): Thread reads your Meet
  Stripe account as the personal fallback; the Payments card links to
  Meet's settings. Connections card likewise.
- **Email sender selectable**: workspace name / the thread's team name /
  the organiser's name / custom fill-in (Emails & defaults).
- **Discount codes**: default EARLYBIRD 10% auto-created when a thread
  goes Paid; codes can apply to **all tickets or one specific ticket**.
- **Registrations at thread level** — header icon opens Enrolments
  filtered to that thread. **Contacts rows open a popup** (threads,
  status, link to the Fibre profile).

(Migration `20260702190000_thread_event_anchor_and_interaction.sql`, applied.)

- **Messages can anchor to an event**: "relative" triggers now offer the
  thread's activities as anchors ("2d before *SDL — vertrouwen* · 09:00"),
  next to thread start/end. The timeline computes their spot from the
  anchor's date; labels show the event title.
- **Timeline cards float** — subtle layered shadow (and Flow's card
  shadow softened to match: less bulk, same lift).
- **Threads overview filters**: status chips All · Active · Drafts ·
  Past, next to the team chips.
- **Thread page or enrol popup**: a Basics setting decides what an
  overview click does — the full public page, or a **Luma-style popup**
  with cover, info and direct enrolment (live on the organiser page;
  embed lists follow the same setting via the thread detail).
- **Pricing keeps the Free/Paid toggle** — Paid reveals the ticket +
  discount-code lists; Free hides them. **Quantity is a plain number
  field** now, not a dropdown.

- **Personal page is login-based now** (Sjoerd: no email-token links).
  `/my` asks participants to **sign in** — Google SSO today, the
  platform's emailed login code as the passwordless path, more providers
  later. Visitor sessions skip the workspace access-check (participants
  aren't members); the API verifies their Supabase JWT directly and
  matches persons by email across workspaces. The token portal (`/p/…`)
  is removed; confirmation emails link to `/my`.
- **Payout**: exactly two options — Workspace account / My personal
  account — no Auto. Options **grey out when no Stripe account is
  connected**; the default pre-selects per the rule (team thread →
  workspace; personal thread → personal when connected).
- **Engagement dialog**: the Where block (in person / virtual + fields)
  moved to the **first column**; the Personal-meeting-room provider
  option greys out when not configured in Meet.
- **Thread image**: Basics gains a cover upload (thread-assets bucket,
  preview, replace/remove) — shown on the public page and embeds.

(Migrations `20260702170000_thread_tickets.sql` +
`20260702180000_thread_policy_consent.sql`, applied.)

- **Pricing, v3 model**: the Pricing tab is now a **list of tickets**
  (name, price or Free, quantity limit, availability window, active) and
  a **list of discount codes** (mono code, percentage/amount/free,
  usage n/limit, early-bird deadline, expiry) — each row opens a popup
  editor with Delete in the footer. Payout selector stays. Checkout +
  redemption arrive with the payments phase.
- **Privacy-policy consent at enrolment**: required (never pre-ticked)
  checkbox linking the policy, in all five languages; the accepted
  **versioned policy list** lives in `apps/thread/lib/policies.ts` and
  the accepted version + timestamp are stored on the enrolment.
- **The personal page** — email-based visitor identity: the
  confirmation email's button now opens `/p/{signed-token}` — the
  participant's own page listing everything they're enrolled in across
  threads, localized, no account or password (the emailed link is the
  credential; HMAC-signed, 180-day, refreshed by every new email).
  Groundwork for the Fibre-wide visitor identity.
- **Engagement dialog polish**: title spans the full width, Type/Status
  stacked, right column narrower.
- **Per-thread organisation dropped** (Sjoerd: an organiser practically
  never organises for another org — teams cover intra-org, another
  workspace covers the rest). UI + plumbing removed; the column stays
  dormant.

Four asks in one release (migrations
`20260702150000_thread_payment_destination.sql` +
`20260702160000_thread_language.sql`, applied; `thread-assets` storage
bucket created):

- **Certificate builder**: real background + element **image upload**
  (drop-zone → public `thread-assets` bucket, thumbnail preview,
  replace/remove, URL fallback); element **properties bar moved above the
  canvas**; Share dialog gains **"Everyone in the workspace"** vs "Only
  selected people and teams".
- **Webflow embeds**: paste `<script src="https://thread.thefibre.app/embed.js">`
  plus `data-thread-embed` divs — `list` (overview of an organiser, team
  or org), `thread` with chosen elements (`cover,intention,agenda,price,enrol`),
  `enrol` opening the subscription form in a popup overlay. Auto-resizing
  iframes, origin-checked postMessage, framework-free, <200 lines. Bare
  `/embed/*` pages reuse the real enrol flow. New public endpoint
  `GET /thread/public/embed/threads?organiser=|team=|org=`.
- **Language system**: every public string (organiser/thread pages, enrol
  card, embeds, participant emails) lives in a **typed catalog**
  (`apps/thread/lib/i18n.ts`) translated to **English, Dutch, Spanish,
  Portuguese, German** — a key missing a translation fails typecheck,
  which is how the list stays complete. Threads carry a `language`
  (settings → Basics, default English); the enrolment confirmation email
  localises subject, body and date formatting.
- **Payout selector** (Pricing tab): Workspace / Personal / Auto —
  auto = workspace for team/workspace-shared threads, personal (when
  connected) for personal threads. Stored on the thread; Phase 4
  checkout reads it.

Nine interface improvements in one slice
(migration `20260702140000_thread_engagement_location_provider.sql`, applied):

- **Engagement dialog, two columns**: left = what it is (title, rich-text
  description, message content), right = when + where (type, status,
  times, location). Order follows the work, not the schema.
- **One date-time popover — the Fibre single point of truth**: calendar
  left, scrollable 15-minute time column right, one trigger showing
  "Wed 2 Jul 2026 · 09:00". Synced to web + meet copies.
- **Quick time edit**: click the time on any timeline card → a small
  popup to change just the schedule.
- **Delete moved off the timeline** into the dialog footer, joined by
  **Duplicate**; Save/Cancel on the right, destructive actions left.
- **Thread settings: tabbed** (Basics / Pricing / Registration /
  Certificate — more coming), behind a proper gear icon. **Pricing tab**
  new: Free/Paid 2-card chooser + price + currency (checkout arrives with
  the payments phase).
- **Rich text** (bold, italic, lists, links) for descriptions and message
  bodies; emails strip to clean plain text; the public agenda renders it.
- **Status = toggle** (Draft | Published segments), no more select.
- **Meeting link = provider dropdown** (Google Meet / Zoom / Teams /
  Personal room / Custom — Meet's vocabulary). Personal room reads your
  Meet profile setting: connection settings are shared across the family.
- **Location = In person / Virtual toggle** with consequential fields:
  in person → description + map link; virtual → provider + meeting link.

The Thread grows the same workspace surfaces Meet has:

- **Threads overview filter** — chips above the list: All · Personal ·
  one per team; team name rides along in each row's meta.
- **Teams** — create teams right in Thread (platform `team`, creator
  becomes lead), team detail with member management (add from workspace
  members with lead/member role, remove with confirm). Same primitive
  Meet and Flow use.
- **Contacts** — everyone who has enrolled in your threads, with their
  thread chips and a link out to their Fibre profile.
- **Internal team** — workspace members with their Thread access;
  one-click "Grant access" gives the-thread app membership.
- **Settings** becomes a real hub: Profile (organiser slug, display
  name, bio, photo, timezone → your public page) and Emails & defaults
  (sender name, footer note, default organiser revenue share). Payments
  card waits for the payments phase.
- Sidebar gains a People section: Contacts / Teams / Internal team.

Two big pieces (migration `20260702120000_thread_templates_and_scoping.sql`,
applied):

### Certificate template builder — v3's designer, ported

- **/certificates** — template list (scope chips, page size, updated) +
  New template (name + Personal/Team/Workspace scope).
- **/certificates/[id]** — the builder: white page canvas with aspect-true
  A4/Letter portrait/landscape, background image URL, %-positioned
  elements (field tokens · text with `{token}` substitution · image ·
  line), click-select with yellow outline, drag to move, double-click to
  edit text inline, properties strip (font family/size, width, bold /
  italic, align, colour, opacity, z-order), 2s debounced auto-save +
  manual Save, delete with confirm. Nine field tokens with sample-value
  preview (recipient, thread title, org, dates, certificate number,
  criteria, issued by).
- **Template scoping**: personal / team / workspace; workspace templates
  can be granted to selected members and teams via a Share dialog
  (`thread_template_share`; no grants = whole workspace).
- **Thread settings** gains the v3-style Certificate section: enable +
  pick from the template list + criteria field.
- Schema also lands `thread_template` (thread templates, next release).

### Dates move together (v3's shiftAllEngagementDates)

Change the thread's start date and **every fixed engagement date shifts
by the same number of days** — start/end times, message send moments,
and the thread's end date (unless the same save explicitly changed it).
Relative and lifecycle triggers follow automatically since they're
computed from the thread window.

Threads join the Fibre categories
(migration `20260702110000_thread_scope_and_roles.sql`, applied):

- **Personal / Team scope** on New thread (the 2-card chooser, platform
  `team` — in-family apps use platform tables natively). Settings can
  reassign the team and link an **organisation** as the thread's public
  face. Both show as chips under the timeline header.
- **Hosts & facilitators**: invite workspace members to a thread via the
  new people button in the header — pick a member, pick a role (hosts
  edit, facilitators run sessions), done. Invited users get a
  thread_organiser profile auto-provisioned. Roles renamed
  co_organiser → host.
- API: `GET /thread/teams`, `GET /thread/workspace-members`,
  `POST/DELETE /thread/threads/:id/members`.

The timeline was too monochrome. Per-type colour now carries through:
tinted icon chips on every card (sky event / emerald conversation /
amber workshop / blue message / violet reflection / teal practice /
slate document / pink inspiration), matching coloured type labels,
bigger dots on the rail. Date badges get the Thread brand-yellow month
bar (v3's accent); the add-engagement button glows yellow on hover.

## [0.13.65] — 2026-07-02 — Thread 3.4.0: engagement triggers + date-window rule

Two structural rules from Sjoerd land together
(migration `20260702100000_thread_engagement_triggers.sql`, applied):

- **Activities stay inside the thread window.** Event / conversation /
  workshop dates must fall between the thread's start and end — enforced
  in the API on create + update, and in the editor via the date picker's
  min/max (out-of-range days grey out).
- **Messages get a "When to send" trigger** instead of only a fixed date:
  *fixed date* · *relative to the thread dates* (N days before/after
  start/end, at a chosen time — curated dropdowns) · *when someone
  enrols* · *when their enrolment is approved* (only offered when the
  thread requires approval) · *when they complete the thread*.
- **On-enrolment messages are live now**: the public enrol flow sends
  every published on-enrolment message to the new participant
  immediately — personalisation tokens substituted, branded shell,
  deduped per (engagement, person) via `thread_message_send`
  insert-first. Approval/completion delivery hooks in when those flows
  land; fixed + relative sends arrive with the Phase-6 scheduler.
- **Timeline placement understands triggers**: lifecycle-triggered
  messages sit in an "Auto" group at the top; relative messages get a
  computed date from the thread window and sort chronologically; cards
  show trigger labels ("On enrolment", "3d before start · 09:00").

Editing popups grow into thethread-v3's roomy shape (decision: big
centered modal over a side drawer). Dialog gains an `xl` size —
`max-w-3xl`, generous padding — and a footer slot that sits outside the
scroll area, so Save/Cancel behave as a sticky save bar. The engagement
editor and thread-settings dialog both move to it: two-column field
grids, larger spacing, error message inline in the save bar.

## [0.13.63] — 2026-07-02 — Thread 3.3.0: v3-style timeline editor (no tabs)

The thread editor drops its tabs for thethread-v3's layout (read from the
v3 source, restyled in Fibre tokens): the thread is the **main item** up
top, the engagements flow **immediately under it** as a vertical timeline.

- **Header row** — back, start-date chip, **inline-editable title** (blur
  or Enter saves), status pill (Draft / Published / Completed / Archived —
  a disguised select), settings gear, open-public-page link. Intention
  line beneath.
- **Timeline** — left rail with a vertical line, **date badges** (MON/DD)
  per day group, same-day cards visually attached (v3's rounded-t/-b
  grouping), **coloured type dots** on the line per engagement type.
  Cards show type, title, time (activities) or "Sends HH:MM" (messages),
  location/online badges, hover-reveal delete. Undated items group under
  a dashed "No date" badge.
- **Add** — dashed button at the timeline's end opens a type menu
  (Activities / Messages with their dots); picking one opens the editor
  dialog with the type preselected.
- **Thread settings** (name/slug, intention, dates, timezone, public
  listing + registration questions) move behind the gear into a dialog.
  Status was removed from that form — the header pill owns it, so saving
  settings can no longer reset a published thread to draft.

## [0.13.62] — 2026-07-02 — Fibre-styled date fields everywhere (Meet 2.1.5 · Thread 3.2.1)

Native `<input type="date">` / `datetime-local` (and their cramped,
unstylable browser popovers) replaced with a shared `DateField` /
`DateTimeField` component in house style — Sjoerd: "higher UX quality,
more spacious, bigger fonts."

- **Spacious trigger** (44px tall, 15px type, formatted "Wed 2 Jul 2026",
  calendar icon, inline clear ×) + **custom calendar popover**: 40px day
  cells, month nav, today ring, selected fill, min/max disabling, Today +
  Clear actions. Fixed-position so it never clips inside dialogs.
- **Times are curated dropdowns** (hours + quarter-hour minutes) per the
  house rule — no free-form time typing.
- Zero new dependencies; hidden inputs keep every existing FormData form
  working unchanged. Supports controlled mode for dynamic lists.
- Converted: Thread (new/edit thread dates, engagement starts/ends/send-at),
  Web (programme dates, org member started, org relationship touchpoints,
  contact first-contact), Meet (one-off date & time, poll candidate slots).
  Flow has no date inputs today; the component is ready to copy in when it
  does.

Theme + sidebar preferences were deliberately host-only per app (a
documented earlier decision). Sjoerd reversed it: one user = one
preference, everywhere. `savePref` now writes the cookies with
`domain = NEXT_PUBLIC_COOKIE_DOMAIN` (`.thefibre.app`) — same mechanism
as SSO — and evicts the legacy host-only cookie so it can't shadow the
shared one. Applied to all four apps.

Bonus: The Thread's user menu still wrote `document.cookie` directly
(host-only AND capped to 7 days by Safari ITP — the very problem the
server action solves). Now uses the shared `savePref` action like the
other apps.

## [0.13.60] — 2026-07-01 — fix: "Body is unusable" in every app's API client

The error path of `apiFetch`/`publicFetch` read the response body twice
(`res.json()` then `res.text()` in the catch) — when an API error payload
wasn't valid JSON, the second read threw `TypeError: Body is unusable`,
masking the real error. Now the body is read once as text and JSON-parsed
best-effort. Fixed in all six copies (web, meet, thread, flow ×
api.ts/public-api.ts). Spotted in thread.thefibre.app production logs.

Also today, production got un-wedged: the API's "verified" Thread deploy
turned out to be a false positive (a 401 from the auth middleware proves
nothing about routes) — the real Fly release was still June 10. Redeployed;
`/api/v1/thread/public/*` now serves real payloads and junk slugs 404.

## [0.13.59] — 2026-07-01 — Apps catalog catches up with Flow; thread Vercel project

- **Fibre web knew nothing about Fibre Flow** — `apps/web/lib/apps.ts`
  (AppSlug, APPS, APP_ORDER) and Settings → Apps (`INSTALLABLE` +
  descriptions) still listed only Meet / Thread / Sales / Learn. Flow now
  appears as an Active app; Sales stays "Building", Learn "Planned".
- **`thefibre-thread` Vercel project created** (it never existed — the
  build-plan note that the skeleton was live turned out to be stale).
  Root `apps/thread`, linked to the GitHub repo, fra1, all 7 env vars
  copied from `thefibre-meet` (incl. `NEXT_PUBLIC_COOKIE_DOMAIN` per
  deploy.md), domain `thread.thefibre.app` attached and verified. First
  deploy rides this commit.

### The platform loop closes — first delivery app writing real enrolments

Public front end + free enrolment, end-to-end tested against the real API
(person → consent → enrolment → activity → email; idempotent retry
verified; test data cleaned).

- **Public pages** (no auth, service-role reads like Meet):
  `/{organiserSlug}` — organiser profile + listed active threads;
  `/{organiserSlug}/{threadSlug}` — cover, intention, capacity + certificate
  badges, **agenda** (published activities only; meeting links hidden until
  enrolment, shown as an "Online" badge), sticky enrol card.
- **Enrolment flow** (`POST /thread/public/enrol`): platform person
  create-or-match by email → consent records (`transactional_email`/contract
  required, `marketing_email`/consent only on opt-in, per brief §9) →
  platform `enrolment` (status enrolled) → `thread_enrolment` companion →
  `event_registered` activity (type + subject only — the wall holds) →
  branded confirmation email. Idempotent via client `request_id`; duplicate
  signups collapse; capacity enforced; paid threads 409 until Phase 4.
- **Registration tab** in the thread editor — custom enrolment questions
  (short / long / choice / checkbox, required flag); answers stored on
  `thread_enrolment.answers`, never on the platform.
- **Enrolments page** in-app: everyone across your threads with platform
  status + payment state.
- `shell()` email template exported from Meet's module; Thread templates
  share the same visual family (`thread-templates.ts`).

### Engagements — the thread timeline

The thread editor grows tabs (Meet's pattern: all tabs stay in the DOM).
**Basics** is the existing form; **Engagements** is new:

- **Timeline** — engagements ordered by position, one card each: type icon,
  title, status chip, when (start time for activities, "Sends …" for
  messages), online/location badges. Move up/down, edit, delete
  (with confirm).
- **Add engagement** — dialog with the 8 types grouped in their two
  families (Activities: event / conversation / workshop · Messages:
  message / reflection / practice / document / inspiration). Activities
  carry starts/ends, location and a plain **meeting link** (Zoom / Teams /
  Meet — the v3 approach, no OAuth). Messages carry **Send at**
  (`scheduled_at`) plus type-specific content: reflection questions,
  practice assignments, document link + note, inspiration text,
  message body (with `{name}`/`{thread}`/`{organiser}`/`{date}` tokens
  for the Phase 6 sender).
- **Family lock respected** — editing offers only same-family types,
  mirroring the API rule.
- `lib/engagement-meta.ts` — single source for type labels, icons
  (Lucide), families and descriptions.

### The Thread rebuilt from scratch — Fibre-native, simpler than v3

The Thread starts over inside the monorepo: thethread-v3
(`~/Projects/thethread-v3`) is the functional reference, the Fibre design
system is the interface, and the platform is the core. Full design +
phase plan in [`docs/thread-rebuild-plan.md`](docs/thread-rebuild-plan.md).
Scope locked with Sjoerd: 8 features (typed engagements, paid enrolments +
coupons, certificate designer, Zoom/Teams links, multi-organiser,
per-organiser Stripe with v3's revenue split, public pages, email
sequences). Thread's user-facing version is now **v3.x**, decoupled from
the monorepo cadence — same rule as Meet's v2.x.

**Phase 1 in this release:**

- **Schema** — `20260701090000_thread_schema.sql`: `thread_organiser`
  (per-user, Stripe account + vendor cut), `thread_settings`
  (workspace-level Stripe + email branding), `thread_thread` (1:1 with a
  platform `program` row — a thread IS a programme), co-organiser join,
  `thread_engagement` (8 types in two families: activities event /
  conversation / workshop with `meeting_url`; messages reflection /
  practice / message / document / inspiration with `scheduled_at`),
  `thread_enrolment` (1:1 companion to platform `enrolment`),
  `thread_coupon`, `thread_certificate_template` + `thread_certificate`,
  `thread_message_send`, `thread_payout`. Meet's RLS pattern throughout.
- **API** — `apps/api/src/routes/thread.ts`: organiser auto-provision
  (`GET/PATCH /thread/me`), workspace settings, threads CRUD (creates and
  syncs the paired `program` row), engagements CRUD with the
  family-locked type rule. Reserved-slug validation extends Meet's shared
  list with Thread's route names. `/thread/public/*` +
  `/thread/stripe-webhook` pre-registered as public prefixes.
- **App** — `apps/thread` wakes up: Threads list, New thread
  (Event/Journey 2-card chooser + `NameAndSlugFields`), thread editor
  (Basics: name/slug, intention, dates, status, timezone, public
  listing). Sidebar nav: Threads / Enrolments / Certificates (stubs where
  phases are pending). Thread sidebar shows **v3.0.0**.

## [0.13.55] — 2026-05-30 — Fibre Flow v1.9.0

### Run popup: journey list view + per-step notes

Clicking a contact now opens a **List / Flow** toggle (List is the default):

- **List view** — the steps stacked vertically in builder order, non-current
  steps muted, the **current step as a thick card** with its gate tasks
  (tickable, and now re-openable) and a "Current" badge. Transition labels
  ride the connectors between steps. Every step has a **"Move here →"**
  action (same gated / revert confirm popups).
- **Per-step notes** — every step card carries a comment composer; notes show
  with author + date in soft amber. Stored in a new app-private
  `flow_run_note` table (content never crosses the data wall into activity).
- **Flow view** — the existing graph + token interaction, one click away.

Migration `20260530100000_flow_run_note.sql`; API: notes embedded in
`GET /flow/runs/:id`, new `POST /flow/runs/:id/notes`.

## [0.13.54] — 2026-05-29 — Fibre Flow v1.8.0

### Board restyled + columns follow the builder layout

- **Board columns match the card language**: each column is now a soft grey
  rounded panel (no hard borders) with a kind dot, a white count pill, dashed
  "No one here" empty slots, and white shadow-card contact cards with tinted
  avatar circles inside.
- **Column order = builder order.** Columns sort by the step's canvas position
  (left-to-right, then top-to-bottom) instead of creation order, so the board
  reads exactly like the flow in the Builder. Saving from the canvas now also
  persists steps in visual order, so reports follow the same reading.

## [0.13.53] — 2026-05-29 — Fibre Flow v1.7.2

### Lighter builder grid

Grid lines stepped down another notch (#eaeef4) so they read as a whisper
under the cards rather than a visible lattice.

## [0.13.52] — 2026-05-29 — Fibre Flow v1.7.1

### Loop-back transitions easier to draw

Backward transitions (e.g. `Nurture → First Contact`) were always supported by
the model and runtime — but drawing one required hitting exactly the right
handle pair. The builder now uses React Flow's **loose connection mode**: drag
from any handle to any handle and the edge connects, making loop-backs (and
everything else) much easier to draw. Self-connections (step → itself) are
blocked client-side to match the DB constraint.

## [0.13.51] — 2026-05-29 — Fibre Flow v1.7.0

### New step kind: Loop — closes a cycle back to the start

The briefing's "Waitlisted (loops back)" pattern, now first-class. A **Loop**
step (amber chip, ↻ icon, "Loop — back to start" in the Kind dropdown) bounces
the contact straight back to the flow's **Start** step the moment they enter
it: fresh entry tasks are materialised and the activity timeline logs
"Looped back to {start} via {loop step}". Works on gated transitions, manual
moves, and board drag-and-drop alike — no need to hand-draw a return edge.

- Migration `20260529230000_flow_step_loop_kind.sql` (relax `flow_step.kind`).
- API: both move paths redirect loop destinations to the entry step.
- Builder/run-popup/board pick up the amber loop styling.

## [0.13.50] — 2026-05-29 — Fibre Flow v1.6.0

### Board drag-and-drop, full-width flow page, builder polish

- **Drag contacts across the board.** Kanban cards are draggable: drop one on
  another column and the move popup opens with that step pre-selected — the
  same gated-confirm / manual-move (revert) logic as in the run popup. The
  target column highlights while dragging; the dragged card dims.
- **Flow detail page is full width.** Dropped the `max-w-4xl` cap so the board
  and builder use the whole screen (per the screenshot where the board was cut
  off at the container edge).
- **Builder canvas is much larger in-page** — grows with the viewport
  (`calc(100vh - 340px)`, min 560px) instead of a fixed 560px; full-screen
  toggle still available on top.
- **Lighter grid** lines (slate-200).
- **Kind icons on step cards** — the pill chip now carries an icon: ▶ Start,
  ○ Step, ✓-circle End (positive), ✗-circle End (negative).

## [0.13.49] — 2026-05-29 — Fibre Flow v1.5.0

### Full-screen builder

The builder toolbar gets a **maximise** button that expands the canvas to fill
the whole screen (fixed overlay) for plenty of room to lay out big flows —
**Esc** or the minimise button exits, and the view re-fits on toggle. Normal
(in-page) mode unchanged.

## [0.13.48] — 2026-05-29 — Fibre Flow v1.4.0

### Cool-grey canvas + soft floating cards (matching the design references)

Retuned Fibre Flow's theme to the clean-dashboard look from the shared
references:
- **Background** shifts from warm cream to a **cool light-grey** (`#eef1f6`);
  ink/line tokens move to the **slate** family — cooler, crisper overall.
- **Cards float** on the grey with a **soft, diffuse shadow** (new
  `.shadow-card` / `.shadow-card-hover` utilities) instead of a tight
  `shadow-sm` — pure-white cards lift off the canvas the way the references do.
- Applied across Home, Flows, board, Tasks, Reports, Contacts, builder cards,
  and the run popup. Flow has its own theme tokens, so Meet / The Fibre are
  untouched.

## [0.13.47] — 2026-05-29 — Fibre Flow v1.3.3

### Builder + run-popup cards match the clean-dashboard style

The canvas step cards were still the odd ones out — whole-card colour tint +
heavy border. Reworked to match everything else: **white cards** with a soft
`ring-1 ring-black/5` + shadow (lifting on hover/select), with the step kind
shown as a **tinted pill chip** (Entry / Step / ✓ End / ✗ End) instead of
colouring the whole card. Run-popup step cards likewise white with a small
coloured kind dot; drop-target highlights now use a dashed outline.

## [0.13.46] — 2026-05-29 — Fibre Flow v1.3.2

### Consistent page headers across Flow

Unified page chrome so every Flow page matches Home: same large semibold
heading (`text-[28px]`), same top spacing (`py-10`), same subtitle treatment —
Flows, the flow detail, Tasks, and Contacts were still on the older smaller
medium-weight headers.

## [0.13.45] — 2026-05-29 — Fibre Flow v1.3.1

### Clean-dashboard card style rolled out across Flow

Propagated the Home design language to every surface: Flows library, kanban
board + list, Tasks (quick-add + rows), Reports stat cards, Contacts, and all
empty states + dialogs. Hard borders → soft `ring-1 ring-black/5` + `shadow-sm`
(hover `shadow-md`), `rounded-xl`/`rounded-2xl` corners, tinted rounded icon
chips + avatar circles, pill-shaped status/lifecycle badges, modals at
rounded-2xl. Consistent, modern, card-forward throughout.

## [0.13.44] — 2026-05-29 — Fibre Flow v1.3.0

### Home dashboard — clean-dashboard-card redesign (direction sample)

Reworked Home toward the "clean dashboard UI" references: pure-white cards
floating on the canvas with soft shadows + hairline rings (no hard borders),
rounded-2xl corners, tinted rounded icon chips, big bold stat numbers, and
pill badges. Three stat cards (Open tasks / In motion / Favourite flows) +
favourite-flow cards in a grid. Sample surface — to propagate across Flows,
board, and Tasks once the direction's confirmed.

## [0.13.43] — 2026-05-29 — Fibre Flow v1.2.1

### Builder grid → visible lines

The dot grid was too faint to read; switched to a proper **lines grid**
(slate-300 on a slate-50 canvas) so it's clearly visible. Grid toggle unchanged.

## [0.13.42] — 2026-05-29 — Fibre Flow v1.2.0

### More modern, card-like canvas + visible grid

- **Visible grid.** Builder canvas now sits on a soft slate background
  (`#f1f5f9`) with clearly-visible dots (slate-400, size 2.2) — the grid is
  actually there now. Toggle still works.
- **Floating cards.** Step cards are rounded-xl with a real drop shadow
  (`shadow-md`, lifting to `shadow-lg` on hover/selected) and a thinner 1px
  coloured border — they float on the tinted board instead of sitting flat.
- Same treatment in the run popup (tinted pane + card shadows) and the kanban
  board (cards gain a subtle shadow + hover lift).

## [0.13.41] — 2026-05-29 — Fibre Flow v1.1.1

### Removed the "Advanced — edit graph as JSON" escape hatch

The visual builder is now the single way to author flows — the JSON editor
disclosure (and `editor.tsx`) is gone. Cleaner Builder tab.

## [0.13.40] — 2026-05-29 — Fibre Flow v1.1.0

### Builder canvas — auto-arrange + grid/snap settings (Miro-like)

- **Auto-arrange** button: tidies cards into clean columns by longest-path depth
  from the entry step (rows stacked per column), then fits the view. One click
  to make a messy canvas orderly.
- **Canvas settings** popover (gear): toggle the **Grid** (dot background) on/off
  and **Magnetic (snap-to-grid)** on/off — drag freely or snap to the 24px grid.

## [0.13.39] — 2026-05-29 — Fibre Flow v1.0.2

### Modernised colour palette

Refreshed Flow's step/status colours to a cooler, more contemporary scheme,
applied consistently across the canvas, board, run popup, reports, and chips:
entry **blue → indigo**, end-negative **red → rose**, neutrals **→ slate**,
softer **-200** borders, and lighter (-50/-100) lifecycle + status chips.

## [0.13.38] — 2026-05-29 — Fibre Flow v1.0.1

### Builder: proactive publish-readiness hints

Instead of only learning what's missing when Publish fails, the builder now
shows an amber hint banner the moment the graph isn't publishable — "Mark a
step as an End (positive ✓ / negative ✗)", "Set one step's Kind to Entry", etc.
— with a pointer to click a card to open its panel and change its Kind. Makes
the entry/end requirements discoverable rather than a surprise on publish.

## [0.13.37] — 2026-05-29 — Fibre Flow v1.0.0 🎉

### Fibre Flow Phases I + J — lifecycle, reports, seed, v1.0

Fibre Flow reaches **v1.0** — a complete people-flow app: design flows on a
drag-and-drop canvas, put contacts in, move them through gated steps (manually
or auto-completed by cross-app activity), revert, and watch a kanban board /
report. Home + Tasks are the daily driver.

#### Lifecycle (Phase I)
- A flow-actions menu on the flow header: **Close to new contacts** (with an
  "N contacts still active" prompt), **Reopen**, **Archive** / **Restore**, and
  **Delete** (soft). Closed flows block new entries but let existing contacts
  finish.

#### Reports (Phase I)
- A **Reports** tab per flow: total / active / completed / withdrawn stat
  cards, plus a current-distribution bar chart across steps. (Honestly scoped:
  current snapshot, not a historical cohort funnel — that needs step-history
  tracking, noted inline.)

#### Seed (Phase J)
- `apps/api/scripts/seed-flow.mjs` — idempotent demo "Partnership Pipeline"
  flow (5 steps, gated transitions) with a few seeded people placed across
  steps and their gate tasks materialised. For fresh/demo workspaces.

#### Cutover (Phase J)
- Fibre Flow user-facing version → **v1.0.0**. Phases C–J all shipped.

## [0.13.36] — 2026-05-29 — Fibre Flow v0.12.0

### Fibre Flow Phase H — kanban board

The Flows tab now defaults to a **board**: one column per step (colour-accented
by kind), contact cards grouped by their current step, with avatar, name, and
time-at-step. A **Board / List** toggle switches views. Click any card → the
move popup. Withdrawn runs show faded in their column; runs on an old flow
version fall into an "Other" column.

- `apps/flow/app/(app)/flows/[id]/runs-panel.tsx` gains the `Board` view +
  toggle; the flow detail page passes the version's `steps` as columns.

## [0.13.35] — 2026-05-29 — Fibre Flow v0.11.0

### Fibre Flow Phase F — contact gate tasks auto-complete from activity

The cross-app magic: when any app writes an activity for a person (Meet logs a
`meeting_booked`, Thread a session attendance, …), Flow closes any open
**contact** gate task whose `contact_action_type` matches that activity type
for that contact — so the gate turns green with no manual logging.

- DB trigger `flow_autocomplete_on_activity` (AFTER INSERT on `public.activity`,
  SECURITY DEFINER). Matches on `(contact_id = person_id, contact_action_type =
  activity.type, workspace)`. Completes the task; does **not** auto-advance the
  run (a human still confirms the move — the gate just shows satisfied).
  Migration `20260529190000_flow_autocomplete_contact_tasks.sql`.
- Builder: the gate-task `contact_action_type` field now offers a datalist of
  known activity types (Meet booked / requested / attended, Thread attended,
  signed contract, …) with an inline explanation; default is `meeting_booked`.

### Note
- Auto-advancing the run when a gate is fully satisfied is a deliberate future
  step (which transition? branching?). For now the task completes and the
  gate reads green.

## [0.13.34] — 2026-05-29 — Fibre Flow v0.10.1

### Polish: revert direction in the manual-move popup

A backward (revert) move now reads as a revert: the popup title says "Revert
to …", and the action button shows a **left-pointing** arrow ("← Revert")
instead of "Move →". Forward/sideways manual moves keep "Move →". Direction is
derived from each step's depth from the entry.

## [0.13.33] — 2026-05-29 — Fibre Flow v0.10.0

### Fibre Flow Phase E — dashboard counts + actionable tasks

- **Home shows live counts** — the My-tasks card shows your open-task count, the
  Contacts card shows how many people are in motion (active runs).
- **Tasks are now actionable** — tick a task done (or reopen) right from the
  list, and **quick-add** a personal task (type + Enter). Gate/flow tasks still
  link out to their run.

### Added — API
- `POST /flow/tasks` — create a manual personal task.

### Added — frontend
- `apps/flow/app/(app)/tasks/tasks-list.tsx` (inline complete + quick-add);
  dashboard task/motion counts; `createManualTask` + `setTaskStatus` actions.

## [0.13.32] — 2026-05-29 — Fibre Flow v0.9.0

### Fibre Flow — favourites + tab reorder

- **Flows tab first.** On a flow's detail page the tabs are now **Flows** (the
  contacts moving through, the default) then **Builder** — you build when you
  set up, but day-to-day you want the live view first.
- **Favourite flows.** Tap the ☆ on any flow in the library to favourite it
  (per-user). Favourites pin to the top of **Home**, so your go-to flows are
  one click away.

### Added
- `flow_favorite` table (per-user, RLS-scoped). Migration
  `20260529160000_flow_favorite.sql`.
- API: `PUT`/`DELETE /flow/flows/:id/favorite`; `GET /flow/flows` now returns
  `is_favorite` and accepts `?favorite=1`.
- `apps/flow/app/(app)/flows/favorite-star.tsx`; Home dashboard "Favourite
  flows" section; `toggleFavorite` action.

## [0.13.31] — 2026-05-29 — Fibre Flow v0.8.0

### Fibre Flow — revert / manual move (move a contact to any step)

The run popup now lets you move a contact **anywhere**, not just forward:

- **Forward** steps with a defined transition stay **amber** and run the gate check (complete tasks inline / override).
- **Any other step** (backward to revert, or sideways) lights up **grey** as a **manual move** — a no-gate confirm popup that re-creates the destination step's tasks and logs the move as "(manual)" on the activity timeline.
- Works from completed/withdrawn runs too, so a contact parked on Won/Lost can be reverted to an earlier step (which reopens the run).

### Added — API
- `POST /flow/runs/:id/move` `{ step_key, reason? }` — gate-free reposition to any step in the run's version.

### Added — frontend
- `repositionRun` action; unified the run popup's confirm flow into gated-transition vs. manual-move paths.

## [0.13.30] — 2026-05-29 — Fibre Flow v0.7.0

### Fibre Flow — Builder / Flows tabs on the flow detail page

Split the flow detail page into two tabs:
- **Builder** — the visual canvas + the Advanced JSON disclosure (designing the flow).
- **Flows** — the contacts moving through it (the runs panel; tab shows a count).

Both panes stay mounted (CSS-hidden) so switching tabs never loses unsaved
canvas edits.

- `apps/flow/app/(app)/flows/[id]/flow-tabs.tsx`.

## [0.13.29] — 2026-05-29 — Fibre Flow v0.6.2

### Fix: contact still wouldn't move (click handlers swallowed by React Flow nodes)

The click-to-move handlers were on elements *inside* the React Flow node, which
the node wrapper swallows — so neither the token click nor the target click
fired (confirmed in Chrome too). Switched to React Flow's `onNodeClick` (the
same reliable handler the builder canvas uses): click the **current step card**
to pick up / drop the person, then click a highlighted reachable step to open
the confirm-move popup. Removed `elementsSelectable={false}` (which could
suppress node clicks).

## [0.13.28] — 2026-05-29 — Fibre Flow v0.6.1

### Fix: moving a contact didn't work in Safari (HTML5 drag unreliable in React Flow)

The drag-the-token interaction relied on HTML5 drag-and-drop, which is flaky
inside React Flow's transformed viewport — especially in Safari. Added a
robust **click-to-move** path alongside drag: click the person token to "pick
them up" (it turns amber and pulses, reachable steps highlight), then click a
highlighted step to open the confirm-move popup. Drag still works where the
browser supports it; both routes share the same confirmation. Token also
`stopPropagation`s pointerdown so React Flow doesn't swallow the gesture.

## [0.13.27] — 2026-05-29 — Fibre Flow v0.6.0

### Fibre Flow — drag-a-contact-through-the-flow popup

Clicking a contact (on a flow's "Contacts in this flow" list, or on the
Contacts page) now opens a **popup that shows the whole flow** with the
person positioned on their current step:

- The person rides a **draggable token** on their current step card.
- Steps reachable from here **light up** as drop targets; the current step's
  outgoing edge animates.
- **Drag the token onto a reachable step** → a **confirmation popup** runs the
  gate check: if satisfied, confirm and move; if not, it lists the step's gate
  tasks with one-click complete (the gate re-evaluates live) or an override
  reason to move anyway.
- Moving fires the same activity events as before; the popup refreshes to show
  the person on their new step.

Intuitive runtime — no buttons, you literally drag the person forward. The
button-based `/runs/[id]` full view is still available via "Full view".

### Added
- `apps/flow/app/(app)/flows/[id]/run-modal.tsx` — React Flow read-only graph
  with a draggable person token + confirm-move sub-popup.
- `apps/flow/app/(app)/contacts/contacts-list.tsx` — opens the modal from the
  Contacts page.
- `getRunDetail` server action.

### Changed — API
- `GET /flow/runs/:id` now also returns the run's full version `graph`
  (steps + transitions) so the popup can lay the flow out.

## [0.13.26] — 2026-05-29 — Fibre Flow v0.5.0

### Fibre Flow — drag-and-drop visual builder (Phase G)

The flow detail page now has a real **interactive canvas** (React Flow /
xyflow). No JSON needed:

- **Drag step cards** around a dotted grid; positions **snap** to 24px
  columns/rows and persist (`flow_step.canvas_x/canvas_y`).
- **Inline-edit a card's name** right on the card.
- **Click a card** → side panel to set kind (entry / normal / end ✓ / end ✗),
  description, expected duration, and the tasks auto-created when a contact
  enters that step.
- **Drag from a card's right edge to another's left** to create a transition;
  **click an arrow** → side panel for its label, gate logic (all / any), and
  gate tasks (title, actor type, contact-action type, required).
- **Add step**, delete step/transition, **Save** / **Publish** from the toolbar.
- Cards colour-coded by kind. Loop-backs render as curved edges.

The JSON editor is preserved under a collapsed **"Advanced — edit graph as
JSON"** disclosure for power edits / bulk paste.

### Added
- `apps/flow/app/(app)/flows/[id]/flow-canvas.tsx` — React Flow editor with
  custom step-card nodes + step/transition side panels.
- `@xyflow/react` dependency on `apps/flow`.

### Changed — API
- `PUT /flow/flows/:id/graph` now accepts + persists `canvas_x` / `canvas_y`
  per step (optional — the JSON editor omits them and still validates).

### Removed
- The read-only `flow-diagram.tsx` (superseded by the interactive canvas).

## [0.13.25] — 2026-05-29 — Fibre Flow v0.4.0

### Fibre Flow — visual flow diagram (Phase G, slice 1)

The flow detail page now renders the graph **visually**: steps as colour-coded
cards (entry = blue, end_positive = green ✓, end_negative = red ✗, normal =
white), transitions as labelled curved arrows with their gate summary
(`all 2` / `any 1`). Auto-laid-out into columns by longest-path depth from the
entry step; back-edges (loops) route below. Read-only for now — drag-to-edit
and in-canvas gate editing are the next slice; the JSON editor remains below
as the authoring surface in the meantime.

- `apps/flow/app/(app)/flows/[id]/flow-diagram.tsx` — hand-rolled SVG
  (no graph-library dependency, full design control). `foreignObject` for
  on-brand node/label typography.

## [0.13.24] — 2026-05-29 — Fibre Flow v0.3.0

### Fibre Flow Phase D — the runtime

Flows now *do* something: contacts can be put into a flow, their gate and
step tasks auto-materialise, and they move through steps with gate
validation. Step transitions and task completions write platform activity
events (type + subject only — across the data wall).

### Added — API (`apps/api/src/routes/flow.ts`)
- `POST /flows/:id/runs` — start a run for a person at the published version's entry step; materialises the entry step's tasks. Fires `flow.run.started`.
- `GET /flows/:id/runs` — runs in a flow (person + current step).
- `GET /runs` — all visible runs (Contacts "in motion" + dashboard); `?status=`.
- `GET /runs/:id` — run detail: current step, tasks, and available transitions each annotated with `gate_satisfied`.
- `POST /runs/:id/transition` — move along a transition. Validates the gate (all/any of the required gate tasks); blocks with `409 gate_unsatisfied` unless an `override_reason` is given. Cancels the old step's open generated tasks, materialises the destination step's tasks, fires `flow.run.step_changed` (or `flow.run.completed` at an end step).
- `POST /runs/:id/withdraw` — pull a contact out; cancels open tasks; fires `flow.run.withdrawn`.
- `PATCH /tasks/:id` — update/complete a task; completing a contact-actor task fires `flow.task.completed`.
- `GET /tasks` — caller's open tasks across flows (`?scope=mine|all`, `?status=`).
- `GET /contacts/:personId/runs` — a person's runs (for the future contact tab).

### Added — Flow frontend (`apps/flow`)
- **Flow detail → "Contacts in this flow"** — run list + Add-contact dialog (person search against the platform, start a run).
- **Run detail** (`/runs/[id]`) — current step, tasks with one-click complete/reopen (actor-type icons, gate badges), and "Move to next step" buttons that enable only when the gate is satisfied — with an inline override-reason flow when it isn't. Withdraw action.
- **My tasks** (`/tasks`) and **Contacts in motion** (`/contacts`) now wired to live data.

### Known limitation
- `can_see_person` (v0.9.0) has no "shares a flow_run" clause, so non-admin
  users can't yet see contacts solely because they're in a shared flow. Fine
  for the current admin-only workspace; a future migration adds the clause.

### Task-materialisation model
- Entering a step creates: that step's default tasks + the gate tasks on every
  transition leaving it. Leaving a step cancels its open generated tasks
  (manual tasks are preserved). Assignee resolves by actor type:
  personal→run owner, team→flow team, contact→the person.

## [0.13.23] — 2026-05-29 — Fibre Flow v0.2.0

### Fibre Flow Phase C — the definition layer

Flows can now be created, defined, versioned, and published. The visual
canvas is still deferred (Phase G); definitions are edited as JSON for now,
against the same underlying graph the canvas will later render.

### Added — API (`apps/api/src/routes/flow.ts`)
- `GET /api/v1/flow/flows` — list visible flows (RLS-scoped) with active-run counts; `?lifecycle=` / `?scope=` filters.
- `POST /api/v1/flow/flows` — create a draft flow + its first version.
- `GET /api/v1/flow/flows/:id` — flow metadata + the editable (or current) version's full graph, round-tripped by step `key`.
- `PATCH /api/v1/flow/flows/:id` — metadata + lifecycle (draft/active/closed/archived) + visibility.
- `PUT /api/v1/flow/flows/:id/graph` — replace the draft version's graph from JSON. Validates: unique step keys, exactly one `entry` step, ≥1 end step, transitions reference real keys, contact gate tasks require `contact_action_type`. Wipes + re-inserts steps/transitions/gates/defaults atomically per draft.
- `POST /api/v1/flow/flows/:id/publish` — publish the draft (must be non-empty), set `current_version_id`, flip lifecycle to `active`. Published versions are immutable; editing a published flow clones a fresh draft (version N+1).
- `DELETE /api/v1/flow/flows/:id` — soft delete.

### Added — Flow frontend (`apps/flow`)
- **Flow Library** (`/flows`) — list with lifecycle chips, scope, active-run count; empty state; "New flow" dialog (Personal / Workspace; team scope deferred pending a team picker).
- **Flow detail + JSON editor** (`/flows/[id]`) — edit the graph as JSON with a starter template, inline schema crib, Save draft / Publish, and full API error surfacing in the banner (per the read-the-error rule).

### Notes
- All flow routes run through `userClient(jwt)`; RLS enforces workspace +
  `has_app_membership('fibre-flow')` + scope/visibility. No service-role.
- Flow's user-facing version → **v0.2.0**.

## [0.13.22] — 2026-05-29

### Fix: theme / sidebar preferences now persist across sessions (Safari)

Theme and sidebar-mode choices were written client-side via
`document.cookie`. Safari's ITP caps **all** JavaScript-set first-party
cookies to a 7-day lifetime regardless of the requested max-age, so the
preference silently reverted. The cookies were already host-only (no
`domain`), so per-app isolation was fine — it was persistence that broke.

### Changed
- New `lib/prefs-actions.ts` Server Action (`savePref`) in web, meet, and
  flow. Writes `thefibre.theme` / `thefibre.sidebar` from the server via
  `Set-Cookie` (1-year max-age, host-only, `sameSite=lax`, not httpOnly so
  the no-flash `ThemeScript` can still read it). Server-set cookies aren't
  subject to Safari's 7-day script-cookie cap.
- `user-menu.tsx` (all three apps) now calls `savePref` instead of writing
  `document.cookie`. Theme still applies instantly client-side via
  `applyTheme()`; sidebar awaits the save before `router.refresh()` so the
  server layout re-reads the new value.
- Each app keeps its own preference (host-only cookie, per subdomain) —
  Meet can be dark while Flow is light.

## [0.13.21] — 2026-05-29

### Fix: returning to `thefibre.app` while signed in looked like a logout

After signing in and visiting `meet`/`flow`, navigating back to
`thefibre.app` showed the marketing landing page with a sign-in link —
appearing as if the session had dropped. It hadn't: cross-subdomain SSO
was working (the `.thefibre.app` cookie is shared, which is why meet/flow
stayed logged in). The root page (`apps/web/app/page.tsx`) just rendered
the public landing page **unconditionally**, with no auth check — unlike
meet/flow, whose root pages redirect signed-in users to `/dashboard`.

### Changed
- `apps/web/app/page.tsx` is now an async server component that calls
  `getUser()` and `redirect('/dashboard')` for authenticated users,
  mirroring meet/flow. Signed-out visitors still get the marketing page.

### Also
- Bundle analysis confirmed `NEXT_PUBLIC_COOKIE_DOMAIN=.thefibre.app` is
  correctly baked into all three frontends — the cookie scope was never
  the issue.

## [0.13.20] — 2026-05-20 — Fibre Flow v0.1.0

### Fibre Flow lands as the fourth in-family app (Phase B)

The platform's fourth sibling app — alongside Meet, Thread, and the
gated Sales / Learn slots. Sales pipelines, project intakes, partnership
arcs, anywhere a contact moves through a sequence over time. Conceptual
spec: [`docs/fibreflow-brief-v0.3.md`](docs/fibreflow-brief-v0.3.md).
Build plan: [`docs/fibreflow-build-plan.md`](docs/fibreflow-build-plan.md).

Phase B closes Phase A (the `team` rename) and delivers the shell.

### Added

- **Schema** — nine new tables under `public.flow_*`:
  `flow_definition`, `flow_version`, `flow_step`, `flow_transition`,
  `flow_gate_task`, `flow_step_default_task`, `flow_run`,
  `flow_task`, `flow_document_link`. Workspace + has-app-membership
  RLS, mirroring the v0.9.0 Meet pattern. No platform schema changes —
  Flow consumes `person`, `organisation`, `team`, `workspace`,
  `activity`, `app_membership` natively. Migration
  `20260520120000_fibre_flow_schema.sql`.

- **`fibre-flow` app registered** in `public.app` (slug constraint
  widened to include it). Branded via
  `packages/shared/src/branding.ts`.

- **`apps/flow/` skeleton** at `flow.thefibre.app` (Vercel project
  + DNS land in Phase B3). Sidebar: Home / Flows / Tasks /
  Contacts / Settings. Empty-state placeholders for the four content
  pages — visible end-to-end so Sjoerd can see the shape before the
  engine fills in. Phase B's job is to be empty-on-purpose.

- **`fibre.app.json` manifest** declaring Flow's scopes
  (read persons/orgs/activities, write activities) and the five
  activity types it will emit: `flow.run.started`,
  `flow.run.step_changed`, `flow.run.completed`,
  `flow.run.withdrawn`, `flow.task.completed`.

### Decisions baked in (per `docs/fibreflow-review.md` §4, locked 2026-05-17)

- `gate_logic` is configurable per transition (`'all'` | `'any'`), default `'all'` (Q1)
- `flow_version` is snapshot-pinned per run; published versions are immutable (Q2)
- A contact re-entering a flow gets a new `flow_run` row (Q3)
- `flow_step_default_task` materialises into `flow_task` rows on step entry (Q4)
- `team_id` references `public.team` natively (Q5; Phase A enabled this)
- In-app notifications first; email digest later (Q6)
- Manual Google Drive URL paste in v1; OAuth picker later (Q7)

### Not yet shipped (intentional — comes in Phases C–J)

- The flow builder (Phase G), including a JSON-textarea fallback for
  Phase C.
- The runtime that moves contacts through flows (Phase D).
- The task system + dashboards (Phase E).
- Cross-app activity reading for contact-action gates (Phase F).
- Flow Board kanban view (Phase H).
- Lifecycle / hygiene / reports / docs (Phase I).
- Seed data + v1.0 cutover (Phase J).

## [0.13.19] — 2026-05-19

### Reserved-slug validation on host / team / meeting-type

Until now nothing stopped a host from claiming the slug `settings` —
the resulting URL `meet.thefibre.app/settings` would match Meet's
`(app)/settings` route group instead of `[hostSlug]`, and the host
would be silently unreachable. Same hazard for `meeting-types`,
`teams`, `dashboard`, `confirmed`, `auth`, etc.

Now denied at the API layer with a clean 400 + field error.

### Added
- **`apps/api/src/lib/reserved-slugs.ts`** — single source of truth:
  - `TOP_LEVEL_ROUTES` — `auth`, `invite`, `no-access`, `sign-in`,
    `signup`, `login`, `app`.
  - `APP_GROUP_ROUTES` — `bookings`, `contacts`, `dashboard`,
    `internal-team`, `meeting-types`, `organisations`, `persons`,
    `programmes`/`programs`, `settings`, `teams`.
  - `MT_SUBPATHS` — `confirmed`, `cancel`, `reschedule`.
  - `INFRA` — conventional SaaS reserves: `api`, `admin`, `about`,
    `brand`, `callback`, `docs`, `faq`, `health`, `help`, `legal`,
    `oauth`, `privacy`, `pricing`, `public`, `robots`, `status`,
    `support`, `terms`, `webhook`(s), `www`.
- **`SLUG_PATTERN`** regex — lowercase alnum + hyphens, no leading/
  trailing hyphen.

### Changed
- **`HostUpdate.slug`**, **`MeetingTypeUpsert.slug`**, **`TeamUpsert.slug`**
  in `apps/api/src/routes/meet.ts` now go through `SLUG_PATTERN` +
  `isReservedSlug` refinement. Error messages name the issue
  ("reserved word — would collide with a Meet route") and list a
  preview of reserved values.

### Notes
- The DB has no `CHECK` constraint mirroring the list — slugs are
  validated at the API boundary only. Adding a generated-column
  constraint would couple DB to UI route names; an API-layer check
  is the right scope.
- Web-side: the existing `name-slug.tsx` widget normalises input to
  lowercase + hyphen, so the regex piece is already enforced
  client-side; the reserved-word check is the only new server-only
  rule. Web caller still sees the clean field error in dialogs.

## [0.13.18] — 2026-05-19

### Platform Billing Phase 1 — plan-aware Meet skim

Schema + free-by-default + plan-aware Meet fee. The 2%/€2 cap on paid
Meet bookings is no longer hard-coded — it reads the workspace's plan.
Free pays the skim; Pro / Org pay 0%, as decided in
[`docs/platform-billing-roadmap.md`](docs/platform-billing-roadmap.md).
Phases 3 + 4 (upgrade UI, Stripe Checkout for subscriptions) are
deferred — they need Sjoerd to configure Products in Stripe first.

### Added (Phase 1)
- **Migration `20260519100000_platform_billing_phase1.sql`**:
  - `billing_plan` table seeded with the three tiers from the roadmap
    — Free (€0, 2%/€2 cap), Pro (€15/seat/mo, 0%), Org (€30/seat/mo, 0%).
    Features stored as JSONB (`first_party_apps`, `sso`, `audit_log`,
    `max_users`, `max_contacts`, etc.) so the UI can gate without code
    changes when we add a tier.
  - `workspace_subscription` table — FK to `workspace` and to
    `billing_plan`, status enum incl. `comped`, Stripe customer +
    subscription ids, billing interval, period boundaries, seat count.
    RLS: workspace members can read their own row; writes via
    service-role only (Stripe webhook handler in a later phase).
  - `workspace_meet_fee(ws_id)` SQL helper returning
    `(pct, cap_cents)` — the API reads this at Checkout time.

### Added (Phase 2)
- **Backfill** — every existing workspace gets a Free + `comped`
  row tagged `comped_reason = 'pre-billing default'`, so we never
  charge for legacy data.
- **Trigger `on_workspace_insert_create_subscription`** — every new
  workspace automatically gets a Free + comped row. UI never has to
  remember to create one.

### Changed (Phase 7)
- **`POST /api/v1/meet/public/bookings`** — the Connect Checkout
  Session's `application_fee_amount` now comes from
  `workspace_meet_fee` instead of the hard-coded `(2%, cap €2)`. Pro
  and Org workspaces send `application_fee_amount: 0` so the host
  keeps 100% of the booking revenue. Defensive default: if the
  lookup somehow fails, falls back to the Free rate (never under-
  skim).

### Added (UI hook)
- **`GET /api/v1/workspace-apps/billing`** — returns
  `{ plan, subscription }` for the current workspace. UI can use this
  to render a plan badge / upgrade prompt / gate Pro-only features.
  No UI consumer yet; landing it now keeps Phase 3 a 1-day build
  instead of 1.5.

### What's still out (Phases 3–8)
- Workspace billing page (`/settings/workspace/billing`)
- Stripe Checkout for upgrades + webhook lifecycle
- Feature gates calling `requirePlan(min)` from API endpoints
- Stripe Billing portal hand-off for invoice history / cancellation

These need a Stripe Products + Prices walkthrough in the dashboard
first — see [`docs/platform-billing-setup.md`](docs/platform-billing-setup.md).

## [0.13.17] — 2026-05-19

### API CORS goes from "any origin" to an allowlist

Until now the Hono CORS middleware reflected every Origin back ("any
origin is allowed"). With paid bookings, branded auth, and Stripe
webhooks all live in production, that was the last "we'll harden it
later" item on the post-deploy loop. Done.

### Changed
- **`apps/api/src/server.ts`** — CORS now allowlists:
  - The 5 prod subdomains: `thefibre.app`, `meet.thefibre.app`,
    `thread.thefibre.app`, `sales.thefibre.app`, `learn.thefibre.app`.
  - Local dev: `http://localhost:3000` / `:3001` / `:3002`.
  - Our own Vercel previews — regex match on
    `https://(thefibre-web|thefibre-meet|thefibre-thread)-<branch>.vercel.app`.
  - Anything in `CORS_ORIGINS` (comma-separated env override) for
    one-off staging hosts.
- Unknown origins receive **no `Access-Control-Allow-Origin` header**
  at all. The browser then blocks the cross-site request as the spec
  requires. We deliberately don't reflect-and-allow because
  `credentials: true` + `*` would have been rejected by browsers
  anyway, and we want a clean deny rather than a noisy half-allow.
- Server-to-server callers (Stripe webhook, Supabase Send Email Hook)
  are unaffected — no `Origin` header, no CORS handshake.

### Operations note
- For any extra preview / staging origin Sjoerd wants to whitelist
  without redeploying: `fly secrets set CORS_ORIGINS="https://extra.example.com" -a thefibre-api`.
  Restart picks it up.

## [0.13.16] — 2026-05-18

### The Fibre wordmark in the platform sidebar

Until now the handwritten "the fibre" wordmark lived only in the
auth emails (BRAND_ASSETS.logoUrl, v0.10.0). Inside the platform
the sidebar showed plain text "The Fibre". This brings the brand
into the app shell — same asset, same SPoT.

### Changed
- **`apps/web/components/shell/sidebar.tsx`** — when the sidebar is
  expanded, the brand label is now the wordmark image (`/brand/the-fibre.png`)
  instead of plain "The Fibre" text. The compact yellow "tf" tile stays
  exactly as it was — it's the anchor when the sidebar is collapsed and
  doesn't depend on image loading.
- Meet sidebar untouched. Meet shows "Fibre Meet" specifically — the
  Fibre wordmark belongs on the platform shell where it represents
  the umbrella brand.

### Also
- **Build-plan cleanup.** The "Group / One-off / Meeting poll event
  types" entry is marked done — Group shipped in v0.11.1, the other
  two in v0.12.0. The stale entry was misleading me earlier today.

## [0.13.15] — 2026-05-18

### Verified-domain auto-attribution

The promised follow-up to v0.13.14. When a new person is created with
an email whose domain matches a verified organisation in the workspace,
we now auto-link them via `org_membership` (as primary, since brand-new
persons have no existing primary). Plus a backfill endpoint to retro-
link existing contacts after an org's domain is verified.

### Added
- **`POST /api/v1/persons/` auto-link.** On person create, looks up
  `organisation` rows in the workspace where `domain` matches the
  email's domain (case-insensitive) and `domain_verified_at IS NOT
  NULL`. On a match: inserts an `org_membership` row with
  `is_primary: true` and stamps an audit activity row.
  - The response now includes `auto_linked_org_id` (nullable) so
    callers can react in the UI.
  - The activity row's subject reads
    `"Added <Name> to the workspace · auto-linked to <Org> (verified domain)"`.
- **`POST /api/v1/organisations/:id/domain-verification/backfill`**
  — re-scans all persons in the workspace whose email matches the
  org's verified domain, inserts an `org_membership` for each that
  isn't already linked. `is_primary` is set only when the person
  has no other active primary (doesn't fight existing curation).
  Returns `{ linked, skipped, total }`. Idempotent: re-running just
  reports 0 new links.
- **"Link existing contacts on this domain" button** on the org
  overview, shown once the domain is verified. Calls the backfill
  endpoint and renders the count inline.

### Safe by design
- **Verification is the gate.** Unverified domains are ignored, so
  a typoed/squatted org domain can't auto-attribute strangers.
- **Audit trail.** Every auto-link writes an activity row, so an
  admin can see exactly where a contact's org link came from and
  end the membership if it's wrong.
- **No PATCH-time auto-link.** Updating an existing person's email
  doesn't trigger auto-attribution — keeps behaviour predictable
  and avoids surprise re-links when emails change.

## [0.13.14] — 2026-05-18

### Org branding + DNS-based domain verification

Sjoerd: "branding is missing" and "setting for a DNS for an org with a
domain name is missing". Both addressed in one slice — org logo + a
TXT-challenge verification flow for the org's claimed domain.

### Added
- **Org logo on the profile header.** `logo_url` (already a column on
  `organisation`) is now editable from the org edit dialog and renders
  as a 48px avatar to the left of the org name on every org-detail
  surface (Overview / Profile / per-app tabs). Falls back to a letter
  tile when unset.
- **`PageHeader` now supports a `leading` slot** — the avatar/logo
  slot. Generic enough that contact profiles can use the same pattern
  later.
- **DNS verification panel** on the org overview (visible when a
  domain is set). Three states: no challenge issued, in-flight (shows
  the TXT name + value with copy icons + Check button), verified
  (green chip + "Re-verify" link).
- **Migration `20260517270000`** — adds `organisation.domain_verified_at`
  and a new `org_domain_verification` table holding the one-time TXT
  challenge per org. RLS scoped to workspace_member.
- **Three API endpoints**:
  - `GET    /api/v1/organisations/:id/domain-verification` — current
    state (domain, verified-at, in-flight challenge if any).
  - `POST   /api/v1/organisations/:id/domain-verification` — generate
    or rotate a challenge. Returns `record_name` + `record_value`.
  - `POST   /api/v1/organisations/:id/domain-verification/check` —
    `dns.resolveTxt(_fibre-verify.<domain>)` and compare. On match:
    stamps `domain_verified_at`.
- **OrgUpdate schema** now accepts `logo_url`.

### Honest gaps
- **Logo upload is URL-only.** No file upload to Supabase Storage yet —
  paste a public PNG/JPG/SVG URL. The "upload" UI is a follow-up
  (probably aligned with workspace branding when we get there).
- **No follow-on auto-attribution.** Verified domains don't yet auto-
  link new persons whose email matches `@<domain>` to the org. The
  trust signal is there; the wiring is the next slice.
- **Workspace-level branding** (the Fibre app shell wordmark in topbar
  / sidebar) is still untouched. The hand-written wordmark lives in
  emails only; the sidebar shows the 2-letter brand tile. Worth a
  separate decision before changing.

## [0.13.13] — 2026-05-18

### Platform prep: rename `meet_team` → `team` (Phase A of Fibre Flow build)

Teams are a Fibre primitive, not a Meet-private one. Sibling apps (Fibre
Flow next) consume teams natively, so the table moves out of Meet's
namespace. See [`docs/fibreflow-review.md` §2.2](docs/fibreflow-review.md)
and [`docs/fibreflow-build-plan.md` Phase A](docs/fibreflow-build-plan.md).

### Changed
- `public.meet_team` → `public.team`, `public.meet_team_member` →
  `public.team_member`. Indexes, triggers, and policies renamed in place
  (FK constraints follow by OID).
- `public.can_see_person` and `meet_booking_visibility` policy bodies
  refreshed so their canonical source text uses the new names.
- `public.meet_is_team_lead` body refreshed; function name kept for now
  (rename deferred — the `meet_` prefix is historical baggage we can
  drop in a later cleanup pass).
- `apps/api/src/routes/meet.ts` and `apps/meet/fibre.app.json` updated.

### Migration
- `20260517220000_rename_meet_team_to_team.sql`.

### Notes
- Four companion docs landed first: brief, review (with locked
  decisions), data model, full build plan. See
  [`docs/fibreflow-build-plan.md`](docs/fibreflow-build-plan.md).
- The `app_entity_mapping` seed row for `meet_team_member` is updated to
  `team_member`; the entry will likely be removed entirely in a later
  cleanup since team membership is now a platform concept and not a
  Meet app entity.

## [0.13.12] — 2026-05-17 — Meet 2.1.4

### Paid bookings now generate real VAT invoices

Sjoerd: "Is invoicing in?" Partly — billing fields (legal name, tax ID,
address) existed on persons + orgs, and Stripe Connect was wired for
paid bookings, but Stripe Checkout only emails its own receipt — that's
not a legal VAT invoice. EU customers need one. Now Stripe auto-generates
a finalised invoice for every paid booking, emails the hosted PDF link
to the invitee, and we surface it on the confirmation page.

### Added
- **`invoice_creation.enabled = true`** on the Connect Checkout Session
  in `POST /api/v1/meet/public/bookings`. Stripe creates a finalised
  Invoice (with the connected host's branding, tax ID, business address),
  emails a hosted PDF link to the invitee, and files it under the host's
  Invoices dashboard. No new tables, no new render code.
- **`billing_address_collection: 'required'`** — so the auto-generated
  invoice has a "Bill to" block, mandatory for EU reverse-charge VAT.
- **`invoice_data.description` + `metadata.booking_id`** stamped on the
  invoice so it traces back to the booking row.
- **Migration `20260517260000_meet_booking_invoice.sql`** — adds
  `stripe_invoice_id` and `stripe_invoice_url` (hosted PDF) to
  `meet_booking`. Both nullable; free bookings have neither.
- **Webhook capture** — `checkout.session.completed` now also
  `stripe.invoices.retrieve(session.invoice)` on the connected account
  and stashes `id` + `hosted_invoice_url` on the booking. Best-effort:
  a missing invoice doesn't block confirmation.
- **Confirmation page** (`/<host>/<mt>/confirmed/<id>`) — when
  `payment_status='paid'` and the invoice URL is present, shows a
  "View invoice (PDF) ↗" link beside the confirmation-email note.
  Graceful fallback copy when the host's connected account doesn't
  have automatic invoicing enabled yet.

### Also
- **User menu fix** (web + meet): the Profile and Settings entries
  were inert `<button>`s with no href/onClick. Both apps now route
  them to `/settings` (resp. `/settings/profile` on Meet) and close
  the menu on click. "Take a tour" stays as a muted placeholder.

### Honest gaps
- **No Stripe Tax.** Tax rates on the auto-invoice depend on the host
  enabling Stripe Tax inside their connected account. We don't force
  `automatic_tax: true` because the Session call would fail for hosts
  who haven't onboarded it — a regression risk for existing paid
  flows. Per-workspace opt-in once Platform Billing Phase 1 lands.
- **No Fibre Sales surface** — there's still no in-product way to
  issue arbitrary invoices (outside the Meet paid-booking flow). The
  `fibre-sales` app slug exists; the app doesn't.
- **Historical paid bookings** (pre-migration) won't have an invoice
  URL stamped. Stripe still has the invoice on the host's account —
  we just don't backfill the link.
## [0.13.11] — 2026-05-17

### Same dormant-membership fix on /settings (App access list)

v0.13.10 fixed the contact-profile surface. The `/settings` page
read from a separate endpoint (`/api/v1/auth/me`) and was still
listing all 5 apps as ADMIN while `/settings/apps` showed only Fibre
Meet activated.

### Changed
- **`GET /api/v1/auth/me`** now filters `memberships` to apps the
  workspace has activated in `workspace_app` (deactivated_at IS NULL).
  Sidebar app list, /settings App access section, and any other
  consumer of `me.memberships` now matches the workspace's active
  apps.
- **`fibre-platform` always included** in both endpoints
  (auth/me + persons/:id/memberships) — it's The Fibre itself,
  no workspace_app row exists for it, but the workspace-admin gate
  on /settings/apps reads `m.app.slug === 'fibre-platform' && m.role === 'admin'`,
  so dropping it would lock admins out of managing apps. Special-cased
  in code with a comment.

## [0.13.10] — 2026-05-17

### Fix: contact's "Apps they have access to" listed dormant memberships

Sjoerd: profile showed Fibre Meet + The Thread + Fibre Sales + Fibre
Learn + The Fibre — but the workspace's Settings → Apps page had
only Fibre Meet activated. The two pages contradicted each other.

### Changed
- **`GET /api/v1/persons/:id/memberships`** now joins `app_membership`
  with `workspace_app` (where `deactivated_at IS NULL`) and drops
  any app memberships for apps the workspace hasn't activated. So
  the profile's app-access chips match Settings → Apps.

### Note on the still-empty Organisations section
"No organisations linked yet" on Sjoerd's own profile is accurate —
there's no `org_membership` row connecting him to Solidarity Lab B.V.
The relationship exists conceptually (the workspace belongs to the
company) but the platform's contact-graph edge wasn't created. Fix
by opening the org page (e.g. /organisations/<solidarity-lab-id>) →
**Add member** → Sjoerd, with the appropriate title/role/dates.

## [0.13.9] — 2026-05-17

### Contact profile now shows org + workspace + app memberships

Sjoerd: "Sjoerd@soul.com is an org owner ... in Fibre I don't see
that in his profile (not the connection to the company, not his role
in the workspace, not the workspaces he is part of...). This should
be there no?" Yes — these are platform-owned facts (brief §2,
"platform owns identity + contact graph edges"). Now surfaced.

### Added
- **`GET /api/v1/persons/:id/memberships`** — returns
  `{ org_memberships, workspace_member, app_memberships, has_account }`.
  Org memberships include title, department, seniority, decision-
  maker / budget-holder / champion flags, primary org, and start/end
  dates. Workspace member shows role + relationship_type (internal /
  external). App memberships list which apps the person has a seat
  for (only if they hold a Fibre user account).
- **Contact overview page** gains two new sections between the
  identity fields and the timeline:
  - **Organisations**: cards per org membership with a "Primary"
    chip on the main one, "Ended" chip on historical roles, plus
    decision-maker / budget-holder / champion badges where set.
    Clicks into `/organisations/<id>`.
  - **Workspace access** (only when the person has a Fibre account):
    workspace name, role (admin/member), relationship_type (internal
    /external), and a row of app-name chips for the apps they hold.

### On Sjoerd's other question

**"Are contacts of an organisation shared between apps? That would
be meaningful."** Yes, already. The `person` and `organisation`
tables are platform-owned and workspace-scoped — every app with
`app_membership` in the workspace sees the same identity rows (RLS
on `person.workspace_id`). Apps own per-app *curator data* on top
(host notes in Meet, lead score in HubSpot) — those don't cross
the wall. So:

- Identity, contact details, **org memberships**, contact-graph
  relationships → all shared across apps in the workspace.
- Curator data → per-app, gated by that app's membership.

That's the brief §2 / §5 contract working as designed.

## [0.13.8] — 2026-05-17 — Meet 2.1.3

### Meet's contact tab finally shows what Meet actually justifies

Until now, the Fibre Meet tab on a contact profile rendered
change-facilitation fields (Role in change, Stance, Readiness,
Leadership style, Themes, Blockers, Motivators, Current challenge,
Facilitator notes). Those fields belong to a future Fibre Change
app, not to Meet. Per brief §5 ("the app justifies the field"),
Meet should only persist what it has a reason to.

### Changed
- **Migration `20260517250000_meet_person_profile.sql`** — new
  `person_meet_profile` table: workspace_id+person_id PK, host_notes
  (private text), vip + blocked flags, invitee_timezone. RLS scoped
  to fibre-meet membership.
- **New `GET /api/v1/persons/:id/meet`** returns
  `{ profile, upcoming_bookings, past_bookings }`. Bookings are live
  from `meet_booking`, matched by `invitee_email`.
- **New `PATCH /api/v1/persons/:id/meet`** upserts the profile.
- **GET `/api/v1/persons/:id/apps`** now also lists `fibre-meet`
  when a person has any `meet_booking` against their email — so the
  tab appears even before any curator data exists.
- **Web `apps/web/app/(app)/contacts/[id]/app/[appSlug]`** branches
  for `appSlug === 'fibre-meet'` and renders `<MeetTab>` instead of
  the generic curator layout.
- **New `MeetTab`** (`contacts/[id]/meet/tab.tsx`) renders:
  - Meet profile card with status chips (VIP / Blocked), preferred
    timezone, host notes, total-meeting count
  - Upcoming meetings list (live)
  - Past meetings list (live)
- **New `MeetProfileEdit`** dialog — clean, Meet-only fields. Title
  reads "Edit Meet profile — Fibre Meet" matching the app-chip
  convention from v0.10.1.

### Honest gaps
- The old `person_change_context` table is left in place. No data
  loss; just no longer surfaced on the Meet tab. Drop is a separate
  migration once you confirm no workspace relies on it.
- The Meet manifest still references `person_change_context` as a
  curator field for backward compat. Updating that is part of the
  table-drop follow-up.
- Booking rows on the contact page aren't clickable into a dialog
  here (that lives in Meet). For deeper inspection users click
  through to the meeting in Meet.

## [0.13.7] — 2026-05-17 — Meet 2.1.2

### Fix: paid MT silently reverted to Free on save

Native `<input type="radio">` with no `value` attribute posts the
literal string `"on"` for whichever radio is checked. The Pricing
free/paid radios were unattributed — so both posted
`pricing_visible: 'on'`, the action's `!== 'paid'` branch always
fired, and `price_cents` was nulled out on every save. Then the
form re-rendered with no price and the chooser jumped back to
"Free".

### Changed
- **`apps/meet/app/(app)/meeting-types/form.tsx`** — Pricing radios
  gain `value="free"` / `value="paid"`.
- **`apps/meet/app/(app)/meeting-types/actions.ts` `bodyFromForm`**
  now reads the existing hidden `pricing_mode` input (mirrors React
  state directly) as the authoritative source, falling back to
  `pricing_visible`. Belt-and-braces so a future radio regression
  can't wipe prices again.

## [0.13.6] — 2026-05-17 — Meet 2.1.1

### Fix: Payments page saved silently but UI showed old value; settings cards spaced

### Changed
- **`apps/meet/app/(app)/settings/actions.ts`** — `updateHost`
  revalidatePath list now includes `/settings/payments`. Previously
  pasting `acct_…` and clicking Save flipped the row in DB but the
  page re-rendered from cache, showing the field still empty.
- Same action now uses `formatApiError()` (matches the v0.12.3
  pattern) so any future zod/RLS error appears inline instead of
  the bare "API 500".
- **API `PATCH /api/v1/meet/me`** logs full Postgres error + zod
  details + body keys on failure. Same diagnostic pattern as
  v0.12.2 for MT save.

### Settings cards — actual breathing room
- Settings page now renders cards in a **2-column grid with `gap-3`**
  instead of a single divided list. Each card is its own bordered
  surface with `p-5` and a slightly larger icon tile (`h-10 w-10`).
  The two sections (Personal / Workspace) separated by `mt-14`.

## [0.13.5] — 2026-05-17 — Meet 2.1.0

### Meet Phase 3: Stripe Checkout for paid bookings

A paid meeting type now redirects the invitee to Stripe Checkout
after they pick a slot. The booking sits as `payment_status='pending'`
until Stripe's webhook fires `checkout.session.completed`; then the
deferred side-effects (Google Calendar event, branded confirmation
email, activity row) run automatically.

### Added
- **`apps/api/src/lib/stripe/client.ts`** — lazy-loaded Stripe SDK.
  `stripeOrNull()` returns `null` when `STRIPE_SECRET_KEY` is unset
  so the API still boots in environments without Stripe configured.
- **Booking POST** detects paid MTs (`price_cents > 0`), creates a
  **Stripe Connect Checkout Session** against the host's connected
  account, and returns `{ booking, payment_required: true, checkout_url }`.
- **`payment_intent_data.application_fee_amount`** set to 2% capped
  at €2 per booking — the Free-workspace skim. Phase 7 will read the
  workspace's plan and waive this for Pro/Org once Platform Billing
  Phase 1 lands.
- **New `POST /api/v1/meet/stripe-webhook`** (public, HMAC-verified).
  Handles three events: `checkout.session.completed` (flip
  payment_status to 'paid', run side-effects), `checkout.session.expired`
  and `payment_intent.payment_failed` (cancel the booking).
  Idempotent — same session id is safe to receive twice.
- **`runConfirmationSideEffects(bookingId)`** helper centralises
  Calendar + email + activity logic. The approve endpoint refactored
  to call it; the webhook calls the same code so both paths produce
  identical state.

### Changed
- **Public booking page** (`/[host]/[mt]`) now shows the price in
  the sidebar (currency-localised) with "— paid at checkout".
- **Public booking flow** (`flow.tsx`) detects `payment_required`
  in the create-booking response and redirects to `checkout_url`
  via `window.location.href`.
- **Stripe webhook URL** registered in `apps/api/src/middleware/app-context.ts`
  PUBLIC_PREFIXES so the route bypasses JWT auth — signature is the
  trust mechanism.

### Honest gaps
- **Approval + payment combined**: a MT with both required is
  treated as paid-only (payment is the hard gate; approval is
  auto). If you want host-approval-then-pay, the combined flow is
  a Phase 3b follow-up.
- **No refund UI** yet — that's roadmap Phase 6.
- **Application fee is hardcoded at 2%/€2** (Free-workspace rate)
  for every booking because Platform Billing hasn't shipped. Once
  Platform Billing Phase 1 seeds `workspace_subscription`, the
  Meet POST reads the plan and applies 0% for Pro/Org.
- **Untested in prod** until `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
  are set on Fly per `docs/platform-billing-setup.md`. The code
  ships dormant; the API returns 503 with `code: 'stripe_not_configured'`
  on the create-booking path until then.

## [0.13.4] — 2026-05-17

### Booking email matches the auth-email visual; Google stops emailing invitees

### Changed
- **`apps/api/src/lib/email/templates.ts` shell rewritten** to use the
  same wordmark + footer pattern as the v0.10.0 auth emails. Centred
  Fibre logo at the top, white canvas (no bordered card), Help /
  About / Legal footer, whitelist-our-address hint, legal address
  line. Booking + cancellation emails now read as one family with
  sign-in / magic-link / etc.
- **Google Calendar event creation** now passes `sendUpdates: 'none'`
  so Google no longer emails the invitee a separate calendar invite.
  Fibre Meet's branded confirmation email is the sole notification.
  Same change applied to event deletion (cancel path) so Google
  doesn't double up on cancellation either.
- The invitee is still listed as an attendee on the host's Google
  Calendar event, so the host's calendar shows who's coming. Just no
  Google-sent email.

### Honest gap
- The Fibre confirmation email doesn't yet include an `.ics`
  attachment. Invitees who relied on Google's invite to auto-populate
  their calendar will need to add the meeting manually. Adding an
  attached `.ics` is a clean follow-up — small.

## [0.13.3] — 2026-05-17

### Meet's display version decoupled — sidebar now shows v2.0.0

Meet is the rebuild of Suite v1, so calling it `0.13.x` in the
sidebar didn't reflect its lineage. Meet now has its own
user-facing version, starting at **v2.0.0**, independent of the
monorepo release cadence in `package.json` (which keeps tracking
cross-package work).

### Changed
- `apps/meet/app/(app)/layout.tsx` `VERSION` constant → `'2.0.0'`.
- `CLAUDE.md` "Version bumps" section updated: from now on, bump
  Meet's VERSION independently when Meet-specific surfaces ship;
  don't mass-bump in lockstep with platform-wide releases.

## [0.13.2] — 2026-05-17

### Booking approval — host default + per-MT override

A meeting type can now require host approval before a booking
auto-confirms. Default is set on the host profile and individual
MTs can override it.

### Added
- Migration `20260517240000_meet_booking_approval.sql`:
  `meet_host.requires_approval` (bool default false) and
  `meet_meeting_type.requires_approval` (nullable bool — null = inherit).
  Booking status enum gains `pending_approval`.
- **Booking POST** computes effective approval (MT-level wins; null
  falls back to host default). When true:
  - Booking inserted with `status='pending_approval'`
  - Google Calendar event + confirmation emails are skipped
  - Invitee gets "request received"; host gets "approval needed"
  - Activity event is `meeting_requested` instead of `meeting_booked`
- **`POST /api/v1/meet/bookings/:id/approve`** — host-only; creates the
  Google Calendar event + sends the normal confirmation email + flips
  status to `confirmed`. Mirrors the auto-confirm path exactly.
- **`POST /api/v1/meet/bookings/:id/reject`** — host-only; flips to
  `cancelled`, sends a "declined" email (optional reason).
- **Settings → Profile** gains "Require my approval before a booking
  is confirmed" checkbox (host-level default). Presence sentinel
  hidden input so unchecking actually persists.
- **MT editor → Availability tab** gains "Approval" section with
  three radios: Use my default / Always require / Never require.
- **Booking dialog** shows amber "Pending" status; when pending,
  Approve and Reject buttons appear in the footer.
- **Bookings list rows** show amber "Pending" pill alongside the
  existing Confirmed/Cancelled.
- **Public confirmation page** branches copy when status is
  `pending_approval` — "Your request is in" instead of "You're booked",
  with a line explaining the host will review.
- **Bookings list query** keeps `pending_approval` rows visible even
  when "Include cancelled" is off — hosts shouldn't have to opt in to
  see bookings they need to act on.

### Honest gap
- Reject email is plain text; no "request a different time" loop yet.
- No reminder if a pending request sits >24h. Easy follow-up.
- Approval state is per-host (the MT owner), not per-team-lead — if
  the MT is a team type, the owner-host's policy still governs.

## [0.13.1] — 2026-05-17

### Phase 2: Stripe Connect (paste flow) + price on MT

Hosts can now connect Stripe and assign a price to a meeting type.
The actual Stripe Checkout redirect on booking is Phase 3 — saving a
price today reserves the field but doesn't yet trigger payment.

### Added
- **Settings → Payments page** (`/settings/payments`) — paste-style
  Stripe Connect onboarding mirroring Suite. Pastes `acct_…`,
  validates format, shows Connected/Not connected pill.
- **MT editor → Pricing tab** is no longer the stub. Paid radio is
  live; price input (decimal) + currency dropdown (EUR/USD/GBP)
  appear when Paid is selected.
- **API: `HostUpdate` zod** accepts `stripe_account_id` with regex
  guard (`^acct_…`).
- **API: `MeetingTypeUpsert` zod** accepts `price_cents`
  (int 0–10,000,00) + `price_currency` (3-letter ISO).
- **API: POST/PATCH `/meeting-types` guard** — if `price_cents > 0`
  and the host has no `stripe_account_id`, returns a 400 with
  "connect Stripe in Settings → Payments before setting a price"
  (visible inline in the form thanks to v0.12.3's error pipeline).
- **Action: `bodyFromForm`** converts `price_major` (decimal string
  like "49.00") to cents, nulls out price columns on paid→free flip
  so stale prices don't linger.

### Honest gap
This commit ships the *plumbing* for paid MTs — connection +
price storage + guard. Phase 3 (Stripe Checkout redirect, webhook,
payment_status updates) is next. A paid MT today still completes
booking as if free; that changes in Phase 3.

## [0.13.0] — 2026-05-17

### Intake forms ship; pricing/payments roadmap published

Sjoerd asked for the full Suite-equivalent Pricing + Payments surface
(intake, price, Stripe + PayPal + Invoice, refunds, invoice emails,
tax). That's ~5-6 days of focused work — see
[`docs/meet-pricing-roadmap.md`](docs/meet-pricing-roadmap.md) for the
phased plan. This release ships Phase 1 only.

### Added (Phase 1 — Intake forms, end-to-end)
- **API: `PUT /api/v1/meet/meeting-types/:id/intake`** — upserts
  the `meet_intake_form` row and links it via `intake_form_id`.
  Empty fields detaches and cleans up. Zod-validated.
- **API: MT list endpoint** now also pulls
  `intake_form:intake_form_id (id, name, fields)` so the editor can
  preload.
- **Editor: Intake tab** is wired up. The pre-existing
  `IntakeFieldsEditor` component (5 field types, drag-reorder,
  cascade-delete, conditional logic) is now mounted. Saves
  out-of-band from the main MT PATCH via the new `saveIntakeFields`
  server action.
- **Public booking page** already rendered intake answers and
  stored them on `meet_booking.invitee_answers` — confirmed working
  end-to-end now that the editor exists.

### Roadmap published
- [`docs/meet-pricing-roadmap.md`](docs/meet-pricing-roadmap.md)
  documents how Suite implements each piece (read fresh today), what
  our schema already supports (it's already there from v0.10.x), and
  the 8-phase implementation order. Two decision points flagged for
  Sjoerd: Stripe Connect onboarding style (paste vs OAuth) and
  whether PayPal ships at all (recommend skip).

### Honest scope
This commit ships Phase 1 only (intake). Phases 2-6 (Stripe Connect,
Checkout, invoice mode, refunds, invoice numbering+email) are queued
in priority order. PayPal (Phase 7) and Tax (Phase 8) are recommended
as defer-unless-asked.

## [0.12.8] — 2026-05-17

### Click-to-open booking popup everywhere; Month calendar grid; per-contact appointment list

### Added
- **Shared `BookingDetailsDialog`** (`components/booking-details-dialog.tsx`)
  — one modal renders booking info from any surface. Used by Dashboard
  "Next up", Bookings list, and the Contact popup. Has Join, Cancel,
  and Close buttons.
- **`ClickableBookingRow`** wrapper — turns any server-rendered row
  into a click target that opens the dialog. Reused across surfaces.
- **Bookings → Month view** is now a real 6×7 calendar grid (Mon-first
  weeks, days outside the month dimmed, today's number in a filled
  pill). Each day cell shows up to 3 booking chips ("HH:MM Name")
  plus "+N more" overflow. Chips click straight to the dialog.
- **Contact popup → Appointments list.** Lazy-loaded via a new server
  action `listContactBookings(email)` calling
  `GET /api/v1/meet/bookings?invitee_email=…`. Each row clicks to
  the same `BookingDetailsDialog`.
- **API**: `GET /api/v1/meet/bookings` accepts `?invitee_email=` to
  scope a result list to a single person.

### Changed
- **Bookings view toggle** (`List / Week / Month`) is now icon-only —
  the labels are in `title` + `aria-label` for screen readers.
- **Bookings list rows** lost the inline "Join" link (it's in the
  popup now) and gained a `cursor-pointer` row hover.

### Honest gap
- **Week view** is still the previous day-grouped list, not a
  Google-Calendar-style 7-column hour grid. The Month grid lands
  first because it's the higher-leverage view; Week-as-hour-grid is
  queued as a separate change (~half-day's work).
- **Reschedule** still doesn't atomically cancel+rebook — same v0.12.7
  caveat applies; the popup's cancel link routes to the existing
  cancel page.

## [0.12.7] — 2026-05-17

### Booking confirmation gets a card + real buttons; per-MT "show on overview" toggle

### Added
- **`is_public_listed` on `meet_meeting_type`** (migration
  `20260517230000_meet_mt_public_listed.sql`). Default `true`.
  When `false`, the MT is bookable via its direct link but omitted
  from `/api/v1/meet/public/host/:slug` and `/api/v1/meet/public/team/:slug`.
- **Visibility section on the Availability tab** with a checkbox:
  "Available on personal overview page". Wires to the new column.
- **`MeetingTypeUpsert` zod schema** accepts `is_public_listed`.

### Changed
- **Booking confirmation page** (`/[hostSlug]/[mtSlug]/confirmed/[bookingId]`)
  redesigned as a floating card on `bg-neutral-50` to match the
  booking-page card style. Two real buttons replace the plain link:
  **Reschedule** (goes to the booking page so the invitee can pick a
  new time — the old booking persists, cancel separately) and
  **Cancel** (goes to the existing cancel flow). "← Back to host" lives
  in a subtle footer band.

### Honest gap
"Reschedule" currently just re-opens the booking flow; the old slot is
not auto-cancelled. A proper reschedule (atomic cancel+rebook with a
single email) is a follow-up.

## [0.12.6] — 2026-05-17

### Fix: saving from any non-Basics tab returned 400 (slug/name missing)

Each tab in the meeting-type editor was conditionally mounted, so
switching to Conferencing/Availability/Pricing/Intake unmounted the
Basics tab and dropped `name` + `slug` from FormData on submit. The
API rejected with 400 (slug too short, name required) — exactly what
the user saw clicking Save from the Conferencing or Availability
tab.

### Changed
- **`apps/meet/app/(app)/meeting-types/form.tsx`** — every tab is now
  rendered in the DOM at all times and just hidden via the `hidden`
  Tailwind class when inactive. All form inputs are present in
  FormData regardless of which tab the user is on.
- **Zoom + Microsoft Teams** in the Conferencing provider dropdown
  now show "— coming soon" and are unselectable (`<option disabled>`).
  They had been pickable but generated no meeting URL on booking.
- **`apps/meet/components/ui/field.tsx` `SelectField`** option shape
  gains `disabled?: boolean` (and appends "— coming soon" automatically).
  General-purpose so other forms can mark not-yet-built options too.

## [0.12.5] — 2026-05-17

### Editor Event-type dropdown now mirrors the "+ New" menu

The in-editor Event-type select used to be a plain native dropdown
showing only the label. Now it's a rich popover with the same icon,
"1 host → N invitees" sub-line, and one-line description the user
saw when creating the MT — so they can always tell what the meeting
type actually does.

### Changed
- **New shared component** `apps/meet/components/event-type-picker.tsx`
  — single source of truth for `EVENT_TYPES` metadata, the menu-row
  presentation (`EventTypeMenuList`), and a controlled
  `EventTypePicker` for the editor.
- **`apps/meet/app/(app)/meeting-types/new-menu.tsx`** now imports
  `EventTypeMenuList` instead of duplicating the rows. The "+ New"
  menu UX is byte-identical; just deduplicated.
- **`apps/meet/app/(app)/meeting-types/form.tsx`** — Event-type
  `SelectField` replaced with `<EventTypePicker>`. The trigger button
  shows the current event type's icon, label, and "1 host → 1 invitee"
  sub; clicking opens the same six-row popover the New menu uses,
  with team-only types disabled and labelled "Switch to Team scope to
  use this." Hint text under the picker is the option's description
  (e.g. "Coffee chats, intro calls, 1:1 reviews.").
- Local duplicate `EVENT_TYPES` array in form.tsx deleted.

## [0.12.4] — 2026-05-17

### Fix: MT save 500 — `conflict_calendar_ids` NOT NULL violation

Save failed on team-flip with "null value in column
conflict_calendar_ids violates not-null constraint". The column is
`uuid[] not null default '{}'` but the UI sends `null` to mean "use
host default."

### Changed
- **API: POST and PATCH `/meeting-types`** coerce
  `conflict_calendar_ids: null` → `[]` server-side so third-party
  callers don't have to know which columns are nullable. v0.12.3's
  improved error surfacing made this diagnosable in one save attempt.
- **Meet's sidebar VERSION constant** had been stuck at `0.9.0` while
  package.json marched up. Both web and meet now bump in lockstep
  (apps/meet/app/(app)/layout.tsx).

## [0.12.3] — 2026-05-17

### Surface API error detail on MT save instead of bare "API 500"

Sjoerd reported a 500 on flipping a personal one_on_one MT to team
collective. The form just said "API 500" — no actionable detail.

### Changed
- `apps/meet/app/(app)/meeting-types/actions.ts` — both
  `createMeetingType` and `updateMeetingType` now pull
  `error`/`details`/`code` out of the response body via a shared
  `formatApiError()` and render that string in the form's red banner.
- Paired with the structured stderr logging from v0.12.2, the next
  500 is fully diagnosable: the Postgres message (e.g. unique
  index name, RLS hint, CHECK constraint name) shows up inline in
  the UI **and** in `fly logs -a thefibre-api`.

## [0.12.2] — 2026-05-17

### Harden PATCH /meeting-types/:id; trace what gets persisted

User reports team scope flips back to personal after save+reload on
prod. Couldn't reproduce from a code read — every path traces to "this
should work." Two changes ship together:

### Changed
- **Mirror the POST guard on PATCH.** Previously only the create path
  verified the caller is a lead of the destination team; the update
  path accepted any team_id. Now PATCH 403s if the caller isn't a
  lead. Defence-in-depth and removes one class of "silent succeed,
  row not visible" scenarios.
- **Structured logging on every PATCH outcome.** Logs the requested
  team_id/event_type vs what came back from the DB. RLS failures get
  full code/details/hint logged. Next time someone reports this, the
  Fly log (`fly logs -a thefibre-api`) tells us in one line whether
  the API even got the team_id, whether the DB accepted it, and what
  came back.

### Why this matters
Brief reviewer note (v0.3 retro): "open the API log first, hypothesise
second." This commit makes that possible for the MT save path.

## [0.12.1] — 2026-05-17

### Fix: `/settings/availability` crashed in prod

`WorkingHoursEditor` reads `value[day].length` for each of the seven
days, but the three callers passed `working_hours` straight from the
API with a `as Schedule` cast. Any saved row missing a day key
(common — Saturday/Sunday often absent) crashed React on mount with
"client-side exception."

### Changed
- All three callers (settings page, settings/availability, meeting-type
  editor) now use the existing `coerceSchedule()` helper from
  `components/working-hours-editor.tsx`, which guarantees all 7 day
  keys are present (empty array per missing day) before the editor
  ever reads them.

## [0.12.0] — 2026-05-17

### Added: One-off and Meeting-poll event types

The last two stubs in the New-Meeting-Type chooser ship for real. Fibre Meet
now supports every event type drawn on the original wall: One-on-one, Group,
Round-robin, Collective, **One-off**, and **Meeting poll**.

### Changed
- **New migration `supabase/migrations/20260517210000_meet_one_off_and_poll.sql`**
  adds `fixed_starts_at`/`fixed_ends_at` (nullable timestamptz with paired
  CHECK + window CHECK) to `meet_meeting_type`, and creates two tables for
  polls: `meet_poll_slot` (composite PK `(meeting_type_id, starts_at)`) and
  `meet_poll_vote` (one row per `(voter, slot)`, deduped via UNIQUE). RLS on
  both poll tables defers to the parent meeting type — if you can see the
  MT, you can see its slots and votes.

- **API: `MeetingTypeUpsert` zod schema** accepts `one_off` and `poll` as
  `event_type` values, plus optional `fixed_starts_at` / `fixed_ends_at`
  datetimes.

- **API: `POST /api/v1/meet/public/bookings`** validates `starts_at` against
  the MT's `fixed_starts_at` for one-off bookings, rejects with
  `409 wrong_fixed_time` on mismatch. Capacity from v0.11.1 is reused —
  default 1 (single-attendee interview), but the editor offers the same
  CAPACITY_OPTIONS dropdown so a one-off can also be a small group event.
  Poll MTs are not bookable directly (`400 poll_not_bookable`).

- **API: slots endpoints** (`/public/host/.../slots` and team variant)
  short-circuit for `one_off` (return just the fixed slot with `slots_meta`)
  and `poll` (return `{ slots: [] }`). Public MT GET endpoints attach
  `poll_slots: [{starts_at, ends_at}]` when the MT is a poll.

- **New auth'd endpoints** on `apps/api/src/routes/meet.ts`:
  `GET /meeting-types/:id/poll` (slots + votes for the host),
  `PUT /meeting-types/:id/poll-slots` (replace candidate slots, 2–5),
  `POST /meeting-types/:id/confirm-poll-slot` (flip a poll into a one-off
  with `fixed_starts_at` = winning slot — see "trimmed scope" below).

- **New public endpoint** `POST /api/v1/meet/public/poll-votes` lets an
  invitee submit `{ meeting_type_id, voter_email, voter_name,
  slot_starts_ats[] }`. Re-submission from the same email replaces that
  voter's existing rows (so changing your mind just works). Bypasses RLS
  via `adminClient` like the rest of `/meet/public/*`.

- **UI: Meeting-type editor** (`apps/meet/app/(app)/meeting-types/form.tsx`):
  the event-type dropdown adds One-off and Meeting poll for personal scope
  too. When One-off is selected, the Availability tab disappears and a
  "Date & time" `<input type="datetime-local">` + Capacity dropdown appear
  on Basics. When Meeting poll is selected, the Availability tab is
  relabelled **Candidate slots** and renders a dedicated editor with 2–5
  datetime rows + Add/Remove buttons. Slots save out-of-band via the new
  `savePollSlots` server action.

- **UI: MT detail page** (`apps/meet/app/(app)/meeting-types/[id]/page.tsx`)
  loads `/meeting-types/:id/poll` for poll MTs and renders a new
  **`PollVotesMatrix`** (`votes.tsx`) — voters down rows, candidate slots
  across columns, ✓ in each cell where the voter ticked. Each column header
  shows vote count + a "Confirm" button that calls the confirm-poll-slot
  endpoint.

- **UI: New-MT chooser** (`new-menu.tsx`): both `disabled: true` flags
  removed; One-off + Meeting poll are now bookable from the menu.

- **UI: Public booking page** (`apps/meet/app/[hostSlug]/[mtSlug]/`):
  `BookingFlow` branches on `event_type`. One-off renders a single
  "Scheduled for {datetime}" block + name/email + "Confirm attendance".
  Poll renders a checkbox list of the candidate slots + name/email +
  "Submit votes", with a thank-you state on success.

### Trimmed scope (documented gap)
"Confirm this slot" on a poll currently just flips the MT into `one_off`
with the winning slot set as `fixed_starts_at`. **It does not auto-create
bookings for every voter who ticked that slot, and it does not email the
losing voters that the poll closed.** The host gets a stable one-off MT
URL they can share again to collect attendance confirmations. Auto-booking
+ poll-close email notifications are the obvious next pass; they were
trimmed because they triple the surface area (template wiring + Resend
batch send + idempotency) without adding much for v1 use.

### Gotchas
- `<input type="datetime-local">` reads as local time. The form converts
  to UTC ISO before sending so the API stores in UTC. Read-back goes
  through `toLocalDatetimeInput()` which formats in the host's local tz.
- Poll slot rows persist after a poll is "confirmed". They aren't read
  by any active code path but show up in an erasure export — that's
  fine and arguably useful (audit trail of which slots existed).
- `meet_poll_vote.UNIQUE(meeting_type_id, voter_email, slot_starts_at)`
  + the "delete-then-insert" replace pattern means a fast double-submit
  could in theory cause a unique-violation on a race. The delete-then-
  insert isn't wrapped in a transaction; if it surfaces we'll wrap in
  one. Not a v1 blocker.

## [0.11.1] — 2026-05-17

### Added: Fibre Meet Group event type

Fibre Meet's "Group" event type is no longer a stub. A single host can now
offer slots that multiple invitees share until a per-MT capacity is reached.

### Changed
- **New column `meet_meeting_type.capacity`** (nullable integer, CHECK > 0)
  in `supabase/migrations/20260517200000_meet_group_capacity.sql`. Only
  meaningful when `event_type='group'`. Bookings are grouped by the
  existing `(meeting_type_id, starts_at)` tuple — no extra `slot_key`
  column needed.
- **API: `POST /api/v1/meet/public/bookings`** now performs a capacity
  check before insert when the MT is `event_type='group'`. If the
  confirmed-booking count for `(meeting_type_id, starts_at)` already
  meets capacity, the request is rejected with `409 { error: 'fully
  booked', code: 'slot_full' }`. No waitlist yet — that's a follow-up
  behind a per-MT toggle.
- **API: slots endpoints** (`/public/host/.../slots` and
  `/public/team/.../slots`) skip the MT's own bookings from the host's
  busy intervals when `event_type='group'` (so the slot stays bookable
  until full), and return a parallel `slots_meta` array with
  `{ starts_at, capacity, booked, remaining }` per slot. Fully booked
  slots are removed from `slots` entirely.
- **API: `MeetingTypeUpsert` zod schema** accepts `capacity` (int 1–1000,
  nullable). Server stores it on create + update.
- **UI: Meeting-type editor** (`apps/meet/app/(app)/meeting-types/form.tsx`):
  the event-type chooser now also shows up in Personal scope (since Group
  is single-host). Personal scope offers One-on-one and Group; Team scope
  adds Round-robin and Collective. When Group is selected, a curated
  "Capacity" dropdown appears in Details (2/4/6/8/10/12/15/20/30/50,
  default 12).
- **UI: New-MT chooser** (`apps/meet/app/(app)/meeting-types/new-menu.tsx`):
  the Group option is no longer `disabled: true`.
- **UI: Public booking page** (`apps/meet/app/[hostSlug]/[mtSlug]/`):
  Group MTs show a `Users` icon row in the sidebar ("Up to N invitees
  per slot"), and each time-slot button shows "X of Y left" pulled
  from `slots_meta`. If a slot happens to fill while the user is on
  the page, the 409 surfaces as "This slot just filled up. Please
  pick a different time."

## [0.11.0] — 2026-05-17

### Added: GDPR Article 15 self-service data export

The Privacy page's "Export my data" card is no longer a "Coming soon"
stub. One click downloads a single JSON file containing every piece of
personal data The Fibre stores about the caller, across every app.

### Changed
- **New endpoint `GET /api/v1/privacy/export`** in `apps/api/src/routes/privacy.ts`.
  Pulls in parallel from `user`, `person`, `user_identity_provider`,
  `app_membership`, `workspace_member`, `org_membership`, `activity`,
  `meet_booking`, `person_professional`, `person_change_context`,
  `person_relationship_context`, `person_learning`, `person_billing`,
  `person_tag`, `consent_record`, `data_subject_request`,
  `app_record_link`, `relationship` (outgoing + incoming) and the
  caller's `workspace`. Top-level `_meta.included_categories` lists
  every category considered, so a receiver can verify completeness.
- Uses `adminClient` (RLS bypass) with an explicit
  `user_id`/`person_id`/`workspace_id` filter on every query. Article
  15 supersedes UI-level app-membership scoping: a user is entitled
  to their `person_billing` row even if they don't currently hold the
  Sales app membership.
- Side-effect: each successful export writes a `data_subject_request`
  row of type `access`, status `completed`, for the audit trail.
- Response sets `Content-Disposition: attachment;
  filename="fibre-data-export-{email-slug}-{YYYY-MM-DD}.json"` so
  browsers save the file with a meaningful name.

- **New Next.js route handler** at `apps/web/app/(app)/privacy/export/route.ts`.
  Vercel-side proxy that forwards the user's Supabase access token to
  the API and streams the JSON response back. Hard rule §13 still
  holds — Vercel forwards bytes, never reads the payload.

- **`ExportButton` on the Privacy page.** Client component that
  fetches `/privacy/export`, materialises the response into a Blob,
  reads `Content-Disposition` for the filename and triggers a download
  via a synthetic `<a download>`. Shows "Preparing…" while in flight
  and an inline error if the export fails.

### Why this matters
Article 15 is the right of access. Until v0.10.4 we had the right of
erasure (Article 17) wired up but no way for a user to *see* what we
held about them — only what the UI surfaced. v0.11.0 closes that gap.
"The app justifies the field" (brief §5) means every field has a
reason to exist; Article 15 means every field also has to be
disclosable on demand. The export covers both first-party apps
(Platform, Meet) and any third-party app that has registered itself
in `app` and written into `app_record_link`.

### Gotchas / follow-ups
- The export currently runs synchronously in a single request. Fine
  for the current shape of data (one user, a few hundred rows at
  most). If a workspace ever sees an activity log in the thousands
  per person, move to a background job + presigned download URL.
- `relationships` is split into `outgoing` / `incoming` to keep
  semantics clear (some types like `introduced_by` are directional).
- `_meta.subject` is the canonical identity bundle for the export —
  if a receiver (e.g. a different controller) needs to know "who is
  this file about", that's the block to read.

## [0.10.4] — 2026-05-17

### Fix: Meet was showing the full workspace contact graph

Brief §5 ("the app justifies the field") and §13 (data wall) say each
app sees what it has a reason to see. The Meet Contacts page was
returning every `person` in the workspace — a quiet leak across the
app boundary.

### Changed
- **`GET /api/v1/meet/contacts`** now scopes to persons Meet justifies
  knowing about: invitees on any `meet_booking`, plus members of any
  `meet_team` in the workspace. Two-source UNION, computed in the
  route. Everyone else is no longer returned.
- Each row carries a `source: ('booking' | 'team')[]` field plus
  `is_team_member`, so the UI can explain *why* a person is surfaced
  (and so future audits can replay the justification).
- Meet Contacts page description updated to match. Two new chips on
  each row: `Team` and `Booked`. Empty state now reads "No-one has
  booked yet, and your teams have no members."

### Why this matters
This was the exact pattern the data wall is designed to prevent: an
app sees data it didn't earn. The Fibre platform is the source of
truth for identity; Meet only surfaces the slice tied to its own
records. Sales, Learn, Thread will follow the same shape when they
ship contact views.

## [0.10.3] — 2026-05-17

### Third-party apps can now identify themselves end-to-end

The two blockers a real third-party connector hits on day one are
fixed. An external app registered in `public.app` can call the API as
itself and push activities using its own type names.

### Changed
- **`X-App-ID` accepts any registered app slug.** The middleware's
  hardcoded enum (`fibre-platform`, `fibre-meet`, etc.) is replaced
  with a cached lookup against `public.app` (5-min TTL, refresh on
  miss). Once `mailchimp` is in the table, `X-App-ID: mailchimp` works
  on the second request at the latest. Unknown slugs now return a
  clearer `unknown-app-id` problem instead of the generic
  `missing-app-id`.
- **`activity.type` is no longer enum-locked.** Replaced the
  `z.enum(ACTIVITY_TYPES)` validator with a snake_case regex
  (`^[a-z][a-z0-9_]{1,63}$`). Manifest-declared types like
  `newsletter_opened` are accepted directly. `subject` is still
  length-limited per brief §6 — type is just a machine label, content
  belongs in subject.
- **Demo script** now calls in as `mailchimp` with type
  `newsletter_opened` — no more workaround comments.
- **Third-party guide** trimmed: those two gaps moved from "Open gaps"
  to "Done".

## [0.10.2] — 2026-05-16

### Cross-app entity mapping — docs + runnable third-party demo

The schema (`app_entity_mapping` + `app_record_link`) and the four
`/api/v1/apps/...` routes have been live since v0.10.x but only Meet
used them internally. This release closes the documentation gap so an
external integrator can pick up the surface end-to-end, plus a worked
example script.

### Added
- **`docs/third-party-app-guide.md`** — step-by-step walkthrough:
  manifest format → register the app + mappings → link records → push
  activities → reverse lookup. Honest about every gap a third party
  hits today (no external `X-App-ID`, no API keys, no self-register
  endpoint, no bulk linking, no curator-data write API, scopes
  unenforced, custom activity types unmerged).
- **`apps/api/scripts/demo-third-party-app.mjs`** — ~180-line idempotent
  Node script that simulates a "Mailchimp" connector: registers the
  app, declares an entity mapping, links three subscribers (two
  existing EBBF persons + one created via `create_if_missing`), pushes
  activities, and reverse-looks-up the link + full person row. Run
  with `FIBRE_JWT=… node scripts/demo-third-party-app.mjs`.

### Changed
- **`docs/cross-app-entity-mapping.md`** — removed the "draft, before
  any code" framing now that everything in §"The model" has shipped.
  Added a "What actually shipped" section that maps each piece of the
  proposal to a file (migration / route / manifest) and lists the seven
  still-open gaps.

## [0.10.1] — 2026-05-16

### Per-app curator-data labelling reaches the org side

The pattern shipped for contact profiles (chip on each curator-data
section + app suffix on every "Edit X" dialog title) now lands on
organisation profiles too — so a viewer always knows which app justifies
a given field.

### Changed
- `organisations/[id]/app/[appSlug]` — "System context" gets a
  `Fibre Meet` chip; "Commercial relationship" and "Invoicing" get a
  `Fibre Sales` chip. Uses the same `AppChip` component as the contact
  side.
- Edit dialog titles: "Edit system context — Fibre Meet", "Edit
  commercial relationship — Fibre Sales", "Edit invoicing details —
  Fibre Sales".

## [0.10.0] — 2026-05-16

### Auth emails now route through our API — branded, with SPoT

Supabase's "Send Email" hook is configured to call our API for every
auth email (signup, sign-in, magic link, invite, password reset, email
change, reauthentication). The API renders the email from
`packages/shared/src/branding.ts`, so a rename or white-label is one
file change. End-to-end verified: logo, headline, 8-digit code box,
CTA, and footer all arrive correctly.

### Added
- **`POST /api/v1/auth-hook/email`** — handles the Supabase Send Email
  Hook. HMAC-SHA256 verification per the standardwebhooks spec; renders
  via `auth-templates.ts`; sends via Resend.
- **Eight auth email types** rendered in Thread-style identity: centred
  Fibre wordmark, "Almost there" headline, big code box, optional CTA,
  reassurance paragraph, divider, Help/About/Legal footer + whitelist
  hint + legal address line.
- **`BRAND_ASSETS`** on `packages/shared` — logo URL, native dimensions,
  alt text. Single source of truth for the wordmark across web + emails.
- **The Fibre wordmark** hosted at `https://thefibre.app/brand/the-fibre.png`
  (1404×704 PNG, served from `apps/web/public/brand/`).
- **`/sign-in` page** on `thefibre.app` exposing the same Google +
  8-digit email-code flow Meet has on its landing.

### Changed
- Sign-in input accepts **8 digits** (matches Supabase OTP length).
- `legalFooterLine()` no longer includes the legal entity name on public
  surfaces. `ENTITY.name` (Solidarity Lab B.V.) remains in `branding.ts`
  for internal billing / invoicing.
- Fly machine pinned to `min_machines_running = 1`, `auto_stop_machines = off`
  — Supabase auth hooks have a 5s ceiling, cold starts blow it.
- HMAC secret parser accepts `v1,whsec_xxx`, `whsec_xxx`, or bare base64
  so dashboard copy-paste just works.

### Sjoerd action
- Rotate the Resend API key still pending from v0.8.0.

## [0.9.0] — 2026-05-17

### Permission tiers — within-workspace visibility lands

The platform's access model grows a second axis. Workspaces no longer treat
every member as "sees everything"; visibility is per-resource (each Meet team,
program, etc. carries `members_only | org_wide`) and users carry a
`relationship_type` (`internal | external`) that decides whether they get the
org-wide widening. See `docs/permission-tiers-proposal.md` for the resolved
model and `docs/fibre-vs-app-data.md` for how this slots into the brief.

### Added
- **`public.workspace_member`** pivot table (`user_id`, `workspace_id`,
  `workspace_role` = admin|member, `relationship_type` = internal|external,
  `member_status`). Multi-org ready from day one — a person can be a user in
  multiple organisations cleanly when we need it.
- **`visibility` column** on `meet_team` and `program`, default `members_only`,
  opt-in `org_wide`. Editable by leads / org admins via the team detail page.
- **`can_see_person()`, `can_see_organisation()`, `can_see_activity()`,
  `is_workspace_admin()`** — all `SECURITY DEFINER` SQL helpers, granted only
  to `authenticated`. `can_see_person` covers six clauses (admin / self /
  shared Meet team / shared program enrolment / org_wide widening for
  internals / hosted-a-booking with them).
- **RLS rewritten** on `public.person`, `public.organisation`, `public.activity`
  (SELECT), and `public.meet_booking`. Workspace check stays as the cheap
  pre-filter; the helper provides the per-row gate.
- **API endpoints**:
  - `POST /teams/:id/members` + `POST /internal-team` accept
    `relationship_type` for new users.
  - `PATCH /teams/:id` accepts `visibility`.
  - `PATCH /internal-team/:userId` (admin-only) flips `workspace_role`,
    `relationship_type`, `member_status`.
  - `GET /internal-team` returns the per-row workspace_role +
    relationship_type + member_status.
- **UI**:
  - Team invite form + Internal-team invite gain a Relationship select.
  - Team detail page gains a Visibility card (radio: members_only / org_wide).
  - Internal-team page renders role + relationship chips; admins see editable
    selects.

### Backfill
- Every existing `user` row gets a `workspace_member` row.
  `workspace_role='admin'` iff they hold a `fibre-platform` `app_membership`
  with role `admin`; otherwise `member`. `relationship_type='internal'` for
  all. All existing teams + programs start `members_only`.

### Migration
- `20260517000000_permission_tiers.sql` — schema + helpers + RLS + backfill.

### Behavioural change to watch
Workspaces that previously had everyone-sees-everything now scope per
resource. The seeded `sjoerd@soul.com` workspace is unaffected (single admin
sees everything via the admin shortcut). When you invite future members,
choose Internal or External; Internal users see org-wide things, External
only see resources they're explicitly added to.

## [0.8.0] — 2026-05-16

### Suite v2 — Fibre Meet matures into a real scheduler

This release lands the rest of the Suite UI port and the structural primitives
underneath it. Most of the changes are visible in commits 92ea693 …
through d74dae9 over the day. See `docs/meet-architecture.md` for the running
reference and `docs/meet-api.md` / `docs/meet-data-model.md` for endpoint + schema docs.

### Added — invite-by-email + two-step accept (team invites)
- Inviting an email that doesn't yet have a workspace user pre-creates a `user` + paired `person`, grants `fibre-meet` membership, and writes a `meet_team_member` row with `status='invited'` plus a unique `invite_token`. The invitee gets an email pointing at `meet.thefibre.app/invite/<token>`.
- New public `/invite/[token]` accept page peeks at the invite (no auth), prompts sign-in if needed, and on Accept flips status to `active`, clears the token, and seats the user in the right workspace.
- Pending invites are excluded from round-robin / collective rosters and from the user's own `/teams` list — they only count once accepted.
- Lead-only actions on the team detail page: **Copy link** (so the lead can DM the URL when email is unreliable), **Resend** (rotates the token + re-emails), **Revoke**.
- API: `POST /teams/accept-invite/:token`, `GET /public/invite/:token`, `POST /teams/:id/members/:userId/resend-invite`.

### Added — identity invariant: every workspace user has a paired `public.person`
- Both invite paths (team-member + internal-team) now create a `person` and link `user.person_id` both ways.
- New SECURITY DEFINER helper `public.ensure_user_person(user_id)` called from `resolve_sso_identity()` on every match path so the invite-then-signin flow completes the link.
- Startup heal block in the migration cleans up legacy rows (`person_id IS NULL`).
- Meet's `/contacts` page rewritten to read from `public.person` (workspace-scoped) instead of aggregating from `meet_booking`. Meet decorates each person with its booking summary — that's the curator data it justifies.

### Added — meeting-type editor as tabs + per-MT overrides
- Tabbed editor in the Suite layout: **Basics / Availability / Conferencing / Pricing / Intake**, with a sticky save bar at the top and white cards on a light grey background.
- Personal vs Team is a 2-card chooser (clicking Team reveals a Team dropdown below — no select-in-a-select, no sub-picker in the New menu).
- Duration / buffer / notice / advance are curated dropdowns (`None / 15 min / 30 min / …` / `1 day / 7 days / …`) instead of free-form number inputs.
- New columns: `meet_meeting_type.working_hours_override jsonb`, `meet_meeting_type.conflict_calendar_ids uuid[]`. NULL falls back to host defaults. The single-host slots endpoint respects both overrides; team route uses `buildPerHostArgs` which picks them up automatically.

### Added — Calendars role management + Re-sync
- `POST /api/v1/meet/calendars/sync` re-pulls the calendar list from Google without re-doing OAuth.
- `minAccessRole: 'reader'` so subscribed / shared calendars surface (previously only owner-tier rows did).
- `meet_calendar.role` now accepts `ignore`; ignored calendars are excluded from freebusy.
- Suite-style Calendars page: card list with a role dropdown per row (Primary / Conflict source / Write target / Ignore) and a Re-sync button.

### Added — Connections (formerly Integrations) consolidates external services
- Personal meeting room URL moved from Profile → Connections (it lives with Zoom/Whereby links, not personal identity).
- Google Calendar connect/disconnect stays here.

### Added — design canon
- Lucide icons across the board (Settings cards, bookings view toggle, new-MT menu, public booking meta). No emoji icons anywhere.
- Unified slug UX in `apps/meet/components/ui/name-slug.tsx`: `[prefix/]  [editable slug]  [Alt]`. Auto-fill from name; Alt regenerates a `<slug>-<rand>` variant. Profile slug field follows the same visual pattern.
- `PageContainer` left-aligned (drops `mx-auto`) — content sits next to the sidebar instead of being centered in the viewport.
- Public-booking page bg neutral-50 with a single white split-card; matches Suite's layout.

### Migrations
- `20260516000000_meet_calendar_ignore_role.sql` — adds 'ignore' to `meet_calendar.role`.
- `20260516010000_sso_link_existing_person.sql` — `ensure_user_person()` helper + updated `resolve_sso_identity()` + startup heal.
- `20260516020000_meet_team_member_pending.sql` — `status` + `invite_token` + `invited_at` + `accepted_at` on `meet_team_member`.
- `20260516030000_meet_meeting_type_overrides.sql` — `working_hours_override jsonb` + `conflict_calendar_ids uuid[]`.

### Fixed
- The earlier "no calendars syncing" — Google Calendar API hadn't been enabled in the Cloud Console project. The error path now logs the underlying message; Sjoerd enabled the API and Re-sync works.
- PKCE `code_verifier` mismatch on second sign-in — documented (stale cookies; use a fresh window).
- Fly machine lease stuck after a half-completed deploy — documented (wait it out).

### Required production secrets (Fly)
Unchanged: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SSO_INTERNAL_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.

### Operational note
The Resend API key used during this release ended up visible in a development screenshot. **It must be rotated** before the next release: Resend dashboard → API Keys → delete + recreate → `fly secrets set RESEND_API_KEY=…` from repo root.

## [0.7.0] — 2026-05-15

### Added — Fibre Meet step 7 (Round-robin + Collective)
- **Event types on meeting types.** New `event_type` column on `meet_meeting_type` with values `one_on_one` (default), `round_robin`, `collective`, and a reserved `group`. Only team-owned meeting types may use the multi-host modes (enforced by a CHECK constraint).
- **`meet_meeting_type_assignee`** table — eligible team members per MT, with one row marked `is_primary`. Lead-only writes, gated by the existing `meet_is_team_lead()` security-definer helper (no recursion).
- **Multi-host slot composition.** `generateMultiHostSlots(mode, hosts[])` in the availability engine — UNION for round-robin (slot bookable if any host is free), INTERSECTION for collective (every host must be free). Per-host args include each host's own working_hours, busy intervals, and Google freebusy.
- **Team slots endpoint** rewritten to dispatch on `event_type`: loads the assignee roster, builds per-host args (including GCal freebusy in parallel), and returns the right union/intersection. Falls back to single-host mode for `one_on_one`.
- **Team booking POST** now picks the host:
  - `round_robin` — least-loaded eligible host who's free at the chosen slot (rejects with 409 if nobody available).
  - `collective` — primary assignee runs the canonical GCal event; the other assignees are added as event attendees and receive the host-notification email.
- **Google event** supports `extraAttendees` — used to invite the team to a collective booking on one event.
- **Meeting-type editor** learned an "Event type" selector (only shown when team-owned), dynamic hint per option. The detail page renders an **Assignees** section for round-robin / collective MTs with a per-team-member checkbox + primary radio.
- **Assignee CRUD API**: `GET /api/v1/meet/meeting-types/:id/assignees`, `POST` (lead-only; auto-clears prior primary), `DELETE /:userId`.

### Migration
- `20260515030000_fix_team_member_rls_recursion.sql` (shipped between 0.6.0 and 0.7.0) — replaced the self-referencing `meet_team_member` write policy with a `SECURITY DEFINER` `meet_is_team_lead()` helper + split per-verb policies, fixing Postgres `42P17 infinite recursion`.
- `20260515040000_meet_event_types.sql` — adds `event_type` + the `meet_meeting_type_assignee` table with full RLS (read = workspace + fibre-meet; write = team lead via `meet_is_team_lead`). Partial unique index enforces at-most-one-primary-per-MT.

## [0.6.0] — 2026-05-15

### Added — Fibre Meet step 5 (emails + cancel)
- **Booking emails.** Resend-backed transactional emails sent on every booking: a branded confirmation to the invitee (with cancel link) and a notification to the host. Cancellations send to both sides. Plain-text + HTML, formatted in the host's timezone. Templates live in `apps/api/src/lib/email/templates.ts`; transport in `apps/api/src/lib/email/client.ts`. No-ops with a `[email] would send: …` log line when `RESEND_API_KEY` is unset so dev and CI don't need outbound mail.
- **Cancel flow.** New public endpoint `POST /api/v1/meet/public/bookings/:id/cancel` flips the booking to `cancelled`, deletes the linked Google Calendar event (best-effort), and emails both sides. New cancel page at `/[hostSlug]/[mtSlug]/cancel/[bookingId]` with a confirmation step. The confirmation page now surfaces "Need to cancel or reschedule?".

### Added — Fibre Meet step 6 (Teams)
- **Teams.** New `meet_team` + `meet_team_member` tables. A team is a workspace-scoped slugged group with its own member list (roles: `lead` / `member`). Each team gets its own public booking page at `meet.thefibre.app/<team-slug>`. Meeting types can be owned by a team instead of a single host — the meeting-type editor learned a new "Owned by" selector.
- **Shared root namespace.** New `meet_root_slug` table, populated by triggers from `meet_host` and `meet_team`. Single-segment URLs (`/<slug>`) resolve unambiguously to one host or one team per workspace; slug collisions are rejected at create time.
- **Team CRUD + members API.** `GET/POST /api/v1/meet/teams`, `GET/PATCH /:id`, `POST /:id/members` (resolves email → workspace user), `DELETE /:id/members/:userId` (refuses to remove the last lead). Creator becomes lead automatically.
- **Public team booking.** `/api/v1/meet/public/team/:slug`, `/.../mt/:mt_slug`, `/.../mt/:mt_slug/slots`. The Meet front-end dual-resolves any root slug — tries host first, falls back to team — so the same booking flow renders both. The booking flow client accepts an `ownerKind` of `host | team` and picks the matching slots URL.
- **Teams UI.** New /teams list, /teams/new, and /teams/[id] detail with member management. The Meet sidebar gained a Teams nav item.
- **Meeting types page** now groups by Personal + per-team sections, each showing the correct public URL.

### Migration
- `20260515020000_meet_teams.sql` — adds `meet_team`, `meet_team_member`, `meet_root_slug` (with sync triggers), `meet_meeting_type.team_id` column + two partial unique indexes (per-host slug when personal, per-team slug when team-owned), full RLS (workspace + fibre-meet membership; team-member writes gated to leads). Backfills the root-slug table for existing hosts.

### Required env (production)
- `RESEND_API_KEY` and `EMAIL_FROM` on the API host (Fly) for emails to actually send.

## [0.5.1] — 2026-05-14

### Added
- **Per-workspace app activation.** New `workspace_app` table records which apps a workspace has turned on; independent of per-user `app_membership`. New page **Settings → Apps** lists the four installable apps (Fibre Meet, The Thread, Fibre Sales, Fibre Learn) with descriptions and an Activate / Deactivate toggle. Workspace-admin gated (`fibre-platform` role=admin in the current workspace) — non-admins are redirected back to Settings.
- **API endpoints** `GET /api/v1/workspace-apps`, `POST /api/v1/workspace-apps` (activate + auto-grant the activating user a `role='admin'` app_membership), `DELETE /api/v1/workspace-apps/:slug` (soft deactivate — keeps history so old activity rows still resolve their app).
- **Super admin** as a first-class concept. New boolean `is_super_admin` on `public.user`, with SQL helper `public.is_super_admin()`. Sjoerd promoted in the migration. The signup_request admin page and its RLS policies now gate on super-admin (cross-workspace concern). Workspace admins still see their own workspace settings and the Apps page.
- **New workspaces auto-grant** their first user `fibre-platform` role=admin via `resolve_sso_identity()`, so approved applicants land with workspace-admin rights in their own workspace from minute one.

### Changed
- **Dashboard "Your apps"** card now reads from `workspace_app` (what the workspace has installed) intersected with the user's memberships, instead of just the JWT's `app_memberships` claim. Empty state links to /settings/apps.
- **Sidebar "Admin" section** splits cleanly: Apps for workspace admins; Access requests for super admins.

### Migration
- `20260514160000_workspace_apps.sql` — creates `workspace_app` + RLS, adds `is_super_admin` + helper, re-points signup_request policies at `is_super_admin()`, bootstraps the default workspace's currently-seeded app memberships into workspace_app rows, and rewrites `resolve_sso_identity()` to grant new users their workspace-admin membership.

## [0.5.0] — 2026-05-14

### Added
- **Self-serve apply + admin approval.** New public landing page (white, descriptive, request-access CTA) plus a `/request-access` form. Submissions land in a new `signup_request` table. Founding user (sjoerd@soul.com) is bootstrapped to `fibre-platform` role `admin`; admins see an "Access requests" page under a new sidebar Admin section and can approve or deny. Approval auto-provisions a fresh workspace; the applicant lands in it the next time they sign in.
- **`/access-pending` holding page** for users whose sign-in lands without an approved request — three states: pending review, denied, or unknown email (with CTA back to `/request-access`).
- **API endpoints** `POST /api/v1/signup-requests` (public, anon), `GET` and `PATCH /:id` (admin-gated by RLS via new `public.is_platform_admin()` helper), and `POST /api/v1/sso/access-check` (server-to-server, secret-gated) for the auth callback to know whether to let a user through.
- **Auth callback** (`/auth/callback`) now calls `access-check` first, then routes the user to their workspace (existing or just-approved), or to the holding page.

### Changed
- Bumped to **v0.5.0** — first version where Fibre is genuinely multi-tenant. The default seeded workspace remains for the founding user; every new applicant gets their own.
- Landing page reworked from the dark "list of apps" layout to a light, descriptive marketing page that explains what The Fibre is and why before asking the visitor to do anything.

### Migration
- `20260514150000_signup_requests.sql` — creates `signup_request` (with `status` + partial unique index on email), adds the `public.is_platform_admin()` SQL helper, RLS policies, and promotes sjoerd@soul.com to `fibre-platform` admin.

## [0.4.8] — 2026-05-14

### Shipped
- **Live in production.** Web at https://thefibre.app (Vercel, fra1) and API at https://thefibre-api.fly.dev (Fly.io, fra). Sign-in works, contacts/orgs/programmes/activity all flow end-to-end through the real EU API with RLS enforcing workspace + app-membership scoping.

### Fixed
- `@thefibre/shared` now emits a compiled `dist/`. Previously `main` pointed at `src/index.ts`, which worked under tsx (dev) but crashed Node 22 in production with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. Adds a `build` script, `outDir` + `rootDir` to its tsconfig, and an `exports` map.
- Both apps' build commands now use the pnpm topological filter (`pnpm --filter @thefibre/web... build` / `--filter @thefibre/api... build`). The trailing `...` tells pnpm to include workspace dependencies in topological order, so `@thefibre/shared` gets built before its consumers without hand-chaining. Applied to `vercel.json` (root + apps/web) and the API Dockerfile.
- Contact edit dialog gained the **Preferred language** field. API + DB already accepted it; the form was missing the control so it stayed read-only at "—" on the overview.

### Migration
- `20260514140000_relax_text_arrays_again.sql` — re-applies `drop not null` on text[] columns. The v0.3.9 migration was recorded as applied on remote but the constraints were still tripping `stated_values` etc. Supabase tracks migrations by filename only, so a fresh migration is the right way to re-apply schema changes.

## [0.4.7] — 2026-05-14

### Added
- **Searchable country picker** (`components/ui/country-combobox.tsx`) backed by an ISO-3166 list in `lib/countries.ts`. Type-to-search, arrow-keys + Enter to pick, hidden input submits the ISO 2-letter code. Replaces the free-text 2-letter country field on person and organisation identity edit dialogs. Overview pages now render the full country name instead of the code.
- **Physical address** (`street`, `postal_code`) on platform `person` and `organisation` rows. Surfaced in both the identity edit dialogs and the overview field grids.
- **Invoicing details** as a new fibre-sales curator table — `person_billing` and `org_billing` — with: legal name, tax / VAT ID, billing email, billing address (street / postal code / city / region / country), payment terms (days), currency, PO required, free-form notes. New API endpoints `GET|PATCH /api/v1/persons/:id/billing` and `/organisations/:id/billing`. RLS gates these by `fibre-sales` app-membership — users without sales access never see the section. Section lives on the Fibre Sales tab of each entity alongside Commercial relationship.

### Changed
- `PersonSubResource` and `OrgSubResource` unions in `apps.ts` extended with `'billing'`; the Fibre Sales descriptor lists it alongside `'relationship'` so the apps-discovery query treats it as an emergent tab signal.

### Migration
- `20260514130000_address_and_billing.sql` — additive, idempotent. Adds the address columns, creates the two billing tables with the canonical curator-table RLS policy (`has_app_id` + workspace check).

## [0.4.6] — 2026-05-14

### Changed
- **Renamed Fibre Suite → Fibre Meet** across the entire codebase. Slug `fibre-suite` → `fibre-meet`, subdomain `suite.thefibre.app` → `meet.thefibre.app`, display label `Fibre Suite` → `Fibre Meet`. New migration `20260514120000_rename_fibre_suite_to_meet.sql` updates the `app` row and refreshes the `app.slug` CHECK constraint. All TypeScript type unions (`AppId`, `AppSlug`), the API `VALID_APP_IDS` set, `FORMAT_TO_APP_SLUG`, profile-routing helpers, dashboard `APP_DOMAINS`/`APP_NAMES`, settings, activity, contacts and organisation per-app tabs, redirect shims (`/contacts/[id]/change` and `/organisations/[id]/system-context` now point at `/app/fibre-meet`), the EBBF seed script, and the technical brief have all been updated. Historical migrations and the v0.3 brief are intentionally left as-is.

## [0.4.5] — 2026-05-15

### Added
- **Richer dashboard.** Four stat cards (Contacts / Organisations / Programmes / Activity), recent activity timeline (last 6 events), active programmes list, and the existing your-apps section. Stat values come from parallel best-effort API calls — each fetch is non-fatal so a slow endpoint doesn't break the page. Combined with the seed data, the dashboard now lands on substance instead of an empty welcome.

## [0.4.4] — 2026-05-15

### Added
- **Activity filter by `organisation_id`.** `GET /api/v1/activities` now resolves an org id to the union of its current members' activity (two-step query: resolve members via `org_membership` where `ended_at IS NULL`, then `.in('person_id', members)` on activity). Works without changing the `activity` schema.
- Per-app organisation tab now renders this timeline instead of an EmptyState placeholder.

## [0.4.3] — 2026-05-15

### Added
- **Deploy-ready config.** `vercel.json` (repo root + `apps/web/`), `apps/api/Dockerfile` (multi-stage, repo-root build context for monorepo workspaces), `apps/api/fly.toml` (Frankfurt, scale-to-zero, health checks), `apps/api/.dockerignore`, and a full walkthrough in [`docs/deploy.md`](docs/deploy.md). Nothing was actually deployed — that needs dashboard access.

## [0.4.2] — 2026-05-15

### Added
- **Seed script** at `apps/api/scripts/seed-ebbf.mjs`. Creates the brief §8 worked example: EBBF Athens 2026 conference, post-Athens journey, board working session, 7 sample people, EBBF organisation with identity + system context + 3 members, ~11 enrolments, ~21 activity events spread across 90 days, per-app curator data for two key contacts. Idempotent — safe to re-run. Reads service key from `apps/api/.env`.
- Solves yesterday's "feels abstract" problem: every screen now renders real content.

## [0.4.1] — 2026-05-15

### Added
- **Programme + enrolment UI.** `/programmes` list, `/programmes/new` create form, `/programmes/[id]` detail with enrolments and Enrol-person dialog.
- API: `GET /api/v1/programs/:id` (detail), `GET /api/v1/programs/:id/enrolments` (with person info).
- `POST /api/v1/programs` now derives the owning app from the format (meeting → fibre-meet, event/journey → the-thread, *learn → fibre-learn) per brief §5 Domain 5.
- Sidebar gets a new "Programmes" section with Programmes + Activity.

## [0.4.0] — 2026-05-14

Brief revised to v0.4. Two structural principles formalised: **per-app profile tabs** and **the app justifies the field** (GDPR Article 5(1)(c) data minimisation).

### Schema (additive — nothing dropped, all reversible)
- Curator tables (`person_professional`, `person_relationship_context`, `person_change_context`, `person_learning`, `org_identity`, `org_system_context`, `org_relationship`) now carry an `app_id` FK declaring which app owns each row.
- Backfilled with sensible defaults: person_professional → fibre-platform, person_change_context → fibre-meet, person_learning → fibre-learn, person_relationship_context → fibre-sales, org_identity → fibre-platform, org_system_context → fibre-meet, org_relationship → fibre-sales.
- RLS rewritten to require `has_app_id(app_id)` — a user only sees curator rows for apps they have membership for. The principle is enforced at the database layer, not just the UI.

### API
- PATCH endpoints stamp the correct `app_id` server-side based on the endpoint.
- New: `GET /api/v1/persons/:id/apps` and `GET /api/v1/organisations/:id/apps` — returns the set of app slugs that have data on this entity (curator rows + activity events for persons). The UI uses this to render dynamic per-app tabs.

### UI
- Person profile now has: **Overview** → **Profile** (identity fields + Professional curator section) → one tab per app that has data.
- Organisation profile mirrors: **Overview** (basic identity + members) → **Profile** (org_identity curator) → per-app tabs.
- Old sub-routes are now redirect shims so existing bookmarks still work.
- `apps/web/lib/apps.ts` is the catalogue mapping each app slug → label and which curator sub-resources it owns.

### How this was built
Foundation by me sequentially. Two parallel sub-agents then refactored person and org profile pages on disjoint folders. Combined typecheck clean.

### Known gap (deferred)
- Activities filter by `organisation_id` isn't supported yet (`activity` schema only has `person_id`). Per-app org tabs render curator section + EmptyState for timeline. Future: join through `org_membership`.

## [0.3.11] — 2026-05-14

### Fixed
- **Page didn't refresh after save.** PATCH succeeded, dialog closed, but the read view stayed on the empty state because the dialog closes client-side and Next.js's `revalidatePath` from inside the server action didn't trigger the client to re-fetch. Now every edit dialog calls `router.refresh()` after a successful save, before closing — the page re-renders with fresh data immediately.

Applied to all 10 dialogs (contact + 4 person tabs, org + 3 org tabs, add-member).

## [0.3.10] — 2026-05-14

### Fixed
- Drop NOT NULL on `person_relationship_context.is_key_contact` and `is_ambassador`. They were `boolean NOT NULL DEFAULT false`; the UI sends `null` when the Yes/No select is left blank.
- Person `upsertProfile` helper now logs the full Postgres error (code/details/hint) to stderr and returns it in the 500 body — same pattern as v0.3.6's `upsertOrgProfile`. Future similar failures surface cleanly.

## [0.3.9] — 2026-05-14

### Fixed
- Relaxed `NOT NULL` on profile-table columns the UI treats as optional. The original schema had over-tightened these to `text[] NOT NULL DEFAULT '{}'` or `integer NOT NULL DEFAULT 0`. When the user cleared a value, the upsert rejected with `23502 null value in column "X" violates not-null constraint`. Defaults still apply on INSERT; `null` now means "unknown / not recorded" on clear.
  - text[]: `expertise_areas`, `industries_worked_in`, `certifications`, `spoken_at_events`, `change_themes`, `blockers`, `motivators`, `learning_interests`, `prior_programmes`, `stated_values`, `cultural_descriptors`, `languages_of_operation`, `active_change_themes`, `structural_tensions`, `previous_interventions`, `enablers`, `programmes_completed`, `operating_countries`, `languages_spoken`
  - integer: `total_participants_reached`, `touchpoints_count`

## [0.3.8] — 2026-05-14

### Fixed
- **The actual root cause of the silent saves.** `auth.users.id` (the JWT `sub` claim) is *not* the same as `public.user.id`. The API was using `ctx.userId = jwt.sub` for fields like `notes_updated_by`, `created_by`, etc. — all of which FK to `public.user.id`. Every such write failed with `23503 Key is not present in table "user"`.
  - Migration: `custom_access_token_hook` now injects `app_user_id` (the `public.user.id`) into JWT claims, and `public.current_user_id()` (used by RLS) reads from there.
  - API middleware: `ctx.userId` is now `app_user_id`; `ctx.authUserId` exposes the Supabase auth uuid separately for the few places that need it (none in app code yet).

This also retroactively fixes RLS policies on `user_identity_provider`, `session`, `app_membership`, `sso_match_log` that were silently denying queries because `current_user_id()` returned the wrong UUID.

### Action required
Users must **sign out and sign in** once to get a JWT with the new `app_user_id` claim. The API will return `401 invalid-claims` until then with a message telling them so.

## [0.3.7] — 2026-05-14

### Fixed
- **Profile-tab saves now actually persist.** The v0.3.6 fix (userClient apikey) made requests reach the database, which exposed the next bug: `parseList()` in the action helpers returned `null` for empty comma-separated inputs, but the `text[]` columns (`stated_values`, `expertise_areas`, `blockers`, `motivators`, …) are declared `NOT NULL DEFAULT '{}'`. Postgres rejected the insert with `null value in column "stated_values" violates not-null constraint`. Now `parseList` returns `[]` for empty input — applied to all 6 profile-tab actions (4 person, identity / system-context / relationship for org).

### Architecture note
This came out cleanly because the v0.3.6 `upsertOrgProfile` change started logging full Postgres errors (code, details, hint) to stderr — the actual constraint name was right there in the API server's terminal.

## [0.3.6] — 2026-05-14

### Fixed
- **Real cause of the silent saves: `userClient` was using the service-role key as its base apikey.** PostgREST then treats every request as `service_role`, ignoring the user's JWT claims for RLS. INSERTs/UPSERTs into `org_identity` etc. failed with a 500 because the JWT context wasn't applied correctly. Fixed by using the **anon key** as the apikey and overriding `Authorization` to forward the user JWT — the standard Supabase JS-on-the-server pattern.

This was the underlying cause of "save does nothing on Identity tab" — and likely several silent edge cases on other PATCH endpoints too.

### Added
- API: `upsertOrgProfile` now logs the full Postgres error (code/details/hint) to stderr before returning 500, and includes them in the response body for easier debugging.

## [0.3.5] — 2026-05-14

### Fixed
- **Save buttons (second pass).** v0.3.4 switched to `formRef.current.requestSubmit()` but Save was still doing nothing in practice. Now the button calls a `doSave()` function directly — it reads `FormData(formRef.current)` and invokes the server action without involving the form's submit event at all. `onSubmit` is kept as a fallback for the Enter key.

## [0.3.4] — 2026-05-14

### Fixed
- **Save buttons in all Edit dialogs now actually save.** Was: the submit `<Button>` lived in the Dialog footer (outside the form) and used `form="…-edit-form"` to point at the form. This is HTML-spec but unreliable in some browser/React combos — clicking Save did nothing. Now: each form uses a `ref`, and the Save button calls `formRef.current?.requestSubmit()` directly. Reliable everywhere.

Applies to all 9 Edit dialogs:
- Contact main (`contact-actions.tsx`)
- Contact tabs: Professional, Relationship, Change context, Learning
- Organisation main (`org-actions.tsx`)
- Organisation tabs: Identity, System context, Relationship
- Add member dialog on org detail

## [0.3.3] — 2026-05-14

Fixes the silent-save issue on edit dialogs.

### Changed
- **URL fields no longer require `https://` prefix.** Was: `z.string().url()` rejected `thefibre.app` or `linkedin.com/company/x` with a generic 400. Now: accept any string up to 500 chars; the display layer prepends `https://` when needed. Affects: organisation `website` + `linkedin_url`, person `linkedin_url`, user `avatar_url`.

### Fixed
- **All field errors now display.** Was: only `name` / `first_name` / `last_name` / `email` showed per-field errors — every other field surfaced only a generic "API 400" with no clue what to fix. Now: every input in both the contact and organisation Edit dialogs is wired to `state.fieldErrors`. If you mistype a country code or leave a malformed field, you'll see exactly which one.
- Country fields now include a hint ("Two letters or leave blank") so users don't accidentally type a single character.

## [0.3.2] — 2026-05-14

Organisation profile tabs — the org-graph counterpart to v0.3.0's person tabs.

### Added
- **Tabbed organisation detail** — `/organisations/[id]` now uses a layout with four tabs: Overview, Identity, System context, Relationship.
- **Identity** tab — mission, vision, stated values, cultural descriptors, governance model, ownership type, decision-making style, languages of operation, maturity stage, identity notes.
- **System context** tab — transformation stage, active change themes, structural tensions, strategic priorities, current challenges, **political landscape** (flagged Sensitive per brief §5.D3), leadership stability, change readiness, previous interventions, lessons, blockers, enablers.
- **Relationship** tab — relationship stage, health status, engagement type, programmes completed, total participants reached, touchpoints count, primary/secondary owner, last touchpoint, next planned contact, next opportunity, relationship history.
- **API:** GET + PATCH endpoints per tab (`/organisations/:id/{identity|system-context|relationship}`). Shared `upsertOrgProfile` helper.

### How this got built
Three parallel sub-agents, ~80 seconds wall-clock after the API + tab foundation was in place. Same pattern as v0.3.0.

## [0.3.1] — 2026-05-14

The relational glue between contacts and organisations.

### Added
- **Add member to org** — popup dialog on the org detail page with a person picker (dropdown of unaffiliated workspace contacts), title, department, employment type, influence, started date, and four flags (Primary / Decision maker / Budget holder / Champion). Writes to `org_membership`.
- **End membership** — inline button on each member row, opens a confirm dialog and stamps `ended_at` (soft end — historical link preserved per brief §5.D3).
- **API:**
  - `POST /api/v1/organisations/:id/members`
  - `POST /api/v1/organisations/members/:membership_id/end`

## [0.3.0] — 2026-05-14

Contact-graph deepening — the four profile sub-resources from brief §5.D2 are now editable in the UI.

### Added
- **Tabbed contact detail** — `/contacts/[id]` now has a shared layout (breadcrumb + header + tabs) with five tabs: Overview, Professional, Relationship, Change context, Learning. Each tab is its own route segment.
- **Professional** tab — title, department, seniority, sector, expertise areas, industries, years of experience, career stage, independent flag, certifications, events spoken at.
- **Relationship** tab — source, source detail, introduced by, strength, communication preference, best time, key-contact flag, ambassador flag, first contact at, first contact notes.
- **Change context** tab — role in change, stance, readiness, leadership style, change themes, blockers, motivators, current challenge, **facilitator notes** (flagged Sensitive per brief §5.D2; stamps `notes_updated_at` + `notes_updated_by` server-side).
- **Learning** tab — interests, prior programmes, learning style, group role tendency, open-to-coaching / peer-exchange, development goals, **post-programme reflection** (flagged Participant-owned per brief §5.D2).
- **API:** GET + PATCH endpoints per tab (`/persons/:id/{professional|relationship|change|learning}`). Shared `upsertProfile` helper. Strict Zod schemas covering every enum from the brief.
- **UI primitive:** `TabNav` in `components/ui/tabs.tsx`.

### How this got built
Four parallel sub-agents implemented one tab each, owning isolated folders. ~2.5 minutes total wall-clock for all four agents. Foundation (tab layout, stubs, API endpoints) was built sequentially first; then web-only tabs in parallel with no file overlap.

## [0.2.3] — 2026-05-13

### Added
- **Settings page** (`/settings`):
  - **Profile** form (full name, avatar URL) using the design-system primitives
  - Read-only details: email (managed by provider), sign-in method, last sign-in
  - **Workspace** card (name, slug, plan, created date) — multi-workspace switching noted as roadmap
  - **App access** list per `app_membership` with role
  - Link back to `/privacy`
- **API:**
  - `PATCH /api/v1/auth/me` — update own profile (full_name, avatar_url)
  - `GET /api/v1/auth/me` now also returns the workspace and `primary_auth_method` / `last_sign_in`

## [0.2.2] — 2026-05-13

### Added
- **Privacy page** (`/privacy`) — three sections:
  - **Active consents** with per-purpose Revoke buttons (only for `consent` legal basis; contract / legitimate_interest are noted but not revokable)
  - **Data subject requests** with status (Article 15/17)
  - **Actions** — Export (placeholder, Article 15 coming soon) + Request erasure dialog (Article 17 self-service)
- **API:**
  - `GET /api/v1/privacy/consent` — list the caller's own consent records
  - `GET /api/v1/privacy/requests` — list the caller's own data subject requests
  - `POST /api/v1/privacy/erasure-request` — `person_id` is now optional; defaults to the caller's own person (self-service)

## [0.2.1] — 2026-05-13

### Added
- **Edit / delete on organisations** — same Dialog + ConfirmDialog pattern as contacts
- **API:** `PATCH /api/v1/organisations/:id`, `DELETE /api/v1/organisations/:id` (soft delete)

## [0.2.0] — 2026-05-13

Design-system milestone. Single source of truth for buttons, fields, dialogs, list rows, and page chrome.

### Added
- **Edit / delete on contacts** — Pencil opens an Edit dialog (popup); Trash opens a Confirm dialog and soft-deletes via the API.
- **API:** `PATCH /api/v1/persons/:id` (partial update with strict Zod schema), `DELETE /api/v1/persons/:id` (soft delete via `deleted_at`).
- **UI primitives** under `components/ui/`:
  - `Button` + `ButtonLink` with variants (primary / secondary / ghost / danger), sizes, leading icon
  - `TextField`, `SelectField`, `TextAreaField` — single label/input/errors shell
  - `Dialog`, `ConfirmDialog` — popup pattern with Esc-to-close, click-outside-to-close, body-scroll lock
  - `PageContainer`, `PageHeader`, `Breadcrumb`, `SectionLabel`, `EmptyState`, `ErrorBanner`
  - `ListGroup` + `ListRow` — the repeated list pattern

### Changed
- All existing pages (dashboard, contacts list/detail/new, organisations list/detail/new) refactored onto the primitives. Tailwind class strings are no longer duplicated.
- Server actions for contacts unified under one `ActionResult` type with a shared error unwrapper.

### Note on history / undo
The 10-step undo idea is deferred — see conversation. Save / cancel / delete shipped first; history can layer in once we know which fields people actually change.

## [0.1.2] — 2026-05-12

### Added
- **Activity timeline** (`/activity`) — workspace-wide event log with type and app filters, cursor pagination
- **`fibre-platform` app slug** — the platform itself is now a registered app. Resolves the long-standing TODO of using `fibre-meet` as a placeholder.
- **`user_created` events** — written automatically when a person is created (in the API). Backfilled for existing users.
- API: `GET /api/v1/activities` now accepts either a UUID or a slug for `app_id` and joins the app name into responses

### Changed
- `lib/api.ts` `PLATFORM_APP_ID` switched from `fibre-meet` to `fibre-platform`
- `packages/shared` `APP_IDS` includes `fibre-platform`
- API middleware `VALID_APP_IDS` includes `fibre-platform`

## [0.1.1] — 2026-05-12

### Added
- **Organisations UI:** list with search (`/organisations`), detail page with members (`/organisations/[id]`), add-organisation form (`/organisations/new`)
- **Build tracking:** [CHANGELOG.md](./CHANGELOG.md) and [docs/build-plan.md](docs/build-plan.md) — version displayed in sidebar footer

## [0.1.0] — 2026-05-12

The end-to-end sign-in milestone. A real user can sign in with Google and land inside the app shell.

### Added
- **Auth:** Google OAuth via Supabase Auth. SSO match logic (`resolve_sso_identity`) creates platform `user` + `person` rows on first sign-in.
- **JWT claims:** custom access token hook injects `workspace_id` and `app_memberships` (slug array) into every JWT — required for RLS to work.
- **App shell:** sidebar with three modes (expanded / collapsed / expand-on-hover), top bar with avatar + user menu, theme switcher (light / dark / system) with cookie persistence and no-flash script.
- **Contacts UI:** list with search, person detail with activity timeline, add-person form via Server Action.
- **Schema:** identity + contact graph + RLS baseline; programme + enrolment + activity (append-only triggers); GDPR (consent_record, data_subject_request, retention_policy, processing_purpose).
- **API:** `/auth/me`, `/persons`, `/organisations`, `/activities`, `/programs`, `/privacy/consent`, `/privacy/erasure-request`, `/sso/resolve`.
- **Infrastructure:** Supabase project `the fibre` (West EU / Ireland), migrations tracked, deployed.

### Architecture
- Hard rule §13 holds: no personal data in Vercel. Every PII operation goes through the Hono API.
- Web pages under `app/(app)/` route group share one layout that enforces auth and renders the shell.

## [0.0.1] — 2026-05-12

Foundation.

### Added
- pnpm monorepo (`apps/web`, `apps/api`, `packages/shared`)
- Supabase project linked, region confirmed (West EU / Ireland)
- Phase 0 migration: identity, multi-tenancy, contact graph, RLS baseline
- Briefs saved under `docs/` (canonical project copy)
- GitHub remote: `findingthesoul/thefibre`
