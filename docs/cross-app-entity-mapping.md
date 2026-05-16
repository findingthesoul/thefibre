# Cross-app entity mapping — design proposal

_Draft, 2026-05-17. For discussion before any code._

## The question

> "A third party app: do we need an interface to connect info items from one app to the other? Like a contact in App A is Contact in Fibre. A Right in App X is a Right in Fibre… So that we can connect apps easily? Then maybe this needs to be done for our own apps too." — Sjoerd

Yes. And yes — same machinery applies to our own apps. We're building this anyway as soon as an external app wants to integrate; doing it now also disciplines our own architecture.

---

## What problem this actually solves

When two apps both have a concept of "contact" / "user" / "right" / "deal" / "session" / etc., one of three things has to happen:

1. **Each app keeps its own version.** Sjoerd shows up as a row in HubSpot, a row in Mailchimp, a row in The Fibre. No connection. Duplication + drift + privacy nightmare.

2. **One app is the source of truth and others sync.** HubSpot is "the CRM"; everything pulls from it. Brittle, vendor lock, doesn't compose.

3. **A platform owns the canonical entities; apps map their concepts to platform entities.** Apps store the bits *they* justify (per the brief), tagged with `app_id`, but the *identity* lives on the platform. This is The Fibre's design.

We've already done this implicitly for our own apps:
- Meet's `meet_booking.invitee_person_id` → `public.person`
- Meet's `meet_team_member.user_id` → `public.user`
- The Thread will do the same with `programme_enrolment.person_id`.

What we **haven't** done is formalise it so:
- A third-party app installing into a workspace can declare its mapping
- An admin can see / confirm / adjust the mapping
- The platform can render a person's profile by aggregating from all mapped apps

This doc formalises that.

---

## The model: entities, mappings, links

### Canonical platform entities

These already exist in `public.*`:

| Platform entity | Purpose |
|---|---|
| `person` | A human in the contact graph |
| `organisation` | A formal or informal org |
| `user` | A signed-in human (subset of `person`) |
| `workspace` | The tenant (= organisation account) |
| `activity` | The append-only event log |
| `relationship` | Person ↔ person edges (the contact graph) |
| `org_membership` | Person ↔ organisation edges |

We're adding nothing new at this layer. **Apps map to these.**

### App-side entities

Each app declares the entities it owns. Some examples:

| App | Entity it owns | Maps to platform entity? |
|---|---|---|
| Fibre Meet | `meet_meeting_type` | No (Meet's own concept) |
| Fibre Meet | `meet_booking` | Yes — `invitee_person_id` → `person`, `host_id` → indirectly via `user` |
| Fibre Meet | `meet_team` | No (Meet's own concept) |
| Fibre Meet | `meet_team_member.user_id` | Yes → `user` |
| Fibre Sales | `sales_deal` | No (Sales's own concept) |
| Fibre Sales | `sales_deal.lead_person_id` | Yes → `person` |
| Fibre Sales | `sales_deal.account_org_id` | Yes → `organisation` |
| HubSpot (3p) | `hubspot_contact` | Yes → `person` |
| HubSpot (3p) | `hubspot_company` | Yes → `organisation` |
| HubSpot (3p) | `hubspot_deal` | No (HubSpot's own concept) |
| HubSpot (3p) | `hubspot_contact_property` | No (curator-data field on `person`) |
| Mailchimp (3p) | `mc_audience_member` | Yes → `person` |

The pattern:
- App entities that **identify a human or organisation** map to platform `person`/`organisation`/`user`.
- App entities that are **app-internal** stay in their own tables.
- App entities that are **fields on a platform entity** become curator-data tagged with `app_id`.

### The mapping table

```sql
create table public.app_entity_mapping (
  workspace_id        uuid not null references public.workspace(id) on delete cascade,
  app_id              uuid not null references public.app(id) on delete cascade,
  app_entity          text not null,                 -- e.g. "hubspot_contact"
  platform_entity     text not null
                        check (platform_entity in ('person','organisation','user','activity')),
  mapping_kind        text not null
                        check (mapping_kind in ('identity','curator_data','reference')),
  registered_at       timestamptz not null default now(),
  primary key (workspace_id, app_id, app_entity)
);
```

- `identity` — this app entity *is* a platform entity. E.g. HubSpot's contact resolves to a Fibre person.
- `curator_data` — this app entity is fields attached to a platform entity. E.g. HubSpot's `lead_score` is a curator field on `person`.
- `reference` — this app entity references a platform entity but isn't *itself* one. E.g. `meet_booking.invitee_person_id` references `person`; the booking isn't a person.

### The per-record link table

```sql
create table public.app_record_link (
  workspace_id     uuid not null references public.workspace(id) on delete cascade,
  app_id           uuid not null references public.app(id) on delete cascade,
  app_entity       text not null,                  -- "hubspot_contact"
  app_record_id    text not null,                  -- HubSpot's contact id, as a string
  platform_entity  text not null
                     check (platform_entity in ('person','organisation','user')),
  platform_id      uuid not null,                  -- public.person.id, etc.
  linked_at        timestamptz not null default now(),
  linked_by        uuid references public."user"(id),
  primary key (workspace_id, app_id, app_entity, app_record_id)
);
create index app_record_link_platform on public.app_record_link (platform_entity, platform_id);
```

One row per (app record ↔ platform entity) pair. The unique key prevents a HubSpot contact from being linked to two different Fibre people. The reverse index makes "what apps know about this person?" a single indexed lookup.

This replaces a scatter of FK columns. Apps that want strong typing can still have FK columns (e.g. `meet_booking.invitee_person_id`) — but for 3rd party apps where the platform doesn't even know the source table exists, the link table is the integration surface.

---

## How an app declares its mapping

At install (workspace activates the app) we run the app's **manifest**:

```jsonc
// example manifest for a hypothetical HubSpot connector
{
  "app_slug": "hubspot",
  "app_name": "HubSpot",
  "version": "1.0.0",
  "scopes_requested": ["read:persons", "write:persons", "read:activities"],

  "entity_mappings": [
    {
      "app_entity": "hubspot_contact",
      "platform_entity": "person",
      "mapping_kind": "identity",
      "match_on": ["email"],
      "curator_fields": ["lead_score", "lifecycle_stage", "owner_email"]
    },
    {
      "app_entity": "hubspot_company",
      "platform_entity": "organisation",
      "mapping_kind": "identity",
      "match_on": ["domain"]
    }
  ],

  "activity_types": [
    { "type": "hubspot_form_submitted", "subject": "Form submission" },
    { "type": "hubspot_email_opened",   "subject": "Email opened" }
  ]
}
```

The platform admin reviews + approves the manifest. We persist the mappings to `app_entity_mapping` and the manifest itself to `app_manifest`.

For our own apps: same machinery. Meet's manifest declares:

```jsonc
{
  "app_slug": "fibre-meet",
  "entity_mappings": [
    {
      "app_entity": "meet_booking",
      "platform_entity": "person",
      "mapping_kind": "reference",
      "references_via": "invitee_person_id"
    }
  ],
  "activity_types": [
    { "type": "meeting_booked",     "subject": "Booked a meeting" },
    { "type": "meeting_cancelled",  "subject": "Cancelled" },
    { "type": "meeting_attended",   "subject": "Attended" }
  ]
}
```

Manifests live as `apps/<app>/fibre.app.json` checked in alongside the code. The platform reads them at startup for built-in apps; third-party apps deliver theirs at install via an HTTP endpoint.

---

## How records get linked at runtime

For each `identity` mapping the app declares, it must call:

```
POST /api/v1/apps/:app_slug/links
{
  "app_entity": "hubspot_contact",
  "app_record_id": "12345",
  "match_on": { "email": "sjoerd@soul.com" }
}
```

The platform does:
1. Look up `public.person` in this workspace by the `match_on` fields.
2. If found → write `app_record_link` row → return `{ platform_id, action: "linked" }`.
3. If not found → create a new `public.person`, link it, return `{ platform_id, action: "created" }`.

Bulk variant for initial sync: `POST /apps/:app_slug/links:bulk` with an array. Same semantics per record; returns per-record status.

Once linked, the app can:
- Push curator-data fields: `PATCH /api/v1/persons/:id/curator-data/:app_slug { lead_score: 87 }`
- Push activities: `POST /api/v1/activities { person_id, type: "hubspot_form_submitted", ... }`
- Pull the platform's view of a person it knows: `GET /api/v1/persons/by-app-link/:app_slug/hubspot_contact/12345`

---

## UI surfaces

### App install / manifest review

When an admin clicks **Install** for a new app, before activating they see a "What this app will know about your contacts" review:

```
HubSpot will:
- Identify Contacts as Fibre People (matched on email)
  - With these extra fields on each Person: lead_score, lifecycle_stage, owner_email
- Identify Companies as Fibre Organisations (matched on domain)
- Write activities of types: hubspot_form_submitted, hubspot_email_opened
- Read: persons, activities
- Write: persons, activities

[Approve and install]  [Cancel]
```

Once approved, the install records the mappings + scopes. Per-scope grants live in `app_membership.permissions` (already a `jsonb`).

### Per-person, "What other apps know about them"

On a person's profile in `apps/web/app/(app)/contacts/[id]/`, a tab per active app installed in the workspace. Each tab shows the curator data that app justifies + a link to the underlying app's view (`GET /apps/:app_slug/contacts/:id/external-link`).

The `app_record_link` table powers this: "what apps have a row for this person?".

### Admin: review entity mappings

`/settings/apps/:app_slug` shows the live entity mappings for an installed app: what app entities map to what platform entities, with how many records linked. Audit + sanity check surface.

---

## Why this is worth doing now (not later)

Three reasons:

1. **It disciplines our own apps.** Today's `meet_team_member.user_id` is implicit cross-app linking. If we formalise the pattern early, future apps follow it without re-inventing.

2. **It's the only way third-party apps cleanly integrate.** Without an entity-mapping contract, every integration is bespoke — the platform stays "internal."

3. **It's the contract Sjoerd needs to ask "who's allowed to know what about whom?"** The mapping + link tables surface the answers. Privacy gets easier, not harder, when relationships are explicit.

---

## Open questions

1. **Match-on rules** — for identity mappings, what fields are acceptable? Email is the obvious one; domain for orgs. Should we allow custom fields ("hubspot.external_id matches some Fibre custom field")?
2. **Conflicts** — what if HubSpot contact `12345` and Mailchimp member `xyz` both claim the same Fibre person? Today that's fine (multiple `app_record_link` rows pointing at the same `platform_id`). But what if the *emails* of those two app records *diverge* over time? Re-link or fork?
3. **Soft-delete on the platform side** — if a Fibre person is deleted, what happens to their `app_record_link` rows? Cascade-delete (clean) or keep-and-mark-stale (apps can still surface their data)?
4. **Privacy of curator-data per app** — today an app's curator-data is visible to anyone with platform read access. Should we let apps gate their fields per `relationship_type` (so HubSpot's `lead_score` is internal-only)?
5. **Versioning of manifests** — when an app upgrades and changes its entity mappings, what do we do with existing `app_record_link` rows? Run a migration step in the manifest upgrade?
6. **The reverse direction** — can the platform *push* changes to apps? Today apps poll or call the API; webhooks from the platform to apps is a separate thing. Worth thinking about for "person updated their email" events.

---

## My recommendation

**Do the table + manifest shape now.** It's two tables (`app_entity_mapping`, `app_record_link`) + a manifest format. The UI can wait. Even just having the tables means new apps + new integrations follow the contract instead of inventing.

**Defer:** the per-person "other apps" tab, the install-review screen, the per-scope permission UI. Those land when we wire the first 3rd-party connector.

If you say go, I draft the tables + manifest format + the two API endpoints (`POST /apps/:slug/links`, `GET /persons/by-app-link/...`) in one commit. Migrating existing Meet entities to use `app_record_link` is a follow-up that doesn't touch behaviour.
