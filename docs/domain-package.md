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

`book.soul.com` for Meet, `events.soul.com` for Thread, public pages only;
signing in stays on our hosts. Same table (`kind 'web'`, provider
`vercel`). The API adds the host to the right Vercel project (`POST
/v10/projects/{id}/domains`), stores the CNAME target Vercel answers with
(and the TXT when Vercel wants ownership proved), the page shows it with a
copy button and a Check. Then: a host → workspace lookup in the Meet and
Thread middleware (cached), rewriting `/` and `/{thread}` to the owner's
paths; `publicOriginFor(workspace)` in every URL builder — mail, iCal
feeds, payment-link redirects, Stripe success URLs, OG tags, embeds — so a
link in a customer's mail carries the customer's host; the CORS allow-list
learns verified tenant hosts; a staging twin; the smoke test. Size 4–6
working days; the plan-key work and the table are done in part 1.

## Releases (small, one at a time)

1. This spec + `custom_domain` key (PlanFeature, `/admin/plans` row,
   seeded `true` on `org`) — docs + a migration on the plan rows.
2. `workspace_domain` table, the Resend client, the routes, the gate in
   `getWorkspaceBrand`, `workspaceSender()`, unit tests — API deploy.
3. Settings → Your domain page (apps/web), hub entry, i18n.
4. The eight group-B mail paths and Meet's reply-to, with the owners.
5. Part 2.
