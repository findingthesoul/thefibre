# Build plan

Living document. Tracks what's queued, what's parked, and how we work.

For *what's done*, see [CHANGELOG.md](../CHANGELOG.md) — every shipped version is recorded there.
For *why*, see the canonical spec: [`fibre-technical-brief-v0.3.md`](fibre-technical-brief-v0.3.md).

Current version: **v0.3.2** — both core entities (persons + organisations) have full tabbed profiles, edit/delete, members glue, privacy controls, settings. The contact graph from brief §5 + §6 is **functionally complete in the UI**.

---

## Now — the next thing to ship

The platform isn't reachable at `thefibre.app` yet. Everything else is secondary until that's fixed.

- [ ] **Deploy web to Vercel**
  - Framework preset → **Next.js** (currently wrong)
  - Root Directory → `apps/web`
  - Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL`, `SSO_INTERNAL_SECRET`, `DEFAULT_WORKSPACE_ID`
- [ ] **Deploy API to Fly.io Frankfurt** (or Railway EU)
  - Add `Dockerfile` and `fly.toml` under `apps/api/`
  - Store secrets via `fly secrets set` — never commit
- [ ] **Connect `thefibre.app` domain** once Vercel deploy is green
- [ ] **Update Supabase Auth + Google OAuth redirect URLs** to include the production domains

---

## Next — feature gaps in the foundation

### Contact graph
- [ ] Relationship form (person ↔ person, type + strength)
- [ ] Tags — create, assign, filter contacts and orgs by them
- [ ] CSV import for contacts
- [ ] Sensitive-field access gating — `facilitator_notes`, `political_landscape` are visually marked but anyone in the workspace can read them; brief §5 wants role-based gating
- [ ] Person + org list filtering (by tag, country, sector, stage, owner)

### Workspace & membership
- [ ] App membership management UI (assign role + permissions per app per user)
- [ ] Workspace creation + switching (currently single seeded workspace)
- [ ] Invite by email (magic link flow, brief §5.5b)

### SSO providers
- [ ] Microsoft OAuth (Supabase Auth + new `user_identity_provider` row type)
- [ ] LinkedIn OAuth
- [ ] Magic link as a UI option on the landing page
- [ ] `hd` claim org-link suggestion ("we see you're from nme.nl — link to NME?")

---

## Phase 2 — programme layer (brief §12)

The schema is in (`program`, `enrolment`). UI doesn't exist yet.

- [ ] Create / list / view programmes (any format: meeting, event, journey, self_paced, blended)
- [ ] Enrol a person in a programme (link from contact detail too)
- [ ] Enrolment status transitions (invited → enrolled → active → completed / dropped)
- [ ] Activity write path from inside an app (e.g. `session_attended` from The Thread)
- [ ] `progress_pct` updates on activity events
- [ ] Programme detail view with enrolment list

---

## Phase 3 — GDPR UX (brief §10)

Schema is in. Self-service revoke + erasure request shipped in v0.2.2. Remaining:

- [ ] Article 15 export — JSON of everything held about you (`/privacy/export`)
- [ ] Article 16 rectification — link from privacy page to self-edit profile
- [ ] Article 20 portability — same payload as export plus schema definition
- [ ] Cross-app erasure webhook fan-out — when a DSR is fulfilled, each app's webhook handler zeroes its sensitive fields
- [ ] Consent grant UI per purpose code (revoke exists; granting beyond registration is missing)
- [ ] Retention policy admin (one row per `data_category` per workspace)
- [ ] `processing_purpose` table populated with Supabase, Vercel, Resend, Stripe as documented processors
- [ ] Email service consent-gate — don't send `marketing_email` without an active consent record

---

## Phase 4 — Fibre Sales (brief §3, §5 domain 7)

Gated app — not visible to facilitators or participants.

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
- [ ] Cross-subdomain auth — share Supabase cookies across `*.thefibre.app`
- [ ] App-specific schemas (sessions, agendas, journeys, reflections — never platform)
- [ ] Activity event taxonomy enforced per app (brief §5 Domain 6)
- [ ] Promotion model — "save to profile" actions from inside apps that update platform-side fields (brief §6)
- [ ] Fibre Learn architecture skeleton (future)

---

## Operational & infra

- [ ] **Custom email domain** — Resend with `@thefibre.app`, SPF / DKIM / DMARC
- [ ] **Lint rule banning Supabase imports under `apps/web/app/api/`** — enforce brief rule §13.13
- [ ] **CI** — typecheck + build on every PR
- [ ] **Backups** — Supabase has them; confirm retention, document restore
- [ ] **Migrations workflow** — staging environment for trying migrations before prod

---

## Code-level TODOs left in place

- `apps/web/app/auth/callback/route.ts`: workspace resolution falls back to `DEFAULT_WORKSPACE_ID`. Replace with invite / magic-link / domain-matching logic once we support multi-workspace.
- `apps/web/lib/supabase/server.ts`: `setAll` swallows server-component cookie write errors. Add a Next middleware calling `supabase.auth.getUser()` so sessions auto-refresh between requests.
- `apps/api/src/routes/sso.ts`: gated by `SSO_INTERNAL_SECRET` — rotate before prod and store via Fly secrets.
- `apps/api/src/middleware/app-context.ts`: error responses are inline; consider extracting a problem-details helper if we add more.

---

## Gotchas we've hit (for memory)

- **Supabase migrations** need 14-digit timestamps (`YYYYMMDDHHMMSS`); same-day filenames with shorter prefixes collide in the tracker.
- **`custom_access_token_hook`** must be enabled in the Auth dashboard for the `workspace_id` claim to land in JWTs. Without it, RLS denies everything authenticated.
- **SSO first-sign-in race:** the JWT is issued before `/sso/resolve` creates the `public.user` row, so the hook can't match yet. The callback must call `refreshSession()` after `/sso/resolve` returns.
- **`X-App-ID` requirement:** the API middleware demands it on `/api/v1/*`. The SSO endpoint is in `PUBLIC_PATHS` to bypass that — it has its own secret check.
- **Vercel monorepo:** framework preset defaults to "Other" and the Root Directory defaults to the repo root. Both must be set explicitly for `apps/web` to deploy as Next.js.
- **Vercel project-name collision:** the project name must be unique per team; if a prior failed attempt left a `thefibre` project, delete it before re-importing.
- **Next.js dev server + rapid file changes:** when sub-agents add files in parallel faster than the running dev server can hot-reload, every route 500s. Fix: `Ctrl+C` and restart `pnpm dev`.
- **Server Components + cookie writes:** Next.js 15 forbids cookie writes outside Route Handlers / Server Actions. Wrap Supabase SSR's `setAll` in try/catch.
- **Parallel agents need disjoint folders.** Worktree isolation didn't work here (session started before the repo existed), so agents share the working directory. Strict file lanes prevent corruption.

---

## How we ship

- One feature, one version. SemVer:
  - **patch** (`0.x.y+1`) — additions and fixes that don't change UX shape
  - **minor** (`0.x+1.0`) — UX milestone or new top-level page
  - **major** — reserved for breaking API changes once we have external consumers
- Every shipped version updates: `package.json` × 4, `apps/web/app/(app)/layout.tsx` (sidebar footer), `CHANGELOG.md`.
- Build plan ticks come *off* when shipped — completed items move out of view here (the CHANGELOG keeps them).

## How we use parallel agents

Worked well for tabbed features (v0.3.0 person tabs, v0.3.2 org tabs). Rules:
1. Each agent owns one disjoint folder (e.g. `contacts/[id]/professional/`). No shared files.
2. The parent (me) builds the foundation first — layout, stubs, shared API. Agents only fill leaves.
3. After every parallel batch: full `pnpm -r typecheck`, then commit.
4. Sequential is faster for ≤2 tasks. Parallel pays off at 3+.

---

## Parked / decisions deferred

- **Auto-edit / 10-step undo / change history** — good idea, premature. GDPR erasure must zero PII; storing old field values is a hidden second copy. Revisit once we know which fields people actually edit most.
- **Self-hosted Supabase on Hetzner** — migration trigger documented in brief §4 (client requiring no-US parent, scale ≥10k users, or sovereign regulator).
- **Fly.io vs Railway** — pick before API deploy. Fly = more control; Railway = simpler.
- **Region:** project is West EU (Ireland), not Frankfurt as the brief suggested. Both EU, GDPR-compliant. Move only if a client requires Frankfurt specifically.
- **GraphQL via Hasura** — only if a contract requires it (brief §4 evaluated alternatives).
- **Multi-provider OAuth (Microsoft, LinkedIn)** — Supabase Auth supports them with config only. Defer until there's demand or a partner.
