# Ops Guide - UX Event Cleanup Scheduling

## Purpose
Run `ux_event_log` retention cleanup on a schedule so telemetry storage remains bounded.

- command: `pnpm --dir web run db:cleanup:ux-events`
- default retention: `120` days (`UX_EVENTS_RETENTION_DAYS`)
- dry-run mode: `UX_EVENTS_CLEANUP_DRY_RUN=1`

## Option 1: Linux Cron (Self-hosted)
Run daily at `03:20` server time.

```cron
20 3 * * * cd /home/dhshin/projects/workout-log && UX_EVENTS_RETENTION_DAYS=120 pnpm --dir web run db:cleanup:ux-events >> /var/log/workout-log-ux-cleanup.log 2>&1
```

## Option 2: GitHub Actions (Scheduled)
Create `.github/workflows/ux-events-cleanup.yml` and run with secrets-backed `DATABASE_URL`.

```yaml
name: ux-events-cleanup
on:
  schedule:
    - cron: "20 18 * * *" # UTC daily
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --dir web run db:cleanup:ux-events
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          UX_EVENTS_RETENTION_DAYS: "120"
```

## Option 3: CI Dry-Run Safety Check
Before enabling delete in production schedule, run dry-run for 1-2 days.

```bash
UX_EVENTS_CLEANUP_DRY_RUN=1 UX_EVENTS_RETENTION_DAYS=120 pnpm --dir web run db:cleanup:ux-events
```

## Rollout Checklist
- `0008_lush_polaris` migration applied in production DB.
- `DATABASE_URL` available to scheduler runtime.
- Daily logs monitored for `deletedRows` and failures.
- Dry-run output verified before delete mode.

## Failure Notes
- If `ux_event_log` is missing, job logs `table not found, skipping cleanup` and exits successfully.
- Non-schema errors should fail the job and trigger alert/retry.
