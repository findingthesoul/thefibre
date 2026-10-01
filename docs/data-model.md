# Data model — the map

Every table in the database, grouped by who owns it, with one line on what it
is for. Measured from `supabase/migrations/` at v1.96.2 (2026-10-01): 235
migrations, 141 tables, all in the `public` schema. No table has ever been
dropped; two were renamed (`meet_team` → `team`, `meet_team_member` →
`team_member`).

This is a map, not a specification. The migrations are the schema; the
intent behind the model is in `docs/fibre-technical-brief-v0.4.md` §2 and §5.
When this file and the migrations disagree, the migrations are right and this
file is stale.

**How to read the flags.** `W` = the table has a `workspace_id`. `–` = it is
scoped through a parent row. `pN` = N row-level-security policies. **SR** =
service-role only: RLS is on and there is deliberately NO policy, so only the
API's service-role client can touch it. That is the intended shape for
credentials and machine state, not a missing policy.

## Three things to know first

1. **There are no per-app schemas.** Ownership is by table prefix
   (`thread_*`, `meet_*`, …). The "data wall" between the platform and the
   apps is a convention enforced by review and by RLS, not by Postgres
   schemas.
2. **Tenancy is `workspace_id` plus RLS, and much of the API bypasses RLS.**
   Most routes use the service-role client and filter `workspace_id` by hand
   (handbook §2). A table's policies protect it from a browser and from a
   user-scoped query; they do not protect it from a route that forgets its
   filter.
3. **Every table declares row level security in the migrations — since
   v1.97.3.** Two catalogue tables, `app` and `billing_plan`, had no such
   statement until then; the live databases protected them only because
   Supabase enables RLS on new tables by default (an anonymous client read
   zero rows from each, probed 2026-10-01). Migration `20261001165521` says
   it, and `rls-declared.test.ts` refuses a new table that does not.
   `billing_plan` has no policy at all, on purpose: it is read only through
   the API (`GET /api/v1/public/plans`), as service role.

## The relationships a newcomer must know

1. **`auth.users` ↔ `user` ↔ `person`.** There is no foreign key from
   `public.user` to Supabase's `auth.users`. The access-token hook
   (`custom_access_token_hook`) joins them on lower-cased email, prefers the
   workspace named in `user_active_workspace`, else the oldest `user` row,
   and stamps `app_user_id`, `workspace_id` and `app_memberships` into the
   JWT. The join MUST stay case-insensitive: a case-sensitive one stamps no
   claims for a mixed-case address and RLS then denies that person
   everything (`hook-case.int.test.ts` guards it).
2. **One human in N workspaces is N `user` rows**, tied together only by
   email. `identity_profile` and `identity_billing` are keyed by that email.
   The JWT's `sub` is `auth.users.id`; every foreign key to `user(id)` must
   use the `app_user_id` claim.
3. **Access has four layers.**
   - `workspace_member` — the role in a workspace (`super_admin`, `admin`,
     `organiser`; internal or external).
   - `workspace_app` — the workspace has switched this app on.
   - `app_membership` — this user may open this app. It is per `user` row,
     and therefore per workspace.
   - `team_member` + `team_app_grant` — an assignment layer only.
     `apps/api/src/lib/team-grants.ts` resolves it into ordinary
     `app_membership` rows; enforcement reads `app_membership`.
4. **A thread is a programme.** `thread_thread` is a 1:1 companion of a
   platform `program` row, and `thread_enrolment` of a platform `enrolment`
   row. The platform owns status and progress; the `thread_*` rows hold only
   Thread's own content (payment, answers, slug).
5. **Two sanctioned writes across the data wall.** `activity` (append-only,
   type and subject, never content; update and delete are blocked by a
   trigger even for the service role) and `purchase` (one row per money
   event, written update-then-insert on `(app_id, item_ref)` so a webhook
   retry is safe). "My money" queries must match `person_id` OR
   `payer_email`; either alone drops rows.
6. **Contact points and merges.** `person.email` and `person.phone` are the
   primary copies, synced one way into `person_contact_point` by trigger.
   `merge_person()` re-points every foreign key to `person` by reading
   `pg_constraint` at run time, records what it moved in `person_merge`
   (that row is the undo), fills the survivor's blank fields from the loser,
   and soft-deletes the loser with `merged_into`. Organisations mirror this.
   Participant surfaces still resolve a signed-in email against
   `person.email` only, so a merged-away address cannot see its portal — an
   open decision in `docs/build-plan.md`.
7. **Curator rows are "the app justifies the field" in practice**: every row
   in the `person_*` / `org_*` curator tables carries an `app_id`, and its
   policy requires `app_membership` for that app.
8. **An app-key request has no user and bypasses RLS.** `ctx.userId` is the
   empty string; every query on that path filters `workspace_id` in code.

## Platform

| Tables (flags) | Purpose |
|---|---|
| `workspace` (–, p1) | Tenant root. Its `plan` column is dead; the real plan is in `workspace_subscription` |
| `user` (W, p1) | A sign-in seat: one row per (workspace, email), with `person_id` pointing at the paired person |
| `user_identity_provider`, `sso_match_log`, `session` (–, p1 each) | OAuth identities per user; SSO match audit; `session` has no reader in the API |
| `user_active_workspace` (W, **SR**) | Which workspace a multi-workspace person is acting in; read by the token hook |
| `workspace_member` (W, p2) | Role per (user, workspace), plus internal/external |
| `user_profile` (–, p2), `identity_profile` (–, p2), `identity_billing` (–, p1) | Per-user public profile (a read fallback); one face per email across workspaces; owner-only payment details |
| `user_connection` (–, **SR**) | Credentials: Google refresh token, personal room URL, Zoom tokens and user id |
| `signup_request` (W, p3), `platform_setting` (–, **SR**) | The access-request funnel; operator switches |
| `sso_handoff` (–, **SR**), `oauth_client` (W, **SR**), `oauth_code` (–, **SR**) | Cross-apex SSO codes (60 s, single use); The Fibre as OAuth2 provider |
| `mcp_grant` (W, **SR**) | A person's connected AI assistant: workspace, scopes, an encrypted session, a hashed refresh token |
| `public_root_slug` (W, **SR**) | The global `/{owner}` namespace shared by workspaces, teams and organisers |
| `app` (–, p1) | The app catalogue: slug, `status` pending/approved/suspended, kind, manifest, `released_at`, `beta_at` |
| `workspace_app` (W, p2) | Which apps a workspace has switched on |
| `app_membership` (–, p1) | Which apps a user may open; unique (user_id, app_id) |
| `app_key` (W, **SR**) | A credential scoped to app × workspace; only its sha256 is stored |
| `app_entity_mapping`, `app_record_link` (W, p1 each) | External apps only: manifest entity mappings and per-record links |
| `team` (W, p2), `team_member` (–, p4), `team_app_grant` (–, p2) | Platform teams and what a team grants |
| `person` (W, p4), `organisation` (W, p4) | The contact graph. Soft delete; `merged_into` |
| `person_contact_point` (W, p1) | Every email and phone of a person, labelled |
| `person_merge`, `organisation_merge`, `organisation_distinct` (W, p1 each) | Merge audit rows (the undo); "these two are different" answers |
| `org_membership` (–, p1), `relationship` (W, p1), `tag` (W, p1), `person_tag` (–, p1) | Person↔organisation edges; person↔person edges; tags |
| `org_domain_verification` (W, p2) | DNS TXT challenge per organisation |
| `person_professional`, `person_relationship_context`, `person_change_context`, `person_learning`, `person_billing`, `org_identity`, `org_system_context`, `org_relationship`, `org_billing` (–, p1 each) | Curator tables: each row carries `app_id` |
| `program` (W, p1), `enrolment` (–, p1) | Shared programme and enrolment state |
| `activity` (W, p2) | The append-only event log |
| `consent_record` (–, p1), `data_subject_request` (–, p1) | GDPR consent and data-subject requests |
| `retention_policy`, `processing_purpose` (W, p1 each) | GDPR tables with no reader in the code yet |
| `purchase` (W, p1) | The money ledger. Read policy only; writes are service role |
| `billing_plan` (–, no policy) | The plan catalogue, edited at `/admin/plans`. Gates follow `plan_id`, never price. It has no `updated_at` |
| `workspace_subscription`, `usage_warning`, `usage_overage_charge` (W, p1 each) | Stripe subscription state; usage warnings and overage dedup |
| `workspace_assistant` (W, **SR**), `assistant_usage` (W, p1) | A workspace's own Anthropic key (encrypted); token usage per day |
| `user_task` (W, p2) | A person's own cross-app to-do state. Private to that person |
| `person_calendar_feed` (–, **SR**) | A subscribable calendar token per participant |
| `scheduler_lease` (–, **SR**) | One lease per scheduled job, so two API machines never run the same tick |

## The Thread

| Tables (flags) | Purpose |
|---|---|
| `thread_thread` (W, p1) | 1:1 companion of a `program` |
| `thread_enrolment` (W, p1) | 1:1 companion of an `enrolment`: payment state, registration answers, check-in |
| `thread_engagement`, `thread_ticket`, `thread_coupon`, `thread_rsvp` (W, p1 each) | Agenda items and scheduled messages; prices; discount codes; RSVPs |
| `thread_task` (W, p1) | A thread's shared to-dos — visible to everyone with a Thread seat, unlike `user_task` |
| `thread_organiser` (W, p1), `thread_thread_organiser` (–, p1), `thread_settings` (W, p1) | A person's storefront; co-organisers; workspace-level settings and the public site texts |
| `thread_certificate_template`, `thread_certificate`, `thread_template`, `thread_template_share` (W, p1 each) | Certificate designs and issued snapshots; thread templates and their sharing |
| `thread_category` (W, p1), `thread_thread_category` (–, p1) | Categories |
| `thread_message_send` (–, p1), `thread_payout` (W, p1), `thread_calendar_change` (W, p1) | Send dedup log; revenue split per paid enrolment; calendar changes not yet announced |

## Meet

| Tables (flags) | Purpose |
|---|---|
| `meet_host`, `meet_calendar`, `meet_intake_form`, `meet_meeting_type`, `meet_booking` (W, p1 each) | Host configuration; connected calendars; intake schema; the bookable offering; bookings |
| `meet_meeting_type_assignee`, `meet_team_member_hours` (–, p2 each), `meet_root_slug` (W, p1) | Team assignees; per-team hours; the host and team slug namespace |
| `meet_poll_slot`, `meet_poll_vote` (–, p2 each), `meet_poll_invite` (W, p2) | Meeting polls |
| `person_meet_profile` (W, p1) | Meet's curator data on a person |

## Flow

| Tables (flags) | Purpose |
|---|---|
| `flow_definition` (W, p1), `flow_version`, `flow_step`, `flow_transition`, `flow_gate_task`, `flow_step_default_task` (–, p1 each) | A flow, its immutable versions, the graph and its task templates |
| `flow_run`, `flow_task`, `flow_run_note`, `flow_run_note_mention` (W, p1 each), `flow_favorite` (–, p1) | A person's journey; to-dos; notes and mentions (Connect reads these too); stars |
| `flow_document_link` (W, p1) | Drive links; no reader in the code yet |

## Pulse

| Tables (flags) | Purpose |
|---|---|
| `pulse_settings` (W, p2), `pulse_stage` (W, p4), `pulse_involved_team` (W, p1), `pulse_cashflow_grant` (W, p1) | Assumptions; pipeline stages; participating teams; who may read or write the cashflow |
| `pulse_account` (W, p3), `pulse_balance_snapshot` (–, p2), `pulse_reservation_rule` (W, p3) | Bank accounts and reserve buckets; balance history; reservations |
| `pulse_offering`, `pulse_project`, `pulse_commitment` (W, p3 each), `pulse_commitment_line`, `pulse_commitment_item` (–, p2 each), `pulse_commitment_stage_event` (W, p1) | What is sold; projects; opportunities; expected payments; stage-move history |
| `pulse_budget_line` (W, p3), `pulse_projection_snapshot` (W, p1) | Recurring in and out; saved projections |
| `pulse_budget` (W, p1), `pulse_budget_target` (–, p1) | Annual budgets; no reader in the code yet |

## Members

| Tables (flags) | Purpose |
|---|---|
| `membership_tier`, `membership_product`, `membership_member` (W, p3 each), `membership_tier_product` (–, p2) | Tiers; the catalogue; the member lifecycle record |
| `membership_access_grant` (W, p1), `membership_member_access` (–, p1) | What a tier unlocks elsewhere (Thread, Circle, Google Workspace, a platform seat); the sync journal per member and grant |
| `membership_pricing_rule` (W, p2), `membership_product_purchase` (W, p1) | Purchasing-power pricing rules; one-off product purchases |
| `membership_settings` (W, **SR**), `membership_reminder_send` (–, **SR**) | Workspace settings including the Circle token and Google Workspace credential; renewal-reminder dedup |

## Connect

| Tables (flags) | Purpose |
|---|---|
| `connections_band_label`, `connections_axis_label`, `connections_effort_default` (W, p2 each), `connections_agenda_calendar` (W, p1) | The landscape's vocabulary; minutes per kind of work; which Google calendars feed the agenda |
| `hygiene_finding` (W, p1), `hygiene_run` (–, **SR**) | The data-hygiene review queue (duplicates and their answers); the nightly sweep's log |

Connect owns little data of its own on purpose: it is a view over people,
enrolments, memberships, commitments and flow runs.

## Models

| Tables (flags) | Purpose |
|---|---|
| `models_model` (W, p3) | One business model: a JSON definition scoped to a team or the workspace (`docs/business-models.md`) |

## Functions worth knowing by name

- **Token hook:** `custom_access_token_hook` (must be enabled in the Supabase
  dashboard).
- **RLS helpers:** `current_user_id`, `current_workspace_id`,
  `current_workspace_role`, `is_workspace_admin`, `is_super_admin`,
  `is_platform_admin`, `has_app_membership`, `has_app_role`,
  `can_see_person`, `can_see_organisation`, `can_see_activity`.
- **Merges:** `merge_person`, `unmerge_person`, `merge_organisation`,
  `unmerge_organisation`, `person_duplicate_candidates`.
- **Money:** `workspace_meet_fee` (the plan-aware platform fee).
- **Scheduler:** `try_scheduler_lease`, `release_scheduler_lease`.
- **Connect:** `connections_landscape`, `connections_attention`.

Fifty-three functions are SECURITY DEFINER. Default privileges revoke
execute from `public` and `anon`; a new function is still born executable by
`authenticated` and needs an explicit revoke unless it is meant to be called.
`apps/api/scripts/audit-definer-functions.mjs` prints the current exposure
for either stack.
