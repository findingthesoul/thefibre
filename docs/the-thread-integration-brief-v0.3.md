# The Thread — Integration Brief
## The Fibre v0.3
**Version:** 0.3
**Parent document:** The Fibre Technical Brief v0.3
**Slug:** `the-thread`
**Domain:** thread.thefibre.app
**Changes from v0.2:** Parent platform renamed to The Fibre (thefibre.app).

---

## 1. What The Thread is

The Thread is an event and journey platform. It holds two distinct modes that share the same identity and registration layer but have different content structures.

An event is a public or managed happening with registration — a conference, symposium, or open workshop. It has a schedule, sessions at specific times, speakers and facilitators, tracks and breakout rooms, and registered attendees who move through it. The EBBF Annual Conference "Reorienting Towards Hope" in Athens is an event on The Thread.

A journey is a personal arc. Someone moves through a designed sequence of experiences over time — milestones, steps, reflections, resources — at their own pace, with their own progress. A journey may follow from an event (post-conference follow-through) or stand alone (a leadership development track over six months). Progress is individual and personal.

In the The Fibre model, The Thread is registered with `slug = 'the-thread'` and creates programmes with `format = 'event'` or `format = 'journey'`. It does not own user accounts. Identity and contact data come from the platform. In-app experience data — reflections, session selections, peer connections — stays inside The Thread.

---

## 2. The two programme formats

### Event (`format = 'event'`)

An event has:
- A programme record with dates and location
- Sessions — each with a facilitator or speaker, time slot, capacity, track, and format
- Registration — persons enrolled via public or managed registration
- Session selections — which sessions each participant chose (optional, per event config)
- Attendance tracking per session
- Event materials and resources

The experience inside an event — which sessions someone attended, their notes, peer connections made — stays in The Thread.

### Journey (`format = 'journey'`)

A journey has:
- A programme record with start date and expected duration
- Milestones — major stages in the arc (e.g. "Awareness", "Practice", "Integration")
- Steps within each milestone — specific actions, reflections, resources, conversations
- Personal progress — which steps are complete, which are in progress
- Reflection responses — personal writing prompted by the journey design
- Optional cohort layer — a group of people moving through the same journey together

The experience inside a journey — step responses, personal reflections, milestone notes — stays in The Thread. A participant may choose to promote a reflection to their platform learning profile. That is their choice.

---

## 3. The data wall

**What stays inside The Thread — never crosses to the platform:**
- Session schedule and participant session selections
- Session content (materials, slides, resources)
- Personal reflection responses to journey prompts
- Journey step completion notes
- Peer connections and introductions made within The Thread
- Cohort directory content (names visible within The Thread — consent-gated)
- Facilitator observations from sessions (if captured in The Thread)
- Event recordings or materials

**What crosses to the platform — events only:**

| Event type | Subject example |
|---|---|
| `event_registered` | Registered: EBBF Annual Conference 2026 — Athens |
| `session_attended` | Attended: Practice lab — Reorienting Towards Hope |
| `journey_step_completed` | Completed step: First reflection — Vertrouwen als de Basis journey |
| `programme_completed` | Completed: Post-EBBF leadership journey |

The activity row carries `type`, `subject`, `person_id`, `app_id: 'the-thread'`, and `occurred_at`. No reflection content. No session notes. No peer connection details. The platform knows something happened. It does not know what was written or experienced.

---

## 4. What The Thread owns vs what the platform owns

| Data | Lives in | Access |
|------|----------|--------|
| Person identity (name, email, avatar) | Platform | Read from `/persons/:id` at session load |
| Organisation identity | Platform | Read from `/organisations/:id` |
| App access and role | Platform | Resolved from `app_membership` via JWT |
| Session schedule and content | The Thread | Programme managers and facilitators |
| Session selections per participant | The Thread | Participant (own) + programme manager |
| Personal reflections and journey responses | The Thread | Participant only (default); facilitator with explicit permission |
| Milestone and step completion | The Thread | Participant + programme manager |
| Peer connections made | The Thread | Participant only |
| Event materials | The Thread | All enrolled participants |
| Enrolment state (status, progress) | Platform | The Thread writes via `/enrolments/:id` |
| Activity events | Platform | The Thread writes via `/activities`; events only |

---

## 5. Registration flows

### 5a. Public event registration (primary path for events)

Events are typically open or semi-open. Visitors register themselves.

```
1. Visitor arrives at event landing page (public endpoint — no auth required)
   → The Thread fetches programme details
2. Registration form: name, email, organisation, optional fields
   → POST /persons (creates or matches contact in platform)
   → POST /privacy/consent:
     - transactional_email (required)
     - marketing_email (opt-in, clearly separated from required consent)
     - cohort_directory (opt-in — "show my name to other attendees")
     - learning_analytics (legitimate interest — inform, do not require)
3. Magic link sent to email
   → On click: user account created (if new), app_membership created
   → POST /programs/:id/enrolments { person_id, status: 'enrolled' }
4. Participant enters The Thread
   → GET /auth/me → identity, app_membership, active enrolments
```

### 5b. Managed event invitation (for curated or private events)

Some events — like EBBF — have a curated participant list. A programme manager adds participants directly.

```
1. Programme manager identifies or creates person record
   → GET /persons?email=... or POST /persons
2. POST /programs/:id/enrolments { person_id, status: 'invited' }
3. Platform checks: does this person have a user account?
   → If yes: enrolment linked to existing user
   → If no: magic link invitation sent (transactional_email consent created)
4. Person clicks magic link → account created → app_membership created
5. Enrolment status: 'invited' → 'enrolled'
```

### 5c. Journey enrolment

Journeys may follow an event or be standalone. Enrolment is similar to managed invitation but the programme context is personal.

```
1. After event completes OR programme manager creates journey programme
   → POST /programs { format: 'journey', ... }
2. Enrolments created for participants:
   → POST /programs/:id/enrolments { person_id, status: 'enrolled' }
   → If participant already has platform account from the event: no new magic link needed
   → If new person: invitation flow as above
3. Participant enters The Thread journey view
   → Sees their milestones, current step, progress
   → Step completions update enrolment.progress_pct via PATCH /enrolments/:id
```

### 5d. Returning user

```
1. User visits The Thread
2. No active session → redirect to The Fibre SSO
   → /auth/login?redirect_uri=https://thread.thefibre.app
3. JWT issued → GET /auth/me
   → identity, app_membership, active enrolments (events + journeys)
4. User lands on their dashboard
```

---

## 6. Role model

| Role | Description | Key capabilities |
|------|-------------|-----------------|
| `participant` | Registered attendee or journey participant | Access own enrolments, view content, update own progress |
| `facilitator` | Leads sessions within an event or journey | View own session participants, add session notes |
| `programme_manager` | Manages events and journeys | Create and edit programmes, manage enrolments, export data |
| `admin` | Full access | All of the above plus workspace settings |

Fine-grained permissions:

```json
{
  "can_view_cohort_directory": true,
  "can_export_participants": false,
  "can_send_cohort_messages": true,
  "can_view_participant_reflections": false,
  "can_access_analytics": true
}
```

`can_view_participant_reflections` is `false` by default. Journey reflections belong to the participant. A facilitator or programme manager does not see them unless the participant explicitly shares.

---

## 7. Enrolment states

```
invited → enrolled → active → completed
                   ↘ dropped
```

| Status | Meaning | Who sets it |
|--------|---------|-------------|
| `invited` | Invitation sent, not yet accepted | Platform (on invitation send) |
| `enrolled` | Accepted, not yet started | Platform (on magic link click) |
| `active` | Attending sessions or progressing in journey | The Thread (on first interaction) |
| `completed` | Event fully attended or journey milestones met | The Thread (on completion criteria) |
| `dropped` | Left before completion | Programme manager (manual) |

---

## 8. The EBBF conference as a concrete example

The EBBF Annual Conference "Reorienting Towards Hope" in Athens.

On the platform: one `program` record with `format: 'event'`, `app_id: 'the-thread'`, dates, location.

In The Thread: sessions (practice labs, keynotes, plenaries), each with a facilitator, time slot, track, and capacity. Participants select sessions. Attendance is tracked per session.

Activity events written to the platform:
- `event_registered` for each participant at registration
- `session_attended` for each session a participant attends

What stays in The Thread: which practice lab a participant chose and why, notes from the session, peer introductions made, group reflections.

After the conference, some participants begin a follow-up journey: `format: 'journey'`, linked to the same people via new enrolments. The platform contact timeline shows both: the conference registration and attendance, then the continuing journey steps. The thread is unbroken. The content of the journey stays in The Thread.

---

## 9. Consent model

**At public event registration:**

| Purpose code | Legal basis | Required |
|---|---|---|
| `transactional_email` | Contract | Yes |
| `marketing_email` | Consent | No — opt-in |
| `cohort_directory` | Consent | No — opt-in |
| `learning_analytics` | Legitimate interest | Inform, do not gate |

**At journey start (if not already on record):**

Check for `cohort_directory` consent if the journey has a visible participant list. If not on record, prompt on first login.

**For personal reflections:**

Journey reflections are `facilitation_data` under legitimate interest or contract basis depending on context. The platform retention policy for `facilitation_data` applies. Participants can request deletion of their reflection content via the erasure flow — The Thread registers an erasure webhook handler that zeroes response content.

The Thread never sends a non-transactional email without a valid `consent_record` for `marketing_email`. This check is in the platform email service, not in The Thread's application code.

---

## 10. The promotion model

In-app experience data stays in The Thread. Distilled insights can be promoted to the platform by the participant or by a programme manager with permission.

**Participant-initiated promotions:**

| Source in The Thread | Destination on platform |
|---|---|
| Journey reflection (chosen by participant) | `person_learning.development_goals` or `post_programme_reflection` |
| Programme completion experience | `person_learning.prior_programmes` |

**Programme manager promotions (with participant consent):**

| Source in The Thread | Destination on platform |
|---|---|
| Observed learning style | `person_learning.learning_style` |
| Observed group role tendency | `person_learning.group_role_tendency` |
| Themes this person engaged most with | `person_learning.learning_interests` |

Promotion is always explicit. The participant must consent for programme manager promotions. The participant initiates their own. Promotion is one-way — platform fields become independent of the source data in The Thread.

---

## 11. What to decommission

If The Thread currently manages:
- Own user table or user model → retire; identity comes from platform
- Own authentication → retire; SSO via Supabase Auth
- Own session management → retire
- Any local copy of participant name or email → retire; read from `/persons/:id` at runtime
- Any registration form that does not write to `/persons` and `/privacy/consent` → retire

What The Thread retains and owns:
- Event content structure (sessions, speakers, tracks, schedule)
- Journey content structure (milestones, steps, resources, reflection prompts)
- Session selection logic
- Participant reflection responses
- Cohort directory (consent-gated, visible within The Thread only)
- Its own frontend routing, event and journey UI, and design system

---

## 12. API calls The Thread makes to the platform

At session load:
```
GET  /auth/me                           → identity + app_membership
GET  /persons/:id/enrolments            → participant's active programmes
```

At registration:
```
POST /persons                           → create or find contact
POST /programs/:id/enrolments           → create enrolment
POST /privacy/consent                   → record consent choices
PATCH /enrolments/:id                   → update status on magic link click
```

At event delivery:
```
POST /activities                        → write session_attended events
PATCH /enrolments/:id                   → update status, progress_pct
```

At journey delivery:
```
POST /activities                        → write journey_step_completed events
PATCH /enrolments/:id                   → update progress_pct on step completion
```

At programme management:
```
GET  /programs/:id/enrolments           → participant list
GET  /persons/:id                       → participant profile
GET  /persons/:id/activities            → event history (platform events only)
```

The Thread never calls:
```
GET  /deals                             → Fibre Sales territory
GET  /activities (other apps' content)  → events only; no content from other apps
```

---

## 13. Integration checklist

- [ ] App registered: `slug: 'the-thread'`, supports `format: 'event'` and `format: 'journey'`
- [ ] All authentication redirected to The Fibre SSO
- [ ] `X-App-ID: the-thread` header on all outbound API calls
- [ ] `app_membership` resolver middleware in place
- [ ] Public event registration form writes to `/persons` and `/privacy/consent` first
- [ ] Magic link invitation flow tested end-to-end (event and journey)
- [ ] Enrolment status transitions implemented for both formats
- [ ] Session attendance events write to `/activities` — type + subject only, no notes
- [ ] Journey step completion events write to `/activities` — type + subject only, no reflection content
- [ ] Participant reflections stay in The Thread schema — never in platform activity body
- [ ] `can_view_participant_reflections` permission enforced
- [ ] Cohort directory respects `cohort_directory` consent flag
- [ ] Promotion UI implemented for participant-initiated profile updates
- [ ] Erasure webhook handler registered — zeroes reflection responses and journey notes
- [ ] Own user table and authentication decommissioned

---

*Questions about the platform data model or API contracts: refer to The Fibre Technical Brief v0.2.*
