# Brief — publishing makes an app name a person it cannot look up

_Written 2026-08-28, publishing the first Festival of Trust event._

> **Implemented** on branch `thread-default-organiser`, in the direction of
> "rights follow function": `organiser_person_id` is optional, and a workspace
> with no storefront gets one derived from its admin rather than being told to
> visit a settings screen. The read route below was not added — nothing needs
> it once the default works.

## What happens

`POST /apps/:slug/thread/threads` requires `organiser_person_id`, and then
requires that person to have a Fibre `user` and a `thread_organiser` profile:

```ts
organiser_person_id: z.string().uuid(),
...
if (!user)      return c.json({ error: 'that person has no Fibre account, so they cannot be an organiser yet' }, 400)
if (!organiser) return c.json({ error: 'that person has no Thread organiser profile — they need to visit The Thread’s settings once' }, 400)
```

The check is right. A public page should have a real human behind it. The
problem is what it leaves the app holding.

## The gap

An app has **no way to discover who those people are.** The app-facing surface
is `POST /threads`, `GET /threads`, `GET/PATCH /threads/:id`, `GET
/threads/:id/enrolments`. Nothing lists the workspace's Thread organisers, and
nothing says which is the default.

So the app must supply a UUID it cannot obtain from the platform. In the
planner that became an environment variable holding an email address, resolved
to a person through `/links` at publish time. That is configuration for
something the platform already knows, and it is wrong in the ordinary way
config is wrong: it is set once, in a different system, by someone who has to
remember the two facts must match.

The app key is already scoped to (app x workspace). The workspace is not in
question. Only the person is, and only the platform knows them.

## Why it bites here specifically

The planner's organisers are community organisers. They sign in to the
planner's own Supabase, which Fibre knows nothing about, and they will never
have Fibre accounts — that is the whole point of an external app. So the
organiser of a festival can *never* be its Thread organiser, and every publish
falls back to the workspace's own person.

That is not a workaround, it is the true shape: Festival of Trust vets the
festival and puts its name to the page; the community runs it. The API should
be able to express it without config.

## Suggested shape

Make `organiser_person_id` optional. When omitted, publish under the
workspace's default Thread organiser.

```jsonc
{ "title": "…", "format": "event", "slug": "…", "source_ref": "…" }
// organiser_person_id omitted -> the workspace's own organiser
```

Failing that — or alongside it — a read route so an app can choose honestly:

```
GET /apps/:slug/thread/organisers
-> { organisers: [{ person_id, name, is_default }] }
```

Either removes the env var. The first is better: the common case needs no
decision, and an app that genuinely wants to attribute to a specific person can
still pass one.

## Worth deciding too

If a workspace has several Thread organisers, "default" needs to mean
something. Earliest, or a flag on `thread_organiser`. Not urgent — Festival of
Trust has one — but the answer belongs in the same change.

## Reference

- `apps/api/src/routes/app-thread.ts:168` — the required field; `:243-272` the
  person / user / organiser checks.
- `~/Projects/festivaloftrust.com/src/lib/festivals.ts` — `publishToThread`,
  where the fallback happens, commented at the point it does.
- `~/Projects/festivaloftrust.com/src/lib/contact-graph.ts` —
  `publisherPerson()`, the env-var workaround this brief asks to delete.
