# The assistant inside the app

*Written 2026-09-15 with v0.77.0 (Thread 3.51.0); §1.4 and §6 updated the
same day with v0.78.0. Version 1 is built and switched off until a key
exists; §5 is the version 2 that makes it worth having; §6 records what
Sjoerd decided and what is still his to do before production.*

Sjoerd, 2026-09-15: "From a user XP version 2 is way more useful." Agreed.
Version 1 exists so that version 2 has something to stand on: the model call,
the approval gate, the allow-list and the panel are the same in both. What
changes between them is how much the assistant may know and how it talks.

Related: [`mcp.md`](mcp.md) is the other direction — The Fibre plugged into
the person's own Claude. That one costs the platform nothing per token and
sends nothing anywhere the person did not already point it. This one runs a
model on the platform's key, so every design choice below is about what may
leave, and who pays.

## 1. What version 1 is

A small panel in The Thread. An "Ask" button bottom-right opens it. The
organiser types; the assistant answers about their threads and can set things
up for them. Two example conversations it is built for:

> "Make a thread from a template."
> *Lists the templates by name, asks which one, confirms title and start
> date, then proposes:* Create "Athens 2026" from a template — template,
> title, slug, start date. **Yes, do it** / **No**. *On yes: created as a
> draft, with an* Open the thread *button.*

> "How is registration going on Athens?"
> *Counts: 34 registered, 3 waiting for approval, 2 not yet paid, 12 checked
> in. Points to the participants page for who.*

### 1.1 Where the model runs

In the EU API (`apps/api/src/lib/assistant/`), never in a Next.js app — hard
rule 1. The browser calls a server action in The Thread; the action calls
`POST /api/v1/assistant/chat` with the person's own session; the API calls
Anthropic. Nothing about the conversation is stored anywhere: the client holds
the transcript and sends it back each turn, the API logs token counts and
never content.

The model is pinned in one place (`lib/assistant/model.ts`): `claude-opus-5`,
adaptive thinking, effort `medium`, 4096 output tokens per step, at most 8
steps per turn. The server-side refusal fallback is on (`fallbacks:
"default"`), so a safety classifier declining a request re-runs it on the
default chain instead of answering nothing. The key is `ANTHROPIC_API_KEY` on
Fly. **Without it the feature does not exist**: the status route says
`enabled: false`, The Thread renders no button. Nothing visible changes on a
deployment until someone sets the key.

### 1.2 What the assistant may see — the allow-list

This is the design decision, and it is code, not a promise
(`lib/assistant/tools.ts`, tested in `assistant.test.ts`). Every tool result
is built field by field before it goes to the model:

| Tool | What reaches the model |
|---|---|
| `list_threads`, `get_thread` | title, slug, format, status, dates, listing, approval flag, capacity, price, team name, category names, a 400-character plain-text excerpt of the intention |
| `list_templates` | title, scope, format, duration, how many engagements and of which types |
| `enrolment_summary` | **counts only**: total, by status, by payment state, checked in, waiting for approval, completed |
| the three writes | the same thread fields, plus a path to open |

What never reaches it: a participant's name, email, phone, city, answers or
billing; the organiser's own profile row; registration fields; notes of any
kind; the activity log; anything from Connections. The tests feed the tools
rows full of personal data and assert none of it survives.

The one thing this cannot control is **what the person types**. If an
organiser writes "is Marja de Vries registered?", that name goes to Anthropic
as part of the prompt. The assistant cannot answer it (it has counts), and the
intro text says so, but the words still travelled. See §6.

### 1.3 The approval gate

Reads run at once. The first write the model asks for stops the turn; the
proposal — tool, arguments, a one-line label — is parked on the API for
fifteen minutes and shown in the panel with **Yes, do it** and **No**. Only an
approve carrying that proposal's id, from the same signed-in person, runs it,
and it runs **the parked arguments**, not whatever the client's copy of the
conversation says. A tampered transcript cannot turn a rename into an
archive between proposal and approval (`pending.ts`, tested).

Every write is one the person could do themselves: the tools call this API's
own Thread routes with the person's JWT, so RLS, the zod validators and the
slug uniqueness check apply exactly as they do to a click. The assistant has
no authority the person lacks, and an app key cannot reach the route at all.

### 1.4 Cost, and who pays — decided 2026-09-15

Anthropic bills per token, in and out, with no volume tiers. A three-call turn
("make Athens from the Festival template") costs a few cents; a five-turn
conversation 15–30 cents; an organiser who uses it a few times a week well
under a euro a month. The exposure is the worst case: someone holding Enter,
or a loop that keeps hitting its ceilings, is on the order of a dollar a turn.
So the rule, in Sjoerd's words and then in code (`lib/assistant/access.ts`,
tested in `access.test.ts`; migration `20260915120000_assistant_access.sql`):

| Plan | Assistant |
|---|---|
| **Free** | none |
| **Starter, Pro** | on the platform's key, within a daily token budget (`assistant_tokens_day`, default 200,000 in + out per workspace per UTC day; editable per plan on /admin/plans) |
| **Any workspace** | may connect its **own Anthropic key** at Settings → Assistant. That lifts both the plan gate and the budget: Anthropic bills them, and they set their own spend limit in Anthropic's console |

The decision order is own key → plan + budget → off, and every refusal says
why: "not part of the Free plan", "used today's allowance, resets at midnight
UTC, or connect your own key", "not switched on here". Over budget is a
pause, never a cut-off.

The own key is stored in `workspace_assistant`, service-role only, encrypted
with AES-256-GCM under a key derived from `ASSISTANT_KEY_SECRET` — a Fly
secret of its own since v0.78.1, with `SSO_INTERNAL_SECRET` as the fallback
until it exists; each stored value records which one it was written under so
the two rotations stay separate and a later rotation can re-encrypt instead of
asking every workspace to reconnect (`lib/assistant/secret.ts`). It cannot be
hashed like an app key — the API must send it — so it is shown once, kept as
a four-character hint, verified against Anthropic before it is saved, and
never logged. Rotating a secret that rows depend on makes them unreadable,
which surfaces as "connect your key again"; the assistant falls back to the
platform key meanwhile rather than failing.

Usage lands in `assistant_usage` per workspace per day per paying key (turns,
tokens in, tokens out). Members see their own workspace's rows at Settings →
Assistant; the API reads today's platform row before every turn. The brakes
from version 1 stay underneath: 40 turns per person per 10 minutes, 8 model
calls per turn, 4,096 output tokens per call, cached system prompt, and a
usage line per turn in the API log that names the paying key.

**Still to do on the platform side:** a hard monthly spend limit on the
platform key in the Anthropic Console, with an alert at half. That is a
console setting, not code, and the one protection that holds if everything
above fails. Do it when the key is created.

### 1.5 Where the code is

| | |
|---|---|
| `apps/api/src/lib/assistant/model.ts` | model id, client, limits |
| `apps/api/src/lib/assistant/tools.ts` | the tools and the allow-list |
| `apps/api/src/lib/assistant/loop.ts` | one turn, the approval pause |
| `apps/api/src/lib/assistant/pending.ts` | parked writes |
| `apps/api/src/routes/assistant.ts` | `/api/v1/assistant/chat`, `/status` |
| `packages/shared/src/ui/assistant.tsx` | `AssistantPanel` — born shared, mounted by Thread first |
| `apps/thread/components/shell/assistant.tsx` | Thread's mount: labels, server action, navigation |
| `apps/thread/lib/assistant-actions.ts` | the server action |

## 2. Switching it on (staging first)

1. In the Anthropic Console: create the key, set a hard monthly spend limit
   and an alert at half.
2. `fly secrets set ANTHROPIC_API_KEY=sk-ant-… -c fly.staging.toml`
3. The workspace must be on Starter or Pro (Free has no assistant), or have
   connected its own key at Settings → Assistant. On /admin/plans the
   Assistant rows show which tiers have it and the daily budget.
4. Open The Thread on staging. The Ask button appears bottom-right.
5. Try the two conversations in §1. Watch the API log for `[assistant]` lines
   and Settings → Assistant for the day's count.
6. Before production: the privacy statement names Anthropic (§6.1).

## 3. Verifying

- `pnpm --filter @thefibre/api test -- src/lib/assistant` — 11 checks, no
  network: personal data fed in, none out; strict schemas; the parked-write
  contract; a scripted model walking read → propose → approve/decline; refusal
  and runaway handling.
- The panel itself has no automated render check yet. It is hidden until a
  key exists, so nothing shipped visibly; the first look happens on staging
  after step 1 above.

## 4. What is deliberately not in version 1

- **No memory across conversations.** New conversation = blank slate.
- **No streaming.** A turn answers when it is done. Two to eight seconds.
- **No participant data, no notes, no Connections, no other apps.**
- **No voice.** Claude's own apps dictate; this panel types.
- **No per-workspace OFF switch for a plan that includes it.** A Starter or
  Pro workspace that wants no model near its data has no toggle yet; the
  admin can only refrain from using it. Small; §6.2.
- **No writes beyond the thread itself**: no engagements, tickets, prices'
  destinations, certificates, emails to participants.

## 5. Version 2 — notes

What Sjoerd meant by "way more useful", turned into a list. Roughly in the
order each one earns its cost.

1. **Streaming and a real chat feel.** Tokens as they arrive, tool steps
   appearing as they run. `client.beta.messages.stream()` in the loop, a
   streamed response from the route, the panel appending deltas. Pure
   plumbing; the first thing people notice.
2. **The assistant knows where you are.** Open on a thread's page, it should
   know which thread. Pass `thread_id` + page kind from the mount into the
   system prompt as context. Turns "how is registration going on Athens" into
   "how is registration going".
3. **Engagements.** Lay down a session, a reminder, a welcome message on the
   thread being edited — the message family behind the same approval gate,
   with the email consequence spelled out in the proposal card. This is where
   a template-then-tweak workflow becomes conversational.
4. **Participants, once §6.1 is decided.** "Who has not paid?", "approve the
   three waiting", "check in Marja" need names. With a DPA, an EU inference
   region and the privacy statement updated, the allow-list widens to name +
   status for the organiser's own threads — still never answers or billing.
   Without that decision, this item does not exist.
5. **Voice.** Web Speech API dictation into the textarea is a client-side
   afternoon and sends audio nowhere but the browser's own recogniser. A
   transcribed voice *note* stored on a thread is a different feature (audio
   is personal data; storage; a speech provider) and belongs after 4.
6. **Every app, one panel.** Meet, Flow, Membership and Connections mount the
   same `AssistantPanel` with their own tool set; The Fibre's own shell gets
   a cross-app one. Connections' tools stay structure-only whatever §6.1
   decides — notes never go to a model (`connections-data-integrity.md` §9.5).
7. **Memory.** A per-person preference note ("I always start on Mondays",
   "my events are in Dutch") the assistant reads at the start of a turn.
   Small table, person-scoped, deletable in Settings → Privacy.
8. **Metering and the plan — done in v0.78.0**, see §1.4: `assistant_usage`,
   `assistant` + `assistant_tokens_day` feature keys, Settings → Assistant,
   own key per workspace. Left for later: billing overage on the platform key
   (today it pauses instead), and a monthly view on Settings → Plan.
9. **Proactive nudges, carefully.** "Three applications have waited two
   days." A scheduled read of counts, surfaced in the panel's intro, never a
   message sent anywhere.
10. **The MCP server and this panel converge.** When the hosted MCP with OAuth
    exists (`mcp.md` §6), a person's own Claude and the in-app panel are two
    doors onto one tool catalogue. The allow-list should be shared code by
    then, not two copies.

## 6. Decisions — Sjoerd, 2026-09-15

**6.1 What may leave for the model: "Not now — Thread data only."** Decided
by Sjoerd (answered in the Connections session, relayed 2026-09-15; to be
confirmed first-hand): the assistant stays with threads, templates and
counts. No participant names, notes or Connections data go to a model until
a DPA with the provider and an EU endpoint are in place. That is exactly the
allow-list in §1.2, so nothing changes in code; v2 item 4 stays parked behind
those two conditions.

What still has to happen **before the key goes on production**:

- a line in the privacy statement's sub-processor list
  (`packages/shared/src/ui/legal-docs.tsx`) and in
  `data-protection-approach.md` §3, naming Anthropic, the purpose (the in-app
  assistant), what is sent (thread structure, counts, and what the person
  types) and the region;
- a DPA with Anthropic for the platform key, and a decision on pinning
  inference to an EU region (`inference_geo` — the API supports it, the
  account has to). A workspace on its own key has its own relationship with
  Anthropic; the statement should say that too.

**6.2 Who pays — decided, built in v0.78.0.** Free: none. Starter and Pro: an
allowance on the platform key with a daily budget. Any workspace may bring its
own key. See §1.4. Left open, small: a per-workspace OFF switch for a plan
that includes it, and whether over-budget use on the platform key should
ever be billed as overage instead of paused.

**6.3 Model and effort.** `claude-opus-5` at medium effort is the default for
quality. Sonnet 5 would cost about 40 % of it per token. Decide after a week
of `[assistant]` log lines on staging, not before.

**6.4 Thread version.** Thread's sidebar shows 3.51.0 for this. The Ask
button is the first visible chrome change since 3.50; it is hidden until §2
step 1.
