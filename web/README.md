# Workout Log Web

추가 문서:
- `git clone` 직후 온보딩: [`docs/local-dev-after-clone-guide.md`](./docs/local-dev-after-clone-guide.md)
- 기여/형상관리 규칙: [`../CONTRIBUTING.md`](../CONTRIBUTING.md)

## Local Dev (Docker, Recommended)

Run from repository root:

```bash
./dev up
```

What this does:
- starts Postgres (`127.0.0.1:5432`)
- installs dependencies inside container on first run
- runs DB migrations
- starts Next.js dev server on `http://localhost:3000`

Useful commands:

```bash
# stop containers
./dev down

# stop + delete DB data volume
./dev down:volumes

# follow logs
./dev logs

# run seed manually
./dev seed
```

Optional env overrides:

```bash
# run seed automatically at startup
RUN_DB_SEED=1 ./dev up

# run on different host ports
WEB_PORT=3001 POSTGRES_PORT=5433 ./dev up
```

## Local Dev (Without Docker)

```bash
pnpm run dev:check
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Required local env (`.env.local`):

```bash
DATABASE_URL=postgres://app:app@127.0.0.1:5432/workoutlog
NEXT_PUBLIC_APP_URL=http://localhost:3000
WORKOUT_AUTH_USER_ID=local-user
NEXT_PUBLIC_DISABLE_SW=1
```
