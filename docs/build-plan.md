# Build plan

Living document. Tracks what's shipped, what's queued, and what's parked. Edit freely.

The official spec is [`fibre-technical-brief-v0.3.md`](fibre-technical-brief-v0.3.md) — read that for the *why*. This file is the operational view of the *what* and *when*.

---

## Shipped — see [CHANGELOG.md](../CHANGELOG.md)

Everything tagged in the changelog is verified working end-to-end.

---

## Now (current sprint)

- [x] Org list, detail, add form (parallel to contacts)
- [x] Activity page — workspace-wide timeline (the spine of the product, brief §1)
- [x] Introduce `fibre-platform` app slug (was `fibre-suite` placeholder)
- [x] Design-system primitives + Edit/Delete on contacts (v0.2.0)
- [x] Edit/Delete on organisations (v0.2.1)
- [x] Privacy page — consent records, erasure request flow (v0.2.2)
- [x] Settings page — workspace + profile basics (v0.2.3)
- [ ] **Deploy web to Vercel** — fix framework preset to Next.js, root `apps/web`; add env vars
- [ ] **Deploy API to Fly.io Frankfurt** (or Railway EU)
- [ ] **Connect `thefibre.app` domain** once Vercel deploy is green

---

## Next (foundation completion)

### Contact graph deepening
- [ ] Add-member-to-org form — link `person` ↔ `organisation` with title, role, dates
- [ ] Relationship form — person ↔ person, with type + strength
- [ ] Tags — create, assign, filter by
- [x] Person edit form (Dialog-based) — v0.2.0
- [x] Organisation edit form (Dialog-based) — v0.2.1
- [x] Person profile tabs: Professional, Relationship context, Change context, Learning (v0.3.0)
- [ ] Org profile tabs: Identity, System context, Relationship
- [ ] Sensitive-field gating: `facilitator_notes`, `political_landscape` — visually marked in v0.3.0; access-control still TODO (brief §5)
- [ ] CSV import for contacts

### Workspace & membership
- [ ] App membership management UI (assign role + permissions per app per user)
- [ ] Workspace creation + switching (currently single seeded workspace)
- [ ] Invite by email (magic link flow, brief §5.5b)

### SSO providers
- [ ] Microsoft OAuth
- [ ] LinkedIn OAuth
- [ ] Magic link as primary path (currently only Google live)
- [ ] `hd` claim org-link suggestion ("we see you're from nme.nl — link to NME?")

---

## Phase 2 — programme layer (brief §12)

- [ ] Create / list / view programmes (any format: meeting, event, journey, self_paced, blended)
- [ ] Enrol a person in a programme
- [ ] Enrolment status transitions (invited → enrolled → active → completed / dropped)
- [ ] Activity write path from inside an app (e.g. POST `session_attended` from The Thread)
- [ ] `progress_pct` updates on activity events
- [ ] Programme detail view with enrolment list

---

## Phase 3 — GDPR UX (brief §10) — schema is in

- [x] Privacy dashboard for the participant (v0.2.2): my consents (with revoke), my requests
- [ ] Article 15 export — JSON of everything held about you
- [x] Article 17 erasure request UI (v0.2.2) — file + track. Cross-app webhook fan-out still TODO.
- [ ] Article 16 rectification — self-edit profile fields
- [ ] Article 20 portability — same as export with schema definition
- [ ] Consent grant / revoke UI per purpose code, unbundled
- [ ] Retention policy admin (one row per `data_category` per workspace)
- [ ] `processing_purpose` table populated with Supabase, Vercel, Resend, Stripe as documented processors
- [ ] Email service consent-gate (don't send `marketing_email` without active consent record)
- [ ] Cross-app erasure webhook handlers (each app registers an endpoint)

---

## Phase 4 — Fibre Sales (brief §3 + §5 domain 7)

- [ ] Sales schema migration (`pipeline_stage`, `deal`, `deal_contact`, `line_item`, `sales_activity`)
- [ ] RLS extended for sales tables — workspace AND `has_app_membership('fibre-sales')`
- [ ] Pipeline kanban UI (gated by app membership)
- [ ] Deal detail view with line items + sales activity log
- [ ] `deal_won` → programme handover webhook (creates a programme in the delivery app)
- [ ] Org engagement summary endpoint (aggregate; brief §6)

---

## Phase 5 — app integration (brief §12)

- [ ] Fibre Suite frontend scaffold at `apps/suite/`
- [ ] The Thread frontend scaffold at `apps/thread/`
- [ ] Cross-subdomain auth (cookie share across `*.thefibre.app`)
- [ ] App-specific schemas (sessions, agendas, journeys, reflections — never platform)
- [ ] Activity event taxonomy enforced per app (brief §5 Domain 6)
- [ ] Promotion model: "save to profile" actions from inside apps (brief §6)
- [ ] Fibre Learn architecture skeleton (future)

---

## Operational & infra

- [ ] **Vercel deploy of web** (currently 404 at thefibre.app)
  - Framework preset → Next.js
  - Root Directory → `apps/web`
  - Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL`, `SSO_INTERNAL_SECRET`, `DEFAULT_WORKSPACE_ID`
- [ ] **Deploy API to Fly.io Frankfurt** — `Dockerfile` for `apps/api`, `fly.toml`, secrets
- [ ] **Domain wiring** — `thefibre.app` (landing), `suite.thefibre.app`, `thread.thefibre.app`, `sales.thefibre.app` all point to Vercel; `api.thefibre.app` → Fly.io
- [ ] **Custom email domain** — Resend with `@thefibre.app`, SPF / DKIM / DMARC
- [ ] **Lint rule banning Supabase imports under `apps/web/app/api/`** — enforce brief rule §13.13
- [ ] **CI** — typecheck + build on every PR
- [ ] **Backups** — Supabase has them; confirm retention; document restore procedure
- [ ] **Migrations workflow** — staging environment for trying migrations before prod

---

## Code-level TODOs we've left in place

- `apps/web/app/auth/callback/route.ts`: workspace resolution falls back to `DEFAULT_WORKSPACE_ID` — replace with invite/magic-link/domain-matching logic
- `apps/web/lib/supabase/server.ts`: `setAll` swallows server-component cookie write errors. Add a Next middleware that calls `supabase.auth.getUser()` so sessions auto-refresh between requests.
- `apps/api/src/routes/sso.ts`: gated by `SSO_INTERNAL_SECRET` — rotate before prod and store securely

---

## Gotchas we've hit (for memory)

- Supabase migrations need 14-digit timestamps; same-day filenames with shorter prefixes collide in the tracker
- `custom_access_token_hook` must be enabled in the Auth dashboard for `workspace_id` claim to land in JWTs — without it, RLS denies everything
- After SSO creates a new user, the **first** JWT was issued before the user row existed → call `refreshSession()` in the callback
- API middleware required `X-App-ID` on `/sso/resolve` — fixed by putting that path in `PUBLIC_PATHS` (gated by its own secret)
- Vercel deploys default to "Other" framework preset; for a monorepo with Next.js under `apps/web`, set the preset explicitly and the Root Directory

---

## Parked / decisions deferred

- **Self-hosted Supabase on Hetzner** — migration trigger documented in brief §4 (client requiring no-US parent, scale, or sovereign regulator). Not needed yet.
- **Fly.io vs Railway** — pick before API deploy. Fly.io = more control, Railway = simpler.
- **Region:** project is West EU (Ireland) not Frankfurt as the brief suggests. Both EU, GDPR-compliant. Move if a client requires Frankfurt specifically.
- **GraphQL via Hasura** — only if a contract requires it (brief §4 evaluated alternatives)
