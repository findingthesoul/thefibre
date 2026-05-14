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
