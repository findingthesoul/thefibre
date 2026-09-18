# The Fibre over MCP

*Written 2026-09-15, with v0.76.0. `packages/mcp` is the code; this is why it
looks the way it does and how to use it.*

The Model Context Protocol is how an AI assistant — Claude Desktop, Claude
Code, Claude.ai, and a growing list of others — is given tools. An MCP server
describes what it can do; the assistant decides when to do it. `fibre-mcp` is
that server for The Fibre. Point an assistant at it with an app key and the
assistant can do, in conversation, exactly what an external app can do
through the API: link its records to people and organisations, log activity,
publish a programme on The Thread and see who registered, run a process on
Flow.

Exactly that, and not one thing more. That sentence is the design.

## 1. Three decisions

**It holds an app key, never a user's session.** An app key carries one
app's authority in one workspace, bounded by the scopes a workspace admin
ticked when minting it (`docs/building-on-the-fibre.md` §4.3). That is the
right amount of authority for an assistant acting on someone's behalf: it can
be narrowed to "read the links you made and log activity", it dies the moment
the key is revoked or the app suspended, and it never sees another workspace.
A user JWT would hand the assistant the user's full authority in every app —
the exact problem app keys were introduced to end (v0.14.0). So there is no
way to configure one. The credential check in `client.ts` refuses anything
that does not start with `fibre_ak_`.

**Every tool is one line of the API's allow-list.** The app-key route table
in `apps/api/src/middleware/app-context.ts` is default-deny: a key reaches the
routes listed there and nothing else. The MCP server offers one tool per row,
gated on the same scope, and no tool that is not a row. There is no search,
no aggregation, no "helpful" join done on the assistant's side; the assistant
sees what curl would see. `packages/mcp/src/mcp.test.ts` reads the middleware
source at test time and fails if a tool maps onto a route the table does not
accept, or offers itself at a looser scope than the table demands. A new route
on the API side needs a new tool here; a new scope needs adding to the union
in `tools.ts`. Nothing else ever needs to change.

The tool list an assistant receives is filtered by the scopes the key
actually holds (`GET /apps/whoami` at startup). A key without `read:flows`
does not see the Flow tools at all, rather than seeing them and being refused.
The API still checks every call — the filter is a courtesy to the model, not
the enforcement layer.

**The assistant pays for its own tokens.** The Fibre runs no language model.
It answers ordinary API calls, which cost it what any API call costs. The
thinking happens in the user's own Claude, on the user's own subscription.
This is the opposite of building an AI feature *into* the product, where the
platform's API key would be billed for every prompt and completion token and
the feature's cost would scale with how much people used it. MCP puts the
whole capability on the table and the whole bill on the side that chose to
use it.

## 2. Setting it up

The server is a client of the app-key contract, so the steps are the app
onboarding steps from `building-on-the-fibre.md` §4, then two lines of
configuration.

1. **An app.** Either an app you already run, or one registered for the
   purpose (`POST /api/v1/apps/register`, or the demo in
   `apps/api/scripts/demo-third-party-app.mjs`). Its manifest decides which
   `app_entity` names the link tools accept and which activity types
   `fibre_log_activity` may write. Approve it at **Admin → App registry**,
   activate it at **Settings → Apps**.
2. **A key.** Settings → Apps → the app → Manage API keys. Tick only the
   scopes the assistant should have. `read:persons` + `write:activities` is a
   good first key: it can look up the records the app linked and log what
   happened, and nothing else.
3. **Build once.** The package is private to this monorepo for now:

   ```bash
   pnpm --filter @thefibre/mcp build
   ```

4. **Tell the assistant.** Claude Desktop reads `claude_desktop_config.json`:

   ```json
   {
     "mcpServers": {
       "thefibre": {
         "command": "node",
         "args": ["/absolute/path/to/thefibre/packages/mcp/dist/cli.js"],
         "env": {
           "FIBRE_APP_KEY": "fibre_ak_…",
           "FIBRE_API": "https://thefibre-api.fly.dev"
         }
       }
     }
   }
   ```

   Claude Code, one line:

   ```bash
   claude mcp add thefibre -e FIBRE_APP_KEY=fibre_ak_… -- node /absolute/path/to/thefibre/packages/mcp/dist/cli.js
   ```

   `FIBRE_API` defaults to production; point it at
   `https://thefibre-api-staging.fly.dev` with a staging key to rehearse.

On connect the server tells the assistant, in its instructions, which app it
acts as, which workspace, which scopes, and the rules that hold on every call
(no search beyond your own links; activity is append-only and public to the
workspace; registration comes from the public form). When the API refuses
something the assistant is told which scope is missing and asked to say so
rather than work around it.

## 3. What an assistant can do, by scope

| Scope on the key | Tools it unlocks |
|---|---|
| *(any key)* | `fibre_whoami`, `fibre_get_manifest` |
| `write:persons` | `fibre_link_record`, `fibre_link_records` (bulk) |
| `read:persons` | `fibre_get_link`, `fibre_get_person` |
| `read:organisations` | `fibre_get_organisation` |
| `write:organisations` | `fibre_add_org_membership` (and organisation links, checked by the API) |
| `write:activities` | `fibre_log_activity` |
| `read:activities` | `fibre_list_activities` |
| `read:programs` | `fibre_thread_templates`, `fibre_thread_list`, `fibre_thread_get`, `fibre_thread_engagements` |
| `write:programs` | `fibre_thread_publish`, `fibre_thread_update`, `fibre_thread_add_host`, `fibre_thread_add_engagement`, `fibre_thread_update_engagement` |
| `write:messages` | `fibre_thread_delete_engagement`; message-family items in the two engagement writes above |
| `read:enrolments` | `fibre_thread_enrolments` |
| `review:enrolments` | `fibre_thread_approve_enrolment`, `fibre_thread_decline_enrolment`, `fibre_thread_checkin_lookup`, `fibre_thread_checkin` |
| `read:flows` | `fibre_flow_list`, `fibre_flow_get`, `fibre_flow_runs`, `fibre_flow_get_run`, `fibre_flow_get_note` |
| `write:flow_runs` | `fibre_flow_start_run`, `fibre_flow_move_run`, `fibre_flow_add_task`, `fibre_flow_update_task`, `fibre_flow_set_note` |

Deliberately absent, and why:

- **Updating the manifest** (`PUT /apps/:slug/manifest`). The manifest is the
  developer's declaration of what the app is; an assistant redefining its own
  entity mappings mid-conversation is not a feature.
- **Registering an app, minting keys.** Those are human, reviewed acts.
- **Anything on `/persons` or `/organisations` directly.** Not reachable with
  an app key at all; those routes run on a user's RLS identity.
- **Enrolling anyone.** There is no `write:enrolments` scope anywhere.

Two tools pass their body straight through to the API rather than restating
its schema: `fibre_thread_add_engagement` and `fibre_thread_update_engagement`.
The engagement schema is shared with The Thread's own editor and is large;
a second copy here would drift. The API's 400 says exactly which field is off
and the assistant corrects itself.

Every write tool carries MCP annotations (read-only, destructive, idempotent)
so a client that asks before destructive actions asks for `decline` and
`delete engagement` and not for a link.

## 4. HTTP mode

```bash
fibre-mcp --http 3009            # 127.0.0.1:3009/mcp
fibre-mcp --http 3009 --host 0.0.0.0
```

Streamable HTTP, stateless: every request builds a server for the key it
carries in `Authorization: Bearer fibre_ak_…`. The process holds no key of its
own, so one deployment can serve any number of workspaces and apps, and a
revoked key stops working within a minute (whoami is cached per key hash for
60 s). `GET /health` answers without a key. This is the shape a hosted
`mcp.thefibre.app` would take; it is not deployed today.

## 5. Verifying

- `pnpm --filter @thefibre/mcp test` — 46 checks, no network: the allow-list
  cross-check for every tool, scope filtering, bearer + JSON plumbing, error
  rendering, and a real MCP client talking to the server over an in-memory
  transport.
- `apps/api/scripts/verify-external-app.mjs` **step 6b** drives the built
  `dist/cli.js` over stdio against a live API with the keys the script mints:
  the tool list follows the key's scopes, a call returns the same link curl
  got, a tool outside the scopes is not callable, a typo'd activity type comes
  back as a readable tool error, and an activity written through MCP lands.
  Run it against staging after touching either side:

  ```bash
  pnpm --filter @thefibre/mcp build
  FIBRE_VERIFY_CONFIRM=1 FIBRE_ENV_FILE=.env.staging FIBRE_API=https://thefibre-api-staging.fly.dev node apps/api/scripts/verify-external-app.mjs
  ```

  Passed in full on 2026-09-15 against staging, first run.

## 6. Not built yet

- **A hosted server with OAuth, acting as the person.** Today a person mints
  a key and pastes it into a config file, and the server acts as an APP.
  The planned next step is different in kind: sign in from Claude.ai or
  ChatGPT, and the server acts as YOU — which is what Connections needs,
  since a person's network is not an app's records. Planned in full in
  [`mcp-personal-access-plan.md`](mcp-personal-access-plan.md).
- **A first-party assistant app in the catalogue**, so a workspace can switch
  the capability on at Settings → Apps like any other app, with a manifest that
  declares sensible activity types (`assistant_noted`, …).
- **Publishing to npm** as `@thefibre/mcp`, so the config is `npx` rather than
  an absolute path into a checkout.
- **Resources and prompts.** The server offers tools only. The manifest and
  whoami could also be resources; a "prepare a festival" prompt could chain
  the Flow and Thread tools. Neither has a user asking for it yet.
- **Curator-data writes** — when the API grows that surface (§8 of the app
  contract), it gets a tool the same day.

## 7. For whoever maintains this

- A new row in `APP_KEY_ROUTES` → a new entry in `TOOLS` and a sample in the
  test's `SAMPLES` map. The test fails until both exist.
- A new scope in `lib/app-keys.ts` → add it to the `AppScope` union in
  `tools.ts`.
- Describe what a tool does, not which response fields come back. The
  response shapes under `/api/v1/apps/*` are additive-only (CLAUDE.md hard
  rule 8); a description that lists them is a second copy of that promise.
- The package relaxes `exactOptionalPropertyTypes` in its own tsconfig because
  the MCP SDK's types are not written for it. Nothing else in the monorepo
  should follow.
- `packages/mcp/package.json` carries the monorepo version like every other
  workspace package; `scripts/release.sh` derives `packages/*` since v0.76.0.
