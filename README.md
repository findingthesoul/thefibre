# The Fibre

> Relationship intelligence for purpose-driven work. EU-hosted, GDPR-native, cooperative-owned.

The Fibre is a multi-tenant identity, contact, and relationship platform for a family of purpose-driven apps. See [`docs/fibre-technical-brief-v0.3.md`](docs/fibre-technical-brief-v0.3.md) for the canonical spec.

## App family

| App | Slug | Domain | Status |
|-----|------|--------|--------|
| Landing | — | thefibre.app | Phase 1 |
| Fibre Meet | `fibre-meet` | meet.thefibre.app | Phase 5 |
| The Thread | `the-thread` | thread.thefibre.app | Phase 5 |
| Fibre Sales | `fibre-sales` | sales.thefibre.app | Phase 4 |
| Fibre Learn | `fibre-learn` | learn.thefibre.app | Future |

## Repo layout

```
apps/
  web/        Landing platform (Next.js, Vercel) — stateless, no personal data
  api/        Backend API (Hono/Fastify, Fly.io Frankfurt or Railway EU) — all PII
  meet/       Fibre Meet frontend (future)
  thread/     The Thread frontend (future)
  sales/      Fibre Sales frontend (future)
packages/
  db/         Supabase migrations, RLS policies, generated types
  shared/     Cross-app TypeScript types, constants, schema
  ui/         Tailwind preset + shared React components
  config/     Shared eslint/tsconfig/prettier
docs/         Briefs and architecture documents
```

## Hard rules (see brief §13)

1. **No personal data in Vercel.** Frontend is stateless. All PII through the API.
2. **RLS on every table.** `workspace_id` from JWT, never from URL.
3. **`X-App-ID` header** on every API call.
4. **Soft delete only** for personal data. `deleted_at`, never `DELETE`.
5. **Activity is append-only.** Type + subject only — no content body.
6. **Cursor pagination only.** No offset.
7. **Connection pooling from day one.** PgBouncer transaction mode (port 6543).

## Getting started

```bash
pnpm install
pnpm db:start       # local Supabase via docker
pnpm db:migrate     # apply migrations
pnpm dev            # all apps in parallel
```

## Status

Phase 0 — Foundation. See [`docs/fibre-technical-brief-v0.3.md`](docs/fibre-technical-brief-v0.3.md) §12 for phase plan.
