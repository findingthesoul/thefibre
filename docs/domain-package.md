# The domain package: your own sender, your own web address

Spec, 2026-10-06. Sjoerd in the coordinator chat: "go domain package" —
"like one package… for enterprise". Background and the soul.com findings
that started it: `docs/soul-com-own-sender-and-domain.md`.

**Pricing, decided:** sending from your own address stays Pro and up
(`custom_sender_domain`, unchanged). Your own web address for the public
pages is a NEW key, `custom_domain`, Enterprise (`org`) only. One settings
page carries both: **Fibre → Settings → Your domain**, workspace admins,
plan-gated by the API (402 with the plan named, as every gate here).

## Part 1 — own sender (first)

**What the admin does.** Types the domain (`soul.com`), the sender address
(`office@soul.com`) and a reply-to. Saves. The page then shows the DNS
records to add, each with a copy button, and a **Check** button. Until the
domain is verified, mail keeps going out exactly as today: from the
platform address, with the workspace's name. Once verified, the typed
address takes effect on every send — nothing else to flip.

**What the API does.**

- `workspace_domain` table: `(id, workspace_id, kind 'email'|'web', host,
  provider 'resend'|'vercel', provider_id, status, records jsonb,
  verified_at, checked_at, created_at)`, unique `(kind, host)` so one
  domain belongs to one workspace. RLS on; service-role only (machine
  state, like `public_root_slug`); every read goes through the API.
- `POST /api/v1/workspace-domain/email {domain}` — admin, `can(…,
  'custom_sender_domain')`; calls Resend `POST /domains {name, region:
  'eu-west-1'}`; stores id, status and the `records` array Resend returns
  (type, name, value, priority, status per record). Resend's "domain has
  been registered already" (403 `validation_error`) is shown in plain words:
  *"This domain is already registered with our mail provider under another
  account. Ask us to move it: hello@…"* — that is soul.com's exact state
  (half-added to some Resend team).
- `POST /api/v1/workspace-domain/email/check` — Resend `POST
  /domains/:id/verify` (asynchronous: the domain goes `pending`), then `GET
  /domains/:id` and store the per-record statuses. The page shows each
  record green or not, and the domain's status.
- `DELETE /api/v1/workspace-domain/email` — Resend delete + row.
- `GET /api/v1/workspace-domain` — the row(s) for the settings page.
- `GET /api/v1/admin/email-domains` — super admin only: what the Resend
  account behind THIS stack's key holds (names + status, nothing else).
  This is how we learn whether staging's key is the same team as
  production's, and where soul.com currently sits, without a dashboard.
- **The gate on the send path.** `getWorkspaceBrand()` returns
  `fromAddress` only when a `workspace_domain` row of kind `email` is
  `verified` and matches the address's domain. The fallback in
  `lib/email/client.ts` stays as the second net. One exception, for the
  workspaces that typed an address BEFORE this page existed and were
  verified by hand in the Resend dashboard (festival-of-trust, the default
  workspace, soul.com on production): a workspace with NO domain row keeps
  the old behaviour — the address is tried, Resend decides. `POST
  /api/v1/admin/email-domains/adopt` (super admin) turns the provider's
  verified domains into rows for the workspaces sending from them; after
  that the one rule applies to everyone.
- **One sender helper.** `workspaceSender(workspaceId)` in
  `lib/workspace-brand.ts` returns `{fromName, fromAddress?, replyTo?}`;
  the five copies of that logic (Meet's `meetSender`, Thread's
  `threadEmailIdentity().sender`, `sendReceipt`, five spreads in
  membership.ts, `resolveAuthBrand`) call it. The audit (2026-10-06, 55
  send paths) found eight workspace mails that ignore the workspace sender —
  Thread certificates (2 sites) and the scheduled engagement messages,
  Thread session .ics invites, the two payment-link mails (Thread and
  Membership), Pulse's commitment invoice, and Membership's card-country
  alert — plus Meet overwriting the workspace reply-to with the host's
  address on thirteen sends. Those are fixed in their owners' lanes with a
  one-line call each, once the helper exists.

**Who does what.** The customer: three DNS records at their registrar
(`TXT resend._domainkey`, `MX send`, `TXT send`) and the fields on the page.
Nothing of theirs moves: their apex SPF, their mail provider's MX, their
website stay as they are, because Resend lives on the `send` subdomain. We:
nothing by hand — the API adds the domain and reads the verdict with the
server's Resend key. The admin never sees a key, a provider name is the
most they see.

**Staging first.** Staging has its own `RESEND_API_KEY`. The admin list
route says whether it is the same Resend team as production's. If it is
not, a domain verified for production is unverified on staging (one DKIM
selector per domain → one team at a time), and the staging test uses a
subdomain we own (`*.thefibre.tech`) rather than a customer's domain.

## Part 2 — own web address (after part 1)

Spec addendum, 2026-10-06, written against the code as it is (survey of the
public route trees, middleware, CORS and URL builders of Meet and Thread).

**What changes for a customer.** An Enterprise workspace admin opens
Settings → Your domain → *Your web address*, picks WHAT the address shows
(the booking pages of one Meet host or team, or the event pages of one
Thread owner — workspace, organiser or team), types the host
(`book.soul.com`), presses Register. The page shows one or two DNS
records — a `CNAME book.soul.com → cname.vercel-dns.com`, plus a `TXT
_vercel.soul.com` only when Vercel wants ownership of the apex proved (it
asks when the apex is already in another Vercel account) — each with a
Copy button, and a Check. Once Vercel says verified and the CNAME points
at it, `https://book.soul.com/` shows the owner's page and
`https://book.soul.com/<meeting-type>` the booking flow, with a
certificate from Vercel, no action from us. Until then nothing is
different anywhere. A workspace without `custom_domain` sees the sentence
and the plan link, as for the sender. Nothing is visible to visitors until
the host is verified.

**Old links keep working forever.** The customer host is an ADDITIONAL
door, never a move. `meet.thethread.app/<slug>/…` and
`app.thethread.app/{owner}/{thread}` keep serving exactly as today; the
rewrite only runs for requests that ARRIVE on a customer host. No
redirect from our hosts to theirs, ever — a link in a two-year-old mail is
a promise.

**How a customer host is served.** One Vercel project per app serves both
stacks (production on `main`, staging as the `staging` branch), so the
host is attached to `thefibre-meet` or `thefibre-thread` by name, with
`gitBranch: 'staging'` on the staging API. The app's `middleware.ts`
(session refresh today, no host logic) gains one step: when the request
host is not the app's own host (nor localhost nor a Vercel preview), it
asks the API `GET /api/v1/public/domains/resolve?host=…` (public, cached
60 s on both sides) and, for a verified row of this app, REWRITES the path
by prefixing the owner's root slug — `/` → `/{root}`, `/{x}` →
`/{root}/{x}` — unless the path already starts with `/{root}` (the apps'
own links are relative with the segment, `/${hostSlug}/${mtSlug}/…`, so a
second visit must not become `/{root}/{root}/…`). Reserved first segments
on a customer host — `/my`, `/auth`, `/sso`, `/dashboard`, `/invite`,
`/api`, `/_next` — are not rewritten: the signed-in and sign-in paths get a
307 to the app's canonical origin, because the session cookie lives on
`.thethread.app` and a sign-in on a foreign host would silently fail.
Unknown host → pass through (Vercel would not route it to us anyway).
The address bar shows `book.soul.com/soul/intro`; dropping the root
segment from the apps' own relative links on a tenant host is a later
polish, not a correctness issue.

**CORS.** The public booking flow, enrol form, coupon check and contact
form call the API from the BROWSER, and the allow-list in
`lib/cors-origins.ts` is a static set built at import. It gains a second,
dynamic check: verified web hosts from `workspace_domain`, refreshed every
60 s. Nothing else about CORS changes.

**Links in mail and redirects (the biggest piece).** Today every absolute
URL comes from `appUrl()`: Meet has 13 `meetAppUrl()` sites in
`routes/meet.ts` (Stripe success/cancel, poll, invite accept, request-
expired and approval mails, and the five `meetAppUrl` template fields that
fan out into cancel/reschedule/booking links), Thread has `threadAppUrl()`
in Stripe redirects, the certificate URL, the portal's `threadPublicUrl`,
the calendar feed and both payment-link modules. `publicOriginFor(app,
rootSlug)` — a verified customer host for that owner, else the app's own
origin — replaces every one, so a customer on `book.soul.com` gets mail
whose links say `book.soul.com`. A guard test fails the release on a bare
`meetAppUrl()`/`threadAppUrl()` in those files afterwards. Meet's chat
agreed to this on 2026-10-06 and will sequence its mail i18n after it.
Canonical `<link>` and OG URLs follow the same function.

**Who does what.** The customer: one CNAME (and the TXT if asked) at their
registrar, and the choice on the page. We: nothing by hand — the API
registers the host with the server's Vercel token (`VERCEL_API_TOKEN`,
team-scoped, plus `VERCEL_TEAM_ID`, on both Fly apps; Sjoerd's to set,
dark until then exactly like mail without `RESEND_API_KEY`). Vercel issues
and renews the certificate.

**Staging twin.** `fixture-book.thefibre.tech` CNAME → `cname.vercel-dns.com`
at TransIP (one record, Sjoerd's hands), registered through the staging
page for the e2e fixture workspace; the e2e walks the host and asserts the
owner page renders and the old `meet.thefibre.tech/<slug>` still does.
Nothing goes near production before that passes.

**Releases.**
1. `workspace_domain` gains `app` and `root_slug` (migration); the Vercel
   client (`lib/vercel-domains.ts`, token-injected, 9 unit cases);
   `POST/DELETE /workspace-domain/web`, `POST /web/check`, public
   `/public/domains/resolve`; the dynamic CORS check; the page's web
   section. Gate: `custom_domain`. — **v1.113.3, staging.**
2. The middleware step in Meet and Thread (`@thefibre/shared/tenant-host`:
   pass / 307 to canonical / rewrite under the root), the hourly Vercel
   re-check that demotes a host whose DNS moved, the CORS suffix-trap
   test. — **v1.113.4, staging.**
3. `publicOriginFor()` across every owner-rooted builder, with the guard
   test; Meet's chat told the exact lines first. `/bookings`, `/invite`,
   `/my`, `/checkin`, `/certificate` stay on our origin on purpose. —
   **v1.113.5, staging.**
4. The staging twin: `e2e/tenant-host.spec.ts` (skips, saying so, until
   `E2E_TENANT_HOST` names a registered host). Needs from Sjoerd:
   `VERCEL_API_TOKEN` + `VERCEL_TEAM_ID` on `thefibre-api-staging`, and
   `fixture-book.thefibre.tech CNAME cname.vercel-dns.com.` at TransIP;
   then the host is registered through the page for the `default`
   workspace's Meet host and the spec runs. Then Sjoerd decides on
   production.

Size unchanged: 4–6 working days.

## Releases (small, one at a time)

1. This spec + `custom_domain` key (PlanFeature, `/admin/plans` row,
   seeded `true` on `org`) — docs + a migration on the plan rows.
2. `workspace_domain` table, the Resend client, the routes, the gate in
   `getWorkspaceBrand`, `workspaceSender()`, unit tests — API deploy.
3. Settings → Your domain page (apps/web), hub entry, i18n.
4. The eight group-B mail paths → `workspaceSender()` / `senderOf()` (done
   2026-10-06: Thread certificates ×2, scheduled messages, .ics invites,
   both payment-link mails, Pulse's invoice, Membership's admin alert; the
   five inline copies collapsed). Meet's reply-to stays the host's, on
   purpose: the invitee talks to the host. The sign-in code
   (`auth-hook.ts`) keeps its own resolution — it chooses WHETHER a
   workspace fronts the mail, which is a different question.
5. Part 2.
