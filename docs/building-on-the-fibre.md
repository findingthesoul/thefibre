# Building on The Fibre

_The contract every app works to. Read this before writing a line of
integration code._

**Audience: anyone building an app that uses The Fibre** — a third-party
integration outside this monorepo, or a new in-family app inside it. Most of
this document applies to both; §7 covers where they differ.

If you only have ten minutes, read §1 and §2. They are the parts you cannot
work out from the API, and the parts that will get a design rejected if you
skip them.

**Runnable companions:** `apps/api/scripts/verify-external-app.mjs` walks the
entire external path end-to-end and asserts it; `apps/api/scripts/demo-third-party-app.mjs`
is a gentler ~150-line walkthrough of linking and activity.

---

## 1. The model

### 1.1 The data wall

The Fibre is not a database you write your app's data into. It is a platform
with a wall down the middle, and which side a piece of data lives on is not
negotiable.

**The platform owns** identity (persons, organisations, users, workspaces,
teams), the contact graph between them, the activity event log, enrolment
state, and consent.

**Each app owns** its own content — in its own schema if it is in-family, in
its own database if it is external — and, on the platform side, only the
specific curator-data fields it can justify.

Apps do not read each other's content. Not through a join, not through a
helpful shared table, not "just this once for a dashboard". If two apps need
to know the same thing, that thing is either platform data or it crosses via a
sanctioned crossing (§1.3).

The reason is not tidiness. It is that a person's data has to be explainable:
who holds what, why, and under whose consent. A wall you can see is a wall you
can answer questions about.

### 1.2 The app justifies the field

Every field stored about a person or organisation exists because a **named
app** needs it for a **stated purpose**. There is no general-purpose "extra
info" store, and there is no field that exists because it might be useful one
day.

When you propose a new field, the question is always: *which app justifies
this?* If the answer is "it'd be handy", the answer is no.

This is enforced, not merely encouraged: curator-data rows are tagged with
`app_id`, and RLS shows a user only the rows for apps they have membership
for. A person's profile is composed of an Identity tab plus one tab per app
that actually holds data on them — the tabs appear because the data does.

GDPR Article 5(1)(c) — data minimisation — by construction rather than by
policy document.

### 1.3 The three sanctioned crossings

Only three kinds of data cross between apps, and each was a deliberate
decision:

| Crossing | What moves | What does not |
|---|---|---|
| **Activity** | `type` + `subject` + `occurred_at`, against a person | Any body, payload or content |
| **Purchase ledger** | Money events: what was bought, for how much, by whom | The thing that was sold |
| **Flow definitions** | The shape of a process — steps, order, task templates | Any run's contents |

Activity is the oldest and the one you will use. It is **append-only**: a
correction is a new row, never an edit. That is enforced by a database
trigger, not by convention.

If you find yourself wanting a fourth crossing, that is a conversation to have
before you build, not a table to add.

### 1.4 Where your data lives

Your app's own content stays yours. What you put on the platform is:

- **Links** — "my record `sub_abc123` is Fibre person `<uuid>`."
- **Activity** — "something happened to that person."
- **Curator data** — the handful of platform-side fields you justified.

Everything else stays in your database. An external app therefore runs two
stores, joined by a platform uuid you hold. That uuid is not a foreign key and
cannot be one — it points into a different database, and pretending otherwise
would be a lie the schema can't enforce.

---

## 2. The rules

Non-negotiable, and the first things a reviewer checks.

1. **No personal data outside the EU boundary.** The API and database are in
   the EU. Frontends are stateless. Every operation touching personal data
   goes through the API.
2. **Identify yourself on every request** — an app key does this implicitly;
   a user-session request needs the `X-App-ID` header.
3. **RLS on every table.** Workspace scoping is mandatory; app-membership
   scoping wherever the data is app-owned. A table without a policy is a bug,
   not a to-do.
4. **Soft delete only** for personal data. `deleted_at`, never `DELETE`.
5. **Activity is append-only.** Corrections are new rows.
6. **Cursor pagination only.** No offsets.
7. **Never widen your own access.** Your scopes and your route list are the
   boundary. If you need more, ask for more — do not find a way around.

---

## 3. The manifest

`fibre.app.json` in your repo root. It is not documentation: a key can never
carry a scope the manifest didn't request, and an activity type it didn't
declare is refused at the door.

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

**The three `mapping_kind` values:**

- **`identity`** — your record *is* a person or organisation. "contact",
  "subscriber", "lead".
- **`reference`** — your record *points to* one but isn't one. "booking",
  "ticket", "support_case".
- **`curator_data`** — your record is extra fields on an existing person.
  Declarable, but nothing consumes it yet (§8) — leave it out of v1.

`match_on` names the fields that identify the record on your side. For persons
the API matches on `email`; for organisations, `domain` (preferred — the
closest thing an org has to a natural key) or `name`.

**The scope vocabulary:**

`read:persons` · `write:persons` · `read:organisations` ·
`write:organisations` · `read:activities` · `write:activities` ·
`write:curator_data` · `read:flows` · `write:flow_runs`

Ask for the narrowest set that works. Every scope is a thing an admin has to
be comfortable granting, and an unused one is a reason to say no.

---

## 4. Getting connected

### 4.1 Register

Unauthenticated, because an app registering itself has no credential yet:

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
**Admin → App registry** — seeing your description, your scopes and your
declared activity types — and approves or rejects. Nothing about your app can
act until they do.

Approval makes an app *installable*. Activation is a separate, per-workspace
decision: a workspace admin turns it on at **Settings → Apps**, the same
toggle as any first-party app.

### 4.2 Install the manifest into the workspace

This is what creates the entity mappings:

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

`GET` the same path to read back what landed.

### 4.3 Get a key

A workspace admin mints one at **Settings → Apps → your app → Manage API
keys**, ticking the scopes it should carry. They can only tick scopes your
manifest asked for.

```
fibre_ak_xLq2…
```

Shown once, never again — only its SHA-256 hash is stored, so there is no
"show it to me again" and no way for anyone to recover it. Send it as a bearer
token. You do **not** need `X-App-ID`; the key already says who you are.

```bash
curl -H "Authorization: Bearer $KEY" "$API/api/v1/apps/whoami"
# { "auth": "app_key", "app_slug": "mailchimp",
#   "workspace_id": "…", "scopes": ["read:persons", "write:activities"] }
```

What a key is bound to, precisely:

| Bound to | Meaning |
|---|---|
| **One workspace** | The one it was minted in. There is no cross-workspace key. |
| **One app** | It cannot act as another app, even on a shared endpoint. |
| **Its scopes** | Anything outside them is a 403, whatever the manifest said. |
| **A short route list** | Default deny. General platform routes (`/persons`, `/organisations`, `/flow/*`) are not reachable with an app key **at all** — they run on a user's RLS identity, and a key has none. The app-facing equivalents under `/apps/:slug/*` are what you use. |

Suspending the app, deactivating it on the workspace, or revoking the key all
take effect on the next request. There is no cache to wait out.

---

## 5. The surfaces

### 5.1 Link your records

Every time you meet a record for the first time:

```bash
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{
    "app_entity": "mailchimp_subscriber",
    "app_record_id": "sub_abc123",
    "match_on": { "email": "marja@example.org", "name": "Marja de Vries" },
    "create_if_missing": true
  }' \
  "$API/api/v1/apps/mailchimp/links"
```

```json
{ "platform_id": "550e8400-…", "platform_entity": "person", "action": "linked" }
```

Idempotent on `(app_entity, app_record_id)` — safe to re-run after a re-sync.
With `create_if_missing: false` and no match, you get a 404 and decide for
yourself whether to create or skip.

Organisations work identically; declare the mapping with
`platform_entity: "organisation"`. Note that writing an org link needs
`write:organisations` — **the required scope follows the mapping's target, not
the URL.**

For an initial sync use the bulk form, up to 500 per call:

```bash
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{ "links": [ {…}, {…}, {…} ] }' \
  "$API/api/v1/apps/mailchimp/links:bulk"
```

Partial success is the honest outcome for a batch, so every item reports its
own result and the response is `207` unless all of them landed.
`links/bulk` is an accepted alias if a colon is awkward in your HTTP client.

**Store the returned `platform_id`.** That is your durable key into Fibre.

### 5.2 Push activity

```bash
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{
    "person_id": "550e8400-…",
    "type": "newsletter_opened",
    "subject": "Opened May newsletter",
    "occurred_at": "2026-05-16T12:01:00Z"
  }' \
  "$API/api/v1/activities"
```

Type + subject only — no body, ever. The type must be one your manifest
declared; anything else is a 400 with the declared list in the response.
Because activity is append-only, a typo'd type is not something you can
quietly clean up afterwards, so you are stopped at the door instead.

### 5.3 Look up what Fibre knows

```bash
# Just the link
curl -H "Authorization: Bearer $KEY" \
     "$API/api/v1/apps/mailchimp/links/mailchimp_subscriber/sub_abc123"

# Link + the full person row, one round-trip
curl -H "Authorization: Bearer $KEY" \
     "$API/api/v1/apps/mailchimp/persons/mailchimp_subscriber/sub_abc123"
```

There is an `/organisations/…` twin for org mappings.

You can look up records **you linked**. There is no "search the workspace's
contacts" for an app key, and there should not be one without a much more
explicit consent step.

### 5.4 Run a process on Fibre Flow

Flow is the platform's sequence engine: a **flow** is steps with task
templates hanging off them, a **run** is one subject's journey through it. An
app can own runs on a flow somebody authored in Flow — which is how you get a
shared, durable process without inventing your own tables.

Two scopes: `read:flows` (list flows, read a flow's shape, read your runs) and
`write:flow_runs` (start a run, move it, tasks, notes).

There is deliberately **no `write:flows`**. An app consumes a flow; it never
authors one. Steps, transitions and gates belong to the people in Flow.

```bash
# What can I run?
curl -H "Authorization: Bearer $KEY" "$API/api/v1/apps/my-app/flow/flows"

# The published shape: steps in order, with the tasks each one seeds
curl -H "Authorization: Bearer $KEY" "$API/api/v1/apps/my-app/flow/flows/$FLOW_ID"

# Start a run. source_ref is YOUR id for the thing — pass it and creation is
# idempotent, so a retry returns the same run instead of a duplicate.
curl -X POST -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
     -d '{"subject_label":"Festival of Trust — Athens","source_ref":"'$MY_ID'"}' \
     "$API/api/v1/apps/my-app/flow/flows/$FLOW_ID/runs"
```

A run needs no person. Pass `person_id`, `organisation_id`, a plain
`subject_label`, or any combination — a project, an event or a festival is a
legitimate subject.

Reading a run gives you everything in one call: each step with its tasks, its
note, and a derived `status` — `not_started` / `in_progress` / `done`, from
the task counts.

| | |
|---|---|
| `POST /flow/runs/:id/move` | `{"step_key":"grow"}` — jump to **any** step. No gate, no ordering, no lock. |
| `POST /flow/runs/:id/tasks` | Add a task of your own, optionally under a `step_key` |
| `PATCH /flow/tasks/:id` | `{"status":"done"}` — check it off, or back on |
| `PUT /flow/runs/:id/steps/:step_key/note` | One note per step, rewritten in place; empty body clears it |
| `GET /flow/runs/:id/steps/:step_key/note` | Read it back |

**Gated or self-paced.** A flow carries a `progression` you can read on its
shape. `gated` is a state machine: a run sits on one step and only the entry
step's tasks exist until it moves. `open` is self-paced: every step's tasks
exist from run creation, and **no due dates are written at all** — a
template's `due_days_after_entry` is ignored. If your app is a companion
rather than a taskmaster, that is the one you want. Whoever authors the flow
chooses; you read it and render accordingly.

**Sections and app-defined fields.** A step may carry a `group_key` /
`group_label` pair — an optional section, for a flow long enough to need them.
Steps sharing a `group_key` belong together, in ordinal order; group on the
key, not the label, because the label is only a display string and can be
renamed. Both are `null` on a flow that doesn't group.

A step also carries `meta` — a JSON object for whatever your app needs on a
step that the platform doesn't model. The Festival planner keeps a purpose, a
trap and a reflection question there. Fibre never reads or validates the
contents; you get back exactly what was stored. It is `{}` when unset rather
than `null`, so you can read `meta.whatever` without a guard.

You cannot write either one — like the rest of a flow's shape, they belong to
whoever authors it in Flow, where the step inspector has fields for both.

Three things that hold everywhere here:

- **You see only your own runs.** Every route filters on the run's
  `source_app`. Other apps' runs, and runs people started in Flow, are
  invisible and unreachable.
- **Your note is yours.** A step can carry your app's single rewritten note
  and the append log a person keeps in Flow, without collision.
- **Steps are addressed by `key`, never uuid.** You should not have to carry
  platform identifiers you cannot interpret.

---

### 5.5 Publish a programme on The Thread

Flow runs a process; The Thread gives it a public page and takes registrations.
An app that plans something can publish it, keep the page in step as the plan
firms up, and see who signed up.

```bash
# Publish. organiser_person_id is a PERSON — you already link your organiser to
# one, and you shouldn't need to learn about platform user rows to publish.
curl -X POST -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
     -d '{"title":"Festival of Trust — Athens","format":"event",
          "slug":"athens-2026","organiser_person_id":"'$PERSON'",
          "source_ref":"'$MY_ID'"}' \
     "$API/api/v1/apps/my-app/thread/threads"

# Who registered
curl -H "Authorization: Bearer $KEY" \
     "$API/api/v1/apps/my-app/thread/threads/$THREAD_ID/enrolments"
```

| | |
|---|---|
| `GET /thread/threads` | The pages you published |
| `GET /thread/threads/:id` | One of them |
| `PATCH /thread/threads/:id` | Title, dates, intention, cover, capacity, listing, status |
| `GET /thread/threads/:id/enrolments` | Who registered, and where each registration stands |

**Publishing is idempotent on `source_ref`**, like starting a flow run: a retry
returns the page that already exists (`"created": false`) rather than a second
public page. Use the same `source_ref` on the run and the page and the two are
linked with no extra bookkeeping.

**A registration is a platform row.** `enrolment` is the registration itself;
The Thread layers the storefront, the money and the form answers on top. That is
why you can read it at all — you are reading platform data through a
Thread-shaped lens, not into another app's private tables.

**What you will never receive**, however the response grows: the registration
form `answers`, and `amount_cents`, `coupon_id`, `stripe_session_id`,
`stripe_payment_intent`. Whatever the organiser asked people on the way in is
between them and the organiser, and payment instruments are nobody's business
but The Thread's. You do get `payment_status` — a state, not an instrument.

**What you cannot do:**

- **Write an enrolment.** There is no `write:enrolments` scope. An app that
  could write them could enrol arbitrary people in arbitrary programmes, and
  that row is what the certificate and payout chain hangs off. Registration
  comes from the public form.
- **Set price, payment destination, tickets, certificates or registration
  fields.** Money and credentials belong to a human in The Thread's own UI.
- **Invent an organiser.** The person you name must have a Fibre account and a
  Thread organiser profile. A page with no human behind it is not a page.

**Reviewing applications** (`review:enrolments`, added 2026-08-30): a thread
with `requires_approval` receives applications, not enrolments. The list marks
them — `awaiting_approval` is true exactly when the organiser's decision is
what the person is waiting for ('invited' alone is ambiguous: it also means
"hasn't paid yet" on paid threads without a gate). Decide with:

```
POST /api/v1/apps/:slug/thread/enrolments/:id/approve
POST /api/v1/apps/:slug/thread/enrolments/:id/decline
```

`:id` is the enrolment row's `id` from the list. Both act only on threads the
app itself published — the same `source_app` rule as everything above. They
run the exact machinery The Thread's own buttons run: approve flips the
platform enrolment to `enrolled`, sends the confirmation, and releases the
waiting on-enrolment/on-approval messages; decline drops it and expires any
open checkout session. Both are idempotent — approving twice answers
`{ ok, already: true }`.

This is a *decision*, not a write: the person applied themselves, through the
public form. There is still no way for an app to conjure an enrolment.

Scopes: `read:programs`, `write:programs`, `read:enrolments`,
`review:enrolments`.

## 6. The stability contract

This is the part that decides whether your integration survives the platform
evolving.

### 6.1 What is a contract and what is not

Everything under **`/api/v1/apps/*`** is a published contract. It is
deliberately *not* the shape of the platform's tables — it is a shape chosen
for consumers, sitting on top of whatever the schema happens to be.

Everything else — `/api/v1/persons`, `/api/v1/flow/*`, the tables themselves —
is internal. It is unreachable with an app key precisely so that it stays free
to change.

**The promise on the contract surface: additive only.** A response key that
has shipped is permanent. Fields get added; they are not renamed, removed,
retyped, or quietly given a new meaning.

**Your side of it:** tolerate unknown fields. A response will grow keys you
have never seen. If that breaks your parser, that is your bug, not a breaking
change.

### 6.2 Why this works, with evidence

v0.16.0 was a substantial Flow change: `flow_task` gained a `step_id` column,
the derivation logic that reconstructed it was deleted, `flow_definition`
gained `progression`, and when tasks materialise changed entirely. The
contract surface came through it identical. Nothing written against
`/apps/:slug/flow/*` needed a line changed.

That is the indirection paying for itself — and it only pays as long as the
shape holds still.

### 6.3 How it is enforced

`apps/api/scripts/verify-external-app.mjs` asserts the response shape of every
app-facing route (`CONTRACT_SHAPES`, step 7b). Remove or rename a key and the
run fails. The check earns its keep: it caught a wrong assumption on its very
first execution.

There is a matching `THE CONTRACT` block at the top of
`apps/api/src/routes/app-flow.ts`. If you are changing that file, read it
first.

### 6.4 When a break is genuinely unavoidable

Do not break it quietly. Add a second, versioned path alongside the old one
and let the manifest declare which an app expects. That has not been needed
yet, and it should not be built until it is.

### 6.5 What the contract cannot do for you

It protects you from *how* the platform changes, not from *what it gains*. A
genuinely new concept — a new grouping on steps, a new field a step carries —
has to appear in the response before you can use it. No layer invents
something that was not there.

So: platform releases will not break you. Platform releases that add
capability you want still mean work on your side. Those are different events,
and only the second one should ever be on your roadmap.

---

## 7. In-family apps: what differs

An app inside this monorepo (Meet, Thread, Flow, Pulse) follows §1 and §2
exactly the same way. What changes is the plumbing:

| | In-family | External |
|---|---|---|
| **Auth** | The user's Supabase JWT + `X-App-ID` | An `app_key`, no user present |
| **Enforcement** | RLS, on the user's identity | Route allow-list + scopes, then explicit workspace filtering in the handler |
| **Its own content** | Its own schema in the platform database | Its own database entirely |
| **Platform tables** | Uses `person` / `team` / `workspace` **natively** | Reaches them through links |
| **Registration** | A migration adds the row | `POST /apps/register` and an admin approves |

The one that trips people up: **in-family apps do not use
`app_entity_mapping`.** They share the platform's own tables directly. Entity
mapping exists for apps whose records live somewhere else. Using it in-family
means you have built a second identity system alongside the real one.

An in-family app also gets to add curator-data fields on persons and
organisations — under §1.2, and no further.

---

## 8. What is not built yet

- **Curator-data write API.** An app that wants to annotate a person (lead
  score, lifecycle stage) has no generic surface. A manifest can declare a
  `curator_data` mapping; nothing consumes it.
- **Key expiry.** Keys do not expire and nothing nags an admin to rotate one.
  `last_used_at` is shown, so an unused key is at least visible.
- **Webhooks out.** Fibre does not call you. You poll, or you push.
- **Reading persons beyond your own links.** Deliberate, see §5.3.
- **First-party manifests.** Meet, Thread, Flow and Pulse declare no
  `activity_types`, so they keep the permissive path on `POST /activities`.
  Declaring them would extend the typo guard to our own apps.

If one of these blocks you, say which — that is how the order gets decided.

---

## 9. Verifying

```bash
cd apps/api
FIBRE_VERIFY_CONFIRM=1 node scripts/verify-external-app.mjs
```

Walks the whole path — register, approve, activate, mint, link a person *and*
an organisation, emit activity, own runs on a flow it did not author, assert
every published response shape, and lose everything on suspension.

The opt-in is deliberate: there is one Supabase project, so the script always
writes to a real workspace. It cleans up after itself, except for the two rows
the platform's own rules make permanent — an append-only activity row, and the
person it pins (soft-deleted). Read the script header before running it.

**If you change anything in this document, run that script.** It is the
executable version of the same claims.

---

## Further reading

- [`fibre-technical-brief-v0.4.md`](fibre-technical-brief-v0.4.md) — the
  canonical spec. §2 data wall, §5 data model, §6 ownership, §13 developer
  rules.
- [`cross-app-entity-mapping.md`](cross-app-entity-mapping.md) — why the
  mapping model looks the way it does.
- [`brief-external-apps.md`](brief-external-apps.md) — the half-failed
  integration attempt that produced most of §4.
- [`brief-flow-as-planner-engine.md`](brief-flow-as-planner-engine.md) — why
  Flow is consumable rather than copied.
