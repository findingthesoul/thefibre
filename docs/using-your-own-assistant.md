# Using your own assistant with The Fibre

_A short manual for people, not programmers. Written 2026-09-27 for v1.76.0,
after Sjoerd asked: "do we have some instructions how to start using your
Claude to build a business model or a thread? And what are the limits?"_

You can connect the AI assistant you already use — Claude today, ChatGPT and
Gemini CLI in principle — to your Fibre account. Once connected, it can look
at your own data in The Fibre and do a few things for you, in your name, when
you ask. This page says how to connect it, what to ask it, what it will and
will not do, and where the edges are.

There is a second, separate assistant: the **Ask** button inside The Thread.
That one needs nothing installed and runs on your workspace's plan or key.
This page is about the first one, your own assistant.

---

## 1. Connecting, once per workspace

The address is **per workspace**, and Settings → Assistant in The Fibre shows
it for the workspace you have open, with a copy button. It looks like:

```
https://mcp.thefibre.app/your-workspace-slug
```

Why per workspace: Claude treats the address as the connector's identity, so
one address per workspace lets a single Claude hold several workspaces side by
side, each as its own connector — and the connection is tied to the workspace
*in the address*, not to whichever tab happened to be open when you pressed
Allow. To connect a second workspace, switch to it in The Fibre, copy its
address, and add it as another connector. Name each connector for its
workspace, since all of them offer the same tools.

The plain `https://mcp.thefibre.app` still works and connects whatever
workspace you have open at the moment you press Allow. (On the test stack the
host is `mcp.thefibre.tech`.)

**Claude on the web or in the desktop app.** Settings → Connectors → Add
custom connector. Paste the address, give it a name ("The Fibre"). Claude
opens a page in The Fibre that says what it will be able to read and do;
sign in if asked, press **Allow**. Back in Claude, The Fibre appears among
your tools. A connector added on claude.ai also works in the Claude phone
app.

**Claude Code** (the terminal tool), one line:

```
claude mcp add --transport http thefibre https://mcp.thefibre.app
```

then `/mcp` inside a session and follow the same Allow page.

**ChatGPT.** Settings → Connectors → Create (this lives behind "developer
mode" on the paid plans). Paste the same address; the sign-in and Allow page
are the same. The Fibre speaks the standard ChatGPT expects, but nobody has
walked this path yet — if something stops, say so and it gets fixed.

**Gemini.** The Gemini command-line tool can connect to the same address
(an `mcpServers` entry with the address and OAuth). The Gemini app and
website do not take custom connections at the time of writing.

**The connection belongs to one workspace**: the one in the address (or, for
the plain address, the one you had open when you pressed Allow). It stays
with that workspace whatever you switch to in a browser. If you belong to
several workspaces, add one connector per workspace; they coexist. An address
for a workspace you are not a member of is refused on the Allow page — an
address is not an invitation.

**To disconnect**: Settings → Connections → Connected assistants →
Disconnect. The assistant's next request is refused and it offers to sign in
again. You can also remove The Fibre from the assistant's own settings.

---

## 2. What to ask

Ask in your own words. The assistant knows what it may do and picks the right
step; you do not have to name the tools. Some examples that work well:

**Connect (your relationships)**

- "Who should I follow up with this week?"
- "Who needs attention in my landscape?"
- "What do I have on Marja?" — it finds her and reads your notes.
- "What meetings do I have coming up?"
- "Who could introduce me at organisation X?"

**The Thread (your programmes and events)**

- "Which threads do I have running, and how is registration going for the
  autumn course?"
- "Which templates do I have?"
- "Make a new thread from the 'Two-day workshop' template, called 'Facilitation
  basics, spring 2027', starting 12 March."
- "Here is our fellowship schedule [paste a table of dates and steps]. Turn it
  into a thread." — Claude also offers a ready prompt for this, **Plan a
  thread from a schedule**, in its prompt menu. Settings → Connections carries
  a longer paste-in version, **Build a thread from a document**, which asks
  you about pricing, visibility and messages as it goes.

**Business Models (your ventures)**

- "Which business models can I open?"
- "Read me the 'Community kitchen' model and tell me where the break-even is."
- "Here is how our new venture works: [tell the story — what you sell, at what
  price, to how many, what it costs, what you invest]. Build the business
  model for team Kitchen."
- "In 'Community kitchen', set the meal price to 12 euro and the volume to
  400 a month, then save that as scenario 'Ambitious'."
- "Duplicate 'Community kitchen' as 'Community kitchen — two locations' so I
  can try a different structure."

---

## 3. What to expect

**It confirms before it changes anything.** For every write — a new thread,
a schedule laid onto it, a new model, changed numbers, a scenario, a copy — it
tells you what it is about to do, to which thread or model, and waits for
your yes. If your words could mean two models, it asks instead of guessing.

**Threads it makes are drafts.** A thread created this way, and every item on
its timeline, is a draft. Nothing is published, nobody is emailed, no ticket
goes on sale, until you open the thread in The Thread and publish it
yourself. (One thing is not ours: The Thread adds its own standard "You're
enrolled" confirmation message to every new thread. It is there in the draft;
you can edit or remove it.)

**Business models are live, but reversible.** Changed numbers are saved for
the team like any edit in the app. Save a scenario before you experiment, or
ask for a duplicate to play with. The assistant reads a model back and checks
its name before writing, so a slip never lands in the wrong model.

**It sees only what you can see.** It signs in as you. Your workspace, your
teams, your threads, your Connect entries. Nothing more than you would see
yourself, and nothing when you are not asking.

**What it reads goes to the assistant's maker.** When you ask Claude
something about your data, the answer The Fibre gives is sent to Anthropic
as part of your conversation, the same as anything you type into Claude. The
Fibre sends nothing to any assistant on its own. The privacy statement says
the same in longer words.

**It is fast for questions, slower for building.** A question takes a few
seconds. Building a thread from a fourteen-row schedule or a model from a
story is several steps and a minute or two, with confirmations in between.

---

## 4. The limits, honestly

**Things it cannot do yet, on purpose.**

- **Publish, send or sell.** No publishing a thread, no sending a message, no
  enrolling anyone, no payments. Those stay in the app, where you see what you
  are doing.
- **Write in Connect.** It reads your notes and landscape; it does not add a
  note or change a relationship yet. That is the next planned addition.
- **See who registered.** Registration comes back as counts and statuses, not
  names. Participants' details stay in The Thread.
- **Change a running thread.** It creates new threads and lays schedules on
  them. Editing an existing thread's timeline is done in The Thread.
- **Create a business model unless you lead.** Only workspace admins and team
  leads may create or copy models; everyone in the team may read them and
  change numbers.

**Sizes and paces.**

| What | Limit |
|---|---|
| Calls per minute, per connection | 120 — more than a conversation ever needs; a runaway assistant is braked, you are not |
| Turnover generators in one model | 40 |
| Fixed cost lines / settings in one model | 60 each |
| Rows in one schedule | no fixed cap; a long one lands in one go, all as drafts |
| Connection lifetime | stays valid while used; after 90 days without use you sign in again |

**One workspace per connection.** Said above; worth saying twice, because it
is the most common reason for "it says it cannot see my thread".

**It can be wrong.** It is an assistant reading your data, not the app. It
may misread a date in a pasted table, sort a row as a message that you meant
as a meeting, or pick a price you did not say. That is what the confirmation
step and the drafts are for: read what it proposes, correct it, then say yes.
Anything it built is visible in the app straight away, where you fix it like
any other draft.

**Who pays.** Nothing. Your own assistant runs on your own Claude, ChatGPT or
Gemini plan; The Fibre charges nothing for the connection. (The Ask button
inside The Thread is the one that draws on your workspace's plan.)

---

## 5. If something does not work

- **"Sign in to connect this assistant"** — the connection was disconnected,
  or expired after 90 days. Let the assistant sign in again.
- **It cannot find a thread or model you know exists** — check which
  workspace the connection belongs to (Settings → Connections) and which one
  you are in.
- **Claude offers no Fibre tools after Allow** — remove the connector in
  Claude and add it again; a connection made on the old address
  (`…fly.dev/api/v1/mcp`) keeps working but cannot be moved to the new one.
- **ChatGPT or Gemini refuses the address** — tell Sjoerd what it said. The
  server is standard; the path is untested.

For the technical side — how consent, tokens and scopes work — see
`docs/mcp-personal-access-plan.md`.
