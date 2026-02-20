
# WorkoutLog Deploy
(GCP Ubuntu + Docker Compose + Tailscale-only, No Domain)

------------------------------------------------------------

1) Start / Stop

Start:
    cd /opt/workout-log/deploy
    docker compose up -d --build
    docker compose ps
    docker compose logs -f web

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
    NEXT_PUBLIC_APP_URL=http://100.xx.yy.zz

Check Tailscale IP:

    tailscale ip -4

------------------------------------------------------------

3) Tailscale-only Access

Expose localhost:3000 to tailnet:

    sudo tailscale serve --http=80 http://127.0.0.1:3000
    tailscale serve status

Access from tailnet device:

    http://<server-tailscale-ip>/

------------------------------------------------------------

4) Database Backup / Restore

Backup:

    docker exec -t workoutlog-postgres pg_dump -U app workoutlog > backup_$(date +%F).sql

Restore:

    cat backup_xxx.sql | docker exec -i workoutlog-postgres psql -U app -d workoutlog

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

Security Notes:
- Port 3000 is bound to 127.0.0.1 only
- No public HTTP/HTTPS exposure
- Access restricted via Tailscale
- No domain required

End of document.
