# A personal to-do list, across the apps — proposal

**Status:** proposal, 2026-09-22. Nothing built. Decisions at the end.
**Asked by Sjoerd:** *"Can a personal to do list be created over the whole app.
So you can get to do's from connect and from the thread... etc... It creates a
list with things to do per date/app/project... Think this through before you
make it."*

## The short answer

**Most of it already exists, in the wrong place.** Connect's Today page is a
cross-app merge of everything that wants doing (`routes/connections-today.ts`,
771 lines): Flow tasks assigned to you, Thread engagements about to start,
Meet bookings, Pulse money not yet invoiced, your calendar. It is
workspace-user-keyed, server-composed, and deliberately stores nothing.

What is missing is not a merge. It is **a list that is yours and remembers
things**: an item you ticked, an item you pushed to Thursday, an item you
typed yourself that belongs to no app.

So: keep the composition, add the memory, and move the surface up one level —
out of Connect, into the platform, where every app can show it.

## What exists today (read from the code)

| Thing | Where | Keyed to |
|---|---|---|
| The only real task table | `flow_task` (20260520120000) — title, `due_at`, `status`, `assignee_user_id` \| `assignee_team_id` \| `contact_id` | a user |
| Connect follow-ups | a note's `follow_up_at` **materialises a `flow_task`** (`routes/notes.ts:256`) | a user |
| Everything else | a status on a domain row: `thread_enrolment.payment_status`, `meet_booking.status`, `membership_member.renews_at`, `pulse_commitment` | not a person's list |
| The merge | `routes/connections-today.ts` — OWED (your Flow tasks) + PREPARE (Thread, Meet, Pulse, calendar), each row carrying `prepare_at = happens_at − lead_days` | you, inside Connect |
| The precedent for composing across apps | `GET /api/v1/me/portal` (`routes/portal.ts:1`), the **third sanctioned crossing**: the platform assembling, for one person, a view of their own data | a person |

## Why this is allowed (and where the line is)

The brief is blunt: *"No app reads another app's content data — ever"*
(fibre-technical-brief-v0.4 §2), and the app contract: *"If you find yourself
wanting a fourth crossing, that is a conversation to have before you build"*
(building-on-the-fibre §6).

This proposal does **not** give an app another app's data. It is the
**platform** composing one user's own work — the same argument that was
accepted for `/me/portal`, one level over from "my enrolments" to "my work".
Three rules keep it honest:

1. **Per source, per seat.** Thread items appear only for a user with a Thread
   seat (`has_app_membership`), Meet items only with a Meet seat, and so on.
   No seat, no row — the list can never become a side door into an app.
2. **Reference and label, never content.** A row stores `app · item_ref ·
   a short title · when · a link`. Exactly the discipline of the activity log
   (type + subject, never body). The list links back to the app; it never
   holds the note, the message or the invoice.
3. **Personal, not managerial.** The list answers *what should I do*. It is
   not a view of someone else's day. Assigning work to another person already
   exists — a Flow task with their `assignee_user_id`.

## The design

### A. One new platform table: `user_task`

The memory the merge lacks. RLS copied from `user_profile`: readable and
writable only by `user_id = current_user_id()` — not by workspace admins,
because this is a private list, not a management report.

| column | meaning |
|---|---|
| `user_id`, `workspace_id` | whose list, in which workspace |
| `title` | what it is |
| `due_on` (date, nullable) | the day it belongs to — a date, not a timestamp: a to-do lives on a day |
| `app_id` (nullable) | which app it belongs to, when it belongs to one |
| `subject_kind` / `subject_id` | what it is about: person, organisation, thread, flow run, booking — for the "per project" grouping |
| `source_app` / `source_ref` (nullable) | set when the row MIRRORS something an app owns (see B) |
| `state` | `open` · `done` · `snoozed` |
| `snoozed_until` (nullable) | pushed to a day |
| `done_at`, `created_at`, `sort` | the usual |

Manual to-dos ("ring the accountant") are rows with no source. They are the
only thing the platform itself owns here.

### B. Derived items keep living in their app — the list only remembers your answer

A Thread engagement, a Meet booking, a Flow task stay where they are. The list
composes them at read time, exactly as Today does, and joins them to a
`user_task` row **only when you act on one** (tick, snooze, reorder). That row
carries `source_app + source_ref` and no copy of the content.

Why not mirror everything into the table: a mirror goes stale the moment the
owning app changes its row, and it would put Thread's and Meet's content in a
platform table, which is the thing the wall forbids. Composition cannot go
stale; it has no second copy.

Ticking a *derived* item is honest about what it means: it marks **your list**
done, not the app's row. Where an app has a real completion (a Flow task), the
tick is passed through to the app — one code path, `flow_task.status`.

### C. One reader, three surfaces

`GET /api/v1/me/tasks` returns the merged, grouped list; `POST/PATCH` manage
manual rows and per-item state. The shape is Today's shape, generalised:

```
{ groups: { overdue, today, tomorrow, this_week, later, no_date },
  items: [{ id, title, due_on, app, subject: {kind,id,label}, href,
            source, state, snoozed_until }] }
```

- **The Fibre** — a full page, *My list*, with grouping by **date** (default),
  **app**, or **project** (the subject: a thread, a person, an organisation).
- **Every app's dashboard** — the same list narrowed to that app, from the same
  endpoint with `?app=`. No second implementation.
- **Connect's Today** keeps its shape (agenda + prepare + owed) and starts
  reading the platform list for its OWED half, so ticking in one place shows in
  the other. Today stays the "what is my day" surface; My list is "what do I
  owe, everywhere".

### D. Reminding, without a new machine

The 5-minute scheduler in `server.ts` already runs four jobs. A fifth sends a
daily digest — *"3 due today, 1 overdue"* — with the same dedup discipline as
the Thread and Membership senders (a `*_send` row per user per day). Off by
default; a per-user preference turns it on.

### E. What it means on a phone

The list is the one screen that justifies a mobile-first layout in The Fibre:
date groups, a tick that works with a thumb, and "add" that takes one line of
text. This follows the phone work already done (v0.81–0.90).

## What I would NOT do

- **No fourth crossing.** No new shared "tasks" table that every app writes
  into. Apps keep their own rows; the platform composes.
- **No mirroring of app content** into the platform, for the staleness and
  wall reasons above.
- **No assigning to others** in v1 — Flow already does that, and a private
  list that others can write into is no longer private.
- **No AI triage** in v1. The ordering is date, then app, then your own drag.

## Order of work

1. `user_task` + RLS + manual add/tick/snooze + `GET /api/v1/me/tasks`
   composing Flow tasks first (the one real task source).
2. The Fibre page *My list*, with the three groupings, phone-first.
3. The other sources, one per step, each gated on its app seat: Thread,
   Meet, Pulse, Membership.
4. Connect's Today reads the platform list for OWED.
5. The daily digest, off by default.

Each step is useful on its own, and step 1 alone already gives a personal list
that survives a reload.

## Decisions for Sjoerd

1. **Name.** *My list* · *To do* · *My work*?
2. **Where does it live first** — a page in The Fibre, or a panel in every
   app's sidebar from day one?
3. **Ticking a derived item** (a Thread engagement): does that mean "off my
   list" only, or should it try to complete the thing in the app where the app
   has a completion?
4. **Snooze** — a day ("Thursday"), or also "next week"/"someday"?
5. **The digest** — daily at a fixed hour, or only when something is overdue?
