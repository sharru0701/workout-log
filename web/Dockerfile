FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

FROM base AS deps
# Include .npmrc to use node-linker=hoisted
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS builder
ARG NEXT_PUBLIC_APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}
# Copy only necessary files for build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production

# ✅ build-time fallback env
ENV DATABASE_URL=postgres://app:app@localhost:5432/workoutlog
ENV NEXT_PUBLIC_APP_URL=http://localhost

# Cache .next/cache to speed up builds
RUN --mount=type=cache,id=next,target=/app/.next/cache \
    pnpm build

FROM base AS runner
ARG APP_VERSION=unknown
ENV NODE_ENV=production
ENV PORT=3000
ENV APP_VERSION=${APP_VERSION}
WORKDIR /app

# Standalone output mode only copies necessary files
# node_modules is already inside standalone/
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Copy scripts and migrations manually as they're needed for entrypoint
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/server/db ./src/server/db

EXPOSE 3000
# Migrations run as a dedicated deploy job before the web container is switched.
CMD ["node", "server.js"]
