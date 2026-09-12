# Inbox

Sjoerd's gathering box. Raw items, captured as they arrive, from any chat.

**This is not the queue.** `docs/build-plan.md` is the queue and it claims to
be in priority order. Dropping unranked items into it breaks that claim
quietly. Items land here first, get ranked later, then move.

## For any session reading this

- **Append, never reorder.** Newest at the bottom of Open.
- **Capture what he said**, in his words. Do not improve it, do not scope it,
  do not decide whether it is a good idea. A one line item is a complete item.
- **Add the date** and, where it helps, where it came from (which app, which
  chat, what he was doing).
- **When an item moves** into the build-plan queue, move it to Done below with
  the date and where it went. Never delete an item to tidy up.
- If an item is already shipped or already queued, say so next to it rather
  than dropping it.

## Open

### 2026-09-12 — different view types, and seeing connections between people

Sjoerd, in the fibre chat, with three Visual Thesaurus screenshots attached:

> Interface: I am not so happy witht the interface....
>
> I want to have different view types...
> Maybe one like the visual thesaurus.
> I want to see connectiosn between people....
>
> with one or more charateristics
>
> could also be a list.... ordder in what ranks more...
>
> but then there should be characteriustcis you can select or type..
>
> Like info is like a tag
>
> a tag could be closness, but also company
>
> (sorry - all this neededd to go to connections)

What the screenshots show, since they do not live in the repo:
visualthesaurus.com, the word "connection". A force-directed graph, one big
central word, related words radiating out on thin lines, small coloured dots
at the joints. Clicking a word re-centres the whole map on it (screenshot 2
is "connect", screenshot 3 is "collide with" after two clicks). A right-hand
panel lists the senses, grouped and colour-coded by part of speech, each
group with its own on/off switch that filters what the map draws. Dashed
lines mean a weaker or different relation than solid ones; one red dashed
line marks an opposite ("disconnect").

So the graph is one view, not the only one. A ranked list is another: the
same people, ordered by how much they rank on the characteristic. The
characteristic is the input to both views, picked from a list or typed. His
own gloss on what a characteristic is: a piece of information behaving like
a tag. His two examples pull in different directions: closeness, which is a
degree and orders naturally, and company, which is a category you either
share or do not.

**Surface: Connections** (`apps/connections`, slug `fibre-sales`). He said so
himself at the end. Its landscape already places people on derived axes, so
this lands on a screen that exists rather than a blank one.

**Where this stands against what is already written.** Rewritten 2026-09-12
21:00 UTC, after merging `staging`. The first version of this note was two
hours old and already wrong, because part of the item shipped while it sat.
Not a scoping decision, just what a reader should know.

**Already built, on `staging` and not yet released** (held at Sjoerd's
request while he looks at the Vercel bill):

- Tags exist. `v0.73.10` detects them while a note is being written, and
  organisation names count as tags. The "characteristic you can select or
  type" has a vocabulary behind it.
- The tag **list** and the tag **cloud** both shipped, on one page, and
  tapping a tag filters the people list. Band and tag filters compose. So
  "pick a characteristic, get the people who carry it" already works.
- `@` mentions for people and organisations, by intent rather than
  inference. People open in a popup.

**Still not built, and this is the part of his item that is genuinely open:**

- The **graph**. Tags gave it an edge source for the first time, and it is
  the desktop landscape rather than a screen that exists.
- The dissatisfaction he opened with: *"I am not so happy witht the
  interface"*. That is about the landscape as it stands. It is separable from
  the request for new views, and possibly cheaper. Worth asking him which one
  he actually wants first.

**Two things that push back on the item as stated:**

- **Ranking.** He asked for a list *"ordder in what ranks more"*. The cloud
  that shipped does the opposite on purpose: size is reach, opacity is
  connective strength, and strength FALLS as reach grows, so the biggest word
  is deliberately not the most important one. A tag on three people is a
  strong link; a tag on nearly everybody is a category. If he means "most
  people first", that is a different ordering from the one the model argues
  for, and the disagreement is worth surfacing rather than silently picking
  one.
- **Edges.** `docs/system-handbook.md`, same day: *"co-occurrence is not a
  relationship."* Two people sharing a tag have co-occurred. Drawing a line
  between them because they share one is precisely the inference that rule
  forbids, because an edge meaning "somebody states these two know each
  other" quietly starts meaning "these two were typed near each other".
  **The counter-reading, which matters here:** the rule is about what gets
  STORED in `relationship`, not about what a view may draw. A layout that
  places people near each other because they share a tag stores nothing and
  claims nothing. So his graph is not forbidden; one implementation of it is.
  Anyone scoping this needs to hold that line explicitly, because it is the
  cheap step the rule was written about.

**One caveat on his example tags.** Of the two he named, closeness is the
last axis with no history: a current-state column. A view ranking people by
closeness can show where they stand and cannot show them moving. Company does
not have that problem.

Not scoped.

## Moved out

_Items that graduated to `docs/build-plan.md`, with the date and destination._
