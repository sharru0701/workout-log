#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup.sql|backup.sql.gz> [--yes]" >&2
  exit 1
fi

BACKUP_FILE="$1"
CONFIRM="${2:-}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-workoutlog-postgres}"
WEB_CONTAINER="${WEB_CONTAINER:-workoutlog-web}"
DB_USER="${DB_USER:-app}"
DB_NAME="${DB_NAME:-workoutlog}"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "[restore] backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if [[ "${CONFIRM}" != "--yes" ]]; then
  echo "[restore] refusing to run without --yes" >&2
  echo "[restore] this will replace current data in ${DB_NAME}" >&2
  exit 1
fi

if ! docker inspect "${POSTGRES_CONTAINER}" >/dev/null 2>&1; then
  echo "[restore] container not found: ${POSTGRES_CONTAINER}" >&2
  exit 1
fi

if [[ "$(docker inspect -f '{{.State.Running}}' "${POSTGRES_CONTAINER}")" != "true" ]]; then
  echo "[restore] postgres container is not running: ${POSTGRES_CONTAINER}" >&2
  exit 1
fi

web_was_running="false"
if docker inspect "${WEB_CONTAINER}" >/dev/null 2>&1; then
  if [[ "$(docker inspect -f '{{.State.Running}}' "${WEB_CONTAINER}")" == "true" ]]; then
    web_was_running="true"
  fi
fi

if [[ "${web_was_running}" == "true" ]]; then
  echo "[restore] stopping web container to prevent writes"
  docker stop "${WEB_CONTAINER}" >/dev/null
fi

cleanup() {
  if [[ "${web_was_running}" == "true" ]]; then
    echo "[restore] restarting web container"
    docker start "${WEB_CONTAINER}" >/dev/null || true
  fi
}
trap cleanup EXIT

echo "[restore] terminating active sessions"
docker exec "${POSTGRES_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null

echo "[restore] restoring from ${BACKUP_FILE}"
if [[ "${BACKUP_FILE}" == *.gz ]]; then
  gzip -dc "${BACKUP_FILE}" | docker exec -i "${POSTGRES_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}" >/dev/null
else
  cat "${BACKUP_FILE}" | docker exec -i "${POSTGRES_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}" >/dev/null
fi

echo "[restore] restore completed successfully"
