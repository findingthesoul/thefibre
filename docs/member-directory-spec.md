# Member directory — build spec

Companion to [`member-directory-proposal.md`](member-directory-proposal.md),
which holds the request and Sjoerd's decisions. This is the implementable
version: what exists, what to add, the resolution rules in full, the contract,
and what must be true before it ships.

Written to be handed over. Where something is undecided it says so under
§9 rather than being quietly chosen.

---

## 1. What this rests on, verified against production

| Claim | Checked |
|---|---|
| Members mostly have NO user account | 6 active soul.com members: **2** have `user_id`, **1** has a `user_profile` |
| A profile keyed by EMAIL already exists | `identity_profile(email, display_name, bio, photo_url, timezone, locale, todo_enabled)` — 10 rows on production |
| Location already exists | `person.city / region / country` — 3 of 6 filled |
| Contact ways already exist | `person_contact_point(kind, value, label, is_primary, verified_at)` |
| A consent-gated people list is already a decided pattern | The Thread's `/my` cohort: `consent_record(purpose_code='cohort_directory')` + the thread's `share_participants_participants` |

**So the profile is not new.** `identity_profile` is the right subject and
`user_profile` is not: a directory built on `user_profile` would today show
one of six members. It is also already the rule this portal follows — the
portal's own `PATCH /me/profile` puts the NAME on every `person` row carrying
the verified email and the LANGUAGE on `identity_profile`, because "one
identity, one preference, everywhere". A profile is identity, so it follows
the language, not the per-workspace row.

**Consequence to accept deliberately:** one bio and one photo across every
community a person belongs to. Per-community expression is the TAGS (§3.3),
which are per workspace. If per-community bios are wanted later that is a
new column, not a redesign — but see §9.1.

---

## 2. The shape in one paragraph

A member is listed in their workspace's directory when their membership is
active, they have not opted out, and the viewer may see them. What a viewer
sees is the identity profile (name, photo, bio), the location, the tags, and
— only if the contact check resolves to yes — the contact ways. Who a viewer
may see is decided by CATEGORY, which the workspace defines and a PRODUCT
carries, so a member's categories follow what they hold rather than what
anybody administers.

---

## 3. Data to add

Three new tables and one settings column. Nothing is added to `person` or
`identity_profile`.

### 3.1 `membership_directory_category`
The workspace's own vocabulary.

```
id              uuid pk
workspace_id    uuid not null references workspace(id)
name            text not null
sort_order      int  not null default 0
archived_at     timestamptz
created_at      timestamptz not null default now()
unique (workspace_id, lower(name))
```

A category is NOT a tier and must not be named after one. A category shown
beside a member discloses which product they hold, and a product has a price
— `Soul Fellowship` as a visible category tells every member who paid €2,000.
The workspace names them; the UI that creates them says this.

### 3.2 `membership_product_category`
Which categories a product confers. Many-to-many, because a product may serve
more than one circle.

```
product_id   uuid not null references membership_product(id) on delete cascade
category_id  uuid not null references membership_directory_category(id) on delete cascade
primary key (product_id, category_id)
```

### 3.3 `membership_directory_entry`
The member's own choices, per workspace. One row per (workspace, person).

```
workspace_id   uuid not null references workspace(id)
person_id      uuid not null references person(id) on delete cascade
listed         boolean not null default false     -- opt-IN (§9.6)
show_contact   boolean                            -- NULL = inherit workspace default
tags           text[] not null default '{}'       -- max 3, enforced in the API
updated_at     timestamptz not null default now()
primary key (workspace_id, person_id)
```

`show_contact` is deliberately **nullable with three meanings**: `true` show,
`false` hide, `NULL` follow the workspace. A plain boolean cannot express
"follow the default", so a member who never touched it would stop moving when
the admin changes the default — the same inheritance the payment methods use
(account → thread → ticket, null = inherit at each level).

### 3.4 `membership_settings` gains

```
directory_visibility        text not null default 'everybody'  -- 'everybody' | 'category'
directory_show_contact      boolean not null default false     -- default for show_contact
directory_show_category     boolean not null default false     -- §9.2
directory_default_category_id uuid null references membership_directory_category(id)  -- §9.3
```

Default `false` on contact: a workspace that never thinks about this does not
publish its members' phone numbers.

---

## 4. Consent

Sjoerd decided **always opt-in** (§9.6, 2026-10-04 — superseding his own
earlier wording from the same day). `listed` therefore defaults to **false**.

Joining is where the choice is OFFERED: the 'Community landscape' product
adds a step to the enrolment process, and the switch there arrives OFF. The
profile is where it can be changed either way afterwards, which is also what
makes withdrawal as easy as giving it (Art 7(3)).

That makes three obligations, and none of them is optional:

1. **The join page says so, in the flow**, next to what the member agrees to
   — not only in a policy page. Wording belongs with the privacy statement
   (§8), which does not describe a directory today.
2. **A `consent_record` is written ON SWITCH-ON** (§9.6 — at join nothing has
   been consented to yet, because the switch arrives off), `purpose_code =
   'member_directory'`, `legal_basis = 'consent'` — separate from
   `cohort_directory`, because agreeing to appear among your community is not
   agreeing to appear in a course cohort, and revoking one must not revoke
   the other.
3. **Opting out takes effect on the next read.** `listed` is read at query
   time; there is no job and no cache to wait for.

Revocation writes `revoked_at` on the consent record AND sets `listed=false`.
Both, because the record is the evidence and the flag is the behaviour.

---

## 5. Resolution rules, in full

Let `V` be the viewer's person row in this workspace, `M` a candidate.

**Listed:**
```
M is a candidate  ⟺  M.membership is active
                  ∧  M.person.deleted_at IS NULL
                  ∧  entry(M).listed IS NOT false      -- no row = listed
```
A missing `membership_directory_entry` row means listed — consistent with
opt-out, and it means no backfill is needed for existing members.

**Categories** of a person = the union of categories on every product they
hold: products included in their tier (`membership_tier_product`) plus any
bought à la carte (`membership_product_purchase`).

**Visibility:**
```
V may see M  ⟺  workspace.directory_visibility = 'everybody'
              ∨  categories(V) ∩ categories(M) ≠ ∅
```
Symmetric by construction. A member in two categories sees both circles.

**Contact shown:**
```
show(M)  =  entry(M).show_contact        if not null
            workspace.directory_show_contact otherwise
```

**Fields returned** — and nothing else:

| Always | Only when `show(M)` |
|---|---|
| display name | email (primary verified contact point) |
| photo | phone |
| bio | other contact points, incl. LinkedIn / website |
| city, country | |
| tags | |

Region, street, postal code are never returned. The category
**name** is shown only when the workspace switches it on (§9.2).

---

## 6. The contract

```
GET  /api/v1/me/directory?workspace=<slug>&tag=&q=&cursor=
GET  /api/v1/me/directory/suggest-tags?workspace=<slug>&q=
PATCH /api/v1/me/directory            { listed?, show_contact?, tags? }
```

On `portalRoutes`, authenticated the way the rest of the portal is —
`participantEmailFromAuth`, never a workspace session, because a member has
no app membership and usually no user account.

Cursor pagination (hard rule 6). `tags` is validated as ≤3 entries, each ≤40
chars, trimmed, case-folded for comparison and stored in the casing first
used in that workspace.

**Tag filtering uses a typed query, never an interpolated filter string.**
A tag is free text from a member; `.or()` strings are injectable and this
repo has been bitten by that before.

---

## 7. What must be true before it ships

Not a wish list — each of these is a known way this exact feature breaks.

1. **Tenancy test.** The read path uses `adminClient`, so the workspace scope
   is code and not RLS. A test must assert a member of workspace A cannot
   see a member of workspace B by any parameter. The last stress round found
   a tenancy hole in exactly this shape.
2. **A merge must carry the entry.** `membership_directory_entry` and the
   consent record are keyed by `person_id`. When two people merge, the
   survivor must keep both, or a member silently returns to a list they left.
3. **This inherits the open merged-address bug.** The portal resolves a
   viewer by `person.email` only, so a member whose address was merged away
   sees nothing — including this directory. The directory must not ship
   before that is decided (proposal §4 of `open_decisions`; the mechanism
   Sjoerd must name is *stamp verified_at at merge* or *add a source
   column*).
4. **A lapsed member disappears** — asserted by a test that flips
   `membership_member.status` and re-reads, not by reasoning about the query.
5. **An opt-out disappears on the next read**, same shape of test.
6. **Non-empty assertions.** Every one of these tests asserts a member IS
   returned in the control case. An empty list looks exactly like a working
   one.
7. **Rendered once, by a person**, on staging with a seeded fixture of at
   least three members in two categories — one listed with contact, one
   listed without, one opted out.

---

## 8. Not ours to write

The privacy statement does not describe a member directory. That text must
exist before the first member is listed, and it is a lawyer's, not mine.
`/privacy-policy` is still unreviewed per the 2026-09 note.

---

## 9. Resolved (2026-10-02)

Sjoerd: *"Can you resolve the questions from the plan... and consult whenever
needed."* Each is settled below with the reason, so a later reader can
disagree with the reasoning rather than guess at the intent. One of them is
resolved AGAINST my own first recommendation.

### 9.1 One bio, everywhere — RESOLVED: one

Follows the rule this portal already made and wrote down: a member's NAME
goes to every `person` row carrying their verified email, and their LANGUAGE
to `identity_profile`, because "one identity, one preference, everywhere"
(`routes/portal.ts`, the `PATCH /me/profile` note). A bio is identity in the
same sense that a name is.

The cost is real and accepted: someone in a professional network and a
spiritual community writes one bio for both. The per-community expression is
the TAGS, which are per workspace by design. If this turns out wrong it is
one nullable column on `membership_directory_entry`, read in preference to
the identity bio — an addition, not a redesign.

### 9.2 Is the category NAME shown? — RESOLVED: a workspace switch, default OFF

```
membership_settings.directory_show_category  boolean not null default false
```

Not a decision to make centrally, because it is a decision about a community
and not about the software. A fellowship may want its name visible as a mark
of belonging; a hardship-fund tier must never be. Default off, because the
default must be the one that cannot hurt anybody, and the admin UI carries
the sentence that matters: **a category beside a member's name tells every
other member what that member holds, and a product has a price.**

### 9.3 A member with NO category, in `category` mode — RESOLVED, and not the way §9 first said

My earlier recommendation — "an uncategorised product confers the workspace's
FIRST category" — is wrong, and worth saying why: "first" is sort order, which
is a display choice. It would put a member into a circle nobody chose for
them, decided by a drag handle. That is a worse failure than the one it fixes,
because it is invisible and it is an over-disclosure.

Instead:

```
membership_settings.directory_default_category_id  uuid null
                                                   references membership_directory_category(id)
```

- **Set:** a product carrying no category confers this one. Explicit, chosen
  by a human, changeable.
- **Unset (default):** a member with no category is **not listed and sees
  nobody** in `category` mode. It fails CLOSED.

And because a member silently missing from a list is exactly the kind of
empty that reads as working, the admin screen must show the count:
*"4 products carry no category — members who hold only those will not appear
in the directory."* The count is the feature. A setting that fails closed and
says nothing is how somebody loses four members for a month.

In `everybody` mode none of this applies; categories only gate visibility.

### 9.4 Email harvesting — RESOLVED: accept, bounded

The relay was not chosen, and showing an address is a legitimate thing for a
community to decide. What makes it bounded rather than careless:

- contact points are returned **only for members the viewer may already
  see**, and only when `show(M)` resolves true — never as a separate lookup
  that could be walked;
- the directory endpoint is **rate limited** per viewer, so a member can read
  a directory and not drain one;
- **no bulk export** from this surface. An organiser exporting their own
  members is a different, already-authorised thing.

Residual risk, stated plainly so it is a choice and not an oversight: a
member with `show_contact` on has published their address to every other
member who may see them, and one compromised member account can collect
them. The mitigation if that ever matters is the relay in the proposal, which
remains the better long-term answer.

### 9.5 Two visibility switches, and why they are not a pair — RESOLVED: both, apart

Sjoerd, 2026-10-04, looking at his own profile page: *"should there also be
the buttons for what a person allows 'show a public page', 'show up in list
of members'? Or are both not a choice and do they conflict with a design
choice made earlier?"*

Both should be a choice. They must not be drawn as a pair, and only one of
them exists today.

**"Show up in list of members" already exists in this plan** — it is slice 2,
`membership_directory_entry.listed`, from his own earlier instruction
(*"Maybe someone can state: visible in the list or not"*). No conflict.

But the question exposes a SHAPE error in how it was about to be built. The
profile is ONE thing — `identity_profile`, keyed by email, one bio everywhere
(§9.1) — while membership is per workspace. A single switch on the profile
would force somebody in three communities to hide from all three in order to
hide from one. So:

- the switch lives **per community**, on `membership_directory_entry`;
- the profile may carry at most a global **"never list me anywhere"**
  kill-switch above it, which wins over every per-community setting.

**"Show a public page" does NOT exist, and that is the finding.**
`thread_program.is_public_listed` is per THREAD, not per person. An
organiser's page exists for anybody holding a slug, and since A2 (v1.98.8,
production 2026-10-03) that page publishes display name, bio and photo
automatically. Nobody opted in. Nothing improper has happened — of the seven
pages that changed, three are Sjoerd's own accounts and he cleared the fourth
name by hand — but the MECHANISM has no consent step, so the next person who
writes a bio in Settings → Profile is published to the open internet without
being asked.

That sits against two decisions already made:

- **"The app justifies the field"** (brief §13). A bio justified by *"my
  public page shows me"* is data minimisation working. A bio published
  *because a page exists by default* is the same field with the justification
  removed.
- **The consent model in §4**, which requires consent at join for the
  NARROWER audience — the members of one community. The public page reaches
  everyone and is indexable, and has no equivalent gate.

**Why they are not a pair.** Two adjacent checkboxes read as symmetric, and
somebody will switch one off and believe they are private. The audiences are
not comparable: one is a community that admitted them, the other is the
internet. They belong in different places, with different words, and the
public one needs to say plainly that it means the open web.

**The one part that is Sjoerd's, not ours:** what happens to pages that are
ALREADY public. Defaulting the new switch off un-publishes live URLs people
may have shared; defaulting it on grandfathers everyone in without ever
asking. The recommendation is on-for-existing, explicit-for-new, with a
one-time notice — but that is a consent call, not an engineering one, and it
is recorded here undecided.

## 9.6 The directory is a PRODUCT, and listing is always opt-in — Sjoerd, 2026-10-04

Decided in two steps on the same day, and the second supersedes the first.
Both are recorded, because the reasoning between them is the useful part.

**First**, on the shape:

> *"in the enrolment process, it is by default switched on and someone can
> switch it off. Like a feature in the process (a product in a package). For
> example: 'community landscape' as a product. Setting: default switched
> on... and then it appears in the process."*

**Then**, asked whether a default-on switch was safe for a community whose
membership itself discloses a special category — a faith-linked community
publishes religious affiliation by listing somebody, and this platform seeds
EBBF, a Bahá'í business forum — he answered:

> *"Always opt-in"*

So the product framing stands and the default is reversed.

### What ships

"Community landscape" is a **feature of a package**, the way a Circle space
or a seat is. A package carrying it makes a step appear in the enrolment
process. At that step the listing switch is **OFF**, and the person switches
it on. The same switch lives on my.thread afterwards, and reaching it there
is as easy as reaching it at enrolment.

### What this replaces

- It supersedes his own default-on wording from earlier the same day. No
  pre-ticked switch ships.
- It supersedes the recommendation I had written in response to that
  wording — a per-workspace "default on / explicit opt-in" setting. It is no
  longer needed: always opt-in is one rule, and one rule that is right
  everywhere beats a setting an admin can get wrong for a congregation.
- §4's consent model returns rather than being replaced. §9.5's per-community
  `listed` switch is unchanged. §9.3 is untouched — category resolution still
  fails closed.

### Why opt-in makes the lawful basis straightforward again

An explicit switch-on is a "clear affirmative action" (Art 4(11)), which a
pre-ticked box is not (Recital 32). So:

- **Art 6(1)(a) consent** is the basis, and writing a `consent_record` row on
  switch-on is correct — it records something that actually happened.
- Where membership discloses a special category (religion, health, political
  opinion), **Art 9(2)(a) explicit consent** is satisfied by the same action,
  provided the step says in words what being listed means.
- Withdrawal must be as easy as giving it (Art 7(3)) — hence the same switch
  on my.thread, not a support request.

Still unreviewed by a lawyer; same status as the privacy policy and terms.

### The cost, stated so nobody quietly undoes it

Opt-in means **fewer members are listed**, and a community's first directory
may look nearly empty. That is the design working, not failing. The temptation
a year from now will be to "fix" the empty directory by flipping the default,
and that would walk straight back into a pre-ticked box with a consent row
asserting something untrue.

There are now TWO reasons a member does not appear — they have not opted in,
or they hold no category (§9.3) — and from the outside both look identical.
So the admin screen that counts uncategorised products should also show how
many members have not opted in. Otherwise "the directory is empty" has two
causes and no way to tell them apart, which is the same empty-that-reads-as-
working trap §9.3 exists to avoid.

### Still genuinely Sjoerd's, and blocking

**The merged-address mechanism** (§7.3). The portal resolves a viewer by
`person.email` only, so a member whose address was merged away cannot see the
portal at all, directory included. Two shapes were put to him on 2026-09-25 —
*stamp `verified_at` at merge* or *add a `source` column* — and neither has
been chosen. Slices 1 and 2 do not touch it. **Slice 3 must not ship without
it**, or the directory will be invisible to exactly the people a merge has
already inconvenienced.

## 10. Suggested slice order

1. **Categories** — the two tables, the product screen, the workspace mode.
   Everything else is guesswork until a member has a category.
2. **The entry** — `membership_directory_entry`, the consent record at join,
   the switch on my.thread's You page. No list yet; a member can state their
   choice before anyone can see them, which is the right order for an
   opt-out. The switch is **per community** (§9.5), not one global flag on
   the profile.
3. **The list** — the endpoint, the my.thread page, filtering by tag and
   location.
4. **Tags** — last, because a filter over an empty vocabulary is not worth
   looking at.

Each slice is one release and names its own lane before it starts.

5. **The public-page switch** (§9.5) — NOT part of the directory, and listed
   here only so it is not lost: it is a Thread change, it needs Sjoerd's
   decision on existing pages first, and it is more urgent than slices 3–4
   because A2 is already publishing profiles on production today.
