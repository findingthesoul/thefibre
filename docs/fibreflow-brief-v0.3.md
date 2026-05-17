# Fibre Flow — Product Briefing
*A people-flow app built on the Fibre ecosystem*
*Version 0.3 — May 2026*

> Spelling normalised from the source draft: **Fibre** (not Fiber), **Fibre Meet**, **The Thread**.
> This is the founding-team briefing as written. It has not yet been reconciled against
> [`fibre-technical-brief-v0.4.md`](fibre-technical-brief-v0.4.md). For that, see
> [`fibreflow-review.md`](fibreflow-review.md). For the proposed schema + scaffolding plan,
> see [`fibreflow-data-model.md`](fibreflow-data-model.md).

---

## 1. Vision

Most CRM tools are built around deals. Fibre Flow is built around **people and the journeys they take**.

In consulting, professional services, and project-driven organisations, a person rarely fits neatly into a single pipeline. They might be a lead, a project participant, an event attendee, an interviewee, and a partner — sometimes all at once, sometimes sequentially. Traditional CRMs lose this nuance. Fibre Flow captures it.

The central concept is the **Flow**: a defined sequence of steps, with possible branching paths, that a person moves through over time. Flows are visual, reusable, and people-centric. A contact can be in one or more flows simultaneously, and their position — and what needs to happen next — is always visible.

Crucially, **flows drive to-do lists**. A contact doesn't simply move between steps — they are held at a step until specific tasks are completed. Those tasks may belong to an individual team member, to the team collectively, or may be actions the contact themselves has taken (logged by a team member). The flow engine turns relationship management into a clear, actionable system — for individuals, teams, and the whole organisation.

Fibre Flow is the third app in the Fibre ecosystem, built on the same shared foundation as Fibre Meet and The Thread — inheriting contacts, organisations, authentication, and event data — and adding the flow engine on top.

---

## 2. The Core Concept: Flows as State Machines

A **Flow** is a directed graph of steps. Each step represents a state a contact can be in. Movement between steps is governed by **transition gates** — sets of tasks that must be completed before the transition is unlocked.

### Anatomy of a Flow

```
[Step A] ──── transition gate ────► [Step B] ──── transition gate ────► [Step C ✓]
                                              ↘── transition gate ────► [Step D ✗]
```

**Steps** — discrete states (e.g. "First Contact", "Proposal Sent", "Contract Signed")
**Transitions** — directed paths between steps, each with its own gate
**Gates** — one or more tasks that must be completed to unlock a transition
**Branches** — multiple possible transitions from one step, leading to different outcomes
**End states** — terminal steps, positive (✓ Won, Onboarded, Completed) or negative (✗ Lost, Rejected, Withdrawn)

### Task Types within a Gate

Each task in a transition gate belongs to one of three actor types:

| Actor        | Meaning                                       | Example                                                    |
| ------------ | --------------------------------------------- | ---------------------------------------------------------- |
| **Personal** | I need to do this                             | Draft the proposal                                         |
| **Team**     | Someone on our team needs to do this          | Internal approval sign-off                                 |
| **Contact**  | The contact has done / needs to do this       | Attended a Fibre Meet · Signed contract · Confirmed attendance |

Contact tasks are logged manually by a team member for now — the semantic is "we record that the contact did this", making the activity timeline richer and more honest about who acted.

A gate can require **all tasks** to be completed, or **at least one** — configured in the flow builder per transition.

### Example Flows

**Sales Flow**

```
First Contact
  └─[gate: discovery call done (team)]──► Discovery Call
      └─[gate: proposal drafted (personal) + proposal reviewed (contact)]──► Proposal Sent
          ├─[gate: negotiation started (team)]──► Negotiation ──► Signed ✓
          ├─[gate: marked not ready]──► Nurture
          └─[gate: marked lost]──► Lost ✗
```

**Project Participation Flow**

```
Application Received
  └─[gate: interview scheduled (personal)]──► Interview Scheduled
      └─[gate: interview attended (contact)]──► Interview Done
          ├─[gate: approval confirmed (team)]──► Approved ──► Onboarded ──► Active ──► Completed ✓
          ├─[gate: rejection logged]──► Rejected ✗
          └─[gate: waitlist decision]──► Waitlisted (loops back)
```

**Partnership Flow**

```
Introduction
  └─[gate: meeting held (contact via Fibre Meet)]──► Exploration Meeting
      └─[gate: LOI drafted (personal)]──► Letter of Intent
          └─[gate: MOU signed (contact)]──► Active Partner ✓
```

---

## 3. Flow Scopes

Flows exist at three levels of the organisation:

| Scope         | Owned by         | Visible to       | Example                                       |
| ------------- | ---------------- | ---------------- | --------------------------------------------- |
| **Personal**  | One team member  | That person only | My own follow-up rhythm for warm leads        |
| **Team**      | A defined group  | That team        | Shared project intake process                 |
| **Workspace** | The organisation | Everyone         | Company-wide partnership or sales flow        |

A project *is* a flow. A list of contacts travels through it together — each contact at their own step, each with their own task gate — giving a clear overview of everyone's status at a glance.

Personal flows also serve as **smart to-do lists**: the gate tasks at the current step for each contact become the actions you need to take today.

---

## 4. Position in the Fibre Ecosystem

```
┌──────────────────────────────────────────────────┐
│                Fibre Platform                     │
│      Contacts · Organisations · Auth · SSO        │
└──────────┬────────────────┬───────────┬──────────┘
           │                │           │
   ┌───────▼──────┐  ┌──────▼─────┐  ┌──▼──────────┐
   │  Fibre Meet  │  │ The Thread │  │ Fibre Flow  │
   │  (meetings)  │  │ (events +  │  │ (flows &    │
   │              │  │  journeys) │  │  tasks)     │
   └──────┬───────┘  └─────┬──────┘  └──────┬──────┘
          └────── activity events ──────────┘
```

- **Contact & organisation data** lives in Fibre core — Fibre Flow reads and enriches it, never duplicates it
- **Fibre Meet meetings** are automatically logged as contact activities and can serve as contact-action triggers (e.g. "participated in a Meet" unlocks a gate task)
- **The Thread events / journey sessions** — attendance is also surfaced in contact timelines and can satisfy contact gate tasks
- Fibre Flow is the **operational memory and action layer** of the Fibre ecosystem

---

## 5. Key Features

### 5.1 Visual Flow Builder

The centrepiece of Fibre Flow. Admins design flows on an interactive canvas:

- **Drag and drop** steps onto the canvas
- **Connect steps** by drawing transitions between them
- **Configure gates** per transition: add tasks, assign actor type (personal / team / contact), set gate logic (all required vs. at least one)
- **Add branches** — multiple outgoing transitions from one step
- **Label transitions** with meaningful action names
- **Set step properties**: name, description, expected duration, default responsible role
- **Publish, archive, or close** flows (see §6 Lifecycle Management)
- Flows are versioned: changes don't affect contacts already in an older version

### 5.2 Dashboard

The home screen, personalised per team member:

**My Flows panel** — all flows I'm involved in (personal, team, workspace), grouped by scope; each flow shows: number of contacts at each step, my open tasks today.

**My Contacts in Motion** — contacts I own that are currently in a flow, with their step and next required action; overdue gate tasks highlighted.

**Team view (switchable)** — same view across the whole team — who owns what, what's blocked, what's overdue.

**My Tasks** — flat list of all my open tasks across all flows, sorted by due date; overdue tasks flagged prominently.

### 5.3 Flow Board

A visual board for a specific flow, showing all contacts currently in it:

- Contacts grouped by their current step (column per step)
- Each contact card shows: name, organisation, time at current step, next gate task
- **Drag a card** to the next step (only if the gate is satisfied — or with override + reason)
- Contacts overdue at a step are colour-flagged
- Filter by owner, entry date, or step duration
- Click a contact card to open their full profile

A project flow board gives an instant **status overview of all participants** in that project.

### 5.4 Contact Detail

Each contact has a unified profile:

- **Base data** from Fibre core
- **Active flows** — each flow they're in, current step, gate tasks remaining
- **Flow history** — completed flows with outcomes and dates
- **Activity timeline** — full chronological log:
  - Step transitions (auto-logged)
  - Gate task completions (auto-logged)
  - Fibre Meet meetings (auto-imported)
  - The Thread session attendance (auto-imported)
  - Manual notes, logged calls, document links
- **Tasks** — all open tasks linked to this contact, across all flows
- **Documents** — linked Google Drive / Docs files

### 5.5 Task System

Tasks are generated by flow gates but can also be created manually.

**Flow-generated tasks** — created automatically when a contact enters a step that has a gate; assigned per the gate configuration
**Manual tasks** — created freely, linked to a contact, organisation, flow, or standalone

**Task properties:** title, description, actor type (personal / team / contact), assignee, due date, linked contact / organisation / flow step, status (Open · In Progress · Done).

**Task views:** My Tasks, Team Tasks, Tasks per contact, Tasks per step.

### 5.6 Contact Action Logging

When a contact does something meaningful, a team member logs it as a contact action:

- Participated in a Fibre Meet *(auto-detected if contact exists in Fibre core)*
- Attended a Thread event / journey session *(auto-detected via activity log)*
- Signed a contract
- Confirmed attendance
- Submitted a form or document
- Any custom action defined in the flow

Logging a contact action can satisfy a gate task of type "contact" and potentially trigger an automatic step transition if all other gate conditions are also met.

### 5.7 Organisation View

- All contacts at an organisation, with their active flows and current steps
- Aggregated activity timeline
- Linked documents at the organisation level

### 5.8 Document Linking

- Attach any Google Drive / Docs URL to a contact, organisation, or flow step
- Document title and last-modified date shown inline
- Documents linked to a flow *step* are visible to anyone working that step

### 5.9 Insights & Reporting

- **Flow funnel**: contacts per step, drop-off rates, conversion to end state
- **Time at step**: average and individual — spot where people get stuck
- **Gate completion**: which task types are slowest (personal vs team vs contact)
- **Activity volume**: per team member, per flow, per time period
- **Relationship health**: contacts with no activity in X days
- **Task completion rates**: personal and team

---

## 6. Lifecycle Management — Keeping Things Clean

### Flow Lifecycle States

| State        | Meaning                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| **Draft**    | Being built in the flow builder, not yet active                          |
| **Active**   | Live — contacts can be added and moved through it                        |
| **Closed**   | No new contacts can enter; existing contacts can still be moved on       |
| **Archived** | Fully inactive; visible for reference but not editable                   |

Closing a flow prompts: *"X contacts are still active in this flow. Choose: complete them, move them to another flow, or mark as withdrawn."*

### Task Hygiene

- **Bulk close** outdated tasks on a contact or flow in one action
- **Archive a contact's flow participation** — closes all related open tasks and marks the flow as ended for that person
- **Legacy task sweep**: a periodic view showing tasks older than X days with no activity — bulk resolve or reassign
- Completed and archived items always accessible for audit but don't clutter active views

---

## 7. Information Architecture

```
Fibre Flow
├── Dashboard
│   ├── My Flows (personal · team · workspace)
│   ├── My Contacts in Motion
│   ├── My Tasks
│   └── Team View (toggle)
├── Contacts
│   ├── List / Search / Filter
│   └── Contact Detail
├── Organisations
├── Flows
│   ├── Flow Library
│   ├── Flow Board (per flow)
│   ├── Flow Builder (canvas — Admin only)
│   └── Flow Reports
├── Tasks
│   ├── My Tasks
│   └── Team Tasks
└── Reports
```

---

## 8. User Roles

| Role       | Capabilities                                                                       |
| ---------- | ---------------------------------------------------------------------------------- |
| **Admin**  | Everything — build and publish flows, manage lifecycle, view all data              |
| **Member** | Move contacts through flows, log activities, manage tasks, view all contacts       |
| **Viewer** | Read-only access *(Phase 2)*                                                       |

These should map to Fibre's existing `workspace_member` + per-resource `visibility` model rather than a fresh role table — see review doc.

---

## 9. Integration Points

| System             | Type                                | Data Flow                                                |
| ------------------ | ----------------------------------- | -------------------------------------------------------- |
| **Fibre Core**     | Native                              | Contacts, organisations, auth, SSO                       |
| **Fibre Meet**     | Native (via activity log)           | Meetings → timeline + contact action gate trigger        |
| **The Thread**     | Native (via activity log)           | Event / session attendance → timeline + gate trigger     |
| **Google Drive**   | Link-based                          | Documents on contacts, orgs, flow steps                  |
| **Email**          | Manual log (Phase 1) / sync (Phase 2) | Logged as timeline activities                          |

---

## 10. Out of Scope — Phase 1

- Automated transitions triggered by system events (no-code automation engine)
- Public-facing intake forms that drop contacts into a flow
- Contact-facing portal (contacts seeing their own flow status)
- Native mobile app (responsive web only)
- AI-powered suggestions
- Email client sync (Gmail / Outlook)
- Invoicing or financial tracking

---

## 11. Open Questions

1. **Gate logic per transition** — always "all tasks required", or configurable (all / any) per gate?
2. **Flow versioning** — when a flow is edited after contacts are in it, do existing contacts stay on the old version or migrate?
3. **Contact in same flow twice** — new participation, or reopen the old one?
4. **Step-level default tasks** — auto-created for every contact when they enter a step?
5. **Team flow ownership** — inherited from Fibre platform (`workspace_member` + Meet team membership), or configured in Fibre Flow?
6. **Notifications** — in-app only for Phase 1, or also email? Who gets notified when a gate task is completed?
7. **Google Drive depth** — manual URL paste, or OAuth file picker?

---

## 12. Suggested Next Steps

1. ✅ Name confirmed — **Fibre Flow**
2. Answer open questions above (especially #1, #2, #4) — see [`fibreflow-review.md`](fibreflow-review.md) for proposed defaults
3. **Design sprint: Flow Builder canvas** — the most novel component
4. **Design sprint: Dashboard** — personal flows + tasks view is the daily driver
5. Adopt the data model in [`fibreflow-data-model.md`](fibreflow-data-model.md)
6. Map Fibre Meet + Thread integration: shared contact resolution + activity-as-gate-trigger
7. Scaffold `apps/flow/` following the Meet template (see scaffolding plan)

---

*Briefing version 0.3 — May 2026*
*Based on founding team input sessions; spelling and ecosystem references normalised against Fibre v0.4 brief on 2026-05-17.*
