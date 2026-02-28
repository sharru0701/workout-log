#!/usr/bin/env bash
set -euo pipefail

if [ ! -d "node_modules" ] || [ ! -x "node_modules/.bin/next" ]; then
  echo "[docker-dev] installing dependencies..."
  pnpm install --frozen-lockfile
fi

if [ "${SKIP_DB_MIGRATE:-0}" != "1" ]; then
  echo "[docker-dev] running migrations..."
  pnpm db:migrate
fi

if [ "${RUN_DB_SEED:-0}" = "1" ]; then
  echo "[docker-dev] running seed..."
  pnpm db:seed
fi

echo "[docker-dev] starting next dev server..."
exec pnpm dev --hostname 0.0.0.0 --port "${PORT:-3000}"
