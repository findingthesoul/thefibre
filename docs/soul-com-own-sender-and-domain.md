# soul.com: email from its own address, pages on its own domain

Research note, 2026-10-06, read-only. Sjoerd: "verify soul.com" — Meet and
Thread mail for the soul.com workspace should come FROM an `@soul.com`
address, as Suite did; then "maybe it can come with own URL?"; then "like
one package… for enterprise". This is the plan, in the order he would click
it. Nothing here has been changed: no DNS, no Resend, no Vercel, no rows.

## 0. What is true today (checked, not remembered)

**The workspace is already set up for it.** On PRODUCTION the `soul`
workspace has sender name `soul.com`, sender address `office@soul.com`,
reply-to `s@soul.com`, logo set (Fibre → Settings → Workspace; stored on
`workspace.email_from_*`, read by `getWorkspaceBrand`, used by `meetSender`
in `routes/meet.ts` and by Thread's sends). Its plan is `beta` (comped), and
`beta`, `pro` and `org` all have `custom_sender_domain = true`, so the gate
is not what stops it. Staging has no soul workspace at all.

**What stops it is Resend.** `lib/email/client.ts` sends from the address the
workspace typed; if Resend refuses it (domain not verified in the account
whose key is on Fly), it logs `[email] sender "office@soul.com" refused` and
re-sends from the platform address, keeping the name. That is exactly what
Sjoerd sees: "soul.com <hello@thethread.app>". (I could not catch the refusal
line itself: `fly logs --no-tail` only holds the last minutes and no soul
mail went out in them. The code path is unambiguous.)

**soul.com's DNS, public lookups.** Nameservers TransIP (`ns0.transip.net`
…). Mail is Google Workspace: five `aspmx…google.com` MX records; apex SPF
`v=spf1 include:_spf.google.com ~all`; DMARC `p=reject; adkim=r; aspf=r;
rua=dmarc@soul.com`. And three Resend-shaped leftovers:

| host | record | state |
|---|---|---|
| `resend._domainkey.soul.com` | TXT DKIM key `p=MIGf…CrHs…` | present |
| `send.soul.com` | MX 10 `feedback-smtp.eu-west-1.amazonses.com` | present |
| `send.soul.com` | TXT `v=spf1 include:amazonses.com ~all` | **MISSING** (checked at Google, Cloudflare and TransIP's own NS) |

So somebody once added the apex `soul.com` to a Resend account (EU region)
and stopped one record short; Resend will show it as not verified, and every
send from `@soul.com` is refused. Separately, `updates.soul.com` is FULLY
verified for Resend (DKIM + MX + SPF all present) — that is the sender the
Airtable-era Thread used (`~/Projects/the-thread`, default `EMAIL_FROM = The
Thread <hello@updates.soul.com>`). Suite v1 itself (`~/Projects/souls
calendar`) sent `"<host> via Soul Suite <EMAIL_FROM>"` from ONE env address
(`.env.example` suggests `noreply@soul.com`); it never sent from a customer's
own domain. So "Suite did this" means: Suite was soul.com's own tool, and its
one sender was a soul.com address. The platform has to do it per workspace.

**Which Resend account.** The platform API has `RESEND_API_KEY` + `EMAIL_FROM`
on both Fly apps (names only; I did not read values). `docs/meet-architecture.md`
says `thefibre.app` is DKIM-verified in that account; `docs/build-plan.md`
§"Email sending domain" says `thethread.app` (hello@, certificates@) is
verified in **the OLD Resend account** — "reconcile, don't duplicate". A
domain's DKIM lives at one selector (`resend._domainkey`), so soul.com can be
verified in ONE Resend team at a time. Whichever team holds the key in DNS is
the one that may send. Where that key came from is one dashboard look.

## 1. EMAIL — the clicks

1. **Open Resend → Domains** (resend.com/domains) in the account whose key is
   on `thefibre-api`. Look for `soul.com`.
   - **Listed, not verified** (most likely, given the DNS): open it, it shows
     the one missing record. At TransIP add `TXT send.soul.com` =
     `v=spf1 include:amazonses.com ~all`. Click Verify. Done — minutes, up to
     72 h worst case.
   - **Listed in the OLD account instead**: decide which account the platform
     uses (one, not two). Either put a key from that account on Fly, or add
     soul.com in the platform account and REPLACE the `resend._domainkey`
     value with the new one (plus the two `send.` records). Do not leave
     thethread.app's sending in one account and soul.com's in another.
   - **Not listed anywhere**: Add Domain → `soul.com` → region **EU (Ireland,
     eu-west-1)**, same as thethread.app and the existing MX. Three records
     at TransIP: `TXT resend._domainkey` (replace the stale value), `MX send`
     → `feedback-smtp.eu-west-1.amazonses.com` priority 10, `TXT send` →
     `v=spf1 include:amazonses.com ~all`.
2. **What NOT to touch, and why soul.com's own mail is safe.** Resend's SPF
   and MX sit on the `send` subdomain; the apex SPF stays exactly
   `v=spf1 include:_spf.google.com ~all` — never add a second `v=spf1` record
   and no `include:amazonses.com` is needed on the apex. Google's MX on the
   apex is untouched; an MX on `send.soul.com` affects only that name. DMARC
   `p=reject` keeps working: Resend signs with `d=soul.com`, which aligns
   (relaxed), and the Return-Path `send.soul.com` aligns too. Nothing in
   this plan can bounce Sjoerd's own Google mail.
3. **In our UI** nothing new is needed: Fibre → Settings → Workspace already
   holds name / sender address / reply-to. Keep `office@soul.com` as the
   sender, or `hello@soul.com` — once the domain is verified ANY mailbox at
   it may send, no per-address step. **hello@ vs sjoerd@:** the From address
   is where a reply lands unless a reply-to is set. Sender `office@` or
   `hello@` with reply-to `s@soul.com` (the current setting) means mail looks
   like it comes from the organisation and replies reach Sjoerd personally;
   sender `sjoerd@` would put every bounce-notice and every reply in his own
   inbox under his own name. Recommendation: keep the shared address as
   sender, use reply-to for the person.
4. **Test on STAGING first.** Staging has its own `RESEND_API_KEY`; if it is
   a different Resend team, soul.com is unverified THERE and the test proves
   nothing — check which team, or test on production with one real booking
   (it is a read of the inbox, not a write to data). The staging test:
   create the soul workspace on staging (or use `e2e-fixtures`), set the
   sender to `office@soul.com`, book a Meet slot to a mailbox you own, then
   (a) `fly logs -a thefibre-api-staging --no-tail | grep '\[email\] sender'`
   must show NO refusal, and (b) in the received mail's headers: `From:
   soul.com <office@soul.com>`, `DKIM-Signature … d=soul.com`, `spf=pass`
   for `send.soul.com`, `dmarc=pass`.

## 2. OWN URL — what exists, what it would take

**Today: nothing.** Public pages are path-based on our hosts:
`meet.thethread.app/<slug>`, `app.thethread.app/{owner}/{thread}` (one global
slug namespace, `public_root_slug`). Every URL goes through one registry,
`appUrl()` in `packages/shared/src/branding.ts`; Meet's `lib/public-host.ts`
and Thread's `lib/public-host.ts` derive from it, and the API builds the
same URLs in `routes/portal.ts`, `routes/thread.ts`, `lib/calendar-feed.ts`,
the two payment-link modules and `routes/purchases.ts` — about twenty
builders, all on one origin per app. No `middleware.ts` routes by host; the
only host logic is "is this staging". CORS (`lib/cors-origins.ts`) is derived
from that registry and is default-deny. The session cookie domain is one env
value per apex (`NEXT_PUBLIC_COOKIE_DOMAIN`). Thread v3 had custom domains
(flag `branding.custom_domain`, Business tier) and the rebuild plan says
"explicitly NOT ported". `docs/platform-billing-roadmap.md` already names
"custom domain on `meet.<their-domain>`" as an Org-tier intent.

**What the old systems had.** The Airtable-era Thread mapped
`events.soul.com` → one org via an `ORG_DOMAINS` env var and an Airtable
`customDomain` field ("Enterprise"). That DNS record is still there:
`events.soul.com` CNAMEs to `thethread-app.onrender.com`, which answers
**503** today — a dead link in soul.com's zone that should be removed or
re-pointed whatever else happens. Suite v1 had no custom domains.

**What `book.soul.com` would take (public pages only, signed-in stays on
our hosts):**

1. **Schema**: `workspace_domain` (host, workspace_id, app, verified_at),
   RLS, admin-only PATCH — half a day.
2. **Vercel**: add the host to the Meet (or Thread) project through the REST
   API (`POST /v10/projects/{id}/domains`); the customer adds one CNAME
   `book.soul.com → <project cname>.vercel-dns-….com` (Vercel shows the
   project-specific target; if the name is in use by another Vercel account
   a one-off TXT verifies ownership). SSL is automatic. Pro plan: domains per
   project unlimited (soft limit 100k). Half a day plus the token on Fly.
3. **Routing**: middleware looks the host up (API `by-host`, cached), and
   rewrites `/` and `/{thread}` to the workspace's owner paths — one day.
4. **URL builders**: every builder above learns `publicOriginFor(workspace)`
   so links in mail, iCal feeds, payment-link redirects, Stripe success
   URLs, OG tags and embeds carry the customer's host, not ours — one to
   two days, and the biggest risk (a link that still says thethread.app is
   not a bug anyone reports).
5. **CORS** allow-list adds verified tenant hosts; the embed loader and
   `/my` portal keep our hosts; sign-in stays on our apex (no cookie work)
   — half a day.
6. **Staging twin** and the smoke test — half a day.

**Size: 4–6 working days for Meet and Thread public pages**, in a quiet lane,
after soul.com's sender is done. **Cheap variant, one day:** a hardcoded
`book.soul.com` added to the Meet Vercel project with a host-conditioned
`rewrites` rule to `/soul` — Enterprise hand-holding, no schema, no UI; the
links in mail still say meet.thethread.app. Good enough to show him, not a
product.

## 3. One Enterprise package

Gating today: `billing_plan.features` jsonb is the whole vocabulary,
`lib/plan.ts` `can(workspaceId, feature)` is the one reader (fails open),
`/admin/plans` edits the checkboxes, a new key is a deploy (`PlanFeature`
union + `FEATURE_GROUPS` label + one `can()` call). `custom_sender_domain`
exists and is Pro+ (the 402 in `routes/workspace-brand.ts`).
`white_labelled_invoices` is seeded in the plan rows but nothing reads it.

Proposed: a feature key `custom_domain` beside `custom_sender_domain`, true
on `org` only; the "Enterprise" package in the matrix = `custom_sender_domain`
+ `custom_domain` (+ `white_labelled_invoices` once something reads it). The
gate sits in the new domains route; the Workspace settings screen shows the
DNS records to add (Resend's three via Resend's Domains API, Vercel's CNAME
via Vercel's) and a Verify button. Whether `custom_sender_domain` moves from
Pro to Enterprise is a pricing call for Sjoerd — today a Pro workspace may
already type its own address.

**Who does what.** The customer: four DNS records at their registrar (three
for mail, one CNAME for the URL; plus one TXT if Vercel asks), and the
sender fields in Settings. We: add the domain in Resend and the host in
Vercel (both have APIs, so this can be a button rather than a ticket), flip
the plan, and run the header check once. Nothing of theirs moves: their mail
provider, their apex records and their website stay as they are.

## 4. 👉 FOR SJOERD

1. Resend → Domains, in the account whose key is on Fly: is `soul.com`
   listed, and is `thethread.app` in the same account? (Decides step 1.)
2. Add the one missing record (`TXT send.soul.com`) — or the three — at
   TransIP; click Verify.
3. Decide sender `office@` vs `hello@` (keep `s@soul.com` as reply-to).
4. Remove or re-point `events.soul.com` (dead Render target, 503).
5. Say whether "own URL" is the one-day hardcoded showing or the 4–6 day
   Enterprise feature, and whether own-sender moves from Pro to Enterprise.
