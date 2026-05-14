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

# Copy api source and build
COPY apps/api/src/ apps/api/src/
RUN pnpm --filter @thefibre/api build

# ----- Runtime stage ------------------------------------------------------
FROM node:22-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# Bring over just the things needed at runtime
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/packages/shared/src ./node_modules/@thefibre/shared/src
COPY --from=build /repo/packages/shared/package.json ./node_modules/@thefibre/shared/package.json

# Production-only deps (the tsc-compiled dist still needs these runtime libs)
RUN pnpm install --prod --no-frozen-lockfile

ENV NODE_ENV=production
ENV API_PORT=8080
EXPOSE 8080

CMD ["node", "dist/server.js"]
