
# WorkoutLog Deploy
(GCP Ubuntu + Docker Compose + Tailscale-only, No Domain)

------------------------------------------------------------

1) Start / Stop

Start:
    cd /opt/workout-log/deploy
    docker compose up -d --build postgres
    docker compose run --rm migrate
    docker compose up -d web
    docker compose ps
    docker compose logs -f web

Notes:
    - DB migration is executed by dedicated `migrate` job before web replacement.
    - web startup migration is disabled by default (`WEB_DB_MIGRATE_ENABLED=0`) to avoid multi-replica race.
    - deploy pipeline/restart script both run dedicated migration job before web 교체.
    - Look for log lines:
      - [migrate] run started
      - [migrate] advisory lock acquired
      - [migrate] migrations applied

Stop:
    cd /opt/workout-log/deploy
    docker compose down

------------------------------------------------------------

2) Environment Setup

Create environment file:

    cd /opt/workout-log/deploy
    cp .env.example .env
    nano .env

Example .env:

    POSTGRES_PASSWORD=change-me-strong
    NEXT_PUBLIC_APP_URL=https://<server-hostname>.<tailnet-name>.ts.net

Check Tailscale IP:

    tailscale ip -4

------------------------------------------------------------

3) Tailscale-only Access

Expose localhost:3001 to tailnet over HTTPS (recommended):

    sudo tailscale serve reset
    sudo tailscale serve --bg --https=443 http://127.0.0.1:3001
    tailscale serve status

Access from tailnet device:

    https://<server-hostname>.<tailnet-name>.ts.net/

------------------------------------------------------------

3-1) Migration Status Check (Troubleshooting)

List app tables:

    cd /opt/workout-log/deploy
    docker compose exec -T postgres psql -U app -d workoutlog -c '\dt'

Check applied Drizzle migrations:

    cd /opt/workout-log/deploy
    docker compose exec -T postgres psql -U app -d workoutlog -c 'select id, hash, created_at from "__drizzle_migrations" order by created_at;'

Migration one-shot dry run (no app restart):

    cd /opt/workout-log/deploy
    docker compose run --rm migrate

Check migration telemetry endpoint (requires OPS_MIGRATION_TOKEN):

    curl -fsS -H "x-ops-token: <OPS_MIGRATION_TOKEN>" \
      "http://127.0.0.1:3001/api/ops/migrations?lookbackMinutes=120&limit=10"

------------------------------------------------------------

4) Database Backup / Restore

Automated daily backup + retention (14 days):

    cd /opt/workout-log/deploy
    ./scripts/install_backup_timer.sh
    systemctl list-timers --all | grep workoutlog-backup

Manual backup run:

    sudo systemctl start workoutlog-backup.service
    ls -lah /opt/workout-log/backups

Restore safely into running stack:

    sudo ./scripts/restore_postgres.sh /opt/workout-log/backups/workoutlog_YYYYMMDDTHHMMSSZ.sql.gz --yes

Detailed backup/restore guide:

    /opt/workout-log/deploy/README_BACKUP_RESTORE.md

------------------------------------------------------------

5) Auto Start on Reboot (systemd)

Install service:

    sudo cp /opt/workout-log/deploy/systemd/workoutlog.service /etc/systemd/system/workoutlog.service
    sudo systemctl daemon-reload
    sudo systemctl enable --now workoutlog.service
    sudo systemctl status workoutlog.service

Notes:
    - systemd start now uses `scripts/restart_workoutlog.sh` (migration + healthcheck).
    - if `.last_successful_web_sha` exists, restart uses that SHA as default `WEB_IMAGE_TAG`
      to avoid falling back to an older local `latest` image.

------------------------------------------------------------

6) Update After Git Pull

    cd /opt/workout-log
    git pull
    cd deploy
    docker compose pull web migrate
    docker compose run --rm migrate
    docker compose up -d --no-deps web

------------------------------------------------------------

7) CI/CD Deploy Pipeline (GitHub Actions)

- Build tags pushed to GHCR:
  - `latest` (main branch)
  - commit SHA (40 chars)
  - date tag (`YYYYMMDD-HHmmss`)
  - semver tags when pushing `v*.*.*`
- Deploy behavior:
  - deploys by commit SHA image tag
  - runs dedicated migration job first (`docker compose run --rm migrate`)
  - runs post-deploy healthcheck on deploy server (default: deep health with required tables)
  - optional migration telemetry alert check (`/api/ops/migrations`)
  - on healthcheck failure, rolls back to last successful SHA automatically

Required GitHub Secrets:

    TS_OAUTH_CLIENT_ID
    TS_OAUTH_SECRET
    DEPLOY_SSH_KEY
    DEPLOY_USER
    DEPLOY_HOST
    DEPLOY_HEALTHCHECK_URL   # optional, default: deep health URL
    DEPLOY_OPS_TOKEN         # optional, for migration telemetry alert check

Optional GitHub Variables:

    DEPLOY_MIGRATION_ALERT_LOOKBACK_MINUTES   # default 120
    DEPLOY_MIGRATION_ALERT_STRICT             # 1 => fail deploy on critical telemetry

------------------------------------------------------------

8) Server Maintenance Scripts

Restart workflow:

    cd /opt/workout-log/deploy
    ./scripts/restart_workoutlog.sh

Restart + pull latest configured tag:

    cd /opt/workout-log/deploy
    PULL_WEB=1 ./scripts/restart_workoutlog.sh

Restart without one-shot migration (not recommended):

    cd /opt/workout-log/deploy
    MIGRATE_FIRST=0 ./scripts/restart_workoutlog.sh

Restart + migration telemetry strict check:

    cd /opt/workout-log/deploy
    OPS_TOKEN=<OPS_MIGRATION_TOKEN> MIGRATION_ALERT_STRICT=1 ./scripts/restart_workoutlog.sh

Prune old web images safely (keep 10 newest by default):

    cd /opt/workout-log/deploy
    ./scripts/prune_old_images.sh

Keep only 5 images:

    cd /opt/workout-log/deploy
    KEEP_IMAGES=5 ./scripts/prune_old_images.sh

------------------------------------------------------------

Security Notes:
- Host port 3001 is bound to 127.0.0.1 only
- No public HTTP/HTTPS exposure
- Access restricted via Tailscale
- No domain required

End of document.
