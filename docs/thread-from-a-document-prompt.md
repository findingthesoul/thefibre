# Turning a document into a thread — the prompt

Sjoerd, 2026-09-25: *"I have a full doc with dates and flows… some things are
preparations… some are conversations, reflections, events… can you create a
prompt — with potential questions — to make full instructions for the thread
to make a flow?"*

This is that prompt. Paste it into a chat that has The Fibre connected
(Settings → Connections), then paste your document under it.

It is deliberately an **interview first, build second**. The shipped MCP
prompt `plan_thread_from_schedule` sorts rows and creates drafts; it asks
almost nothing, because it was the first slice. Everything that makes a
thread *yours* — paid or free, who may see it, whether messages actually go
out — is not in a schedule and cannot be guessed from one.

---

## The prompt

> I am going to paste a document with dates and a flow. Some rows are
> preparations, some are conversations or reflections, some are events. Turn
> it into a thread in The Fibre.
>
> **Work in three stages and do not write anything until stage 3.**
>
> **Stage 1 — read it back to me.** Produce a table with one row per item:
> date, my original wording, and which of these four it is:
>
> - **Agenda** — something participants attend or a date that structures the
>   programme for them. Types: `event`, `conversation`, `workshop`.
> - **Message** — something *sent* to participants. Types: `message`,
>   `reflection` (asks them to reflect), `practice` (asks them to do
>   something), `document`, `inspiration`.
> - **Internal** — a step only the organisers do. This stays on the timeline
>   but off the participants' agenda.
> - **To-do** — preparation with no date participants care about. This is not
>   a timeline item at all; it belongs on the thread's to-do list.
>
> Where a row could be two things, say so and ask rather than choosing.
>
> **Stage 2 — ask me your questions, grouped, with your recommended default
> next to each so I can say "defaults" and move on.** Ask about all of the
> following that my document does not already answer. Do not ask them one at
> a time.
>
> *The thread itself*
> 1. Title, and a one-line intention.
> 2. Is it one event or a journey over time? Start and end date. Timezone.
> 3. Page language, and the language it is actually facilitated in.
> 4. Who is it published under — me personally, a team, or the whole
>    workspace? This decides its public web address.
> 5. Categories, if any. A cover image?
>
> *Enrolment*
> 6. Free, or paid? If paid: one price or several tickets, what each is
>    called and costs, and whether people pay by card, by invoice, or either.
> 7. Do I approve people before they are in, or is enrolling enough?
> 8. A maximum number of participants?
> 9. What do I ask people when they sign up beyond name and email?
> 10. Should the sign-up form be on the public page at all — or does this
>     thread fill from a membership or from me adding people?
> 11. Should the agenda be visible to people who have not enrolled?
> 12. Should participants see who else is coming? Should the public?
>
> *The timeline*
> 13. Should everything land as a **draft** for me to review, or published?
>     (Recommend draft. Published agenda items appear on the public page
>     immediately; published messages become emails that actually send.)
> 14. **Titles: keep my wording exactly, or may you improve them?**
> 15. **Descriptions: do you write a suggested description for each item, or
>     leave them empty for me?** If you write them: how long, and in whose
>     voice?
>     **Never fold a description into the title.** They are two separate
>     fields. The title is a short label on the timeline; the description is
>     the body. A long sentence as a title is the most common way this goes
>     wrong.
> 16. Default start and end time for items whose time I did not give.
> 17. Which items are online, in a room, or both — and the link or address.
> 18. Do people RSVP per event, or not at all?
> 19. Any item running over several days with different times per day?
>
> *Messages and reminders*
> 20. Which reminders do you create beyond what my document names? Offer me
>     a list rather than inventing them silently.
> 21. For each message: is it sent on a **fixed date**, **relative to
>     something** (so many days before/after the start, the end, or a
>     specific event — at what time of day), or **on a lifecycle moment**
>     (when somebody enrols, when I approve them, when they complete)?
> 22. Should messages appear on the participants' agenda, or only arrive as
>     email? (Recommend: not on the agenda — an email is not something that
>     happens on a day.)
>
> *Finishing*
> 23. Does this thread issue a certificate? On what criteria?
> 24. Which preparation steps become a **to-do list** for me and the hosts,
>     with what due dates, and assigned to whom? Should that list be saved as
>     a reusable to-do template?
>
> **Stage 3 — write the full instruction set, then build.** First show me the
> complete plan: thread settings, every timeline item with its type, date,
> time, status, title and description, every message with its trigger, and
> the to-do list. Let me correct it. Then create it — thread first, then the
> items — and tell me plainly what was created, what is still a draft, and
> that nothing is published or sent until I say so in The Thread.
>
> The document:
>
> [paste it here]

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
