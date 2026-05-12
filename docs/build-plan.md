# Build plan

Living document. Tracks what's shipped, what's queued, and what's parked. Edit freely.

The official spec is [`fibre-technical-brief-v0.3.md`](fibre-technical-brief-v0.3.md). This file is the operational view.

---

## Shipped — see [CHANGELOG.md](../CHANGELOG.md)

Everything tagged in the changelog is verified working end-to-end.

---

## Now (current sprint)

- [x] Org list, detail, add form (parallel to contacts)
- [ ] Activity page — workspace-wide timeline
- [ ] Privacy page — consent records, erasure request flow
- [ ] Settings page — workspace + member management

## Next

- [ ] Add-member-to-org form (link a `person` to an `organisation` with role + title)
- [ ] Relationship form (person ↔ person)
- [ ] Tags
- [ ] App membership management UI (invite + role + permissions)
- [ ] Workspace creation + switching (currently uses single seeded workspace)

## Phase 2 — programme layer

- [ ] Create / list / view programmes (any format)
- [ ] Enrol a person in a programme
- [ ] Activity write path from inside an app (e.g. "session_attended")

## Phase 3 — GDPR UX (schema is in)

- [ ] Privacy dashboard (Article 15 export, Article 17 erasure)
- [ ] Consent grant / revoke UI per purpose
- [ ] Retention policy admin

## Phase 4 — Fibre Sales

- [ ] Sales schema + RLS gating by `app_membership`
- [ ] Pipeline UI
- [ ] `deal_won` → programme handover webhook

## Phase 5 — app integration

- [ ] Fibre Suite frontend scaffold
- [ ] The Thread frontend scaffold
- [ ] Cross-app erasure webhook handlers

## Operational

- [ ] Deploy API to Fly.io Frankfurt
- [ ] Deploy web to Vercel (EU) — currently 404
- [ ] Connect domain `thefibre.app` once Vercel deploy is green
- [ ] Microsoft + LinkedIn SSO providers
- [ ] Introduce `fibre-platform` app slug (currently the landing reuses `fibre-suite` for X-App-ID)

## Parked / decisions deferred

- Self-hosted Supabase on Hetzner — migration trigger documented in brief §4; not needed yet
- Custom email domain for transactional mail (`@thefibre.app` via Resend)
