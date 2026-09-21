# The Fibre in your own assistant — plan

*Written 2026-09-18 for Sjoerd, who asked on 2026-09-17: "I want to do
something with Connections." This is the plan for route (2) of the two MCP
routes — The Fibre reached FROM a person's own Claude (later ChatGPT), acting
as that person. Route (1), the assistant inside the apps, is
[`assistant-in-app.md`](assistant-in-app.md); what exists today for route (2)
is [`mcp.md`](mcp.md).*

## Status — 2026-09-21, v0.85.0 on staging

Sjoerd said go on 2026-09-21. **P1 and P2 are built and on staging** in one
release: the sign-in (§3.2), the grant (§3.1), the endpoint (§3.3) and the
eleven read tools (§3.4). `apps/api/scripts/verify-mcp-personal.mjs` walks
the whole flow the way a client would — discovery, registration, consent as
a signed-in person, PKCE exchange, initialize, tools/list, a real
Connections read, refresh rotation, disconnect — 32 checks, all green
against the staging database. Two things it found on the first live run
and that the unit tests could not: the endpoint path had to be in the
middleware's public list, and the SDK's default SSE reply was being cut
off by the per-request close (fixed with `enableJsonResponse`).

**P3 is next and needs Sjoerd**: connect Claude Desktop or Claude.ai to
`https://thefibre-api-staging.fly.dev/api/v1/mcp` and walk the consent page
once for real. §8 has the steps. P4 (writes, ChatGPT) waits on that.

## 0. The estimate, corrected

I said "a session or two" in chat. Written out, it is **three to four
sessions**. The part I underweighted is the sign-in: Claude.ai and ChatGPT
connect to a remote MCP server through OAuth 2.1 with a specific shape
(PKCE, dynamic client registration, discovery documents, refresh tokens),
and the platform's existing OAuth provider was built for Circle's simpler
flow. Everything after the sign-in reuses routes that already exist.

## 1. What exists, and what is missing

| Piece | State |
|---|---|
| MCP server, stdio | Shipped (v0.76.0). Runs on the person's machine with an **app key**. |
| MCP server, HTTP | Shipped, stateless, key per request. Not deployed anywhere. |
| Tool catalogue | App-shaped: one tool per app-key route. Threads, counts, Flow, activity. **No Connections** — an app key cannot reach Connections routes, and should not: they are a person's network, not an app's records. |
| OAuth provider | `routes/oauth-provider.ts`: authorize → sign in → code → 15-minute token. Built for Circle SSO. No PKCE, no refresh, no client registration, clients are rows an admin creates. |
| Connections routes | `/api/v1/connections/*` and `/api/v1/notes`: today, attention, agenda, landscape, map, entries, tags, notes. All run as the signed-in user through RLS with `X-App-ID: fibre-sales`. |

**The missing piece is one thing: a way for the API to act as a person on a
request that did not come from their browser.** Once a request from Claude
carries the person's own identity, every Connections route works unchanged,
RLS and all.

## 2. Why this route for Connections, and not the in-app one

Connections is people and notes. The in-app assistant runs on the platform's
key, so the platform sends the data to a model and is the processor of it;
"Thread data only" (assistant-in-app §6.1) and Connections' own rule
(`connections-data-integrity.md` §9.5) both say no to that today.

In the person's own Claude the roles are different. The person asks their
own assistant, which they already have a relationship with, to look at their
own network. The Fibre answers an ordinary API call, as it does for the
browser. Nothing leaves through the platform's own key, and nothing goes
anywhere the person did not point it — the same position Connections already
takes when it lets a person paste a meeting prompt into their own assistant.
The platform's obligation is disclosure, not a new sub-processor: see §6.

## 3. Design

### 3.1 Identity: the connection holds the person's own session

The OAuth flow ends with the person signed in to The Fibre on a consent page.
At that moment the API has their Supabase session. It keeps the **refresh
token** — encrypted, in a service-role-only table, the way Google refresh
tokens already live in `user_connection` and workspace model keys in
`workspace_assistant` — as an `mcp_grant`:

| column | |
|---|---|
| `id` | the grant |
| `user_id`, `workspace_id` | who, where — one workspace per grant, chosen on the consent page |
| `client_id` | which assistant (Claude.ai, Claude Desktop, ChatGPT …) |
| `scopes` | what the person ticked |
| `supabase_refresh_token_ciphertext` | AES-256-GCM under `ASSISTANT_KEY_SECRET`, key-id byte, same code as `secret.ts` |
| `refresh_token_hash` | the OAuth refresh token The Fibre issued to the client, sha256 |
| `created_at`, `last_used_at`, `revoked_at` | |

On each MCP call the API turns the stored refresh token into a fresh Supabase
access token, builds `userClient(jwt)` with it, and calls its own routes.
**Every existing query, policy and validator applies exactly as it does to a
click.** Supabase rotates refresh tokens on use; the new one is written back
each time. Revoking the grant deletes the row; the next call fails closed.

This is the same shape as the in-app assistant's tools (they call the API
with the person's JWT), so the two doors converge on one idea: *the
assistant acts as the person, through the API, never around it.*

### 3.2 Sign-in: what the OAuth provider has to grow

The MCP specification's authorization flow needs, beyond what Circle needed:

- **Protected-resource metadata** (`/.well-known/oauth-protected-resource`)
  and **authorization-server metadata** (`/.well-known/oauth-authorization-server`),
  so a client discovers the endpoints from the MCP URL alone.
- **Dynamic client registration** (`POST /oauth/register`): Claude.ai and
  ChatGPT register themselves. Registered clients land in `oauth_client` with
  `kind = 'mcp'`; they carry no secret (public clients) and prove themselves
  with PKCE.
- **PKCE** on `/authorize` + `/token` (`code_challenge` S256).
- **Refresh tokens**, rotated on use, so a connection survives longer than
  15 minutes without the person signing in again.
- **A consent page** in The Fibre (web), not Membership's `/oauth-continue`:
  it shows which assistant is asking, lets the person pick the workspace,
  shows the scopes in plain words, and records the grant.
- **Scopes**, coarse and few: `connections:read`, `connections:write`,
  `thread:read`, `thread:write`. What a tool may do is decided by the
  person's real permissions; the scope only narrows.

The token endpoint stays stateless for access tokens (short HS256 JWT
carrying the grant id, as today) and stateful for refresh tokens (the hash
on the grant row).

### 3.3 Where the server runs

Inside the API, at `/api/v1/mcp`. The MCP SDK's web-standard Streamable HTTP
transport takes a `Request` and returns a `Response`, which is what a Hono
handler has. No second Fly app, no new domain, one place to brake and log.
The stdio server in `packages/mcp` stays for people who prefer an app key on
their own machine; the person-shaped tool catalogue is born in that package
too (`person-tools.ts`), so the two catalogues live side by side and share
the client, the tests and the docs.

A public HTTPS address is the one hard prerequisite. `thefibre-api.fly.dev`
works today; `api.thefibre.app` (still on the not-shipped list) would be the
address to print.

### 3.4 Tools, version 1 — read only

Each tool is one existing route, called as the person with `X-App-ID:
fibre-sales`. Results are the route's answer shaped for a model, the way the
in-app tools shape theirs — but here the person's data IS the point, so
names and notes are in.

| Tool | Route | Answers |
|---|---|---|
| `connections_today` | `GET /connections/today` | who is waiting for you, the horizon |
| `connections_attention` | `GET /connections/attention` | the five conditions, who is in each |
| `connections_agenda` | `GET /connections/agenda` | what is coming up, with whom |
| `connections_landscape` | `GET /connections/landscape` | bands and axes, who is where |
| `connections_person` | `GET /connections/map/:personId/neighbourhood` + `GET /notes?person=` | one person: where they sit, who they connect to, your notes on them |
| `connections_entries` | `GET /connections/entries` | who can get you in where |
| `connections_search` | the existing contact search route | find a person by name, to get an id |

Plus the Thread reads the in-app assistant already has (threads, templates,
enrolment counts), as the person.

### 3.5 Version 2 — writes, behind a confirmation

`connections_add_note` (`PUT /notes`, with the client-supplied id that makes
a retry free — `connections-data-integrity.md` §4.1), `connections_set_follow_up`.
MCP has no approval card of its own; Claude's clients ask before a tool the
server marks as non-read-only, and the tool descriptions say plainly what
will be written. Provenance: notes written this way carry `source = 'mcp'`
and the client id, per §4.3 of the integrity doc.

## 4. The work, in order

| Phase | Deliverable | Effort |
|---|---|---|
| **P1 — sign-in** ✅ v0.85.0 | Discovery documents, dynamic registration, PKCE, refresh tokens, `mcp_grant` table + migration, consent page in The Fibre web (`/connect`), revoke list on Settings → Connections ("Assistants connected to your account"). The grant is resolved in the MCP handler itself rather than a new auth kind in `app-context.ts`: the tools call the API's own routes with the person's JWT, so the middleware never needed to learn a third credential. Tests: `lib/mcp/mcp.test.ts` (PKCE, discovery, our tokens) + the live walk in `verify-mcp-personal.mjs`. | done |
| **P2 — the server and the read tools** ✅ v0.85.0 | `/api/v1/mcp` on the API (stateless, JSON responses), `person.ts` in `packages/mcp` — seven Connections reads + four Thread reads, per-grant brake, one log line per call (grant, workspace, status, ms — never content). Tests: `packages/mcp/src/person.test.ts` — every tool is a GET as the person with the owning app's `X-App-ID`; the list follows the scopes; a real MCP client over an in-memory transport. | done |
| **P3 — first live turns** | Sjoerd connects Claude Desktop and Claude.ai to staging (§8), walks the consent page once for real, and we fix whatever a real client does differently from the script. | ½ session, needs Sjoerd |
| **P4 — writes + ChatGPT** | Add note, set follow-up, provenance; then connect ChatGPT (its OAuth client behaves differently enough to count as its own check). | ½–1 session |
| **P5 — later** | `api.thefibre.app`; a Thread-as-person catalogue that replaces the app-key one for people (the two MCP doors converge); metering per grant if use grows. | — |

Total: **three to four sessions**, P1 and P2 sequential, P3 and P4 short.

## 5. Guards that hold throughout

- **No new credential class.** The stored thing is the person's own Supabase
  refresh token, held the way Google's already is. The API never gains a
  way to act as someone without their session.
- **RLS is the enforcement layer**, as everywhere: the tools reach nothing
  the person could not see in the app.
- **One workspace per grant**, chosen at consent. Switching workspace is a
  second grant, not a hidden parameter.
- **Revocable in one click**, and visible: Settings → Connections lists every
  assistant connected, with last use.
- **Braked**: per grant, the same in-memory brake as the assistant; Anthropic
  and OpenAI pay for the tokens, The Fibre only answers API calls.
- **Logged as usage, never content.**

## 6. Decisions for Sjoerd

1. **Go.** This is a different product from the in-app assistant and a
   different compliance position. Confirm the read-only v1 scope in §3.4.
2. **Disclosure line.** The privacy statement should say: *if you connect
   your own AI assistant to your account, the data you ask it for is sent to
   that assistant's provider on your instruction; The Fibre does not send
   anything to it otherwise.* Not a sub-processor entry — a user-directed
   transfer — but it must be written down before production. Lawyer-unreviewed
   like the rest of that page.
3. **Grant lifetime.** Proposal: refresh tokens live 90 days without use,
   then the person signs in again. Shorter is safer, longer is kinder.
4. **Where the consent page lives.** Proposal: The Fibre web
   (`thefibre.app/connect`), since it is an account-level act, not an app's.
5. **Address.** `thefibre-api.fly.dev/api/v1/mcp` for staging and first
   production use, or do the `api.thefibre.app` CNAME first so the printed
   address never changes.

## 8. Connecting for real (P3) — for Sjoerd

The staging API is the server; nothing needs to be installed.

**Claude Desktop** (or Claude.ai → Settings → Connectors → Add custom
connector): give it the URL

```
https://thefibre-api-staging.fly.dev/api/v1/mcp
```

It reads the discovery documents, registers itself, and opens a browser
tab on `thefibre.tech/connect`. Sign in if asked, read what it will be able
to read, press **Allow**. The tab returns to Claude; the tools appear.

**Claude Code**, one line:

```bash
claude mcp add --transport http thefibre-staging https://thefibre-api-staging.fly.dev/api/v1/mcp
```

then `/mcp` inside a session to sign in the same way.

**Then ask**: "Who should I follow up with this week?" — it should call
`connections_today`, then `connections_attention`. "What do I have on
Marja?" — `connections_search`, then `connections_person`.

**To disconnect**: Settings → Connections → Assistants connected → Disconnect.
The next call from the assistant is refused and it will offer to sign in again.

**Two things to know on staging**: the API answers on the fly.dev address
(§6.5 — `api.thefibre.app` would make the printed URL permanent), and the
grant follows the workspace you had active in The Fibre when you pressed
Allow. If you switch workspace in the browser afterwards, the assistant is
told so and asks you to switch back or connect again.

## 7. What this does not do

- It does not put a model near Connections data on the platform's key. The
  in-app assistant stays out of Connections until §6.1 of its doc changes.
- It does not give an assistant any authority the person lacks.
- It does not replace the app-key MCP; external systems without a person
  behind them still use that.
