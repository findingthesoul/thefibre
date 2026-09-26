# Business Models — the app (`apps/models`, slug `fibre-models`)

_2026-09-25/26. Sjoerd: "We use the full framework of thethread as a
foundation. Just another app. In the fibre we use the workspace Solidarity
Lab, then we make teams, give people access to a team. They can see the
business models for that team."_

## What it is

One interactive business model per venture: turnover generators, each with
its own volume, price and cost structure; generic fixed costs; one-off
investment; break even (month and units), funding need, cash position; a
monthly projection and totals per year; all shown on a Business Model Canvas
whose nine blocks carry the live numbers. One set of inputs at the bottom of
the page moves everything. The team edits the numbers together; the app
saves them for everyone.

It began as a password-protected static page (solidarity-lab/business-models
on GitHub, which still holds the definitions and a single-file build). Every
hosting option for that was public or paid, and the real need was never a
shared password but *these people, this model* — which The Fibre already
answers with teams.

## The pieces

| Piece | Where | Notes |
|---|---|---|
| Definition contract | `apps/models/lib/engine.ts` (types), `packages/mcp/src/person.ts` `MODEL_SCHEMA_GUIDE` (in words, with an example) | JSON; formulas are arithmetic strings over input ids |
| Engine | `apps/models/lib/engine.ts` | pure; a typed port of the static build's `shared/engine.js`, checked to the dollar against it |
| Page | `apps/models/components/models/*` | canvas, KPIs, years, charts, mix and cost tables, projection, inputs; CSV export; print of the canvas alone |
| Storage | `public.models_model` (`20260925124033_fibre_models_schema.sql`) | `definition` jsonb + `inputs` jsonb, `team_id` nullable, soft delete |
| API | `apps/api/src/routes/models.ts` at `/api/v1/models` | list, teams, create, get, patch (inputs by any member; the rest by admins and leads), delete |
| MCP | `packages/mcp/src/person.ts`, scopes `models:read` / `models:write` | `models_list`, `models_teams`, `models_get`, `models_schema` (local), `models_create` |
| Templates | `apps/models/lib/templates/` | blank, doáb.ai; or paste a definition |
| Chrome | `apps/models/components/shell/*`, `lib/i18n-ui.ts` | the shared shell; six-locale chrome catalogue; sidebar doors to Teams and Members in The Fibre |

## Who sees what

`models_model.team_id` is the whole access story, enforced by RLS:

- a model with a team: that team's **active** members read it and turn the
  dials; a workspace-wide model (`team_id` null): everyone with the app;
- workspace admins see all;
- **create, change the definition, move to another team, delete**: workspace
  admins and the team's **leads** (`mayShape` in the route);
- app membership comes from `app_membership` as always — through "teams as
  access groups" (`team_app_grant`), a team that confers only Business
  Models gives its people a seat in this app and nothing else.

Every API call, from the page or from an assistant, is the person's own JWT
with `X-App-ID: fibre-models`; there is no service-role path.

## A story becomes a model

Two ways in, same result:

1. **Paste.** New business model → "Paste a definition (JSON)". A Claude
   chat writes the definition; the `new-business-model` skill in the
   solidarity-lab/business-models repo knows the format.
2. **MCP.** Connect an assistant in The Fibre (Settings → Connections →
   Assistants) with `models:read` + `models:write`. The assistant reads
   `models_schema`, drafts, confirms name and team, calls `models_create`.

## Beta, on purpose

The catalogue row carries `beta_at` and no `released_at` (Sjoerd, 2026-09-26:
"activate it in beta only"). Settings → Apps shows the switch only to a
workspace whose plan has "Gets new apps early, to test" (`beta_apps`); tick
it for the plan in `/admin/plans`, or move the workspace to the Beta plan in
`/admin/workspaces`. Everyone else sees "not built yet".

`APPS['fibre-models'].available` stays `false` until `models.thethread.app`
serves: `scripts/smoke-prod.mjs` (in `pnpm verify`) probes every available
app's production URL and would refuse every release otherwise. Flip it in
the promotion commit.

## Hosting

Vercel project `thefibre-models` (root `apps/models`), `models.thefibre.tech`
on the `staging` branch, `models.thethread.app` for production (DNS at
TransIP, CNAME to the Vercel host). Env vars as for the other delivery apps
plus `NEXT_PUBLIC_MODELS_URL`; `scripts/verify-vercel-env.mjs` holds the
list. Vercel's own deployment protection is OFF on this project, like the
others — with it on, the custom staging domain bounced to a Vercel login.

## Versions

Its own `VERSION` in `apps/models/app/(app)/layout.tsx` (0.1.0 from
2026-09-25), decoupled from the monorepo number, bumped by hand when
user-facing surfaces ship. Shipped so far: 1.61.0 (the app), 1.61.1 (MCP
tools), 1.61.2 (sidebar doors), 1.61.3 (the tile).
