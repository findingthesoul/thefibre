# Keeping data integrity when capture gets easy

*Written 2026-09-11, answering Sjoerd: "How to work with Fibre in a way that
keeps data integrity?" — given quick mobile entry, calendar and email reading,
Meet integration, and possibly a separate app for task and sales input.*

*Fourth companion to [`connections-what-exists.md`](connections-what-exists.md),
[`connections-market.md`](connections-market.md) and
[`connections-calendar.md`](connections-calendar.md).*

> **Reframed 2026-09-11 — read this first:**
> [`connections-model.md`](connections-model.md). Sjoerd: for facilitators the
> core need is a *landscape* — where is everybody, what needs attention, who
> knows whom, what needs moving — and closeness to the community rather than
> sales. **The pipeline is a view of that, not the other way round.** That doc
> carries the current build order and decisions **D23–D27**.

---

## 0. The principle: Fibre does not clean data, it declines to hold it

*(Added 2026-09-11, answering "what is the best way to keep it clean,
considering the whole concept of the Fibre?" — this is the organising idea for
everything below, written after the rest and placed first.)*

Most systems get dirty because they are buckets. Things go in, nothing comes
out, and fields exist whether or not anything needs them. Fibre is deliberately
not a bucket: every field has a named owner and a stated reason, enforced by
`app_id` tagging and RLS rather than by a policy document.

**So the best cleaning mechanism in Fibre is not a cleaning mechanism.** It is
the set of choices that shrink the surface capable of being wrong. Ranked by
leverage, highest first:

**1. Derive instead of storing.** A field you do not store can never be wrong,
never drifts, and needs no maintenance for the life of the system. This is
already Fibre's instinct — profile tabs appear because data exists rather than
because someone configured them — and it is the single highest-leverage
cleanliness decision available. It is why community standing is derived (D24),
why relationship edges are computed at read time and kept nowhere (D26), and why
relationship counters are read-only (D16). **Stored state rots; derived state
cannot.**

**2. One accessor per fact.** Fibre has discovered this twice, reactively:
`lib/connections.ts` for Google tokens and `lib/payment-accounts.ts` for Stripe
accounts, both created because one value was read from several places and
drifted. `resolvePerson()` (§3, D13) is the third instance and is not built.
Make it a standing rule rather than a lesson relearned each time.

**3. Provenance on everything written.** `client_ref` and `origin` (§4.1, §4.3)
mean any bad batch is one query to find and one to reverse. **The goal is not a
system that never gets dirty — it is a system where every mistake is
reversible.** That is far cheaper to achieve and Fibre's append-only activity log
already works this way.

**4. Minimisation is cleaning done in advance.** The cheapest field to keep clean
is the one that does not exist. The app-justifies-the-field rule *is* a data
hygiene policy; it just does not look like one. The dormant
`person.custom_fields` column (§5) is what it looks like when the rule lapses.

**5. Retention — the counterweight Fibre is missing.** Soft-delete-only is right
for correctness and, without a reaping policy, wrong for hygiene: this database
has never deleted anything and has no mechanism to (§9.6). This is the one place
where an existing principle creates the problem instead of solving it, so it is
not optional.

**6. Then the sweep** (§9), and **7. then AI** (§9.4), in that order — because a
sweep is the admission that the five above let something through, and AI is the
admission that the sweep could not decide.

**The one thing that cannot be derived** is what a person said in a
conversation. That is irreducibly typed by a human, it is the core of
Connections, and for it the only defence is discipline at the moment of capture:
autosave with real drafts, defaults instead of questions, provenance on the row
(§7). Everything else, prefer not to hold it.

---

## 1. Your five points, checked

Four are right as stated. One needs splitting.

1. **Super easy UX, mainly mobile, for quick entry.** Right, and the adoption
   data says it is the whole ball game — over 60% of CRM failures are adoption,
   and the complaint is always the cost of entry. Fibre has the mobile shell
   already (bottom nav in six apps since v0.45.0).
2. **Tasks in the agenda, reading the calendar and email.** Split this.
   *Calendar* is nearly free — read and write scopes already granted, tokens
   already stored, one missing function. *Email* is not: Gmail scopes are
   restricted, needing verification and an annual security assessment, on a
   platform that sells data minimisation. The cheap substitute is a BCC
   address. So: calendar now, email later and by BCC.
3. **Keeping it simple.** Right, and the mechanism that keeps it simple is §2
   below, not discipline.
4. **Auto integration with Meet.** Right, and more built than expected — Meet
   already creates real calendar events with Meet links, and its slot engine
   already computes availability from free/busy.
5. **A separate app for task and sales input.** Right *if* it is a client and
   not a second database. That distinction is this document.

---

## 2. The frame: surfaces multiply, tables do not

Fibre already has seven front ends. An eighth for quick capture is not a
problem — it is the same problem you already solved seven times.

The rule that makes it safe:

> **A capture surface owns no data.** It writes through the same API to the
> same tables that Flow writes to. It has no schema, no migration, no store of
> its own.

Then there is no integrity problem *arising from the second surface*, because
there is no second copy of anything. All the real hazards below exist already;
easy capture just makes them fire more often.

Concretely, the capture PWA sends `X-App-ID: fibre-flow`. It is a second front
end for Flow, not a new app in the Fibre sense. That keeps `app_membership`,
RLS scoping and the per-app profile tabs exactly as they are, and it means
nobody has to grant a new app access to see their own notes. `app_id`
identifies the data domain, not the binary — Meet's web app and a hypothetical
Meet phone app are both `fibre-meet`.

This is also consistent with decision D1: no eighth *app*. An eighth *client*
is a different thing and costs almost nothing.

---

## 3. The hazard that already exists, and will get worse

**Nine call sites across six files insert into `person`:** `persons.ts`,
`meet.ts`, `thread.ts`, `members.ts`, `apps.ts` and `membership.ts` (twice).
Each does its own match-or-create. There is **no shared resolver**, and there
is **no unique constraint** — `person.email` is `citext` with a plain index
(`person_email_idx`), so the database will happily hold two Marjas.

Add calendar scanning and BCC capture and that becomes eleven writers minting
people, two of them from fuzzy email matches. This is the single biggest
integrity risk in the whole Simple Sales exploration, and it predates it.

**Recommendation: one `resolvePerson()` accessor**, the same pattern Fibre
already uses for `connections.ts` (Google tokens) and `payment-accounts.ts`
(Stripe accounts) — both introduced precisely because the same value was being
read from several places and drifting. Every path that might create a person
goes through it. It takes an email, optional name, and a `source`, and it:

- matches on `lower(email)` within the workspace, excluding soft-deleted rows
- returns the existing person if found
- creates only when the caller passes an explicit `create: true`
- records how the row came to exist (§4)

**Do not add a unique index on (workspace_id, email) as the fix.** Two reasons.
The migration would fail on any workspace that already has duplicates, so it
needs a dedup pass first. And it is wrong in the real world: couples share an
address, and `info@` is one mailbox for a whole organisation. Uniqueness is a
guideline the API enforces with judgement, not an invariant the database can
hold.

A merge tool follows from this, and should be built before auto-capture, not
after. The first duplicate is inevitable; the question is whether there is a
way to fix it.

---

## 4. Six mechanisms, each against a named hazard

### 4.1 Client-generated ids make retries free

*Hazard: quick mobile entry on a bad connection. The request times out, the
user taps save again, and now there are two notes.*

The client mints a uuid before the first attempt and sends it as `client_ref`.
The server upserts on `(workspace_id, client_ref)`. Retrying is then always
safe, and an offline queue can replay without thinking.

Fibre already has this pattern and it already works: the purchase ledger
upserts on `(app_id, item_ref)` with update-first-insert-second, specifically
so Stripe webhook retries and double-submits are harmless
(`apps/api/src/lib/purchases.ts`). Copy it. Do not invent a second approach.

### 4.2 The record is editable; the trail is not

*Hazard: two writers to the same row, last write wins, and nobody can tell what
was lost.*

A note is something a person typed, and they must be able to fix a typo. So
notes are editable by their author. But everything *derived* from a note —
the `activity` row it produces, the touch count, the last-touchpoint date — is
append-only, exactly as `activity` already is (enforced by trigger, not
convention).

This is the existing Fibre rule stated for a new object: corrections are new
rows. It means an edit can never quietly rewrite history, only add to it.

### 4.3 Provenance on every row a machine created

*Hazard: the scanner has a bad week and writes four hundred wrong notes. Which
ones were they?*

Every note and every task carries an `origin`: `manual`, `calendar_scan`,
`bcc`, `import` — plus the id of the run that made it. Without this, a bad
auto-capture release is unfixable, because there is no way to separate machine
rows from human ones. With it, the repair is one query.

This is cheap to add now and impossible to backfill later. It is the single
column I would least want to ship without.

### 4.4 Derived fields are derived, never typed

*Hazard: `org_relationship.last_touchpoint_at` is editable in the UI and also
computed from notes. The two disagree within a week.*

`org_relationship` already has `touchpoints_count`, `last_touchpoint_at`,
`total_participants_reached` — currently written by nothing. When they start
being written, they are read-only in the interface and computed from notes and
the purchase ledger. `relationship_stage` and `next_opportunity` are judgement
calls and stay hand-editable.

Pick one writer per field. Never both.

### 4.5 A queue that does not lie

*Hazard: the PWA says "saved" when it means "queued", the sync later fails,
and the user believes a conversation is recorded that is not.*

Queued and synced must look different on screen, and a permanently failed item
must surface rather than disappear. This is a UX rule with data-integrity
consequences: the worst state is not a lost note, it is a lost note the user
thinks they have.

### 4.6 Time is captured, not assumed

*Hazard: a note logged from a phone in Athens, stored against the server's idea
of the day.*

Store `happened_at` in UTC with the capture timezone alongside. Validate any
timezone string against `Intl.supportedValuesOf('timeZone')` at the boundary.

This is not hypothetical here. There is a live wound of exactly this shape:
the Festival of Trust planner PATCHes `timezone: "Athenes/Greece"` through the
app API, nothing validates it, and it crashed the Thread editor on 2026-09-08.
Build-plan item 1b. A capture app in a different timezone is the same bug
class.

---

## 5. Two things not to do

**Do not use `person.custom_fields`.** The column exists — `jsonb`, default
`{}` — and is read by exactly one thing in the entire codebase: the GDPR
Article 15 export. Nothing writes it, no UI shows it. A quick-capture app is
precisely the thing that will be tempted to dump unstructured input there, and
that is how the app-justifies-the-field rule dies quietly. Either a field is
justified and gets a column, or it is not and does not exist.

**Do not let the capture app hold personal data locally beyond the queue.** The
first hard rule is no personal data outside the EU API, and the frontends are
stateless by design. An offline outbox is a queue of pending writes, drained
and cleared. It is not a local contact database, and a PWA that caches the
address book for offline browsing would break the rule the platform is built
on.

---

## 6. What this means for the build

Nothing here is a large piece of work, and most of it is a column or an
accessor rather than a feature. But the order matters: **the integrity work
comes before auto-capture, not after.** Once a scanner is writing, the cost of
not having `origin` or `resolvePerson()` is a cleanup, not a refactor.

Revised front of the build order:

| Step | Item |
|---|---|
| 0 | `resolvePerson()` accessor + a merge tool. Retires nine hand-rolled match-or-creates |
| 1 | `flow_note` — with `client_ref`, `origin`, `happened_at` + timezone from day one |
| 2 | Rotting (zero schema) |
| 2b | `listEvents()` + the match pass |
| 3 | Contact context in the pipeline |
| 3b | Meeting → draft note, scan-match-discard |
| 4 | Growth view — `org_relationship` written, derived and read-only |
| 5 | Today = tasks + calendar |
| 5b | Time-blocking and follow-up booking via Meet |
| 6 | The capture client, as a PWA identifying as `fibre-flow` |
| 7 | BCC-to-log |
| 8 | Offerings know their delivery |

Step 0 is new and it is the one I would not skip. Step 6 is deliberately late:
the capture surface is worth building once there is something worth capturing
into, and by then the shared components exist and it is mostly assembly.

---

## 7. Capture UX rules that are integrity rules

*(Added 2026-09-11, from Sjoerd: "everything you enter is auto saved… not too
much choices… so barriers are lowered, not threshold.")*

These read like design preferences. They are not — each one changes what ends
up in the database, so they belong here rather than in a style guide.

### 7.1 Autosave, and what it does to the data

No save button. Every change persists as it is typed, debounced, upserting on
the same `client_ref` from §4.1. That idempotency key was introduced for
offline retries and it turns out to be exactly what autosave needs too: a
hundred keystroke batches and one save button press write the same single row.
The two mechanisms are the same mechanism.

But autosave creates a state that a save button never did: **a row that exists
before the user has decided anything.** Three consequences to handle
deliberately.

**Drafts are real rows and must be marked as such.** A note gets a row on the
first keystroke. It is a draft until it has content and the user has left it.
Only then does it count as a touch.

**Derived effects fire once, on first commit — not on row creation.** The
`activity` row, the touch count, the last-spoke date: all of these fire when a
draft becomes a note, never per keystroke. Otherwise the append-only trail
fills with a hundred rows for one conversation, and §4.2 stops meaning
anything.

**An abandoned draft is not a conversation.** Someone opens a note, types two
characters, gets interrupted, never returns. That must not appear as "you spoke
to Marja". Empty and near-empty drafts age out; they do not become history.

### 7.2 Default everything; ask almost nothing

The proposed note carries a kind, a date it happened, a person, an organisation
and a follow-up. That is five decisions for one note, which is the threshold
Sjoerd is describing.

**Every one of them has a correct default from context.** Kind comes from where
the note came from — a calendar match is a meeting, a BCC is an email, typed by
hand is a note. The date it happened is the meeting's start time, or now.
Person and organisation are pre-filled from whatever was open. Each stays
editable, and none of them is ever *asked*.

The screen for logging a conversation should be **one text box and a person's
name at the top**. Everything else appears only if tapped. The provenance
column from §4.3 is what makes this possible: because the row records where it
came from, the interface does not have to ask.

### 7.3 The next-action rule, revised

**This supersedes D7** in [`connections-market.md`](connections-market.md) §5.

D7 said you cannot close a note without setting a follow-up date or explicitly
declining one. That is a blocking dialog, which is precisely the threshold this
section exists to remove. The behaviour was right and the mechanism was wrong.

The revised version: **offer, never block.** Three chips sit under the text box
— *in a week*, *in a month*, *nothing planned* — one tap each, nothing
pre-selected, and closing without touching them is allowed. A note left with no
follow-up is not lost; it surfaces in the landscape's attention list as
*"finished with nothing next"*
([`connections-model.md`](connections-model.md) §3.2, condition 3).

The nudge moves out of a modal and into the view that exists to hold exactly
this kind of unfinished business. That is better than the original in both
directions: less friction at capture, and the omission is still visible
tomorrow.

---

## 9. Keeping it clean over time

*(Added 2026-09-11, from Sjoerd: "how do we keep the data clean? Can we make a
procedure to clean up the database regularly — auto, with AI support maybe?")*

Sections 1–7 are about not creating dirt. This one is about the dirt that
accumulates anyway.

### 9.1 The reframe: most cleaning is a query, not a judgement

The instinct to reach for AI is understandable and mostly wrong here. **The
large majority of what goes wrong in this database is detectable with SQL** —
exactly, cheaply, repeatably, and with an audit trail. Using a language model
for those is slower, costs money, produces different answers on different runs,
and cannot be explained to a regulator.

AI earns its place in one narrow spot (§9.4). Everything else is a scheduled
query.

### 9.2 What actually accumulates

| The dirt | How it is found | Kind |
|---|---|---|
| Duplicate people | Nine insert sites, no unique constraint (§3) | Deterministic *and* fuzzy — the one place AI helps |
| Dead email addresses | Bounce events — **no Resend webhook exists today** (D20) | Deterministic |
| Ghost records | A person created by a booking, only an email, never touched since | Deterministic |
| Abandoned drafts | Autosave rows that never became notes (§7.1) | Deterministic |
| Drifted derived fields | Touch counts and last-spoke dates disagreeing with their source | Deterministic |
| Stranded flow runs | Someone sitting at a step for a year with no tasks | Deterministic |
| Formatting junk | Whitespace in emails, ALL CAPS names, `NL` vs `Netherlands`, phone numbers in six shapes | Deterministic |
| Invalid timezones | The live `"Athenes/Greece"` bug, build-plan item 1b | Deterministic |
| Soft-deleted rows, forever | Soft delete is a hard rule, so **nothing ever leaves** | Policy, see §9.5 |

### 9.3 The sweep: a fourth job on a scheduler that already exists

No new infrastructure. `apps/api/src/server.ts` already runs an in-process
`setInterval` every five minutes carrying three jobs — the Thread message
scheduler, the membership scheduler and the billing meter tick — on a Fly
machine pinned warm. **A nightly hygiene sweep is a fourth job on that same
interval**, guarded to run once a day the way the billing meters already guard
themselves hourly.

**What it does, and the rule that matters: it produces a review queue, it does
not silently repair.**

*Auto-fix, because it is provably safe and reversible:* trim whitespace, fix
obvious casing, normalise countries to ISO-2, flag a bounced address as invalid
(flag, never delete), age out empty drafts, recompute derived fields, validate
timezone strings against `Intl.supportedValuesOf('timeZone')`.

*Propose, never apply:* merging two people, anything that removes content,
changing a name, closing a stranded run. Each lands in a queue with the evidence
attached and a one-tap accept.

*Never, even as a proposal:* **filling in a blank.** Cleaning means removing
wrongness, not inventing completeness. An AI suggesting "probably works at
Acme" is enrichment wearing a hygiene badge, and enrichment is refused on
principle in [`connections-market.md`](connections-market.md) §8. Worth stating
because it will be proposed, and it will sound helpful.

### 9.4 Where AI actually earns its place

**Fuzzy duplicate candidates, and nothing else.** *Marja Bakker* / *M. Bakker* /
*marja.bakker@…* is exactly the case deterministic matching misses and a model
catches. So: the deterministic pass runs first and catches the easy ones, and
only genuine ambiguity escalates — which cuts the volume by orders of magnitude
and makes the cost trivial.

Even there, **the model proposes and a person confirms.** An auto-merge that is
wrong produces a worse class of dirt than the duplicate did: two people fused
into one, with no trace of which fields came from where.

The adjacent use that is genuinely good but is *not* cleaning: summarising a
long relationship history into the pre-meeting brief from
[`connections-mobile.md`](connections-mobile.md) §3. Worth building. Different
job.

### 9.5 The part that is a processor decision, not a technical one

**Sending personal data to a language model is a processing operation**, and it
runs straight into the platform's first hard rule — no personal data outside the
EU API — and its central promise of minimisation. Before any of §9.4 is built:

- The provider becomes a documented sub-processor. `public.processing_purpose`
  exists for exactly this and is **referenced by no code at all today** — the
  build plan has had "populate with Supabase / Vercel / Resend / Stripe" open
  for months. An AI provider would be the entry that finally forces it.
- An EU endpoint and a data-processing agreement, or it does not happen.
- Disclosure in the privacy policy, which is already flagged as unreviewed by a
  lawyer.

**And the mitigation that makes this much smaller: do not send the records.**
Duplicate detection needs comparison keys — normalised name fragments, email
local-parts — not full profiles. Send the shape, not the person. That reduces
both the legal surface and the volume, and it is worth designing for from the
start rather than retrofitting after a privacy review objects.

### 9.6 Retention is the missing half

`public.retention_policy` also exists and is also referenced by nothing. Combined
with soft-delete-only, that means **this database has never deleted anything and
currently has no mechanism to.** Every erasure request, every lapsed consent,
every dormant record from a workspace that left — all still there.

That is a growing liability on two axes at once, legal and size, and it is
genuinely the least glamorous item in this entire series. But a hygiene procedure
without a retention half is only tidying the surface of something that keeps
getting heavier.

The sweep is the natural place to enforce it, once someone decides what the
policies are — which is a business decision, not an engineering one.

### 9.7 Does Fibre provide the AI, or does each customer connect one?

*(Added 2026-09-11, answering Sjoerd directly.)*

**First: for the job described, an LLM is probably the wrong tool entirely.**

Fuzzy name and email matching — *Marja Bakker* / *M. Bakker* / *marja.bakker@…* —
is a textbook trigram-similarity problem, not a language problem. Postgres solves
it with `pg_trgm`, which Supabase supports and which is **one `create extension`
away**; `pgcrypto` and `citext` are already enabled the same way. Combined with
`citext` (already in use on every email column) and a phonetic pass, that covers
the large majority of real duplicates.

What it buys compared to a model: nothing leaves the database, no sub-processor,
no DPA, no disclosure, no token cost, no rate limit, deterministic results that
are the same on every run, and it is fast enough to run over the whole table
nightly. **Start here, and find out how much is actually left over** before
buying anything.

**Where a model genuinely is the right tool, it is not cleaning.** It is the
language-shaped work: summarising a long relationship history into the
pre-meeting brief ([`connections-mobile.md`](connections-mobile.md) §3),
drafting a follow-up. Those are worth having and should be judged on their own
merits, not smuggled in under hygiene.

**If and when that happens: Fibre provides it, opt-in per workspace.** All three
mechanisms already exist:

| Need | Existing mechanism |
|---|---|
| Gate it by plan | `billing_plan.features` — a jsonb feature map, editable at `/admin/plans`; new keys are a deploy |
| Charge for usage | `usage_overage_charge.meter`, today `('emails','storage')` — a third meter is the same shape |
| Keep it off by default | Workspace-level activation, as `workspace_app` already does for apps |

Off by default matters more than usual here. A platform whose promise is
minimisation should not quietly begin sending its customers' contacts to a model
because a release shipped.

**On bring-your-own-key: it does not move the legal boundary as much as people
assume.** If the customer supplies a key but Fibre's server makes the call,
**Fibre is still the party sending personal data to a third party** — still a
processing operation, still needing disclosure, still needing the provider in
`processing_purpose`. What BYOK actually buys is cost transfer and a customer's
sense of control, plus a genuine answer for an enterprise that insists on its own
vendor. Worth offering later as an Enterprise option; wrong as the default
answer, and wrong as a way to avoid the compliance work.

**The recommendation, in order:** `pg_trgm` first and measure what is left;
LLM work scoped to language tasks rather than hygiene; Fibre-provided, opt-in,
plan-gated and metered when it comes; BYOK as an Enterprise accommodation, never
as the compliance story.

---

## 8. Decisions

**D12 — A capture surface owns no data.** The PWA is a second front end for
Flow, sends `X-App-ID: fibre-flow`, has no schema and no local store beyond a
write queue. *Recommended: yes.* This is the answer to the integrity question:
there is nothing to reconcile because there is nothing to diverge.

**D13 — One `resolvePerson()` accessor, before auto-capture.** Nine call sites
across six files currently create people independently, with no unique
constraint behind them. *Recommended: yes,* and it is worth doing even if
Simple Sales never ships.

**D14 — No unique index on person email.** Enforce in the API with judgement,
build a merge tool, accept that couples and `info@` addresses are real.
*Recommended: yes.*

**D15 — `client_ref` and `origin` on every capture-written row, from the first
migration.** *Recommended: yes.* Both are trivial now and impossible to
backfill.

**D16 — Derived relationship fields are read-only in the UI.** Computed from
notes and the ledger; `relationship_stage` and `next_opportunity` stay
hand-edited. *Recommended: yes.*

**D28 — Autosave, with drafts as a real state.** No save button; the
`client_ref` upsert carries it. Derived effects fire on first commit, never per
keystroke, and abandoned drafts age out rather than becoming history.
*Recommended: yes.*

**D29 — Default from context; never ask.** Kind, date, person and organisation
are all inferred from where the capture came from and stay editable. The
logging screen is a text box and a name. *Recommended: yes* — this is what the
`origin` column in §4.3 buys.

**D30 — D7 revised: offer the next action, do not block on it.** Three one-tap
chips, nothing pre-selected, closing without choosing is allowed, and the
omission surfaces in the landscape's attention list instead of a dialog.
*Recommended: yes.* The original D7 was the right instinct implemented as a
barrier.

**D64 — A nightly hygiene sweep, as a fourth job on the existing scheduler.** No
new infrastructure. *Recommended: yes.*

**D65 — The sweep proposes; it does not silently repair.** Only provably safe,
reversible normalisations auto-apply; merges and removals land in a review queue
with evidence. *Recommended: yes.*

**D66 — AI is used for fuzzy duplicate candidates only, after the deterministic
pass, and it proposes rather than applies.** *Recommended: yes* — most cleaning
is a query, and a model doing a query's job is slower, non-deterministic and
unauditable.

**D67 — Cleaning never fills a blank.** Removing wrongness, never inventing
completeness. *Recommended: yes,* and it belongs in the brief, because it will be
proposed again and will sound helpful every time.

**D68 — Send comparison keys, not records.** Any AI step receives normalised
fragments, never full profiles. *Recommended: yes.*

**D69 — Populate `processing_purpose` before any AI step ships,** and decide
retention policies so `retention_policy` stops being decorative. *Recommended:
yes* — and the retention half is a business decision Sjoerd owns, not an
engineering one.

**D70 — Try `pg_trgm` before any LLM.** One extension, nothing leaves the
database, deterministic, free. Measure the residue before buying a model.
*Recommended: yes.*

**D71 — If an LLM ships, Fibre provides it: opt-in per workspace, gated by
`billing_plan.features`, metered like emails and storage.** Off by default.
*Recommended: yes* — all three mechanisms exist already.

**D72 — Bring-your-own-key is an Enterprise accommodation, not the compliance
answer.** Fibre still sends the data, so the disclosure and sub-processor work is
unchanged. *Recommended: yes.*
