# Changelog

All notable changes to The Fibre. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

The displayed version comes from the `VERSION` constant in `apps/web/lib/version.ts`. Bump it whenever a change ships.

## [Unreleased]

## [0.73.12] — 2026-09-12 — the fifth condition: carrying a lot

`docs/connections-model.md` §3.2 named five attention conditions. Four
shipped this morning and the fifth was deferred with a note saying it needed
task load, "which lands with the note/task work". That work landed the same
day, so the reason to wait was gone.

**What it is.** Appearing in many live things at once. It is the only
condition on the list that points at your own team as much as at the
community, and the one no CRM has, because no CRM knows what delivery looks
like.

**Four sources of live load**, each counted distinct and summed: threads with
a session still ahead, flows still running, open tasks about the person, and
commitments at a stage that is still open. One thread with three sessions is
one thing, not three. Tasks are counted by who they are ABOUT rather than who
is doing them, because this measures what somebody is carrying.

**The threshold is the workspace's own, never a number.** Four live
commitments is a heavy week for a volunteer and a quiet one for a full-time
facilitator; a fixed cut-off would flag the second forever and never notice
the first. So it is the 90th percentile among people carrying anything —
`connections-model.md` §3.5's rule for counts, applied — **with a floor of
four**. The floor matters: a percentile alone is degenerate in a quiet
workspace, where the busiest of five people is automatically the top tenth,
and a condition that fires on an ordinary Tuesday teaches everyone to ignore
the list.

**The row carries both numbers** — *"in 5 live things at once; 5+ is the top
tenth here"* — so the page can say why this person and not somebody else,
rather than asking to be trusted. Still not a score, like the other four.

**Phrased about the load, never about the person.** "Carrying a lot" is
something you could say to somebody's face, which is the test every condition
on this list has to pass.

Proved on staging with a throwaway fixture before production: five open tasks
makes it fire, on that person and nobody else; dropping to three below the
floor makes it stop; the fixture was deleted and left nothing. On production
it finds two people in The Thread B.V. carrying five things each.


## [0.73.11] — 2026-09-12 — the app opens already knowing who today is about

Sjoerd: *"would be great if the app — when you open it — based on agenda —
can pre select people from the DB, that are named in the agenda."* Build-order
step 5, arriving from the end that pays for itself on a Tuesday morning.

**Today now opens with your calendar**, above what you owe, because a meeting
in an hour outranks a task due on Friday. Each meeting lists its attendees,
and each attendee this workspace already knows is a link straight to their
page — which is where the note gets written. The path from "I have a meeting
at 11" to "here is what we said" is one tap, with the looking-up done.

**Each known person carries two facts** next to their name: where they stand,
in whatever this workspace calls that band, and how long since anything was
written down about them. An old date beside somebody you are seeing in an
hour is the entire reason to look at this page.

**Why this one is safe where matching names in prose is not.** A calendar
attendee is an EMAIL ADDRESS. It is exact, so there is no fuzzy match to get
wrong and no chance of attaching a stranger to a record because they share a
first name — which is precisely why person names stay out of the note
detection shipped in v0.73.10. Both Google scopes were already granted, so
this adds no consent step.

**Nothing is created.** An attendee with no person row comes back unmatched
and stops there, shown with a dashed outline and their address. That is the
most useful row on the screen — somebody you are about to meet who is not in
your people yet — and it is an offer, not an action. `resolvePerson()` is the
only way a person is ever made here and its first rule is that creation is
never implicit; a sync that quietly created a person for every address in
every meeting would fill a workspace with booking robots and conference-room
accounts inside a week.

**Only your own calendars, only your own token.** `listEvents()` asks for
`minAccessRole: 'owner'`, so a subscribed team calendar or a colleague's
shared one cannot drag other people's meetings into your day. The route never
reads another user's calendar, not even for an admin: who is in your day is
not a workspace-level fact.

**Three things that fail quietly and one that does not.** No calendar
connected renders nothing at all — most people will never connect one, and a
permanent notice about an optional integration is furniture. A failed band-
name read falls back to the shipped names. A failed agenda read leaves what
you owe untouched. But a calendar that could not be READ says so, because an
empty calendar and an unreachable one look identical on screen and mean
opposite things.

Verified against production before shipping: the calendar is connected for a
real user, and all three query shapes the route depends on — attendee email
to person, standing, last note — run clean against live data.


## [0.73.10] — 2026-09-12 — tags that write themselves, from words you already use

Sjoerd: *"if you type something after a visit or conversation, that it would
integrate tags in the text... which connects things (without you having to do
it)"* and *"e.g. company names are tags (if they exist; if not you can create
it)"*.

`tag` and `person_tag` were modelled in the first migration and read by
nothing but the Article 15 export. `connections-model.md` §3.5 settled long
ago that user-defined characteristics ARE tags rather than custom fields.
This is the first surface that uses either.

**Write a note; the tags appear.** Detection runs in the composer on every
keystroke, against the workspace's OWN vocabulary: tags it already uses, and
the names of organisations it holds. Plus `#anything` for a word nobody has
used yet. They appear already on, because the request was that this happen
without having to do it and a row of things to confirm is another form. The X
removes the tag and leaves the word in the sentence.

**No model, and nothing leaves the browser.** Note bodies are the most
sensitive text in the system, and sending them to one is a processing
operation needing a sub-processor entry, an EU endpoint and a DPA before it
can happen at all (`connections-data-integrity.md` §9.5). None of that is
needed to do the useful part, because the workspace's own words are already
known.

**Person names are deliberately not matched.** A false positive attaches a
claim to a real person's record. An organisation name is distinctive and is
not a person; a bare first name is neither.

**Three rules that are load-bearing.** A word becomes a tag only once it is
finished, or `#sdg13` flickers through four half-tags on the way to being
typed. Matching is whole-word and case-insensitive, so "art" does not fire on
"participate", and a two-word tag matches across punctuation. And the
composer decides while the API applies: the tag list is sent explicitly and
never re-detected server-side, because a second implementation of the same
rules would eventually disagree with the chips, and the first time it did,
somebody would be tagged with a word they watched themselves remove.

**`person_tag` gained provenance** — `created_at`, `created_via`, `note_id`.
Existing rows are backfilled to the epoch rather than to now, because
backdating them to today would invent a stampede of arrivals that never
happened. `note_id` is what makes an automatic tag answerable: "why is this
person tagged sdg13" has to lead back to the sentence, or the tag is an
assertion nobody can check.

**`tag.organisation_id`** lets a tag name an organisation, unique per
workspace so a company's people cannot split into two groups that look
unrelated. One mechanism, not two — the alternative was a second kind of
mention with its own table and its own rules.

**Connections has unit tests now**, 17 of them, all on the detection rules.
The app had none. Verified against production as well: the vocabulary query,
find-or-create, the link with its provenance, the unique index correctly
refusing a second tag for one organisation, and a clean-up that left nothing
behind.

`docs/connections-model.md` §3.7 records the three things asked for in the
same conversation and not built yet: the tag cloud and map (D70), the tag
marked inline in the sentence rather than beside it (D71, with the reason it
is the risky one), and the calendar pre-selecting today's people (D72, which
matches on email rather than name and is therefore the cheap one).


## [0.73.9] — 2026-09-12 — the steps keep their rules and lose their names

Sjoerd, shown the six lifecycle steps: *"those six steps... not sure where
they came from. Can they be edited?"*

They came from one session on 2026-09-11 and nobody had reviewed them since.
Offered the choice, he took: keep the rules, make the names the workspace's
own. That split is the whole design and it is worth stating rather than
inferring.

**The rules stay derived and stay fixed.** What puts somebody on a step is
worked out from what actually happened — attendance, purchases, membership,
who runs a thread — which is why the landscape was useful on the day it
shipped and asks nobody to fill anything in. A workspace that could rewrite
those rules would have to MAINTAIN them, and a hand-maintained ladder is
wrong within a month. There is deliberately no endpoint, column or screen
anywhere in this release that says what earns a band.

**The names are yours.** "Holds space" can be "convenes", or whatever only
your community would say. `connections_band_label` stores one row per
renamed band, keyed by workspace, axis and band, so a workspace that renames
two of the twenty-two stores two rows and everything else falls through to
the shipped translation. All five axes, not only the ladder — a rename
mechanism covering one of five would be an arbitrary distinction to explain.

**Three decisions inside it that are easy to get backwards.**

No locale column. Shipped names live in a typed catalog in six languages, but
a name somebody TYPED is content, and this codebase does not translate
content. One string per band, shown to everyone in the workspace whatever
their interface language. Machine-translating somebody's own vocabulary would
be worse than showing it as they wrote it.

An empty field is the reset. It deletes the row, because absence is what the
fallback reads. Storing the current English as an override instead would
freeze that band in English for every other locale.

"May this user edit?" is answered on the labels endpoint, not added to
`/auth/me`. That is a wide published shape read by eight apps and this is one
screen's question. Renaming is admin-only, enforced in RLS rather than
re-derived in the API, because the words are shared: one person changing
"contributes" changes what the whole team reads on every screen.

**Settings exists in Connections now**, reachable from the avatar menu, with
the platform entries every app shows and one card of its own. The rename
screen prints what earns each band underneath its field — you cannot sensibly
name a step without being told what lands somebody on it.

Verified against production before shipping: upsert, read back in the API's
shape, a second identical upsert to prove idempotency, delete, zero rows left
behind. Renaming two bands and re-rendering shows two changed and four
falling back.


## [0.73.8] — 2026-09-12 — the prompt only appears where nothing was ever written

A bug in v0.73.6, live for about forty minutes, found in review by the
session working on Thread rather than by anything here.

v0.73.6 showed a sentence — *"All 12 people are in one band, so this axis has
nothing to separate yet"* plus what would fill it — whenever a single band
held everybody. That condition reads the SHAPE of the view, and the shape has
two causes. One is the intended one: nothing has ever been written to the
axis's source. The other is a real, stable answer. A workspace where every
person sits at `committed` would have been told to go put something in the
pipeline it demonstrably already has. A community where everyone genuinely
has been spoken to and nobody was ever introduced would have been nagged
forever by a sentence that could never come down.

**The condition now reads the source**, via `AXIS_UNWRITTEN_BAND` — per axis,
the band a person falls into when nothing has been written: `never`,
`unrated`, `never_spoken`, `none`, `brought_nobody`. The sentence renders
only when the one occupied band is that one. For these five axes that is
exactly equivalent to counting the source and costs no second query, because
the source's emptiness is already visible in the band you are looking at. An
axis whose bottom band were reachable with a non-empty source would need the
real count, and the map says so.

Verified by rendering five cases and checking which one prompts: nothing ever
written on cadence and on opportunity do; everyone in rhythm, everyone
committed, and a real maturity spread stay silent.

`docs/system-handbook.md` §12 gained the split between transient and
structural emptiness — hide the quiet Tuesday, explain the never-used feature
— written by the Thread session after testing the rule against a real
dashboard. This release adds the worked instance underneath it, so the next
person reading the principle also gets the mechanism.


## [0.73.7] — 2026-09-12 — the module says out loud why it is safe

`apps/thread/lib/public-site.ts` is read by nine server components and one
client one, and it works only because that client import says `import type`
— which Next erases before it builds a module graph, so no proxy is ever
made. Import a VALUE the same way and it typechecks, `next build` says
nothing, and the page crashes on first render. `PLAIN_SITE` and `siteOf` are
values.

None of that was written anywhere near the file. It was true by accident,
and the next person to add an import had no way to know they were standing
on it. Now the header says so and points at handbook §12.

A comment, and worth a release on its own: the alternative was leaving a
crash-on-first-render trap in a file with ten importers until somebody
happened to be in there.

## [0.73.6] — 2026-09-12 — the landscape says where its numbers came from

Sjoerd, having opened Connections for the first time: *"I dont get what it
is doing now."* He was right, and every number on the page was correct.

**What he was looking at.** Read against production, three of The Thread
B.V.'s five axes put all twelve people in one band — cadence says
`never_spoken` 12/12, contribution says `brought_nobody` 12/12 — because
those axes read captured conversations and recorded introductions, and
nothing has written either yet. A full-width bar labelled "Never spoken"
holding everybody is indistinguishable from a broken page. The app had no
way to say which it was.

**Three additions, all of them the page explaining itself.**

Every band a person actually stands in now carries one line saying what put
them there: *came to two or more things*, *has paid for something or holds a
membership*, *has something in Pulse at a committed or won stage*. These are
restatements of the SQL predicates in `connections_landscape` and
`connections_landscape_axis`, deliberately short, and they must change in the
same commit as the query they describe — a gloss that has drifted from its
predicate is worse than no gloss. Bands nobody is in stay unexplained; there
is nothing to account for.

An axis where everybody lands in one band now says so, and says what would
fill it. *Write down a conversation on a person and this axis starts
working.* That sentence is the difference between a page that looks broken
and a page telling you what to do next, and it disappears by itself the
moment a second band has anybody in it.

A band with people in it is now a link. Nine people are "in touch" was a
number you could not follow; it goes to `/people` filtered to that band, on
that axis, with the band named in a chip and a way back out on the same line.
The filter survives a search, so narrowing a band down to one name works.

**One honest limit, stated in the code.** Filtering happens over the rows
already loaded, so in a workspace larger than the loaded window somebody in a
band can sit on a page nobody has asked for yet. The count in the chip comes
from the landscape rather than from the rows, so it is the band's true size,
and the empty state says *nobody from this band is in the people loaded so
far* rather than pretending the band is empty.

**`app/(app)/landscape/axes.ts`** is new and holds the label maps as data.
It exists for the reason `today/shape.ts` exists: a module read by both a
server component and a `'use client'` component must be neither, because Next
replaces a client module's exports with proxies and erases the types — the
constant typechecks and then crashes on first render. `people-list.tsx` was
carrying its own maturity-only copy of the labels and now imports the one.

**A markup trap not shipped.** Making a band row a link by swapping the
`<li>` for the link component puts an anchor directly inside a `<ul>`.
Invalid, and React says nothing. The link goes inside the `<li>`. Caught by
rendering the component to static HTML with the real production counts and
reading the output — worth doing for any surface with this much conditional
copy, since a typechecker has no opinion about whether a page makes sense.


## [0.73.5] — 2026-09-12 — Connections is a door you can walk through

Sjoerd, on returning: *"what do I need to do?"* Two switches, both his, and
this is the release that follows them being thrown.

**The flag is true.** `available` on `fibre-sales` flipped from false, which
is the last step of bringing an app up and never the first. Connections now
appears in every app switcher, on the Fibre dashboard, as a valid SSO hop
target, and — because those lists are derived rather than hand-written — in
both smoke tests. It was false for a day on purpose: set true before the
deployment existed, it failed the release gate, which was the gate being
right. The flag describes the world. It does not create it.

**Two domains, two different reasons they were dark.**

`connections.thethread.app` needed three stacked build fixes and has served
since yesterday. `connections.thefibre.tech` returned 404 from the day the
app was created, and the cause was not a misconfiguration: the domain was
correctly bound to the staging branch, DNS was valid, and
`scripts/vercel-ignore.mjs` was declining to build, correctly, because no
push had touched `apps/connections` outside its `package.json` — which the
script excludes on purpose, since the release ritual bumps every version
field every time. **A new app's first staging build therefore waits for an
unrelated change to `packages/shared`.** v0.73.4 was that change, and the
404 resolved as a side effect of somebody else's release. Worth knowing
before app number nine: force the first one.

**Then it answered, and still was not reachable.** It redirected to
`vercel.com/sso-api`. A Vercel project created recently has Deployment
Protection ON by default; the older projects predate that default and have it
off. The failure mode is the nasty kind — it looks fine to the person who set
it up, because their browser carries a team session, and to nobody else. The
only way to see it is signed out, with curl.

**`smoke-staging.mjs` now checks Connections** instead of excusing it as "in
the registry but unbuilt". That guard exists so an app cannot be quietly
absent from staging, and the exclusion had gone stale the moment the app
built. The same script found `my.thefibre.tech` sitting behind that same
login wall — staging only, production is clean, and the switch is Sjoerd's.

**One correction, made in public.** This session told both Sjoerd and a peer
that a missing `CORS_ORIGINS` entry would leave staging Connections rendering
without data. Wrong. Every call goes through `apps/connections/lib/api.ts`,
which imports `serverSupabase` and therefore only ever runs server-side, so
no browser request crosses an origin and the allowlist never applies. Worth
setting for consistency with the other six. Blocks nothing.


## [0.73.4] — 2026-09-12 — an event link that looks like the event

Sjoerd, after the website's preview was fixed: *"Solve that. Incl. the logo
of the organiser/workspace."*

An organiser pasting their own event into a WhatsApp group got a grey card
with the words "The Thread" on it — the app's root metadata, identical for
every public page in the product. They were advertising us to their own
participants. Every public thread already had a cover image, a title and
dates, and every workspace already had a logo on its outgoing email.

**Two cards now.** `/{owner}/{thread}` shows the workspace's logo, the event
title, the dates and the cover; `/{owner}` shows the logo, the name, the
headline and how many events are open. Both carry The Thread's wordmark small
at the bottom, the size of a printer's mark. Whose card it is matters: an
organiser sharing their event is not promoting us.

**The layout keeps everything on white** rather than over the photograph. A
logo is somebody else's file — black, white, or a transparent PNG that
vanishes on either — and a scrim that works for one breaks the next. White is
the only ground that takes them all, and the cover keeps the half of the
frame it is good at.

**A workspace that branded itself once is now branded everywhere.**
`publicSite()` falls back to `workspace.name` and `workspace.brand_logo_url`
when the Settings → Website fields are empty, so the logo already on their
outgoing email reaches their public site and their link previews without
anyone filling a second form. An explicit site value still wins.

**`appMetadata()` returns a `metadataBase`.** Without one Next resolves a
relative `opengraph-image` against localhost and the preview silently has no
picture — which is the actual reason these pages have never had a card, and
would have quietly defeated the rest of this release.

Three details found by looking rather than reasoning. The owner's name was
printed twice on any workspace whose logo IS its name, soul.com's being
exactly that. The coverless card left two thirds of the frame empty until the
type grew and the site's own fallen thread ran through it. And the remote
fetch for a cover happens here with a deadline and a size cap rather than
inside the renderer, because a renderer that throws on one broken upload
takes the preview off every link that workspace has ever shared.

Drafts stay private: both cards fetch anonymously, while the page itself
still forwards a signed-in organiser's token for previewing.

## [0.73.3] — 2026-09-12 — Connections gets a row in the plan matrix

"I don't see Connections in my plans" was two causes wearing one symptom.

**The data half, already fixed.** The `app` row had `beta_at` and
`released_at` both null, which the schema reads as *not built, nobody can
activate it*. `beta_at` is now set on prod and staging, so Connections is
testable by workspaces whose plan carries `beta_apps` — exactly the state it
is in: it renders real pages, it is worth a tester's time, it is not ready
for everyone. That mechanism landed overnight in v0.72.x and is a better
answer than anything invented for the occasion. It is activated for The
Thread B.V., the one workspace on the Beta plan.

**The code half, this release.** There was no `connections` feature key, so
`/admin/plans` had no row to tick. It ships **unticked on every tier**,
because while `beta_at` is set and `released_at` is null it is `beta_apps`
that gates activation. This row is the switch for general release, so which
tiers include Connections is decided in the admin screen rather than in a
migration.

`connections.thethread.app` now serves (v0.73.1 fixed the build), with the
production environment set. It is still absent from the app switcher: the
`available` flag in `branding.ts` stays false until somebody has opened it
signed in and confirmed it works.

## [0.73.2] — 2026-09-12 — the link preview is the actual logo

Sjoerd pasted thethread.app into WhatsApp on his phone and got the
pre-rebrand card: *"The image of the thread is an old one. Not the new one."*

`apps/website/app/opengraph-image.tsx` was DRAWING the brand rather than
reading it — a yellow blob and a wavy line in hand-written SVG paths, with
"The Thread" set in the renderer's default sans. None of that had been true
since the site was rebranded on 7 September. The real wordmark is a
handwritten mark in `public/logo-the-thread.svg`, the payoff under it is
"Tools to facilitate change.", and the design language is the painted shapes
in `public/shapes/`.

The card now reads the same files the site renders, so replacing the logo
updates the preview with it. **That is the point, not a detail:** a preview
that redraws the brand from memory is a copy that goes stale in silence.
Nothing failed, nothing warned, and the only way to catch it was to paste the
link into a chat and look — which is how it was caught, five days late.

Checked as a real PNG rather than reasoned about, twice. The first draft ran
the thread straight through the wordmark and looped a curl over the payoff; no
amount of being on-brand makes that legible, so the line moved below the type.
Then built for production and opened the generated file, because the card
reads its assets from disk at build time and dev is not proof of that.

**Still missing, and unowned:** the Thread app and the public thread pages
have no `og:image` at all — `appMetadata()` returns a title and a description
and nothing else. An organiser pasting their own event link gets a bare card.
The obvious fix is the thread's own cover image, which every public thread
already has.

## [0.73.1] — 2026-09-12 — the Connections build actually builds

Three failures, three different causes, each one hidden behind the last.

1. **Root Directory at the repo root**, so Vercel read the root `vercel.json`
   whose `outputDirectory` is `apps/web/.next`. A project setting.
2. **The Output Directory override survived that fix** and still said
   `apps/web/.next`, now resolved against the new root as
   `/vercel/path0/apps/connections/apps/web/.next`. Pinned explicitly in
   `apps/connections/vercel.json`. The sibling apps omit it and rely on clean
   dashboard settings, which is fine right up until a dashboard is not clean.
3. **The real one, and a bug of ours.** `app/(app)/page.tsx` was a bare
   redirect inside a route group, and `app/page.tsx` already resolves to the
   same path. Next silently drops the duplicate and emits no
   `page_client-reference-manifest.js` for it; Vercel then `lstat`s a file
   that was never written, and the deploy dies **after** a successful build.
   The root page already sends a signed-in user to `/landscape`, so the file
   was redundant as well as fatal. Deleted.

A local `next build` cannot catch (3): the manifest is only demanded when
assembling the serverless function, which the local build never does. Two
green builds in a row said nothing about it.

Also: a blanket `.env*` in `.gitignore`, kept after the Vercel CLI added it,
because it closes a real near-miss — a fresh worktree has no gitignored env
files, so they get copied in by hand to run tests, and they never show in
`git status`. The `!.env.example` negation is repeated below it, since a later
rule wins and the original negation was dead the moment that line landed.

Connections production env is now set (Supabase, API base, cookie domain
`.thethread.app`, SSO secret) and the staging scope carries all thirteen,
including `NEXT_PUBLIC_CONNECTIONS_URL`.

## [0.73.0] — 2026-09-12 — Connections can be written to (Connections 0.2.0)

Four surfaces, built in parallel on one foundation, then integrated and
verified signed in against staging with real data.

**Notes hang off people now.** Before this the only place a body could live
against somebody was `flow_run_note`, and it required a run — so "I spoke to
Marja" had nowhere to go unless Marja happened to be on a flow. Widened in
place rather than renamed: four of its nine call sites back the published
external-app contract, and a better name is not worth risking that.

The capture rules from `docs/connections-data-integrity.md` §7 are enforced in
the API rather than trusted to the interface, and each is verified against a
real database: three autosaves make one row (the idempotency key and the
autosave key are the same key), a draft fires nothing, committing fires
exactly once and editing afterwards does not fire again, the activity row
carries type and subject and **never the body**, a follow-up becomes a
`flow_task` rather than a second to-do list, and an invalid timezone is
refused at the boundary — the exact bug that crashed the Thread editor on
2026-09-08.

`last_spoken_at()` counts personal kinds only. **A newsletter is not a
conversation:** if a mailshot reset that clock, the attention conditions would
report a dead relationship as healthy. There is a test holding that.

**Today** — what you owe, and what is coming at you. The second half is the
one no other CRM has, and it works: a gathering nine days out surfaces
*today*, because its preparation lead time is fourteen days. `prepare_at`,
never `happens_at`, decides the segment. Four signals compute; a fifth was
left out deliberately, because deciding "the joining message should have gone
by now" means re-deriving the scheduler's trigger logic and would produce
confident false positives.

**Five axes** re-segment the same people in an identical visual — maturity,
closeness, cadence, opportunity, contribution. Closeness and opportunity
cannot time-travel (current-state columns with no history) and the interface
says so rather than hiding it. Cadence gained a fourth band beyond the brief:
without `never spoken`, everyone you have never talked to reads as "gone
quiet", which is a different and untrue fact.

**Entries** — who can get us in. Two hops structurally, never recursive. Path
strength is the **weakest** edge, verified at 0.286 against real data where an
average would have claimed 0.57. Former employment is included and named,
which is the strongest warm path most CRMs cannot see at all. An entry through
someone marked `sceptic` is shown as a warning and sorted last.

**People** — the list with each person's standing, and the note composer.

Also: `GET /connections/landscape?people=1` returns the per-person rows the
handler already had in memory and was discarding. Additive — omitting the flag
is byte-identical, so every existing caller is untouched.

**One bug only a render check could find.** `HORIZONS` was a runtime constant
exported from a `'use client'` module and imported by a server component. That
typechecks perfectly and crashes on first paint: Next replaces client-module
exports with client-reference proxies, and types are erased, so the compiler
sees nothing. Moved to `today/shape.ts` — a runtime value shared between a
server and a client component belongs in a module that is neither.

Three migrations, all additive, all applied to staging first.

## [0.72.8] — 2026-09-12 — looking at the pricing options stops creating a live discount

Still walking the new organiser's first hour. Opened Thread settings →
Pricing and clicked **Paid** to see what was there. A 10% discount code
called EARLYBIRD appeared in the list, already switched on.

It is seeded deliberately — an example to edit rather than an empty list, and
a reasonable idea. The implementation was not:

- it was written on a **toggle**, before any Save;
- **Cancel could not undo it**, because the coupon list is its own API-backed
  list rather than form state the dialog discards;
- and it was created **active**, so the moment a ticket existed, anyone who
  guessed the word EARLYBIRD got 10% off a thread whose owner had never asked
  for a discount and may never have registered that the code existed.

Verified on staging rather than reasoned about: flip the toggle, press
Cancel, and the row is still there, `is_active: true`.

**It is now seeded inactive.** That keeps what it is for and costs the
organiser one switch. `findValidCoupon` filters on `is_active`, so it cannot
be redeemed until they turn it on, and the list already dims an inactive code
and marks it with a chip, so the state is visible rather than implied.

**`coupon-active.int.test.ts`** locks the rule the fix depends on, against the
real staging API: a switched-off code is refused, the same code is accepted
once switched on, refused again when switched off, and the gate cannot be
dodged by changing the case of the code. It also pins the refusal WORDING to
the same message an unknown code gets — telling a stranger "that one is
switched off" confirms the code is real and invites them back tomorrow.

This is a money rule enforced by a single `.eq('is_active', true)`, which is
exactly the kind of thing the testing approach says to attach a test to.


## [0.72.7] — 2026-09-12 — the participant's own page was never checked

Carrying the cold organiser through the rest of their first hour: publish the
thread, open the public page, enrol somebody, follow that person to their own
page. The first three work. The fourth does not exist on staging, and nothing
had ever said so.

**`my.thefibre.tech` answers a Vercel login, not the portal.** Deployment
protection is on for that project while every other staging domain is open,
so the participant's own page — the one place a person who is not a customer
ever signs in — cannot be reached or tested on staging at all. Production is
fine. This needs a Vercel settings change, so it is listed in build-plan's
Outstanding for Sjoerd rather than fixed here.

**The staging smoke check never looked.** Its subdomain map was written by
hand and listed five apps; `my` had been missing since the portal shipped, so
the gap was invisible. The map still cannot be derived — production moved
Thread to `app.thethread.app` while staging kept `thread.thefibre.tech` — but
whether it is COMPLETE now is: a guard fails the script if a registered app or
surface is neither mapped nor in an explicit `NOT_ON_STAGING` list with a
reason. The same class of bug as the title list this file fixed hours ago, and
the same fix: stop trusting a hand-kept list to stay right.

The new check also reads the `Location` header, so protection is reported as
what it is rather than as "status 302", which would send the next person
hunting for a DNS fault that is not there.

**`One Fibre account for everything` was the first thing a participant read.**
It appears on the public page immediately after enrolling, in all six locales.
`docs/naming-brief.md` §2 is explicit that Fibre is backstage and "never the
first thing a customer meets", and this is exactly that. The brand name is
dropped rather than swapped for Thread's — the sentence goes on to mention
bookings, which are Meet's, and "one account for everything" is the true claim
without asserting a new one.

Verified correct and deliberately left alone: the privacy-policy link on the
enrolment form points at production from staging. That is right. A consent
checkbox should reference the canonical legal document, not an environment
copy of it — the same split v0.72.5 built into the footer.


## [0.72.6] — 2026-09-12 — a new thread stops being born broken

Found by signing in as a genuinely cold organiser — a workspace with nothing
in it, an account that had never logged in — and doing what a first client
does: pick a shape, name the event, give it a date, create it.

**The date went nowhere the organiser could see.** "Starts on" was written to
the `program` row and never reached the timeline. So the create form accepted
a date, the thread header showed it, and the editor opened on:

    NO DATE   The event                                    Draft
              Thank you · 1d after The event · 10:00
              won't send: the anchor has no date

A warning about a problem they had not caused and could not have avoided, on
a thread they had just given a date to, in the first minute of using the
product. `seedRowsFor` simply had no parameter for it.

It now places the FIRST activity element on that date, and the relative
messages hanging off it resolve themselves. Only the first: the rest of the
timeline stays the organiser's to arrange. A multi-day shape ends on its last
day. No date given, or a malformed one, changes nothing.

**It uses `zonedTimeToUtc`, not the naive form.** The template-duplication
path builds its timestamps as `new Date(\`${date}T${time}:00Z\`)`, which
treats a wall clock as UTC and lands a 10:00 Amsterdam event at 12:00 local
in summer. The correct helper already existed in `lib/availability/timezone.ts`
and Meet's availability engine already used it. Twelve tests, including a
December date to prove the DST boundary is handled and that a winter event is
UTC+1 rather than UTC+2.

Note for whoever touches the duplication path next: it is still on the naive
form, so a duplicated thread and a newly seeded one will disagree by the
offset. That is a real inconsistency and it is now the only one left.

**New: `apps/api/scripts/cold-organiser.mjs`.** The tool that found this.
Creates a brand-new workspace, person, user, admin membership, the plan's
apps and a Supabase auth account on STAGING, then prints a single-use sign-in
link. Every other fixture path reuses an account that already has a
workspace, contacts and habits — which is exactly what a first client does
not have, and why empty states and first-run prompts are invisible from a
seeded account. `--list` and `--signin <slug>` come back to one later. It
refuses to run anywhere but staging.


## [0.72.5] — 2026-09-12 — the staging footer stops walking people into production

Caught by opening staging in a real browser, after every scripted layer had
passed. This is the argument for the exploratory pass in one finding.

**Every link in the shared marketing footer pointed at production.** It held
`const WEBSITE = 'https://thethread.app'` and read `APPS[...].url` directly
rather than the env-aware `appUrl`. On `thefibre.tech` that meant Why The
Thread, The workshop, Pricing, About, Contact, the legal links, the logo —
and, worst, **Sign in** — all left staging and landed on the live app.
Sign in on a staging page opening the production app, against production
data, is exactly the bleed the separate staging apex was chosen to prevent
(docs/environments.md D1).

The comment above the constant said "Links are absolute for the same reason",
and absolute was right: this footer renders into emails too. Absolute is not
the same as hardcoded-to-production, and the two had been conflated.

Fixes:

- **`website` is now a registered SURFACE** (`NEXT_PUBLIC_WEBSITE_URL`, dev
  port 3006), beside `my-portal`. The registry comment already said surfaces
  exist so "URLs and CORS derive from ONE place (the domain-flip lesson)" —
  the marketing site was simply never added to it.
- **The footer derives all three hosts** — website, Thread, Fibre — through
  `surfaceUrl` / `appUrl`, defaulting to the ambient environment.
- **`FOOTER_PATHS` split out from `FOOTER_LINKS`.** The absolute production
  links stay exactly as they are, because their job is EMAIL and an inbox is
  read from anywhere, long after sending; a staging host in one is a dead
  link in somebody's inbox. A rendered page joins the paths onto whichever
  host it resolved.
- **`ambientEnv()`** reaches `process.env` without pulling `@types/node` into
  a package that also compiles for browsers, and documents that it is
  server-only — Next inlines `process.env.NEXT_PUBLIC_*` into client bundles
  as literals, which going through `globalThis` would dodge.

Nothing moves until the environment says so: unset variables still resolve to
production, so this is a no-op on production and a fix on staging the moment
`NEXT_PUBLIC_WEBSITE_URL` is set there. **Sign in corrects itself
immediately**, since staging already sets `NEXT_PUBLIC_THREAD_URL`.

Five tests lock it, including that no surface URL carries a path or a
trailing slash, and that the email links stay pinned to production.


## [0.72.4] — 2026-09-12 — a sign-in stops writing twelve rows one at a time

Legacy and optimisation night. The headline finding is a negative one and
worth recording as such: **there is almost no dead code here.** A sweep of
every exported symbol in `apps/api/src/lib` and `packages/shared/src` turned
up four functions nothing calls, and on inspection three of them are
unfinished features with their scaffolding already in place — seat overage,
Zoom's host lookup — not corpses. There are zero TODO, FIXME or deprecated
markers in the entire codebase.

What there is, instead, is comments that describe code that no longer does
what they say. Those cost more than dead code does, because dead code is
inert and a wrong comment actively sends the next person the wrong way.

**`ensurePlanApps` did twelve sequential round trips per sign-in.** It ran a
nested loop over apps × users doing one awaited upsert per pair. `sso/resolve`
calls it fire-and-forget on EVERY sign-in, so a six-person workspace on two
apps paid twelve sequential writes each time anybody logged in, to insert
rows that already existed. The grid is small and uniform, so it is now one
upsert of the whole thing. A failed app activation still skips only that
app's memberships, and the membership write now reports its own error instead
of discarding it silently.

**The rate limiter had a test seam and no test.** `resetAllBuckets` carried a
comment saying the contract script used it to assert the limiter without
waiting a minute. The contract script talks to a deployed API over HTTP and
cannot reach an in-process Map, so nothing had ever called the seam and
nothing had ever tested the file. It guards whether a stranger's site can keep
reading the published thread routes, so it now has ten tests: the boundary
(the request exactly ON the limit is allowed, the next is not), that
`remaining` never goes negative because it goes out in a header, that the
window is fixed rather than sliding, and that an unidentifiable caller shares
one bucket — being unidentifiable is not a way to be exempt.

**`vat.ts` claimed a job that `seller-vat.ts` does.** Its header called
`computeVat` the calculator for "invoice-method purchases". Untrue: app sales
on every rail get their tax from `seller-vat.ts`, which does a VAT-inclusive
split against the seller's own registration — a different model, not a
different caller. `computeVat` is called by nothing at all. It is kept,
because a non-Stripe PSP would need exactly these destination rules and the
platform is deliberately PSP-agnostic, but the header now says plainly that it
is untested reference code and must be tested before it touches money.

Left alone on purpose: the admin workspace list's N×5 head-count queries,
which are a documented decision with a stated revisit point at ~100
workspaces, not an oversight.


## [0.72.3] — 2026-09-12 — two scripts that could not say what was wrong

Both findings come from running the documented flow rather than from reading
it. Neither is a product bug; both are the kind of thing that wastes an hour
at the wrong moment.

**`audit-workspace-admins.mjs` read its environment unlike every one of its
siblings.** Every other script in `apps/api/scripts` takes `FIBRE_ENV_FILE`
and parses the file itself. This one required the caller to remember
`node --env-file=.env`, and the entire reward for forgetting was a
supabase-js stack trace reading `supabaseUrl is required.` — which names
neither the script, nor the missing file, nor the flag. It now reads the
house way, `--env-file` still works because a value already in the process
wins, and a missing file prints the path it looked for. It also announces
which project it is auditing, so pointing it at production by accident is
visible rather than inferred.

**`verify-public-api.mjs` could not say why staging had no fixture.** It
needs a thread that is public-listed, has an owner slug, and has a programme
that is active or completed. When nothing qualified it said only "publish
one, or run seed-ebbf.mjs" — so an environment holding threads that were
merely in draft read exactly like an environment holding none, and the
advice was wrong for both. It now lists every public-listed candidate with
the condition it failed. Staging's says `single-event — programme is draft`,
which is the whole diagnosis in six words.

The advice changed too: it no longer points at `seed-ebbf.mjs` for staging.
That script targets the `default` workspace, which on staging is the Stripe
payment-rehearsal rig — the one the integration suite marks load-bearing and
tells you never to touch.

**Not fixed, and needing Sjoerd** (recorded here so it is not rediscovered):
staging's Stripe webhooks are registered against the platform's own account
for Thread, Meet and Membership, when all three take money on connected
accounts, and Meet's endpoint is missing `payment_intent.payment_failed`.
The mode is fixed at creation, so each has to be deleted and remade, and the
new signing secrets pushed to Fly. Remaking them without the secrets would
leave staging payments worse off than they are now, so they were left alone.


## [0.72.2] — 2026-09-12 — the test run, and the two things it caught

A full pass of the documented flow: types, unit, prod smoke, staging smoke,
the published-contract checks on both environments, the external-app walk,
Stripe webhook registration, the slug and admin audits, the integration suite
against the staging database, Playwright's golden paths, and a signed-in
exploratory pass over everything v0.69–v0.72 shipped.

**The staging smoke was lying, politely.** It reported two correctly-routed
domains as misrouted because it carried a hand-written list of expected page
titles, and that list still said "Thread" and "Membership" after branding had
moved to "The Thread" and "Members". The prod smoke has always derived the
name from the app catalogue; this one now does too, `includes` and all, so a
page title with a suffix no longer reads as the wrong app. The subdomain
mapping is the only staging-specific fact left in it.

**The staging API was three hours behind its own database.** v0.72.0 pushed
the Beta migration to both databases but deployed the code to production
only, so staging had the Beta plan row and none of the code that hides it —
and Beta appeared on the public staging price list with a Get started button.
Deployed; the staging catalogue is back to four plans. The rule this breaks
is already in the release gates: a migration goes to both databases in the
same ship, and the code has to follow it to both too.

**New: `e2e/exploratory.spec.ts`.** The signed-in render check that v0.69.5
and v0.69.7 went out without. It asserts the sidebar shape in Meet and
Thread, that the routes removed from the nav still answer, that Settings →
Teams renders, and that Beta stays off the price list. It asserts nav ORDER
rather than section labels, because labels only render on an expanded
sidebar and a fixture user's preference is not a fact to assume — the first
version of this file failed for exactly that reason and was wrong, not the
app.

## [0.72.1] — 2026-09-12 — the three settings a new app's Vercel project needs

Written while importing Connections, because two of the three bit on the way
in and the second one looked like a new problem while being the same one.

`docs/deploy.md` now carries the recipe. **Root Directory must be
`apps/<app>`** — left at the repo root, Vercel reads the root `vercel.json`
whose `outputDirectory` is `apps/web/.next`, so the app builds correctly and
then the deploy fails looking for web's output. And the **build, install and
output overrides must be blank**: a leftover from a first failed attempt
survives the Root Directory fix and produces a second, different failure
*after* the build succeeds.

`scripts/verify-vercel-env.mjs` gains `thefibre-connections` in its NAMES
list and `NEXT_PUBLIC_CONNECTIONS_URL` in the staging matrix. That list is
hand-kept and cannot be derived — Fibre web's project is plain `thefibre`,
not `thefibre-web`, and a project can exist before its directory or after it.
The eighth app was exactly the "new thing forgotten in a list" bug this repo
keeps hitting.

Connections' `brandLetters` go from an arbitrary `cx` to `cn`; every other app
uses its initials.

Connections remains `available: false` and `connections.thethread.app` still
404s — its Vercel project has no successful build yet. Build settings first,
then the env vars, then flip the flag. Order matters: flipping it early fails
the release gate, because `smoke-prod.mjs` derives its domain list from the
catalogue and will check a domain no browser can reach.

## [0.72.0] — 2026-09-12 — Beta: the companies who see an app first

Sjoerd: *"Give one more plan above enterprise. Beta... it is companies that
get the newest apps to test for a while."*

So the new tier is not about volume or support. It is about **earliness**, and
about a **while** — both of which had to become real things rather than a
promise in a sales conversation.

**A third answer in the catalogue.** `app.released_at` has meant "is there a
product behind this" since August, and `status` means "has a human allowed it
to act" — two questions, two columns, deliberately. Beta needs a third that
neither can give: an app that renders real pages, is worth a tester's time,
and is not ready for everyone. That is `app.beta_at`. Set it with
`released_at` still null and the app can be switched on by a beta workspace
and by nobody else. Everyone else sees exactly what they saw before, "not
built yet", because from where they stand that is still true. Releasing
generally later just sets `released_at`, which always wins.

**The while is enforced.** `workspace_subscription.beta_until` is read on
every plan resolution, and past it the `beta_apps` feature lapses. Only that
feature: the rest of the plan stands and **nothing already switched on is
taken away**. A tester keeps the apps they turned on and simply stops being
first in the queue — taking a live app out of a company's hands because a
date passed would be a worse failure than the one this prevents. Eight tests
cover the expiry, including that an unreadable date keeps access rather than
guessing.

Worth knowing, and deliberately not touched: `comped_until` sits on the same
row, has the same shape, and is read by nothing at all — a comp with an end
date does not end. Making comps start expiring is a billing decision and
belongs to whoever makes it, not to this release.

**Beta is invited, not bought.** `billing_plan.is_public` is new and every
existing plan defaults to true; only Beta opts out, so it never appears on the
public price list beside the tiers you can actually pick. It still gates, it
still shows in /admin/plans, and a workspace on it still sees it on their own
plan page.

Its features are copied from Enterprise **by the migration** rather than
retyped, so a feature added to Enterprise before this ran cannot be quietly
missing from the tier above it. Priced at 0 like Enterprise, which here means
a conversation rather than free.

Setting it up: /admin/workspaces → Plan → Beta, with a "Testing until" date
that only appears for that plan and clears itself when a workspace moves off.

## [0.71.0] — 2026-09-12 — Connections: where everybody stands

The eighth app. `connections.thethread.app` and `connections.thefibre.tech`
already pointed at Vercel; the directory had to exist before the projects
could be imported, which is what this release is for.

**It owns no data.** No tables, no schema, two read-only SQL functions.
Everything on screen is derived from what Thread, Meet, Membership and the
purchase ledger already recorded — which is the whole argument for it: it
shows something useful on the day it ships and asks nobody to fill anything
in.

**The landscape** (`connections_landscape(workspace, as_of)`) places everyone
on a ladder: holds space, contributes, came back, came once, in touch, not
yet. Highest rung wins. Derived and never typed, because nobody maintains
four hundred people's stage by hand and a stored one is wrong within a month.

`as_of` is what makes movement free. Every source is a timestamped event, so
"what did this look like a month ago" is the same query with an earlier
cutoff — no snapshot table, and the answer cannot drift from the facts
underneath.

One bug caught by looking at the page rather than the code: the obvious delta
(count now minus count then) showed a confident "+6" on every band of a young
workspace, because those people did not exist a month ago. It read as six
promotions and was six arrivals. The band delta is now net movement over
people who existed at both ends; arrivals are counted separately.

**What needs you** (`connections_attention(workspace)`) — four named
conditions, each carrying the fact that produced it, never a score. A single
number is lead scoring wearing community clothes, and for this audience it
quietly turns people into a ranking. "Went quiet" is measured against a
person's *own* rhythm with a sixty-day floor, because somebody you speak to
yearly is not stale at ninety days. On staging it immediately found two
people who came to something and were never contacted again.

**Naming.** The slug stays `fibre-sales` — it tags curator data on
`person_relationship_context` and `org_relationship`, and slugs never change
(the membership/Hyve rule). Only the display name moved: here, and on the
profile tab in Fibre web that "Sales" had been titling. `docs/connections-naming.md`.

CORS needed no allowlist entry — `PROD_ORIGINS` is derived from `APP_IDS` and
`appUrl`, so changing the branding URL covered it. Dev port 3008 and the
Vercel preview pattern did need adding.

Verified signed in against staging: both pages render with real data, mobile
stacks to the bottom tab bar, workspace typecheck clean.

**Not done by this release**, in order: import the Vercel projects now that
the directory is on `main`; append `https://connections.thefibre.tech` to
`CORS_ORIGINS` on the staging API (prod needs nothing — its origins are
derived); then flip `available` to `true` for `fibre-sales` in
`packages/shared/src/branding.ts`.

`available` ships **false**, which is the honest value: it means "you can go
there", and until the Vercel projects exist you cannot. It gates every app
switcher, the Fibre dashboard and the SSO hop target check — and, because
that list is derived rather than written out, `scripts/smoke-prod.mjs`.
Setting it true first made the release gate fail on
`connections.thethread.app`, which is the gate working exactly as intended:
it caught an app listed in the catalogue that no browser could reach.

Design series indexed at `docs/connections-overview.md`; current state and the
prod/staging divergence at `docs/connections-handover.md`.

## [0.70.2] — 2026-09-11 — the release refuses a half-push instead of making one

`git push origin HEAD:main HEAD:staging` updates two refs in one command and
git does not apply them atomically. So when `staging` has diverged, `main`
lands anyway and only the second ref is rejected: you are released on main,
the script reports failure, and you are one retry away from spending a second
version number on the same change.

`staging` diverged tonight, for a good reason — a session pushed one commit
there to exercise it on the staging stack without releasing it. That is a
legitimate thing to want and the script had no way to survive it. It now
checks, before pushing anything, that `origin/staging` is an ancestor of
HEAD, and refuses with the command that shows what is there.

The refusal deliberately does not offer to fix itself. Both ways out destroy
or ship somebody's work: merging those commits into main releases them, and
resetting staging to main throws them away. That is a decision, not a retry.
It was taken here by Sjoerd and by the commit's author, not by the script.

**So this release also carries `/contacts/duplicates`,** the screen for the
four admin endpoints v0.70.0 shipped with nothing able to reach them. It
lists candidate pairs with the reason in words rather than a score, shows how
each record arrived so that "typed in" against "booked a meeting" can settle
which to keep, and makes KEEPING the choice rather than merging in a
direction nobody remembers.

**One honest gap, stated by its author:** that page has never been rendered
signed in. The API under it was verified properly — list, merge and undo
exercised over HTTP against staging with a real admin session — but the page
itself was only ever seen as a redirect to sign-in, because the staging
magic-link sign-in does not complete for localhost. A runtime render error in
it is the residual risk. It is admin-gated and behind a deliberate button, so
the blast radius is one page for one role, but it has not been verified the
way the rest of v0.70.0 was.

## [0.70.1] — 2026-09-11 — the release script can be run from where we now tell people to work

Two defects in the release path, both found by the first session to release
from a git worktree, and both fixed at the root rather than written up as
things to remember.

**`release.sh` pushed the ref named `main`.** In the main checkout that is the
commit it just verified. From a worktree it is a different thing entirely —
`main` is checked out in the MAIN checkout and holds whatever that tree last
had, so every gate would pass on your tree and somebody else's commit would
ship. It pushes `HEAD` now, which is identical in the main checkout and
correct everywhere else, and is in any case the honest ref: HEAD is what the
gates read. This mattered today rather than in the abstract, because CLAUDE.md
now tells sessions to take a worktree for code work, so the broken path was
about to become the normal one.

**Two secret files were being uploaded to the Fly builder.** The root
`.dockerignore` said `.env` and `.env.*`, and Docker ignore patterns are
relative to the CONTEXT ROOT, so those matched `/.env` and nothing deeper.
`apps/api/.dockerignore` looked like it covered the gap and never has:
BuildKit reads only the context-root file. The Dockerfile's COPY list is
narrow enough that neither file reached the image — luck, not design — but
the whole context is uploaded to the remote builder, so the secrets crossed
the wire. `**/.env` and `**/.env.*` now match at any depth, and the
decorative nested file says at the top that Docker never reads it.

**Corrected after publishing.** This entry first said the exposure was a
worktree problem, because a worktree has to have those files copied in before
`pnpm verify` will run. That was wrong, and it understated it.
`apps/api/.env` has sat in the MAIN checkout since 12 May 2026, the day the
project started, and `apps/api/.env.staging` since 3 September — so every
`fly deploy --remote-only` anyone has ever run uploaded them, not just the
one release made from a worktree. The API is at v266. Between them the two
files hold `SUPABASE_SERVICE_ROLE_KEY` for both projects — the credential
that bypasses every RLS policy on the EU database — plus
`SSO_INTERNAL_SECRET` and `STRIPE_SECRET_KEY`. What bounds it: `fly secrets list`
shows Fly already holds every one of those values, and has to — the API reads
them at runtime. So the same secrets reached the same vendor by a sloppier
path than the intended one, a build context instead of an encrypted secrets
store. Lower assurance, no new party. A real hygiene defect, now fixed, and
not grounds for an emergency rotation. Whether to rotate anyway is Sjoerd's
call and nobody else's: the service-role key means a Supabase rotation plus
`fly secrets set` plus a redeploy, with a window where the API does not
answer. Found by the session that made the original report, which corrected
its own framing twice — first the scope, then the severity.

The general shape of both: a check you have to remember is the check that
fails. Fixing the pattern beats adding "and list the env files" to a
pre-deploy ritual.

## [0.70.0] — 2026-09-11 — one way a person is matched, and a merge you can undo

Nine call sites across six route files each rolled their own match-or-create
for a person. Reading them turned up three real bugs, not just duplication.

Five used a single-row fetch with no limit, and PostgREST raises PGRST116 when
more than one row matches — so the moment a workspace held two people on one
address, booking a meeting, joining a membership and an external app's link
call all failed. The duplicate problem was eating the code meant to prevent
it. Membership matched with `ilike`, where `%` and `_` in the VALUE are
wildcards and `_` is legal in an address, so `foo_bar@x.com` could match a
different person. Name splitting was written six times, storing `''` in two
places and `null` in the rest.

`lib/resolve-person.ts` is now the only way a person is matched or created —
same pattern as `connections.ts` and `payment-accounts.ts`, both of which
exist because one value drifted across several readers. Creation is never
implicit; callers ask for it. Matching is oldest-wins, explicitly ordered and
limited, so duplicates can never raise, and the count comes back so callers
log it.

No unique index on (workspace_id, email), deliberately: couples share an
address and `info@` is one mailbox for an organisation. The API enforces with
judgement; the database does not pretend otherwise.

**New: `person.created_via`** records how every row arrives — typed in, a
booking, an enrolment, a membership purchase, an external app. Plain text with
no check constraint, so adding a source is a deploy rather than a migration.
Existing rows stay null, which is honest. It joins the Article 15 export.

**New: duplicate review and a reversible merge.** `merge_person` discovers
every FK pointing at `person` from `pg_constraint` rather than listing them —
28 exist today, and a hand-written list is what goes stale the first time
someone adds a table. Every repointed row is recorded by id; every row a
unique constraint refuses to move is stored whole before being dropped, so
`unmerge_person` restores it. The merged person is soft-deleted and stamped
with `merged_into`, never removed.

`person_duplicate_candidates` uses `pg_trgm`, not a model: same address, same
name, and trigram-similar names — the case deterministic matching misses.
Nothing leaves the database and it answers the same way every run.

**The integration test earned its place immediately.** The merge hit
`activity is append-only — write a correction row instead`. The tempting fix
is to exempt the merge, which puts a permanent hole in hard rule 5 for an
administrative convenience. Instead activity is excluded from the repoint and
reads resolve through `person_and_merged()` — the event really did happen
against that record.

Routes (admin-gated — merging rewrites who owns a payment and a certificate):
`GET /persons/duplicates`, `POST /persons/merge`,
`POST /persons/merges/:id/undo`, `GET /persons/merges`. No UI yet; the queue
is reachable by API only.

Also: `callerWorkspaceRole` moved from `routes/members.ts` into
`lib/workspace-roles.ts` rather than being copied — one reader, not two that
drift. `POST /persons` now returns an advisory `duplicate_of` instead of
silently creating a second record; it still creates, because typing a contact
in is deliberate.

Migrations went to staging first per the documented rhythm for anything
touching RLS or existing data. 40 integration tests against staging, 6 new;
160 unit tests, 17 new.


## [0.69.8] — 2026-09-11 — the contact heading starts under the logo

Found by looking at the page rather than at the code: the contact form sat in
a narrower container than the navbar above it, so the word Contact floated in
from the left while the logo stayed at the edge. The container now matches the
navbar's and the form alone stays narrow, because a text field the width of
the page is unpleasant to read back.

Also checked on staging, on a phone-sized viewport and against fixtures that
were removed afterwards: the three designs render, the contact route 404s for
an unknown owner, rejects an incomplete body, and answers a filled honeypot
with a cheerful ok while delivering nothing. The delivery leg itself is
untested — that would mean sending real mail to a real person.

## [0.69.7] — 2026-09-11 — Thread's sidebar catches up with the others

The one piece v0.69.5 left out. Thread's Money section needed a translation
key in a catalogue another session was holding uncommitted, so its invoices
stayed among the Thread screens while the other five apps moved. That
catalogue landed, so Thread now reads the same as everything else: Home,
Thread, People, Money.

## [0.69.6] — 2026-09-11 — somewhere to choose the design, and a way to be written to

The other half of v0.69.4. That release taught the public pages three
designs; this one is where a workspace picks one, and the contact page the
ingredients list promised.

**Settings → Website.** The design, chosen from four cards, then the site's
name, logo, header image, headline, intro, navbar links, footer text and the
contact form. Each theme card carries a small abstract of its layout rather
than a screenshot: what differs between the three is where the weight sits,
and four rectangles say that honestly and never go stale.

**`/{owner}/contact`.** Name, address, message. It delivers to an address the
visitor never sees, which is most of why a form beats printing the address.
Turning the switch on without naming that address is refused in the editor,
because a form with nowhere to deliver eats messages silently. The page 404s
unless the form is on, so the route can never render as a way to reach
somebody that isn't one.

**Thread pages wear the site too.** Same navbar, same footer, reached from
the same listing. One exception, found by looking: festival's navbar floats
transparently over its hero image, and a thread page has no hero, so it
borrows corporate's solid bar for that one page.

Checked in a browser against staging rather than reasoned about, which is how
the festival navbar turned out to be white text on a photograph of a bright
ceiling. It now carries a shallow scrim of its own, and the fixtures that
proved it were removed afterwards.

## [0.69.5] — 2026-09-11 — one sidebar, and nothing in it twice

Sjoerd: *"make the side bar simple, and remove double function (like Settings
from two places).. maybe just one... (dropdown)... Side bar should be
consistent through the app (contacts, teams, invoice... etc.)"*

**Settings leaves the sidebar.** It was already in the avatar menu in every
app, so it was in two places everywhere. The menu keeps it. In Thread and
Membership it was the only thing in its section, so the section goes too.

**Internal team leaves the sidebar** in Thread and Meet. It was a second
Members screen inside the app, and its own page said so — it linked to The
Fibre and called that the single point of truth. Since yesterday that screen
also has Teams beside it, so there is nothing left for a copy to add. Thread's
was already read-only. **The routes stay**, so existing links and the Help
pages still work; only the nav entries go.

**Every app now has the same shape.** Home, then the app's own work, then
People, then Money. Contacts and Teams are platform things, so they stopped
being filed under "Workspace" in Meet and Flow and under "People" in Thread
and Pulse.

Thread's Money section is the one piece not here: it needs a translation key
in a catalogue another session is holding uncommitted, so its invoices stay
where they were until that lands. Better a Thread sidebar that is one step
behind than a second sweep of somebody's in-flight work.

Also fixed, a defect from yesterday's teams release: Meet's internal-team
invite wrote `app_membership` without `is_direct`. An invite landing on a row
a team happened to confer would have been recorded as team-derived, and the
resolver would have withdrawn it the next time that team changed — a
deliberate grant revoked by something unrelated to it.

## [0.69.4] — 2026-09-11 — three ways for a workspace to look public

Sjoerd: *"on workspace level.. provide three different design styles... A
festival: full page hero image with a title and navbar at the top. A second
one more corporate. A third one more community like style."* Plus the
ingredients: image, navbar, logo, intro text, footer, privacy, conditions,
contact page.

**A theme is a layout, not a palette.** The three differ in what they put
first, because they are for visitors arriving in different states of mind.
*Festival* is for a stranger who has to feel something before they read: the
hero image is the page, the navbar floats over it, the programme is a grid of
posters. *Corporate* is for somebody sent here to find a date and a price:
nothing decorative above the fold, and a listing whose first column is the
date. *Community* is for somebody who already belongs: the host's face and
voice first, then what's on.

**`plain` stays the default**, and is exactly the page that was there before,
so no published page changed the day this shipped. It is also the honest
choice for a workspace that wants a listing rather than a website.

The ingredients live on `thread_settings` — one row per workspace, which is
what the public renderer already loads. Deliberately NOT stored: pages.
Sjoerd named the future ("the drag and drop of the certificates for a very
chic design tool") and asked for a basic structure now. A theme is code; a
template will be a document; these columns are what both read from.

Privacy and terms come from the shared `FOOTER_LINKS` — the same two
documents the platform's emails point at. A workspace does not write its own
and should not: they describe what The Fibre does with the data, which does
not change because the page is wearing a festival poster.

**`POST /public/contact`** delivers the form to an address the visitor never
sees, which is most of why the form exists. Two brakes, because it is a public
endpoint that causes mail: a honeypot, and an hourly cap keyed on the
*recipient* workspace rather than the sender's IP — every visitor shares one
Vercel egress address, so an IP cap would have throttled the site and missed
the abuser. `contact` and `about` became reserved thread slugs; nothing in
production held either.

Also in this release: `apps/api/src/lib/public-site.ts` and the migration,
which v0.69.3 committed the callers of without the files themselves. Main was
red for that reason and is green again.

## [0.69.3] — 2026-09-11 — the contact card says who this person is

Sjoerd, looking at the contacts popup in The Thread: *"people may need a
little more info about this person.. e.g. organisations"*. The card held an
email address, a thread and a date — enough to confirm a row, not enough to
recognise a human.

**Organisations first**, because an employer identifies someone faster than
an email does. Current memberships only: a job somebody left is history, and
this card is for knowing who you are looking at. The organisation name now
also rides the list row, so recognising a person no longer costs a click.

Also on the card, and only when we hold them: phone, city and country, and a
LinkedIn link.

None of this is new data. The contact graph is platform-owned and The Thread
reads it natively as an in-family app — the same person row, not a copy, and
the same wall as always. Both new queries were run against production before
shipping, which is how the shape of an embedded select gets checked at all:
TypeScript never reads those strings.

If the organisation lookup fails, the contact list still renders without
employers. A card missing a line is useful; a page that 500s is not.

## [0.69.2] — 2026-09-11 — a home page about today

Sjoerd, on the Thread dashboard: *"every time I have to skip it because there
is nothing meaningful (yet??)"*. He was right, and had been for months. The
page greeted you by name and then explained what the product is for — to
somebody already inside it, standing on top of their own live data.

It now answers the four questions you actually open the app with, in the order
the day asks them: **what needs me** (applications waiting for approval,
invoices unpaid, threads still without dates), **what is on now** (today's
threads, each with how full the room is and a way straight to the door),
**what is next** (the soonest few, how far off, how many are coming), and
**what just happened** (the last handful of people who signed up).

Every section hides when empty, so a quiet Tuesday is a short page rather than
four empty boxes. The orientation copy did not die — it is what an *empty*
workspace sees, beside the template picker, which is the one moment somebody
genuinely does not know what lives here. The line that literally said
"Skeleton" is gone.

Today's rooms get their own per-thread query, because "4 of 12 checked in" has
to be exactly true when somebody is standing at a door. The workspace-wide
counts come from the 200 most recent enrolments and are deliberately kept to
things that link straight through to the page holding the full truth — a
prompt, not a ledger.

**`happeningToday` moved to `apps/thread/lib/thread-dates.ts`.** The check-in
door owned it, and stopped being the only surface that needs it. Two answers
to "is this today" in two files is how the two answers drift.

**The threads filter row: the owner chips became a dropdown.** Sjoerd:
*"maybe categories with a dropdown?"* One chip per team is fine at two teams
and wraps at five; the row was already six wide. Status stays chips — a closed
set of four that never grows. Owner and category are open lists, and an open
list in a row of chips is a layout with a deadline.

**Category became a real filter.** The workspace could define categories and
then not filter by them, which is a control that looks like it worked. The
options come off the thread rows themselves, so there is no extra request and
no dead option for a category nothing carries.

## [0.69.1] — 2026-09-11 — the API build gets the memory it was already using

v0.69.0 built clean locally and died on the Fly remote builder: *"Ineffective
mark-compacts near heap limit"* from `tsc`, twice in a row at the same point,
around 1.95GB. Not a flake — node was taking its default ceiling on a builder
with far more RAM to give, and the API finally grew past it.

`NODE_OPTIONS=--max-old-space-size=4096` on the build stage. Nothing about the
image or the running machine changes; only the compiler's allowance does.

## [0.69.0] — 2026-09-11 — the team decides which apps its people open

Sjoerd, adding more apps: *"I don't want all apps to be available to all
people in a workspace."* The first sketch was a new grouping concept. His was
better: **"the workspace admin can make teams... and the teams he/she makes
can also be used for access levels."**

No new concept, because the right one already existed. `team` stopped being a
Meet rota in May and became a platform primitive; it is workspace-scoped, it
has members, and `team_member.role` already distinguishes lead from member —
which is exactly the distinction an app grant needs. Nothing about
enforcement moves: `workspace_app` still says what a workspace runs and
`app_membership` still says what a person may open. This is an assignment
layer that writes the same rows an admin used to tick one at a time. The test
it passes is the ninth app: you edit one team, not one member after another.

**A team can now be internal.** `team.slug` is a public address, so a Finance
team made to let the bookkeeper into Pulse would otherwise also have stood up
a public page — a surprising side effect for an internal permission. Internal
teams have no public page, and the slug is claimed either way, so publishing
later cannot collide with anyone. That last part needed no work:
`public_root_slug` has claimed the segment globally since 2026-09-09.

**Grants apply immediately** to everyone already in the team. Going-forward-only
would leave two people in one team with different access and no visible
reason. The cost is that adding an app widens access for people added months
ago, so the screen says how many people that is before you save.

**Removing an app no longer guesses.** `app_membership.is_direct` records
whether an admin ticked a grant, so unticking it can tell the difference
between revoking and leaving alone what a team still owes. Every existing row
defaults to direct, which is precisely what it was.

**Workspace admins can manage team membership.** Those writes required a Meet
seat *and* being a lead of that specific team — correct for a rota, and
impossible for an admin putting a finance-only person into a group.

Editing team grants is **Pro** (`team_access_groups`). Resolution never is: a
workspace that drops below Pro keeps the access its people already have and
simply cannot change it. Revoking half a workspace because a card failed is
the wrong answer to a billing event.

`lib/team-grants.ts` is the single resolver, and `mergeGrants` inside it is
pure and covered by nine tests. Union, never intersection — nobody loses an
app by joining a team.

New: Fibre settings → Teams. The Members list now names the team an app comes
from, so "why does she have Pulse?" is answerable where the question occurs.

Design and the decisions behind it: `docs/teams-as-access-groups-proposal.md`.

**Not in this release, deliberately.** Sjoerd's wider rule — apps outside the
plan go read-only with history intact — does not exist today. Plan gates are
per-action and mostly guard switching an app on, so an app already running
keeps working after a downgrade. Doing it properly needs a writable-app
resolver, every write path consulting it, and a banner that explains why; done
badly it means data people cannot reach. It gets its own slice.

## [0.68.76] — 2026-09-11 — the RSVP waits for you to stop tapping (Portal 0.7.3)

Sjoerd, reading the cost v0.68.75 wrote down: *"could there be a delay before
it sends?"* — and it is the right fix rather than a mitigation.

A cycling control cannot be aimed. Someone who means "can't" from a blank
card passes **through** "coming" on the way. Sending on every tap made that a
real answer, briefly counted by an organiser who might be looking at the
moment it lands. The send now waits **800ms after the last tap**, so only
where the finger comes to rest is ever sent — the trip through the middle
state stops existing on the wire.

The screen still changes instantly. The delay is on the wire, not in the
feedback, which is the distinction that makes it free: the control feels
exactly as immediate as before. A deliberate double tap now costs one request
instead of two.

**A pending answer must not die with the component**, and that is the one
failure a delay can introduce. Closing the sheet or re-rendering the list
inside the window would drop it silently — the worst shape of bug here,
because the person watched the answer change and believes it is saved. So
unmount clears the timer **and sends**, without awaiting: the request outlives
the component.

**Reverting on failure goes back to what the SERVER holds**, tracked
separately from what is on screen. The previous on-screen value may itself
have been a state the tapping passed through and never sent, so restoring it
would invent an answer nobody gave.

The button is no longer disabled while in flight — there is nothing to wait
for, and a control that locks after a tap is what makes people tap it again.

**Verified:** typecheck clean, production build clean, 13 portal unit tests
pass. Not verified: the timing itself, which needs a session — the staging
fixture is the only place the control renders.

## [0.68.75] — 2026-09-11 — one card, three columns, one RSVP button (Portal 0.7.2)

Sjoerd, with a layout sketch: *"reduce it to one button, that toggles
between: ? / check / X (at the end of an engagement... total height of a
card... Date also total height of a card):*

```
| [date] | [Titel event / (smaller) time · organiser · QR icon] | [RSVP] |
```

Built as drawn. The card is now three columns with `items-stretch`, so the
date block and the RSVP button both run the **full height of the card**
instead of floating beside a two-line body — the row reads as one row rather
than a square, some text and a button. The ticket mark moved into the second
line with the other small facts, where it stops competing with the one
control that does something.

**The RSVP is one button that cycles**, in his order: no answer → coming →
can't → no answer. It shows the state it **is in**, never the state a tap
would produce; a control that displays its own next action is the classic
confusion, and here the state is the thing an organiser is counting.

**The cost is stated rather than hidden.** A cycle cannot be aimed. Someone
who means "can't" from a blank card taps twice and passes through "coming" on
the way, which is briefly a wrong answer sent to the server. That is
acceptable because the trip is one tap long and the third state exists to
undo it — but it is why `title` and `aria-label` both name the CURRENT state
*and* what the next tap does, and why the detail sheet keeps a words line
("Coming. Tap for can't come.") that the timeline card has no room for.
Without that line on a phone, where there is no hover, the cycle is
undiscoverable.

**`aria-pressed` is deliberately gone.** It describes a two-state toggle, and
announcing three states as two would hide the middle one from exactly the
people who cannot see the colour. Colour still only reinforces: the check,
the cross and the question mark carry the state.

Width dropped from two 44px squares to one; **height stayed**, as it has
since v0.68.38 caught this control at 34px after a round that believed it
was compliant. Small square, never short rectangle.

**Verified:** typecheck clean, production build clean, 13 portal unit tests
pass, signed-out render with no console errors. The control itself lives
behind a session — the staging fixture proves it, and it has not been run
against this change.

## [0.68.74] — 2026-09-11 — the RSVP is two small squares (Portal 0.7.1)

Sjoerd: "make the RSVP smaller — like more smaller icons. And maybe with
green/red once activated."

**The footprint shrinks; the tap target does not.** It was two buttons of
roughly 136×44 spanning the card and is now two 44×44 squares, about 96px of
total width including the gap. The height is deliberately unchanged: this
exact control was already caught at 34px high in v0.68.38, after a round that
believed it was compliant. It is used one-handed on a phone. Small square,
never short rectangle.

**Colour reinforces, the icon carries the state.** The check and the cross
stay. Red and green is the common colour-blind pair; "no answer" has to be
visibly different from both rather than merely paler; and dropping the words
leaves the shape as the only thing that means anything. Selected is a filled
emerald or red; unanswered is two plain outlines.

**Two things that survived the shrink on purpose.** The caption moved beside
the icons rather than being deleted for vertical space — with the words gone
it is the only thing telling anyone that tapping again withdraws, and the
third state is undiscoverable without it. And the `aria-label` now carries
the item, "Coming to Conversation 1" rather than "Coming", because it is the
control's only name now and a screen reader user does not get the row context
that proximity gives a sighted one.

Driven signed in against the staging fixture in all three states, measured
rather than eyeballed: both buttons are exactly 44×44, selected reads green
or red in pixels, and the fixture was returned to the answer it started with.

**A note on the instrument, since it cost three reads.** `getComputedStyle`
in the preview pane reported stale colours while the tab was not repainting —
class lists and a reload-forced screenshot were the signals that held. When a
rendered colour and a class list disagree, the class list is the code and the
computed value is the instrument.

## [0.68.73] — 2026-09-11 — the door lands on the list, not on an empty receipt

Sjoerd: "for desktop the list is probably more intuitive than the QR."

The check-in screen opened on "Just in", which is empty until you have
scanned somebody — so arriving there meant arriving at nothing, on any
device. It now opens on "Everyone today", and the first successful scan
switches to the receipt by itself, which is the moment that half starts being
the useful one. One default, right on a laptop where nobody is holding up a
camera and right on a phone where the list is what you need before the queue
starts.

Recorded rather than built, in the same pass: **online check-in**, which has
no door at all. The answer looks like it already exists — the visitor portal
renders a Join button carrying the meeting URL, and that is the click a
participant makes anyway. Routing it through a check-in stamp records
attendance with zero effort from either side. Build plan carries the shape,
the authorisation (a participant may legitimately check themselves in), and
the honest caveat: clicking Join proves somebody opened the room, not that
they stayed — which matters if a certificate follows completion.

## [0.68.72] — 2026-09-11 — two tabs under the scanner: what you just did, and everyone else

Sjoerd, after using yesterday's scanner at a real door — including trying it
from the wrong account first, which correctly refused: "only see the people
you just checked in, and have a second tab in the same screen with participant
list."

They are two tabs because they answer two questions. **Just in** is the
running receipt of this session: did that scan work, and who have I let
through? Newest first, no search, because you are reading the last few lines
at arm's length. It starts empty and does not survive a reload, which is
honest — it is what YOU just did, not a record. **Everyone today** is the
other question entirely: this person has no QR, are they on the list?
Searchable, with checked-in state, tappable to admit by hand.

**Scoped to today, for two reasons that agree.** It is the path where a human
picks a person by hand and could pick the wrong event, and everyone a
workspace has ever enrolled is not a door list. Each row carries its own
event, so admitting goes to the right one, and the event name only appears
when the door actually covers more than one.

**The door list was generalised, not copied.** `DoorRow` now carries its own
`threadId` instead of the list holding one for everybody, so the same
component serves a single event's door and a mixed one. Its scanner became
optional for the same reason — the workspace screen has one camera above the
tabs, not one per tab. The single-event door is unchanged in behaviour: it
passes its own id as the scan scope and still refuses a ticket for another
event, which is what a single door wants.

That is the second extraction in two releases on the same screen, and both
were forced by the same thing: this is the one surface where a quiet
divergence means a queue outside a building.

## [0.68.71] — 2026-09-10 — a scanner you can reach without choosing an event first

Sjoerd: "In the mobile version, maybe add the QR scanner at the bottom, and it
scans throughout any list of this organiser/workspace… below the scanner is a
button that says go to manual check-in, and then there is a list of only the
threads that happen today."

Until now the scanner lived INSIDE a thread: you had to know which door you
were standing at before you could scan for it. Check-in is now its own place,
third in the nav so it lands in the mobile tab bar rather than the More
sheet — it is the one screen used standing up, at a door, with one hand.

**Most of it already existed and nobody had noticed.** `checkin_code` carries
a unique index across every enrolment, and `GET /checkin/:code` has always
resolved it globally and then authorised with the same rule as
approve/decline — so a ticket for a thread you do not run was already a 403
rather than a leak. The only thing scoping the scanner to one thread was a
single client-side comparison. Removing it is the feature.

**Sjoerd's shape answers the one hazard a global scanner has.** It can admit
somebody to the wrong event; the per-thread one cannot. His manual fallback
is scoped to today, which puts the guard exactly where a human picks an event
by hand and could pick wrongly. The scan itself stays global and now names
the event in the verdict, since the API already returned the title.

**The scanner was extracted, not copied.** It was woven through the door
list — shared flash state and vibration, optimistic row ticks, camera
lifecycle, and a BarcodeDetector fallback whose comment records a real
Safari/desktop trap. That is the one screen in the product where a quiet fork
means a queue outside a building, so `components/ticket-scanner.tsx` is now
the only scanner and both doors use it. The seam is small and holds: the
component owns reading a code and showing a verdict, the caller owns what a
code MEANS. The door list's deliberate freeze — a thumb resting on a row must
not admit somebody mid-scan — survives as an explicit callback rather than
by accident.

## [0.68.70] — 2026-09-10 — quarters, and what still needs an answer (Portal 0.7.0)

Sjoerd, on the Next timeline: "you should be able to organise your timeline
(per quarter, only organiser x, thread… rsvp's)." Two of those four shipped
already — the organiser chips and the thread dropdown. These are the other
two, and they are not the same kind of thing as each other.

**Quarter is GROUPING, and it costs no control at all.** A heading appears
where the list crosses a boundary: nothing to tap, nothing to reset, nothing
added to the bar above a short list. It only appears when the list actually
spans more than one quarter, because a single header over everything labels
nothing. The label says `Oct–Dec 2026` rather than `Q4 2026` — a quarter is a
finance word and a member reads months.

**RSVP is the only one of the four that is a to-do rather than a view**, so
it is not a filter chip. When something is unanswered, a line appears saying
so and how many; tapping it narrows to those, tapping again shows everything.
A filter you have to think to use does not get used. A number that turns up
when it means something does. It counts within the current organiser and
thread scope, so the number and the list it filters to always describe the
same set, and "Earlier" never narrows this way — a past RSVP is not a
question still open, whatever the answer was.

Driven signed in against the staging fixture, using the product's own
controls rather than writing to the database: withdrawing the RSVP made the
line appear, tapping it filtered, tapping again cleared, and answering again
put the fixture back. Four more unit tests cover the quarter boundary and
what counts as unanswered — "can't" is a reply, not a silence.

## [0.68.69] — 2026-09-10 — preferred language is a picker, not an ISO code

Sjoerd, on the Edit contact dialog: "make the language a dropdown." It was a
text box with the hint "ISO 639 code, e.g. nl or en-GB", which asks a
question about a standard rather than about a person — and it sat directly
beside a country field that had been a searchable picker all along.

- **`@thefibre/shared/languages`** — all 183 ISO 639-1 languages with English
  names, the sibling of `countries.ts` and deliberately the same shape. Names
  were generated once from `Intl.DisplayNames` and frozen into the file, the
  same trade countries makes: no runtime dependency, and nothing that shifts
  when a platform ships different ICU data. `languageName()` degrades a region
  variant to its base, so a stored `en-GB` reads as English.
- **`LanguageCombobox`** in the web app, a twin of `CountryCombobox` down to
  the div-not-label wrapper, over the shared `SearchSelect`.

**Why the whole list and not the six locales we speak.** This field describes
a HUMAN, not a setting. It records that a contact would rather be written to
in Afrikaans, and it leaves in their Article 15 export as their own data.
Nothing reads it to pick an email language — that is
`identity_profile.locale`, a different field with a different job. Narrowing
it to what our interface happens to be translated into would discard true
things about real people.

**A value we cannot place is kept, not dropped.** The column is free text and
has been since it was a text box, so it may hold `EN` or `en-GB`. The stored
value is lowercased to match and, if it is still unknown, offered as its own
option. A dropdown that silently discards what somebody already typed would
be worse than the box it replaced.

The `iso_639_hint` string is deleted rather than reworded. The list explains
itself.

Driven signed in on staging, all the way through: the picker opens inside the
dialog, searching "afri" finds Afrikaans, choosing it sets the hidden input
to `af`, saving persists `af` to the person row. The fixture was put back to
null afterwards.

## [0.68.68] — 2026-09-10 — pick a thread on the timeline (Portal 0.6.0)

Sjoerd, looking at his own live Next tab: "maybe also add a dropdown above
the timeline, with the threads you are part of (as a selector)."

**The two filters are hierarchical, not independent.** The thread list is
always drawn from what the organiser chips already allow, and changing the
organiser resets the thread. That removes the state nobody wants to define —
one community selected and somebody else's thread chosen — rather than
handling it. It is `@thefibre/shared/ui/search-select`, the same dropdown the
product dialog picks threads with, not a fifth hand-rolled one.

It appears only when the current scope holds more than one thread. A selector
with a single meaningful setting is furniture, which is the same rule the
organiser chips already follow.

**Choosing a thread hides meets, deliberately.** A meet booking belongs to no
thread, and "show me this thread" is not "show me this thread and also my
coaching call". Getting back is one tap on All threads, and the empty state
names the thread rather than saying nothing is coming up, which would be
false about everything else.

No API change: `groups[].threads[]` already carries the titles, so this is a
client-side predicate like the organiser filter.

Driven signed in against the staging fixture, which holds one thread — so the
control was forced to render locally to prove it mounts, opens, filters and
clears. The case it is actually for, several threads across two organisers,
exists only on Sjoerd's own production account.

## [0.68.67] — 2026-09-10 — a thread's intention can be written, and rich text is sanitised

Sjoerd, on the intention field: "Can this field have a style thing (B, I,
Headers, link, etc.)". Yes — and the editor already existed, used for an
engagement's body since the rebuild. The intention now uses it, and the
toolbar gains a heading button that toggles back to a paragraph rather than
being a one-way door.

**The change that is not visible is the one worth reading.** Those rich-text
fields are written by an organiser and rendered with
`dangerouslySetInnerHTML` on a public page and in emails — and nothing
sanitised them. That is a stored-XSS path: not from a stranger, but from
anyone a workspace makes an organiser, aimed at that workspace's own
visitors. It predates this release; what it did not have was a sanitiser.

`lib/rich-text.ts` now cleans on the way IN — an allowlist of what the
toolbar can produce plus what a paste from a document carries, with DOMPurify
(already a dependency, already used for SVG uploads) doing the work rather
than a hand-rolled regex. On the way in rather than out, because out is four
surfaces and counting and only one of them has to forget. Applied to the
intention AND to engagement descriptions, which had the same exposure. Nine
tests: what must survive, and what must never.

**Six render sites, and getting this half wrong is how you ship raw tags.**
A field that becomes HTML breaks every place that printed it as text. Full
renderings — the thread page, the full thread embed, the owner page's single
thread — render HTML. Clamped previews — listing cards, the list embed, the
card embed, the participant portal — get `richTextPreview()`, which flattens
to a sentence, because two clipped lines of block tags fight the clamp and an
unclosed fragment leaks styling into the card.

**Everything written before today is plain text and renders unchanged.** The
sanitiser passes it through, and `whitespace-pre-line` stays on the full
renderings, so the paragraph breaks fixed four releases ago still work
alongside the new markup.

**Renumbered from 0.68.66 mid-flight**: the membership session released that
number while this was being prepared, with `RichText` — a SHARED renderer for
organiser rich text, built for the same reason on the portal side. Rebased
onto it, and the three full renderings here now use it rather than the class
lists this change had hand-rolled. Two sessions solving one problem in one
hour, caught by the release guard rather than by review.

Its trust comment said sanitising was something to do "if that ever changes".
It changed in this release, so the note is corrected — otherwise the next
reader concludes nothing guards it.

## [0.68.66] — 2026-09-10 — the portal shows a description, not its markup (Portal 0.5.1)

Sjoerd opened his own thread in the portal and the agenda showed
`<div>Een intensieve start…</div>`, tags and all. The engagement
descriptions come out of the editor as HTML; the public thread page has
always rendered them as HTML, and the portal rendered the same field as
plain characters. One field, two surfaces, two answers.

- **`@thefibre/shared/ui/rich-text`** — born shared rather than fixed twice.
  The class list is lifted verbatim from the public page, which is the
  design-leading copy: lists keep their markers, links stay underlined. The
  caller supplies spacing and size, so a bottom sheet and a public page can
  differ in scale without differing in what a bullet looks like. The trust
  boundary is written into the file: this is organiser-authored HTML from our
  own editor, never visitor input, and if that ever changes it gets sanitised
  at the API boundary where `isomorphic-dompurify` already lives.
  Thread's `thread-view.tsx` still has its own copy and is another session's
  lane; the component is there for it and it is one import.
- **An undated agenda item now holds the date column open.** Not everything
  is scheduled — a reflection is something you do when you get to it — and
  rendering nothing there collapsed the row to the left edge, so an undated
  item read as a HEADING for the dated one below it. On the thread that found
  this, a reflection and a conversation share a title, so it looked like one
  session printed twice. A dashed outline says "no date" without claiming one
  is coming, which for a reflection would be false.

## [0.68.65] — 2026-09-10 — an Appearance tab, and the switch that was overriding you

Sjoerd asked for this yesterday and deferred it — "that's for later" — after
losing half an hour to the thing it exists to prevent. soul.com's Community
Member Year Agenda had five conversations, all published, all with "Show on
the public agenda" ticked, and none of them appeared on the page. Two
thread-level switches were off, and neither was anywhere near the item he was
looking at.

**The public face of a thread now lives on one tab**, in the order somebody
actually asks the questions: is it visible at all, what does it look like,
what does it contain, how does it open. So `List publicly`, the thread image,
`Show the agenda` and the page-or-popup choice move out of the general
settings list, where they were mixed in with dates, language and timezone —
facts about the thread rather than decisions about its appearance. The image
came too: it is branding, and Sjoerd named it as belonging here.

**The trap is now named twice, on purpose.** `public_agenda` is a third
switch that sits in neither half of the two-switch model and silently
overrides the per-item one. Turning it off is legitimate — some threads have
no business publishing a schedule — so it stays. What changes is that it
stops being silent. The tab warns the moment you turn it off, and the ITEM
dialog warns too, because whoever ticks "Show on the public agenda" is
looking at an item, not at settings, and that is where the half hour went.

**One thing worth checking if you review this**: moving a field between tabs
is not just moving markup. Both forms send a full patch, and `fd.get()` on a
checkbox that is no longer rendered returns null, which reads as false. Left
half-done, every save of the Basics tab would have quietly switched off the
things that had moved. The keys left the Basics patch in the same change as
the controls, and the image picker went with them rather than staying behind
as a control that no longer saves anything.

Deliberately NOT done: deleting `public_agenda` and letting the section
appear whenever an item asks for it — the other way out recorded in the build
plan, and what was done to RSVP the same evening. That removes a capability
rather than surfacing it, and this is the smaller move.

## [0.68.64] — 2026-09-10 — three corrections from a review of what a membership includes

The my.thread session read the `includes` resolution against the code it
claims to mirror and found three things. Its central check came back clean:
`applyEntitlements` and the portal use the same two filters, so "the same
fact shown to the person rather than executed against a tool" is literally
true and cannot silently drift without someone editing one of those lines.

- **One destination per included thing, chosen by KIND, not by the order the
  links were typed in.** The product dialog appends and deletes links with no
  way to reorder, so first-wins made the answer an editing artefact: a
  product carrying both a `thread` and a `url` pointed two different places
  depending on which was added first. A `thread` wins now, because it is the
  one we RESOLVED — looked up in the member's own workspace and confirmed to
  exist — where a url is whatever was pasted, checked only for a scheme.
- **The optional-product exclusion has a better reason than the one written
  down.** It was "an optional product is on the join form, not in the
  membership". The real reason is that `applyEntitlements` filters
  `optional = false` too, so listing them would promise a member something
  the system does not grant them. Listing what is not granted is worse than
  listing nothing.
- **The purchase query now carries the workspace filter** `applyEntitlements`
  has, rather than leaving it to the grouping downstream. Equivalent for sane
  data — but "the same pair of queries" is the property the whole block leans
  on, and that is only true while the filters match.

Also in `docs/system-handbook.md` §10: **a PostgREST select is a string and
the type-checker never reads it**, filed beside the action/route seam as the
same species of gate-shaped hole. Two bad column names in one session, both
typecheck-clean, one of them latent. A minute of curl against real rows
before shipping is the whole defence.

## [0.68.63] — 2026-09-10 — a member can correct their own name (Portal 0.5.0)

Slice 5 of `docs/member-portal-plan.md`, and the end of the read-only
portal. The YOU tab showed a name with no way to fix it, which is the wrong
answer to "my name is spelled wrong on my invoice" — a question that today
becomes an email to an organiser, and stopping exactly that is what this
surface is for.

`GET` and `PATCH /api/v1/me/profile`. Two things are editable and each lives
somewhere different:

- **A name writes every `person` row carrying the verified email.** `person`
  is per workspace, so somebody in three communities has three rows, and a
  name corrected in one and not the others is a worse state than not offering
  the edit at all. All of them, or none. The form says how many communities
  the change reaches before it is pressed, because that is a fact a person is
  entitled to in advance rather than after.
- **A language writes `identity_profile.locale`**, keyed by email, which is
  already what the email templates and the app chrome read. One identity, one
  preference, everywhere.

**The email is shown and locked.** It is the key this entire surface is
scoped by; changing it here would not move somebody's tickets, it would
orphan them. Nor is anything an app collected ABOUT a person editable: that
is curator data, it exists because a specific app justified it, and it is not
the person's to rewrite from here.

A member editing organiser-visible rows is correct rather than alarming, and
the reason is worth writing down: a name is identity, not curator data, and
GDPR Article 16 is a right to RECTIFY inaccurate personal data.
`ui/profile-form` was the shared candidate and is the wrong one — it is the
ORGANISER's profile, with display name, bio, photo and timezone, none of
which a member has.

**Also: the venue is a link here too.** v0.68.62 published `location_url` on
the public thread page after finding it had been stored on engagements all
along and shown nowhere. The portal renders the same venue and had the same
gap; it does not now.

**Two bugs caught by driving it, neither of which any gate could see.**
`person` has no `updated_at` column — the profile read ordered by it and
would have 400'd for every member on the first load; found by running the
select against production rows before shipping, which is now the habit,
because a PostgREST select is a string and the type-checker never reads it.
And a successful save left the form still marked unsaved, with the button lit
and no confirmation, because `dirty` compared against the server-rendered
prop, which a client component never sees change. It compares against what
was last committed now.

## [0.68.62] — 2026-09-10 — the venue is a link, and the paragraphs are paragraphs

Two from Sjoerd on a live public thread page: "geen mooie opmaak met enters
etc." and "praktische info over venue / Maps link".

**The map link was stored and never published.** `thread_engagement
.location_url` has existed since the schema did, the editor writes it, and
four published agenda items in production carry one right now — pointing at
Google Maps, entered by an organiser who reasonably assumed it would be
usable. The public agenda's select simply never asked for the column, so the
page could only ever render the venue as dead text. One column added to the
select; the payload spread publishes it; the page renders the venue as a link
when there is one and plain text when there is not.

Verified against production rows before shipping rather than after, which is
the habit the membership session was demonstrating an hour earlier when it
caught a select naming a column that does not exist — clean typecheck, latent
400 in production, found only by running the query against real data.

**The paragraph breaks were being eaten.** A thread's intention is a plain
textarea; the public page rendered it in a bare `<p>`, where HTML collapses
every newline into a space. An organiser's carefully broken invitation
arrived as one wall of text. `whitespace-pre-line` on the two places that
render it in full — the thread page and the owner page's single-thread
hero — and deliberately NOT on the clamped preview card, where a two-line
clamp plus hard breaks wastes the preview on white space.

Not a bug, recorded because it looked like one: the missing photo on that
page is a thread with no cover image set. The record has `cover_url: null`
and the page is rendering exactly what it has.

## [0.68.61] — 2026-09-10 — a member can see what they bought and what they belong to (Portal 0.4.0)

Slices 3 and 4 of `docs/member-portal-plan.md`.

**`GET /api/v1/me/invoices` — every invoice, across every app.** Sjoerd:
"invoices please — it was there in version 1." They were, per membership.
`/membership/portal/me/invoices?member_id=…` answers for ONE membership and
nothing else, so a thread ticket and a meet booking — same ledger, same
person — had no member-facing route at all, and the Purchases tab showed a
partial list as if it were a complete one. Now it is one email-scoped list,
newest first, with `GET /me/invoices/:id/pdf` for any app. Both prove
ownership on the two ledger keys (`person_id` OR `payer_email`, either alone
drops rows) and both resolve the seller through `sellerForSale`, so a
membership invoice names the community and a thread invoice names the person.

**A membership now says what it includes.** Sjoerd: "click and then what it
contains, with links to what is included." The payload's `includes` merges
two sources, and both are the member's by different routes: the non-optional
products of their tier, held for as long as they are a member, and the
products they bought outright, kept through a tier change or a lapse. That is
the same pair `applyEntitlements` resolves access grants from — the same fact,
shown to the person instead of executed against a tool. Optional products
stay out: an optional product is on the join form, not in the membership,
until it is bought.

- **A `thread` link stores a ref, not a URL**, and was therefore unshowable.
  It resolves now — scoped to (workspace, slug), because a thread slug is
  unique per organiser and never globally, and resolving by slug alone would
  hand someone another community's thread.
- **A link we cannot resolve is NAMED without a link**, not hidden. A Circle
  space needs per-workspace knowledge this route does not have. The member is
  entitled to know what they are paying for; a dead link would be worth less
  than nothing.
- **Manage payment came with it**, opening the Stripe Billing Portal on the
  community's connected account. It is the control the plan says must not be
  lost when `membership.thethread.app/my` retires into this surface — it
  exists here first, and the redirect comes after. Members without a Stripe
  subscription get a sentence rather than a button that would only 409.

The portal's PDF proxy now sends `fibre-platform` rather than `membership`,
because the invoice can belong to any app's ledger and `/api/v1/me/*` is the
platform composing the data subject's own data.

**What is NOT verified.** The staging fixture holds no membership and no
invoice, and seeding one is still waiting on Sjoerd. Both tabs have been
driven signed in only in their EMPTY state. Everything that depends on a
membership existing — the includes list, the resolved thread link, Manage
payment, the invoice rows — is typechecked and reasoned, not seen.

## [0.68.60] — 2026-09-10 — the settings hub stops sending you to a sign-in form

Sjoerd, looking at Settings inside The Thread: "Workspace links to a Fibre
login page… doesn't seem right."

It wasn't. Every card marked "in The Fibre" — Workspace, Members, Apps, Plan,
Currencies, Profile, About, Privacy — built its link as `${fibreUrl}${path}`,
a bare cross-apex URL. The delivery apps live on `thethread.app` and Fibre on
`thefibre.app`, and no cookie spans two registrable domains, so a signed-in
person clicking Workspace landed on a sign-in form. Eight cards, five apps,
every one of them.

**The machinery for this already existed and was already in use.** `sso-hop.ts`
does a silent handoff: a one-time 60-second code, redeemed server-to-server
for a Supabase magic-link hash, minting an independent session on the target
apex. Membership's and Pulse's own layouts already route their profile link
through it. `platformSettings` simply never called it.

So it does now. `fibreUrl` is gone from the signature rather than kept as a
fallback, because a fallback here is a link that silently fails; the function
takes the calling app and `process.env` and asks `crossAppHref`, which
returns a plain URL when the apexes already match — so Fibre's own settings
page and every local dev setup are byte-identical to before. Six callers
updated, two dead `appUrl` locals removed.

This is the same shape as the copied-rule problems of the last two days, with
the polarity reversed: not a fact duplicated until copies disagreed, but a
helper that existed, was correct, and had one caller who never heard of it.
Nothing failed loudly in either case.

## [0.68.59] — 2026-09-10 — Next is a timeline, not a list of organisers (Portal 0.3.0)

Sjoerd: "the overview page is ugly… maybe a list, organised per date… a
timeline… with the event you're joining per date… and then a selector per
organiser." Slice 2 of `docs/member-portal-plan.md`.

The page's skeleton used to be the ORGANISER, with dates scattered inside
each card. That answers "what does soul.com hold for me", which is a question
nobody asks. **Time is the spine now and the organiser is a filter**, which
only appears when there is more than one — a control with a single meaningful
setting is furniture.

- **A thread with dated sessions contributes its SESSIONS, not itself.** A
  session is what you attend; a thread is the container, and a container has
  no place in a list of things that happen. A thread with nothing scheduled
  still appears, on its own start date.
- **Date chip, title, time and organiser, and at most one action.** The RSVP
  segmented control moved onto the card, which is what "a toggle for coming
  or not coming, in the overview" asked for. Join appears only from fifteen
  minutes before until it ends — a Join button three months early is clutter
  pretending to be an action.
- **Past is behind one "Earlier" toggle**, newest first, because you look
  backwards from now.
- Tapping a card opens the same sheet as before — QR, agenda, RSVP, calendar.
  `ThreadDetail` became `ThreadSheet`: it used to own its own card and its own
  open state, and now the list owns both, because one card can be a session
  inside a thread rather than the thread itself.

**The two kinds of date needed one deliberate rule.** Some entries carry a
day and some a clock, and mixing them without a rule sorts the same list
differently on different days. An all-day entry sorts at the START of its day
and stays until the day is over; a timed one stays for two hours after it
starts, so something happening RIGHT NOW is the top of the list rather than
gone from it.

Flattening happens in the page, not the API — the plan's open decision,
decided. Everything is already fetched in one call and one member has few
entries.

**apps/my has unit tests now** (9, and a `test` script `pnpm -r test` picks
up). They cover exactly what the staging fixture cannot: it holds one
upcoming session for one organiser, so the past toggle and the organiser
filter never render there and the mixed-date rule never fires. Driven signed
in at 375px for the parts it can prove.

## [0.68.58] — 2026-09-10 — completing somebody stops issuing their certificate

Sjoerd asked for the participant list inside a thread's Certificate tab —
search at the top, everyone ticked, untick the ones who should not get one —
"this way the facilitators can select who gets the certificate and who
doesn't."

**That list already existed**, on Enrolments, filtered per thread, with a
search, select-all and Issue certificates. It was simply unreachable from the
screen where you set certificates up. So the Certificate tab links to it
rather than growing a second copy. Two lists doing one job is the fork the
components-first rule exists to stop, and this one would have been ours.

**The real change is behind it.** Completing somebody used to issue their
certificate automatically, which meant "who gets one" was decided entirely by
"who did you mark complete" — and a facilitator who wanted to complete
someone and withhold the certificate had no move at all. Sjoerd's call:
the list becomes the decision. Completion now means completion. Issuing is an
explicit act with two doors, the participant list and the dated timeline
element.

It also removes a silent failure: the old auto-issue wrote one warning line
to stderr when it failed and nothing retried, so a completed person could
receive nothing and nobody would know.

**One consequence is recorded rather than fixed, and it is a real gap.**
Unticking somebody means "not in this batch" — nothing persists it — so a
dated certificate element firing later issues to them anyway. The element's
own hint says so on screen, the comment on `issueDueCertificates` says so,
and build-plan 0c has the shape of the fix. It needs a per-enrolment
exclusion, and the hard part is the interaction rather than the column: a
tick list is transient, and making one of its states permanent has to look
permanent.

**The v0.68.46 entry is now wrong about its own feature.** It called the
timeline element a backstop that "correctly issues to nobody" on a healthy
thread. That was true for a day. With auto-issue gone it is a main path, and
the code comment says which world an old note is describing.

Measured before changing: 2 certificates ever issued, 4 completed enrolments,
1 certificate element in existence.

## [0.68.57] — 2026-09-10 — the portal has four places, not one long page (Portal 0.2.0)

Sjoerd: "why are there two my. environments. As a user, I want 1 environment
for everything." Slice 1 of `docs/member-portal-plan.md` — the shell that
the other two member pages will eventually retire into.

**Four destinations: Next, Memberships, Purchases, You.** Seven things is a
menu; four is a page you can hold in your head. `@thefibre/shared/ui/bottom-nav`
below `md` — four items is exactly its no-"More"-sheet case, which is one
reason to stop at four — and a left rail above it.

The rail is the one deliberate fork in the family. `ui/sidebar-shell` is
organiser chrome: brand tile, workspace switcher, collapse preference, Help.
A member has one identity, one list and no preferences, so all of that would
be dead furniture. It is a fork of nothing, because slice 6 retires the other
two member pages INTO this one rather than alongside it.

**All four are real on day one.** The plan said "existing content moves into
NEXT unchanged", which would have left three placeholders; instead the
content that already existed was split to where it belongs. Memberships and
invoices came out of the per-community cards and became their own tabs, and
Next keeps what has a date.

- **Next** — tickets, threads and meets, still grouped by organiser. Slice 2
  turns this into one flat date-ordered timeline; it is not that yet.
- **Memberships** — community, tier, state, renewal, member since. What a
  membership *unlocks* is slice 4 and the page does not pretend otherwise.
- **Purchases** — one list, newest first, with the PDF. **Membership
  invoices only**, and it says so: thread and meet purchases are in the same
  ledger with no member-facing endpoint yet.
- **You** — name, email, sign out, version. Editing is not possible yet and
  the page says that too, rather than showing fields that do not save.

Signed out, the chrome disappears entirely: four tabs leading to four copies
of one sign-in form is noise.

Driven signed in at 375px against the staging fixture, including sign-out and
signing back in. The plan now records how to get a session as that fixture —
`localhost:3007` is not in staging Supabase's redirect allowlist, so the
magic link is useless locally and the eight-digit code is the way in.

**Correction, same morning:** an earlier draft of this entry said the
`thefibre-my` Vercel project did not exist. It has existed since v0.68.24 and
`my.thethread.app` answers 200 — the claim came from a stale line in
`docs/my-portal-setup.md`, believed rather than measured. What is still open
there is staging: `my.thefibre.tech` redirects to Vercel's own SSO, because
that project carries Standard Protection where the six product apps carry
none.

## [0.68.56] — 2026-09-10 — a membership is sold by the community, not by a person

The first live membership invoice on soul.com was issued in the name of
**Solidarity Lab B.V**, at a private address in Zierikzee, with no VAT
number on it — while charging 21% VAT. soul.com's own entity, One Soul
Community Cooperative U.A. in Rotterdam, VAT NL813651141B01, sat unused in
the workspace's invoice details. That is the wrong legal entity on a tax
document, and it was live.

The cause is that `identity_billing` is keyed by **email**, so an
organiser's personal invoicing identity follows them into every workspace
they work in, and `sellerDetailsFor` prefers personal over workspace. That
preference is right for Thread and Meet — a freelance facilitator selling a
workshop genuinely does sell in their own name, and their workspace may
have no legal entity at all. It is wrong for a membership, which the
community sells.

- **`sellerForSale(appSlug, workspaceId, organiserUserId)`** in
  `routes/purchases.ts` is now the one place that answers "who is this
  invoice from". Membership resolves the workspace and ignores the
  organiser; every other app keeps personal-first.
- Every seller resolution goes through it: both PDF routes (the ledger's
  and the member portal's), both payment-link emails, and `sendReceipt`,
  which reads the app off the ledger row itself — `app.slug` when the row
  carries the join, else a lookup by `app_id`. A row with neither degrades
  to personal-first, which is what Thread and Meet want anyway, so a
  forgotten call site can never produce a wrong entity on a Thread invoice.
- The five membership receipt queries now select `app_id` deliberately, for
  that reason.

`organiser_user_id` stays on the row and still means what it meant: who to
contact about the sale, and what the Invoices page's "Me" scope keys on. It
just no longer decides the seller for a membership.

## [0.68.55] — 2026-09-09 — a member can sign out (Members 0.14.7)

Sjoerd: "logout (not possible now)". He was right, and it was true of all
three member-facing pages in the family — none of them had one.

- **`@thefibre/shared/ui/sign-out`**, born shared because there are three
  callers waiting. The organiser apps already have sign-out inside
  `ui/user-menu`, but that is the avatar menu with theme, sidebar and
  workspace switching — none of which a member has. What a member has is a
  page that knows their email and no way to leave it.
- The app-bound half is injected, the same rule `user-menu` follows: each
  app owns its Supabase browser client and decides where to land.
- Wired into Membership's `/my`, beside the email address, because that is
  the line answering "who am I signed in as" — the question sign-out
  follows from. Signing out returns to `/my`, which shows the sign-in form
  rather than a blank page.

The other two member pages, `my.thethread.app` and Thread's `/my`, are other
sessions' lanes; the component is there for them and it is one import.

## [0.68.54] — 2026-09-09 — the portal shows your invoices

Sjoerd, two words: *"add invoices"*. Earlier, looking for them: *"can't find
them now"* — and he was right to look and right not to find them. They were
never on this surface. `grep -rn invoice apps/my` returned nothing, and the
portal's membership payload carried tier, status and renewal date and nothing
else.

**No new API, no migration.** Membership's own `/my` has had them since
v0.68.25 and both endpoints are deployed and verified:
`GET /membership/portal/me/invoices?member_id=…` and `…/:id/pdf`. Both are
email-scoped — the same auth shape the portal already holds a token for — and
the PDF proves ownership on `person_id` OR `payer_email`, both keys, because
either alone drops rows. `member_id` was already in the portal payload, so
the cheapest correct thing was to call the endpoint rather than widen
`/me/portal`.

- **One call per membership, in parallel, server-side.** A failure yields an
  empty list for THAT membership rather than failing the page: three
  memberships and one bad workspace should still show the other two.
- **The PDF goes through the portal's own route**, `/invoices/:id/pdf`, built
  from the shared `createInvoicePdfRoute` factory — the third caller, not a
  third copy. It exists because a plain `<a>` cannot carry an Authorization
  header and hard rule §13 keeps nothing on Vercel: the route reads the
  session server-side and streams the API's bytes through. Its `appId` is
  `membership`, not the portal, because that identifies whose LEDGER the
  invoice belongs to — the portal is a SURFACE with no AppId by design, and
  it is only the door.
- **The empty state says so out loud** — "Nothing invoiced yet." An empty
  list and a missing feature look identical when both render nothing, which
  is exactly the confusion this release is fixing.

**What he will actually see, and it is worth saying:** production holds ZERO
invoices. Every ledger row in the database is the one €1 soul.com row, still
`pending`, and it belongs to his test member rather than to him. So a correct
build shows him an empty state. That is the list being right and the data not
being there yet — which is the Stripe Connect webhook still standing between
soul.com and money.

Not in the detail popup, deliberately: an invoice is not about a thread, and
that popup is already the densest thing on the surface.

**Verified:** typecheck clean, production build clean with `/invoices/[id]/pdf`
registered. Everything else lives behind a session, so the staging fixture is
the real check — and it has no invoices either, so what it can prove is the
empty state and that nothing else broke.

## [0.68.53] — 2026-09-09 — the shared Dialog says it assumes it is the only layer

Comment only, no behaviour. The fix it explains shipped in 0.68.52; this is
the thing that would have prevented the hour it cost.

`Dialog` listens for Escape on `document` in the BUBBLE phase, and listeners
on the same node fire in registration order. It opens first, so it registers
first, so it wins — and a later bubble listener cannot get in front of it
however much it calls `stopPropagation`. Six apps use this Dialog and the
assumption is invisible until someone stacks something on top of it.

The symptom points away from the cause, which is why it is written down:
Escape with an overlay open closed the dialog UNDERNEATH and left the
overlay stranded with its parent gone. A layer above must listen in the
CAPTURE phase on the same node and call `stopImmediatePropagation`. The
comment names `apps/my/app/detail.tsx` as the worked example.

## [0.68.52] — 2026-09-09 — Escape closes the layer you are looking at

Round five on the staging fixture, signed in at 375×812. One real bug, and
the tap-to-enlarge overlay added in v0.68.51 is where it lives.

Open the popup, tap the QR to enlarge, press Escape once: it closed the
**dialog underneath** and left the full-screen QR floating over the thread
list with its parent gone. Not a trap — the overlay's own caption says to tap
it — but the topmost layer was failing to consume the key while the layer
beneath it consumed it happily, and every other dialog in the family closes
on Escape, so the muscle memory pointed exactly the wrong way.

**Why it happened, since it will happen again to the next person who stacks
two layers:** the shared `Dialog` listens on `document` in the bubble phase,
and it registered first because it opened first. A second bubble listener
cannot get in front of it. The overlay now listens in the **capture** phase
on the same node — which runs before every bubble listener there — and calls
`stopImmediatePropagation`, so the key never reaches the Dialog. Only while
zoomed; the Dialog keeps its own Escape the rest of the time.

**The ticket-block gamble is vindicated by the measurement that justified
it.** v0.68.51 laid the QR sideways on the argument that the agenda started
below the fold on a phone. Measured after: first agenda row top at 576px in
an 812px viewport — above the fold with 236px to spare, where before it was
below it from the first item. The agreement was that the measurement decides
and the block goes back if it fails; it passed, so it stays.

**Everything else passed**, and it is on the record rather than assumed: all
three RSVP states including withdraw, with `aria-pressed` tracking; tap
targets (Coming 136×44, Can't 135×44, calendar 44×44, QR 112×112, full page
145×44 — only the shared Dialog's 18×18 close remains, known and owned
elsewhere); the QR overlay opening 112→320; the `.ics` and the full-page link
both absolute and resolving; **no cross-participant leak**, tested with two
real sessions on the same agenda item rather than one and an assumption; and
the caption agreeing with the API in both directions.

**Two false alarms the verifying session caught in itself first**, worth
recording as the sixth instance of tonight's recurring failure: a 1.6s wait
for the round trip was too short, and a straight apostrophe was matched
against a curly one. Both briefly read as "withdraw is broken". Both were the
measurement, not the code.

**The fixture grew two capabilities** and they are permanent: the agenda
item's `rsvp_enabled` was null (which since v0.68.43 means off, so the
control did not render at all on first load) and is now true, and
`portal-silent@thefibre.tech` has a real auth user, so the fixture exercises
RSVP-on and two participants rather than one participant and an assumption.

## [0.68.51] — 2026-09-09 — the portal's popup stops shouting all at once

Sjoerd, on his own membership: *"improve the interface drastically... more
clear overview... simple icons... a toggle for coming or not coming... or
dropdown for RSVP."* The complaint underneath it was measurable — each agenda
row carried four controls of equal weight and the eye had nothing to land on.
Design worked out with the membership session, which had the screenshot and
the measurements.

- **A date chip, day over month, on the left of each row.** The date had been
  right-aligned in small grey text, which is where you put something you do
  not want read. An agenda is scanned by date. The time moves into the
  subtitle beside the location.
- **Join and Add to calendar are icons**, 44×44, with `aria-label` and
  `title`. Both are already icon-labelled in every calendar app anyone uses;
  dropping the visible word is a visual decision, not an accessibility one.
- **RSVP is ONE segmented control over THREE states.** He asked for a toggle
  or a dropdown; both are two-state shapes and the answer is three — coming,
  can't, and **no answer**. A toggle would have to render "no answer" as off,
  which is exactly the collapse v0.68.30 was careful to avoid: an organiser
  chasing eight silences is doing something different from one reading eight
  refusals. So neither segment is filled until you answer, tapping the filled
  one withdraws, and the caption says which state you are in. Segmented
  rather than a select because this is used on a phone at a door, where a
  44px target beats a native picker. **Taken as the three-state reading of
  his words rather than asked twice** — he has had the argument from the
  other session and can overrule it in a word.

**The ticket block is laid sideways, not redesigned.** The QR, the wording
and the wallet actions are unchanged in substance. But the fifth verification
round measured it filling about half the viewport at 375px, which put the
agenda below the fold **from the first item** — and on a bottom sheet the
only budget is vertical. Stacked, that was unfixable without touching it. Now
the QR sits at 96px on the left with the caption and wallet icons beside it,
and **tapping it opens it full size on white** — the same treatment
`ticket.tsx` already gives an orphan ticket, for the same reason: held at
arm's length, half-turned, sometimes in sun. Full size is one tap away, which
is the right cost for the size that actually matters at a door.

**Verified here, thinly and on purpose:** typecheck clean, production build
clean, signed-out page renders with no console errors. Everything changed
lives inside a dialog that only exists behind a session, so the real check is
the staging fixture — round five is requested, with the withdraw path and the
above-the-fold claim named as the two least trusted.

## [0.68.50] — 2026-09-09 — the join page from the home screen (Members 0.14.6)

Sjoerd: "on the home of members — a link to the membership page."

The public join page's address has lived in one place, Settings → Join page,
which is the one screen you do not open when you simply want to look at the
page or send someone the link. It is now on the Members home, top right,
opening in a new tab.

Built from `appUrl('membership', …)` and the workspace slug, the same
composition Settings uses, so staging produces the staging host. A failed
`/auth/me` hides the link rather than rendering a half-formed URL with a
placeholder slug in it.

## [0.68.49] — 2026-09-09 — a thread grant picks its thread (Members 0.14.5)

Sjoerd, looking at a product's Access row: "how do I set that someone will
enrol in a thread? And slug select". The answer to the first is that this IS
the control — a `thread` grant is what enrols a member and withdraws them on
lapse (v0.68.31). The second was a free-text field.

- **The Access row picks a thread**, in both places that offer one: the
  product dialog and the standalone grant dialog. Same `SearchSelect` and
  the same option shape the LINKS row has used since 2026-09-05 — that row
  got a picker then and Access was left typing.
- **Why it matters more here than for a link.** A mistyped link is a dead
  link, visible immediately. A mistyped grant saves fine, the member joins
  fine, and the worker stamps `no thread "<slug>" in this workspace` into a
  journal nobody is watching. The failure is late, silent, and lands on the
  member rather than the organiser.
- An existing value that is not in the list is kept as its own option, so
  grants holding a full public URL (soul.com has one) still show and still
  work — the worker's parser already takes the last path segment.
- The access page now makes the same cross-app thread read the products page
  makes, on the user's own RLS identity, falling back to the text field if it
  fails. A 403 costs nothing.

## [0.68.48] — 2026-09-09 — a drag that never ended, and a status that lied

Sjoerd, twice: "once I am in the certificate editor, I can't leave", and
after the first fix and a reload, "now it does not work anymore… I try to go
to threads, nothing happens."

**My first diagnosis was wrong and the second explains what the first could
not.** v0.68.44 moved the autosave off the server-action path, which was a
real problem and not his. The evidence that settled it: hover still
highlights the sidebar, clicks do nothing, a fresh page load is fine, and it
only breaks once you have edited something.

That is a stuck drag. If a mouseup is missed — released outside the window,
over the browser chrome, lost to a context menu — `draggingRef` stays set,
and from then on every mouse movement anywhere re-renders the whole element
list. Moving the pointer toward the sidebar fires hundreds of renders. The
hover highlight survives because it is pure CSS; the click lands on a main
thread with no time for it. Only a page load clears it.

The guard is `e.buttons === 0` on every move: the button is not down, so
whatever we thought was happening is over. Checked rather than waited for.
Losing window focus ends a drag too, so the state cannot outlive the gesture.
Both drags — elements and guides — carry it.

**And the save status stops lying.** Sjoerd: "changed something and did not
save (or is it auto save)… and it did not warn me." It HAD saved. The status
said "Saved" for two seconds, then blanked, and a blank toolbar beside a Save
button reads as nothing having been saved. It now always says where you
stand: unsaved changes while the debounce is running, then "Saved
automatically", and it stays there. The state that was missing was the honest
one — touched, not yet written.

## [0.68.47] — 2026-09-09 — the RSVP switch stops offering what the API ignores

A rough edge from 0.68.42, flagged when it shipped rather than found later.
The switch appeared on `family === 'activity'`; the API resolves RSVP on
`hasStart`. So an activity with no date showed "Ask who is coming", stored an
answer, and the resolver ignored it — a control that did nothing, on the one
screen where the whole point is knowing whether you asked.

- **`willHaveStart`**, read from the LIVE form rather than the saved row:
  `timePerDay ? Boolean(firstDay) : Boolean(startsAt)`. Gating on
  `engagement.starts_at` would have hidden the switch exactly while someone
  was setting the date it depends on, since a new event's date is in state
  and not yet on the row.
- Both sides now say the same thing, so the switch cannot promise something
  the resolver will not do.
- The PANEL still gates on the saved `starts_at`, deliberately: it renders
  responses people actually gave, and those exist until the edit is saved.
  Clearing a date in the form hides the switch and keeps the answers, which
  is the honest way round.

## [0.68.46] — 2026-09-09 — the certificate element says what it is for

Review catch from the membership session on v0.68.45, an hour old, and it is
the difference between a feature and a support ticket.

**On a thread that has been running normally, "send certificate" issues to
nobody.** Completing somebody already issues their certificate, so by the
time a dated element fires, almost everyone has theirs and issuance correctly
refuses the second. The element runs, does nothing, and reports success. The
first organiser to use it reports it as broken while looking at something
that worked perfectly.

So the editor now says so, in the dialog, next to the trigger. It is a
BACKSTOP, and what it catches is real: people who completed before
certificates were switched on, before a design was chosen, or whose
certificate failed to send. That last case is the strongest and it is in the
same file — a failed auto-issue writes a warning to stderr and nothing ever
retries it, so today those people simply never get one. A dated element is
the retry that did not exist.

The eligibility rule needed no change, which is the part worth noticing:
completed enrolments with no certificate yet was already exactly the
definition of a straggler. Reusing the bulk button's rule rather than writing
a second one turned out to be right for a reason nobody had stated yet.

## [0.68.45] — 2026-09-09 — a certificate you can put on the calendar, and one you can copy

Two of Sjoerd's: "one extra engagement: send certificate", and "certificate
template builder: duplicate a certificate".

**Sending certificates was never a plan you could write down.** One reached
somebody automatically the moment they were marked complete, or because an
organiser remembered to press the bulk button. A course ending on the 14th
that hands out certificates on the 21st had nowhere to say so.

Now it is an element on the timeline with a trigger, like everything else
there. A fixed date, or relative to the thread's start, its end, or another
item — the same machinery the scheduled messages use, because a certificate
going out on a date IS a scheduled send. It just sends a document instead of
a paragraph.

**A third family, not a ninth message type.** Several queries filter
`type IN (message types)` to mean "things emailed as a body", and a ninth
member would have been swept into every one of them silently, each then
needing an exclusion nobody would remember. `CERTIFICATE_TYPES` sits beside
`MESSAGE_TYPES`, `engagementFamily` returns three values, and the scheduler's
candidate query widens deliberately. It then forks in exactly one place:
family is certificate, so issue instead of email.

**Nothing about eligibility is new.** Who has earned one is the rule the bulk
button already uses — completed enrolments — because two definitions of
"finished the course" would drift and the one that drifted would be the
automatic one nobody watches. Both idempotency layers already existed:
issuance refuses a second certificate per enrolment, and the send log dedupes
per element and person, which is also what stops the scheduler re-walking
every completed enrolment every five minutes for the rest of the thread's
life.

**Dates only for this family, and that is a judgement call.** The lifecycle
triggers are not offered. A message can greet one person the moment something
happens to them; a certificate already does — the completion flow has issued
one at that exact moment since certificates existed. "When they complete"
would be a control duplicating something automatic, and whoever picked it
would reasonably believe it was the thing making it happen.

**Duplicate in the certificate builder.** A certificate is a design somebody
spent an afternoon positioning, and the second one for the same organisation
differs by a paragraph. The button flushes the pending autosave first, because
the copy is taken from the server's row and anything still in the two-second
debounce would not be in it. The copy is personal-scoped whatever you copied
from, and shares are deliberately not carried across: inheriting an access
list silently is how somebody ends up holding a design they were never
granted.

## [0.68.44] — 2026-09-09 — you can leave the certificate editor

Sjoerd: "once I am in the certificate editor, I can't leave. Clicking on any
item from the thread does not respond. It needs a warning when leaving
without save, but you should be able to go somewhere else."

**The editor was not frozen, it was permanently busy, and those look
identical.** The builder autosaves on a two-second debounce, so while you are
moving elements there is a save in flight or about to be, more or less
continuously. Each of those was a SERVER ACTION, and two things follow from
that in the App Router: client-side navigation queues behind a pending
action, and the route re-renders when the action returns — this page's server
component making four sequential calls to Frankfurt before it can paint. Put
together, every sidebar link was dead for as long as you kept working.

So the hot path leaves the router alone entirely. The autosave is now a plain
client-side PATCH to the API with the browser session token
(`lib/certificate-save.ts`), the shape `lib/upload.ts` already established for
the same class of reason. The old server action is deleted rather than left
beside its replacement. The templates LIST still has to notice a renamed
template, but that is once, on the way out, and stays a server action.

**On the warning, I did something narrower than asked and want to say so.**
This editor has always saved itself, so "leaving without saving" is at most
the last two seconds. Every in-app exit now FLUSHES that pending save on the
way out — the back arrow, a sidebar link, the browser's back button — because
asking somebody whether they want to keep work the editor was always going to
save is a question with one sensible answer, and it teaches people to click
through dialogs. Closing the tab is the one exit that cannot be flushed, and
that is where the warning went. Before this, the last two seconds of work
vanished silently on any of those routes.

## [0.68.43] — 2026-09-09 — RSVP asks once, and only when asked to

Sjoerd, an hour after the per-event switch shipped: "bring it back to one
place: per event. Be default off — i.e. not visible for participants. If
someone wants all their events to RSVP, they can toggle it, or duplicate an
event for the rest of the thread."

**Two things were wrong and only one of them was the count.** RSVP had three
levels — item, thread, workspace default — each null meaning inherit. That is
a lot of places to look when an item is not asking, and two of the three had
no interface at all, so two of the three possible answers to "why is this
item silent?" were invisible. The other, larger problem: the chain bottomed
out at TRUE. Asking was the default. Every dated item on every thread asked
every participant from the moment the feature landed, which is the opposite
of a question you decide to ask.

Now: one switch, on the event, off unless someone turns it on.
`resolveRsvpEnabled({ item, hasStart })` is `hasStart && item === true`. The
signature lost its two dead inputs rather than just ignoring them — leaving
them in place is how somebody re-wires them by accident later. `rsvp_default`
is gone from the thread payload, and the two dead levels no longer accept
writes, because a field that takes a value and then ignores it is worse than
one that is absent. The columns stay; dropping them is destructive and buys
nothing.

**Measured before shipping, not after.** Production holds zero RSVP answers
and zero items with an explicit setting, so the flip loses nothing. It does
SILENCE items that were asking an hour ago, which is invisible in the diff
and worth stating plainly: **36 items stop asking.** Those are the published,
on-agenda, timed ones — the only items a participant could ever have been
asked on. A wider count of 44 timed items includes 8 drafts, which were not
asking anybody and would have started once published. One workspace row
carried `rsvp_default_enabled = true` and is now dead data. Had a single
answer existed this would have needed a different plan.

The seven tests written an hour ago are rewritten rather than deleted — the
questions were right, the answers changed, and the two that flipped are the
two worth reading. One is new: the rule is `item === true` and not a truthy
check, because the value arrives from PostgREST and a column that came back
as the string "true" would otherwise switch RSVP on for everybody.

Worth recording that the resolver extracted an hour earlier is why this took
twenty minutes. Had the rule still been written three times, this reversal
would have been three edits with one of them silently missed — and the one
most likely to be missed is the write path, which means answers still
arriving for items an organiser had switched off.

## [0.68.42] — 2026-09-09 — RSVP moves to the event

Sjoerd, after seeing the Responses panel for the first time: "maybe it is
better to set it per event... so per event toggle RSVP and then you have the
second tab." He is right, and a year-long thread shows why: a residential
weekend needs a headcount and the reading group before it does not. One
switch for the whole thread makes you choose between asking about everything
and asking about nothing.

- **`thread_engagement.rsvp_enabled`**, nullable. A THIRD level rather than a
  replacement: item → thread → workspace default → yes, each NULL meaning
  inherit. Nothing existing changes behaviour, no backfill, and the rule the
  thread column already states carries down intact — an item follows its
  thread as the thread changes rather than freezing at creation.
- **One resolver, `resolveRsvpEnabled()`**, in lib/portal.ts with seven
  tests. The rule had already forked into two shapes — the portal's read
  resolving it batched, its write resolving it per request — and the
  organiser panel wanted it a third time. Two of those disagreeing is silent
  in the worst way: either the participant's control vanishes and the
  endpoint still accepts, or the control shows and every answer 409s.
  Neither reaches the organiser, who sees a switch that looked like it
  worked. `hasStart` lives inside the resolver, so timed-items-only is one
  condition rather than three.
- **The switch shows the RESOLVED value.** `GET /threads/:id` returns
  `rsvp_default` (the thread's own answer, already resolved against the
  workspace), so the UI does one `??` and never carries the rule. Rendering
  `item ?? true` on a thread already sitting at off would have shown On for
  something nobody could answer.
- **Write inside the lock, read outside it.** The switch sits in the
  disabled fieldset because it is a write, and the API refuses it too (423
  `thread_locked`). The Responses panel stays outside: a lock freezes the
  design, and who is coming is not the design.
- Migration applied to both databases BEFORE the code shipped, which is the
  reverse of the action/route pairing failure two hours earlier.

Still no UI for the thread- and workspace-level switches. The item is now the
operative control, which is what was asked for.

## [0.68.41] — 2026-09-09 — who is coming, and who never said

Sjoerd: "it is not clear where we can review who of the participants has
signed up for RSVP... maybe it should be a tab on a thread event". The
participant half shipped in 0.68.30-33; an organiser could not see a single
answer. `grep -rn rsvp apps/thread` returned nothing at all.

- **`GET /threads/:id/engagements/:engagementId/rsvps`** and a Responses
  panel on the agenda item, which is where he suggested it and the right
  home for "who".
- **Three numbers, not two.** `thread_rsvp` holds a row only when someone
  answers, so "no answer" is the thread's participants MINUS those who
  answered — a left join, not a group-by. Counting the rows that exist
  reports 12 coming and 3 not, and silently loses the 8 who said nothing.
  Eight silences and eight refusals are different facts and only one is
  worth chasing.
- **Answered first, silent last**, because the list is read to find who to
  chase and the people to chase are at the bottom.
- Dropped enrolments are excluded from both list and counts: they are not
  participants, the portal already refuses their answers (0.68.32), and
  counting them would inflate "no answer" with people who were never going
  to reply.
- Only saved, TIMED items get the panel — the same rule the portal applies
  (`rsvp_enabled` is `!!starts_at && …`), so it appears exactly where an
  answer is possible. Shown on a locked thread too: the lock freezes the
  design, not the event, and reading who is coming is not an edit.
- Verified against real staging data, both branches: a participant who
  answered and a second seeded specifically to never answer, so the left
  join is exercised rather than assumed.

Carries the API route for `getEngagementRsvps`, which was swept into
0.68.40 from an uncommitted tree and shipped there calling a route that did
not exist yet. Inert (nothing called it), now whole. The lane claim that
would have prevented it omitted the file — a lane list that is not true is
not a lane claim.

Not built, deliberately: counts on the timeline itself, and the two RSVP
switches (`thread_settings.rsvp_default_enabled`, `thread_thread.rsvp_enabled`)
which still have no UI. Both are Sjoerd's to ask for.

## [0.68.40] — 2026-09-09 — the account has a name, and the workspace has a chip

Sjoerd, on the payments screen: "payment account is unclear — add the
different accounts: workspace | personal, then a popup for info". And on the
Threads list: the owner filter should read everyone, personal, soul.com, then
the teams.

**The accounts are now called what they are.** "My account" became Personal
account, and "Workspace account" became the workspace's actual name —
soul.com, Solidarity Lab — in Settings → Payments and in a thread's payout
choice. Sending money to the wrong account is not a mistake anyone should be
able to make from a label, and a category is a worse label than a name.

**Each one's explanation moved behind an ⓘ.** Those grey paragraphs are read
once and then become furniture, and meanwhile they push the fields you came
for below the fold. The per-thread payout choice gets one for the opposite
reason: it explained itself nowhere at all, despite being the control that
decides whose bank account receives the money.

**`InfoHint` is BORN in `@thefibre/shared`**, not in this app. Two sessions
were asked for the same affordance within the hour — the membership session
for its product dialog, this one for payments — which is exactly the fork the
components-first rule exists to catch, and it was caught by them telling me
rather than by anyone reviewing it later. Three things it has to survive, each
learned rather than guessed: the bubble is `position: fixed` and placed from
the trigger's own rect, because these live in dialog bodies that scroll and an
absolutely-positioned one is clipped at the scroll edge; click makes it sticky,
because hover alone means the explanation does not exist on a phone; and it is
a real button with focus, Escape and `aria-describedby`, because otherwise a
screen reader gets an icon called "i".

**The Threads owner filter was quietly lying.** "Personal" filtered on
`!team_id` — but a workspace-scoped thread stores `team_id` NULL by design
(brief D1: that is HOW a workspace thread is stored), so the whole
organisation's threads were being counted as one person's. There is now a
chip for the workspace, named after it, and Personal means personal again.
Ownership here is the same three-way it is in the URL: personal, workspace,
or a team. That is the third surface today where "team_id is null means
personal" turned out to be false.

## [0.68.39] — 2026-09-09 — the portal's link points at the canonical owner

Found by the thread session chasing the coupling between the portal's URL
builder and its new `public_root_slug`, and measured before it was reported.

`routes/portal.ts` derived the owner segment as `team ?? organiser`. There
are **three** owner kinds, not two: a workspace-scoped thread has `team_id`
NULL by design (brief D1), so it fell through to the organiser and the portal
emitted `/{organiser}/{thread}` where the canonical address is
`/{workspace}/{thread}`. Now `(public_scope === 'workspace' ? workspaceSlug :
null) ?? team ?? organiser`, the same order the web app's own builders use.

**Not a 404, and that was checked before the report was made.** Brief D2
keeps `/{organiser}/{thread}` valid as a second address for exactly this
case; production's one active workspace-scoped thread resolved 200 under both
forms, and the other three 404 under both because they are drafts. The cost
was canonicality — the portal handed a visitor a link that is not the one the
page's own canonical tag points at.

**NOT VERIFIED, and it is the case this fix is FOR.** A fourth staging round
confirmed the fix does not disturb what it was not aimed at — an
organiser-scoped thread's URL is byte-identical before and after. That is a
negative worth having. But the staging fixture exercises exactly ONE owner
kind, so nothing has yet exercised a workspace-scoped thread through the
portal. The green means "organiser-scoped threads are unaffected", not "the
fix works". A workspace-scoped and a team-scoped fixture want seeding before
the next URL change; it is in `docs/build-plan.md` in those terms.

**The same shape is still live in `routes/thread.ts:4657`** (`ownerSlugOf`,
`team ?? organiser`, feeding public payloads). Deliberately not changed
tonight: it alters the value of a published field, which is Sjoerd's call and
not an end-of-evening one. Noted for him.

**And this is now at least the SIXTH hand-written copy of one URL rule.**

> **Correction, same evening.** This entry first said "fourth", and proposed
> a pure shared function over `{public_scope, workspaceSlug, teamSlug,
> organiserSlug}` as the fix. The thread session grepped the RULE rather than
> the files it remembered, and both halves were wrong.
>
> The count is six, five agreeing and one not: `routes/portal.ts` (fixed
> here), `routes/thread.ts:4965 canonical_owner_slug`, `timeline.tsx:363`,
> `timeline.tsx:1140`, `settings/embeds/page.tsx:55` — all three-way — and
> **`routes/thread.ts:4657 ownerSlugOf`, still two-way, the odd one out.**
> Five correct out of six is exactly why nobody notices: the wrong one looks
> fine alone and nobody diffs six files.
>
> **Two further corrections, both verified here.** (a) `ownerSlugOf` is not
> an internal helper — line 5197 is inside `GET /public/my-enrolments`, so
> the two-way copy is on **the link a participant clicks from their own
> enrolments list**. Same class of surface as the portal link fixed in this
> release, same non-canonical result. That is the copy to fix first, on
> exactly the reasoning that made the portal one worth fixing: it is the one
> a person actually follows. (b) The "seventh place" was overstated by both
> sessions, including this entry. `public_scope` IS published
> (`routes/thread.ts:4959`), so `[deepSlug]/page.tsx:42` reads
> `thread.public_scope != null ? <the field> : <fallback>` — legacy defensive
> code whose fallback branch is dead against a current API, not a heuristic
> covering a missing field. Delete it when someone is in there; it is not
> evidence of a gap and should not have been put forward as the first thing
> to look at.
>
> And the fix is better-shaped than a new function. **The server already
> publishes the answer** — `canonical_owner_slug` is a field on the public
> thread payload and `thread-view.tsx:155` already reads it for the canonical
> tag. So several of those copies are clients recomputing a value that is
> already on the wire. The extraction is: ONE server-side function feeding
> both `canonical_owner_slug` and `ownerSlugOf`, clients that hold the
> payload reading the field, and a shared pure function only for the surfaces
> that build a URL with no payload in hand (the editor, the embed generator).
> Six new call sites of a helper would have been the wrong answer arrived at
> confidently.
>
> Still not built, and still Sjoerd's to assign: it spans three sessions'
> lanes and `ownerSlugOf` feeds a published field. If it is assigned, the
> extraction and the `ownerSlugOf` change must be ONE commit — fixing either
> alone reproduces exactly this state.

## [0.68.38] — 2026-09-09 — the buttons people actually press are now 44px too

v0.68.36 fixed two links and then claimed "everything tappable in the popup
is now at least 44px tall". It wasn't. The membership session re-measured
against the staging fixture at 375×812:

```
Add to calendar      152 × 44   fixed in 0.68.36
Open the full page   145 × 44   fixed in 0.68.36
Yes                   49 × 34   still under
Can't make it        111 × 34   still under
```

The two that were fixed are exactly the two that had been reported. The claim
was then generalised to the whole popup without measuring the rest — and the
ones missed are the RSVP pair, which is the most-pressed control on that
screen. Now `min-h-11` with wider padding, like every other control there.
The 0.68.36 entry carries an inline correction rather than being quietly
restated.

The lesson is cheaper than the bug: **fix what was measured, claim only what
was measured.** A green re-verification of two specific things is not a green
verification of the surface they sit on.

**Also confirmed in the same run, so it is on the record:** both URL fixes
work signed in, and they are environment-aware — the STAGING API produced the
staging Thread host rather than a hardcoded production one, which is the part
that would have been easy to get wrong invisibly.

**And a false alarm worth writing down so nobody chases it:** that staging
thread URL returns 404, correctly. The fixture thread's program status is
`draft` and a draft has no public page; the same shape against a published
thread on production returns 200. The URL is right, the thread simply is not
published.

**Still under 44px and deliberately not fixed here:** the shared `Dialog`
close button, at 18×18. It is chrome across six apps, so it needs a signed-in
render check in each before it ships — the right fix is a 44px hit area with
the glyph left at 18px so nothing moves visually. Owned by the membership
session, deferred on purpose rather than done at the end of a long day.

## [0.68.37] — 2026-09-09 — one public address, one owner

Sjoerd made a team called "Vertrouwen als de Basis" in the soul.com
workspace. Solidarity Lab already had a team of that name. Within seconds,
`app.thethread.app/vertrouwen-als-de-basis` was a 404 — and so were the two
live threads sitting under the Solidarity Lab team, which had done nothing
at all. Nothing warned anyone at the moment of creation.

**The namespace was never actually unique.** `app.thethread.app/{owner}`
resolves a workspace, a team or an organiser from one global segment, but
uniqueness existed only INSIDE a workspace and only per table: `workspace`
globally unique on its own, `thread_organiser` per (workspace, slug), `team`
per workspace through Meet's `meet_root_slug` — none of the three aware of
the others. The workspace-URLs brief said a duplicate claim was refused. It
described an intention. `resolvePublicOwner` reads the owner with
`.maybeSingle()`, so two rows returned nothing, and the resolver's honest
answer to "which of these two did you mean" was 404 for both.

`public_root_slug` is now that table: one row per workspace, team and
organiser, the slug as its primary key, kept in sync by triggers on all
three. A second claim is a unique violation the moment it is made, and both
The Thread and Meet turn it into a 409 that names who holds the address
(`lib/root-slug.ts`, shared rather than copied). Organiser auto-provisioning,
which invents a slug with a random three-character suffix, now retries on a
collision instead of failing someone's first sign-in.

The backfill uses `on conflict do nothing` on purpose: a collision that
already exists is a human decision, and it must not take a migration — and
every other change riding with it — down on whichever database happens to
hold one. `scripts/audit-root-slugs.mjs` reports what a database was already
carrying. Both prod and staging come back clean: 18 and 12 addresses, nothing
to settle.

Six tests. The two that matter say a row never conflicts with itself — get
that wrong and a team can never be renamed once it holds its own address.

**Not fixed, deliberately:** Meet's own root namespace
(meet.thethread.app/{host|team}) is still only unique per workspace and has
exactly the same hole. Sjoerd's proposal — put the globally unique workspace
slug in front of every public path, which would make both impossible by
construction — is recorded at the top of the build plan's open queue rather
than built, because today's workspace slugs were never meant to be read by a
visitor (`default`, `de-werkhaven-9npq`) and it would change every live URL.

The live collision was settled first: the Solidarity Lab team moved to
`vertrouwen-als-de-basis-lab`, soul.com keeps the plain address, and all four
pages answer 200 again.

**Two unrelated 404s shipped fixes today; do not merge the stories.** This one
is a slug collision on the `{owner}` segment, where two owners claimed one
address and the resolver could not choose. v0.68.36 is a different fault
entirely: the visitor portal built a thread's URL as a bare path with no
origin, so it resolved against the portal's own domain. Same symptom, nothing
else in common. The fixes touch different files and neither would have caught
the other.

## [0.68.36] — 2026-09-09 — the portal's links point at the Thread, not at itself

**The verification found two real bugs and this fixes both.** Sjoerd granted
the membership session permission to build a staging fixture and drive the
signed-in portal for real — a throwaway user, person and enrolment against an
existing thread, signed in through the actual 8-digit code form. Neither bug
is reachable without a session, which is precisely why they survived four
releases of typechecks, builds and unit tests.

**One cause, two consumers.** `routes/portal.ts` built a thread's public URL
as a bare path, `` `/${ownerSlug}/${slug}` ``, with no origin:

- **"Open the full page" was a dead link.** The popup rendered that path, so
  the browser resolved it against `my.thethread.app`. Measured on staging:
  `404`. Every thread, in every popup.
- **The `.ics` carried an invalid `URL:` property.** The calendar route falls
  back to the thread URL, so the file contained `URL:/owner/slug`. RFC 5545's
  URL property is a URI and needs a scheme; calendars ignore or mangle a bare
  path.

Fixed once, in the API, with `appUrl('the-thread', process.env)` — so both
consumers are correct without either changing. Patching it twice in `apps/my`
would have been the wrong shape and left the payload still lying.

**Touch targets.** "Open the full page" was a 17px line of text on a surface
whose whole purpose is a phone held at arm's length at a door.

> **Correction (v0.68.38).** This entry originally said "everything tappable
> in the popup is now at least 44px tall". That was wrong. Two LINKS were
> fixed — the two that had been measured and reported — and the claim was
> generalised to the whole popup without measuring the rest. Re-measured at
> 375px: the RSVP buttons were still 34 high, and they are the most-pressed
> control on the screen. Fixed in v0.68.38. The lesson is the cheaper one:
> fix what was measured, claim only what was measured.

**What the same run verified as working**, so it is on the record rather than
assumed: the signed-in list with the right workspace group and ticket; the
QR; the agenda item in local time; **all three RSVP states including the
withdraw path** — the one this session trusted least — with a clean `400` on
a malformed body; the `.ics` returning `text/calendar` with a valid
VCALENDAR; the wallet buttons correctly ABSENT, which means the availability
gate added in v0.68.28 does its job; and no horizontal overflow at 375px with
the RSVP buttons not overlapping.

**A fixture trap worth knowing:** Supabase's admin API will happily create an
`@example.com` user, and the sign-in form then **rejects** that address as
invalid. An admin-created example.com fixture can never sign in. Use a real
domain — the staging fixture uses `@thefibre.tech`.

The fixture is left in place on staging (`portal-verify@thefibre.tech`),
which makes re-verifying a portal change about a two-minute job.

## [0.68.35] — 2026-09-09 — the template picker stops shouting

Sjoerd, on the New thread form: don't show these large types, a dropdown
with select template is sufficient; an (i) with more info can open a popup,
and the template selector opens in that popup.

The five template cards shipped yesterday and took the entire first screen
of a form whose actual subject is the thread you are about to name. They are
good at explaining what each shape gives you and bad at being a field you
pass through on the way to the interesting part.

So the choice is a dropdown now, sitting in the same column as Kind and
Scope with the selected template's one-line description underneath — the
pattern those two already use. The (i) beside the label opens the cards in a
popup, and picking one there sets the dropdown and closes it. One control,
two levels of detail, and the cards keep doing the only job they were ever
good at. A template your plan doesn't cover still appears in the list,
marked, rather than being silently absent.

Nothing about what a template DOES has changed.

## [0.68.34] — 2026-09-09 — a thread you can freeze

Sjoerd, this afternoon: in a thread's settings you should be able to lock it,
so it cannot be edited or deleted.

**What the lock freezes is the thread AS A DESIGN**, and that boundary is the
whole decision. Settings, timeline, tickets, discount codes, categories and
co-organisers all stop moving; the thread cannot be deleted. Enrolment,
payment, check-in, certificates and the message scheduler never consult it.
A lock that took a live event off the air while people were enrolling would
be a worse accident than the one it exists to prevent.

Status is the other deliberate exception. Marking a finished thread completed
or archived is lifecycle, not design, and it lives on its own control in the
header — locking a thread should not strand it as `active` forever.

**Unlocking is one click, locking asks first.** Unlocking removes a guard;
ceremony there teaches people to leave threads unlocked, which is the outcome
the feature is against. The lock is not a permission level either — whoever
may edit the thread may unlock it. It is a guard against an accident by the
person who already has the authority, which is what almost every real "don't
touch this one" actually is.

Both halves exist. The UI hides what it will not let you do: Save and Delete
leave the settings dialog, every panel that writes goes inert behind a
disabled fieldset (the embed tab keeps its copy buttons, they write nothing),
the timeline's add button and the inline time shortcut go away, the
engagement dialog stays open as a reader, the title stops being editable, and
a chip beside the status pill says why. The API refuses the same writes with
`423 thread_locked` on fourteen routes — the settings PATCH, the delete, all
three engagement routes, tickets and coupons in all three, categories and
both co-organiser routes — because the same endpoints are reachable by
anything holding the JWT.

Duplicating a locked thread still works and the copy starts unlocked; so does
saving it as a template. Both build a NEW thread, which is exactly the escape
hatch you want when the locked one is the one you must not touch.

`thread_thread.locked_at` + `locked_by`, applied to prod and staging.
Thread's own version goes to 3.39.0.

## [0.68.33] — 2026-09-09 — the one fact those two predicates share, written once

Review catch from the membership session on v0.68.32, and the seventh
hand-copied-fact-drifting-from-a-derivable-one of the day — the only one we
were introducing ourselves.

`enrolmentCanRespond` and `ticketIsAdmissible` each carried the literal
`'dropped'`, ten lines apart, in the file whose whole point is that they
agree on exactly that. The day someone adds `'withdrawn'` or `'removed'`,
one gets updated and the other does not, and the silent direction is the bad
one: a person who should not be answering, answering.

`enrolmentIsLive(status)` now holds it and both call it. The two predicates
stay separate — that part was right and is unchanged. What is extracted is
their **agreement**, not the predicate.

**The reason for keeping them apart is now recorded properly**, because the
one shipped in v0.68.32 was the weaker half. Money is the obvious difference;
the real one is that these will diverge *again*, predictably, on statuses
neither has been asked about yet. `'completed'` is admissible to the session
that happened and should almost certainly not be answering for future ones.
`'invoice_sent'` is admitted on trust at a door, but an invoice six weeks old
is a different question for an RSVP than for entry. One predicate would force
both through a shape that cannot express them, and whoever hit it would add a
boolean parameter rather than split the function again.

Two new tests: one asserting the shared definition, one asserting it reaches
BOTH predicates so a new terminal status cannot land in only one.
`portal.test.ts` is at 17.

Verified separately by the membership session, driving all three directions
against production with Sjoerd's test member: grant creates both rows and a
check-in code, revoke sets the enrolment to `'dropped'` and KEEPS both rows,
rejoin restores the same rows rather than duplicating. So the state
v0.68.32 guards is real, reachable and reversible. It also confirmed
`ticketIsAdmissible` already accepts `'not_required'`, which is what the
worker writes — had that list been `'paid'` only, every member who joined
through a tier would have been turned away at a door holding a valid QR.

## [0.68.32] — 2026-09-09 — a lapsed member stops answering for future sessions

v0.68.31's thread worker made a bug in v0.68.30 reachable, and the other
session flagged the behaviour as *context* rather than as a problem — it was
a problem.

When a membership lapses, the worker sets `enrolment.status = 'dropped'` and
leaves both rows standing. That is correct: soft delete only for personal
data, and the record that someone took part is theirs to keep. But the RSVP
write checked only that a `thread_enrolment` row EXISTED. So from v0.68.31 a
lapsed member kept seeing the thread — which is intended — and could keep
answering for its future sessions, which is not. An organiser would have been
counting someone who had left.

Fixed on **both** sides, so the screen and the API agree rather than one
offering what the other refuses:

- **Write** — the enrolment's status is fetched and a dropped one gets `409`.
- **Read** — `rsvp_enabled` is false for a thread this person has dropped, so
  the control is never offered.

**A deliberate non-reuse.** `enrolmentCanRespond` sits next to
`ticketIsAdmissible` and does not call it. They answer different questions: a
door also asks whether the money landed, and an RSVP is not a purchase — an
unpaid participant saying "I'm coming" costs nothing and is worth knowing.
The only thing both refuse is `'dropped'`. A test asserts that divergence
explicitly, so a later reader doesn't merge them thinking it is a
simplification.

Checked while here: nothing in the RSVP path keys off how an enrolment was
created, so v0.68.31's `membership:<grant_id>:<member_id>` request_id shape
— a third one, after checkout and `manual:` — reaches nothing. The write
matches on person, thread and now status.

`apps/api/src/lib/portal.test.ts` is at 15 tests, all green.

## [0.68.31] — 2026-09-09 — a thread grant finally does something

The access-grant dropdown has offered "Thread" since Membership shipped. It
saved, it listed, and nothing consumed it — circle, fibre_seat and
google_user each had a worker; thread had none. So a tier could promise a
thread and deliver nothing, silently, forever. Found on soul.com, where four
of seven products are threads and the €2300 tier unlocked nothing at all.

- **`lib/thread-access.ts`, `runThreadAccessSync()`**, drained on the same
  five-minute tick as the other three. A member joining a tier that includes
  a thread is enrolled in it; a member lapsing is withdrawn.
- **An enrolment is two rows** — `enrolment` (platform, keyed on program)
  and `thread_enrolment` (the app's) — and the worker writes both directly,
  the in-family-app rule.
- **Revoke does not delete.** It marks the enrolment `dropped` and leaves
  both rows: deleting would destroy the record that someone took part, and
  the platform rule is soft delete only for personal data. The participant
  list already selects `enrolment.status`, so a dropped member reads as
  dropped rather than vanishing. Rejoining flips the same rows back.
- **`payment_status: 'not_required'`** — a grant is an entitlement the tier
  already paid for, never a second charge.
- **The config parser is tested**, because it decides whether a grant
  resolves at all. Real grants store the full public URL rather than a slug
  (`https://app.thethread.app/soul/community-member-year-agenda`), so it
  takes the last path segment and tolerates query strings, fragments,
  trailing slashes and case. apps/api: 51 tests, 8 files.

Not code, same session: a `google_user` grant now sits on soul.com's
"email@soul.com / Google Workspace" product. Circle stays ungranted — that
workspace's `circle_api_token` is null, and a grant with no credential waits
forever without saying so.

## [0.68.30] — 2026-09-09 — RSVP: the participant half

Sjoerd decided the shape: *"Setting in workspace: default RSVP on... and can
be put out per thread."* Built as specified, which is **not** what was
recommended — the recommendation put the switch on the agenda item defaulted
from the thread, and the simpler two-level version was chosen. His call.

**The switch is two-level and inherits by NULL.**
`thread_settings.rsvp_default_enabled` defaults to true, so an unconfigured
workspace asks. `thread_thread.rsvp_enabled` is **nullable** rather than a
defaulted boolean, because a default would freeze each thread at whatever the
workspace said on the day it was created; null means inherit, and a thread
follows the workspace as it changes. Same rule payment destinations already
use here. The API resolves it server-side, so the client is told the answer
and never carries the rule.

**The answer is three states, not two.** `thread_rsvp` holds one current row
per (agenda item, person) with `coming | not_coming`; a MISSING row is *no
answer*, and that is deliberately not collapsed into a boolean. Forty
declines and forty non-replies are different facts, and a caterer needs to
tell them apart — storing a boolean would destroy that difference
permanently, where keeping it costs nothing. Withdrawing an answer is
reachable (`response: 'none'`), because otherwise a mis-tap is forever and
every count is quietly wrong. What silence *means* is a presentation question
Sjoerd has not decided, and nothing here pre-empts it.

**Where the checks live.** `PUT /api/v1/me/portal/rsvp` verifies, against the
same verified email the read uses, that the item exists and is published and
timed, that the person is enrolled in its thread, and that the thread is
actually asking. The browser never holds a token: the control posts to the
portal's own `/api/rsvp` handler, which reads the session server-side and
forwards. It forwards rather than decides — every check that matters is in
the API, because that is the only place one cannot be skipped by calling
something else.

Only timed items can be answered. An item with no `starts_at` is not
something you can attend.

**NOT BUILT, and this is the honest half of the release:** there is no
organiser UI yet. The API accepts `rsvp_default_enabled` on workspace
settings and `rsvp_enabled` on a thread, and the migration defaults to on, so
the feature is live and answerable — but a switch in The Thread's own screens
and an organiser view of who answered are the next slice, and neither exists.
Adding them means new i18n keys across six locales and a response list, which
is its own piece of work rather than a tail on this one.

**Verified:** typecheck clean across all nine; portal build clean with
`/api/rsvp` registered; migration applied to staging and production. **Not
verified: nobody has actually answered an RSVP** — that needs a participant
session, which is the same gap v0.68.28 carries.

## [0.68.29] — 2026-09-09 — staging stops inviting search engines in

While answering a question about Vercel's deployment protection, a bigger
hole turned up behind it: **there was no robots file anywhere in the repo**,
and the staging stack is publicly reachable. Six `.tech` subdomains were
serving a complete copy of the product with nothing telling a crawler to stay
away. Verified by fetching a staging site with no credentials and finding no
`noindex` and no `/robots.txt`. A staging copy in a search index competes
with the real site and confuses real people.

Every app now has `app/robots.ts`, one line each, over a single policy in
`@thefibre/shared/robots`.

**The asymmetry is the design.** The only thing that opens a site is
`VERCEL_ENV === 'production'`. Preview, development, an empty string, a
missing variable, a build outside Vercel — all closed. A staging site that
gets indexed is a nuisance; a production site accidentally de-indexed is
weeks of lost ground, so "unknown" must never mean "index me". Eight unit
tests lock that, including the near-misses `'Production'` and `'prod'`.

**The environment is passed in, not read.** `packages/shared` is bundled into
eight browser builds and carries no node types on purpose — it decides what
the policy is, the caller supplies `process.env.VERCEL_ENV`. Same split as
the invoice model and the ical builder. (First attempt read `process.env`
inside shared and the build refused it, correctly.)

**The visitor portal is closed everywhere, production included** — every page
below its sign-in is one person's own tickets, enrolments and memberships. It
now carries both halves: `robots.ts` stops the crawl, the `robots` metadata
added in v0.68.24 stops the listing.

**Verified against real builds, in both directions**, because the risky
branch is the one that would de-index `thethread.app`:

```
VERCEL_ENV unset        →  User-Agent: *  /  Disallow: /
VERCEL_ENV=production   →  User-Agent: *  /  Allow: /
```

**This is not the same thing as Vercel's SSO protection**, which is still
Sjoerd's open decision. That gates who can reach a preview at all; this gates
what a crawler does with one it can reach. They are independent, and neither
touches the platform's own cross-app sign-in.

## [0.68.28] — 2026-09-09 — the portal opens: agenda, ticket, wallet, calendar

The visitor portal was a list. Tapping an item now opens it, which is where
the things a person actually needs on the way to a door live.

**The detail popup** (`apps/my/app/detail.tsx`) is ordered physically rather
than by data shape: the QR first, because a phone at a door is held at arm's
length; then the ways to keep it — Apple Wallet, Google Wallet, add to
calendar; then the agenda, each item with its own join link and its own
calendar file; then the page it came from. It uses the shared `Dialog`, not a
portal-local copy, per CLAUDE.md's components-first rule.

A ticket now rides **inside** its thread rather than beside it. The two
sections showed the same event twice; only an orphan ticket — one whose
thread isn't in the payload — still gets its own row.

**No new API surface for the ticket.** The QR and both wallet passes are
already served by Thread at `/api/v1/thread/public/checkin/:code/*`, and the
portal holds the check-in code, so these are URL builders. The one thing the
portal could not know is whether the passes are *issuable*: both config
readers return null without credentials and the routes 503. A button that
fails is worse than no button, so `GET /me/portal` now carries
`wallet: { apple, google }` and the buttons appear only when they work. Both
are false in production today, waiting on Sjoerd's Apple Pass Type ID
certificate and Google Wallet issuer account.

**`lib/ical.ts` moved to `@thefibre/shared/ical`.** It is a hand-rolled RFC
5545 string builder with zero dependencies and no node imports — the same
test v0.68.26 applied to the invoice model: the *definition* is shared, a
renderer that needs an engine is not. Meet keeps its endpoint and its import
path via a re-export shim; the portal renders its own. `ORGANIZER`,
`ATTENDEE`, `URL` and `PRODID` became optional, so a thread agenda item —
which has no single host and is a download rather than an invitation — emits
a valid VEVENT without them. Meet's output is unchanged: PRODID still
defaults to Meet's, and all five original tests pass through the shim
untouched. Four new ones lock the portal shape.

**Add-to-calendar is served by the portal, not the API** (`/ics/:threadId/:itemId`).
A calendar link is a plain `<a>`, and a plain link cannot carry a bearer
token. The route handler has the session cookie, re-reads the portal with the
same call the page makes, and finds the item inside that payload — so the
file is scoped to the signed-in person by construction, and there is no new
way to address someone else's agenda. Agenda items only: they carry
timestamps, where a thread carries dates and would need all-day VEVENTs for
no benefit. An item with a start but no end gets an hour.

**Not built, deliberately:** "email it to me" needs a visitor-facing resend
endpoint and a template, and RSVP has no model anywhere — its shape was
discussed on 2026-09-09 and Sjoerd has not decided it. Both are specified in
`docs/build-plan.md` rather than guessed at.

**Verified:** `pnpm -r typecheck` clean across all nine; the production build
of `@thefibre/my` clean with `/ics/[threadId]/[itemId]` registered; the ics
route returns 401 unauthenticated; nine ical tests pass. **Not verified: the
signed-in list and the popup were not rendered** — that needs a participant
session this session does not have.

## [0.68.27] — 2026-09-09 — the import cycle is inert for one reason; say so

`routes/purchases.ts` and `routes/membership.ts` now import each other
(0.68.22 added `activateMemberFromInvoice` to mark-paid). Caught in review
the same day.

- **Measured, not reasoned about**: the built modules were imported in both
  evaluation orders and every binding resolves. It is inert ONLY because
  all three crossing functions — `activateMemberFromInvoice`,
  `sendReceipt`, `sellerDetailsFor` — are hoisted `function` declarations,
  so the live binding is populated before either module body runs.
- **Both import sites now say that.** Converting any of the three to
  `const fn = () => {}` reads as a style change and would turn this into
  `undefined is not a function` on the path a membership payment runs
  through. The comment is the guard until the real fix, which is lifting
  `sendReceipt` / `receiptHtml` / `sellerDetailsFor` into a lib module.
  That surgery is not something to do at the end of a long day through the
  middle of the live payment path.

## [0.68.26] — 2026-09-09 — one definition of what an invoice is

Sjoerd: "PDF and send can also be created based on what is in the
@fibre/shared environment right? Like a single point of truth." Half yes.
The renderers stay in the API; the DEFINITION moves to shared.

- **`@thefibre/shared/invoice-model`** — a pure function turning a ledger
  row into the invoice: kind (a pending row is an invoice, anything else a
  receipt), number, date, seller and buyer blocks, the line with its
  optional service-until, subtotal/tax/total, and the payment method as a
  decided vocabulary. It returns DATA, never formatted text, because the
  on-screen dialog localises and the two server renderers do not. No
  dependencies, no node, no I/O.
- **All three renderers now read it**: `apps/api/src/lib/invoice-pdf.ts`,
  `receiptHtml` in `routes/purchases.ts`, and
  `packages/shared/src/ui/invoice-dialog.tsx`. Each keeps its own layout and
  its own wording; none decides any more what an invoice contains.
- **They had drifted, which is the point.** The email dated a settled
  receipt by `created_at`, so it showed when the invoice was RAISED rather
  than when it was paid — now the paid date, as the PDF always did. The PDF
  showed a subtotal always and the email only alongside tax. The buyer name
  fell back differently in each. One definition, one answer.
- Not moved, deliberately: `buildInvoicePdf` needs pdfkit and returns a
  Buffer, and `packages/shared` has zero dependencies and is bundled into
  every web app. It also draws from personal data, which HARD RULE 1 keeps
  in the EU API.
- Verified beyond typecheck: real production ledger rows rendered
  byte-identically through the rebuilt PDF (2060 bytes before and after for
  soul.com's €1 invoice).

## [0.68.25] — 2026-09-09 — a member can get their own invoice (Members 0.14.4)

Sjoerd on his own member page, on production: "Can't download or send the
invoice", and "should it not say Powered by Members · The Thread".

- **`GET /membership/portal/me/invoices/:id/pdf`.** The ledger's PDF route
  scopes to organiser-or-admin, which is precisely what a member is not, so
  the portal listed an invoice with nothing to click unless Stripe happened
  to host one — and an invoice-method membership never does. Ownership is
  proved the way the rest of the portal proves it: the verified email
  resolves to person rows, and the row must match `person_id` OR
  `payer_email`, both keys, because either alone drops rows. The shared
  `createInvoicePdfRoute` factory takes an optional `apiPath` so the member
  door reuses it rather than becoming a sixth copy.
- **The public face is The Thread.** The 2026-09-08 branding pivot made
  `ENTITY.publicName` 'The Thread', and four public surfaces still carried
  "· The Fibre" as a literal: Membership's `/my`, and in Thread the public
  thread page, the embed, and its own `/my`. All four now read the constant.
  Fourth hardcoded copy of a derived value found today, after the dev-server
  list, the version-file count and the CORS origins.

## [0.68.24] — 2026-09-09 — the portal's first real deploy, and the build-skip trap that hid it

`my.thethread.app` served a `500` all day from a deployment built the night
before it had any environment variables. The cause was not the project, the
env, DNS or the domains — all of those were wired correctly. It was that
**no build ever ran.**

Each app's `vercel.json` carries `ignoreCommand: vercel-ignore.mjs <app>`,
which builds only when a push touches that app, `packages/shared` or the
lockfile. It is a good rule and it saved ~€150 in five days. But a project
can sit for a day with correct config and never deploy, because no push
happens to touch any of those three paths. That is what happened: between
2026-09-08 21:37 UTC and 2026-09-09 08:48 UTC every push was `apps/api`,
`apps/membership` or docs, and every one reported CANCELED. `NEXT_PUBLIC_*`
values are inlined at build time, so the env vars set that morning were
invisible to the deployment still being served, and
`createServerClient(undefined, undefined)` threw in a server component —
a `500` with an opaque digest and nothing pointing at the cause.

**Redeploying from the dashboard or the API does not help**: the ignore step
runs there too and cancels those the same way. A push touching one of the
three trigger paths is the only thing that produces a build.

> **Correction, same day.** The first version of this entry said the fix was
> "a commit touching `apps/my`" and implied this release is what unblocked
> the portal. Both are wrong, and the deployment record says so. The two
> builds this project has ever run were BOTH triggered by `packages/shared`,
> never by `apps/my`: `dpl_DC2M…` at 21:37 UTC from `fa2d8e5` (v0.68.21,
> `packages/shared/src/participant-auth-i18n.ts`) and `dpl_Djwjz…` at 08:48
> UTC from `bf5f7d7` (v0.68.23, `packages/shared/src/ui/app-landing.tsx`) —
> the latter landing about two minutes before this release. The portal was
> already unblocked when this shipped. The trigger set is three paths, and
> `packages/shared` is the one that fires in practice because most releases
> touch it, which is precisely why nobody noticed the rule for a day. Caught
> by the membership session reading the commit column of the deployment
> table. The `noindex` change below stands on its own merits either way.

- **The visitor portal is `noindex`.** `robots: { index: false, follow: false }`
  on `apps/my/app/layout.tsx`. Every page below the sign-in is one person's
  own tickets, enrolments and memberships, on the one app whose whole purpose
  is showing that to its subject. It should never enter a search index. Same
  posture the Thread and Membership embed layouts already take.
- **`docs/system-handbook.md` stops giving the wrong remedy.** The build-skip
  bullet told the reader to "redeploy manually" to pick up env-var changes.
  Measured on `thefibre-my` today: that does not work. Corrected, with both
  sharp edges named — env-only changes rebuild nothing, and a new app's
  project silently never deploys.
- **`docs/my-portal-setup.md` gains step 4**: make a commit that touches
  `apps/<app>`. It is now the documented last step of standing up any new app,
  because everything can be perfect and still serve nothing.

Found by the two sessions working this repo in parallel: the membership
session read the deployment states with the Vercel token and produced the
21:37 timeline and the `ssoProtection` matrix; this one reproduced the
throw locally and wrote it up.

**Still open for Sjoerd, not code:** `thefibre-my` carries Vercel Standard
Protection (`ssoProtection: all_except_custom_domains`) where the six product
apps carry `null`. That is why `my.thefibre.tech` redirects to Vercel's SSO —
it is bound to the `staging` branch, so it is a Preview. Flipping it to `null`
is a security setting and his call.

## [0.68.23] — 2026-09-09 — the landing page has a door for members (Members 0.14.3)

Signing in at membership.thethread.app takes you to the admin side, which
a community member has no seat for. That wall was fixed for people who
arrive already signed in (0.68.22 sends them to /my); a signed-out member
still had nowhere to click.

- **`belowSignIn`** — an optional slot on the shared `AppLanding`, under
  the sign-in block. Membership fills it with a link to `/my`; the other
  apps are untouched.
- Also carries `apps/api/scripts/verify-stripe-webhooks.mjs`, pushed
  outside the release script in 72ca494 and recorded here instead of
  quietly. Read-only auditor for the four Stripe endpoints: existence,
  status, Connect-versus-account mode, and the events each route needs.
  Written because a webhook in the wrong mode looks healthy in the Stripe
  dashboard and delivers nothing — which is why soul.com's first live
  payment never reached the membership.

## [0.68.22] — 2026-09-09 — a paid membership stays paid (Members 0.14.2)

soul.com's first live member joined on an invoice, paid, and the app
disagreed with all three parts of that sentence. Four defects, found from
the row itself rather than the symptom.

- **Paying an invoice now moves the membership.** The Stripe payment link
  in a membership invoice email settled the ledger row and stopped there —
  the membership kept the status and renewal date it was created with, so
  someone who paid on day one sat in grace forever. New
  `activateMemberFromInvoice()` (routes/membership.ts): item refs shaped
  `member-inv-<member id>-<n>` set the member active, clear `lapsed_at` and
  roll `renews_at` one period on from whichever is later, the date already
  on the row or today. Wired into the Connect webhook AND
  `POST /purchases/:id/mark-paid`, which had the same hole. The period the
  invoice bought is stamped into `purchase.billing.membership_interval` at
  creation (person and organisation paths both).
- **A manual add gets a real renewal date.** `renews_at` was whatever the
  caller sent, and the Add-member dialog sent an explicit `null` when the
  field was blank. Absent now means one period from `started_at`; an
  explicit null still means "never renews". The dialog omits the key
  instead of nulling it, and its hint says so.
- **The overdue sweep no longer graces a membership on its first day.** A
  renewal date on or before `started_at` is a data error, not a late
  payment. The sweep skips those rows — before this, a membership created
  with today's date was graced by the next 5-minute tick, two minutes after
  joining, with a `membership_payment_failed` activity row to match.
- **`country` comes back from the API.** It was missing from
  `MEMBER_SELECT`, so the member dialog read it as undefined, always showed
  "Not declared", and — worse — wrote that null back over a declared
  country on the next save.
- **The wall knows about members** (`/no-access`). The (app) gate sends
  everyone without a workspace seat there, and the largest group hitting it
  is community members, who have no seat by design. It now checks the
  portal and redirects a member to `/my`; the wall that remains says what
  it is and links there anyway.

## [0.68.21] — 2026-09-08 — one copy of the participant sign-in strings (Members 0.14.1)

The passwordless email-code + Google sign-in copy lived twice — six
locales in the Thread's catalog, hardcoded English in Membership's two
sign-in components — with apps/my poised to become a third copy.

- **New shared catalog** `@thefibre/shared/participant-auth-i18n` (also
  exported from the root index): the 12 participant-auth keys
  (`sign_in_google`, `email_me_code`, `code_sent`, `enter_code`,
  `verify_code`, `sending`, `verifying`, `redirecting`,
  `use_different_email`, `code_send_failed`, `code_invalid`, and the
  genuinely-duplicated `something_wrong`), Thread's copy verbatim
  (design-leading), `// MT` marks preserved. Plain TS, hook-free,
  server-renderable — the chrome-server-i18n pattern.
- **Thread + Membership** spread `...PARTICIPANT_AUTH` into their typed
  catalogs; the duplicate entries are deleted. Thread's keys and copy are
  unchanged for users.
- **Membership speaks six languages at sign-in** (0.14.1): the /my portal
  and oauth-continue sign-in components read the catalog instead of
  hardcoded English, converged on the Thread's copy ("Verify code" instead
  of "Sign in" on the code submit; the terser "We sent an 8-digit code to
  {email}."), and Supabase's raw `error.message` is replaced by the
  localized `code_send_failed` / `code_invalid` / `something_wrong`.
  `SignInButton` grew an optional `locale` prop.
- **apps/my is the noted pending consumer** — when the visitor portal
  grows i18n it adopts this catalog rather than a fourth copy.


## [0.68.20] — 2026-09-08 — my.thethread.app: the visitor's own place

The eighth app, `apps/my` (dev port 3007) — the surface for the API that
shipped in 0.68.15. Sign in with email + a code, then everything you are
part of, grouped by the organiser you know.

- **The ticket is the point.** Today a thread's QR exists only inside the
  enrolment email; delete the email and you are on the door volunteer's
  name-search fallback. The portal shows it, and tapping opens it
  full-screen on white — a phone at a door is held at arm's length, often
  half-turned toward someone else, sometimes in the sun.
- **Email + a code, and nothing else.** No Google button: a visitor arriving
  from a ticket email has already proved they hold that mailbox, and
  offering four ways in is how a simple door stops feeling simple.
- Per organiser: tickets, threads with their agenda and links, meetings,
  membership. One API call; no Supabase read beyond the session itself.
- Registered as a SURFACE, not an app — no AppId, no activation, no
  membership. `thefibre-my` joins scripts/verify-vercel-env.mjs (NAMES +
  NEXT_PUBLIC_MY_URL for staging).

**release.sh no longer hand-keeps its version list.** It derives from
`apps/*/package.json` + root + packages/shared, so the eighth app was
covered the moment it existed. The hardcoded ten would have skipped
apps/my silently — the same shape as the CORS list that forgot
membership.thefibre.tech. Portable to macOS bash 3.2 (no `mapfile`).

Not yet: the Vercel project and DNS (docs/my-portal-setup.md has the steps,
and nothing can point at the app until it exists — which it now does), the
PWA, and the per-thread door capability.

## [0.68.19] — 2026-09-08 — website: a hamburger next to Start a Thread

Below the sm breakpoint the nav's link row is hidden, so a phone visitor
could reach nothing but the Start button — Why, The workshop, Pricing,
About, Contact and Sign in were simply unreachable. A hamburger now sits
right of the Start button (mobile only; desktop keeps its inline links):
inline-drawn icon (no new deps) flipping to an ×, dropping a white card
with the five links and Sign in behind a divider. Closes on link tap,
outside tap, and Escape. Verified at 375px (open/close, all six entries)
and 1280px (hamburger absent, seven inline links) on a local render.

## [0.68.18] — 2026-09-08 — snap-controller comment tells the truth about mobile

Comment-only: snap-controller.tsx's header claimed "mobile stays proximity
via the media query" — since 0.68.17 mobile has no snap at all. The comment
now says so (asked for by the website session; comments and CSS must agree
or the next reader "fixes" the wrong one).

## [0.68.17] — 2026-09-08 — the landing-page magnet is desktop-only

Sjoerd on mobile: "the magnetic is not working - showing weird behaviour."
The base `scroll-snap-type: y proximity` applied at every width — only the
mandatory upgrade was desktop-gated — while every landing section is
min-h-[100svh], i.e. taller than a phone viewport. Snap points on sections
taller than the screen fight iOS momentum scrolling: flicks ending near a
card edge get yanked, mid-card stops rubber-band. The proximity base now
lives inside the same `min-width: 768px` block as the zoned mandatory
upgrade, so phones scroll fully native and the desktop deck keeps its
magnetic feel (verified at 375px → snap none, and 1280px → y mandatory in
the deck, on a local render).

## [0.68.16] — 2026-09-08 — the thread editor stops crashing on template-made threads (Thread 3.38.2)

Sjoerd opened a thread made from the "two-day event" template and got
Next's "Application error: a client-side exception" page. The v0.67.1
seeder wrote a `daily_schedule` of two rows WITHOUT dates (a template has
none to give); the editor formats each row's date with Intl, which throws
on undefined, and one throw takes the whole page down.

- **Seeder** — `seedRowsFor()` in lib/thread-template-library.ts is now a
  pure function (unit-tested): no daily_schedule at all — `days` stays a
  hint on the template card and the organiser picks the dates in the
  dialog. Relative messages carry `trigger_anchor = 'engagement'`, the value
  the editor AND the scheduler branch on; seeded without it they silently
  resolved to the programme start. Anchors resolve in a second pass, so the
  conversation circle's reminder (blueprint order: message before circle)
  finally links to its circle.
- **Editor** — `fmtDayShort` returns the raw string instead of throwing on
  an invalid date, and the card + `coveredDays` only read schedule rows that
  carry one. A bad row degrades to nothing, never to a white page.
- **Repair migration** `20260908130000_repair_seeded_engagements.sql` —
  nulls date-less schedules (1 row) and sets the missing anchor (3 rows).
- Found by reading the Fly log around the crash (two editor loads, all
  200s) and the rows themselves — the client console was out of reach.
  Noted while there: the Festival of Trust planner writes `timezone:
  "Athenes/Greece"` through the app API, which is not an IANA zone; the
  PATCH schema accepts any string. Left as is (rejecting it would break
  the planner's sync) — build-plan item.

## [0.68.15] — 2026-09-08 — the visitor portal's API

The participant's own place, across every app: `GET /api/v1/me/portal`
returns tickets, threads (with agenda + links), meets and memberships for
one person, grouped by the organiser they know — which is the workspace
(Sjoerd, 2026-09-08: "organiser in the eyes of the visitor can be
workspace"). docs/visitor-portal-proposal.md holds the decisions.

- **The third sanctioned data-wall crossing.** Reading three apps' schemas
  in one response is forbidden everywhere else. It is allowed here because
  the wall stops APPS reading each OTHER; this is the PLATFORM composing,
  for the data subject, a view of their own data (GDPR Art. 15). No app
  gains a read it did not have. Stated in the route's own header so a
  future session doesn't "fix" it.
- `lib/participant-auth.ts` — participantEmailFromAuth promoted out of the
  two copies in thread.ts and membership-portal.ts. Those still hold their
  own; the comment calling the duplication deliberate stops being true only
  now that a third caller exists, and swapping them is its own change.
- `/api/v1/me/` joins PUBLIC_PREFIXES: the participant JWT is verified in
  the handler, and the caller has no workspace claims and no X-App-ID.
- **The email filter IS the security model.** Every query runs on
  adminClient, so RLS protects nothing here; each one is scoped explicitly
  to person rows matching the verified email. Said in the file, at length,
  because the doc won't be open when someone edits the handler.
- **Dual keys.** meet_booking.invitee_person_id is nullable and
  invitee_email is not; neither column alone finds all of a visitor's rows.
  Two typed queries merged by id — never a PostgREST .or() string with the
  email interpolated into filter syntax, where `,` `(` `)` `.` are
  meaningful. A verified email proves someone receives mail there, not that
  it is inert inside a query language. Same trap waits on `purchase`.
- Tickets carry a QR only when the door would honour it (paid /
  not_required / invoice_sent, never dropped) — an unpaid enrolment still
  shows as a thread. A refused ticket at the front of a queue is worse than
  no ticket. Locked by 8 unit tests in lib/portal.test.ts.
- Two column errors caught by probing real data, invisible to typecheck
  because the Supabase client is untyped: `thread_thread.location` doesn't
  exist (threads have no location — the place is on the engagement, which
  is why the ticket email leaves it null; the portal now takes the first
  agenda item that names one), and `meet_host.display_name` doesn't exist
  (the host's name is on the user row, slug as fallback).

Not yet: the my.thethread.app surface itself, the PWA, and the per-thread
door capability that would let a volunteer scan without workspace
membership. No client calls this route yet.

## [0.68.14] — 2026-09-08 — website: Sign in reaches the nav

- thethread.app's nav gains a quiet "Sign in" link (→ app.thethread.app)
  before the Start-a-Thread button — it previously lived only in the
  footer and the /login redirect.

## [0.68.13] — 2026-09-08 — SURFACES: the portal registered as a platform surface

- branding.ts grows SURFACES — public web properties that are NOT
  catalogue apps (no AppId, no activation, no membership; X-App-ID:
  fibre-platform). First entry: my-portal → https://my.thethread.app
  ("My Thread", dev port 3007; 3006 is the website). surfaceUrl() mirrors
  appUrl's env-override pattern. Adopted from the visitor-portal session's
  analysis: teaching APP_IDS about a non-app would ripple into launchers,
  display order and tile maps.
- API CORS derives surface origins from the registry (same
  derived-never-listed rule), localhost:3007 joins dev origins, thefibre-my
  joins the Vercel preview regex. Sjoerd's checklist when the portal app
  exists: TransIP A record for my.thethread.app + eighth Vercel project.

## [0.68.12] — 2026-09-08 — website: card 2 names its audience

- "…online tools for organisers and facilitators who bring people
  together" (was "for people").

## [0.68.11] — 2026-09-08 — website: the After card in Sjoerd's words

- Home arc "Journey" card: "…The first event was just the beginning. A
  second day or a follow-up session. Maybe reflections. … An event ends.
  The thread doesn't. One moment becomes a learning journey."

## [0.68.10] — 2026-09-08 — the workspace, named beside the avatar

- The shared avatar menu shows the active workspace's name in front of the
  icon ("soul.com  SL") in all six apps — derived from the switcher list,
  no per-app wiring; hidden on the smallest screens, truncated past 11rem.

## [0.68.9] — 2026-09-08 — the fibre pages wear a Fibre footer

- MarketingFooter grows a 'fibre' variant — same structure and safe-data
  commitment, but the Fibre wordmark on quiet neutral instead of the
  Thread's yellow band. The fibre public pages (terms, privacy, support,
  about, pricing, landing) use it, so thefibre.app is a Fibre page down to
  its last pixel; thethread.app keeps the yellow.

## [0.68.8] — 2026-09-08 — website: the Before card in Sjoerd's words

- Home arc "Intention" card: "…an enrolment page, tickets if you want them
  — payment by card or invoice. Maybe you need messages sent before, an
  online preparation meeting, a series of conversations… Set the
  conditions for something real to happen."

## [0.68.7] — 2026-09-08 — higher contrast everywhere; the scope control stops wrapping (Thread 3.38.1)

Sjoerd, live-testing the new-thread form on a fresh Free workspace: "Interface
does not work (general: color system is too light.. contrast needs to be
higher)" — and the Kind/Scope segmented control rendered broken (Workspace
wrapped below the border, overlapping).

- **Light theme darkened one step in all six apps** (thread, meet, members,
  web in the gray family; flow, pulse in slate): secondary text gray-600→700,
  tertiary text/placeholders gray-400→500 (was 2.5:1 on white — below WCAG;
  now 4.6:1), borders gray-200→300, strong borders gray-300→400. Labels,
  hints, section headers and placeholders all read at arm's length now.
  Dark theme untouched.
- **New-thread segmented controls fixed**: the two grids had swapped column
  counts — Kind (2 buttons) sat in `grid-cols-3` with an empty cell, Scope
  (3 buttons) in `grid-cols-2` so Workspace wrapped into the clipped
  overflow. Both corrected, plus hairline dividers between segments and
  truncation guards so long locale labels can't wrap.
- Verified with a signed-in local render (light theme, via the SSO-land
  session mint the e2e suite uses). Free-plan template copy needed no change
  for the 1→2 limit bump — no count was ever hardcoded.

## [0.68.6] — 2026-09-08 — the Thread door works end to end (Sjoerd's live signup test)

Sjoerd signed up through the popup as a stranger and walked into every gap.
All fixed:

- **Platform emails present The Thread**: EMAIL_BRAND in the registry (name
  = ENTITY.publicName, sign-in = app.thethread.app, wordmark PNG rendered
  from the SVG onto the brand SPoT). Auth + platform templates fall back to
  it (per-community brands still win); defaultEmailFrom and
  legalFooterLine say The Thread now.
- **The launcher tells the truth on first sign-in**: the JWT's
  app_memberships claim is minted before first-login app activation, so
  the fresh workspace showed no Thread tile. The dashboard now reads live
  memberships from /auth/me (claim = fallback).
- **Sales/Learn tiles are gone** — not even "coming soon".
- **The digital facilitator, v1** (guided onboarding, existing interface
  as the stage): a fresh workspace's launcher asks "Shall I guide you to
  your first journey?" — Yes dims the other tiles, rings The Thread in
  yellow with a bouncing arrow ("Click The Thread"), and the Thread's own
  shape picker guides from there. No stores a cookie and stays quiet.
  Six locales.
- **Free gets 2 templates** (billing_plan features on prod + staging;
  Sjoerd: "otherwise people don't experience the thread") — pricing bullet
  follows.
- **thefibre.app is a Fibre page again**: platform-voiced landing — what
  The Fibre is, the tools running on it (Thread, Meet, Members, Pulse &
  Flow, external apps), and "Build yours on it" inviting outside builders.
- **Home stickiness restored, zoned**: SnapController arms MANDATORY
  snapping inside the card deck (desktop) and relaxes to proximity in the
  page tail — full magnet AND a scrollable footer, with hysteresis.

## [0.68.5] — 2026-09-08 — the Zoom page a reviewer can read signed out

### Added
- **`meet.thethread.app/docs/zoom`** — public documentation for the Zoom
  integration: adding it, what it creates on your account, the four
  permissions and the one call each is for, what we store and where, how to
  remove it, and troubleshooting. Zoom's most common Marketplace rejection is
  "user documentation insufficient", and their Documentation URL has to point
  at a page about the integration itself, not a general support page — so
  this is the last piece the submission packet was waiting on. It sits
  outside the `(app)` group deliberately: a reviewer must be able to read it
  with no session.
  Ported from Soul Suite's `/docs/zoom` and corrected to what Meet actually
  does — Suite deleted and recreated the Zoom meeting on reschedule, we
  `PATCH` it, so the join link survives a move.

### Changed
- `docs/zoom-marketplace-submission.md`: Documentation URL filled in, its
  checklist item ticked.

## [0.68.5] — 2026-09-08 — the magnet learns manners

- scroll-snap goes PROXIMITY everywhere (was mandatory on desktop):
  mandatory + a snapless footer re-snaps erratically and traps the scroll
  at the bottom ("footer constantly in screen, can't scroll up"). The pull
  near card edges stays; nothing holds the page hostage. The invitation
  card rejoins the snap flow.
- The scroll cue GLIDES instead of jumping: a ~700ms eased rAF animation
  with the root's snap AND smooth-behavior released during the ride
  (both fought the animation), aimed at the next card's real top (the
  sticky nav shifts every card down; a blind viewport hop landed short).
  Verified: three consecutive glides land exactly on card tops.

## [0.68.4] — 2026-09-08 — the scroll escapes the footer; real shapes on About

- The Home page tail (invitation card + footer) opts out of the snap
  system entirely: snap-end on the footer trapped the scroll at the
  bottom (couldn't scroll back up). Free tail = reachable down AND
  escapable up; the magnet still runs hero→proof.
- Website /about swaps the hand-drawn placeholder shapes for two real cut-
  outs, chosen not random: the teal beginning-figure up top (the site's
  traveller) and the joyful pink figure at the closing block.

## [0.68.3] — 2026-09-08 — release.sh learns to share the tree

- The clean-tree check refuses only STAGED-but-uncommitted changes now.
  Two sessions share this working directory as a matter of course; a full
  clean-tree bar blocked one session's sealed release on the other's
  in-flight files — and pushed people around the script, which is worse
  (peer's refinement, adopted verbatim in spirit).

## [0.68.2] — 2026-09-08 — the legal pages live on both apexes; the Why page

- Clicking Privacy/Terms/Support on thethread.app no longer lands you on
  thefibre.app: the three documents moved to @thefibre/shared/ui/legal-docs
  (one implementation, incl. the prose kit) and are served on BOTH hosts
  under identical paths; FOOTER_LINKS point at the thethread.app copies.
  The fibre pages remain as thin wrappers.
- The default (yellow) footer is now shared too — @thefibre/shared
  ui/marketing-footer, brand-fixed colours — rendered by the website AND
  the fibre public pages, so it truly is on every page.
- NEW /why — "For people who bring people together": simple interface,
  quick editing, duplicate anything, fully serviced, one place, a fair
  price. In the nav and the footer.
- Home card 2: heading a full pt-40 from the top (justify-start).

## [0.68.1] — 2026-09-08 — the template cards find their colours

### Changed
- **The template cards drop the \'80s look** (Sjoerd): each of the five
  shapes wears a soft paper-cut wash in its own brand colour, and the
  element chips become round moments strung on a coloured THREAD drawn
  behind them — activities large, messages small, multi-day badges on
  the dot. Cards lift on hover; the selected one raises on the yellow
  ring. Same component everywhere (picker, hero, Templates hub).


## [0.68.0] — 2026-09-08 — products learn a rhythm (Members 0.14.0)

### Added
- **Product pricing intervals** (Sjoerd: "a dropdown: per week, month,
  year, once-off"): a product's price is now One-time / Per month / Per
  year. One-time bills on the first invoice as before; a recurring
  product joins the member's subscription as an extra line — and is only
  offered on the join page when the membership shares its rhythm (Stripe
  allows one interval per subscription; the checkout refuses mismatches
  server-side with an honest message). Weekly is reserved in the schema
  for the day weekly tiers exist. Join page shows "+ €X / month" on
  recurring extras; migration applied to both DBs; all copy ×6.


## [0.67.8] — 2026-09-08 — the access door moves to where the question lives (Members 0.13.2)

### Changed
- **"Sync overview" is now "Access status", and it lives on the Members
  page** (Sjoerd: "why is that button there? it is products") — the
  ledger answers a members question ("has everyone who paid actually
  been let in everywhere?"), so its door belongs with Members; Products
  returns to being purely the catalog. Help copy follows, ×6.


## [0.67.7] — 2026-09-08 — the standard shapes show where people look

### Fixed
- **"I see no default templates"** (Sjoerd, on the Templates page — the
  natural place; the shapes only lived in New-thread and the first-event
  hero): the Templates hub now carries a "Standard shapes" section with
  the five cards, each linking into a pre-selected New thread. The
  New-thread picker also fails loudly (translated note) instead of
  silently hiding when the library cannot load.


## [0.67.6] — 2026-09-08 — The Thread is the name; Zierikzee is the place

- ENTITY gains publicName 'The Thread' (registered business name of
  Solidarity Lab B.V.); address corrected Rotterdam → Zierikzee (fixes
  every email footer via legalFooterLine and all invoice seller blocks in
  one move).
- Public surfaces now say The Thread, never the legal name: website footer
  (entity block removed, © line simplified), website about ("a small team
  in the Netherlands"), fibre public-pages footer, fibre landing footer,
  fibre about. The legal name survives only in brackets where the law
  wants it: terms §1 "The Thread (Solidarity Lab B.V., … Zierikzee …)",
  privacy controller lines, invoice seller blocks. Terms venue "court in
  Rotterdam" → "the competent court in the Netherlands".

## [0.67.5] — 2026-09-08 — yellow footer, both doors on support, atomic release

- Website footer turns brand yellow with black type (was dark ink/white) —
  Sjoerd's call.
- thefibre.app/support gains "Coming from The Thread?" (hello@thethread.app
  — one service, either address) and the public pages' footer grows up:
  entity + address, link to The Thread, support address, and the safe-data
  line.
- scripts/release.sh — the atomic tail of the ritual (guard → ten-file
  version consistency → clean-tree check → pnpm verify → push, one set -e
  script), born from the 928898c incident where a broken && chain pushed
  past a guard refusal. Pushes should go through it from now on.

## [0.67.4] — 2026-09-08 — both brands in the legal pages; mobile snap released

- Terms of use §1 now names both doors: The Thread (thethread.app and
  subdomains) and The Fibre (thefibre.app) as one service operated by
  Solidarity Lab B.V. — "these terms apply whichever of the two doors you
  came in through". Platform definition refreshed post-domain-flip (apps
  live on thethread.app subdomains); TERMS_UPDATED bumped. Privacy
  statement title + standfirst likewise cover both brands. (Both documents
  remain lawyer-unreviewed.)
- Website mobile: scroll-snap drops to proximity under 768px — mandatory
  snapping trapped the scroll on anything taller than one viewport (the
  footer, tall cards), hiding content. Desktop keeps the full magnet.

## [0.67.3] — 2026-09-08 — website: the ready-made shapes reach /pricing

- /pricing notes gain "Ready-made shapes." — one on Free, five on Starter,
  own designs on Pro; the five named (wording from the Thread-templates
  session). build-plan 1e groomed to CONTENT-DONE.

## [0.67.2] — 2026-09-08 — THE CUT: thethread.app serves the new website

- Sjoerd moved apex + www onto the thefibre-website Vercel project (his
  dashboard click; DNS untouched — same account). Verified live: new Home
  at the apex, /pricing 200 (V3's redirect to thefibre.app is gone),
  /workshop with the problem pairs, /login → app.thethread.app, www →
  apex, TLS valid.
- smoke-prod.mjs asserts the new apex (title + fabric line, /pricing 200,
  /login forwards to the app); build-plan item 0 groomed (remaining:
  archive thethread-v3 after the V3 Stripe-webhook delete; optional
  TransIP A → 216.150.1.1).
- Housekeeping: commit 928898c carried these files but was mislabeled
  "v0.67.1" with no bump — a collision with the Thread-templates release
  landed in the same minute; this release restores serialization.

## [0.67.1] — 2026-09-08 — five shapes for a gathering (Thread 3.38.0)

### Added
- **The standard event templates** (Sjoerd: "just 5 variations of
  events"; build-plan 1e's content, live): Single event · Two-day event
  (ONE element whose settings stretch it — never separate items) ·
  Guided event · Workshop series · Conversation circle. Platform-owned,
  code-defined blueprints; chosen at New thread, elements arrive as
  ready-to-configure draft engagements with triggers wired; enrolment
  confirmation stays the seeded system messages.
- **The plan gates mean it now**: thread_template_limit slices which
  templates a plan may pick (Free 1 / Starter 5 / Pro all); adding or
  removing timeline elements requires thread_custom_templates — Free
  configures every element's settings, never the structure (server
  enforced, editor affordances follow; seeded system messages stay
  tidy-able).
- **Onboarding steers to the first event**: a Thread dashboard with zero
  threads leads with "Organise your first event" — the five template
  cards inline, one click into a pre-selected New thread. Derived from
  data, no wizard state. All new chrome ×6 locales.


## [0.67.0] — 2026-09-08 — website: every tool gets its recognisable problem

- /workshop: each tool now opens with "Sound familiar?" — the itch a
  facilitator knows by name (the five-places spreadsheet truth, the
  seventeen-email hour, the register nobody trusts, the December surprise,
  the people falling between steps) — followed by "So we built it away."
- Home card 2 pinned to exactly one viewport (h-[100svh]): the collage
  keeps falling off the page, but the SCROLL cue is always on screen.
- The footer is a snap stop (snap-end) — the mandatory snap magnet was
  bouncing back off the last card, making the footer unreachable on Home.

## [0.66.1] — 2026-09-08 — website: each card's scroll cue takes a shape colour

- The SCROLL cue changes colour per card, drawn from the cut-outs:
  turquoise (hero), orange (fabric), bordeaux (moment), royal blue
  (workshop), magenta (Fibre), green (starts-there), ochre (arc), navy
  (proof).

## [0.66.0] — 2026-09-08 — website: Start a Thread is a popup on our own apex

- Every "Start a Thread" CTA (nav, Home invitation + bottom button, pricing
  cards, workshop, about) now opens a dialog on thethread.app itself
  instead of hopping to thefibre.app/request-access: name, email,
  organisation, "What are you weaving?", hidden desired_plan. Submits
  server-to-server to the same public POST /api/v1/signup-requests the
  Fibre form uses (apps/website/app/actions.ts mirrors the proven action);
  success states cover auto-approved ("You're in" + sign-in), pending, and
  already-requested. Enterprise keeps "Talk to us" → /contact.
- The apex cut is approved by Sjoerd ("it's already better than what we
  have now"); the Vercel domain move needs his dashboard click — the API
  route is blocked for the agent by the permission classifier.

## [0.65.0] — 2026-09-08 — website: cues on every card, richer story copy

- The turquoise SCROLL cue now sits next to the thread line on EVERY card
  (components/scroll-cue.tsx — each thread segment exits at a known
  x-fraction; the cue sits just right of it; click scrolls one viewport
  and the snap magnet lands the next card). The last card carries a yellow
  "Start a Thread" button at the bottom instead, next to the thread's end
  hook.
- Moment card grows Sjoerd's facilitator line: "Every encounter matters —
  the facilitator knows this. When every moment of contact is curated, the
  experience becomes a learning journey."
- The forms of gathering vary across the story (his list): workshop /
  hackathon / festival on card 2; meeting / party / learning process on
  the workshop card; dinner / forum / large-scale intervention on the
  starts-there card.

## [0.64.1] — 2026-09-08 — website: the moment-vs-journey card

- New card between the fabric and the workshop: "An event is a moment. It
  starts, and it stops." / "A thread is there to weave moments together —
  into a journey." Thread segment spliced into the chain (700 → 700, a
  wander off-centre and back), workshop handoff untouched.

## [0.64.0] — 2026-09-08 — website: the serious footer

- Footer rebuilt as a dark four-column band on every page: brand + entity,
  Explore, Legal & help (privacy / terms / support, reusing the Fibre's
  public documents), and "Built on The Fibre" — the platform reference plus
  the real stack (PostgreSQL with row-level security on Supabase EU-West,
  API on Fly.io Frankfurt, payments by Stripe, hosted in the EU end to
  end). Beneath it, "Our commitment to safe data" in the accent: minimum
  justified storage, EU hosting, erasure on request, nothing sold or
  profiled — GDPR by construction, not by checkbox.
- Nav is 20% transparent once scrolled (bg-surface/20, soft blur) so the
  thread runs visibly behind it.

## [0.63.4] — 2026-09-08 — website: air around the story

- Card 2's text sits further off the top (pt-28) and every story section
  gains 40px extra margin on each side of the centre container
  (md:px-10 → md:px-20), Scene included.

## [0.63.3] — 2026-09-08 — website: turquoise scroll cue

- The hero SCROLL cue (text + bouncing arrow) is turquoise (#2fb3ab),
  matching the teal of the paper cuts.

## [0.63.2] — 2026-09-08 — website: the coming-together turns physical

- ScrollCollage v3: scroll position now only sets each piece's TARGET; the
  piece chases it with its own exponential lag (per-piece speeds). Ease-in
  and ease-out fall out of the physics; pieces are still settling after the
  card arrives, and scrolling on before completion reverses the chase
  mid-flight — the picture falls apart from wherever it got to. Styles are
  written imperatively in one rAF loop (no per-frame React renders).
- Hero scroll cue smaller (11px, smaller arrow).

## [0.63.1] — 2026-09-07 — website: left-aligned two-column story

- Text left-aligned again (the right-align was Sjoerd's mistake, reverted)
  and every story text block restructured as two columns — heading left,
  body right — inside one consistent centred container (max-w-6xl):
  card 2, "The Thread starts there.", and the invitation (CTAs left-set);
  arc + proof widened to the same container.
- Hero scroll cue moved next to the thread line with a little bouncing
  down-arrow, set in the payoff's type (13px/lg bold uppercase, 0.22em).

## [0.63.0] — 2026-09-07 — website: the one-sentence cards come out

- Removed the six litany scenes ("A gathering is a cut in time." through
  "Most event platforms stop at the event.") — the Home now runs hero →
  fabric → workshop → Fibre → "The Thread starts there." → arc → proof →
  invitation (~8 viewports, was ~14). The thread re-chained across the cut
  (Fibre exits left at 220, the starts-there segment sweeps 220→560 into
  the arc). Constellation/star wiring dropped from Home along with the
  unused thread keys.

## [0.62.1] — 2026-09-07 — website: the thread is simply there

- No white interruptions (Sjoerd): the draw-on-scroll scrub is removed from
  DrawnThread — the line is fully laid end to end at every scroll position,
  like a thread that has already fallen on the paper. begin/end props stay
  in the signature but are inert.
- Hero segment moved into the whitespace between the left edge and the
  wordmark; card 2's segment re-chained to pick it up there and sweep
  across the fabric to the workshop handoff.

## [0.62.0] — 2026-09-07 — website: one fallen thread, text to the right

- The thread is redesigned as ONE line fallen on a long white paper: it now
  starts at the top of the hero, wanders left/right/centre with exact
  x-handoffs between every card (hero → fabric → workshop → fibre → the
  seven litany scenes → arc → proof → invitation), curls twice on the way
  (a pigtail on the workshop card, a snag in the litany) and ends in an
  open hook beside the final CTAs — no more repeating centre swirl. The
  arc, proof and hero sections now carry the thread too, so nothing breaks
  the line.
- Story text is right-aligned throughout (Sjoerd's rule: never centred) —
  card 2's block, the workshop/Fibre columns, every litany sentence, and
  the invitation incl. its buttons.

## [0.61.1] — 2026-09-07 — website: card 2 almost full with illustration

- The fabric collage now dominates card 2: heading collapsed to one line,
  smaller paragraph, collage cap raised to 130svh and the arrangement itself
  opened out to use the whole canvas (same composition, scaled up and spread
  vertically).

## [0.61.0] — 2026-09-07 — website: the cards learn to move with the scroll

- Home cards 2–4 are now a connected sequence: the collage COMPILES as a card
  scrolls toward centre and FALLS APART as it leaves (scroll-scrubbed, not a
  one-shot trigger — components/scroll-collage.tsx). Pieces enter from beyond
  the real screen edges (sides + bottom, vectors in vw/vh); traveller shapes
  exit down one card and arrive from the top of the next (yellow egg 2→3→4,
  teal figure 2→3, black leaf 3→4). The drawn thread now runs behind all
  three cards, connecting them to the litany below (segments re-alternated).
- NEW card 3 "The workshop." — text left / Sjoerd's portrait composition
  right: weaving explained, Meet and Members introduced by name, other tools
  "still on the workbench".
- NEW card 4 "Underneath it all: The Fibre." — art left / text right:
  contacts and personal information held with the highest integrity.
- Card 2 collage bigger (88svh cap).
- Pricing: why-these-prices note (low and affordable, but fair to
  development), Stripe's own processing cost stated plainly, fair-use
  paragraph (emails, storage) — all qualitative, no hardcoded numbers.

## [0.60.0] — 2026-09-07 — website: the social-fabric slide, made of Sjoerd's real paper cuts

- Home slide 2 — "Weaving the social fabric. In companies. In society." with
  a practical paragraph on what The Thread is, above a collage of Sjoerd's 19
  Matisse-style cut-out PNGs (apps/website/public/shapes/). The collage
  assembles itself as the card scrolls in: each piece drifts from its own
  direction and settles into his reference arrangement
  (components/fabric-collage.tsx — server renders ASSEMBLED; the scatter
  applies client-side only, so no-JS and reduced-motion readers see the
  finished picture). Transparent borders trimmed off the PNGs (headless-
  Chromium canvas — no ImageMagick on this machine) so sizing is predictable.
- Hero — the payoff line "Tools to facilitate change." starts 30px right of
  the wordmark's left edge (Sjoerd's call, verified live).

## [0.59.6] — 2026-09-07 — website: the cards become magnetic (Sjoerd's live review)

- Full-page cards with scroll-snap — a scroll pulls the next card in
  "like a magnet"; SCROLL is now a click that opens the story. (Gotcha
  earned: overflow-hidden on <main> silently made IT the snap container —
  clipping moved onto each card.)
- Nav links get a light-grey shape on hover.
- Under the wordmark: "Tools to facilitate change."


## [0.59.5] — 2026-09-07 — website: the yellow button squares up

Sjoerd's live review of the unfolding Home ("looks great"): the nav's
Start-a-Thread CTA goes from pill to squared with light radius.


## [0.59.4] — 2026-09-07 — Home unfolds

The Home page rebuilt to Sjoerd's direction (reference: counder.com): an
UNFOLDING STORY — one sentence per viewport, the key word inked while the
rest stays muted; the litany is the story. A single thread draws itself
down the page's centre (per-scene segments, centre handoffs, stitch-like
joins); Matisse cut-outs gather like a constellation as the story fills
with people — one cut, then a few, then a gathering, then the fabric.
Opens with the wordmark alone on white and a SCROLL line; closes through
the turn, the arc cards, quiet proof, and "Start with one gathering."
New components: scene.tsx (Scene/Line/Ink), constellation.tsx (parallax
star-field of shapes). Reduced-motion/no-JS: every sentence simply there.


## [0.59.3] — 2026-09-07 — the workshop page, Sjoerd's way

The website's product page redone to Sjoerd's spec after his review:
**"By facilitators, for facilitators."** as the banner, the workshop
concept intro, then the apps NAMED — The Thread, Meet, Members, Pulse,
Flow — each with its real Matisse tile (the launcher-poster crops, served
from the fibre brand SPoT via `tileArtUrl`, never copied) and a plain
feature list. The overall site design remains awaiting Sjoerd's own
design (build-plan verdict stands: no cut).

## [0.59.2] — 2026-09-07

## [0.59.2] — 2026-09-07 — the workspace becomes the public face (Thread 3.37.0)

### Added
- **Workspace public URLs** (docs/brief-workspace-urls.md — "It is the
  organisation"): a thread can publish under the WORKSPACE's slug —
  `app.thethread.app/{workspace}/{thread}` — with the deeper addresses
  `/{workspace}/{organiser}/{thread}` and `/{workspace}/{organiser}`
  also resolving. New-thread and the editor offer Personal / Team /
  Workspace with a live URL preview; embeds and "Open public page"
  follow the canonical owner. Old organiser/team addresses stay
  resolvable (canonical link tag names the real one). One slug
  namespace: workspace slugs win — organiser/team slugs matching a
  workspace are refused. All public API changes additive (rule 8);
  `public_scope` migration applied to both DBs.


## [0.59.1] — 2026-09-07 — the new thethread.app website (awaiting Sjoerd's cut)

Executes `docs/thethread-website-rewrite-plan.md`: the seventh app,
`apps/website` — The Thread's marketing site, replacing the old V3 landing
once Sjoerd approves the preview and the apex moves.

### Added
- **`apps/website`** (dev :3006, Vercel project `thefibre-website`,
  git-connected with rootDirectory set — deploys per push like the others).
  Light-only, static-first, 102 kB first-load, zero runtime deps beyond
  Next/React + shared constants. Five pages in the brief's voice:
  - **Home** — the six beats: the litany hero, "Most event platforms stop
    at the event. The Thread starts there.", the arc as three settling
    cards, the workshop as four verb-sentences (tools by function, never
    named as products), unnamed-truths proof, "Start with one gathering."
  - **/workshop** — the product tour organised by the arc (replaces V3's
    engineer-voiced /features; /features 301s here).
  - **/pricing** — live catalogue (same endpoint the product gates on;
    the fee is a fraction in the payload — rendered ×100; Enterprise =
    `org`, no public price, "Talk to us"). Designed empty state.
  - **/about** — the V3 Matisse essay ported nearly untouched + a
    two-sentence "who makes this".
  - **/contact** — hello@thethread.app; Enterprise is a conversation.
- **The visual identity**: cut-out shape library (5 shapes, ONE path each),
  `ShapeMask` (photos clipped in shapes; degrades to solid until consented
  photography exists), the **drawn thread** (scroll-drawn line, vanilla
  ~60 lines, per-section segments, fully drawn without JS/motion), and
  `Settle` (paper placed by hand; server renders settled — no-JS and
  reduced-motion never hide content, zero CLS).
- Favicon + OG image for this surface (the P5 gap): `app/icon.svg` +
  generated `opengraph-image`.
- `/login` + `/signup` redirect to app.thethread.app (V3's obligation
  inherited); footer legal links reuse the Fibre's public pages.
- Ops: version ritual is now TEN package.jsons (CLAUDE.md + handbook);
  verify-vercel-env audits `thefibre-website` (prod
  NEXT_PUBLIC_API_BASE_URL only); `.claude/launch.json` for :3006.

### Still ahead (Act 2 + the cut)
Sjoerd reviews the live preview → the apex + www move from the
`thethread-v3` project (then smoke/E2E gain the new-apex assertions, and
V3 can be archived). Scissors hero animation + photography pass follow.

## [0.59.0] — 2026-09-07 — Meet catches up with Suite: Zoom, moving a booking, fair rotation

## [0.59.0] — 2026-09-07 — Meet catches up with Suite: Zoom, moving a booking, fair rotation

The Soul Suite comparison written this morning
(`docs/meet-vs-suite-parity.md`) listed ten things Suite v1 had that Meet
didn't. The five that would bite a Suite user on cutover day are done.

### Added
- **Zoom conferencing** — per-user OAuth at Settings → Integrations, then a
  real Zoom meeting created for every booking on a Zoom meeting type: link
  in the calendar event, the confirmation email, the booking. Moved on
  reschedule, deleted on cancel; a cross-org co-host on a collective booking
  falls back to creating it without them rather than failing.
  The credential lives in the connections SPoT (`user_connection`, never
  `meet_host`), and `lib/zoom/host.ts` is the ONE caller that may refresh it
  — Zoom rotates the refresh token on every use, so it caches, coalesces
  concurrent refreshes, and persists each rotation.
  **Off until `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` exist on Fly** — see
  docs/deploy.md § Zoom for the Marketplace app steps (Sjoerd).
- **Reschedule** — the link that has sat on the confirmation page since v0.12
  now goes somewhere: `?reschedule=<booking id>` turns the booking page into
  "pick a new time", and `POST /meet/public/bookings/:id/reschedule` moves
  it. **The booking keeps its id** — the purchase ledger points at it by
  `item_ref`, so cancel-and-rebook would orphan the payment. The Google event
  is patched in place, so the join link survives; both sides get a "moved"
  email with the old time struck through; activity gets a new
  `meeting_rescheduled` row (append-only, never an edit).
- **Round-robin fairness, per meeting type** — least-loaded (still the
  default), whoever waited longest, strict rotation, or random.
  `lib/meet/round-robin.ts` is pure and unit-tested; "last assigned" is read
  back off the bookings, so there is no counter to drift.
- **Per-team availability** — `meet_team_member_hours`: narrower hours that
  apply only to a team's meeting types, set from the team page by a lead (or
  by yourself). Resolution: meeting-type override → team override → personal
  hours.
- **"Add to calendar"** — one `.ics` builder in the API, on the confirmation
  page and in the confirmation email.
- **Reimburse a paid booking from its detail dialog** — through the ONE
  refund path (`POST /purchases/:id/refund`), with the confirm dialog now
  extracted to `@thefibre/shared/ui/refund-confirm` and shared with the
  Invoices page. `GET /purchases/by-ref` is the new lookup.

### Fixed
- A meeting-type working-hours override was silently ignored for
  round-robin / collective types — `buildPerHostArgs` only ever read the
  host's own hours. It now layers properly.
- A Zoom (or any non-Google) join URL is no longer wiped when the calendar
  event is created without a Meet link.

### Docs
- `docs/meet-vs-suite-parity.md` — the full two-way comparison and what is
  deliberately still open (PWA, branding on public pages, retry-finalize,
  dirty-nav guard; onboarding belongs to `onboarding-proposal.md`).


## [0.58.10] — 2026-09-07 — the poster is whole; the art reaches home

### Changed
- **The launcher popup fires at LOGIN, not once per browser session**:
  the auth callback stamps a one-shot cookie the dashboard consumes —
  "I logged in — no popup" can't happen again (and if you ticked
  "Don't show at login" earlier, the switch lives in Settings →
  Profile → App launcher).
- **All eight apps are the tapestry**, in Sjoerd's order: The Fibre,
  The Thread, Meet, Members / Pulse, Flow, Sales, Learn — the unbuilt
  two close the weave as muted coming-soon tiles (their crops were the
  fillers all along).
- **The art reaches each app's home**: the sidebar's top-left brand tile
  shows the app's Matisse crop in all six apps (served from fibre web,
  env-aware; letters fall back if a tile 404s).
- **The app-switcher dropdown follows the canonical order** (The Fibre
  first) via shared APP_DISPLAY_ORDER — one order, three surfaces.


## [0.58.9] — 2026-09-07 — the tiles carry Sjoerd's names

### Changed
- Tile filenames follow Sjoerd's naming ("I took away the name fibre —
  the apps are not fibre anymore, they are thethread"): thethread /
  meet / members / pulse / flow / fibre .png, slug names as fallback.
  The v0.58.8 commit had raced his Finder renames; disk and code agree
  now. Known: meet.png is currently a byte-copy of members.png — swap in
  the real Meet crop whenever.


## [0.58.8] — 2026-09-07 — the tapestry hangs

### Added
- **Sjoerd's Matisse crops ship**: eight 600×600 tiles in
  `public/brand/apps/` — six apps + two fillers — and the launcher
  poster renders them. Filenames normalized to the slug convention;
  swapping art stays a file swap.


## [0.58.7] — 2026-09-07 — The Fibre joins its own tapestry

### Changed
- **The Fibre is the sixth tile** in the launcher poster ("and where is
  fiber?") — closing the weave in the backstage position, linking home.
  Six apps + two fillers complete the 4×2 grid; the filler count now
  adapts so the poster always fills to eight cells. Art filename:
  `fibre-platform.png`.


## [0.58.6] — 2026-09-07 — the launcher becomes a tapestry

### Changed
- **The launcher popup is one poster** (Sjoerd: "the icons together make
  up one poster — 4 on a row, 2 rows… a tapestry"): square Matisse-crop
  tiles in a 4×2 weave — the five apps in order (The Thread, Meet,
  Members, Pulse, Flow), decorative crops completing the grid. Art is
  picked up by convention from `public/brand/apps/` (`<slug>.png`,
  `filler-N.png`) the moment the files exist; until then the yellow
  letter tiles stand in. The inline "Your apps" section keeps the card
  style and also shows per-app art when present.


## [0.58.5] — 2026-09-07 — fixtures learn what append-only means; the charge is rehearsed

### The rehearsal (not code — for the record)
The **first end-to-end card charge is rehearsed**: staging join page →
country-aware pricing → Community member + the €50 optional product →
real Stripe sandbox Checkout (test card) → webhook → **ACTIVE member**,
€350 ledger row labeled with the until-date, product purchase recorded —
all verified server-side. The optional-products code and the
dashboard-governed payment methods were both exercised live. The first
LIVE charge is now just a customer.

### Changed
- **Enrolment fixtures reuse permanent workspaces**
  (`int-enrol-fixtures` / `e2e-enrol-fixtures`): the activity append-only
  trigger blocks even service-role deletes, so a workspace that ever
  hosted an enrolment can never be hard-deleted — throwaway-and-delete
  was structurally impossible (seven silently-leaked shells on staging
  are now labeled `retired-*`; fixture persons soft-deleted). Teardowns
  now surface every error instead of swallowing them — a silent teardown
  failure is exactly how the shells leaked.
- Old Thread V3: down to ONE dashboard click (delete the test-mode Stripe
  webhook endpoint; the API deletion attempt was permission-blocked —
  endpoint id in build-plan).

## [0.58.4] — 2026-09-07 — Membership displays as "Members" (Members 0.13.1)

### Changed
- **The Membership app is called "Members"** (Sjoerd) — one branding.ts
  line; slug `membership` and the domain never change. Launcher, sidebar,
  app switcher, help, settings hub follow the registry.
- The stray hardcoded display-name literals now DERIVE from the registry
  (Powered-by footers, embed iframe title, dashboard tab title, contact
  profile tab label, nav home key) — the next rename is truly one line.


## [0.58.3] — 2026-09-07 — the launcher learns manners

### Added
- **"Don't show at login"** checkbox on the launcher popup — persistent
  (per-browser pref, like theme/sidebar), with its reset switch under
  Settings → Profile → App launcher.
- The dashboard's inline **"Your apps" section folds** via a chevron on
  its heading; the fold is remembered.


## [0.58.2] — 2026-09-07 — the launcher pops; Thread is The Thread

_Renumbered from a second 0.58.1: the sessions' messaging channel was
one-directional for part of the day and two releases took the same number
twice in a row. Content below is unchanged (shipped as dd30250)._

### Changed
- **The launcher is a popup** (Sjoerd's preference): on entering the
  dashboard it opens above the page on a dimmed backdrop — once per
  browser session, dismissed by Esc, the backdrop, or ×. The same tiles
  stay inline below the stats so apps remain one click away afterwards.
- **"Thread" displays as "The Thread"** everywhere — one branding.ts
  line (the registry is the SPoT); shortName stays "Thread" for tight
  chrome. The live-title smoke check derives its expectation from the
  registry, so it goes green with this deploy.
- /admin/plans column headers say "N on this plan" — the adoption count
  read as if it were an allowance ("why does starter have no
  workspaces?" — nobody has bought Starter yet; that's all it meant).


## [0.58.1] — 2026-09-07 — the enrolment golden path, walked by a browser

The last automatable golden path: a stranger enrols in a published thread
and finds it on /my — proven both server-side and in a real browser.

### Added
- **Public-thread fixture** (integration harness + E2E twin): the minimum
  viable PUBLISHED thread — throwaway workspace, organiser, ACTIVE
  program, public-listed thread, NO tickets — so the enrol route takes the
  free path without ever touching the rehearsal workspace's Stripe rig.
  Full teardown includes everything the enrol flow auto-creates (person,
  platform user, auth account).
- **`enrol-free.int.test.ts`** (34 integration tests total): POST
  /thread/public/enrol → 201 with `has_account: true`; the oracle confirms
  thread_enrolment (payment_status `not_required`) + person + platform
  enrolment; same request_id replays idempotently (still one row); missing
  policy agreement refused.
- **E2E golden path #7**: the fixture thread renders publicly (title +
  intention), the API enrolment lands, and the auto-created participant
  signs in via a minted handoff to see the enrolment on /my. The
  Stripe-card variant stays a supervised rehearsal on the rig, on purpose.
- e2e helpers: `createPublicThread`, `signedInLandUrlFor` (handoff mint
  for a specific participant), `authUserByEmail`.

### Note on the version line
- v0.56.1/v0.56.2 were released AFTER v0.57.2 with backwards numbers, and
  two sessions then both picked v0.58.0 within seconds (cross-session
  messaging is down — coordination is git-only right now). The launcher
  release keeps 0.58.0 (it landed first); this one is 0.58.1. Line
  re-anchored; nothing else about those releases needs correcting.

## [0.58.0] — 2026-09-07 — the front door: a launcher and a welcome

### Added
- **The dashboard leads with your apps** (Sjoerd: "big buttons, with the
  apps that are part of your seat"): a hero grid of large tiles — brand
  tile, name, tagline — for exactly the apps activated for the workspace
  AND on your seat, Thread first. Stats and activity read below; the old
  bottom-of-page list is gone.
- **First login walks you through your settings**: an empty
  identity_profile (derived — no wizard state, per the onboarding
  proposal's rule) routes to /welcome, a two-step sequence wrapping the
  EXISTING profile form and language picker. Skippable at every point;
  the dismiss cookie (thefibre.welcome) is the only stored bit; finishing
  lands on the launcher. The per-app "Set up" checklists from
  docs/onboarding-proposal.md remain open (D1–D3).


## [0.56.2] — 2026-09-07 — payment methods follow the dashboard

### Changed
- All five payment-link/checkout flows that pinned card-only now use
  Stripe's dynamic payment methods — enabling iDEAL, SEPA Direct Debit,
  Bancontact etc. in the dashboard's payment-method configuration takes
  effect everywhere (the membership join + à-la-carte buy flows already
  did). Cheapest rails for Dutch members: iDEAL flat ~€0.29 vs ~1.5%+
  for cards.

## [0.56.1] — 2026-09-07 — the join page's optional extras actually appear

### Fixed
- The public catalog route never split optional tier products from
  included ones (the v0.47.0 round was interrupted before the public
  half): optional add-ons listed under "Includes" and the tick-box
  extras section never rendered. Caught live during the staging
  browser tour; the admin API and the join-form wiring were already
  correct.

## [0.57.2] — 2026-09-07 — the hook survives a mixed-case email

The v0.57.0 finding, fixed and locked. Migration 20260907190000 wraps the
access-token hook's email join in lower() on both sides — a mixed-case
email in `public."user"` used to mint a token with NO custom claims (a
silent, claim-less sign-in; auth varchar vs citext defeated the case
folding). Regression `hook-case.int.test.ts` reproduces the exact trigger
(lowercase auth email, mixed-case platform row) and was run RED before
the migration, GREEN after, on staging — then the migration went to prod.
31 integration tests. `docs/build-plan.md` 0a finding closed.

## [0.57.1] — 2026-09-07 — the language follows you; dropdowns stop hiding (Meet 2.7.1)

### Fixed
- **The interface language now follows the user to every device** (Sjoerd:
  NL on desktop, English on his phone): the thefibre.locale cookie is
  per-browser, and layouts never fell back to the durable copy. /auth/me
  additively carries `locale` (identity_profile) and all six layouts
  resolve cookie-first, profile-fallback. The distinction stands as
  designed: interface language = the user's one setting, everywhere;
  public/front-end pages = the workspace's/content's language.
- **SearchSelect grows drop-up collision handling** (the queued 3a3 item):
  the panel flips upward when the space below — measured against the
  nearest overflow-clipping ancestor, not just the viewport — cannot fit
  it. Fixes the timezone dropdown rendering invisibly outside Meet's
  public booking card (Sjoerd's screenshot); verified rendering locally.
- **thethread.app's dead Sign in / Sign up** (old V3 landing): /login and
  /signup now redirect to app.thethread.app — shipped from the
  thethread-v3 repo (e4fbe77), live.


## [0.57.0] — 2026-09-07 — the tenancy matrix: two real users, one wall

The strongest test the platform now has: two throwaway workspaces, two
REAL staging auth users with hook-stamped sessions, and eight assertions
that the data wall holds in both directions.

### Added
- **Auth-fixture harness** (`src/integration/staging.ts`):
  `createThrowawayWorkspace` / `createFixtureUser` — a real GoTrue user +
  `public."user"` row, session minted via `generateLink` → `verifyOtp`
  (no email), then an RLS client built the `userClient` way (anon apikey +
  pinned Bearer — `persistSession:false` silently DROPS the session
  otherwise and every query runs anonymous, which fails open-looking).
- **`rls-matrix.int.test.ts`** — claims name the right tenant; reads stay
  inside it (own program visible, B's program/workspace/person/user rows
  invisible); writes stay inside it (cross-tenant update touches 0 rows,
  insert into the other workspace refused, delete refused) — each denial
  double-checked against the service-role oracle. 30 integration tests
  total, all green.

### Found while testing (queued in build-plan 0a)
- The access-token hook's `au.email = u.email` join resolves
  case-SENSITIVELY (auth varchar vs citext): a mixed-case email in
  `public."user"` yields a token with NO custom claims — a silent,
  claim-less sign-in. Real flows write lowercase; hardening migration
  (lower() both sides) queued.

### Changed
- `apps/api/tsconfig.json` excludes `src/integration/**` — test plumbing
  never compiles into the deployed dist.

## [0.56.0] — 2026-09-07 — the golden paths: a real browser walks the product

Phase 4 of the testing roadmap starts. 6 Playwright scenarios green
against staging (83 checks across all layers now).

### Added
- **`pnpm test:e2e`** — Playwright (chromium) against the staging stack
  (`e2e/`): the Fibre landing, public /pricing (Free first), the sign-in
  page, the Thread embed loader served as parseable JS, and — the one
  that matters — **a signed-in Meet dashboard**.
- **The hop machinery is the E2E session fixture**: `e2e/helpers.ts`
  mints a single-use `sso_handoff` code straight into the staging DB for
  an existing staging user and points the browser at `/sso/land?code=…` —
  the app redeems it server-side and sets its own session cookies exactly
  as a real hop does. No OTP inbox, no Google automation, no cookie
  forgery — and every signed-in E2E run re-exercises the v0.48.0 handoff
  end to end. The bogus-code degradation path (→ sign-in page, no error
  surface) is a scenario of its own.
- Guards as in the integration pack: non-staging Supabase URLs refused;
  fixture codes are e2e-prefixed, single-use, 60s TTL.

### Next
Remaining golden paths (Stripe test-checkout enrolment, /my, cross-app
switch) need a public staging thread fixture; the two-user RLS matrix
needs an auth-fixture harness — both queued in build-plan 0a.

## [0.55.0] — 2026-09-07 — the integration pack: real Postgres, real RLS

Phase 3 of the testing roadmap. 29 more tests (77 total): 22 integration
tests against the STAGING database + 7 on the Vercel build-skip guard.

### Added
- **`pnpm test:integration`** (apps/api `src/integration/`, own vitest
  config): loads `apps/api/.env.staging`, refuses to run against any
  non-staging Supabase URL, serializes files (one shared DB), and honors
  the staging rules of engagement — the rehearsal workspace is refused by
  the helper, fixtures are throwaway rows cleaned by their own refs/codes,
  addresses are @example.com (the live 5-minute scheduler sweeps this DB).
  - `rls-floor.int.test.ts` — an anonymous client reads ZERO rows from 14
    PII/tenant tables (with a service-role sanity check proving 0 means
    denied, not empty). The full two-user cross-workspace matrix still
    needs an auth-fixture harness (queued).
  - `purchase-idempotency.int.test.ts` — recordPurchase's
    update-first-insert-second: webhook-retry writes converge to one row,
    later partial writes MERGE (paid stamps paid_at without erasing what
    the first write knew), concurrent first writes don't duplicate.
  - `sso-race.int.test.ts` — the handoff claim: 8 concurrent redeemers,
    exactly one wins; replay, expiry and wrong-target-app all refuse.
- **`scripts/vercel-ignore.test.mjs`** (+ root vitest for scripts/):
  `validApp`/`pickBase`/`changePaths` extracted pure from the build-skip
  guard (CLI behavior identical); tests lock the safety posture — any
  doubt (bad arg, missing sha, shallow clone without parent) → build.
- Root scripts: `pnpm test` now also runs the scripts tests (CI updated);
  `pnpm verify:full` = the verify gate + the integration pack.

## [0.54.0] — 2026-09-07 — test batch 2: the money decisions become law

18 more tests (48 total). Two behavior-identical extractions pull the pure
decision out of its side-effect shell so the decided semantics are locked
by tests instead of folklore:

### Changed
- `lib/fees.ts` — `computeFeeCents(gross, pct, cap)` extracted;
  `platformFeeCents` unchanged in behavior. Tests pin: floor-never-round-up,
  cap applies after the pct, and **cap 0 ≠ cap null** (a 0 cap normalized
  to "no cap" would uncap real fees).
- `lib/seat-billing.ts` — `seatItemAction(currentQty, overage)` extracted;
  `reconcileSeatBilling` routes through it. Tests pin the ASYMMETRIC
  proration (decided 2026-09-04): grow → `create_prorations`, shrink →
  `none`, overage-to-zero → DELETE the item (never update-to-0), equal →
  no-op (idempotent against the webhook echo).

### Added
- `archived-workspaces.test.ts` — mocked db + fake timers lock the v0.51.2
  design: stale-on-error (an errored refresh must never empty the set —
  that would UNLOCK archived workspaces) and full-TTL backoff (no
  hot-looping the database).
- `embed-loader.test.ts` (shared) — the served /embed.js string must parse
  as JavaScript (a syntax error is a silent site-wide embed outage),
  start with its usage header, carry ns/flag/title, and keep the
  origin-from-own-script-src contract.

Deferred to batch 3: membership scheduler transitions (DB-heavy — wants
the staging integration pack), vercel-ignore base selection (wants CI as
its home). `pnpm verify` green at ship.

## [0.53.0] — 2026-09-07 — the first tests: Phase 0 + the start of Phase 2

The testing roadmap (docs/testing-approach.md, handbook §11) starts
executing. First test runner in the repo's history.

### Added
- **Vitest** in `packages/shared` and `apps/api` (`pnpm -r test`; test
  files excluded from build tsconfigs — their type safety rides vitest's
  execution until the suite earns a dedicated test tsconfig).
- **30 unit tests** on pure, high-blast-radius logic:
  - `sso-hop.test.ts` — apex comparison + crossAppHref topology (locks the
    two-apex decision: same-apex plain links, cross-apex hop links,
    staging's single-apex override behavior).
  - `branding.test.ts` — appUrl resolution order (env override → registry,
    empty-string fallback) + the v0.52.0 production topology as executable
    fact + every registry URL a clean https origin.
  - `i18n.test.ts` — makeT placeholder substitution (incl. repeats) and
    toLocale fallback (mechanism only; catalogs stay guarded by types).
  - `pricing.test.ts` — evaluatePriceLogic first-match-wins, in/not_in,
    case-insensitivity, unknown-context-never-matches (no accidental
    discounts), pct clamping, malformed-rule skipping; applyPct rounding.
- **`scripts/smoke-prod.mjs`** — read-only production smoke driven by the
  branding registry (each available app serves its own app by title, the
  thethread.app apex landing still up, API health + plans + CORS
  allow/block).
- **`pnpm verify`** — THE pre-release gate: `pnpm -r typecheck` →
  `pnpm -r test` → prod smoke → verify-public-api. Green across the board
  at ship time.
- `apps/api/vitest.config.ts` — placeholder Supabase env so importing lib
  modules (which pull in db.ts) is safe; unit tests never touch a database.

### Fixed
- Handbook locale list corrected: the six locales are en/nl/es/pt/de/fr
  (pt, not el — caught while writing the i18n tests).

### Next (testing-approach §4)
- Phase 1 CI install remains blocked on a GitHub token with `workflow`
  scope (Sjoerd). Then: money-logic extraction for platformFeeCents-style
  functions, seat-billing proration, scheduler transitions,
  vercel-ignore base selection (peer-suggested targets), the staging
  integration pack, Playwright golden paths.

## [0.52.0] — 2026-09-06 — the apps move to thethread.app

The branding pivot lands in DNS: **fibre web stays at thefibre.app; the five
delivery apps now live at app./meet./flow./pulse./membership.thethread.app**
(Thread is the flagship, so it takes `app.`). The thethread.app apex is
untouched — the old Thread V3 landing keeps serving it. This deliberately
REVERSES the v0.23.1 domain decision ("operator apps stay on
*.thefibre.app") — decided by Sjoerd 2026-09-06, with the cross-apex SSO
hop (v0.48.0) shipped first so click-through survives the split.

### Changed
- `packages/shared/src/branding.ts` — the five registry `url:` defaults flip
  to thethread.app. CORS, app switcher, dashboard cards, email CTAs and the
  embed snippet generators all follow (they derive from the registry).
- **Fallback sweep**: every `?? 'https://….thefibre.app'` default now routes
  through `appUrl()` (API: thread-payment-link, membership-payment-link,
  purchases, membership, membership-portal, oauth-provider, meet; Meet's
  public-page footers + dashboard; Thread's HOST/slug-prefix constants moved
  to the new literal). The env-override names (`THREAD_APP_URL`,
  `MEMBERSHIP_APP_URL`) keep working and now fall back to the registry.
- `routes/thread.ts` `apiPublicUrl()` reads `PUBLIC_API_URL` (canonical name;
  it read the never-set `API_PUBLIC_URL`, so the override was dead).
- `scripts/verify-vercel-env.mjs` — prod cookie-domain expectation is now
  per-project (web `.thefibre.app`, the five apps `.thethread.app`); matrix
  values may be functions of the project name.
- `app.base_url` data-fix migration (admin-catalogue truthfulness only).
- Vercel: five new domains attached (each to its own project — the
  2026-09-03 staging-misroute lesson); `NEXT_PUBLIC_COOKIE_DOMAIN` set to
  `.thethread.app` on the five moved projects. TransIP: five A records to
  76.76.21.21. Supabase redirect allowlist + Google OAuth origins widened.

### Migration notes
- **Everyone signs in once more** on the new domains (cookies don't
  re-scope). Prefs (theme/sidebar/locale) ride the SSO hop across.
- Old `*.thefibre.app` app subdomains keep serving through a short grace
  window, then get a HARD CUT (decision: accepted that already-sent email
  links — payment links, certificates, /my — die with them).
- Stripe webhooks unaffected (they point at the Fly API host).

## [0.51.2] — 2026-09-06 — the archive flag gets its gate

### Fixed
- **Archived workspaces are now actually read-locked** (the 13-month
  Free archive shipped as a flag in v0.46.0; compiling the full backlog
  surfaced that nothing enforced it): the API refuses all routes for an
  archived workspace except auth, billing (incl. reactivation),
  profile, privacy and SSO — for user sessions AND app keys — and The
  Fibre steers archived workspaces to Settings → Plan, where the
  reactivation banner lives. Zero per-request cost (60s cached set).
- Legacy tier-level grant on staging de-duplicated (its included
  product carries the identical grant; journal twins verified before
  deletion; production had none). Tier-level grants remain honored in
  code — creation was already removed.

## [0.51.1] — 2026-09-06 — the two language stores can no longer disagree

### Fixed
- **Chrome in Dutch, picker in English** (Sjoerd, live on prod): the
  language save wrote the profile row and the cookie non-atomically — a
  cookie-write failure after a successful PATCH desynced them silently
  and the picker never reverted. saveLocale is now cookie-first with
  revert-on-failure, all inside the error path; and the profile page
  SELF-HEALS: when cookie and profile row disagree, the cookie follows
  the durable row and the page repaints — opening Settings → Profile
  fixes any stale state.


## [0.51.0] — 2026-09-06 — i18n P3 complete: all six apps in six languages (Pulse 0.29.0 · Membership 0.13.0)

### Added
- **Fibre web (667 keys), Pulse (594) and Membership admin (~330) join
  Wave 1** — P3 is complete: every signed-in surface of all six apps
  renders in en/nl/es/pt/de/fr from the one Settings → Profile language
  setting. Settings, members, plan, privacy, person/org profiles and all
  curator dialogs, the entire cashflow planner (period grid, opportunity
  dialogs, charts), membership tiers/products/access/pricing rules incl.
  the Google Workspace card, and every sidebar/bottom-nav label.
- `INTL_LOCALES.pt` is now `pt-BR`, matching the catalogs' Brazilian
  register (flip together with the prose if native review prefers
  European Portuguese).

### Deliberately still English (documented decisions)
- `/admin/**` (internal super-admin surfaces), the "How The Fibre works"
  editorial explainer (authored voice — a per-locale pass of its own if
  wanted), printable invoice/receipt documents (the seller's legal
  document), raw API error pass-throughs, static browser-tab titles.

### Notes
- MT burn-down: `grep -rn "// MT"` across catalogs is the native-review
  list; NL is written to native quality and awaits Sjoerd's read. Known
  divergence for that pass: ES "Settings" (Ajustes vs Configuración).


## [0.50.0] — 2026-09-06 — i18n P3 Wave 1: Thread, Meet and Flow speak six languages (Thread 3.36.0 · Meet 2.7.0 · Flow 1.16.0)

### Added
- **The signed-in interfaces of the Thread (738 keys), Meet (399+) and
  Flow (254) are fully translated** — en/nl/es/pt/de/fr, driven by the
  Settings → Profile language setting. Every page, dialog, empty state,
  toast, table header, the thread timeline editor, the 1,500-line
  certificate builder, the flow canvas, the check-in scanner. Typed
  per-app catalogs (`lib/i18n-ui.ts`) — a missing locale fails
  typecheck; machine-drafted non-EN strings carry `// MT` for native
  review (NL written to native quality).
- **The shared chrome speaks too**: user menu, sidebar Help, bottom-nav,
  dialogs (incl. the DELETE-to-confirm copy — the typed keyword stays
  literal), the whole invoices area, invoice dialog, profile form,
  date picker (Intl month/weekday names per locale), search select,
  currency editor — via `useLocale()` context; and the server-renderable
  settings hub + help page via an explicit `locale` param
  (`chrome-server-i18n.ts`). Sidebar/bottom-nav labels translate through
  each app's catalog; app names and "The Fibre" stay brand.
- Product terms stay untranslated by design: thread, flow, run, gate.
  User content (titles, names, notes) is never translated.

### Notes
- Web, Pulse and Membership admin follow in the next release (Wave 2 in
  progress). ES "Settings" currently diverges between catalogs
  (Ajustes vs Configuración) — flagged for the native review pass.


## [0.49.1] — 2026-09-06 — Wave 0 of i18n P3: the interface learns whose language to speak

### Added
- **The UI-locale mechanism** (P3 Wave 0, Sjoerd: "P3 for all 6
  languages"): each app's layout reads the `thefibre.locale` cookie
  (`lib/locale.ts` → `uiLocale()`) and wraps the shell in
  `LocaleProvider` from `@thefibre/shared/ui/i18n-ui`; shared components
  learn the language via `useLocale()` (English outside a provider —
  public pages unaffected). The Settings → Profile language picker now
  `router.refresh()`es after a save so the chrome repaints immediately.
  Translations themselves land in the following releases (per-app
  catalogs are being written).

### Fixed
- **v0.49.0 could not build the Membership app**: the shared-tree race
  swept the layout's LocaleProvider edit into that release without the
  `@thefibre/shared/ui/i18n-ui` module and `lib/locale.ts` it imports —
  membership's Vercel build failed and the add-on-products join page
  never went live. This release completes the picture; both features
  now deploy together.


## [0.49.0] — 2026-09-06 — Membership 0.12.0: choose your extras at the door

### Added
- **Optional add-on products on the join page** (Sjoerd: "maybe the
  member can also choose a product that is offered as an option… which
  may increase the price or is included if 0"): a tier's product link
  is now Included or OPTIONAL (three-state picker in the tier dialog).
  Optional products appear as tick-boxes under the join form — a priced
  one adds a one-time line to the first payment (live subtotal shown),
  a €0 one is included when chosen. Chosen options are recorded as
  product purchases, so their access grants flow through the existing
  bought-product path — including surviving a later lapse (they were
  paid for outright). Join-page strings in all six locales.

### Notes
- Migration 20260906160000 (link `optional` flag; product-purchase
  idempotency key widened to session×product) applied to BOTH DBs.
- packages/shared version bump skipped this release (a peer session's
  uncommitted work sits in that file; my round didn't touch shared).

## [0.48.0] — 2026-09-06 — Cross-apex SSO: the session learns to hop

Phase 1 of the thethread.app domain migration (approved plan: fibre web
stays on thefibre.app; Meet/Thread/Flow/Pulse/Membership move to
app./meet./flow./pulse./membership.thethread.app). No shared cookie can
span two apexes, so before any domain moves, the session learns to travel.

### Added
- **Cross-apex SSO handoff** (`@thefibre/shared/sso-hop`): cross-apex links
  route through `/sso/hop?to=<slug>&next=<path>` on the current app → the
  API mints a single-use 60-second code bound to (user, target app)
  (`POST /api/v1/sso/handoff`, user's own JWT, JWKS-verified) → the target
  app's `/sso/land` redeems it server-to-server (`POST /api/v1/sso/redeem`,
  X-SSO-Secret) for a Supabase magic-link `token_hash` minted via
  `admin.generateLink` (no email sent) → `verifyOtp` writes a fresh,
  INDEPENDENT session on the target apex → the normal `/auth/callback`
  finishes access-check + workspace claims. The Supabase credential never
  appears in a URL; only the opaque code does. Theme/sidebar/locale prefs
  ride along (validated allowlist) so appearance follows the user across
  the apex boundary. Degradation: signed out / expired / replayed code →
  the target's own sign-in page, one click recovers.
- `sso_handoff` table (migration 20260906150000) — service-role only, the
  `oauth_code` precedent: RLS enabled, no policies, 60s expiry, race-safe
  single-use claim.
- `crossAppHref(current, target, env, next?)` — THE way to build a link
  from one app to another. Same apex → plain absolute URL (today: always,
  so production behavior is byte-identical until the domains split). The
  app switcher (`buildAppList` — now takes `currentApp`), the web
  dashboard app cards, and the Membership/Pulse `profileHref` all route
  through it.

### Notes
- Destination allowlist IS the branding registry (`APPS`/`available`) —
  no hand-written domain list anywhere, per the standing rule.
- Known trade-off: redeeming a hop invalidates the user's outstanding
  email OTPs (e.g. an 8-digit code mid-typing in another tab).

## [0.47.0] — 2026-09-06 — Membership 0.11.0: Google Workspace joins the integrations

### Added
- **Google Workspace integration** (Sjoerd: "in Lapsed, can we also
  pause the USER in Google?"): the second integration row after Circle.
  A new 'google_user' access grant kind — put it on a product and a
  member's Google account is SUSPENDED when their membership lapses and
  reactivated when they (re)join; accounts are never created or deleted.
  Works for org seats too (seats ride the same journal). Setup:
  Settings → Integrations → Google Workspace — a service account with
  domain-wide delegation + the admin email it impersonates; the key is
  write-only (stored server-side, echoed only as "connected"). The
  worker mints its own RS256 JWTs (no SDK) and runs on the scheduler
  tick beside Circle and Fibre seats. Migration on both DBs.

## [0.46.2] — 2026-09-06 — the Profile item goes somewhere

### Fixed
- **Profile 404 in Membership and Pulse** (Sjoerd hit it live on staging):
  the shared user-menu defaults its Profile item to `/settings/profile`,
  a route neither app has — they own no profile content, identity is
  Fibre's. Their layouts now pass an env-aware absolute link to the ONE
  profile editor (`appUrl('fibre-platform')/settings/profile`), threaded
  through the topbar/user-menu shims. Flow's deliberate hide stays.


## [0.46.1] — 2026-09-06 — branded auth emails: text part agrees

### Fixed
- The plain-text half of a community-branded sign-in email still opened
  with "The Fibre" while the subject and HTML said the community —
  buildText now receives the sender name. (Cross-session review nit.)

## [0.46.0] — 2026-09-06 — Membership 0.10.0: orgs hold seats, meters bill, emails come from the community

Three parallel lanes + Sjoerd's live rehearsal findings, one release.

### Added
- **Org memberships with seats** (§3.5 v1): an organisation holds a
  membership (tier × seat allowance, invoice/comped billing — org as
  payer, price × seats); its people occupy seats that get the tier's
  access grants through the same journal and workers as individual
  members. Seat management on the member dialog ("4 of 10 seats",
  add/remove soft); org lapse fans out to every seat (bought products
  exempt, as ever).
- **P4 metering**: email + storage usage against plan allowances
  (progress bars on Settings → Plan), one 80%-warning email per meter
  per month to admins, overage invoice items on the Stripe subscription
  for closed months (prices per-plan on /admin/plans; empty = soft
  allowance, nothing bills), and the 13-month Free archive (12-month
  warning w/ export pointer → soft archive flag + reactivation, never
  deletion).
- **SearchSelect async search** (loadOptions): web's person + country
  comboboxes and Flow's add-contact dialog converge on the shared
  component (~250 lines retired). Pulse's create-flow combobox stays —
  it's not a list-with-filter.
- Phase-4 shared factories: root layout, no-access page, app landing,
  invoice-pdf route — ported ×5/×4/×4/×4.

### Fixed (from Sjoerd's live testing)
- **Invoices/receipts send AS THE WORKSPACE** (sender name, reply-to,
  logo) with **our own PDF attached** — the Stripe-hosted invoice page
  is gone from emails entirely. Platform-sent invoices still come from
  The Fibre, correctly.
- **Sign-in-code emails brand as the community** when the address
  belongs to exactly one workspace's member; platform users keep The
  Fibre.
- Membership → Invoices opens on the Workspace scope (membership sales
  have no personal seller — "Me" was always empty); non-admins fall
  back to Me.
- Access page: the "Tier-level grant (legacy)" button is gone (access
  is configured on products); remaining legacy rows are labeled for
  migration.
- Membership's landing page carried Pulse's copy wholesale; its invoice
  PDF route sent X-App-ID fibre-meet (invoices mislabeled as Meet's).
  Both caught by the phase-4 sweep.

### Notes
- Migrations 20260906100000 (org members) + 20260906110000 (usage
  meters + archive) applied to BOTH databases.
- Queued next: google_user grant kind (suspend Google Workspace account
  on lapse), optional add-on products on the join page.

## [0.45.6] — 2026-09-06 — CORS origins come from the registry

### Fixed
- The API's CORS allowlist is derived from the app registry (APP_IDS x
  appUrl) instead of a hand-written list — the hand-list pattern struck
  a third time when membership.thefibre.tech was missing from staging's
  CORS_ORIGINS and blocked the join page during the payment rehearsal
  (staging secret also fixed). An eighth app can no longer be forgotten.

### Rehearsed
- **First end-to-end membership payment on staging**: join page → Stripe
  Checkout (test card) on the connected account → webhook 200s → active
  member with subscription + correct renewal → EUR 2,000 paid ledger row
  → access grants journaled. Production webhook armed and waiting for
  the first real member.

## [0.45.5] — 2026-09-05 — skip-builds diffs the whole push

### Fixed
- vercel-ignore diffed only the LAST commit (HEAD^), but Vercel builds
  once per push — an app-touching commit buried in a multi-commit push
  would have been silently skipped. The diff base is now the branch's
  last deployed sha (VERCEL_GIT_PREVIOUS_SHA) when resolvable, HEAD^ as
  fallback, build-to-be-safe otherwise. (Caught in cross-session
  review.)

## [0.45.4] — 2026-09-05 — builds only what changed

### Changed
- **Vercel skips builds for unchanged apps** (Sjoerd: €150 of usage in
  five days — every release rebuilt all six apps on both branches, ~150
  builds on the busiest day). Each app's vercel.json now carries an
  `ignoreCommand` (scripts/vercel-ignore.mjs): build only when the app's
  own folder, packages/shared, or the lockfile changed — the release
  ritual's version-bump churn (nine package.json fields) deliberately
  does NOT trigger builds. All six vercel.json files made identical in
  shape while at it.

## [0.45.3] — 2026-09-05 — the sidebar gets its height back

### Fixed
- **Desktop sidebars collapsed to a sliver in all six apps** (Sjoerd,
  live: "scroll shows the buttons are there"): v0.45.0's responsive
  wrapper around the sidebar broke its height chain — the shell's aside
  positions absolutely against a parent whose height fell to zero, so
  the nav squeezed into an invisible scroll strip. The shell root now
  carries `h-full`.

## [0.45.2] — 2026-09-05 — interval row wraps in sheet form

### Fixed
- Membership's yearly/monthly interval row inside the billing choice
  wraps at phone width (dialogs render as bottom sheets below `sm`
  since v0.45.0 — the fixed row clipped there).

## [0.45.1] — 2026-09-05 — one billing choice

### Changed
- **BillingChoice extracted to @thefibre/shared/ui** (second-use rule):
  the Invoice-or-Comped block born in Membership's Add-member and
  copied into Thread's Add-participant is one component now — apps pass
  labels/descriptions and optional sub-options (Membership's
  yearly/monthly row); the box, radios and disabled-invoice handling
  live in shared.

## [0.45.0] — 2026-09-05 — the mobile round (all six apps · bottom menu)

### Added
- **The signed-in apps are mobile-ready** (Sjoerd: "make the interface of
  fibre and thread mobile ready — bottom menu"; shipped to ALL six since
  the shell is one shared component). Below `md` the sidebar hides and a
  bottom tab bar takes over: the first four nav items as tabs plus a
  "More" sheet carrying the full sectioned nav, Help and the version
  line. `@thefibre/shared/ui/bottom-nav` (createBottomNav factory, same
  Link/usePathname injection as the sidebar shell) is fed by the SAME
  per-app `SidebarNavSection[]` arrays — one nav, two chromes. Web's
  admin sections ride along via the extracted `buildSections()`.
- **Dialogs become bottom sheets on phones**: the shared Dialog slides to
  the bottom edge below `sm` (full width, rounded top, safe-area
  padding) — every app inherits it, zero call-site changes.

### Changed
- App shells use `h-dvh` (mobile URL-bar-correct) instead of `h-screen`;
  the bottom bar is a flex sibling of `<main>`, never overlaying content.
  Desktop is pixel-identical: the SidebarShell itself is untouched.


## [0.44.1] — 2026-09-05 — one email-locale resolver

### Changed
- The auth hook now resolves the recipient's language through
  `platformEmailLocale()` (platform-i18n.ts) instead of its own inline
  identity_profile lookup — one resolver for every platform-side email.


## [0.44.0] — 2026-09-05 — auth emails speak six languages (i18n P2 complete)

### Added
- **All 8 auth emails ×6** (sign-in code, signup confirm, invite, password
  reset, both email-change confirms, reauthentication) — the last open P2
  surface. OTP codes are seen by every non-Google invitee, so this is
  effectively public. Locale: `identity_profile.locale` where the recipient
  has one (resolved in the auth hook by email, non-fatal on miss), English
  otherwise. Copy tables are `Record<Locale, …>` — a missing locale fails
  typecheck; non-EN lines carry `// MT` for native review. With v0.43.0's
  platform emails + Settings language picker, **i18n P2 is complete**.

### Fixed
- `apps/web/lib/version.ts` was committed EMPTY in v0.43.1 (a write race
  between two parallel sessions sharing the working tree) while the layout
  still imports `VERSION` from it — the web app could not build from main.
  Restored.

## [0.43.2] — 2026-09-05 — rejoining members get their access back

### Fixed
- **Rejoin grant gap**: a member who lapsed (grants revoked) and later
  rejoined never re-synced — reconcileMemberAccess's inserts no-op on
  the unique key and the revoked rows stayed revoked. Entitled grants
  now re-arm to pending on an active/grace reconcile, mirroring the
  bought-product re-arm path.

## [0.43.1] — 2026-09-05 — the shell is one component

### Changed
- **Extraction phases 2–4, app ports** (~1,900 more duplicated lines
  retired): all six apps now render their sidebar via the shared
  SidebarShell (NAV stays per-app; web passes its wordmark image and
  admin sections in), the shared UserMenu (savePref / workspace switch /
  sign-out injected), the shared TopbarFrame, the shared page-chrome kit
  (page/danger-confirm/form-error shims), and @thefibre/shared/prefs.
  Five auth callbacks (meet, flow, pulse, thread, membership) are now
  the ONE shared factory — the superset of the drifted copies, so
  thread/flow/pulse gain the verifyOtp arrival path and the magic-link
  provider mapping they silently lacked. Web's callback keeps its own
  richer flow (access-pending handling) — noted in the inventory.
- Flow's user-menu Settings link now respects the environment
  (NEXT_PUBLIC_FIBRE_URL) — the old copy hardcoded production, the same
  env-leak class as v0.39.1's dashboard cards.

## [0.43.0] — 2026-09-05 — Membership 0.8.0 · Thread 3.34.0 · Meet 2.5.0: the backlog round

Five parallel lanes (strict file ownership, one combined typecheck), plus
extraction phases 2–4 shared-side on the main line. Sjoerd's standing
order: "Once done, don't wait for me. Build everything."

### Added
- **Thread: manual adds to paid threads ask to send an invoice** (the
  Membership v0.40 pattern, ported): Add participant dialog offers
  Invoice (default, ticket-priced server-side) or Comped. Invoice parks
  the enrolment at invited/payment-pending, records the pending purchase
  (adding admin as seller), emails the invoice with a Pay online button
  on the organiser's connected account; mark-paid / payment-link /
  webhook all converge on finalizePaidEnrolment, which lifts the
  enrolment and fires the confirmation emails.
- **Membership: à-la-carte product buying** — products gain "Can be
  bought on its own"; the public page shows an Also-available grid; a
  one-off Checkout on the connected account (flat price, plan-aware fee)
  lands in membership_product_purchase (person-keyed — no fake member
  rows), grants ride the existing access journal (and survive lapse —
  bought outright), purchases show on /my, receipts carry the product
  links. i18n ×6.
- **i18n P2** — user-level UI language: identity_profile.locale (the
  profile SPoT; the proposal's user_profile is a dead fallback), profile
  API + Settings → Profile picker + domain-wide thefibre.locale cookie;
  platform welcome email now renders in the recipient's locale ×6.
  App-chrome translation is P3.
- **Workspace seats: removal + cost confirm** — DELETE /members/:userId
  (soft delete; last-super-admin and last-admin guards; re-invite
  resurrects the row), seat SHRINK bills from the next period
  (proration none) while additions stay prorated; invites past the
  allowance 402 with the server-computed monthly cost and the UI
  confirms explicitly before re-submitting. POST/PATCH /members now
  require admin (was page-redirect-only).
- **SearchSelect sweep** — meet availability + all three public-booking
  timezone pickers, thread embed generator's thread picker; shared
  SearchSelect gains a `name` prop; the shared profile form's timezone
  is a SearchSelect now.
- **@thefibre/shared extraction phases 2–4 (shared side)** — ui/page
  (align + leading superset), ui/danger-confirm, ui/form-error, ui/toast,
  ./prefs, ui/user-menu (callbacks injected), ui/sidebar-shell (factory),
  ui/topbar, ./auth-callback (superset of six drifted copies). Pulse
  fully ported (~470 lines removed); remaining app ports queued.

### Notes
- Migrations: identity_profile.locale + membership_product_purchase
  (+ product.purchasable) — applied to BOTH databases.
- Known gap queued: rejoining members' revoked tier grants never re-arm
  (fixed for bought products only) — see build-plan.

## [0.42.0] — 2026-09-05 — the invoice email pays online

### Added
- **Pay button in the manual-add invoice email** (Sjoerd: "No payment
  link though… in the email"): adding a member with Invoice billing now
  creates a Stripe Checkout session on the workspace's connected account
  (plan-aware fee) and the invoice email carries Pay online next to the
  bank-transfer default. No connected account → the invoice still goes
  out, without the button.
- **Send payment link works for Membership invoices** (was Thread-only);
  the membership Connect webhook completes payment-mode sessions (marks
  the ledger row paid + mails the receipt), and Mark paid expires any
  live session — the Thread double-pay guard, same rule.
- `purchase.stripe_session_id` column (both DBs migrated) — one-off
  payment-link sessions live on the ledger row itself.

### Fixed
- **Manual-add invoices were invisible on the admin's Me scope** ("my
  invoice list is also empty"): the adding admin is now stamped as
  organiser on the purchase row; the Workspace scope always had it.

## [0.41.0] — 2026-09-05 — i18n P1 + one shared embed integration (Thread 3.34.0 · Membership 0.8.0)

### Added
- **French is a platform language.** `@thefibre/shared` gained the `./i18n`
  module — `LOCALES` (now en/nl/es/pt/de/**fr**), `Locale`, `LOCALE_LABELS`,
  `INTL_LOCALES`, `makeT` — the ONE definition the typed catalogs consume
  (i18n proposal D1–D5, decided 2026-09-05). Thread's catalog (74 keys) and
  all thread email tables carry FR; machine-drafted lines are marked `// MT`
  for native review.
- **The language split** (D1 sharpened): `thread.language` is now explicitly
  the PAGE language (buttons, system messages, emails — ours); the new
  free-text `facilitation_language` says what the course is RUN in (the
  organiser's, informational). Editor has both fields; public + embed thread
  pages show a "Facilitated in …" chip when it differs.
- **Membership speaks six languages on its money surfaces**: join page, tier
  grid, joined page, tier/button embeds and the /my portal render through a
  new typed catalog (43 keys ×6). Workspace default via Settings → Join
  page → "Public page language" (`membership_settings.locale`); `?lang=` /
  `data-lang` override; the joining member's active language is stamped on
  `membership_member.locale` (via Stripe metadata — the row is
  webhook-created) so scheduler emails know it forever.
- **Membership lifecycle emails ×6** (welcome, renewal reminder, payment
  failed, lapsed) — locale chain member → workspace default → en; dates and
  amounts format per locale. **Certificate emails ×6** too (closes the
  build-plan item), including locale-formatted dates on the certificate
  snapshot itself.
- **One embed integration for every app** (Sjoerd: "embeds should be
  @thefibre/shared"). The loader mechanism moved to
  `@thefibre/shared/embed-loader`; Thread's `/embed.js` is now served from
  it (behavior-identical port of the static file, which is deleted), and
  Membership gained its own `/embed.js` — integrators paste one script +
  `<div data-membership-embed="tiers|button" data-workspace="…">` with
  auto-sizing, `data-lang`, and `<style>`-inside-the-div custom CSS, exactly
  like Thread. The iframe-side halves (height reporter, CSS receiver) are
  shared components; both apps' copies are shims. Settings → Website embeds
  in Membership now emits the script+div snippets.

### Changed
- Public thread payloads (incl. `/public/…` routes) additively carry
  `facilitation_language`; membership public catalog carries `locale`;
  membership settings GET/PUT and the /my portal payload carry `locale`.
- Migration `20260905230000`: thread language CHECK widened for fr,
  `thread_thread.facilitation_language`, `membership_settings.locale`,
  `membership_member.locale` (applied to both DBs).

## [0.40.0] — 2026-09-05 — Membership 0.7.0: manual add is an invoiced intake

### Added
- **Add member is now a full intake** (Sjoerd: contact details "from
  moment one", "people receive an invoice right?"). The dialog takes
  phone, street/postal/city, country (SearchSelect, feeds the pricing
  rules) and a VAT number (stored as Membership's app-tagged
  person_billing row — the app justifies the field).
- **Billing choice on manual add**: Invoice (default when the tier is
  priced) creates a PENDING purchase-ledger row — tier price × pricing
  rules for the declared country — and emails the invoice in the house
  style; Mark paid / Send payment link work from the Invoices page like
  any other invoice. Comped stays free and quiet.
- **Invitation email** (checkbox, on by default): ensures the auth
  account exists and sends a workspace-branded welcome linking the
  member portal (/my).

### Changed
- `POST /persons` accepts phone/street/postal_code/city; `person` table
  gained a `phone` column (both DBs migrated).
- `PATCH /persons/:id/billing` now tags the curator row with the CALLING
  app instead of a hardcoded slug.
- chargeAccountForItem resolves membership invoices to the workspace's
  connected Stripe account, so Send payment link works for them.

## [0.39.1] — 2026-09-05 — staging links stay on staging

### Fixed
- **The Fibre dashboard's app cards linked to PRODUCTION from staging**
  (Sjoerd: "going to Meet lands me on a login page" — his .tech session
  doesn't exist on .app). The cards used the registry's raw production
  URLs instead of env-aware appUrl, AND the hardcoded map was missing
  Membership — now derived from APP_IDS so a new app can't be forgotten.
  Settings → Apps got the same treatment (the catalogue's base_url is
  the production address even in the staging DB; in-family links now go
  through appUrl, third-party apps keep their declared link).

## [0.39.0] — 2026-09-05 — Membership 0.6.0 · Thread 3.33.0: the parallel round

Six lanes, one afternoon — five agents + the main line, strict file
lanes, everything typechecked together before this commit.

### Added
- **Pricing rules as a LOGIC BUILDER** (§3.9 generalised, Sjoerd: "other
  people can build other logic"): declarative rows (when country/interval
  is/is-not-one-of → price %), first match wins, editor at Membership →
  Settings → Pricing rules with SearchSelect country chips. Join page:
  self-declared country + live adjusted preview; the server recomputes
  authoritatively at checkout and stamps country+pct into subscription
  metadata. Country stored on the member; admin change REPRICES FROM THE
  NEXT RENEWAL (new Price on the connected account, proration none).
  Card-country mismatch emails the admins (deduped) — never blocks.
- **Member self-serve portal**: membership.thefibre.app/my — every
  membership the signed-in email holds (any workspace), invoices, and
  Manage payment via a Stripe billing-portal session on the connected
  account; manual/comped members get the quiet "managed by the
  community" note. Auth callback learned member routes (/my,
  /oauth-continue) need a session, not a workspace account.
- **Per-event images in threads** (Thread 3.33.0): activity-family
  engagements carry image_url — edit dialog upload (cover pipeline),
  public agenda + embeds render it (te-agenda-image hook), duplication
  and templates keep it.
- **Circle SSO spike** (docs/spike-circle-sso.md): /api/v1/oauth
  {authorize, continue, token, me} shaped to Circle's WP-OAuth preset —
  membership-gated sign-in (active/grace only, re-checked live). NOT
  wired to Circle; staging test first, the doc says exactly how.
- **docs/brief-workspace-threads.md**: workspace-scoped threads design
  (recommendation: a workspace-kind organiser row, zero new public
  routes); D1–D3 await Sjoerd.

### Changed
- **Extraction phase 1 executed** (component-inventory): button, dialog,
  switch, list, fields, theme-script, app-switcher live ONCE in
  @thefibre/shared; six apps hold 4-line shims. ~1,640 net lines gone,
  zero page changes.

## [0.38.0] — 2026-09-05 — the trust items: Members list + one profile everywhere

### Changed
- **Fibre Members page rebuilt to the house pattern** (Sjoerd's spec):
  a list — Name / Email / Role / Relationship / Apps summary / Joined;
  clicking a row opens the settings dialog (role, relationship, per-app
  — / Member / Admin, saves-on-change with optimistic revert); Add
  member opens the invite dialog (which now grants app-ADMIN at invite
  time too). 309 inline-card lines → list + two dialogs.
- **Meet's profile page ported to the converged model** (Thread's, decided
  2026-09-01 but never applied to Meet): "Public page" = URL + location
  (Meet's own fields) + a read-only echo of name/photo/bio with "Edit
  your profile in The Fibre". PATCH /meet/me no longer accepts
  bio/photo_url (write-dead columns stop resurrecting); timezone stays
  Meet-owned — it anchors availability math.
- **Public booking pages read the platform profile first** (bio/photo/
  name) with meet_host as fallback — a bio edited in The Fibre now
  actually reaches the booking page.
- **Pulse's orphaned duplicate profile editor deleted** (its hub already
  linked to The Fibre; the page was a third editor waiting to drift).

## [0.37.1] — 2026-09-05 — Membership 0.5.1: access is VISIBLY under products

### Changed
- Sjoerd's close-of-day check was right: grants moved onto products in
  0.36.0 but the EXPERIENCE hadn't — Access still sat in the sidebar as
  its own page. Now: product cards show what they unlock, the sidebar
  entry is gone, the sync overview hangs off Products, help copy updated.
  Half-done is not done.

## [0.37.0] — 2026-09-05 — Membership 0.5.0: seats wait for a yes

### Added
- **Seat approvals**: fibre_seat grants park as awaiting_approval — an
  Approve-seat button on the member provisions synchronously. Policy
  lives on the built-in Fibre integration row (Integrations page):
  approve-or-auto, plus the standing consent "seats above the allowance
  may be billed" (without it a costing seat ALWAYS waits). Lapse cleans
  parked rows up like pending ones.
- **The Fibre hosts /settings/connections** (was a 404 from every hub —
  the canon linked a page only Thread had). Ported with return=fibre on
  the Google flow.

### Fixed
- **Meet profile save 500** ("row violates RLS for meet_root_slug"): the
  slug-registry sync triggers lacked SECURITY DEFINER, so user-session
  saves wrote the registry as authenticated — same disease as the
  v0.31.1 grant bug, found by Sjoerd on staging.

### Queued
- Fibre Members page redo to the house list+dialog pattern (Sjoerd's
  spec) and profile-page convergence (platform block + app overlay, one
  shared layout) — trust depends on it.

## [0.36.0] — 2026-09-05 — Membership 0.4.0: the product carries its access

### Changed
- **Access grants attach to PRODUCTS** (Sjoerd: "why is this not under
  products" — the product is the promise, so it carries the fulfillment):
  the product dialog gains an Access section (Circle space / Thread /
  Fibre seat with the billed-seat warning); a tier grants everything its
  included products carry; entitlement re-reconciles when a tier's
  product set or a product's access changes. The Access page becomes the
  overview (sync status + retry); tier-level grants stay valid as legacy.

### Added
- **Shared SearchSelect** (@thefibre/shared/ui/search-select) — the
  list-with-search-field component; first consumer is the thread picker
  (which also showed BLANK rows: a thread's title lives on its paired
  program — mapping fixed). Timezone pickers + the three hand-rolled
  comboboxes converge here (inventory item).

### Queued
- Pricing rules (§3.9) pinned as the NEXT Membership increment.
- Thread: workspace-scope threads (design call — public URL contract) and
  per-event images inside a thread — both Sjoerd asks, 2026-09-05.

## [0.35.0] — 2026-09-05 — Membership 0.3.0: the seat grant + currencies go platform-wide

### Added
- **Grant kind fibre_seat** (proposal §3.10 built): a tier can grant a
  workspace seat — the worker provisions user + workspace_member with the
  invite flow's exact seat policy (allowance → billable → refuse, error
  surfaced in the journal), reconciles seat billing both ways, revoke
  closes the seat from the next period. The grant dialog names the
  billed-seat cost before save. The built-in integration — same journal
  and cadence as Circle.
- **ECB reference rates** (/api/v1/currencies/rates, Frankfurter mirror,
  12h cache): indicative conversion display; charging never converts.

### Changed
- **Currencies is a platform-wide setting now** (Sjoerd: "currency should
  be a platform-wide setting… a module"): settings-canon key under
  Workspace, edited at The Fibre → Settings → Currencies (shared
  CurrencyEditor component with injected save), every app's hub links
  there; Membership's app-section copy removed. Per-product currency
  shift stays (built yesterday); ECB rates shown on the editor.

## [0.34.0] — 2026-09-05 — app access without workspace admin

### Added
- **Per-app access with roles on the Members page** (Fibre web): each
  activated app gets a — / Member / Admin select per person. The
  checkboxes existed but their allow-list was stale (Pulse and Membership
  missing — now the catalogue answers, the v0.14.0 rule) and every save
  silently downgraded app-admins to member (role now explicit).
- **App-level admin** (has_app_role): role 'admin' on the Membership app
  manages tiers/members/grants/settings WITHOUT workspace admin — the
  "soul office" case: grant the office people Membership (Admin), the
  rest stay out entirely; members themselves get the self-serve portal
  (queued).

### Notes
- Member portal (each member sees only their own membership) queued as
  its own build in the proposal §3.7 follow-up.

## [0.33.2] — 2026-09-05 — selected means selected

### Fixed
- **Selected state is unmistakable platform-wide**: the shared Invoices
  area's Me/Team/Workspace switch and app chips (one edit → Meet, Thread
  and Membership at once — the extraction paying for itself same-day),
  plus Membership's filter chips: active = dark pill, inverse text.
- **Four sign-in screens were broken in dark mode** (meet/flow/pulse/
  membership carried raw bg-white/neutral-* classes) — swapped to
  semantic tokens. Found by the component sweep.

### Added
- **docs/component-inventory.md** — the full six-app duplication sweep
  (~8,000 lines, mostly byte-identical), four extraction phases queued
  under build-plan 1g. docs/i18n-proposal.md (D1–D5 pending) landed the
  same evening.

## [0.33.1] — 2026-09-05 — Membership 0.2.3: thread links are picked, not typed

### Changed
- Thread-kind product links offer a picker of the workspace's actual
  threads (cross-app read on the user's own RLS identity; empty list
  falls back to the text field). Circle-space picking waits on a token +
  spaces proxy.
- Proposal §3.10: grant kind fibre_seat designed (tier ⇒ workspace seat;
  billed-seat caveat stated in the dialog) — build on Sjoerd's go.

## [0.33.0] — 2026-09-05 — components first

### Changed
- **THE Invoices area is a shared component**
  (@thefibre/shared/ui/invoices): Meet, Thread and Membership each
  collapsed their ~450-line invoices-client into a dozen-line wrapper
  injecting server actions. One implementation, one app-chip list (now
  incl. Pulse + Membership) everywhere. Pulse's variant carries ledger
  extras — converge when next touched.
- **Membership renews-on fields use the shared DateField** (Sjoerd's
  screenshot: native browser calendar vs Thread's — "thread is
  leading").
- **CLAUDE.md gains the binding Components-first rule**: check shared +
  the other apps before building any surface; new recurring surfaces are
  born in @thefibre/shared; never fork a per-app variant. Component
  inventory rescan + i18n architecture proposal both running as
  background agents.

## [0.32.1] — 2026-09-05 — Membership 0.2.1: the invisible link field

### Fixed
- **The links saga's true root cause**: the link-row kind select carried
  both w-full (shared INPUT class) and w-36 — w-full won, the select
  swallowed the row, and the ref + label fields rendered off-dialog.
  The user was asked to fill a field he could not see. Select now has
  its own width-free class. (Sjoerd's screenshot found it.)

## [0.32.0] — 2026-09-05 — Membership 0.2.0: one way of working

### Added
- **Invoices page** in Membership (ported byte-true from Meet's, ledger
  scope Me/Workspace, Membership chip in the app filter) + **Settings →
  Payments** (the Pulse form). Sidebar grows a Money section.
- **Drag-and-drop ordering** for tiers and products — the numeric Sort
  order fields are gone (Sjoerd: "order of things is always drag and
  drop, not with numbers"). New items join at the end.

### Changed
- **Settings is the canonical hub** (platformSettings + SettingsCards —
  "same four sections, same order, same words as every other app");
  Join page / Integrations / Website embeds / Currencies became
  subpages. **Circle.so is row one of an Integrations LIST**, the
  Memberful-style catalogue the roadmap names.
- Standing rule recorded (build-plan 1g): recurring surfaces are shared
  platform components — never another per-app copy.

## [0.31.4] — 2026-09-05 — Membership 0.1.3: Meet's warm palette

### Changed
- Membership wears Meet's interface palette (warm neutrals) instead of
  the cool slate it inherited from the Pulse scaffold (Sjoerd: "make the
  color setting the same as in meet"). One globals.css swap — the token
  system did its job.

## [0.31.3] — 2026-09-05 — Membership 0.1.2: link rows stop failing silently

### Fixed
- **Product links "didn't save"** — they were never sent: the dialog
  silently dropped any link row whose middle (ref) field was empty.
  Caught live: PATCH 200 with links []. An added row with an empty ref
  now blocks the save with a message naming the field, instead of
  discarding the user's intent.

## [0.31.2] — 2026-09-05 — Membership 0.1.1: add-member creates contacts

### Fixed
- **Add member dead-ended on people who weren't contacts yet** ("Pick a
  person first" with no way forward): the dialog now offers Create
  "<name>" as a new contact — inline name+email, POST /persons, then the
  membership. First caught adding Peter Test member on staging.

### Decided
- **Pricing rules designed** (proposal §3.9): purchasing-power pricing as
  a rule layer (kind 'region', config per workspace). Country
  self-declared at join; card-country mismatch warns the admin;
  migration is deliberate and reprices from the next renewal. Build is
  the next Membership increment.

### Known
- Product links reported as not saving — reproduction pending (dialog,
  schema and route all check out in isolation; needs a live request in
  the API log).

## [0.31.1] — 2026-09-05 — the activation grant was never landing

### Fixed
- **Activating an app never granted the activator app_membership** —
  app_membership deliberately has no authenticated write policy, so the
  workspace-apps route's userClient upsert was silently RLS-refused since
  the day it was written. Every earlier app's grants came from migrations
  and bootstraps; Membership was the first activation with no fallback
  (symptom: toggle says ACTIVE, app switcher never shows it, the app
  itself bounces to no-access). The grant now runs on adminClient — the
  one deliberate code path allowed to write that table; the table stays
  locked to self-serve writes on purpose. Sjoerd's staging grant
  backfilled by hand.

## [0.31.0] — 2026-09-05 — Membership 0.1.0: the 7th app, whole

*"I want to build. No question asked. A full integrated platform."*

The soul.com community case, built as a family app in one day
(docs/membership-proposal.md, D1–D6 all accepted 2026-09-04). Slug
`membership` — display name deliberately swappable in branding.ts alone
(Hyve is on the table).

### Added
- **Membership app** (membership.thefibre.app, port 3005, own VERSION
  0.1.0): tiered recurring community memberships on the workspace's
  connected Stripe account. Schema `membership_*` (tiers, products,
  tier↔product links, members, access grants, sync journal, settings,
  reminder dedup) with the house RLS shapes; app row via the open
  catalogue, `released_at` latch flipped in this release.
- **Money**: public join page (`/<workspace-slug>`) → subscription
  Checkout (price_data, plan fee as `application_fee_percent` — no fixed
  cap in subscription mode, documented); Connect webhook
  (`STRIPE_MEMBERSHIP_WEBHOOK_SECRET`, no fallback) where
  checkout.completed and the first invoice.paid converge idempotently;
  one ledger row per billing period keyed by Stripe invoice id; receipts
  with the workspace as seller. DIY VAT rails (inclusive split via
  recordPurchase), NOT Stripe Tax — proposal §3.3 amended.
- **Lifecycle machinery** on the 5-min tick: 14-day renewal reminders
  (deduped per cycle), grace/lapse sweep for manual members, and the
  **Circle.so access sync worker** draining the journal (invite on join,
  space/community removal on revoke, errors surfaced +
  `POST /membership/access/retry`). Activity events for every transition
  — Flow reacts, never decides (proposal §3.8).
- **Surfaces**: dashboard (actives, grace, annual value, renewing soon),
  members (filters, add/edit dialogs, access journal), tiers + products
  (catalogue with links), access grants, settings (join page copy, Circle
  token, embed-code generator). **Website embeds** (`/embed/tiers`,
  `/embed/button`) — iframe + height postMessage, stable `me-*` classes,
  the Thread pattern.
- **Fibre web**: emergent Membership profile tab on contacts (member row
  IS the curator data; `/persons/:id/apps` + `/persons/:id/membership`).
- **Workspace currency SPoT** (Sjoerd: "single point of truth on
  workspace level"): `workspace.default_currency` + `workspace.currencies`
  read/written through `/api/v1/workspace`; membership tier/product
  dialogs offer the workspace's list; Settings → Currencies card writes
  the platform endpoint. Organiser-level override deliberately deferred
  (follows the payment-accounts chain when needed).

### Decided
- Integrations roadmap: a growing Memberful-style catalogue — each tool =
  a new `access_grant.kind` + worker (deploy, not migration); Circle is
  worker #1 and the template.
- Plan-gating for Membership deliberately deferred — any workspace can
  activate it while soul.com dogfoods; gate when pricing is decided.

### Fixed / guarded
- **Staging app domains misrouted** (Sjoerd: "Meet and The Thread does not
  open in my .tech account"): meet/thread/flow/pulse.thefibre.tech all serve
  the WEB app — every CNAME points at the web project's Vercel DNS target.
  Fix is dashboard work (per-project domain + CNAME; steps in
  docs/environments.md gotchas). `scripts/smoke-staging.mjs` now asserts
  each app subdomain serves its own app by `<title>`, so the promote gate
  catches domain misroutes from now on.

### Proposed
- **First-visit onboarding for Meet + Thread** — docs/onboarding-proposal.md:
  role-aware derived "Set up" card (person + workspace-admin steps) and a
  first-visit tour offer. Decisions D1–D3 with Sjoerd; queued as build-plan
  item 6.

## [0.30.0] — 2026-09-04 — VAT on sales: workspace, then organiser

*"VAT is workspace and then organiser. Workspace is organiser too."*

### Added
- **Seller-side VAT on app sales** (`lib/seller-vat.ts`): the workspace's
  invoice details carry the default VAT config; a person selling under
  their own name overrides with their profile's. Team and workspace sales
  follow the workspace — the workspace IS an organiser.
- **Settings → Payments (Thread + Meet)** grew "VAT on sales": a
  VAT-registered toggle + rate, at both My-account and Workspace level,
  stored in the payments SPoT (invoice_details jsonb — no migration).
- **Ticket prices stay what buyers see**: rates are INCLUSIVE. At
  `recordPurchase` every app sale gets the split stamped into billing
  (subtotal / tax / "incl. VAT 21%"), so the invoice popup, page, PDF and
  receipt email all show it — one stamping point covers Thread card +
  invoice-method enrolments and Meet bookings. Platform (fibre-platform)
  rows keep their Stripe-computed tax untouched.
- recordPurchase now merges billing over the existing row's on updates —
  a webhook confirm can no longer clobber the enrol form's buyer details.

## [0.29.0] — 2026-09-04 — one invoice viewer for the whole family

*"One ref of truth for the whole app (fibre, meet, thread)"* — now actually
true everywhere ("make it so").

### Changed
- **Thread, Meet and Pulse adopt the shared invoice dialog**
  (`@thefibre/shared/ui/invoice-dialog`) for the purchase detail view —
  the same document popup as Settings → Plan: share link, Download PDF
  (each app grew its own `/invoices/:id/pdf` session-carrying pass-through),
  Email to… (any address), subtotal/VAT/total when the row carries tax.
- The shared dialog grew an `actions` slot (app-side management buttons —
  Reimburse, Mark paid incl. Pulse's account+date variant, Send payment
  link, Resend invoice — stay each app's own) and a `children` slot (fee
  split, refund note); `seller` became optional (hidden when an app cannot
  name it yet — the organiser-VAT work will fill it).
- Three near-identical 100-line detail dialogs deleted.

## [0.28.5] — 2026-09-04

### Fixed
- **Invoice labels name the plan on the invoice, not the workspace's plan
  of the moment**: invoice.paid can race checkout.completed, which labeled
  the first Starter invoice "The Fibre — Free". The plan now resolves from
  the invoice's own line prices (reverse order, so a proration names the
  plan being bought); workspace plan stays as fallback.
- Also in this release: two staging-rebuild touches of @thefibre/shared
  (no behaviour change) from the env-var repair.

## [0.28.4] — 2026-09-04 — SVG logos, sanitised

### Added
- **SVG upload** ("Logo upload: no SVG?" — logos are SVGs): accepted on the
  shared upload route, but every SVG passes through DOMPurify's SVG profile
  first (scripts, event handlers, javascript: URIs, foreignObject stripped
  by an audited sanitizer — the raw-SVG stored-XSS reason for the old block
  stays answered). An SVG that sanitises to nothing is refused with advice.

### Fixed
- Bucket mime allowlist aligned with the route on BOTH projects — it
  omitted gif/avif (route accepted them, storage then 500'd) and svg.

## [0.28.3] — 2026-09-04

### Fixed
- **Share link shares OUR invoice page**, not Stripe's hosted copy — the
  dialog preferred `stripe_invoice_url`; now the app's own invoice page
  leads and Stripe is the fallback only when no page href was wired.

## [0.28.2] — 2026-09-04 — the billing country moves in-app

### Fixed
- **Checkout 500**: Stripe has removed `dynamic_tax_rates` from current API
  versions ("the feature you are trying to use is deprecated") — the
  address-driven rate pick chosen in 0.28.0 cannot exist anymore. The rate
  must be known BEFORE the session: the upgrade panel now carries a
  billing-country select (defaults NL), and `/billing/checkout` pins that
  country's rate as the subscription's default tax rate from birth — the
  first invoice is taxed. Non-EU country → out of scope, no rate.
- **Typed-address reconciliation** (`reconcileSubscriptionTax`): after
  checkout the webhook compares the address the buyer actually typed at
  Stripe with the pinned rate; a mismatch corrects every future invoice and
  logs loudly so the first one can be checked. The reverse-charge pass runs
  inside the same call.

## [0.28.1] — 2026-09-04 — legacy subscriptions accept our tax rates

### Fixed
- **Switch 500 on subscriptions born under Stripe Tax**: a subscription
  created via checkout while `automatic_tax` was still in the charge path
  refuses manual rates ("Manual tax rates cannot be used when
  automatic_tax[enabled]=true"). The switch update now disables automatic
  tax in the same call that pins the country rate — a no-op on post-0.28
  subscriptions.
- **The release record itself**: v0.24.2 through v0.28.0 shipped as commits
  without CHANGELOG entries or version bumps (the sidebar sat on 0.24.1 for
  ten releases). Backfilled below from the commit record; versions
  re-synced at 0.28.1.

## [0.28.0] — 2026-09-04 — the Fibre collects its own VAT

*"We can do tax collections ourselves, no?"* Go given. Stripe Tax (and its
0.5% per transaction) is out of the money path; the /admin/vat table now
collects directly.

### Added
- **Our rates become Stripe tax_rate objects** (`lib/vat-stripe.ts`):
  mirrored at boot, on every /admin/vat save, and when the weekly sensor
  applies a law change. Stripe rates are immutable — a change archives the
  old object and creates a new one; removed countries archive.
- **Checkout charges from OUR table**: `dynamic_tax_rates` on every line —
  Stripe picks the country's rate from the billing address the customer
  types, applying a number it did not choose.
- **Switches invoice tax correctly**: the customer's country rate rides on
  the same subscription update that generates the proration invoice.
- **Reverse charge, validated by the EU itself** (`lib/vies.ts`): after
  checkout, an EU non-NL business customer's VAT number is checked against
  VIES; valid → `tax_exempt='reverse'` on the customer. VIES down → soft
  fail, never blocking a checkout.
- Ledger capture, dialog, page, PDF and receipt email needed no changes —
  manual rates populate the same tax fields.

Stripe Tax stays activated ONLY as the sensor behind the weekly rate probe,
never in the charge path.

## [0.27.1] — 2026-09-04 — VAT auto-sync, the Fibre's own invoice PDF

### Added
- **The VAT table syncs itself** (`lib/vat-sync.ts`): weekly probe of
  Stripe's tax engine (a €100 test calculation per EU country), drift
  applied to the /admin/vat table, operator email on every change, log in
  `platform_setting.vat_sync_log`. Piggybacks on the scheduler interval.
- **Download PDF downloads OUR PDF** ("Download PDF opens Stripe" — no):
  pdfkit A4 invoice (`lib/invoice-pdf.ts`) served at
  `GET /purchases/:id/pdf`, reached from the web app via a
  session-carrying pass-through route.
- Portal button shrinks to "Payment method" — its last remaining duty.

## [0.27.0] — 2026-09-04 — VAT: computed on card rails, owned by the Fibre

### Added
- **The VAT module** ("build a VAT module… so we can update it regularly"):
  EU-27 rate table stored as platform data (`lib/vat.ts`,
  `platform_setting.vat_rates`), editable at /admin/vat, `computeVat()`
  (home rate / EU reverse charge / destination rate / out of scope) for
  non-Stripe rails. Migration `20260904120000_vat_rates`.
- Stripe Tax on checkout (with graceful fallback until activated) — later
  replaced by DIY collection in 0.28.0.
- Tax breakdown (subtotal/tax_cents/tax_label) captured into
  `purchase.billing` by the webhook and rendered on the invoice dialog,
  the invoice page, the PDF and the receipt email.

## [0.26.1] — 2026-09-04 — the invoice popup

### Added
- **THE canonical invoice viewer** ("one ref of truth for the whole app —
  fibre, meet, thread"): `@thefibre/shared/ui/invoice-dialog`, self-contained
  popup with Share link / Download PDF / Email to… / Print, adopted on
  Settings → Plan. Family-wide adoption queued (build-plan 1f).
- Webhook captures the Stripe-hosted PDF url; `POST
  /purchases/:id/resend-invoice` takes a `to` override and uses the
  platform seller for fibre-platform rows.

### Fixed
- Follow-up commit: ENTITY import + an overreaching `recipient` rename that
  broke purchases.ts (and both deploys). Build gating tightened.

## [0.26.0] — 2026-09-04 — the invoice lives in the Fibre

### Added
- **Webhook writes the invoice onto the ledger**: number, buyer
  company/address/tax id, service period, subtotal — the Fibre document is
  complete without asking Stripe anything.
- **In-Fibre invoice page** (`/settings/plan/invoices/:id`), print-ready
  (`?print=1` auto-opens the dialog).
- **Receipt email from the platform**: shared receipt machinery with
  Solidarity Lab as seller block. Stripe's hosted copy demoted to a
  footnote link.

## [0.25.3] — 2026-09-03

### Fixed
- **SCA fallback on switches**: when the proration charge needs
  confirmation, the open invoice's hosted page is returned and the browser
  redirected there instead of failing silently.

## [0.25.2] — 2026-09-03

### Fixed
- Plan buttons stay visible during a pending cancellation — picking a plan
  un-cancels and switches in one act (was: cancelled workspaces had no way
  back to a paid plan).

## [0.25.1] — 2026-09-03

### Added
- Billing-interval toggle on the plan controls ("1 subscription with a
  toggle for per year"): Monthly / Yearly — 2 months free, switch invoiced
  like any other plan change.

### Fixed
- Follow-up commit: leftover `options` reference in the interval-toggle
  panel broke the web build.

## [0.25.0] — 2026-09-03 — in-app plan switching

*"Why can't someone upgrade or downgrade themselves?"* Now they can,
without leaving the Fibre.

### Added
- **`POST /billing/switch`**: updates the Stripe subscription directly
  (base item swapped, seat riders re-created by the reconciler),
  `proration_behavior: 'always_invoice'` so every change produces a real
  invoice in our ledger immediately.
- **Cancel / Resume** endpoints + confirm dialogs on Settings → Plan; the
  full control set lives in the app, Stripe demoted to rails.

## [0.24.8] — 2026-09-03

### Added
- Amber banner with the exact end date for cancelled subscriptions ("It
  would be nice that the end date would be shown").

## [0.24.7] — 2026-09-03 — the seller side of the ledger

### Added
- **/admin/invoices**: cross-workspace invoice list for the platform
  operator, read from the purchase ledger. Doctrine locked in: Stripe is
  rails (payment + tax + legal PDF); the Fibre ledger is the system of
  record. A future PSP is a `method` value + a webhook calling
  `recordPurchase()`.

## [0.24.6] — 2026-09-03

### Added
- Fibre invoices on Settings → Plan ("Where can I see my invoice as a
  workspace?") — the workspace's own purchases from the ledger.

## [0.24.5] — 2026-09-03

### Fixed
- Checkout 400 with an existing customer: `tax_id_collection` requires
  `customer_update: {name: 'auto', address: 'auto'}`.

## [0.24.4] — 2026-09-03

### Fixed
- **New workspaces start `active` on Free, not comped**: the auto-create
  trigger's 'comped' default hid all self-serve billing from every new
  customer ("Still no way to upgrade for me as client"). Migration
  `20260903160000`; deliberate comps untouched.

## [0.24.3] — 2026-09-03

### Added
- **Event templates join the price list** (1 / 5 / unlimited / unlimited):
  `thread_template_limit` as a numeric plan dimension — seeded,
  matrix-editable, public on /pricing, exposed on the Plan type. Library +
  enforcement queued (1e) pending template designs.

## [0.24.2] — 2026-09-03

### Changed
- The portal button says what it does (change plan, cancel) — superseded in
  0.27.1 when the portal shrank to "Payment method".

## [0.24.1] — 2026-09-03 — the welcome parade is two apps

*"Pulse can stay out of the loop for now, as does flow."* Auto-activation now
covers Meet + Thread only. Pro still makes Flow + Pulse AVAILABLE in
Settings → Apps — switching them on stays a human act, fitting the naming
brief: backstage tools, not sibling products.

## [0.24.0] — 2026-09-03 — sign up like a customer, not an applicant

Sjoerd walked the funnel as a customer and called it: *"Very nonlogical.
Sign up: choose your plan, fill in your payment info, apps are activated…
other apps are not visible. By default approve (make a toggle)."* This is
that funnel.

### Added
- **Auto-approve signups (default ON)** — a signup approves itself:
  workspace created, plan apps switched on, welcome email sent, and the form
  says "Your workspace is ready — sign in now" instead of "we'll be in
  touch". `platform_setting` table (migration `20260903120000`) carries the
  switch; a **toggle on /admin/access-requests** restores the velvet rope.
  One shared implementation (`lib/signup-approval.ts`) serves both the auto
  path and the admin's Approve button.
- **The plan assembles the product** (`lib/plan-apps.ts`): Meet + Thread
  activate on every plan at approval; Pro's checkout webhook auto-activates
  Flow + Pulse (and seeds the Pulse pipeline flow). Runs again at every
  sign-in to fill app memberships for new users. Idempotent, respects
  deliberate deactivations, never blocks the caller.
- **Apps outside the plan are invisible** on Settings → Apps (active ones
  stay visible so a downgrade never hides a switch). Fails open like the
  gates.
- **Paid pick lands on payment**: a first sign-in whose signup chose a paid
  package is routed to Settings → Plan (welcome banner naming the package)
  instead of an empty dashboard.
- **Self-serve downgrade**: sync-stripe-plans.mjs now provisions a Stripe
  billing-portal configuration (switch Starter↔Pro monthly/yearly, cancel at
  period end; id stored per-database in platform_setting and passed
  explicitly). A subscription that ends drops the workspace to **Free** —
  data kept, active apps stay active; gates bind on the next activation,
  mirroring the seat rule.
- **The public site follows the door**: `signup_mode` on
  `GET /api/v1/public/plans`; landing + pricing + the form swap chip, copy
  and CTAs ("Start free" / "Get started") when self-serve is on.

### Ops (same day)
Staging got real email (Resend key, "(staging)" sender) and a pinned machine
(the email hook's 5s ceiling + the in-process scheduler both need a warm
machine); Stripe live + sandbox fully wired incl. both portal configs.

## [0.23.1] — 2026-09-02 — staging prep, and links that tell the truth

Phase 1 of docs/environments.md, done before the clicking starts.

### Added
- `scripts/db-push-staging.sh` / `db-push-prod.sh` — the staging wrapper
  links, pushes, and ALWAYS restores the prod link (trap on exit), so a bare
  `supabase db push` afterwards still means prod. Staging ref goes in
  `supabase/.staging-ref`.
- `scripts/smoke-staging.mjs` — health, plan catalogue, 401 enforcement,
  landing/pricing/sign-in render; gates the promote.

### Changed
- Meet's booking-link host displays (slug prefixes, team + meeting-type
  lists, profile "Public URL") and Pulse's invite hint now derive from
  `appUrl(...)` (`apps/meet/lib/public-host.ts`) instead of a hardcoded
  `meet.thefibre.app` — staging will show staging URLs.

### Domain news
Sjoerd owns **thethread.app** (currently an earlier standalone Thread).
Architecture agreed in principle: thethread.app becomes the public face
(marketing + public thread pages) — customers meet Thread; the signed-in
operator apps stay on *.thefibre.app (shared SSO cookie apex, Fibre
backstage). Cutover is its own slice pending one answer: what still lives on
the old app. Staging stays on a neutral apex regardless.

## [0.23.0] — 2026-09-01 — Thread stands alone

The naming brief arrived and was decided in one message (saved verbatim:
docs/naming-brief.md): **Fibre is the invisible foundation. Thread is the
flagship, the product people meet and feel. Meet, Sales and Flow are
functional tools that serve Thread, not siblings competing with it.** The
test that decided it: a word only earns textile language if a customer would
say it out loud.

### Changed
- **branding.ts, the single source, renamed**: Thread ("The learning journey
  a person walks."), Meet ("How meetings happen inside a Thread."), Flow,
  Pulse, Sales, Learn. The Fibre keeps its name, backstage. **Slugs, ids and
  URLs did not move** — `the-thread`, `fibre-meet` etc. are FKs and published
  API contract; the plan-ids precedent (`org` displays as "Enterprise")
  applied family-wide.
- **The landing page is Thread-first** (Brief B): Thread as the name and the
  journey as the story; four *functions* it carries instead of the
  one-platform-four-apps sibling grid; Fibre reduced to one "under the hood"
  paragraph. Tone per the brief: accompaniers who walk alongside.
- **~55 files of display copy swept across all five apps + shared + API**
  (four parallel agents, strict lanes): dialog titles, settings labels,
  invoice filter chips, no-access pages, help pages, metadata titles,
  powered-by footers ("Thread · The Fibre"), wallet passes
  (Apple organizationName / Google issuerName), Stripe invoice descriptions
  and footers, host-approval email, 402 plan-gate labels, error messages,
  Flow/Pulse cross-references ("authored in Flow", "Deactivate Pulse").
- The 5-language Thread catalog needed **nothing** — the brand was never in
  translated strings; every translated "thread" is the common noun for a
  journey, which stays by design.
- Stripe SDK `appInfo` renamed 'Fibre Meet' → 'The Fibre' (it is the
  platform-wide client; dashboard telemetry only).

### Deliberately not changed
- `/terms` + `/privacy-policy` (one "Fibre Meet" sentence remains) — legal
  text pending lawyer review; renamed with that review, not piecemeal.
- Google Wallet classId `…the_thread_ticket` — a registered identifier at
  Google; renaming orphans the class.
- Code comments naming the old brands — history, not copy.
- Reserved/rejected names (Tapestry, Stitch, Knot, Loom, Warp, Shuttle,
  Spindle) appear nowhere in product code; kept that way.

### Parked, per the brief + tomorrow's session
Meet standalone vs an event type inside Thread (product decision); the
domain strategy (with the staging build, docs/environments.md Phase 0);
Thread-as-platform (do not build for it yet).

## [0.22.3] — 2026-09-01 — the operator sees the costs, and the tools get their own tab

Two of Sjoerd's observations, minutes apart: "on the economics page I don't
see the costs" and "I want to see a separate cashflow for the tools."

### Added
- **/admin/economics shows operating costs** — the Pulse budget lines with
  category "Platform infrastructure", cadence-normalised to €/month, with a
  total and a **Net/month** headline (MRR − costs). Read under the operator's
  own authority, scoped to workspaces the requesting super admin is a member
  of — not a peek into any tenant's books. Editing stays in Pulse → Budget;
  this page only reads.
- **"The Fibre" cashflow tab in Pulse** — tabs are separate cashflows keyed
  on teams, so the tools now live on a team of their own:
  seed-operating-costs.mjs v2 creates team "The Fibre" (slug the-fibre) in
  Solidarity Lab, registers it as a Pulse involved team, and stamps the six
  cost lines with it. Run tonight: the workspace cashflow is clean of tooling
  again, and Pulse → Cashflow has a The Fibre tab with its own virtual bank
  and projection.
- **docs/environments.md** — the staging plan for tomorrow, step by step:
  two decisions (separate apex domain for cookie isolation; free-tier
  Supabase), six lettered blocks of Sjoerd clicks (~45 min), first-light
  checklist ending in a test-card Pro purchase, the promote rhythm, and the
  gotcha list. `fly.staging.toml` checked in (scale-to-zero — staging skips
  the email hook, so cold starts are harmless there).

## [0.22.2] — 2026-09-01 — the form asks which product

*"I have registered — but never I had to make the choice for a product."*
Sjoerd, testing his own funnel. /pricing said €19 and €49 and then the
request form ignored the answer.

### Added
- **Package choice on /request-access** — pill selector (Free / Starter /
  Pro / Enterprise / "Not sure yet"), rendered from the same public catalogue
  as /pricing so names and prices cannot drift. Arriving from a /pricing card
  preselects it (`?plan=starter`); `signup_request.desired_plan` carries it
  (migration `20260901230000`, FK to billing_plan; unknown ids degrade to
  null, never fail a signup).
- **/admin/access-requests shows it** — a "wants Pro" chip beside the name,
  so approval decisions see intent.
- **The welcome email closes the loop** — a paid pick adds "your workspace
  starts on Free; activate Pro under Settings → Plan once you're in."
  Deliberate: approval still provisions Free — a paid plan begins at
  checkout, after sign-in, when there is somebody to charge.
- The form says so too: "your workspace starts free either way, and nothing
  is charged until you choose to upgrade inside."

## [0.22.1] — 2026-09-01 — an hour after signing in, everything broke

Contacts: "Couldn't load contacts: API 401". Settings → Apps: the same. Admin →
Apps and Access requests: Next's white "Application error" page. All at once,
to somebody who was plainly signed in — his name and both his workspaces were
right there in the menu.

**Not an authentication failure. A token-refresh failure**, and it has been
latent since the beginning: it needs a tab open for an hour to appear.

A Supabase access token lasts an hour. The browser refreshes it in the
background — but a **server component cannot**, because it may read cookies and
not write them. `lib/supabase/server.ts` has always swallowed that write with a
comment saying as much. So once the token aged out, every server-rendered page
asked for a session, got null, and threw its own 401 before reaching the API.
Pages that caught it printed "API 401"; pages that did not crashed.

### Fixed
- **`middleware.ts` in all five apps.** Middleware is the one place in Next
  that can read the request's cookies *and* write cookies onto the response, so
  the refresh belongs there: `getUser()` performs it as a side effect when the
  token is stale, and the new cookies go back with the response.

  Both halves of `setAll` matter — the request copy so the rest of that pass
  sees the new token, the response copy so the browser keeps it.

  Public pages are untouched: a visitor with no session has nothing to refresh.

_Read the API log first, says CLAUDE.md, and it was right here too: the 401 was
never in the API's logs, because no request ever reached it._

## [0.22.0] — 2026-09-01 — a seat costs eight euros, and now it says so on the bill

*"We should wire it."* Extra-seat billing, end to end
(migration `20260901210000`, `lib/seat-billing.ts`).

### Added
- **Seat Prices per plan** — `billing_plan.stripe_price_id_seat_{month,year}`,
  created by `sync-stripe-plans.mjs` on the plan's Product. Yearly seats
  follow the same two-months-free rule as the base (€80/seat/yr), so "yearly
  is two months free" is true of the whole invoice.
- **One reconciler** (`reconcileSeatBilling`) — the subscription carries an
  extra-seat item with quantity = seats over the allowance, prorated by
  Stripe. Compares before touching, so the webhook echo of its own update is
  a no-op. Fails SOFT: a Stripe hiccup logs and lets the invite through; the
  quantity converges on the next event.
- **Checkout counts existing seats** against the plan being bought — a
  14-seat workspace buying Pro is billed €49 + 9×€8 from day one (503 with a
  clear message if seat prices aren't synced yet).
- **An invite past the allowance is now charged, not refused** — on a
  workspace with a live subscription, the 6th Pro seat adds a prorated €8
  item. The 402 remains exactly where there is nothing to charge: Free,
  comped, unpaid.
- **Portal plan switches re-count** — the billing webhook resolves the plan
  from the price actually on the subscription (never items[0], which may be
  the seat item) and re-reconciles against the new allowance.
- Settings → Plan shows the arithmetic: "9 extra × €8 = €72/month, on your
  subscription". docs/pricing-worked-examples.md updated (soul.com yearly:
  Starter €1,150 / Pro €1,210).

Still standing from 0.21.0: nothing charges until Sjoerd sets the Stripe key
+ webhook secrets and runs the sync script.

## [0.21.1] — 2026-09-01 — a face for the tab

- **Favicon at last** (`apps/web/app/icon.svg`) — the yellow sidebar tile
  with the lowercase letters, now in the browser tab. `public/` had exactly
  one file since day one; shared links stop looking bare. (OG image is P5.)
- Docs groomed to match the two productisation releases: build-plan Open
  queue rewritten (Sjoerd's Stripe steps are item 1 — no STRIPE_SECRET_KEY
  exists on Fly at all), CLAUDE.md "Where we left off", proposal §4/§5
  status lines, platform-billing-setup.md updated for the package model +
  sync script.

## [0.21.0] — 2026-09-01 — the subscription itself, and the operator's ledger

Productisation slices 2 + 3 (docs/productisation-proposal.md). Slice 1 gave
the plans their surfaces; this makes them chargeable, and gives the operator
somewhere to look.

### Added
- **Stripe Billing** (`routes/billing.ts`) — the workspace's own Fibre
  subscription, on the PLATFORM Stripe account, fully separate from Connect:
  - `POST /api/v1/billing/checkout` — subscription-mode Checkout (admin+).
    Tailored prices ride as inline `price_data` on the plan's Product; VAT id
    collection + promotion codes on. Comped workspaces are refused politely;
    a live subscription is redirected to the portal.
  - `POST /api/v1/billing/portal` — Stripe's hosted portal (card, plan
    switches, cancellation, invoice history).
  - `POST /api/v1/billing/stripe-webhook` — its OWN secret
    (`STRIPE_BILLING_WEBHOOK_SECRET`, no fallback). Drives
    `workspace_subscription`; **every paid subscription invoice lands in the
    purchase ledger under `fibre-platform`**, so a workspace sees its Fibre
    invoices on the same Invoices page as everything else, and Pulse's settle
    loop can see them. A canceled subscription moves status, never features —
    what a lapsed plan may DO is a later, deliberate decision.
  - `scripts/sync-stripe-plans.mjs` — one Product per plan, monthly + yearly
    Prices, ids written onto `billing_plan`
    (migration `20260901200000`). Checkout 503s until run.
  - Settings → Plan grew the money buttons: upgrade (monthly/yearly per
    package) when Stripe is configured, "Manage billing" once subscribed,
    renews/ends line from the live subscription.
- **/admin/economics** — the operator's view from platform tables only: MRR /
  ARR, by-plan distribution, paying workspaces (tailored + past_due flagged),
  the on-the-house list with reasons, 30/90-day ledger income (subscription
  invoices vs Connect fees), access-request pipeline. Costs are deliberately
  NOT here — the data wall applies to the operator too.
- **Operating costs seeded into Pulse** (`scripts/seed-operating-costs.mjs`,
  run today): Fly €7, Supabase €25, Vercel €20, Resend €20, domains €2,
  Stripe ~€5 as monthly budget lines ("Platform infrastructure") in
  Solidarity Lab's workspace — correct the amounts there as real invoices
  arrive. Pulse remains the business view; /admin/economics the platform one.
- Catalogues everywhere now sort Free → Starter → Pro → Enterprise
  (`sortPlans`) instead of by price, which put Enterprise (€0, POA) first.

### For Sjoerd (nothing confirms until these are done)
1. Register the billing webhook:
   `https://thefibre-api.fly.dev/api/v1/billing/stripe-webhook`
   (checkout.session.completed, customer.subscription.updated/deleted,
   invoice.paid, invoice.payment_failed) and
   `fly secrets set STRIPE_BILLING_WEBHOOK_SECRET=whsec_…`.
2. Run `node apps/api/scripts/sync-stripe-plans.mjs` once (needs
   STRIPE_SECRET_KEY in apps/api/.env or the environment).
3. The Thread Connect webhook from July is STILL unregistered — that makes
   two on the list.

## [0.20.0] — 2026-09-01 — the plans get their surfaces

Productisation, slice one (docs/productisation-proposal.md). The pricing
model was decided 2026-08-31 and the gates went live in 0.19.24 — but every
*surface* was missing: no plan screen, no admin matrix, no public price list,
no way to give a social enterprise a tailored deal, and the approval email
the request-access flow had been promising since v0.14 was never sent.

### Added
- **/admin/plans — the tier matrix, editable.** Plans as columns, every
  functionality as checkbox rows grouped by app (The Thread, Flow, Pulse,
  platform), monthly + yearly prices, allowances and the fee ladder. It edits
  the same `billing_plan` rows the gates read, so the matrix, the public
  pricing page and enforcement cannot drift. New feature *keys* remain a
  deploy, deliberately (same rule as app-key scopes).
- **Settings → Plan** — the page every `needsPlan()` refusal has pointed at.
  What you are on (incl. comped / tailored badges and effective price), what
  you are using (seats, email vs bundle), and all packages side by side. The
  shared settings card existed since the settings hub; it is un-omitted.
- **/pricing** — public price list on the marketing site, rendered from the
  new no-auth `GET /api/v1/public/plans` (catalogue only, no PII; server-side
  fetch, CORS untouched). Trial banner; every CTA routes to request-access.
- **Tailored pricing + comps on /admin/workspaces.** Each workspace row shows
  its REAL plan (`workspace_subscription`, not the legacy text column) with a
  Plan… dialog: move plan, comp with a written reason, or set a custom price
  (`workspace_subscription.custom_price_cents_month/year`, null = list).
  Prices never gate features — gates always follow the plan.
- **New workspace button** — the invited-in door for social enterprises,
  with plan/comp/tailored price set at creation
  (`POST /api/v1/workspaces`, super-admin). The signup request stays the door
  for people who ask; there is still no delete.
- **`billing_plan.price_cents_year`** — yearly prices stored (€190/€490, two
  months free), not computed, so a future promo can break the ×10 rule
  without lying. Migration `20260901190000` (…180000 was taken — the
  same-day-collision gotcha, again).
- **The approval email exists.** Approving an access request now sends the
  branded "Your workspace is ready" welcome (`platform-templates.ts`) —
  /request-access and /access-pending had promised it since v0.14.
- **Landing page grows up a little**: invited-trial chip, the four-app family
  section (from `branding.ts`, single-sourced), pricing links.

### Changed
- `GET /api/v1/plan` also returns yearly + *effective* prices (tailored ?? 
  list) and a `tailored` flag.
- `/settings/about` and `/admin/workspaces` stopped reading the legacy
  `workspace.plan` column; signup approval stopped writing it. The column is
  now fully dead.
- `lib/plan.ts` gained `forgetAllPlans()` — a plan edit invalidates the whole
  60s cache, not one workspace's entry.
- Super-admin checks share one helper (`lib/super-admin.ts`).

### Still not built (next slices, in the proposal)
Stripe Billing for the subscription itself (P2), /admin/economics + Pulse
cost seed (P3), metered overage + the 13-month archive (P4).

## [0.19.33] — 2026-09-01 — the enrolment emails belong to the thread

*"Enrolment emails — should that not be part of a thread? With a default text
that can be altered?"*

Yes. The Thread already had messages that fire on enrolment and on approval,
token substitution, per-person dedup, five languages and an editor people
know — and the platform was sending its own email straight past all of it.
Last night's editable *note* was a paragraph inserted into an email you could
not see. This is the right shape: the email **is** a message in the timeline.

### Added
- **`thread_engagement.system_role`** — `enrolment_received` /
  `enrolment_confirmed`. Ordinary messages in every other respect: they sit in
  the timeline, read in the thread's language, and are edited like any other.
- **Seeded, not required.** A new thread gets them at creation; an existing one
  the first time it is opened. The default wording is composed from the strings
  the compiled emails already use, in all five languages — so a seeded default
  says exactly what today's email says, without anybody inventing prose in a
  language they do not speak.
- **`on_application`** joins the trigger vocabulary. There was `on_enrolment`
  and `on_approval`, but the moment somebody *applies* to a gated thread had no
  name — which is precisely why that email could only ever be the platform's.
- **The ticket attaches itself.** For `enrolment_confirmed` the sender appends
  the QR block; it is not a token in the body. An organiser rewriting their
  welcome must not be able to delete the ticket from their own ticket email.
- **`{start_date}`** as an alias for `{date}` — the token Sjoerd reached for
  unprompted, and the one that reads better in a sentence written by hand.

### Changed
- **Transactional messages are exempt from the freeze** (Sjoerd's call,
  2026-09-01). `20260829140000` froze a message once sent, because two people
  receiving different words under one title is a lie the system tells for you.
  A ticket email meets that rule on the first enrolment and would be stuck with
  any typo for the life of the thread. These are addressed to one person at the
  moment they enrol, not broadcast to a cohort, so the wording may change and
  reaches whoever enrols next.
- **The compiled emails stand down** when a thread has its own, and remain the
  fallback when it does not. Delete a seeded message and enrolment still works
  — nobody loses a ticket by tidying up.
- **Triggered sends now carry the workspace's logo and sender**, which they
  did not: only the platform's own emails had been given the branding shipped
  in v0.19.17.

## [0.19.32] — 2026-09-01 — the whole logo

The workspace logo preview showed "festiv / tru" — a wordmark cropped to a
square and presented as if that were the logo.

### Fixed
- **`PhotoField` emitted `object-cover` and `object-contain` together** for the
  square shape. Both are the same utility group, so the stylesheet's order
  decided it, not the order they were written in, and cover won. A class list
  that contradicts itself has an answer; it just is not the one you meant.
- **A logo is no longer forced into a square.** Fixed height, free width, up to
  240px, on white with a little padding — the proportions the logo was drawn
  with. A face is still cropped to a circle, which is what a face wants.

## [0.19.31] — 2026-09-01 — the door answers out loud

The Thread's door now behaves exactly like festivaloftrust.com's, so both
feel identical at the entrance.

### Added
- **A camera scanner on the door list.** BarcodeDetector where the browser
  really has it — only when it names `qr_code`, because on desktop the
  constructor exists while the implementation answers `[]` forever — and a
  jsQR frame-grab fallback everywhere else (Safari).
- **Full-screen verdict, ~2.2s.** Green with a huge ✓ and the guest's name in
  display type over "Checked in"; red with ✕ and the reason over "Not
  admitted". Tap dismisses early, scanning continues underneath,
  `aria-live="assertive"`, and one buzz for green / three for red where
  `navigator.vibrate` exists.
- **Already scanned is a refusal, in red**: "«name» was already checked in at
  14:32", in the EVENT's timezone. A ticket opens the door once; the same QR
  twice is what a door exists to notice. Undo in the list, then rescan, is
  the way back.
- Repeat reads of the same code are ignored for 4s, so one ticket held in
  front of the lens does not strobe.

### Changed
- **One door at a time.** While the camera is live the per-guest taps are
  disabled and greyed, with a line saying why — a thumb resting on the list
  must not admit someone mid-scan. Search stays live in both modes.

## [0.19.30] — 2026-09-01 — your profile is yours, not your seat's

*"If I'm in various workspaces, do I need to make a profile over and over?"*

He did. The data said so: his Solidarity Lab profile held a bio and his invoice
details, his Festival of Trust profile held a photo and neither. Tahirih had
one profile and one blank. Yesterday's "one profile" was only ever one profile
*per workspace*.

One line caused it. `user_profile.user_id` references `public."user"(id)`, and
a user row is per workspace. A seat is per workspace on purpose — role, apps,
visibility all differ per tenant. A face is not one of those things.

### Added
- **`identity_profile`**, keyed by email — the same key that already finds
  someone's seats across workspaces (v0.19.1). The backfill takes the fullest
  answer per field rather than picking a row: Sjoerd's merged profile has the
  photo from one workspace and the bio from the other.
- **`identity_billing`**, keyed by email, **owner-only**.
- **`lib/identity-profile.ts`** — one reader, so the fallback to the old
  per-seat rows exists in one place and can be deleted in one place.
- **A "Signing in" section** on the profile page: email, method, last sign-in,
  and a plain statement that the email cannot be changed here yet because it is
  the key to every workspace you belong to.

### Fixed
- **Personal invoice details were readable by the whole workspace.**
  `user_profile`'s read policy is workspace-wide — correct when the row held a
  name, a bio and a photo ("they're public faces"), and quietly wrong from
  v0.13.95, when the payments SPoT added `invoice_details` and
  `stripe_account_id` to the same row. Since then a member's personal legal
  name, home address and tax number have been readable by every other member of
  their workspace.

  RLS cannot withhold a column, so the private half moved to its own table with
  its own policy. Nobody but the owner can read `identity_billing`.

### Changed
- `/api/v1/profile`, The Thread's and Meet's `/me`, and every personal reader
  in `lib/payment-accounts.ts` now resolve identity-first, with the per-seat
  rows as fallbacks. Nothing writes the old columns.

## [0.19.29] — 2026-09-01 — the same page, not the same content twice

Sjoerd, on the two profile screens side by side: *"It's not the same yet."*
Then, when they matched: *"It should be exactly the same page.. not different
pages with the same content. Right?"* And before both: *"the settings should be
the same in the whole app environment. Otherwise it is mystery meat."*

Right. Sharing a component was half an answer — two URLs that edit the same
person are still two places to keep in step, and the one that gets forgotten is
where the drift starts.

### Changed
- **One profile, in The Fibre.** The Thread and Meet no longer edit your name,
  photo, bio or timezone. They keep what is genuinely theirs — the ADDRESS of
  their public page — and link to the profile for the rest, showing a read-only
  preview of what that page will display.

  `20260901140000` fills the platform profile from whatever the apps already
  held, then clears their copies. Before it, the app columns won: Sjoerd's face
  was on his organiser row while his platform profile sat empty, which is
  exactly the screen he was looking at. `thread_organiser` and `meet_host` keep
  the columns as read fallbacks, marked deprecated. Nothing writes them.

  The cost, stated: an organiser who deliberately used a different name or
  photo on their public page than on their profile loses the distinction.
  Today that is nobody.

- **The same four sections in all five apps** — You · Workspace · This app ·
  The Fibre — from one definition in `@thefibre/shared/ui/settings`. Same
  order, same words, same descriptions, so muscle memory survives moving
  between apps.

  An entry that lives in The Fibre is **labelled "in The Fibre"** and carries
  an external-link icon. A card that silently changes domain is precisely the
  mystery meat being removed.

- **Flow has a settings page for the first time.** Its gear went nowhere. It
  has nothing of its own to configure yet, and says so.

- **The Fibre's settings index** drops the read-only block that repeated the
  workspace's name, slug, plan and creation date, and the list of app
  memberships. Facts on a page you could not act on; the name is now editable
  at Settings → Workspace.

- **The Thread's Emails & defaults is gone**, having become the second page
  editing the workspace — Settings → Workspace in The Fibre is the one.

### Added
- **`@thefibre/shared/ui/profile-form`** — the form itself, not just its
  widgets. Both apps had the same fields and the same field kit, byte for byte,
  and still produced different screens: one led with the name and paired photo
  with timezone, the other led with a full-width photo. Layout is what drifts.
- **`@thefibre/shared/ui/fields`** — the field kit, which existed identically
  in two apps. The per-app copies stay for now; moving every consumer is its
  own sweep.

### Not yet
Payments still has a page in both Meet and The Thread, both writing the same
platform values. Same duplication, one level down — it needs a payments page in
The Fibre before those two can become links.

## [0.19.28] — 2026-09-01 — one profile, one workspace

Two questions on the same evening, with the same answer underneath.

*"How come the profile page of The Thread has improved, but it is not the same
as The Fibre? It should be one. The Thread should be leading."*

*"Where can I change info from the workspace? Like name, address, logo,
invoice."*

### Changed
- **The Fibre's profile is now The Thread's.** It had two forms: "Your details"
  (full name, **Avatar URL**) writing `user`, and "Public profile" (display
  name, bio, **Photo URL**, timezone) writing `user_profile`. Two names and two
  pictures, in two tables, free to disagree — and neither was the good version,
  which had been in The Thread all along.

  One form now: upload a photo, name, bio, timezone. It saves the profile every
  app inherits **and** keeps `user.full_name` / `avatar_url` in step, because
  those are what the sidebar and the member list read; left apart they drift,
  which is how there came to be two of everything.

  The timezone stays a picker rather than The Thread's free-text IANA field —
  the one place The Fibre was ahead. "Europe/Amsterdam" typed by hand is a
  support ticket waiting to happen.

- **`PhotoField` moved to `@thefibre/shared/ui/photo-field`** and both apps use
  it. `upload` is injected rather than imported: each app talks to the API with
  its own session and `X-App-ID`, and a shared component reaching for one app's
  client would work there and mysteriously fail next door.

### Added
- **Settings → Workspace, in The Fibre.** Name, logo, invoice details (legal
  name, address, tax number), sender name, reply-to, sending domain, and the
  enrolment note.

  The name **could not be changed at all** before this — read-only on the
  settings page, with no endpoint behind it. The address and tax number lived
  in Settings → Payments inside two other apps; the logo in The Thread's email
  settings. Three places and a hole.

- **`GET/PATCH /api/v1/workspace`** — the same handler as `/workspace-brand`
  (which stays, because The Thread's settings page is written against it),
  widened with `name` and `invoice_details`.

- **`POST /api/v1/uploads`** — an image, from any app. Was `/thread/uploads`,
  which is still mounted and still works; the handler moved to
  `lib/uploads.ts` when The Fibre needed the same thing. The bucket keeps the
  name `thread-assets`: renaming it would mean rewriting stored URLs across
  live threads to make one identifier read nicely.

### Removed
- `settings/profile-form.tsx` and the two actions behind it (`updateMe`,
  `updateProfile`). Superseded, and a second way to write a profile is exactly
  how the two drifted apart.

## [0.19.27] — 2026-09-01 — a certificate that names itself

### Added
- **A saved certificate PDF is named after its holder.** The browser takes a
  "Save as PDF" filename from the page title, so the title is now
  `Name · Course · THR-2026-XXXXXX` instead of something decorative — a
  folder of them sorts and searches the way an administrator needs.
  Filename-hostile characters are replaced, not stripped.

## [0.19.26] — 2026-09-01 — show the whole logo

### Fixed
- **The logo preview cropped the logo.** `object-cover` in a short box filled
  the frame by cutting the image — a square mark lost its top, which is
  exactly the half you look at to check the upload worked. It is `contain`
  now, on a taller frame so a square logo is still legible, with padding so
  it does not touch the border. Applies to the certificate builder's
  background and element previews too, which shared the component.

## [0.19.25] — 2026-09-01 — upload the logo, don't host it first

### Changed
- **Settings → Emails & defaults takes a logo upload.** It asked for a public
  URL, which meant finding somewhere to host a PNG before you could brand an
  email. Pick the file; pasting a URL still works for anyone who already has
  one.
- `ImageUpload` moved out of the certificate builder into
  `components/ui/image-upload.tsx` — extracted the first time a second screen
  needed it, rather than copied. The DateField copies that drifted
  (v0.13.104) are why.

## [0.19.24] — 2026-09-01 — the plans mean something

`docs/pricing-proposal.md`, decided: Free · Starter €19 · Pro €49 ·
Enterprise. Seats 1 / 2 / 5 / unlimited. Free keeps 13 months.

The billing spine has existed since May — `billing_plan`,
`workspace_subscription` with a `comped` status, and a fee ladder read at
every Stripe Checkout. What was missing is what a plan BUYS.

_Housekeeping: the API code below was committed inside 1446b05 (a parallel
session's `git add`), so it is not in that commit's diff by intent and its
changelog entry does not mention it. It is described here, where it belongs._

### Added
- **`billing_plan` becomes a package.** New columns: `price_cents_month`,
  `included_seats`, `extra_seat_cents_month`, `included_emails_month`,
  `included_storage_gb`, `retention_months`. The old
  `price_cents_user_month` stays and is no longer read — the model is per
  workspace now, because a festival has two organisers and four hundred
  participants, and per-seat prices the two while ignoring the four hundred.

  Ids are not renamed: `org` keeps its id and reads as "Enterprise". It is a
  foreign key from every live subscription, and renaming it to look nicer in
  one admin screen is a migration across paying customers for no function.

- **`lib/plan.ts` — the only thing that reads a plan.** `planFor`, `can`,
  `seatAvailable`, `emailUsage`. Cached 60s: long enough to matter on every
  gated request, short enough that an upgrade lands while the person who paid
  is still looking at the screen.

  **It fails open.** If the lookup errors, `can()` says yes. The asymmetry is
  not close — a database hiccup that quietly downgrades a paying festival
  mid-event costs trust that months of correct billing will not win back,
  while the same hiccup letting someone design a template they had not paid
  for costs nothing anyone will notice.

- **The gates**, all answering 402 with the feature named and the plan that
  has it:
  - Flow and Pulse at app **activation** — one gate each, not a check
    scattered through their routes. Both apps already refuse to render for a
    workspace that has not activated them, so refusing the activation gates
    the whole app with nothing left half-open.
  - Third-party app installs (Pro), API-key minting (Pro).
  - Email logo + sender name (Starter); sending from your own domain (Pro).
  - Designing thread templates (Pro). **Using** one stays open on every plan —
    the gate is on authoring, or Starter would have no templates at all.
  - Certificates (Starter).
  - Events live at once (Free: one). Only the transition INTO live is checked;
    a thread already live stays live, because a plan change must never take an
    event off the air while people are enrolling.
  - Seats, on invite. Keys already minted keep working, and a workspace over
    its allowance keeps everybody — the limit binds on the next invite, never
    retroactively.

- **`GET /api/v1/plan`** — what you are on, what you are using, what the next
  one gives. Readable by any member: a plan is not a secret from the people it
  limits. The catalogue comes from the same rows the gates read, so a pricing
  screen cannot drift from what is enforced.

- **An email meter that needed no instrumentation.** `thread_message_send` is
  already one row per (engagement, person) — one email. Counted per calendar
  month through the engagement's thread.

### Changed
- **Every existing workspace moved to Enterprise, comped.** They were all on
  `free` + `comped` from before any of this was gated, and several are using
  Flow, Pulse, app keys and custom templates. Leaving them on Free would have
  taken those away the moment the gates landed. The first bill that removes
  something is a betrayal, and these are the people who trusted it first. New
  workspaces still start on Free.

### Not yet
Stripe Billing for the subscription itself, the plan screen, seat and overage
invoicing, and the 13-month archive — which ships only with a warning, an
export, and an upgrade that stops the clock.

## [0.19.23] — 2026-09-01 — rulers, guides, magnetism

### Added
- **Alignment guides on certificate templates, saved with the template.**
  Rulers along the top and left of the canvas: drag off one to lay a guide,
  drag a guide to move it, drop it back on the ruler to remove it. Positions
  are percentages, so a guide keeps its place if the page size or orientation
  changes.
- **Snapping.** While dragging, an element's left/centre/right and
  top/middle/bottom edges catch guides and the page's own edges and centres
  within ~1%. Hold **Alt** to place freely; a "Snap to guides" checkbox turns
  it off entirely.
- Guides live in their own `guides` column
  (`20260901100000_certificate_guides.sql`), not among `elements` — so the
  snapshot an issued certificate keeps (page, background, elements) cannot
  include them by construction. A design aid never becomes content.

## [0.19.22] — 2026-08-31 — a certificate that proves itself

### Added
- **A QR code element for certificate templates.** Drop it on the design and
  every issued certificate carries a code linking to its own verification
  page — which is the point on paper: whoever is handed the certificate can
  check it is real. `GET /public/certificate/:number/qr.png` generates it, so
  it prints at whatever resolution the printer asks for. The builder shows a
  placeholder, because the number only exists once a certificate is issued.

## [0.19.21] — 2026-08-31 — type the position, not drag it

### Added
- **A position tool in the certificate builder, Illustrator-style.** A
  nine-square reference picker chooses which point of the PAGE the numbers are
  measured from — top-left, top-centre, right-middle, and so on — then X and Y
  are typed in **mm or px**. Positive always points inward, so "10 from the
  right" means the same whichever corner is selected. The element's own
  matching edge is what gets measured, and its height comes from the DOM,
  because how tall a line of text wraps is not in the model.
- **Width is typeable** in the same unit, not only draggable.
- **Opacity is typeable** as a percentage, next to its slider.
- **Type is set in points.** Stored as px and converted for display
  (1pt = 96/72px), so every existing design keeps the size it had.

Page geometry lives in `lib/certificate-types.ts`: A4 210×297mm, Letter
215.9×279.4mm, px at 96dpi — the ratio a browser prints at.

## [0.19.20] — 2026-08-31 — remove it where it is

### Changed
- **Delete moved onto the element.** A small dark dot with a cross sits on the
  selected element's top-right corner, the way every design tool does it —
  instead of a button in the toolbar, far from the thing it deletes. On all
  three kinds (text/field, image, line); hidden while a text element is being
  edited. Delete/Backspace still works, and the toolbar is one control
  lighter.

## [0.19.19] — 2026-08-31 — the controls come with you

### Fixed
- **The certificate builder's formatting bar sticks to the top while you
  scroll.** An A4 canvas is taller than the viewport, so working on anything
  near the bottom of the page meant scrolling to it and leaving every
  control — font, size, colour, alignment, arrange, delete — behind. It now
  follows down the page, opaque so the canvas passes underneath it.

## [0.19.18] — 2026-08-31 — a card keeps you where you are

### Changed
- **A card embed always opens the enrolment popup**, never links out to the
  thread page. It used to defer to the thread's `public_interaction`, so a
  page-interaction thread sent the visitor off the site — to read the same
  cover, title, date and price the card had just shown them.
  `public_interaction` decides how a LISTING opens a thread; a card has
  already made that choice.

### Added
- **Card with the registration form in it** — `data-form="1"`, the third
  shape: no click at all, the form sits inside the card. Offered in both
  generators (Settings → Website embeds, and a thread's own Embed tab) and
  documented at /developers.

## [0.19.17] — 2026-08-31 — whose email is this

An enrolment sent three emails. The first ("request received") and the third
("you're enrolled", with the QR ticket) are the platform's — compiled in,
translated into five languages, editable nowhere. The second existed only
because the other two could not be written in.

And all three arrived branded The Fibre, from The Fibre, for a festival that
is not The Fibre.

### Added
- **The organiser's own words, inside the platform's two enrolment emails.**
  Set once for the workspace at Settings → Emails & defaults, overridable per
  thread on the Registration tab. Write it and the middle email is no longer
  needed.

  Null at the thread inherits the workspace's; empty string means this thread
  deliberately adds nothing. A textarea cannot say both, so the thread carries
  a switch — the same null-means-inherit shape as payment methods.

  Newlines become paragraphs and everything else is escaped: this is text on
  its way into HTML, written by someone who is not writing markup.

- **Workspace branding on outgoing email.** `workspace.brand_logo_url` replaces
  the platform wordmark at the top. The footer links, whitelist hint and legal
  line stay — those are obligations, not decoration, and remain true whoever
  the mail looks like it came from.

- **A sender, in two halves with very different costs.** `email_from_name` is
  free: a mailbox shows the display name, and the address behind it can stay
  ours, so mail reads as "Festival of Trust" tonight with no setup at all.
  `email_from_address` needs SPF and DKIM on that domain, verified with Resend.
  `email_reply_to` is free again — the cheap way to be reachable under your own
  domain while DNS is pending.

  Set an address before the domain is verified and mail still arrives: the
  send is retried from the platform address, keeping your name, and the refusal
  is logged with what to do about it. Losing somebody's ticket to a DNS record
  is not an acceptable way to find out.

- **`GET/PATCH /api/v1/workspace-brand`** — admin-only, sibling of
  workspace-billing. Read everywhere through `lib/workspace-brand.ts`.

### Fixed
- **Settings → Emails & defaults has been writing to nothing since v0.13.x.**
  `thread_settings.email_from_name` and `email_footer_note` were stored and
  editable, and no send site ever read them: someone set a sender name, saved
  it, and every email since went out saying The Fibre. They are now read
  fallbacks behind the platform values (the payments-SPoT arrangement), so
  those saves finally mean something. Never written again.

## [0.19.16] — 2026-08-31 — the tokens, on screen

### Added
- **A Tokens panel in the certificate builder's left column** — all nine, each
  showing the literal token, what it means, and what it becomes
  (`{start_date}` · Start date · *8 Aug 2026*). Click one to insert it into
  the selected text element. A list you can read beats a list you have to go
  looking for.

### Fixed
- **Delete moved out of the scrolling properties bar.** It has been there
  since v0.13.68, pinned right — but the bar scrolls horizontally, so with a
  text element's full set of controls it sat past the scroll edge and read as
  "there is no way to delete this". It is now outside the scroll area,
  always visible. (Correcting the previous entry: the control existed; it was
  unreachable, not absent. The duplicate "Remove" added in 0.19.14 is gone;
  the Delete/Backspace shortcut stays.)

## [0.19.15] — 2026-08-31 — the box fits the words

### Fixed
- **A text element shrank when you started editing it** in the certificate
  builder. Reading, it was a div that grew to its content; editing, it became
  a `rows={3}` textarea with `overflow: hidden` — so anything longer than
  three lines collapsed on double-click, and what you typed past that was
  clipped out of sight. The textarea now grows to fit, so editing looks like
  the certificate will.

## [0.19.14] — 2026-08-31 — take it off the certificate, and say the date

### Fixed
- **You could not remove an element from a certificate template.**
  `deleteSelected()` had been there since the builder shipped and nothing ever
  called it. The properties bar now ends in **Remove**, and Delete/Backspace
  does it too (ignored while a caret is in a field).

### Added
- **Every token, offered.** The bar named `{recipient_name}` and left the
  other eight invisible — they all worked, `substituteFields` has handled any
  `{token}` since the start. A picker now inserts any of them:
  `{thread_title}`, `{start_date}`, `{end_date}`, `{issue_date}`,
  `{org_name}`, `{certificate_number}`, `{criteria}`, `{issued_by}`.
  Unknown tokens still pass through untouched rather than rendering as blanks.

## [0.19.13] — 2026-08-31 — a copy that is actually a copy

### Fixed
- **Duplicating a thread lost its pricing.** Tickets were never copied — and
  when a thread has tickets they ARE its price (`effectivePrice` takes the
  lowest active one), so the copy read "Free" no matter how carefully
  `price_cents` was carried over. Verified against a real €1850/€500 thread:
  the copy now carries both tickets, limits included.
- Discount codes come along too, with `used_count` reset — the new run starts
  its allowance at zero. `ticket_id` scoping is dropped rather than guessed at
  (it pointed at the source thread's ticket).
- **Columns that shipped after this route was written and were never added to
  it**: `payment_methods`, `share_participants_public`,
  `share_participants_participants`, `public_agenda` — each silently reverted
  to its column default on every copy. Categories now copy as well.
- **`daily_schedule`** on engagements: a duplicated two-day event lost its
  per-day times.
- **Event-anchored messages are re-anchored to the copy.** A message set to
  "1 day after the opening ceremony" pointed at the ORIGINAL's ceremony, so
  moving the copy's dates would not move it. Two-pass insert with an
  old-id→new-id map.

### Added
- **Click a discount code to copy it.** The row still opens the editor; the
  code itself is now its own button — a code exists to be sent to someone,
  and retyping it off the screen is how a typo reaches a customer.

## [0.19.12] — 2026-08-31 — the address knows where it is

### Added
- **Type an address, get the map link offered.** Under Location link, once
  there is an address and no link yet: "Use a Google Maps link for …" — one
  click fills it. Built from Google's documented search URL, so there is no
  geocoding service, no API key, and the address never leaves the browser
  until someone clicks the finished link. Offered rather than auto-written:
  a venue with its own page deserves that link instead, and silently
  overwriting would bury it.

## [0.19.11] — 2026-08-31 — days that belong together, and a refusal you can read

### Changed
- **The timeline moulds a multi-day activity to the days it covers.** A
  two-day event and a conversation on its second day used to render as two
  free-floating groups; the second day now attaches to the first as one
  continuous block, each day keeping its own date badge. Days a single
  activity spans form a "run"; separate days still sit apart.

### Fixed
- **"Delete does nothing"** on a message that had already been sent. Two
  faults stacked: the dialog discarded the result of `deleteEngagement`, so a
  refusal closed the dialog and left the item there; and `pgErrorMessage`
  replaced the trigger's own carefully-written sentence with a generic line.
  Our triggers (SQLSTATE P0001) now speak for themselves and answer 409 —
  "This message has already been sent to 2 people and cannot be deleted…" —
  and the dialog shows it instead of pretending to succeed.

## [0.19.10] — 2026-08-31 — the end follows the beginning

### Fixed
- **Moving an activity's start date left the end date behind.** Ends was an
  uncontrolled field with a `min`: picking a new start tightened the
  constraint but never touched the value, so the dialog would sit there
  reading "Starts 17 Sept · Ends 2 Sept" until someone noticed. Ends is
  controlled now and moves with the start, **keeping the gap** — a 7½-hour
  day stays 7½ hours, a two-day activity stays two days — the same way a
  thread's engagements shift when the thread's own start date moves. With no
  end yet (or one stranded before the start) it opens an hour.

## [0.19.9] — 2026-08-31 — a thread belongs somewhere

Categories, as Sjoerd specified them: made in Settings, scoped to the
workspace or to one organiser, and a thread picks one or more. **Not tags** —
a curated list, not free text on the thread.

### Added
- **Settings → Categories** — add, rename, delete; "Whole workspace" or "Only
  me". Renaming keeps the slug on purpose: the slug is the public filter other
  websites may already embed, so a wording tweak must not break their
  listings. Migration `20260831140000_thread_categories.sql`
  (`thread_category` + `thread_thread_category`, slug unique per workspace so
  a public filter is never ambiguous).
- **Categories on the thread** — a chip row in thread settings → Basics,
  multi-select, saved with the rest of the form
  (`PUT /threads/:id/categories`, replace-the-set).
- **Public + embeds** — `categories: {name, slug}[]` on the listing and
  thread payloads (additive, rule 8), `?category=<slug>` on the listing,
  `data-category` on the list embed, and a Category picker in the Settings →
  Website embeds generator. /developers and verify-public-api.mjs updated.
- **Through the app key** — `categories: string[]` on the thread PATCH, BY
  NAME: the planner sends its own vocabulary and the platform resolves each
  name to the workspace's category, minting missing ones workspace-scoped, so
  a sync never manages platform ids.

## [0.19.8] — 2026-08-31 — a string, not a proxy

### Fixed
- **Settings → Website embeds 500'd in production** ("Application error",
  digest only). `DEFAULT_EMBED_CSS` lived in embed-generator.tsx — a
  `'use client'` module — and every export of a client module reaches a
  Server Component as a client-reference proxy, not the value. The page
  calls `.split('\n')` on it during SSR; on the proxy that throws. The
  constant now lives in its own server-safe module
  (`default-embed-css.ts`), imported by both sides as a plain string.

## [0.19.7] — 2026-08-31 — the event on your own website

Website integration, both places Sjoerd named.

### Added
- **Card embed** — one thread as a compact card (cover, title, date, price,
  one button honouring the thread's page/popup interaction):
  `data-thread-embed="card"`, rendered by `/embed/card`. The thread-level
  counterpart of the list.
- **Thread settings → Embed tab** — the generator scoped to ONE thread: card
  or registration button, language, and an Any-website / Webflow toggle that
  labels the two blocks with Webflow's actual place names (Site settings →
  Custom code → Head code; Embed element). Any-website also offers an
  all-in-one block (embed.js is idempotent, a doubled script tag is safe).
- **Settings → Website embeds generator** grows the same Webflow toggle, the
  Card kind, and a list "Kind" filter — events only / journeys only — backed
  by `?format=event|journey` on `GET /public/embed/threads` (additive,
  ignored when invalid so a typo degrades to the full list, not a broken
  widget) and `data-format` on the list embed. /developers documents both.

## [0.19.6] — 2026-08-31 — every app can switch workspace, to the ones it works in

The switcher shipped in v0.19.1 only in The Fibre. Thread, Meet, Flow and Pulse
have the same account menu, so being in the wrong workspace there meant going
to The Fibre, switching, and coming back.

### Added
- **Workspace section in the account menu of Thread, Meet, Flow and Pulse.**
  Same behaviour as The Fibre's: record the choice, refresh the token so the
  access-token hook stamps the new workspace, re-read. Hidden when there is
  nothing to choose between.
- **`has_app` on `GET /auth/workspaces`.** Per workspace, whether the app that
  asked — the `X-App-ID` on the request — can actually be used there: switched
  on for the workspace, and granted to that person's seat in it. A seat is per
  workspace, so the grant is looked up per seat; the same person can hold The
  Thread in one workspace and not in another.

  Each app lists only those. Without the filter the menu would offer dead
  ends — every one of these apps redirects to `/no-access` without both halves,
  so switching into a workspace you have no grant in would bounce you straight
  out of the app you were using.

  The Fibre is exempt and lists every seat: it is not an app a workspace
  activates, it is where the account lives.

### Changed
- **Switching lands on the dashboard** rather than refreshing where you stood.
  A contact, a thread, a flow run — every id on screen belongs to the workspace
  being left, and means nothing in the one being entered. Refreshing in place
  showed an empty page or a 404 as the reward for switching.

## [0.19.5] — 2026-08-31 — work can change hands without the seat being retired

v0.19.3 gave us the wrong-address case: make the seat, move the grants, retire
the old one. It refuses outright when the old seat owns anything. This is that
refusal's other half — a seat that has been *used*, whose work should now sit
under the address its owner actually signs in with, while the old seat stays
usable as a way back in.

### Added
- **`apps/api/scripts/hand-over.mjs`** — `--workspace <slug> --from <email>
  --to <email>`, a dry run unless `FIBRE_HANDOVER_CONFIRM=1`. Moves the Thread
  storefront (every thread hangs off it, so they follow), template and
  certificate-design authorship, engagements, flow ownership and versions,
  runs and open tasks, the Meet host record, Pulse budget lines and
  commitments. The destination is granted whatever apps the source holds, or
  it could not open what it now owns.

  Four things it deliberately leaves, and prints as STAYS rather than passing
  over in silence:

  - `activity.created_by` — the log is append-only (brief §5). It records who
    did a thing on a day; rewriting it makes the past say something that did
    not happen.
  - `workspace_app.activated_by` — the same kind of fact, and it grants
    nothing today.
  - `user_profile` — display name, timezone, payment details keyed to that
    seat. The old seat is being kept, so it keeps its own.
  - `app_membership` / `workspace_member` / `user_identity_provider` —
    stripping these would leave a backup account that cannot sign in, which is
    not a backup.

  It stops before writing if the destination already has a Thread storefront:
  two cannot be merged, and finding that out halfway through a run is worse
  than not starting.

Run today for the Festival of Trust workspace, moving the storefront, both
threads, two templates, three engagements and two flows from
`sjoerd+fot@soul.com` to `sjoerd@soul.com` — one account to sign in with, the
plus-address kept as a way back in.

## [0.19.4] — 2026-08-31 — the person field is a search field

Linking a person to an organisation, or enrolling one in a programme, meant
picking from a dropdown of the first hundred contacts. Both halves of that fail
as a workspace fills up: a hundred names is not a list you read, and contact
101 was not offered at all — the person you wanted could be missing with
nothing on screen to say so.

### Changed
- **`PersonCombobox`** replaces the person `<select>` in the organisation's
  Add member dialog and the programme's Enrol dialog. Type a name; it queries
  `/persons?q=` after a 200ms pause and lists matches with their email beside
  them. Arrow keys and Enter work, as in the country picker it is shaped after.

  It shows the page's first twenty contacts before you type, so picking a
  recent one is still a single click and the field is never empty.

  Search runs on the API under the caller's own RLS, so a picker can never
  surface somebody its user could not already see. Out-of-order replies are
  dropped rather than applied: without that guard a slow "ma" can land after a
  fast "marja" and quietly replace the results you are looking at.

  Typing after a pick clears the pick. The alternative — leaving the id set
  while the text says something else — submits a person nobody chose.

  Members already linked are excluded by id, which the page now passes down
  rather than pre-filtering its list: a name typed in has to be filtered too,
  not only a seeded one.

## [0.19.3] — 2026-08-30 — a seat can be moved to the right address

An invite goes to an address, and a workspace membership IS that address: a row
in `public."user"` keyed by (workspace_id, email). So an invite sent to the
wrong one is not a field to correct — it is a seat under a name that is not
theirs, holding the app grants somebody meant to give them.

The Members screen can invite and can remove. It cannot say "this is the same
person, under the address they actually use", because that is three writes that
have to happen together: make the seat, move the grants, retire the old one.

### Added
- **`apps/api/scripts/transfer-membership.mjs`** — does exactly those three,
  and nothing else. `--workspace <slug> --from <email> --to <email>`; a dry run
  unless `FIBRE_TRANSFER_CONFIRM=1`. Where the target already holds a seat, the
  grants are added to it rather than a second one being made.

  It refuses to run if the old address owns anything — a thread, a flow, an
  invoice, a Meet host record. Moving content is a different job and a person
  should look at it; silently orphaning it is the failure this guard exists to
  prevent. In practice a mis-addressed invite has never been signed into and
  owns nothing.

  The old user and person rows are soft-deleted (brief §6). The
  `workspace_member` and `app_membership` rows are join rows and go outright —
  left behind, a retired seat keeps appearing in the Members list.

  It does not touch that person's seats in other workspaces. Since v0.19.1 one
  account may hold several, and the usual reason to run this is to make the
  address here match the one they already use elsewhere.

## [0.19.2] — 2026-08-30 — a second membership must not lock you out

v0.19.1 let one account hold a user row in several workspaces. Two places still
assumed exactly one, and the first person to gain a second membership was shown
the request-access form on their own account.

### Fixed
- **`/sso/access-check` treated a second membership as no account at all.**
  It looked the person up with `.maybeSingle()`, which treats more than one row
  as an **error** rather than a result: `data` came back null, the check read as
  "no account", and a returning member was sent to sign up. Now ordered,
  `limit 1`.

  Which workspace it returns barely matters, deliberately: the callback resolves
  into it, refreshes the session, and the access-token hook decides the active
  workspace by applying the person's own choice. This only has to name a
  workspace they really belong to — and the earliest is the hook's own fallback,
  so the two cannot disagree.

- **Inviting a colleague refused anyone who was already in another workspace**,
  with "that email already belongs to another Fibre workspace". That was correct
  when an email meant one workspace and is exactly backwards now. The lookup is
  scoped to the current workspace, where `unique (workspace_id, email)` makes
  `.maybeSingle()` safe again, and the refusal is gone: inviting someone who
  works in another workspace now does what you would expect.

### Note
Both are the same mistake — code that read "the user with this email" when the
question had become "the user with this email, in this workspace". Every other
by-email lookup in the API was checked; these were the two.


## [0.19.1] — 2026-08-30 — one account, several workspaces

Until now the workspace you were in lived in your login token and nowhere else.
The hook stamped one `workspace_id`; every policy asked the token rather than
the person. `current_workspace_id()` is read **238 times across 32 migrations**,
so the workspace was welded to the session — which is why reaching a second
workspace meant a second email address, and switching meant signing out.

### Added
- **`user_active_workspace`** — which workspace a sign-in is currently acting
  in. Keyed by `auth.users.id`, because that is the identity that spans
  workspaces; `public."user".id` does not, it *is* the per-workspace row.
  RLS on, **no policies**: only the service role writes it, so a client cannot
  put itself in a tenant by writing the table directly.
- **`GET /api/v1/auth/workspaces`** — the workspaces you belong to, and which
  one this token is acting in.
- **`POST /api/v1/auth/workspace`** — switch. Membership is the gate: you must
  already have a live `user` row in the target. Returns `refresh_required`,
  because recording the choice changes nothing until a new token is minted.
- **A workspace section in the account menu**, which hides itself when there is
  only one — as there is for almost everybody. Switching records the choice,
  calls `refreshSession()` so the hook re-stamps the token, then re-renders.

### Changed
- **The token hook picks deterministically.** It was `limit 1` with no ordering
  — fine with one row, arbitrary with two. Now: the chosen workspace if one is
  set and still valid, otherwise the earliest membership. A hook that picked
  differently on two consecutive sign-ins would look exactly like data
  disappearing.
- **`resolve_sso_identity` matches an identity within one workspace.** Step 1
  matched on `(provider, provider_user_id)` alone, which is global — the same
  Google identity legitimately has a row in each workspace, so it would have
  resolved a sign-in into whichever was found first. There is deliberately no
  unique constraint on that pair: one identity, many rows, one per workspace.

### What deliberately did not change
**Every RLS policy.** They all read `current_workspace_id()`, which still
returns exactly one workspace. This changes *which* one and lets a person move
between them; it does not let a token name two at once. A request is still
answered inside exactly one tenant — the property the whole data wall rests on,
and the one not worth trading for convenience.

### Verified
Against the live database, with a real second membership: with no choice set
the session stays put; choosing a workspace lands the next token in it, with
the right `app_user_id`; choosing back returns. Switching to a workspace you
are not a member of is refused. And the data follows — 12 contacts in Festival
of Trust, 23 in Solidarity Lab, same account, policies untouched.


## [0.19.0] — 2026-08-30 — the door

Check-in, end to end (Sjoerd 2026-08-30). Migration
`20260830120000_thread_checkin.sql`: every registration carries a
`checkin_code` — a capability that only ever OPENS read surfaces; the state
change always runs the organiser authority check (loadEnrolmentForAction).

### Added
- **The ticket in the confirmation email** — a QR block (image served by the
  API; data URIs get stripped by mail clients) in all four sends: instant
  enrol, approval, paid finalization, manually-added participant. i18n ×5.
- **Wallet passes, env-gated** (`lib/checkin.ts`): Apple `.pkpass` (signed
  event ticket, passkit-generator) and Save-to-Google-Wallet (RS256 JWT via
  jose, object inline — no Wallet API round-trip). The email offers each
  button only when the platform can honour it; unconfigured endpoints answer
  503 with a sentence. Credentials are issuer accounts only Sjoerd can
  create — new build-plan item.
- **`/checkin/[code]`** in The Thread — the scan landing. Camera → link →
  signed-in organiser one tap from done; first tap wins (two volunteers
  scanning the same ticket both see "checked in", one timestamp). Undo for
  mistaken taps. A guest scanning their own ticket gets a polite refusal.
- **`/threads/[id]/checkin`** — the door list, mobile-first: search by name
  or email, tap a row to check in/undo, running count, "not approved yet" /
  "payment pending" flags. Linked from the timeline header (ScanLine icon).
  Declined applications don't appear.
- **The door through the app key** (the FOT planner's ask), riding on
  `review:enrolments` — door admission is the same authority family as
  application review: `checkin_code` + `checked_in_at` on the enrolments
  list, `GET /apps/:slug/thread/checkin/:code`,
  `POST /apps/:slug/thread/enrolments/:id/checkin` `{undo?}`. Same
  `performCheckinEnrolment` core as The Thread's own door. Verifier 7d
  extended: scan-resolve, tap, second-scan-harmless, refusal without scope.
- `checked_in_at` on The Thread's own enrolments list (registrations dialog
  data source, door list).

## [0.18.27] — 2026-08-30 — the agenda reads back

### Added
- **Activity fields on the app-key engagement read** — `starts_at`, `ends_at`,
  `daily_schedule`, `location`, `location_url`, `meeting_url`,
  `meeting_provider` (additive). An app could always WRITE them; now it reads
  them back, which is the door the planner's agenda migration was waiting on:
  the site lays its sessions down in The Thread and renders its public agenda
  from here, organiser edits included. `verify-external-app.mjs` pins the
  full 24-key engagement shape and asserts the timing/place round-trip.

## [0.18.26] — 2026-08-30 — the organiser decides where they already look

The festival planner's brief "enrolment review through the app key", both
asks. A gated festival receives applications; its organiser reviews them on
the site, not in The Thread.

### Added
- **`awaiting_approval`** on the app-key enrolments list (additive). The
  platform `status` was already there, but 'invited' is ambiguous — it also
  means "hasn't paid yet" on ungated paid threads. This is true exactly when
  the organiser's decision is what the person is waiting for.
- **`review:enrolments` scope** +
  `POST /apps/:slug/thread/enrolments/:id/{approve,decline}`. A decision on
  an enrolment the person created themselves — the app still cannot conjure
  one (no `write:enrolments`, unchanged). Constrained to the app's own
  threads (`source_app`), like every Thread surface. Both routes converge on
  the SAME cores as The Thread's signed-in buttons —
  `performApprove/DeclineEnrolment`, extracted from the existing routes, so
  the confirmation email, the waiting on-enrolment/on-approval messages, the
  activity rows and the checkout-session expiry on decline cannot drift
  between the two doors.
- `verify-external-app.mjs` step 7d: applications marked, refusal without the
  scope, admit → enrolled, decline → dropped. All steps pass.
- `docs/building-on-the-fibre.md` §5.5 documents the surface.

## [0.18.25] — 2026-08-30 — the editor is for the timeline

### Changed
- The thread editor no longer renders the intention under the title. It was
  fine when intentions were a sentence; once the Festival planner started
  syncing full festival descriptions into the field, the whole text sat
  between the title and the timeline and pushed the actual work below the
  fold. It still lives in Settings → Basics and on the public page — the two
  places it is actually for. The Team chip stays.

## [0.18.24] — 2026-08-29 — the app edits the agenda, because The Thread owns it

`docs/brief-thread-engagements-from-apps.md` §7 held the activity family back:
"two systems both authoring the agenda is a sync problem nobody has scoped…
Activities can follow once someone has decided which side owns the agenda."

Sjoerd decided: The Thread owns it, and the planner's editing screen is a
window onto that rather than a second copy. So activities open.

### Changed
- **Both engagement families are writable** on `POST /apps/:slug/thread/threads/:id/engagements`
  and `PATCH /apps/:slug/thread/engagements/:id`. Type may still only move
  within its family — an agenda item does not become a message by being
  retyped.
- **The scope split follows what the thing can do**, not which route it arrives
  on. Both routes are allow-listed under `write:programs`, which owns thread
  content; the handler additionally demands `write:messages` when the type is
  message-family, because only that family can cause an email to reach a human.
  The route table cannot see the body, so the check lives where the body is.

  This is a **relaxation** for the agenda and unchanged for messages: a key
  without `write:messages` gained the ability to write agenda items and still
  cannot write, edit or send a message.

### Verified
`verify-external-app.mjs`, all steps passing, four new:
an agenda item is written; one outside the event's dates is refused
(`activityWindowError` still applies); an agenda item cannot be retyped into a
message; and a key without `write:messages` still cannot write one.


## [0.18.23] — 2026-08-29 — whether the page has an agenda at all

### Added
- **Public agenda switch** on thread settings (Sharing, next to "List on the
  organiser's public page"). Two layers on purpose: this switch decides
  whether the public page HAS an agenda; the per-element "Show on the public
  agenda" toggle decides what it is made of. Off = `agenda` is `[]` in the
  public payload and neither the page nor the embed renders the section.
  Defaults on — every existing public page keeps its agenda. Published as
  `public_agenda` on the thread payload (additive, rule 8); /developers and
  verify-public-api.mjs updated. Migration
  `20260829170000_thread_public_agenda.sql` (renamed past the parallel
  session's 20260829110000 — same-day timestamp collision).

## [0.18.22] — 2026-08-29 — the organiser picks the structure

Several thread templates, and the event organiser chooses between them from the
app that owns the festival. Structure, not design: a template is the shape of a
thread — its settings and its items — and the organiser fills in the content per
event.

### Added
- **`GET /apps/:slug/thread/templates`** (`read:programs`) — what a festival can
  be built from. Returns `title`, `scope`, `item_count` and `sends_messages`.
  **`structure` itself is deliberately not returned**: it is The Thread's
  internal shape, and an app that read it would end up depending on it. What an
  organiser needs to choose is the name, a sense of size, and whether picking it
  will email anyone.
- **`template_id` on `POST /apps/:slug/thread/threads`** — build the event from
  the chosen structure, its items rebased onto `starts_on`.

### Security
- **A template is not a way around `write:messages`.** The allow-list gates
  publishing on `write:programs` and cannot see inside a template — but a
  template carrying message-family items can email everyone who enrols. The
  route loads the template first, and refuses with `missing-scope` when it
  contains messages and the key lacks `write:messages`. Asserted in
  `verify-external-app.mjs`: *"a template full of messages is not a way around
  write:messages"* → 403.

### Changed
- **`seedTemplateEngagements` extracted** from The Thread's own
  `/thread-templates/:id/instantiate`, which now calls it. One implementation
  with two callers rather than two that drift — and the one that drifted would
  be the one nobody was looking at. `templateHasMessages` alongside it.
- The template is loaded and its scope checked **before** anything is written,
  so a bad id or a missing scope cannot leave a half-built event behind.

### Notes
- `created_by` is null on the app path: there is no user behind a key.
- All templates in the workspace are listed, not only workspace-scoped ones. A
  template is authored structure with no personal data, and the key is
  workspace-bound; `scope` is returned so an app can show or filter on it.
- Verified end to end: the list reads, a festival builds from a template, and
  the template's items arrive with it.


## [0.18.21] — 2026-08-29 — editing and deleting a message, and a refusal that reads like one

Steps 4 and 5 of §8 in `docs/brief-thread-engagements-from-apps.md`, closing it.

### Added
- **`PATCH`** and **`DELETE /apps/:slug/thread/engagements/:id`**, both
  `write:messages`. Ownership is checked **one level down**, as the brief
  insists: the engagement resolves to its thread, and the thread must belong to
  the calling app. `workspace_id` alone would let one app edit a message on a
  thread another app published.
- Neither route enforces "sent messages are frozen" itself — the trigger from
  v0.18.20 does, so The Thread's editor obeys the same rule. These surface the
  refusal properly.

### Fixed
- **A deliberate refusal read as a server error.** `pgErrorStatus` had no case
  for `P0001`, so every `raise exception` in the platform — append-only
  activity, the super-admin interlock, and now freeze-once-sent — came back as
  **500**, and `pgErrorMessage` replaced the trigger's carefully written
  sentence with the generic *"The database would not accept this change."*
  `P0001` now maps to **409**, and its message passes through untouched.

  Every `raise exception` in the codebase was checked before doing this: all of
  them are written for a person, which is what makes passing the text through
  safe rather than a leak.

  This fixes The Thread's editor as much as the app surface — the sentence
  explaining *why* and what to do instead is the only useful part, and it was
  being thrown away.

### Verified
`verify-external-app.mjs` passes in full, now including re-wording and deleting
an unsent message, and refusing both without `write:messages`. Separately,
through the running API on the human path: editing an unsent message returns
200; editing a sent one returns **409** carrying *"this message has already been
sent to 1 person and its wording cannot be changed…"*.

### Notes
- `EngagementUpdate` is imported from `routes/thread.ts`, like the create schema.
  No `omit` needed — it is `EngagementCreate.partial()`, and `source_ref` only
  ever existed on the app-side create. An app names its own ref once, at
  creation, and addresses the engagement by id afterwards.


## [0.18.20] — 2026-08-29 — a message that has been sent cannot be altered

Sjoerd's rule, and the reason he gave is the whole argument: a message sends to
whoever is enrolled at the time, and the scheduler keeps sending it to people
who enrol later — dedup is per `(engagement_id, person_id)`, so a later
registrant is a fresh send. Edit the text after the first send and two people
receive different words under one title, with nothing recording that they differ.

**This was a live hole in The Thread, not a gap on the app surface.** `PATCH
/thread/engagements/:id` and `DELETE` had no such guard, so a human could do
exactly this today. Guarding only the app surface would have left the real bug
in place and made an app stricter than the people using the product.

### Added
- **`thread_engagement_frozen_once_sent()`**, a trigger on `thread_engagement`
  before update and before delete. Once any `thread_message_send` row exists:
  - `title`, `description` and `content` are immutable — what a recipient
    receives is fixed;
  - the row cannot be deleted at all. `thread_message_send.engagement_id`
    cascades, so deleting a sent message drops the record of who received it,
    and a planner re-creating it from its own copy would send to them again.
- **Deliberately still editable:** `status`, `position`, `show_in_agenda` and the
  trigger/timing columns. You must be able to **stop** a message reaching future
  registrants (`status` → `draft`), reorder a timeline, or re-time what has not
  gone yet. Freezing those would make "sent to one person" mean "this thread can
  no longer be managed".

### Notes
- In the database rather than in either route, because both surfaces have to
  obey it and the human one is where the hole actually was.
- Safe against the senders: `sendTriggeredMessages` and
  `runThreadMessageScheduler` only **read** engagements, so nothing here can
  block a send in progress. Checked before writing the trigger.
- Verified against the live database: before a send everything is editable;
  after one, wording, title and delete are refused while stop and reorder still
  work.
- Two follow-up migrations are grammar on the message a person reads
  ("1 people" → "2 persons" → "1 person / 2 people"). Behaviour unchanged.
- Still open from `docs/brief-thread-engagements-from-apps.md` §8: steps 4 and 5,
  the app-surface PATCH and DELETE. Both now inherit this rule for free.


## [0.18.19] — 2026-08-29 — an app can write the messages around its own event

Steps 2, 3 and 6 of §8 in `docs/brief-thread-engagements-from-apps.md`. The
planner could publish a festival, describe it, credit its hosts, open enrolment
and read who registered — and then not write a word that goes out to those
people.

### Added
- **`write:messages`** — a new scope, deliberately not folded into
  `write:programs`. Nothing on this surface could previously cause an email to
  reach a human: `write:programs` publishes a page and edits settings, and every
  send originates from the public enrolment form. The moment an app can publish
  a message-family engagement, whatever scope allows it also means *this
  credential can email everyone enrolled, from the platform's domain, on a
  five-minute timer*. Folding that in would have granted it silently to every
  key already holding `write:programs`.
- **`POST /apps/:slug/thread/threads/:id/engagements`** (`write:messages`) and
  **`GET`** the same path (`read:programs`).
  - **Message family only.** Activities are the public agenda, validated against
    the programme's dates, and the planner has its own sessions model — two
    systems authoring one agenda is a sync problem nobody has scoped.
  - **Idempotent** on `(thread_id, source_app, source_ref)`, returning
    `created: true|false` exactly as the thread publish does, so a retried sync
    cannot produce a second welcome email. A losing race on the unique index is
    read back rather than failed.
  - **`trigger_anchor_ref`** names the anchor by the app's *own* ref, resolved
    server-side, so a sequence can be laid down in one pass before platform ids
    exist. Naming both it and `trigger_engagement_id` is a 400.
- **Verification, before the routes shipped rather than after** (§8 step 6):
  `thread_message_send`, `sends`, `sent_at` and `recipients` joined `WALLED_OFF`,
  and `verify-external-app.mjs` now writes an engagement, checks the wall on both
  the create and the list response, and asserts a key **without**
  `write:messages` is refused. All steps pass.

### Notes
- `EngagementCreate`, `MESSAGE_TYPES`, `activityWindowError` and
  `dailyScheduleError` are **imported** from `routes/thread.ts`, not restated. A
  second copy would drift from the first.
- `created_by` stays null on app writes — it is a FK to `public."user"` and there
  is no user behind an app key.
- Delivery data stays behind the wall: no `thread_message_send`, no app-addressed
  sends, and token substitution stays server-side. The app writes the token; it
  never sees what the token resolves to.
- **Action needed before the planner can use this:** `app_key.scopes` is a stored
  column, so an existing key does not acquire the new scope. The fot-planner
  manifest must declare `write:messages` and its key be re-minted.
- Still open from the brief: §8 steps 4 (PATCH) and 5 (DELETE, which needs the
  `thread_message_send` guard — deleting an engagement that has already sent
  takes the dedup log with it and re-sends to everyone).


## [0.18.18] — 2026-08-29 — an engagement can carry the app's own id

Step 1 of §8 in `docs/brief-thread-engagements-from-apps.md`. Nothing on the
app surface uses it yet; everything planned there depends on it, so it lands
first and alone.

### Added
- **`thread_engagement.source_app` / `source_ref`**, with a partial unique index
  on `(thread_id, source_app, source_ref)`.
  - **Idempotency.** Publishing a thread is already idempotent on
    `program.source_ref` (20260824170000) so a retried publish cannot create a
    second public page. The same has to hold one level down: a retried sync of a
    message sequence must not create a second welcome email.
  - **Anchoring.** `trigger_engagement_id` names another engagement. A planner
    laying down "opening ceremony" and "reminder, two days before the opening
    ceremony" in one sync must name the first from inside the second, before it
    has been told the first's platform id. Its own ref makes that possible.

### Notes
- Scoped per **thread**, not per workspace as `program_source_ref_idx` is: an
  engagement only means anything inside its thread, and two festivals may both
  call their opening message the same thing on the app's side.
- Partial, because almost every engagement is written by a person in The
  Thread's editor and carries neither column.
- `app_record_link` deliberately not reused — its `platform_entity` is
  CHECK-constrained to person / organisation / user, and widening that would
  turn the entity-mapping table into a general id registry.
- No routes yet. The scope decision in §8 step 2 comes before those.


## [0.18.17] — 2026-08-29 — a message that would never have sent

Found while debugging, live on tester-2: a "Thank you" message anchored to an
event that has no date. The scheduler resolves the anchor to null and skips
the message every run — no error, no warning, discovered the day after the
festival or never.

### Fixed
- The anchor picker names the problem in the option itself: an activity
  without a date reads "Festival of Trust — has no date yet".
- The timeline card stops lying: "1d after Festival of Trust · 11:00" gains
  "— won't send: the anchor has no date" when that is the truth.

## [0.18.16] — 2026-08-29 — a draft you can look at

"Open public page" on a draft thread was a guaranteed 404. The public detail
route refuses anything not active or completed — correct for the public,
but the editor offered a preview the API would never serve, so there was no
way to see the page before publishing.

### Added
- **Draft preview.** The public thread page forwards the visitor's session
  token when one exists; the API serves an unpublished thread to members of
  the workspace that owns it, flagged `is_preview` (additive, rule 8), with
  an amber banner and enrolment closed. Anonymous visitors keep the 404 and
  cannot tell a draft from a thread that never existed — verified all three
  ways, including that a member of a *different* workspace still gets 404.

## [0.18.15] — 2026-08-29 — the read API is a contract

`docs/brief-thread-public-api.md`, all five items. The standalone Thread at
thethread.app had a /developers page and a CORS-open read API; the rebuild had
neither — not by decision, but because a security hardening (the CORS
allowlist, v0.13.17) and the embed build (3.10.0) each happened without
knowing about the other. This closes that gap on purpose, with the discipline
the platform already applies to `/api/v1/apps/*`.

### Fixed
- **The public thread payload no longer spreads the raw row.** `{ ...thread }`
  shipped `workspace_id`, `team_id`, `organiser_id` and `payment_destination`
  to the internet — and would have shipped every future `thread_thread`
  column too. All three public read routes now build their responses through
  explicit mappers; appearing in public is a decision, not a migration side
  effect.
- **Thread's top-level routes joined RESERVED_SLUGS** (`certificate`,
  `developers`, `embed`, `my`). An organiser named `my` would have been
  silently unreachable — the exact bug the reserved-slug file was created for
  in Meet, never extended to Thread. No existing organiser or team held one.

### Added
- **`GET /public/embed/threads`, `/public/organiser/:slug` and
  `/public/organiser/:slug/thread/:threadSlug` are published.** CORS open
  (`*`, no credentials, GET only) on those three exact paths — never the
  `/public/` prefix, because POST `/public/enrol` and `/public/validate-coupon`
  live on it and the enrol form calls them from the browser; a prefix-wide
  cors() would have broken enrolment in production. Enrolment and coupon
  validation stay same-origin deliberately: one writes personal data, the
  other is a discount-code oracle.
- **Rate limiting** (`lib/rate-limit.ts`): 60/min per IP, in-memory fixed
  window (one Fly machine — Redis when that changes). Keyed on what the
  opening actually invites: browser traffic from foreign origins. Our own
  pages funnel through a handful of Vercel egress IPs and are not metered —
  a naive per-IP limit would have throttled the whole site while missing
  every scraper.
- **`thread.thefibre.app/developers`** — the three routes with full field
  tables, the widget snippets, the rate limits, a stability promise, and an
  honest section on why registration is not part of the API. Linked from
  Settings → Website embeds.
- **`scripts/verify-public-api.mjs`** — the contract, runnable (read-only, no
  confirm gate). Asserts every published key, that the internal columns stay
  out, that CORS is open on exactly three paths and closed on their
  neighbours, that our own enrol form still gets its preflight answered, and
  that only third-party browser traffic is metered. 25 checks.

## [0.18.14] — 2026-08-28 — an anchor the database allowed

A message set to send relative to an *activity* — "1 day after the Festival of
Trust" — could never be saved. The dialog returned `new row for relation
"thread_engagement" violates check constraint
"thread_engagement_trigger_anchor_check"`.

Event anchoring shipped on 2026-07-02 in two migrations a few hours apart. The
second added `trigger_engagement_id` and the whole reading side learned
`trigger_anchor = 'engagement'` — the scheduler, the timeline preview, the
public payload. The first had written the column's CHECK the day it only knew
`'start'` and `'end'`, and nobody went back to widen it. Anchoring to the thread
start or end worked, so the gap stayed invisible until someone anchored to an
actual event.

### Fixed
- `thread_engagement.trigger_anchor` now accepts `'engagement'`. The migration
  drops the old constraint by shape rather than by name — it was an inline
  column check, so its name was Postgres's to choose.

### Changed — the error line in a dialog says something
The reason that bug read as `new row for relation "thread_engagement"
viola…` is two separate faults, both now fixed.

- `apps/api/src/lib/pg-error.ts` turns a Postgres error into one sentence a
  person can act on ("The end time has to be after the start time."), keyed on
  constraint name first and SQLSTATE second, with an honest generic fallback.
  The raw driver text rides along under `detail`, and the full error object
  still goes to the server log — that stays the first stop when debugging.
  Wired into the engagement, ticket and coupon writes: the six routes behind
  the four dialogs that show an error line.
- `components/ui/form-error.tsx` replaces `truncate max-w-xs`, which clipped
  every message at roughly half a sentence regardless of what it said. Wraps,
  keeps the full text in `title`, `role="alert"`.

## [0.18.13] — 2026-08-28 — a host who has no Fibre account

§1 of `docs/brief-thread-event-settings.md`. Hosts & Facilitators on a thread
is `thread_thread_organiser`, which pointed only at `thread_organiser` — a
storefront, needing a Fibre `user`. A festival's hosts sign in to the planner's
own database and never will have one, so they could not be listed at all.

**One list, not two.** The alternative was a second table for "credited on this
thread", which would have left two lists meaning nearly the same thing and every
reader joining both.

### Added
- **`thread_thread_organiser.person_id`** — a row now names either an organiser
  (a storefront, unchanged) or a person directly. Exactly one of the two,
  enforced by a check constraint.
- **`POST /apps/:slug/thread/threads/:id/hosts`** — credit a host by the app's
  own record id, already linked through `/links`, so the app never handles a
  platform UUID. `role` is `host` or `facilitator`. Idempotent on
  `(thread_id, person_id)`: a repeat call updates the role rather than adding a
  second row. Scoped `write:programs`, matching the other thread writes —
  crediting a host writes to the thread, not to the person.
- The workspace-side thread read returns `person` alongside `organiser`, so the
  rows are not invisible to The Thread.

### Notes
- **The primary key moved** from `(thread_id, organiser_id)` to a surrogate
  `id`. That pair is what pinned `organiser_id` to NOT NULL. Both pairings are
  now plain UNIQUE constraints — deliberately **not** partial indexes, because
  `ON CONFLICT (thread_id, organiser_id)` in `routes/thread.ts` can only infer a
  full unique index, and a partial one would have broken the existing members
  upsert. Postgres treats NULLs as distinct, so person rows carry a NULL
  `organiser_id` and never collide.
- The brief's suggested `role` values (`co_organiser`) are stale; the column was
  widened to `host | facilitator` in 20260702110000. The route follows the
  column.
- **The Thread's own UI does not render person hosts yet.** The data is
  returned; the members screen still assumes an organiser and its invite
  dropdown still says "Choose a workspace member…". Nothing breaks — a person
  host simply does not appear there until that screen is updated.


## [0.18.12] — 2026-08-28 — an event the owning app can actually describe

§2 of `docs/brief-thread-event-settings.md`. A festival could be published as a
draft thread and then not described: every setting an organiser reaches for
lived in The Thread's own UI, behind a workspace login the festival's organiser
does not have. The columns already existed; the app surface did not expose them.

### Added
- **Eight fields on `PATCH /apps/:slug/thread/threads/:id`** —
  `timezone`, `language`, `requires_approval`, `public_interaction`,
  `share_participants_public`, `share_participants_participants`,
  `price_cents`, `price_currency`. No schema, no new route.
  Each Zod shape mirrors its column exactly: a NOT NULL column is
  optional-but-not-nullable, so a null is a 400 from us rather than a 500 from
  Postgres, and `language` / `public_interaction` are enums matching their check
  constraints instead of free text.
- **`language`, `public_interaction` and both `share_participants_*` are now
  returned** by the thread response. They were settable-but-unreadable
  otherwise, and the planner has to render current values to mirror them as its
  own settings screen. Additive, per the rules at the top of `app-thread.ts`.

### Notes
- `price_cents` and `price_currency` stay nullable: a free event is null stated
  deliberately, not a field left unset.
- **`registration_fields` is deliberately not exposed.** It shapes what is asked
  of a registrant, and the data wall exists precisely so an app does not reach
  into that — the caution is in the brief and now in the code.
- `status: 'active'` is commented as the single act it is: the page is live
  *and* enrolment is open. That is §3 of the brief, which asks for naming rather
  than a column, so the note lives where someone would change it.
- Still open from the brief: §1 (hosts — needs a design decision, see below),
  §4 (event templates).


## [0.18.11] — 2026-08-28 — primary means primary

### Fixed
- **`is_primary` on `POST /apps/:slug/memberships` now does what it said.**
  The field was documented as "only one per person ends up marked" and nothing
  did that — no constraint in the schema, and the route did not unset the
  others. Marking one now unsets the rest for that person, kept in the route
  because `org_membership` carries no `workspace_id` for a partial unique index
  to be scoped by.
- **A repeat call is no longer a silent no-op.** It applies `is_primary` and
  `title` to the existing row instead of returning early, so promoting a
  membership to primary works whether or not it already existed.

### Correction to v0.18.10
That release's commit message claims no app route compares the URL `:slug`
against the key's own app, and calls it a pre-existing authorization hole.
**That is wrong.** The check has been in `middleware/app-context.ts` since
v0.14.0 — it compares the path slug to `key.appSlug` and returns
`403 wrong-app` — and `scripts/verify-external-app.mjs` asserts it under "a key
cannot act as another app". The claim came from grepping `routes/` for
comparisons against `ctx.appId`, which is not where the check lives or what it
compares. Nothing was open, and nothing needed fixing.


## [0.18.10] — 2026-08-28 — an app can say who belongs to what

An app could create a person and create an organisation and had no way to
connect them. The graph knew both parties and never the relationship, so the
question "which contacts did this organisation have" had nothing to compute
from — gap 2 in `docs/brief-contacts-from-apps.md`, now closed.

### Added
- **`POST /api/v1/apps/:slug/memberships`** — connect a linked person to a
  linked organisation. Both sides are named by the app's **own** record ids,
  already matched through `/links`, so the app never handles a platform UUID —
  the same reasoning as Flow steps being addressed by key. Optional `title` and
  `is_primary`. Scoped on `write:organisations`, because the edge belongs to the
  organisation's graph.
- Added to `APP_KEY_ROUTES`; without that entry the route would have been
  default-denied and unreachable.

### Notes
- `org_membership` carries no `workspace_id` of its own — it inherits one from
  both ends. Both lookups are already scoped to the key's workspace, so a
  cross-workspace pair cannot be assembled.
- Idempotent by hand on `(person_id, org_id)` where `ended_at is null`, since
  there is no unique constraint to lean on. A second call returns the existing
  row with `created: false`. Two *simultaneous* calls could still both insert;
  a partial unique index would settle it if that ever matters.
- `is_primary` is written as given. Nothing enforces one primary per person —
  no constraint in the schema, and this route does not unset the others — so
  an app can mark several. Worth a decision if it starts mattering.


## [0.18.9] — 2026-08-28 — publish under the workspace when an app names nobody

`POST /apps/:slug/thread/threads` required `organiser_person_id`, and required
that person to have a Fibre account and a Thread organiser profile. The check
was right; what it left the app holding was not.

An external app's organisers sign in to the app's own database. They have no
Fibre account and never will — that is the point of an external app — so they
can never satisfy the check. And no app-facing route lists who in the workspace
*could*, so the app had to supply a UUID it had no way to obtain. In the
Festival of Trust planner that became an environment variable holding an email
address, resolved through `/links` at publish time: configuration standing in
for something the platform already knows.

### Changed
- **`organiser_person_id` is now optional.** Omit it and the workspace publishes
  under its own Thread organiser. Additive — every existing caller still works.
- **A workspace with no organiser gets one derived from its admin**, rather than
  being told to go and visit a settings screen. Rights follow function: a
  workspace admin already holds the authority to publish on the workspace's
  behalf, so requiring a manual visit was a step standing in for a lookup the
  platform can do itself. The storefront is named after the workspace, owned by
  its earliest admin, with no payout account — all editable in The Thread
  afterwards.
- When a workspace has several organisers and the app names nobody, the
  earliest wins. Stable beats arbitrary; `docs/brief-thread-default-organiser.md`
  leaves a `thread_organiser` default flag open for when it matters.

### Notes
- The derived slug follows the same shape as the auto-provision in
  `routes/thread.ts` — a seed plus a short random suffix — rather than the bare
  workspace slug, which would collide with a person who already took it under
  `unique (workspace_id, slug)`.
- `thread_organiser.user_id` is unique across the **whole table**, not per
  workspace, so the insert-conflict recovery looks up by user alone and reports
  clearly when the admin already organises elsewhere.
- Depends on v0.18.8: a workspace with no admin has nobody to derive from and
  returns `this workspace has no admin to publish as` rather than publishing
  under nobody.


## [0.18.8] — 2026-08-26 — a new workspace had no admin, and no way to get one · Meet 2.4.3

Approve an access request, and a workspace is created. The first person signs
in and everything looks normal — workspace, contacts, apps. Then every route
behind a workspace-admin check answers 403: listing app keys, minting one, and
**the members screen**, which is the only place the role could be granted. The
only way to grant the role was a screen that required the role.

An external app could be approved platform-wide, activated on the workspace,
and still never given a credential there.

### Fixed
- **The first user of a workspace is now its admin.** Nothing created the
  `workspace_member` row — the pivot carrying `workspace_role`. Not the
  approval handler (the user doesn't exist yet), and not `resolve_sso_identity`
  when it creates them. The intent was already written down: branch 3 of that
  function says *"the first user in a workspace gets fibre-platform admin —
  they own this workspace"* and grants `app_membership.role = 'admin'`. That is
  the **app** role. The **workspace** role is a different pivot. One word, two
  meanings, and the second one was never written.

  New `ensure_workspace_member()` is called from all three resolve branches, so
  users who predate it heal on next sign-in — the same shape as the existing
  `ensure_user_person` call. First member of a workspace gets `admin`; everyone
  after gets the column default.
- **Backfilled every workspace that already had users but no admin.** One did.
- **`ensureWorkspaceMember` had been failing silently since 2026-07-04.** Its
  signature said `role?: 'admin' | 'member'` and it defaulted to `'member'` —
  but `20260704090000_role_tiers` replaced that check constraint with
  `('super_admin','admin','organiser')`. Every insert violated the CHECK, and
  the error was never read, so all four Meet invite paths believed they were
  writing a membership row and were not. Roles corrected, error now logged.
- **Meet → Internal team could not change anyone's role.** Its dropdown offered
  Member/Admin and posted `'member'`, which the database rejects — the save
  500'd. It now offers Organiser / Admin / Super admin.
- **A workspace super_admin was locked out of Meet → Internal team.** The gate
  read `workspace_role !== 'admin'`, excluding the role above it.

### Added
- **The last admin cannot step down.** `wouldOrphanWorkspace` refuses a
  demotion that would leave a workspace with no admin, on both the Fibre
  members screen and Meet's — the one path that could recreate this bug.
- **`lib/workspace-roles.ts`** — the role vocabulary and `isAdminRole` in one
  place, with the distinction spelled out: workspace admin is **not**
  `user.is_super_admin`. That is the *platform* super admin — what lets someone
  approve an app registration — and it confers no authority over any workspace.
  Same word, unrelated thing.
- **`scripts/audit-workspace-admins.mjs`** — read-only: which workspaces have
  users but nobody who can administer them.

### Note on the bug report
The report's second finding — that the `super_admin` branch of
`requireWorkspaceAdmin` is unreachable because the column only permits
`('admin','member')` — reads the **superseded** constraint from
`20260517000000_permission_tiers`. `20260704090000_role_tiers` replaced it with
`('super_admin','admin','organiser')`, default `'organiser'`. `super_admin` is
a real workspace role, the branch is reachable, and the guard is correct as
written. The stale vocabulary is real, but it lives in Meet's internal-team
surface (fixed above), not in that guard.


## [0.18.7] — 2026-08-25 — a flow you can hand a file · Flow 1.14.0

A nine-step method with 39 default tasks and four `meta` fields per step is an
afternoon of typing in the builder, and a transcription error is invisible
until someone reads a step and finds the wrong trap under it. The Festival of
Trust flow shipped as SQL for exactly this reason. `PUT /flows/:id/graph`
already accepted the whole design — validated, structural checks and all —
but nothing anywhere could hand it a file.

### Added
- **Design file · import.** *Design file* in the flow builder toolbar: paste
  JSON or choose a file, **Check**, then **Import**. Check is a real dry run —
  `PUT /flows/:id/graph?dry_run=1` runs the entire validation and returns the
  plan without touching a row.
- **The plan, before the wipe.** Saving a graph deletes every step of the
  version and re-inserts them. That is fine on a draft nobody has run and it
  must never be a surprise, so the preview states counts (*9 steps replacing
  0, 8 transitions, 39 default tasks*), **which step keys disappear**, whether
  a new version appears because the latest is published, how many runs exist,
  and any `system_key` collision.
- **Design file · export.** `GET /flows/:id/graph` — the same shape the PUT
  accepts, so a flow round-trips: export it, keep the method in version
  control, import it into another workspace. `?version=published` pins to the
  current published version. Import stops being an import feature and becomes
  a way to move a method around.
- **A flow-level block in the design file.** `progression` and `system_key`
  live on `flow_definition`, not the version, so neither travelled in the
  graph — and a design for a self-paced method is not fully expressed without
  `progression`. `system_key` was settable from **neither the UI nor the API**;
  Pulse's pipeline got its own from a migration. Now:

  ```jsonc
  { "flow": { "progression": "open", "system_key": "fot_festival" },
    "steps": [...], "transitions": [...], "step_default_tasks": [...] }
  ```

  `system_key` requires the workspace **admin** role — it is the handle other
  apps resolve the flow by, so repointing it is an administrative act, not an
  editing one. An editor who lacks the role is refused **loudly**, not silently
  dropped: a quietly-unset key means the consuming app finds nothing and nobody
  knows why.
- **`scripts/verify-flow-design-file.ts`** — validate a design file against the
  real schema with no server and no session, before anyone opens the builder.

### Fixed
- **The builder was silently eating fields on every save.** `serialise()`
  emitted only `step`/`title`/`actor_type` for default tasks, dropping
  `description`, `default_assignee_role` and `due_days_after_entry`, and
  dropped step-level `default_assignee_role` too. Because the save wipes and
  re-inserts, opening any flow that had those values and pressing Save
  destroyed them — and it would have turned every import of a rich design into
  a trap. The canvas has no inputs for these fields; it now carries them
  through untouched.
- **`step_key` is accepted as an alias for `step`** on default tasks, and a
  stray `ordinal` no longer fails the parse (order comes from the array, so a
  file whose ordinals restart per step still lands correctly). The Festival of
  Trust design file used both and could not be imported at all.


## [0.18.6] — 2026-08-24 — an app you can switch on is an app that exists

Fibre Sales and Fibre Learn have been placeholders since the phase-0 seed, and
until now a workspace admin could switch either of them on. The toggle worked,
the `workspace_app` row landed, and the workspace then "had" an app that will
never render a page.

### Added
- **`app.released_at`** — null means not built yet. `status` (pending →
  approved → suspended) is about *review*: has a human allowed this app to act.
  `released_at` is about *existence*. Sales and Learn are approved in the review
  sense — they are ours, their curator tables and RLS policies shipped — but
  there is no product behind either. Two questions, so two columns; overloading
  `status` would have made the app-review UI fight this concept over one field.

  Not a hardcoded list in the API or the web app, deliberately: that is the
  mistake v0.14.0 removed with the slug allow-list. If you want to know which
  apps are real, ask the catalogue.

### Changed
- `resolveInstallableApp` refuses an unreleased app with `app "x" is not built
  yet`, so the API and the UI now agree instead of the UI being the only guard.
- Third-party apps get `released_at` at registration — somebody wrote them
  before they registered, so they exist by definition.
- **Settings → Apps** greys unreleased apps out, sorts them to the bottom, and
  shows a **Not built yet** label where the toggle was. No disabled toggle: a
  control you cannot use is worse than no control.

### Notes
- `available: false` in `packages/shared/src/branding.ts` already kept Sales and
  Learn out of the app switcher, so that surface was never wrong. What was
  missing was the same truth on the server, where it can actually be enforced.


## [0.18.5] — 2026-08-24 — the first user of a new workspace could never sign in

Creating the second workspace on this platform surfaced a bug that had been
sitting in `resolve_sso_identity` since 2026-05-16. **Anyone who was the first
user of a new workspace got a completely broken account**: Supabase Auth signed
them in, they landed in the app, and then every single API call returned 401 —
contacts, settings, profile, all of it.

### Fixed
- **`resolve_sso_identity` raised 42702 in its create-a-new-user branch.**
  The function is declared `returns table (user_id uuid, resolution text)`, so
  `user_id` is an OUT parameter. The branch that provisions a brand-new person
  ends with:

  ```sql
  insert into public.app_membership (user_id, app_id, role)
  values (v_user_id, v_platform_app, 'admin')
  on conflict (user_id, app_id) do nothing;
  ```

  An ON CONFLICT target cannot be table-qualified, so that `user_id` is
  ambiguous against the OUT parameter and Postgres refuses the whole call.
  Fixed with `#variable_conflict use_column`, which makes bare identifiers
  resolve to columns. Safe because the body reads `v_user_id` / `v_resolution`
  throughout and never the OUT names.

- **`/sso/resolve` now logs the Postgres error** (code, message, details,
  hint) instead of returning a bare 500. See below for why that mattered.

### Why it hid for three months
Only the third branch of the resolver — create a new person *and* user — hits
that statement. Branches 1 and 2 (match by provider id, match by email) do not,
and every sign-in since May took one of those, because the account already
existed: accounts are auto-created at enrolment, and the seeded users predate
the migration. **The first person ever to reach branch 3 was the first user of
the second workspace.**

The failure mode made it worse. `apps/web/app/auth/callback/route.ts` treats a
resolve failure as non-fatal and carries on — reasonable, since the Supabase
session is genuinely valid — so the user is dropped into the app with no
`public.user` row. The access-token hook then injects no `app_user_id` or
`workspace_id` claim, and the API rejects everything. Nothing anywhere said
why. The only trace was `POST /api/v1/sso/resolve 500` in the Fly access log.

That is the second time the reviewer's note in CLAUDE.md has been earned: the
diagnosis took twenty minutes of hypothesising and about ninety seconds once
the RPC was called directly and Postgres was allowed to say what was wrong.
`/sso/resolve` logs properly now.


### Fixed
- **The user menu had two entries that did the same thing** (Sjoerd, 2026-08-24:
  "under SL (right top), profile and settings are the same"). It was three
  different faults behind one symptom, so three different fixes:
  - **Pulse** was the real bug. It has its own `/settings` *and*
    `/settings/profile`, but both menu items pointed at
    `https://thefibre.app/settings` — so Pulse's own settings (payments, teams,
    offerings, reservations, stages) were unreachable from the menu, and both
    entries bounced you out of the app. Now points at its own two pages, like
    Meet and Thread.
  - **Flow** has no settings of its own; profile and preferences live on the
    platform. Two items to the same external page is noise, so it is one item.
  - **Fibre web** was the platform being the odd one out: Meet, Thread and
    Pulse all have a `/settings/profile`, and web kept those two sections
    inline on `/settings`, so a "Profile" menu entry had nowhere to point but
    the same page as "Settings". It now has the page the others have — your
    details and your public profile moved to `/settings/profile`, and
    `/settings` links to it the way it already links "How The Fibre works".

  Meet and Thread were already correct, which is why the symptom only showed up
  in three of the five apps.


## [0.18.4] — 2026-08-24 — super admins cannot be deleted

The platform has one super admin, and nothing stopped that row being removed.
There is no UI anywhere to grant the flag, so losing it would have meant
nobody could approve a person or an app onto the platform ever again, and
putting it right would have needed a direct write with the service-role key.

### Added
- **`protect_super_admin()` trigger** on `public."user"` — before update and
  before delete. Three rules:
  - a super admin cannot be hard-deleted;
  - a super admin cannot be soft-deleted while they still hold the flag;
  - the flag cannot be removed from the **last** remaining super admin.

  The third is what makes the first two mean anything. Without it the guard is
  bypassable in two innocent-looking steps — revoke from everyone, then delete
  everyone — and the platform ends up with users and no way to administer it.

  It is an **interlock, not immortality**: revoke the flag first, then delete.
  Setting `deleted_at` and `is_super_admin = false` in the same statement is
  allowed, because that is someone saying both things on purpose.

### Notes
- **A trigger rather than app code, deliberately.** `public."user"` is written
  from the API on a user JWT, the API on the service role, the erasure flow,
  one-off scripts and the Supabase SQL editor. RLS does not apply to the
  service role and app code cannot see the SQL editor at all. The database is
  the only place a guarantee like this holds.
- **It guards the role, not two email addresses.** Hardcoding the two current
  admins would rot at the first address change and would say nothing about
  why those rows are special. The real rule is "you must not be able to lock
  yourself out", which is what `is_super_admin` expresses.
- **It cannot cover `auth.users`.** Deleting the Supabase Auth record breaks
  sign-in even though `public."user"` survives. That table belongs to
  `supabase_auth_admin` and adding triggers to it risks breaking Supabase's
  own operations, so it is left alone. The Auth users list stays a sharp edge.
- Verified against the live database: hard delete, soft delete and last-admin
  revoke all refused; ordinary users still soft- and hard-deletable.


### Added
- `apps/api/scripts/grant-super-admin.mjs` — grant, revoke or list platform
  super-admins. No UI for this by design: it is the flag that unlocks Admin →
  Access requests, App registry and Workspaces across *every* workspace, so it
  should be a deliberate act rather than a toggle. Refuses an unknown or
  soft-deleted email, and refuses to revoke the last remaining super admin.
  `--list` is read-only and needs no confirmation.

  Two things its header records, because both are easy to assume wrongly:
  super-admin is **not** in the JWT — it is read from `public.user` on every
  request, so a change lands on the target's next page load with no sign-out —
  and it is **independent of how someone authenticates**, because it follows
  the email address rather than the credential. Google SSO and the emailed
  passcode reach the same account with the same rights.


## [0.18.3] — 2026-08-24 — Admin → Workspaces

A super admin could not see the tenants of their own platform. There was no
workspace list anywhere in the product and no endpoint behind one; the only
way to enumerate them was a script. That gap is how a workspace created by
mistake stayed invisible — Access requests looks like a workspace list and is
not one (it lists `signup_request` rows, so a workspace born any other way,
including the original seeded one, never appears there).

### Added
- **`GET /api/v1/workspaces`** — every workspace with live counts of users,
  contacts, organisations, activity and active apps. Super-admin only.
  Deliberately read-only: no create (approving an access request is the only
  path, and that human gate is the point) and no delete (`workspace_id` is
  referenced by 54 tables — a cascade you cannot preview from a confirm
  dialog). Runs on `adminClient`, because the `workspace_self` RLS policy
  scopes SELECT to `current_workspace_id()` and even a super admin's own JWT
  cannot see another workspace. **The explicit `is_super_admin` check is
  therefore the entire gate, not a nicety on top of RLS — do not remove it.**
- **Admin → Workspaces** (`/admin/workspaces`), plus its sidebar entry.
  An **Empty** badge marks any workspace nobody has ever signed into (no
  users, no contacts, no activity) — the signal the page exists for. A count
  that fails renders `?` rather than `0`, because on this page a false zero is
  the one genuinely wrong answer: zero is exactly what "safe to delete" looks
  like.

### Notes
- Counts filter soft-deleted rows, so they read lower than raw table counts —
  23 live contacts against 38 rows, 4 active apps against 6 `workspace_app`
  rows. That is the intended reading: what is actually in the workspace.
- If a delete is ever added here, it must refuse unless the workspace is
  provably empty, the way the one-off Festival-of-Trust cleanup did. A confirm
  dialog is not a substitute for a precondition.


### Added
- `apps/api/scripts/inspect-tenancy.mjs` — read-only diagnostic printing every
  workspace, signup request, user and organisation, plus per-workspace row
  counts. Writes nothing. Added while undoing an accidentally-provisioned
  workspace; the useful lesson was that `approve` on a signup request is the
  *only* thing that creates a `workspace`, and it is not reversible from any UI.

## [0.18.2] — 2026-08-24 — The pages our email has always linked to

`FOOTER_LINKS` in `packages/shared/src/branding.ts` has footered every
transactional email we have ever sent with Help / About us / Legal, pointing at
`thefibre.app/support`, `/about` and `/terms`. None of the three routes
existed. Worse, `apps/thread/lib/policies.ts` made `/terms` the **privacy
policy a participant is required to tick before enrolling** — so every enrolee
so far has accepted a document that 404'd.

### Added
- **Four public routes** in a new `app/(public)/` group — outside `(app)`,
  whose layout bounces anyone without a session back to `/`. These are read by
  people who are not signed in and may not have an account at all.
  - **`/about`** — what the platform is for, the apps, who operates it.
  - **`/support`** — where to write, what to try first, response times,
    how to report a vulnerability.
  - **`/terms`** — terms of use: access, acceptable use (including the duty
    that comes with recording data about other people), ownership, apps and
    the wall, payments through an organiser's Stripe account, availability,
    liability, Dutch law.
  - **`/privacy-policy`** — the real GDPR statement: the controller/processor
    split, what is held and why, what does *not* cross the data wall, legal
    bases, EU locations, the complete sub-processor list (Supabase, Fly.io,
    Vercel, Resend, Stripe, Google), retention and soft delete, Article 15/17,
    and why there is no cookie banner.
  - Both legal documents carry a visible "last updated" date and a source
    comment saying they have **not been through a lawyer**.

### Changed
- **The Thread's required policy now points at `/privacy-policy`**, via
  `FOOTER_LINKS.privacy` rather than a hardcoded URL, and its version moves to
  `2026-08-24` — enrolments from here on record acceptance of a document that
  exists. Earlier enrolments hold `privacy@2026-07-02`, which never did.
- **`FOOTER_LINKS` gains `privacy`**, and email footers (HTML and plain text,
  both template files) gain the matching link.
- **The landing page's "Privacy" link** pointed at `/privacy`, the signed-in
  consent dashboard inside `(app)` — a logged-out visitor clicking it was
  redirected straight back to the landing page. It now goes to
  `/privacy-policy`, alongside new Terms and About links.

## [0.18.1] — 2026-08-24 — The Help link goes somewhere

Every Fibre sidebar has had a **Help** link in its footer since the shell was
first built. In all five apps it pointed at `/help`, and in all five apps that
route did not exist — clicking Help 404'd. Pre-existing, not introduced by
v0.17.1; found while wiring up Settings → How The Fibre works.

### Added
- **`/help` in all five apps** — The Fibre, Meet, The Thread, Flow and Pulse.
  Each page is app-specific and has three parts:
  - **Getting around** — one card per sidebar entry, saying what it is for.
    The blurbs are lifted verbatim from the pages' own headers, so Help can
    never quietly contradict the page it describes.
  - **The rest of your Fibre** — the other apps, with their taglines, built
    from `buildAppList()`. Same rule as the app switcher: switched on for the
    workspace *and* you are a member. No hardcoded app list (v0.14.0's rule).
  - **Read more** — through to *How The Fibre works*, plus where the app
    contract and the changelog live for anyone building against the platform.
- **`@thefibre/shared/ui/help`** — the page chrome, written once. Server
  renderable (no hooks, no `'use client'`); `next/link` is injected as a prop
  so the shared package keeps no Next.js dependency. Five copies of this
  layout would have drifted the way `date-field` did before v0.13.105.

### Changed
- The sidebar Help link now takes the selected style when you are on `/help`,
  like every other nav item.

## [0.18.0] - 2026-08-24 - The Thread opens to external apps

`docs/brief-thread-and-registrations.md` §1-§3. The planner could already run
the nine steps on Flow; it could not publish the festival or see who came. The
Thread had no app-facing surface at all - every `/api/v1/thread/*` route runs on
`userClient(ctx.jwt)` and is bounded by RLS acting on a real signed-in user, so
an app key was denied everything.

### Added
- **`routes/app-thread.ts`** - publish a programme as a public page, read it
  back, edit it as the plan firms up, and see who registered. Deliberately
  narrow, following `app-flow.ts` rather than inventing a second shape: app keys
  only, an app sees only what it created, published shape rather than table
  shape, additive-only contract, asserted in `verify-external-app.mjs`.
- **Three scopes** - `read:programs`, `write:programs`, `read:enrolments`. There
  is **no `write:enrolments`**, by design: an app that could write enrolments
  could enrol arbitrary people in arbitrary programmes, and that row is what the
  whole certificate and payout chain hangs off. Registration comes from the
  public form, never from an app.
- **`program.source_app` / `source_ref`** - a festival is a `flow_run` in Flow
  and a `program` + `thread_thread` in The Thread, and nothing connected them.
  Same columns as `flow_run` got in 20260709080000, deliberately: this is the
  third time "which app owns this mirrored row" has come up, and a third
  convention would be the mistake. A planner sets `source_ref` to its own plan
  id on both, and the edge is derivable with no join table. It also makes
  publishing idempotent - a retry returns the same page, not a second one.

### The wall through `thread_enrolment`
A registration is a **platform** row (`enrolment`); The Thread layers commerce
and form answers on top. So the enrolments route reads platform data through a
Thread-shaped lens rather than reaching into another app's private tables - but
`answers` (the registration form responses, marked "never crosses the wall" in
the schema since it was written), `amount_cents`, `coupon_id`,
`stripe_session_id` and `stripe_payment_intent` must never leave.

`payment_status` does leave. It is a state, not an instrument, and a
registration list without it would be useless.

**The wall assertion was tested by sabotage rather than assumed.** That
established something worth writing down: `select('*')` on its own leaks
nothing, because the response is built field by field and the mapping filters.
The regression to fear is a `...r` spread in that mapping, which reads as a
harmless tidy-up - and which the assertion does catch, loudly. The file's
comment originally claimed the select was the protection; it now says which
does the work, and why the column list is still worth keeping.

### Fixed
- **`docs/fibre-briefing.md` listed every app path without its `/api/v1`
  prefix.** A client written from that table verbatim would 404 on every call,
  and it is the first thing an integrator copies. Paths are now written in full.

### Notes
- An app cannot invent an organiser. `POST /thread/threads` takes an
  `organiser_person_id` - a person, because the app already links its organiser
  to a Fibre person and should not have to learn about platform user rows - and
  that person must have both a Fibre account and a Thread organiser profile.
  Publishing under a storefront nobody owns would leave a public page with no
  human behind it.
- `PATCH` deliberately cannot touch price, payment destination, certificates,
  tickets or registration fields. Those are money and credentials, and they
  belong to a human in The Thread's own UI.

## [0.17.1] — 2026-08-24 — Settings → How The Fibre works

The platform could explain itself to a developer (`docs/building-on-the-fibre.md`)
and to nobody else. This is the same contract, in the product, in plain words —
so a workspace admin deciding whether to switch an outside app on can actually
see what they are agreeing to.

### Added
- **Settings → How The Fibre works** (`/settings/about`). One page, twelve
  sections, three hand-drawn SVG diagrams:
  - **The building** — the front desk keeps the register; each app keeps its
    own files; outside apps come through one door with a badge.
  - **The data wall** — what the platform owns, what an app owns, and the three
    openings between them.
  - **The badge** — the same app, drawn twice: reaching everything a borrowed
    staff sign-in reaches, versus the two things an `app_key` reaches. The
    blast-radius difference is the whole argument for v0.14.0, and it is much
    easier to see than to read.
  Plus the complete app-key route list with the scope each one costs, the
  permission vocabulary (including `write:flows` struck through, because it
  deliberately does not exist), a rule-by-rule table of *what actually enforces
  this*, why it was built this way, what it costs, and a glossary that
  translates every term on the page.
- The diagrams are drawn entirely with the app's own tokens (`surface` / `ink` /
  `line`), so both themes come for free; amber is reserved for "outside the
  building" and red for "refused".
- Live facts on the same page: version, workspace, plan, and which apps are
  actually switched on here.

### Changed
- **`VERSION` moved to `apps/web/lib/version.ts`.** It was a private const in
  `app/(app)/layout.tsx`, which meant a second surface wanting to show it had
  no way to ask. The sidebar footer and the new page now read the same
  constant. `CLAUDE.md` updated to point at the new file.

### Notes for whoever picks this up
- `settings/about/reference.tsx` restates `APP_KEY_ROUTES`
  (`middleware/app-context.ts`) and `APP_SCOPES` (`lib/app-keys.ts`) in plain
  English. Those two files are the source of truth — add a route or a scope
  there and this page starts lying to people until it is updated too. The file
  header says so.


## [0.17.0] — 2026-08-24 — Flow 1.13.0: steps gain sections and app-defined fields

The last two structural gaps under the Festival planner
(`docs/brief-flow-as-planner-engine.md` gaps 3 and 4). `flow_step` had taken no
new columns since it was created; these three are the ones it needed.

### Added
- **`flow_step.group_key` + `group_label`** — an optional section. The
  planner's nine steps fall into three phases (orientation, doing,
  culmination) that drive its whole visual system, and a step had `ordinal`,
  `kind`, `canvas_x/y` and nothing to say "these three belong together". Any
  flow long enough to need sections wants this, so it is a platform column.
  `group_key` is the stable one consumers group on; renaming `group_label`
  moves nothing.
- **`flow_step.meta jsonb`** — app-defined fields the platform never
  interprets. The planner needs three descriptions per step (purpose, trap,
  reflection) where `flow_step` offers one. Deliberately not three columns:
  hard-coding one app's fields invites the next app's four. The brief calls it
  "the curator-data problem in miniature" and it gets the same answer — the app
  justifies the field, so the app carries it.
- Both are **exposed on the app-key contract**, additive per the rules at the
  top of `routes/app-flow.ts`: `group_key`, `group_label` and `meta` appear on
  every step in `GET /apps/:slug/flow/flows/:id` and
  `GET /apps/:slug/flow/runs/:id`. `meta` is `{}` rather than null when unset,
  so a consumer can read `meta.whatever` without a guard.
- **A UI home in Flow's builder**, not just columns. The step inspector gets a
  Section pair and an Extra-fields JSON editor. Without it these would be
  settable only by SQL — the exact pattern v0.14.0 removed from the app
  catalogue.

### Fixed
- **The graph save would have silently destroyed all three.** Saving a flow
  wipes and re-inserts every step, so a column not carried through
  `GraphStep` → `loadGraph` → `stepRows` is lost the first time anyone opens
  the builder and hits save. All three are wired through that round-trip, and
  the migration carries a note for whoever adds the next column.
- A step whose `meta` won't parse now **blocks the save** rather than being
  dropped — since the save wipes first, dropping it would destroy the stored
  value.
- **`verify-external-app.mjs` no longer strands a person per run.** Each run
  soft-deleted the person its activity pinned and the next run created another,
  so the residue only ever grew (it reached 13). A re-run now revives exactly
  one dormant row instead. Two subtleties, both found by running it rather than
  reasoning about it: reviving *all* of them made the linker's `maybeSingle()`
  match many rows and create yet another, and doing the revive before the
  soft-delete loop meant the same pass undid it.

### Notes
- The 13 already-stranded rows can't be collected — each is pinned by its own
  append-only activity row. All are soft-deleted and invisible.

## [0.16.1] — 2026-08-23 — The app contract, written down and enforced

Sjoerd asked the right question before building the Festival planner's UI
layer: *"is there a proxy where all input and output can be translated even if
changes happen, or does the planner need an update every time Flow gets an
update?"*

The proxy already existed — `/api/v1/apps/*` is deliberately not the shape of
our tables, which is why 0.16.0 could rebuild how Flow stores and materialises
tasks without a consumer noticing. What was missing was the discipline that
makes the indirection worth anything, and a document saying so.

### Added
- **The additive-only rule**, stated where it will be read: a `THE CONTRACT`
  block at the top of `routes/app-flow.ts`, and hard rule #8 in CLAUDE.md. A
  response key that has shipped is permanent — no renames, no removals, no
  retypes, and no quiet changes of meaning, which break a caller just as hard
  and no type checker catches.
- **`CONTRACT_SHAPES` in `verify-external-app.mjs`** (step 7b) — every
  app-facing response asserted key by key, so a rename fails CI instead of
  somebody's integration. It caught a wrong assumption on its first run.
- **`docs/building-on-the-fibre.md`** — the canonical instruction document for
  *any* app on the platform, in-family or external. The data wall and why it
  is not negotiable, the app-justifies-the-field rule, the three sanctioned
  crossings, the seven platform rules, manifest → register → approve →
  activate → key, every surface including Flow, the stability contract in
  full, what differs for in-family apps, and what is honestly not built yet.
  Replaces `third-party-app-guide.md` (renamed; its content is §3–5).

### Why 0.15.0's rename is called out by name
It returned `step_filed` from the create-task route and 0.16.0 renamed it to
`step_key`. Nothing consumed it, so nothing broke — but nothing stopped it
either, and that is exactly the class of change this release exists to catch.
The contract block cites it rather than hiding it.

## [0.16.0] — 2026-08-22 — Flow: a task knows its step, and a flow can be self-paced

The rest of `docs/brief-flow-as-planner-engine.md` (items 4 + 6). 0.15.0 let an
app key own Flow runs; this makes the engine itself able to hold a sequence
somebody walks at their own pace. Flow 1.12.0.

### Added
- **`flow_task.step_id`.** A task's step used to be *derived* — through
  `flow_step_default_task.step_id`, or through gate → transition →
  `from_step_id` — so a manually created task belonged to no step at all. That
  was a defect in Flow, not merely something the planner wanted: "add a task to
  this step" is an ordinary thing to do and the row could not record it.
  Backfilled from both templates; indexed on `(flow_run_id, step_id)`.
- **`flow_definition.progression`** — `'gated'` (unchanged: one cursor,
  authored edges, gates that hold a contact until required tasks are done) or
  `'open'` (a sequence you move through at your own pace). An open flow
  materialises **every** step's tasks when a run starts, so all of them carry a
  real status from the first render, and writes **no due dates**, so nothing in
  it can ever be overdue. Arriving at a step no longer re-seeds it.
- **A "Make self-paced" toggle** in Flow's own lifecycle menu, with a
  self-paced marker in the flow header. `POST /flow/flows` and
  `PATCH /flow/flows/:id` accept `progression`.

### Why open flows write no due date
The engine is perfectly able to express lateness; the surfaces built on it must
never surface it. Rather than teach every reader to suppress overdue styling
for one kind of flow, an open flow simply never writes a `due_at` — including
ignoring a template's `due_days_after_entry`. A schema that can represent an
overdue festival step would eventually show one.

### Changed
- The app-facing surface reads `step_id` directly instead of reconstructing it,
  and `POST /apps/:slug/flow/runs/:id/tasks` now stores the `step_key` it has
  been accepting since 0.15.0. `unfiled_tasks` holds only legacy rows whose
  step could not be recovered at backfill time.
- `materialiseTasksForStep` stamps `step_id` on everything it creates and takes
  a `noDueDates` option; `materialiseAllSteps` is the open-flow entry point.
  Both surfaces share them rather than forking.

### Verified
`verify-external-app.mjs` step 7 now also proves: a step the run never visited
already holds its tasks, no task anywhere carries a due date (the fixture sets
`due_days_after_entry` on purpose), and a task the app adds with a `step_key`
comes back filed under that step with nothing adrift. All eight steps pass.

## [0.15.0] — 2026-08-22 — Flow, reachable by an app key

The Festival of Trust planner stays **external** (Sjoerd, 2026-08-22: "It is an
external app, that can communicate with everything from Fibre: the Fibre, the
Flow and also the Thread later"). v0.14.0 gave external apps a credential; this
lets that credential own Flow runs, so an app outside the monorepo can run a
shared, durable process without inventing its own tables.

`docs/brief-flow-as-planner-engine.md` items 1–3. `verify-external-app.mjs`
grew a seventh step covering the whole surface; all eight pass against the live
database.

### Added
- **`read:flows` + `write:flow_runs`** in `APP_SCOPES`. Deliberately no
  `write:flows` — an app *consumes* a flow, it never authors one. Steps,
  transitions and gates stay with the people in Flow.
- **The app-facing Flow surface** (`apps/api/src/routes/app-flow.ts`), under
  `/api/v1/apps/:slug/flow/*`: list consumable flows, read a flow's published
  shape (steps in order with their task templates), start a run, read it back
  as steps-with-tasks-and-status, move it, add and check off tasks, and keep
  one note per step. Steps are addressed by `key`, never uuid — an external
  app should not have to carry platform identifiers it cannot interpret.
- **A per-(run, step) note an app can rewrite.** `flow_run_note.app_id`
  separates an app's single reflection from the append log a person keeps in
  Flow, with a unique index so concurrent writes can't leave duplicates.
  Empty body clears it.
- **Idempotent run creation.** Pass your own `source_ref` and a retry returns
  the run that already exists — no duplicate, no 409.

### Why a separate route file rather than allow-listing `/api/v1/flow/*`
Every route in `routes/flow.ts` runs on `userClient(ctx.jwt)` and is bounded by
RLS acting on a signed-in user. There is no user behind an app key, so those
routes would have denied everything. This mirrors the choice v0.14.0 already
made for persons and organisations: the app-facing equivalents live under
`/apps/:slug/*` and filter by workspace explicitly on the service-role client.
Because that client bypasses RLS, the handlers carry the rules themselves —
app keys only (a user session is refused and pointed at `/api/v1/flow/*`), and
an app reaches only runs whose `source_app` is its own. Reading definitions is
limited to workspace-scoped flows; personal and team flows are somebody's
private working set, not a public capability.

### Changed
- `flow_task.created_by` and `flow_run_note.created_by` are **nullable**. They
  assumed a human behind every write; `actorUserId()` returns null for an app
  key by design, so an app creating a task or a note violated the constraint.
  Null now means "an app wrote this", and the owning app is recoverable — from
  the run's `source_app`, and for notes from `app_id`.
- `materialiseTasksForStep` is exported from `routes/flow.ts` and takes a
  nullable `personId` / `createdBy`, so both surfaces seed tasks the same way
  instead of forking the logic.
- Tasks an app creates carry no `due_at`. A companion-style app cannot
  accidentally start nagging.

### Notes
- A run needs no person: `person_id`, `organisation_id`, `subject_label` or any
  combination. A festival is a legitimate subject.
- Per-step status is derived from task counts (`not_started` / `in_progress` /
  `done`), not from `current_step_id`. `POST /runs/:id/move` already jumped to
  any step bypassing gates, so free navigation needed nothing built — the
  cursor is reported as `current_step_key` and a companion app can ignore it.
- Still open, and the next item: `flow_task.step_id`. A task's step is derived
  through whichever template created it, so a task an app adds comes back under
  `unfiled_tasks`. `step_key` is accepted and validated on create so callers
  write against the final contract, but it cannot be stored yet.

## [0.14.0] — 2026-08-22 — The Fibre welcomes external apps

`docs/brief-external-apps.md` came out of a real attempt to integrate the
Festival of Trust planner from outside this monorepo. Its honest verdict on
"can The Fibre host external apps?" was **not yet** — one structural blocker
and a set of missing pieces. This closes all of them.

`apps/api/scripts/verify-external-app.mjs` runs the brief's six-step
verification end-to-end against a live API. All six pass.

### Added
- **An open app catalogue.** `public.app.slug` carried an allow-list
  (`app_slug_check`), so every app since phase 0 registered itself by dropping
  the constraint, inserting, and re-adding it with its own slug appended —
  inside a platform migration. Registering an app was a *schema change against
  the platform database*, which meant the set of installable apps was fixed at
  platform build time and nobody outside the platform team could add one.
  Slugs are now validated by **format**; the guard the allow-list stood in for
  moved onto the row as a lifecycle: `pending → approved → suspended`, plus
  `kind`, `owner_user_id` and `manifest`. Deliberately shaped like
  `signup_request` rather than inventing a second review pattern.
- **`POST /api/v1/apps/register`** — unauthenticated, because an app
  registering itself has no credential yet. Lands a `pending` row.
- **Admin → App registry** (`/admin/apps`) — super admins approve, reject,
  suspend and reinstate. The card shows the scopes the app asked for and the
  activity types it declared, because that is what you are actually deciding
  about. Suspending revokes its keys and deactivates it everywhere.
- **`app_key` — server-to-server credentials scoped to (app × workspace).**
  Before this, an external app authenticated with a *user-scoped* Supabase JWT
  pulled from a signed-in browser. That ruled out background sync, and — the
  serious half — handed a third-party app the user's full platform authority
  in every app, whatever its manifest asked for. A key carries the app's
  authority, in one workspace, bounded by scopes. The token is returned once
  at mint time; only its SHA-256 hash is stored.
- **Settings → Apps → Manage API keys** — mint (scopes ticked from what the
  manifest requested), see `last_used_at`, revoke.
- **Scope enforcement.** `scopes_requested` was "declarative only — not checked
  at request time". Now: a key can never carry a scope its manifest didn't ask
  for, and an app key reaches an explicit allow-list of routes and nothing
  else. Everything outside is a 403 regardless of scopes held, so widening an
  app's surface is a deliberate edit rather than a side effect of granting a
  scope. General `/persons` and `/organisations` stay unreachable — they run on
  a user's RLS identity and a key has none.
- **Organisation links.** `POST /apps/:slug/links` was person-only, so the
  planner's declared `festival_host → organisation` mapping could not be
  written at all. Orgs match on `domain`, then `name`. The required scope
  follows the mapping's target, not the URL.
- **Bulk linking** — `POST /apps/:slug/links:bulk` (and `/links/bulk`), up to
  500 per call, bounded concurrency. Partial success is the honest outcome for
  a batch, so every item reports its own result and the response is 207 unless
  all landed.
- **`GET /apps/:slug/organisations/:app_entity/:app_record_id`** — the org twin
  of the person resolver.
- **`PUT /apps/:slug/manifest`** — install entity mappings and declared
  activity types into a workspace. Was SQL.
- **`GET /apps/whoami`** — an app verifying its own credential and scopes.

### Changed
- **Activity types are validated against the manifest.** The API accepted any
  snake_case type, so a typo landed silently on a workspace timeline — and
  activity is append-only, so it stayed there. An app that declared types is
  now held to them (400 with the declared list). Apps that declare none keep
  the old behaviour; every first-party app relies on that.
- **`workspace_app` activation refuses anything not `approved`**, enforced by a
  trigger so it holds regardless of which client writes the row. Deactivation
  is always allowed, or a suspension would trap the workspace.
- **Settings → Apps is catalogue-driven.** The installable list was a constant
  in the page — the web-side twin of the closed allow-list. An approved
  third-party app now appears with no code change.
- `X-App-ID` is only accepted for **approved** apps.
- `app` read policy: approved apps stay readable by everyone (they are
  reference data); pending and suspended ones are visible only to their
  submitter and to super admins.
- `docs/third-party-app-guide.md` rewritten around registration and keys. Its
  "Open gaps" list lost five of its seven entries.

### Notes
- `scripts/verify-external-app.mjs` requires `FIBRE_VERIFY_CONFIRM=1`. There is
  one Supabase project, so "local" only ever describes the API process — the
  script always writes to the real workspace. It cleans up after itself, with
  two exceptions forced by the platform's own rules: `activity` is append-only,
  so its one activity row is permanent, and that row pins both its person (soft
  deleted, per the personal-data rule) and the app row (left `suspended`).
- Deviation from the brief's sketch: `app_key` has **no** `unique (app_id,
  workspace_id)`. That would make rotation a hard cutover — you could not mint
  the replacement before revoking the incumbent. Several live keys per pair are
  allowed instead.

## [0.13.155] — 2026-07-15 — Pulse 0.27.0: pick the cashflow you land on (home page)

### Added
- **A cashflow chooser on the home page** (Sjoerd 2026-07-15: "in the home
  page you should be able to select the cashflow of pref you want to land
  on"). The dashboard header now carries a **Cashflow** dropdown — Me, each
  team you're in, and Workspace (admins/granted). The projection, the stat
  cards and the runway sentence all follow the choice.
- It writes the **same** preference the cashflow tab bar uses, so it's a
  shared "preferred cashflow": pick it once on the home page and both the
  dashboard AND the cashflow grid land on it next time. Selecting refreshes
  the home page in place (no jump to the grid).
- The chooser only appears when there's more than one cashflow to pick from;
  Workspace collapses to Me when you can't read it, and a stale team choice
  falls back to Me.

## [0.13.154] — 2026-07-15 — Pulse 0.26.1: "Later" money no longer inflates the last month's end position

### Fixed
- **The END POSITION stops at the visible horizon** (Sjoerd 2026-07-15: "what
  comes later is not in the last month"). Money expected beyond the projection
  window ("Later") was being bucketed into the final visible month, so the
  last column's end position absorbed income that hasn't arrived yet (e.g. a
  €17.280 "Later" receivable flipping Jan 2027 from a deficit to a surplus).
  `bucketFor` now returns no bucket for at/after-horizon dates, matching the
  grid's own Later boundary — the Later column still shows the money; the
  running balance simply doesn't count it.

## [0.13.153] — 2026-07-15 — Pulse 0.26.0: per-row payment dates (multiple payments per project)

### Added
- **A date at row level** (Sjoerd 2026-07-15: "if it has multiple payments
  per project, there should be a date added at row level"). Once an offer has
  **2+ offering rows**, each row gains an **Expected** date column. Set
  different dates and the project fans out into **one payment per date** in
  the cashflow; leave a row's date blank and it inherits the offer's top-level
  Expected date. A single-row offer is unchanged (one date, one payment).
- Repeating rows are timed by their cadence, so they show "—" instead of a
  date (no one-off date applies).

### How it flows
- The per-row date is stored on the offering row (`pulse_commitment_item.
  expected_date`) and DERIVES the payment-line schedule on save — the
  projection still reads lines, so the grid, totals and reserves need no
  change. Existing un-invoiced lines are reused by date to avoid churn; once
  an offer is invoiced/settled its schedule is locked.

### Fixed (infra)
- Resolved a same-day migration-timestamp collision (two `20260710120000_*`
  files) that was blocking `supabase db push`. `pulse_cashflow_grants` moved
  to `20260710130000`; both were already live on remote.

## [0.13.152] — 2026-07-15 — Pulse 0.25.0: duplicate an offer into an independent row

### Added
- **Duplicate an offer** (Sjoerd 2026-07-15: "copy a project no. → it should
  duplicate the row, so each offer can be altered separately"). The offer
  dialog now carries a **Duplicate** button (Fibre dialog contract:
  Delete·Duplicate left, Cancel·Save right). It deep-copies the deal —
  fields, offering rows AND expected payments — into a brand-new row named
  "… (copy)" in the same cashflow, right after the original. Each copy is
  fully independent from then on.
- The copy is a **fresh, not-yet-invoiced** offer: the invoice number,
  invoice date, purchase-ledger link and per-payment invoice/settle state
  are never carried over (same convention as ⌥-drag line copies).

## [0.13.151] — 2026-07-10 — Pulse 0.24.0: currency picker (and the grid respects it)

### Added
- **Currency is a picker** (Sjoerd's 8: Euro, US Dollar, South African
  Rand, Swiss Franc, Chilean Peso, El Salvador (USD), Brazilian Real,
  UAE Dirham) in Settings → Planner → Time rhythm & currency.
### Fixed
- **The cashflow grid now formats in the chosen currency** — it was
  hardcoded to € regardless of the setting. All grid amounts follow
  the workspace currency now.

### Note
- This is the workspace-level default. Per-team / per-person overrides
  (workspace > team > person) are the next step — they slot onto the
  existing cashflow-scope model.

## [0.13.150] — 2026-07-10 — Thread 3.32.0: per-day timing for multi-day activities

### Added
- **Time per day** — a switch on the activity dialog (Sjoerd 2026-07-10).
  When on, set a First/Last day and a daily begin/end time that prefills
  every day; edit any single day's row to override it (e.g. a shorter
  final day). Stored as `thread_engagement.daily_schedule` (jsonb; null =
  the previous single start/end range). The public thread page and the
  in-app timeline render one row per day (Mon 2 Mar · 09:00–17:00); the
  outer `starts_at`/`ends_at` envelope stays populated so sorting and the
  scheduler are unaffected. Migration `20260710120000`.

## [0.13.149] — 2026-07-10 — Thread 3.31.5: new thread/team lands on a filled page (was empty until refresh)

### Fixed
- Creating a thread (or team) navigated to a blank page — no title, no
  settings — until a manual browser refresh. A `router.refresh()` fired
  synchronously right after `router.push()`, racing the navigation so the
  destination mounted against a cleared router cache. Removed it; `push`
  alone fetches the new route fresh (matching the certificate, duplicate
  and template-instantiate flows that never had the bug).

## [0.13.148] — 2026-07-10 — Fibre Pulse joins the platform app surfaces

### Fixed
- **Pulse (and Flow) were missing from the web dashboard's app tiles** —
  a hardcoded APP_DOMAINS map on thefibre.app listed only meet/thread/
  sales/learn. Both added. Also registered fibre-pulse in the web app
  catalogue (apps/web/lib/apps.ts: descriptor + APP_ORDER) so it appears
  in the members grant grid and can carry a per-app contact/org profile
  tab. The app-switcher dropdowns already derived from the shared
  registry, so they had Pulse already.

## [0.13.147] — 2026-07-10 — Pulse 0.21.0: the payment is derived, not a separate list

### Changed
- **The "Expected payments" editor is gone** (Sjoerd: "all info is above
  — I don't need that separate list"). A deal is now just its offering
  rows + the Expected date; the single payment that drives the cashflow
  is DERIVED from them (deal total on the expected date) — no parallel
  list to keep in sync, so a price edit always flows through. Invoice
  and settled state still freeze a line; any pre-existing staged
  (multi-payment) schedule is preserved untouched.

## [0.13.146] — 2026-07-10 — Pulse 0.20.2: editing a price flows to the payment

### Fixed
- **"I changed the amount in an income and the list wasn't adapted"**:
  offering rows (or legacy quantity × unit price) describe the deal;
  the payment line is what actually lands in the grid, and the two
  could drift after a price edit. Now a single, not-yet-invoiced
  payment auto-resyncs to the deal total on save — editing the price
  flows straight to the cashflow. Staged multi-payment schedules are
  still yours to manage by hand.

## [0.13.145] — 2026-07-10 — Pulse 0.20.1: drag a recurring occurrence to reschedule the series

### Added
- **Recurring rows are draggable now** (Sjoerd: "why can't I drag costs
  like income" — they were recurring, and recurring occurrences weren't
  draggable, in either direction). Dragging any occurrence of a
  repeating item onto another period sets the item's start
  (repeat_starts_on) there — the whole series shifts. One-off payments
  still drag per-payment; the distinction is one-off vs recurring, not
  income vs cost.

## [0.13.144] — 2026-07-10 — Pulse 0.20.0: Invoices page, per-cashflow settings, blue receivables, paid-with-account

### Added
- **Invoices page** (Money → Invoices, the Meet/Thread surface): scope
  switcher, search, totals, detail actions — Pulse-issued invoices show
  alongside Meet/Thread ledger money.
- **Mark-paid asks for a date + receiving account**: it stamps the paid
  date, adds a balance snapshot to the chosen Pulse account (so the BANK
  row moves by itself), and settles the matching plan line.
- **Per-cashflow settings gear** on the tab bar: the active tab's banks
  &amp; reserves (+ create, update balances) and reservation rules (+ add,
  remove), with a pointer to planner-wide settings (VAT, rhythm,
  invoicing).
- **Invoiced amounts are blue** (sky) — a receivable with a number on
  it, distinct from emerald expectations — in the grid pills, the
  counterparty totals and the org dialog's receivables; settled money
  leaves the view.

## [0.13.143] — 2026-07-10 — Pulse 0.19.0: repeats repeat, accounts connect, teams create

### Fixed
- **"Repeat is on, but does not repeat"**: per-item cadences on offering
  rows now expand — in the projection AND the grid (each item by its own
  rhythm from the expected date, incl VAT; non-repeating items once;
  lines skipped for such items to avoid double counting).

### Added
- **Connect any account to a cashflow**: the Accounts page shows a
  Cashflow chip per row and a selector in the dialog (Workspace / Me /
  any involved team) — reserves included; reassignment moves it between
  tabs instantly. Foreign personal accounts are shown but never
  clobbered.
- **Create teams from Pulse** (completes the teams-SPoT promotion,
  build-plan 10b): POST /api/v1/teams (creator becomes lead, Meet's
  slug rules respected); the Teams page gets "New team" — Pulse-created
  teams join the planner immediately (tab, bank prompt, reservations).
- **The Workspace tab wears the company name** (from the platform
  workspace, renameable in workspace settings).

## [0.13.142] — 2026-07-10 — Pulse 0.18.0: tabs are separate cashflows

### Changed
- **An item belongs to the cashflow it was created in** (Sjoerd: "If I
  delete something from ME it is also deleted from WORKSPACE" — it no
  longer appears there at all). Migration `20260710090000`: personal
  flag; strict partition — Me = your personal items, a team tab = its
  items (Team locked to the tab on create), Workspace = the company's.
  Creation stamps the home cashflow; edits never move it; the popup
  shows a "Personal / <Team> cashflow" chip away from workspace.
  Existing items live in the Workspace cashflow.

## [0.13.141] — 2026-07-09 — Pulse 0.17.0: the invoice button appears; reservations go per-cashflow

### Fixed
- **"Turn offering into an invoice" was invisible on new items** — the
  section only rendered for saved commitments, so the green-+ flow
  never showed it. It now always shows for income: "Save first, then
  invoice." while unsaved, the button once saved, the invoice
  date/expected/badge once invoiced.

### Changed
- **Reservations are per-cashflow** (migration `20260709230000`): rules
  carry the same scope as banks; each tab's RESERVATIONS header gets a
  "+" creating rules for THAT cashflow (target buckets = the tab's own
  reserves); the settings card manages workspace rules only; the
  projection follows the active scope.
- **Layout pass**: CASHFLOW title above the tabs; the filter row is
  gone; view choice is a compact "By contact / By period" select next
  to Per month; green + / red − sit left of that cluster; a new
  All / Only invoiced / Not invoiced filter (totals stay honest).

## [0.13.140] — 2026-07-09 — Pulse 0.16.0: P4 complete — paid becomes settled, by itself

### Added
- **The ledger↔plan loop closes**: every ledger write now fires a settle
  hook — a paid Pulse-issued invoice settles its whole opportunity
  (lines settled, stage → done, the Flow card completes); a paid
  purchase linked to a specific expected payment settles that line.
- **Conservative auto-matching**: Meet/Thread money that was also
  planned in Pulse links itself — exact amount + same counterparty
  person + a single unambiguous candidate (paid → settled; pending →
  linked). Matched purchases stop double-counting as ledger
  receivables in the projection. Throttled like the stages sync.

## [0.13.139] — 2026-07-09 — Pulse 0.15.0: cashflows are tabs, each with its own bank

### Changed
- **The tab system** (Sjoerd's morning pt 1): Me · a tab per involved
  team · Workspace (only with access) — the tab bar replaces the
  chooser and switcher; each tab anchors on ITS OWN accounts, and an
  empty tab offers "Create bank" (a virtual bank/reserve, in a popup).
- **The daily bank popup** (pt 2, "not a row"): the first visit each
  day opens that tab's balances ready to type (checkbox to disable per
  tab); it is THE balance-editing surface — the grid's BANK rows are
  display-only, with a pencil on the header to summon the popup any
  time.
- **Focus date** (pt 3): "First column on" — Today or any weekday
  (the first upcoming Friday, say) — in the rhythm settings; grid and
  projection shift together.
- **Tab-level + / −** (pt 4): a green + ("Add income — a contact and
  an amount is enough") and red − ("Add a cost") on the tab bar; the
  Quick add / New income / New cost header buttons retired.
- **Drag rows into your order**: grip handles on item rows and client
  groups under Income/Costs, insertion lines, order persisted
  (sort_order), optimistic with toast-on-error.
- **Columns obey the horizon**: 6 months = exactly 6 monthly columns
  (or the fortnights that fit) — the fixed 10-column tail is gone;
  Later only appears when something is truly dated beyond the horizon.

## [0.13.138] — 2026-07-09 — Pulse 0.14.0: the popup calms down; scopes get their own banks

### Changed
- **Popup polish (Sjoerd's morning list 5–12)**: uniform h-9 controls
  (calmer UX), a "More" disclosure under the contact (Project · Owner ·
  Team · the new Offer/quotation link with a clickable icon), the
  Income|Cost choice as a compact icon switch behind the contact,
  Name · narrow Expected date · Stage on one line, "Turn offering into
  an invoice" as a full-width bottom section (invoiced → Invoice date +
  Expected + the number badge), Notes last.

### Added (backend for wave 2)
- **Scoped accounts** (migration `20260709190000`): a bank/reserve
  belongs to the workspace, a team (its virtual bank) or a person;
  personal accounts manageable by their owner; the projection anchors
  each scope on ITS OWN accounts; focus_weekday setting (first column =
  e.g. first upcoming Friday).
- quote_url on opportunities (`20260709200000`); manual row order
  sort_order + ordered lists (`20260709210000`) — the drag UI ships in
  wave 2 (tabs).

## [0.13.137] — 2026-07-09 — Pulse 0.13.1: the 2-second tax removed

### Fixed
- **Every interaction felt 2–3s slow** (Sjoerd, first coffee): each
  change refreshes the page's data, and GET /pulse/stages was re-running
  the full Flow-mirror sync (~6 queries) PLUS an O(N) run-backfill walk
  on every single read — the logs showed it at 2s. Now: the mirror
  syncs at most once a minute per workspace (Flow edits surface within
  60s; Pulse-side stage edits hit the mirror directly), and the
  backfill only walks when a cheap count-parity check says a run is
  actually missing. Interactions drop to the sub-second roundtrip.

## [0.13.136] — 2026-07-09 — Pulse 0.13.0: whose cashflow?, the settings hub, and the rear-view mirror

### Added
- **The cashflow chooser**: opening /cashflow without a remembered scope
  asks whose cashflow you're opening — My cashflow, each involved team
  you can access, Workspace when you have access. Choice remembered;
  "Switch cashflow" returns to the chooser.
- **Settings is a hub** (the Thread pattern): Profile · Payments ·
  Planner cards. Profile edits the platform profile; Payments is the
  payments-SPoT form; all seven planner cards moved to
  /settings/planner.
- **History**: cadence select (off / 7 / 14 / 30 days) for the
  projection snapshots, the two-year retention note, the stored
  overviews list, and a first comparison popup (period table of any
  stored moment).
- Reservation rules default their target to the workspace's single
  reserve account (tonight's virtual-growth gap can't recur).

## [0.13.135] — 2026-07-09 — Pulse 0.12.2: the popup is an invoice; warnings are toasts

### Changed
- **The opportunity popup reads like an invoice**: letterhead contact
  band (org + person side by side, Invoice badge top-right), Name with
  the Income|Costs toggle inline behind it, columned meta row, offering
  rows as a full-bleed hairline table with right-aligned numbers, and
  an invoice-style totals block (weighted / full / VAT / bold TOTAL
  incl VAT). Owner/Team/Notes folded into More options.
- **Clicking a number in the sheet opens the popup** (drag moves,
  ⌥-drag copies, empty-cell + still adds inline, BANK balances still
  edit in place).
- **Warnings are popups**: a toast stack (top-right, auto-dismiss)
  carries every server error — nothing hides at the scrolled bottom of
  a dialog anymore. Field validation stays inline next to its field.
- Virtual reserve growth data-fix: both reservation rules now target
  the Saving account (they had no bucket — set in Settings anytime).

## [0.13.134] — 2026-07-09 — Pulse 0.12.1: ⌥-drag duplicates

### Added
- **Option-drag copies** ("Select + option = duplicate in the same
  row"): hold ⌥ while dropping an amount chip — or a whole org-level
  subtotal — on another period and the payment(s) are duplicated there
  instead of moved (cursor shows copy; invoice/settle state never
  copies). POST /pulse/lines/duplicate behind it.

## [0.13.133] — 2026-07-09 — Pulse 0.12.0: the popup rebuilt + ten grid refinements

### Changed
- **The opportunity popup, Sjoerd's exact order**: direction → name →
  contact (org selected → ONLY its people; "Add person…" opens a nested
  search-or-create popup; unlinked picks still confirm) → expected date
  → stage → **offering rows** (select-or-type × qty × price × repeat,
  weighted amounts, + add offering) → weighted/full totals → **VAT
  tariff** + total incl VAT → owner | auto team → notes. Saved income
  gets **Invoice…** (nested confirm: create / create & send; number,
  ledger row, email) with "Invoice {no}" badges everywhere.
- **The grid, ten refinements in one pass**: BANK rename with the
  workbook chain (Bank(n) = End(n−1)); RESERVATIONS rename; reserve
  accounts grow virtually (greyed cumulative from their feeding rules);
  the yellow **Total** column at row end; org-level subtotals drag
  whole groups; client groups default closed with fold-state remembered
  per view; focus mode (active row pushed forward, rest folds/dims);
  cost rows lose the committed/↻ chips; one-line sticky labels with
  hover tooltips; reservation rows aligned to column keys (off-by-one
  fixed).
- **Settings: Invoicing card** (prefix, next-number preview, auto-send,
  VAT tariff editor) — plus the API-side schema fields the card needs.

## [0.13.132] — 2026-07-09 — Pulse 0.11.1: backend train + Teams under People

Interim ship (the popup-redesign agent is still building the UI half).

### Added
- **Offering rows + VAT + invoicing (backend)** (migration
  `20260709140000`): pulse_commitment_item (offering × qty × price ×
  repeat), VAT tariffs list + invoice numbering/auto-send in settings,
  and POST /commitments/:id/invoice — number from the workspace
  sequence, purchase-ledger row (SPoT), stage→invoiced, receipt email
  (manual or auto). UI follows with the agent batch.
- **Projection history (backend)** (migration `20260709160000`):
  snapshot_cadence_days in settings; the projection stores itself on
  cadence (workspace scope), keeps two years, GET /pulse/snapshots
  lists/serves them — comparison material.
- **Teams under People** (the Thread sidebar pattern): new /teams page —
  all workspace teams, member counts, planner-involvement toggle, "Open
  cashflow" per involved team. Projects page is purely Projects.
- Reservation rules expose their target bucket to the grid (reserve
  accounts will show virtual growth in the agent batch).

### Fixed
- **Deleting an income/cost 500'd on RLS despite owner+admin** — the
  soft delete now verifies visibility through RLS and stamps via the
  service role (the contact-creation pattern), with full error logging.

## [0.13.131] — 2026-07-08 — Pulse 0.11.0: the org popup, scopes, and the day's last batch

### Added
- **Per-organisation popup** ("I want per org a popup... a list of
  opportunities and invoices... clicking on one opens a popup with
  info... adding one opens a popup to add one"): click a client's name
  in either view — identity header, Opportunities group, Invoices &
  receivables group, + Add. Rows and Add open the opportunity popup
  LAYERED on top (Escape closes only the top; scroll-lock nests; the
  outer list refreshes after inner saves).
- **Me / Team / Workspace scope switcher** on Cashflow — URL params +
  per-user cookie; the projection and all rows follow; Workspace hides
  for users without access (RLS refuses them the data regardless).
- **Default probability per stage** editable in the stages card (empty
  = keep the row's value; committed/won always 100); stage changes in
  the table and popup apply the entering stage's default.
- **Ledger invoices card** in Settings: the include_ledger Switch +
  expected-settlement days. Open Stripe/invoice purchases from Meet and
  The Thread project as receivables.

## [0.13.130] — 2026-07-08 — Pulse 0.10.2: every reservation visible

### Changed
- RESERVES folds open like the other sections: header keeps the total
  per period; expanded shows one row per reservation rule (label + %,
  per-period amount = % of that period's weighted income). The
  projection response now carries the included rules.

## [0.13.129] — 2026-07-08 — Pulse 0.10.1: financial position = current

### Changed
- FINANCIAL POSITION shows one number: the current position (bank
  anchor, editable per account in the now column). The running
  projection across periods is END POSITION's job — showing both spread
  out duplicated the same series shifted by a column.

## [0.13.128] — 2026-07-08 — Pulse 0.10.0 · Flow 1.11.0: opportunities live in Flow

### Added
- **The Pulse↔Flow runtime bridge** (Sjoerd: "when opportunities are in
  the pipeline (Pulse), they should of course also be visible in FLOW").
  Migration `20260709080000`: flow_run supports external subjects
  (person_id nullable; subject_label, organisation_id, source_app +
  source_ref, unique per flow). Every opportunity mirrors to a run on
  the Pipeline flow — created/moved/completed as its stage changes
  (create/patch/delete hooks + idempotent backfill on the stages sync).
  **Two-way**: transitioning a mirrored run in Flow (kanban, run view)
  updates the commitment's stage and forces 100% for committed/won
  kinds — Flow's gates apply to those transitions. Flow renders
  person-less runs via label/organisation with a "Pulse" source chip
  (runs panel, kanban, run view, tasks, contacts).
- **Invoiced is a stage** (Sjoerd: "lead, proposal, committed, done,
  cancelled or an invoice"): seeded into new pipelines and retrofitted
  into existing ones by migration `20260709100000` (committed → Invoice
  sent → invoiced → Paid → done); money-kind committed — the receivable
  state.
- **Per-stage default probability** (same migration): lead 25 ·
  proposal 60 · committed/invoiced/done 100 · cancelled 0, stored on
  pulse_stage, editable via the stages API, applied automatically when
  a row enters a stage unless explicitly overridden per row.
- **Cashflow per me / team / workspace (backend)** (migration
  `20260709110000`): pulse_budget_line gains team_id (null = workspace
  overhead); the projection + budget-lines endpoints accept ?team_id=
  and ?owner=me, scoping commitments + recurring lines. Workspace scope
  stays admin-gated by RLS ("workspace may only be visible to the ones
  who have access" — organisers' reads are self-scoped by policy). The
  visible Me/Team/Workspace switcher follows in the UI batch.
- **Company-aware person picker**: with an organisation selected, its
  people list first; new people auto-link to the company; picking an
  unlinked person asks before creating the connection (org_membership —
  the real contact graph). Fold arrows on company rows in both views.

## [0.13.127] — 2026-07-08 — Pulse 0.9.0: every line works on its own

### Changed
- Sjoerd: "every line should just work on its own... this popup is very
  unclear. Just make it editable line per line, organised per org or
  pers." Both cashflow views became direct editors:
  - **By counterparty** is an inline-editable table — per org/person
    group, one line per income/cost: Label · No. · Unit € · = Total ·
    Recurring · Stage · Probability, every cell click-to-edit in place;
    a pencil opens the dialog for the rest.
  - **By period**: click an amount chip to edit it in place; click an
    empty cell in a line's row to add a payment in that period (hover
    shows a faint +); dragging still re-dates.
  - **The dialog is progressive** — counterparty, deal size, repeats,
    stage up front; label/team/project/offering/owner/notes folded
    behind "More options" (auto-expanded when set).

## [0.13.126] — 2026-07-08 — Pulse 0.8.1: chevron folds + teams endpoint fix

### Fixed
- **GET /api/v1/teams 500'd in production** — the member-count embed
  selected team_member.id, a column that table doesn't have (fly logs:
  "column team_member_1.id does not exist"). Counts now embed user_id.
  The workspace-teams fallback in the income/cost dialog and the
  Settings picker were failing silently because of this.
- ("The costs repetitive does not save" — diagnosis, not a code change:
  the deployed API predated the recurrence fields, so zod stripped them
  on save. Both migrations are already applied; one fly deploy closes it.)

### Changed
- **Section headers fold with a chevron** — the whole INCOME/COSTS/
  FINANCIAL POSITION header cell is the toggle (▸ closed / ▾ open);
  the "Show more/less" text links are gone.

## [0.13.125] — 2026-07-08 — Pulse 0.8.0: recurring is a characteristic; the grid grows up

### Changed
- **Recurring is a characteristic, not a separate thing** (Sjoerd; migration
  `20260708220000`): a commitment may carry repeat_cadence + first-on/until.
  One dialog for everything — a "Repeats" select reveals the window and
  hides the payment schedule (occurrences come from quantity × unit price,
  weighted by stage like everything else; the projection expands them
  server-side, the grid client-side under their client group as ↻ rows).
  "Opportunity is just income": buttons/titles say New income / New cost;
  the grid's add-rows are + Income / + Cost. The separate recurring dialog
  (0.7.2) is gone; the Budget page remains for counterparty-less overhead.
- **Drag-drop hardening**: hover highlight no longer dies when the cursor
  crosses a chip (relatedTarget guard); re-render churn fixed; move errors
  are explicit in the banner. The wiring itself was sound — every cell in
  a row was already a drop target.
- **Costs/income design identity**: emerald/rose accent bars + tinted
  titles on section headers, amount pills (rounded, ringed, grab cursor,
  − prefix on costs), semibold client rows, guide-border indents, slate
  ↻ cadence pills, zebra striping. Yellow totals + red END POSITION stay.
- **Fit to screen** toggle (persisted per user via cookie): the whole
  horizon in the viewport — fixed table, 160px label column, compact
  cells; or the normal scrollable layout.
- **FINANCIAL POSITION is editable in place**: Show more lists every bank
  account (reserves badged); the current-period cell is click-to-edit —
  type the balance, Enter saves today's append-only snapshot, positions
  recompute. The every-session ritual without leaving the grid.
- **Overdue can hide**: the column renders only when overdue unsettled
  amounts exist; otherwise the grid starts at the current period.

## [0.13.124] — 2026-07-08 — Pulse 0.7.2: recurring lines add inline from the grid

### Changed
- "I don't see the recurring costs/income": the grid's + Recurring
  income / + Recurring cost now open the Budget line dialog RIGHT THERE
  (shared LineDialog, direction preset) instead of navigating to the
  Budget page; budget actions also revalidate /cashflow so new
  recurring lines appear in the grid immediately. Recurring rows render
  inside the expanded Income/Costs sections as the "Recurring (budget)"
  group; totals include them even when collapsed.

## [0.13.123] — 2026-07-08 — Pulse 0.7.1: show per week/month/quarter, + rows in the grid

### Added
- **"Show per…" switcher on the grid** (week / fortnight / month /
  quarter): a display rhythm independent of the settings rhythm, via
  ?show= — the projection re-fetches on the requested grid (quarter
  added to the projection endpoint as calendar quarters) so the
  position rows always align with the columns.
- **"+" rows at the bottom of Income and Costs**: + Opportunity /
  + Cost open the dialog with the right direction; + Recurring
  income / + Recurring cost link to the Budget page (recurring lines
  live there, both directions).

## [0.13.122] — 2026-07-08 — Pulse 0.7.0: deal size as quantity × unit price

### Added
- Opportunities carry an amount as **quantity × unit price** (Sjoerd:
  "16 * product x / € 1.350") — migration `20260708190000` adds
  quantity + unit_amount_cents to pulse_commitment. The dialog gets a
  deal-size row (picking an offering prefills the unit price from its
  default amount; the computed total shows live, with an "insert as
  payment" shortcut that drops it into the schedule); the counterparty
  list shows "16 × Product X". Payment lines remain the schedule; the
  deal size is the expression.

## [0.13.121] — 2026-07-08 — Pulse 0.6.2: grid polish from Sjoerd's walkthrough

### Changed
- **Total rows have a distinct colour**: section headers (Financial
  position / Income / Costs) sit on the Fibre yellow tint; End position
  on a stronger tint, negatives still red — like the workbook's grey
  totals + red row, in house colours.
- **The period grid is the default Cashflow view**, and the choice is
  remembered per user (thefibre.pulse.cashflow-view cookie via the
  savePref pattern — settings are per-user, not per-app).
- **The grid runs the full width of the screen**; the by-counterparty
  list keeps its reading width.
- **Empty financial position points at the fix**: when no balances are
  filled in, a "Fill in your bank balances →" row links to Accounts
  (manual each session for now; auto-connect is the future).

## [0.13.120] — 2026-07-08 — Pulse 0.6.1: a cost is not an opportunity

### Changed
- Sjoerd: "With costs — it is not an opportunity... there are repetitive
  costs (and income)." The dialog now speaks accordingly: choosing
  **Costs** hides Stage + Probability entirely (a new cost saves as
  committed money at 100%; existing rows keep their stored stage) and
  shows a note pointing repeating costs AND repeating income to the
  Budget page's recurring lines. Titles follow ("New cost" / "Edit
  cost"), and the Cashflow header gains a **New cost** button beside
  New opportunity, opening the same dialog preset to Costs. Recurring
  income budget lines were already routed to the INCOME section of the
  grid (0.6.0).

## [0.13.119] — 2026-07-08 — Pulse 0.6.0: the cashflow grid — the spreadsheet's anatomy, live

### Changed
- **"By period" is now a sheet-shaped grid** (replaces the card board):
  sticky label column, period columns on the anchor grid (Overdue first,
  Later overflow), ‹ › scroll buttons so horizontal scrolling never
  depends on the input device. Rows in the workbook's order:
  FINANCIAL POSITION (balance entering each period) → INCOME (section
  totals + Show more; expanded = client group rows with opportunities
  stacked beneath, amounts as draggable chips in period cells — drag =
  re-date) → COSTS (outgoing commitments per client + budget lines
  expanded by cadence as non-draggable "Recurring" rows) → RESERVES →
  END POSITION (bold, red cells when negative — the sheet's red row).
  Live row filter (totals stay honest, "(filtered view)" note).
  Non-admins degrade to INCOME + COSTS.
- **Opportunity label prefills** from the picked project/offering
  ("Label of an opportunity is: project/offering").

## [0.13.118] — 2026-07-08 — Pulse 0.5.1: contact creation via the platform pattern

### Fixed
- **Creating contacts STILL 500'd after the 0.13.117 policy split** (the
  RLS violation surfaced on the insert's returning read even for a
  super_admin). Rather than a third policy iteration, POST /persons and
  POST /organisations now follow the established platform pattern for
  contact creation (as Meet/Thread enrolment always has): adminClient
  with explicit `workspace_id: ctx.workspaceId` — membership is
  guaranteed by the auth middleware; reads stay fully RLS-gated. Both
  routes also finally log full Postgres errors (code/details/hint) to
  stderr, which they never did — the one route class that violated
  feedback_api_logs_first.

## [0.13.117] — 2026-07-08 — Pulse 0.5.0: quick add, the period board, and the fixes from Sjoerd's test-drive

### Fixed
- **Creating a NEW contact was impossible under RLS** (platform-wide, hit
  from Pulse's combobox: "new row violates row-level security policy").
  person/organisation policies had can_see_* in their WITH CHECK — never
  true for a fresh row. Migration `20260708150000` splits the policies:
  visibility gates reads/updates/deletes; INSERT needs only your own
  workspace.
- **GET /pulse/stages self-heals**: if the Pipeline flow is missing (the
  migration backfill needs a super-admin owner and skips otherwise), the
  first read creates it. (Also the diagnosis for "I don't see it": the
  running Fly API predated the stages routes entirely — logs showed 404.)

### Added
- **Quick add** on the Cashflow page: one combobox over ALL contacts
  (people + organisations, create-org inline), an amount, a date —
  defaults handle the rest (income, Lead, 50%, you as owner). The
  extended dialog remains for everything else.
- **By-period board**: view toggle on Cashflow — columns per period
  (week/fortnight/month per settings, Overdue first, Later overflow),
  unsettled expected payments as draggable cards; drop on a column
  re-dates the payment (the spreadsheet's drag-a-number-to-a-column,
  formalised). Weighted net total per column.
- **Direction is two buttons** in the opportunity dialog — Income (green,
  arrow in) / Costs (red, arrow out) — replacing the select.

### Changed
- **Team select falls back to all workspace teams** (with a "scope in
  Settings" hint) when no involved teams are picked yet.
- **Every date input in Pulse uses the shared DateField SPoT** (date-only)
  via the standard re-export shim — lines editor, budget dates, balance
  as-of, quick add.
- **Settings: "How far ahead" presets** (2 / 3 / 6 / 12 months / 2 years)
  replace the horizon number input; the confusing period-anchor-date
  field is gone from the UI (grid anchors on today; the P6 importer sets
  the payroll-aligned anchor from the workbook).

## [0.13.116] — 2026-07-08 — Pulse 0.4.0: the Pipeline lives in Fibre Flow; Pulse speaks cashflow

Sjoerd's correction, verbatim: "FLOW is the other app... there the pipeline
should be built. That FLOW could then be used in the CASHFLOW tool, which
is in PULSE." And: "Still I see pipeline in pulse... not cashflow."

### Changed
- **The Pipeline is a real Fibre Flow** (migration `20260708120000`):
  `flow_definition.system_key` marks app-owned flows; a "Pipeline" flow
  (5 steps, transitions, canvas positions) is backfilled for Pulse
  workspaces and seeded on future activations (lib/pulse-pipeline.ts).
  Flow's DELETE guards it with a 409 while Pulse is active. Pulse
  consumes it read-only: GET /pulse/stages now syncs the `pulse_stage`
  mirror from the flow's current version (labels + order from Flow;
  end_positive→won, end_negative→lost) before answering, and returns
  `pipeline_flow_id`. POST/DELETE /pulse/stages answer 409 "authored in
  Fibre Flow"; PATCH is kind-only (the money-semantics overlay — the one
  thing that stays Pulse's). Third sanctioned wall crossing: flow
  definitions are consumable cross-app, Flow owns authoring
  (proposal §3.12 rewritten).
- **Pulse says Cashflow, not Pipeline**: sidebar item, page title and
  copy renamed; the route moved /pipeline → /cashflow with a redirect;
  Settings' stages card is now a read-only reflection of the flow with
  per-stage money-semantics editing and an "Edit the flow in Fibre
  Flow" link.

## [0.13.115] — 2026-07-08 — Pulse 0.3.0: the pipeline is a flow, the chart is visual

From Sjoerd's P2 test-drive, five asks in one release.

### Added
- **Stages are a flow, not an enum** (migration `20260708090000`):
  `pulse_stage` — the workspace's pipeline flow, seeded on Pulse
  activation with the default sales flow (Lead → Proposal → Committed →
  Done, + Cancelled). System stages are undeletable (RLS-enforced, not
  just API); custom stages can be added/renamed/reordered around them.
  `kind` (open | committed | won | lost) carries the projection math:
  open = probability-weighted, committed = 100%, won = done, lost =
  excluded. Commitment stage validation + probability forcing now run
  against the table; the old check constraint is dropped (seeded keys
  match the old enum — zero data change). Settings gets a "Pipeline
  stages" card; the opportunity dialog's stage select and the list's
  stage chips are data-driven. (Deliberately Pulse-owned, not a Fibre
  Flow definition — proposal §3.12 explains; the shape maps onto Flow
  if the apps ever converge.)
- **Type-ahead counterparty pickers with inline create** — organisation
  and person fields in the opportunity dialog are now comboboxes: type
  to filter, and "Create '<name>'" makes the contact on the spot (POST
  /organisations, /persons) and selects it. Contacts born in Pulse are
  ordinary platform contacts (proposal §3.5).
- **Owner defaults to the signed-in user** on new opportunities.
- **The cashflow overview is visual**: per-period income (emerald) and
  cost (rose) bars — costs were always in the math, now they're on
  screen — under committed (solid) + expected (dashed) balance lines,
  zero line with below-zero shading, hover tooltip per period,
  Expected / Committed / Best-case layer toggle, legend; the period
  table is collapsible behind it.

## [0.13.114] — 2026-07-07 — teams are workspace-visible (RLS fix)

Sjoerd: "the team is not the same as in thread or meet." Two causes:

### Fixed
- **`team` + `team_member` RLS still required fibre-meet membership** — a
  leftover from teams' Meet era (meet_team_scope, renamed 2026-05-17).
  A Pulse-only user saw an empty picker and zero member counts. New
  migration `20260707210000`: read = any workspace member; team writes =
  workspace admin or fibre-meet (behaviour-preserving); lead-gated
  team_member writes unchanged. Teams are a platform primitive — their
  visibility can't hang off one app's membership.

### Clarified (by design, not a bug)
- Meet's team list shows *teams you're an active member of* (it's "my
  teams"). Pulse's involved-teams picker shows *all workspace teams* —
  an admin marks any team as a hub, including ones they're not in. Same
  table, different lens.

## [0.13.113] — 2026-07-07 — Pulse 0.2.0: P2 — every Pulse surface is editable

Three parallel agents, one lane each; foundation (teams endpoint + Switch)
built first. All dialogs follow the Fibre dialog contract; every money
input accepts comma decimals and stores integer cents.

### Added
- **Platform `/api/v1/teams`** (build-plan 10b, the teams SPoT doorway):
  workspace teams with member counts. Meet's team routes stay as aliases;
  Pulse's involved-teams picker is the first consumer.
- **Settings**: rhythm/currency edit dialog (granularity, anchor date,
  fiscal year start, horizon), reservation rules (inline include Switch,
  add/edit/delete, target reserve-bucket select), involved-teams picker
  (excludes already-involved, shows member counts), and a new Offerings
  section (name/category/default amount/notes, archive).
- **Accounts**: new/edit account dialogs (bank|reserve, parent bank for
  reserves, archive), and the **Update balances** dialog — every account
  with euro inputs prefilled from latest snapshots, one as-of date,
  dirty-tracking, append-only snapshot writes.
- **Budget**: new/edit line dialog (category, direction, amount, cadence,
  start/end, owner from workspace members, include SwitchField) + inline
  optimistic include toggle per row; archive as Delete.
- **Pipeline**: the opportunity dialog (xl) — direction, label, mutually-
  exclusive organisation/person counterparty pickers, team (involved
  teams), project (grouped by chosen team), offering, owner, stage +
  probability (forced 100 & disabled for committed/done), notes, and the
  Expected-payments lines editor (date, euro amount, invoice #, invoiced/
  settled dates, add/remove, live total). One server action saves the
  commitment then diffs lines (create/patch/delete). Two-click delete
  (soft). Rows in the counterparty-grouped list open the dialog.
- **Teams & projects**: new/edit project dialog (name, team with
  hubs-are-teams hint, notes), archive; clickable rows.

### Known limits (deliberate, P2 scope)
- Owner can be reassigned but not cleared back to nobody (API defaults
  the caller on create; omitted-on-edit = unchanged).
- Pickers cap at 100 persons/organisations (search comes with the
  counterparty view phase).

## [0.13.112] — 2026-07-07 — Pulse 0.1.0: Fibre Pulse P1 — the business planner is born

The 6th Fibre app (5th delivery app): cashflow projection + budgeting built
on contacts and offerings. docs/fibre-pulse-proposal.md is the spec; this
release is P1 of its build plan (schema + API + walking-skeleton app).

### Added
- **pulse schema** (migration `20260707120000`): settings, involved teams,
  accounts + append-only balance snapshots, offerings, projects (under
  platform teams — hubs/incubators), commitments (opportunities: stage
  lead→done + probability %) with dated lines carrying real-invoice refs
  and purchase-ledger links, budget lines (recurring, include toggle),
  user-defined reservation rules (VAT = just another rule), annual budgets
  + quarterly targets. RLS: money surfaces admin+, pipeline admin-or-owner.
  App registered as `fibre-pulse`; activated + admin-membership granted for
  existing workspaces in the migration (unlike Flow, which was hand-done).
- **`/api/v1/pulse/*`** — CRUD for all of the above plus `GET /projection`:
  period buckets (week/fortnight/month, anchor-date grid), three layers
  (committed / probability-weighted expected / best case), budget-line
  cadence expansion, reservation deduction, running balances, and the
  dips-below-zero answer.
- **apps/pulse** (`:3004`, pulse.thefibre.app, Vercel project TBD) — Flow's
  shell pattern: landing, auth, no-access, app-switcher gating. Pages:
  Pulse (runway sentence + SVG balance chart + period table), Pipeline
  (grouped by counterparty, stage + probability), Teams & projects, Budget,
  Accounts, Settings (rhythm/currency/reservations/teams read-out). P2
  brings the edit dialogs; P6 imports the real Soul Lab workbook.
- `fibre-pulse` in the shared APPS registry, workspace-apps INSTALLABLE,
  CORS allowlists (plus Vercel preview regex).

### Fixed
- **flow.thefibre.app was missing from the API CORS allowlist** (and the
  Vercel preview regex) — production Flow presumably rode on the
  `CORS_ORIGINS` env override. Both lists now carry flow + pulse.

## [0.13.111] — 2026-07-07 — Thread 3.31.4: toggle switches for every boolean setting

### Changed
- All single on/off settings in Thread now use the toggle switch (label
  left, yellow when on): show-on-public-agenda (engagement dialog),
  list-on-organiser-page (Basics), approval required + both participant
  visibility options (Registration tab), award-certificate (Certificates
  tab), early-bird + active (coupon dialog), active (ticket dialog), and
  send-confirmation (Add participant). New `SwitchField` handles both
  FormData forms (hidden 'on' input) and controlled state.
- Checklists (payment options, embed elements, share grantees, bulk row
  selection) and the public form's consent boxes deliberately stay
  checkboxes — different semantics.

## [0.13.110] — 2026-07-07 — Thread 3.31.3: publish is a toggle switch next to the title

### Changed
- The engagement dialog's publish control is now an iOS-style toggle
  (yellow when on, per Sjoerd's reference) sitting to the right of the
  Title field — replaces the pill in the dialog header (3.30.3). New
  `Switch` component in components/ui. Behaviour unchanged: new
  engagements start published; toggling off keeps them as drafts.

## [0.13.109] — 2026-07-07 — Thread 3.31.2 · Meet 2.4.2 · Flow 1.10.1: whole-Fibre code cleanup

Four inventory agents swept every package; each claim re-verified before
touching anything. Net −~2,600 lines with zero intended behaviour change,
plus a handful of real fixes the sweep surfaced.

### Fixed (found by the sweep)
- **Tailwind purge now scans `packages/shared`** — all four apps' content
  globs missed it, so the shared date-picker's arbitrary-value classes
  (e.g. `w-[292px]`) could vanish from production CSS.
- **Meet's invite page Sign out button worked again** — it posted to
  `/auth/sign-out`, a route that didn't exist (added).
- **Thread + Meet `GET /me` / `GET /settings` report Stripe connection
  through the payments SPoT** — they read only the legacy columns, so the
  pricing panel showed "connect Stripe first" to users who had connected
  via Settings → Payments. The app-local PATCHes no longer accept
  `stripe_account_id` at all ("never write the old columns again" is now
  enforced by the schema).
- **Scheduler timezone conversion is DST-safe** — thread.ts carried its
  own sv-SE-locale hack without the DST re-check; it now delegates to the
  shared implementation.
- **Flow's sidebar Settings link went nowhere** (no settings route) — removed.
- Thread's pricing tab still told organisers "checkout lands with the
  payments phase" (it shipped weeks ago) — three user-visible strings fixed.

### Removed (verified dead)
- **~30 dead files** across thread/meet/flow (~1,300 lines): unused ui
  primitives (tabs/card/avatar/bottom-sheet/…, both apps), sign-out
  components ×3, Meet's stale availability-engine copy (the live one is
  in the API), scheduling-rules, ical builder, old settings form,
  skeletons/save-bar/prefetch helpers, empty workspace skeletons
  (packages/config·db·ui).
- Dead code: `moveEngagement` action, `requireStripe`, `fmtDate`,
  `cookieDomain`, unused imports/consts, a hot-path debug `console.log`
  on meeting-type PATCH.
- Unused dependencies: zod (thread, flow, meet), radix dropdown (meet,
  flow), class-variance-authority (meet, flow), clsx+tailwind-merge
  (flow), prettier (root), and the four zombie `next lint` scripts +
  eslint deps (no config ever existed; queued as a real task).

### Changed (consolidation, no behaviour change)
- `errorMessage()` — nine drifted copies across Thread's server actions →
  one export in `lib/api.ts`. `one()` PostgREST normalizer — local copies →
  the `lib/thread-types` export. One `Billing` type instead of four inline
  literals. Prefs cookie names from `prefs-shared` constants.
- **`lib/fees.ts`** — the plan-aware platform-fee block existed four times
  (Meet checkout, Thread enrol, webhook payout, payment links); one
  implementation now.
- `escapeHtml` deduped in the email templates; credential columns dropped
  from a dozen selects that no longer read them.

### Docs & config grooming
- build-plan.md "Open queue" is now THE maintained to-do list (groomed
  stamp; done items removed). New: docs/thread-split-map.md — full
  section/dependency map for splitting the 4.7k-line thread.ts.
- CLAUDE.md / build-plan / deploy.md version markers and stale claims
  fixed ("five package.json" → six, CORS note, Sales/Learn references).
- `.env.example` rewritten against what the code actually reads.
- Flow's dev server moved to :3003 (thread and flow both claimed :3002);
  CORS allowlist follows. Root package.json version aligned.

## [0.13.108] — 2026-07-05 — Thread 3.31.1 · Meet 2.4.1: full-app debug pass (21 fixes)

Four parallel review agents swept the releases since the last adversarial
pass (0.13.98–0.13.107) plus the standing money/auth flows; every finding
was re-verified against the source before fixing. 31 findings → 21 fixed,
the rest judged working-as-intended and documented.

### Security / authority
- **Manual add participant now requires real authority** — admins, the
  thread organiser, co-organiser hosts, or owning-team members; before,
  any workspace member could inject enrolled participants (and trigger
  emails) into any thread, bypassing payment and approval.
- **PATCH /meet/me no longer returns the Google refresh token** (GET
  already stripped it; PATCH leaked the raw row — and always, after the
  personal-room-only save split).
- **Uploads take raster images only** (png/jpeg/webp/gif/avif) — SVG/HTML
  in a public bucket is stored XSS.
- **Certificate-template shares endpoint scoped to the workspace** (was an
  unscoped read by template UUID).

### Money
- **Mark-paid now expires a live Stripe Checkout session** (both the
  Invoices route and the thread route) — the payment link stayed payable
  after a bank transfer was marked received: a real double-payment window
  the webhook then swallowed silently.
- **Payment links follow team payout routing** — chargeAccountForItem now
  uses the same destination resolution as checkout, so lead-payout team
  threads no longer get their resent links charged to the workspace
  account (which also left two payable sessions alive).
- **Receipts read seller details through the payments SPoT** — Settings →
  Payments edits (legal name, VAT) finally reach the receipt emails.
- **Reimburse refuses €0 discount-code purchases** (flipping them to
  refunded irreversibly mislabeled a free enrolment as a refunded payment).
- **Pending purchases mail as "Invoice", not "Receipt"** (with "awaiting
  payment"), and free purchases say "Free (discount code)" instead of
  "Card".

### Enrolment correctness
- **Manual add checks thread state**: completed/archived threads refuse
  new people; full threads (capacity) refuse with a clear message.
- **Manual add re-activates instead of lying**: adding someone who was
  declined or stuck at unpaid/unapproved now re-enrols them (door
  override) instead of replying "already enrolled" while leaving them out;
  completed/active enrolments are never regressed.
- **The message scheduler skips 'invited' enrolments** — people awaiting
  approval or payment no longer receive all scheduled course content.
- **Duplicates and templates keep engagement statuses** — an all-draft
  copy silently emptied the public agenda and muted every message; now
  published source engagements stay published in the copy.

### Dates
- **The API rejects end-before-start** on thread create/update (aware of
  the auto-shift) and on activities (end must follow start — same-day
  end-times before the start were accepted).
- **The date picker's "Today" button respects min/max** — it was a
  one-click bypass of the end-after-start constraint.

### Connections polish
- **Meet's OAuth feedback lands on Settings → Connections** (redirects
  targeted /settings, which never read the ?google= params — success and
  errors were invisible).
- **Disconnect cleans calendar rows for Thread-only users** (the delete
  ran under Meet-membership RLS and silently no-op'd for them).
- **Host provisioning survives a first-touch race** (unique-violation now
  resolves to the winner's row instead of a 500).
- **Credential columns dropped from a dozen unused selects** on public
  endpoints (they pulled the token into memory for nothing).

### Registrations dialog
- **Lifecycle action failures are surfaced** (approve/decline/complete/
  mark-paid errors used to vanish — the list just re-rendered unchanged).
- **"Already enrolled" renders as info, not an error**, and reactivation
  gets its own message.

### Noted, not changed (deliberate)
- Manual adds receive up to 72h of catch-up messages via the scheduler
  lookback (at-most-once send semantics stay as designed).
- Engagement status 'closed' collapses to draft in the editor — latent;
  nothing writes 'closed' today.
- Uploads still don't check per-app membership (any workspace member may
  upload); MIME + size limits added, membership gate deferred.

## [0.13.107] — 2026-07-05 — Connections data moves to platform level

### Changed
- **Connections are now a data-level SPoT** (follow-up to 0.13.106, which
  unified the UI but left the data on `meet_host`). New `user_connection`
  table holds `google_refresh_token` + `personal_room_url` per user —
  deliberately NOT on `user_profile`, which is workspace-readable by RLS
  design; the token is a credential, so the new table has RLS enabled with
  no policies (API service-role only). Backfilled from `meet_host`
  (migration `20260705090000`).
- All readers (booking create/cancel/confirm, slots, multi-host
  availability, calendar sync, `/me`, connections, Thread's organiser
  payload) resolve through `apps/api/src/lib/connections.ts` —
  platform value first, old `meet_host` columns as read fallback. Writes
  (OAuth callback, disconnect, personal-room saves from either app) go to
  the platform table and clear the fallback so a disconnect can't be
  resurrected by a stale app-local value.

## [0.13.106] — 2026-07-04 — Thread 3.31.0 · Meet 2.4.0: manual add participant, photo upload, Connections SPoT

### Added
- **Manual add participant** (Thread) — the Registrations popup gains an
  "Add participant" button: name + email, optional confirmation/welcome
  messages. Skips payment and approval — the person is enrolled
  immediately (walk-ins, phone signups). Same account auto-create and
  consent bookkeeping as the public form; duplicates are detected.
  New API: `POST /thread/threads/:id/participants`.
- **Profile photo upload** (Thread + Meet) — the Photo URL text field in
  Settings → Profile is now an image upload with thumbnail,
  replace/remove. Meet gained an uploads endpoint backed by a new public
  `fibre-assets` bucket (migration `20260704220000`).

### Changed
- **Connections is a SPoT now** — Thread has its own Settings →
  Connections page (Google Calendar + personal meeting room) managing the
  same user-level data as Meet's; the settings card no longer bounces you
  to Meet in a new tab. The Google OAuth flow returns to whichever app
  started it (signed `return_to` in the state), and the connections
  endpoints provision the host row on first touch so Thread-only
  organisers can connect too. The engagement dialog's "no personal room"
  hint now points at Settings → Connections.

## [0.13.105] — 2026-07-04 — One date-field component for all apps

### Changed
- **`DateField`/`DateTimeField` moved to `@thefibre/shared`** (`src/ui/
  date-field.tsx`) — the per-app copies in Thread, Meet and Fibre web had
  drifted (the 22:00 time cap was fixed in one but not the others). The
  app-local files are now one-line re-exports, so existing imports keep
  working; the shared package gained JSX/DOM compilation and a
  `./ui/date-field` subpath export. Edit the shared copy from now on.

## [0.13.104] — 2026-07-04 — Meet 2.3.3: full-day time picker in Meet and Fibre web too

### Fixed
- The 00:00–23:45 time-picker range (3.30.3) had only reached The Thread's
  copy of the date-field component — Meet's and Fibre web's copies still
  stopped at 22:00. All three now cover the whole day.

## [0.13.103] — 2026-07-04 — Thread 3.30.3: publish pill on engagements, complete billing address, full-day time picker

### Added
- **Publish pill in the engagement dialog** — a green Published / grey Draft
  toggle sits top-right next to the title (replaces the Status control in
  the sidebar column). New engagements are published by default; click the
  pill to keep one as a draft.
- **Complete billing address on the enrol form** — the single address
  textarea is now street + number, postal code, city and country (labels
  translated ×5). The receipt email, participant popup and both Invoices
  detail dialogs render the composed address.

### Changed
- **Time picker covers the whole day** — the date-time selector's time
  column now runs 00:00–23:45 (was 06:00–22:00), still in 15-minute steps.

## [0.13.102] — 2026-07-04 — Thread 3.30.2: receipt resend + contact info in participant popup, end-after-start dates

### Added
- **Send receipt from the participant popup** — the detail popup (Enrolments
  page + per-thread Registrations dialog) gains a "Send receipt" button in
  the footer for anyone with a purchase, including free-via-code enrolments.
  Backed by `POST /api/v1/purchases/resend-by-ref` ({app, item_ref}), which
  reuses the shared receipt email; the invoice-PDF button appears when
  Stripe issued one.
- **Contact info in the participant popup** — email, phone, city/country and
  preferred language now show in a Contact section (the API's enrolment list
  select was extended with those person fields).

### Fixed
- **End date can no longer precede the start date** — picking a start date
  constrains the end-date picker in the new-thread form, the thread Basics
  form, and the activity dialog (where Ends also stays within the thread
  window).

## [0.13.101] — 2026-07-04 — Thread 3.30.1: Invoices team picker shows only your teams

### Fixed
- The Team scope on the Invoices page listed every workspace team (Meet's
  listed only yours) — selecting a team you're not in could only ever show
  "0 purchases". The picker now offers only teams you're an active member
  of (`/thread/teams?mine=1`); admins see everything via the Workspace
  scope as before.

## [0.13.100] — 2026-07-04 — Thread 3.30.0: approval toggle, hosts into settings, free-code purchases, detail popup everywhere

### Added
- **The approval toggle exists now** — it never had UI. Thread settings →
  Registration tab → "Approval required": enrolments wait as requests until
  approved (the flow itself shipped in 3.22.0; the switch was missing).
- **Discount-code people are purchases** (migration `20260704200000`) —
  €0-via-code enrolments land in the Invoices area as method "Free (code)",
  amount €0, settled, with the code in the item label; existing ones
  backfilled.
- **Participant detail popup in the Registrations dialog** — the per-thread
  popup's rows now open the same full detail view (answers, payment,
  billing, certificate) as the Enrolments page.

### Changed
- **Hosts & facilitators moved into thread settings** (Sjoerd's earlier
  request, recovered) — the people icon left the timeline header; the
  management panel lives in the Basics tab under language/timezone, next to
  the page/popup and listing settings.

## [0.13.99] — 2026-07-04 — Workspace payment defaults, team payout routing, honest card availability (Thread 3.29.0 · Meet 2.3.2)

### Fixed
- **"payments are not configured yet" on enrol** — root cause found:
  `STRIPE_SECRET_KEY` was never set on Fly, so the card path could never
  work (Meet's included). Two changes make the system honest until it is:
  the public payload now **drops the card option whenever it cannot work**
  (platform key missing, or no connected account for the thread's payout
  destination) — leaving invoice when enabled, so invoice-method
  enrolments work today; tickets cannot resurrect a dropped card option.
  Setting the key remains Sjoerd's action.

### Added
- **Workspace-level default payment options** (migration
  `20260704180000`) — the inheritance root now follows the money:
  team/workspace-destination threads inherit the WORKSPACE defaults
  (Settings → Payments → Workspace account gains the same checkboxes);
  personal threads keep inheriting the organiser's.
- **Team settings + payout routing** — the team page gains a settings
  section: description, and "payments from this team's threads go to"
  with a 2-card chooser: **Workspace account** (default) or the **team
  lead's personal account** (named). Editable by the team lead or a
  workspace admin; checkout and refunds resolve accordingly. This answers
  "who is the team admin": the existing `lead` role.

## [0.13.98] — 2026-07-04 — Thread 3.28.0: enrolments search + participant detail popup

### Added
- **Search on the Enrolments page** — name, email, thread or ticket,
  filtering live; select-all follows the filtered view.
- **Participant detail popup** — clicking a participant opens everything
  about their enrolment: thread, status + progress, signed-up/enrolled/
  completed dates, certificate link, the payment block (amount, card vs
  invoice, ticket, discount code, billing incl. tax no.) and — visible for
  the first time — their **registration answers** (the intake questions
  collected on the enrol form).

## [0.13.97] — 2026-07-04 — Security & money hardening: 14 review findings fixed (Thread 3.27.1 · Meet 2.3.1)

An independent adversarial review of the payments/invoices surface produced
15 findings (most confirmed). 14 fixed, 1 accepted with documentation.

### Fixed — authority & safety
- **Any workspace member could mark-paid / approve / decline / complete
  other organisers' enrolments** — the lifecycle routes now require admin,
  the thread's organiser, or a co-organiser host (matching the purchases
  routes' authority model).
- **Disconnecting Stripe now sticks** — clearing the platform value also
  clears the legacy fallback columns (meet_host / thread_organiser /
  thread_settings); previously the old account silently kept charging.
- **Declining a participant expires their open checkout session** — no more
  paying through a tab that was still open after a decline.

### Fixed — money correctness
- **Refunds run on the account the charge landed on** (stored per purchase
  at record time), not on today's possibly-changed settings.
- **Resending a payment link expires the previous session** and the webhook
  resolves stale sessions by metadata — no orphaned still-payable links, no
  unrecorded charges.
- **A payment-link expiry no longer fails an outstanding invoice** — the
  email said "the invoice stands" and now the ledger agrees.
- **Mark-paid only applies to pending purchases** — refunded/failed sales
  can't be resurrected, and confirmation side-effects never re-fire
  (finalize is idempotent on retries).
- **Webhook retries repair partial runs** — the idempotency guard now also
  checks the ledger row; payout inserts are conflict-proof.
- **Coupons aren't burned by failed checkout starts** — rollbacks release
  the use; retries with the same code work.
- **Abandoned checkouts no longer eat capacity/quantity forever** — failed
  enrolments are excluded from sold-out and capacity counts, the
  cheapest-ticket fallback path enforces quantity, and a bailed-out payer
  gets a fresh checkout instead of a false "already enrolled".
- **Meet's expired sessions flip the ledger to failed** (pending totals no
  longer inflate forever).
- **Totals are per currency** — a £ sale no longer inflates the € figure.
- **Concurrent ledger writes can't drop the paid state** (insert-race
  retry-as-update).

### Accepted (documented)
- The payment-SPoT migration converted explicit card-only thread settings
  into "inherit" (indistinguishable from the old default). Identical
  behaviour until an account default changes — organisers who want
  card-only-per-thread set it in the Pricing tab.

## [0.13.96] — 2026-07-04 — Payments as a true SPoT, payment-type inheritance, auto-accounts (Thread 3.27.0 · Meet 2.3.0)

Sjoerd's diagnosis was correct: the Stripe connection was "a setting in one
app used in others" — Meet wrote meet_host, Thread wrote thread_organiser,
edits forked. Fixed structurally.

### Changed — payments SPoT (migration `20260704150000`)
- **Personal payment settings live on `user_profile`** (stripe_account_id,
  invoice_details, default_payment_methods) and **workspace settings on the
  `workspace` row** — backfilled from the app-local columns (Meet's value
  wins; the old columns remain read fallbacks and are never written again).
- **One resolution path**: `apps/api/src/lib/payment-accounts.ts` — every
  reader (Thread checkout, Meet checkout, refunds, payment links) resolves
  through it: platform value → app-local fallback.
- **Settings → Payments is the same page in Thread AND Meet**, writing the
  platform endpoints (`/api/v1/profile`, new `/api/v1/workspace-billing`,
  admin-gated). Two levels: My account + Workspace account, each with the
  Stripe id and the invoice issuer identity. Teams inherit the workspace
  account by design (noted on the page).

### Added — payment-type inheritance (account → thread → ticket)
- **Account default** (Settings → Payments → "Default payment options":
  pay online / pay per invoice), **thread override** (Pricing tab: inherit
  or custom), **ticket override** (ticket popup: inherit or custom). Null =
  inherit at every level; resolved server-side including the public enrol
  payload, so the enrol form's method toggle follows the SELECTED ticket.

### Changed — participant accounts
- **Accounts are created automatically at enrolment** (email-only — Google/
  the 8-digit code still verify ownership at first sign-in). The enrol form
  now always says "Sign in to your personal page".

### Also
- Members page role picker speaks the new vocabulary (Super Admin / Admin /
  Organiser (default)).
- Full debug sweep: production builds of all five packages pass; migrations
  applied; independent code review of the payments/invoices surface ran in
  parallel (findings follow as a patch release if any).
- Documentation refreshed across CLAUDE.md, docs/build-plan.md,
  docs/deploy.md (Stripe webhook matrix), docs/invoices-and-roles-proposal.md
  (decisions recorded as resolved).

## [0.13.95] — 2026-07-04 — App filter on Invoices, invoice issuer identity (Thread 3.26.1 · Meet 2.2.2)

### Added
- **App filter chips on the Invoices page** (All apps / Fibre Meet /
  The Thread) — defaulting to the app you're in, one click to the
  cross-app view.
- **Invoice issuer identity** (migration `20260704140000`) — Settings →
  Payments now carries the seller's legal name, address and tax/VAT
  number at BOTH levels: personal (organiser profile — used for personal
  sales) and workspace (used for team/workspace sales). Receipts and
  invoice emails show a From/seller block resolved per purchase
  (organiser's details first, workspace's as fallback).

## [0.13.94] — 2026-07-04 — Payments settings native, receipt emails, invoice payment links (Thread 3.26.0 · Meet 2.2.1)

### Added
- **Payments settings live in Thread** (Settings → Payments) — no more
  new-tab bounce to Meet. Two levels: **My account** (the personal Stripe
  Connect id — the same value Meet reads: one connection per person) and
  **Workspace account** (admin-gated). Teams hold no accounts by design —
  team sales pay out to the workspace account per the payout rule; noted
  on the page.
- **Receipt-styled emails** — resend-invoice (and the new payment-link
  mail) now render an actual receipt: item, date, payment method, billing
  block, total, and the button (View invoice PDF / Pay online).
- **Payment link for invoice-method sales** — the Invoices detail dialog
  gains "Send payment link" on pending invoice purchases: a Stripe
  Checkout session for the open amount, emailed as a receipt with a Pay
  online button; the existing webhook completes it (confirmation, ledger,
  split). Thread purchases in v1; Meet's invoice bookings stay mark-paid.
- **Billing fields on the enrol form** (migration `20260704120000`) —
  choosing "Receive an invoice" reveals company/organisation, billing
  address and tax/VAT number (i18n ×5); stored on the enrolment and the
  purchase row, shown in the Invoices detail dialog.

## [0.13.93] — 2026-07-04 — Invoices area + role tiers (Thread 3.25.0 · Meet 2.2.0)

The big one from docs/invoices-and-roles-proposal.md — all four design
decisions accepted as recommended.

### Added — platform
- **`purchase` ledger** (migration `20260704091000`) — the second
  sanctioned data-wall crossing after the activity log: one row per money
  event across Meet + Thread (payer, item, amount, split, method, status,
  Stripe invoice link), written by both apps at checkout completion /
  mark-paid / refund and **backfilled** from every existing booking and
  enrolment with money involved. RLS: admins see the workspace, organisers
  their own sales + their teams'.
- **Role tiers** (migration `20260704090000`) — `workspace_role` becomes
  `super_admin | admin | organiser` ("every account is an organiser at
  minimum"); existing members migrated, earliest admin per workspace
  promoted to Super Admin. `is_workspace_admin` / `can_see_person` /
  `can_see_organisation` widened; new `current_workspace_role()` helper.
  **Facilitator stays a per-thread role** and sees no financial data.
- **Purchases API** — `GET /api/v1/purchases` (scope me/team/workspace,
  search, app filter, cursor pagination, totals; workspace scope is
  admin-only) + `resend-invoice` (branded email with the hosted Stripe
  invoice), `refund` (full refund on the connected account, **platform fee
  returned**; invoice-method = recorded), `mark-paid` (invoice-method,
  runs the same side-effects as the webhook).
- **Thread webhook now stores the hosted Stripe invoice URL** (closed the
  gap Meet never had).

### Added — apps
- **Invoices in the sidebar of Thread AND Meet** — scope toggle
  Me / Team / Workspace (workspace disabled without an admin role), search
  across payer/email/item, totals bar (paid / pending / refunded / fees),
  load-more pagination, and a detail dialog on the Fibre bottom-bar
  contract with Reimburse (confirm, full only), Mark paid, Resend invoice
  and the hosted-invoice link.

### Notes
- Refunds are v1: full amount only, no partial; Stripe issues no automatic
  credit note (proposal §3.7).
- Invoice-method sales carry no Stripe document — resend applies to card
  payments; organisers send their own invoice documents.

## [0.13.92] — 2026-07-04 — Thread 3.24.0: embed custom CSS — every element named

### Added
- **Stable `te-*` classes on every embed element** — card, cover, kicker,
  title, intention, meta, price, label, list, agenda(+item), enrol card,
  input, button — across the list embed, thread embed and enrol card.
- **Custom CSS that crosses the iframe** — a `<style>` block placed INSIDE
  the embed element is lifted off the host page by embed.js and injected
  into the embed iframe (`thread-embed:ready`/`:css` handshake; capped,
  CSS-only). Popups inherit the CSS of the embed/trigger that opened them.
  Injected last, so overrides win without `!important`.
- **The default stylesheet, documented and generated** — Settings → Website
  embeds shows the complete element reference with the default look (change
  the values, keep the selectors), and the code generator gains an
  "Include the starter stylesheet" checkbox that writes it into the snippet.

## [0.13.91] — 2026-07-04 — Thread 3.23.1: workspace-wide list embeds

### Added
- **`data-workspace` on list embeds** — a list of every public thread in
  the workspace, across all organisers and teams. Supported end-to-end:
  embed listing API (`?workspace=`), embed.js attribute, embed list page,
  and a "Whole workspace — everyone's public threads" option in the code
  generator's Which-threads picker. Docs updated.

## [0.13.90] — 2026-07-03 — Thread 3.23.0: embed code generator

### Added
- **Embed code generator** at the bottom of Settings → Website embeds:
  choose what to embed (thread list / one thread / enrol button), which
  thread (a real picker of your threads — team threads automatically get
  the team's public slug), which sections (cover, intention, agenda, price,
  enrol), the language (automatic = the thread's own, or fixed), and the
  button text for the popup variant. The copy-paste code builds itself —
  script tag + snippet, each with a Copy button. Unlisted threads get an
  honest note (embed works by direct link, won't appear in list embeds).

## [0.13.89] — 2026-07-03 — Flow 1.10.0: shared dialog component + bottom-bar contract

### Changed
- **Flow gets the shared Dialog/Button primitives** (ported from The
  Thread's, the pinned Fibre SPoT) — `apps/flow/components/ui/`. Migrated:
  New flow (footer Cancel · Create via form id), Add contact to flow, and
  the run popup's confirm-move and manual-move/revert sub-dialogs. The
  lifecycle menu's `window.confirm`/`window.alert` calls are gone —
  close/archive/delete now use the proper ConfirmDialog (delete styled
  destructive), errors render inline instead of browser alerts.
- Deliberately left custom: the run viewer itself and the visual flow
  canvas — they are interactive workspaces (React Flow graph, view
  toggles), not dialogs.

## [0.13.88] — 2026-07-03 — Thread 3.22.1: certificate reissue

### Added
- **Reissue certificate** — the explicit exception to snapshot immutability
  (migration `20260703100000`). The refresh button next to the Certificate
  chip on the Enrolments page regenerates the snapshot from the CURRENT
  template design after a confirm; the certificate number, recipient and
  original issue date stay unchanged, so shared verification and LinkedIn
  links keep working. `reissued_at` records the correction. No email is
  sent — resending stays the separate explicit action.

## [0.13.87] — 2026-07-03 — Thread 3.22.0: paid enrolments, approval + completion, /my code sign-in, dialog-bar rollout

### Added — payments (Phase 4 core)
- **Stripe Checkout for paid enrolments** — a paid ticket (after any
  discount code) now creates the enrolment as `payment_status='pending'`,
  opens a Checkout session against the payout account (personal → the
  organiser's connected account with Meet's as fallback; workspace →
  thread settings), with the plan-aware platform fee (2% capped €2 on
  Free, waived Pro/Org via `workspace_meet_fee`) and Stripe's
  auto-generated legal invoice (EU VAT), then redirects — escaping the
  iframe when enrolling inside a website embed. Success/cancel return to
  the public page (`?paid=…`) with honest localized messages.
- **Webhook** `POST /api/v1/thread/stripe-webhook` (signature-verified;
  `STRIPE_THREAD_WEBHOOK_SECRET`, falls back to the Meet secret) flips the
  enrolment to paid, writes the **revenue-split ledger row**
  (`thread_payout`: gross = platform fee + organiser share by the stored
  default cut + org share; actual transfers land with the payouts phase),
  and runs the confirmation side-effects. Expired sessions → failed.
- **Invoice path** — threads accepting `invoice` offer a Pay online /
  Receive an invoice toggle on the enrol card; invoice enrolments wait as
  pending with a clear message, and the organiser's **Mark paid** runs the
  same confirmation side-effects as Stripe.

### Added — approval + completion (#14)
- **Approval flow** — approval-required threads park enrolments at
  `invited`: participant gets a localized "request received" email (×5);
  the Registrations popup shows **Approve / Decline** chips. Approve →
  enrolled + confirmation + on_enrolment AND on_approval messages;
  decline → dropped (no email, deliberately).
- **Completion flow** — **Complete** per row and **Mark completed (n)** in
  the Enrolments bulk bar: status completed (100%), fires on_completion
  messages, and **auto-issues the certificate** when the thread awards one
  (the certificate email stays a separate explicit step).

### Added — participant side
- **/my sign-in with an emailed 8-digit code** next to Google (#13) —
  account created on first sign-in, i18n ×5.
- **/my cohort directory** (#16) — threads sharing participants with
  participants now show consent-gated fellow-participant chips on the
  personal page.

### Changed
- **Dialog bottom bar rolled out to web** (#17) — 14 web dialogs moved
  their Save into the footer (Cancel · Save right, destructive left);
  Meet's dialogs already complied; Flow has no shared dialog component yet
  (noted for later).
- **Embeds** (#15) — `data-lang` on all embed kinds (falls back to the
  thread's language); embedded lists open popup-interaction threads as the
  Luma-style overlay on the host page (new `thread-embed:open-enrol`
  postMessage) instead of linking out; snippets page documents both.

### Ops note
- Register the webhook endpoint in the Stripe dashboard:
  `https://thefibre-api.fly.dev/api/v1/thread/stripe-webhook`
  (event: `checkout.session.completed`, `checkout.session.expired`) and
  set `STRIPE_THREAD_WEBHOOK_SECRET` on Fly (or reuse the shared secret).

## [0.13.86] — 2026-07-02 — Thread 3.21.0: the message scheduler — sequences actually send

### Added
- **Message scheduler (Phase 6)** — fixed-date and relative messages
  ("7d after start · 09:00", "2d before end", "3d after workshop X") now
  actually send. An in-process interval on the warm Fly machine runs every
  5 minutes: finds published messages whose moment arrived (relative times
  resolved in the thread's timezone, engagement anchors supported), fans out
  to everyone enrolled (dropped excluded), renders the same per-type email
  as the on-enrolment flow with {name}/{thread}/{organiser}/{date} tokens,
  and dedup-logs every send in `thread_message_send` — restarts and
  overlapping runs can never double-send. A 72-hour lookback stops a
  (re)starting scheduler from blasting months-old messages: anything older
  stays visible on the timeline but is never emailed late. Drafts and
  archived threads never send; completed threads still can (journey tails
  outlive the closing date). Manual trigger for ops:
  `POST /api/v1/thread/scheduler/run`.

## [0.13.85] — 2026-07-02 — Thread 3.20.0: bulk certificates, LinkedIn share, compact choosers

### Added
- **Select participants → certificates in bulk** (v3 parity) — the
  Enrolments list gains per-row checkboxes + select-all and an action bar:
  Issue certificates (for the selection), Download for print (one combined
  print view at `/certificate/print?numbers=…` — auto-opens the print
  dialog, save as PDF), and Send by email (each participant gets their
  certificate link; explicit, never automatic —
  `POST /enrolments/:id/send-certificate`).
- **LinkedIn on the public certificate page** — "Add to LinkedIn profile"
  (pre-filled certification entry: name, organisation, issue date, URL,
  certificate id), Share, and Print/PDF buttons under the certificate.
- **New thread from a template** — hovering "New thread" reveals the saved
  templates; picking one opens its Use dialog (`/templates/threads?use=id`),
  clicking the button starts from scratch.

### Changed
- **Kind and Scope are compact toggles** in the new-thread form — the
  explanation of the active choice sits underneath; the big cards are gone.
- **Applied discount codes show the old price struck through** next to the
  new price on the public enrol card.
- **Certificate builder properties bar has a fixed height** — selecting an
  element no longer shifts the canvas; overflow scrolls horizontally.
- **Email sender options lose "The organiser's name"** (existing workspaces
  on it fall back to the workspace name) and **"Default organiser share"
  left Emails & defaults** — it's a payment decision, it returns with the
  payments settings.

## [0.13.84] — 2026-07-02 — Thread 3.19.0: timeline polish, editable template content, cert-template archiving

### Fixed
- **Rail dots no longer sit on top of the date badges** — the badge stacks
  above the cards' type dots (z-10) and gets a subtle shadow.
- **On-completion messages moved to the end of the timeline** — they fire at
  the end, so they render at the end; enrolment/approval messages keep
  opening it.
- **Typing in rich-text fields (Description/Body) is reliable again** — the
  editor's initial HTML is now written imperatively on mount instead of via
  dangerouslySetInnerHTML, so no re-render can reset the caret (typed text
  came out reversed).

### Changed
- **Messages default to NOT showing on the public agenda** — activities
  still default to visible; messages are the participant journey.
- **Thread templates are editable in full** — a template is a complete
  duplicate (texts, message bodies, triggers — capture and instantiate were
  already full-fidelity). The template editor now opens each engagement in
  a sub-dialog with the same content fields as the live editor: title,
  rich-text description, per-type message content (questions, assignments,
  body, links), day/time/duration. Changes persist with the template's Save.
- **Certificate templates archive instead of delete when in use**
  (migration `20260702260000`): deleting a template a thread points at
  returns "archive it instead"; the builder gains Archive/Restore, archived
  templates show dimmed with a Archived chip in the list, disappear from
  thread pickers, and issued certificates are untouched (they carry full
  snapshots).

## [0.13.83] — 2026-07-02 — Thread 3.18.0: account-aware enrolment, discount codes public, activity on /my

### Added
- **Register / sign in after enrolling** — the enrol endpoint checks whether
  the email already has a Fibre account (`auth_user_exists`, service-role
  only, migration `20260702250000`). The success and already-enrolled states
  now end with "Sign in to your personal page" (account exists) or "Create
  your account" (none — created on first sign-in, no separate signup), plus
  the note that one Fibre account covers threads, bookings and certificates
  across all apps. i18n ×5.
- **Discount codes on the public enrol form** — a "Discount code?" reveal
  under the ticket chooser, validated live via
  `POST /public/validate-coupon` (active, not expired, early-bird window,
  usage limit, ticket scope — all server-side). An applied code updates the
  shown price and button; a code that brings the price to €0 (e.g. type
  "free") enrols immediately — `coupon_id` + final `amount_cents` land on
  the enrolment and `used_count` increments. Paid remainders still wait for
  the Stripe phase. Switching tickets clears the applied code (scope).
- **Recent activity on /my** — the personal page shows the participant's own
  activity trail (subject, app, date; type + subject only — the same data
  that crosses the wall, shown to the person it's about).
- **Styling (CSS) instructions in the interface** — Settings → Website
  embeds now documents how to style embeds: container CSS (iframes — your
  site styles the frame), the `.thread-embed-wrap` snippet, and the
  "build natively, embed only the enrol card / popup trigger" pattern.

## [0.13.82] — 2026-07-02 — Thread 3.17.1: honest "already enrolled" state

### Fixed
- **Enrolling twice with the same email now says so** — the API already
  detected the duplicate (same person, same thread → no second enrolment, no
  second email), but the form showed the standard "confirmation is on its
  way" anyway. The form now reads the `already_enrolled` flag and shows
  "You're already enrolled with this email address" plus an "Open your
  personal page" button to `/my` (new tab — embeds must not open the portal
  inside the iframe). i18n ×5. Person matching stays by email: no duplicate
  contacts, and the personal page picks up all enrolments for the address
  the moment they sign in.

## [0.13.81] — 2026-07-02 — Thread 3.17.0: ticket chooser on the public enrol form

### Added
- **Ticket selection at enrolment** — with multiple prices the enrol card
  shows a radio-card list (name, description, price, sold-out state; never a
  dropdown — the Fibre chooser pattern). The selection drives the header
  price and the button label ("Enrol — €250"). Works on the public thread
  page, the Luma popup and the website embeds — all three read the same
  detail payload, which now carries `tickets` (active, non-expired, with
  sold-out flags from `quantity_limit`).
- **Enrol accepts `ticket_id`** — validated against the thread (active, open,
  not sold out) and stored on the enrolment. Without one (older embeds) the
  cheapest open ticket is assumed. Free tickets enrol directly; paid tickets
  still return "paid enrolment is not available yet" until the Stripe phase,
  which now has the chosen ticket to charge for.

## [0.13.80] — 2026-07-02 — Thread 3.16.2: one bottom bar in thread settings

### Changed
- **Save moved to the dialog footer** in thread settings — the Fibre dialog
  contract: Delete · Duplicate · Save as template on the left, Cancel · Save
  on the right. No more inline Save buttons floating inside the tabs. The
  footer Save submits the active tab's form by id (`thread-{tab}-form`);
  Basics, Registration, Certificate and Pricing (payout) all save-and-close
  through it. Pricing uses a hidden sibling form — its ticket/coupon popups
  carry their own forms and nesting would break submit semantics; their
  buttons keep their own popup bottom bars, as before.

## [0.13.79] — 2026-07-02 — Thread 3.16.1: team threads open under the team's public URL

### Fixed
- **"Open public page" 404'd for team threads** — the timeline header built
  the URL with the organiser's personal slug, but since the team-leak fix
  (3.16.0) team threads only resolve under the team's slug. The timeline
  link, the embed-listing URLs, and the new-thread URL preview now all use
  the team slug when the thread belongs to a team.

## [0.13.78] — 2026-07-02 — Thread 3.16.0: templates, truthful pricing, participant sharing

### Added
- **Thread templates end-to-end** — "Save as template" in the thread settings
  gear captures the whole design (engagements, messages, triggers) with
  relative timing; `/templates/threads` lists them with edit (name + sharing:
  personal / team / workspace), delete, and "Use template" which rebases every
  date onto the new start. Templates hub card un-stubbed.
- **Registrations popup** — the registrations icon on the timeline opens
  everyone enrolled for *this* thread (status, payment, certificate badges)
  without leaving the editor; links to the full enrolments page.
- **Participant sharing** — Registration tab gains "share publicly" (Who's
  coming on the public page) and "share with participants" toggles; names show
  only for enrollees who opted into the cohort directory (consent-gated,
  brief §9). Migration `20260702240000` + enrol-form opt-in checkbox, i18n ×5.
- **Payment methods** on threads (`stripe` / `invoice`, migration
  `20260702230000`) — stored now; the invoice flow ports from Meet with the
  payments phase.
- **Website embeds discoverable** — Settings → Website embeds shows the four
  copy-paste snippets (script, list, single thread, enrol popup).

### Fixed
- **Public price now reads tickets** — a thread with a €250 ticket said "Free"
  on the public page because the card read the legacy `price_cents`. The
  organiser page, thread page, embed listing and the enrol guard now derive
  the price from the cheapest active, non-expired ticket (fallback:
  `price_cents`). Paid threads are blocked from free enrolment on the same
  derived price; a genuinely free ticket keeps the free path open.
- **User-menu Settings/Profile were dead buttons** in Thread — they never had
  a link. Now: Profile → `/settings/profile`, Settings → `/settings`; "Take a
  tour" visibly disabled until a tour exists. Flow's menu pointed at settings
  pages Flow doesn't have — both entries now go to the platform settings.
- **Team threads no longer leak** onto the organiser's personal public page —
  organiser-kind public queries filter `team_id IS NULL` (listing, detail,
  enrol).

## [0.13.77] — 2026-07-02 — Thread 3.15.0: certificate issuance + public certificate page

Certificates close the loop from designer to artefact:

- **Issue** — per-enrolment "Issue certificate" on the Enrolments page
  (threads with certificates enabled), plus **"Issue to completed"** bulk
  when filtered to a thread. Numbers `THR-YYYY-XXXXX` (unambiguous
  alphabet, collision-checked); the **template + resolved values are
  snapshotted** at issue time — later edits never change an issued
  certificate. One per enrolment; re-issuing 409s. The recipient gets a
  branded email with their link + number.
- **Public page** `/certificate/{number}` — anyone with the number can
  verify: the snapshot renders with the builder's exact %-element model,
  scaled to fit, with a **Print / Save as PDF** button (A4/Letter
  `@page` CSS, backgrounds preserved — the print-quality-HTML decision
  from day one). `?print=1` auto-opens the dialog.
- Issued certificates show as green chips on enrolment rows, linking to
  the public page.
- Auto-issue on completion connects when the completion flow (#14) lands.

Implements [`docs/platform-spot-members-profile.md`](docs/platform-spot-members-profile.md)
(migration `20260702220000_user_profile.sql`, applied + backfilled):

- **thefibre.app Settings → Members is canonical** (admin-gated): member
  list with workspace-role, internal/external relationship and one
  checkbox per activated app; invite by email (pending user + person +
  app grants + branded invite — Meet's mechanics generalised). API:
  `GET/POST /api/v1/members`, `PATCH /api/v1/members/:userId`.
- **Public profile at platform level**: new `user_profile` (display
  name, bio, photo, timezone), backfilled from Meet ← Thread. Edited on
  thefibre.app Settings ("shared across the Fibre apps"); API
  `GET/PATCH /api/v1/profile`. **Thread inherits** — organiser fields
  become overrides, `/thread/me` merges the platform profile.
- **Apps show, the platform manages**: Thread's Internal team is
  read-only with a "Manage in The Fibre" link; Meet keeps its page one
  release with a transition banner.
- **Interface fixes**: user-menu dropdown gained `z-50` in all four apps
  (timeline cards painted over it); Thread sidebar's Certificates became
  **Templates** — a hub for certificate templates (live) and thread
  templates (next).

## [0.13.75] — 2026-07-02 — Thread 3.14.0: destructive-action SPoT, team URLs, shared payments

(Migrations `…200000_thread_coupon_ticket_scope` +
`…210000_thread_email_from_mode`, applied.)

- **Thread settings footer = engagement parity**: Delete · Duplicate ·
  Close. **Duplicate** clones the thread + engagements as an unlisted
  draft. **Delete** uses the new app-wide `DangerConfirmDialog` — type
  DELETE to arm the button — now the single point of truth for every
  hard delete (thread + engagement switched to it).
- **Popups close after save**; closing with unsaved changes warns first
  (settings + engagement dialogs).
- **Public URLs group by owner**: team threads live under the **team's
  slug** (`thread.thefibre.app/{team}/{thread}`), personal under the
  organiser's. One root namespace, organiser-first resolution; public
  pages, enrolment, embeds and email links all follow.
- **Payments settings shared with Meet** (SPoT): Thread reads your Meet
  Stripe account as the personal fallback; the Payments card links to
  Meet's settings. Connections card likewise.
- **Email sender selectable**: workspace name / the thread's team name /
  the organiser's name / custom fill-in (Emails & defaults).
- **Discount codes**: default EARLYBIRD 10% auto-created when a thread
  goes Paid; codes can apply to **all tickets or one specific ticket**.
- **Registrations at thread level** — header icon opens Enrolments
  filtered to that thread. **Contacts rows open a popup** (threads,
  status, link to the Fibre profile).

(Migration `20260702190000_thread_event_anchor_and_interaction.sql`, applied.)

- **Messages can anchor to an event**: "relative" triggers now offer the
  thread's activities as anchors ("2d before *SDL — vertrouwen* · 09:00"),
  next to thread start/end. The timeline computes their spot from the
  anchor's date; labels show the event title.
- **Timeline cards float** — subtle layered shadow (and Flow's card
  shadow softened to match: less bulk, same lift).
- **Threads overview filters**: status chips All · Active · Drafts ·
  Past, next to the team chips.
- **Thread page or enrol popup**: a Basics setting decides what an
  overview click does — the full public page, or a **Luma-style popup**
  with cover, info and direct enrolment (live on the organiser page;
  embed lists follow the same setting via the thread detail).
- **Pricing keeps the Free/Paid toggle** — Paid reveals the ticket +
  discount-code lists; Free hides them. **Quantity is a plain number
  field** now, not a dropdown.

- **Personal page is login-based now** (Sjoerd: no email-token links).
  `/my` asks participants to **sign in** — Google SSO today, the
  platform's emailed login code as the passwordless path, more providers
  later. Visitor sessions skip the workspace access-check (participants
  aren't members); the API verifies their Supabase JWT directly and
  matches persons by email across workspaces. The token portal (`/p/…`)
  is removed; confirmation emails link to `/my`.
- **Payout**: exactly two options — Workspace account / My personal
  account — no Auto. Options **grey out when no Stripe account is
  connected**; the default pre-selects per the rule (team thread →
  workspace; personal thread → personal when connected).
- **Engagement dialog**: the Where block (in person / virtual + fields)
  moved to the **first column**; the Personal-meeting-room provider
  option greys out when not configured in Meet.
- **Thread image**: Basics gains a cover upload (thread-assets bucket,
  preview, replace/remove) — shown on the public page and embeds.

(Migrations `20260702170000_thread_tickets.sql` +
`20260702180000_thread_policy_consent.sql`, applied.)

- **Pricing, v3 model**: the Pricing tab is now a **list of tickets**
  (name, price or Free, quantity limit, availability window, active) and
  a **list of discount codes** (mono code, percentage/amount/free,
  usage n/limit, early-bird deadline, expiry) — each row opens a popup
  editor with Delete in the footer. Payout selector stays. Checkout +
  redemption arrive with the payments phase.
- **Privacy-policy consent at enrolment**: required (never pre-ticked)
  checkbox linking the policy, in all five languages; the accepted
  **versioned policy list** lives in `apps/thread/lib/policies.ts` and
  the accepted version + timestamp are stored on the enrolment.
- **The personal page** — email-based visitor identity: the
  confirmation email's button now opens `/p/{signed-token}` — the
  participant's own page listing everything they're enrolled in across
  threads, localized, no account or password (the emailed link is the
  credential; HMAC-signed, 180-day, refreshed by every new email).
  Groundwork for the Fibre-wide visitor identity.
- **Engagement dialog polish**: title spans the full width, Type/Status
  stacked, right column narrower.
- **Per-thread organisation dropped** (Sjoerd: an organiser practically
  never organises for another org — teams cover intra-org, another
  workspace covers the rest). UI + plumbing removed; the column stays
  dormant.

Four asks in one release (migrations
`20260702150000_thread_payment_destination.sql` +
`20260702160000_thread_language.sql`, applied; `thread-assets` storage
bucket created):

- **Certificate builder**: real background + element **image upload**
  (drop-zone → public `thread-assets` bucket, thumbnail preview,
  replace/remove, URL fallback); element **properties bar moved above the
  canvas**; Share dialog gains **"Everyone in the workspace"** vs "Only
  selected people and teams".
- **Webflow embeds**: paste `<script src="https://thread.thefibre.app/embed.js">`
  plus `data-thread-embed` divs — `list` (overview of an organiser, team
  or org), `thread` with chosen elements (`cover,intention,agenda,price,enrol`),
  `enrol` opening the subscription form in a popup overlay. Auto-resizing
  iframes, origin-checked postMessage, framework-free, <200 lines. Bare
  `/embed/*` pages reuse the real enrol flow. New public endpoint
  `GET /thread/public/embed/threads?organiser=|team=|org=`.
- **Language system**: every public string (organiser/thread pages, enrol
  card, embeds, participant emails) lives in a **typed catalog**
  (`apps/thread/lib/i18n.ts`) translated to **English, Dutch, Spanish,
  Portuguese, German** — a key missing a translation fails typecheck,
  which is how the list stays complete. Threads carry a `language`
  (settings → Basics, default English); the enrolment confirmation email
  localises subject, body and date formatting.
- **Payout selector** (Pricing tab): Workspace / Personal / Auto —
  auto = workspace for team/workspace-shared threads, personal (when
  connected) for personal threads. Stored on the thread; Phase 4
  checkout reads it.

Nine interface improvements in one slice
(migration `20260702140000_thread_engagement_location_provider.sql`, applied):

- **Engagement dialog, two columns**: left = what it is (title, rich-text
  description, message content), right = when + where (type, status,
  times, location). Order follows the work, not the schema.
- **One date-time popover — the Fibre single point of truth**: calendar
  left, scrollable 15-minute time column right, one trigger showing
  "Wed 2 Jul 2026 · 09:00". Synced to web + meet copies.
- **Quick time edit**: click the time on any timeline card → a small
  popup to change just the schedule.
- **Delete moved off the timeline** into the dialog footer, joined by
  **Duplicate**; Save/Cancel on the right, destructive actions left.
- **Thread settings: tabbed** (Basics / Pricing / Registration /
  Certificate — more coming), behind a proper gear icon. **Pricing tab**
  new: Free/Paid 2-card chooser + price + currency (checkout arrives with
  the payments phase).
- **Rich text** (bold, italic, lists, links) for descriptions and message
  bodies; emails strip to clean plain text; the public agenda renders it.
- **Status = toggle** (Draft | Published segments), no more select.
- **Meeting link = provider dropdown** (Google Meet / Zoom / Teams /
  Personal room / Custom — Meet's vocabulary). Personal room reads your
  Meet profile setting: connection settings are shared across the family.
- **Location = In person / Virtual toggle** with consequential fields:
  in person → description + map link; virtual → provider + meeting link.

The Thread grows the same workspace surfaces Meet has:

- **Threads overview filter** — chips above the list: All · Personal ·
  one per team; team name rides along in each row's meta.
- **Teams** — create teams right in Thread (platform `team`, creator
  becomes lead), team detail with member management (add from workspace
  members with lead/member role, remove with confirm). Same primitive
  Meet and Flow use.
- **Contacts** — everyone who has enrolled in your threads, with their
  thread chips and a link out to their Fibre profile.
- **Internal team** — workspace members with their Thread access;
  one-click "Grant access" gives the-thread app membership.
- **Settings** becomes a real hub: Profile (organiser slug, display
  name, bio, photo, timezone → your public page) and Emails & defaults
  (sender name, footer note, default organiser revenue share). Payments
  card waits for the payments phase.
- Sidebar gains a People section: Contacts / Teams / Internal team.

Two big pieces (migration `20260702120000_thread_templates_and_scoping.sql`,
applied):

### Certificate template builder — v3's designer, ported

- **/certificates** — template list (scope chips, page size, updated) +
  New template (name + Personal/Team/Workspace scope).
- **/certificates/[id]** — the builder: white page canvas with aspect-true
  A4/Letter portrait/landscape, background image URL, %-positioned
  elements (field tokens · text with `{token}` substitution · image ·
  line), click-select with yellow outline, drag to move, double-click to
  edit text inline, properties strip (font family/size, width, bold /
  italic, align, colour, opacity, z-order), 2s debounced auto-save +
  manual Save, delete with confirm. Nine field tokens with sample-value
  preview (recipient, thread title, org, dates, certificate number,
  criteria, issued by).
- **Template scoping**: personal / team / workspace; workspace templates
  can be granted to selected members and teams via a Share dialog
  (`thread_template_share`; no grants = whole workspace).
- **Thread settings** gains the v3-style Certificate section: enable +
  pick from the template list + criteria field.
- Schema also lands `thread_template` (thread templates, next release).

### Dates move together (v3's shiftAllEngagementDates)

Change the thread's start date and **every fixed engagement date shifts
by the same number of days** — start/end times, message send moments,
and the thread's end date (unless the same save explicitly changed it).
Relative and lifecycle triggers follow automatically since they're
computed from the thread window.

Threads join the Fibre categories
(migration `20260702110000_thread_scope_and_roles.sql`, applied):

- **Personal / Team scope** on New thread (the 2-card chooser, platform
  `team` — in-family apps use platform tables natively). Settings can
  reassign the team and link an **organisation** as the thread's public
  face. Both show as chips under the timeline header.
- **Hosts & facilitators**: invite workspace members to a thread via the
  new people button in the header — pick a member, pick a role (hosts
  edit, facilitators run sessions), done. Invited users get a
  thread_organiser profile auto-provisioned. Roles renamed
  co_organiser → host.
- API: `GET /thread/teams`, `GET /thread/workspace-members`,
  `POST/DELETE /thread/threads/:id/members`.

The timeline was too monochrome. Per-type colour now carries through:
tinted icon chips on every card (sky event / emerald conversation /
amber workshop / blue message / violet reflection / teal practice /
slate document / pink inspiration), matching coloured type labels,
bigger dots on the rail. Date badges get the Thread brand-yellow month
bar (v3's accent); the add-engagement button glows yellow on hover.

## [0.13.65] — 2026-07-02 — Thread 3.4.0: engagement triggers + date-window rule

Two structural rules from Sjoerd land together
(migration `20260702100000_thread_engagement_triggers.sql`, applied):

- **Activities stay inside the thread window.** Event / conversation /
  workshop dates must fall between the thread's start and end — enforced
  in the API on create + update, and in the editor via the date picker's
  min/max (out-of-range days grey out).
- **Messages get a "When to send" trigger** instead of only a fixed date:
  *fixed date* · *relative to the thread dates* (N days before/after
  start/end, at a chosen time — curated dropdowns) · *when someone
  enrols* · *when their enrolment is approved* (only offered when the
  thread requires approval) · *when they complete the thread*.
- **On-enrolment messages are live now**: the public enrol flow sends
  every published on-enrolment message to the new participant
  immediately — personalisation tokens substituted, branded shell,
  deduped per (engagement, person) via `thread_message_send`
  insert-first. Approval/completion delivery hooks in when those flows
  land; fixed + relative sends arrive with the Phase-6 scheduler.
- **Timeline placement understands triggers**: lifecycle-triggered
  messages sit in an "Auto" group at the top; relative messages get a
  computed date from the thread window and sort chronologically; cards
  show trigger labels ("On enrolment", "3d before start · 09:00").

Editing popups grow into thethread-v3's roomy shape (decision: big
centered modal over a side drawer). Dialog gains an `xl` size —
`max-w-3xl`, generous padding — and a footer slot that sits outside the
scroll area, so Save/Cancel behave as a sticky save bar. The engagement
editor and thread-settings dialog both move to it: two-column field
grids, larger spacing, error message inline in the save bar.

## [0.13.63] — 2026-07-02 — Thread 3.3.0: v3-style timeline editor (no tabs)

The thread editor drops its tabs for thethread-v3's layout (read from the
v3 source, restyled in Fibre tokens): the thread is the **main item** up
top, the engagements flow **immediately under it** as a vertical timeline.

- **Header row** — back, start-date chip, **inline-editable title** (blur
  or Enter saves), status pill (Draft / Published / Completed / Archived —
  a disguised select), settings gear, open-public-page link. Intention
  line beneath.
- **Timeline** — left rail with a vertical line, **date badges** (MON/DD)
  per day group, same-day cards visually attached (v3's rounded-t/-b
  grouping), **coloured type dots** on the line per engagement type.
  Cards show type, title, time (activities) or "Sends HH:MM" (messages),
  location/online badges, hover-reveal delete. Undated items group under
  a dashed "No date" badge.
- **Add** — dashed button at the timeline's end opens a type menu
  (Activities / Messages with their dots); picking one opens the editor
  dialog with the type preselected.
- **Thread settings** (name/slug, intention, dates, timezone, public
  listing + registration questions) move behind the gear into a dialog.
  Status was removed from that form — the header pill owns it, so saving
  settings can no longer reset a published thread to draft.

## [0.13.62] — 2026-07-02 — Fibre-styled date fields everywhere (Meet 2.1.5 · Thread 3.2.1)

Native `<input type="date">` / `datetime-local` (and their cramped,
unstylable browser popovers) replaced with a shared `DateField` /
`DateTimeField` component in house style — Sjoerd: "higher UX quality,
more spacious, bigger fonts."

- **Spacious trigger** (44px tall, 15px type, formatted "Wed 2 Jul 2026",
  calendar icon, inline clear ×) + **custom calendar popover**: 40px day
  cells, month nav, today ring, selected fill, min/max disabling, Today +
  Clear actions. Fixed-position so it never clips inside dialogs.
- **Times are curated dropdowns** (hours + quarter-hour minutes) per the
  house rule — no free-form time typing.
- Zero new dependencies; hidden inputs keep every existing FormData form
  working unchanged. Supports controlled mode for dynamic lists.
- Converted: Thread (new/edit thread dates, engagement starts/ends/send-at),
  Web (programme dates, org member started, org relationship touchpoints,
  contact first-contact), Meet (one-off date & time, poll candidate slots).
  Flow has no date inputs today; the component is ready to copy in when it
  does.

Theme + sidebar preferences were deliberately host-only per app (a
documented earlier decision). Sjoerd reversed it: one user = one
preference, everywhere. `savePref` now writes the cookies with
`domain = NEXT_PUBLIC_COOKIE_DOMAIN` (`.thefibre.app`) — same mechanism
as SSO — and evicts the legacy host-only cookie so it can't shadow the
shared one. Applied to all four apps.

Bonus: The Thread's user menu still wrote `document.cookie` directly
(host-only AND capped to 7 days by Safari ITP — the very problem the
server action solves). Now uses the shared `savePref` action like the
other apps.

## [0.13.60] — 2026-07-01 — fix: "Body is unusable" in every app's API client

The error path of `apiFetch`/`publicFetch` read the response body twice
(`res.json()` then `res.text()` in the catch) — when an API error payload
wasn't valid JSON, the second read threw `TypeError: Body is unusable`,
masking the real error. Now the body is read once as text and JSON-parsed
best-effort. Fixed in all six copies (web, meet, thread, flow ×
api.ts/public-api.ts). Spotted in thread.thefibre.app production logs.

Also today, production got un-wedged: the API's "verified" Thread deploy
turned out to be a false positive (a 401 from the auth middleware proves
nothing about routes) — the real Fly release was still June 10. Redeployed;
`/api/v1/thread/public/*` now serves real payloads and junk slugs 404.

## [0.13.59] — 2026-07-01 — Apps catalog catches up with Flow; thread Vercel project

- **Fibre web knew nothing about Fibre Flow** — `apps/web/lib/apps.ts`
  (AppSlug, APPS, APP_ORDER) and Settings → Apps (`INSTALLABLE` +
  descriptions) still listed only Meet / Thread / Sales / Learn. Flow now
  appears as an Active app; Sales stays "Building", Learn "Planned".
- **`thefibre-thread` Vercel project created** (it never existed — the
  build-plan note that the skeleton was live turned out to be stale).
  Root `apps/thread`, linked to the GitHub repo, fra1, all 7 env vars
  copied from `thefibre-meet` (incl. `NEXT_PUBLIC_COOKIE_DOMAIN` per
  deploy.md), domain `thread.thefibre.app` attached and verified. First
  deploy rides this commit.

### The platform loop closes — first delivery app writing real enrolments

Public front end + free enrolment, end-to-end tested against the real API
(person → consent → enrolment → activity → email; idempotent retry
verified; test data cleaned).

- **Public pages** (no auth, service-role reads like Meet):
  `/{organiserSlug}` — organiser profile + listed active threads;
  `/{organiserSlug}/{threadSlug}` — cover, intention, capacity + certificate
  badges, **agenda** (published activities only; meeting links hidden until
  enrolment, shown as an "Online" badge), sticky enrol card.
- **Enrolment flow** (`POST /thread/public/enrol`): platform person
  create-or-match by email → consent records (`transactional_email`/contract
  required, `marketing_email`/consent only on opt-in, per brief §9) →
  platform `enrolment` (status enrolled) → `thread_enrolment` companion →
  `event_registered` activity (type + subject only — the wall holds) →
  branded confirmation email. Idempotent via client `request_id`; duplicate
  signups collapse; capacity enforced; paid threads 409 until Phase 4.
- **Registration tab** in the thread editor — custom enrolment questions
  (short / long / choice / checkbox, required flag); answers stored on
  `thread_enrolment.answers`, never on the platform.
- **Enrolments page** in-app: everyone across your threads with platform
  status + payment state.
- `shell()` email template exported from Meet's module; Thread templates
  share the same visual family (`thread-templates.ts`).

### Engagements — the thread timeline

The thread editor grows tabs (Meet's pattern: all tabs stay in the DOM).
**Basics** is the existing form; **Engagements** is new:

- **Timeline** — engagements ordered by position, one card each: type icon,
  title, status chip, when (start time for activities, "Sends …" for
  messages), online/location badges. Move up/down, edit, delete
  (with confirm).
- **Add engagement** — dialog with the 8 types grouped in their two
  families (Activities: event / conversation / workshop · Messages:
  message / reflection / practice / document / inspiration). Activities
  carry starts/ends, location and a plain **meeting link** (Zoom / Teams /
  Meet — the v3 approach, no OAuth). Messages carry **Send at**
  (`scheduled_at`) plus type-specific content: reflection questions,
  practice assignments, document link + note, inspiration text,
  message body (with `{name}`/`{thread}`/`{organiser}`/`{date}` tokens
  for the Phase 6 sender).
- **Family lock respected** — editing offers only same-family types,
  mirroring the API rule.
- `lib/engagement-meta.ts` — single source for type labels, icons
  (Lucide), families and descriptions.

### The Thread rebuilt from scratch — Fibre-native, simpler than v3

The Thread starts over inside the monorepo: thethread-v3
(`~/Projects/thethread-v3`) is the functional reference, the Fibre design
system is the interface, and the platform is the core. Full design +
phase plan in [`docs/thread-rebuild-plan.md`](docs/thread-rebuild-plan.md).
Scope locked with Sjoerd: 8 features (typed engagements, paid enrolments +
coupons, certificate designer, Zoom/Teams links, multi-organiser,
per-organiser Stripe with v3's revenue split, public pages, email
sequences). Thread's user-facing version is now **v3.x**, decoupled from
the monorepo cadence — same rule as Meet's v2.x.

**Phase 1 in this release:**

- **Schema** — `20260701090000_thread_schema.sql`: `thread_organiser`
  (per-user, Stripe account + vendor cut), `thread_settings`
  (workspace-level Stripe + email branding), `thread_thread` (1:1 with a
  platform `program` row — a thread IS a programme), co-organiser join,
  `thread_engagement` (8 types in two families: activities event /
  conversation / workshop with `meeting_url`; messages reflection /
  practice / message / document / inspiration with `scheduled_at`),
  `thread_enrolment` (1:1 companion to platform `enrolment`),
  `thread_coupon`, `thread_certificate_template` + `thread_certificate`,
  `thread_message_send`, `thread_payout`. Meet's RLS pattern throughout.
- **API** — `apps/api/src/routes/thread.ts`: organiser auto-provision
  (`GET/PATCH /thread/me`), workspace settings, threads CRUD (creates and
  syncs the paired `program` row), engagements CRUD with the
  family-locked type rule. Reserved-slug validation extends Meet's shared
  list with Thread's route names. `/thread/public/*` +
  `/thread/stripe-webhook` pre-registered as public prefixes.
- **App** — `apps/thread` wakes up: Threads list, New thread
  (Event/Journey 2-card chooser + `NameAndSlugFields`), thread editor
  (Basics: name/slug, intention, dates, status, timezone, public
  listing). Sidebar nav: Threads / Enrolments / Certificates (stubs where
  phases are pending). Thread sidebar shows **v3.0.0**.

## [0.13.55] — 2026-05-30 — Fibre Flow v1.9.0

### Run popup: journey list view + per-step notes

Clicking a contact now opens a **List / Flow** toggle (List is the default):

- **List view** — the steps stacked vertically in builder order, non-current
  steps muted, the **current step as a thick card** with its gate tasks
  (tickable, and now re-openable) and a "Current" badge. Transition labels
  ride the connectors between steps. Every step has a **"Move here →"**
  action (same gated / revert confirm popups).
- **Per-step notes** — every step card carries a comment composer; notes show
  with author + date in soft amber. Stored in a new app-private
  `flow_run_note` table (content never crosses the data wall into activity).
- **Flow view** — the existing graph + token interaction, one click away.

Migration `20260530100000_flow_run_note.sql`; API: notes embedded in
`GET /flow/runs/:id`, new `POST /flow/runs/:id/notes`.

## [0.13.54] — 2026-05-29 — Fibre Flow v1.8.0

### Board restyled + columns follow the builder layout

- **Board columns match the card language**: each column is now a soft grey
  rounded panel (no hard borders) with a kind dot, a white count pill, dashed
  "No one here" empty slots, and white shadow-card contact cards with tinted
  avatar circles inside.
- **Column order = builder order.** Columns sort by the step's canvas position
  (left-to-right, then top-to-bottom) instead of creation order, so the board
  reads exactly like the flow in the Builder. Saving from the canvas now also
  persists steps in visual order, so reports follow the same reading.

## [0.13.53] — 2026-05-29 — Fibre Flow v1.7.2

### Lighter builder grid

Grid lines stepped down another notch (#eaeef4) so they read as a whisper
under the cards rather than a visible lattice.

## [0.13.52] — 2026-05-29 — Fibre Flow v1.7.1

### Loop-back transitions easier to draw

Backward transitions (e.g. `Nurture → First Contact`) were always supported by
the model and runtime — but drawing one required hitting exactly the right
handle pair. The builder now uses React Flow's **loose connection mode**: drag
from any handle to any handle and the edge connects, making loop-backs (and
everything else) much easier to draw. Self-connections (step → itself) are
blocked client-side to match the DB constraint.

## [0.13.51] — 2026-05-29 — Fibre Flow v1.7.0

### New step kind: Loop — closes a cycle back to the start

The briefing's "Waitlisted (loops back)" pattern, now first-class. A **Loop**
step (amber chip, ↻ icon, "Loop — back to start" in the Kind dropdown) bounces
the contact straight back to the flow's **Start** step the moment they enter
it: fresh entry tasks are materialised and the activity timeline logs
"Looped back to {start} via {loop step}". Works on gated transitions, manual
moves, and board drag-and-drop alike — no need to hand-draw a return edge.

- Migration `20260529230000_flow_step_loop_kind.sql` (relax `flow_step.kind`).
- API: both move paths redirect loop destinations to the entry step.
- Builder/run-popup/board pick up the amber loop styling.

## [0.13.50] — 2026-05-29 — Fibre Flow v1.6.0

### Board drag-and-drop, full-width flow page, builder polish

- **Drag contacts across the board.** Kanban cards are draggable: drop one on
  another column and the move popup opens with that step pre-selected — the
  same gated-confirm / manual-move (revert) logic as in the run popup. The
  target column highlights while dragging; the dragged card dims.
- **Flow detail page is full width.** Dropped the `max-w-4xl` cap so the board
  and builder use the whole screen (per the screenshot where the board was cut
  off at the container edge).
- **Builder canvas is much larger in-page** — grows with the viewport
  (`calc(100vh - 340px)`, min 560px) instead of a fixed 560px; full-screen
  toggle still available on top.
- **Lighter grid** lines (slate-200).
- **Kind icons on step cards** — the pill chip now carries an icon: ▶ Start,
  ○ Step, ✓-circle End (positive), ✗-circle End (negative).

## [0.13.49] — 2026-05-29 — Fibre Flow v1.5.0

### Full-screen builder

The builder toolbar gets a **maximise** button that expands the canvas to fill
the whole screen (fixed overlay) for plenty of room to lay out big flows —
**Esc** or the minimise button exits, and the view re-fits on toggle. Normal
(in-page) mode unchanged.

## [0.13.48] — 2026-05-29 — Fibre Flow v1.4.0

### Cool-grey canvas + soft floating cards (matching the design references)

Retuned Fibre Flow's theme to the clean-dashboard look from the shared
references:
- **Background** shifts from warm cream to a **cool light-grey** (`#eef1f6`);
  ink/line tokens move to the **slate** family — cooler, crisper overall.
- **Cards float** on the grey with a **soft, diffuse shadow** (new
  `.shadow-card` / `.shadow-card-hover` utilities) instead of a tight
  `shadow-sm` — pure-white cards lift off the canvas the way the references do.
- Applied across Home, Flows, board, Tasks, Reports, Contacts, builder cards,
  and the run popup. Flow has its own theme tokens, so Meet / The Fibre are
  untouched.

## [0.13.47] — 2026-05-29 — Fibre Flow v1.3.3

### Builder + run-popup cards match the clean-dashboard style

The canvas step cards were still the odd ones out — whole-card colour tint +
heavy border. Reworked to match everything else: **white cards** with a soft
`ring-1 ring-black/5` + shadow (lifting on hover/select), with the step kind
shown as a **tinted pill chip** (Entry / Step / ✓ End / ✗ End) instead of
colouring the whole card. Run-popup step cards likewise white with a small
coloured kind dot; drop-target highlights now use a dashed outline.

## [0.13.46] — 2026-05-29 — Fibre Flow v1.3.2

### Consistent page headers across Flow

Unified page chrome so every Flow page matches Home: same large semibold
heading (`text-[28px]`), same top spacing (`py-10`), same subtitle treatment —
Flows, the flow detail, Tasks, and Contacts were still on the older smaller
medium-weight headers.

## [0.13.45] — 2026-05-29 — Fibre Flow v1.3.1

### Clean-dashboard card style rolled out across Flow

Propagated the Home design language to every surface: Flows library, kanban
board + list, Tasks (quick-add + rows), Reports stat cards, Contacts, and all
empty states + dialogs. Hard borders → soft `ring-1 ring-black/5` + `shadow-sm`
(hover `shadow-md`), `rounded-xl`/`rounded-2xl` corners, tinted rounded icon
chips + avatar circles, pill-shaped status/lifecycle badges, modals at
rounded-2xl. Consistent, modern, card-forward throughout.

## [0.13.44] — 2026-05-29 — Fibre Flow v1.3.0

### Home dashboard — clean-dashboard-card redesign (direction sample)

Reworked Home toward the "clean dashboard UI" references: pure-white cards
floating on the canvas with soft shadows + hairline rings (no hard borders),
rounded-2xl corners, tinted rounded icon chips, big bold stat numbers, and
pill badges. Three stat cards (Open tasks / In motion / Favourite flows) +
favourite-flow cards in a grid. Sample surface — to propagate across Flows,
board, and Tasks once the direction's confirmed.

## [0.13.43] — 2026-05-29 — Fibre Flow v1.2.1

### Builder grid → visible lines

The dot grid was too faint to read; switched to a proper **lines grid**
(slate-300 on a slate-50 canvas) so it's clearly visible. Grid toggle unchanged.

## [0.13.42] — 2026-05-29 — Fibre Flow v1.2.0

### More modern, card-like canvas + visible grid

- **Visible grid.** Builder canvas now sits on a soft slate background
  (`#f1f5f9`) with clearly-visible dots (slate-400, size 2.2) — the grid is
  actually there now. Toggle still works.
- **Floating cards.** Step cards are rounded-xl with a real drop shadow
  (`shadow-md`, lifting to `shadow-lg` on hover/selected) and a thinner 1px
  coloured border — they float on the tinted board instead of sitting flat.
- Same treatment in the run popup (tinted pane + card shadows) and the kanban
  board (cards gain a subtle shadow + hover lift).

## [0.13.41] — 2026-05-29 — Fibre Flow v1.1.1

### Removed the "Advanced — edit graph as JSON" escape hatch

The visual builder is now the single way to author flows — the JSON editor
disclosure (and `editor.tsx`) is gone. Cleaner Builder tab.

## [0.13.40] — 2026-05-29 — Fibre Flow v1.1.0

### Builder canvas — auto-arrange + grid/snap settings (Miro-like)

- **Auto-arrange** button: tidies cards into clean columns by longest-path depth
  from the entry step (rows stacked per column), then fits the view. One click
  to make a messy canvas orderly.
- **Canvas settings** popover (gear): toggle the **Grid** (dot background) on/off
  and **Magnetic (snap-to-grid)** on/off — drag freely or snap to the 24px grid.

## [0.13.39] — 2026-05-29 — Fibre Flow v1.0.2

### Modernised colour palette

Refreshed Flow's step/status colours to a cooler, more contemporary scheme,
applied consistently across the canvas, board, run popup, reports, and chips:
entry **blue → indigo**, end-negative **red → rose**, neutrals **→ slate**,
softer **-200** borders, and lighter (-50/-100) lifecycle + status chips.

## [0.13.38] — 2026-05-29 — Fibre Flow v1.0.1

### Builder: proactive publish-readiness hints

Instead of only learning what's missing when Publish fails, the builder now
shows an amber hint banner the moment the graph isn't publishable — "Mark a
step as an End (positive ✓ / negative ✗)", "Set one step's Kind to Entry", etc.
— with a pointer to click a card to open its panel and change its Kind. Makes
the entry/end requirements discoverable rather than a surprise on publish.

## [0.13.37] — 2026-05-29 — Fibre Flow v1.0.0 🎉

### Fibre Flow Phases I + J — lifecycle, reports, seed, v1.0

Fibre Flow reaches **v1.0** — a complete people-flow app: design flows on a
drag-and-drop canvas, put contacts in, move them through gated steps (manually
or auto-completed by cross-app activity), revert, and watch a kanban board /
report. Home + Tasks are the daily driver.

#### Lifecycle (Phase I)
- A flow-actions menu on the flow header: **Close to new contacts** (with an
  "N contacts still active" prompt), **Reopen**, **Archive** / **Restore**, and
  **Delete** (soft). Closed flows block new entries but let existing contacts
  finish.

#### Reports (Phase I)
- A **Reports** tab per flow: total / active / completed / withdrawn stat
  cards, plus a current-distribution bar chart across steps. (Honestly scoped:
  current snapshot, not a historical cohort funnel — that needs step-history
  tracking, noted inline.)

#### Seed (Phase J)
- `apps/api/scripts/seed-flow.mjs` — idempotent demo "Partnership Pipeline"
  flow (5 steps, gated transitions) with a few seeded people placed across
  steps and their gate tasks materialised. For fresh/demo workspaces.

#### Cutover (Phase J)
- Fibre Flow user-facing version → **v1.0.0**. Phases C–J all shipped.

## [0.13.36] — 2026-05-29 — Fibre Flow v0.12.0

### Fibre Flow Phase H — kanban board

The Flows tab now defaults to a **board**: one column per step (colour-accented
by kind), contact cards grouped by their current step, with avatar, name, and
time-at-step. A **Board / List** toggle switches views. Click any card → the
move popup. Withdrawn runs show faded in their column; runs on an old flow
version fall into an "Other" column.

- `apps/flow/app/(app)/flows/[id]/runs-panel.tsx` gains the `Board` view +
  toggle; the flow detail page passes the version's `steps` as columns.

## [0.13.35] — 2026-05-29 — Fibre Flow v0.11.0

### Fibre Flow Phase F — contact gate tasks auto-complete from activity

The cross-app magic: when any app writes an activity for a person (Meet logs a
`meeting_booked`, Thread a session attendance, …), Flow closes any open
**contact** gate task whose `contact_action_type` matches that activity type
for that contact — so the gate turns green with no manual logging.

- DB trigger `flow_autocomplete_on_activity` (AFTER INSERT on `public.activity`,
  SECURITY DEFINER). Matches on `(contact_id = person_id, contact_action_type =
  activity.type, workspace)`. Completes the task; does **not** auto-advance the
  run (a human still confirms the move — the gate just shows satisfied).
  Migration `20260529190000_flow_autocomplete_contact_tasks.sql`.
- Builder: the gate-task `contact_action_type` field now offers a datalist of
  known activity types (Meet booked / requested / attended, Thread attended,
  signed contract, …) with an inline explanation; default is `meeting_booked`.

### Note
- Auto-advancing the run when a gate is fully satisfied is a deliberate future
  step (which transition? branching?). For now the task completes and the
  gate reads green.

## [0.13.34] — 2026-05-29 — Fibre Flow v0.10.1

### Polish: revert direction in the manual-move popup

A backward (revert) move now reads as a revert: the popup title says "Revert
to …", and the action button shows a **left-pointing** arrow ("← Revert")
instead of "Move →". Forward/sideways manual moves keep "Move →". Direction is
derived from each step's depth from the entry.

## [0.13.33] — 2026-05-29 — Fibre Flow v0.10.0

### Fibre Flow Phase E — dashboard counts + actionable tasks

- **Home shows live counts** — the My-tasks card shows your open-task count, the
  Contacts card shows how many people are in motion (active runs).
- **Tasks are now actionable** — tick a task done (or reopen) right from the
  list, and **quick-add** a personal task (type + Enter). Gate/flow tasks still
  link out to their run.

### Added — API
- `POST /flow/tasks` — create a manual personal task.

### Added — frontend
- `apps/flow/app/(app)/tasks/tasks-list.tsx` (inline complete + quick-add);
  dashboard task/motion counts; `createManualTask` + `setTaskStatus` actions.

## [0.13.32] — 2026-05-29 — Fibre Flow v0.9.0

### Fibre Flow — favourites + tab reorder

- **Flows tab first.** On a flow's detail page the tabs are now **Flows** (the
  contacts moving through, the default) then **Builder** — you build when you
  set up, but day-to-day you want the live view first.
- **Favourite flows.** Tap the ☆ on any flow in the library to favourite it
  (per-user). Favourites pin to the top of **Home**, so your go-to flows are
  one click away.

### Added
- `flow_favorite` table (per-user, RLS-scoped). Migration
  `20260529160000_flow_favorite.sql`.
- API: `PUT`/`DELETE /flow/flows/:id/favorite`; `GET /flow/flows` now returns
  `is_favorite` and accepts `?favorite=1`.
- `apps/flow/app/(app)/flows/favorite-star.tsx`; Home dashboard "Favourite
  flows" section; `toggleFavorite` action.

## [0.13.31] — 2026-05-29 — Fibre Flow v0.8.0

### Fibre Flow — revert / manual move (move a contact to any step)

The run popup now lets you move a contact **anywhere**, not just forward:

- **Forward** steps with a defined transition stay **amber** and run the gate check (complete tasks inline / override).
- **Any other step** (backward to revert, or sideways) lights up **grey** as a **manual move** — a no-gate confirm popup that re-creates the destination step's tasks and logs the move as "(manual)" on the activity timeline.
- Works from completed/withdrawn runs too, so a contact parked on Won/Lost can be reverted to an earlier step (which reopens the run).

### Added — API
- `POST /flow/runs/:id/move` `{ step_key, reason? }` — gate-free reposition to any step in the run's version.

### Added — frontend
- `repositionRun` action; unified the run popup's confirm flow into gated-transition vs. manual-move paths.

## [0.13.30] — 2026-05-29 — Fibre Flow v0.7.0

### Fibre Flow — Builder / Flows tabs on the flow detail page

Split the flow detail page into two tabs:
- **Builder** — the visual canvas + the Advanced JSON disclosure (designing the flow).
- **Flows** — the contacts moving through it (the runs panel; tab shows a count).

Both panes stay mounted (CSS-hidden) so switching tabs never loses unsaved
canvas edits.

- `apps/flow/app/(app)/flows/[id]/flow-tabs.tsx`.

## [0.13.29] — 2026-05-29 — Fibre Flow v0.6.2

### Fix: contact still wouldn't move (click handlers swallowed by React Flow nodes)

The click-to-move handlers were on elements *inside* the React Flow node, which
the node wrapper swallows — so neither the token click nor the target click
fired (confirmed in Chrome too). Switched to React Flow's `onNodeClick` (the
same reliable handler the builder canvas uses): click the **current step card**
to pick up / drop the person, then click a highlighted reachable step to open
the confirm-move popup. Removed `elementsSelectable={false}` (which could
suppress node clicks).

## [0.13.28] — 2026-05-29 — Fibre Flow v0.6.1

### Fix: moving a contact didn't work in Safari (HTML5 drag unreliable in React Flow)

The drag-the-token interaction relied on HTML5 drag-and-drop, which is flaky
inside React Flow's transformed viewport — especially in Safari. Added a
robust **click-to-move** path alongside drag: click the person token to "pick
them up" (it turns amber and pulses, reachable steps highlight), then click a
highlighted step to open the confirm-move popup. Drag still works where the
browser supports it; both routes share the same confirmation. Token also
`stopPropagation`s pointerdown so React Flow doesn't swallow the gesture.

## [0.13.27] — 2026-05-29 — Fibre Flow v0.6.0

### Fibre Flow — drag-a-contact-through-the-flow popup

Clicking a contact (on a flow's "Contacts in this flow" list, or on the
Contacts page) now opens a **popup that shows the whole flow** with the
person positioned on their current step:

- The person rides a **draggable token** on their current step card.
- Steps reachable from here **light up** as drop targets; the current step's
  outgoing edge animates.
- **Drag the token onto a reachable step** → a **confirmation popup** runs the
  gate check: if satisfied, confirm and move; if not, it lists the step's gate
  tasks with one-click complete (the gate re-evaluates live) or an override
  reason to move anyway.
- Moving fires the same activity events as before; the popup refreshes to show
  the person on their new step.

Intuitive runtime — no buttons, you literally drag the person forward. The
button-based `/runs/[id]` full view is still available via "Full view".

### Added
- `apps/flow/app/(app)/flows/[id]/run-modal.tsx` — React Flow read-only graph
  with a draggable person token + confirm-move sub-popup.
- `apps/flow/app/(app)/contacts/contacts-list.tsx` — opens the modal from the
  Contacts page.
- `getRunDetail` server action.

### Changed — API
- `GET /flow/runs/:id` now also returns the run's full version `graph`
  (steps + transitions) so the popup can lay the flow out.

## [0.13.26] — 2026-05-29 — Fibre Flow v0.5.0

### Fibre Flow — drag-and-drop visual builder (Phase G)

The flow detail page now has a real **interactive canvas** (React Flow /
xyflow). No JSON needed:

- **Drag step cards** around a dotted grid; positions **snap** to 24px
  columns/rows and persist (`flow_step.canvas_x/canvas_y`).
- **Inline-edit a card's name** right on the card.
- **Click a card** → side panel to set kind (entry / normal / end ✓ / end ✗),
  description, expected duration, and the tasks auto-created when a contact
  enters that step.
- **Drag from a card's right edge to another's left** to create a transition;
  **click an arrow** → side panel for its label, gate logic (all / any), and
  gate tasks (title, actor type, contact-action type, required).
- **Add step**, delete step/transition, **Save** / **Publish** from the toolbar.
- Cards colour-coded by kind. Loop-backs render as curved edges.

The JSON editor is preserved under a collapsed **"Advanced — edit graph as
JSON"** disclosure for power edits / bulk paste.

### Added
- `apps/flow/app/(app)/flows/[id]/flow-canvas.tsx` — React Flow editor with
  custom step-card nodes + step/transition side panels.
- `@xyflow/react` dependency on `apps/flow`.

### Changed — API
- `PUT /flow/flows/:id/graph` now accepts + persists `canvas_x` / `canvas_y`
  per step (optional — the JSON editor omits them and still validates).

### Removed
- The read-only `flow-diagram.tsx` (superseded by the interactive canvas).

## [0.13.25] — 2026-05-29 — Fibre Flow v0.4.0

### Fibre Flow — visual flow diagram (Phase G, slice 1)

The flow detail page now renders the graph **visually**: steps as colour-coded
cards (entry = blue, end_positive = green ✓, end_negative = red ✗, normal =
white), transitions as labelled curved arrows with their gate summary
(`all 2` / `any 1`). Auto-laid-out into columns by longest-path depth from the
entry step; back-edges (loops) route below. Read-only for now — drag-to-edit
and in-canvas gate editing are the next slice; the JSON editor remains below
as the authoring surface in the meantime.

- `apps/flow/app/(app)/flows/[id]/flow-diagram.tsx` — hand-rolled SVG
  (no graph-library dependency, full design control). `foreignObject` for
  on-brand node/label typography.

## [0.13.24] — 2026-05-29 — Fibre Flow v0.3.0

### Fibre Flow Phase D — the runtime

Flows now *do* something: contacts can be put into a flow, their gate and
step tasks auto-materialise, and they move through steps with gate
validation. Step transitions and task completions write platform activity
events (type + subject only — across the data wall).

### Added — API (`apps/api/src/routes/flow.ts`)
- `POST /flows/:id/runs` — start a run for a person at the published version's entry step; materialises the entry step's tasks. Fires `flow.run.started`.
- `GET /flows/:id/runs` — runs in a flow (person + current step).
- `GET /runs` — all visible runs (Contacts "in motion" + dashboard); `?status=`.
- `GET /runs/:id` — run detail: current step, tasks, and available transitions each annotated with `gate_satisfied`.
- `POST /runs/:id/transition` — move along a transition. Validates the gate (all/any of the required gate tasks); blocks with `409 gate_unsatisfied` unless an `override_reason` is given. Cancels the old step's open generated tasks, materialises the destination step's tasks, fires `flow.run.step_changed` (or `flow.run.completed` at an end step).
- `POST /runs/:id/withdraw` — pull a contact out; cancels open tasks; fires `flow.run.withdrawn`.
- `PATCH /tasks/:id` — update/complete a task; completing a contact-actor task fires `flow.task.completed`.
- `GET /tasks` — caller's open tasks across flows (`?scope=mine|all`, `?status=`).
- `GET /contacts/:personId/runs` — a person's runs (for the future contact tab).

### Added — Flow frontend (`apps/flow`)
- **Flow detail → "Contacts in this flow"** — run list + Add-contact dialog (person search against the platform, start a run).
- **Run detail** (`/runs/[id]`) — current step, tasks with one-click complete/reopen (actor-type icons, gate badges), and "Move to next step" buttons that enable only when the gate is satisfied — with an inline override-reason flow when it isn't. Withdraw action.
- **My tasks** (`/tasks`) and **Contacts in motion** (`/contacts`) now wired to live data.

### Known limitation
- `can_see_person` (v0.9.0) has no "shares a flow_run" clause, so non-admin
  users can't yet see contacts solely because they're in a shared flow. Fine
  for the current admin-only workspace; a future migration adds the clause.

### Task-materialisation model
- Entering a step creates: that step's default tasks + the gate tasks on every
  transition leaving it. Leaving a step cancels its open generated tasks
  (manual tasks are preserved). Assignee resolves by actor type:
  personal→run owner, team→flow team, contact→the person.

## [0.13.23] — 2026-05-29 — Fibre Flow v0.2.0

### Fibre Flow Phase C — the definition layer

Flows can now be created, defined, versioned, and published. The visual
canvas is still deferred (Phase G); definitions are edited as JSON for now,
against the same underlying graph the canvas will later render.

### Added — API (`apps/api/src/routes/flow.ts`)
- `GET /api/v1/flow/flows` — list visible flows (RLS-scoped) with active-run counts; `?lifecycle=` / `?scope=` filters.
- `POST /api/v1/flow/flows` — create a draft flow + its first version.
- `GET /api/v1/flow/flows/:id` — flow metadata + the editable (or current) version's full graph, round-tripped by step `key`.
- `PATCH /api/v1/flow/flows/:id` — metadata + lifecycle (draft/active/closed/archived) + visibility.
- `PUT /api/v1/flow/flows/:id/graph` — replace the draft version's graph from JSON. Validates: unique step keys, exactly one `entry` step, ≥1 end step, transitions reference real keys, contact gate tasks require `contact_action_type`. Wipes + re-inserts steps/transitions/gates/defaults atomically per draft.
- `POST /api/v1/flow/flows/:id/publish` — publish the draft (must be non-empty), set `current_version_id`, flip lifecycle to `active`. Published versions are immutable; editing a published flow clones a fresh draft (version N+1).
- `DELETE /api/v1/flow/flows/:id` — soft delete.

### Added — Flow frontend (`apps/flow`)
- **Flow Library** (`/flows`) — list with lifecycle chips, scope, active-run count; empty state; "New flow" dialog (Personal / Workspace; team scope deferred pending a team picker).
- **Flow detail + JSON editor** (`/flows/[id]`) — edit the graph as JSON with a starter template, inline schema crib, Save draft / Publish, and full API error surfacing in the banner (per the read-the-error rule).

### Notes
- All flow routes run through `userClient(jwt)`; RLS enforces workspace +
  `has_app_membership('fibre-flow')` + scope/visibility. No service-role.
- Flow's user-facing version → **v0.2.0**.

## [0.13.22] — 2026-05-29

### Fix: theme / sidebar preferences now persist across sessions (Safari)

Theme and sidebar-mode choices were written client-side via
`document.cookie`. Safari's ITP caps **all** JavaScript-set first-party
cookies to a 7-day lifetime regardless of the requested max-age, so the
preference silently reverted. The cookies were already host-only (no
`domain`), so per-app isolation was fine — it was persistence that broke.

### Changed
- New `lib/prefs-actions.ts` Server Action (`savePref`) in web, meet, and
  flow. Writes `thefibre.theme` / `thefibre.sidebar` from the server via
  `Set-Cookie` (1-year max-age, host-only, `sameSite=lax`, not httpOnly so
  the no-flash `ThemeScript` can still read it). Server-set cookies aren't
  subject to Safari's 7-day script-cookie cap.
- `user-menu.tsx` (all three apps) now calls `savePref` instead of writing
  `document.cookie`. Theme still applies instantly client-side via
  `applyTheme()`; sidebar awaits the save before `router.refresh()` so the
  server layout re-reads the new value.
- Each app keeps its own preference (host-only cookie, per subdomain) —
  Meet can be dark while Flow is light.

## [0.13.21] — 2026-05-29

### Fix: returning to `thefibre.app` while signed in looked like a logout

After signing in and visiting `meet`/`flow`, navigating back to
`thefibre.app` showed the marketing landing page with a sign-in link —
appearing as if the session had dropped. It hadn't: cross-subdomain SSO
was working (the `.thefibre.app` cookie is shared, which is why meet/flow
stayed logged in). The root page (`apps/web/app/page.tsx`) just rendered
the public landing page **unconditionally**, with no auth check — unlike
meet/flow, whose root pages redirect signed-in users to `/dashboard`.

### Changed
- `apps/web/app/page.tsx` is now an async server component that calls
  `getUser()` and `redirect('/dashboard')` for authenticated users,
  mirroring meet/flow. Signed-out visitors still get the marketing page.

### Also
- Bundle analysis confirmed `NEXT_PUBLIC_COOKIE_DOMAIN=.thefibre.app` is
  correctly baked into all three frontends — the cookie scope was never
  the issue.

## [0.13.20] — 2026-05-20 — Fibre Flow v0.1.0

### Fibre Flow lands as the fourth in-family app (Phase B)

The platform's fourth sibling app — alongside Meet, Thread, and the
gated Sales / Learn slots. Sales pipelines, project intakes, partnership
arcs, anywhere a contact moves through a sequence over time. Conceptual
spec: [`docs/fibreflow-brief-v0.3.md`](docs/fibreflow-brief-v0.3.md).
Build plan: [`docs/fibreflow-build-plan.md`](docs/fibreflow-build-plan.md).

Phase B closes Phase A (the `team` rename) and delivers the shell.

### Added

- **Schema** — nine new tables under `public.flow_*`:
  `flow_definition`, `flow_version`, `flow_step`, `flow_transition`,
  `flow_gate_task`, `flow_step_default_task`, `flow_run`,
  `flow_task`, `flow_document_link`. Workspace + has-app-membership
  RLS, mirroring the v0.9.0 Meet pattern. No platform schema changes —
  Flow consumes `person`, `organisation`, `team`, `workspace`,
  `activity`, `app_membership` natively. Migration
  `20260520120000_fibre_flow_schema.sql`.

- **`fibre-flow` app registered** in `public.app` (slug constraint
  widened to include it). Branded via
  `packages/shared/src/branding.ts`.

- **`apps/flow/` skeleton** at `flow.thefibre.app` (Vercel project
  + DNS land in Phase B3). Sidebar: Home / Flows / Tasks /
  Contacts / Settings. Empty-state placeholders for the four content
  pages — visible end-to-end so Sjoerd can see the shape before the
  engine fills in. Phase B's job is to be empty-on-purpose.

- **`fibre.app.json` manifest** declaring Flow's scopes
  (read persons/orgs/activities, write activities) and the five
  activity types it will emit: `flow.run.started`,
  `flow.run.step_changed`, `flow.run.completed`,
  `flow.run.withdrawn`, `flow.task.completed`.

### Decisions baked in (per `docs/fibreflow-review.md` §4, locked 2026-05-17)

- `gate_logic` is configurable per transition (`'all'` | `'any'`), default `'all'` (Q1)
- `flow_version` is snapshot-pinned per run; published versions are immutable (Q2)
- A contact re-entering a flow gets a new `flow_run` row (Q3)
- `flow_step_default_task` materialises into `flow_task` rows on step entry (Q4)
- `team_id` references `public.team` natively (Q5; Phase A enabled this)
- In-app notifications first; email digest later (Q6)
- Manual Google Drive URL paste in v1; OAuth picker later (Q7)

### Not yet shipped (intentional — comes in Phases C–J)

- The flow builder (Phase G), including a JSON-textarea fallback for
  Phase C.
- The runtime that moves contacts through flows (Phase D).
- The task system + dashboards (Phase E).
- Cross-app activity reading for contact-action gates (Phase F).
- Flow Board kanban view (Phase H).
- Lifecycle / hygiene / reports / docs (Phase I).
- Seed data + v1.0 cutover (Phase J).

## [0.13.19] — 2026-05-19

### Reserved-slug validation on host / team / meeting-type

Until now nothing stopped a host from claiming the slug `settings` —
the resulting URL `meet.thefibre.app/settings` would match Meet's
`(app)/settings` route group instead of `[hostSlug]`, and the host
would be silently unreachable. Same hazard for `meeting-types`,
`teams`, `dashboard`, `confirmed`, `auth`, etc.

Now denied at the API layer with a clean 400 + field error.

### Added
- **`apps/api/src/lib/reserved-slugs.ts`** — single source of truth:
  - `TOP_LEVEL_ROUTES` — `auth`, `invite`, `no-access`, `sign-in`,
    `signup`, `login`, `app`.
  - `APP_GROUP_ROUTES` — `bookings`, `contacts`, `dashboard`,
    `internal-team`, `meeting-types`, `organisations`, `persons`,
    `programmes`/`programs`, `settings`, `teams`.
  - `MT_SUBPATHS` — `confirmed`, `cancel`, `reschedule`.
  - `INFRA` — conventional SaaS reserves: `api`, `admin`, `about`,
    `brand`, `callback`, `docs`, `faq`, `health`, `help`, `legal`,
    `oauth`, `privacy`, `pricing`, `public`, `robots`, `status`,
    `support`, `terms`, `webhook`(s), `www`.
- **`SLUG_PATTERN`** regex — lowercase alnum + hyphens, no leading/
  trailing hyphen.

### Changed
- **`HostUpdate.slug`**, **`MeetingTypeUpsert.slug`**, **`TeamUpsert.slug`**
  in `apps/api/src/routes/meet.ts` now go through `SLUG_PATTERN` +
  `isReservedSlug` refinement. Error messages name the issue
  ("reserved word — would collide with a Meet route") and list a
  preview of reserved values.

### Notes
- The DB has no `CHECK` constraint mirroring the list — slugs are
  validated at the API boundary only. Adding a generated-column
  constraint would couple DB to UI route names; an API-layer check
  is the right scope.
- Web-side: the existing `name-slug.tsx` widget normalises input to
  lowercase + hyphen, so the regex piece is already enforced
  client-side; the reserved-word check is the only new server-only
  rule. Web caller still sees the clean field error in dialogs.

## [0.13.18] — 2026-05-19

### Platform Billing Phase 1 — plan-aware Meet skim

Schema + free-by-default + plan-aware Meet fee. The 2%/€2 cap on paid
Meet bookings is no longer hard-coded — it reads the workspace's plan.
Free pays the skim; Pro / Org pay 0%, as decided in
[`docs/platform-billing-roadmap.md`](docs/platform-billing-roadmap.md).
Phases 3 + 4 (upgrade UI, Stripe Checkout for subscriptions) are
deferred — they need Sjoerd to configure Products in Stripe first.

### Added (Phase 1)
- **Migration `20260519100000_platform_billing_phase1.sql`**:
  - `billing_plan` table seeded with the three tiers from the roadmap
    — Free (€0, 2%/€2 cap), Pro (€15/seat/mo, 0%), Org (€30/seat/mo, 0%).
    Features stored as JSONB (`first_party_apps`, `sso`, `audit_log`,
    `max_users`, `max_contacts`, etc.) so the UI can gate without code
    changes when we add a tier.
  - `workspace_subscription` table — FK to `workspace` and to
    `billing_plan`, status enum incl. `comped`, Stripe customer +
    subscription ids, billing interval, period boundaries, seat count.
    RLS: workspace members can read their own row; writes via
    service-role only (Stripe webhook handler in a later phase).
  - `workspace_meet_fee(ws_id)` SQL helper returning
    `(pct, cap_cents)` — the API reads this at Checkout time.

### Added (Phase 2)
- **Backfill** — every existing workspace gets a Free + `comped`
  row tagged `comped_reason = 'pre-billing default'`, so we never
  charge for legacy data.
- **Trigger `on_workspace_insert_create_subscription`** — every new
  workspace automatically gets a Free + comped row. UI never has to
  remember to create one.

### Changed (Phase 7)
- **`POST /api/v1/meet/public/bookings`** — the Connect Checkout
  Session's `application_fee_amount` now comes from
  `workspace_meet_fee` instead of the hard-coded `(2%, cap €2)`. Pro
  and Org workspaces send `application_fee_amount: 0` so the host
  keeps 100% of the booking revenue. Defensive default: if the
  lookup somehow fails, falls back to the Free rate (never under-
  skim).

### Added (UI hook)
- **`GET /api/v1/workspace-apps/billing`** — returns
  `{ plan, subscription }` for the current workspace. UI can use this
  to render a plan badge / upgrade prompt / gate Pro-only features.
  No UI consumer yet; landing it now keeps Phase 3 a 1-day build
  instead of 1.5.

### What's still out (Phases 3–8)
- Workspace billing page (`/settings/workspace/billing`)
- Stripe Checkout for upgrades + webhook lifecycle
- Feature gates calling `requirePlan(min)` from API endpoints
- Stripe Billing portal hand-off for invoice history / cancellation

These need a Stripe Products + Prices walkthrough in the dashboard
first — see [`docs/platform-billing-setup.md`](docs/platform-billing-setup.md).

## [0.13.17] — 2026-05-19

### API CORS goes from "any origin" to an allowlist

Until now the Hono CORS middleware reflected every Origin back ("any
origin is allowed"). With paid bookings, branded auth, and Stripe
webhooks all live in production, that was the last "we'll harden it
later" item on the post-deploy loop. Done.

### Changed
- **`apps/api/src/server.ts`** — CORS now allowlists:
  - The 5 prod subdomains: `thefibre.app`, `meet.thefibre.app`,
    `thread.thefibre.app`, `sales.thefibre.app`, `learn.thefibre.app`.
  - Local dev: `http://localhost:3000` / `:3001` / `:3002`.
  - Our own Vercel previews — regex match on
    `https://(thefibre-web|thefibre-meet|thefibre-thread)-<branch>.vercel.app`.
  - Anything in `CORS_ORIGINS` (comma-separated env override) for
    one-off staging hosts.
- Unknown origins receive **no `Access-Control-Allow-Origin` header**
  at all. The browser then blocks the cross-site request as the spec
  requires. We deliberately don't reflect-and-allow because
  `credentials: true` + `*` would have been rejected by browsers
  anyway, and we want a clean deny rather than a noisy half-allow.
- Server-to-server callers (Stripe webhook, Supabase Send Email Hook)
  are unaffected — no `Origin` header, no CORS handshake.

### Operations note
- For any extra preview / staging origin Sjoerd wants to whitelist
  without redeploying: `fly secrets set CORS_ORIGINS="https://extra.example.com" -a thefibre-api`.
  Restart picks it up.

## [0.13.16] — 2026-05-18

### The Fibre wordmark in the platform sidebar

Until now the handwritten "the fibre" wordmark lived only in the
auth emails (BRAND_ASSETS.logoUrl, v0.10.0). Inside the platform
the sidebar showed plain text "The Fibre". This brings the brand
into the app shell — same asset, same SPoT.

### Changed
- **`apps/web/components/shell/sidebar.tsx`** — when the sidebar is
  expanded, the brand label is now the wordmark image (`/brand/the-fibre.png`)
  instead of plain "The Fibre" text. The compact yellow "tf" tile stays
  exactly as it was — it's the anchor when the sidebar is collapsed and
  doesn't depend on image loading.
- Meet sidebar untouched. Meet shows "Fibre Meet" specifically — the
  Fibre wordmark belongs on the platform shell where it represents
  the umbrella brand.

### Also
- **Build-plan cleanup.** The "Group / One-off / Meeting poll event
  types" entry is marked done — Group shipped in v0.11.1, the other
  two in v0.12.0. The stale entry was misleading me earlier today.

## [0.13.15] — 2026-05-18

### Verified-domain auto-attribution

The promised follow-up to v0.13.14. When a new person is created with
an email whose domain matches a verified organisation in the workspace,
we now auto-link them via `org_membership` (as primary, since brand-new
persons have no existing primary). Plus a backfill endpoint to retro-
link existing contacts after an org's domain is verified.

### Added
- **`POST /api/v1/persons/` auto-link.** On person create, looks up
  `organisation` rows in the workspace where `domain` matches the
  email's domain (case-insensitive) and `domain_verified_at IS NOT
  NULL`. On a match: inserts an `org_membership` row with
  `is_primary: true` and stamps an audit activity row.
  - The response now includes `auto_linked_org_id` (nullable) so
    callers can react in the UI.
  - The activity row's subject reads
    `"Added <Name> to the workspace · auto-linked to <Org> (verified domain)"`.
- **`POST /api/v1/organisations/:id/domain-verification/backfill`**
  — re-scans all persons in the workspace whose email matches the
  org's verified domain, inserts an `org_membership` for each that
  isn't already linked. `is_primary` is set only when the person
  has no other active primary (doesn't fight existing curation).
  Returns `{ linked, skipped, total }`. Idempotent: re-running just
  reports 0 new links.
- **"Link existing contacts on this domain" button** on the org
  overview, shown once the domain is verified. Calls the backfill
  endpoint and renders the count inline.

### Safe by design
- **Verification is the gate.** Unverified domains are ignored, so
  a typoed/squatted org domain can't auto-attribute strangers.
- **Audit trail.** Every auto-link writes an activity row, so an
  admin can see exactly where a contact's org link came from and
  end the membership if it's wrong.
- **No PATCH-time auto-link.** Updating an existing person's email
  doesn't trigger auto-attribution — keeps behaviour predictable
  and avoids surprise re-links when emails change.

## [0.13.14] — 2026-05-18

### Org branding + DNS-based domain verification

Sjoerd: "branding is missing" and "setting for a DNS for an org with a
domain name is missing". Both addressed in one slice — org logo + a
TXT-challenge verification flow for the org's claimed domain.

### Added
- **Org logo on the profile header.** `logo_url` (already a column on
  `organisation`) is now editable from the org edit dialog and renders
  as a 48px avatar to the left of the org name on every org-detail
  surface (Overview / Profile / per-app tabs). Falls back to a letter
  tile when unset.
- **`PageHeader` now supports a `leading` slot** — the avatar/logo
  slot. Generic enough that contact profiles can use the same pattern
  later.
- **DNS verification panel** on the org overview (visible when a
  domain is set). Three states: no challenge issued, in-flight (shows
  the TXT name + value with copy icons + Check button), verified
  (green chip + "Re-verify" link).
- **Migration `20260517270000`** — adds `organisation.domain_verified_at`
  and a new `org_domain_verification` table holding the one-time TXT
  challenge per org. RLS scoped to workspace_member.
- **Three API endpoints**:
  - `GET    /api/v1/organisations/:id/domain-verification` — current
    state (domain, verified-at, in-flight challenge if any).
  - `POST   /api/v1/organisations/:id/domain-verification` — generate
    or rotate a challenge. Returns `record_name` + `record_value`.
  - `POST   /api/v1/organisations/:id/domain-verification/check` —
    `dns.resolveTxt(_fibre-verify.<domain>)` and compare. On match:
    stamps `domain_verified_at`.
- **OrgUpdate schema** now accepts `logo_url`.

### Honest gaps
- **Logo upload is URL-only.** No file upload to Supabase Storage yet —
  paste a public PNG/JPG/SVG URL. The "upload" UI is a follow-up
  (probably aligned with workspace branding when we get there).
- **No follow-on auto-attribution.** Verified domains don't yet auto-
  link new persons whose email matches `@<domain>` to the org. The
  trust signal is there; the wiring is the next slice.
- **Workspace-level branding** (the Fibre app shell wordmark in topbar
  / sidebar) is still untouched. The hand-written wordmark lives in
  emails only; the sidebar shows the 2-letter brand tile. Worth a
  separate decision before changing.

## [0.13.13] — 2026-05-18

### Platform prep: rename `meet_team` → `team` (Phase A of Fibre Flow build)

Teams are a Fibre primitive, not a Meet-private one. Sibling apps (Fibre
Flow next) consume teams natively, so the table moves out of Meet's
namespace. See [`docs/fibreflow-review.md` §2.2](docs/fibreflow-review.md)
and [`docs/fibreflow-build-plan.md` Phase A](docs/fibreflow-build-plan.md).

### Changed
- `public.meet_team` → `public.team`, `public.meet_team_member` →
  `public.team_member`. Indexes, triggers, and policies renamed in place
  (FK constraints follow by OID).
- `public.can_see_person` and `meet_booking_visibility` policy bodies
  refreshed so their canonical source text uses the new names.
- `public.meet_is_team_lead` body refreshed; function name kept for now
  (rename deferred — the `meet_` prefix is historical baggage we can
  drop in a later cleanup pass).
- `apps/api/src/routes/meet.ts` and `apps/meet/fibre.app.json` updated.

### Migration
- `20260517220000_rename_meet_team_to_team.sql`.

### Notes
- Four companion docs landed first: brief, review (with locked
  decisions), data model, full build plan. See
  [`docs/fibreflow-build-plan.md`](docs/fibreflow-build-plan.md).
- The `app_entity_mapping` seed row for `meet_team_member` is updated to
  `team_member`; the entry will likely be removed entirely in a later
  cleanup since team membership is now a platform concept and not a
  Meet app entity.

## [0.13.12] — 2026-05-17 — Meet 2.1.4

### Paid bookings now generate real VAT invoices

Sjoerd: "Is invoicing in?" Partly — billing fields (legal name, tax ID,
address) existed on persons + orgs, and Stripe Connect was wired for
paid bookings, but Stripe Checkout only emails its own receipt — that's
not a legal VAT invoice. EU customers need one. Now Stripe auto-generates
a finalised invoice for every paid booking, emails the hosted PDF link
to the invitee, and we surface it on the confirmation page.

### Added
- **`invoice_creation.enabled = true`** on the Connect Checkout Session
  in `POST /api/v1/meet/public/bookings`. Stripe creates a finalised
  Invoice (with the connected host's branding, tax ID, business address),
  emails a hosted PDF link to the invitee, and files it under the host's
  Invoices dashboard. No new tables, no new render code.
- **`billing_address_collection: 'required'`** — so the auto-generated
  invoice has a "Bill to" block, mandatory for EU reverse-charge VAT.
- **`invoice_data.description` + `metadata.booking_id`** stamped on the
  invoice so it traces back to the booking row.
- **Migration `20260517260000_meet_booking_invoice.sql`** — adds
  `stripe_invoice_id` and `stripe_invoice_url` (hosted PDF) to
  `meet_booking`. Both nullable; free bookings have neither.
- **Webhook capture** — `checkout.session.completed` now also
  `stripe.invoices.retrieve(session.invoice)` on the connected account
  and stashes `id` + `hosted_invoice_url` on the booking. Best-effort:
  a missing invoice doesn't block confirmation.
- **Confirmation page** (`/<host>/<mt>/confirmed/<id>`) — when
  `payment_status='paid'` and the invoice URL is present, shows a
  "View invoice (PDF) ↗" link beside the confirmation-email note.
  Graceful fallback copy when the host's connected account doesn't
  have automatic invoicing enabled yet.

### Also
- **User menu fix** (web + meet): the Profile and Settings entries
  were inert `<button>`s with no href/onClick. Both apps now route
  them to `/settings` (resp. `/settings/profile` on Meet) and close
  the menu on click. "Take a tour" stays as a muted placeholder.

### Honest gaps
- **No Stripe Tax.** Tax rates on the auto-invoice depend on the host
  enabling Stripe Tax inside their connected account. We don't force
  `automatic_tax: true` because the Session call would fail for hosts
  who haven't onboarded it — a regression risk for existing paid
  flows. Per-workspace opt-in once Platform Billing Phase 1 lands.
- **No Fibre Sales surface** — there's still no in-product way to
  issue arbitrary invoices (outside the Meet paid-booking flow). The
  `fibre-sales` app slug exists; the app doesn't.
- **Historical paid bookings** (pre-migration) won't have an invoice
  URL stamped. Stripe still has the invoice on the host's account —
  we just don't backfill the link.
## [0.13.11] — 2026-05-17

### Same dormant-membership fix on /settings (App access list)

v0.13.10 fixed the contact-profile surface. The `/settings` page
read from a separate endpoint (`/api/v1/auth/me`) and was still
listing all 5 apps as ADMIN while `/settings/apps` showed only Fibre
Meet activated.

### Changed
- **`GET /api/v1/auth/me`** now filters `memberships` to apps the
  workspace has activated in `workspace_app` (deactivated_at IS NULL).
  Sidebar app list, /settings App access section, and any other
  consumer of `me.memberships` now matches the workspace's active
  apps.
- **`fibre-platform` always included** in both endpoints
  (auth/me + persons/:id/memberships) — it's The Fibre itself,
  no workspace_app row exists for it, but the workspace-admin gate
  on /settings/apps reads `m.app.slug === 'fibre-platform' && m.role === 'admin'`,
  so dropping it would lock admins out of managing apps. Special-cased
  in code with a comment.

## [0.13.10] — 2026-05-17

### Fix: contact's "Apps they have access to" listed dormant memberships

Sjoerd: profile showed Fibre Meet + The Thread + Fibre Sales + Fibre
Learn + The Fibre — but the workspace's Settings → Apps page had
only Fibre Meet activated. The two pages contradicted each other.

### Changed
- **`GET /api/v1/persons/:id/memberships`** now joins `app_membership`
  with `workspace_app` (where `deactivated_at IS NULL`) and drops
  any app memberships for apps the workspace hasn't activated. So
  the profile's app-access chips match Settings → Apps.

### Note on the still-empty Organisations section
"No organisations linked yet" on Sjoerd's own profile is accurate —
there's no `org_membership` row connecting him to Solidarity Lab B.V.
The relationship exists conceptually (the workspace belongs to the
company) but the platform's contact-graph edge wasn't created. Fix
by opening the org page (e.g. /organisations/<solidarity-lab-id>) →
**Add member** → Sjoerd, with the appropriate title/role/dates.

## [0.13.9] — 2026-05-17

### Contact profile now shows org + workspace + app memberships

Sjoerd: "Sjoerd@soul.com is an org owner ... in Fibre I don't see
that in his profile (not the connection to the company, not his role
in the workspace, not the workspaces he is part of...). This should
be there no?" Yes — these are platform-owned facts (brief §2,
"platform owns identity + contact graph edges"). Now surfaced.

### Added
- **`GET /api/v1/persons/:id/memberships`** — returns
  `{ org_memberships, workspace_member, app_memberships, has_account }`.
  Org memberships include title, department, seniority, decision-
  maker / budget-holder / champion flags, primary org, and start/end
  dates. Workspace member shows role + relationship_type (internal /
  external). App memberships list which apps the person has a seat
  for (only if they hold a Fibre user account).
- **Contact overview page** gains two new sections between the
  identity fields and the timeline:
  - **Organisations**: cards per org membership with a "Primary"
    chip on the main one, "Ended" chip on historical roles, plus
    decision-maker / budget-holder / champion badges where set.
    Clicks into `/organisations/<id>`.
  - **Workspace access** (only when the person has a Fibre account):
    workspace name, role (admin/member), relationship_type (internal
    /external), and a row of app-name chips for the apps they hold.

### On Sjoerd's other question

**"Are contacts of an organisation shared between apps? That would
be meaningful."** Yes, already. The `person` and `organisation`
tables are platform-owned and workspace-scoped — every app with
`app_membership` in the workspace sees the same identity rows (RLS
on `person.workspace_id`). Apps own per-app *curator data* on top
(host notes in Meet, lead score in HubSpot) — those don't cross
the wall. So:

- Identity, contact details, **org memberships**, contact-graph
  relationships → all shared across apps in the workspace.
- Curator data → per-app, gated by that app's membership.

That's the brief §2 / §5 contract working as designed.

## [0.13.8] — 2026-05-17 — Meet 2.1.3

### Meet's contact tab finally shows what Meet actually justifies

Until now, the Fibre Meet tab on a contact profile rendered
change-facilitation fields (Role in change, Stance, Readiness,
Leadership style, Themes, Blockers, Motivators, Current challenge,
Facilitator notes). Those fields belong to a future Fibre Change
app, not to Meet. Per brief §5 ("the app justifies the field"),
Meet should only persist what it has a reason to.

### Changed
- **Migration `20260517250000_meet_person_profile.sql`** — new
  `person_meet_profile` table: workspace_id+person_id PK, host_notes
  (private text), vip + blocked flags, invitee_timezone. RLS scoped
  to fibre-meet membership.
- **New `GET /api/v1/persons/:id/meet`** returns
  `{ profile, upcoming_bookings, past_bookings }`. Bookings are live
  from `meet_booking`, matched by `invitee_email`.
- **New `PATCH /api/v1/persons/:id/meet`** upserts the profile.
- **GET `/api/v1/persons/:id/apps`** now also lists `fibre-meet`
  when a person has any `meet_booking` against their email — so the
  tab appears even before any curator data exists.
- **Web `apps/web/app/(app)/contacts/[id]/app/[appSlug]`** branches
  for `appSlug === 'fibre-meet'` and renders `<MeetTab>` instead of
  the generic curator layout.
- **New `MeetTab`** (`contacts/[id]/meet/tab.tsx`) renders:
  - Meet profile card with status chips (VIP / Blocked), preferred
    timezone, host notes, total-meeting count
  - Upcoming meetings list (live)
  - Past meetings list (live)
- **New `MeetProfileEdit`** dialog — clean, Meet-only fields. Title
  reads "Edit Meet profile — Fibre Meet" matching the app-chip
  convention from v0.10.1.

### Honest gaps
- The old `person_change_context` table is left in place. No data
  loss; just no longer surfaced on the Meet tab. Drop is a separate
  migration once you confirm no workspace relies on it.
- The Meet manifest still references `person_change_context` as a
  curator field for backward compat. Updating that is part of the
  table-drop follow-up.
- Booking rows on the contact page aren't clickable into a dialog
  here (that lives in Meet). For deeper inspection users click
  through to the meeting in Meet.

## [0.13.7] — 2026-05-17 — Meet 2.1.2

### Fix: paid MT silently reverted to Free on save

Native `<input type="radio">` with no `value` attribute posts the
literal string `"on"` for whichever radio is checked. The Pricing
free/paid radios were unattributed — so both posted
`pricing_visible: 'on'`, the action's `!== 'paid'` branch always
fired, and `price_cents` was nulled out on every save. Then the
form re-rendered with no price and the chooser jumped back to
"Free".

### Changed
- **`apps/meet/app/(app)/meeting-types/form.tsx`** — Pricing radios
  gain `value="free"` / `value="paid"`.
- **`apps/meet/app/(app)/meeting-types/actions.ts` `bodyFromForm`**
  now reads the existing hidden `pricing_mode` input (mirrors React
  state directly) as the authoritative source, falling back to
  `pricing_visible`. Belt-and-braces so a future radio regression
  can't wipe prices again.

## [0.13.6] — 2026-05-17 — Meet 2.1.1

### Fix: Payments page saved silently but UI showed old value; settings cards spaced

### Changed
- **`apps/meet/app/(app)/settings/actions.ts`** — `updateHost`
  revalidatePath list now includes `/settings/payments`. Previously
  pasting `acct_…` and clicking Save flipped the row in DB but the
  page re-rendered from cache, showing the field still empty.
- Same action now uses `formatApiError()` (matches the v0.12.3
  pattern) so any future zod/RLS error appears inline instead of
  the bare "API 500".
- **API `PATCH /api/v1/meet/me`** logs full Postgres error + zod
  details + body keys on failure. Same diagnostic pattern as
  v0.12.2 for MT save.

### Settings cards — actual breathing room
- Settings page now renders cards in a **2-column grid with `gap-3`**
  instead of a single divided list. Each card is its own bordered
  surface with `p-5` and a slightly larger icon tile (`h-10 w-10`).
  The two sections (Personal / Workspace) separated by `mt-14`.

## [0.13.5] — 2026-05-17 — Meet 2.1.0

### Meet Phase 3: Stripe Checkout for paid bookings

A paid meeting type now redirects the invitee to Stripe Checkout
after they pick a slot. The booking sits as `payment_status='pending'`
until Stripe's webhook fires `checkout.session.completed`; then the
deferred side-effects (Google Calendar event, branded confirmation
email, activity row) run automatically.

### Added
- **`apps/api/src/lib/stripe/client.ts`** — lazy-loaded Stripe SDK.
  `stripeOrNull()` returns `null` when `STRIPE_SECRET_KEY` is unset
  so the API still boots in environments without Stripe configured.
- **Booking POST** detects paid MTs (`price_cents > 0`), creates a
  **Stripe Connect Checkout Session** against the host's connected
  account, and returns `{ booking, payment_required: true, checkout_url }`.
- **`payment_intent_data.application_fee_amount`** set to 2% capped
  at €2 per booking — the Free-workspace skim. Phase 7 will read the
  workspace's plan and waive this for Pro/Org once Platform Billing
  Phase 1 lands.
- **New `POST /api/v1/meet/stripe-webhook`** (public, HMAC-verified).
  Handles three events: `checkout.session.completed` (flip
  payment_status to 'paid', run side-effects), `checkout.session.expired`
  and `payment_intent.payment_failed` (cancel the booking).
  Idempotent — same session id is safe to receive twice.
- **`runConfirmationSideEffects(bookingId)`** helper centralises
  Calendar + email + activity logic. The approve endpoint refactored
  to call it; the webhook calls the same code so both paths produce
  identical state.

### Changed
- **Public booking page** (`/[host]/[mt]`) now shows the price in
  the sidebar (currency-localised) with "— paid at checkout".
- **Public booking flow** (`flow.tsx`) detects `payment_required`
  in the create-booking response and redirects to `checkout_url`
  via `window.location.href`.
- **Stripe webhook URL** registered in `apps/api/src/middleware/app-context.ts`
  PUBLIC_PREFIXES so the route bypasses JWT auth — signature is the
  trust mechanism.

### Honest gaps
- **Approval + payment combined**: a MT with both required is
  treated as paid-only (payment is the hard gate; approval is
  auto). If you want host-approval-then-pay, the combined flow is
  a Phase 3b follow-up.
- **No refund UI** yet — that's roadmap Phase 6.
- **Application fee is hardcoded at 2%/€2** (Free-workspace rate)
  for every booking because Platform Billing hasn't shipped. Once
  Platform Billing Phase 1 seeds `workspace_subscription`, the
  Meet POST reads the plan and applies 0% for Pro/Org.
- **Untested in prod** until `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
  are set on Fly per `docs/platform-billing-setup.md`. The code
  ships dormant; the API returns 503 with `code: 'stripe_not_configured'`
  on the create-booking path until then.

## [0.13.4] — 2026-05-17

### Booking email matches the auth-email visual; Google stops emailing invitees

### Changed
- **`apps/api/src/lib/email/templates.ts` shell rewritten** to use the
  same wordmark + footer pattern as the v0.10.0 auth emails. Centred
  Fibre logo at the top, white canvas (no bordered card), Help /
  About / Legal footer, whitelist-our-address hint, legal address
  line. Booking + cancellation emails now read as one family with
  sign-in / magic-link / etc.
- **Google Calendar event creation** now passes `sendUpdates: 'none'`
  so Google no longer emails the invitee a separate calendar invite.
  Fibre Meet's branded confirmation email is the sole notification.
  Same change applied to event deletion (cancel path) so Google
  doesn't double up on cancellation either.
- The invitee is still listed as an attendee on the host's Google
  Calendar event, so the host's calendar shows who's coming. Just no
  Google-sent email.

### Honest gap
- The Fibre confirmation email doesn't yet include an `.ics`
  attachment. Invitees who relied on Google's invite to auto-populate
  their calendar will need to add the meeting manually. Adding an
  attached `.ics` is a clean follow-up — small.

## [0.13.3] — 2026-05-17

### Meet's display version decoupled — sidebar now shows v2.0.0

Meet is the rebuild of Suite v1, so calling it `0.13.x` in the
sidebar didn't reflect its lineage. Meet now has its own
user-facing version, starting at **v2.0.0**, independent of the
monorepo release cadence in `package.json` (which keeps tracking
cross-package work).

### Changed
- `apps/meet/app/(app)/layout.tsx` `VERSION` constant → `'2.0.0'`.
- `CLAUDE.md` "Version bumps" section updated: from now on, bump
  Meet's VERSION independently when Meet-specific surfaces ship;
  don't mass-bump in lockstep with platform-wide releases.

## [0.13.2] — 2026-05-17

### Booking approval — host default + per-MT override

A meeting type can now require host approval before a booking
auto-confirms. Default is set on the host profile and individual
MTs can override it.

### Added
- Migration `20260517240000_meet_booking_approval.sql`:
  `meet_host.requires_approval` (bool default false) and
  `meet_meeting_type.requires_approval` (nullable bool — null = inherit).
  Booking status enum gains `pending_approval`.
- **Booking POST** computes effective approval (MT-level wins; null
  falls back to host default). When true:
  - Booking inserted with `status='pending_approval'`
  - Google Calendar event + confirmation emails are skipped
  - Invitee gets "request received"; host gets "approval needed"
  - Activity event is `meeting_requested` instead of `meeting_booked`
- **`POST /api/v1/meet/bookings/:id/approve`** — host-only; creates the
  Google Calendar event + sends the normal confirmation email + flips
  status to `confirmed`. Mirrors the auto-confirm path exactly.
- **`POST /api/v1/meet/bookings/:id/reject`** — host-only; flips to
  `cancelled`, sends a "declined" email (optional reason).
- **Settings → Profile** gains "Require my approval before a booking
  is confirmed" checkbox (host-level default). Presence sentinel
  hidden input so unchecking actually persists.
- **MT editor → Availability tab** gains "Approval" section with
  three radios: Use my default / Always require / Never require.
- **Booking dialog** shows amber "Pending" status; when pending,
  Approve and Reject buttons appear in the footer.
- **Bookings list rows** show amber "Pending" pill alongside the
  existing Confirmed/Cancelled.
- **Public confirmation page** branches copy when status is
  `pending_approval` — "Your request is in" instead of "You're booked",
  with a line explaining the host will review.
- **Bookings list query** keeps `pending_approval` rows visible even
  when "Include cancelled" is off — hosts shouldn't have to opt in to
  see bookings they need to act on.

### Honest gap
- Reject email is plain text; no "request a different time" loop yet.
- No reminder if a pending request sits >24h. Easy follow-up.
- Approval state is per-host (the MT owner), not per-team-lead — if
  the MT is a team type, the owner-host's policy still governs.

## [0.13.1] — 2026-05-17

### Phase 2: Stripe Connect (paste flow) + price on MT

Hosts can now connect Stripe and assign a price to a meeting type.
The actual Stripe Checkout redirect on booking is Phase 3 — saving a
price today reserves the field but doesn't yet trigger payment.

### Added
- **Settings → Payments page** (`/settings/payments`) — paste-style
  Stripe Connect onboarding mirroring Suite. Pastes `acct_…`,
  validates format, shows Connected/Not connected pill.
- **MT editor → Pricing tab** is no longer the stub. Paid radio is
  live; price input (decimal) + currency dropdown (EUR/USD/GBP)
  appear when Paid is selected.
- **API: `HostUpdate` zod** accepts `stripe_account_id` with regex
  guard (`^acct_…`).
- **API: `MeetingTypeUpsert` zod** accepts `price_cents`
  (int 0–10,000,00) + `price_currency` (3-letter ISO).
- **API: POST/PATCH `/meeting-types` guard** — if `price_cents > 0`
  and the host has no `stripe_account_id`, returns a 400 with
  "connect Stripe in Settings → Payments before setting a price"
  (visible inline in the form thanks to v0.12.3's error pipeline).
- **Action: `bodyFromForm`** converts `price_major` (decimal string
  like "49.00") to cents, nulls out price columns on paid→free flip
  so stale prices don't linger.

### Honest gap
This commit ships the *plumbing* for paid MTs — connection +
price storage + guard. Phase 3 (Stripe Checkout redirect, webhook,
payment_status updates) is next. A paid MT today still completes
booking as if free; that changes in Phase 3.

## [0.13.0] — 2026-05-17

### Intake forms ship; pricing/payments roadmap published

Sjoerd asked for the full Suite-equivalent Pricing + Payments surface
(intake, price, Stripe + PayPal + Invoice, refunds, invoice emails,
tax). That's ~5-6 days of focused work — see
[`docs/meet-pricing-roadmap.md`](docs/meet-pricing-roadmap.md) for the
phased plan. This release ships Phase 1 only.

### Added (Phase 1 — Intake forms, end-to-end)
- **API: `PUT /api/v1/meet/meeting-types/:id/intake`** — upserts
  the `meet_intake_form` row and links it via `intake_form_id`.
  Empty fields detaches and cleans up. Zod-validated.
- **API: MT list endpoint** now also pulls
  `intake_form:intake_form_id (id, name, fields)` so the editor can
  preload.
- **Editor: Intake tab** is wired up. The pre-existing
  `IntakeFieldsEditor` component (5 field types, drag-reorder,
  cascade-delete, conditional logic) is now mounted. Saves
  out-of-band from the main MT PATCH via the new `saveIntakeFields`
  server action.
- **Public booking page** already rendered intake answers and
  stored them on `meet_booking.invitee_answers` — confirmed working
  end-to-end now that the editor exists.

### Roadmap published
- [`docs/meet-pricing-roadmap.md`](docs/meet-pricing-roadmap.md)
  documents how Suite implements each piece (read fresh today), what
  our schema already supports (it's already there from v0.10.x), and
  the 8-phase implementation order. Two decision points flagged for
  Sjoerd: Stripe Connect onboarding style (paste vs OAuth) and
  whether PayPal ships at all (recommend skip).

### Honest scope
This commit ships Phase 1 only (intake). Phases 2-6 (Stripe Connect,
Checkout, invoice mode, refunds, invoice numbering+email) are queued
in priority order. PayPal (Phase 7) and Tax (Phase 8) are recommended
as defer-unless-asked.

## [0.12.8] — 2026-05-17

### Click-to-open booking popup everywhere; Month calendar grid; per-contact appointment list

### Added
- **Shared `BookingDetailsDialog`** (`components/booking-details-dialog.tsx`)
  — one modal renders booking info from any surface. Used by Dashboard
  "Next up", Bookings list, and the Contact popup. Has Join, Cancel,
  and Close buttons.
- **`ClickableBookingRow`** wrapper — turns any server-rendered row
  into a click target that opens the dialog. Reused across surfaces.
- **Bookings → Month view** is now a real 6×7 calendar grid (Mon-first
  weeks, days outside the month dimmed, today's number in a filled
  pill). Each day cell shows up to 3 booking chips ("HH:MM Name")
  plus "+N more" overflow. Chips click straight to the dialog.
- **Contact popup → Appointments list.** Lazy-loaded via a new server
  action `listContactBookings(email)` calling
  `GET /api/v1/meet/bookings?invitee_email=…`. Each row clicks to
  the same `BookingDetailsDialog`.
- **API**: `GET /api/v1/meet/bookings` accepts `?invitee_email=` to
  scope a result list to a single person.

### Changed
- **Bookings view toggle** (`List / Week / Month`) is now icon-only —
  the labels are in `title` + `aria-label` for screen readers.
- **Bookings list rows** lost the inline "Join" link (it's in the
  popup now) and gained a `cursor-pointer` row hover.

### Honest gap
- **Week view** is still the previous day-grouped list, not a
  Google-Calendar-style 7-column hour grid. The Month grid lands
  first because it's the higher-leverage view; Week-as-hour-grid is
  queued as a separate change (~half-day's work).
- **Reschedule** still doesn't atomically cancel+rebook — same v0.12.7
  caveat applies; the popup's cancel link routes to the existing
  cancel page.

## [0.12.7] — 2026-05-17

### Booking confirmation gets a card + real buttons; per-MT "show on overview" toggle

### Added
- **`is_public_listed` on `meet_meeting_type`** (migration
  `20260517230000_meet_mt_public_listed.sql`). Default `true`.
  When `false`, the MT is bookable via its direct link but omitted
  from `/api/v1/meet/public/host/:slug` and `/api/v1/meet/public/team/:slug`.
- **Visibility section on the Availability tab** with a checkbox:
  "Available on personal overview page". Wires to the new column.
- **`MeetingTypeUpsert` zod schema** accepts `is_public_listed`.

### Changed
- **Booking confirmation page** (`/[hostSlug]/[mtSlug]/confirmed/[bookingId]`)
  redesigned as a floating card on `bg-neutral-50` to match the
  booking-page card style. Two real buttons replace the plain link:
  **Reschedule** (goes to the booking page so the invitee can pick a
  new time — the old booking persists, cancel separately) and
  **Cancel** (goes to the existing cancel flow). "← Back to host" lives
  in a subtle footer band.

### Honest gap
"Reschedule" currently just re-opens the booking flow; the old slot is
not auto-cancelled. A proper reschedule (atomic cancel+rebook with a
single email) is a follow-up.

## [0.12.6] — 2026-05-17

### Fix: saving from any non-Basics tab returned 400 (slug/name missing)

Each tab in the meeting-type editor was conditionally mounted, so
switching to Conferencing/Availability/Pricing/Intake unmounted the
Basics tab and dropped `name` + `slug` from FormData on submit. The
API rejected with 400 (slug too short, name required) — exactly what
the user saw clicking Save from the Conferencing or Availability
tab.

### Changed
- **`apps/meet/app/(app)/meeting-types/form.tsx`** — every tab is now
  rendered in the DOM at all times and just hidden via the `hidden`
  Tailwind class when inactive. All form inputs are present in
  FormData regardless of which tab the user is on.
- **Zoom + Microsoft Teams** in the Conferencing provider dropdown
  now show "— coming soon" and are unselectable (`<option disabled>`).
  They had been pickable but generated no meeting URL on booking.
- **`apps/meet/components/ui/field.tsx` `SelectField`** option shape
  gains `disabled?: boolean` (and appends "— coming soon" automatically).
  General-purpose so other forms can mark not-yet-built options too.

## [0.12.5] — 2026-05-17

### Editor Event-type dropdown now mirrors the "+ New" menu

The in-editor Event-type select used to be a plain native dropdown
showing only the label. Now it's a rich popover with the same icon,
"1 host → N invitees" sub-line, and one-line description the user
saw when creating the MT — so they can always tell what the meeting
type actually does.

### Changed
- **New shared component** `apps/meet/components/event-type-picker.tsx`
  — single source of truth for `EVENT_TYPES` metadata, the menu-row
  presentation (`EventTypeMenuList`), and a controlled
  `EventTypePicker` for the editor.
- **`apps/meet/app/(app)/meeting-types/new-menu.tsx`** now imports
  `EventTypeMenuList` instead of duplicating the rows. The "+ New"
  menu UX is byte-identical; just deduplicated.
- **`apps/meet/app/(app)/meeting-types/form.tsx`** — Event-type
  `SelectField` replaced with `<EventTypePicker>`. The trigger button
  shows the current event type's icon, label, and "1 host → 1 invitee"
  sub; clicking opens the same six-row popover the New menu uses,
  with team-only types disabled and labelled "Switch to Team scope to
  use this." Hint text under the picker is the option's description
  (e.g. "Coffee chats, intro calls, 1:1 reviews.").
- Local duplicate `EVENT_TYPES` array in form.tsx deleted.

## [0.12.4] — 2026-05-17

### Fix: MT save 500 — `conflict_calendar_ids` NOT NULL violation

Save failed on team-flip with "null value in column
conflict_calendar_ids violates not-null constraint". The column is
`uuid[] not null default '{}'` but the UI sends `null` to mean "use
host default."

### Changed
- **API: POST and PATCH `/meeting-types`** coerce
  `conflict_calendar_ids: null` → `[]` server-side so third-party
  callers don't have to know which columns are nullable. v0.12.3's
  improved error surfacing made this diagnosable in one save attempt.
- **Meet's sidebar VERSION constant** had been stuck at `0.9.0` while
  package.json marched up. Both web and meet now bump in lockstep
  (apps/meet/app/(app)/layout.tsx).

## [0.12.3] — 2026-05-17

### Surface API error detail on MT save instead of bare "API 500"

Sjoerd reported a 500 on flipping a personal one_on_one MT to team
collective. The form just said "API 500" — no actionable detail.

### Changed
- `apps/meet/app/(app)/meeting-types/actions.ts` — both
  `createMeetingType` and `updateMeetingType` now pull
  `error`/`details`/`code` out of the response body via a shared
  `formatApiError()` and render that string in the form's red banner.
- Paired with the structured stderr logging from v0.12.2, the next
  500 is fully diagnosable: the Postgres message (e.g. unique
  index name, RLS hint, CHECK constraint name) shows up inline in
  the UI **and** in `fly logs -a thefibre-api`.

## [0.12.2] — 2026-05-17

### Harden PATCH /meeting-types/:id; trace what gets persisted

User reports team scope flips back to personal after save+reload on
prod. Couldn't reproduce from a code read — every path traces to "this
should work." Two changes ship together:

### Changed
- **Mirror the POST guard on PATCH.** Previously only the create path
  verified the caller is a lead of the destination team; the update
  path accepted any team_id. Now PATCH 403s if the caller isn't a
  lead. Defence-in-depth and removes one class of "silent succeed,
  row not visible" scenarios.
- **Structured logging on every PATCH outcome.** Logs the requested
  team_id/event_type vs what came back from the DB. RLS failures get
  full code/details/hint logged. Next time someone reports this, the
  Fly log (`fly logs -a thefibre-api`) tells us in one line whether
  the API even got the team_id, whether the DB accepted it, and what
  came back.

### Why this matters
Brief reviewer note (v0.3 retro): "open the API log first, hypothesise
second." This commit makes that possible for the MT save path.

## [0.12.1] — 2026-05-17

### Fix: `/settings/availability` crashed in prod

`WorkingHoursEditor` reads `value[day].length` for each of the seven
days, but the three callers passed `working_hours` straight from the
API with a `as Schedule` cast. Any saved row missing a day key
(common — Saturday/Sunday often absent) crashed React on mount with
"client-side exception."

### Changed
- All three callers (settings page, settings/availability, meeting-type
  editor) now use the existing `coerceSchedule()` helper from
  `components/working-hours-editor.tsx`, which guarantees all 7 day
  keys are present (empty array per missing day) before the editor
  ever reads them.

## [0.12.0] — 2026-05-17

### Added: One-off and Meeting-poll event types

The last two stubs in the New-Meeting-Type chooser ship for real. Fibre Meet
now supports every event type drawn on the original wall: One-on-one, Group,
Round-robin, Collective, **One-off**, and **Meeting poll**.

### Changed
- **New migration `supabase/migrations/20260517210000_meet_one_off_and_poll.sql`**
  adds `fixed_starts_at`/`fixed_ends_at` (nullable timestamptz with paired
  CHECK + window CHECK) to `meet_meeting_type`, and creates two tables for
  polls: `meet_poll_slot` (composite PK `(meeting_type_id, starts_at)`) and
  `meet_poll_vote` (one row per `(voter, slot)`, deduped via UNIQUE). RLS on
  both poll tables defers to the parent meeting type — if you can see the
  MT, you can see its slots and votes.

- **API: `MeetingTypeUpsert` zod schema** accepts `one_off` and `poll` as
  `event_type` values, plus optional `fixed_starts_at` / `fixed_ends_at`
  datetimes.

- **API: `POST /api/v1/meet/public/bookings`** validates `starts_at` against
  the MT's `fixed_starts_at` for one-off bookings, rejects with
  `409 wrong_fixed_time` on mismatch. Capacity from v0.11.1 is reused —
  default 1 (single-attendee interview), but the editor offers the same
  CAPACITY_OPTIONS dropdown so a one-off can also be a small group event.
  Poll MTs are not bookable directly (`400 poll_not_bookable`).

- **API: slots endpoints** (`/public/host/.../slots` and team variant)
  short-circuit for `one_off` (return just the fixed slot with `slots_meta`)
  and `poll` (return `{ slots: [] }`). Public MT GET endpoints attach
  `poll_slots: [{starts_at, ends_at}]` when the MT is a poll.

- **New auth'd endpoints** on `apps/api/src/routes/meet.ts`:
  `GET /meeting-types/:id/poll` (slots + votes for the host),
  `PUT /meeting-types/:id/poll-slots` (replace candidate slots, 2–5),
  `POST /meeting-types/:id/confirm-poll-slot` (flip a poll into a one-off
  with `fixed_starts_at` = winning slot — see "trimmed scope" below).

- **New public endpoint** `POST /api/v1/meet/public/poll-votes` lets an
  invitee submit `{ meeting_type_id, voter_email, voter_name,
  slot_starts_ats[] }`. Re-submission from the same email replaces that
  voter's existing rows (so changing your mind just works). Bypasses RLS
  via `adminClient` like the rest of `/meet/public/*`.

- **UI: Meeting-type editor** (`apps/meet/app/(app)/meeting-types/form.tsx`):
  the event-type dropdown adds One-off and Meeting poll for personal scope
  too. When One-off is selected, the Availability tab disappears and a
  "Date & time" `<input type="datetime-local">` + Capacity dropdown appear
  on Basics. When Meeting poll is selected, the Availability tab is
  relabelled **Candidate slots** and renders a dedicated editor with 2–5
  datetime rows + Add/Remove buttons. Slots save out-of-band via the new
  `savePollSlots` server action.

- **UI: MT detail page** (`apps/meet/app/(app)/meeting-types/[id]/page.tsx`)
  loads `/meeting-types/:id/poll` for poll MTs and renders a new
  **`PollVotesMatrix`** (`votes.tsx`) — voters down rows, candidate slots
  across columns, ✓ in each cell where the voter ticked. Each column header
  shows vote count + a "Confirm" button that calls the confirm-poll-slot
  endpoint.

- **UI: New-MT chooser** (`new-menu.tsx`): both `disabled: true` flags
  removed; One-off + Meeting poll are now bookable from the menu.

- **UI: Public booking page** (`apps/meet/app/[hostSlug]/[mtSlug]/`):
  `BookingFlow` branches on `event_type`. One-off renders a single
  "Scheduled for {datetime}" block + name/email + "Confirm attendance".
  Poll renders a checkbox list of the candidate slots + name/email +
  "Submit votes", with a thank-you state on success.

### Trimmed scope (documented gap)
"Confirm this slot" on a poll currently just flips the MT into `one_off`
with the winning slot set as `fixed_starts_at`. **It does not auto-create
bookings for every voter who ticked that slot, and it does not email the
losing voters that the poll closed.** The host gets a stable one-off MT
URL they can share again to collect attendance confirmations. Auto-booking
+ poll-close email notifications are the obvious next pass; they were
trimmed because they triple the surface area (template wiring + Resend
batch send + idempotency) without adding much for v1 use.

### Gotchas
- `<input type="datetime-local">` reads as local time. The form converts
  to UTC ISO before sending so the API stores in UTC. Read-back goes
  through `toLocalDatetimeInput()` which formats in the host's local tz.
- Poll slot rows persist after a poll is "confirmed". They aren't read
  by any active code path but show up in an erasure export — that's
  fine and arguably useful (audit trail of which slots existed).
- `meet_poll_vote.UNIQUE(meeting_type_id, voter_email, slot_starts_at)`
  + the "delete-then-insert" replace pattern means a fast double-submit
  could in theory cause a unique-violation on a race. The delete-then-
  insert isn't wrapped in a transaction; if it surfaces we'll wrap in
  one. Not a v1 blocker.

## [0.11.1] — 2026-05-17

### Added: Fibre Meet Group event type

Fibre Meet's "Group" event type is no longer a stub. A single host can now
offer slots that multiple invitees share until a per-MT capacity is reached.

### Changed
- **New column `meet_meeting_type.capacity`** (nullable integer, CHECK > 0)
  in `supabase/migrations/20260517200000_meet_group_capacity.sql`. Only
  meaningful when `event_type='group'`. Bookings are grouped by the
  existing `(meeting_type_id, starts_at)` tuple — no extra `slot_key`
  column needed.
- **API: `POST /api/v1/meet/public/bookings`** now performs a capacity
  check before insert when the MT is `event_type='group'`. If the
  confirmed-booking count for `(meeting_type_id, starts_at)` already
  meets capacity, the request is rejected with `409 { error: 'fully
  booked', code: 'slot_full' }`. No waitlist yet — that's a follow-up
  behind a per-MT toggle.
- **API: slots endpoints** (`/public/host/.../slots` and
  `/public/team/.../slots`) skip the MT's own bookings from the host's
  busy intervals when `event_type='group'` (so the slot stays bookable
  until full), and return a parallel `slots_meta` array with
  `{ starts_at, capacity, booked, remaining }` per slot. Fully booked
  slots are removed from `slots` entirely.
- **API: `MeetingTypeUpsert` zod schema** accepts `capacity` (int 1–1000,
  nullable). Server stores it on create + update.
- **UI: Meeting-type editor** (`apps/meet/app/(app)/meeting-types/form.tsx`):
  the event-type chooser now also shows up in Personal scope (since Group
  is single-host). Personal scope offers One-on-one and Group; Team scope
  adds Round-robin and Collective. When Group is selected, a curated
  "Capacity" dropdown appears in Details (2/4/6/8/10/12/15/20/30/50,
  default 12).
- **UI: New-MT chooser** (`apps/meet/app/(app)/meeting-types/new-menu.tsx`):
  the Group option is no longer `disabled: true`.
- **UI: Public booking page** (`apps/meet/app/[hostSlug]/[mtSlug]/`):
  Group MTs show a `Users` icon row in the sidebar ("Up to N invitees
  per slot"), and each time-slot button shows "X of Y left" pulled
  from `slots_meta`. If a slot happens to fill while the user is on
  the page, the 409 surfaces as "This slot just filled up. Please
  pick a different time."

## [0.11.0] — 2026-05-17

### Added: GDPR Article 15 self-service data export

The Privacy page's "Export my data" card is no longer a "Coming soon"
stub. One click downloads a single JSON file containing every piece of
personal data The Fibre stores about the caller, across every app.

### Changed
- **New endpoint `GET /api/v1/privacy/export`** in `apps/api/src/routes/privacy.ts`.
  Pulls in parallel from `user`, `person`, `user_identity_provider`,
  `app_membership`, `workspace_member`, `org_membership`, `activity`,
  `meet_booking`, `person_professional`, `person_change_context`,
  `person_relationship_context`, `person_learning`, `person_billing`,
  `person_tag`, `consent_record`, `data_subject_request`,
  `app_record_link`, `relationship` (outgoing + incoming) and the
  caller's `workspace`. Top-level `_meta.included_categories` lists
  every category considered, so a receiver can verify completeness.
- Uses `adminClient` (RLS bypass) with an explicit
  `user_id`/`person_id`/`workspace_id` filter on every query. Article
  15 supersedes UI-level app-membership scoping: a user is entitled
  to their `person_billing` row even if they don't currently hold the
  Sales app membership.
- Side-effect: each successful export writes a `data_subject_request`
  row of type `access`, status `completed`, for the audit trail.
- Response sets `Content-Disposition: attachment;
  filename="fibre-data-export-{email-slug}-{YYYY-MM-DD}.json"` so
  browsers save the file with a meaningful name.

- **New Next.js route handler** at `apps/web/app/(app)/privacy/export/route.ts`.
  Vercel-side proxy that forwards the user's Supabase access token to
  the API and streams the JSON response back. Hard rule §13 still
  holds — Vercel forwards bytes, never reads the payload.

- **`ExportButton` on the Privacy page.** Client component that
  fetches `/privacy/export`, materialises the response into a Blob,
  reads `Content-Disposition` for the filename and triggers a download
  via a synthetic `<a download>`. Shows "Preparing…" while in flight
  and an inline error if the export fails.

### Why this matters
Article 15 is the right of access. Until v0.10.4 we had the right of
erasure (Article 17) wired up but no way for a user to *see* what we
held about them — only what the UI surfaced. v0.11.0 closes that gap.
"The app justifies the field" (brief §5) means every field has a
reason to exist; Article 15 means every field also has to be
disclosable on demand. The export covers both first-party apps
(Platform, Meet) and any third-party app that has registered itself
in `app` and written into `app_record_link`.

### Gotchas / follow-ups
- The export currently runs synchronously in a single request. Fine
  for the current shape of data (one user, a few hundred rows at
  most). If a workspace ever sees an activity log in the thousands
  per person, move to a background job + presigned download URL.
- `relationships` is split into `outgoing` / `incoming` to keep
  semantics clear (some types like `introduced_by` are directional).
- `_meta.subject` is the canonical identity bundle for the export —
  if a receiver (e.g. a different controller) needs to know "who is
  this file about", that's the block to read.

## [0.10.4] — 2026-05-17

### Fix: Meet was showing the full workspace contact graph

Brief §5 ("the app justifies the field") and §13 (data wall) say each
app sees what it has a reason to see. The Meet Contacts page was
returning every `person` in the workspace — a quiet leak across the
app boundary.

### Changed
- **`GET /api/v1/meet/contacts`** now scopes to persons Meet justifies
  knowing about: invitees on any `meet_booking`, plus members of any
  `meet_team` in the workspace. Two-source UNION, computed in the
  route. Everyone else is no longer returned.
- Each row carries a `source: ('booking' | 'team')[]` field plus
  `is_team_member`, so the UI can explain *why* a person is surfaced
  (and so future audits can replay the justification).
- Meet Contacts page description updated to match. Two new chips on
  each row: `Team` and `Booked`. Empty state now reads "No-one has
  booked yet, and your teams have no members."

### Why this matters
This was the exact pattern the data wall is designed to prevent: an
app sees data it didn't earn. The Fibre platform is the source of
truth for identity; Meet only surfaces the slice tied to its own
records. Sales, Learn, Thread will follow the same shape when they
ship contact views.

## [0.10.3] — 2026-05-17

### Third-party apps can now identify themselves end-to-end

The two blockers a real third-party connector hits on day one are
fixed. An external app registered in `public.app` can call the API as
itself and push activities using its own type names.

### Changed
- **`X-App-ID` accepts any registered app slug.** The middleware's
  hardcoded enum (`fibre-platform`, `fibre-meet`, etc.) is replaced
  with a cached lookup against `public.app` (5-min TTL, refresh on
  miss). Once `mailchimp` is in the table, `X-App-ID: mailchimp` works
  on the second request at the latest. Unknown slugs now return a
  clearer `unknown-app-id` problem instead of the generic
  `missing-app-id`.
- **`activity.type` is no longer enum-locked.** Replaced the
  `z.enum(ACTIVITY_TYPES)` validator with a snake_case regex
  (`^[a-z][a-z0-9_]{1,63}$`). Manifest-declared types like
  `newsletter_opened` are accepted directly. `subject` is still
  length-limited per brief §6 — type is just a machine label, content
  belongs in subject.
- **Demo script** now calls in as `mailchimp` with type
  `newsletter_opened` — no more workaround comments.
- **Third-party guide** trimmed: those two gaps moved from "Open gaps"
  to "Done".

## [0.10.2] — 2026-05-16

### Cross-app entity mapping — docs + runnable third-party demo

The schema (`app_entity_mapping` + `app_record_link`) and the four
`/api/v1/apps/...` routes have been live since v0.10.x but only Meet
used them internally. This release closes the documentation gap so an
external integrator can pick up the surface end-to-end, plus a worked
example script.

### Added
- **`docs/third-party-app-guide.md`** — step-by-step walkthrough:
  manifest format → register the app + mappings → link records → push
  activities → reverse lookup. Honest about every gap a third party
  hits today (no external `X-App-ID`, no API keys, no self-register
  endpoint, no bulk linking, no curator-data write API, scopes
  unenforced, custom activity types unmerged).
- **`apps/api/scripts/demo-third-party-app.mjs`** — ~180-line idempotent
  Node script that simulates a "Mailchimp" connector: registers the
  app, declares an entity mapping, links three subscribers (two
  existing EBBF persons + one created via `create_if_missing`), pushes
  activities, and reverse-looks-up the link + full person row. Run
  with `FIBRE_JWT=… node scripts/demo-third-party-app.mjs`.

### Changed
- **`docs/cross-app-entity-mapping.md`** — removed the "draft, before
  any code" framing now that everything in §"The model" has shipped.
  Added a "What actually shipped" section that maps each piece of the
  proposal to a file (migration / route / manifest) and lists the seven
  still-open gaps.

## [0.10.1] — 2026-05-16

### Per-app curator-data labelling reaches the org side

The pattern shipped for contact profiles (chip on each curator-data
section + app suffix on every "Edit X" dialog title) now lands on
organisation profiles too — so a viewer always knows which app justifies
a given field.

### Changed
- `organisations/[id]/app/[appSlug]` — "System context" gets a
  `Fibre Meet` chip; "Commercial relationship" and "Invoicing" get a
  `Fibre Sales` chip. Uses the same `AppChip` component as the contact
  side.
- Edit dialog titles: "Edit system context — Fibre Meet", "Edit
  commercial relationship — Fibre Sales", "Edit invoicing details —
  Fibre Sales".

## [0.10.0] — 2026-05-16

### Auth emails now route through our API — branded, with SPoT

Supabase's "Send Email" hook is configured to call our API for every
auth email (signup, sign-in, magic link, invite, password reset, email
change, reauthentication). The API renders the email from
`packages/shared/src/branding.ts`, so a rename or white-label is one
file change. End-to-end verified: logo, headline, 8-digit code box,
CTA, and footer all arrive correctly.

### Added
- **`POST /api/v1/auth-hook/email`** — handles the Supabase Send Email
  Hook. HMAC-SHA256 verification per the standardwebhooks spec; renders
  via `auth-templates.ts`; sends via Resend.
- **Eight auth email types** rendered in Thread-style identity: centred
  Fibre wordmark, "Almost there" headline, big code box, optional CTA,
  reassurance paragraph, divider, Help/About/Legal footer + whitelist
  hint + legal address line.
- **`BRAND_ASSETS`** on `packages/shared` — logo URL, native dimensions,
  alt text. Single source of truth for the wordmark across web + emails.
- **The Fibre wordmark** hosted at `https://thefibre.app/brand/the-fibre.png`
  (1404×704 PNG, served from `apps/web/public/brand/`).
- **`/sign-in` page** on `thefibre.app` exposing the same Google +
  8-digit email-code flow Meet has on its landing.

### Changed
- Sign-in input accepts **8 digits** (matches Supabase OTP length).
- `legalFooterLine()` no longer includes the legal entity name on public
  surfaces. `ENTITY.name` (Solidarity Lab B.V.) remains in `branding.ts`
  for internal billing / invoicing.
- Fly machine pinned to `min_machines_running = 1`, `auto_stop_machines = off`
  — Supabase auth hooks have a 5s ceiling, cold starts blow it.
- HMAC secret parser accepts `v1,whsec_xxx`, `whsec_xxx`, or bare base64
  so dashboard copy-paste just works.

### Sjoerd action
- Rotate the Resend API key still pending from v0.8.0.

## [0.9.0] — 2026-05-17

### Permission tiers — within-workspace visibility lands

The platform's access model grows a second axis. Workspaces no longer treat
every member as "sees everything"; visibility is per-resource (each Meet team,
program, etc. carries `members_only | org_wide`) and users carry a
`relationship_type` (`internal | external`) that decides whether they get the
org-wide widening. See `docs/permission-tiers-proposal.md` for the resolved
model and `docs/fibre-vs-app-data.md` for how this slots into the brief.

### Added
- **`public.workspace_member`** pivot table (`user_id`, `workspace_id`,
  `workspace_role` = admin|member, `relationship_type` = internal|external,
  `member_status`). Multi-org ready from day one — a person can be a user in
  multiple organisations cleanly when we need it.
- **`visibility` column** on `meet_team` and `program`, default `members_only`,
  opt-in `org_wide`. Editable by leads / org admins via the team detail page.
- **`can_see_person()`, `can_see_organisation()`, `can_see_activity()`,
  `is_workspace_admin()`** — all `SECURITY DEFINER` SQL helpers, granted only
  to `authenticated`. `can_see_person` covers six clauses (admin / self /
  shared Meet team / shared program enrolment / org_wide widening for
  internals / hosted-a-booking with them).
- **RLS rewritten** on `public.person`, `public.organisation`, `public.activity`
  (SELECT), and `public.meet_booking`. Workspace check stays as the cheap
  pre-filter; the helper provides the per-row gate.
- **API endpoints**:
  - `POST /teams/:id/members` + `POST /internal-team` accept
    `relationship_type` for new users.
  - `PATCH /teams/:id` accepts `visibility`.
  - `PATCH /internal-team/:userId` (admin-only) flips `workspace_role`,
    `relationship_type`, `member_status`.
  - `GET /internal-team` returns the per-row workspace_role +
    relationship_type + member_status.
- **UI**:
  - Team invite form + Internal-team invite gain a Relationship select.
  - Team detail page gains a Visibility card (radio: members_only / org_wide).
  - Internal-team page renders role + relationship chips; admins see editable
    selects.

### Backfill
- Every existing `user` row gets a `workspace_member` row.
  `workspace_role='admin'` iff they hold a `fibre-platform` `app_membership`
  with role `admin`; otherwise `member`. `relationship_type='internal'` for
  all. All existing teams + programs start `members_only`.

### Migration
- `20260517000000_permission_tiers.sql` — schema + helpers + RLS + backfill.

### Behavioural change to watch
Workspaces that previously had everyone-sees-everything now scope per
resource. The seeded `sjoerd@soul.com` workspace is unaffected (single admin
sees everything via the admin shortcut). When you invite future members,
choose Internal or External; Internal users see org-wide things, External
only see resources they're explicitly added to.

## [0.8.0] — 2026-05-16

### Suite v2 — Fibre Meet matures into a real scheduler

This release lands the rest of the Suite UI port and the structural primitives
underneath it. Most of the changes are visible in commits 92ea693 …
through d74dae9 over the day. See `docs/meet-architecture.md` for the running
reference and `docs/meet-api.md` / `docs/meet-data-model.md` for endpoint + schema docs.

### Added — invite-by-email + two-step accept (team invites)
- Inviting an email that doesn't yet have a workspace user pre-creates a `user` + paired `person`, grants `fibre-meet` membership, and writes a `meet_team_member` row with `status='invited'` plus a unique `invite_token`. The invitee gets an email pointing at `meet.thefibre.app/invite/<token>`.
- New public `/invite/[token]` accept page peeks at the invite (no auth), prompts sign-in if needed, and on Accept flips status to `active`, clears the token, and seats the user in the right workspace.
- Pending invites are excluded from round-robin / collective rosters and from the user's own `/teams` list — they only count once accepted.
- Lead-only actions on the team detail page: **Copy link** (so the lead can DM the URL when email is unreliable), **Resend** (rotates the token + re-emails), **Revoke**.
- API: `POST /teams/accept-invite/:token`, `GET /public/invite/:token`, `POST /teams/:id/members/:userId/resend-invite`.

### Added — identity invariant: every workspace user has a paired `public.person`
- Both invite paths (team-member + internal-team) now create a `person` and link `user.person_id` both ways.
- New SECURITY DEFINER helper `public.ensure_user_person(user_id)` called from `resolve_sso_identity()` on every match path so the invite-then-signin flow completes the link.
- Startup heal block in the migration cleans up legacy rows (`person_id IS NULL`).
- Meet's `/contacts` page rewritten to read from `public.person` (workspace-scoped) instead of aggregating from `meet_booking`. Meet decorates each person with its booking summary — that's the curator data it justifies.

### Added — meeting-type editor as tabs + per-MT overrides
- Tabbed editor in the Suite layout: **Basics / Availability / Conferencing / Pricing / Intake**, with a sticky save bar at the top and white cards on a light grey background.
- Personal vs Team is a 2-card chooser (clicking Team reveals a Team dropdown below — no select-in-a-select, no sub-picker in the New menu).
- Duration / buffer / notice / advance are curated dropdowns (`None / 15 min / 30 min / …` / `1 day / 7 days / …`) instead of free-form number inputs.
- New columns: `meet_meeting_type.working_hours_override jsonb`, `meet_meeting_type.conflict_calendar_ids uuid[]`. NULL falls back to host defaults. The single-host slots endpoint respects both overrides; team route uses `buildPerHostArgs` which picks them up automatically.

### Added — Calendars role management + Re-sync
- `POST /api/v1/meet/calendars/sync` re-pulls the calendar list from Google without re-doing OAuth.
- `minAccessRole: 'reader'` so subscribed / shared calendars surface (previously only owner-tier rows did).
- `meet_calendar.role` now accepts `ignore`; ignored calendars are excluded from freebusy.
- Suite-style Calendars page: card list with a role dropdown per row (Primary / Conflict source / Write target / Ignore) and a Re-sync button.

### Added — Connections (formerly Integrations) consolidates external services
- Personal meeting room URL moved from Profile → Connections (it lives with Zoom/Whereby links, not personal identity).
- Google Calendar connect/disconnect stays here.

### Added — design canon
- Lucide icons across the board (Settings cards, bookings view toggle, new-MT menu, public booking meta). No emoji icons anywhere.
- Unified slug UX in `apps/meet/components/ui/name-slug.tsx`: `[prefix/]  [editable slug]  [Alt]`. Auto-fill from name; Alt regenerates a `<slug>-<rand>` variant. Profile slug field follows the same visual pattern.
- `PageContainer` left-aligned (drops `mx-auto`) — content sits next to the sidebar instead of being centered in the viewport.
- Public-booking page bg neutral-50 with a single white split-card; matches Suite's layout.

### Migrations
- `20260516000000_meet_calendar_ignore_role.sql` — adds 'ignore' to `meet_calendar.role`.
- `20260516010000_sso_link_existing_person.sql` — `ensure_user_person()` helper + updated `resolve_sso_identity()` + startup heal.
- `20260516020000_meet_team_member_pending.sql` — `status` + `invite_token` + `invited_at` + `accepted_at` on `meet_team_member`.
- `20260516030000_meet_meeting_type_overrides.sql` — `working_hours_override jsonb` + `conflict_calendar_ids uuid[]`.

### Fixed
- The earlier "no calendars syncing" — Google Calendar API hadn't been enabled in the Cloud Console project. The error path now logs the underlying message; Sjoerd enabled the API and Re-sync works.
- PKCE `code_verifier` mismatch on second sign-in — documented (stale cookies; use a fresh window).
- Fly machine lease stuck after a half-completed deploy — documented (wait it out).

### Required production secrets (Fly)
Unchanged: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SSO_INTERNAL_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.

### Operational note
The Resend API key used during this release ended up visible in a development screenshot. **It must be rotated** before the next release: Resend dashboard → API Keys → delete + recreate → `fly secrets set RESEND_API_KEY=…` from repo root.

## [0.7.0] — 2026-05-15

### Added — Fibre Meet step 7 (Round-robin + Collective)
- **Event types on meeting types.** New `event_type` column on `meet_meeting_type` with values `one_on_one` (default), `round_robin`, `collective`, and a reserved `group`. Only team-owned meeting types may use the multi-host modes (enforced by a CHECK constraint).
- **`meet_meeting_type_assignee`** table — eligible team members per MT, with one row marked `is_primary`. Lead-only writes, gated by the existing `meet_is_team_lead()` security-definer helper (no recursion).
- **Multi-host slot composition.** `generateMultiHostSlots(mode, hosts[])` in the availability engine — UNION for round-robin (slot bookable if any host is free), INTERSECTION for collective (every host must be free). Per-host args include each host's own working_hours, busy intervals, and Google freebusy.
- **Team slots endpoint** rewritten to dispatch on `event_type`: loads the assignee roster, builds per-host args (including GCal freebusy in parallel), and returns the right union/intersection. Falls back to single-host mode for `one_on_one`.
- **Team booking POST** now picks the host:
  - `round_robin` — least-loaded eligible host who's free at the chosen slot (rejects with 409 if nobody available).
  - `collective` — primary assignee runs the canonical GCal event; the other assignees are added as event attendees and receive the host-notification email.
- **Google event** supports `extraAttendees` — used to invite the team to a collective booking on one event.
- **Meeting-type editor** learned an "Event type" selector (only shown when team-owned), dynamic hint per option. The detail page renders an **Assignees** section for round-robin / collective MTs with a per-team-member checkbox + primary radio.
- **Assignee CRUD API**: `GET /api/v1/meet/meeting-types/:id/assignees`, `POST` (lead-only; auto-clears prior primary), `DELETE /:userId`.

### Migration
- `20260515030000_fix_team_member_rls_recursion.sql` (shipped between 0.6.0 and 0.7.0) — replaced the self-referencing `meet_team_member` write policy with a `SECURITY DEFINER` `meet_is_team_lead()` helper + split per-verb policies, fixing Postgres `42P17 infinite recursion`.
- `20260515040000_meet_event_types.sql` — adds `event_type` + the `meet_meeting_type_assignee` table with full RLS (read = workspace + fibre-meet; write = team lead via `meet_is_team_lead`). Partial unique index enforces at-most-one-primary-per-MT.

## [0.6.0] — 2026-05-15

### Added — Fibre Meet step 5 (emails + cancel)
- **Booking emails.** Resend-backed transactional emails sent on every booking: a branded confirmation to the invitee (with cancel link) and a notification to the host. Cancellations send to both sides. Plain-text + HTML, formatted in the host's timezone. Templates live in `apps/api/src/lib/email/templates.ts`; transport in `apps/api/src/lib/email/client.ts`. No-ops with a `[email] would send: …` log line when `RESEND_API_KEY` is unset so dev and CI don't need outbound mail.
- **Cancel flow.** New public endpoint `POST /api/v1/meet/public/bookings/:id/cancel` flips the booking to `cancelled`, deletes the linked Google Calendar event (best-effort), and emails both sides. New cancel page at `/[hostSlug]/[mtSlug]/cancel/[bookingId]` with a confirmation step. The confirmation page now surfaces "Need to cancel or reschedule?".

### Added — Fibre Meet step 6 (Teams)
- **Teams.** New `meet_team` + `meet_team_member` tables. A team is a workspace-scoped slugged group with its own member list (roles: `lead` / `member`). Each team gets its own public booking page at `meet.thefibre.app/<team-slug>`. Meeting types can be owned by a team instead of a single host — the meeting-type editor learned a new "Owned by" selector.
- **Shared root namespace.** New `meet_root_slug` table, populated by triggers from `meet_host` and `meet_team`. Single-segment URLs (`/<slug>`) resolve unambiguously to one host or one team per workspace; slug collisions are rejected at create time.
- **Team CRUD + members API.** `GET/POST /api/v1/meet/teams`, `GET/PATCH /:id`, `POST /:id/members` (resolves email → workspace user), `DELETE /:id/members/:userId` (refuses to remove the last lead). Creator becomes lead automatically.
- **Public team booking.** `/api/v1/meet/public/team/:slug`, `/.../mt/:mt_slug`, `/.../mt/:mt_slug/slots`. The Meet front-end dual-resolves any root slug — tries host first, falls back to team — so the same booking flow renders both. The booking flow client accepts an `ownerKind` of `host | team` and picks the matching slots URL.
- **Teams UI.** New /teams list, /teams/new, and /teams/[id] detail with member management. The Meet sidebar gained a Teams nav item.
- **Meeting types page** now groups by Personal + per-team sections, each showing the correct public URL.

### Migration
- `20260515020000_meet_teams.sql` — adds `meet_team`, `meet_team_member`, `meet_root_slug` (with sync triggers), `meet_meeting_type.team_id` column + two partial unique indexes (per-host slug when personal, per-team slug when team-owned), full RLS (workspace + fibre-meet membership; team-member writes gated to leads). Backfills the root-slug table for existing hosts.

### Required env (production)
- `RESEND_API_KEY` and `EMAIL_FROM` on the API host (Fly) for emails to actually send.

## [0.5.1] — 2026-05-14

### Added
- **Per-workspace app activation.** New `workspace_app` table records which apps a workspace has turned on; independent of per-user `app_membership`. New page **Settings → Apps** lists the four installable apps (Fibre Meet, The Thread, Fibre Sales, Fibre Learn) with descriptions and an Activate / Deactivate toggle. Workspace-admin gated (`fibre-platform` role=admin in the current workspace) — non-admins are redirected back to Settings.
- **API endpoints** `GET /api/v1/workspace-apps`, `POST /api/v1/workspace-apps` (activate + auto-grant the activating user a `role='admin'` app_membership), `DELETE /api/v1/workspace-apps/:slug` (soft deactivate — keeps history so old activity rows still resolve their app).
- **Super admin** as a first-class concept. New boolean `is_super_admin` on `public.user`, with SQL helper `public.is_super_admin()`. Sjoerd promoted in the migration. The signup_request admin page and its RLS policies now gate on super-admin (cross-workspace concern). Workspace admins still see their own workspace settings and the Apps page.
- **New workspaces auto-grant** their first user `fibre-platform` role=admin via `resolve_sso_identity()`, so approved applicants land with workspace-admin rights in their own workspace from minute one.

### Changed
- **Dashboard "Your apps"** card now reads from `workspace_app` (what the workspace has installed) intersected with the user's memberships, instead of just the JWT's `app_memberships` claim. Empty state links to /settings/apps.
- **Sidebar "Admin" section** splits cleanly: Apps for workspace admins; Access requests for super admins.

### Migration
- `20260514160000_workspace_apps.sql` — creates `workspace_app` + RLS, adds `is_super_admin` + helper, re-points signup_request policies at `is_super_admin()`, bootstraps the default workspace's currently-seeded app memberships into workspace_app rows, and rewrites `resolve_sso_identity()` to grant new users their workspace-admin membership.

## [0.5.0] — 2026-05-14

### Added
- **Self-serve apply + admin approval.** New public landing page (white, descriptive, request-access CTA) plus a `/request-access` form. Submissions land in a new `signup_request` table. Founding user (sjoerd@soul.com) is bootstrapped to `fibre-platform` role `admin`; admins see an "Access requests" page under a new sidebar Admin section and can approve or deny. Approval auto-provisions a fresh workspace; the applicant lands in it the next time they sign in.
- **`/access-pending` holding page** for users whose sign-in lands without an approved request — three states: pending review, denied, or unknown email (with CTA back to `/request-access`).
- **API endpoints** `POST /api/v1/signup-requests` (public, anon), `GET` and `PATCH /:id` (admin-gated by RLS via new `public.is_platform_admin()` helper), and `POST /api/v1/sso/access-check` (server-to-server, secret-gated) for the auth callback to know whether to let a user through.
- **Auth callback** (`/auth/callback`) now calls `access-check` first, then routes the user to their workspace (existing or just-approved), or to the holding page.

### Changed
- Bumped to **v0.5.0** — first version where Fibre is genuinely multi-tenant. The default seeded workspace remains for the founding user; every new applicant gets their own.
- Landing page reworked from the dark "list of apps" layout to a light, descriptive marketing page that explains what The Fibre is and why before asking the visitor to do anything.

### Migration
- `20260514150000_signup_requests.sql` — creates `signup_request` (with `status` + partial unique index on email), adds the `public.is_platform_admin()` SQL helper, RLS policies, and promotes sjoerd@soul.com to `fibre-platform` admin.

## [0.4.8] — 2026-05-14

### Shipped
- **Live in production.** Web at https://thefibre.app (Vercel, fra1) and API at https://thefibre-api.fly.dev (Fly.io, fra). Sign-in works, contacts/orgs/programmes/activity all flow end-to-end through the real EU API with RLS enforcing workspace + app-membership scoping.

### Fixed
- `@thefibre/shared` now emits a compiled `dist/`. Previously `main` pointed at `src/index.ts`, which worked under tsx (dev) but crashed Node 22 in production with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. Adds a `build` script, `outDir` + `rootDir` to its tsconfig, and an `exports` map.
- Both apps' build commands now use the pnpm topological filter (`pnpm --filter @thefibre/web... build` / `--filter @thefibre/api... build`). The trailing `...` tells pnpm to include workspace dependencies in topological order, so `@thefibre/shared` gets built before its consumers without hand-chaining. Applied to `vercel.json` (root + apps/web) and the API Dockerfile.
- Contact edit dialog gained the **Preferred language** field. API + DB already accepted it; the form was missing the control so it stayed read-only at "—" on the overview.

### Migration
- `20260514140000_relax_text_arrays_again.sql` — re-applies `drop not null` on text[] columns. The v0.3.9 migration was recorded as applied on remote but the constraints were still tripping `stated_values` etc. Supabase tracks migrations by filename only, so a fresh migration is the right way to re-apply schema changes.

## [0.4.7] — 2026-05-14

### Added
- **Searchable country picker** (`components/ui/country-combobox.tsx`) backed by an ISO-3166 list in `lib/countries.ts`. Type-to-search, arrow-keys + Enter to pick, hidden input submits the ISO 2-letter code. Replaces the free-text 2-letter country field on person and organisation identity edit dialogs. Overview pages now render the full country name instead of the code.
- **Physical address** (`street`, `postal_code`) on platform `person` and `organisation` rows. Surfaced in both the identity edit dialogs and the overview field grids.
- **Invoicing details** as a new fibre-sales curator table — `person_billing` and `org_billing` — with: legal name, tax / VAT ID, billing email, billing address (street / postal code / city / region / country), payment terms (days), currency, PO required, free-form notes. New API endpoints `GET|PATCH /api/v1/persons/:id/billing` and `/organisations/:id/billing`. RLS gates these by `fibre-sales` app-membership — users without sales access never see the section. Section lives on the Fibre Sales tab of each entity alongside Commercial relationship.

### Changed
- `PersonSubResource` and `OrgSubResource` unions in `apps.ts` extended with `'billing'`; the Fibre Sales descriptor lists it alongside `'relationship'` so the apps-discovery query treats it as an emergent tab signal.

### Migration
- `20260514130000_address_and_billing.sql` — additive, idempotent. Adds the address columns, creates the two billing tables with the canonical curator-table RLS policy (`has_app_id` + workspace check).

## [0.4.6] — 2026-05-14

### Changed
- **Renamed Fibre Suite → Fibre Meet** across the entire codebase. Slug `fibre-suite` → `fibre-meet`, subdomain `suite.thefibre.app` → `meet.thefibre.app`, display label `Fibre Suite` → `Fibre Meet`. New migration `20260514120000_rename_fibre_suite_to_meet.sql` updates the `app` row and refreshes the `app.slug` CHECK constraint. All TypeScript type unions (`AppId`, `AppSlug`), the API `VALID_APP_IDS` set, `FORMAT_TO_APP_SLUG`, profile-routing helpers, dashboard `APP_DOMAINS`/`APP_NAMES`, settings, activity, contacts and organisation per-app tabs, redirect shims (`/contacts/[id]/change` and `/organisations/[id]/system-context` now point at `/app/fibre-meet`), the EBBF seed script, and the technical brief have all been updated. Historical migrations and the v0.3 brief are intentionally left as-is.

## [0.4.5] — 2026-05-15

### Added
- **Richer dashboard.** Four stat cards (Contacts / Organisations / Programmes / Activity), recent activity timeline (last 6 events), active programmes list, and the existing your-apps section. Stat values come from parallel best-effort API calls — each fetch is non-fatal so a slow endpoint doesn't break the page. Combined with the seed data, the dashboard now lands on substance instead of an empty welcome.

## [0.4.4] — 2026-05-15

### Added
- **Activity filter by `organisation_id`.** `GET /api/v1/activities` now resolves an org id to the union of its current members' activity (two-step query: resolve members via `org_membership` where `ended_at IS NULL`, then `.in('person_id', members)` on activity). Works without changing the `activity` schema.
- Per-app organisation tab now renders this timeline instead of an EmptyState placeholder.

## [0.4.3] — 2026-05-15

### Added
- **Deploy-ready config.** `vercel.json` (repo root + `apps/web/`), `apps/api/Dockerfile` (multi-stage, repo-root build context for monorepo workspaces), `apps/api/fly.toml` (Frankfurt, scale-to-zero, health checks), `apps/api/.dockerignore`, and a full walkthrough in [`docs/deploy.md`](docs/deploy.md). Nothing was actually deployed — that needs dashboard access.

## [0.4.2] — 2026-05-15

### Added
- **Seed script** at `apps/api/scripts/seed-ebbf.mjs`. Creates the brief §8 worked example: EBBF Athens 2026 conference, post-Athens journey, board working session, 7 sample people, EBBF organisation with identity + system context + 3 members, ~11 enrolments, ~21 activity events spread across 90 days, per-app curator data for two key contacts. Idempotent — safe to re-run. Reads service key from `apps/api/.env`.
- Solves yesterday's "feels abstract" problem: every screen now renders real content.

## [0.4.1] — 2026-05-15

### Added
- **Programme + enrolment UI.** `/programmes` list, `/programmes/new` create form, `/programmes/[id]` detail with enrolments and Enrol-person dialog.
- API: `GET /api/v1/programs/:id` (detail), `GET /api/v1/programs/:id/enrolments` (with person info).
- `POST /api/v1/programs` now derives the owning app from the format (meeting → fibre-meet, event/journey → the-thread, *learn → fibre-learn) per brief §5 Domain 5.
- Sidebar gets a new "Programmes" section with Programmes + Activity.

## [0.4.0] — 2026-05-14

Brief revised to v0.4. Two structural principles formalised: **per-app profile tabs** and **the app justifies the field** (GDPR Article 5(1)(c) data minimisation).

### Schema (additive — nothing dropped, all reversible)
- Curator tables (`person_professional`, `person_relationship_context`, `person_change_context`, `person_learning`, `org_identity`, `org_system_context`, `org_relationship`) now carry an `app_id` FK declaring which app owns each row.
- Backfilled with sensible defaults: person_professional → fibre-platform, person_change_context → fibre-meet, person_learning → fibre-learn, person_relationship_context → fibre-sales, org_identity → fibre-platform, org_system_context → fibre-meet, org_relationship → fibre-sales.
- RLS rewritten to require `has_app_id(app_id)` — a user only sees curator rows for apps they have membership for. The principle is enforced at the database layer, not just the UI.

### API
- PATCH endpoints stamp the correct `app_id` server-side based on the endpoint.
- New: `GET /api/v1/persons/:id/apps` and `GET /api/v1/organisations/:id/apps` — returns the set of app slugs that have data on this entity (curator rows + activity events for persons). The UI uses this to render dynamic per-app tabs.

### UI
- Person profile now has: **Overview** → **Profile** (identity fields + Professional curator section) → one tab per app that has data.
- Organisation profile mirrors: **Overview** (basic identity + members) → **Profile** (org_identity curator) → per-app tabs.
- Old sub-routes are now redirect shims so existing bookmarks still work.
- `apps/web/lib/apps.ts` is the catalogue mapping each app slug → label and which curator sub-resources it owns.

### How this was built
Foundation by me sequentially. Two parallel sub-agents then refactored person and org profile pages on disjoint folders. Combined typecheck clean.

### Known gap (deferred)
- Activities filter by `organisation_id` isn't supported yet (`activity` schema only has `person_id`). Per-app org tabs render curator section + EmptyState for timeline. Future: join through `org_membership`.

## [0.3.11] — 2026-05-14

### Fixed
- **Page didn't refresh after save.** PATCH succeeded, dialog closed, but the read view stayed on the empty state because the dialog closes client-side and Next.js's `revalidatePath` from inside the server action didn't trigger the client to re-fetch. Now every edit dialog calls `router.refresh()` after a successful save, before closing — the page re-renders with fresh data immediately.

Applied to all 10 dialogs (contact + 4 person tabs, org + 3 org tabs, add-member).

## [0.3.10] — 2026-05-14

### Fixed
- Drop NOT NULL on `person_relationship_context.is_key_contact` and `is_ambassador`. They were `boolean NOT NULL DEFAULT false`; the UI sends `null` when the Yes/No select is left blank.
- Person `upsertProfile` helper now logs the full Postgres error (code/details/hint) to stderr and returns it in the 500 body — same pattern as v0.3.6's `upsertOrgProfile`. Future similar failures surface cleanly.

## [0.3.9] — 2026-05-14

### Fixed
- Relaxed `NOT NULL` on profile-table columns the UI treats as optional. The original schema had over-tightened these to `text[] NOT NULL DEFAULT '{}'` or `integer NOT NULL DEFAULT 0`. When the user cleared a value, the upsert rejected with `23502 null value in column "X" violates not-null constraint`. Defaults still apply on INSERT; `null` now means "unknown / not recorded" on clear.
  - text[]: `expertise_areas`, `industries_worked_in`, `certifications`, `spoken_at_events`, `change_themes`, `blockers`, `motivators`, `learning_interests`, `prior_programmes`, `stated_values`, `cultural_descriptors`, `languages_of_operation`, `active_change_themes`, `structural_tensions`, `previous_interventions`, `enablers`, `programmes_completed`, `operating_countries`, `languages_spoken`
  - integer: `total_participants_reached`, `touchpoints_count`

## [0.3.8] — 2026-05-14

### Fixed
- **The actual root cause of the silent saves.** `auth.users.id` (the JWT `sub` claim) is *not* the same as `public.user.id`. The API was using `ctx.userId = jwt.sub` for fields like `notes_updated_by`, `created_by`, etc. — all of which FK to `public.user.id`. Every such write failed with `23503 Key is not present in table "user"`.
  - Migration: `custom_access_token_hook` now injects `app_user_id` (the `public.user.id`) into JWT claims, and `public.current_user_id()` (used by RLS) reads from there.
  - API middleware: `ctx.userId` is now `app_user_id`; `ctx.authUserId` exposes the Supabase auth uuid separately for the few places that need it (none in app code yet).

This also retroactively fixes RLS policies on `user_identity_provider`, `session`, `app_membership`, `sso_match_log` that were silently denying queries because `current_user_id()` returned the wrong UUID.

### Action required
Users must **sign out and sign in** once to get a JWT with the new `app_user_id` claim. The API will return `401 invalid-claims` until then with a message telling them so.

## [0.3.7] — 2026-05-14

### Fixed
- **Profile-tab saves now actually persist.** The v0.3.6 fix (userClient apikey) made requests reach the database, which exposed the next bug: `parseList()` in the action helpers returned `null` for empty comma-separated inputs, but the `text[]` columns (`stated_values`, `expertise_areas`, `blockers`, `motivators`, …) are declared `NOT NULL DEFAULT '{}'`. Postgres rejected the insert with `null value in column "stated_values" violates not-null constraint`. Now `parseList` returns `[]` for empty input — applied to all 6 profile-tab actions (4 person, identity / system-context / relationship for org).

### Architecture note
This came out cleanly because the v0.3.6 `upsertOrgProfile` change started logging full Postgres errors (code, details, hint) to stderr — the actual constraint name was right there in the API server's terminal.

## [0.3.6] — 2026-05-14

### Fixed
- **Real cause of the silent saves: `userClient` was using the service-role key as its base apikey.** PostgREST then treats every request as `service_role`, ignoring the user's JWT claims for RLS. INSERTs/UPSERTs into `org_identity` etc. failed with a 500 because the JWT context wasn't applied correctly. Fixed by using the **anon key** as the apikey and overriding `Authorization` to forward the user JWT — the standard Supabase JS-on-the-server pattern.

This was the underlying cause of "save does nothing on Identity tab" — and likely several silent edge cases on other PATCH endpoints too.

### Added
- API: `upsertOrgProfile` now logs the full Postgres error (code/details/hint) to stderr before returning 500, and includes them in the response body for easier debugging.

## [0.3.5] — 2026-05-14

### Fixed
- **Save buttons (second pass).** v0.3.4 switched to `formRef.current.requestSubmit()` but Save was still doing nothing in practice. Now the button calls a `doSave()` function directly — it reads `FormData(formRef.current)` and invokes the server action without involving the form's submit event at all. `onSubmit` is kept as a fallback for the Enter key.

## [0.3.4] — 2026-05-14

### Fixed
- **Save buttons in all Edit dialogs now actually save.** Was: the submit `<Button>` lived in the Dialog footer (outside the form) and used `form="…-edit-form"` to point at the form. This is HTML-spec but unreliable in some browser/React combos — clicking Save did nothing. Now: each form uses a `ref`, and the Save button calls `formRef.current?.requestSubmit()` directly. Reliable everywhere.

Applies to all 9 Edit dialogs:
- Contact main (`contact-actions.tsx`)
- Contact tabs: Professional, Relationship, Change context, Learning
- Organisation main (`org-actions.tsx`)
- Organisation tabs: Identity, System context, Relationship
- Add member dialog on org detail

## [0.3.3] — 2026-05-14

Fixes the silent-save issue on edit dialogs.

### Changed
- **URL fields no longer require `https://` prefix.** Was: `z.string().url()` rejected `thefibre.app` or `linkedin.com/company/x` with a generic 400. Now: accept any string up to 500 chars; the display layer prepends `https://` when needed. Affects: organisation `website` + `linkedin_url`, person `linkedin_url`, user `avatar_url`.

### Fixed
- **All field errors now display.** Was: only `name` / `first_name` / `last_name` / `email` showed per-field errors — every other field surfaced only a generic "API 400" with no clue what to fix. Now: every input in both the contact and organisation Edit dialogs is wired to `state.fieldErrors`. If you mistype a country code or leave a malformed field, you'll see exactly which one.
- Country fields now include a hint ("Two letters or leave blank") so users don't accidentally type a single character.

## [0.3.2] — 2026-05-14

Organisation profile tabs — the org-graph counterpart to v0.3.0's person tabs.

### Added
- **Tabbed organisation detail** — `/organisations/[id]` now uses a layout with four tabs: Overview, Identity, System context, Relationship.
- **Identity** tab — mission, vision, stated values, cultural descriptors, governance model, ownership type, decision-making style, languages of operation, maturity stage, identity notes.
- **System context** tab — transformation stage, active change themes, structural tensions, strategic priorities, current challenges, **political landscape** (flagged Sensitive per brief §5.D3), leadership stability, change readiness, previous interventions, lessons, blockers, enablers.
- **Relationship** tab — relationship stage, health status, engagement type, programmes completed, total participants reached, touchpoints count, primary/secondary owner, last touchpoint, next planned contact, next opportunity, relationship history.
- **API:** GET + PATCH endpoints per tab (`/organisations/:id/{identity|system-context|relationship}`). Shared `upsertOrgProfile` helper.

### How this got built
Three parallel sub-agents, ~80 seconds wall-clock after the API + tab foundation was in place. Same pattern as v0.3.0.

## [0.3.1] — 2026-05-14

The relational glue between contacts and organisations.

### Added
- **Add member to org** — popup dialog on the org detail page with a person picker (dropdown of unaffiliated workspace contacts), title, department, employment type, influence, started date, and four flags (Primary / Decision maker / Budget holder / Champion). Writes to `org_membership`.
- **End membership** — inline button on each member row, opens a confirm dialog and stamps `ended_at` (soft end — historical link preserved per brief §5.D3).
- **API:**
  - `POST /api/v1/organisations/:id/members`
  - `POST /api/v1/organisations/members/:membership_id/end`

## [0.3.0] — 2026-05-14

Contact-graph deepening — the four profile sub-resources from brief §5.D2 are now editable in the UI.

### Added
- **Tabbed contact detail** — `/contacts/[id]` now has a shared layout (breadcrumb + header + tabs) with five tabs: Overview, Professional, Relationship, Change context, Learning. Each tab is its own route segment.
- **Professional** tab — title, department, seniority, sector, expertise areas, industries, years of experience, career stage, independent flag, certifications, events spoken at.
- **Relationship** tab — source, source detail, introduced by, strength, communication preference, best time, key-contact flag, ambassador flag, first contact at, first contact notes.
- **Change context** tab — role in change, stance, readiness, leadership style, change themes, blockers, motivators, current challenge, **facilitator notes** (flagged Sensitive per brief §5.D2; stamps `notes_updated_at` + `notes_updated_by` server-side).
- **Learning** tab — interests, prior programmes, learning style, group role tendency, open-to-coaching / peer-exchange, development goals, **post-programme reflection** (flagged Participant-owned per brief §5.D2).
- **API:** GET + PATCH endpoints per tab (`/persons/:id/{professional|relationship|change|learning}`). Shared `upsertProfile` helper. Strict Zod schemas covering every enum from the brief.
- **UI primitive:** `TabNav` in `components/ui/tabs.tsx`.

### How this got built
Four parallel sub-agents implemented one tab each, owning isolated folders. ~2.5 minutes total wall-clock for all four agents. Foundation (tab layout, stubs, API endpoints) was built sequentially first; then web-only tabs in parallel with no file overlap.

## [0.2.3] — 2026-05-13

### Added
- **Settings page** (`/settings`):
  - **Profile** form (full name, avatar URL) using the design-system primitives
  - Read-only details: email (managed by provider), sign-in method, last sign-in
  - **Workspace** card (name, slug, plan, created date) — multi-workspace switching noted as roadmap
  - **App access** list per `app_membership` with role
  - Link back to `/privacy`
- **API:**
  - `PATCH /api/v1/auth/me` — update own profile (full_name, avatar_url)
  - `GET /api/v1/auth/me` now also returns the workspace and `primary_auth_method` / `last_sign_in`

## [0.2.2] — 2026-05-13

### Added
- **Privacy page** (`/privacy`) — three sections:
  - **Active consents** with per-purpose Revoke buttons (only for `consent` legal basis; contract / legitimate_interest are noted but not revokable)
  - **Data subject requests** with status (Article 15/17)
  - **Actions** — Export (placeholder, Article 15 coming soon) + Request erasure dialog (Article 17 self-service)
- **API:**
  - `GET /api/v1/privacy/consent` — list the caller's own consent records
  - `GET /api/v1/privacy/requests` — list the caller's own data subject requests
  - `POST /api/v1/privacy/erasure-request` — `person_id` is now optional; defaults to the caller's own person (self-service)

## [0.2.1] — 2026-05-13

### Added
- **Edit / delete on organisations** — same Dialog + ConfirmDialog pattern as contacts
- **API:** `PATCH /api/v1/organisations/:id`, `DELETE /api/v1/organisations/:id` (soft delete)

## [0.2.0] — 2026-05-13

Design-system milestone. Single source of truth for buttons, fields, dialogs, list rows, and page chrome.

### Added
- **Edit / delete on contacts** — Pencil opens an Edit dialog (popup); Trash opens a Confirm dialog and soft-deletes via the API.
- **API:** `PATCH /api/v1/persons/:id` (partial update with strict Zod schema), `DELETE /api/v1/persons/:id` (soft delete via `deleted_at`).
- **UI primitives** under `components/ui/`:
  - `Button` + `ButtonLink` with variants (primary / secondary / ghost / danger), sizes, leading icon
  - `TextField`, `SelectField`, `TextAreaField` — single label/input/errors shell
  - `Dialog`, `ConfirmDialog` — popup pattern with Esc-to-close, click-outside-to-close, body-scroll lock
  - `PageContainer`, `PageHeader`, `Breadcrumb`, `SectionLabel`, `EmptyState`, `ErrorBanner`
  - `ListGroup` + `ListRow` — the repeated list pattern

### Changed
- All existing pages (dashboard, contacts list/detail/new, organisations list/detail/new) refactored onto the primitives. Tailwind class strings are no longer duplicated.
- Server actions for contacts unified under one `ActionResult` type with a shared error unwrapper.

### Note on history / undo
The 10-step undo idea is deferred — see conversation. Save / cancel / delete shipped first; history can layer in once we know which fields people actually change.

## [0.1.2] — 2026-05-12

### Added
- **Activity timeline** (`/activity`) — workspace-wide event log with type and app filters, cursor pagination
- **`fibre-platform` app slug** — the platform itself is now a registered app. Resolves the long-standing TODO of using `fibre-meet` as a placeholder.
- **`user_created` events** — written automatically when a person is created (in the API). Backfilled for existing users.
- API: `GET /api/v1/activities` now accepts either a UUID or a slug for `app_id` and joins the app name into responses

### Changed
- `lib/api.ts` `PLATFORM_APP_ID` switched from `fibre-meet` to `fibre-platform`
- `packages/shared` `APP_IDS` includes `fibre-platform`
- API middleware `VALID_APP_IDS` includes `fibre-platform`

## [0.1.1] — 2026-05-12

### Added
- **Organisations UI:** list with search (`/organisations`), detail page with members (`/organisations/[id]`), add-organisation form (`/organisations/new`)
- **Build tracking:** [CHANGELOG.md](./CHANGELOG.md) and [docs/build-plan.md](docs/build-plan.md) — version displayed in sidebar footer

## [0.1.0] — 2026-05-12

The end-to-end sign-in milestone. A real user can sign in with Google and land inside the app shell.

### Added
- **Auth:** Google OAuth via Supabase Auth. SSO match logic (`resolve_sso_identity`) creates platform `user` + `person` rows on first sign-in.
- **JWT claims:** custom access token hook injects `workspace_id` and `app_memberships` (slug array) into every JWT — required for RLS to work.
- **App shell:** sidebar with three modes (expanded / collapsed / expand-on-hover), top bar with avatar + user menu, theme switcher (light / dark / system) with cookie persistence and no-flash script.
- **Contacts UI:** list with search, person detail with activity timeline, add-person form via Server Action.
- **Schema:** identity + contact graph + RLS baseline; programme + enrolment + activity (append-only triggers); GDPR (consent_record, data_subject_request, retention_policy, processing_purpose).
- **API:** `/auth/me`, `/persons`, `/organisations`, `/activities`, `/programs`, `/privacy/consent`, `/privacy/erasure-request`, `/sso/resolve`.
- **Infrastructure:** Supabase project `the fibre` (West EU / Ireland), migrations tracked, deployed.

### Architecture
- Hard rule §13 holds: no personal data in Vercel. Every PII operation goes through the Hono API.
- Web pages under `app/(app)/` route group share one layout that enforces auth and renders the shell.

## [0.0.1] — 2026-05-12

Foundation.

### Added
- pnpm monorepo (`apps/web`, `apps/api`, `packages/shared`)
- Supabase project linked, region confirmed (West EU / Ireland)
- Phase 0 migration: identity, multi-tenancy, contact graph, RLS baseline
- Briefs saved under `docs/` (canonical project copy)
- GitHub remote: `findingthesoul/thefibre`
