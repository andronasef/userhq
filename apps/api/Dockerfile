# syntax=docker/dockerfile:1.7

# Stage 1: Base
FROM node:24-bookworm-slim AS base
COPY --from=oven/bun:1.4.2-slim /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

# Stage 2: Deps (build dependencies for @userhq/api...)
FROM base AS deps
COPY package.json bun.lock bunfig.toml ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile --filter '@userhq/api...'

# Stage 3: Build
FROM deps AS build
COPY packages/types ./packages/types
COPY packages/db ./packages/db
COPY apps/api ./apps/api
RUN bun run --filter '@userhq/types' build && \
    bun run --filter '@userhq/db' build && \
    bun run --filter '@userhq/api' build

# Stage 4: Prod-deps
FROM base AS prod-deps
COPY package.json bun.lock bunfig.toml ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile --production --filter '@userhq/api...'

# Stage 5: Runtime
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    UPLOAD_DIR=/data/uploads

# Copy manifests
COPY package.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

# Copy isolated node_modules trees (root and workspaces)
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=prod-deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy build artifacts and migrations
COPY --from=build /app/packages/types/dist ./packages/types/dist
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY packages/db/migrations ./packages/db/migrations

RUN mkdir -p /data/uploads && chown -R node:node /data

USER node
EXPOSE 4000

CMD ["sh", "-c", "node packages/db/dist/migrate.js && exec node apps/api/dist/main.js"]
