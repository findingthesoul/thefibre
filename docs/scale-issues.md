# Scale issues — known thresholds + mitigations

_Living doc. 2026-05-17 first cut. Updated whenever we hit something._

Today (v0.8.0) The Fibre runs on 1 Supabase project + 1 small Fly machine and one seeded workspace. Everything's fast. This doc catalogues where we'll hit walls as workspaces grow, with a rough threshold + the mitigation we have in mind.

Five "size axes" matter:

| Axis | Today | Trouble threshold | Hard ceiling without re-architecting |
|---|---|---|---|
| Persons per workspace | ~8 (seed) | 10k | 100k |
| Activities per workspace | ~21 (seed) | 100k (1 year × medium use) | 5M |
| Bookings per workspace | <10 (test) | 50k | 500k |
| Workspaces (orgs) | 2 | 500 | 5k |
| Concurrent users (workspace) | 1 | 50 | 500 |

The rest of this doc walks through where each axis bites.

---

## 1. `can_see_person()` evaluates per row

**Where:** the permission-tier helper proposed in `docs/permission-tiers-proposal.md`. Five `EXISTS` subqueries per call. Called for every row in `public.person` queries via RLS.

**Threshold:** ~5k persons per workspace begins to add ms; ~50k starts to noticeably affect contact-list load.

**Mitigation:**
- **Stage 1 (cheap):** add the partial + compound indexes called out in the proposal doc.
- **Stage 2:** materialise `person_visibility(person_id, user_id)` via trigger maintenance — recompute on `meet_team_member`, `programme_enrolment`, `org_membership`, `meet_booking`, `meet_team.visibility`. RLS becomes a single `exists (select 1 from person_visibility where user_id = current_user_id() and person_id = id)`.
- **Stage 3:** if even that's slow, switch to a denormalised `person.visible_to uuid[]` column with GIN index.

We don't pre-build stages 2 + 3; we wait until we have a workspace at 5k+ persons and profile.

---

## 2. Activity feed filtering

**Where:** every "see my workspace activity" query. The platform brief makes activity append-only, so it grows fastest. Each row needs a can-see check against its subject.

**Threshold:** 100k activities (around one year of moderate use) is when the feed page gets sluggish.

**Mitigation:**
- **Stage 1:** keep activity reads always filtered by `person_id` or `organisation_id` first. Don't allow unbounded "all activities" queries.
- **Stage 2:** materialised view `activity_visible(activity_id, user_id)` maintained by triggers. Updated on activity insert + on permission-graph changes (which are rare).
- **Stage 3:** partition `activity` by year. Each partition is its own physical table; queries scan one or two partitions.

---

## 3. Bookings table grows unboundedly

**Where:** `meet_booking`. Append-only in practice (cancellations flip a status flag, never delete).

**Threshold:** 500k rows is when the table needs partitioning. We're nowhere close.

**Mitigation:**
- Already have indexes on `(host_id, starts_at)`, `(meeting_type_id)`, `(workspace_id)`, `(invitee_person_id)`.
- When we hit the threshold: partition by `starts_at` quarter. Drop old partitions to cold storage if compliance allows; otherwise keep but ARCHIVE-flag them.

---

## 4. Google Calendar API quota

**Where:** every slot-availability query + every booking. We call `freebusy.query` for the host's connected calendars; for round-robin meeting types, that's N hosts × M calendars per slot lookup.

**Threshold:**
- Default daily quota: 1M units. Each `freebusy.query` ≈ 1 unit per calendar.
- A round-robin meeting type with 5 hosts × 3 calendars = 15 units per slot request.
- ~60k slot requests per day = ceiling.

**Mitigation:**
- **Cache freebusy** in-memory for a few minutes per (host_id, calendar_id, window). Invalidate on a booking write.
- **Push notifications** — set up Google Calendar watch channels per calendar so we get notified of changes instead of polling. Same data, ~100× fewer requests.
- **Per-workspace OAuth project** — at very high scale, give each workspace its own Cloud Console project so quotas isolate per tenant. (Operational complexity; defer.)

---

## 5. Resend / email volume

**Where:** every booking + cancellation + invite sends 1–N emails.

**Threshold:**
- Resend free tier: 3k emails/month, 100/day. Hit fast.
- Resend pro: 50k/month, 100/day rate-limited per minute.

**Mitigation:**
- We already send only on legit triggers (book, cancel, invite). No marketing volume.
- For higher scale: bring our own transactional plan, or move to Amazon SES (cheaper per email; same DKIM/SPF setup).
- Don't bundle invite + reminder emails into a single batch — keep them as separate transactional sends.

---

## 6. RLS predicate cost on bulk queries

**Where:** any `SELECT *` from a workspace table. Every row is evaluated against the policy.

**Threshold:** noticeable at ~10k rows in a single query. We avoid this by always cursor-paginating.

**Mitigation:**
- **Pagination is mandatory** — already a hard rule in the brief (§13). Anywhere in the API that fetches a list, it caps at 100 rows. Hold the line.
- For aggregates ("count of contacts I can see"), don't run the policy per row — denormalise the count.

---

## 7. Database size on Supabase

**Where:** the Pg cluster.

**Threshold:**
- Free: 500MB.
- Pro: 8GB (then $0.125/GB/month to grow).
- Team: 50GB.

A workspace with 50k persons, 200k activities, 500 bookings, average row size 1KB ≈ 250MB. So one heavy workspace fits comfortably in Pro.

**Mitigation:**
- **Photos** — when we let users upload profile photos, point them at Supabase Storage (or S3) instead of base64-in-text. Storage is cheaper per GB than DB.
- **Activity payload** — keep `activity.subject` short (we already do — just a type + subject; never body). Don't add long-text columns.
- **Soft-deleted rows accumulate** — schedule a quarterly GC: rows where `deleted_at < now() - interval '12 months'` get hard-deleted unless flagged for compliance retention.

---

## 8. Connection pool

**Where:** Fly API → Supabase Postgres.

**Threshold:** Supabase Pro pool: 60 transaction-mode connections via PgBouncer (port 6543). We already use this.

**Mitigation:**
- Already correct. Anything that calls Postgres goes through 6543, not 5432 directly.
- At 50 concurrent active users hitting the API, we're at the edge. Scale Fly to 2 machines + use Supabase IPv4 read replicas at that point.

---

## 9. Fly machine RAM

**Where:** 1 × shared-cpu-1x with 1GB RAM. Node API.

**Threshold:** ~100 concurrent active requests on heavy queries (the API materialises rows in memory for RLS post-processing).

**Mitigation:**
- Scale to `performance-1x` 2GB before hitting the wall.
- Add a second machine in `fra` for redundancy.
- Eventually multi-region: `fra` + `iad` + `sin` so global users hit a local edge.

---

## 10. Cold starts on Vercel

**Where:** Next.js serverless functions wake up cold on first request.

**Threshold:** noticeable on infrequently-visited pages (Settings sub-pages, the team detail page after a sleep).

**Mitigation:**
- Cache aggressively where it's safe — `revalidate: 60` on read-mostly server components.
- Prefetch on hover for sidebar nav links (Next.js does this by default).
- Don't bother with Edge runtime for now — our queries hit Fra Postgres anyway, so the round-trip dominates.

---

## 11. Migration backfills

**Where:** big migration `DO` blocks (we did one for `ensure_user_person`).

**Threshold:** any backfill that touches >100k rows in a transaction.

**Mitigation:**
- Batch any backfill that touches more than a few thousand rows.
- For huge backfills, run them out-of-band: a one-shot Node script invoked via `pnpm --filter @thefibre/api run migrate:backfill:foo` that reads + writes in 1000-row batches with a sleep between.
- Never run a long backfill inside the migration that the deploy waits on.

---

## 12. Cross-app aggregates (the contact's "all apps" tab)

**Where:** the platform composes a person's profile from per-app curator data. Today: one query to the platform + one query per app. N+1 in spirit.

**Threshold:** at ~10 installed apps per workspace, each contact-profile load fans out 10 queries.

**Mitigation:**
- **Server-side parallelism** — issue the app queries concurrently with `Promise.all`. Already do this in the existing per-app tabs.
- **Optional aggregate endpoint** — `GET /persons/:id/all-app-data` that the platform composes once and returns to the client.
- **Skip queries for inactive apps** — if `workspace_app.deactivated_at IS NOT NULL`, don't query that app.

---

## 13. Search

**Where:** contact / org search by name, email, company, etc.

**Threshold:** today we string-match in-memory after RLS. At 10k+ persons that's too slow.

**Mitigation:**
- `pg_trgm` extension for ILIKE-able indexes on name + email + company.
- Eventually a separate search index (Typesense / Meilisearch / Postgres FTS) populated via triggers. Defer until we feel the wall.

---

## 14. Stripe webhooks (when payments land)

**Where:** future. Stripe sends webhooks; we update booking + payment state.

**Threshold:** Stripe retries failed webhooks for up to 3 days. A blocked webhook handler stays blocked.

**Mitigation when we get there:**
- Webhook handler: read event, drop into a `stripe_event` queue table, return 200 immediately. A background worker drains the queue.
- Idempotency on `event.id` so retries are safe.

---

## Where this gets reviewed

When we sign our first paying customer, walk through this doc end-to-end. Don't pre-optimise — just know what to do when the alert fires.

The deploy doc (`docs/deploy.md`) should reference this whenever a "go bigger" decision comes up.
