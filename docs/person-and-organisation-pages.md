# The person's page and the organisation's page

**Status: DECIDED, not built.** Written 2026-10-11 from the code as it stands.
Sjoerd answered on 2026-10-11 — *"pages: all recommendations"* — so Q1 to Q6
below are settled exactly as each recommendation reads. The questions are kept
rather than deleted, because the reasoning is the record of why, and §4 turns
the answers into slices.

> Sjoerd, 2026-10-04, looking at `app.thethread.app/sjoerd`: the soul.com logo,
> the line *"courses… by soul.com"*, and underneath it his own first-person
> *About me*. **"Half me the person, half me the organiser, confusing."** And:
> **"Maybe these are two things."**
>
> His decision at the time was (c): the workspace gets its own **organisation**
> page — logo, headline, what it offers, the people who opted in — and a
> person's page is **the person speaking**, which links to the organisation.

This document is in three parts: what the pages are made of today, what the
split would look like, and the questions only he can answer.

---

## 1. What is on the page today, and where each piece comes from

`/{slug}` is **one route** serving three kinds of owner. `resolvePublicOwner`
tries **workspace first**, then organiser, then team, and the same handler
renders whichever it finds. (Corrected 2026-10-11, re-reading
`thread.ts:5546`: this document first said organiser-then-team-then-workspace,
which is backwards. The order matters for the collision rule below — a
workspace WINS a contested slug, it does not lose it.) So `/sjoerd` and `/soul-com` are the same endpoint with
different owners — which is the first half of why they feel like one thing.

### The person half

| On the page | Column | Table | Edited at |
|---|---|---|---|
| Name | `display_name` | platform profile, laid over `thread_organiser` | **The Fibre → Settings → Profile** |
| About me | `bio` / `bio_html` | same | **The Fibre → Settings → Profile** |
| Short bio | `short_bio` | same | **The Fibre → Settings → Profile** |
| Photo | `photo_url` | same | **The Fibre → Settings → Profile** |
| Timezone | `timezone` | same | **The Fibre → Settings → Profile** |
| The address | `slug` | `thread_organiser` | **The Thread → Settings → Public page** |
| Whether it exists at all | `is_published` | `thread_organiser` | **Settings → Profile** (2026-10-10) |
| The threads listed | `thread_thread` rows, `is_public_listed` and an active/completed program | — | **The Thread → each thread** |

One profile per person, and it is the platform's: since `20260901140000` the
organiser's own `display_name` / `bio` / `photo_url` columns are **read
fallbacks that nothing writes**. That part is already single-sourced and right.

### The organisation half — on the same page

| On the page | Column | Table | Edited at |
|---|---|---|---|
| Logo | `site_logo_url`, falling back to `workspace.brand_logo_url` | `thread_settings` / `workspace` | **The Thread → Settings → Website** |
| Site name | `site_name`, falling back to `workspace.name` | same | same |
| Headline (*"courses… by soul.com"*) | `site_headline` | `thread_settings` | same |
| Intro text | `site_intro` | `thread_settings` | same |
| Hero image | `site_hero_url` | `thread_settings` | same |
| Footer note, links | `site_footer_note`, `site_links` | `thread_settings` | same |
| Contact form | `site_contact_enabled`, `site_contact_intro` | `thread_settings` | same |
| Theme | `site_theme` | `thread_settings` | same |

**This is the finding.** Every row in the second table is **workspace**-owned
and arrives through `publicSite(workspaceId)`. A person's page renders a person
inside a wrapper belonging to their organisation — his name and his *About me*
sitting under somebody else's logo and somebody else's headline. The confusion
he described is not a styling accident; it is two owners on one page, and no
amount of layout fixes it.

`site_contact_email` is deliberately **not** in the public payload: the form
works without the visitor learning the address. Worth preserving in any split.

### What already exists that the proposal can stand on

Three things, and they matter because they make this smaller than it sounds:

1. **The organisation page already has a URL.** `public_root_slug` is one
   primary key across `workspace`, `team` and `organiser`, and a workspace slug
   already resolves: `/{workspaceSlug}` renders with `owner.kind === 'workspace'`.
   It lists the workspace's public threads inside the site wrapper. What it
   does **not** have is any sense of the **people**.
2. **The site ingredients already exist** — logo, headline, intro, hero,
   footer, links, contact — and already have an editor at
   **The Thread → Settings → Website**. The organisation page is mostly a
   matter of pointing them at the right page rather than inventing them.
3. **A person can already switch their page off** (`is_published`,
   2026-10-10), and the gate is on the organiser page **alone** — thread pages
   under the same slug stay reachable, so switching off never breaks a link
   somebody has sent.

---

## 2. The proposal

### The person's page — `/{personSlug}`

**The person speaking.** Their name, their photo, their *About me* in their own
voice, their timezone, the threads they personally run, and **a link to the
organisation they run them with**.

What LEAVES it: the organisation's logo, headline, intro, hero and footer. If a
visitor needs to know who the organisation is, the link is one click, and the
link is the honest version of the relationship — *I run these with soul.com* —
rather than a logo implying the page itself is soul.com's.

What it keeps from the wrapper: the **theme**, so the two pages look like
family rather than strangers. A theme is a visual language, not a claim of
authorship.

### The organisation's page — `/{workspaceSlug}`

**The organisation speaking.** Logo, headline, intro, hero, the threads the
workspace runs, the footer and the contact form — all of which exist today —
plus the one genuinely new thing: **the people**, each linking to their own
page, and each appearing **only if they opted in**.

That opt-in is the same decision the publish switch already asks. Appearing on
your organisation's page is a second, different act of publication from having
a page of your own, and it should be its own answer — see the open questions.

### URLs, and the collision that must not be waved past

One global namespace, `public_root_slug`, with `slug` as the primary key across
all three kinds. Consequences that have to be stated plainly:

- A workspace and a person **cannot** share a slug. `soul.com` the
  organisation and `sjoerd` the person coexist; `sjoerd` the person and
  `sjoerd` the workspace cannot.
- Slugs are claimed **whether or not the page is published** — deliberately
  (Sjoerd, 2026-09-11: *"published or not, it claims that slug… this way we
  prevent future collisions"*). So an unpublished person already holds their
  name, and the split does not change who owns what.
- Teams are in the same namespace, which is why `everyone-soul-com` is
  suffixed rather than called `everyone`.

**No migration of existing slugs is proposed.** Every address that works today
keeps working, and nobody's shared link breaks.

### What happens to today's mixed pages

Nothing, on the day it ships. Today's `/sjoerd` renders the person inside the
organisation wrapper; afterwards it renders the person with a link out. The URL
is the same, the threads are the same, the enrolment links beneath it are
untouched. The change is what surrounds the content, which is exactly the thing
he said was confusing.

### How the publish switch fits

It already carries the right shape and needs no change:
`is_published = true` says yes, `false` says no, `NULL` means the row predates
the question and is treated as published until the person is asked. The
organisation-page listing should ask its own question in the same three-state
way, so somebody who wants a page of their own but does not want to be listed
on the company page can have exactly that.

---

## 3. The questions, and the answers

**All six were answered as recommended** (Sjoerd, 2026-10-11: *"pages: all
recommendations"*). Each recommendation below is therefore the decision; the
wording is left as written so the reasoning survives with it.

**Q1. Is being listed on the organisation page a separate opt-in from having a
personal page?**
*Recommendation: yes, separate, defaulting to not-listed for existing people.*
They are different acts: one is "I have a page", the other is "I appear on my
employer's page". Defaulting to listed would publish a staff directory nobody
agreed to, which is the same mistake the publish switch was built to undo.

**Q2. What does a person's page show when they have switched it off, and
somebody follows the link from the organisation page?**
*Recommendation: the organisation page does not link to an unpublished person
at all — it lists them as text, or not at all per Q1.* A link to a deliberate
404 is a worse experience than no link.

**Q3. Does the organisation page replace The Thread's Settings → Website, or
is it the same thing under a clearer name?**
*Recommendation: the same thing, renamed.* The ingredients, the editor and the
URL all exist; calling it "your organisation page" rather than "website embeds
and site settings" is most of the work, and a second editor would be a second
source of truth for one logo.

**Q4. Should a person's page keep the organisation's THEME?**
*Recommendation: yes.* It is the one piece of the wrapper that says "related
to" without saying "belongs to", and dropping it would make the two pages look
like unrelated products.

**Q5. What about a person who runs threads for two workspaces?**
*Recommendation: list every organisation they are a member of and publish
threads for, rather than picking one.* This is rare today and the data already
supports it — `thread_organiser` is per person, `thread_thread` carries its own
`workspace_id` — but a single "their organisation" field would have to invent
an answer. **This is the question I am least sure about and the one most likely
to change the data model, so it is worth his attention before anything is
built.**

**Q6. Does the organisation page need its own switch — a workspace that wants
no public page at all?**
*Recommendation: yes, and it should match the person's: three states, NULL
grandfathered as published, so nothing goes dark the day it ships.*

---

## What this document is not

It is not a plan with estimates, and it is not a decision. Every table above
was read from the code on 2026-10-11 rather than remembered; the three
"already exists" findings in §1 are the reason this is smaller than it looks,
and they are also the most likely things to be wrong if somebody reads this
months from now. Check them before building.


---

## 4. The slices

Four releases, in this order. Each one is whole: nothing offers a switch that
a later release would make true, because "offered X then refused X" is two
code paths and this codebase has paid for that shape more than once.

**What a visitor sees on `/sjoerd` is named per slice**, because that is the
thing Sjoerd will be looking at.

### Slice 1 — the decisions, written down (docs only)
This document. No migration, no code, **nothing changes on `/sjoerd`**.
Pushes to `staging` with a `docs:` prefix like any docs commit.

### Slice 2 — the organisation page gets a name and a switch
- **Migration** (one, `thread_settings`): `site_is_published boolean`, nullable.
  NULL is grandfathered as PUBLISHED (Q6), because every workspace page that
  serves today must keep serving the day this ships.
- **API**: `resolvePublicOwner`'s workspace branch honours it, so a workspace
  that says no 404s — the switch and the gate in the same release.
- **Thread → Settings → Website is renamed** to the organisation page (Q3),
  and gains the switch. Same editor, same columns, clearer name.
- **On `/sjoerd`: nothing changes.** On `/{workspaceSlug}`: nothing changes
  either, unless somebody switches it off.

### Slice 3 — the people, and their opt-in
- **Migration** (one, `thread_organiser`): `listed_on_org_page boolean`,
  nullable. **NULL means NOT listed** (Q1) — the opposite grandfathering from
  `is_published`, and deliberately so: that switch protected pages that already
  existed, this one must not publish a staff directory nobody agreed to.
- **The Fibre → Settings → Profile** gains the question, beside the existing
  publish switch, since both are "what of me is public".
- **The organisation page gains its people section**, reading that column, and
  **does not link to anyone whose own page is unpublished** (Q2).
- **On `/sjoerd`: nothing changes.** On `/{workspaceSlug}`: a people section
  appears — empty for everybody on day one, which is the point.

### Slice 4 — the split itself
- **No migration.** Every column this needs already exists.
- The person's page stops rendering the organisation's logo, headline, intro,
  hero and footer, **keeps the theme** (Q4), and gains a link out: *I run these
  with …*. **Q5 is a list, not a field** — every organisation the person
  publishes threads for, derived from their `thread_thread` rows'
  `workspace_id`. Worth stating plainly because §3 flagged Q5 as the one most
  likely to need a data-model change: re-read on 2026-10-11, it does not.
  `thread_organiser.user_id` is globally unique, so one person has one
  organiser row, and each of their threads carries its own `workspace_id` — so
  the set of organisations is derivable and nothing needs to be stored.
- **On `/sjoerd`: this is the visible one.** The soul.com logo, headline,
  intro, hero and footer leave; his name, photo, *About me*, timezone and
  threads stay; the theme stays; a link to `/soul-com` appears. Same URL, same
  threads, same enrolment links.
- **Sjoerd looks at this on staging before it is promoted.** It is the change
  he asked for and the one where "is this right?" can only be answered by
  looking.

### What is deliberately NOT in any slice
- **No slug migration.** Every address that works today keeps working (§2).
- **`site_contact_email` stays out of the public payload.** It is not in it
  today and the split must not quietly add it.
- **No second editor for the logo.** Q3 is a rename precisely so there is one
  place a logo is set.

### Checks each slice owes
Slices 2 and 3 each add a column that decides whether something is public, so
each needs an integration case proving the DEFAULT — a workspace that has
never been asked still serves, a person who has never been asked is not
listed. Slice 4 is visual and owes a staging look rather than an assertion.
