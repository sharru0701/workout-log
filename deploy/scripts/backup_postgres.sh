#!/usr/bin/env bash
set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-workoutlog-postgres}"
DB_USER="${DB_USER:-app}"
DB_NAME="${DB_NAME:-workoutlog}"
BACKUP_DIR="${BACKUP_DIR:-/opt/workout-log/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"

if ! docker inspect "${POSTGRES_CONTAINER}" >/dev/null 2>&1; then
  echo "[backup] container not found: ${POSTGRES_CONTAINER}" >&2
  exit 1
fi

if [[ "$(docker inspect -f '{{.State.Running}}' "${POSTGRES_CONTAINER}")" != "true" ]]; then
  echo "[backup] container is not running: ${POSTGRES_CONTAINER}" >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out_file="${BACKUP_DIR}/workoutlog_${timestamp}.sql.gz"

tmp_file="${out_file}.tmp"

echo "[backup] creating dump: ${out_file}"
docker exec "${POSTGRES_CONTAINER}" pg_dump \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  -U "${DB_USER}" \
  "${DB_NAME}" | gzip -9 > "${tmp_file}"
mv "${tmp_file}" "${out_file}"
sha256sum "${out_file}" > "${out_file}.sha256"

# Retention: keep recent backups only
find "${BACKUP_DIR}" -type f -name 'workoutlog_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete
find "${BACKUP_DIR}" -type f -name 'workoutlog_*.sql.gz.sha256' -mtime "+${RETENTION_DAYS}" -delete

echo "[backup] done"
