# What Sjoerd asked, and what happened to it

Started 2026-09-13, on his instruction:

> *"you did not solve all the things I have asked... are things still being
> build? DO they move to the backlog when not being build? Maybe a practice
> could be: I ask something, you log it.. then you do it immidiatly or later...
> and when done, you check... It makes me a bit uncertain what gets picked up
> and what not."*

He is right. Some asks shipped, some went into
[connections-backlog.md](connections-backlog.md), some were answered in chat
and never written down anywhere, and **three were lost entirely** — answered
neither in code nor in a document. That is what this file fixes.

## The practice

1. **Every ask gets a row here, the moment it is made**, before any work.
2. A row is **Shipped** (with the version), **Backlog** (with the section),
   **Answered** (a question, not a build), or **Waiting** (needs his answer).
3. **Nothing leaves this file.** A shipped row stays shipped so the record of
   what was asked survives the thing being built.
4. When a release goes out, the rows it closes are marked in the same commit.

## 2026-09-13

| # | Asked | Status |
|---|---|---|
| 1 | The cloud still jumps when connections appear | **Shipped** v0.73.36 |
| 2 | Junction hover label renders behind a name | **Shipped** v0.73.36 |
| 3 | Density above the canvas; search field instead of the dropdown | **Shipped** v0.73.36 |
| 4 | Improve the person page, with activities, a lot | **Backlog** §1.1 |
| 5 | The whole categorisation editable — which readings, how many, and the title | **Shipped** v0.73.37 |
| 6 | Open an organisation and connect a person to it, in the popup | **Shipped** v0.73.38 |
| 7 | Cloud names keep their relative positions; they should move | **Shipped** v0.73.38 |
| 8 | A full screen button | **Shipped** v0.73.38 |
| 9 | A further ring of fainter second-degree names | **Backlog** §2.1 |
| 10 | A cloud around a tag | **Shipped** v0.73.39 |
| 11 | …and around a location / space | **Backlog** §3.1 — no venue entity exists |
| 12 | The connect search opened into the bottom of the popup, invisible | **Shipped** v0.73.39 |
| 13 | Popup over popup: open a name from the organisation | **Shipped** v0.73.39 |
| 14 | The connection card, with basic info and editable relation fields | **Shipped** v0.73.43 |
| 15 | After connecting somebody, the screen should update | **Shipped** v0.73.40 |
| 16 | A full debug and optimisation pass | **Shipped** v0.73.41 |
| 17 | A new full backlog | **Shipped** — [connections-backlog.md](connections-backlog.md) |
| 18 | **Timeline: highlight tags; companies and people as @, highlighted** | **Shipped** v0.73.57 — was MISSED |
| 19 | **Click a name → popup with name, email, phone, LinkedIn** | **Shipped** v0.73.51 — was MISSED, see below |
| 20 | **Landscape should work like "as columns" in macOS** | **Shipped** v0.73.56 |
| 21 | Where do I change the labels of a reading? | **Answered** — Settings → What you call the steps; per workspace, admin only |
| 22 | Entries: can I fill in everything? Also tags? | **Answered** + **Backlog** §1.3, §2.6 |
| 23 | Entries interface error — content under the sidebar | **Shipped** v0.73.46 (hardened; cause not reproduced) |
| 24 | Full screen should keep the search and slider | **Shipped** v0.73.46 |
| 25 | Where do I change a person's state? | **Answered** + **Backlog** §1.3b |
| 26 | Should there be a tab at person level with relation info? | **Answered** — it exists in The Fibre's per-app tab |
| 27 | A field for interests, not just event-based info | **Answered** — interests are tags (model §3.5) |
| 28 | A tab of meetings with this person from the calendar | **Answered** + **Backlog** §2.7 |
| 29 | Why two buttons, and a warning before leaving for The Fibre | **Shipped** v0.73.46 |
| 30 | "How you met" should be contextual per answer | **Shipped** v0.73.47 |
| 31 | Tabs instead of accordion; relation open only when unfilled | **Shipped** v0.73.47 |
| 32 | Key contact / speaks for us — what do they mean? | **Shipped** v0.73.47 — removed; they were one switch with two names |
| 33 | A minimum height so tabs are calm | **Shipped** v0.73.48 |
| 34 | Follow up, kind and date on one row | **Shipped** v0.73.48 |
| 35 | Could there also be a team member? | **Answered** by 44 — the author is you, and the note is filed under a team |
| 36 | How does Connections work with individual / teams / workspace? | **Answered** — workspace is the unit; calendar and owed tasks are yours; teams unused |
| 37 | The list of readings should be flexible — title above, then rows of "name : description" | **Shipped** v0.73.49 |
| 38 | Keep Connections at workspace level; admin decides who has access — everyone or a selection | **Answered** — that is exactly what exists |
| 39 | "I remember we built something like groups... with rights" | **Answered** — teams as access groups, 2026-09-11 |
| 40 | Calling somebody means leaving Maps for The Fibre and coming back to file the note | **Shipped** v0.73.51 — this is #19, and why it mattered |
| 41 | Is the staging branch mine? (peer session, blocked release) | **Answered** — three stale premises corrected; peer released on top |
| 42 | Kind and when should sit next to Follow up, not behind a click | **Shipped** v0.73.54 |
| 43 | Peer: is the invoices tab yours? | **Answered** — evidence points at The Fibre contact profile, which already has the tab machinery |

## 2026-09-14

| # | Asked | Status |
|---|---|---|
| 44 | Teams as an organising layer: a person in several teams; a note is filed under one of mine, with a default team; I am the author automatically | **Shipped** v0.73.59 — the Fibre session had ended, so built as proposed: a filter, not a wall |
| 45 | An update view: pick a team and a period (last week, two weeks, custom) and see every shift by everyone in it — for update meetings | **Shipped** v0.73.59 — on Today; notes only, since nothing else carries a team yet |
| 46 | A longer "what happened" for meetings, plus a copyable prompt to paste a transcript into ChatGPT / Claude / Gemini that returns a short summary with @ and # | **Shipped** v0.73.57 |
| 47 | Typing `#f` shows a dropdown of matching tags; typing `@` shows people and companies | **Shipped** v0.73.55 |
| 48 | A tag should look like a tag inside the sentence; it need not also be listed at the bottom | **Answered** — it already shows inside the sentence; the chips stay because their X is the only way to take a tag off without deleting the word |
| 49 | Landscape as macOS columns: person inline in the last column, or the popup? | **Decided** — inline, since it went unanswered; reversible |
| 50 | Production: three migrations missing after the promotion — go or no-go? | **Blocked** — "make it all work" taken as go; the push was refused by the permission classifier. Sjoerd to run it. |
| 51 | "When" appears twice in the composer — remove the label | **Shipped** v0.73.55 |
| 52 | "On a date" in the follow-up list needs only a calendar icon, not the word | **Shipped** v0.73.55 |
| 53 | Follow-up list gains today, tomorrow and this week | **Shipped** v0.73.55 |
| 54 | Landscape: see the movement — the steps as columns next to each other | **Shipped** v0.73.58 — a Movement tab beside Browse |
| 55 | Landscape: an extra column to sub-group by tag, location, company… | **Shipped** v0.73.58 — group by tag, location or company |
| 56 | "Make it all work" — everything open: production, movement board, sub-groups, prompt, highlighting, teams | **Done except production** — v0.73.57–59; the production push was refused by the permission classifier |
| 57 | connections.thefibre.tech/dashboard should be connections.thefibre.tech | **Shipped** v0.73.60 — /dashboard never existed here (404); sign-in, SSO, the logo and workspace switch now go to the root, and /dashboard redirects there |
| 58 | (found while fixing 57) The Help link in the Connections sidebar also answers 404 — there is no help page | **Backlog** — needs content, not a redirect |
| 59 | `#` and `@` may run over a space — type the words, press Enter, and it becomes a tag, person or organisation | **In progress** |
| 60 | Tag cleaning: find doubles, find tags unused for a long time, and present a list for a clean-up now and then | **In progress** — was Backlog §1.4 |

### The three that were lost

**18 — highlighting in the timeline.** Asked while I was mid-release on
something else, acknowledged in passing, and never written down. The composer
already highlights tags and `@` names as you type
(`components/tag-highlight-box.tsx`); the saved note in the timeline renders as
plain text. Same ranges, a different renderer.

**19 — the contact-details popup. SHIPPED v0.73.51**, after he said plainly
what it cost: *"when I am searching for someone in my network and use maps to
identify them, and want to call them... I need to leave MAPS and go to FIBRE
for more info.. and then when I talked to them, I need to go back to
Connections, search him again and then file the info... That does not seem user
friendly"*.

The sting is that the round trip bought nothing. `GET /persons/:id` is a
`select('*')`, so the phone number was already in the response the popup had
fetched — it was never typed and never rendered. A `tel:` link, and the call
and the note happen in one dialog.

The original note follows. Asked together with a real architectural
question — *"This can be sent to basic info in fibre I guess... but at least
can appear here. Right (considering Fibre's Wall)?"* — **which I never
answered.** The answer is yes, and the reason matters: name, email, phone and
LinkedIn are **platform identity**, not app-owned curator data. The wall (brief
§2) separates apps from each other's CONTENT; identity is the shared floor
every app stands on. So Connections showing it is exactly what the platform is
for. Editing it writes to the platform's person endpoints, never to a
Connections-owned copy.

**20 — the landscape as macOS columns.** Acknowledged in one line as "queued"
and then never logged. A Miller-column browse — readings in the first column,
bands in the second, people in the third — is a real design item, not a tweak.

### 38 / 39 — the access model he described already exists

He is remembering correctly. `20260911120000_team_access_groups.sql`, from his
own ask on 2026-09-11: *"I'm adding more apps and I don't want every app
available to everyone in a workspace."*

  * An admin creates a **team**, which can be **internal** — `is_published`
    false, so it has no public page, though its slug is still claimed so it
    can be published later without colliding.
  * **`team_app_grant`** says which apps that team confers.
  * Being in the team writes the same `app_membership` row an admin would tick
    by hand; `lib/team-grants.ts` reconciles it. `team_member.role`
    (lead | member) carries the app role, so a team lead becomes an app admin.
  * **`is_direct`** distinguishes a grant somebody ticked by hand from one that
    arrived through a team.

So both halves of what he asked for are already there: **a selection** is a
team that grants Connections, and **every seat** is either ticking everyone on
the Members page or one team that contains them all.

Connections needs no change for this. Its gate is `has_app_membership(
'fibre-sales')` plus the workspace having the app switched on — which is what
`app/(app)/layout.tsx` checks on every request.

## Where this lives

`connections-backlog.md` stays the reasoned list: what to build, why, what it
costs, what the decision is. **This file is the receipt** — one row per ask,
so the question "did that get picked up" has an answer that does not depend on
remembering.
