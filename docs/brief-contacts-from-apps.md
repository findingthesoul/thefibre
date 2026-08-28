# Brief — an app can create a contact but not describe one

_Written 2026-08-28, from wiring the Festival of Trust planner's people into
the contact graph._

## The intent

> "Someone signs up. Their profile — name, email, telephone, address — and
> organisation are saved in the Fibre. There one can see activities. When a host
> is added: to the Fibre. Once someone registers: to the Fibre. An organisation
> can see the contacts they had. The Fibre workspace can see it all."

That is the platform working as intended: the app owns its own workflow, and
every human it touches lands in one shared graph. Most of it is reachable
today. Two pieces are not, and they are the two that make a contact a contact
rather than a row.

## What already works

`POST /apps/:slug/links` with `create_if_missing` creates a `person` or an
`organisation` and records the link. The planner now calls it when an organiser
creates a festival and when a host accepts an invitation, and writes an activity
against the person. That part is done and needs nothing.

## Gap 1 — only three fields can ever be supplied

`LinkBody` accepts `match_on`, and `MatchOn` is:

```ts
const MatchOn = z.object({
  email: z.string().email().toLowerCase().optional(),
  name: z.string().max(200).optional(),
  domain: z.string().max(200).toLowerCase().optional(),
});
```

Those fields are used to *find* an entity, and — when nothing matches — they are
also all that gets written:

```ts
.insert({
  workspace_id: ctx.workspaceId,
  email,
  first_name: parts[0] ?? null,
  last_name: parts.length > 1 ? parts.slice(1).join(' ') : null,
})
```

`person` has `phone`, `location`, `timezone`, `preferred_language` and
`photo_url`. None can be set by an app, ever — not at creation, and not
afterwards, since there is no person-update route on the app surface.

So an app that asked someone for their phone number has nowhere to put it. The
planner collects phone and address on the application form and holds them in its
own database, which is precisely the duplication the data wall exists to
prevent: two records of the same human, one of them fuller than the platform's.

**Suggested shape.** Separate finding from describing:

```jsonc
{
  "app_entity": "festival_organiser",
  "app_record_id": "organiser:…",
  "match_on": { "email": "…" },
  "create_if_missing": true,
  "attributes": { "phone": "…", "location": "…" }   // new
}
```

`attributes` written only on create, or on an explicit `update_if_found`, so an
app cannot quietly overwrite a contact a human has curated. That distinction
matters more than the fields: **the risk here is not an app writing too little,
it is an app overwriting what somebody typed.**

## Gap 2 — an app cannot say who belongs to what

There is no route that writes `org_membership`. An app can create a person, and
create an organisation, and cannot connect them.

That is the missing edge under "an organisation can see the contacts they had".
Without it the question has nothing to compute from: the graph knows both
parties and not the relationship.

**Suggested shape.** Either a third `platform_entity` on the existing links
route, or `POST /apps/:slug/memberships` taking two `app_record_id`s the app has
already linked — which keeps the app in its own identifiers and never handling
platform UUIDs, consistent with the rest of the surface.

## The question behind gap 2

"An organisation can see the contacts they had" implies visibility scoped to an
organisation. Fibre scopes to the **workspace**: RLS is `current_workspace_id()`,
and every member of a workspace sees its whole graph. There is no notion of an
organisation signing in and seeing a subset.

Two readings, and they cost very differently:

1. **The app shows it.** The planner shows an organiser the people on their own
   festival. Needs only gap 2, and the planner already knows which festival is
   whose. Almost free once memberships can be written.
2. **The platform enforces it.** An organisation-scoped view inside Fibre, with
   RLS to match. A significant change to the visibility model, and one that
   would touch every app.

Worth deciding which is meant before either is built. The requirement reads
naturally as (1); (2) is a different product.

## Not in scope here

Registrants reaching the graph is The Thread's app surface
(`brief-thread-and-registrations.md`), which shipped in v0.18.0 and has nothing
built against it yet. When it is, enrolment already creates `person` rows, so
that half arrives for free — it is the planner reading them that is missing.

## Reference

- `apps/api/src/routes/apps.ts` — `MatchOn`, `LinkBody`, `linkOne`.
- `docs/fibre-vs-app-data.md` — the two-list contract; `person` and
  `org_membership` are both platform-owned.
- `~/Projects/festivaloftrust.com/src/lib/contact-graph.ts` — the caller, with
  the workaround for gap 1 commented where it happens.
