# A plan for AI assistance in The Fibre

*Drafted 2026-09-15 at Sjoerd's request, from the MCP conversation in
`inbox.md`. A plan, not a decision. Everything here is checked against the
code: scopes in `apps/api/src/lib/app-keys.ts`, the route allow-list in
`apps/api/src/middleware/app-context.ts`, and the RLS policies in
`supabase/migrations/`.*

---

## 1. The fork that shapes everything else

There are two ways to put AI assistance in this product and they are different
businesses. Decide this first; the rest of the plan assumes the first.

**A. Bring your own assistant (MCP).** A seat connects the assistant they
already pay for — Claude, or whatever speaks the protocol — to a Fibre MCP
server. They pay for the tokens. You expose data and actions, bounded by their
own permissions. No model bill, no prompt tuning, no chat UI to maintain.

**B. An assistant inside the product.** Fibre calls a model itself and shows a
panel in the app. No setup for the user, complete control of the experience,
and Fibre pays for every token and owns every answer's quality.

They are not exclusive, and B becomes much cheaper once A exists, because the
tools are the same. But A first: it costs least, proves demand fastest, and
the permission model is already built.

---

## 2. How it works, once

A seat is a person in a workspace with a role. They already have an identity
the database understands, and RLS already decides what they may see.

1. Shuri clicks **Connect an assistant** in Fibre settings.
2. She sees exactly which permissions are being asked for, and approves.
3. Her assistant receives a **token bound to her user id and workspace**.
   Revocable from the same screen.
4. From then on her assistant can call the MCP server, and **every call runs as
   her**.

The consequence worth repeating: her assistant sees exactly what she sees in
her browser. Not because the server is written carefully, but because the same
policies run. A careless tool cannot widen it.

**Three gates stack, and only the first is ours to design:**

| Gate | Who decides | What it stops |
|---|---|---|
| Which tools the MCP server exposes | us, at design time | anything we did not build a tool for |
| RLS | the database, per row, per query | anything this seat could not see anyway |
| `app_membership` | the database | curator data for apps this seat is not in |

---

## 3. Phases

| # | What | Why this order | Needs |
|---|---|---|---|
| **1** | Read-only server, one seat (Sjoerd), run locally against staging | Proves people actually ask questions before any consent UI exists | An MCP server + the existing workspace app key. Days, not weeks |
| **2** | The connect flow: seat token, consent screen, revocation, audit | This is the product. Everything else rides on it | OAuth-style flow; the token is the only genuinely new thing |
| **3** | Writes, narrowly: notes and follow-ups | Aims at capture, which `connections-overview.md` calls the central risk | Phase 2 + a rule that assistant writes are marked as such |
| **4** | Steering: ask for a screen, get taken to it | Only worth it once reading and writing are proven | Phase 2 + a command surface (see §4.3) |
| **5** | Compositions: the preparation brief, the year in review | These are products, not plumbing | Phases 1 to 3 |

**Stop after phase 1 if nobody asks anything.** That is the point of doing it
first.

---

## 4. Applications worth building

### 4.1 The preparation brief
Before a session: who is coming, what happened with each of them last time,
who is new, who has gone quiet, who is carrying a lot. Composes from activity,
enrolments and the landscape, all of which exist. **The highest ratio of value
to work in this document.**

### 4.2 The year in review
Board and funder reporting assembled from what actually happened: enrolments,
activity, the purchase ledger. Differentiating precisely because delivery and
money sit in one system — `connections-market.md` §4's moat, turned into a
deliverable. **The most sellable.**

### 4.3 The interface on top of the interface
Sjoerd asked for this specifically, and it needs a correction before it is
scoped, because three different things hide inside it.

- **Ask and get an answer.** "Who is coming on Thursday?" Pure read. Easy, and
  phase 1 covers it.
- **Ask and get it done.** "Add a follow-up with Marja for next week." The
  assistant calls the same endpoint the form would have called. Also
  straightforward once writes exist.
- **Ask and get taken there.** "Open Marja" or "filter this list by Athens."
  **This is not what MCP does.** MCP hands an assistant data and actions, not
  control of your cursor. Driving the actual UI means either browser
  automation, which is fragile and does not belong in a product, or a command
  surface in the app that the assistant calls and the app then navigates to.

  The honest version is the third: **the assistant does the thing, and the app
  shows you the result.** Not "the AI moves your mouse."

  **Voice** is a separate question from all three. It is speech to text in
  front of whatever surface exists, useful mainly on the phone where typing
  after a conversation is the real friction. It can be added to any of the
  above, and it can also be added with no AI assistance at all. Nothing in the
  repo does this today.

### 4.4 The capture companion
A facilitator talks loosely after a session; the assistant writes the note,
the follow-ups and the activity rows. Aimed at the number in
`connections-data-integrity.md`: over 60% of CRM failures are adoption, and
the complaint is always the cost of entry.

**The rule that keeps this honest: the human states, the machine formats.**
Never: the machine observes. `detect-tags.ts` already refuses to send note
bodies to a model, and that refusal is load-bearing.

**And the tool is already specified, in the wrong medium.**
`apps/connections/lib/meeting-prompt.ts` (v0.75.x) generates a prompt a seat
pastes into their own assistant with a transcript. Read its header: it decides
what leaves the building (the person's name, the workspace's topic tags), what
deliberately does not (organisation tags, anybody else's name — *"this
workspace's contact graph handed to a third party because it was
convenient"*), and the output shape, hyphenated so detection resolves it. That
is inputs, outputs and a minimisation policy: everything an MCP tool
definition needs. Converting it is mostly mechanical.

**One thing MCP does not fix here.** The prompt is careful because the text
goes to a service the platform does not control. MCP changes the RETURN trip —
structured writes instead of a clipboard round trip — and leaves the OUTBOUND
exposure exactly where it was, because the seat's assistant still reads the
transcript. Do not assume the protocol makes the privacy question go away.

### 4.5 The to-do template, as a conversation
Sjoerd's Thread ask of 2026-09-14. `flow_step_default_task` already does this
for Flow. Rather than build a drag-and-drop builder, a facilitator says what
usually needs doing for this kind of thread and the assistant drafts the
template from threads that already ran.

### 4.6 The external builder's unlock
`fot-planner` already runs against the published contract. An MCP server for
that contract gives every external app builder assistant access to their own
workspace data, with scopes already enforced. A platform feature, not an
internal convenience.

---

## 5. What a seat could ask it

Grouped by where the data lives. Everything here is answerable from tables that
exist today.

**People and relationships**
- Who have I not spoken to since Athens?
- Who is drifting that I said I would keep close?
- Who do I know at this organisation, and who introduced us?
- Who is near this person, and why?
- Which of last year's participants have gone quiet?

**A session, before it**
- Who is coming on Thursday, and what happened with each of them last time?
- Who on Thursday's list is new to us?
- Who is carrying a lot right now?
- Has anyone on this list not paid?

**A thread, while it runs**
- Who applied and is still waiting on a decision?
- Who enrolled but has never turned up?
- What is still open on this thread, and who owns it?
- Which messages are scheduled to go out this week?

**After, and across cohorts**
- What happened on this thread, start to finish?
- How many people completed, and how many came back for something else?
- What did this cohort cost us and what did it bring in?
- Which threads produce people who return?

**Writing**
- Draft a follow-up to everyone who came on Thursday.
- Write the note from what I just told you, and set the follow-ups.
- Draft this quarter's report to the board from what actually happened.

---

## 6. What it cannot do

Four different reasons, and the difference matters. Only the last one is a
"yet".

### 6.1 Structurally impossible
The database refuses, whatever the assistant asks and whatever we build.

- **See another workspace.** RLS scopes every row to the workspace in the
  token.
- **See a person this seat cannot see.** Same policies as the browser.
- **See curator data for an app this seat is not a member of.**
- **Read anything through an app key that needs a real user's identity** — the
  general `/persons` and `/organisations` routes are deliberately absent from
  the app-key allow-list for exactly this reason.

### 6.2 Deliberately withheld
Could be built. Should not be, and the reasoning is already in the code.

- **Enrol anybody.** There is no `write:enrolments` scope at all. Registration
  comes from the public form, because the enrolment row is what the
  certificate and payout chain hangs off.
- **Email everyone on a thread unprompted.** `write:messages` is split out of
  `write:programs` precisely because such a credential *"can email everyone
  enrolled in a programme, from the platform's domain, on a five-minute
  timer"* (`app-keys.ts`). If an assistant ever gets it, it gets it explicitly
  and separately.
- **Author a flow.** `read:flows` exists; there is no `write:flows`. Editing
  steps, transitions and gates stays with humans.
- **Decide anything on its own.** Admitting or declining an application is a
  decision about a real person. `actorUserId()` returns `null` for an app key,
  so such a decision would be attributed to nobody. Assistant writes need
  marking as assistant writes, and decisions need a human attached.

### 6.3 Not in the data
No permission would help. The information does not exist.

- **Read what was said in a conversation.** Activity carries type and subject,
  never body. It can tell you *that* something happened and link out.
- **Tell you how close you are to someone who has never been rated.** The
  closeness axis reports `unrated` rather than guessing, on purpose.
- **See a deal moving.** Nothing writes an activity row when a commitment
  changes stage: `pulse.ts` writes no activity rows at all. A timeline built
  today would show notes and meetings and never a stage change. One missing
  write, recorded in `inbox.md`.
- **Infer a relationship from two people appearing together.**
  Co-occurrence is not a relationship (`system-handbook.md` §12).

### 6.4 Not built yet
- The seat token and the consent screen (phase 2).
- Any write path for an assistant (phase 3).
- Voice input anywhere in the product.
- Any assistant-driven navigation (§4.3).

---

## 7. Open decisions

1. **A or B in §1**, or A now and B later.
2. **Are assistant writes marked as such?** Recommendation: yes, visibly, and
   from the first write. Retrofitting provenance is painful and the activity
   log is append-only.
3. **Which seats may connect** — every seat, or admins first.
4. **Do we support more than one assistant client?** Exposing a standard
   server costs nothing extra; *promising* three clients work is a support
   burden we would own.
5. **Does phase 1 happen at all?** It is the cheapest way to find out whether
   any of this is wanted, and the answer may be no.
