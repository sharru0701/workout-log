# Dev DB on Deploy Server

로컬 Docker 없이, 배포 서버의 dev 전용 PostgreSQL에 연결해 개발하는 방법.

- 프로덕션 DB: `workoutlog-postgres` (port 5433, 127.0.0.1 only)
- Dev DB:       `workoutlog-postgres-dev` (port 5435, Tailscale 망)

------------------------------------------------------------

## 1) 배포 서버 최초 설정 (1회)

```bash
cd /opt/workout-log/deploy
```

### 1-1) .env에 dev DB 비밀번호 추가

```bash
echo "DEV_POSTGRES_PASSWORD=원하는비밀번호" >> .env
```

### 1-2) Dev DB 컨테이너 실행

```bash
docker compose -f docker-compose.dev-db.yml up -d
docker compose -f docker-compose.dev-db.yml ps
```

### 1-3) 스키마 마이그레이션 적용

로컬 머신에서 `.env.local`을 원격 dev DB로 설정한 뒤 실행:

```bash
# web/ 디렉터리에서
pnpm db:migrate
```

또는 배포 서버에서 직접 확인:

```bash
docker compose -f docker-compose.dev-db.yml exec postgres-dev \
  psql -U dev -d workoutlog_dev -c '\dt'
```

------------------------------------------------------------

## 2) Dev DB 관리

### 시작 / 정지

```bash
# 시작
docker compose -f docker-compose.dev-db.yml up -d

# 정지 (데이터 유지)
docker compose -f docker-compose.dev-db.yml down

# 정지 + 데이터 삭제 (초기화)
docker compose -f docker-compose.dev-db.yml down -v
```

### 로그 확인

```bash
docker compose -f docker-compose.dev-db.yml logs -f postgres-dev
```

### psql 접속 (서버에서)

```bash
docker compose -f docker-compose.dev-db.yml exec postgres-dev \
  psql -U dev -d workoutlog_dev
```

### 데이터 초기화 (스키마 유지)

```bash
docker compose -f docker-compose.dev-db.yml exec postgres-dev \
  psql -U dev -d workoutlog_dev -c \
  "TRUNCATE workout_logs, program_store, exercise_catalog RESTART IDENTITY CASCADE;"
```

------------------------------------------------------------

## 3) 로컬 개발 환경 설정

### 3-1) Tailscale IP 확인 (배포 서버에서)

```bash
tailscale ip -4
# 예: 100.x.x.x
```

### 3-2) web/.env.local 수정

```env
# 원격 dev DB 사용
DATABASE_URL=postgres://dev:<DEV_POSTGRES_PASSWORD>@<TAILSCALE_IP>:5435/workoutlog_dev

# 로컬 docker DB 사용 (기존)
# DATABASE_URL=postgres://app:app@127.0.0.1:5432/workoutlog
```

### 3-3) 개발 서버 실행

```bash
cd web
pnpm dev
```

Tailscale에 연결된 상태라면 바로 원격 dev DB에 접속됩니다.

------------------------------------------------------------

## 4) 연결 확인

```bash
# 로컬에서 원격 dev DB 연결 테스트
psql "postgres://dev:<DEV_POSTGRES_PASSWORD>@<TAILSCALE_IP>:5435/workoutlog_dev" -c '\dt'
```

------------------------------------------------------------

## 5) 보안 메모

- port 5435는 Tailscale 망에서만 접근 가능 (GCP 방화벽이 외부 트래픽 차단)
- dev 전용 사용자(`dev`) / 별도 데이터베이스(`workoutlog_dev`) 사용
- 프로덕션 DB(`workoutlog`)와 완전히 분리됨
- `.env`의 `DEV_POSTGRES_PASSWORD`는 git에 커밋하지 않음

------------------------------------------------------------

End of document.
