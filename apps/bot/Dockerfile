# Build context is the monorepo root (see docker-compose.yml `bot.build.context`).
FROM node:20-alpine AS base
# Prisma's query engine needs OpenSSL present on Alpine to detect the right build.
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/bot/package.json apps/bot/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS runtime
COPY packages/database packages/database
COPY packages/shared-types packages/shared-types
COPY packages/config packages/config
COPY apps/bot apps/bot
RUN pnpm --filter @telegram-ads/database run generate

WORKDIR /app/apps/bot
ENV NODE_ENV=production
CMD ["node", "--require", "ts-node/register", "src/main.ts"]
