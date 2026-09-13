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
| 18 | **Timeline: highlight tags; companies and people as @, highlighted** | **MISSED** — see below |
| 19 | **Click a name → popup with name, email, phone, LinkedIn** | **MISSED** — see below |
| 20 | **Landscape should work like "as columns" in macOS** | **MISSED** — see below |
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
| 35 | Could there also be a team member? | **Waiting** — owner of the relationship, or who had the conversation? |
| 36 | How does Connections work with individual / teams / workspace? | **Answered** — workspace is the unit; calendar and owed tasks are yours; teams unused |
| 37 | The list of readings should be flexible — title above, then rows of "name : description" | **In progress** |

### The three that were lost

**18 — highlighting in the timeline.** Asked while I was mid-release on
something else, acknowledged in passing, and never written down. The composer
already highlights tags and `@` names as you type
(`components/tag-highlight-box.tsx`); the saved note in the timeline renders as
plain text. Same ranges, a different renderer.

**19 — the contact-details popup.** Asked together with a real architectural
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

## Where this lives

`connections-backlog.md` stays the reasoned list: what to build, why, what it
costs, what the decision is. **This file is the receipt** — one row per ask,
so the question "did that get picked up" has an answer that does not depend on
remembering.
