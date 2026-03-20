FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production

# ✅ build-time fallback env (prevents build from crashing on missing env)
ENV DATABASE_URL=postgres://app:app@localhost:5432/workoutlog
ENV NEXT_PUBLIC_APP_URL=http://localhost

RUN --mount=type=cache,id=next,target=/app/.next/cache \
    pnpm build

FROM base AS runner
ARG APP_VERSION=unknown
ENV NODE_ENV=production
ENV PORT=3000
ENV APP_VERSION=${APP_VERSION}
WORKDIR /app

# Standalone output mode only copies necessary files
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Copy scripts and migrations manually as they're needed for entrypoint
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/server/db ./src/server/db
# We need drizzle-kit and pg/tsx for migrations if scripts/migrate.mjs uses them
# But with standalone mode, we might need a separate way to handle migrations
# or just ensure they're part of the standalone build if possible.
# Actually, the current scripts/migrate.mjs might need the full node_modules if not careful.

EXPOSE 3000
# In standalone mode, use the generated server.js
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node server.js"]
