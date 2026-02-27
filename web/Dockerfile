FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production

# ✅ build-time fallback env (prevents build from crashing on missing env)
ENV DATABASE_URL=postgres://app:app@localhost:5432/workoutlog
ENV NEXT_PUBLIC_APP_URL=http://localhost

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm build

FROM base AS runner
ARG APP_VERSION=unknown
ENV NODE_ENV=production
ENV PORT=3000
ENV APP_VERSION=${APP_VERSION}
WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/server/db/migrations ./src/server/db/migrations
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node node_modules/next/dist/bin/next start -p 3000"]
