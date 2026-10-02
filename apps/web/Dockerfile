# syntax=docker/dockerfile:1.7

# Stage 1: Base
FROM node:24-bookworm-slim AS base
COPY --from=oven/bun:1.4.2-slim /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

# Stage 2: Deps (build dependencies for @userhq/web...)
FROM base AS deps
COPY package.json bun.lock bunfig.toml ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile --filter '@userhq/web...'

# Stage 3: Build
FROM deps AS build
COPY packages/types ./packages/types
COPY apps/web ./apps/web
RUN bun run --filter '@userhq/types' build && \
    bun run --filter '@userhq/web' build

# Stage 4: Runtime
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    VINEXT_TRUST_PROXY=1

COPY --from=build --chown=node:node /app/apps/web/dist/standalone ./

USER node
EXPOSE 3000

CMD ["node", "server.js"]
