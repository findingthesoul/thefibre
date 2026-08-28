# Brief — an event, settable from the app that owns it

_Written 2026-08-28, from the Festival of Trust planner publishing its first
event._

A festival is now a draft thread. What the planner cannot do is describe it:
every setting an organiser would reach for lives in The Thread's own UI, behind
a workspace login the festival's organiser does not have.

Most of the columns already exist. This is mostly about exposure, plus two
genuinely new things.

## 1. A host on the festival should be a host on the thread — the real gap

The planner invites collaborators to a festival. They sign in to the planner's
own database. On the thread they appear nowhere: Hosts & Facilitators shows
only "Festival of Trust — Organiser".

`thread_thread_organiser` takes an `organiser_id` referencing
`thread_organiser`, which requires a Fibre `user`. The invite dropdown in the UI
says "Choose a workspace member…", which is the same assumption. A festival host
is neither, and will never be.

This is the shape already settled for the primary organiser in v0.18.9: an app
names a **person**, the platform resolves the rest. The same answer applies
here.

**Suggested shape**

```
POST /apps/:slug/thread/threads/:id/hosts
{ "person_id": "…", "role": "co_organiser" | "facilitator" }
```

The open question is what a host without a Fibre account resolves *to*, since
`thread_thread_organiser.organiser_id` must point at a `thread_organiser`
row and that needs a user. Two options:

1. **Derive a `thread_organiser` for them**, as v0.18.9 does for the workspace.
   Cheap, consistent — but it gives a storefront to someone who never asked for
   one, and `thread_organiser.user_id` is `not null unique`, so it cannot be
   done for a person with no user at all.
2. **Let a thread credit a person directly** — a `thread_thread_person` row, or
   `person_id` nullable alongside `organiser_id`. Honest about the difference
   between "runs sessions here" and "has a storefront". More schema.

(2) looks right, and (1) is not actually available given the `not null` on
`user_id`. Worth deciding before either is built.

## 2. Fields that exist and the app cannot set

`PatchThread` on the app surface accepts eight fields. These columns are all
already on `thread_thread` and are not among them:

| Column | What the planner needs it for |
|---|---|
| `timezone` | the festival's own, not Europe/Amsterdam by default |
| `language` | the festival's language |
| `requires_approval` | "people apply, we admit" vs open enrolment |
| `public_interaction` | `page` or `popup` — the Luma-style enrol popup |
| `share_participants_public` | whether visitors' names show publicly |
| `share_participants_participants` | whether participants see each other |
| `price_cents` / `price_currency` | free events: explicit null, not unset |

Adding them to `PatchThread` is the whole change. No schema, no new route.

One caution: `registration_fields` should **not** be opened up in the same pass.
It shapes what is asked of a registrant, and the data wall exists precisely so
an app does not reach into that.

## 3. Opening enrolment should be one act with one name

Today `status` moves draft → active, and nothing in the vocabulary says that
this is the moment people may sign up. From the planner's side there is one
decision — "welcome subscriptions" — and it means: the page is live and
enrolment is open.

Not asking for a new column. Asking that `status: 'active'` be documented as
exactly that, and named that way in the UI, so the two systems do not drift
into meaning different things by "live".

## 4. Event type as a design template — genuinely new

The ask: a dropdown of event types in settings; picking one gives the public
event page that template's design.

Nothing like it exists. `thread_certificate_template` is for certificates and is
not a precedent for page design.

**Suggested shape**

```sql
create table public.thread_event_template (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspace(id) on delete cascade,  -- null = platform-wide
  key           text not null,
  name          text not null,
  design        jsonb not null default '{}'::jsonb,
  unique (workspace_id, key)
);

alter table public.thread_thread
  add column event_template_id uuid references public.thread_event_template(id);
```

Two seeded to start with — Sjoerd will make them detailed later; anything
plausible will do for now. `design` deliberately opaque: layout, palette,
whether the agenda shows. The renderer decides what it honours, and an unknown
key is ignored rather than an error, so a template can gain fields without a
migration.

Then `event_template_id` joins the `PatchThread` list in §2.

## 5. The event page from this information

Once §2 and §4 land, the public page has everything it needs without the
organiser opening The Thread at all: title, intention, start date, timezone,
language, cover, template, whether enrolment is open, whether it needs approval,
whether names are shown, and the enrol popup. Free is `price_cents = null`.

The planner would then mirror these as its own settings screen and PATCH them.
That is the test of whether this brief is complete: an organiser who never signs
in to Fibre can still publish a finished event page.

## Order

1. §2 — hours, unblocks the planner's settings screen immediately.
2. §1 — decide the host question first; it is the one with a real design choice.
3. §4 — templates.
4. §3 — naming, whenever §2 ships.

## Reference

- `apps/api/src/routes/app-thread.ts` — `PatchThread`, and the organiser
  resolution changed in v0.18.9.
- `supabase/migrations/20260701090000_thread_schema.sql` — `thread_thread`,
  `thread_thread_organiser`.
- `20260702160000_thread_language`, `20260702190000_thread_event_anchor_and_interaction`,
  `20260702240000_thread_share_participants` — the columns in §2.
