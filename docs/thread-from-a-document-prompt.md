# Turning a document into a thread — the prompt

Sjoerd, 2026-09-25: *"I have a full doc with dates and flows… some things are
preparations… some are conversations, reflections, events… can you create a
prompt — with potential questions — to make full instructions for the thread
to make a flow?"*

This document is the reasoning behind that prompt. The prompt itself is in
the product — Settings → Connections — and in
`packages/shared/src/thread-plan-prompt.ts`.

It is deliberately an **interview first, build second**. The shipped MCP
prompt `plan_thread_from_schedule` sorts rows and creates drafts; it asks
almost nothing, because it was the first slice. Everything that makes a
thread *yours* — paid or free, who may see it, whether messages actually go
out — is not in a schedule and cannot be guessed from one.

---

## Where the prompt lives

**In the product:** The Fibre → **Settings → Connections → "Build a thread
from a document"**. It is collapsed until you open it, with a copy button.
That is the place because it is where somebody has just connected an
assistant and is holding the question the prompt answers — *now what can it
actually do?* — whereas a help article is where you go once you already know
a thing exists.

**In the code:** `packages/shared/src/thread-plan-prompt.ts`, as one exported
string. It is shown in the interface and referred to here, and Sjoerd had
just finished saying what he thinks of something that exists in two places
(*"should be a single point of truth in the whole app"*), so this file does
not keep its own copy of the text. Read it there; the reasoning stays here.

---

## What each answer maps to, for whoever maintains this

Grounded in the real model, so the questions cannot drift from what a thread
can actually hold.

| Question | Field |
|---|---|
| 2 | `program.format`, `starts_on`, `ends_on`, `thread.timezone` |
| 3 | `language` (ours: chrome + emails), `facilitation_language` (free text) |
| 4 | `public_scope` — `personal` \| `team` \| `workspace`; decides the URL |
| 6 | `price_cents` or `thread_ticket` rows; `payment_methods: ['stripe','invoice']` |
| 7 | `requires_approval` — also switches the seeded system message to `on_approval` |
| 8 | `capacity` |
| 9 | `registration_fields[]` — `short` \| `long` \| `select` \| `checkbox` |
| 10 | `public_enrolment_open` — false hides the form, `/public/enrol` still accepts |
| 11 | `public_agenda` |
| 12 | `share_participants_public`, `share_participants_participants` (consent-gated) |
| 13 | `status` per engagement — `draft` \| `published` |
| 15 | `title` and `description` — **two fields** |
| 16/17 | `starts_at`, `ends_at`, `location`, `location_url`, `meeting_url`, `meeting_provider` |
| 18 | `rsvp_enabled` — null inherits the thread, which inherits the workspace |
| 19 | `daily_schedule[]` — `{date, start, end}` per day |
| 21 | `trigger_kind` — `fixed` \| `relative` \| `on_enrolment` \| `on_approval` \| `on_completion`; with `trigger_anchor` (`start` \| `end` \| `engagement`), `trigger_offset_days`, `trigger_time` |
| 22 | `show_in_agenda` |
| 23 | `certificate_enabled`, `certificate_criteria`, `certificate_template_id` |
| 24 | `thread_task` rows; a to-do template is `thread_template` with `kind='todo'` |

The three type families are not interchangeable: `ACTIVITY_TYPES`
(`event`, `conversation`, `workshop`) must fall inside the thread's date
window; `MESSAGE_TYPES` (`reflection`, `practice`, `message`, `document`,
`inspiration`) are exempt, because firing before or after the thread is their
whole point; `certificate` is its own family.

## The trap this prompt exists to close

**Titles and descriptions merged** in the first real test. That is not a bug
in the tool — `thread_add_engagements` maps `title` and `description` to
separate columns. It happened because nothing told the assistant to split a
row, so it passed the whole line as the title and sent no description.

The general shape: a tool with two fields and a prompt that mentions one
produces plausible-looking output where the second field is simply empty, and
nobody notices until they read a timeline of sentence-long titles. Question
15 is the fix, and it is phrased as an instruction rather than a preference
for that reason.
