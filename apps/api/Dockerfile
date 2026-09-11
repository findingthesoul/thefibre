# syntax = docker/dockerfile:1.7

# ----- Build stage --------------------------------------------------------
FROM node:22-alpine AS build

# Install pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /repo

# Copy lockfile + manifests first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json apps/api/
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src/ packages/shared/src/

# Install all deps (workspace)
RUN pnpm install --frozen-lockfile

# Build the API. The `...` filter modifier tells pnpm "and its workspace deps"
# so @thefibre/shared is compiled first in topological order.
COPY apps/api/src/ apps/api/src/
# tsc needs more than node's default heap here. The API crossed ~2GB during
# v0.69.0 and the remote builder died with "Ineffective mark-compacts near
# heap limit" — a hard ceiling, not a flake: two clean runs failed at the
# same point. The builder has the RAM; node just would not ask for it.
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN pnpm --filter @thefibre/api... build

# Produce a self-contained deploy folder (resolves workspace:* deps,
# strips devDependencies). Lives at /deploy.
RUN pnpm --filter @thefibre/api deploy --prod /deploy

# ----- Runtime stage ------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=build /deploy /app

ENV NODE_ENV=production
ENV API_PORT=8080
EXPOSE 8080

CMD ["node", "dist/server.js"]
