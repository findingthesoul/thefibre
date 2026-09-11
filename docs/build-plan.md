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

_Last groomed 2026-09-11 (v0.69.8). Done items get removed, not ticked._

**DESIGN — the site designer, and templates that are documents.** Sjoerd,
   2026-09-11, when the three themes shipped: *"In the future I want to
   expand the design parts (think about the drag and drop of the certificates
   for an vert chique design tool) ... but for now a basic structure to use
   templates. Later we will make templates."*

   What exists after v0.69.4–0.69.8: four themes, which are CODE, reading a
   fixed set of ingredients on `thread_settings` (logo, header image,
   headline, intro, navbar links, footer, contact). A workspace picks a theme
   in Settings → Website. That is deliberately the whole of it — no page
   layout is stored anywhere.

   What "templates" would add is the other axis: a stored DOCUMENT describing
   an arrangement, the way `thread_certificate_template` stores an element
   list the builder drags around. The certificate builder is the working
   precedent for the interaction AND for the trap — its autosave and its
   stuck-drag bug (v0.68.44–0.68.47) are what a second drag surface would
   inherit if it were forked rather than shared.

   Three questions to answer before any of it:
   - Does a site template belong to a workspace, or is it a library item a
     workspace copies — the way a thread template already works?
   - Does the designer place SECTIONS from a fixed vocabulary (hero, listing,
     text, contact), or free elements on a canvas? The certificate is free
     elements because a certificate is one fixed page; a website is not.
   - What happens to a site whose theme is code when its workspace later
     saves a template? A theme has to stay the fallback, or every existing
     page becomes an unmaintained document.

   Cheap next step if the appetite is for more designs rather than a
   designer: a theme is now one entry in `THEMES` plus one renderer in
   `apps/thread/app/[organiserSlug]/themes.tsx` and one option in the
   editor's card list. A fourth and fifth design cost an afternoon each and
   need no schema at all.

**DESIGN — the workspace is invisible in the URL.** Sjoerd, 2026-09-10,
   looking at `membership.thefibre.tech/tiers`: "URL change for workspace
   would be nice." Every admin URL in every app is workspace-less. You cannot
   tell from a link which workspace it opens, you cannot bookmark one that
   reliably opens the right one, and you cannot send a colleague a link to a
   page in a workspace you both belong to.

   **Why it is not a routing change.** The active workspace is not a URL
   concept at all today: it lives in `user_active_workspace`, is stamped into
   the ACCESS TOKEN by the auth hook, and every RLS policy reads the token
   rather than the request. Switching is two ordered steps — record the
   choice, then let the browser refresh its token. So a workspace segment in
   the path could not scope anything by itself; it could only ask for a
   switch, and then the page has to wait for a new token before it can render
   a single row.

   **And the choice is per ACCOUNT, not per app or per tab** (see the header
   of `lib/workspace-actions.ts`). That is the hard part and the reason this
   is a design item rather than a task. Two tabs on two workspaces is the
   thing people will expect the moment the workspace is in the URL, and today
   the second tab's next token silently flips the first. Putting the
   workspace in the path without addressing that builds a URL that lies.

   Three levels, increasing in cost:

   1. Show it, don't route it — the workspace slug in the path purely as a
      label, and a mismatch with the token offers a switch instead of
      rendering. Cheap, honest, fixes "which workspace is this link".
   2. Route it — the segment drives the switch on navigation. Needs a token
      refresh in the middle of a page load, and a clear story for a person
      who has no access to that workspace.
   3. Per-tab workspaces — the real prize and a different system: the
      workspace stops being one row per account and becomes part of the
      request, which means every RLS policy that reads the token has to
      change. Not a URL feature.

   Worth noting the public side already does this properly: `/{owner}/{thread}`
   carries its owner and needs no session at all. The asymmetry is what makes
   the admin side feel wrong.

**DESIGN — online check-in: the Join button should BE the check-in.**
   Sjoerd, 2026-09-11: "think about an online check-in… how can that be done
   quickly?" Check-in today assumes a door — a QR held up, or a name ticked
   off a list. An online session has neither, and an organiser watching a
   video call has no way to record who came without typing names twice.

   **The answer already exists and nobody is using it.** The visitor portal
   renders a **Join** button on an agenda item carrying `meeting_url`
   (apps/my/app/detail.tsx). That is the click a participant makes ANYWAY.
   Route it through a check-in stamp and attendance records itself: zero
   effort for the participant, zero for the organiser, and the door list
   fills as people arrive exactly as it does at a physical one.

   Shape: `POST /checkin/self` (or a redirect through `/join/:code`) that
   stamps `checked_in_at` for the caller's own enrolment and 302s to the
   meeting URL. Authorisation is the participant's own portal session, so it
   grants nothing they did not already have — this is the one check-in a
   person may legitimately perform on themselves.

   **The honest caveat, which is a product decision not a bug:** clicking
   Join proves somebody opened the room, not that they stayed. For a
   certificate that follows completion, that distinction may matter. Options,
   in increasing cost: accept it and say so in the UI; only stamp within a
   window around the session's start; or read real attendance from the
   provider (Zoom and Teams both report it), which is a per-provider
   integration and a different order of work.

   Cheaper adjacent win, same screen: the workspace door's "Everyone today"
   tab could offer multi-select and a "check in selected" for the organiser
   who is looking at a video call roster and ticking names. That needs no new
   concepts at all — the selection pattern already exists on Enrolments.

**DESIGN — a venue has an address and nowhere to say anything else.**
   Noticed 2026-09-10 while making the map link work, recorded on Sjoerd's
   instruction because it had only ever existed in a chat message.

   An engagement carries `location` (one line of text), `location_url` (a map
   link, published since v0.68.62), `meeting_url` for the online case, and
   `description`. That is the whole vocabulary. Everything a person actually
   needs on the day — second floor, ring the bell, parking is behind the
   building, bring indoor shoes, lunch is included, the entrance is not the
   one the map pin shows — has to be written into the description or left
   out. So it competes with the invitation copy, and the same practical text
   gets retyped on every session of a series held in the same room.

   Two shapes, and they answer different questions:

   - A `location_notes` (or `practical_info`) text field beside the address,
     rendered under the venue on the public page and in the portal's agenda
     row. Small, obvious, and still retyped per session.
   - A VENUE as a thing in its own right — name, address, map link, practical
     notes, maybe a photo — that engagements point at. Solves the repetition
     and gives "the room we always use" a home, at the cost of a new table
     and a picker in the engagement editor.

   The second is the honest model for anyone running a series, and the first
   is a fifth of the work. Sjoerd's call which problem is real.

   Whichever wins, note the surfaces that must show it or it is invisible
   where it matters: the public thread page, the visitor portal's agenda row
   (people read that ON THE WAY), and the calendar file — `lib/ical.ts` puts
   `location` in the LOCATION property today, and practical notes belong in
   DESCRIPTION rather than appended to the address.

**0. Public root slugs — the one that is now guarded, and the one that is
   not.** `public_root_slug` (v0.68.37) makes the app.thethread.app/{owner}
   namespace unique across workspaces, teams and organisers, so the second
   claimant is refused instead of 404ing both. Meet's own root
   (meet.thethread.app/{host|team}) is STILL only unique per workspace via
   `meet_root_slug` — the same silent double-404 is available there and
   nobody has hit it yet. Sjoerd's alternative, putting the (globally
   unique) workspace slug in front of every public path, is still on the
   table and would make both impossible structurally; the reason it was not
   done today is that existing workspace slugs were never designed to be
   read by a visitor (`default`, `de-werkhaven-9npq`, `testers-inc-fgol`)
   and every live URL would change. Decide the grammar before Thread embeds
   are widely live.

   **Two API builders know only two of the three owner kinds.** `ownerKind`
   is organiser | team | workspace, and the web builder branches on all
   three, but `ownerSlugOf` (routes/thread.ts) and `threadPublicUrl`
   (routes/portal.ts) both collapse it to `team?.slug ?? organiserSlug`. A
   workspace-scoped thread stores team_id NULL by design (D1), so both emit
   the ORGANISER address where the canonical one is the workspace's. Not a
   broken link — D2 makes the organiser form a valid second door, and the
   one published workspace-scoped thread in prod answers 200 under both —
   so this is canonicality, not reachability. Changing it changes the value
   of a published field, hence Sjoerd's call.

   **And the fixture that verifies this proves one owner kind, not three.**
   The staging portal fixture is organiser-scoped, so the green it produced
   on 2026-09-09 said nothing about team- or workspace-scoped threads.
   Anyone re-verifying a URL builder wants one seeded thread per owner kind
   or the result covers a third of the surface.

   **Moving a thread between owners silently kills its old public URL.**
   Sjoerd, 2026-09-09, after doing it to himself: a thread re-scoped from
   personal to a team moved from `/{organiser}/{thread}` to
   `/{team}/{thread}`, and the old address 404s with no redirect. Anyone
   holding the previous link — an email, a Webflow embed, a WhatsApp
   message — hits a dead page, and nothing tells the organiser that
   happened. Same class covers renaming the thread's own slug, and renaming
   an organiser, team or workspace slug: every one of those rewrites a live
   public address.

   His call on the shape, and it is the right one: a REDIRECT from the old
   address, not keeping both live. Two live addresses for one thread splits
   analytics, confuses the canonical tag and doubles the surface D2 already
   made subtle.

   Sketch, not a decision: an alias row per retired address —
   (owner_segment, thread_slug) → thread_id, written by the same triggers or
   route code that changes any of those four slugs. `resolvePublicOwner`
   plus the thread lookup already miss cleanly, so the alias table is a
   fallback consulted only on a 404, which keeps the happy path untouched.
   Three things need deciding before building it: how long an alias lives; what
   happens when a NEW thread legitimately claims a retired address (the live
   one must win, so the alias is checked last and pruned on conflict); and
   whether a 301 or a 302 — 301 is right for a permanent move but is cached
   by browsers essentially forever, which is unforgiving if someone moves a
   thread back.

**0b. Relative triggers cannot say "on the same day."** Sjoerd, 2026-09-10,
   looking at a certificate element set to fire relative to the thread's end.
   `TRIGGER_DAY_OPTIONS` (engagements.tsx) starts at 1, so the nearest you
   can get to "the day it finishes" is one day after. The API already accepts
   it — `trigger_offset_days` is `int().min(-365).max(365)` and the scheduler
   adds it straight to the anchor date, so zero means the anchor day itself
   and needs no server change.

   The wrinkle that makes it more than adding '0' to an array: the form pairs
   Days with a Direction, and zero before equals zero after. A "0 day(s)"
   entry would leave a live control that changes nothing, which is the same
   class of thing as the switch that stored a value the resolver ignored.
   Better shape: one option reading "on the day" that hides Direction while
   selected, and writes `trigger_offset_days: 0`. Reading an existing 0 back
   has to select it too, since `defaultDirection` currently derives from the
   sign and 0 is not negative.

   Applies to every relative trigger, so messages get it as well as
   certificates — and "the day it ends" is the obvious setting for a
   certificate, which is how it was noticed.

**0c. The two certificate doors do not agree about who is excluded.**
   Sjoerd, 2026-09-10, chose "the list becomes the decision": completing
   somebody no longer issues their certificate, and issuing is an explicit
   act. Two doors do it — the participant list on Enrolments (tick, untick,
   issue) and the `certificate` timeline element (issues on a date).

   Unticking somebody in the list means "not in this batch". Nothing persists
   it. So a dated element firing next week issues to them anyway, because its
   rule is "completed and no certificate yet" and the exclusion left no trace.
   A facilitator who deliberately withheld one would not find out.

   What it wants is a per-enrolment exclusion — `thread_enrolment
   .certificate_excluded`, or a nullable decision column if "not yet decided"
   should read differently from "no" — set when you untick and issue, honoured
   by both doors and by the bulk button. The open question is the
   interaction, not the column: a checkbox list is a transient selection UI,
   and making one of its states permanent needs to look permanent, or people
   will exclude somebody by accident and never see it again.

   Until then the honest reading is: the list decides THIS batch, the element
   decides everyone completed. Both the element's on-screen hint and the
   comment on `issueDueCertificates` say so.

**0a. Testing roadmap (docs/testing-approach.md + handbook §11).** Phase 0
   DONE, Phase 2 started (v0.53.0: pnpm verify gate, 30 unit tests,
   smoke-prod). Phase 1 DONE (CI installed — SSH
   pushes need no workflow scope; ci.yml per push + nightly-contracts.yml
   daily smoke). Money extractions DONE v0.54.0 (computeFeeCents,
   seatItemAction, archived-cache, embed-loader). Integration pack
   STARTED v0.55.0 (`pnpm test:integration` vs staging: RLS anon-floor
   ×14 tables, recordPurchase idempotency, sso_handoff race;
   vercel-ignore extracted+tested). Playwright STARTED v0.56.0
   (`pnpm test:e2e`: 6 golden paths green incl. SIGNED-IN Meet dashboard
   via a minted /sso/land code — the hop machinery is the E2E session
   fixture). Remaining: two-user cross-workspace RLS matrix (auth-fixture
   harness), scheduler-transition tests, remaining golden paths (Stripe
   test-checkout enrol, /my) needing a public staging thread fixture;
   OPTIONAL (Sjoerd): repo Actions secrets to let nightly run
   verify-public-api too.
   ~~Hook email-case finding~~ FIXED v0.57.2 (migration 20260907190000,
   lower() both sides; red-then-green regression hook-case.int.test.ts).

**0b. Meet ↔ Suite parity (docs/meet-vs-suite-parity.md).** Five of the ten
   Suite-only features SHIPPED v0.59.0: Zoom, reschedule, round-robin
   fairness, per-team availability, .ics — plus reimburse-from-a-booking via
   the shared refund dialog. Remaining, in the order they'd be missed:
   - **Zoom Marketplace app** (Sjoerd, gating): create it and
     `fly secrets set ZOOM_CLIENT_ID ZOOM_CLIENT_SECRET` — steps in
     docs/deploy.md § Zoom. Until then Zoom stays unselectable everywhere.
   - **Branding on public booking pages** — `workspace_brand` exists; Meet's
     public pages don't read it.
   - **Retry-finalize** for a paid booking whose calendar/email step failed
     (Suite had it in admin; refund is already covered).
   - **PWA** (manifest, service worker, installable) — Meet is responsive
     but not installable.
   - **Dirty-nav guard / sticky SaveBar** — Suite warned before leaving a
     dirty form.
   Onboarding + tour is NOT tracked here: it's docs/onboarding-proposal.md
   (per-app emergent checklist), being built alongside the landing pages.

**0c. Visitor portal (docs/visitor-portal-proposal.md).** The participant's
   own place: tickets, threads (agenda + links), meets and memberships for
   one person, grouped by organiser workspace. Decisions D1-D3 taken
   2026-09-08 (third sanctioned data-wall crossing / own surface / group by
   workspace). **API SHIPPED v0.68.15** — GET /api/v1/me/portal, live on Fly
   prod + staging, 8 unit tests, no client calling it yet. branding.ts
   SURFACES registry + CORS derivation landed v0.68.13. Remaining:
   - ~~**Sjoerd:** TransIP records + an eighth Vercel project~~ **done
     2026-09-09.** Both zones have records (thethread.app an A record,
     thefibre.tech a CNAME — the target is ACCOUNT-scoped, all six .tech
     subdomains share it), the `thefibre-my` project exists, both domains
     are attached and verified, and env is set and machine-verified on both
     scopes.
   - ~~**The surface itself** (apps/my, dev port 3007)~~ **shipped v0.68.20**,
     first real deploy v0.68.24 — read-only portal. The visitor's own ticket
     QR is in it; it previously existed only in the enrolment email.
   - **Sjoerd, still open:** flip `ssoProtection` to `null` on `thefibre-my`
     to match the six product apps. It currently carries Vercel Standard
     Protection (`all_except_custom_domains`), so `my.thefibre.tech` — bound
     to the `staging` branch, hence a Preview — redirects to Vercel's SSO
     instead of serving. Production is unaffected. Security setting, his call.
   - **Detail popup SHIPPED v0.68.28** — tapping an item opens agenda, QR,
     both wallet buttons (shown only when `portal.wallet.{apple,google}`,
     both false until the credentials exist) and per-agenda-item
     add-to-calendar (`/ics/:threadId/:itemId`, served by the portal because
     a calendar link cannot carry a bearer token). `lib/ical.ts` lifted to
     `@thefibre/shared/ical` with an API re-export shim.
   - **STILL TO BUILD from the same slice**: "email it to me" (needs a
     visitor-facing resend endpoint + template + rate limiting — the portal
     exists because the ticket lives in an email, so this is arguably the
     highest-value button left) and RSVP (below, decision not taken).
   - **Original slice as specified by Sjoerd 2026-09-09.** The portal
     is a LIST; tapping an item opens a detail popup carrying: the agenda,
     the ticket QR, **Add to wallet**, **Email it to me**, **Add to
     calendar**, and **RSVP** where applicable. What already exists, so none
     of it is built from scratch: the portal API already returns
     `agenda[]` per thread (title, description, type, times, location,
     meeting_url, external_url) and tickets with `checkin_code`; the QR and
     BOTH wallet passes are already served by Thread at
     `/api/v1/thread/public/checkin/:code/{qr.png,apple.pkpass,google}`, so
     the portal can link them directly with NO API change (wallet stays inert
     until the Apple/Google credentials exist). Genuinely missing: an `.ics`
     for a thread or agenda item — `lib/ical.ts` (`buildBookingIcal`) exists
     but is Meet-only, with the one endpoint at
     `meet/public/bookings/:id/calendar.ics`; a thread variant is an
     extension of that, not new work. And RSVP, which has NO model anywhere
     (`grep -i rsvp` finds only an `RSVP=FALSE` string in ical.ts).
   - **RSVP participant half SHIPPED v0.68.30.** Sjoerd decided the shape
     2026-09-09: workspace default (on), overridable per thread. Two-level
     switch inheriting by NULL; `thread_rsvp` holds THREE states (a missing
     row is "no answer", never collapsed into a boolean);
     `PUT /me/portal/rsvp` checks enrolment + that the thread is asking;
     portal control posts via its own `/api/rsvp` so the browser holds no
     token. **NEXT: the organiser half — a switch in The Thread's settings
     and per-thread screen (new i18n keys ×6 locales) and a view of who
     answered.** The API already accepts both fields, so it is UI work.
     Still undecided by Sjoerd: what silence MEANS (the recommendation was
     to let it follow whether an item is included or optional). Capacity
     arrives with RSVP whether or not it is built — the record is shaped so
     adding it is not a migration.
   - **RSVP — the original design conversation, 2026-09-09.**
     Sjoerd asked whether RSVP defaults to on per event, or is a thread-level
     setting. Recommendation given: those are two different questions and
     they compose. (a) Organiser side — put the switch on the AGENDA ITEM,
     defaulted from a thread-level default, because a thread mixes assumed
     attendance with genuinely optional items. (b) Participant side — the
     default should follow the item rather than be a preference: an item
     INCLUDED in what you enrolled in defaults to "coming" and the control is
     really "I can't make this one" (opt-out); an OPTIONAL item defaults to
     no/unknown and the control is opt-in. So the organiser never picks a
     default, they mark the item included or optional, which they already
     know. Store THREE states (coming / not coming / no answer), because
     forty declines and forty non-replies are different facts and a caterer
     needs to tell them apart. Capacity arrives with RSVP whether or not it
     is built — shape the record so adding it later is not a migration. An
     RSVP fits the activity log naturally: append-only, corrections as new
     rows.
   - **Organiser path: enrolment → user → invoice does NOT exist** (Sjoerd's
     model, 2026-09-09: member/visitor → `my`; organiser/workspace → the app,
     then via Invoices *or* via enrolments). Nothing links an enrolment to
     its ledger row — "invoice" appears in none of Thread's enrolment
     surfaces (registration.tsx, registrations-dialog.tsx, threads/[id]).
     The join already exists (`purchase.item_ref` + upsert on
     `app_id, item_ref`), so this is surfacing, not modelling.
   - **The Invoices page never says it is workspace-scoped**, which reads as
     data loss. `public."user"` is per workspace (`unique (workspace_id,
     email)`), so one human is several user rows; `scope=me` filters
     `organiser_user_id = ctx.userId`, the workspace-resolved one. Sjoerd has
     three rows and hit this on 2026-09-09 ("I don't see my invoices
     anymore"). Nothing is lost and the filter is correct — the screen is
     just silent about it. Contrast worth keeping: the organiser side keys on
     the workspace-scoped user ("what I sold, here"), the visitor side on the
     verified email across all workspaces ("what I bought, anywhere"). That
     difference is the clearest justification for `my` existing at all.
   - **D4 — PWA.** Recommended thin (manifest, icons, service worker
     caching the shell + the visitor's own tickets) and only AFTER the
     wallet passes; NOT an offline-first rewrite. iOS installs manually, so
     budget a visible hint; iOS push only works post-install. Offline
     check-in deferred: two volunteers, two phones, one guest needs real
     conflict handling.
   - **D5 — the door capability.** The scanner shipped in v0.68.6 and is
     good, but it sits under `(app)` and needs workspace membership, so a
     volunteer on the door for one evening would need permanent authority
     over the whole workspace. Proposal: a per-thread expiring door link,
     same capability pattern as checkin_code.
   - **Wallet passes** (coded, inert): blocked on an Apple Pass Type ID
     certificate and a Google Wallet issuer account — Sjoerd only.
   - ~~Not read by the portal: the purchase ledger~~ **it is now.**
     `GET /api/v1/me/invoices` + `/me/invoices/:id/pdf` (v0.68.61) answer
     for EVERY app, dual-keyed, replacing the membership-only endpoint that
     left thread tickets and meet bookings unreachable.

   **THE CONSOLIDATION — `docs/member-portal-plan.md`, slices 1-5 SHIPPED
   2026-09-10.** Sjoerd: "why are there two my. environments. As a user, I
   want 1 environment for everything." Four destinations on
   my.thethread.app — Next / Memberships / Purchases / You — bottom tabs
   below `md`, a local rail above (`ui/sidebar-shell` is organiser chrome
   and a member has none of it). Next is a date-ordered timeline; a thread
   with dated sessions contributes its SESSIONS, not itself. Memberships
   says what it includes with resolved links, plus Manage payment. You is
   editable: a name writes every `person` row on the verified email, a
   language writes `identity_profile.locale`. Portal VERSION 0.5.0.

   Remaining on the plan:
   - **Slice 6 — retire the other two `/my` pages.** NOT YET, and the plan
     says why: not before parity, and not before somebody has watched this
     surface render a REAL membership. `membership.thethread.app/my` is at
     parity now; Thread's `/my` still has an activity trail the portal has
     no equivalent for (thread session's lane).
   - **Slice 7 — participants and documents on a thread**, consent-gated,
     reusing `share_participants_participants`. Deferred on purpose until
     the shape has been used.
   - **BLOCKING BOTH, and it is one sentence from Sjoerd:** the staging
     fixture (`portal-verify@thefibre.tech`) has no membership and no
     invoice, so the two tabs that matter most have been driven only in
     their EMPTY state. Seeding one was refused by RLS and two sessions have
     now declined to force it with the service key, because the standing
     authorisation covered "a test visitor and a seeded thread", not
     memberships.

**0. Domain migration aftercare (v0.48.0 hop + v0.52.0 flip are LIVE;
   hard cut EXECUTED 2026-09-07).**
   The five delivery apps live on *.thethread.app (Thread = app.); fibre web
   stays on thefibre.app; sessions cross via /sso/hop. The old
   *.thefibre.app app subdomains are detached (404) and the transitional
   CORS_ORIGINS secret is removed — Sjoerd confirmed all affected data was
   test data, so no payment-link resends were needed. Remaining:
   - **TransIP cosmetic cleanup** (Sjoerd, no rush): the five stale
     meet/thread/flow/pulse/membership records in the thefibre.app DNS
     zone now point at a 404 — delete them whenever convenient.
   - **Decommission old Thread V3** (separate repo ~/Projects/thethread-v3,
     Vercel project thethread-v3) — largely DONE 2026-09-07 (29e9d49; webhook deletion attempted by
     session 2026-09-07 — test-mode endpoint we_1TGYovCfSrP60NN3IhrUHMI5
     found, deletion blocked by permission classifier, ONE dashboard click
     for Sjoerd; check live mode too):
     5-min cron REMOVED; middleware neutered (it session-refreshed against
     the dead V3 backend and 504'd every uncached request the moment a
     redeploy emptied the edge cache — the landing "worked" for 22 days on
     cache alone); /login + /signup redirect to app.thethread.app,
     /pricing to thefibre.app/pricing. The APEX LANDING (all-static now)
     KEEPS SERVING until the website rework. Remaining: delete the V3
     Stripe webhook (https://thethread.app/api/webhooks/stripe) in the
     Stripe dashboard — Sjoerd.
   - **thethread.app website rework** — LIVE ON THE APEX (cut executed
     2026-09-08, v0.67.x). The design round happened live with Sjoerd
     (v0.60.0–v0.67.0): his real paper-cut PNGs (public/shapes/),
     scroll-scrubbed collages with physical easing, one fallen-thread
     line hero→footer, per-card coloured scroll cues, moment-vs-journey
     card, problem/solution pairs on /workshop, serious dark footer
     (legal + stack + Fibre + safe-data commitment), Start-a-Thread
     POPUP posting to /api/v1/signup-requests (no more thefibre.app
     hop). Sjoerd approved ("already better than what we have now") and
     moved apex + www to the thefibre-website project himself (Vercel
     dashboard; DNS untouched — same account). smoke-prod now asserts
     the new apex (title + fabric line, /pricing 200, /login →
     app.thethread.app). Remaining: archive the thethread-v3 Vercel
     project (after Sjoerd's V3 Stripe-webhook delete); OPTIONAL TransIP
     apex A 76.76.21.21 → 216.150.1.1 (Vercel's new IP; legacy keeps
     working). Act 2 queued: scissors hero, photography pass (consent),
     thread-as-nav-progress, e2e/website.spec.ts five-route walk.
   - **Email sending domain**: platform mail still sends from
     @thefibre.app. The OLD Resend account has thethread.app verified
     (hello@/certificates@) — reconcile, don't duplicate, if/when app mail
     should come from @thethread.app.
   - Real cross-apex E2E of the hop is now live-testable (thefibre.app ↔
     app.thethread.app); exercise the full v0.48.0 test matrix.

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
   in the Stripe dashboard. ~~First real charge unrehearsed~~ REHEARSED 2026-09-07 on staging:
   €350 join (Community member + €50 optional product) through real
   Stripe sandbox checkout → webhook → ACTIVE member + correct ledger
   rows verified server-side. The flow is proven; first LIVE charge is
   just a customer now.
1e. **Event template library (Thread)** — CONTENT-DONE 2026-09-08
   (v0.67.1): lib/thread-template-library.ts ships 5 blueprints (Single
   event, Two-day event, Guided event, Workshop series, Conversation
   circle); GET /thread/template-library is plan-sliced by
   thread_template_limit (1 / 5 / ∞); POST /threads seeds a chosen
   blueprint; engagement add/remove 403s without thread_custom_templates
   (Free configures but never restructures); new-thread picker +
   zero-threads first-event hero live in Thread. Website /pricing carries
   the ready-made-shapes bullet (v0.67.3). Remaining tail: shared-template
   DESIGNER polish only, already behind Pro+.
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
1b. **App-API timezone validation** (found 2026-09-08 while chasing the
   editor crash, v0.68.16). The Festival of Trust planner PATCHes
   `timezone: "Athenes/Greece"` into thread 58a6a229 through
   `/api/v1/apps/fot-planner/thread/threads/:id`; PatchThread/CreateThread
   in app-thread.ts accept any string. Anything that formats that thread's
   times with Intl (door list, public page, emails) will throw exactly the
   way the editor did. NOT fixed yet on purpose: a 400 would stop the
   planner's sync landing its other fields. Do it as a pair — validate
   against `Intl.supportedValuesOf('timeZone')` in the API AND fix the
   planner's value (Sjoerd's other repo) in the same hour; repair the row
   to Europe/Athens.

2. **P4 — meters that bill** (proposal §4): ~~seat billing~~ (done 0.22.0 —
   quantity item on the subscription, prorated; invites past the allowance
   are charged, not refused). Remaining: email/storage overage lines on the
   monthly invoice, 80% warnings, the 13-month Free archive (warning email +
   export first). ~~Seat follow-ups~~ **SHIPPED v0.43.0**: member removal
   (DELETE, soft, next-period billing stop, resurrection on re-invite,
   last-admin guards) + invite cost confirm (402 w/ server-computed cost,
   explicit accept_seat_cost flag) + admin gate on POST/PATCH /members.
3. **P5 — website polish**: OG image (favicon shipped), screenshots,
   self-serve signup flip when the trial ends. Now under the naming brief
   (docs/naming-brief.md): Thread-first — NO per-app product pages (Meet /
   Sales / Flow are functions in Thread's service, never sibling products).
3a3. **SearchSelect enhancements (sweep 2026-09-05)**: async
   loadOptions (converges flow AddContactDialog + web person-combobox),
   label/hint prop, drop-up collision handling. Remaining bespoke
   comboboxes: web country/person-combobox, pulse cashflow combobox.
3b. **Thread asks (Sjoerd, 2026-09-05)**: (a) WORKSPACE-scoped threads —
   New-thread offers Personal/Team only; workspace scope touches the
   public-URL contract (organiser/team slugs are published), needs a
   design call (workspace slug as public face?). (b) Per-EVENT images
   inside a thread (cover_url exists thread-wide; events in the timeline
   have none). (c) Adopt shared SearchSelect for timezone pickers +
   converge the three comboboxes (inventory).
3c. **Mobile follow-ups** (bottom menu SHIPPED v0.45.0 to all six apps:
   shared ui/bottom-nav + dialog sheet mode + h-dvh layouts): the tail is
   per-screen polish on the operational surfaces (wide tables, dense
   toolbars) as Sjoerd's phone testing surfaces them. The BUILDERS
   (timeline editor, certificate designer, flow canvas) stay
   desktop-first by design — don't chase touch support there.
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
   **P2 SHIPPED same day** (split across the two parallel sessions):
   v0.43.0 — identity_profile.locale (NOT user_profile: that's a dead
   read-only fallback since the profile SPoT moved) + Settings → Profile
   language picker + thefibre.locale cookie in savePref + platform
   emails ×6 (platform-i18n.ts, exports platformEmailLocale — THE
   resolver for platform-side emails); v0.44.0/0.44.1 — all 8
   auth-templates ×6, auth hook resolves via platformEmailLocale.
   **P3 SHIPPED 2026-09-06** (Sjoerd overrode demand-driven: "P3 for all
   6 languages") in v0.50.0 + v0.51.0: ALL six apps' signed-in
   interfaces ×6 via per-app lib/i18n-ui.ts catalogs (~3,000 keys
   total), shared chrome via useLocale()/chromeT + chrome-server-i18n
   for the server-renderable hub/help, nav labels per-app, locale from
   the thefibre.locale cookie via each layout's LocaleProvider.
   Deliberately English: /admin/**, the about explainer, invoice legal
   documents, raw API errors (P4 never — unchanged). Standing rule: NEW
   user-facing strings always go through a catalog ×6 — never hardcode
   EN. MT burn-down: `grep -rn '// MT'` is the native-review list
   (NL: Sjoerd; known ES divergence Ajustes/Configuración; pt is BR —
   INTL_LOCALES.pt flipped to pt-BR to match).
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
   **2026-09-09 — first live invoiced member (v0.68.22).** Four defects
   fixed in code (invoice payment now settles the membership itself, in
   both the webhook and mark-paid; a manual add dates its own renewal;
   the overdue sweep skips renews_at <= started_at; `country` is back in
   MEMBER_SELECT; /no-access routes members to /my). Two things remain
   config, and both block soul.com going live this week:
   - **The Connect webhook still looks unregistered.** The EUR 1 test
     invoice for sjoerdluteyn@gmail.com holds a live `cs_live_…` session
     and is still `pending`. Register it (below), then Mark paid on the
     Invoices page to clear the stuck row — the new code activates the
     membership from there.
   - **Access grants are missing on soul.com's tiers.** The workspace has
     exactly ONE grant (kind `thread`, on the product "The Thread"), and
     that product is Off in the Community member tier. Joining currently
     unlocks nothing — the Circle community product carries no Circle
     grant.

   **Remaining — Sjoerd, not code:**
   - Stripe **Connect** webhook endpoint
     `https://thefibre-api.fly.dev/api/v1/membership/stripe-webhook`
     (checkout.session.completed, invoice.paid, invoice.payment_failed,
     customer.subscription.updated/deleted — MUST pick "listen on
     Connected accounts" AT CREATION, it can't be flipped later) →
     `fly secrets set STRIPE_MEMBERSHIP_WEBHOOK_SECRET`. Was mid-redo
     2026-09-05. Staging twin (test mode → thefibre-api-staging)
     recommended for the test-card rehearsal.
   - ~~Create the soul.com workspace~~ **LIVE 2026-09-07**: workspace
     986d1631 (slug `soul`, org plan comped), Membership active, tiers
     Community member EUR 300/yr + Soul Fellowship EUR 2000/yr, pricing
     rules ZA 75 / AO 50 / default 100, Google credential in place,
     Sjoerd super_admin. Join page serves at
     membership.thethread.app/soul. REMAINING (Sjoerd): Stripe account
     in Settings -> Payments; Circle token + access grants on the two
     products. Also queued from today: VAT incl/excl pricing setting
     (workspace-level toggle + per-org override; ties into org
     memberships and reverse-charge B2B); ~~enable iDEAL + SEPA DD in
     Stripe~~ DONE 2026-09-07 (live, connected-accounts config; Klarna
     off; v0.56.2 made all flows follow the dashboard config).
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

### Stripe Connect webhook — DONE 2026-09-05 (was THE revenue blocker)

Both membership webhook endpoints registered and verified end-to-end:
LIVE "the production API" + sandbox("staging") "membership-staging", both
Connected-accounts scope, 5 events, API 2026-04-22.dahlia. Secrets on
both Fly apps. Verified: forged calls get 400 bad-signature on both; a
REAL connected-account event (subscription create+cancel on a throwaway
acct, deleted after) delivered to staging and returned 200.

Learned along the way (Stripe housekeeping):
- There are TWO sandboxes: "staging" (the real twin — the staging API's
  key lives here) and "Solidarity Lab B.V." (accidental). During cleanup
  the STAGING sandbox's four destinations got deleted by mistake (the
  two look identical); all four were RECREATED via the API 2026-09-05
  (meet/billing/thread "Your account" + membership Connect, api_version
  pinned) and all four staging Fly secrets rotated to the new endpoints.
  Delivery re-verified with a real connected-account event (200).
- CHECK: the SL B.V. sandbox may still hold its four junk endpoints
  (meet/billing/thread → PROD api + a misplaced membership one) — if
  "no destinations left" referred to staging, delete the SL B.V. set
  too. Identify by the sandbox switcher label before deleting.
- "Accounts v1 support" feature flag is now ENABLED in the staging
  sandbox (needed for any account creation with the current integration;
  new Stripe accounts/sandboxes default to v2-only).
- The "Multiple capabilities paused — required task overdue" banner: if
  it shows in LIVE, complete the task or real charges may bounce.
- Staging test-card rehearsal DONE 2026-09-06: EUR 2,000 Soul Fellowship
  joined with the test card on a synthetic connected account
  (acct_1UCS0ELHO1HI5S0R, kept as a staging fixture wired to the
  'default' workspace) — webhook 200s, active member, paid ledger row.
  Flushed out + fixed: membership.thefibre.tech missing from staging
  CORS (secret updated; allowlist derived from the registry, v0.45.6).

### Google Workspace integration — SHIPPED v0.47.0 (2026-09-06)

'google_user' grant kind (suspend member's Google account on lapse,
unsuspend on rejoin — never create/delete) + Settings → Integrations
credential card. Credential walkthrough DONE 2026-09-07: service account
(project fibre-membership) + domain-wide delegation + Admin SDK API
enabled; verified end-to-end in BOTH envs (token mint + directory read
200). Staging credential on the 'default' workspace; PROD credential
parked on the default workspace — RE-ENTER it on the soul.com workspace
once that exists. Live suspend drill optional (needs a throwaway
Workspace user).

Queued next in the membership lane: OPTIONAL ADD-ON PRODUCTS on the
join page (Sjoerd 2026-09-06: tick-able product options — priced ones
raise the total, EUR-0 ones included if chosen; reuse the a-la-carte
purchase machinery so grants ride the existing journal).

## Outstanding for Sjoerd

- **Create the Zoom Marketplace app** and set `ZOOM_CLIENT_ID` /
  `ZOOM_CLIENT_SECRET` on Fly (docs/deploy.md § Zoom). Meet's Zoom support
  shipped in v0.59.0 and is inert until those exist.
- **Decide Meet ↔ Suite cutover** strategy (decided: hard swap, case-by-case for any slug breakage).
- **Add yourself as an org_membership** on Solidarity Lab B.V. via the UI so your own profile's Organisations section populates.

- **Staging's Stripe webhooks are registered against the wrong account.**
  Found by the overnight pass, 2026-09-12. Thread, Meet and Membership all
  take money on CONNECTED accounts, but all three staging endpoints listen on
  the platform's own account, and Meet's is also missing
  `payment_intent.payment_failed`. The mode is fixed at creation, so each has
  to be deleted and recreated, and the new signing secrets pushed to Fly.
  Recreating them without setting the secrets would leave staging payments
  worse off than they are now, which is why the pass left them alone. Until
  this is done a staging payment rehearsal cannot confirm.
  Check with: `FIBRE_ENV_FILE=.env.staging node scripts/verify-stripe-webhooks.mjs`

- **Decide how staging gets a published-contract fixture.** `verify-public-api.mjs`
  needs a thread that is public-listed, has an owner slug, and has a programme
  that is active or completed. Staging has none — its one listed thread,
  `single-event`, is still in draft. So the published contract is currently
  only verifiable against PRODUCTION, i.e. after it ships, which is backwards
  for a staging-first workflow. Moving that thread's programme to active would
  do it, but it lives in a real workspace so the call is yours. Do NOT reach
  for `seed-ebbf.mjs` here: on staging it targets the `default` workspace,
  which is the Stripe payment-rehearsal rig.

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
