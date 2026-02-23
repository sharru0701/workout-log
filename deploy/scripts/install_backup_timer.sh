#!/usr/bin/env bash
set -euo pipefail

REPO_DEPLOY_DIR="${REPO_DEPLOY_DIR:-/opt/workout-log/deploy}"
SYSTEMD_DIR="/etc/systemd/system"

sudo install -m 755 "${REPO_DEPLOY_DIR}/scripts/backup_postgres.sh" /opt/workout-log/deploy/scripts/backup_postgres.sh
sudo install -m 755 "${REPO_DEPLOY_DIR}/scripts/restore_postgres.sh" /opt/workout-log/deploy/scripts/restore_postgres.sh

sudo cp "${REPO_DEPLOY_DIR}/systemd/workoutlog-backup.service" "${SYSTEMD_DIR}/workoutlog-backup.service"
sudo cp "${REPO_DEPLOY_DIR}/systemd/workoutlog-backup.timer" "${SYSTEMD_DIR}/workoutlog-backup.timer"

sudo systemctl daemon-reload
sudo systemctl enable --now workoutlog-backup.timer
sudo systemctl status workoutlog-backup.timer --no-pager
