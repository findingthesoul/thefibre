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
| 18 | **Timeline: highlight tags; companies and people as @, highlighted** | **Shipped** v0.73.57 — was MISSED |
| 19 | **Click a name → popup with name, email, phone, LinkedIn** | **Shipped** v0.73.51 — was MISSED, see below |
| 20 | **Landscape should work like "as columns" in macOS** | **Shipped** v0.73.56 |
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
| 35 | Could there also be a team member? | **Answered** by 44 — the author is you, and the note is filed under a team |
| 36 | How does Connections work with individual / teams / workspace? | **Answered** — workspace is the unit; calendar and owed tasks are yours; teams unused |
| 37 | The list of readings should be flexible — title above, then rows of "name : description" | **Shipped** v0.73.49 |
| 38 | Keep Connections at workspace level; admin decides who has access — everyone or a selection | **Answered** — that is exactly what exists |
| 39 | "I remember we built something like groups... with rights" | **Answered** — teams as access groups, 2026-09-11 |
| 40 | Calling somebody means leaving Maps for The Fibre and coming back to file the note | **Shipped** v0.73.51 — this is #19, and why it mattered |
| 41 | Is the staging branch mine? (peer session, blocked release) | **Answered** — three stale premises corrected; peer released on top |
| 42 | Kind and when should sit next to Follow up, not behind a click | **Shipped** v0.73.54 |
| 43 | Peer: is the invoices tab yours? | **Answered** — evidence points at The Fibre contact profile, which already has the tab machinery |

## 2026-09-14

| # | Asked | Status |
|---|---|---|
| 44 | Teams as an organising layer: a person in several teams; a note is filed under one of mine, with a default team; I am the author automatically | **Shipped** v0.73.59 — the Fibre session had ended, so built as proposed: a filter, not a wall |
| 45 | An update view: pick a team and a period (last week, two weeks, custom) and see every shift by everyone in it — for update meetings | **Shipped** v0.73.59 — on Today; notes only, since nothing else carries a team yet |
| 46 | A longer "what happened" for meetings, plus a copyable prompt to paste a transcript into ChatGPT / Claude / Gemini that returns a short summary with @ and # | **Shipped** v0.73.57 |
| 47 | Typing `#f` shows a dropdown of matching tags; typing `@` shows people and companies | **Shipped** v0.73.55 |
| 48 | A tag should look like a tag inside the sentence; it need not also be listed at the bottom | **Answered** — it already shows inside the sentence; the chips stay because their X is the only way to take a tag off without deleting the word |
| 49 | Landscape as macOS columns: person inline in the last column, or the popup? | **Decided** — inline, since it went unanswered; reversible |
| 50 | Production: three migrations missing after the promotion — go or no-go? | **Blocked** — "make it all work" taken as go; the push was refused by the permission classifier. Sjoerd to run it. |
| 51 | "When" appears twice in the composer — remove the label | **Shipped** v0.73.55 |
| 52 | "On a date" in the follow-up list needs only a calendar icon, not the word | **Shipped** v0.73.55 |
| 53 | Follow-up list gains today, tomorrow and this week | **Shipped** v0.73.55 |
| 54 | Landscape: see the movement — the steps as columns next to each other | **Shipped** v0.73.58 — a Movement tab beside Browse |
| 55 | Landscape: an extra column to sub-group by tag, location, company… | **Shipped** v0.73.58 — group by tag, location or company |
| 56 | "Make it all work" — everything open: production, movement board, sub-groups, prompt, highlighting, teams | **Done except production** — v0.73.57–59; the production push was refused by the permission classifier |
| 57 | connections.thefibre.tech/dashboard should be connections.thefibre.tech | **Shipped** v0.73.60 — /dashboard never existed here (404); sign-in, SSO, the logo and workspace switch now go to the root, and /dashboard redirects there |
| 58 | (found while fixing 57) The Help link in the Connections sidebar also answers 404 — there is no help page | **Backlog** — needs content, not a redirect |
| 59 | `#` and `@` may run over a space — type the words, press Enter, and it becomes a tag, person or organisation | **Shipped** v0.73.61 — up to three words; `#` offers a new tag; `@` picks existing people and organisations only (a new person is backlog §1.3) |
| 60 | Tag cleaning: find doubles, find tags unused for a long time, and present a list for a clean-up now and then | **Shipped** v0.73.61 — Settings → Tag cleaning; merge, rename, delete for admins; a nudge on Today at most every 30 days |
| 61 | The date field is double in the composer — take the bottom one away | **Shipped** v0.73.61 — the note is dated when written; the calendar icon is the follow-up |
| 62 | The calendar icon should only appear when the follow-up is "on a date" | **Shipped** v0.74.2 — reverses 52: "On a date…" is back in the list and the date field shows only for it |
| 63 | "Follow up: [kind] on [when]" — the Kind had read as the follow-up's; put the note's kind and time at the TOP (time = the moment you start writing, openable), and give the follow-up its own colour with its own two dropdowns | **Shipped** v0.74.2 — reverses 61: the note's time is back, at the top; the follow-up's kind becomes the title of its task in what you owe |
| 64 | The note box is inconsistent — small, big, over two lines; put the inputs on one line | **Shipped** v0.74.3 — kind, time and team on one line, every control the same small height (shared DateTimeField gained size="sm") |
| 65 | "From a meeting transcript…" should say "AI report as input" | **Shipped** v0.74.3 |
| 66 | Follow up and Done on one line | **Shipped** v0.74.3 — wraps below on a phone |
| 67 | The follow-up's date field can just be a calendar icon | **Shipped** v0.74.4 — an icon until a date is picked, then the icon and a short date; shared DateTimeField gained size="icon" |
| 68 | "Why do we have two styles? It should be one single point of truth" — the note box against Thread's editor; "The Thread is way more clear" | **Shipped** v0.74.6 — Connections' forms rebuilt on the shared SelectField / DateTimeField / Button; the extra date sizes (sm, icon) removed from shared; hand-written control classes across Connections replaced by the shared FIELD_CLASS. Supersedes the look of 63, 64, 66 and 67: labelled fields in Thread's style instead of one tinted line |
| 69 | Make Done clearly ready once somebody has started typing (asked: blue) | **Shipped** v0.75.1 — decided with him: no new colour; Done is outlined until there is text, then The Fibre's filled black |
| 70 | "Why are the dropdowns another format than the date… bad design" | **Shipped** v0.75.1 — fixed in SHARED, so every app: text fields, dropdowns and textareas now match the date field (h-11, 15px); dropdowns draw their own arrow so Safari keeps the height |
| 71 | Email directly under the name; full profile as an icon with a "Full profile" hover at the end of the name's line, next to the X | **Shipped** v0.75.1 — shared Dialog gained `headerActions` |
| 72 | How you know them: "I reached out" and "They reached out" get a comment field, "Why?" | **Shipped** v0.75.1 |
| 73 | "When" defaults to now | **Shipped** v0.75.1 — as today's date, see 74 |
| 74 | "Time may not be so relevant… take it out... just date" | **Shipped** v0.75.1 — the note's When is a date (today by default); the timeline shows dates only |
| 75 | The AI prompt should also work in a chat that has already worked on the transcript | **Shipped** v0.75.1 — it looks below OR earlier in the chat, keeps earlier corrections, and its format wins |
| 76 | "Again: Entries… why can I only search for a person or an org and not on other things like tags or location?" | **Shipped** v0.75.2 — search offers tags and places too; a tag or place answers with the people around it, closest first, labelled as NOT introductions (sharing a word is not knowing somebody, handbook §12). Closes the tag half of backlog §1.3 |
| 77 | Field size and Save colour, settled across two chats: compact fields with the date field to match; saving is yellow in every app | **Shipped** v0.75.4 (by the Thread session, shared) — decided by Sjoerd with both asks side by side |
| 78 | "Done should also be something else… maybe add… why not save then?" | **Shipped** v0.75.6 — the composer's button says Save, in the save colour, outlined until there is something to keep |
| 79 | In a narrow column the note box's date wraps over four lines; "size is great.. datum needs to fit.. write format that works" | **Shipped** v0.75.8 — the composer's fields stack when there is no room (auto-fit grid); shared DateField shows "14 Sep 2026" (no weekday) and never wraps; DateTimeField keeps the weekday and truncates. When loses its asterisk |
| 80 | "Did you solve my AI report question?" | **Answered** — yes: 75 (v0.75.1), the prompt works in a chat already working on the transcript |
| 81 | If the transcript is not clear enough, the prompt could ask a few questions to clarify | **Shipped** v0.75.8 — at most three numbered questions, only about who, what was agreed, or the next step; skipped when all is clear |
| 82 | Landscape: "Why is this not full screen?" | **Shipped** v0.75.15 — the page uses the whole window (shared PageContainer max="full") |
| 83 | Landscape's person column: "why is How you know them and What happened below each other and not two tabs" | **Shipped** v0.75.15 — the same two tabs as the popup |
| 84 | "Why is the introduced by not clickable" | **Shipped** v0.75.15 — the introducer opens the person popup; a company under Through work opens the organisation |
| 85 | Third Landscape column: a magnifier that opens a search which selects people | **Shipped** v0.75.15 — searches everybody in the reading; picking opens their step and them |
| 86 | "Why is Kind When and Team over two lines? You can also make the popup a little wider?" | **Shipped** v0.75.15 — the person popup is the roomy dialog size and the fields sit side by side down to 10rem |
| 87 | After showing the map to somebody: nodes should be more useful, "see the connections"; full (have content) or empty (unclear, for overview) — both the dots and the names, he chose | **Shipped** v0.75.30 — names carry a filled or hollow marker (a note or how you know them = full); dots are filled and named when they are a tag or company you can open, hollow when they only group; pointing at anything lights its connections and dims the rest |
| 88 | A stronger 3D effect: smaller and bigger, bringing pieces to the foreground | **Shipped** v0.75.30 — every node has a depth from what it means (middle, strength, content): size, light, a little soft focus when far, parallax with the pointer, near painted over far; what you point at comes forward |
| 89 | Once refined: open-source the map as code others can use, crediting The Thread as its designer | **Decided, not built** (2026-09-15): MIT; own public GitHub repo + npm package; named Constellation (plain `constellation` is taken on npm, so a scope is needed); credit to The Thread in README and licence notice. Built only after the map is refined; nothing is published without his final go |
| 90 | The in-app assistant (Thread): may it ever process personal data via the AI provider? | **Decided** — not now: Thread data only; revisit after a DPA and an EU endpoint. Relayed to the assistant's session |
| 91 | The map's depth: "the contrast are way too heavy. It is about subtle changes. Not big changes." | **Shipped** v0.78.2 — size 0.9-1.06x (was 0.62-1.22x), light 72-100% (was 38-100%), blur only on the very farthest, parallax a third, hover dims to 80% not 45%, softer full dots; a test pins the bounds |
| 92 | "You use dashed lines... maybe better to use dotted lines" | **Shipped** v0.78.2 — ties that are not a stated relationship are round-dotted |
| 93 | "Some names go beyond the box... if possible - abbreviations here" | **Shipped** v0.78.3 — a name over 24 characters is drawn as the initials of its capitalised words (EBBF) or cut at a word with …; the box is sized to what is drawn; the full name is the tooltip |
| 94 | "What were the initial names of Maturity?" / "Maybe I did not understand the concepts" | **Answered** — the six shipped steps and what earns each, explained in chat |
| 95 | "Positioning of ORGs is not centered" (screenshot) | **Shipped** v0.78.4 — every name's box is one height, centred on its node; the box had grown for a title line that is never drawn |
| 96 | "Maybe instead of a frame... a light grey background" | **Shipped** v0.78.4 — organisations have a light grey ground, no outline; Today's outlined chip dotted too |
| 97 | "When pulling someone away from the cloud... don't let them quickly flip back.. but let them gradually slide back" | **Shipped** v0.78.5 — a dropped name's pull home builds back over about two seconds, eased in, with a speed limit |
| 98 | "Dots are better by the way" | **Answered** — kept; dots since v0.78.2 |
| 99 | "It still jumps back way too quick" | **Shipped** v0.78.6 — the speed limit now holds until the name is back at its ring (v0.78.5 lifted it on a two-second timer while still far away, so it crept and then snapped); ties to other people pull gently too; the pull builds over about four seconds from a crawl |
| 100 | The "Picked up" tag chips under the note: "This is not needed" | **Shipped** v0.78.6 — the row is gone; tags show inside the sentence |
| 101 | "Perfect: Constellation to GitHub and give me the link to share" | **Shipped** 2026-09-15 — code at github.com/thefibre/constellation, live demo at thefibre.github.io/constellation (checked in a browser: renders, clicking glides); install from GitHub, npm package not yet published |
| 102 | "People list — full width (so like a list on the iPhone itself)" | **Shipped** v0.81.0 — on a phone the rows run to the screen edges, iOS-style; from `sm` up it is the card again. The look is one recipe (ROW_LIST), and the page padding it cancels is named beside it |
| 103 | "When I click on a text field, my iOS zooms in; it does not restore... We solved this earlier no?" | **Shipped** v0.81.0 — it HAD been solved on 2026-09-17 and the work sat on an unreleased branch. Released, plus the hand-written fields it missed (map search, sign-in, band names, four shared components). A test now fails the release on any field under 16px in Connections or shared |
| 104 | "In the overview page I see my agenda: there I see people who are not yet in my contact list. Would be great if I could just click on their name and add people from this agenda" | **Shipped** v0.81.0 — the greyed chip is a button; pressing it adds them and becomes the ordinary person chip. Still nothing created by the sync: the name comes from Google on the server, and the address must be in a meeting on screen |
| 105 | "Select agendas available to me. And select one or more. Maybe popup. And then put agendas on and off" | **Shipped** v0.81.0 — a popup beside the agenda heading, your own calendars first then the ones you follow, a switch each. Default is what happened before (on if you own it); the choice is yours alone, not an admin's |
| 106 | "If locations of meetings in the agenda are filled in: location → maps... zoom/teams: link opens app" | **Shipped** v0.82.0 — a meeting with a way in gets a Meet/Zoom/Teams button that opens that app; a meeting with a place gets one that opens Maps. A location that is only a link is a way in, never a place (Zoom puts its join URL there) |
| 107 | "When click on the meeting, it should open and select the people present and potentially add info immediately (online meeting, date filled in, basic content in the description field like the title). Maybe the meeting is connected to a project or a company" | **Shipped in part** v0.82.0 — the meeting title opens a write-up with the kind, the date, the title and everyone already in your people ticked; it saves one note per person, each naming the others. **Still open: the project or company.** The agenda does not know which organisations the room belongs to, and guessing from a shared email domain is the kind of inference this app refuses. Needs a decision on what "connected to" should mean |
| 108 | Three screenshots — Today, next to iOS Recents and Gmail: "on photo 1 you see what it is... but on 2 and 3 you see what is regular on apps. The later is more intuitive" | **Shipped** v0.84.0 — Today's three lists are rows against the screen edges with a hairline between them, the whole row tappable and the time on the right, sharing the people list's recipe. Two things from the same photo fixed with it: a meeting on two calendars was listed twice, and the person chip ran three facts together |
| 109 | "Can it be that the How you know them is not saving? Filled it in a few times for Tahirih Michot, but its not saving..." | **Answered in part** — the writes DID reach production (three PATCHes, all 200, and the row holds what they said). What was broken was the evidence: `updated_at` on every curator table had never been updated since the first migration, so "when did this last change" always answered with the insert date. Fixed with a trigger. Waiting on one distinguishing observation from him: which value he expected to see |
| 110 | "Also the landscape interface: full width" | **Shipped** — the page margin is 16px on a phone instead of 32px, which is what iOS uses; from `sm` up it is 32px again. Every page gains it, the landscape most |
| 111 | "Production does not have the full width... it does show the calendar selection, which I don't see in staging... quite confusing" | **Answered** — two separate things. Full width: nobody had it until v0.86.0; production was promoted to v0.82.0, which has the people list edge to edge but not the landscape. Calendar selection: it IS on staging, but the picker lives inside the agenda section, and that section renders NOTHING when no calendar is connected — staging has zero Google connections (checked), production has two. **Worth fixing**: a control that is invisible precisely when somebody has nothing connected is backwards |
| 112 | "I have a proposal... I want to rename connections to connect" — and, asked: move the address too | **Shipped** — Connect everywhere a person reads it: sidebar, app switcher, home-screen icon, the profile tab in The Fibre, the plan matrix, the external manifest and the app catalogue. The slug stays `fibre-sales` and the folder stays `apps/connections` (both tag real data). The address moved to **connect.thethread.app** / **connect.thefibre.tech**: he added the DNS at TransIP, I attached both domains to the Vercel project and waited for the certificates, and the old hosts still serve and redirect. A test now fails the release if a future rename leaves any of the five spelled-out copies behind — this is the second rename this app has had |
| 113 | "Today: I like to see the whole day... greyed out what has passed, but still clickable... a line of the time" | **Shipped** v0.89.0 — the agenda reads from the viewer's own midnight (not the server's, which is UTC), a finished meeting is dimmed and still opens, and a line with the time is drawn between the rows and moves once a minute |
| 114 | "When clicking the item... I like to see the popup of What happened, prefilled as stated earlier" | **Shipped** v0.89.0 — the whole row opens it now, not only the title, which is why clicking was doing nothing. The Zoom and Maps links stay their own targets |
| 115 | "I also don't see the agenda thing, that I do see in the production" | **Answered** — staging has no Google calendar connected (zero rows with a refresh token, checked); the whole agenda section renders nothing without one. Same cause as ask 111 |
| 116 | "I like that the day selection at the top" | **Shipped** v0.89.0 — the day selector sits above the agenda instead of halfway down the page |
| 117 | The page intro paragraph "should have a toggle button (on and off... reduce info on interface when not really needed)" | **Shipped** v0.89.0 — a show/hide toggle, remembered domain-wide like the theme and read on the server so it never flashes. The component is shared; other apps adopt it by allow-listing one cookie |
| 118 | Screenshot of the write-up dialog rendering translucent over the list | **Shipped** — my own regression from v0.89.0: dimming a past row with `opacity` makes every `position: fixed` descendant both translucent AND positioned inside that row, and the shared Dialog is fixed with no portal. One dialog for the whole list now, rendered outside it |
| 119 | "The auto fill — if it is a person, use the @ with a real reference. If a # is used, use the hash tag (mouse over also shows the X to turn the # into a word again)" | **Shipped** v0.104.0 — hovering a tag or an @name in the box shows an X on the word; pressing it keeps the word and drops the tag. It also appears when the caret is inside the word, which is the same thing on a phone. The `@` half already resolved to a real person id; what was missing was the X, whose only trigger (the chip row) he had removed himself on 2026-09-15 |
| 120 | "For the print screen: remove the lines between agenda's" (the Calendars popup) | **Shipped** v0.91.0 — no rules between the calendar rows; a short named group with a switch each is already a list |
| 121 | Screenshot of his own calendar: "Make the agenda look like this (time on the left... appointments over the time they take" | **Shipped** v0.92.0 — a day grid: hours down the left, meetings drawn over the time they take, clashes side by side, the now line across it. What it cost: a block has no room for the attendee chips, so the names are a quiet line inside taller blocks, the full list is in the write-up the block opens, and the people who are NOT on file keep a strip of their own under the grid |
| 122 | "Don't really understand what's at the bottom" (To prepare / What's next) | **Shipped in part** v0.93.0 — the rows led with "Call" and buried the person; they lead with WHO now and name the task underneath. "overdue 1 days ago" was a hand-written plural and now goes through Intl ("yesterday", "3 weeks ago"). **Still open:** the row does not say what the follow-up was ABOUT — the note it came from is not in the payload |
| 123 | "Can you also show tomorrow (maybe even as the calendar view...)" | **Shipped** v0.93.0 — picking Tomorrow draws tomorrow's grid, from the viewer's own midnight and correct across a clocks-change day. The week horizons still show no grid: seven days is a different screen, not a taller one |
| 124 | "Date should be filled for today. Team: which team is expected? Nobody was there... an add button, so I can list people who were present" | **Shipped** v0.93.0 — the date field was uncontrolled and kept the empty value it mounted with once the dialog stopped remounting; it is keyed per meeting now. The team defaults to your default, or to your only team. And the box has a person search, so a meeting whose invitation named nobody can still be written up |
| 125 | "BG color: contrast higher between BG and calendar items" | **Shipped** v0.94.0 — a past block was painted `surface-sunken`, which in Connect IS the page's ground, so it disappeared. Every block is a white card with an edge and a little lift now; past is quieter through its text and its accent, never through its background. A test fails the release if a block is ever painted the ground again |
| 126 | "When typing..., can I add people if they are not there?" + "There should be a Single Point of truth — it is existing somewhere else" + "Add company - also a single point of truth" | **Shipped** v0.95.0 — he was right: apps/web already had the picker, wrapping the shared SearchSelect. It is in `@thefibre/shared/ui/{person,organisation}-combobox` now, bound per app to that app's own search. Connect had **four** hand-rolled copies; all four are gone, including one a new test found that I had not noticed. Both pickers can create what you typed. `POST /persons` no longer insists on an email or a last name — the table never did |
| 130 | "In Fibre this person exists... but the TODAY meeting does not recognize it" / "I added him before through this interface - I assumed it connected email" | **Shipped** v0.106.0 — he was right on both counts. The agenda matches on an ADDRESS, and a person added by name alone (possible since v0.95.0) has none, so they are invisible to it for ever and pressing add would have made a twin. The chip now asks "is this them?" and attaching the address makes every later meeting match by itself. And the write-up stops throwing away an address it already has |
| 131 | "In Maps... the title should have a small thing behind it (edit)... so you can edit the contact (Organisation or Person)" | **Shipped** v0.109.0 — a pencil beside the title of both popups. A person's had an arrow to the full profile; an organisation's had nothing at all, so the map was a dead end for a company. One control for both, with the leaving warning inside it, rather than the second copy it was about to become |
| 132 | "When clicking in a TO DO on the to do, and you go to the app to do it.. in Connections, please show a peoples list with a popup... not a full page floating no where" | **Shipped** v0.126.0 + v0.127.0 — — a Connect follow-up links to `/people/<id>`, the standalone page: a name, its notes, and nothing around it. The popup he means already exists and every in-app row uses it; an arrival from OUTSIDE has no click to intercept, so it lands on the bare page instead |
| 133 | "When you add people from calendar to fibre, you twist first and last name often..." | **In progress** — a calendar display name is not always "First Last". Two shapes invert it and both are common here: `Jimenez R.G.M. (Raquel)` (surname, official initials, given name in brackets — Dutch directories) and `Verweij, Martine`. `splitPersonName` took the first word as the first name, so both arrived backwards |
| 134 | "Also: # is not working here" (the meeting write-up box) | **Shipped** v1.6.0 — the write-up was a plain textarea, so a hashtag was detected and saved but nothing lit up while typing and a tag could not be taken back off a word. It uses the person page's box now, and the detection behind both is ONE hook (`use-note-tags.ts`) rather than a second copy that would drift. The `#`/`@` autocomplete stays on the person page for now — it owns caret position and a controlled-re-render insert, and half of it would be worse than none |
| 135 | "I tried to connect Martine Verweij" — the chip showed a raw uuid, "and then it is not there" | **Shipped** v1.10.0 — two bugs in one press. The picker handed back only an id, so the write-up's own chip had no name to show and rendered the uuid. And the form's reset was keyed on the `event` OBJECT, which the parent rebuilds on every render: an agenda refresh handed down an equal-but-new object and wiped who had been picked, under somebody mid-form |
| 136 | "Maybe the agenda items can be colored (full) instead of white" | **Shipped** v1.12.0 — one accent, his choice over a colour per calendar. The palette had nothing for it (monochrome plus the yellow that only ever means saving), so it is a new shared token, `booked` — named for what it MEANS, time already spoken for, so the next surface that wants it reuses it rather than inventing a second blue. Past blocks stay quieter through a lighter fill, never through `opacity` |
| 127 | "When I connect an org in How do you know them... it does not save that field for organisations" | **Shipped** v0.96.0 — it WAS saving; the field could not say so. A picker labels a value from its search results, and a page that has just loaded has run no search, so a saved company showed the placeholder and read as empty. Both comboboxes take a `resolve` now and look one up by id |
| 128 | "When I open connect - save the last page used.... first timer is TODAY" | **Shipped** v0.96.0 — the section you were in is remembered and you land back on it; Today the first time, and any time the value is not one of the sidebar's own sections (a redirect built from a cookie is a redirect anybody can aim) |
| 129 | "In What's next... when I click on an item I am redirected to the fibre" | **Shipped** v0.96.0 — a person opens in Connect's own popup now, in both lists. It went to the platform because that is where a person's details live, but what you want after clicking something you owe somebody is to write down what you did. The subtitle also says what those rows ARE: follow-ups you set when writing a note |

### The three that were lost

**18 — highlighting in the timeline.** Asked while I was mid-release on
something else, acknowledged in passing, and never written down. The composer
already highlights tags and `@` names as you type
(`components/tag-highlight-box.tsx`); the saved note in the timeline renders as
plain text. Same ranges, a different renderer.

**19 — the contact-details popup. SHIPPED v0.73.51**, after he said plainly
what it cost: *"when I am searching for someone in my network and use maps to
identify them, and want to call them... I need to leave MAPS and go to FIBRE
for more info.. and then when I talked to them, I need to go back to
Connections, search him again and then file the info... That does not seem user
friendly"*.

The sting is that the round trip bought nothing. `GET /persons/:id` is a
`select('*')`, so the phone number was already in the response the popup had
fetched — it was never typed and never rendered. A `tel:` link, and the call
and the note happen in one dialog.

The original note follows. Asked together with a real architectural
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

### 38 / 39 — the access model he described already exists

He is remembering correctly. `20260911120000_team_access_groups.sql`, from his
own ask on 2026-09-11: *"I'm adding more apps and I don't want every app
available to everyone in a workspace."*

  * An admin creates a **team**, which can be **internal** — `is_published`
    false, so it has no public page, though its slug is still claimed so it
    can be published later without colliding.
  * **`team_app_grant`** says which apps that team confers.
  * Being in the team writes the same `app_membership` row an admin would tick
    by hand; `lib/team-grants.ts` reconciles it. `team_member.role`
    (lead | member) carries the app role, so a team lead becomes an app admin.
  * **`is_direct`** distinguishes a grant somebody ticked by hand from one that
    arrived through a team.

So both halves of what he asked for are already there: **a selection** is a
team that grants Connections, and **every seat** is either ticking everyone on
the Members page or one team that contains them all.

Connections needs no change for this. Its gate is `has_app_membership(
'fibre-sales')` plus the workspace having the app switched on — which is what
`app/(app)/layout.tsx` checks on every request.

## Where this lives

`connections-backlog.md` stays the reasoned list: what to build, why, what it
costs, what the decision is. **This file is the receipt** — one row per ask,
so the question "did that get picked up" has an answer that does not depend on
remembering.
