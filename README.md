# The Fibre

The platform behind **The Thread**: a GDPR-native, EU-hosted family of apps
for people who run learning journeys, events, communities and the
relationships around them. Operated by Solidarity Lab B.V. (Rotterdam).

"The Fibre" is the name of the platform and of this repository. The public
product name is "The Thread".

## Where to start

| You want to | Read |
|---|---|
| Understand the system in twenty minutes: what it is, the stack, the size, how it is run, what is fragile | [`docs/technical-overview.md`](docs/technical-overview.md) |
| Make a correct change to the code | [`docs/system-handbook.md`](docs/system-handbook.md) |
| Find a table and what it is for | [`docs/data-model.md`](docs/data-model.md) |
| Land a change or deploy | [`docs/runway.md`](docs/runway.md), then handbook §10 |
| Know what is queued | [`docs/build-plan.md`](docs/build-plan.md), the Open queue |
| Know what shipped and why | [`CHANGELOG.md`](CHANGELOG.md) |
| Build an app against the platform | [`docs/building-on-the-fibre.md`](docs/building-on-the-fibre.md) |

The vision and the data-model intent are in
[`docs/fibre-technical-brief-v0.4.md`](docs/fibre-technical-brief-v0.4.md).
[`CLAUDE.md`](CLAUDE.md) holds the working rules that every LLM session
working in this repository loads automatically; it is worth reading as a
human too.

## The family

One Hono API and ten Next.js apps. The registry that names them, and the
only correct place to read a domain from, is
[`packages/shared/src/branding.ts`](packages/shared/src/branding.ts).

| App | Directory | Production |
|---|---|---|
| The Fibre (the platform) | `apps/web` | thefibre.app |
| The Thread | `apps/thread` | app.thethread.app |
| Meet | `apps/meet` | meet.thethread.app |
| Flow | `apps/flow` | flow.thethread.app |
| Pulse | `apps/pulse` | pulse.thethread.app |
| Members | `apps/membership` | membership.thethread.app |
| Connect | `apps/connections` | connect.thethread.app |
| Models (beta) | `apps/models` | models.thethread.app |
| My Thread (participant portal) | `apps/my` | my.thethread.app |
| Marketing site | `apps/website` | thethread.app |
| API | `apps/api` | thefibre-api.fly.dev |

Staging mirrors all of it on `thefibre.tech`.

## Repo layout

```
apps/            the API and the ten Next.js apps
packages/
  shared/        @thefibre/shared — registry, design tokens, shared UI, i18n
  mcp/           @thefibre/mcp — the app contract as MCP tools
supabase/
  migrations/    the schema; every table and policy is here
e2e/             Playwright specs (run against staging)
scripts/         release, promote, deploy, migration and smoke tooling
docs/            the documents; handbook §13 says which are current
```

## Getting started

```bash
pnpm install
pnpm --filter @thefibre/shared build
pnpm --filter ./packages/mcp build
pnpm dev
```

Node 22 and pnpm 9.12. The API listens on 8080 and the apps on 3000 to 3009.

Two things to know before running anything else:

- **There is no local database in normal use.** `apps/api/.env` points the
  API at a hosted Supabase project, and on most machines that is production.
  Use `apps/api/.env.staging` (`FIBRE_ENV_FILE=.env.staging`) for anything
  that writes.
- **`pnpm db:migrate` pushes migrations to whichever remote project the
  Supabase CLI is linked to.** Do not use it. Use
  `bash scripts/db-push-staging.sh` or `bash scripts/db-push-prod.sh`, which
  link explicitly.

## The rules that are never broken

1. **No personal data in Vercel.** The frontends are stateless; every
   operation on personal data goes through the EU-hosted API.
2. **`X-App-ID` on every API request.**
3. **Row-level security on every table**, and a service-role query filters
   `workspace_id` itself.
4. **Soft delete only** for personal data.
5. **The activity log is append-only**: type and subject, never content.
6. **Cursor pagination only.**
7. **`/api/v1/apps/*` and Thread's public read routes are additive-only**
   published contracts.
8. **A release lands on staging; production moves only on the owner's word.**

The full list with the reasoning is in the handbook, §14.

## Checks

```bash
pnpm verify             # typecheck, unit tests, production smoke, public contract
pnpm test:integration   # against the staging database
pnpm test:e2e           # Playwright against the staging stack
```

In a git worktree, `pnpm verify` needs
`FIBRE_ENV_FILE=<absolute path to apps/api/.env>`.
