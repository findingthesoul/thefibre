# Fibre vs app data — the two-list contract

_Draft, 2026-05-17. Concretises §2 ("the data wall") of the technical brief._

Two lists, kept apart. Everything in The Fibre is one or the other.

## List 1 — Fibre (platform-owned, given to every app)

Identity, the contact graph, and the cross-app event log live here. Every app can read from these (subject to permission tiers); only the platform writes them. They are the "given data sets" every app gets when it joins a workspace.

### Entities

| Entity | What it carries | Notes |
|---|---|---|
| `person` | first_name, last_name, email, phone, location, timezone, preferred_language, photo_url | The human in the contact graph. Anyone an app touches gets a row. |
| `organisation` | name, slug, domain, kind (formal/informal), description, photo_url | The tenant. Persons belong to one or more orgs via `org_membership`. |
| `user` | workspace_id, person_id, email, full_name, avatar_url, email_verified, primary_auth_method | Signed-in human. Every user has a paired person. |
| `workspace` | name, slug, primary_email_domain | The tenant container. Equivalent to "organisation account" in user-facing language. |
| `relationship` | person_a, person_b, type, since, ended_at | Person ↔ person edges (the contact graph). |
| `org_membership` | person_id, organisation_id, role, since | Person ↔ organisation edges. A person can be in many orgs. |
| `activity` | person_id?, organisation_id?, app_id, type, subject, occurred_at | Append-only, type + subject only. The cross-app event log. |
| `app` | slug, name, description | Catalogue of every app the platform knows about. |
| `app_membership` | user_id, app_id, role, permissions | A user has access to an app. |
| `workspace_app` | workspace_id, app_id, deactivated_at? | An org has activated an app. |
| `workspace_member` (proposed) | user_id, workspace_id, workspace_role, relationship_type, member_status | Per-(user, org) attributes. See `permission-tiers-proposal.md`. |
| `consent` | person_id, scope, granted_at, revoked_at | GDPR consent records. |
| `app_entity_mapping` (proposed) | workspace_id, app_id, app_entity, platform_entity, mapping_kind | App declares: "my X = Fibre Y". See `cross-app-entity-mapping.md`. |
| `app_record_link` (proposed) | workspace_id, app_id, app_entity, app_record_id, platform_entity, platform_id | Per-record link rows. |
| `signup_request`, `audit_log`, `user_identity_provider`, … | platform-internal — apps don't touch these. | |

### Standard activity-type vocabulary (platform-emitted)

These are emitted by the platform itself, not by apps. Any app can read them.

| Type | Subject | Emitted when |
|---|---|---|
| `person_created` | "Joined the workspace" | A new person row lands. |
| `person_updated_identity` | "Updated identity" | name/email/phone/etc changes. |
| `person_archived` | "Archived" | Soft-delete. |
| `organisation_created` | "Created" | New org. |
| `org_membership_added` | "Joined {org}" | Person joins an org. |
| `org_membership_removed` | "Left {org}" | Person leaves. |
| `relationship_added` | "Connected to {person}" | New relationship edge. |
| `relationship_ended` | "Connection ended" | Edge closed. |
| `user_signed_in` | "Signed in" | First sign-in or after >30 days. |
| `workspace_app_activated` | "{App} activated" | Workspace installs an app. |
| `workspace_app_deactivated` | "{App} deactivated" | Workspace uninstalls. |
| `app_membership_granted` | "Granted access to {app}" | A user gets app access. |
| `app_membership_revoked` | "Revoked access to {app}" | A user loses app access. |
| `consent_granted`, `consent_revoked` | "{Scope} consented / revoked" | GDPR events. |

Apps can subscribe to these in their manifest (future feature) or just query the activity log.

### Curator-data convention (per brief §5)

Any app can attach extra fields to platform entities, tagged with `app_id`. The platform doesn't validate the shape; the app does. RLS gates visibility to users who have app-membership for that app. This is how, e.g., Fibre Sales attaches a `pipeline_stage` to a person without polluting the platform schema.

A future `person_curator_data(person_id, app_id, data jsonb)` table will formalise this. For now, each app makes its own per-person side table (e.g. `sales_person_data`). Same shape, less generic.

---

## List 2 — App-private (specific to the app, never crosses the wall)

Each app owns a set of tables that no other app reads. They are the app's own working memory. They reference platform entities (via FK or via `app_record_link`) but are not part of the contact graph.

### Fibre Meet

| Table | What it carries |
|---|---|
| `meet_host` | A user's per-host config (slug, timezone, working_hours, google_refresh_token, bio, location, personal_room_url, photo_url). |
| `meet_meeting_type` | A bookable offering. Includes overrides (`working_hours_override`, `conflict_calendar_ids`) and the `event_type` (one_on_one / round_robin / collective / group). |
| `meet_meeting_type_assignee` | Multi-host routing roster. |
| `meet_booking` | A booking. References `person` via `invitee_person_id` (the only platform link). |
| `meet_team` | A team within Meet (booking link + members). |
| `meet_team_member` | (team, user, role, status, invite_token). |
| `meet_calendar` | Synced Google calendar with a role per row. |
| `meet_root_slug` | Workspace-scoped slug namespace shared by hosts + teams. |
| `meet_intake_form` | Structured questions on a meeting type. |

**Activity types Meet emits:**

| Type | Subject |
|---|---|
| `meeting_booked` | "Booked {meeting type}" |
| `meeting_cancelled` | "Cancelled" |
| `meeting_rescheduled` | "Rescheduled" |
| `meeting_attended` (future) | "Attended" |
| `meeting_no_show` (future) | "No-show" |

**Cross-wall surface** (the only things Meet pushes into the platform side):
- Insertions into `public.person` for new invitees.
- Insertions into `public.activity` for the types above.
- `app_record_link` rows linking `meet_booking.invitee_person_id` to `public.person` (already implicit; will be formalised via the mapping table).

### The Thread (skeleton today; schema lands when it's built out)

| Table | What it carries |
|---|---|
| `programme` | A learning journey / event / cohort. |
| `programme_session` | A single date in the programme. |
| `programme_enrolment` | (programme, person, status, progress). |
| `programme_attendance` | (session, person, attended_at). |

**Activity types:**

| Type | Subject |
|---|---|
| `enrolment_created` | "Enrolled in {programme}" |
| `session_attended` | "Attended {session}" |
| `programme_completed` | "Completed {programme}" |

### Fibre Sales (future)

| Table | What it carries |
|---|---|
| `sales_pipeline` | A pipeline definition. |
| `sales_stage` | Stages within a pipeline. |
| `sales_deal` | A deal (references `person`, `organisation`). |
| `sales_account` | Per-org sales config. |

**Activity types:** `deal_created`, `deal_stage_moved`, `deal_won`, `deal_lost`, `deal_invoice_sent`.

### Fibre Updates (newsletter app — future)

| Table | What it carries |
|---|---|
| `updates_list` | A subscriber list. |
| `updates_subscription` | (list, person, status). |
| `updates_send` | A campaign send. |

**Activity types:** `updates_subscribed`, `updates_unsubscribed`, `updates_email_opened`, `updates_link_clicked`.

### Third-party apps (HubSpot, Mailchimp, Stripe, …)

Each declares its own private entities in its manifest. Examples:

- **HubSpot**: `hubspot_deal` (private), `hubspot_workflow` (private), `hubspot_email_thread` (private). Plus `hubspot_contact` and `hubspot_company` which **do** cross the wall (they map to platform entities).
- **Mailchimp**: `mc_campaign` (private), `mc_template` (private). `mc_audience_member` crosses (maps to person).
- **Stripe**: `stripe_subscription` (private), `stripe_invoice` (private). `stripe_customer` crosses (maps to person OR organisation, depending on what Stripe is invoicing).

---

## The contract, restated

For every entity in your app, decide which list it's on:

| Question | List 1 (Fibre) | List 2 (App) |
|---|---|---|
| Does it identify a human or an org? | **Yes** — map to `person` or `organisation` via `app_entity_mapping` | No |
| Does it represent a fact about a human/org that other apps would benefit from? | **Yes** — emit as an `activity` row | No |
| Is it a label/score/status the app attaches to a person? | **Yes** — store as curator-data tagged with `app_id` | No |
| Is it internal bookkeeping (a meeting type, a campaign template, a deal-stage definition)? | No | **Yes** — keep in your own tables |
| Is it private to one user's working memory? | No | **Yes** — keep in your own tables, RLS-scope to that user |

If you're not sure, default to **List 2**. It's cheaper to promote later than to demote.

---

## What the platform owes apps (and vice versa)

**Platform → apps:**
- Stable read API for List 1 entities, scoped by RLS.
- Stable write API for `activity` and `app_record_link`.
- Push events when a person/org changes (future webhooks).
- Standard activity-type vocabulary they can reuse.

**Apps → platform:**
- A manifest declaring what entities they map, what activity types they emit, what curator fields they write.
- An auth scope per data type they want to read/write.
- A webhook endpoint for the platform to call them when a person they care about changes (future).

---

## Where this lands

This doc is **descriptive** of how we've been building so far + **prescriptive** for the cross-app mapping work proposed in `docs/cross-app-entity-mapping.md`. Together they're the brief-amendment material for §2 / §5 ("the data wall" + "the app justifies the field"). When the brief gets to v0.5, fold these in.

Until then: when a new app gets scoped (sales, updates, a third-party), build it by writing its List 1 / List 2 first. That's the design checkpoint — agreeing on what crosses the wall and what doesn't.
