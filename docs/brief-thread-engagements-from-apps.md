# Brief — the messages around an event, writable from the app that owns it

_Written 2026-08-29, from the Festival of Trust planner. Follows
`brief-thread-event-settings.md`, which closed the settings gap; this closes the
one behind it._

The owner asked for "the registration process… incl the messages in the thread".
The registration half exists. The messages half does not: the planner can
publish a festival, describe it, credit its hosts, open enrolment and read who
registered, and then cannot write a single word that goes out to those people.

The Thread already has the model. It is called `thread_engagement`. Nothing on
the app-facing surface touches it.

## 1. What an app can do today, exactly

Six routes, all in `apps/api/src/routes/app-thread.ts`, all allow-listed in
`apps/api/src/middleware/app-context.ts:163-167` (plus `:153` for hosts):

| Route | Line | Scope |
|---|---|---|
| `POST   /apps/:slug/thread/threads` | `app-thread.ts:325` | `write:programs` |
| `GET    /apps/:slug/thread/threads` | `app-thread.ts:492` | `read:programs` |
| `GET    /apps/:slug/thread/threads/:id` | `app-thread.ts:518` | `read:programs` |
| `POST   /apps/:slug/thread/threads/:id/hosts` | `app-thread.ts:557` | `write:programs` |
| `PATCH  /apps/:slug/thread/threads/:id` | `app-thread.ts:613` | `write:programs` |
| `GET    /apps/:slug/thread/threads/:id/enrolments` | `app-thread.ts:687` | `read:enrolments` |

That is the whole surface. The allow-list is default-deny
(`app-context.ts:246-256`), so everything else 403s as `not-app-accessible`
regardless of scopes held.

Engagements are reachable only from the user surface —
`POST /thread/threads/:id/engagements` (`thread.ts:818`), `PATCH
/thread/engagements/:id` (`thread.ts:885`), `DELETE` (`thread.ts:932`). All
three run on `userClient(ctx.jwt)` and are bounded by
`thread_engagement_scope`, which requires `current_workspace_id()` and
`has_app_membership('the-thread')`
(`supabase/migrations/20260701090000_thread_schema.sql:309-314`). There is no
user behind an app key, so those routes deny everything. Same situation
`app-thread.ts` was written to solve.

## 2. Why this matters here and not in the abstract

The festival's organisers sign in to the planner's own database. They have no
Fibre account, they will not be given one, and no route on this surface would
tell the planner who in the workspace does have one.

That constraint has now shaped three changes in a row: the optional
`organiser_person_id` (`app-thread.ts:181-188`), the derived workspace organiser
(`app-thread.ts:242-311`), and hosts-by-person rather than hosts-by-storefront
(`app-thread.ts:557`). Each time the answer was the same — the platform resolves
what the app cannot know.

Messages are the case where the workaround runs out. Settings can be entered
once by hand if someone with a login is willing. A message sequence is written
per festival, revised as the plan moves, and re-timed when a date shifts. If the
planner cannot write it, the festival either has no messages or has a person in
The Thread's UI retyping them, and the planner's own "welcome subscriptions"
switch becomes a lie: enrolment opens and nothing is sent.

## 3. The model as it actually is

`thread_engagement` (base at `20260701090000_thread_schema.sql:120-150`, then
four ALTERs). One table, two families, distinguished only by `type`:

- **activities** — `event`, `conversation`, `workshop`. Timed, on the agenda.
- **messages** — `reflection`, `practice`, `message`, `document`,
  `inspiration`. Scheduled sends. The email sequence *is* this family.

`ACTIVITY_TYPES` / `MESSAGE_TYPES` at `thread.ts:111-113`. Type may change only
within its family after creation (`thread.ts:899-906`).

Columns, by what they are for:

| Column | Notes |
|---|---|
| `workspace_id`, `thread_id` | both NOT NULL |
| `title`, `description` | description is HTML from the rich-text editor |
| `type`, `status` | status `draft` / `published` / `closed`, default `draft` |
| `starts_at`, `ends_at`, `location`, `location_url`, `meeting_url`, `meeting_provider` | activities. Provider added `20260702140000` |
| `daily_schedule` jsonb | per-day wall-clock times for multi-day items, `20260710120000` |
| `scheduled_at` | messages, `trigger_kind = 'fixed'` |
| `content` jsonb | the message body — see §6 |
| `position`, `show_in_agenda` | ordering, agenda visibility |
| `created_by` | FK to `public."user"` — nullable, and it must stay null for app writes |

### Timing — read this before designing anything

The relative model is **not** `day_offset` / `time_of_day`. It is four columns
added by `20260702100000_thread_engagement_triggers.sql:11-18`:

```
trigger_kind         fixed | on_enrolment | on_approval | on_completion | relative
trigger_anchor       start | end | engagement          (null unless relative)
trigger_offset_days  signed integer — negative = before the anchor
trigger_time         'HH:MM', wall clock in the THREAD's timezone
```

plus `trigger_engagement_id`, added later
(`20260702190000_thread_event_anchor_and_interaction.sql:3-5`), which lets a
message anchor to a specific activity rather than to the thread's own dates.

`trigger_anchor = 'engagement'` was only made legal on 2026-08-28
(`20260828140000_trigger_anchor_allows_engagement.sql`) — the CHECK constraint
had never learned about it, so event-anchored messages had failed the insert
since the day the column shipped. Anything built on this surface should assume
that migration is applied.

Two senders, and only two:

- `sendTriggeredMessages` (`thread.ts:4703`) — fires the three lifecycle kinds
  from the public enrol / approve / complete paths.
- `runThreadMessageScheduler` (`thread.ts:4791`) — every five minutes
  (`server.ts:222-231`), picks up `fixed` and `relative` messages that are
  `status = 'published'` on a thread whose programme is `active` or `completed`
  (`thread.ts:4839-4841`), with a 72-hour lookback (`thread.ts:4789`).

Audience is everyone enrolled except `invited` and `dropped`
(`thread.ts:4905-4906`). Dedup is an insert-first unique on
`thread_message_send (engagement_id, person_id)`
(`20260701090000_thread_schema.sql:222-231`).

## 4. Suggested shape

Four routes on the existing app surface, mirroring the user surface rather than
inventing a second vocabulary:

```
POST   /apps/:slug/thread/threads/:id/engagements
GET    /apps/:slug/thread/threads/:id/engagements
PATCH  /apps/:slug/thread/engagements/:id
DELETE /apps/:slug/thread/engagements/:id
```

`ownThread()` (`app-thread.ts:100`) already establishes that a thread belongs to
the calling app via `program.source_app`. PATCH and DELETE need the same check
one level down — resolve the engagement to its thread, then run `ownThread`. An
app must not be able to edit an engagement on a thread it did not publish, and
`workspace_id` alone does not give you that.

The request body should be `EngagementCreate` (`thread.ts:729-771`) minus
`created_by`, which is a user FK and has no app-key answer
(`actorUserId`, `app-context.ts:48`). Reuse the schema, do not restate it; the
two will drift otherwise. `activityWindowError` (`thread.ts:776`) and
`dailyScheduleError` (`thread.ts:808`) must run here too — extract them rather
than copying.

### On ids — the "own record ids" rule, stated correctly

The rule as usually stated ("an app never handles platform UUIDs") is not what
the surface actually does. The planner holds `thread.id`, a platform UUID, and
passes it to `PATCH /threads/:id` every time it saves a setting. The real rule
is narrower and worth writing down properly:

> An app never has to **look up** a platform record it did not create. Where it
> names something it did not create — a person, a host — it names it by its own
> record id through `app_record_link` (`app-thread.ts:575-588`). Where it names
> something it did create, the platform id it was handed is fine.

By that rule an engagement id in the path is acceptable, because the app created
the engagement and was handed the id.

But it is not sufficient, for two reasons.

**Idempotency.** Publishing a thread is idempotent on `source_ref`
(`app-thread.ts:338-357`), because a retried publish must not create a second
public page. A retried message-sequence sync must not create a second welcome
email. `thread_engagement` has no `source_app` / `source_ref`; `program` gained
them in `20260824170000_program_source_app.sql:26-38` for exactly this.

**Anchoring.** `trigger_engagement_id` names *another engagement*. A planner
that lays down "opening ceremony" and "reminder, 2 days before the opening
ceremony" in one sync has to name the first from inside the second before it has
been told the first's id — or make two round trips and hold platform ids across
them.

So: add `source_app text` / `source_ref uuid` to `thread_engagement` with a
unique index on `(thread_id, source_app, source_ref)`, mirroring
`program_source_ref_idx`. `POST` becomes idempotent on it and returns
`created: true|false` exactly as the thread publish does. Accept
`trigger_anchor_ref` alongside `trigger_engagement_id`, resolving the app's own
ref to the platform id server-side.

Note `app_record_link` cannot do this job: `platform_entity` is CHECK-constrained
to `person`, `organisation`, `user`
(`20260517100000_app_entity_mapping.sql:35-36`). Widening that check to cover
thread content would make the entity-mapping table a general id registry, which
is a larger and worse change than two columns on one table.

## 5. Scope, and the honest cost

`write:programs` already owns thread content — `app-context.ts:151-153` says so
in as many words when it explains why crediting a host is gated on it. Adding
engagement routes under `write:programs` costs nothing: no migration, no
re-approval, four rows in `APP_KEY_ROUTES`, and the Festival of Trust key works
the moment it deploys.

I do not think that is the right answer, and it is worth being clear about why.

Today, no scope on this surface can cause an email to be sent to a human.
`write:programs` publishes a page and edits its settings; registration and every
send that follows it come from the public form. The moment an app can publish a
message-family engagement, `write:programs` means something it did not mean when
it was granted: *this credential can email everyone enrolled in a programme, from
the platform's domain, on a five-minute timer.* Every existing key silently gains
that. That is scope creep of the permanent, invisible kind.

So: a new scope, `write:messages`, on the message-family writes. Reads and
activity-family writes stay on `read:programs` / `write:programs`.

The cost, named plainly. `APP_SCOPES` is a plain TS const, deliberately not a
CHECK constraint (`apps/api/src/lib/app-keys.ts:19-48`), so adding the string is
a deploy. What is not free is that `app_key.scopes` is a stored column read by
`resolveAppKey` (`app-keys.ts:112-127`): an existing key does not acquire the new
scope, so the planner's key must be re-minted or edited, and the app's manifest
re-approved to declare it. For one app on one workspace today that is an
afternoon. It is also the last moment it will be that cheap.

If the re-approval is genuinely unacceptable right now, the fallback is:
engagement writes under `write:programs`, but the app may only ever write
`status: 'draft'`, and a human publishes. That is coherent — and it is useless
for this planner, whose organisers have no login to publish with. Take the
re-approval.

## 6. The data wall — where the line goes

The other brief cautions that `registration_fields` should not be opened to apps
(`brief-thread-event-settings.md` §2), and `app-thread.ts:20-53` walls
`thread_enrolment.answers` absolutely. Message content is not the same thing,
and the difference is direction.

`registration_fields` and `answers` are **inbound**: what is asked of a
registrant, and what they said. That is the registrant's data, held by the
platform, and an app that plans festivals has no claim on it.

Message content is **outbound**: what the organiser says to the room. The
organiser authors it, it is addressed to nobody in particular, and it already
leaves the platform as email. An app that is the organiser's own tool writing
the organiser's own words is not crossing the wall — it is on the near side of
it.

So `title`, `description` and `content` may be written and read back freely.

Three things stay behind the wall, and they are the ones to be firm about.

**`thread_message_send` never crosses.** It is per-person delivery data — who
received what, when — sitting one step from `answers` in kind. Nothing on the
app surface should read it, aggregate it, or expose a "sent / not sent" flag per
registrant.

**No app-addressed sends.** No `POST …/engagements/:id/send`, no recipient list,
no "send this to person X". The two senders in §3 stay the only senders, and the
audience stays whoever is enrolled. This is the same reasoning that produced no
`write:enrolments` (`app-keys.ts:38-44`): the app describes what should happen,
the platform decides to whom.

**Token substitution stays server-side.** `{name}`, `{thread}`, `{organiser}`,
`{date}` are resolved per recipient inside the sender (`thread.ts:4920-4931`).
The app writes the token; it never sees what the token resolves to. That is what
lets an app personalise a message without being handed the room.

## 7. Things I think are bad ideas

**Giving an app DELETE without a guard.** `thread_message_send.engagement_id`
cascades on delete (`20260701090000_thread_schema.sql:224`). Delete an
engagement that has already sent and the dedup log goes with it; recreate it
from the planner's copy of the sequence and everyone gets the email a second
time. A sync loop that deletes-and-recreates on every save will do this
routinely. DELETE should 409 when any `thread_message_send` row exists, and the
planner should be told to PATCH.

**Accepting rich HTML and expecting it to survive.** `description` and
`content.body` hold HTML from The Thread's editor, and the send path strips it
(`stripHtml`, `thread.ts:4658`) and then escapes what is left
(`engagementMessage`, `lib/email/thread-templates.ts:89-91`). Emails are
plain-text-shaped by construction. This is good — an app cannot inject markup
into mail from the platform's domain — but it means a rich editor in the planner
produces bold text that arrives unbold. Say so before someone builds one.

**Opening the activity family in the same pass.** It is tempting, because it is
the same table and the same route. But an activity is a public agenda item
subject to `activityWindowError` against the programme's dates, and the planner
already has its own sessions model; two systems both authoring the agenda is a
sync problem nobody has scoped. Ship messages first. Activities can follow once
someone has decided which side owns the agenda.

**A `content` schema per type validated on the app surface.** `content` is
`z.record(z.unknown())` on the user surface (`thread.ts:769`) and the renderer
switches on `type` for known keys — `questions`, `assignments`, `body`,
`external_url` (`thread.ts:4672-4700`). Tightening it only for app callers means
the planner can be rejected for a body The Thread's own UI would accept. Keep it
opaque, document the keys the renderer honours, and let unknown keys be ignored.

**Exposing `POST /thread/scheduler/run`.** It exists (`thread.ts:4956`) and it is
an ops handle for authenticated workspace members. An app key that could call it
could pull every due send forward. Leave it off the allow-list.

## 8. Order

1. **The migration** — `source_app` / `source_ref` on `thread_engagement` plus
   the unique index. Everything else depends on it, and it is half an hour.
2. **The scope decision.** `write:messages` or not. Decide before the routes,
   because retrofitting a scope onto shipped routes means breaking callers, and
   this surface is additive-only (`app-thread.ts:56-62`).
3. **`POST` + `GET`,** message family only, idempotent on `source_ref`,
   `trigger_anchor_ref` resolved server-side. This alone unblocks the planner:
   it can lay down a sequence and open enrolment.
4. **`PATCH`,** for re-timing when a date moves.
5. **`DELETE`,** with the `thread_message_send` guard from §7. Last, because it
   is the one that can do damage and the one the planner needs least.
6. **The verification script.** `apps/api/scripts/verify-external-app.mjs`
   asserts walled fields are *absent* from responses; add the same for
   `thread_message_send` before §3 ships, not after.

## Reference

- `apps/api/src/routes/app-thread.ts` — the whole app surface; THE WALL at
  `:19-53`; the contract at `:55-67`.
- `apps/api/src/middleware/app-context.ts:140-184` — `APP_KEY_ROUTES`.
- `apps/api/src/lib/app-keys.ts:25-48` — `APP_SCOPES`, and why it is not a CHECK.
- `apps/api/src/routes/thread.ts` — `EngagementCreate` `:729`, the three CRUD
  routes `:818` / `:885` / `:932`, `sendTriggeredMessages` `:4703`,
  `runThreadMessageScheduler` `:4791`.
- `supabase/migrations/20260701090000_thread_schema.sql:114-150` —
  `thread_engagement`; `:222-231` — `thread_message_send`.
- `20260702100000_thread_engagement_triggers.sql`,
  `20260702140000_thread_engagement_location_provider.sql`,
  `20260702190000_thread_event_anchor_and_interaction.sql`,
  `20260710120000_engagement_daily_schedule.sql`,
  `20260828140000_trigger_anchor_allows_engagement.sql` — the ALTERs.
- `20260824170000_program_source_app.sql` — the `source_ref` precedent.
- `docs/brief-thread-event-settings.md` §2 — the `registration_fields` caution
  this brief is consistent with.
- `docs/fibre-vs-app-data.md` — the two-list contract.
