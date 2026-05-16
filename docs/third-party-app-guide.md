# Building a third-party app on The Fibre

_Audience: an external developer (or future you) integrating an app
that lives outside the monorepo with The Fibre's contact graph._

This is the practical companion to
[`docs/cross-app-entity-mapping.md`](cross-app-entity-mapping.md).
That doc explains *why* the model looks the way it does; this one walks
you from zero to a working integration in 10 minutes. The end state:
your app's records show up linked to Fibre persons, with activity events
arriving on the workspace timeline.

For a runnable version of every step below, see
`apps/api/scripts/demo-third-party-app.mjs`.

---

## The 30-second model

Three concepts:

1. **Entity mapping** (`app_entity_mapping`) — "When my app says
   `mailchimp_subscriber`, that's a Fibre `person`. Match them on
   `email`." Declared once per workspace at install.
2. **Record link** (`app_record_link`) — "My subscriber #abc-123 *is*
   Fibre person `<uuid>`." Written at sync time, one row per record.
3. **Activity** — "My subscriber #abc-123 opened the newsletter at
   12:01." Append-only events on the Fibre timeline, referencing the
   linked person.

Everything else (manifest, scopes, slugs) is plumbing around those
three.

---

## What you'll need before you start

- An API base URL — `https://thefibre-api.fly.dev` in prod, or
  `http://localhost:8080` if you're running the monorepo locally.
- An app slug registered in `public.app`. Today this is a database
  insert (see "Registering a new app" below). External-app
  self-registration isn't built yet — talk to a workspace admin.
- A user-scoped Supabase JWT for the workspace you're integrating
  against. Same JWT the web app uses; pulled from a signed-in browser
  session via `supabase.auth.getSession()`. (A dedicated app-key
  scheme is on the roadmap — see "Open gaps" below.)
- Your app's manifest (`fibre.app.json`). Format below.

---

## Step 1 — Write the manifest

Drop this in your app's repo root as `fibre.app.json`:

```jsonc
{
  "$schema": "https://thefibre.app/schemas/fibre-app-manifest.v1.json",
  "app_slug": "mailchimp",
  "app_name": "Mailchimp",
  "version": "0.1.0",
  "description": "Newsletter audiences and engagement events.",

  "scopes_requested": [
    "read:persons",
    "write:persons",
    "write:activities"
  ],

  "entity_mappings": [
    {
      "app_entity": "mailchimp_subscriber",
      "platform_entity": "person",
      "mapping_kind": "identity",
      "match_on": ["email"],
      "description": "A subscriber IS a Fibre person; matched on email."
    }
  ],

  "activity_types": [
    { "type": "newsletter_subscribed", "subject": "Joined {audience}" },
    { "type": "newsletter_opened",     "subject": "Opened {campaign}" },
    { "type": "newsletter_clicked",    "subject": "Clicked {link}" }
  ]
}
```

The three `mapping_kind` values:
- **`identity`** — your record *is* a person/org. Use for "contact",
  "subscriber", "lead".
- **`reference`** — your record *points to* a person but isn't one. Use
  for "booking", "ticket", "support_case".
- **`curator_data`** — your record is extra fields on an existing
  person (lead score, lifecycle stage). Curator data has no separate
  write API yet, so for now leave these out of v1.

Pick `match_on` field names that uniquely identify the record on your
side. Email is the only matcher today's API understands for persons.

---

## Step 2 — Register the app + mappings

Until we ship a self-registration endpoint, a workspace admin runs:

```sql
-- 1. Add the app to the registry (one-time, global)
insert into public.app (slug, name, description)
values ('mailchimp', 'Mailchimp', 'Newsletter audiences');

-- 2. Declare entity mappings for the workspace installing the app
insert into public.app_entity_mapping
  (workspace_id, app_id, app_entity, platform_entity, mapping_kind, match_on)
select
  '<workspace-uuid>',
  (select id from public.app where slug = 'mailchimp'),
  'mailchimp_subscriber', 'person', 'identity', array['email'];

-- 3. Grant the user calling the API access to this app
insert into public.app_membership (workspace_id, user_id, app_id, role)
values ('<workspace-uuid>', '<user-uuid>',
        (select id from public.app where slug = 'mailchimp'), 'owner');
```

After this you can sanity-check via the API:

```bash
curl -H "X-App-ID: mailchimp" \
     -H "Authorization: Bearer $JWT" \
     "$API/api/v1/apps/mailchimp/manifest"
```

You should get back:

```json
{
  "app": { "id": "...", "name": "Mailchimp", "slug": "mailchimp" },
  "mappings": [
    {
      "app_entity": "mailchimp_subscriber",
      "platform_entity": "person",
      "mapping_kind": "identity",
      "match_on": ["email"],
      "registered_at": "2026-05-..."
    }
  ]
}
```

> `X-App-ID` accepts any slug present in `public.app` (cached for
> ~5 minutes, with a refresh-on-miss so a freshly-inserted app row is
> recognised on the second request). Once Step 2 inserts `mailchimp`,
> the API treats it as a first-class caller.

---

## Step 3 — Link your records as you encounter them

Every time your app sees a subscriber for the first time, link them:

```bash
curl -X POST \
  -H "X-App-ID: mailchimp" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "app_entity": "mailchimp_subscriber",
    "app_record_id": "sub_abc123",
    "match_on": { "email": "marja@example.org", "name": "Marja de Vries" },
    "create_if_missing": true
  }' \
  "$API/api/v1/apps/mailchimp/links"
```

Response:

```json
{
  "platform_id": "550e8400-e29b-41d4-a716-446655440000",
  "platform_entity": "person",
  "action": "linked"   // or "created" if create_if_missing kicked in
}
```

The endpoint is idempotent — same `(app_entity, app_record_id)` pair
upserts; you can re-run it after a re-sync without duplicating links.

If `create_if_missing` is `false` and no match exists, you get a 404 —
the app gets to decide whether to create the person or skip.

**Store the returned `platform_id` on your side.** That's the durable
key into Fibre. Future activity events reference it directly.

---

## Step 4 — Push activity events

Once a record is linked, push events:

```bash
curl -X POST \
  -H "X-App-ID: mailchimp" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "person_id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "newsletter_opened",
    "subject": "Opened May newsletter",
    "occurred_at": "2026-05-16T12:01:00Z"
  }' \
  "$API/api/v1/activities"
```

Activity is append-only. Corrections = new rows. No body payload —
type + subject only. That's how the data wall stays clean: apps cross
it via *what happened*, never *what was said*.

---

## Step 5 — Look up what Fibre knows about a record

Two flavours:

**Just the link** (cheap, indexed by primary key):
```bash
curl -H "X-App-ID: mailchimp" -H "Authorization: Bearer $JWT" \
     "$API/api/v1/apps/mailchimp/links/mailchimp_subscriber/sub_abc123"
```

**Link + full person row** (one round-trip):
```bash
curl -H "X-App-ID: mailchimp" -H "Authorization: Bearer $JWT" \
     "$API/api/v1/apps/mailchimp/persons/mailchimp_subscriber/sub_abc123"
```

The second is the one most integrations want — "give me Fibre's view
of this subscriber."

---

## A complete example

`apps/api/scripts/demo-third-party-app.mjs` runs through every step
above end-to-end against your local API:

```bash
cd apps/api
node scripts/demo-third-party-app.mjs
```

It registers a synthetic "Mailchimp" app in the default workspace,
declares the mapping, links three subscribers (two existing Fibre
persons + one created via `create_if_missing`), pushes activities, and
reads back via reverse lookup. It's idempotent — re-run as many times
as you want; nothing duplicates.

Read the script before you run it. It's deliberately ~150 lines and
mirrors the steps above one-to-one.

---

## Open gaps (what's not built yet)

- **API keys per (workspace × app).** Today you need a user JWT.
  Server-to-server keys are designed (see `docs/cross-app-entity-mapping.md`
  §"Still open") but not implemented.
- **Self-registration endpoint.** New apps go in via SQL today.
- **Bulk linking.** `POST /apps/:slug/links:bulk` for initial sync —
  not yet built; do N parallel POSTs for now.
- **Curator-data write API.** Apps that want to write extra fields on
  a person (e.g. `lead_score`) have no generic surface yet. First-party
  apps own their own tables (e.g. `person_change_context`).
- **Scope enforcement.** `scopes_requested` in the manifest is
  declarative only — not checked at request time.
- **Org mappings on `POST /links`.** Person-only today; org coming
  with the first sales integration.
- **`activity_types` in the manifest is informational.** The API
  accepts any snake_case `type` value, so anything your manifest
  declares will go through, but there's no validation that you only
  use types you declared.

If any of these block your integration, open an issue and tell us
which one — that's how the priority order gets decided.
