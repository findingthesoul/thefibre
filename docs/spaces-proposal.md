# Spaces — a system for conversations

**Sjoerd, 2026-09-23:** *"We can think through a system for spaces
(conversations, like the circle functions). Can we analyse functionality. What
exists. And then make a plan."*

**Status:** proposal. Nothing in it is built. No decision in §6 has been taken.

Three sections answer the three questions, in order: **§2–3** is the
functionality analysis (what Circle does, what we have), **§4–5** is where a
space would live and what it would be made of, **§7** is the plan. §6 is the
list of things only Sjoerd can answer, and §8 says exactly what I checked so
nobody has to trust a sentence of this.

---

## 1. The headline, before the detail

The Fibre is not missing a *container* for conversations. It is missing the
*loop*.

Everything a conversation needs around it already exists here and several
pieces are better than Circle's equivalents: identity, access gating by paid
membership, courses, events with RSVP, payments, a published API, GDPR
machinery, six locales, an HTML sanitiser, an asset bucket, a five-minute job
runner, and a participant sign-in that needs no password.

What does not exist, anywhere in 208 migrations and ten apps, is **one person
who is not a member of the workspace writing something that another person who
is not a member of the workspace reads.** Not one row. Participants write
today — enrolment answers, meet intake answers, an RSVP, their own profile —
and in every case exactly one audience reads it: the organiser.

That is the whole of the work. Not "add a posts table": cross the line where
the platform starts carrying what people say to each other, with everything
that follows it — moderation, notification, erasure of a voice from a
conversation other people are still having.

---

## 2. What Circle actually gives you

Circle's own help centre is JS-rendered and unfetchable from here (noted
already in `spike-circle-sso.md`), so this list is from knowledge of the
product and should be checked against Circle's current plan matrix before any
of it is quoted at a customer. The mapping column, however, is checked against
this repo — see §8.

| Circle function | The Fibre today | Gap |
|---|---|---|
| **Spaces** + space groups | nothing. Nearest containers: `thread_thread` (a journey), `team` (an access group), `workspace` | the container |
| **Posts** — a feed, rich text, images | one-way only: `thread_engagement` message types, authored by an organiser and **emailed**, never a feed. `flow_run_note` is internal CRM | the whole read/write surface |
| **Comments**, replies | nothing participant-facing. `opportunity_axis_comment`, `flow_run_note` are operator-side | — |
| **Reactions** / likes | nothing | — |
| **@mentions** | `flow_run_note_mention` — people only, operator-side, deliberately never inferred | reuse the rule, not the table |
| **Member directory** | **exists, narrowly**: `/my` shows fellow participants as *first name + initial*, gated by the `cohort_directory` consent AND an organiser switch (`thread_thread.share_participants_*`) | names but no faces, per-thread only |
| **Member profiles** | `identity_profile` (display_name, bio, photo_url, timezone) keyed by email, cross-workspace — **exists and is shown to nobody but its owner** | a read surface, not a model |
| **DMs** | nothing | — |
| **Chat** (real-time) | nothing. Supabase Realtime is not used anywhere in this repo | — |
| **Live rooms / streaming** | Meet: booking, personal room URL, Google/Zoom links. 1:1 and group scheduling, not broadcast | different product |
| **Events** + RSVP + calendar | **stronger than Circle**: activity engagements, `thread_rsvp`, iCal feeds, check-in, tickets, discount codes | — |
| **Courses** | **this is Thread.** Timeline, triggers, drip, approval, completion, certificates | — |
| **Paywall / memberships** | **stronger**: tiers, pricing rules, Stripe subscriptions, grace/lapse, the purchase ledger | — |
| **Moderation** — pin, lock, hide, report, moderator role, spam | nothing, at any layer | the safety floor |
| **Notifications** — in-app bell, email digest, push | outbound email (Resend) + a 5-minute in-process scheduler. **No in-app notification, no digest of other people's activity, and no unsubscribe or preference anywhere in the mail path** | the return path |
| **Search** across content | per-entity search only (persons, organisations — accent-insensitive). No content search | — |
| **Invitations / onboarding** | `signup_request`, workspace invites, membership join pages, embeddable buttons | reusable |
| **Gamification** (points, leaderboards) | nothing | probably never |
| **AI** | in-app assistant (structure-only allow-list) + MCP personal access | ahead |
| **Custom domain / branding** | `public_site`, `public_root_slug`, workspace brand, `/embed.js` | reusable |
| **Mobile app** | none. PWA manifests + a shared bottom nav | — |
| **SSO** | Fibre answers OAuth2 already (the Circle spike) | ahead |
| **API / webhooks** | `/api/v1/apps/*` published contract, app keys, scopes, MCP | ahead |
| **Analytics** | `/admin/economics` (money). No engagement analytics | — |

Read the column: we are ahead of Circle on the things that are hard to build
and absent on the things that are easy to build and hard to *run*. Moderation
and notification are not features, they are obligations. Circle charges for
carrying them.

### What Circle is doing for us right now

`lib/circle.ts` drains `membership_member_access` against Circle's Admin API:
member activates → invite to the tier's space; lapses → remove from the space,
or from the community when the grant names no space. One-directional, no
identity federation, members hold a Circle password. The spike in
`spike-circle-sso.md` adds the other half — Circle can use *us* as its login,
with membership status as the gate — and is unshipped.

So today, **the conversation is Circle's and the membership is ours.** Any plan
here has to say what happens to that seam, and §7 does: nothing, for a long
time.

---

## 3. What already exists that a space would stand on

Not a list of nice-to-haves — these are the pieces that make the estimate in §7
small enough to be worth doing.

1. **A participant identity that needs no password.** `participantEmailFromAuth`
   verifies a Supabase session against JWKS and yields one fact: a verified
   email. Google or an 8-digit code. Four surfaces already trust it.
2. **Email → person, reliably.** `lib/resolve-person.ts`, `person_contact_point`
   with primary + secondary emails, citext, and a merge history that respects
   append-only. The hard part of "who is writing" is done.
3. **A member home that already exists** — `apps/my`, live at
   my.thethread.app, four destinations by deliberate design.
4. **A directory with its legal groundwork laid.** `cohort_directory` is a
   registered processing purpose with copy in six locales, opt-in at enrolment,
   never defaulted, and there is a working consumer. A space's member list is
   this, widened.
5. **A cross-workspace personal profile nobody can see.** `identity_profile`
   already holds bio and photo. A space is the first thing that gives them a
   reason to exist.
6. **Access sources, already modelled.** `membership_member` (active/grace),
   `thread_enrolment`, `team_member`, `workspace_member` + roles,
   `app_membership`. Four different honest answers to "who is in this room".
7. **The grant journal.** `membership_access_grant.kind` + `config`, drained
   idempotently. Circle is worker #1. A native space is worker #2 — and it is
   the cheapest worker imaginable, because it calls no external API.
8. **A sanitiser on the way in.** `lib/rich-text.ts`, DOMPurify, an allowlist
   matching what the editor can emit. Written for organiser-authored HTML on
   public pages; a participant body needs it more, not less.
9. **An asset bucket with an audited SVG path.** `lib/uploads.ts` — images
   only, 5 MB. Documents would be a widening, not a new system.
10. **A job runner.** One warm Fly machine, a five-minute interval, seven jobs
    on it, every send dedup-logged. A digest is job #8.
11. **Six locales with compile-time completeness** and a typed catalog.
12. **Rate limiting** (`lib/rate-limit.ts`, in-memory, per-IP) — honest about
    being an abuse brake, which is what a write surface needs first.

And the constraints that shape every line of §5: no Supabase from the web tier,
`X-App-ID` on every call, RLS on every table, soft delete only for personal
data, cursor pagination only, activity append-only (type + subject, never a
body), `/api/v1/apps/*` additive-only.

---

## 4. Where a space lives — the decision that shapes everything

Today's decision about Flow (`flow-as-a-building-block-proposal.md`) is the
right precedent, and it points one way.

**Option A — a tenth app, "Spaces", with its own seat, tile and domain.**
Honest, familiar, and wrong. A space is never the thing someone came for; they
came for a journey, a membership or a team. An app you must choose is a
sidebar item people visit once. It also multiplies the surface: its own
sidebar, settings, i18n, mobile nav, seat and plan gate.

**Option B — build it inside Membership.** Fastest to a demo for soul.com, and
it strands every other use: a Thread cohort wanting to talk, a team wanting an
internal channel, a Festival planner wanting participants to meet each other.
It is also how `flow_run_note` ended up named after a run.

**Option C — a building block (recommended).** One set of `space_*` tables and
one set of API routes; the UI is **born in `@thefibre/shared/ui`** (the
components-first rule — three plausible callers exist on day one) and rendered
by whichever app owns the context:

- **Thread** — a cohort space on a journey. Organiser side: the space's
  settings and moderation live next to the timeline.
- **Membership** — the community space(s) a tier unlocks. This is the Circle
  replacement path, if it is ever taken.
- **`/my`** — where a participant actually reads and writes. One destination,
  which is the fifth, and §6 D5 is about that cost.
- **Connect / a team** — an internal space, later, and free once the above
  exists.

A space is **owned by a workspace and attached to a context** (`thread`,
`membership_tier`, `team`, or `workspace` = the whole community). Access is
*derived from the context*, not administered separately — that is the single
design choice that keeps this small. Nobody maintains a membership list; being
enrolled, or holding an active tier, *is* being in the room.

### The naming problem, which is real

- `conversation` is **taken** — an engagement type (a live gathering).
- `thread` is **taken**, and it is the master brand. So the industry's default
  word for a chain of replies is unavailable. Say **post** and **reply**.
- `space` collides mildly with Connect's open ask #11 ("a cloud around a
  location / space") where it means a venue.
- The naming brief reserves **Stitch / Knot** for *"a single moment of contact,
  smaller than a Thread"* — which is a fair description of a post. Activating
  a reserved name is cheaper than inventing one, and the brief's own test ("would
  a customer say it out loud?") is the judge. D7.

---

## 5. What it is made of

Deliberately small. Every table workspace-scoped, RLS on, soft delete.

```
space                 workspace_id, context_kind (thread|tier|team|workspace),
                      context_id, title, purpose, locale, is_open (read-only
                      when false), created_by, archived_at, deleted_at

space_post            space_id, workspace_id, author_person_id, body_html
                      (sanitised in), body_text (search + digest), pinned_at,
                      locked_at, client_ref (idempotency + autosave, the
                      flow_run_note pattern), edited_at, deleted_at,
                      deleted_by, deleted_reason

space_reply           post_id, space_id, workspace_id, author_person_id,
                      body_html, body_text, client_ref, edited_at, deleted_at…

space_reaction        (post_id|reply_id), person_id, kind, created_at   -- PK on
                      (target, person_id, kind); one table, one nullable column
                      is cheaper than two

space_mention         (post_id|reply_id), person_id, workspace_id
                      -- an @ typed on purpose, never inferred (the v0.73.10
                      rule, and the note-mention header states it)

space_read            space_id, person_id, last_read_at
                      -- unread counts and "what to put in your digest" are the
                      same fact

space_report          target, reporter_person_id, reason, resolved_at,
                      resolved_by   -- the safety floor, phase 3

space_notify_pref     person_id, space_id (nullable = all), channel, cadence
                      (off|immediate|daily|weekly)
                      -- and an unsubscribe token, because none exists today
```

Notes that matter more than the columns:

- **The wall holds.** Bodies are app-owned content and never cross. What
  crosses is `activity`: type + subject — `space_post_written`, subject = the
  space. That is enough for a person's timeline, Flow triggers and Connect's
  "when did we last actually speak" to see that something happened without
  seeing what was said. `last_spoken_at` deliberately counts personal kinds
  only; a space post is *not* a personal conversation and must not reset it.
- **The author is a `person`, not a `user`.** Participants have no
  `public."user"` row. Every FK goes to `person`; every read resolves the
  writer through `resolve-person`.
- **RLS cannot see a participant.** A participant's JWT carries no workspace
  claim, so these tables get *no* authenticated policy for the participant path
  — the API answers with the service role and an **explicit** space-access
  check, exactly as `membership_settings` and the app-key paths do today. The
  organiser path can and should have a normal workspace policy. This asymmetry
  is the single most dangerous thing in the design and the first thing a test
  should pin (`rls-floor.int.test.ts` is where it belongs).
- **Erasure.** A deleted account's posts cannot simply vanish: other people's
  replies reference them. Soft delete + a tombstone author ("a former member")
  keeps the conversation legible and the person gone. Article 15 export must
  include a member's own posts, and does not today.
- **Retention.** `retention_policy` exists as a table with no admin surface. A
  space is a strong argument for finishing it — a community's archive is
  precisely the thing that should expire.

---

## 6. Decisions needed (Sjoerd)

| # | Question | If unanswered |
|---|---|---|
| **D1** | Is the goal (a) conversation *inside* a Thread cohort, (b) replacing Circle for soul.com, or (c) both eventually? | I would build (a) first — it is the smaller room, the people are already identified, and a failure is contained |
| **D2** | Does v1 include reactions? They are cheap to build and change the feel of a room more than anything else on the list | recommend yes, one kind only |
| **D3** | Email on every post, a daily digest, or nothing until asked? Anything but "nothing" needs the unsubscribe path that does not exist | recommend **daily digest, opt-in, off by default**, and build the unsubscribe path with it |
| **D4** | Who moderates? Workspace `admin`/`organiser`, or a per-space host (the per-thread facilitator precedent)? | recommend facilitator-style: a space host, defaulting to the context's owner |
| **D5** | `/my` has four destinations *by design* (member-portal-plan §3: "seven is a menu; four is a page you can hold in your head"). A space is a fifth, which trips the bottom nav's More sheet | recommend spaces appear **inside** the thing they belong to on NEXT / MEMBERSHIPS, not as a fifth tab |
| **D6** | Are attachments (a PDF, not an image) in scope? Uploads accept images only today | recommend no, until asked |
| **D7** | Naming: "Space" + post/reply in plain words, or activate the reserved Stitch/Knot? | recommend plain words, revisit when it is public |
| **D8** | Does a space ever have a *public* face (read without signing in), like a public thread page? | recommend no for v1 — it doubles the threat model |

---

## 7. The plan

Sizing is in sessions of the kind this repo has, not days. Each phase ends
shippable and useful; none of them requires the next.

### Phase 0 — decide (no code)
D1, D3, D4, D5. The rest can be decided while building.

### Phase 1 — a space, and the smallest real loop · ~2 sessions
`space`, `space_post`, `space_reply` + the API (cursor-paginated, sanitised in,
rate-limited, `client_ref` idempotency), the shared UI in
`@thefibre/shared/ui/space.tsx`, one context only (D1's answer), the organiser
side in that app, the participant side in `/my`, `activity` rows on write, the
RLS floor test, i18n in all six locales. **No** notifications, reactions,
mentions, moderation, search. Post → read → reply, and that is it.

*Why this order:* it is the only phase that proves the thing nobody here has
done — a participant writing what another participant reads. Everything after
it is addition; if this phase feels wrong, nothing is stranded.

### Phase 2 — the return path · ~2 sessions
Reactions (D2), `@` mentions reusing the intentional-marker rule, `space_read`
+ unread counts, the digest as scheduler job #8, `space_notify_pref` **and the
unsubscribe path the mail system has never had**. This is the phase that makes
people come back, and the phase that can annoy them; the preference and the
unsubscribe link ship in the same release as the first email, not after.

### Phase 3 — the floor we owe · ~1.5 sessions
Pin, lock, hide-with-reason, `space_report`, mute-a-person, the host role (D4),
an audit trail for every moderator action, erasure tombstones, Article 15
export including one's own posts, and `retention_policy` reaching a space.
**Not optional and not last in importance** — it is third only because a room
with four known people in it can survive a week without it, and a community
cannot.

### Phase 4 — reach · ~2 sessions, demand-first
Content search, drafts and scheduled posts, attachments (D6), an in-app
notification surface, a space inside an embed, a Flow trigger on space
activity, engagement analytics. Each is independent; build only what a real
workspace asks for.

### Phase 5 — the Circle question · decide, don't schedule
Only after a real community has run on phases 1–3. Then the comparison is
honest: what Circle still does better (mobile app, live rooms, gamification,
the polish of a product with a moderation team behind it) against what we do
better (one identity, payments, courses, GDPR, no second bill). The migration
path exists either way: `membership_access_grant.kind` gains `space`, the
worker writes a row instead of calling an API, and a tier can grant both at
once while people move. Circle stays wired up throughout.

### What this deliberately does not do
No DMs (a different consent shape and a different abuse surface), no real-time
chat (no Realtime in this repo, and polling is honest at this scale), no
streaming, no gamification, no mobile app.

---

## 8. What I actually checked

So that nothing above has to be taken on trust, and so the next reader knows
the boundary of the claim:

- **Read:** all 208 migration filenames and the full text of the notes,
  note-mention, teams-organise-notes, membership-schema and
  todo-is-an-org-feature migrations; `lib/circle.ts`, `lib/rich-text.ts`,
  `lib/uploads.ts`, `lib/participant-auth.ts`, `lib/rate-limit.ts`,
  `lib/email/client.ts`, `server.ts`'s scheduler block, the engagement-type
  block in `routes/thread.ts`, the cohort-directory query in the same file,
  `apps/my/app/nav.tsx`; `spike-circle-sso.md`, `naming-brief.md`,
  `membership-proposal.md` §3.5–3.8, `flow-as-a-building-block-proposal.md`,
  `member-portal-plan.md` §3, the head of `build-plan.md` and
  `connections-asks.md`.
- **Derived from the schema, not from a doc:** the table inventory in §2's
  middle column is `create table` across every migration — there is no posts,
  comments, reactions, DM or moderation table of any kind.
- **Greps that returned nothing**, which is why some claims are stated flatly:
  `realtime` / `.channel(` anywhere in `apps` or `packages`; `unsubscribe`
  anywhere in the API or shared package.
- **Not checked:** production data (no counts of members or enrolments are
  quoted here), Circle's current plan matrix and API limits, and whether
  `cohort_directory` copy has been reviewed in the four machine-translated
  locales.
