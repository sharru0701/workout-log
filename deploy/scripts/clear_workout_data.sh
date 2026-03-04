#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: clear_workout_data.sh --yes [--skip-backup]

Destructive operation:
- clears workout logs
- clears program store/templates/plans related data
- clears exercise catalog data

Options:
  --yes          required; confirms destructive action
  --skip-backup  skip pre-clear backup (not recommended)
EOF
}

confirm="0"
skip_backup="0"

for arg in "$@"; do
  case "${arg}" in
    --yes)
      confirm="1"
      ;;
    --skip-backup)
      skip_backup="1"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if [[ "${confirm}" != "1" ]]; then
  echo "[clear] refusing to run without --yes" >&2
  usage
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-workoutlog-postgres}"
WEB_CONTAINER="${WEB_CONTAINER:-workoutlog-web}"
DB_USER="${DB_USER:-app}"
DB_NAME="${DB_NAME:-workoutlog}"

if ! docker inspect "${POSTGRES_CONTAINER}" >/dev/null 2>&1; then
  echo "[clear] container not found: ${POSTGRES_CONTAINER}" >&2
  exit 1
fi

if [[ "$(docker inspect -f '{{.State.Running}}' "${POSTGRES_CONTAINER}")" != "true" ]]; then
  echo "[clear] postgres container is not running: ${POSTGRES_CONTAINER}" >&2
  exit 1
fi

if [[ "${skip_backup}" != "1" ]]; then
  echo "[clear] creating pre-clear backup"
  "${SCRIPT_DIR}/backup_postgres.sh"
fi

web_was_running="false"
if docker inspect "${WEB_CONTAINER}" >/dev/null 2>&1; then
  if [[ "$(docker inspect -f '{{.State.Running}}' "${WEB_CONTAINER}")" == "true" ]]; then
    web_was_running="true"
  fi
fi

if [[ "${web_was_running}" == "true" ]]; then
  echo "[clear] stopping web container to prevent writes"
  docker stop "${WEB_CONTAINER}" >/dev/null
fi

cleanup() {
  if [[ "${web_was_running}" == "true" ]]; then
    echo "[clear] restarting web container"
    docker start "${WEB_CONTAINER}" >/dev/null || true
  fi
}
trap cleanup EXIT

show_counts() {
  local label="$1"
  echo "[clear] ${label}"
  docker exec "${POSTGRES_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -P pager=off -c "
SELECT 'program_template' AS table_name, count(*)::int AS count FROM program_template
UNION ALL SELECT 'program_version', count(*)::int FROM program_version
UNION ALL SELECT 'plan', count(*)::int FROM plan
UNION ALL SELECT 'plan_module', count(*)::int FROM plan_module
UNION ALL SELECT 'plan_override', count(*)::int FROM plan_override
UNION ALL SELECT 'generated_session', count(*)::int FROM generated_session
UNION ALL SELECT 'exercise', count(*)::int FROM exercise
UNION ALL SELECT 'exercise_alias', count(*)::int FROM exercise_alias
UNION ALL SELECT 'workout_log', count(*)::int FROM workout_log
UNION ALL SELECT 'workout_set', count(*)::int FROM workout_set
UNION ALL SELECT 'stats_cache', count(*)::int FROM stats_cache
ORDER BY table_name;"
}

show_counts "before clear counts"

echo "[clear] terminating active DB sessions"
docker exec "${POSTGRES_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" \
  >/dev/null

echo "[clear] truncating target tables"
docker exec "${POSTGRES_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
TRUNCATE TABLE
  "workout_set",
  "workout_log",
  "generated_session",
  "plan_override",
  "plan_module",
  "plan",
  "program_version",
  "program_template",
  "exercise_alias",
  "exercise",
  "stats_cache"
RESTART IDENTITY CASCADE;
COMMIT;
SQL

show_counts "after clear counts"
echo "[clear] completed"
