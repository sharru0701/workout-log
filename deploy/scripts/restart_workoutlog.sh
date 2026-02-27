#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/workout-log/deploy}"
PULL_WEB="${PULL_WEB:-0}"
MIGRATE_FIRST="${MIGRATE_FIRST:-1}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health?checkMigrations=1&requiredTables=program_template,user_setting,ux_event_log,migration_run_log}"
OPS_TOKEN="${OPS_TOKEN:-${OPS_MIGRATION_TOKEN:-}}"
MIGRATION_ALERT_LOOKBACK_MINUTES="${MIGRATION_ALERT_LOOKBACK_MINUTES:-120}"
MIGRATION_ALERT_STRICT="${MIGRATION_ALERT_STRICT:-0}"
LAST_SUCCESSFUL_SHA_FILE=".last_successful_web_sha"

cd "${DEPLOY_DIR}"

if [[ -z "${WEB_IMAGE_TAG:-}" && -s "${LAST_SUCCESSFUL_SHA_FILE}" ]]; then
  candidate_tag="$(tr -d '\r\n' < "${LAST_SUCCESSFUL_SHA_FILE}")"
  if [[ "${candidate_tag}" =~ ^[0-9a-f]{40}$ ]]; then
    export WEB_IMAGE_TAG="${candidate_tag}"
    echo "[restart] using last successful web image tag: ${WEB_IMAGE_TAG}"
  else
    echo "[restart] ignoring invalid ${LAST_SUCCESSFUL_SHA_FILE} value: ${candidate_tag}" >&2
  fi
fi

if [[ -n "${WEB_IMAGE_TAG:-}" ]]; then
  echo "[restart] target web image tag: ${WEB_IMAGE_TAG}"
else
  echo "[restart] target web image tag: latest (default)"
fi

if [[ "${PULL_WEB}" == "1" ]]; then
  echo "[restart] pulling web image"
  docker compose pull web migrate
elif [[ -n "${WEB_IMAGE_TAG:-}" ]]; then
  image_ref="ghcr.io/sharru0701/workout-log-web:${WEB_IMAGE_TAG}"
  if ! docker image inspect "${image_ref}" >/dev/null 2>&1; then
    echo "[restart] image not found locally (${image_ref}); pulling web image"
    docker compose pull web migrate
  fi
fi

if [[ "${MIGRATE_FIRST}" == "1" ]]; then
  echo "[restart] running dedicated migration job"
  docker compose run --rm migrate
fi

echo "[restart] restarting stack"
docker compose up -d postgres web

echo "[restart] waiting for health: ${HEALTH_URL}"
healthy=0
for i in $(seq 1 18); do
  if curl -fsS --max-time 5 "${HEALTH_URL}" >/dev/null; then
    echo "[restart] healthy"
    healthy=1
    break
  fi
  sleep 5
done

if [[ "${healthy}" != "1" ]]; then
  echo "[restart] healthcheck failed after restart" >&2
  docker compose ps
  exit 1
fi

if [[ -n "${OPS_TOKEN}" ]]; then
  MIGRATION_STATUS_URL="http://127.0.0.1:3001/api/ops/migrations?lookbackMinutes=${MIGRATION_ALERT_LOOKBACK_MINUTES}&limit=10"
  echo "[restart] checking migration telemetry alerts"
  migration_payload="$(curl -fsS --max-time 8 -H "x-ops-token: ${OPS_TOKEN}" "${MIGRATION_STATUS_URL}" || true)"

  if [[ -z "${migration_payload}" ]]; then
    echo "[restart] migration telemetry endpoint not reachable" >&2
    if [[ "${MIGRATION_ALERT_STRICT}" == "1" ]]; then
      exit 1
    fi
  else
    echo "[restart] migration telemetry: ${migration_payload}"
    if grep -Eq '"status"[[:space:]]*:[[:space:]]*"critical"' <<<"${migration_payload}"; then
      echo "[restart] migration telemetry reported critical status" >&2
      if [[ "${MIGRATION_ALERT_STRICT}" == "1" ]]; then
        exit 1
      fi
    fi
  fi
fi

docker compose ps
current_image="$(docker inspect -f '{{.Config.Image}}' workoutlog-web 2>/dev/null || true)"
if [[ -n "${current_image}" ]]; then
  echo "[restart] workoutlog-web image: ${current_image}"
fi
exit 0
