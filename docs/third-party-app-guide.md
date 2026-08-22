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
- An app slug, registered through `POST /api/v1/apps/register` and
  approved by a Fibre admin (Step 2). No SQL, no platform migration.
- An **app key** — a credential scoped to one app in one workspace,
  minted by a workspace admin (Step 2b). It needs no browser session,
  so background sync and scheduled jobs work.
- Your app's manifest (`fibre.app.json`). Format below. It is not
  decorative: a key can never carry a scope the manifest didn't ask
  for, and an activity type it didn't declare is refused.

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

## Step 2 — Register the app

Registration is an unauthenticated POST — an app registering itself has
no credential yet, by definition:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d @fibre-registration.json "$API/api/v1/apps/register"
```

```jsonc
{
  "app_slug": "mailchimp",
  "app_name": "Mailchimp",
  "description": "Newsletter audiences and engagement events.",
  "homepage_url": "https://example.com/fibre-connector",
  "contact_email": "dev@example.com",
  "manifest": { /* the contents of fibre.app.json */ }
}
```

That lands a row with `status = 'pending'`. A Fibre admin reviews it at
**Admin → App registry**, where they see your description, the scopes
you asked for and the activity types you declared, and either approves
or rejects. Nothing about your app can act until they do.

Once approved, a workspace admin turns it on at **Settings → Apps** —
the same toggle as any first-party app. Approval makes an app
installable; activation is a separate, per-workspace decision.

Then install the manifest into that workspace, which is what creates
the entity mappings:

```bash
curl -X PUT -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{
    "entity_mappings": [
      { "app_entity": "mailchimp_subscriber",
        "platform_entity": "person",
        "mapping_kind": "identity",
        "match_on": ["email"] }
    ],
    "activity_types": [{ "type": "newsletter_opened" }]
  }' \
  "$API/api/v1/apps/mailchimp/manifest"
```

And sanity-check:

```bash
curl -H "Authorization: Bearer $KEY" \
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

---

## Step 2b — Get a key

A workspace admin mints one at **Settings → Apps → your app → Manage
API keys**, ticking the scopes it should carry. They can only tick
scopes your manifest asked for.

```
fibre_ak_xLq2…
```

The token is shown once and never again — only its SHA-256 hash is
stored, so there is no "show it to me again" and no way for us to
recover it. Send it as a bearer token; you do **not** need `X-App-ID`,
because the key already says which app you are:

```bash
curl -H "Authorization: Bearer $KEY" "$API/api/v1/apps/whoami"
# { "auth": "app_key", "app_slug": "mailchimp",
#   "workspace_id": "…", "scopes": ["read:persons", "write:activities"] }
```

What a key can do, precisely:

| Bound to | Meaning |
|---|---|
| **One workspace** | The one it was minted in. There is no cross-workspace key. |
| **One app** | It cannot act as another app, even on shared endpoints. |
| **Its scopes** | Anything outside them is a 403, whatever the manifest said. |
| **A short route list** | General platform routes (`/persons`, `/organisations`) are not reachable with an app key at all — they run on a user's RLS identity, and a key has none. |

Suspending the app, deactivating it on the workspace, or revoking the
key all take effect on the next request. There is no cache to wait out.

The scope vocabulary:

`read:persons` · `write:persons` · `read:organisations` ·
`write:organisations` · `read:activities` · `write:activities` ·
`write:curator_data`

---

## Step 3 — Link your records as you encounter them

Every time your app sees a subscriber for the first time, link them:

```bash
curl -X POST \
  -H "Authorization: Bearer $KEY" \
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

**Organisations work the same way.** Declare a mapping with
`platform_entity: "organisation"` and match on `domain` (preferred — it
is the closest thing an org has to a natural key) or `name`:

```json
{
  "app_entity": "mailchimp_account",
  "app_record_id": "acct_991",
  "match_on": { "domain": "ebbf.org", "name": "EBBF" },
  "create_if_missing": true
}
```

Writing an organisation link needs `write:organisations`, not
`write:persons` — the required scope follows the mapping's target, not
the URL.

**For an initial sync, use the bulk form** rather than N parallel
POSTs. Up to 500 links per call, the same body shape per item:

```bash
curl -X POST -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{ "links": [ {…}, {…}, {…} ] }' \
  "$API/api/v1/apps/mailchimp/links:bulk"
```

Partial success is the honest outcome for a batch, so every item
reports its own result and the response is `207` unless all of them
landed. `links/bulk` is accepted as an alias if the colon form is
awkward in your HTTP client.

**Store the returned `platform_id` on your side.** That's the durable
key into Fibre. Future activity events reference it directly.

---

## Step 4 — Push activity events

Once a record is linked, push events:

```bash
curl -X POST \
  -H "Authorization: Bearer $KEY" \
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

**The type must be one your manifest declared.** Anything else is a
400 with the declared list in the response. Because activity is
append-only, a typo'd type isn't something you can quietly clean up
afterwards — better to be stopped at the door.

---

## Step 5 — Look up what Fibre knows about a record

Two flavours:

**Just the link** (cheap, indexed by primary key):
```bash
curl -H "Authorization: Bearer $KEY" \
     "$API/api/v1/apps/mailchimp/links/mailchimp_subscriber/sub_abc123"
```

**Link + full person row** (one round-trip):
```bash
curl -H "Authorization: Bearer $KEY" \
     "$API/api/v1/apps/mailchimp/persons/mailchimp_subscriber/sub_abc123"
```

There is an `/organisations/…` twin of that route for org mappings.

The person form is the one most integrations want — "give me Fibre's
view of this subscriber."

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

## Verifying the whole path

`apps/api/scripts/verify-external-app.mjs` runs the six steps from
`docs/brief-external-apps.md` end-to-end against a live API — register,
approve, activate, mint a key, link a person *and* an organisation,
emit activity, and get refused for a scope it doesn't hold. It uses a
throwaway slug and cleans up after itself.

```bash
cd apps/api
node scripts/verify-external-app.mjs
```

If you change anything in this document, run that script. It is the
executable version of the same claims.

`apps/api/scripts/demo-third-party-app.mjs` is the older, gentler walk
through the same territory using a user JWT.

---

## Open gaps (what's not built yet)

- **Curator-data write API.** Apps that want to write extra fields on
  a person (e.g. `lead_score`) have no generic surface yet. First-party
  apps own their own tables (e.g. `person_change_context`). A manifest
  can declare a `curator_data` mapping, but nothing consumes it.
- **Reading persons beyond your own links.** `read:persons` gets you
  the person behind a record *you* linked. There is no "search the
  workspace's contacts" surface for an app key, and there probably
  shouldn't be one without a much more explicit consent step.
- **Webhooks out.** Fibre doesn't call you; you poll or push.
- **Key expiry.** Keys don't expire and nothing nags you to rotate
  one. `last_used_at` is shown so an admin can spot a key nobody uses.

If any of these block your integration, open an issue and tell us
which one — that's how the priority order gets decided.
