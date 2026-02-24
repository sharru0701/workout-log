
# WorkoutLog Deploy
(GCP Ubuntu + Docker Compose + Tailscale-only, No Domain)

------------------------------------------------------------

1) Start / Stop

Start:
    cd /opt/workout-log/deploy
    docker compose up -d --build
    docker compose ps
    docker compose logs -f web

Notes:
    - web container runs DB migrations on startup before Next.js starts.
    - Look for log line: [migrate] migrations applied

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

------------------------------------------------------------

6) Update After Git Pull

    cd /opt/workout-log
    git pull
    cd deploy
    docker compose up -d --build

------------------------------------------------------------

7) CI/CD Deploy Pipeline (GitHub Actions)

- Build tags pushed to GHCR:
  - `latest` (main branch)
  - commit SHA (40 chars)
  - date tag (`YYYYMMDD-HHmmss`)
  - semver tags when pushing `v*.*.*`
- Deploy behavior:
  - deploys by commit SHA image tag
  - runs post-deploy healthcheck on deploy server (default: `http://127.0.0.1:3001/api/health`)
  - on healthcheck failure, rolls back to last successful SHA automatically

Required GitHub Secrets:

    TS_OAUTH_CLIENT_ID
    TS_OAUTH_SECRET
    DEPLOY_SSH_KEY
    DEPLOY_USER
    DEPLOY_HOST
    DEPLOY_HEALTHCHECK_URL   # optional, default: http://127.0.0.1:3001/api/health

------------------------------------------------------------

8) Server Maintenance Scripts

Restart workflow:

    cd /opt/workout-log/deploy
    ./scripts/restart_workoutlog.sh

Restart + pull latest configured tag:

    cd /opt/workout-log/deploy
    PULL_WEB=1 ./scripts/restart_workoutlog.sh

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
