# fibre-mcp

A read-only MCP server over The Fibre API. Phase 1 of
[`docs/ai-assistance-plan.md`](../../docs/ai-assistance-plan.md): one seat,
run locally, against staging, nothing written, nothing deployed.

This README is written for Sjoerd first and for the next builder second. It
explains what the thing is, what it can and cannot see, where it departs from
the plan and why, and how to run it in ten minutes.

## 1. What this is, in plain words

An MCP server is a small program that hands a list of named tools to an
assistant you already use: Claude Desktop, Claude Code, or anything else that
speaks the protocol. The assistant reads the list, decides when a question
needs one, calls it, and gets structured data back. You watch every call.

This one runs on your own machine, over stdin and stdout. Each tool call
becomes an ordinary request to the Fibre API, made **as you**: your user
token, the platform's slug in the app header, and the database's row level
security deciding what comes back. The assistant sees what you see in the
browser. It cannot see more, because the same policies run.

The tools, all reads:

| Tool | Answers |
|---|---|
| `whoami` | Who the assistant is acting as, in which workspace, with which app memberships |
| `search_people`, `get_person` | Find someone, see their card, roles and which apps hold data on them |
| `person_timeline` | What happened with one person, newest first: activity, that notes were written, processes they are in |
| `recent_activity` | The workspace stream, with names filled in |
| `search_organisations`, `get_organisation` | An organisation and the people connected to it |
| `list_threads`, `thread_participants` | A programme, who is enrolled and where each stands, its agenda |
| `who_needs_attention` | Who is drifting, each with the fact that says so in words |
| `today` | What you owe and what needs preparing, on its own lead time |
| `landscape` | The community on one axis (maturity, closeness, cadence, opportunity, contribution) and who moved |
| `open_tasks` | Open Flow tasks, yours or everyone's |
| `agenda` | Your calendar for the next days, attendees matched to people by exact email |

Plus one prompt, `prepare_for_thread`, which is the preparation brief from
plan §4.1 written as a recipe over the tools rather than computed here. The
assistant composes it and you see each step.

## 2. What it does not do, and why each line is where it is

Three gates stack (plan §2). Only the first is ours to design, and it is
deliberately small.

**Gate 1, this code.** Decided in `src/shape.ts`, one allow-list per tool:

- **No writes.** There is no tool that changes anything. Phase 3.
- **Note bodies do not cross.** A note is what a human observed about a real
  person, in their own words. `detect-tags.ts` in Connections already refuses
  to send bodies to a model. The timeline says that a note was written, when,
  of what kind, and whether it set a follow-up. Never what it said. This is
  reversible: one field in one list. It is also worth a conversation before
  reversing.
- **Message content does not cross.** The agenda of a thread returns titles,
  types and times of sessions and scheduled messages, not the email bodies.
- **Nothing spreads a row through.** A new column on the API reaches the
  assistant only when somebody adds it to a list on purpose.

**Gate 2, RLS.** Every read runs on your identity. Another workspace, a person
you cannot see, a thread not shared with you: the database returns nothing,
whatever the tool asks.

**Gate 3, app membership.** Curator data for apps you are not a member of
stays invisible, same as in the browser.

**And what no permission would fix**, because the data does not exist (plan
§6.3): what was said in a conversation, how close you are to someone nobody
rated, and a deal moving stage. On the last one, `routes/pulse.ts` still
writes no activity rows, so a timeline built today never shows a stage
change. Re-checked 2026-09-15. Not fixed here: it is a product decision in
another lane, and phase 1 only reads.

## 3. Where this departs from the plan, and why

The plan's phase 1 says to run on **"the existing workspace app key"**. This
server runs on a **user session** instead. That is the one design decision in
this package, and it needs to be understood rather than accepted.

Checked against `apps/api/src/middleware/app-context.ts` on 2026-09-15. An
app key reaches, for reads:

- the activity stream: person ids, no names;
- threads **its own app** published, and their enrolments;
- flows and runs **its own app** created;
- a link lookup from **its own** record ids to platform ids.

It cannot list, search or read a person. It cannot read a note. It cannot
see a thread a human published in The Thread. The general `/persons` and
`/organisations` routes are deliberately absent from its allow-list, and the
inbox entry that started this already said so. That credential was designed
for an app that brings its own records and links them. It was never designed
for a question about the workspace, and every question in plan §5 would come
back empty through it. A server built on it would prove the plumbing and
nothing about demand, and "stop after phase 1 if nobody asks anything" would
then measure the wrong silence.

A user session answers the questions, and it is the boundary the plan itself
says is right for a seat: "her assistant sees exactly what she sees". So
phase 1 rehearses **phase 2's boundary** without building phase 2's token.
The session is minted the same supported way `verify-external-app.mjs`
already mints one for its admin steps, lasts an hour, and is re-minted
locally. No consent screen, no durable token, nothing deployed.

**The cost, stated plainly.** In the minting mode the local process holds the
service role key in memory, exactly as every script in `apps/api/scripts`
does. It uses it for one thing: minting your session. Every data read goes
through your user token. The trust in phase 1 is therefore in this code, not
in the credential, which is acceptable for one seat on one machine and is
not acceptable as a product. That gap is what phase 2 closes.

If you want to see the app key boundary anyway, that is a small addition, not
a rewrite: `Fibre.get()` would accept a `fibre_ak_` token and the tool list
would shrink to what the allow-list permits. Ask, and it is an afternoon.

## 4. Running it

Prerequisites: the repo checked out, `pnpm install` done, and
`apps/api/.env.staging` present (the file every staging script already reads).

```bash
pnpm --filter @thefibre/mcp build
```

Add one line to `apps/api/.env.staging`, or export it in the shell:

```
FIBRE_USER_EMAIL=sjoerd@soul.com
```

Then register the server with your assistant.

**Claude Code**, from the repo root:

```bash
claude mcp add fibre -- node apps/mcp/dist/server.js
```

**Claude Desktop**, in its MCP settings:

```json
{
  "mcpServers": {
    "fibre": {
      "command": "node",
      "args": ["/absolute/path/to/thefibre/apps/mcp/dist/server.js"]
    }
  }
}
```

On start the server prints one line to stderr saying which API it targets and
whom it acts as. Then ask something. A good first question is
"who am I here", which calls `whoami` and shows you the boundary.

### Variables

| Variable | Default | Meaning |
|---|---|---|
| `FIBRE_ENV_FILE` | `.env.staging` | Which file under `apps/api` to read |
| `FIBRE_USER_EMAIL` | none | The seat to act as. Required in minting mode |
| `FIBRE_JWT` | none | A token pasted from a signed-in browser. Skips minting; lasts an hour |
| `FIBRE_API` | `https://thefibre-api-staging.fly.dev` | Where requests go. `http://localhost:8080` for a local API |
| `FIBRE_APP_ID` | `fibre-platform` | The slug announced in `X-App-ID` |
| `FIBRE_MCP_ALLOW_PRODUCTION` | unset | The server refuses any Supabase project except staging unless this is `1` |

### What was verified, and what was not

Verified here: the package typechecks and builds, its unit tests pass (the
wall tests assert that a note body, an engagement body, form answers and
money fields never appear in any tool output), and an MCP client can start
the server, list fourteen read-only tools and one prompt, get a clean
validation error for a bad id, and get a sentence rather than a stack trace
when the API refuses.

Not verified here: any call against real staging data. The container this
was built in cannot reach the staging API host. The first live run is yours,
and the two things most likely to need a tweak are field names inside
`shape.ts` where a response is nested differently than read from the route
source, and the `agenda` tool, which needs your Google calendar connected.

## 5. What phase 1 is for

To find out whether anybody asks anything. Use it for a week. If the
questions in plan §5 turn out to be questions you actually have, phase 2 is
the seat token and consent screen, and that is the real commitment. If they
are not, this package cost two days and can be deleted with nothing else
depending on it.
