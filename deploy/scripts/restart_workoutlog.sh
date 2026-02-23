#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/workout-log/deploy}"
PULL_WEB="${PULL_WEB:-0}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"

cd "${DEPLOY_DIR}"

if [[ "${PULL_WEB}" == "1" ]]; then
  echo "[restart] pulling web image"
  docker compose pull web
fi

echo "[restart] restarting stack"
docker compose up -d

echo "[restart] waiting for health: ${HEALTH_URL}"
for i in $(seq 1 18); do
  if curl -fsS --max-time 5 "${HEALTH_URL}" >/dev/null; then
    echo "[restart] healthy"
    docker compose ps
    exit 0
  fi
  sleep 5
done

echo "[restart] healthcheck failed after restart" >&2
docker compose ps
exit 1
