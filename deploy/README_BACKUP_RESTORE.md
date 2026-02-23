# Backup and Restore (WorkoutLog)

This setup targets the existing server layout:
- repo: `/opt/workout-log`
- compose: `/opt/workout-log/deploy/docker-compose.yml`
- postgres container: `workoutlog-postgres`
- backup dir: `/opt/workout-log/backups`

## 1) Install daily automated backups (systemd timer)

Run on server:

```bash
cd /opt/workout-log/deploy
./scripts/install_backup_timer.sh
```

Verify timer:

```bash
systemctl list-timers --all | grep workoutlog-backup
systemctl status workoutlog-backup.timer --no-pager
```

Manual run once:

```bash
sudo systemctl start workoutlog-backup.service
ls -lah /opt/workout-log/backups
```

Retention policy:
- default is 14 days (`RETENTION_DAYS=14` in service unit)
- older `.sql.gz` and matching `.sha256` are deleted automatically
- dumps are generated with `--clean --if-exists` so restores can overwrite existing schema safely

## 2) Restore procedure (safe for running container)

Always restore from a verified backup file.

### Step A: Pre-restore snapshot (recommended)

```bash
sudo systemctl start workoutlog-backup.service
```

### Step B: Restore selected backup

```bash
cd /opt/workout-log/deploy
sudo ./scripts/restore_postgres.sh /opt/workout-log/backups/workoutlog_YYYYMMDDTHHMMSSZ.sql.gz --yes
```

What the script does:
- stops `workoutlog-web` temporarily (if running)
- terminates active DB sessions
- restores SQL with `ON_ERROR_STOP=1`
- restarts `workoutlog-web`

### Step C: Validate after restore

```bash
docker compose ps
curl -fsS http://127.0.0.1:3001/ >/dev/null && echo "web ok"
```

## 3) One-time restore test checklist

Use this once after setup to verify recoverability:
1. Create a fresh backup using the timer service.
2. Restore that backup using `restore_postgres.sh`.
3. Confirm app and DB health checks pass.
4. Keep this note with date/operator in your ops log.
